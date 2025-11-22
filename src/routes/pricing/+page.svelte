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

  let chatHistory: { role: 'user' | 'assistant', content: string }[] = [];

  function calculateProductScore(product: Product): number {
    let score = 50; // Base score
    
    // Margin Impact
    const margin = calculateMargin(product.lastPrice, product.sellingPrice);
    if (margin > 0.4) score += 20;
    else if (margin > 0.25) score += 10;
    else if (margin < 0.15) score -= 10;

    // Volume Impact
    const volume = product.salesVolume || 0;
    if (volume > 100) score += 30;
    else if (volume > 50) score += 15;
    else if (volume < 10) score -= 10;

    return Math.min(100, Math.max(0, score));
  }

  async function chatWithAI(message: string) {
    if (!message.trim() || !selectedProduct) return;
    
    // Add user message
    chatHistory = [...chatHistory, { role: 'user', content: message }];
    
    // Simulate AI response (or call API)
    // For now, let's do a quick API call for chat
    try {
        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${$apiKey}`
            },
            body: JSON.stringify({
                messages: [
                    { role: "system", content: "You are a helpful Pricing Analyst assistant. Keep answers short and conversational." },
                    { role: "user", content: `Product: ${selectedProduct.name}. Context: ${selectedProduct.aiReasoning}. User Question: ${message}` }
                ],
                model: "grok-3",
                stream: false
            })
        });
        const result = await response.json();
        const aiMsg = result.choices[0].message.content;
        
        chatHistory = [...chatHistory, { role: 'assistant', content: aiMsg }];
    } catch (e) {
        chatHistory = [...chatHistory, { role: 'assistant', content: "Sorry, I couldn't connect to the analyst server." }];
    }
  }

  async function analyzeSingleProduct(product: Product & { supplierName?: string }) {
    if (!$apiKey) {
        alert('Please set your API Key in Settings first.');
        return;
    }
    
    isAnalyzing = true;
    chatHistory = []; // Reset chat

    try {
        // Fetch Pricing Rules
        const globalContextItems = await db.globalContext.toArray();
        const pricingRules = globalContextItems
            .filter(i => i.category === 'pricing_rule')
            .map(i => `- ${i.title}: ${i.content}`)
            .join('\n');

        const prompt = `
            Analyze this product for a Dominican Colmado. Act as a Wall Street Analyst but for groceries.
            
            PRODUCT: ${product.name}
            Supplier: ${product.supplierName}
            Cost: $${product.lastPrice}
            Price: $${product.sellingPrice}
            Volume: ${product.salesVolume} units
            
            RULES:
            ${pricingRules}

            OUTPUT JSON:
            {
                "suggestedPrice": number,
                "suggestedMargin": number,
                "reasoning": "Short, punchy analysis.",
                "analystRating": "BUY" | "SELL" | "HOLD",
                "creativeIdea": "One specific, out-of-the-box idea (e.g. 'Bundle with Coke', 'Flash Sale Friday')."
            }
        `;

        const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${$apiKey}`
            },
            body: JSON.stringify({
                messages: [
                    { role: "system", content: "You are an expert Pricing Analyst. Return ONLY valid JSON." },
                    { role: "user", content: prompt }
                ],
                model: "grok-3",
                stream: false,
                temperature: 0.1
            })
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message || 'API Error');

        const content = result.choices[0].message.content;
        const jsonStr = content.replace(/```json\n?|```/g, '').trim();
        const suggestion = JSON.parse(jsonStr);

        // Update DB
        await db.products.update(product.id!, {
            aiSuggestedPrice: suggestion.suggestedPrice,
            aiSuggestedMargin: suggestion.suggestedMargin,
            aiReasoning: suggestion.reasoning,
            aiAnalystRating: suggestion.analystRating,
            aiCreativeIdea: suggestion.creativeIdea
        });

        // Update UI
        selectedProduct = {
            ...selectedProduct,
            aiSuggestedPrice: suggestion.suggestedPrice,
            aiSuggestedMargin: suggestion.suggestedMargin,
            aiReasoning: suggestion.reasoning,
            aiAnalystRating: suggestion.analystRating,
            aiCreativeIdea: suggestion.creativeIdea
        } as any;

        await loadData();

    } catch (e) {
        console.error(e);
        alert('Analysis failed: ' + e);
    } finally {
        isAnalyzing = false;
    }
  }

  function closeHistory() {
    showHistory = false;
    selectedProduct = null;
    chatHistory = [];
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

<!-- Stock App Style Deep Dive Modal -->
{#if showHistory && selectedProduct}
  <div class="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
    <div class="bg-[#1c1c1e] border border-gray-800 rounded-2xl w-full max-w-6xl h-[90vh] overflow-hidden shadow-2xl flex flex-col">
      
      <!-- Stock Ticker Header -->
      <div class="p-6 border-b border-gray-800 flex justify-between items-start bg-black/40">
        <div>
          <div class="flex items-center space-x-3 mb-2">
            <span class="px-2 py-1 rounded text-[10px] font-bold bg-gray-700 text-gray-300 uppercase tracking-wider">
                {selectedProduct.category || 'Uncategorized'}
            </span>
            <span class="text-xs text-gray-500 font-mono">{selectedProduct.supplierName}</span>
          </div>
          <div class="flex items-end space-x-4">
            <h2 class="text-4xl font-bold text-white tracking-tight">{selectedProduct.name}</h2>
            <div class="flex items-baseline space-x-2 pb-1">
                <span class="text-2xl font-mono font-bold text-white">${selectedProduct.sellingPrice?.toFixed(2) || '-'}</span>
                {#if selectedProduct.sellingPrice && selectedProduct.lastPrice}
                    {@const margin = calculateMargin(selectedProduct.lastPrice, selectedProduct.sellingPrice)}
                    <span class="text-sm font-bold {margin > 0.3 ? 'text-green-500' : 'text-red-500'}">
                        {margin > 0.3 ? '+' : ''}{(margin * 100).toFixed(1)}%
                    </span>
                {/if}
            </div>
          </div>
        </div>
        <div class="flex items-center space-x-4">
            <!-- Product Score Badge -->
            {@const score = calculateProductScore(selectedProduct)}
            <div class="flex flex-col items-end">
                <span class="text-[10px] uppercase text-gray-500 font-bold">Product Score</span>
                <div class="flex items-center space-x-2">
                    <div class="w-12 h-12 rounded-full border-4 {score >= 70 ? 'border-green-500 text-green-500' : score >= 40 ? 'border-yellow-500 text-yellow-500' : 'border-red-500 text-red-500'} flex items-center justify-center font-bold text-lg bg-black">
                        {score}
                    </div>
                </div>
            </div>
            <button on:click={closeHistory} class="text-gray-500 hover:text-white p-2 bg-white/5 rounded-full transition-colors">
                <X size={24} />
            </button>
        </div>
      </div>
      
      <div class="flex-1 overflow-hidden flex flex-col md:flex-row">
        
        <!-- LEFT COLUMN: Data & Charts -->
        <div class="flex-1 overflow-y-auto p-6 border-r border-gray-800 space-y-8">
            
            <!-- Key Metrics Grid -->
            <div class="grid grid-cols-3 gap-4">
                <div class="bg-black/20 p-4 rounded-xl border border-gray-800">
                    <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider">Cost Basis</div>
                    <div class="text-xl font-bold text-gray-300 font-mono">${selectedProduct.lastPrice.toFixed(2)}</div>
                </div>
                <div class="bg-black/20 p-4 rounded-xl border border-gray-800">
                    <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider">Volume (30d)</div>
                    <div class="text-xl font-bold text-ios-blue font-mono">{selectedProduct.salesVolume || 0}</div>
                </div>
                <div class="bg-black/20 p-4 rounded-xl border border-gray-800">
                    <div class="text-xs text-gray-500 mb-1 uppercase tracking-wider">Velocity</div>
                    <div class="text-xl font-bold text-white font-mono">
                        {(selectedProduct.salesVolume ? (selectedProduct.salesVolume / 30).toFixed(1) : 0)} <span class="text-xs text-gray-500">/day</span>
                    </div>
                </div>
            </div>

            <!-- Price History Chart -->
            <div class="bg-black/20 rounded-xl p-6 border border-gray-800">
                <h3 class="text-sm font-bold text-gray-400 uppercase mb-6 flex items-center space-x-2">
                    <TrendingUp size={16} />
                    <span>Price Performance</span>
                </h3>
                <div class="h-48 flex items-end space-x-1">
                    {#if productHistory.length > 0}
                        {#each productHistory as point}
                            {@const maxPrice = Math.max(...productHistory.map(h => h.price)) * 1.1}
                            {@const height = (point.price / maxPrice) * 100}
                            <div class="flex-1 flex flex-col items-center group relative">
                                <div class="w-full bg-gradient-to-t from-ios-blue/20 to-ios-blue hover:from-ios-blue/40 hover:to-ios-blue/80 transition-all rounded-t-sm min-w-[4px]" style="height: {height}%"></div>
                            </div>
                        {/each}
                    {:else}
                        <div class="w-full h-full flex items-center justify-center text-gray-600 text-sm">No history data</div>
                    {/if}
                </div>
            </div>

            <!-- Supplier & Invoice History -->
            <div class="bg-black/20 rounded-xl p-6 border border-gray-800">
                <h3 class="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center space-x-2">
                    <FileSpreadsheet size={16} />
                    <span>Supply Chain</span>
                </h3>
                <div class="space-y-3">
                    {#each [...productHistory].reverse().slice(0, 3) as h}
                        <div class="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                            <div class="flex items-center space-x-3">
                                <div class="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-white">INV</div>
                                <div>
                                    <div class="text-sm text-white font-medium">Invoice #{h.invoiceId || 'N/A'}</div>
                                    <div class="text-xs text-gray-500">{h.date}</div>
                                </div>
                            </div>
                            <div class="text-right">
                                <div class="text-sm font-mono text-white">${h.price.toFixed(2)}</div>
                                <div class="text-[10px] text-gray-400">Unit Cost</div>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        </div>

        <!-- RIGHT COLUMN: AI Analyst -->
        <div class="w-full md:w-[450px] bg-[#121212] flex flex-col">
            
            <!-- Analyst Rating Header -->
            <div class="p-6 border-b border-gray-800">
                <h3 class="text-sm font-bold text-gray-400 uppercase mb-4 flex items-center space-x-2">
                    <Sparkles size={16} class="text-purple-500" />
                    <span>AI Analyst Rating</span>
                </h3>
                
                {#if selectedProduct.aiAnalystRating}
                    <div class="flex items-center justify-between mb-4">
                        <div class="text-3xl font-black tracking-tighter {selectedProduct.aiAnalystRating === 'BUY' ? 'text-green-500' : selectedProduct.aiAnalystRating === 'SELL' ? 'text-red-500' : 'text-yellow-500'}">
                            {selectedProduct.aiAnalystRating}
                        </div>
                        <div class="text-right">
                            <div class="text-xs text-gray-500">Target Price</div>
                            <div class="text-xl font-bold text-white font-mono">${selectedProduct.aiSuggestedPrice?.toFixed(2)}</div>
                        </div>
                    </div>
                {:else}
                    <div class="text-center py-4 text-gray-500 text-sm">Run analysis to get a rating.</div>
                {/if}

                {#if !isAnalyzing && !selectedProduct.aiAnalystRating}
                     <button 
                        class="w-full bg-white text-black py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center justify-center space-x-2"
                        on:click={() => analyzeSingleProduct(selectedProduct)}
                    >
                        <Sparkles size={18} />
                        <span>Start Analysis</span>
                    </button>
                {/if}
            </div>

            <!-- Chat / Insights Area -->
            <div class="flex-1 overflow-y-auto p-6 space-y-4">
                {#if isAnalyzing}
                    <div class="flex flex-col items-center justify-center h-full text-purple-400 animate-pulse">
                        <Sparkles size={32} class="mb-2 animate-spin" />
                        <p class="text-sm">Crunching numbers...</p>
                    </div>
                {:else if selectedProduct.aiReasoning}
                    <!-- AI Message -->
                    <div class="flex items-start space-x-3">
                        <div class="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 mt-1">
                            <Sparkles size={14} />
                        </div>
                        <div class="bg-gray-800 rounded-2xl rounded-tl-none p-4 text-sm text-gray-200 leading-relaxed border border-gray-700">
                            <p class="mb-2">{selectedProduct.aiReasoning}</p>
                            
                            {#if selectedProduct.aiCreativeIdea}
                                <div class="mt-3 pt-3 border-t border-gray-700">
                                    <div class="text-xs font-bold text-purple-400 uppercase mb-1">💡 Out of the Box Idea</div>
                                    <p class="text-gray-300 italic">{selectedProduct.aiCreativeIdea}</p>
                                </div>
                            {/if}
                        </div>
                    </div>

                    <!-- User Chat History (Mock for now, or real if we implement store) -->
                    {#each chatHistory as msg}
                        <div class="flex items-start space-x-3 {msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}">
                            <div class="w-8 h-8 rounded-full {msg.role === 'user' ? 'bg-gray-700' : 'bg-purple-500/20 text-purple-400'} flex items-center justify-center mt-1">
                                {#if msg.role === 'user'}
                                    <span class="text-xs">You</span>
                                {:else}
                                    <Sparkles size={14} />
                                {/if}
                            </div>
                            <div class="{msg.role === 'user' ? 'bg-ios-blue text-white rounded-tr-none' : 'bg-gray-800 text-gray-200 rounded-tl-none'} rounded-2xl p-3 text-sm max-w-[80%]">
                                {msg.content}
                            </div>
                        </div>
                    {/each}

                {/if}
            </div>

            <!-- Chat Input -->
            <div class="p-4 border-t border-gray-800 bg-black/40">
                <div class="relative">
                    <input 
                        type="text" 
                        placeholder="Ask about pricing, suppliers, or strategy..." 
                        class="w-full bg-gray-900 border border-gray-700 rounded-xl pl-4 pr-12 py-3 text-white text-sm focus:border-purple-500 outline-none"
                        on:keydown={(e) => e.key === 'Enter' && chatWithAI(e.currentTarget.value)}
                    />
                    <button class="absolute right-2 top-1/2 transform -translate-y-1/2 text-purple-500 p-2 hover:bg-white/5 rounded-lg">
                        <Sparkles size={16} />
                    </button>
                </div>
            </div>

        </div>
      </div>
    </div>
  </div>
{/if}
