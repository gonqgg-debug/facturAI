<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '$lib/db';
  import { Search, Plus, Upload, FileSpreadsheet, Edit2, Trash2, Save, X } from 'lucide-svelte';
  import type { Product, Supplier } from '$lib/types';
  import * as XLSX from 'xlsx';

  let products: (Product & { supplierName?: string })[] = [];
  let suppliers: Supplier[] = [];
  let searchQuery = '';
  let isImporting = false;
  let fileInput: HTMLInputElement;

  // Editing State
  let editingProduct: (Product & { supplierName?: string }) | null = null;
  let isCreating = false;

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    suppliers = await db.suppliers.toArray();
    const rawProducts = await db.products.toArray();
    
    products = rawProducts.map(p => ({
      ...p,
      supplierName: suppliers.find(s => s.id === p.supplierId)?.name || 'Unknown'
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  $: filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.productId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.supplierName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    let skippedCount = 0;

    for (const row of data) {
      const name = row['Name'] || row['Product Name'] || row['Producto'];
      const productId = row['ProductID'] || row['SKU'] || row['Codigo'] || row['ID'];
      
      if (!name && !productId) {
        skippedCount++;
        continue;
      }

      let existing = productId 
        ? products.find(p => p.productId === productId)
        : products.find(p => p.name.toLowerCase() === name?.toLowerCase());
      
      const lastPrice = row['Cost'] || row['Costo'] || row['Last Cost'];
      const averageCost = row['AverageCost'] || row['Average Cost'] || row['Costo Promedio'];
      
      const productData: any = {
        productId: productId || existing?.productId,
        sellingPrice: row['Price'] || row['Precio'] || row['Selling Price'],
        targetMargin: row['TargetMargin'] || row['Margen'] || row['Target Margin'],
        category: row['Category'] || row['Categoria'],
        salesVolume: row['SalesVolume'] || row['Sales Volume'] || row['Cantidad Vendida'],
        lastSaleDate: new Date().toISOString().split('T')[0]
      };

      if (lastPrice !== undefined) productData.lastPrice = lastPrice;
      if (averageCost !== undefined) productData.averageCost = averageCost;

      Object.keys(productData).forEach(key => productData[key] === undefined && delete productData[key]);

      if (existing && existing.id) {
        await db.products.update(existing.id, productData);
        updatedCount++;
      } else {
        const supplierName = row['Supplier'] || row['Suplidor'] || 'Unknown';
        let supplier = suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
        
        if (!supplier && supplierName !== 'Unknown') {
          const id = await db.suppliers.add({ name: supplierName, rnc: '000000000', examples: [] });
          supplier = { id, name: supplierName, rnc: '000000000', examples: [] };
          suppliers.push(supplier);
        }

        await db.products.add({
          name: name || `Product ${productId}`,
          supplierId: supplier?.id,
          lastPrice: lastPrice || 0,
          lastDate: new Date().toISOString().split('T')[0],
          ...productData
        });
        createdCount++;
      }
    }

    await loadData();
    isImporting = false;
    alert(`Import Complete!\nCreated: ${createdCount}\nUpdated: ${updatedCount}\nSkipped: ${skippedCount}`);
  }

  function startEdit(product: Product & { supplierName?: string }) {
    editingProduct = { ...product };
    isCreating = false;
  }

  function startCreate() {
    editingProduct = {
        name: '',
        lastPrice: 0,
        lastDate: new Date().toISOString().split('T')[0],
        supplierName: 'Unknown'
    };
    isCreating = true;
  }

  async function saveProduct() {
    if (!editingProduct) return;

    // Resolve Supplier
    let supplierId = editingProduct.supplierId;
    if (editingProduct.supplierName) {
        const s = suppliers.find(s => s.name === editingProduct?.supplierName);
        if (s) {
            supplierId = s.id;
        } else {
            // Create new supplier if needed? For now, let's just use Unknown if not found or require selection
            // Simple approach: if name matches existing, use ID. Else, keep as is (might need better UX here)
        }
    }

    const data = {
        name: editingProduct.name,
        productId: editingProduct.productId,
        supplierId: supplierId,
        lastPrice: editingProduct.lastPrice,
        sellingPrice: editingProduct.sellingPrice,
        category: editingProduct.category,
        targetMargin: editingProduct.targetMargin
    };

    if (isCreating) {
        await db.products.add({
            ...data,
            lastDate: new Date().toISOString().split('T')[0]
        });
    } else if (editingProduct.id) {
        await db.products.update(editingProduct.id, data);
    }

    editingProduct = null;
    await loadData();
  }

  async function deleteProduct(id?: number) {
    if (!id) return;
    if (confirm('Are you sure you want to delete this product?')) {
        await db.products.delete(id);
        await loadData();
    }
  }
</script>

<div class="p-6 max-w-7xl mx-auto">
  <!-- Header -->
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
    <div>
      <h1 class="text-3xl font-bold text-white tracking-tight">Product Catalog</h1>
      <p class="text-gray-400 mt-1">Manage your inventory, prices, and suppliers.</p>
    </div>
    <div class="flex space-x-3">
      <input 
        type="file" 
        accept=".xlsx,.xls" 
        class="hidden" 
        bind:this={fileInput}
        on:change={handleFileUpload}
      />
      <button 
        class="bg-ios-card border border-ios-separator text-white px-4 py-2 rounded-xl flex items-center space-x-2 hover:bg-white/5 transition-colors"
        on:click={() => fileInput.click()}
        disabled={isImporting}
      >
        {#if isImporting}
          <div class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
        {:else}
          <Upload size={18} />
        {/if}
        <span>Import</span>
      </button>
      <button 
        class="bg-ios-blue text-white px-4 py-2 rounded-xl flex items-center space-x-2 font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-600 transition-colors"
        on:click={startCreate}
      >
        <Plus size={18} />
        <span>Add Product</span>
      </button>
    </div>
  </div>

  <!-- Search & Filter -->
  <div class="mb-6">
    <div class="relative">
      <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
      <input 
        bind:value={searchQuery}
        type="text" 
        placeholder="Search by name, SKU, or supplier..." 
        class="w-full bg-ios-card border border-ios-separator rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:border-ios-blue focus:ring-1 focus:ring-ios-blue outline-none transition-all"
      />
    </div>
  </div>

  <!-- Product Table -->
  <div class="bg-ios-card border border-ios-separator rounded-2xl overflow-hidden shadow-sm">
    <div class="overflow-x-auto">
      <table class="w-full text-left">
        <thead class="bg-black/20 text-gray-400 text-xs uppercase tracking-wider">
          <tr>
            <th class="p-4 font-medium">Product</th>
            <th class="p-4 font-medium">SKU / ID</th>
            <th class="p-4 font-medium">Supplier</th>
            <th class="p-4 font-medium text-right">Cost</th>
            <th class="p-4 font-medium text-right">Price</th>
            <th class="p-4 font-medium text-center">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-ios-separator">
          {#each filteredProducts as product}
            <tr class="group hover:bg-white/5 transition-colors">
              <td class="p-4">
                <div class="font-medium text-white">{product.name}</div>
                <div class="text-xs text-gray-500">{product.category || 'Uncategorized'}</div>
              </td>
              <td class="p-4 text-sm text-gray-400 font-mono">
                {product.productId || '-'}
              </td>
              <td class="p-4 text-sm text-gray-400">
                {product.supplierName}
              </td>
              <td class="p-4 text-right font-mono text-gray-300">
                ${product.lastPrice.toFixed(2)}
              </td>
              <td class="p-4 text-right font-mono text-white font-bold">
                {product.sellingPrice ? `$${product.sellingPrice.toFixed(2)}` : '-'}
              </td>
              <td class="p-4 flex justify-center space-x-2">
                <button 
                    class="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                    on:click={() => startEdit(product)}
                    title="Edit"
                >
                    <Edit2 size={16} />
                </button>
                <button 
                    class="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    on:click={() => deleteProduct(product.id)}
                    title="Delete"
                >
                    <Trash2 size={16} />
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
          <p class="text-sm">Try importing a catalog or adding a product.</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Edit/Create Modal -->
{#if editingProduct}
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div class="bg-ios-card w-full max-w-lg rounded-2xl border border-ios-separator shadow-2xl overflow-hidden flex flex-col">
        <div class="p-4 border-b border-ios-separator flex justify-between items-center bg-black/20">
            <h3 class="text-white font-bold text-lg">{isCreating ? 'Add Product' : 'Edit Product'}</h3>
            <button on:click={() => editingProduct = null} class="text-gray-400 hover:text-white">
                <X size={20} />
            </button>
        </div>
        
        <div class="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
            <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Product Name</label>
                <input bind:value={editingProduct.name} class="w-full bg-black/50 border border-ios-separator rounded-lg p-3 text-white focus:border-ios-blue outline-none" placeholder="e.g. President Beer" />
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">SKU / ID</label>
                    <input bind:value={editingProduct.productId} class="w-full bg-black/50 border border-ios-separator rounded-lg p-3 text-white focus:border-ios-blue outline-none" placeholder="Optional" />
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Category</label>
                    <input bind:value={editingProduct.category} class="w-full bg-black/50 border border-ios-separator rounded-lg p-3 text-white focus:border-ios-blue outline-none" placeholder="e.g. Beverages" />
                </div>
            </div>

            <div>
                <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Supplier</label>
                <select 
                    bind:value={editingProduct.supplierId} 
                    class="w-full bg-black/50 border border-ios-separator rounded-lg p-3 text-white focus:border-ios-blue outline-none"
                >
                    <option value={undefined}>Select Supplier...</option>
                    {#each suppliers as s}
                        <option value={s.id}>{s.name}</option>
                    {/each}
                </select>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Cost</label>
                    <input type="number" step="0.01" bind:value={editingProduct.lastPrice} class="w-full bg-black/50 border border-ios-separator rounded-lg p-3 text-white focus:border-ios-blue outline-none" />
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-500 uppercase mb-1">Selling Price</label>
                    <input type="number" step="0.01" bind:value={editingProduct.sellingPrice} class="w-full bg-black/50 border border-ios-separator rounded-lg p-3 text-white focus:border-ios-blue outline-none" />
                </div>
            </div>
        </div>

        <div class="p-4 border-t border-ios-separator bg-black/20 flex justify-end space-x-3">
            <button on:click={() => editingProduct = null} class="px-4 py-2 text-gray-400 hover:text-white font-medium">Cancel</button>
            <button on:click={saveProduct} class="bg-ios-blue text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-600 transition-colors shadow-lg shadow-blue-900/20">
                {isCreating ? 'Create Product' : 'Save Changes'}
            </button>
        </div>
    </div>
  </div>
{/if}
