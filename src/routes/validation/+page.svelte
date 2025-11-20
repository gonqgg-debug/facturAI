<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { currentInvoice, apiKey, isProcessing } from '$lib/stores';
  import { db } from '$lib/db';
  import { recalculateInvoice, validateNcf, getNcfType, recalculateFromTotal } from '$lib/tax';
  import { parseInvoiceWithGrok } from '$lib/grok';
  import { Save, RefreshCw, AlertTriangle, Check, TrendingUp, TrendingDown } from 'lucide-svelte';
  import type { Supplier, Product } from '$lib/types';

  let invoice = $currentInvoice;
  let suppliers: Supplier[] = [];
  let selectedSupplierId: number | null = null;
  let products: Product[] = [];
  let priceAlerts: Record<number, { type: 'up' | 'down', diff: number, lastPrice: number, lastDate: string }> = {};
  let isSaving = false;

  onMount(async () => {
    if (!invoice) {
      goto('/capture');
      return;
    }
    suppliers = await db.suppliers.toArray();
    
    // Auto-match supplier by name or RNC
    const match = suppliers.find(s => 
      s.rnc === invoice?.providerRnc || 
      s.name.toLowerCase().includes(invoice?.providerName?.toLowerCase() || '')
    );
    if (match && match.id) selectedSupplierId = match.id;
    
    // Initial calc
    handleRecalc();
  });

  $: if (selectedSupplierId) {
    loadProducts(selectedSupplierId);
  }

  async function loadProducts(supplierId: number) {
    products = await db.products.where('supplierId').equals(supplierId).toArray();
    checkPrices();
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

      // 2. Save Invoice
      const finalInvoice = {
        ...invoice,
        status: 'validated',
        providerName: suppliers.find(s => s.id === supplierId)?.name || invoice.providerName
      };
      
      await db.invoices.add(finalInvoice as any);

      // 3. Train (Optional - auto add to examples)
      // We update the supplier's examples with this validated one
      const supplier = await db.suppliers.get(supplierId);
      if (supplier) {
        const newExamples = [...(supplier.examples || []), finalInvoice];
        // Keep last 5
        if (newExamples.length > 5) newExamples.shift();
        await db.suppliers.update(supplierId, { examples: newExamples as any });
      }

      // 4. Update Product Prices
      if (invoice.items) {
        for (const item of invoice.items) {
          if (item.description && item.unitPrice) {
            // Check if exists
            const existing = await db.products
              .where('[supplierId+name]')
              .equals([supplierId, item.description])
              .first();

            if (existing) {
              await db.products.update(existing.id!, {
                lastPrice: item.unitPrice,
                lastDate: invoice.issueDate || new Date().toISOString().split('T')[0]
              });
            } else {
              await db.products.add({
                supplierId,
                name: item.description,
                lastPrice: item.unitPrice,
                lastDate: invoice.issueDate || new Date().toISOString().split('T')[0],
                category: invoice.category
              });
            }
          }
        }
      }

      alert('Invoice Saved!');
      goto('/history');
    } catch (e) {
      console.error(e);
      alert('Error saving invoice');
    } finally {
      isSaving = false;
    }
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
  function handleCancel() {
    if (confirm('Are you sure you want to discard this invoice?')) {
      currentInvoice.set(null);
      goto('/capture');
    }
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
</script>

<div class="h-screen flex flex-col md:flex-row overflow-hidden bg-ios-bg">
  
  <!-- Left: Image Viewer (Desktop) / Top (Mobile) -->
  <div class="w-full md:w-[35%] h-64 md:h-full bg-black relative overflow-hidden border-b md:border-b-0 md:border-r border-ios-separator group">
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
      <div class="w-full h-full flex items-center justify-center text-gray-500">
        No Image Available
      </div>
    {/if}
  </div>

  <!-- Right: Form -->
  <div class="w-full md:w-[65%] h-full overflow-y-auto p-4 pb-24">
    {#if invoice}
      <!-- Header Actions -->
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold text-white">Validate</h1>
        <div class="flex space-x-2">
          <button 
            class="bg-red-500/10 text-red-500 px-3 py-2 rounded-lg text-sm font-bold hover:bg-red-500/20 transition-colors"
            on:click={handleCancel}
          >
            Cancel
          </button>
          <button 
            class="bg-ios-card border border-ios-separator text-white px-3 py-2 rounded-lg flex items-center space-x-2"
            on:click={handleReanalyze}
            disabled={$isProcessing}
          >
            <RefreshCw size={16} class={$isProcessing ? 'animate-spin' : ''} />
            <span class="hidden sm:inline text-sm">Re-Analyze</span>
          </button>
          <button 
            class="bg-ios-green text-white px-4 py-2 rounded-lg flex items-center space-x-2 font-bold shadow-lg shadow-green-900/20"
            on:click={handleSave}
            disabled={isSaving}
          >
            <Save size={18} />
            <span>Save</span>
          </button>
        </div>
      </div>

      <!-- Main Form -->
      <div class="space-y-6">
        
        <!-- Provider Info -->
        <div class="bg-ios-card p-4 rounded-xl border border-ios-separator">
          <h3 class="text-ios-gray text-xs font-bold mb-3 uppercase tracking-wider">Provider Info</h3>
          
          <div class="mb-3">
            <label class="block text-[10px] text-gray-500 mb-1 uppercase">Select Provider</label>
            <select 
              bind:value={selectedSupplierId} 
              class="w-full bg-black/50 border border-ios-separator rounded-lg p-2 text-white text-sm focus:border-ios-blue outline-none"
            >
              <option value={null}>-- New / Unknown --</option>
              {#each suppliers as s}
                <option value={s.id}>{s.name} ({s.rnc})</option>
              {/each}
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] text-gray-500 mb-1 uppercase">Name</label>
              <input bind:value={invoice.providerName} class="w-full bg-black/50 border border-ios-separator rounded-lg p-2 text-white text-sm focus:border-ios-blue outline-none" />
            </div>
            <div>
              <label class="block text-[10px] text-gray-500 mb-1 uppercase">RNC</label>
              <input bind:value={invoice.providerRnc} class="w-full bg-black/50 border border-ios-separator rounded-lg p-2 text-white text-sm focus:border-ios-blue outline-none" />
            </div>
          </div>
        </div>

        <!-- Invoice Details -->
        <div class="bg-ios-card p-4 rounded-xl border border-ios-separator">
          <h3 class="text-ios-gray text-xs font-bold mb-3 uppercase tracking-wider">Details</h3>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] text-gray-500 mb-1 uppercase">NCF</label>
              <input 
                bind:value={invoice.ncf} 
                class="w-full bg-black/50 border border-ios-separator rounded-lg p-2 text-white text-sm {validateNcf(invoice.ncf || '') ? 'border-green-500/50' : 'border-red-500/50'} focus:border-ios-blue outline-none" 
              />
              <p class="text-[10px] text-gray-400 mt-1 truncate">{getNcfType(invoice.ncf || '')}</p>
            </div>
            <div>
              <label class="block text-[10px] text-gray-500 mb-1 uppercase">Date</label>
              <input type="date" bind:value={invoice.issueDate} class="w-full bg-black/50 border border-ios-separator rounded-lg p-2 text-white text-sm focus:border-ios-blue outline-none" />
            </div>
          </div>
          
          <div class="mt-3">
            <label class="block text-[10px] text-gray-500 mb-1 uppercase">Category</label>
            <select 
              bind:value={invoice.category} 
              class="w-full bg-black/50 border border-ios-separator rounded-lg p-2 text-white text-sm focus:border-ios-blue outline-none"
            >
              <option value="Inventory">Inventory (Resale)</option>
              <option value="Utilities">Utilities</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Payroll">Payroll</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <!-- Totals -->
        <div class="bg-ios-card p-4 rounded-xl border border-ios-separator">
          <h3 class="text-ios-gray text-xs font-bold mb-3 uppercase tracking-wider">Totals</h3>
          <div class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-400">Subtotal</span>
              <span class="text-white font-mono">{invoice.subtotal?.toFixed(2)}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-gray-400">Discount</span>
              <input 
                type="number" 
                bind:value={invoice.discount} 
                on:input={handleRecalc}
                class="w-24 bg-black/50 border border-ios-separator rounded p-1 text-right text-white font-mono text-sm focus:border-ios-blue outline-none" 
              />
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">ITBIS (18%)</span>
              <span class="text-white font-mono">{invoice.itbisTotal?.toFixed(2)}</span>
            </div>
            <div class="border-t border-ios-separator my-2 pt-2 flex justify-between items-center">
              <span class="text-white font-bold">Total</span>
              <span class="text-ios-green font-bold text-xl font-mono">DOP {invoice.total?.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <!-- Items Grid -->
        <div class="bg-ios-card rounded-xl border border-ios-separator overflow-hidden">
          <div class="p-4 border-b border-ios-separator flex justify-between items-center">
            <h3 class="text-ios-gray text-xs font-bold uppercase tracking-wider">Line Items</h3>
            <button on:click={addLine} class="text-ios-blue text-xs font-bold uppercase hover:text-white transition-colors">+ Add Item</button>
          </div>
          
          <div class="overflow-x-auto">
            <table class="w-full text-left text-sm">
              <thead class="bg-white/5 text-gray-400 text-xs uppercase">
                <tr>
                  <th class="p-3 font-medium">Desc</th>
                  <th class="p-3 font-medium w-14 text-center">Qty</th>
                  <th class="p-3 font-medium w-20 text-right">Price</th>
                  <th class="p-3 font-medium w-16 text-center">Tax Inc</th>
                  <th class="p-3 font-medium w-20 text-center">Tax</th>
                  <th class="p-3 font-medium w-20 text-right">Total</th>
                  <th class="p-3 w-8"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-ios-separator">
                {#each invoice.items || [] as item, i}
                  <tr class="group hover:bg-white/5 transition-colors">
                    <td class="p-2">
                      <input 
                        bind:value={item.description} 
                        class="w-full bg-transparent text-white outline-none placeholder-gray-600" 
                        placeholder="Item..." 
                        data-row={i} data-col="0"
                        on:keydown={(e) => handleKeydown(e, i, 0)}
                      />
                    </td>
                    <td class="p-2">
                      <input 
                        type="number" 
                        bind:value={item.quantity} 
                        on:input={handleRecalc} 
                        class="w-full bg-transparent text-white outline-none text-center" 
                        data-row={i} data-col="1"
                        on:keydown={(e) => handleKeydown(e, i, 1)}
                      />
                    </td>
                    <td class="p-2 relative">
                      <div class="relative">
                        <input 
                          type="number" 
                          bind:value={item.unitPrice} 
                          on:input={handleRecalc} 
                          class="w-full bg-transparent text-white outline-none text-right border-b border-transparent focus:border-ios-blue focus:bg-white/5 transition-colors {priceAlerts[i] ? (priceAlerts[i].type === 'up' ? 'text-red-400' : 'text-green-400') : ''}" 
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
                            <div class="absolute bottom-full mb-2 right-0 w-48 bg-black border border-ios-separator p-2 rounded-lg text-xs z-50 hidden group-hover/tooltip:block shadow-xl">
                              <div class="font-bold text-white mb-1">Price Change</div>
                              <div class="text-gray-400">Was: <span class="text-white">{priceAlerts[i].lastPrice.toFixed(2)}</span></div>
                              <div class="text-gray-400">Date: <span class="text-white">{priceAlerts[i].lastDate}</span></div>
                              <div class="{priceAlerts[i].type === 'up' ? 'text-red-400' : 'text-green-400'} font-bold mt-1">
                                {priceAlerts[i].type === 'up' ? '+' : ''}{priceAlerts[i].diff.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        {/if}
                      </div>
                    </td>
                    <td class="p-2 text-center">
                      <input 
                        type="checkbox" 
                        bind:checked={item.priceIncludesTax} 
                        on:change={() => handleTotalChange(i)}
                        class="w-4 h-4 rounded border-gray-600 bg-black/50 text-ios-blue focus:ring-ios-blue"
                      />
                    </td>
                    <td class="p-2">
                      <select 
                        bind:value={item.taxRate} 
                        on:change={handleRecalc}
                        class="w-full bg-transparent text-white outline-none text-center text-xs appearance-none"
                      >
                        <option value={0.18}>18%</option>
                        <option value={0.16}>16%</option>
                        <option value={0}>0%</option>
                      </select>
                    </td>
                    <td class="p-2">
                      <input 
                        type="number" 
                        step="0.01"
                        bind:value={item.amount} 
                        on:change={() => handleTotalChange(i)}
                        class="w-full bg-white/10 rounded px-2 py-1 text-white outline-none text-right font-mono border border-transparent focus:border-ios-blue transition-colors" 
                        data-row={i} data-col="5"
                        on:keydown={(e) => handleKeydown(e, i, 5)}
                      />
                    </td>
                    <td class="p-2 text-center flex items-center justify-center space-x-1">
                      <button 
                        on:click={() => handleLearnRule(item)} 
                        class="text-yellow-500 hover:text-yellow-300 transition-colors p-1"
                        title="Teach AI a rule for this item"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2v1"/><path d="M12 7v5"/><path d="M12 13h.01"/><path d="M12 17h.01"/><path d="M12 21h.01"/><path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z"/></svg>
                        <!-- Lightbulb Icon -->
                        <span class="sr-only">Learn</span>
                      </button>
                      <button on:click={() => removeLine(i)} class="text-gray-600 hover:text-red-500 transition-colors p-1">×
                      </button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    {:else}
      <div class="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
        <p>No invoice data found.</p>
        <a href="/capture" class="text-ios-blue font-bold hover:underline">Go to Capture</a>
      </div>
    {/if}
  </div>
</div>
