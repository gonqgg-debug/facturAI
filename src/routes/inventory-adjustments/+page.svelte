<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { db, generateId } from '$lib/db';
  import { triggerSync } from '$lib/sync-service';
  import { syncStatus } from '$lib/sync-store';
  import { Search, Package, ArrowUp, ArrowDown, ClipboardList, AlertTriangle, CheckCircle2, History } from 'lucide-svelte';
  import type { Product, StockMovement } from '$lib/types';
  import { getFIFOCost, consumeFIFO, addInventoryLot } from '$lib/fifo';
  import { createShrinkageEntry } from '$lib/journal';
  import { getProductCostExTax } from '$lib/tax';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Select from '$lib/components/ui/select';
  import * as Table from '$lib/components/ui/table';
  import * as Card from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Separator } from '$lib/components/ui/separator';

  // Data
  let products: Product[] = [];
  let recentAdjustments: (StockMovement & { productName?: string })[] = [];
  
  // Search
  let searchQuery = '';
  let searchResults: Product[] = [];
  let showSearchResults = false;
  
  // Adjustment form
  let selectedProduct: Product | null = null;
  let actualCount: number = 0;
  let adjustmentReason: string = 'physical_count';
  let adjustmentNotes: string = '';
  let adjustmentDialogOpen = false;
  
  // Kardex modal
  let kardexProduct: Product | null = null;
  let kardexMovements: StockMovement[] = [];
  let kardexDialogOpen = false;

  const adjustmentReasons = [
    { value: 'physical_count', label: 'Conteo físico' },
    { value: 'damage', label: 'Daño/Merma' },
    { value: 'theft', label: 'Pérdida/Robo' },
    { value: 'expiration', label: 'Vencimiento' },
    { value: 'return_supplier', label: 'Devolución a proveedor' },
    { value: 'found', label: 'Producto encontrado' },
    { value: 'correction', label: 'Corrección de error' },
    { value: 'other', label: 'Otro' }
  ];

  let lastSyncSeen: string | null = null;
  let unsubscribeSync: (() => void) | null = null;

  onMount(async () => {
    await loadData();

    // Refresh adjustments when sync completes to reflect remote changes.
    unsubscribeSync = syncStatus.subscribe((status) => {
      const nextSync = status.lastSyncAt?.toISOString() || null;
      if (nextSync && nextSync !== lastSyncSeen && status.state !== 'syncing') {
        lastSyncSeen = nextSync;
        void loadData();
      }
    });
  });

  onDestroy(() => {
    if (unsubscribeSync) {
      unsubscribeSync();
      unsubscribeSync = null;
    }
  });

  async function loadData() {
    if (!browser) return;
    products = await db.products.toArray();
    
    // Load recent adjustments
    const adjustments = await db.stockMovements
      .where('type')
      .equals('adjustment')
      .reverse()
      .limit(20)
      .toArray();
    
    recentAdjustments = adjustments.map(adj => ({
      ...adj,
      productName: products.find(p => p.id === adj.productId)?.name ?? 'Unknown'
    }));
  }

  // Search products
  $: {
    if (searchQuery.length >= 2) {
      const query = searchQuery.toLowerCase();
      searchResults = products.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.barcode?.toLowerCase().includes(query) ||
        p.productId?.toLowerCase().includes(query)
      ).slice(0, 10);
      showSearchResults = true;
    } else {
      searchResults = [];
      showSearchResults = false;
    }
  }
  
  // Calculate difference
  $: theoreticalStock = selectedProduct?.currentStock ?? 0;
  $: difference = actualCount - theoreticalStock;
  $: isPositive = difference > 0;
  $: isNegative = difference < 0;

  function selectProduct(product: Product) {
    selectedProduct = product;
    actualCount = product.currentStock ?? 0;
    adjustmentReason = 'physical_count';
    adjustmentNotes = '';
    searchQuery = '';
    showSearchResults = false;
    adjustmentDialogOpen = true;
  }
  
  async function saveAdjustment() {
    if (!browser || !selectedProduct?.id) return;
    
    if (difference === 0) {
      alert('No hay diferencia entre el stock teórico y el conteo físico');
      return;
    }
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    // Get the FIFO cost for this product (for journal entry)
    const unitCost = await getFIFOCost(selectedProduct.id);
    const totalCost = Math.abs(difference) * unitCost;
    
    // Create stock movement with cost tracking
    const movementUuid = generateId();
    const movement: StockMovement = {
      id: movementUuid,
      productId: selectedProduct.id,
      type: 'adjustment',
      quantity: difference, // Positive for additions, negative for reductions
      date: dateStr,
      notes: `${adjustmentReasons.find(r => r.value === adjustmentReason)?.label}: ${adjustmentNotes || 'Sin notas'}`,
      unitCost: unitCost,
      totalCost: totalCost
    };
    
    await db.stockMovements.add(movement);
    const movementId = movementUuid;
    
    // Handle FIFO inventory
    if (difference < 0) {
      // Stock reduction - consume from FIFO lots and create expense journal entry
      // Note: strict=false allows adjusting legacy products without lots
      await consumeFIFO(
        selectedProduct.id,
        Math.abs(difference),
        { adjustmentId: String(movementId) }
      );
      
      // Create shrinkage expense journal entry
      // Debit: Expense account (based on reason)
      // Credit: Inventory
      await createShrinkageEntry(
        adjustmentReason,
        selectedProduct.name,
        Math.abs(difference),
        totalCost,
        String(movementId),
        adjustmentNotes
      );
    } else {
      // Stock addition (found goods) - create a new lot
      const taxRate = selectedProduct.costTaxRate ?? 0.18;
      await addInventoryLot(
        selectedProduct.id,
        difference,
        unitCost,
        taxRate,
        { purchaseDate: dateStr, lotNumber: 'ADJ-FOUND' }
      );
      
      // Create journal entry for found goods
      await createShrinkageEntry(
        'found',
        selectedProduct.name,
        difference,
        totalCost,
        String(movementId),
        adjustmentNotes
      );
    }
    
    // Update product stock
    await db.products.update(selectedProduct.id, {
      currentStock: actualCount,
      lastStockUpdate: dateStr
    });
    
    adjustmentDialogOpen = false;
    selectedProduct = null;
    await loadData();
    // Trigger immediate sync so adjustments propagate faster across devices
    void triggerSync().catch((error) => {
      console.warn('[InventoryAdjustments] Immediate sync failed (non-blocking):', error);
    });
  }
  
  async function openKardex(product: Product) {
    if (!browser || !product.id) return;
    
    kardexProduct = product;
    kardexMovements = await db.stockMovements
      .where('productId')
      .equals(product.id)
      .reverse()
      .limit(50)
      .toArray();
    kardexDialogOpen = true;
  }
  
  function getMovementTypeLabel(type: string): string {
    switch (type) {
      case 'in': return 'Entrada';
      case 'out': return 'Salida';
      case 'adjustment': return 'Ajuste';
      default: return type;
    }
  }
  
  function getMovementTypeVariant(type: string): "default" | "destructive" | "outline" | "secondary" {
    switch (type) {
      case 'in': return 'default';
      case 'out': return 'destructive';
      case 'adjustment': return 'secondary';
      default: return 'outline';
    }
  }
  
  function getStockStatus(product: Product): { text: string; class: string } {
    const stock = product.currentStock ?? 0;
    const reorder = product.reorderPoint ?? 5;
    
    if (stock === 0) return { text: 'Sin stock', class: 'text-destructive' };
    if (stock <= reorder) return { text: 'Stock bajo', class: 'text-yellow-500' };
    return { text: 'OK', class: 'text-green-500' };
  }
</script>

<div class="p-6 max-w-7xl mx-auto">
  <!-- Header -->
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">Inventory Adjustments</h1>
      <p class="text-muted-foreground mt-1">Adjust stock levels and record physical counts</p>
    </div>
  </div>
  
  <!-- Quick Stats -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Total Products</div>
        <div class="text-2xl font-bold">{products.length}</div>
      </Card.Content>
    </Card.Root>
    <Card.Root class="{products.filter(p => (p.currentStock ?? 0) === 0).length > 0 ? 'border-destructive/30' : ''}">
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1 flex items-center space-x-1">
          <AlertTriangle size={12} class="text-destructive" />
          <span>Out of Stock</span>
        </div>
        <div class="text-2xl font-bold text-destructive">{products.filter(p => (p.currentStock ?? 0) === 0).length}</div>
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1 flex items-center space-x-1">
          <Package size={12} class="text-yellow-500" />
          <span>Low Stock</span>
        </div>
        <div class="text-2xl font-bold text-yellow-500">{products.filter(p => {
          const stock = p.currentStock ?? 0;
          return stock > 0 && stock <= (p.reorderPoint ?? 5);
        }).length}</div>
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Recent Adjustments</div>
        <div class="text-2xl font-bold">{recentAdjustments.length}</div>
      </Card.Content>
    </Card.Root>
  </div>
  
  <!-- Search Product -->
  <Card.Root class="mb-6">
    <Card.Content class="p-6">
      <h2 class="text-lg font-bold mb-4 flex items-center gap-2">
        <ClipboardList size={20} />
        New Adjustment
      </h2>
      <div class="relative max-w-xl">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-10" size={18} />
        <Input 
          bind:value={searchQuery} 
          placeholder="Search product by name, barcode, or SKU to adjust..." 
          class="h-12 pl-10 text-lg bg-input/50"
          on:focus={() => { if (searchQuery.length >= 2) showSearchResults = true; }}
        />
        
        <!-- Search Results Dropdown -->
        {#if showSearchResults && searchResults.length > 0}
          <div class="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-xl max-h-80 overflow-auto">
            {#each searchResults as product}
              {@const stockStatus = getStockStatus(product)}
              <button 
                class="w-full px-4 py-3 flex items-center justify-between hover:bg-muted transition-colors text-left border-b border-border last:border-0"
                on:click={() => selectProduct(product)}
              >
                <div class="flex-1">
                  <div class="font-medium">{product.name}</div>
                  <div class="text-sm text-muted-foreground">
                    {#if product.barcode}<span class="font-mono">{product.barcode}</span> · {/if}
                    {#if product.productId}<span class="font-mono">{product.productId}</span> · {/if}
                    Stock: <span class="{stockStatus.class} font-bold">{product.currentStock ?? 0}</span>
                  </div>
                </div>
                <Badge variant="outline" class="{stockStatus.class}">{stockStatus.text}</Badge>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </Card.Content>
  </Card.Root>
  
  <!-- Recent Adjustments -->
  <Card.Root>
    <Card.Content class="p-0">
      <div class="p-4 border-b border-border">
        <h2 class="text-lg font-bold flex items-center gap-2">
          <History size={20} />
          Recent Adjustments
        </h2>
      </div>
      
      <Table.Root>
        <Table.Header class="bg-muted/50">
          <Table.Row>
            <Table.Head class="text-xs uppercase tracking-wider">Date</Table.Head>
            <Table.Head class="text-xs uppercase tracking-wider">Product</Table.Head>
            <Table.Head class="text-xs uppercase tracking-wider text-center">Type</Table.Head>
            <Table.Head class="text-xs uppercase tracking-wider text-right">Quantity</Table.Head>
            <Table.Head class="text-xs uppercase tracking-wider">Notes</Table.Head>
            <Table.Head class="text-xs uppercase tracking-wider text-center">Actions</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each recentAdjustments as adjustment}
            <Table.Row>
              <Table.Cell class="font-mono text-sm">{adjustment.date}</Table.Cell>
              <Table.Cell class="font-medium">{adjustment.productName}</Table.Cell>
              <Table.Cell class="text-center">
                <Badge variant={getMovementTypeVariant(adjustment.type)}>{getMovementTypeLabel(adjustment.type)}</Badge>
              </Table.Cell>
              <Table.Cell class="text-right font-mono font-bold {adjustment.quantity > 0 ? 'text-green-500' : adjustment.quantity < 0 ? 'text-destructive' : ''}">
                {adjustment.quantity > 0 ? '+' : ''}{adjustment.quantity}
              </Table.Cell>
              <Table.Cell class="text-sm text-muted-foreground max-w-xs truncate">{adjustment.notes || '-'}</Table.Cell>
              <Table.Cell class="text-center">
                <Button variant="ghost" size="sm" on:click={() => {
                  const product = products.find(p => p.id === adjustment.productId);
                  if (product) openKardex(product);
                }}>
                  <History size={14} class="mr-1" /> Kardex
                </Button>
              </Table.Cell>
            </Table.Row>
          {:else}
            <Table.Row>
              <Table.Cell colspan={6} class="h-32">
                <div class="flex flex-col items-center justify-center text-muted-foreground">
                  <ClipboardList size={40} class="mb-2 opacity-20" />
                  <p class="font-medium">No adjustments yet</p>
                  <p class="text-sm">Search for a product to make an adjustment</p>
                </div>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </Card.Content>
  </Card.Root>
</div>

<!-- Adjustment Dialog -->
<Dialog.Root bind:open={adjustmentDialogOpen}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title>Stock Adjustment</Dialog.Title>
      <Dialog.Description>Adjust stock for {selectedProduct?.name}</Dialog.Description>
    </Dialog.Header>
    
    {#if selectedProduct}
      <div class="py-4 space-y-4">
        <!-- Product Info -->
        <div class="bg-muted/50 rounded-lg p-4">
          <div class="font-bold text-lg">{selectedProduct.name}</div>
          <div class="text-sm text-muted-foreground">
            {#if selectedProduct.barcode}<span class="font-mono">{selectedProduct.barcode}</span> · {/if}
            {#if selectedProduct.productId}<span class="font-mono">{selectedProduct.productId}</span>{/if}
          </div>
        </div>
        
        <!-- Stock Comparison -->
        <div class="grid grid-cols-3 gap-4 text-center">
          <div class="bg-muted/30 rounded-lg p-3">
            <div class="text-xs uppercase text-muted-foreground mb-1">Theoretical</div>
            <div class="text-2xl font-bold">{theoreticalStock}</div>
          </div>
          <div class="flex items-center justify-center">
            {#if isPositive}
              <ArrowUp size={24} class="text-green-500" />
            {:else if isNegative}
              <ArrowDown size={24} class="text-destructive" />
            {:else}
              <CheckCircle2 size={24} class="text-muted-foreground" />
            {/if}
          </div>
          <div class="bg-primary/10 rounded-lg p-3">
            <div class="text-xs uppercase text-muted-foreground mb-1">Actual</div>
            <Input 
              type="number" 
              step="1"
              min="0"
              bind:value={actualCount}
              class="h-10 text-2xl font-bold text-center bg-transparent border-0 p-0"
            />
          </div>
        </div>
        
        <!-- Difference Display -->
        {#if difference !== 0}
          <div class="text-center p-3 rounded-lg {isPositive ? 'bg-green-500/10' : 'bg-destructive/10'}">
            <div class="text-sm text-muted-foreground">Difference</div>
            <div class="text-2xl font-bold {isPositive ? 'text-green-500' : 'text-destructive'}">
              {isPositive ? '+' : ''}{difference}
            </div>
          </div>
        {/if}
        
        <Separator />
        
        <!-- Reason -->
        <div class="space-y-1.5">
          <Label class="text-xs uppercase">Reason</Label>
          <Select.Root 
            selected={{ value: adjustmentReason, label: adjustmentReasons.find(r => r.value === adjustmentReason)?.label ?? '' }}
            onSelectedChange={(v) => { if (v?.value) adjustmentReason = v.value; }}
          >
            <Select.Trigger class="w-full"><Select.Value /></Select.Trigger>
            <Select.Content>
              {#each adjustmentReasons as reason}
                <Select.Item value={reason.value} label={reason.label}>{reason.label}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
        
        <!-- Notes -->
        <div class="space-y-1.5">
          <Label class="text-xs uppercase">Notes</Label>
          <Input bind:value={adjustmentNotes} placeholder="Optional notes..." class="bg-input/50" />
        </div>
      </div>
      
      <Dialog.Footer>
        <Button variant="ghost" on:click={() => adjustmentDialogOpen = false}>Cancel</Button>
        <Button 
          variant="default" 
          class="font-bold"
          disabled={difference === 0}
          on:click={saveAdjustment}
        >
          Save Adjustment
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<!-- Kardex Dialog -->
<Dialog.Root bind:open={kardexDialogOpen}>
  <Dialog.Content class="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
    <Dialog.Header>
      <Dialog.Title>Kardex - {kardexProduct?.name}</Dialog.Title>
      <Dialog.Description>Stock movement history</Dialog.Description>
    </Dialog.Header>
    
    <div class="flex-1 overflow-auto">
      <Table.Root>
        <Table.Header class="bg-muted/50 sticky top-0">
          <Table.Row>
            <Table.Head class="text-xs uppercase">Date</Table.Head>
            <Table.Head class="text-xs uppercase text-center">Type</Table.Head>
            <Table.Head class="text-xs uppercase text-right">Qty</Table.Head>
            <Table.Head class="text-xs uppercase text-right">Running Balance</Table.Head>
            <Table.Head class="text-xs uppercase">Reference</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each kardexMovements as movement, i}
            {@const runningBalance = kardexMovements.slice(i).reduce((acc, m) => {
              if (m.type === 'in') return acc - m.quantity;
              if (m.type === 'out') return acc + m.quantity;
              return acc - m.quantity;
            }, kardexProduct?.currentStock ?? 0)}
            <Table.Row>
              <Table.Cell class="font-mono text-sm">{movement.date}</Table.Cell>
              <Table.Cell class="text-center">
                <Badge variant={getMovementTypeVariant(movement.type)}>{getMovementTypeLabel(movement.type)}</Badge>
              </Table.Cell>
              <Table.Cell class="text-right font-mono font-bold {movement.type === 'in' || (movement.type === 'adjustment' && movement.quantity > 0) ? 'text-green-500' : 'text-destructive'}">
                {movement.type === 'in' || (movement.type === 'adjustment' && movement.quantity > 0) ? '+' : '-'}{Math.abs(movement.quantity)}
              </Table.Cell>
              <Table.Cell class="text-right font-mono">{runningBalance}</Table.Cell>
              <Table.Cell class="text-sm text-muted-foreground truncate max-w-xs">
                {#if movement.invoiceId}Invoice #{movement.invoiceId}{/if}
                {#if movement.saleId}Sale #{movement.saleId}{/if}
                {#if movement.notes}{movement.notes}{/if}
              </Table.Cell>
            </Table.Row>
          {:else}
            <Table.Row>
              <Table.Cell colspan={5} class="h-24 text-center text-muted-foreground">
                No movements recorded
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
    
    <Dialog.Footer class="border-t border-border pt-4">
      <div class="flex-1 text-sm text-muted-foreground">
        Current Stock: <span class="font-bold text-foreground">{kardexProduct?.currentStock ?? 0}</span>
      </div>
      <Button variant="outline" on:click={() => kardexDialogOpen = false}>Close</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

