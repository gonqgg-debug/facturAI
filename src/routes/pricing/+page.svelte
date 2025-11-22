<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '$lib/db';
  import { Search, Tag, TrendingUp, TrendingDown, X, Filter, Upload, Sparkles, AlertTriangle, FileSpreadsheet } from 'lucide-svelte';
  import type { Product, Supplier } from '$lib/types';
  import * as XLSX from 'xlsx';
  import { apiKey } from '$lib/stores';
  import { parseInvoiceWithGrok } from '$lib/grok'; // We'll reuse this or create a new one for pricing

  let products: (Product & { supplierName?: string })[] = [];
  let suppliers: Supplier[] = [];
  let searchQuery = '';
  let selectedCategory = 'All';
  let activeTab: 'catalog' | 'suggestions' = 'catalog';
  
  // Import State
  let fileInput: HTMLInputElement;
  let isImporting = false;

  // Analysis State
  let isAnalyzing = false;

  // History Modal
  let selectedProduct: (Product & { supplierName?: string }) | null = null;
  let productHistory: { date: string, price: number, invoiceId?: number }[] = [];
  let showHistory = false;

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    suppliers = await db.suppliers.toArray();
    const rawProducts = await db.products.toArray();
    
    // Join with supplier names
    products = rawProducts.map(p => ({
      ...p,
      supplierName: suppliers.find(s => s.id === p.supplierId)?.name || 'Unknown'
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  $: filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.supplierName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    
    if (activeTab === 'suggestions') {
        // Only show products with "bad" margins or AI suggestions
        const currentMargin = calculateMargin(p.lastPrice, p.sellingPrice);
        const target = p.targetMargin || 0.30;
        const hasAiSuggestion = !!p.aiSuggestedPrice;
        return matchesSearch && matchesCategory && (currentMargin < target || hasAiSuggestion);
    }

    return matchesSearch && matchesCategory;
  });

  function calculateMargin(cost: number, price?: number): number {
    if (!price || price === 0) return 0;
    return (price - cost) / price;
  }

  async function handleFileUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) return;

    const file = target.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        await processImport(jsonData);
      } catch (err) {
        alert('Error reading file: ' + err);
      }
    };

    reader.readAsArrayBuffer(file);
  }

  async function processImport(data: any[]) {
    isImporting = true;
    let updatedCount = 0;
    let createdCount = 0;

    for (const row of data) {
      // Expected columns: Name, Supplier, Cost, Price, Category, TargetMargin, SalesVolume, TotalSales
      const name = row['Name'] || row['Product Name'] || row['Producto'];
      if (!name) continue;

      // Find existing product
      const existing = products.find(p => p.name.toLowerCase() === name.toLowerCase());
      
      const productData = {
        sellingPrice: row['Price'] || row['Precio'] || row['Selling Price'],
        targetMargin: row['TargetMargin'] || row['Margen'] || row['Target Margin'],
        category: row['Category'] || row['Categoria'],
        salesVolume: row['SalesVolume'] || row['Sales Volume'] || row['Cantidad Vendida'],
        // If total sales is provided, we can infer velocity if we had a date range, 
        // but for now let's just store the volume.
        lastSaleDate: new Date().toISOString().split('T')[0] // Mark as updated today
      };

      // Clean undefined values
      Object.keys(productData).forEach(key => productData[key] === undefined && delete productData[key]);

      if (existing && existing.id) {
        await db.products.update(existing.id, productData);
        updatedCount++;
      } else {
        // Create new product if it doesn't exist
        // We need a supplier ID. Try to find by name or use a default "Imported" supplier.
        const supplierName = row['Supplier'] || row['Suplidor'] || 'Unknown';
        let supplier = suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
        
        if (!supplier && supplierName !== 'Unknown') {
            // Create supplier on the fly? Or just link to unknown?
            // Let's create it to be safe
            const id = await db.suppliers.add({ name: supplierName, rnc: '000000000', examples: [] });
            supplier = { id, name: supplierName, rnc: '000000000', examples: [] };
            suppliers.push(supplier);
        }

        await db.products.add({
            name: name,
            supplierId: supplier?.id,
            lastPrice: row['Cost'] || row['Costo'] || 0,
            lastDate: new Date().toISOString().split('T')[0],
            ...productData
        });
        createdCount++;
      }
    }

    await loadData();
    isImporting = false;
    alert(`Import Complete: Updated ${updatedCount}, Created ${createdCount} products.`);
  }

  async function analyzeWithAI() {
    if (!$apiKey) {
        alert('Please set your API Key in Settings first.');
        return;
    }
    
    isAnalyzing = true;
    const productsToAnalyze = products.filter(p => !p.aiSuggestedPrice || activeTab === 'suggestions');
    
    // Fetch Pricing Rules from KB
    const globalContextItems = await db.globalContext.toArray();
    const pricingRules = globalContextItems
        .filter(i => i.category === 'pricing_rule')
        .map(i => `- ${i.title}: ${i.content}`)
        .join('\n');

    // Process in batches of 5 to avoid rate limits/timeouts
    const batchSize = 5;
    let processed = 0;
    let errors = 0;

    try {
        for (let i = 0; i < productsToAnalyze.length; i += batchSize) {
            const batch = productsToAnalyze.slice(i, i + batchSize);
            
            // Prepare prompt for batch
            const itemsText = batch.map(p => 
                `- ${p.name} (Category: ${p.category || 'Unknown'}, Cost: ${p.lastPrice}, Current Price: ${p.sellingPrice || 'N/A'}, Sales Vol: ${p.salesVolume || 'Unknown'})`
            ).join('\n');

            const prompt = `
                Analyze the pricing for these Dominican Republic Colmado products.
                
                GLOBAL PRICING RULES (FROM KNOWLEDGE BASE):
                ${pricingRules || 'No specific custom rules found. Use general logic.'}

                GENERAL LOGIC:
                1. "Fria" (Beer) = Low margin (15-20%), traffic driver.
                2. "Surtido" (Rice, Oil) = Competitive margin (20-25%).
                3. "Antojos" (Snacks, Rum) = High margin (30-50%).
                
                CRITICAL CONSTRAINTS:
                1. Suggested Price MUST be greater than Cost.
                2. Round prices to nearest $5 or $10. No pennies.
                3. Return JSON array with: { name, suggestedPrice, suggestedMargin, reasoning }.

                Products:
                ${itemsText}
            `;

            try {
                const response = await fetch('https://api.x.ai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${$apiKey}`
                    },
                    body: JSON.stringify({
                        messages: [
                            { role: "system", content: "You are an expert Pricing Analyst for a Dominican Colmado. Return ONLY a valid JSON array. Do not include markdown formatting like ```json." },
                            { role: "user", content: prompt }
                        ],
                        model: "grok-3",
                        stream: false,
                        temperature: 0.1
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    console.error('AI API Error:', response.status, response.statusText, result);
                    throw new Error(`API Error (${response.status})`);
                }

                if (!result.choices || result.choices.length === 0) {
                    throw new Error('No choices returned from AI');
                }

                const content = result.choices[0].message.content;
                
                // Parse JSON from content (handle potential markdown blocks)
                const jsonStr = content.replace(/```json\n?|```/g, '').trim();
                const suggestions = JSON.parse(jsonStr);

                // Update DB
                for (const s of suggestions) {
                    const product = batch.find(p => p.name.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(p.name.toLowerCase()));
                    
                    // Validation: Ensure Price > Cost
                    if (product && product.id) {
                        let finalPrice = s.suggestedPrice;
                        if (finalPrice <= product.lastPrice) {
                            finalPrice = product.lastPrice * 1.15; // Force minimum 15% margin if AI fails
                            s.reasoning += " [Auto-corrected: Price was <= Cost]";
                        }

                        await db.products.update(product.id, {
                            aiSuggestedPrice: finalPrice,
                            aiSuggestedMargin: (finalPrice - product.lastPrice) / finalPrice,
                            aiReasoning: s.reasoning
                        });
                    }
                }
                processed += batch.length;

            } catch (batchError) {
                console.error(`Error processing batch ${i}:`, batchError);
                errors++;
                // Continue to next batch instead of stopping completely
            }
        }
        alert(`Analysis Complete! Processed ${processed} products. Errors: ${errors}`);
    } catch (e) {
        console.error(e);
        alert('Critical error during AI analysis: ' + e);
    } finally {
        await loadData();
        isAnalyzing = false;
    }
  }

  async function openHistory(product: Product & { supplierName?: string }) {
    selectedProduct = product;
    showHistory = true;
    productHistory = [];

    const invoices = await db.invoices.toArray();
    const history: typeof productHistory = [];

    invoices.forEach(inv => {
      if (inv.items) {
        const item = inv.items.find(i => i.description?.toLowerCase() === product.name.toLowerCase());
        if (item && item.unitPrice) {
          history.push({
            date: inv.issueDate || 'Unknown',
            price: item.unitPrice,
            invoiceId: inv.id
          });
        }
      }
    });

    productHistory = history.sort((a, b) => a.date.localeCompare(b.date));
  }

  function closeHistory() {
    showHistory = false;
    selectedProduct = null;
  }
</script>

<div class="p-4 max-w-6xl mx-auto pb-24">
  <!-- Header -->
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
    <div>
        <h1 class="text-2xl font-bold text-white flex items-center space-x-2">
        <Tag class="text-ios-blue" />
        <span>Pricing Engine</span>
        </h1>
        <p class="text-gray-400 text-sm">Optimize margins and analyze costs</p>
    </div>
    
    <div class="flex flex-wrap gap-2">
        <button 
            class="bg-ios-card border border-ios-separator text-white px-4 py-2 rounded-lg flex items-center space-x-2 text-sm font-bold hover:bg-white/5 transition-colors"
            on:click={() => fileInput.click()}
        >
            <Upload size={16} />
            <span>Import Catalog</span>
        </button>
        <input 
            type="file" 
            bind:this={fileInput} 
            class="hidden" 
            accept=".xlsx,.xls,.csv"
            on:change={handleFileUpload}
        />

        <button 
            class="bg-gradient-to-r from-ios-blue to-purple-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 text-sm font-bold shadow-lg hover:shadow-xl transition-all"
            on:click={analyzeWithAI}
            disabled={isAnalyzing}
        >
            <Sparkles size={16} class={isAnalyzing ? 'animate-spin' : ''} />
            <span>{isAnalyzing ? 'Analyzing...' : 'Analyze with AI'}</span>
        </button>
    </div>
  </div>

  <!-- Tabs -->
  <div class="flex space-x-1 bg-ios-card p-1 rounded-xl mb-6 border border-ios-separator w-full md:w-auto inline-flex">
    <button 
        class="px-4 py-2 rounded-lg text-sm font-medium transition-all {activeTab === 'catalog' ? 'bg-gray-500/20 text-white shadow-sm' : 'text-gray-400 hover:text-white'}"
        on:click={() => activeTab = 'catalog'}
    >
        Catalog
    </button>
    <button 
        class="px-4 py-2 rounded-lg text-sm font-medium transition-all {activeTab === 'suggestions' ? 'bg-gray-500/20 text-white shadow-sm' : 'text-gray-400 hover:text-white'}"
        on:click={() => activeTab = 'suggestions'}
    >
        Suggestions
    </button>
  </div>

  <!-- Search & Filter Bar -->
  <div class="flex flex-col md:flex-row gap-4 mb-6">
    <div class="relative flex-1">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
        <input 
          bind:value={searchQuery} 
          placeholder="Search product or supplier..." 
          class="w-full bg-ios-card border border-ios-separator rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:border-ios-blue outline-none"
        />
    </div>
    <select 
        bind:value={selectedCategory}
        class="bg-ios-card border border-ios-separator rounded-lg px-3 py-2 text-white text-sm focus:border-ios-blue outline-none"
    >
        <option value="All">All Categories</option>
        <option value="Inventory">Inventory</option>
        <option value="Utilities">Utilities</option>
        <option value="Maintenance">Maintenance</option>
        <option value="Payroll">Payroll</option>
        <option value="Other">Other</option>
    </select>
  </div>

  <!-- Content Area -->
  <div class="bg-ios-card rounded-xl border border-ios-separator overflow-hidden min-h-[400px]">
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-gray-500/10 text-gray-400 text-xs uppercase">
          <tr>
            <th class="p-4 font-medium">Product</th>
            <th class="p-4 font-medium text-right">Sales Vol</th>
            <th class="p-4 font-medium text-right">Cost</th>
            <th class="p-4 font-medium text-right">Price</th>
            <th class="p-4 font-medium text-right">Margin</th>
            {#if activeTab === 'suggestions'}
                <th class="p-4 font-medium text-right text-ios-blue">AI Suggestion</th>
                <th class="p-4 font-medium">Reasoning</th>
            {/if}
            <th class="p-4 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-ios-separator">
          {#each filteredProducts as product}
            {@const margin = calculateMargin(product.lastPrice, product.sellingPrice)}
            {@const target = product.targetMargin || 0.30}
            {@const isLowMargin = margin < target}
            
            <tr class="group hover:bg-white/5 transition-colors">
              <td class="p-4">
                <div class="font-medium text-white">{product.name}</div>
                <div class="text-xs text-gray-500">{product.supplierName} • {product.category || 'Uncategorized'}</div>
              </td>
              <td class="p-4 text-right font-mono text-gray-400">
                {product.salesVolume || '-'}
              </td>
              <td class="p-4 text-right font-mono text-gray-300">
                ${product.lastPrice.toFixed(2)}
              </td>
              <td class="p-4 text-right font-mono text-white font-bold">
                {product.sellingPrice ? `$${product.sellingPrice.toFixed(2)}` : '-'}
              </td>
              <td class="p-4 text-right">
                {#if product.sellingPrice}
                    <span class="px-2 py-1 rounded-full text-xs font-bold {isLowMargin ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}">
                        {(margin * 100).toFixed(1)}%
                    </span>
                {:else}
                    <span class="text-gray-500">-</span>
                {/if}
              </td>

              {#if activeTab === 'suggestions'}
                <td class="p-4 text-right font-mono text-ios-blue font-bold">
                    {#if product.aiSuggestedPrice}
                        ${product.aiSuggestedPrice.toFixed(2)}
                        <div class="text-[10px] text-ios-blue/70">{((product.aiSuggestedMargin || 0) * 100).toFixed(1)}%</div>
                    {:else}
                        -
                    {/if}
                </td>
                <td class="p-4 text-xs text-gray-400 max-w-xs">
                    {product.aiReasoning || '-'}
                </td>
              {/if}

              <td class="p-4 text-right">
                <button 
                    class="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                    on:click={() => openHistory(product)}
                    title="View History"
                >
                    <TrendingUp size={16} />
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      
      {#if filteredProducts.length === 0}
        <div class="p-12 text-center text-gray-500 flex flex-col items-center">
          <FileSpreadsheet size={48} class="mb-4 opacity-20" />
          <p class="text-lg font-medium">No products found.</p>
          <p class="text-sm">Try importing a catalog or changing your filters.</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- History Modal (Same as before) -->
{#if showHistory && selectedProduct}
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-ios-card border border-ios-separator rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
      <div class="p-4 border-b border-ios-separator flex justify-between items-center bg-gray-500/10">
        <div>
          <h2 class="text-xl font-bold text-white">{selectedProduct.name}</h2>
          <p class="text-sm text-gray-400">{selectedProduct.supplierName}</p>
        </div>
        <button on:click={closeHistory} class="text-gray-500 hover:text-white">
          <X size={24} />
        </button>
      </div>
      
      <div class="p-6">
        <h3 class="text-xs font-bold text-gray-500 uppercase mb-4">Price History</h3>
        
        <!-- Simple Visual Chart (CSS Bar/Line) -->
        <div class="h-40 flex items-end space-x-2 mb-6 border-b border-gray-700 pb-2">
          {#each productHistory as point}
            {@const maxPrice = Math.max(...productHistory.map(h => h.price)) * 1.2}
            {@const height = (point.price / maxPrice) * 100}
            <div class="flex-1 flex flex-col items-center group relative">
              <!-- Tooltip -->
              <div class="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-xs p-2 rounded pointer-events-none whitespace-nowrap border border-gray-700">
                {point.date}: ${point.price.toFixed(2)}
              </div>
              
              <div 
                class="w-full bg-ios-blue/50 hover:bg-ios-blue transition-colors rounded-t-sm min-w-[4px]"
                style="height: {height}%"
              ></div>
              <span class="text-[10px] text-gray-500 mt-1 truncate w-full text-center">{point.date.split('-').slice(1).join('/')}</span>
            </div>
          {/each}
        </div>

        <div class="space-y-2 max-h-60 overflow-y-auto">
          {#each [...productHistory].reverse() as h}
            <div class="flex justify-between items-center p-2 hover:bg-white/5 rounded-lg">
              <span class="text-gray-400 text-sm">{h.date}</span>
              <span class="text-white font-mono font-bold">${h.price.toFixed(2)}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </div>
{/if}
