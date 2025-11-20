<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '$lib/db';
  import { Search, Tag, TrendingUp, TrendingDown, X, Filter } from 'lucide-svelte';
  import type { Product, Supplier, Invoice } from '$lib/types';

  let products: (Product & { supplierName?: string })[] = [];
  let suppliers: Supplier[] = [];
  let searchQuery = '';
  let selectedCategory = 'All';
  
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
    return matchesSearch && matchesCategory;
  });

  async function openHistory(product: Product & { supplierName?: string }) {
    selectedProduct = product;
    showHistory = true;
    productHistory = [];

    // Find history from invoices
    // Note: This is a heavy operation for a large DB, but fine for local PWA scale
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

<div class="p-4 max-w-5xl mx-auto pb-24">
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
    <h1 class="text-2xl font-bold text-white flex items-center space-x-2">
      <Tag class="text-ios-blue" />
      <span>Pricing</span>
    </h1>
    
    <div class="flex flex-wrap gap-2 w-full md:w-auto">
      <div class="relative flex-1 md:w-64">
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
  </div>

  <!-- Product List -->
  <div class="bg-ios-card rounded-xl border border-ios-separator overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead class="bg-white/5 text-gray-400 text-xs uppercase">
          <tr>
            <th class="p-4 font-medium">Product Name</th>
            <th class="p-4 font-medium">Supplier</th>
            <th class="p-4 font-medium">Category</th>
            <th class="p-4 font-medium text-right">Last Price</th>
            <th class="p-4 font-medium text-right">Last Date</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-ios-separator">
          {#each filteredProducts as product}
            <tr 
              class="group hover:bg-white/5 transition-colors cursor-pointer"
              on:click={() => openHistory(product)}
            >
              <td class="p-4 text-white font-medium">{product.name}</td>
              <td class="p-4 text-gray-400">{product.supplierName}</td>
              <td class="p-4">
                <span class="text-[10px] px-2 py-1 rounded-full bg-white/10 text-gray-400 uppercase border border-white/10">
                  {product.category || 'Uncategorized'}
                </span>
              </td>
              <td class="p-4 text-right font-mono text-ios-green font-bold">
                {product.lastPrice.toFixed(2)}
              </td>
              <td class="p-4 text-right text-gray-500 text-xs">
                {product.lastDate}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      
      {#if filteredProducts.length === 0}
        <div class="p-8 text-center text-gray-500">
          No products found matching your search.
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- History Modal -->
{#if showHistory && selectedProduct}
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-ios-card border border-ios-separator rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
      <div class="p-4 border-b border-ios-separator flex justify-between items-center bg-white/5">
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
