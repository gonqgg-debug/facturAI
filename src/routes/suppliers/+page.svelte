<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { db } from '$lib/db';
  import type { Supplier, Invoice } from '$lib/types';
  import { 
    Plus, Search, Edit2, Trash2, Phone, Mail, MapPin, 
    Building2, User, Globe, CreditCard, FileText, X, 
    Check, ChevronRight, Clock, DollarSign
  } from 'lucide-svelte';
  import * as Select from '$lib/components/ui/select';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Badge } from '$lib/components/ui/badge';
  import { Switch } from '$lib/components/ui/switch';
  import { Button } from '$lib/components/ui/button';

  let suppliers: Supplier[] = [];
  let searchQuery = '';
  let categoryFilter: string = 'all';
  let showAddModal = false;
  let showDetailModal = false;
  let editingSupplier: Supplier | null = null;
  let selectedSupplier: Supplier | null = null;
  let supplierInvoices: Invoice[] = [];
  let isSaving = false;
  
  // Delete confirmation state
  let deleteDialogOpen = false;
  let supplierToDelete: Supplier | null = null;

  // Form state
  let form: Partial<Supplier> = getEmptyForm();

  function getEmptyForm(): Partial<Supplier> {
    return {
      name: '',
      rnc: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      contactPerson: '',
      contactPhone: '',
      website: '',
      notes: '',
      category: 'Distributor',
      defaultCreditDays: 30,
      isActive: true,
      alias: [],
      examples: []
    };
  }

  onMount(async () => {
    await loadSuppliers();
  });

  async function loadSuppliers() {
    if (!browser) return;
    let allSuppliers = await db.suppliers.toArray();
    
    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      allSuppliers = allSuppliers.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.rnc?.toLowerCase().includes(q) ||
        s.contactPerson?.toLowerCase().includes(q)
      );
    }
    
    // Filter by category
    if (categoryFilter !== 'all') {
      allSuppliers = allSuppliers.filter(s => s.category === categoryFilter);
    }
    
    // Sort by name
    allSuppliers.sort((a, b) => a.name.localeCompare(b.name));
    
    suppliers = allSuppliers;
  }

  function openAddModal() {
    editingSupplier = null;
    form = getEmptyForm();
    showAddModal = true;
  }

  function openEditModal(supplier: Supplier) {
    editingSupplier = supplier;
    form = { ...supplier };
    showAddModal = true;
  }

  async function openDetailModal(supplier: Supplier) {
    selectedSupplier = supplier;
    // Load invoices for this supplier
    supplierInvoices = await db.invoices
      .where('providerName')
      .equals(supplier.name)
      .reverse()
      .limit(10)
      .toArray();
    showDetailModal = true;
  }

  function closeModals() {
    showAddModal = false;
    showDetailModal = false;
    editingSupplier = null;
    selectedSupplier = null;
    form = getEmptyForm();
  }

  async function saveSupplier() {
    if (!form.name?.trim()) {
      alert('El nombre del proveedor es requerido');
      return;
    }

    isSaving = true;
    try {
      const supplierData: Supplier = {
        ...form,
        name: form.name!.trim(),
        rnc: form.rnc?.trim() || '',
        examples: form.examples || [],
        createdAt: editingSupplier?.createdAt || new Date(),
        isActive: form.isActive ?? true
      } as Supplier;

      if (editingSupplier?.id) {
        await db.suppliers.update(editingSupplier.id, supplierData);
      } else {
        await db.suppliers.add(supplierData);
      }

      await loadSuppliers();
      closeModals();
    } catch (e) {
      console.error('Error saving supplier:', e);
      alert('Error al guardar proveedor');
    } finally {
      isSaving = false;
    }
  }

  function confirmDeleteSupplier(supplier: Supplier) {
    if (!supplier.id) return;
    supplierToDelete = supplier;
    deleteDialogOpen = true;
  }

  async function executeDeleteSupplier() {
    if (!supplierToDelete?.id) return;
    
    try {
      await db.suppliers.delete(supplierToDelete.id);
      deleteDialogOpen = false;
      supplierToDelete = null;
      await loadSuppliers();
      closeModals();
    } catch (e) {
      console.error('Error deleting supplier:', e);
      alert('Error al eliminar proveedor');
    }
  }

  function formatCurrency(amount: number): string {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function getCategoryVariant(category?: string): "default" | "secondary" | "outline" {
    switch (category) {
      case 'Wholesaler': return 'default';
      default: return 'secondary';
    }
  }
  
  function getCategoryColorClass(category?: string): string {
    switch (category) {
      case 'Distributor': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Manufacturer': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'Wholesaler': return '';
      case 'Service': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  }

  $: {
    searchQuery;
    categoryFilter;
    loadSuppliers();
  }
</script>

<div class="p-4 max-w-6xl mx-auto pb-24">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-bold">Suppliers</h1>
      <p class="text-muted-foreground text-sm mt-1">{suppliers.length} proveedores registrados</p>
    </div>
    <Button 
      variant="default"
      size="default"
      on:click={openAddModal}
      class="font-semibold"
    >
      <Plus size={18} />
      <span class="hidden sm:inline">Agregar</span>
    </Button>
  </div>

  <!-- Search & Filters -->
  <div class="flex flex-col sm:flex-row gap-3 mb-6">
    <div class="flex-1 relative">
      <Search size={18} class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
      <Input 
        bind:value={searchQuery}
        placeholder="Buscar por nombre, RNC o contacto..."
        class="h-12 pl-10 bg-card rounded-xl"
      />
    </div>
    <Select.Root 
      selected={{ value: categoryFilter, label: { 'all': 'Todas las categorías', 'Distributor': 'Distribuidor', 'Manufacturer': 'Fabricante', 'Wholesaler': 'Mayorista', 'Service': 'Servicios', 'Other': 'Otro' }[categoryFilter] || 'Todas las categorías' }}
      onSelectedChange={(v) => { if (v?.value) categoryFilter = v.value; }}
    >
      <Select.Trigger class="w-[200px] bg-card">
        <Select.Value placeholder="Todas las categorías" />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="all" label="Todas las categorías">Todas las categorías</Select.Item>
        <Select.Item value="Distributor" label="Distribuidor">Distribuidor</Select.Item>
        <Select.Item value="Manufacturer" label="Fabricante">Fabricante</Select.Item>
        <Select.Item value="Wholesaler" label="Mayorista">Mayorista</Select.Item>
        <Select.Item value="Service" label="Servicios">Servicios</Select.Item>
        <Select.Item value="Other" label="Otro">Otro</Select.Item>
      </Select.Content>
    </Select.Root>
  </div>

  <!-- Suppliers Grid -->
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {#each suppliers as supplier}
      <button 
        class="bg-card text-card-foreground border border-border rounded-xl p-4 text-left hover:border-primary/50 transition-all group"
        on:click={() => openDetailModal(supplier)}
      >
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
              {supplier.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 class="font-semibold group-hover:text-primary transition-colors">{supplier.name}</h3>
              {#if supplier.rnc}
                <p class="text-xs text-muted-foreground">RNC: {supplier.rnc}</p>
              {/if}
            </div>
          </div>
          <ChevronRight size={18} class="text-muted-foreground group-hover:text-primary transition-colors" />
        </div>

        <div class="space-y-2 text-sm">
          {#if supplier.category}
            <Badge variant={getCategoryVariant(supplier.category)} class="text-xs {getCategoryColorClass(supplier.category)}">
              {supplier.category}
            </Badge>
          {/if}
          
          {#if supplier.phone}
            <div class="flex items-center gap-2 text-muted-foreground">
              <Phone size={14} />
              <span class="truncate">{supplier.phone}</span>
            </div>
          {/if}
          
          {#if supplier.email}
            <div class="flex items-center gap-2 text-muted-foreground">
              <Mail size={14} />
              <span class="truncate">{supplier.email}</span>
            </div>
          {/if}
          
          {#if supplier.defaultCreditDays}
            <div class="flex items-center gap-2 text-muted-foreground">
              <Clock size={14} />
              <span>{supplier.defaultCreditDays} días de crédito</span>
            </div>
          {/if}
        </div>

        {#if supplier.isActive === false}
          <div class="mt-3 px-2 py-1 bg-destructive/10 text-destructive text-xs rounded inline-block">
            Inactivo
          </div>
        {/if}
      </button>
    {/each}

    {#if suppliers.length === 0}
      <div class="col-span-full text-center py-12">
        <Building2 size={48} class="mx-auto text-muted-foreground mb-4" />
        <p class="text-muted-foreground">No hay proveedores registrados</p>
        <button 
          on:click={openAddModal}
          class="mt-4 text-primary hover:underline"
        >
          Agregar el primero
        </button>
      </div>
    {/if}
  </div>
</div>

<!-- Add/Edit Modal -->
{#if showAddModal}
  <div class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" on:click|self={closeModals}>
    <div class="bg-card text-card-foreground w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <div class="p-4 border-b border-border flex justify-between items-center">
        <h3 class="font-bold text-lg">
          {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        </h3>
        <button on:click={closeModals} class="text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg">
          <X size={20} />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-6">
        <!-- Basic Info -->
        <div>
          <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Información Básica</h4>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="sm:col-span-2 space-y-1.5">
              <Label for="supplier-name">Nombre *</Label>
              <Input 
                id="supplier-name"
                bind:value={form.name}
                placeholder="Nombre del proveedor"
                class="bg-input/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="supplier-rnc">RNC</Label>
              <Input 
                id="supplier-rnc"
                bind:value={form.rnc}
                placeholder="000-00000-0"
                class="bg-input/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="supplier-category">Categoría</Label>
              <Select.Root 
                selected={form.category ? { value: form.category, label: { 'Distributor': 'Distribuidor', 'Manufacturer': 'Fabricante', 'Wholesaler': 'Mayorista', 'Service': 'Servicios', 'Other': 'Otro' }[form.category] || form.category } : { value: 'Distributor', label: 'Distribuidor' }}
                onSelectedChange={(v) => { if (v?.value) form.category = v.value; }}
              >
                <Select.Trigger class="w-full bg-input/50">
                  <Select.Value placeholder="Seleccionar categoría..." />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="Distributor" label="Distribuidor">Distribuidor</Select.Item>
                  <Select.Item value="Manufacturer" label="Fabricante">Fabricante</Select.Item>
                  <Select.Item value="Wholesaler" label="Mayorista">Mayorista</Select.Item>
                  <Select.Item value="Service" label="Servicios">Servicios</Select.Item>
                  <Select.Item value="Other" label="Otro">Otro</Select.Item>
                </Select.Content>
              </Select.Root>
            </div>
          </div>
        </div>

        <!-- Contact Info -->
        <div>
          <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contacto</h4>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-1.5">
              <Label for="supplier-phone">Teléfono</Label>
              <Input 
                id="supplier-phone"
                bind:value={form.phone}
                placeholder="809-000-0000"
                class="bg-input/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="supplier-email">Email</Label>
              <Input 
                id="supplier-email"
                bind:value={form.email}
                type="email"
                placeholder="correo@proveedor.com"
                class="bg-input/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="contact-person">Persona de contacto</Label>
              <Input 
                id="contact-person"
                bind:value={form.contactPerson}
                placeholder="Nombre del contacto"
                class="bg-input/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="contact-phone">Teléfono de contacto</Label>
              <Input 
                id="contact-phone"
                bind:value={form.contactPhone}
                placeholder="809-000-0000"
                class="bg-input/50"
              />
            </div>
          </div>
        </div>

        <!-- Address -->
        <div>
          <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Dirección</h4>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="sm:col-span-2 space-y-1.5">
              <Label for="supplier-address">Dirección</Label>
              <Input 
                id="supplier-address"
                bind:value={form.address}
                placeholder="Calle, número, sector"
                class="bg-input/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="supplier-city">Ciudad</Label>
              <Input 
                id="supplier-city"
                bind:value={form.city}
                placeholder="Santo Domingo"
                class="bg-input/50"
              />
            </div>
            <div class="space-y-1.5">
              <Label for="supplier-website">Sitio Web</Label>
              <Input 
                id="supplier-website"
                bind:value={form.website}
                placeholder="https://proveedor.com"
                class="bg-input/50"
              />
            </div>
          </div>
        </div>

        <!-- Business Terms -->
        <div>
          <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Términos Comerciales</h4>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-1.5">
              <Label for="credit-days">Días de crédito</Label>
              <Input 
                id="credit-days"
                bind:value={form.defaultCreditDays}
                type="number"
                placeholder="30"
                class="bg-input/50"
              />
            </div>
            <div class="flex items-center gap-3 pt-6">
              <div class="flex items-center gap-2">
                <Switch bind:checked={form.isActive} id="active-supplier-switch" />
                <Label for="active-supplier-switch" class="text-muted-foreground cursor-pointer">Proveedor activo</Label>
              </div>
            </div>
          </div>
        </div>

        <!-- Notes -->
        <div class="space-y-1.5">
          <Label for="supplier-notes">Notas</Label>
          <textarea 
            bind:value={form.notes}
            placeholder="Notas adicionales sobre el proveedor..."
            rows="3"
            class="w-full bg-input/50 border border-input rounded-lg px-4 py-2.5 focus:border-primary outline-none resize-none"
          ></textarea>
        </div>
      </div>

      <div class="p-4 border-t border-border flex gap-3">
        {#if editingSupplier}
          <Button 
            variant="destructive"
            size="default"
            on:click={() => confirmDeleteSupplier(editingSupplier)}
            class="px-4"
          >
            <Trash2 size={18} />
          </Button>
        {/if}
        <div class="flex-1"></div>
        <Button 
          variant="ghost"
          size="default"
          on:click={closeModals}
        >
          Cancelar
        </Button>
        <Button 
          variant="default"
          size="default"
          on:click={saveSupplier}
          disabled={isSaving || !form.name?.trim()}
          class="font-semibold"
        >
          {#if isSaving}
            <span class="animate-spin">⏳</span>
          {:else}
            <Check size={18} />
          {/if}
          Guardar
        </Button>
      </div>
    </div>
  </div>
{/if}

<!-- Detail Modal -->
{#if showDetailModal && selectedSupplier}
  <div class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" on:click|self={closeModals}>
    <div class="bg-card text-card-foreground w-full max-w-2xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <div class="p-4 border-b border-border flex justify-between items-center">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
            {selectedSupplier.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 class="font-bold text-lg">{selectedSupplier.name}</h3>
            {#if selectedSupplier.category}
              <Badge variant={getCategoryVariant(selectedSupplier.category)} class="text-xs {getCategoryColorClass(selectedSupplier.category)}">
                {selectedSupplier.category}
              </Badge>
            {/if}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button 
            on:click={() => openEditModal(selectedSupplier)}
            class="text-muted-foreground hover:text-foreground p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <Edit2 size={18} />
          </button>
          <button on:click={closeModals} class="text-muted-foreground hover:text-foreground p-2 hover:bg-muted rounded-lg">
            <X size={20} />
          </button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-6">
        <!-- Contact Info -->
        <div class="grid gap-4 sm:grid-cols-2">
          {#if selectedSupplier.rnc}
            <div class="bg-muted/50 rounded-lg p-3">
              <div class="text-xs text-muted-foreground mb-1">RNC</div>
              <div class="font-mono">{selectedSupplier.rnc}</div>
            </div>
          {/if}
          
          {#if selectedSupplier.phone}
            <a href="tel:{selectedSupplier.phone}" class="bg-muted/50 rounded-lg p-3 hover:bg-muted transition-colors">
              <div class="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Phone size={12} /> Teléfono
              </div>
              <div>{selectedSupplier.phone}</div>
            </a>
          {/if}
          
          {#if selectedSupplier.email}
            <a href="mailto:{selectedSupplier.email}" class="bg-muted/50 rounded-lg p-3 hover:bg-muted transition-colors">
              <div class="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Mail size={12} /> Email
              </div>
              <div class="truncate">{selectedSupplier.email}</div>
            </a>
          {/if}
          
          {#if selectedSupplier.website}
            <a href={selectedSupplier.website} target="_blank" class="bg-muted/50 rounded-lg p-3 hover:bg-muted transition-colors">
              <div class="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Globe size={12} /> Website
              </div>
              <div class="text-primary truncate">{selectedSupplier.website}</div>
            </a>
          {/if}
          
          {#if selectedSupplier.address}
            <div class="bg-muted/50 rounded-lg p-3 sm:col-span-2">
              <div class="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <MapPin size={12} /> Dirección
              </div>
              <div>
                {selectedSupplier.address}
                {#if selectedSupplier.city}, {selectedSupplier.city}{/if}
              </div>
            </div>
          {/if}
          
          {#if selectedSupplier.contactPerson}
            <div class="bg-muted/50 rounded-lg p-3">
              <div class="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <User size={12} /> Contacto
              </div>
              <div>{selectedSupplier.contactPerson}</div>
              {#if selectedSupplier.contactPhone}
                <div class="text-sm text-muted-foreground">{selectedSupplier.contactPhone}</div>
              {/if}
            </div>
          {/if}
          
          {#if selectedSupplier.defaultCreditDays}
            <div class="bg-muted/50 rounded-lg p-3">
              <div class="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <CreditCard size={12} /> Crédito
              </div>
              <div>{selectedSupplier.defaultCreditDays} días</div>
            </div>
          {/if}
        </div>

        {#if selectedSupplier.notes}
          <div class="bg-muted/50 rounded-lg p-3">
            <div class="text-xs text-muted-foreground mb-1">Notas</div>
            <div class="text-muted-foreground text-sm whitespace-pre-wrap">{selectedSupplier.notes}</div>
          </div>
        {/if}

        <!-- Recent Invoices -->
        <div>
          <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <FileText size={14} />
            Facturas Recientes
          </h4>
          
          {#if supplierInvoices.length > 0}
            <div class="space-y-2">
              {#each supplierInvoices as invoice}
                <div class="bg-muted/30 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div class="text-sm font-medium">{invoice.ncf}</div>
                    <div class="text-xs text-muted-foreground">{invoice.issueDate}</div>
                  </div>
                  <div class="text-right">
                    <div class="font-semibold">{formatCurrency(invoice.total)}</div>
                    <div class="text-xs {invoice.paymentStatus === 'paid' ? 'text-green-500' : invoice.paymentStatus === 'overdue' ? 'text-destructive' : 'text-yellow-500'}">
                      {invoice.paymentStatus === 'paid' ? 'Pagado' : invoice.paymentStatus === 'overdue' ? 'Vencido' : 'Pendiente'}
                    </div>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="text-center py-6 text-muted-foreground">
              <FileText size={24} class="mx-auto mb-2 opacity-50" />
              <p class="text-sm">No hay facturas registradas</p>
            </div>
          {/if}
        </div>
      </div>

      <div class="p-4 border-t border-border">
        <a 
          href="/history?supplier={encodeURIComponent(selectedSupplier.name)}"
          class="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <FileText size={18} />
          Ver todas las facturas
        </a>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Supplier Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete Supplier</AlertDialog.Title>
      <AlertDialog.Description>¿Estás seguro de eliminar <strong>{supplierToDelete?.name}</strong>? Esta acción no se puede deshacer.</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={() => { deleteDialogOpen = false; supplierToDelete = null; }}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action class="bg-destructive text-destructive-foreground hover:bg-destructive/90" on:click={executeDeleteSupplier}>Delete</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

