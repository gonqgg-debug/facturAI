<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { db } from '$lib/db';
  import { Search, Plus, Upload, Edit2, Trash2, Package, AlertTriangle, Barcode, Download, ArrowUpDown, ArrowUp, ArrowDown, Columns3 } from 'lucide-svelte';
  import type { Product, Supplier } from '$lib/types';
  import * as XLSX from 'xlsx';
  import { checkLowStock, type StockAlert } from '$lib/alerts';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import * as Select from '$lib/components/ui/select';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import * as Table from '$lib/components/ui/table';
  import * as Tabs from '$lib/components/ui/tabs';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Badge } from '$lib/components/ui/badge';
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';

  type ProductWithSupplier = Product & { supplierName?: string };

  let products: ProductWithSupplier[] = [];
  let suppliers: Supplier[] = [];
  let isImporting = false;
  let fileInput: HTMLInputElement;
  
  // Stock Filter
  type StockFilter = 'all' | 'low_stock' | 'out_of_stock' | 'in_stock';
  let stockFilter: StockFilter = 'all';
  
  function handleStockFilterChange(value: string | undefined) {
    if (value) stockFilter = value as StockFilter;
  }
  
  // Stock Alerts
  let stockAlerts: StockAlert[] = [];

  // Editing State
  let editingProduct: ProductWithSupplier | null = null;
  let isCreating = false;
  let dialogOpen = false;
  
  // Delete confirmation state
  let deleteDialogOpen = false;
  let productToDelete: ProductWithSupplier | null = null;
  let bulkDeleteDialogOpen = false;
  
  // Table state
  let searchQuery = '';
  let sortColumn: string | null = null;
  let sortDirection: 'asc' | 'desc' | null = null;
  let selectedIds: Set<number | string> = new Set();
  let pageIndex = 0;
  let pageSize = 20;
  
  // Column visibility
  let columnVisibility: Record<string, boolean> = {
    name: true,
    sku: true,
    supplier: true,
    stock: true,
    cost: true,
    price: true,
    actions: true
  };

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    if (!browser) return;
    suppliers = await db.suppliers.toArray();
    const rawProducts = await db.products.toArray();
    
    // Check for stock alerts
    stockAlerts = checkLowStock(rawProducts);
    
    products = rawProducts.map(p => ({
      ...p,
      supplierName: suppliers.find(s => s.id === p.supplierId)?.name || 'Unknown'
    })).sort((a, b) => a.name.localeCompare(b.name));
  }

  // Filtering
  $: filteredByStock = products.filter(p => {
    const stock = p.currentStock ?? 0;
    const reorderPoint = p.reorderPoint ?? 5;
    
    switch (stockFilter) {
      case 'out_of_stock':
        return stock === 0;
      case 'low_stock':
        return stock > 0 && stock <= reorderPoint;
      case 'in_stock':
        return stock > reorderPoint;
      default:
        return true;
    }
  });
  
  $: searchFiltered = searchQuery 
    ? filteredByStock.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.productId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.supplierName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredByStock;
  
  // Sorting
  $: sortedProducts = sortColumn && sortDirection
    ? [...searchFiltered].sort((a, b) => {
        let aVal: any, bVal: any;
        switch (sortColumn) {
          case 'name': aVal = a.name; bVal = b.name; break;
          case 'supplier': aVal = a.supplierName; bVal = b.supplierName; break;
          case 'stock': aVal = a.currentStock ?? 0; bVal = b.currentStock ?? 0; break;
          case 'cost': aVal = a.lastPrice; bVal = b.lastPrice; break;
          case 'price': aVal = a.sellingPrice ?? 0; bVal = b.sellingPrice ?? 0; break;
          default: return 0;
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return sortDirection === 'asc' 
          ? String(aVal || '').localeCompare(String(bVal || ''))
          : String(bVal || '').localeCompare(String(aVal || ''));
      })
    : searchFiltered;
  
  // Pagination
  $: totalRows = sortedProducts.length;
  $: pageCount = Math.ceil(totalRows / pageSize);
  $: paginatedProducts = sortedProducts.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  
  // Selection
  $: selectedProducts = products.filter(p => selectedIds.has(p.id ?? p.name));
  $: isAllSelected = paginatedProducts.length > 0 && paginatedProducts.every(p => selectedIds.has(p.id ?? p.name));
  $: isSomeSelected = paginatedProducts.some(p => selectedIds.has(p.id ?? p.name)) && !isAllSelected;
  
  // Stats
  $: totalProducts = products.length;
  $: outOfStock = products.filter(p => (p.currentStock ?? 0) === 0).length;
  $: lowStock = products.filter(p => {
    const stock = p.currentStock ?? 0;
    return stock > 0 && stock <= (p.reorderPoint ?? 5);
  }).length;

  function toggleSort(column: string) {
    if (sortColumn === column) {
      if (sortDirection === 'asc') sortDirection = 'desc';
      else if (sortDirection === 'desc') { sortDirection = null; sortColumn = null; }
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
  }
  
  function toggleSelectAll() {
    if (isAllSelected) {
      paginatedProducts.forEach(p => selectedIds.delete(p.id ?? p.name));
    } else {
      paginatedProducts.forEach(p => selectedIds.add(p.id ?? p.name));
    }
    selectedIds = new Set(selectedIds);
  }
  
  function toggleSelect(product: ProductWithSupplier) {
    const id = product.id ?? product.name;
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    selectedIds = new Set(selectedIds);
  }
  
  function clearSelection() {
    selectedIds = new Set();
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
    let skippedCount = 0;

    for (const row of data) {
      const name = row['Name'] || row['Product Name'] || row['Producto'];
      const productId = row['ProductID'] || row['SKU'] || row['Codigo'] || row['ID'];
      const barcode = row['Barcode'] || row['EAN'] || row['UPC'] || row['CodigoBarras'];
      
      if (!name && !productId && !barcode) {
        skippedCount++;
        continue;
      }

      let existing = productId 
        ? products.find(p => p.productId === productId)
        : barcode 
          ? products.find(p => p.barcode === barcode)
          : products.find(p => p.name.toLowerCase() === name?.toLowerCase());
      
      const lastPrice = row['Cost'] || row['Costo'] || row['Last Cost'];
      const averageCost = row['AverageCost'] || row['Average Cost'] || row['Costo Promedio'];
      const currentStock = row['Stock'] || row['Quantity'] || row['Cantidad'] || row['CurrentStock'];
      const reorderPoint = row['ReorderPoint'] || row['MinStock'] || row['StockMinimo'];
      
      const productData: any = {
        productId: productId || existing?.productId,
        barcode: barcode || existing?.barcode,
        sellingPrice: row['Price'] || row['Precio'] || row['Selling Price'],
        targetMargin: row['TargetMargin'] || row['Margen'] || row['Target Margin'],
        category: row['Category'] || row['Categoria'],
        salesVolume: row['SalesVolume'] || row['Sales Volume'] || row['Cantidad Vendida'],
        lastSaleDate: new Date().toISOString().split('T')[0]
      };

      if (lastPrice !== undefined) productData.lastPrice = lastPrice;
      if (averageCost !== undefined) productData.averageCost = averageCost;
      if (currentStock !== undefined) {
        productData.currentStock = Number(currentStock);
        productData.lastStockUpdate = new Date().toISOString().split('T')[0];
      }
      if (reorderPoint !== undefined) productData.reorderPoint = Number(reorderPoint);

      Object.keys(productData).forEach(key => productData[key] === undefined && delete productData[key]);

      if (existing && existing.id) {
        await db.products.update(existing.id, productData);
        updatedCount++;
      } else {
        const supplierName = row['Supplier'] || row['Suplidor'] || 'Unknown';
        let supplier = suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
        
        if (!supplier && supplierName !== 'Unknown') {
          const id = await db.suppliers.add({ name: supplierName, rnc: '000000000', examples: [] });
          supplier = { id: id as number, name: supplierName, rnc: '000000000', examples: [] };
          suppliers.push(supplier);
        }

        await db.products.add({
          name: name || `Product ${productId || barcode}`,
          supplierId: supplier?.id,
          lastPrice: lastPrice || 0,
          lastDate: new Date().toISOString().split('T')[0],
          currentStock: currentStock !== undefined ? Number(currentStock) : 0,
          ...productData
        });
        createdCount++;
      }
    }

    await loadData();
    isImporting = false;
    alert(`Import Complete!\nCreated: ${createdCount}\nUpdated: ${updatedCount}\nSkipped: ${skippedCount}`);
  }

  function startEdit(product: ProductWithSupplier) {
    editingProduct = { ...product };
    isCreating = false;
    dialogOpen = true;
  }

  function startCreate() {
    editingProduct = {
        name: '',
        lastPrice: 0,
        lastDate: new Date().toISOString().split('T')[0],
        supplierName: 'Unknown',
        currentStock: 0,
        reorderPoint: 5
    };
    isCreating = true;
    dialogOpen = true;
  }
  
  function closeDialog() {
    dialogOpen = false;
    editingProduct = null;
  }

  async function saveProduct() {
    if (!editingProduct) return;

    let supplierId = editingProduct.supplierId;
    if (editingProduct.supplierName) {
        const s = suppliers.find(s => s.name === editingProduct?.supplierName);
        if (s) supplierId = s.id;
    }

    const data = {
        name: editingProduct.name,
        productId: editingProduct.productId,
        barcode: editingProduct.barcode,
        supplierId: supplierId,
        lastPrice: editingProduct.lastPrice,
        sellingPrice: editingProduct.sellingPrice,
        category: editingProduct.category,
        targetMargin: editingProduct.targetMargin,
        currentStock: editingProduct.currentStock ?? 0,
        reorderPoint: editingProduct.reorderPoint ?? 5,
        aliases: editingProduct.aliases
    };

    if (isCreating) {
        await db.products.add({
            ...data,
            lastDate: new Date().toISOString().split('T')[0],
            lastStockUpdate: new Date().toISOString().split('T')[0]
        });
    } else if (editingProduct.id) {
        await db.products.update(editingProduct.id, {
            ...data,
            lastStockUpdate: new Date().toISOString().split('T')[0]
        });
    }

    closeDialog();
    await loadData();
  }

  function confirmDelete(product: ProductWithSupplier) {
    productToDelete = product;
    deleteDialogOpen = true;
  }

  async function executeDelete() {
    if (!productToDelete?.id) return;
    await db.products.delete(productToDelete.id);
    deleteDialogOpen = false;
    productToDelete = null;
    await loadData();
  }
  
  function confirmBulkDelete() {
    if (selectedProducts.length === 0) return;
    bulkDeleteDialogOpen = true;
  }

  async function executeBulkDelete() {
    for (const product of selectedProducts) {
      if (product.id) await db.products.delete(product.id);
    }
    
    bulkDeleteDialogOpen = false;
    clearSelection();
    await loadData();
  }
  
  function exportProducts() {
    const toExport = selectedProducts.length > 0 ? selectedProducts : sortedProducts;
    
    const data = toExport.map(p => ({
      Name: p.name,
      SKU: p.productId || '',
      Barcode: p.barcode || '',
      Supplier: p.supplierName || '',
      Category: p.category || '',
      CurrentStock: p.currentStock ?? 0,
      ReorderPoint: p.reorderPoint ?? 5,
      Cost: p.lastPrice,
      SellingPrice: p.sellingPrice || '',
      TargetMargin: p.targetMargin || ''
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Products");
    XLSX.writeFile(wb, `products_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  }
  
  function getStockStatusVariant(product: Product): "destructive" | "outline" | "default" {
    const stock = product.currentStock ?? 0;
    const reorderPoint = product.reorderPoint ?? 5;
    
    if (stock === 0) return 'destructive';
    if (stock <= reorderPoint) return 'outline';
    return 'default';
  }
  
  function getStockStatusText(product: Product): string {
    const stock = product.currentStock ?? 0;
    const reorderPoint = product.reorderPoint ?? 5;
    
    if (stock === 0) return 'Out';
    if (stock <= reorderPoint) return 'Low';
    return 'OK';
  }
</script>

<div class="p-6 max-w-7xl mx-auto">
  <!-- Header -->
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">Product Catalog</h1>
      <p class="text-muted-foreground mt-1">Manage your inventory, prices, and suppliers.</p>
    </div>
    <div class="flex space-x-3">
      <input type="file" accept=".xlsx,.xls" class="hidden" bind:this={fileInput} on:change={handleFileUpload} />
      <Button 
        variant="outline" 
        size="default"
        on:click={() => fileInput.click()}
        disabled={isImporting}
      >
        {#if isImporting}
          <div class="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
        {:else}
          <Upload size={18} />
        {/if}
        <span>Import</span>
      </Button>
      <Button 
        variant="outline" 
        size="default"
        on:click={exportProducts}
      >
        <Download size={18} />
        <span>{selectedProducts.length > 0 ? `Export (${selectedProducts.length})` : 'Export'}</span>
      </Button>
      <Button 
        variant="default" 
        size="default"
        on:click={startCreate}
        class="font-bold shadow-lg shadow-primary/20"
      >
        <Plus size={18} />
        <span>Add Product</span>
      </Button>
    </div>
  </div>
  
  <!-- Stock Summary Cards -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Total Products</div>
        <div class="text-2xl font-bold">{totalProducts}</div>
      </Card.Content>
    </Card.Root>
    <Card.Root class="{outOfStock > 0 ? 'border-destructive/30' : ''}">
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1 flex items-center space-x-1">
          <AlertTriangle size={12} class="text-destructive" />
          <span>Out of Stock</span>
        </div>
        <div class="text-2xl font-bold {outOfStock > 0 ? 'text-destructive' : 'text-green-500'}">{outOfStock}</div>
      </Card.Content>
    </Card.Root>
    <Card.Root class="{lowStock > 0 ? 'border-yellow-500/30' : ''}">
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1 flex items-center space-x-1">
          <Package size={12} class="text-yellow-500" />
          <span>Low Stock</span>
        </div>
        <div class="text-2xl font-bold {lowStock > 0 ? 'text-yellow-500' : 'text-green-500'}">{lowStock}</div>
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1">In Stock</div>
        <div class="text-2xl font-bold text-green-500">{totalProducts - outOfStock - lowStock}</div>
      </Card.Content>
    </Card.Root>
  </div>

  <!-- Stock Filter Tabs -->
  <Tabs.Root value={stockFilter} onValueChange={handleStockFilterChange} class="mb-4">
    <Tabs.List class="bg-card border border-border h-11 p-1 rounded-xl gap-1">
      <Tabs.Trigger 
        value="all" 
        class="rounded-lg px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
      >
        All
      </Tabs.Trigger>
      <Tabs.Trigger 
        value="out_of_stock" 
        class="rounded-lg px-4 gap-1.5 data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground data-[state=active]:shadow-md"
      >
        <AlertTriangle size={14} />
        <span>Out</span>
      </Tabs.Trigger>
      <Tabs.Trigger 
        value="low_stock" 
        class="rounded-lg px-4 gap-1.5 data-[state=active]:bg-yellow-500 data-[state=active]:text-black data-[state=active]:shadow-md"
      >
        <Package size={14} />
        <span>Low</span>
      </Tabs.Trigger>
      <Tabs.Trigger 
        value="in_stock" 
        class="rounded-lg px-4 data-[state=active]:bg-green-500 data-[state=active]:text-white data-[state=active]:shadow-md"
      >
        OK
      </Tabs.Trigger>
    </Tabs.List>
  </Tabs.Root>

  <!-- Search & Column Toggle -->
  <div class="flex items-center gap-4 mb-4">
    <div class="relative flex-1 max-w-sm">
      <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-10" size={16} />
      <Input bind:value={searchQuery} placeholder="Search by name, SKU, barcode, or supplier..." class="h-10 pl-9 bg-card" />
    </div>
    
    {#if selectedIds.size > 0}
      <span class="text-sm text-muted-foreground"><span class="font-medium text-primary">{selectedIds.size}</span> selected</span>
    {/if}
    
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild let:builder>
        <Button builders={[builder]} variant="outline" size="default" class="inline-flex items-center gap-2">
          <Columns3 size={16} /><span class="hidden sm:inline">Columns</span>
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="w-48">
        <DropdownMenu.Label>Toggle columns</DropdownMenu.Label>
        <DropdownMenu.Separator />
        <DropdownMenu.CheckboxItem checked={columnVisibility.name} onCheckedChange={(v) => columnVisibility.name = !!v}>Product</DropdownMenu.CheckboxItem>
        <DropdownMenu.CheckboxItem checked={columnVisibility.sku} onCheckedChange={(v) => columnVisibility.sku = !!v}>SKU / Barcode</DropdownMenu.CheckboxItem>
        <DropdownMenu.CheckboxItem checked={columnVisibility.supplier} onCheckedChange={(v) => columnVisibility.supplier = !!v}>Supplier</DropdownMenu.CheckboxItem>
        <DropdownMenu.CheckboxItem checked={columnVisibility.stock} onCheckedChange={(v) => columnVisibility.stock = !!v}>Stock</DropdownMenu.CheckboxItem>
        <DropdownMenu.CheckboxItem checked={columnVisibility.cost} onCheckedChange={(v) => columnVisibility.cost = !!v}>Cost</DropdownMenu.CheckboxItem>
        <DropdownMenu.CheckboxItem checked={columnVisibility.price} onCheckedChange={(v) => columnVisibility.price = !!v}>Price</DropdownMenu.CheckboxItem>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>

  <!-- Bulk Actions Bar -->
  {#if selectedIds.size > 0}
    <div class="flex items-center gap-4 px-4 py-3 mb-4 bg-primary/10 border border-primary/20 rounded-xl">
      <span class="text-sm font-medium text-primary">{selectedIds.size} item{selectedIds.size > 1 ? 's' : ''} selected</span>
      <div class="flex items-center gap-2 ml-auto">
        <Button variant="destructive" size="sm" on:click={confirmBulkDelete}>Delete ({selectedIds.size})</Button>
        <Button variant="outline" size="sm" on:click={exportProducts} class="text-primary bg-primary/10 hover:bg-primary/20">Export ({selectedIds.size})</Button>
        <Button variant="ghost" size="sm" on:click={clearSelection}>Clear selection</Button>
      </div>
    </div>
  {/if}

  <!-- Table -->
  <Card.Root class="overflow-hidden shadow-sm">
    <Card.Content class="p-0">
      <Table.Root>
      <Table.Header class="bg-muted/50">
        <Table.Row class="hover:bg-muted/50">
          <Table.Head class="w-12">
            <Checkbox checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false} onCheckedChange={toggleSelectAll} aria-label="Select all" />
          </Table.Head>
          {#if columnVisibility.name}
            <Table.Head>
              <button class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors" on:click={() => toggleSort('name')}>
                Product
                {#if sortColumn === 'name'}
                  {#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}
                {:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
              </button>
            </Table.Head>
          {/if}
          {#if columnVisibility.sku}<Table.Head class="text-xs uppercase tracking-wider">SKU / Barcode</Table.Head>{/if}
          {#if columnVisibility.supplier}
            <Table.Head>
              <button class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors" on:click={() => toggleSort('supplier')}>
                Supplier
                {#if sortColumn === 'supplier'}
                  {#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}
                {:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
              </button>
            </Table.Head>
          {/if}
          {#if columnVisibility.stock}
            <Table.Head class="text-center">
              <button class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors mx-auto" on:click={() => toggleSort('stock')}>
                Stock
                {#if sortColumn === 'stock'}
                  {#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}
                {:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
              </button>
            </Table.Head>
          {/if}
          {#if columnVisibility.cost}
            <Table.Head class="text-right">
              <button class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors ml-auto" on:click={() => toggleSort('cost')}>
                Cost
                {#if sortColumn === 'cost'}
                  {#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}
                {:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
              </button>
            </Table.Head>
          {/if}
          {#if columnVisibility.price}
            <Table.Head class="text-right">
              <button class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors ml-auto" on:click={() => toggleSort('price')}>
                Price
                {#if sortColumn === 'price'}
                  {#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}
                {:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
              </button>
            </Table.Head>
          {/if}
          {#if columnVisibility.actions}<Table.Head class="text-xs uppercase tracking-wider text-center">Actions</Table.Head>{/if}
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each paginatedProducts as product}
          {@const isSelected = selectedIds.has(product.id ?? product.name)}
          <Table.Row class="group {isSelected ? 'bg-primary/5' : ''}">
            <Table.Cell class="w-12">
              <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(product)} aria-label="Select row" />
            </Table.Cell>
            {#if columnVisibility.name}
              <Table.Cell>
                <div class="font-medium">{product.name}</div>
                <div class="text-xs text-muted-foreground">{product.category || 'Uncategorized'}</div>
              </Table.Cell>
            {/if}
            {#if columnVisibility.sku}
              <Table.Cell>
                <div class="flex flex-col space-y-1">
                  {#if product.productId}<span class="text-sm text-muted-foreground font-mono">{product.productId}</span>{/if}
                  {#if product.barcode}<span class="text-xs text-muted-foreground font-mono flex items-center space-x-1"><Barcode size={12} /><span>{product.barcode}</span></span>{/if}
                  {#if !product.productId && !product.barcode}<span class="text-muted-foreground">-</span>{/if}
                </div>
              </Table.Cell>
            {/if}
            {#if columnVisibility.supplier}<Table.Cell class="text-sm text-muted-foreground">{product.supplierName}</Table.Cell>{/if}
            {#if columnVisibility.stock}
              <Table.Cell class="text-center">
                <div class="flex flex-col items-center space-y-1">
                  <span class="font-mono font-bold">{product.currentStock ?? 0}</span>
                  <Badge variant={getStockStatusVariant(product)} class="text-xs font-bold {getStockStatusVariant(product) === 'outline' ? 'text-yellow-500 border-yellow-500' : ''}">{getStockStatusText(product)}</Badge>
                </div>
              </Table.Cell>
            {/if}
            {#if columnVisibility.cost}<Table.Cell class="text-right font-mono text-muted-foreground">${product.lastPrice.toFixed(2)}</Table.Cell>{/if}
            {#if columnVisibility.price}<Table.Cell class="text-right font-mono font-bold">{product.sellingPrice ? `$${product.sellingPrice.toFixed(2)}` : '-'}</Table.Cell>{/if}
            {#if columnVisibility.actions}
              <Table.Cell>
                <div class="flex justify-center space-x-2">
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild let:builder>
                      <button use:builder.action {...builder} class="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors" on:click={() => startEdit(product)}>
                        <Edit2 size={16} />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Content>Edit</Tooltip.Content>
                  </Tooltip.Root>
                  <Tooltip.Root>
                    <Tooltip.Trigger asChild let:builder>
                      <button use:builder.action {...builder} class="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" on:click={() => confirmDelete(product)}>
                        <Trash2 size={16} />
                      </button>
                    </Tooltip.Trigger>
                    <Tooltip.Content>Delete</Tooltip.Content>
                  </Tooltip.Root>
                </div>
              </Table.Cell>
            {/if}
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={8} class="h-48">
              <div class="flex flex-col items-center justify-center text-muted-foreground">
                <Package size={48} class="mb-4 opacity-20" />
                <p class="text-lg font-medium">No products found.</p>
                <p class="text-sm">Try importing a catalog or adding a product.</p>
              </div>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
    </Card.Content>
  </Card.Root>
  
  <!-- Pagination -->
  {#if totalRows > 0}
    <div class="flex items-center justify-between px-2 py-4">
      <div class="text-sm text-muted-foreground">{totalRows} row(s) total.</div>
      <div class="flex items-center space-x-6">
        <div class="flex items-center space-x-2">
          <span class="text-sm text-muted-foreground">Rows per page</span>
          <Select.Root selected={{ value: String(pageSize), label: String(pageSize) }} onSelectedChange={(v) => { if (v?.value) { pageSize = Number(v.value); pageIndex = 0; } }}>
            <Select.Trigger class="h-8 w-[70px]"><Select.Value /></Select.Trigger>
            <Select.Content side="top">
              {#each [10, 20, 30, 50, 100] as size}<Select.Item value={String(size)} label={String(size)}>{size}</Select.Item>{/each}
            </Select.Content>
          </Select.Root>
        </div>
        <div class="text-sm font-medium">Page {pageIndex + 1} of {pageCount || 1}</div>
        <div class="flex items-center space-x-2">
          <Button variant="outline" size="icon" disabled={pageIndex === 0} on:click={() => pageIndex = 0}>«</Button>
          <Button variant="outline" size="icon" disabled={pageIndex === 0} on:click={() => pageIndex--}>‹</Button>
          <Button variant="outline" size="icon" disabled={pageIndex >= pageCount - 1} on:click={() => pageIndex++}>›</Button>
          <Button variant="outline" size="icon" disabled={pageIndex >= pageCount - 1} on:click={() => pageIndex = pageCount - 1}>»</Button>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Edit/Create Dialog -->
<Dialog.Root bind:open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
  <Dialog.Content class="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
    <Dialog.Header>
      <Dialog.Title>{isCreating ? 'Add Product' : 'Edit Product'}</Dialog.Title>
      <Dialog.Description>{isCreating ? 'Create a new product in your catalog.' : 'Update product information.'}</Dialog.Description>
    </Dialog.Header>
    
    {#if editingProduct}
    <div class="space-y-4 overflow-y-auto flex-1 py-4">
      <div class="space-y-1.5">
        <Label for="product-name" class="text-xs uppercase">Product Name</Label>
        <Input id="product-name" bind:value={editingProduct.name} class="h-11 bg-input/50" placeholder="e.g. President Beer" />
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1.5">
          <Label for="product-sku" class="text-xs uppercase">SKU / ID</Label>
          <Input id="product-sku" bind:value={editingProduct.productId} class="h-11 bg-input/50" placeholder="Optional" />
        </div>
        <div class="space-y-1.5">
          <Label for="product-barcode" class="text-xs uppercase flex items-center space-x-1"><Barcode size={12} /><span>Barcode</span></Label>
          <Input id="product-barcode" bind:value={editingProduct.barcode} class="h-11 bg-input/50 font-mono" placeholder="e.g. 7350510066301" />
        </div>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1.5">
          <Label for="product-category" class="text-xs uppercase">Category</Label>
          <Input id="product-category" bind:value={editingProduct.category} class="h-11 bg-input/50" placeholder="e.g. Beverages" />
        </div>
        <div class="space-y-1.5">
          <Label for="product-supplier" class="text-xs uppercase">Supplier</Label>
          <Select.Root selected={editingProduct?.supplierId ? { value: String(editingProduct.supplierId), label: suppliers.find(s => s.id === editingProduct?.supplierId)?.name || '' } : undefined} onSelectedChange={(v) => { if (editingProduct) editingProduct.supplierId = v?.value ? Number(v.value) : undefined; }}>
            <Select.Trigger class="w-full bg-input/50"><Select.Value placeholder="Select Supplier..." /></Select.Trigger>
            <Select.Content>{#each suppliers as s}<Select.Item value={String(s.id)} label={s.name}>{s.name}</Select.Item>{/each}</Select.Content>
          </Select.Root>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1.5">
          <Label for="product-cost" class="text-xs uppercase">Cost</Label>
          <Input id="product-cost" type="number" step="0.01" bind:value={editingProduct.lastPrice} class="h-11 bg-input/50" />
        </div>
        <div class="space-y-1.5">
          <Label for="product-price" class="text-xs uppercase">Selling Price</Label>
          <Input id="product-price" type="number" step="0.01" bind:value={editingProduct.sellingPrice} class="h-11 bg-input/50" />
        </div>
      </div>
      
      <div class="pt-4 border-t border-border">
        <h4 class="text-sm font-bold text-muted-foreground mb-3 flex items-center space-x-2"><Package size={16} /><span>Inventory</span></h4>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <Label for="current-stock" class="text-xs uppercase">Current Stock</Label>
            <Input id="current-stock" type="number" step="1" bind:value={editingProduct.currentStock} class="h-11 bg-input/50" placeholder="0" />
          </div>
          <div class="space-y-1.5">
            <Label for="reorder-point" class="text-xs uppercase">Reorder Point</Label>
            <Input id="reorder-point" type="number" step="1" bind:value={editingProduct.reorderPoint} class="h-11 bg-input/50" placeholder="5" />
            <p class="text-xs text-muted-foreground">Alert when stock falls below this</p>
          </div>
        </div>
      </div>
    </div>
    {/if}

    <Dialog.Footer class="pt-4 border-t border-border">
      <Button variant="ghost" on:click={closeDialog}>Cancel</Button>
      <Button variant="default" on:click={saveProduct} class="font-bold shadow-lg shadow-primary/20">{isCreating ? 'Create Product' : 'Save Changes'}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete Product</AlertDialog.Title>
      <AlertDialog.Description>Are you sure you want to delete <strong>{productToDelete?.name}</strong>? This action cannot be undone.</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={() => { deleteDialogOpen = false; productToDelete = null; }}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action class="bg-destructive text-destructive-foreground hover:bg-destructive/90" on:click={executeDelete}>Delete</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<!-- Bulk Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={bulkDeleteDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete Multiple Products</AlertDialog.Title>
      <AlertDialog.Description>Are you sure you want to delete <strong>{selectedProducts.length}</strong> product{selectedProducts.length > 1 ? 's' : ''}? This action cannot be undone.</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={() => { bulkDeleteDialogOpen = false; }}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action class="bg-destructive text-destructive-foreground hover:bg-destructive/90" on:click={executeBulkDelete}>Delete</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
