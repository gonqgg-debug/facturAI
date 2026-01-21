<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '$lib/db';
  import { 
    Camera, Search, Filter, Calendar, Building2, FileText, 
    Eye, Download, Grid, List, SortAsc, SortDesc, X, ChevronLeft, ChevronRight
  } from 'lucide-svelte';
  import type { Receipt, Supplier } from '$lib/types';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import * as Select from '$lib/components/ui/select';
  import { DatePicker } from '$lib/components/ui/date-picker';
  import { locale } from '$lib/stores';
  import { t } from '$lib/i18n';
  import { goto } from '$app/navigation';

  let receipts: Receipt[] = [];
  let suppliers: Supplier[] = [];
  let loading = true;
  
  // Filters
  let searchQuery = '';
  let selectedSupplierId: string | null = null;
  let dateFrom = '';
  let dateTo = '';
  let onlyWithPhotos = true;
  
  // View state
  let viewMode: 'grid' | 'list' = 'grid';
  let sortOrder: 'newest' | 'oldest' = 'newest';
  
  // Preview modal
  let showPreview = false;
  let previewReceipt: Receipt | null = null;
  let currentPhotoIndex = 0;
  
  // Filtered receipts with photos
  $: receiptsWithPhotos = receipts.filter(r => r.invoicePhotoUrl);
  
  $: filteredReceipts = receiptsWithPhotos
    .filter(r => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesNumber = r.receiptNumber.toLowerCase().includes(query);
        const matchesSupplier = r.supplierName?.toLowerCase().includes(query);
        if (!matchesNumber && !matchesSupplier) return false;
      }
      
      // Supplier filter
      if (selectedSupplierId && r.supplierId !== selectedSupplierId) return false;
      
      // Date range filter
      if (dateFrom && r.receiptDate < dateFrom) return false;
      if (dateTo && r.receiptDate > dateTo) return false;
      
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.receiptDate).getTime();
      const dateB = new Date(b.receiptDate).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    loading = true;
    try {
      receipts = await db.receipts.toArray();
      suppliers = await db.suppliers.toArray();
    } catch (error) {
      console.error('Error loading data:', error);
    }
    loading = false;
  }

  function openPreview(receipt: Receipt) {
    previewReceipt = receipt;
    showPreview = true;
  }

  function closePreview() {
    showPreview = false;
    previewReceipt = null;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('es-DO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  function clearFilters() {
    searchQuery = '';
    selectedSupplierId = null;
    dateFrom = '';
    dateTo = '';
  }

  function downloadPhoto(receipt: Receipt) {
    if (!receipt.invoicePhotoUrl) return;
    
    const link = document.createElement('a');
    link.href = receipt.invoicePhotoUrl;
    link.download = `factura-${receipt.receiptNumber}-${receipt.receiptDate}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Navigate between photos in preview
  function nextPhoto() {
    const currentIndex = filteredReceipts.findIndex(r => r.id === previewReceipt?.id);
    if (currentIndex < filteredReceipts.length - 1) {
      previewReceipt = filteredReceipts[currentIndex + 1];
    }
  }

  function prevPhoto() {
    const currentIndex = filteredReceipts.findIndex(r => r.id === previewReceipt?.id);
    if (currentIndex > 0) {
      previewReceipt = filteredReceipts[currentIndex - 1];
    }
  }

  $: currentPhotoIndexDisplay = previewReceipt 
    ? filteredReceipts.findIndex(r => r.id === previewReceipt?.id) + 1 
    : 0;
</script>

<div class="p-4 max-w-7xl mx-auto pb-24">
  <!-- Header -->
  <div class="mb-6">
    <div class="flex items-center gap-3 mb-2">
      <div class="p-2 bg-amber-500/10 rounded-lg">
        <Camera class="text-amber-500" size={24} />
      </div>
      <div>
        <h1 class="text-2xl font-bold">Bóveda de Facturas</h1>
        <p class="text-muted-foreground text-sm">
          Galería de fotos de facturas de proveedores
        </p>
      </div>
    </div>
  </div>

  <!-- Stats -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <div class="bg-card rounded-xl border border-border p-4">
      <div class="text-2xl font-bold">{receiptsWithPhotos.length}</div>
      <div class="text-sm text-muted-foreground">Facturas con Foto</div>
    </div>
    <div class="bg-card rounded-xl border border-border p-4">
      <div class="text-2xl font-bold">{receipts.length}</div>
      <div class="text-sm text-muted-foreground">Total Recibos</div>
    </div>
    <div class="bg-card rounded-xl border border-border p-4">
      <div class="text-2xl font-bold">
        {receipts.length > 0 ? Math.round((receiptsWithPhotos.length / receipts.length) * 100) : 0}%
      </div>
      <div class="text-sm text-muted-foreground">Cobertura</div>
    </div>
    <div class="bg-card rounded-xl border border-border p-4">
      <div class="text-2xl font-bold">{filteredReceipts.length}</div>
      <div class="text-sm text-muted-foreground">Resultados</div>
    </div>
  </div>

  <!-- Filters -->
  <div class="bg-card rounded-xl border border-border p-4 mb-6">
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2 text-sm font-medium">
        <Filter size={16} />
        Filtros
      </div>
      <Button variant="ghost" size="sm" on:click={clearFilters}>
        Limpiar filtros
      </Button>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
      <!-- Search -->
      <div class="relative">
        <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input 
          bind:value={searchQuery}
          placeholder="Buscar por # recibo o proveedor..."
          class="pl-9"
        />
      </div>
      
      <!-- Supplier Filter -->
      <Select.Root 
        selected={selectedSupplierId ? { value: selectedSupplierId, label: suppliers.find(s => s.id === selectedSupplierId)?.name || '' } : undefined}
        onSelectedChange={(v) => selectedSupplierId = v?.value ?? null}
      >
        <Select.Trigger>
          <Select.Value placeholder="Todos los proveedores" />
        </Select.Trigger>
        <Select.Content>
          <Select.Item value={null}>Todos los proveedores</Select.Item>
          {#each suppliers as supplier}
            <Select.Item value={supplier.id}>{supplier.name}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
      
      <!-- Date From -->
      <div>
        <DatePicker bind:value={dateFrom} placeholder="Fecha desde" class="w-full" />
      </div>
      
      <!-- Date To -->
      <div>
        <DatePicker bind:value={dateTo} placeholder="Fecha hasta" class="w-full" />
      </div>
    </div>
  </div>

  <!-- View Controls -->
  <div class="flex items-center justify-between mb-4">
    <div class="text-sm text-muted-foreground">
      {filteredReceipts.length} factura{filteredReceipts.length !== 1 ? 's' : ''} encontrada{filteredReceipts.length !== 1 ? 's' : ''}
    </div>
    
    <div class="flex items-center gap-2">
      <!-- Sort Toggle -->
      <Button 
        variant="outline" 
        size="sm"
        on:click={() => sortOrder = sortOrder === 'newest' ? 'oldest' : 'newest'}
        class="flex items-center gap-2"
      >
        {#if sortOrder === 'newest'}
          <SortDesc size={16} />
          Más recientes
        {:else}
          <SortAsc size={16} />
          Más antiguas
        {/if}
      </Button>
      
      <!-- View Mode Toggle -->
      <div class="flex border border-border rounded-lg overflow-hidden">
        <button 
          class="p-2 {viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
          on:click={() => viewMode = 'grid'}
        >
          <Grid size={16} />
        </button>
        <button 
          class="p-2 {viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
          on:click={() => viewMode = 'list'}
        >
          <List size={16} />
        </button>
      </div>
    </div>
  </div>

  <!-- Content -->
  {#if loading}
    <div class="text-center py-12 text-muted-foreground">
      Cargando facturas...
    </div>
  {:else if filteredReceipts.length === 0}
    <div class="text-center py-12">
      <Camera size={48} class="mx-auto text-muted-foreground/50 mb-4" />
      <h3 class="font-semibold mb-2">No hay facturas con foto</h3>
      <p class="text-sm text-muted-foreground mb-4">
        {receiptsWithPhotos.length === 0 
          ? 'Captura fotos al recibir productos para crear tu archivo'
          : 'No hay resultados para los filtros seleccionados'}
      </p>
      <Button variant="outline" on:click={() => goto('/purchases/receiving')}>
        Ir a Recepción
      </Button>
    </div>
  {:else if viewMode === 'grid'}
    <!-- Grid View -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {#each filteredReceipts as receipt (receipt.id)}
        <button 
          class="bg-card border border-border rounded-xl overflow-hidden hover:border-primary transition-colors group text-left"
          on:click={() => openPreview(receipt)}
        >
          <!-- Photo -->
          <div class="aspect-[4/3] bg-muted relative overflow-hidden">
            <img 
              src={receipt.invoicePhotoUrl} 
              alt="Factura {receipt.receiptNumber}"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div class="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
              <span class="text-white text-sm flex items-center gap-1">
                <Eye size={14} />
                Ver
              </span>
            </div>
          </div>
          
          <!-- Info -->
          <div class="p-3">
            <div class="font-mono text-sm font-bold mb-1">{receipt.receiptNumber}</div>
            <div class="text-xs text-muted-foreground flex items-center gap-1 mb-1">
              <Building2 size={12} />
              {receipt.supplierName || 'Sin proveedor'}
            </div>
            <div class="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar size={12} />
              {formatDate(receipt.receiptDate)}
            </div>
            <div class="text-sm font-bold mt-2 text-primary">${receipt.total.toFixed(2)}</div>
          </div>
        </button>
      {/each}
    </div>
  {:else}
    <!-- List View -->
    <div class="bg-card border border-border rounded-xl overflow-hidden">
      <table class="w-full">
        <thead>
          <tr class="border-b border-border bg-muted/50">
            <th class="text-left p-3 text-sm font-medium">Foto</th>
            <th class="text-left p-3 text-sm font-medium"># Recibo</th>
            <th class="text-left p-3 text-sm font-medium">Proveedor</th>
            <th class="text-left p-3 text-sm font-medium">Fecha</th>
            <th class="text-right p-3 text-sm font-medium">Total</th>
            <th class="text-center p-3 text-sm font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredReceipts as receipt (receipt.id)}
            <tr class="border-b border-border hover:bg-muted/30 transition-colors">
              <td class="p-3">
                <button 
                  class="w-16 h-12 rounded-lg overflow-hidden border border-border hover:border-primary transition-colors"
                  on:click={() => openPreview(receipt)}
                >
                  <img 
                    src={receipt.invoicePhotoUrl} 
                    alt="Factura"
                    class="w-full h-full object-cover"
                  />
                </button>
              </td>
              <td class="p-3">
                <span class="font-mono font-medium">{receipt.receiptNumber}</span>
              </td>
              <td class="p-3">
                <span class="text-sm">{receipt.supplierName || '-'}</span>
              </td>
              <td class="p-3">
                <span class="text-sm text-muted-foreground">{formatDate(receipt.receiptDate)}</span>
              </td>
              <td class="p-3 text-right">
                <span class="font-mono font-bold">${receipt.total.toFixed(2)}</span>
              </td>
              <td class="p-3">
                <div class="flex items-center justify-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    on:click={() => openPreview(receipt)}
                    class="h-8 w-8 p-0"
                  >
                    <Eye size={16} />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    on:click={() => downloadPhoto(receipt)}
                    class="h-8 w-8 p-0"
                  >
                    <Download size={16} />
                  </Button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- Photo Preview Modal -->
<Dialog.Root bind:open={showPreview}>
  <Dialog.Content class="max-w-5xl max-h-[95vh] overflow-hidden">
    <Dialog.Header>
      <Dialog.Title class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <Camera size={20} />
          {previewReceipt?.receiptNumber || 'Factura'}
        </div>
        <div class="text-sm font-normal text-muted-foreground">
          {currentPhotoIndexDisplay} de {filteredReceipts.length}
        </div>
      </Dialog.Title>
    </Dialog.Header>
    
    {#if previewReceipt}
      <div class="relative">
        <!-- Navigation Arrows -->
        {#if currentPhotoIndexDisplay > 1}
          <button 
            class="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
            on:click={prevPhoto}
          >
            <ChevronLeft size={24} />
          </button>
        {/if}
        
        {#if currentPhotoIndexDisplay < filteredReceipts.length}
          <button 
            class="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
            on:click={nextPhoto}
          >
            <ChevronRight size={24} />
          </button>
        {/if}
        
        <!-- Photo -->
        <div class="bg-muted/30 rounded-lg p-4 min-h-[400px] max-h-[60vh] flex items-center justify-center">
          <img 
            src={previewReceipt.invoicePhotoUrl} 
            alt="Factura {previewReceipt.receiptNumber}"
            class="max-w-full max-h-[55vh] object-contain rounded"
          />
        </div>
        
        <!-- Receipt Details -->
        <div class="mt-4 p-4 bg-muted/30 rounded-lg">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div class="text-muted-foreground text-xs mb-1">Recibo #</div>
              <div class="font-mono font-bold">{previewReceipt.receiptNumber}</div>
            </div>
            <div>
              <div class="text-muted-foreground text-xs mb-1">Proveedor</div>
              <div class="font-medium">{previewReceipt.supplierName || '-'}</div>
            </div>
            <div>
              <div class="text-muted-foreground text-xs mb-1">Fecha</div>
              <div>{formatDate(previewReceipt.receiptDate)}</div>
            </div>
            <div>
              <div class="text-muted-foreground text-xs mb-1">Total</div>
              <div class="font-mono font-bold text-primary">${previewReceipt.total.toFixed(2)}</div>
            </div>
          </div>
          
          {#if previewReceipt.notes}
            <div class="mt-3 pt-3 border-t border-border">
              <div class="text-muted-foreground text-xs mb-1">Notas</div>
              <div class="text-sm">{previewReceipt.notes}</div>
            </div>
          {/if}
        </div>
      </div>
    {/if}
    
    <Dialog.Footer class="flex justify-between">
      <Button 
        variant="outline" 
        on:click={() => previewReceipt && downloadPhoto(previewReceipt)}
        class="flex items-center gap-2"
      >
        <Download size={16} />
        Descargar
      </Button>
      <div class="flex gap-2">
        <Button 
          variant="outline" 
          on:click={() => previewReceipt && goto(`/purchases/receiving?id=${previewReceipt.id}`)}
        >
          <FileText size={16} class="mr-2" />
          Ver Recibo
        </Button>
        <Button variant="outline" on:click={closePreview}>Cerrar</Button>
      </div>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

