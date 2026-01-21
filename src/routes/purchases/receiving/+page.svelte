<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { db, generateId } from '$lib/db';
  import { 
    Package, Plus, X, Search, Save, FileSpreadsheet, CheckCircle2, 
    AlertTriangle, ArrowRight, ClipboardList, Zap, ChevronDown, ChevronUp,
    Check, Minus, Equal, Camera, Image, Trash2, Eye
  } from 'lucide-svelte';
  import type { Receipt, ReceiptItem, PurchaseOrder, Supplier, Product, StockMovement, Invoice, InvoiceItem } from '$lib/types';
  import { createPurchaseInvoiceEntry } from '$lib/journal';
  import { generateReceiptNumber } from '$lib/utils';
  import * as Tabs from '$lib/components/ui/tabs';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Select from '$lib/components/ui/select';
  import * as Table from '$lib/components/ui/table';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Button } from '$lib/components/ui/button';
  import { DatePicker } from '$lib/components/ui/date-picker';
  import * as Card from '$lib/components/ui/card';
  import { locale } from '$lib/stores';
  import { t } from '$lib/i18n';
  import * as XLSX from 'xlsx';

  let activeTab: 'po-receive' | 'manual' | 'excel' = 'po-receive';
  let suppliers: Supplier[] = [];
  let products: Product[] = [];
  let purchaseOrders: PurchaseOrder[] = [];

  // Receipt State
  let receiptSupplierId: string | number | null = null;
  let receiptPurchaseOrderId: string | number | null = null;
  let receiptDate = new Date().toISOString().split('T')[0];
  let receiptNotes = '';
  let receiptItems: ReceiptItem[] = [];

  // Selected PO for comparison
  let selectedPO: PurchaseOrder | null = null;

  // Manual Entry State
  let newItemProductId: number | null = null;
  let newItemProductName = '';
  let newItemQuantity = 1;
  let newItemReceivedQuantity = 1;
  let newItemUnitPrice = 0;
  let newItemCondition: ReceiptItem['condition'] = 'good';
  let newItemNotes = '';
  let showProductSearch = false;

  // Excel Import State
  let excelFile: File | null = null;
  let excelData: any[] = [];
  let excelMapped = false;
  let excelColumnMap: Record<string, string> = {};

  // Info card collapse
  let showInfoCard = true;

  // Invoice creation state
  let createInvoice = true; // Default to creating invoice
  let invoiceNCF = '';
  let invoiceDueDate = '';
  let invoiceCreditDays = 30;
  
  // Invoice photo capture state
  let invoicePhotoUrl: string | null = null;
  let invoicePhotoName: string | null = null;
  let showPhotoPreview = false;
  let photoInputRef: HTMLInputElement;

  // Check URL params for PO pre-selection or viewing existing receipt
  let viewingReceipt: Receipt | null = null;
  let showReceiptView = false;
  
  $: {
    const poParam = $page.url.searchParams.get('po');
    const receiptParam = $page.url.searchParams.get('id') || $page.url.searchParams.get('receipt');
    
    if (poParam && !receiptPurchaseOrderId) {
      // Try to parse as number first (for legacy data), fall back to string (UUID)
      const poId = /^\d+$/.test(poParam) ? parseInt(poParam, 10) : poParam;
      receiptPurchaseOrderId = poId;
      loadPOItems(poId);
    }
    
    // If viewing an existing receipt
    if (receiptParam && !viewingReceipt) {
      loadReceiptForView(receiptParam);
    }
  }
  
  async function loadReceiptForView(receiptId: string) {
    try {
      const receipt = await db.receipts.get(receiptId);
      if (receipt) {
        viewingReceipt = receipt;
        showReceiptView = true;
      }
    } catch (error) {
      console.error('Error loading receipt:', error);
    }
  }
  
  function closeReceiptView() {
    showReceiptView = false;
    viewingReceipt = null;
    goto('/purchases/receiving');
  }

  onMount(async () => {
    // Wait a tick for database to be ready
    await new Promise(resolve => setTimeout(resolve, 100));
    await loadData();
  });

  async function loadData() {
    try {
      // Ensure database is open
      if (!db.isOpen()) {
        console.log('Receiving - Database not open, opening...');
        await db.open();
      }
      
      // Load all data first, then filter in JS to avoid Dexie query issues
      const allSuppliers = await db.suppliers.toArray();
      suppliers = allSuppliers.filter(s => s.isActive !== false);
      
    products = await db.products.toArray();
    purchaseOrders = await db.purchaseOrders.toArray();
      
      // Debug: log what we loaded
      console.log('Receiving - Loaded POs:', purchaseOrders.length, purchaseOrders.map(po => ({ id: po.id, poNumber: po.poNumber, status: po.status })));
    } catch (error) {
      console.error('Error loading data in receiving:', error);
    }
  }

  async function loadPOItems(poId?: string | number) {
    const id = poId ?? receiptPurchaseOrderId;
    if (!id) {
      selectedPO = null;
      receiptItems = [];
      return;
    }
    
    console.log(`[Receiving] Loading PO with ID: ${id} (type: ${typeof id})`);
    const po = await db.purchaseOrders.get(id);
    if (!po) {
      console.warn(`[Receiving] PO not found with ID: ${id}`);
      return;
    }

    console.log(`[Receiving] Loaded PO ${po.poNumber} with ${po.items.length} items`, 
      po.items.map(i => ({ name: i.productName, productId: i.productId })));

    selectedPO = po;
    receiptSupplierId = po.supplierId;
    receiptItems = po.items.map(item => ({
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity, // Ordered quantity
      unitPrice: item.unitPrice,
      receivedQuantity: item.quantity, // Default to ordered quantity
      condition: 'good' as const,
      notes: item.notes
    }));
  }

  function handlePOChange(poId: string | number | null) {
    console.log(`[Receiving] PO selected with ID:`, poId, `(type: ${typeof poId})`);
    receiptPurchaseOrderId = poId;
    if (poId) {
      loadPOItems(poId);
    } else {
      selectedPO = null;
      receiptItems = [];
      receiptSupplierId = null;
    }
  }

  // Variance calculations
  $: varianceStats = receiptItems.reduce((stats, item) => {
    const ordered = item.quantity || 0;
    const received = item.receivedQuantity || 0;
    const variance = received - ordered;
    
    if (variance === 0) stats.matched++;
    else if (variance < 0) stats.under++;
    else stats.over++;
    
    stats.totalOrdered += ordered;
    stats.totalReceived += received;
    stats.totalVariance += variance;
    
    return stats;
  }, { matched: 0, under: 0, over: 0, totalOrdered: 0, totalReceived: 0, totalVariance: 0 });

  $: receiptTotal = receiptItems.reduce((sum, item) => 
    sum + (item.receivedQuantity * item.unitPrice), 0
  );

  $: filteredProducts = receiptSupplierId
    ? products.filter(p => p.supplierId === receiptSupplierId)
    : products;

  $: productSearchResults = (showProductSearch && newItemProductName.trim().length > 0)
    ? filteredProducts.filter(p => 
        p.name.toLowerCase().includes(newItemProductName.toLowerCase()) ||
        p.productId?.toLowerCase().includes(newItemProductName.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(newItemProductName.toLowerCase())
      ).slice(0, 5)
    : [];

  // Filter POs that can be received: draft, sent, or partial status
  // Explicitly include valid statuses rather than excluding to avoid edge cases
  $: openPOs = purchaseOrders.filter(po => 
    po.status === 'draft' || po.status === 'sent' || po.status === 'partial'
  );

  // Photo handling functions
  async function handlePhotoCapture(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    
    const file = input.files[0];
    invoicePhotoName = file.name;
    
    // Compress and convert to base64
    const compressed = await compressImage(file, 1200, 0.8);
    invoicePhotoUrl = compressed;
  }
  
  async function compressImage(file: File, maxWidth: number, quality: number): Promise<string> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          
          // Scale down if needed
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }
  
  function clearPhoto() {
    invoicePhotoUrl = null;
    invoicePhotoName = null;
    if (photoInputRef) {
      photoInputRef.value = '';
    }
  }
  
  function triggerPhotoCapture(inputId: string) {
    const input = document.getElementById(inputId) as HTMLInputElement;
    if (input) {
      input.click();
    }
  }
  
  function triggerGallerySelect(inputId: string) {
    const input = document.getElementById(inputId) as HTMLInputElement;
    if (input) {
      input.removeAttribute('capture');
      input.click();
      // Restore capture attribute after a short delay
      setTimeout(() => input.setAttribute('capture', 'environment'), 100);
    }
  }

  // Condition badge color
  function getConditionColor(condition: ReceiptItem['condition']): string {
    switch (condition) {
      case 'good': return 'bg-green-500/10 text-green-500';
      case 'damaged': return 'bg-red-500/10 text-red-500';
      case 'expired': return 'bg-amber-500/10 text-amber-500';
      case 'wrong_item': return 'bg-purple-500/10 text-purple-500';
      default: return 'bg-muted text-muted-foreground';
    }
  }

  // Variance indicator
  function getVarianceClass(ordered: number, received: number): string {
    if (received === ordered) return 'text-green-500';
    if (received < ordered) return 'text-amber-500';
    return 'text-blue-500'; // Over
  }

  function getVarianceIcon(ordered: number, received: number) {
    if (received === ordered) return Check;
    if (received < ordered) return Minus;
    return Plus;
  }

  // Manual Entry Functions
  function addManualItem() {
    if (!newItemProductName.trim() || newItemReceivedQuantity <= 0 || newItemUnitPrice <= 0) {
      alert('Please fill in product name, received quantity, and unit price');
      return;
    }

    receiptItems = [...receiptItems, {
      productId: newItemProductId || undefined,
      productName: newItemProductName,
      quantity: newItemQuantity,
      unitPrice: newItemUnitPrice,
      receivedQuantity: newItemReceivedQuantity,
      condition: newItemCondition,
      notes: newItemNotes || undefined
    }];

    // Reset form
    newItemProductId = null;
    newItemProductName = '';
    newItemQuantity = 1;
    newItemReceivedQuantity = 1;
    newItemUnitPrice = 0;
    newItemCondition = 'good';
    newItemNotes = '';
    showProductSearch = false;
  }

  function removeItem(index: number) {
    receiptItems = receiptItems.filter((_, i) => i !== index);
  }

  function updateItemReceived(index: number, value: number) {
    receiptItems[index].receivedQuantity = value;
    receiptItems = [...receiptItems]; // Trigger reactivity
  }

  function updateItemCondition(index: number, condition: string) {
    receiptItems[index].condition = condition as ReceiptItem['condition'];
    receiptItems = [...receiptItems];
  }

  // Excel Import Functions
  async function handleExcelUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;

    excelFile = input.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        excelData = jsonData;
        excelMapped = false;
        
        // Try to auto-detect columns
        if (jsonData.length > 0) {
          const firstRow = jsonData[0] as any;
          const keys = Object.keys(firstRow);
          excelColumnMap = {
            productName: keys.find(k => 
              /product|item|name|description/i.test(k)
            ) || keys[0] || '',
            quantity: keys.find(k => 
              /quantity|qty|received/i.test(k)
            ) || keys[1] || '',
            unitPrice: keys.find(k => 
              /price|cost|unit/i.test(k)
            ) || keys[2] || ''
          };
        }
      } catch (error) {
        alert('Error reading Excel file: ' + error);
      }
    };

    reader.readAsArrayBuffer(excelFile);
  }

  function mapExcelData() {
    if (!excelData.length) return;

    receiptItems = excelData.map((row: any) => {
      const productName = row[excelColumnMap.productName] || '';
      const quantity = parseFloat(row[excelColumnMap.quantity]) || 1;
      const unitPrice = parseFloat(row[excelColumnMap.unitPrice]) || 0;

      return {
        productName: String(productName),
        quantity: quantity,
        unitPrice: unitPrice,
        receivedQuantity: quantity,
        condition: 'good' as const
      };
    }).filter(item => item.productName.trim());

    excelMapped = true;
  }

  // Save Receipt
  async function saveReceipt() {
    console.log(`[Receiving] === SAVE RECEIPT START ===`);
    console.log(`[Receiving] receiptSupplierId:`, receiptSupplierId);
    console.log(`[Receiving] receiptPurchaseOrderId:`, receiptPurchaseOrderId, `(type: ${typeof receiptPurchaseOrderId})`);
    console.log(`[Receiving] receiptItems count:`, receiptItems.length);
    console.log(`[Receiving] Items with productId:`, receiptItems.filter(i => i.productId).length);
    
    if (!receiptSupplierId) {
      alert('Please select a supplier');
      return;
    }
    if (receiptItems.length === 0) {
      alert('Please add at least one item');
      return;
    }

    const supplier = suppliers.find(s => s.id === receiptSupplierId);
    const receiptNumber = await generateReceiptNumber();
    const today = new Date().toISOString().split('T')[0];

    const receiptId = generateId();
    const receiptData: Receipt = {
      id: receiptId,
      receiptNumber,
      purchaseOrderId: receiptPurchaseOrderId || undefined,
      supplierId: receiptSupplierId,
      supplierName: supplier?.name,
      receiptDate: receiptDate,
      items: receiptItems,
      total: receiptTotal,
      notes: receiptNotes || undefined,
      invoicePhotoUrl: invoicePhotoUrl || undefined,
      invoicePhotoName: invoicePhotoName || undefined,
      createdAt: new Date()
    };

    await db.receipts.add(receiptData);

    // Update inventory
    let inventoryUpdated = 0;
    let inventorySkipped = 0;
    
    console.log(`[Receiving] Starting inventory update for ${receiptItems.length} items`);
    
    // Load all products once for efficient matching
    const allProducts = await db.products.toArray();
    console.log(`[Receiving] Loaded ${allProducts.length} products for matching`);
    
    for (const item of receiptItems) {
      console.log(`[Receiving] Processing item: "${item.productName}", productId: ${item.productId}, qty: ${item.receivedQuantity}, condition: ${item.condition}`);
      
      // Skip non-good condition items
      if (item.condition !== 'good') {
        console.log(`[Receiving] ⏭ Skipping "${item.productName}" - condition: ${item.condition}`);
        inventorySkipped++;
        continue;
      }
      
      // Try to find the product by ID first
      let product: typeof allProducts[0] | undefined;
      
      if (item.productId) {
        // First try direct ID match
        product = allProducts.find(p => p.id === item.productId);
        if (!product) {
          // Try string comparison in case of type mismatch
          product = allProducts.find(p => String(p.id) === String(item.productId));
        }
        if (product) {
          console.log(`[Receiving] ✓ Found product by ID: "${product.name}" (ID: ${product.id})`);
        }
      }
      
      // If not found by ID, try to find by name (exact and fuzzy match)
      if (!product) {
        const itemNameLower = item.productName.toLowerCase().trim();
        
        // Exact name match
        product = allProducts.find(p => p.name.toLowerCase().trim() === itemNameLower);
        
        // Try alias match
        if (!product) {
          product = allProducts.find(p => 
            p.aliases?.some(alias => alias.toLowerCase().trim() === itemNameLower)
          );
        }
        
        // Try partial match (name contains or is contained)
        if (!product) {
          product = allProducts.find(p => 
            p.name.toLowerCase().includes(itemNameLower) ||
            itemNameLower.includes(p.name.toLowerCase())
          );
        }
        
        if (product) {
          console.log(`[Receiving] ✓ Found product by name match: "${item.productName}" -> "${product.name}" (ID: ${product.id})`);
        }
      }
      
      if (product && product.id) {
        const previousStock = Number(product.currentStock ?? 0);
        const newStock = previousStock + Number(item.receivedQuantity);
        
        console.log(`[Receiving] 📦 Updating inventory for "${product.name}": ${previousStock} + ${item.receivedQuantity} = ${newStock}`);
        
        try {
          await db.products.update(product.id, {
            currentStock: newStock,
            lastPrice: item.unitPrice,
            lastDate: receiptDate,
            lastStockUpdate: today
          });
          
          // Verify update
          const verifyProduct = await db.products.get(product.id);
          console.log(`[Receiving] ✓ Verified: "${product.name}" stock is now ${verifyProduct?.currentStock}`);

          // Create stock movement
          const movement: StockMovement = {
            id: generateId(),
            productId: product.id,
            type: 'in',
            quantity: item.receivedQuantity,
            receiptId: receiptId,
            date: today,
            notes: `Receipt from ${supplier?.name}`
          };
          await db.stockMovements.add(movement);
          inventoryUpdated++;
        } catch (updateError) {
          console.error(`[Receiving] ✗ Failed to update inventory for "${product.name}":`, updateError);
          inventorySkipped++;
        }
      } else {
        console.warn(`[Receiving] ✗ Could not find product for "${item.productName}" (productId: ${item.productId}) - inventory NOT updated`);
        console.log(`[Receiving] Available products (first 5):`, allProducts.slice(0, 5).map(p => ({ id: p.id, name: p.name })));
        inventorySkipped++;
      }
    }
    
    console.log(`[Receiving] ═══════════════════════════════════════`);
    console.log(`[Receiving] Inventory update complete: ${inventoryUpdated} updated, ${inventorySkipped} skipped`);
    console.log(`[Receiving] ═══════════════════════════════════════`);

    // Update PO status if linked
    console.log(`[Receiving] Checking PO status update. receiptPurchaseOrderId:`, receiptPurchaseOrderId, `type:`, typeof receiptPurchaseOrderId);
    
    // Ensure we have a valid PO ID
    const poIdToUpdate = receiptPurchaseOrderId ? String(receiptPurchaseOrderId) : null;
    console.log(`[Receiving] Normalized PO ID:`, poIdToUpdate);
    
    if (poIdToUpdate) {
      // Try to find PO by the ID
      let po = await db.purchaseOrders.get(poIdToUpdate);
      
      // If not found, try looking up in the array (in case of type mismatch)
      if (!po) {
        console.log(`[Receiving] PO not found by direct get, searching in array...`);
        const allPOs = await db.purchaseOrders.toArray();
        po = allPOs.find(p => String(p.id) === poIdToUpdate);
        console.log(`[Receiving] Array search result:`, po ? 'FOUND' : 'NOT FOUND');
      }
      
      console.log(`[Receiving] Found PO for status update:`, po ? { id: po.id, poNumber: po.poNumber, currentStatus: po.status } : 'NOT FOUND');
      
      if (po && po.id) {
        // Check if all items received
        const allReceived = po.items.every(poItem => {
          const receiptItem = receiptItems.find(ri => 
            ri.productId === poItem.productId || 
            ri.productName.toLowerCase() === poItem.productName.toLowerCase()
          );
          const isReceived = receiptItem && receiptItem.receivedQuantity >= poItem.quantity;
          console.log(`[Receiving] Item "${poItem.productName}": ordered=${poItem.quantity}, received=${receiptItem?.receivedQuantity ?? 0}, match=${isReceived}`);
          return isReceived;
        });

        const newStatus = allReceived ? 'received' : 'partial';
        console.log(`[Receiving] Updating PO ${po.id} status from "${po.status}" to "${newStatus}"`);
        
        try {
          await db.purchaseOrders.update(po.id, {
            status: newStatus,
            updatedAt: new Date()
          });
          console.log(`[Receiving] ✓ PO status updated successfully to "${newStatus}"`);
          
          // Verify the update
          const verifyPO = await db.purchaseOrders.get(po.id);
          console.log(`[Receiving] Verification - PO status is now:`, verifyPO?.status);
        } catch (error) {
          console.error(`[Receiving] ✗ Failed to update PO status:`, error);
        }
      } else {
        console.warn(`[Receiving] Could not find PO with ID: ${poIdToUpdate}`);
      }
    } else {
      console.log(`[Receiving] No PO linked to this receipt (receiptPurchaseOrderId is empty)`);
    }

    // Create invoice for payment tracking
    if (createInvoice) {
      // Calculate invoice totals
      let invoiceSubtotal = 0;
      let invoiceItbis = 0;
      const invoiceItems: InvoiceItem[] = receiptItems.map(item => {
        const value = item.receivedQuantity * item.unitPrice;
        const taxRate = 0.18; // Default ITBIS rate
        const itbis = value * taxRate;
        invoiceSubtotal += value;
        invoiceItbis += itbis;
        
        return {
          description: item.productName,
          productId: item.productId,
          quantity: item.receivedQuantity,
          unitPrice: item.unitPrice,
          taxRate: taxRate,
          priceIncludesTax: false,
          value: value,
          itbis: itbis,
          amount: value + itbis
        };
      });

      const invoiceTotal = invoiceSubtotal + invoiceItbis;
      
      // Calculate due date from credit days
      const dueDateCalc = new Date(receiptDate);
      dueDateCalc.setDate(dueDateCalc.getDate() + (invoiceCreditDays || 30));
      const calculatedDueDate = invoiceDueDate || dueDateCalc.toISOString().split('T')[0];

      const invoiceId = generateId();
      const invoice: Invoice = {
        id: invoiceId,
        providerName: supplier?.name || 'Unknown',
        providerRnc: supplier?.rnc || '',
        issueDate: receiptDate,
        dueDate: calculatedDueDate,
        ncf: invoiceNCF || `REC-${receiptNumber}`, // Use receipt number if no NCF
        currency: 'DOP',
        items: invoiceItems,
        subtotal: invoiceSubtotal,
        discount: 0,
        itbisTotal: invoiceItbis,
        total: invoiceTotal,
        rawText: `Generated from receipt ${receiptNumber}`,
        status: 'verified',
        category: 'Inventory',
        createdAt: new Date(),
        paymentStatus: 'pending',
        creditDays: invoiceCreditDays,
        receiptId: receiptId
      };

      await db.invoices.add(invoice);

      // Create journal entry for the purchase (Inventory + ITBIS Paid, Credit A/P)
      try {
        await createPurchaseInvoiceEntry(invoice);
      } catch (e) {
        console.error('Error creating purchase journal entry:', e);
      }
    }

    const successMsg = `Receipt saved successfully!\n\n✓ ${inventoryUpdated} product(s) inventory updated\n${inventorySkipped > 0 ? `⚠ ${inventorySkipped} item(s) skipped` : ''}${createInvoice ? '\n✓ Invoice created for payment tracking' : ''}${poIdToUpdate ? `\n✓ PO status updated` : ''}`;
    alert(successMsg);
    
    // Reset form
    receiptSupplierId = null;
    receiptPurchaseOrderId = null;
    selectedPO = null;
    receiptDate = new Date().toISOString().split('T')[0];
    receiptNotes = '';
    receiptItems = [];
    excelFile = null;
    excelData = [];
    excelMapped = false;
    // Reset invoice fields
    createInvoice = true;
    invoiceNCF = '';
    invoiceDueDate = '';
    invoiceCreditDays = 30;
    // Reset photo
    invoicePhotoUrl = null;
    invoicePhotoName = null;
  }
</script>

<div class="p-4 max-w-7xl mx-auto pb-24">
  <div class="mb-6">
    <h1 class="text-2xl font-bold">{t('nav.receiving', $locale)}</h1>
    <p class="text-muted-foreground text-sm mt-1">Compare ordered vs. received quantities and update inventory</p>
  </div>

  <!-- Helper Info Card -->
  <Card.Root class="mb-6 border-primary/20 bg-primary/5">
    <button 
      class="w-full text-left"
      on:click={() => showInfoCard = !showInfoCard}
    >
      <Card.Header class="pb-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Package class="text-primary" size={20} />
            <Card.Title class="text-base font-semibold">When to Use Receiving</Card.Title>
          </div>
          {#if showInfoCard}
            <ChevronUp size={18} class="text-muted-foreground" />
          {:else}
            <ChevronDown size={18} class="text-muted-foreground" />
          {/if}
        </div>
      </Card.Header>
    </button>
    {#if showInfoCard}
      <Card.Content class="pt-2">
        <div class="space-y-3">
          <p class="text-sm text-muted-foreground">
            Use this module when <strong>goods arrive for a Purchase Order</strong>. Compare what you ordered vs. what was actually delivered.
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
              <div class="flex items-center gap-2 text-green-600 font-semibold text-sm mb-1">
                <CheckCircle2 size={16} />
                Best For
              </div>
              <ul class="text-xs text-muted-foreground space-y-1 ml-6">
                <li>• Receiving against a Purchase Order</li>
                <li>• Tracking partial deliveries</li>
                <li>• Recording damaged or wrong items</li>
                <li>• Audit trail for what was ordered vs received</li>
              </ul>
            </div>
            <div class="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3">
              <div class="flex items-center gap-2 text-amber-600 font-semibold text-sm mb-1">
                <Zap size={16} />
                Use Quick Capture Instead If...
              </div>
              <ul class="text-xs text-muted-foreground space-y-1 ml-6">
                <li>• No Purchase Order exists</li>
                <li>• Live truck ordering</li>
                <li>• Emergency restocking</li>
              </ul>
              <Button variant="link" size="sm" class="mt-2 h-auto p-0 text-amber-600" on:click={() => goto('/capture')}>
                Go to Quick Capture <ArrowRight size={14} class="ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </Card.Content>
    {/if}
  </Card.Root>

  <Tabs.Root bind:value={activeTab}>
    <Tabs.List class="mb-6">
      <Tabs.Trigger value="po-receive" class="flex items-center gap-2">
        <ClipboardList size={16} />
        Receive Against PO
      </Tabs.Trigger>
      <Tabs.Trigger value="manual" class="flex items-center gap-2">
        <Package size={16} />
        Manual Entry
      </Tabs.Trigger>
      <Tabs.Trigger value="excel" class="flex items-center gap-2">
        <FileSpreadsheet size={16} />
        Excel Import
      </Tabs.Trigger>
    </Tabs.List>

    <!-- Receive Against PO Tab (Primary) -->
    <Tabs.Content value="po-receive" class="space-y-4">
      <div class="bg-card rounded-xl border border-border p-6 space-y-6">
        <!-- Step 1: Select PO -->
        <div>
          <div class="flex items-center gap-2 mb-3">
            <div class="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</div>
            <Label class="text-base font-semibold">Select Purchase Order</Label>
          </div>
          <Select.Root 
            selected={receiptPurchaseOrderId ? { value: receiptPurchaseOrderId, label: openPOs.find(po => po.id === receiptPurchaseOrderId)?.poNumber || '' } : undefined}
            onSelectedChange={(v) => handlePOChange(v?.value ?? null)}
          >
            <Select.Trigger class="w-full">
              <Select.Value placeholder="Select a Purchase Order to receive..." />
            </Select.Trigger>
            <Select.Content side="bottom" class="max-h-80 overflow-y-auto">
              {#if openPOs.length === 0}
                <div class="px-3 py-4 text-center text-muted-foreground">
                  <p class="text-sm">No pending Purchase Orders</p>
                  <Button variant="link" size="sm" class="mt-1" on:click={() => goto('/purchases/orders')}>
                    Create one first
                  </Button>
                </div>
              {:else}
                {#each openPOs as po}
                  <Select.Item value={po.id}>
                    <div class="flex items-center justify-between w-full gap-4">
                      <span class="font-mono font-bold">{po.poNumber}</span>
                      <span class="text-muted-foreground">{po.supplierName}</span>
                      <span class="text-xs px-2 py-0.5 rounded {po.status === 'partial' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-500'}">
                        {po.status}
                      </span>
                    </div>
                  </Select.Item>
                {/each}
              {/if}
            </Select.Content>
          </Select.Root>
        </div>

        {#if selectedPO && receiptItems.length > 0}
          <!-- Step 2: Comparison Table -->
          <div>
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <div class="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</div>
                <Label class="text-base font-semibold">Compare & Adjust Quantities</Label>
              </div>
              
              <!-- Variance Summary -->
              <div class="flex items-center gap-4 text-sm">
                <div class="flex items-center gap-1">
                  <div class="w-3 h-3 rounded-full bg-green-500"></div>
                  <span class="text-muted-foreground">Match: {varianceStats.matched}</span>
                </div>
                <div class="flex items-center gap-1">
                  <div class="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span class="text-muted-foreground">Under: {varianceStats.under}</span>
                </div>
                <div class="flex items-center gap-1">
                  <div class="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span class="text-muted-foreground">Over: {varianceStats.over}</span>
                </div>
              </div>
            </div>

            <div class="border border-border rounded-lg overflow-hidden">
              <Table.Root>
                <Table.Header class="bg-muted/50">
                  <Table.Row>
                    <Table.Head class="w-[30%]">Product</Table.Head>
                    <Table.Head class="text-center w-[12%]">Ordered</Table.Head>
                    <Table.Head class="text-center w-[15%]">Received</Table.Head>
                    <Table.Head class="text-center w-[12%]">Variance</Table.Head>
                    <Table.Head class="text-center w-[15%]">Condition</Table.Head>
                    <Table.Head class="text-right w-[12%]">Amount</Table.Head>
                    <Table.Head class="w-[4%]"></Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {#each receiptItems as item, index}
                    {@const variance = (item.receivedQuantity || 0) - (item.quantity || 0)}
                    <Table.Row class="hover:bg-muted/30">
                      <Table.Cell>
                        <div class="font-medium">{item.productName}</div>
                        {#if item.notes}
                          <div class="text-xs text-muted-foreground">{item.notes}</div>
                        {/if}
                      </Table.Cell>
                      <Table.Cell class="text-center">
                        <span class="font-mono text-muted-foreground">{item.quantity}</span>
                      </Table.Cell>
                      <Table.Cell class="text-center">
                        <Input 
                          type="number"
                          value={item.receivedQuantity}
                          on:input={(e) => updateItemReceived(index, parseFloat(e.currentTarget.value) || 0)}
                          min="0"
                          step="1"
                          class="w-20 text-center font-mono mx-auto h-8"
                        />
                      </Table.Cell>
                      <Table.Cell class="text-center">
                        <div class="flex items-center justify-center gap-1 {getVarianceClass(item.quantity, item.receivedQuantity)}">
                          <svelte:component this={getVarianceIcon(item.quantity, item.receivedQuantity)} size={14} />
                          <span class="font-mono font-bold">
                            {variance === 0 ? '0' : variance > 0 ? `+${variance}` : variance}
                          </span>
                        </div>
                      </Table.Cell>
                      <Table.Cell class="text-center">
                        <Select.Root
                          selected={{ value: item.condition, label: item.condition }}
                          onSelectedChange={(v) => { if (v?.value) updateItemCondition(index, v.value); }}
                        >
                          <Select.Trigger class="h-8 w-28 text-xs">
                            <Select.Value />
                          </Select.Trigger>
                          <Select.Content>
                            <Select.Item value="good">Good</Select.Item>
                            <Select.Item value="damaged">Damaged</Select.Item>
                            <Select.Item value="expired">Expired</Select.Item>
                            <Select.Item value="wrong_item">Wrong Item</Select.Item>
                          </Select.Content>
                        </Select.Root>
                      </Table.Cell>
                      <Table.Cell class="text-right font-mono font-bold">
                        ${(item.receivedQuantity * item.unitPrice).toFixed(2)}
                      </Table.Cell>
                      <Table.Cell>
                        <button 
                          on:click={() => removeItem(index)}
                          class="p-1 text-destructive hover:bg-destructive/10 rounded"
                        >
                          <X size={14} />
                        </button>
                      </Table.Cell>
                    </Table.Row>
                  {/each}
                </Table.Body>
              </Table.Root>
            </div>

            <!-- Variance Summary Bar -->
            {#if varianceStats.totalVariance !== 0}
              <div class="mt-4 p-3 rounded-lg {varianceStats.totalVariance < 0 ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-blue-500/10 border border-blue-500/20'}">
                <div class="flex items-center gap-2">
                  <AlertTriangle size={16} class={varianceStats.totalVariance < 0 ? 'text-amber-500' : 'text-blue-500'} />
                  <span class="text-sm font-medium">
                    {#if varianceStats.totalVariance < 0}
                      Receiving {Math.abs(varianceStats.totalVariance)} fewer items than ordered
                    {:else}
                      Receiving {varianceStats.totalVariance} more items than ordered
                    {/if}
                  </span>
                </div>
              </div>
            {/if}
          </div>

          <!-- Step 3: Receipt Details -->
          <div>
            <div class="flex items-center gap-2 mb-3">
              <div class="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</div>
              <Label class="text-base font-semibold">Receipt Details</Label>
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <Label class="text-sm">Receipt Date</Label>
                <DatePicker bind:value={receiptDate} class="w-full" />
              </div>
              <div>
                <Label class="text-sm">Notes (optional)</Label>
                <Input bind:value={receiptNotes} placeholder="Any notes about this delivery..." />
              </div>
            </div>
          </div>

          <!-- Invoice Creation Section -->
          <div class="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
            <div class="flex items-center gap-3 mb-3">
              <input 
                type="checkbox" 
                id="createInvoice" 
                bind:checked={createInvoice}
                class="w-5 h-5 rounded border-blue-500/50 text-blue-500 focus:ring-blue-500"
              />
              <Label for="createInvoice" class="text-base font-semibold cursor-pointer">
                Create Invoice for Payment Tracking
              </Label>
            </div>
            
            {#if createInvoice}
              <div class="grid grid-cols-3 gap-4 mt-3">
                <div>
                  <Label class="text-sm">NCF (Invoice Number)</Label>
                  <Input 
                    bind:value={invoiceNCF} 
                    placeholder="B01-XXXXXXXX" 
                    class="font-mono"
                  />
                  <p class="text-xs text-muted-foreground mt-1">Leave blank to auto-generate</p>
                </div>
                <div>
                  <Label class="text-sm">Credit Days</Label>
                  <Input 
                    type="number" 
                    bind:value={invoiceCreditDays} 
                    placeholder="30"
                    min="0"
                  />
                </div>
                <div>
                  <Label class="text-sm">Due Date</Label>
                  <DatePicker bind:value={invoiceDueDate} class="w-full" />
                  <p class="text-xs text-muted-foreground mt-1">Auto-calculated if empty</p>
                </div>
              </div>
              <p class="text-xs text-blue-600 mt-3">
                ✓ Invoice will appear in Purchase Invoices for payment tracking and accounting
              </p>
              
              <!-- Invoice Photo Capture -->
              <div class="mt-4 pt-4 border-t border-blue-500/20">
                <Label class="text-sm font-medium flex items-center gap-2">
                  <Camera size={16} />
                  Foto de Factura (Opcional)
                </Label>
                <p class="text-xs text-muted-foreground mb-3">Captura una foto de la factura física para tu archivo</p>
                
                <input 
                  type="file" 
                  accept="image/*"
                  capture="environment"
                  on:change={handlePhotoCapture}
                  bind:this={photoInputRef}
                  class="hidden"
                  id="invoice-photo-po"
                />
                
                {#if invoicePhotoUrl}
                  <div class="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div class="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
                      <img src={invoicePhotoUrl} alt="Invoice" class="w-full h-full object-cover" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium text-green-700 truncate">{invoicePhotoName}</p>
                      <p class="text-xs text-green-600">Foto capturada ✓</p>
                    </div>
                    <div class="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        on:click={() => showPhotoPreview = true}
                        class="h-8 w-8 p-0"
                      >
                        <Eye size={16} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        on:click={clearPhoto}
                        class="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                {:else}
                  <div class="flex gap-2">
                    <Button 
                      variant="outline" 
                      class="flex-1"
                      on:click={() => triggerPhotoCapture('invoice-photo-po')}
                    >
                      <Camera size={16} class="mr-2" />
                      Tomar Foto
                    </Button>
                    <Button 
                      variant="outline" 
                      class="flex-1"
                      on:click={() => triggerGallerySelect('invoice-photo-po')}
                    >
                      <Image size={16} class="mr-2" />
                      Elegir de Galería
                    </Button>
                  </div>
                {/if}
              </div>
            {/if}
          </div>

          <!-- Totals & Save -->
          <div class="flex justify-between items-center pt-4 border-t border-border">
            <div>
              <div class="text-sm text-muted-foreground">Receipt Total</div>
              <div class="text-3xl font-bold">${receiptTotal.toFixed(2)}</div>
              <div class="text-xs text-muted-foreground mt-1">
                {receiptItems.length} items • {varianceStats.totalReceived} units
              </div>
            </div>
            <Button on:click={saveReceipt} size="lg" class="flex items-center gap-2">
              <Save size={18} />
              Save Receipt & Update Inventory
            </Button>
          </div>
        {:else if !selectedPO}
          <div class="text-center py-12 text-muted-foreground">
            <ClipboardList size={48} class="mx-auto mb-4 opacity-50" />
            <p class="text-lg font-medium">Select a Purchase Order to start receiving</p>
            <p class="text-sm mt-1">Choose from the dropdown above to compare ordered vs. received quantities</p>
          </div>
        {/if}
      </div>
    </Tabs.Content>

    <!-- Manual Entry Tab -->
    <Tabs.Content value="manual" class="space-y-4">
      <div class="bg-card rounded-xl border border-border p-6 space-y-4">
        <div class="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mb-4">
          <div class="flex items-center gap-2 text-amber-600 text-sm">
            <AlertTriangle size={16} />
            <span><strong>Note:</strong> For faster entry without a PO, consider using <a href="/capture" class="underline font-medium">Quick Capture</a> with OCR.</span>
          </div>
        </div>

        <!-- Supplier Selection -->
        <div>
          <Label>Supplier *</Label>
          <Select.Root 
            selected={receiptSupplierId ? { value: receiptSupplierId, label: suppliers.find(s => s.id === receiptSupplierId)?.name || '' } : undefined}
            onSelectedChange={(v) => receiptSupplierId = v?.value ?? null}
          >
            <Select.Trigger>
              <Select.Value placeholder="Select supplier" />
            </Select.Trigger>
            <Select.Content>
              {#each suppliers as supplier}
                <Select.Item value={supplier.id}>{supplier.name}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        <!-- Date -->
        <div>
          <Label>Receipt Date *</Label>
          <DatePicker bind:value={receiptDate} class="w-full" />
        </div>

        <!-- Items List -->
        <div>
          <Label>Items *</Label>
          <div class="border border-border rounded-lg p-4 space-y-2">
            {#each receiptItems as item, index}
              <div class="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <div class="flex-1">
                  <div class="font-medium">{item.productName}</div>
                  <div class="text-sm text-muted-foreground">
                    {item.receivedQuantity} × ${item.unitPrice.toFixed(2)} = ${(item.receivedQuantity * item.unitPrice).toFixed(2)}
                  </div>
                </div>
                <span class="px-2 py-1 rounded text-xs font-medium {getConditionColor(item.condition)}">
                  {item.condition}
                </span>
                <button 
                  on:click={() => removeItem(index)}
                  class="p-1 text-destructive hover:bg-destructive/10 rounded"
                >
                  <X size={16} />
                </button>
              </div>
            {/each}

            <!-- Add Item Form -->
            <div class="border-t border-border pt-4 space-y-3">
              <div class="relative">
                <Input 
                  bind:value={newItemProductName}
                  on:focus={() => showProductSearch = true}
                  on:input={() => showProductSearch = true}
                  placeholder="Search product or enter name..."
                />
                {#if productSearchResults.length > 0}
                  <div class="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg p-1 max-h-40 overflow-y-auto z-50">
                    {#each productSearchResults as product}
                      <button
                        on:click={() => {
                          newItemProductId = product.id || null;
                          newItemProductName = product.name;
                          newItemUnitPrice = product.lastPrice || 0;
                          showProductSearch = false;
                        }}
                        class="w-full text-left px-3 py-2 hover:bg-accent rounded text-sm"
                      >
                        {product.name} - ${product.lastPrice?.toFixed(2) || '0.00'}
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
              <div class="grid grid-cols-4 gap-2">
                <div>
                  <Label class="text-xs">Quantity</Label>
                  <Input 
                    type="number"
                    bind:value={newItemReceivedQuantity}
                    min="1"
                    step="1"
                  />
                </div>
                <div>
                  <Label class="text-xs">Unit Price</Label>
                  <Input 
                    type="number"
                    bind:value={newItemUnitPrice}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <Label class="text-xs">Condition</Label>
                  <Select.Root 
                    selected={{ value: newItemCondition, label: newItemCondition }}
                    onSelectedChange={(v) => { if (v?.value) newItemCondition = v.value; }}
                  >
                    <Select.Trigger class="h-9">
                      <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="good">Good</Select.Item>
                      <Select.Item value="damaged">Damaged</Select.Item>
                      <Select.Item value="expired">Expired</Select.Item>
                      <Select.Item value="wrong_item">Wrong Item</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </div>
                <div class="flex items-end">
                  <Button on:click={addManualItem} class="w-full">Add</Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div>
          <Label>Notes</Label>
          <Input bind:value={receiptNotes} placeholder="Additional notes..." />
        </div>

        <!-- Invoice Creation Section -->
        <div class="bg-blue-500/5 border border-blue-500/20 rounded-lg p-4">
          <div class="flex items-center gap-3 mb-3">
            <input 
              type="checkbox" 
              id="createInvoiceManual" 
              bind:checked={createInvoice}
              class="w-5 h-5 rounded border-blue-500/50 text-blue-500 focus:ring-blue-500"
            />
            <Label for="createInvoiceManual" class="text-base font-semibold cursor-pointer">
              Create Invoice for Payment Tracking
            </Label>
          </div>
          
          {#if createInvoice}
            <div class="grid grid-cols-3 gap-4 mt-3">
              <div>
                <Label class="text-sm">NCF (Invoice Number)</Label>
                <Input 
                  bind:value={invoiceNCF} 
                  placeholder="B01-XXXXXXXX" 
                  class="font-mono"
                />
              </div>
              <div>
                <Label class="text-sm">Credit Days</Label>
                <Input 
                  type="number" 
                  bind:value={invoiceCreditDays} 
                  placeholder="30"
                  min="0"
                />
              </div>
              <div>
                <Label class="text-sm">Due Date</Label>
                <DatePicker bind:value={invoiceDueDate} class="w-full" />
              </div>
            </div>
            
            <!-- Invoice Photo Capture (Manual Tab) -->
            <div class="mt-4 pt-4 border-t border-blue-500/20">
              <Label class="text-sm font-medium flex items-center gap-2">
                <Camera size={16} />
                Foto de Factura (Opcional)
              </Label>
              <p class="text-xs text-muted-foreground mb-3">Captura una foto de la factura física para tu archivo</p>
              
              <input 
                type="file" 
                accept="image/*"
                capture="environment"
                on:change={handlePhotoCapture}
                class="hidden"
                id="invoice-photo-manual"
              />
              
              {#if invoicePhotoUrl}
                <div class="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div class="relative w-16 h-16 rounded-lg overflow-hidden border border-border">
                    <img src={invoicePhotoUrl} alt="Invoice" class="w-full h-full object-cover" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-green-700 truncate">{invoicePhotoName}</p>
                    <p class="text-xs text-green-600">Foto capturada ✓</p>
                  </div>
                  <div class="flex gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      on:click={() => showPhotoPreview = true}
                      class="h-8 w-8 p-0"
                    >
                      <Eye size={16} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      on:click={clearPhoto}
                      class="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              {:else}
                <div class="flex gap-2">
                  <Button 
                    variant="outline" 
                    class="flex-1"
                    on:click={() => triggerPhotoCapture('invoice-photo-manual')}
                  >
                    <Camera size={16} class="mr-2" />
                    Tomar Foto
                  </Button>
                  <Button 
                    variant="outline" 
                    class="flex-1"
                    on:click={() => triggerGallerySelect('invoice-photo-manual')}
                  >
                    <Image size={16} class="mr-2" />
                    Elegir de Galería
                  </Button>
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Total & Save -->
        <div class="flex justify-between items-center pt-4 border-t border-border">
          <div>
            <div class="text-sm text-muted-foreground">Total</div>
            <div class="text-2xl font-bold">${receiptTotal.toFixed(2)}</div>
          </div>
          <Button on:click={saveReceipt} size="lg" class="flex items-center gap-2">
            <Save size={18} />
            Save Receipt
          </Button>
        </div>
      </div>
    </Tabs.Content>

    <!-- Excel Import Tab -->
    <Tabs.Content value="excel" class="space-y-4">
      <div class="bg-card rounded-xl border border-border p-6 space-y-4">
        <div>
          <Label>Upload Excel File</Label>
          <input 
            type="file" 
            accept=".xlsx,.xls"
            on:change={handleExcelUpload}
            class="w-full p-2 border border-border rounded"
          />
        </div>

        {#if excelData.length > 0 && !excelMapped}
          <div>
            <Label>Map Columns</Label>
            <div class="space-y-2">
              <div>
                <Label class="text-xs">Product Name Column</Label>
                <Select.Root 
                  selected={excelColumnMap.productName ? { value: excelColumnMap.productName, label: excelColumnMap.productName } : undefined}
                  onSelectedChange={(v) => excelColumnMap.productName = v?.value || ''}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {#each Object.keys(excelData[0] || {}) as key}
                      <Select.Item value={key}>{key}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
              <div>
                <Label class="text-xs">Quantity Column</Label>
                <Select.Root 
                  selected={excelColumnMap.quantity ? { value: excelColumnMap.quantity, label: excelColumnMap.quantity } : undefined}
                  onSelectedChange={(v) => excelColumnMap.quantity = v?.value || ''}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {#each Object.keys(excelData[0] || {}) as key}
                      <Select.Item value={key}>{key}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
              <div>
                <Label class="text-xs">Unit Price Column</Label>
                <Select.Root 
                  selected={excelColumnMap.unitPrice ? { value: excelColumnMap.unitPrice, label: excelColumnMap.unitPrice } : undefined}
                  onSelectedChange={(v) => excelColumnMap.unitPrice = v?.value || ''}
                >
                  <Select.Trigger>
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    {#each Object.keys(excelData[0] || {}) as key}
                      <Select.Item value={key}>{key}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
              <Button on:click={mapExcelData}>Map Data</Button>
            </div>
          </div>
        {/if}

        {#if excelMapped}
          <div>
            <Label>Mapped Items ({receiptItems.length})</Label>
            <div class="border border-border rounded-lg p-4 space-y-2 max-h-64 overflow-y-auto">
              {#each receiptItems as item}
                <div class="text-sm">
                  {item.productName} - {item.receivedQuantity} × ${item.unitPrice.toFixed(2)}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if excelMapped}
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div>
                <Label>Supplier *</Label>
                <Select.Root 
                  selected={receiptSupplierId ? { value: receiptSupplierId, label: suppliers.find(s => s.id === receiptSupplierId)?.name || '' } : undefined}
                  onSelectedChange={(v) => receiptSupplierId = v?.value ?? null}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Select supplier" />
                  </Select.Trigger>
                  <Select.Content>
                    {#each suppliers as supplier}
                      <Select.Item value={supplier.id}>{supplier.name}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
              <div>
                <Label>Receipt Date *</Label>
                <DatePicker bind:value={receiptDate} class="w-full" />
              </div>
            </div>
            <div class="flex justify-between items-center pt-4 border-t border-border">
              <div class="text-2xl font-bold">${receiptTotal.toFixed(2)}</div>
              <Button on:click={saveReceipt} size="lg">Save Receipt</Button>
            </div>
          </div>
        {/if}
      </div>
    </Tabs.Content>
  </Tabs.Root>
</div>

<!-- Receipt View Dialog -->
<Dialog.Root bind:open={showReceiptView}>
  <Dialog.Content class="max-w-3xl max-h-[90vh] overflow-y-auto">
    <Dialog.Header>
      <Dialog.Title>Receipt Details</Dialog.Title>
      <Dialog.Description>{viewingReceipt?.receiptNumber}</Dialog.Description>
    </Dialog.Header>

    {#if viewingReceipt}
      <div class="space-y-4">
        <!-- Info Grid -->
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-muted/50 p-3 rounded-lg">
            <div class="text-xs text-muted-foreground uppercase mb-1">Supplier</div>
            <div class="font-medium">{viewingReceipt.supplierName || 'Unknown'}</div>
          </div>
          <div class="bg-muted/50 p-3 rounded-lg">
            <div class="text-xs text-muted-foreground uppercase mb-1">Receipt Date</div>
            <div class="font-medium">{viewingReceipt.receiptDate}</div>
          </div>
          {#if viewingReceipt.purchaseOrderId}
            <div class="bg-muted/50 p-3 rounded-lg">
              <div class="text-xs text-muted-foreground uppercase mb-1">Linked PO</div>
              <div class="font-medium font-mono">{viewingReceipt.purchaseOrderId}</div>
            </div>
          {/if}
          <div class="bg-muted/50 p-3 rounded-lg">
            <div class="text-xs text-muted-foreground uppercase mb-1">Total</div>
            <div class="font-bold text-lg">${viewingReceipt.total.toLocaleString()}</div>
          </div>
        </div>

        <!-- Items Table -->
        <div>
          <h3 class="font-bold mb-2">Items Received</h3>
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>Product</Table.Head>
                <Table.Head class="text-center">Ordered</Table.Head>
                <Table.Head class="text-center">Received</Table.Head>
                <Table.Head class="text-center">Condition</Table.Head>
                <Table.Head class="text-right">Unit Price</Table.Head>
                <Table.Head class="text-right">Amount</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each viewingReceipt.items as item}
                <Table.Row>
                  <Table.Cell>
                    <div class="font-medium">{item.productName}</div>
                    {#if item.notes}
                      <div class="text-xs text-muted-foreground">{item.notes}</div>
                    {/if}
                  </Table.Cell>
                  <Table.Cell class="text-center font-mono">{item.quantity}</Table.Cell>
                  <Table.Cell class="text-center font-mono font-bold">{item.receivedQuantity}</Table.Cell>
                  <Table.Cell class="text-center">
                    <span class="px-2 py-1 rounded text-xs font-medium 
                      {item.condition === 'good' ? 'bg-green-500/10 text-green-500' : 
                       item.condition === 'damaged' ? 'bg-red-500/10 text-red-500' : 
                       item.condition === 'expired' ? 'bg-amber-500/10 text-amber-500' : 
                       'bg-purple-500/10 text-purple-500'}">
                      {item.condition}
                    </span>
                  </Table.Cell>
                  <Table.Cell class="text-right font-mono">${item.unitPrice.toFixed(2)}</Table.Cell>
                  <Table.Cell class="text-right font-mono font-bold">
                    ${(item.receivedQuantity * item.unitPrice).toFixed(2)}
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>

        {#if viewingReceipt.notes}
          <div>
            <h3 class="font-bold mb-2">Notes</h3>
            <p class="text-sm text-muted-foreground">{viewingReceipt.notes}</p>
          </div>
        {/if}

        {#if viewingReceipt.invoicePhotoUrl}
          <div>
            <h3 class="font-bold mb-2 flex items-center gap-2">
              <Camera size={16} />
              Foto de Factura
            </h3>
            <button 
              class="block rounded-lg overflow-hidden border border-border hover:border-primary transition-colors cursor-pointer"
              on:click={() => {
                invoicePhotoUrl = viewingReceipt?.invoicePhotoUrl || null;
                showPhotoPreview = true;
              }}
            >
              <img 
                src={viewingReceipt.invoicePhotoUrl} 
                alt="Invoice" 
                class="max-w-xs max-h-48 object-contain"
              />
            </button>
            <p class="text-xs text-muted-foreground mt-1">Click para ver en grande</p>
          </div>
        {/if}

        <!-- Totals -->
        <div class="flex justify-end">
          <div class="w-64 space-y-1">
            <div class="flex justify-between text-lg font-bold border-t border-border pt-2">
              <span>Total</span>
              <span class="font-mono">${viewingReceipt.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <Dialog.Footer>
      <Button variant="outline" on:click={closeReceiptView}>Close</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Photo Preview Modal -->
<Dialog.Root bind:open={showPhotoPreview}>
  <Dialog.Content class="max-w-4xl">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <Camera size={20} />
        Foto de Factura
      </Dialog.Title>
    </Dialog.Header>
    
    {#if invoicePhotoUrl}
      <div class="flex justify-center items-center bg-muted/30 rounded-lg p-4 min-h-[400px]">
        <img 
          src={invoicePhotoUrl} 
          alt="Invoice full view" 
          class="max-w-full max-h-[70vh] object-contain rounded"
        />
      </div>
    {/if}
    
    <Dialog.Footer>
      <Button variant="outline" on:click={() => showPhotoPreview = false}>Cerrar</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
