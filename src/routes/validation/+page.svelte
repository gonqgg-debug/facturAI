<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { currentInvoice, apiKey, isProcessing } from '$lib/stores';
  import { db } from '$lib/db';
  import { recalculateInvoice, validateNcf, getNcfType, recalculateFromTotal } from '$lib/tax';
  import { parseInvoiceWithGrok } from '$lib/grok';
  import { Save, RefreshCw, AlertTriangle, Check, TrendingUp, TrendingDown, Brain, Link, Package, Calendar, Search, Plus, X, Sparkles, ArrowRight } from 'lucide-svelte';
  import type { Supplier, Product, StockMovement } from '$lib/types';
  import { findProductMatches, autoLinkInvoiceItems, type MatchResult, type ProductMatch } from '$lib/matcher';
  import { checkLowStock, generateStockUpdateAlerts, type StockAlert } from '$lib/alerts';
  import * as Sheet from '$lib/components/ui/sheet';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Table from '$lib/components/ui/table';
  import * as Select from '$lib/components/ui/select';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import * as Card from '$lib/components/ui/card';
  import { Separator } from '$lib/components/ui/separator';
  import { Button } from '$lib/components/ui/button';

  let invoice = $currentInvoice;
  let suppliers: Supplier[] = [];
  let selectedSupplierId: number | null = null;
  let products: Product[] = [];
  let allProducts: Product[] = []; // All products for fuzzy matching
  let priceAlerts: Record<number, { type: 'up' | 'down', diff: number, lastPrice: number, lastDate: string }> = {};
  let isSaving = false;
  let showReasoning = false;
  let stockAlerts: StockAlert[] = [];
  let showStockAlerts = false;
  
  // Discard confirmation state
  let discardDialogOpen = false;

  // Fuzzy Match State
  let fuzzyMatches: Record<number, MatchResult> = {};

  // Enhanced Product Linking State
  let showProductLinker = false;
  let activeLinkIndex: number | null = null;
  let productSearchQuery = '';
  let filteredLinkProducts: Product[] = [];
  let linkerMode: 'suggestion' | 'search' | 'create' = 'suggestion';
  let currentSuggestion: MatchResult | null = null;
  let searchInputRef: HTMLInputElement | null = null;
  let newProductName = '';

  onMount(async () => {
    if (!invoice) {
      goto('/capture');
      return;
    }
    suppliers = await db.suppliers.toArray();
    allProducts = await db.products.toArray(); // Load all products for fuzzy matching
    
    // Auto-match supplier by name or RNC
    const match = suppliers.find(s => 
      s.rnc === invoice?.providerRnc || 
      s.name.toLowerCase().includes(invoice?.providerName?.toLowerCase() || '')
    );
    if (match && match.id) {
      selectedSupplierId = match.id;
      // Auto-calculate due date based on supplier credit days
      if (match.defaultCreditDays && invoice.issueDate) {
        const issueDate = new Date(invoice.issueDate);
        issueDate.setDate(issueDate.getDate() + match.defaultCreditDays);
        invoice.dueDate = issueDate.toISOString().split('T')[0];
        invoice.creditDays = match.defaultCreditDays;
      }
    }
    
    // Initial calc
    handleRecalc();
    // Run fuzzy matching on all items
    runFuzzyMatching();
  });

  $: if (selectedSupplierId) {
    loadProducts(selectedSupplierId);
    updateDueDate(selectedSupplierId);
  }

  async function loadProducts(supplierId: number) {
    products = await db.products.where('supplierId').equals(supplierId).toArray();
    autoLinkProducts();
    checkPrices();
  }

  function updateDueDate(supplierId: number) {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (supplier?.defaultCreditDays && invoice?.issueDate) {
      const issueDate = new Date(invoice.issueDate);
      issueDate.setDate(issueDate.getDate() + supplier.defaultCreditDays);
      invoice.dueDate = issueDate.toISOString().split('T')[0];
      invoice.creditDays = supplier.defaultCreditDays;
    }
  }

  function runFuzzyMatching() {
    if (!invoice || !invoice.items || allProducts.length === 0) return;
    
    const newMatches: Record<number, MatchResult> = {};
    
    invoice.items.forEach((item, index) => {
      if (item.productId) return; // Skip already linked
      
      const result = findProductMatches(item.description, allProducts);
      if (result.fuzzyMatches.length > 0) {
        newMatches[index] = result;
        
        // Auto-link if high confidence
        if (result.confidence === 'high' && result.exactMatch) {
          invoice.items[index].productId = result.exactMatch.productId || result.exactMatch.barcode;
        }
      }
    });
    
    fuzzyMatches = newMatches;
  }

  function autoLinkProducts() {
    if (!invoice || !invoice.items) return;
    
    // Use fuzzy matching for better results
    const linkResults = autoLinkInvoiceItems(invoice.items, allProducts.length > 0 ? allProducts : products);
    
    invoice.items = invoice.items.map((item, index) => {
        // If already linked, skip
        if (item.productId) return item;

        const linkResult = linkResults.find(r => r.index === index);
        if (linkResult?.autoLinked && linkResult.matchResult.exactMatch) {
            const matchedProduct = linkResult.matchResult.exactMatch;
            return { 
                ...item, 
                productId: matchedProduct.productId || matchedProduct.barcode 
            };
        }
        return item;
    });
    
    // Update fuzzy matches for UI display
    const newMatches: Record<number, MatchResult> = {};
    linkResults.forEach(result => {
      if (!result.autoLinked && result.matchResult.fuzzyMatches.length > 0) {
        newMatches[result.index] = result.matchResult;
      }
    });
    fuzzyMatches = newMatches;
  }

  function checkPrices() {
    if (!invoice || !invoice.items) return;
    
    const newAlerts: typeof priceAlerts = {};
    
    invoice.items.forEach((item, index) => {
      if (!item.description) return;
      
      // Simple fuzzy match or exact match
      // For now, let's do exact match on description (case insensitive)
      const product = products.find(p => p.name.toLowerCase() === item.description.toLowerCase());
      
      if (product && item.unitPrice) {
        const diff = item.unitPrice - product.lastPrice;
        // Only alert if difference is significant (> 1%)
        if (Math.abs(diff) > (product.lastPrice * 0.01)) {
          newAlerts[index] = {
            type: diff > 0 ? 'up' : 'down',
            diff: diff,
            lastPrice: product.lastPrice,
            lastDate: product.lastDate
          };
        }
      }
    });
    
    priceAlerts = newAlerts;
  }

  function handleRecalc() {
    if (invoice) {
      invoice = recalculateInvoice(invoice as any);
      currentInvoice.set(invoice);
      checkPrices();
    }
  }

  function handleTotalChange(index: number) {
    if (!invoice || !invoice.items) return;
    // Recalculate this specific item from its total
    invoice.items[index] = recalculateFromTotal(invoice.items[index]);
    // Then update the global totals
    handleRecalc();
  }

  async function handleSave() {
    if (!invoice) return;
    if (!selectedSupplierId && !invoice.providerName) {
      alert('Please select or enter a provider.');
      return;
    }

    isSaving = true;
    const updatedProducts: Array<{ product: Product; quantityAdded: number; previousStock: number }> = [];
    
    try {
      // 1. Save/Update Supplier if needed
      let supplierId = selectedSupplierId;
      if (!supplierId) {
        // Create new supplier
        supplierId = await db.suppliers.add({
          name: invoice.providerName || 'Unknown',
          rnc: invoice.providerRnc || '',
          examples: []
        }) as number;
      }

      // 2. Save Invoice with payment status
      const finalInvoice = {
        ...invoice,
        status: 'verified' as const,
        paymentStatus: 'pending' as const,
        providerName: suppliers.find(s => s.id === supplierId)?.name || invoice.providerName,
        // Ensure createdAt is a Date object (JSON serialization converts it to string)
        createdAt: invoice.createdAt ? new Date(invoice.createdAt) : new Date()
      };
      
      // Remove the id if it exists (let Dexie auto-generate a new one)
      const { id: _, ...invoiceWithoutId } = finalInvoice;
      const invoiceId = await db.invoices.add(invoiceWithoutId as any) as number;

      // 3. Train (Optional - auto add to examples)
      // We update the supplier's examples with this validated one
      const supplier = await db.suppliers.get(supplierId);
      if (supplier) {
        const newExamples = [...(supplier.examples || []), finalInvoice];
        // Keep last 5
        if (newExamples.length > 5) newExamples.shift();
        await db.suppliers.update(supplierId, { examples: newExamples as any });
      }

      // 4. Update Product Prices AND Stock (for Inventory category)
      const isInventoryInvoice = invoice.category === 'Inventory';
      const today = new Date().toISOString().split('T')[0];
      
      if (invoice.items) {
        for (const item of invoice.items) {
          if (item.description && item.unitPrice) {
            let existing: Product | undefined;

            // Try to find by Product ID/Barcode first
            if (item.productId) {
                existing = await db.products.where('productId').equals(item.productId).first();
                if (!existing) {
                  existing = await db.products.where('barcode').equals(item.productId).first();
                }
            }

            // Fallback to Name + Supplier match
            if (!existing) {
                existing = await db.products
                  .where('[supplierId+name]')
                  .equals([supplierId, item.description])
                  .first();
            }

            if (existing && existing.id) {
              const previousStock = existing.currentStock ?? 0;
              const updateData: Partial<Product> = {
                lastPrice: item.unitPrice,
                lastDate: invoice.issueDate || today
              };
              
              // Update stock if this is an inventory invoice
              if (isInventoryInvoice) {
                updateData.currentStock = previousStock + item.quantity;
                updateData.lastStockUpdate = today;
                
                updatedProducts.push({
                  product: { ...existing, currentStock: updateData.currentStock },
                  quantityAdded: item.quantity,
                  previousStock
                });
                
                // Create stock movement record
                const movement: StockMovement = {
                  productId: existing.id,
                  type: 'in',
                  quantity: item.quantity,
                  invoiceId: invoiceId,
                  date: today,
                  notes: `Invoice from ${invoice.providerName}`
                };
                await db.stockMovements.add(movement);
              }
              
              await db.products.update(existing.id, updateData);
            } else {
              // Create new product
              const newProductData: Partial<Product> = {
                supplierId,
                name: item.description,
                productId: item.productId,
                lastPrice: item.unitPrice,
                lastDate: invoice.issueDate || today,
                category: invoice.category === 'Inventory' ? undefined : invoice.category
              };
              
              // Set initial stock if inventory invoice
              if (isInventoryInvoice) {
                newProductData.currentStock = item.quantity;
                newProductData.lastStockUpdate = today;
              }
              
              const newProductId = await db.products.add(newProductData as Product) as number;
              
              // Create stock movement for new product
              if (isInventoryInvoice) {
                const movement: StockMovement = {
                  productId: newProductId,
                  type: 'in',
                  quantity: item.quantity,
                  invoiceId: invoiceId,
                  date: today,
                  notes: `Invoice from ${invoice.providerName} (new product)`
                };
                await db.stockMovements.add(movement);
                
                updatedProducts.push({
                  product: { ...newProductData, id: newProductId } as Product,
                  quantityAdded: item.quantity,
                  previousStock: 0
                });
              }
            }
          }
        }
      }

      // 5. Generate and show stock alerts
      if (isInventoryInvoice && updatedProducts.length > 0) {
        stockAlerts = generateStockUpdateAlerts(updatedProducts);
        
        // Also check for low stock across all products
        const allUpdatedProducts = await db.products.toArray();
        const lowStockAlerts = checkLowStock(allUpdatedProducts);
        if (lowStockAlerts.length > 0) {
          stockAlerts = [...stockAlerts, ...lowStockAlerts];
        }
        
        if (stockAlerts.length > 0) {
          showStockAlerts = true;
        }
      }

      if (!showStockAlerts) {
        alert('Invoice Saved!');
        goto('/history');
      }
    } catch (e) {
      console.error('Invoice save error:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      alert(`Error saving invoice: ${errorMessage}`);
    } finally {
      isSaving = false;
    }
  }
  
  function dismissStockAlerts() {
    showStockAlerts = false;
    goto('/history');
  }

  async function handleReanalyze() {
    if (!invoice || !$apiKey) return;
    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    
    isProcessing.set(true);
    try {
      const newData = await parseInvoiceWithGrok(invoice.rawText || '', $apiKey, supplier);
      // Merge carefully, keeping user edits if possible? 
      // For now, overwrite is safer if they asked for re-analysis
      currentInvoice.set({
        ...invoice,
        ...newData
      });
      invoice = $currentInvoice;
      handleRecalc();
    } catch (e) {
      alert('Re-analysis failed');
    } finally {
      isProcessing.set(false);
    }
  }

  function addLine() {
    if (!invoice) return;
    invoice.items = [...(invoice.items || []), {
      description: '',
      quantity: 1,
      unitPrice: 0,
      priceIncludesTax: false,
      taxRate: 0.18,
      value: 0,
      itbis: 0,
      amount: 0
    }];
    handleRecalc();
  }

  function removeLine(index: number) {
    if (!invoice || !invoice.items) return;
    invoice.items = invoice.items.filter((_, i) => i !== index);
    handleRecalc();
  }
  function confirmDiscard() {
    discardDialogOpen = true;
  }

  function executeDiscard() {
    currentInvoice.set(null);
    discardDialogOpen = false;
    goto('/capture');
  }

  // Image Viewer State
  let imageZoom = 1;
  let imagePan = { x: 0, y: 0 };
  let isDragging = false;
  let startPan = { x: 0, y: 0 };

  function handleWheel(e: WheelEvent) {
    // e.preventDefault() is handled by the modifier in the markup
    const delta = e.deltaY * -0.002; // Adjusted sensitivity
    imageZoom = Math.min(Math.max(0.1, imageZoom + delta), 5);
  }

  function handleMouseDown(e: MouseEvent) {
    isDragging = true;
    startPan = { x: e.clientX - imagePan.x, y: e.clientY - imagePan.y };
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    imagePan = { x: e.clientX - startPan.x, y: e.clientY - startPan.y };
  }

  function handleMouseUp() {
    isDragging = false;
  }

  // Smart Learning
  async function handleLearnRule(item: any) {
    if (!selectedSupplierId) {
      alert('Please select a supplier first.');
      return;
    }

    const rule = prompt(
      `Teach the AI a rule for "${item.description}"?\n\nExample: "Always convert '${item.description}' to ${item.quantity} units"`,
      `When you see "${item.description}", set Quantity to ${item.quantity}`
    );

    if (rule) {
      const supplier = await db.suppliers.get(selectedSupplierId);
      if (supplier) {
        const newRules = (supplier.customRules ? supplier.customRules + '\n' : '') + `- ${rule}`;
        await db.suppliers.update(selectedSupplierId, { customRules: newRules });
        alert('Rule learned! It will be applied next time.');
      }
    }
  }

  // Keyboard Navigation
  function handleKeydown(e: KeyboardEvent, rowIndex: number, colIndex: number) {
    const target = e.target as HTMLInputElement;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextRow = document.querySelector(`[data-row="${rowIndex + 1}"][data-col="${colIndex}"]`) as HTMLInputElement;
      if (nextRow) nextRow.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevRow = document.querySelector(`[data-row="${rowIndex - 1}"][data-col="${colIndex}"]`) as HTMLInputElement;
      if (prevRow) prevRow.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const nextRow = document.querySelector(`[data-row="${rowIndex + 1}"][data-col="${colIndex}"]`) as HTMLInputElement;
      if (nextRow) {
        nextRow.focus();
      } else {
        // If last row, add new line
        addLine();
        // Wait for render then focus
        setTimeout(() => {
          const newRow = document.querySelector(`[data-row="${rowIndex + 1}"][data-col="0"]`) as HTMLInputElement;
          if (newRow) newRow.focus();
        }, 50);
      }
    }
  }
  // Enhanced Product Linking Logic
  async function openProductLinker(index: number) {
    if (!invoice || !invoice.items) return;
    activeLinkIndex = index;
    const itemDescription = invoice.items[index].description || '';
    productSearchQuery = itemDescription;
    newProductName = itemDescription;
    
    // Check if already linked
    const existingProductId = invoice.items[index].productId;
    if (existingProductId) {
      const linkedProduct = allProducts.find(p => p.productId === existingProductId || p.barcode === existingProductId);
      if (linkedProduct) {
        currentSuggestion = {
          exactMatch: linkedProduct,
          fuzzyMatches: [{ product: linkedProduct, score: 100, matchedOn: 'linked' }],
          confidence: 'high'
        };
        linkerMode = 'suggestion';
        showProductLinker = true;
        return;
      }
    }
    
    // Find suggestions for this item
    const searchPool = allProducts.length > 0 ? allProducts : products;
    currentSuggestion = findProductMatches(itemDescription, searchPool, 5);
    
    // Determine initial mode based on match quality
    if (currentSuggestion.confidence === 'high' || currentSuggestion.confidence === 'medium') {
      linkerMode = 'suggestion';
    } else if (currentSuggestion.fuzzyMatches.length > 0) {
      linkerMode = 'suggestion';
    } else {
      linkerMode = 'search';
    }
    
    showProductLinker = true;
    
    // Focus search if in search mode
    if (linkerMode === 'search') {
      await tick();
      searchInputRef?.focus();
    }
  }

  function closeProductLinker() {
    showProductLinker = false;
    activeLinkIndex = null;
    productSearchQuery = '';
    currentSuggestion = null;
    linkerMode = 'suggestion';
    newProductName = '';
  }

  function switchToSearch() {
    linkerMode = 'search';
    searchProducts();
    tick().then(() => searchInputRef?.focus());
  }

  function switchToCreate() {
    linkerMode = 'create';
    if (activeLinkIndex !== null && invoice?.items) {
      newProductName = invoice.items[activeLinkIndex].description || '';
    }
  }

  function searchProducts() {
    const searchPool = allProducts.length > 0 ? allProducts : products;
    
    if (!productSearchQuery.trim()) {
      // Show recent/popular products when no search query
      filteredLinkProducts = searchPool
        .sort((a, b) => {
          // Prioritize products from the same supplier
          if (selectedSupplierId) {
            if (a.supplierId === selectedSupplierId && b.supplierId !== selectedSupplierId) return -1;
            if (b.supplierId === selectedSupplierId && a.supplierId !== selectedSupplierId) return 1;
          }
          // Then by last purchase date
          return (b.lastDate || '').localeCompare(a.lastDate || '');
        })
        .slice(0, 15);
      return;
    }
    
    // Use fuzzy matching for product search
    const result = findProductMatches(productSearchQuery, searchPool, 15);
    filteredLinkProducts = result.fuzzyMatches.map(m => m.product);
  }

  function selectLinkedProduct(product: Product) {
    if (activeLinkIndex === null || !invoice || !invoice.items) return;
    
    // Link the product using productId or barcode or id
    invoice.items[activeLinkIndex].productId = product.productId || product.barcode || String(product.id);
    // Update description to match catalog for consistency
    invoice.items[activeLinkIndex].description = product.name;
    
    // Remove from fuzzy matches since now linked
    delete fuzzyMatches[activeLinkIndex];
    fuzzyMatches = fuzzyMatches;
    
    closeProductLinker();
    checkPrices();
  }

  function acceptSuggestion(match: ProductMatch) {
    selectLinkedProduct(match.product);
  }

  function rejectSuggestion() {
    // Move to search mode
    switchToSearch();
  }

  async function createAndLinkProduct() {
    if (!newProductName.trim() || activeLinkIndex === null || !invoice?.items) return;
    
    const newProduct: Partial<Product> = {
      name: newProductName.trim(),
      supplierId: selectedSupplierId || undefined,
      lastPrice: invoice.items[activeLinkIndex].unitPrice || 0,
      lastDate: invoice.issueDate || new Date().toISOString().split('T')[0]
    };
    
    try {
      const newId = await db.products.add(newProduct as Product) as number;
      
      // Link to the new product
      invoice.items[activeLinkIndex].productId = String(newId);
      invoice.items[activeLinkIndex].description = newProductName.trim();
      
      // Refresh products list
      allProducts = await db.products.toArray();
      
      // Remove from fuzzy matches
      delete fuzzyMatches[activeLinkIndex];
      fuzzyMatches = fuzzyMatches;
      
      closeProductLinker();
      checkPrices();
    } catch (e) {
      console.error('Error creating product:', e);
      alert('Error creating product');
    }
  }

  function unlinkProduct() {
    if (activeLinkIndex === null || !invoice?.items) return;
    invoice.items[activeLinkIndex].productId = undefined;
    closeProductLinker();
  }
  
  function acceptFuzzyMatch(index: number) {
    if (!invoice || !invoice.items || !fuzzyMatches[index]) return;
    
    const match = fuzzyMatches[index].fuzzyMatches[0];
    if (match) {
      invoice.items[index].productId = match.product.productId || match.product.barcode || String(match.product.id);
      invoice.items[index].description = match.product.name;
      
      delete fuzzyMatches[index];
      fuzzyMatches = fuzzyMatches;
      checkPrices();
    }
  }
  
  function getMatchConfidenceColor(confidence: string): string {
    switch (confidence) {
      case 'high': return 'text-green-500 bg-green-500/10 border-green-500/30';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'low': return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
    }
  }

  function getScoreColor(score: number): string {
    if (score >= 90) return 'bg-green-500';
    if (score >= 70) return 'bg-yellow-500';
    if (score >= 50) return 'bg-orange-500';
    return 'bg-red-500';
  }

  function getConfidenceLabel(confidence: string): string {
    switch (confidence) {
      case 'high': return 'Alta coincidencia';
      case 'medium': return 'Coincidencia parcial';
      case 'low': return 'Coincidencia baja';
      default: return 'Sin coincidencias';
    }
  }
</script>

<div class="h-screen flex flex-col md:flex-row overflow-hidden bg-background">
  
  <!-- Left: Image Viewer (Desktop) / Top (Mobile) -->
  <div class="w-full md:w-[35%] h-64 md:h-full bg-black relative overflow-hidden border-b md:border-b-0 md:border-r border-border group">
    {#if invoice?.imageUrl}
      <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
      <div 
        class="w-full h-full flex items-center justify-center cursor-move"
        on:wheel|preventDefault={handleWheel}
        on:mousedown={handleMouseDown}
        on:mousemove={handleMouseMove}
        on:mouseup={handleMouseUp}
        on:mouseleave={handleMouseUp}
        role="img"
      >
        <img 
          src={invoice.imageUrl} 
          alt="Invoice Receipt" 
          class="max-w-none transition-transform duration-75"
          style="transform: translate({imagePan.x}px, {imagePan.y}px) scale({imageZoom})"
          draggable="false"
        />
      </div>
      
      <!-- Zoom Controls -->
      <div class="absolute bottom-4 right-4 flex space-x-2 z-10" on:mousedown|stopPropagation>
        <button class="bg-black/50 text-white p-2 rounded-full hover:bg-black/70" on:click={() => { imageZoom = 1; imagePan = {x:0, y:0}; }}>
          <RefreshCw size={16} />
        </button>
        <div class="flex space-x-1 bg-black/50 rounded-full p-1">
          <button class="text-white px-3 py-1 hover:bg-white/20 rounded-full" on:click={() => imageZoom = Math.max(0.1, imageZoom - 0.5)}>-</button>
          <span class="text-white px-2 py-1 text-sm font-mono min-w-[3rem] text-center">{Math.round(imageZoom * 100)}%</span>
          <button class="text-white px-3 py-1 hover:bg-white/20 rounded-full" on:click={() => imageZoom = Math.min(5, imageZoom + 0.5)}>+</button>
        </div>
      </div>
    {:else}
      <div class="w-full h-full flex items-center justify-center text-muted-foreground">
        No Image Available
      </div>
    {/if}
  </div>

  <!-- Right: Form -->
  <div class="w-full md:w-[65%] h-full overflow-y-auto p-4 pb-24 bg-background text-foreground">
    {#if invoice}
      <!-- Header Actions -->
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">Validate</h1>
        <div class="flex space-x-2">
          <Button variant="destructive" size="sm" on:click={confirmDiscard}>
            Cancel
          </Button>
          <Button variant="outline" size="sm" on:click={handleReanalyze} disabled={$isProcessing}>
            <RefreshCw size={16} class={$isProcessing ? 'animate-spin' : ''} />
            <span class="hidden sm:inline text-sm">Re-Analyze</span>
          </Button>
          {#if invoice.reasoning}
            <Button variant="outline" size="sm" on:click={() => showReasoning = !showReasoning} class="text-primary">
              <Brain size={16} />
              <span class="hidden sm:inline text-sm">AI Logic</span>
            </Button>
          {/if}
          <Button variant="default" size="default" on:click={handleSave} disabled={isSaving} class="bg-green-600 hover:bg-green-500 text-white shadow-lg shadow-green-900/20">
            <Save size={18} />
            <span>Save</span>
          </Button>
        </div>
      </div>

      <!-- Main Form -->
      <div class="space-y-6">
        
        <!-- Provider Info -->
        <Card.Root>
          <Card.Header>
            <Card.Title class="text-muted-foreground text-xs font-bold uppercase tracking-wider">Provider Info</Card.Title>
          </Card.Header>
          <Card.Content>
          <div class="mb-3">
            <label class="block text-[10px] text-muted-foreground mb-1 uppercase">Select Provider</label>
            <Select.Root 
              selected={selectedSupplierId ? { value: String(selectedSupplierId), label: suppliers.find(s => s.id === selectedSupplierId)?.name || '' } : undefined}
              onSelectedChange={(v) => { selectedSupplierId = v?.value ? Number(v.value) : null; }}
            >
              <Select.Trigger class="w-full bg-input/50 h-9 text-sm">
                <Select.Value placeholder="-- New / Unknown --" />
              </Select.Trigger>
              <Select.Content>
                {#each suppliers as s}
                  <Select.Item value={String(s.id)} label="{s.name} ({s.rnc})">{s.name} ({s.rnc})</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <Label for="provider-name" class="text-[10px] uppercase">Name</Label>
              <Input id="provider-name" bind:value={invoice.providerName} class="h-9 bg-input/50" />
            </div>
            <div class="space-y-1.5">
              <Label for="provider-rnc" class="text-[10px] uppercase">RNC</Label>
              <Input id="provider-rnc" bind:value={invoice.providerRnc} class="h-9 bg-input/50" />
            </div>
          </div>
          </Card.Content>
        </Card.Root>

      {#if showReasoning && invoice.reasoning}
        <div class="mb-6 bg-card border border-primary/30 rounded-xl p-4 text-sm text-muted-foreground shadow-lg relative overflow-hidden">
          <div class="absolute top-0 left-0 w-1 h-full bg-primary"></div>
          <div class="flex items-start space-x-3">
            <Brain size={20} class="text-primary mt-1 flex-shrink-0" />
            <div class="whitespace-pre-wrap font-mono text-xs leading-relaxed">
              {invoice.reasoning}
            </div>
          </div>
        </div>
      {/if}

        <!-- Invoice Details -->
        <Card.Root>
          <Card.Header>
            <Card.Title class="text-muted-foreground text-xs font-bold uppercase tracking-wider">Details</Card.Title>
          </Card.Header>
          <Card.Content>
          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1.5">
              <Label for="invoice-ncf" class="text-[10px] uppercase">NCF</Label>
              <Input 
                id="invoice-ncf"
                bind:value={invoice.ncf} 
                class="h-9 bg-input/50 {validateNcf(invoice.ncf || '') ? 'border-green-500/50' : 'border-red-500/50'}" 
              />
              <p class="text-[10px] text-muted-foreground truncate">{getNcfType(invoice.ncf || '')}</p>
            </div>
            <div class="space-y-1.5">
              <Label for="issue-date" class="text-[10px] uppercase">Issue Date</Label>
              <Input id="issue-date" type="date" bind:value={invoice.issueDate} class="h-9 bg-input/50" />
            </div>
          </div>
          
          <div class="grid grid-cols-2 gap-3 mt-3">
            <div>
              <label class="block text-[10px] text-muted-foreground mb-1 uppercase">Category</label>
              <Select.Root 
                selected={invoice?.category ? { value: invoice.category, label: { 'Inventory': 'Inventory (Resale)', 'Utilities': 'Utilities', 'Maintenance': 'Maintenance', 'Payroll': 'Payroll', 'Other': 'Other' }[invoice.category] || invoice.category } : { value: 'Inventory', label: 'Inventory (Resale)' }}
                onSelectedChange={(v) => { if (invoice && v?.value) invoice.category = v.value; }}
              >
                <Select.Trigger class="w-full bg-input/50 h-9 text-sm">
                  <Select.Value placeholder="Select category..." />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="Inventory" label="Inventory (Resale)">Inventory (Resale)</Select.Item>
                  <Select.Item value="Utilities" label="Utilities">Utilities</Select.Item>
                  <Select.Item value="Maintenance" label="Maintenance">Maintenance</Select.Item>
                  <Select.Item value="Payroll" label="Payroll">Payroll</Select.Item>
                  <Select.Item value="Other" label="Other">Other</Select.Item>
                </Select.Content>
              </Select.Root>
            </div>
            <div class="space-y-1.5">
              <Label for="due-date" class="text-[10px] uppercase flex items-center space-x-1">
                <Calendar size={10} />
                <span>Due Date</span>
                {#if invoice.creditDays}
                  <span class="text-primary">({invoice.creditDays} days)</span>
                {/if}
              </Label>
              <Input 
                id="due-date"
                type="date" 
                bind:value={invoice.dueDate} 
                class="h-9 bg-input/50" 
              />
            </div>
          </div>
          
          {#if invoice.category === 'Inventory'}
            <div class="mt-3 p-2 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center space-x-2">
              <Package size={16} class="text-green-500" />
              <span class="text-xs text-green-600 dark:text-green-400">Stock will be automatically updated when saved</span>
            </div>
          {/if}
          </Card.Content>
        </Card.Root>

        <!-- Totals -->
        <Card.Root>
          <Card.Header>
            <Card.Title class="text-muted-foreground text-xs font-bold uppercase tracking-wider">Totals</Card.Title>
          </Card.Header>
          <Card.Content>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-muted-foreground">Subtotal</span>
              <span class="font-mono">{invoice.subtotal?.toFixed(2)}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-muted-foreground">Discount</span>
              <Input 
                type="number" 
                bind:value={invoice.discount} 
                on:input={handleRecalc}
                class="w-24 h-8 text-right font-mono bg-input/50" 
              />
            </div>
            <div class="flex justify-between">
              <span class="text-muted-foreground">ITBIS (18%)</span>
              <span class="font-mono">{invoice.itbisTotal?.toFixed(2)}</span>
            </div>
            <Separator class="my-2" />
            <div class="pt-2 flex justify-between items-center">
              <span class="font-bold">Total</span>
              <span class="text-green-500 font-bold text-xl font-mono">DOP {invoice.total?.toFixed(2)}</span>
            </div>
          </div>
          </Card.Content>
        </Card.Root>

        <!-- Items Grid -->
        <Card.Root class="overflow-hidden">
          <Card.Header class="flex justify-between items-center">
            <Card.Title class="text-muted-foreground text-xs font-bold uppercase tracking-wider">Line Items</Card.Title>
            <Button variant="ghost" size="sm" on:click={addLine} class="text-primary text-xs font-bold uppercase">+ Add Item</Button>
          </Card.Header>
          <Card.Content class="p-0">
          <Table.Root>
            <Table.Header class="bg-muted/50">
              <Table.Row class="hover:bg-muted/50">
                <Table.Head class="text-xs uppercase p-3">Desc</Table.Head>
                <Table.Head class="text-xs uppercase p-3 w-14 text-center">Qty</Table.Head>
                <Table.Head class="text-xs uppercase p-3 w-20 text-right">Price</Table.Head>
                <Table.Head class="text-xs uppercase p-3 w-16 text-center">Tax Inc</Table.Head>
                <Table.Head class="text-xs uppercase p-3 w-20 text-right">Net</Table.Head>
                <Table.Head class="text-xs uppercase p-3 w-16 text-center">Rate</Table.Head>
                <Table.Head class="text-xs uppercase p-3 w-20 text-right">ITBIS</Table.Head>
                <Table.Head class="text-xs uppercase p-3 w-28 text-right">Total</Table.Head>
                <Table.Head class="p-3 w-8"></Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each invoice.items || [] as item, i}
                <Table.Row class="group hover:bg-muted/30">
                  <Table.Cell class="p-2 relative group/cell">
                    <div class="flex items-center space-x-2">
                        <button 
                          class="p-1.5 rounded-md transition-all {item.productId ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30' : fuzzyMatches[i] ? 'bg-yellow-500/20 text-yellow-500 hover:bg-yellow-500/30 animate-pulse' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                          title={item.productId ? "✓ Vinculado - Click para editar" : fuzzyMatches[i] ? "⚡ Sugerencia disponible - Click para ver" : "Click para vincular producto"}
                          on:click={() => openProductLinker(i)}
                        >
                          {#if item.productId}
                            <Check size={14} />
                          {:else if fuzzyMatches[i]}
                            <Sparkles size={14} />
                          {:else}
                            <Link size={14} />
                          {/if}
                        </button>
                        <div class="flex-1 relative">
                          <input 
                            bind:value={item.description} 
                            class="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground {item.productId ? 'text-green-600 dark:text-green-400' : ''}" 
                            placeholder="Item..." 
                            data-row={i} data-col="0"
                            on:keydown={(e) => handleKeydown(e, i, 0)}
                            on:blur={() => runFuzzyMatching()}
                          />
                          {#if fuzzyMatches[i] && !item.productId}
                            <div class="absolute left-0 top-full mt-1 z-20">
                              <Tooltip.Root>
                                <Tooltip.Trigger asChild let:builder>
                                  <button 
                                    use:builder.action
                                    {...builder}
                                    class="flex items-center space-x-1 px-2 py-1 rounded text-xs {getMatchConfidenceColor(fuzzyMatches[i].confidence)} hover:brightness-110 transition-all"
                                    on:click={() => openProductLinker(i)}
                                  >
                                    <span class="truncate max-w-[120px]">
                                      {fuzzyMatches[i].fuzzyMatches[0]?.product.name}
                                    </span>
                                    <span class="font-bold">
                                      {fuzzyMatches[i].fuzzyMatches[0]?.score}%
                                    </span>
                                    <Check size={12} />
                                  </button>
                                </Tooltip.Trigger>
                                <Tooltip.Content>Click para ver sugerencia</Tooltip.Content>
                              </Tooltip.Root>
                            </div>
                          {/if}
                        </div>
                    </div>
                  </Table.Cell>
                  <Table.Cell class="p-2">
                    <input 
                      type="number" 
                      bind:value={item.quantity} 
                      on:change={() => handleTotalChange(i)} 
                      class="w-full bg-transparent text-foreground outline-none text-center border-b border-transparent focus:border-primary focus:bg-muted/30 transition-colors" 
                      data-row={i} data-col="1"
                      on:keydown={(e) => handleKeydown(e, i, 1)}
                    />
                  </Table.Cell>
                  <Table.Cell class="p-2 relative">
                    <div class="relative">
                      <input 
                        type="number" 
                        bind:value={item.unitPrice} 
                        on:input={handleRecalc} 
                        class="w-full bg-transparent text-foreground outline-none text-right border-b border-transparent focus:border-primary focus:bg-muted/30 transition-colors {priceAlerts[i] ? (priceAlerts[i].type === 'up' ? 'text-red-500' : 'text-green-500') : ''}" 
                        data-row={i} data-col="2"
                        on:keydown={(e) => handleKeydown(e, i, 2)}
                      />
                      {#if priceAlerts[i]}
                        <div class="absolute right-full mr-2 top-1/2 transform -translate-y-1/2 group/tooltip">
                          {#if priceAlerts[i].type === 'up'}
                            <TrendingUp size={14} class="text-red-500" />
                          {:else}
                            <TrendingDown size={14} class="text-green-500" />
                          {/if}
                          
                          <!-- Tooltip -->
                          <div class="absolute bottom-full mb-2 right-0 w-48 bg-popover text-popover-foreground border border-border p-2 rounded-lg text-xs z-50 hidden group-hover/tooltip:block shadow-xl">
                            <div class="font-bold mb-1">Price Change</div>
                            <div class="text-muted-foreground">Was: <span class="text-foreground">{priceAlerts[i].lastPrice.toFixed(2)}</span></div>
                            <div class="text-muted-foreground">Date: <span class="text-foreground">{priceAlerts[i].lastDate}</span></div>
                            <div class="{priceAlerts[i].type === 'up' ? 'text-red-500' : 'text-green-500'} font-bold mt-1">
                              {priceAlerts[i].type === 'up' ? '+' : ''}{priceAlerts[i].diff.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      {/if}
                    </div>
                  </Table.Cell>
                  <Table.Cell class="p-2 text-center">
                    <input 
                      type="checkbox" 
                      bind:checked={item.priceIncludesTax} 
                      on:change={() => handleTotalChange(i)}
                      class="w-4 h-4 rounded border-input bg-input text-primary focus:ring-primary"
                    />
                  </Table.Cell>
                  <Table.Cell class="p-2 text-right font-mono text-muted-foreground text-xs">
                    {item.value?.toFixed(2)}
                  </Table.Cell>
                  <Table.Cell class="p-2">
                    <select 
                      bind:value={item.taxRate} 
                      on:change={handleRecalc}
                      class="w-full bg-transparent text-foreground outline-none text-center text-xs appearance-none"
                    >
                      <option value={0.18}>18%</option>
                      <option value={0.16}>16%</option>
                      <option value={0}>0%</option>
                    </select>
                  </Table.Cell>
                  <Table.Cell class="p-2 text-right font-mono text-muted-foreground text-xs">
                    {item.itbis?.toFixed(2)}
                  </Table.Cell>
                  <Table.Cell class="p-2">
                    <input 
                      type="number" 
                      step="0.01"
                      bind:value={item.amount} 
                      on:change={() => handleTotalChange(i)}
                      class="w-full bg-muted/50 rounded px-2 py-1 text-foreground outline-none text-right font-mono border border-transparent focus:border-primary transition-colors" 
                      data-row={i} data-col="5"
                      on:keydown={(e) => handleKeydown(e, i, 5)}
                    />
                  </Table.Cell>
                  <Table.Cell class="p-2">
                    <div class="flex items-center justify-center space-x-1">
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild let:builder>
                          <button 
                            use:builder.action
                            {...builder}
                            on:click={() => handleLearnRule(item)} 
                            class="text-yellow-500 hover:text-yellow-600 transition-colors p-1"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2v1"/><path d="M12 7v5"/><path d="M12 13h.01"/><path d="M12 17h.01"/><path d="M12 21h.01"/><path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z"/></svg>
                            <!-- Lightbulb Icon -->
                            <span class="sr-only">Learn</span>
                          </button>
                        </Tooltip.Trigger>
                        <Tooltip.Content>Teach AI a rule for this item</Tooltip.Content>
                      </Tooltip.Root>
                      <Button variant="ghost" size="icon" on:click={() => removeLine(i)} class="text-muted-foreground hover:text-destructive">×</Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
          </Card.Content>
        </Card.Root>

      </div>

    {:else}
      <div class="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
        <p>No invoice data found.</p>
        <a href="/capture" class="text-primary font-bold hover:underline">Go to Capture</a>
      </div>
    {/if}
  </div>
  <!-- Enhanced Product Linker Sheet -->
  <Sheet.Root bind:open={showProductLinker} onOpenChange={(open) => { if (!open) closeProductLinker(); }}>
    <Sheet.Content side="right" class="w-full sm:max-w-lg flex flex-col">
      <Sheet.Header class="border-b border-border pb-4">
        <Sheet.Title>Link Product</Sheet.Title>
        <Sheet.Description>
          {#if activeLinkIndex !== null && invoice?.items}
            "{invoice.items[activeLinkIndex]?.description || 'Item'}"
          {:else}
            Select a product to link to this invoice item
          {/if}
        </Sheet.Description>
        
        <!-- Mode Tabs -->
        <div class="flex mt-4 bg-muted/50 rounded-lg p-1">
          <button 
            class="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all {linkerMode === 'suggestion' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
            on:click={() => { linkerMode = 'suggestion'; }}
          >
            <Sparkles size={14} class="inline mr-1" />
            Sugerencias
          </button>
          <button 
            class="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all {linkerMode === 'search' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
            on:click={switchToSearch}
          >
            <Search size={14} class="inline mr-1" />
            Buscar
          </button>
          <button 
            class="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-all {linkerMode === 'create' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}"
            on:click={switchToCreate}
          >
            <Plus size={14} class="inline mr-1" />
            Crear
          </button>
        </div>
      </Sheet.Header>

      <!-- Content Area -->
      <div class="flex-1 overflow-y-auto">
        <!-- Suggestion Mode -->
        {#if linkerMode === 'suggestion'}
          <div class="p-4 space-y-4">
            {#if currentSuggestion && currentSuggestion.fuzzyMatches.length > 0}
              <!-- Best Match Card -->
              {@const bestMatch = currentSuggestion.fuzzyMatches[0]}
              <div class="border rounded-xl overflow-hidden {getMatchConfidenceColor(currentSuggestion.confidence)}">
                <div class="p-4">
                  <div class="flex items-center justify-between mb-3">
                    <span class="text-xs font-semibold uppercase tracking-wide opacity-80">
                      {getConfidenceLabel(currentSuggestion.confidence)}
                    </span>
                    <div class="flex items-center gap-2">
                      <div class="w-16 h-2 bg-black/30 rounded-full overflow-hidden">
                        <div class="h-full {getScoreColor(bestMatch.score)} transition-all" style="width: {bestMatch.score}%"></div>
                      </div>
                      <span class="text-xs font-mono">{bestMatch.score}%</span>
                    </div>
                  </div>
                  
                  <div class="mb-3">
                    <div class="font-semibold text-lg">{bestMatch.product.name}</div>
                    <div class="flex flex-wrap gap-2 mt-2">
                      {#if bestMatch.product.productId}
                        <span class="text-xs bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded">SKU: {bestMatch.product.productId}</span>
                      {/if}
                      {#if bestMatch.product.barcode}
                        <span class="text-xs bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded font-mono">{bestMatch.product.barcode}</span>
                      {/if}
                      {#if bestMatch.product.lastPrice}
                        <span class="text-xs bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded">Último: ${bestMatch.product.lastPrice.toFixed(2)}</span>
                      {/if}
                      {#if bestMatch.product.currentStock !== undefined}
                        <span class="text-xs bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded {bestMatch.product.currentStock > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                          Stock: {bestMatch.product.currentStock}
                        </span>
                      {/if}
                    </div>
                    {#if bestMatch.matchedOn && bestMatch.matchedOn !== 'exact' && bestMatch.matchedOn !== 'linked'}
                      <p class="text-xs mt-2 opacity-60">Coincidencia por: {bestMatch.matchedOn}</p>
                    {/if}
                  </div>
                  
                  <!-- Action Buttons -->
                  <div class="flex gap-2">
                    <button 
                      on:click={() => acceptSuggestion(bestMatch)}
                      class="flex-1 bg-green-600 hover:bg-green-500 text-white py-2.5 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                      <Check size={18} />
                      Aceptar
                    </button>
                    <button 
                      on:click={rejectSuggestion}
                      class="flex-1 bg-muted hover:bg-muted/80 text-foreground py-2.5 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                    >
                      <X size={18} />
                      Buscar otro
                    </button>
                  </div>
                </div>

                <!-- Unlink option if already linked -->
                {#if activeLinkIndex !== null && invoice?.items?.[activeLinkIndex]?.productId}
                  <Separator class="bg-current/20" />
                  <div class="p-3 bg-muted/20">
                    <button 
                      on:click={unlinkProduct}
                      class="text-sm text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      Desvincular producto
                    </button>
                  </div>
                {/if}
              </div>
              
              <!-- Other Suggestions -->
              {#if currentSuggestion.fuzzyMatches.length > 1}
                <div>
                  <p class="text-xs text-muted-foreground uppercase tracking-wide mb-2">Otras opciones</p>
                  <div class="space-y-1">
                    {#each currentSuggestion.fuzzyMatches.slice(1, 4) as match}
                      <button 
                        class="w-full text-left p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                        on:click={() => acceptSuggestion(match)}
                      >
                        <div class="flex items-center justify-between">
                          <div class="flex-1 min-w-0">
                            <div class="font-medium truncate">{match.product.name}</div>
                            <div class="text-xs text-muted-foreground">
                              {#if match.product.productId}
                                <span class="mr-2">{match.product.productId}</span>
                              {/if}
                              {#if match.product.lastPrice}
                                <span>${match.product.lastPrice.toFixed(2)}</span>
                              {/if}
                            </div>
                          </div>
                          <div class="flex items-center gap-2 ml-2">
                            <span class="text-xs text-muted-foreground">{match.score}%</span>
                            <ArrowRight size={16} class="text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </div>
                      </button>
                    {/each}
                  </div>
                </div>
              {/if}
            {:else}
              <!-- No Suggestions -->
              <div class="text-center py-8">
                <div class="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
                  <Search size={24} class="text-muted-foreground" />
                </div>
                <p class="text-muted-foreground mb-2">No se encontraron coincidencias</p>
                <p class="text-sm text-muted-foreground mb-4">Busca en el catálogo o crea un nuevo producto</p>
                <div class="flex gap-2 justify-center">
                  <button 
                    on:click={switchToSearch}
                    class="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
                  >
                    <Search size={16} />
                    Buscar
                  </button>
                  <button 
                    on:click={switchToCreate}
                    class="bg-secondary text-secondary-foreground px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
                  >
                    <Plus size={16} />
                    Crear nuevo
                  </button>
                </div>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Search Mode -->
        {#if linkerMode === 'search'}
          <div class="p-4 border-b border-border">
            <div class="relative">
              <Search size={18} class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
              <Input 
                bind:this={searchInputRef}
                bind:value={productSearchQuery}
                on:input={searchProducts}
                placeholder="Buscar por nombre, SKU o código de barras..."
                class="pl-10 h-11 bg-input/50"
              />
            </div>
          </div>
          
          <div class="p-2 space-y-1">
            {#if filteredLinkProducts.length > 0}
              {#each filteredLinkProducts as product}
                <button 
                  class="w-full text-left p-3 rounded-lg hover:bg-muted/50 transition-colors group"
                  on:click={() => selectLinkedProduct(product)}
                >
                  <div class="flex items-center justify-between">
                    <div class="flex-1 min-w-0">
                      <div class="font-medium truncate">{product.name}</div>
                      <div class="flex flex-wrap gap-2 mt-1">
                        {#if product.productId}
                          <span class="text-xs bg-muted px-1.5 py-0.5 rounded">{product.productId}</span>
                        {/if}
                        {#if product.barcode}
                          <span class="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{product.barcode}</span>
                        {/if}
                        {#if product.currentStock !== undefined}
                          <span class="text-xs {product.currentStock > 0 ? 'text-green-500' : 'text-red-500'}">
                            Stock: {product.currentStock}
                          </span>
                        {/if}
                        {#if product.lastPrice}
                          <span class="text-xs text-muted-foreground">${product.lastPrice.toFixed(2)}</span>
                        {/if}
                      </div>
                    </div>
                    <div class="text-primary opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                      <ArrowRight size={18} />
                    </div>
                  </div>
                </button>
              {/each}
            {:else}
              <div class="text-center py-8">
                <p class="text-muted-foreground mb-3">No se encontraron productos</p>
                <button 
                  on:click={switchToCreate}
                  class="text-primary hover:underline text-sm"
                >
                  Crear nuevo producto
                </button>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Create Mode -->
        {#if linkerMode === 'create'}
          <div class="p-4 space-y-4">
            <div class="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <p class="text-yellow-500 text-sm">
                <AlertTriangle size={14} class="inline mr-1" />
                Se creará un nuevo producto en tu catálogo
              </p>
            </div>
            
            <div class="space-y-2">
              <Label for="new-product-name">Nombre del producto</Label>
              <Input 
                id="new-product-name"
                bind:value={newProductName}
                placeholder="Ej: Presidente Botella 12oz"
                class="h-11 bg-input/50"
              />
            </div>
            
            <div class="bg-muted/30 rounded-lg p-3 space-y-2 text-sm">
              <div class="flex justify-between text-muted-foreground">
                <span>Proveedor:</span>
                <span class="text-foreground">{suppliers.find(s => s.id === selectedSupplierId)?.name || 'Sin asignar'}</span>
              </div>
              {#if activeLinkIndex !== null && invoice?.items?.[activeLinkIndex]}
                <div class="flex justify-between text-muted-foreground">
                  <span>Precio inicial:</span>
                  <span class="text-foreground">${invoice.items[activeLinkIndex].unitPrice?.toFixed(2) || '0.00'}</span>
                </div>
              {/if}
            </div>
            
            <button 
              on:click={createAndLinkProduct}
              disabled={!newProductName.trim()}
              class="w-full bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Plus size={18} />
              Crear y vincular
            </button>
          </div>
        {/if}
      </div>
    </Sheet.Content>
  </Sheet.Root>
  
  <!-- Stock Alerts Dialog -->
  <Dialog.Root bind:open={showStockAlerts} onOpenChange={(open) => { if (!open) dismissStockAlerts(); }}>
    <Dialog.Content class="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
      <Dialog.Header class="bg-green-500/10 -mx-6 -mt-6 px-6 pt-6 pb-4 mb-4 border-b border-border">
        <div class="flex items-center space-x-2">
          <Package size={20} class="text-green-500" />
          <Dialog.Title>Invoice Saved - Stock Updated</Dialog.Title>
        </div>
        <Dialog.Description>
          Review stock changes from this invoice.
        </Dialog.Description>
      </Dialog.Header>
      
      <div class="flex-1 overflow-y-auto space-y-3 -mx-6 px-6">
        {#each stockAlerts as alert}
          <div class="p-3 rounded-lg border {
            alert.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
            alert.severity === 'warning' ? 'bg-yellow-500/10 border-yellow-500/30' :
            'bg-green-500/10 border-green-500/30'
          }">
            <div class="flex items-start space-x-3">
              <span class="text-lg">
                {alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : '✅'}
              </span>
              <div class="flex-1">
                <div class="font-medium">{alert.productName}</div>
                <div class="text-sm text-muted-foreground">{alert.message}</div>
                {#if alert.suggestion}
                  <div class="text-xs text-primary mt-1">{alert.suggestion}</div>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
      
      <Separator class="mt-4" />
      <Dialog.Footer class="pt-4">
        <button 
          on:click={dismissStockAlerts}
          class="w-full bg-primary text-primary-foreground px-4 py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors"
        >
          Continue to History
        </button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
</div>

<!-- Discard Invoice Confirmation Dialog -->
<AlertDialog.Root bind:open={discardDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Discard Invoice</AlertDialog.Title>
      <AlertDialog.Description>Are you sure you want to discard this invoice? All unsaved changes will be lost.</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={() => { discardDialogOpen = false; }}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action class="bg-destructive text-destructive-foreground hover:bg-destructive/90" on:click={executeDiscard}>Discard</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
