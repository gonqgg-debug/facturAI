<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { db, generateId } from '$lib/db';
  import { saveSupplier, deleteSupplier as deleteSupplierOp } from '$lib/db-operations';
  import type { Supplier, Invoice } from '$lib/types';
  import { 
    Plus, Search, Edit2, Trash2, Phone, Mail, MapPin, 
    Building2, User, Globe, CreditCard, FileText, X, 
    Check, ChevronRight, Clock, DollarSign, Tag, Smartphone
  } from 'lucide-svelte';
  import * as Select from '$lib/components/ui/select';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import * as Table from '$lib/components/ui/table';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Badge } from '$lib/components/ui/badge';
  import { Switch } from '$lib/components/ui/switch';
  import { Button } from '$lib/components/ui/button';
  import { locale } from '$lib/stores';
  import { t } from '$lib/i18n';

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
  let tagsInput = '';

  function getEmptyForm(): Partial<Supplier> {
    return {
      name: '',
      rnc: '',
      supplierType: 'company',
      taxpayerType: 'Cliente de Consumo',
      phone: '',
      mobile: '',
      email: '',
      address: '',
      address2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'República Dominicana',
      contactPerson: '',
      contactPhone: '',
      website: '',
      notes: '',
      tags: [],
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
        s.contactPerson?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.phone?.toLowerCase().includes(q)
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
    tagsInput = '';
    showAddModal = true;
  }

  function openEditModal(supplier: Supplier) {
    editingSupplier = supplier;
    form = { ...supplier };
    tagsInput = (supplier.tags || []).join(', ');
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
    tagsInput = '';
  }

  function parseTags(input: string): string[] {
    return input
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  }

  async function saveSupplier() {
    if (!form.name?.trim()) {
      alert(t('suppliers.name', $locale) + ' ' + t('settings.required', $locale));
      return;
    }

    isSaving = true;
    try {
      const supplierData: Supplier = {
        ...form,
        name: form.name!.trim(),
        rnc: form.rnc?.trim() || '',
        tags: parseTags(tagsInput),
        examples: form.examples || [],
        createdAt: editingSupplier?.createdAt || new Date(),
        isActive: form.isActive ?? true
      } as Supplier;

      if (editingSupplier?.id) {
        // Update existing supplier using tracked operation
        await saveSupplier({ ...supplierData, id: editingSupplier.id } as Supplier);
      } else {
        // Create new supplier using tracked operation (ID generated automatically)
        await saveSupplier(supplierData as Supplier);
      }

      await loadSuppliers();
      closeModals();
    } catch (e: any) {
      console.error('Error saving supplier:', e?.message || e?.name || JSON.stringify(e) || e);
      console.error('Full error:', e);
      alert(`${t('common.error', $locale)}: ${e?.message || 'Unknown error'}`);
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
      // Use tracked delete operation for sync
      await deleteSupplierOp(supplierToDelete.id as string);
      deleteDialogOpen = false;
      supplierToDelete = null;
      await loadSuppliers();
      closeModals();
    } catch (e) {
      console.error('Error deleting supplier:', e);
      alert(t('common.error', $locale));
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

  function getCategoryLabel(category?: string): string {
    if (!category) return '';
    const key = `suppliers.categories.${category}` as any;
    return t(key, $locale) || category;
  }

  $: {
    searchQuery;
    categoryFilter;
    loadSuppliers();
  }
</script>

<div class="p-4 max-w-7xl mx-auto pb-24">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-bold">{t('suppliers.title', $locale)}</h1>
      <p class="text-muted-foreground text-sm mt-1">{suppliers.length} {t('suppliers.registered', $locale)}</p>
    </div>
    <Button 
      variant="default"
      size="default"
      on:click={openAddModal}
      class="font-semibold"
    >
      <Plus size={18} />
      <span class="hidden sm:inline">{t('common.add', $locale)}</span>
    </Button>
  </div>

  <!-- Search & Filters -->
  <div class="flex flex-col sm:flex-row gap-3 mb-6">
    <div class="flex-1 relative">
      <Search size={18} class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
      <Input 
        bind:value={searchQuery}
        placeholder={t('suppliers.searchPlaceholder', $locale)}
        class="h-12 pl-10 bg-card rounded-xl"
      />
    </div>
    <Select.Root 
      selected={{ value: categoryFilter, label: categoryFilter === 'all' ? t('suppliers.categories.all', $locale) : getCategoryLabel(categoryFilter) }}
      onSelectedChange={(v) => { if (v?.value) categoryFilter = v.value; }}
    >
      <Select.Trigger class="w-[200px] bg-card">
        <Select.Value placeholder={t('suppliers.categories.all', $locale)} />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="all" label={t('suppliers.categories.all', $locale)}>{t('suppliers.categories.all', $locale)}</Select.Item>
        <Select.Item value="Distributor" label={t('suppliers.categories.Distributor', $locale)}>{t('suppliers.categories.Distributor', $locale)}</Select.Item>
        <Select.Item value="Manufacturer" label={t('suppliers.categories.Manufacturer', $locale)}>{t('suppliers.categories.Manufacturer', $locale)}</Select.Item>
        <Select.Item value="Wholesaler" label={t('suppliers.categories.Wholesaler', $locale)}>{t('suppliers.categories.Wholesaler', $locale)}</Select.Item>
        <Select.Item value="Service" label={t('suppliers.categories.Service', $locale)}>{t('suppliers.categories.Service', $locale)}</Select.Item>
        <Select.Item value="Other" label={t('suppliers.categories.Other', $locale)}>{t('suppliers.categories.Other', $locale)}</Select.Item>
      </Select.Content>
    </Select.Root>
  </div>

  <!-- Suppliers Table -->
  {#if suppliers.length > 0}
    <div class="bg-card border border-border rounded-xl overflow-hidden">
      <Table.Root>
        <Table.Header>
          <Table.Row class="hover:bg-transparent border-border">
            <Table.Head class="w-[300px]">{t('suppliers.name', $locale)}</Table.Head>
            <Table.Head class="hidden md:table-cell">{t('suppliers.rnc', $locale)}</Table.Head>
            <Table.Head class="hidden lg:table-cell">{t('suppliers.category', $locale)}</Table.Head>
            <Table.Head class="hidden sm:table-cell">{t('suppliers.phone', $locale)}</Table.Head>
            <Table.Head class="hidden lg:table-cell">{t('suppliers.email', $locale)}</Table.Head>
            <Table.Head class="hidden xl:table-cell">{t('suppliers.creditDays', $locale)}</Table.Head>
            <Table.Head class="w-[100px] text-right">{t('catalog.actions', $locale)}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each suppliers as supplier}
            <Table.Row 
              class="cursor-pointer hover:bg-muted/50 border-border transition-colors"
              on:click={() => openDetailModal(supplier)}
            >
              <Table.Cell class="font-medium">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                    {supplier.name.charAt(0).toUpperCase()}
                  </div>
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="truncate">{supplier.name}</span>
                      {#if supplier.isActive === false}
                        <Badge variant="destructive" class="text-xs">{t('suppliers.inactive', $locale)}</Badge>
                      {/if}
                    </div>
                    {#if supplier.contactPerson}
                      <p class="text-xs text-muted-foreground truncate">{supplier.contactPerson}</p>
                    {/if}
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell class="hidden md:table-cell font-mono text-sm text-muted-foreground">
                {supplier.rnc || '-'}
              </Table.Cell>
              <Table.Cell class="hidden lg:table-cell">
                {#if supplier.category}
                  <Badge variant={getCategoryVariant(supplier.category)} class="text-xs {getCategoryColorClass(supplier.category)}">
                    {getCategoryLabel(supplier.category)}
                  </Badge>
                {:else}
                  <span class="text-muted-foreground">-</span>
                {/if}
              </Table.Cell>
              <Table.Cell class="hidden sm:table-cell text-muted-foreground">
                {supplier.phone || supplier.mobile || '-'}
              </Table.Cell>
              <Table.Cell class="hidden lg:table-cell text-muted-foreground truncate max-w-[200px]">
                {supplier.email || '-'}
              </Table.Cell>
              <Table.Cell class="hidden xl:table-cell text-muted-foreground">
                {#if supplier.defaultCreditDays}
                  {supplier.defaultCreditDays} {t('suppliers.days', $locale)}
                {:else}
                  -
                {/if}
              </Table.Cell>
              <Table.Cell class="text-right">
                <div class="flex items-center justify-end gap-1">
                  <button 
                    on:click|stopPropagation={() => openEditModal(supplier)}
                    class="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    on:click|stopPropagation={() => confirmDeleteSupplier(supplier)}
                    class="p-2 hover:bg-destructive/10 rounded-lg transition-colors text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </div>
  {:else}
    <div class="text-center py-16 bg-card border border-border rounded-xl">
      <Building2 size={48} class="mx-auto text-muted-foreground mb-4" />
      <p class="text-muted-foreground">{t('suppliers.noSuppliers', $locale)}</p>
      <button 
        on:click={openAddModal}
        class="mt-4 text-primary hover:underline"
      >
        {t('suppliers.addFirst', $locale)}
      </button>
    </div>
  {/if}
</div>

<!-- Add/Edit Modal -->
{#if showAddModal}
  <div class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" on:click|self={closeModals}>
    <div class="bg-card text-card-foreground w-full max-w-3xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <div class="p-4 border-b border-border flex justify-between items-center">
        <h3 class="font-bold text-lg">
          {editingSupplier ? t('suppliers.editSupplier', $locale) : t('suppliers.newSupplier', $locale)}
        </h3>
        <button on:click={closeModals} class="text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg">
          <X size={20} />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-6">
        <!-- Supplier Type Toggle -->
        <div class="flex items-center gap-4 p-3 bg-muted/30 rounded-xl">
          <button
            type="button"
            class="flex items-center gap-2 px-4 py-2 rounded-lg transition-all {form.supplierType === 'individual' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
            on:click={() => form.supplierType = 'individual'}
          >
            <User size={18} />
            {t('suppliers.individual', $locale)}
          </button>
          <button
            type="button"
            class="flex items-center gap-2 px-4 py-2 rounded-lg transition-all {form.supplierType === 'company' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}"
            on:click={() => form.supplierType = 'company'}
          >
            <Building2 size={18} />
            {t('suppliers.company', $locale)}
          </button>
        </div>

        <!-- Name / RNC Section -->
        <div>
          <div class="space-y-1.5 mb-4">
            <Input 
              bind:value={form.name}
              placeholder={t('suppliers.namePlaceholder', $locale)}
              class="bg-input/50 text-xl font-semibold h-14"
            />
          </div>
        </div>

        <!-- Two Column Layout -->
        <div class="grid md:grid-cols-2 gap-6">
          <!-- Left Column - Address -->
          <div class="space-y-4">
            <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <MapPin size={14} />
              {t('suppliers.address', $locale)}
            </h4>
            
            <div class="space-y-3">
              <Input 
                bind:value={form.address}
                placeholder={t('suppliers.addressLine1', $locale)}
                class="bg-input/50"
              />
              <Input 
                bind:value={form.address2}
                placeholder={t('suppliers.addressLine2', $locale)}
                class="bg-input/50"
              />
              <div class="grid grid-cols-3 gap-2">
                <Input 
                  bind:value={form.city}
                  placeholder={t('suppliers.city', $locale)}
                  class="bg-input/50"
                />
                <Input 
                  bind:value={form.state}
                  placeholder={t('suppliers.state', $locale)}
                  class="bg-input/50"
                />
                <Input 
                  bind:value={form.postalCode}
                  placeholder={t('suppliers.postalCode', $locale)}
                  class="bg-input/50"
                />
              </div>
              <Input 
                bind:value={form.country}
                placeholder={t('suppliers.country', $locale)}
                class="bg-input/50"
                disabled
              />
            </div>

            <!-- RNC & Taxpayer Type -->
            <div class="pt-2 space-y-3">
              <div class="space-y-1.5">
                <Label class="text-xs text-muted-foreground">{t('suppliers.rnc', $locale)}</Label>
                <Input 
                  bind:value={form.rnc}
                  placeholder={t('suppliers.rncPlaceholder', $locale)}
                  class="bg-input/50"
                />
              </div>
              <div class="space-y-1.5">
                <Label class="text-xs text-muted-foreground">{t('suppliers.taxpayerType', $locale)}</Label>
                <Input 
                  bind:value={form.taxpayerType}
                  placeholder={t('suppliers.consumerClient', $locale)}
                  class="bg-input/50"
                />
              </div>
            </div>
          </div>

          <!-- Right Column - Contact -->
          <div class="space-y-4">
            <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
              <Phone size={14} />
              {t('suppliers.contact', $locale)}
            </h4>
            
            <div class="space-y-3">
              <div class="space-y-1.5">
                <Label class="text-xs text-muted-foreground">{t('suppliers.phone', $locale)}</Label>
                <Input 
                  bind:value={form.phone}
                  placeholder="809-000-0000"
                  class="bg-input/50"
                />
              </div>
              <div class="space-y-1.5">
                <Label class="text-xs text-muted-foreground">{t('suppliers.mobile', $locale)}</Label>
                <Input 
                  bind:value={form.mobile}
                  placeholder="809-000-0000"
                  class="bg-input/50"
                />
              </div>
              <div class="space-y-1.5">
                <Label class="text-xs text-muted-foreground">{t('suppliers.email', $locale)}</Label>
                <Input 
                  bind:value={form.email}
                  type="email"
                  placeholder={t('suppliers.emailPlaceholder', $locale)}
                  class="bg-input/50"
                />
              </div>
              <div class="space-y-1.5">
                <Label class="text-xs text-muted-foreground">{t('suppliers.website', $locale)}</Label>
                <Input 
                  bind:value={form.website}
                  placeholder={t('suppliers.websitePlaceholder', $locale)}
                  class="bg-input/50"
                />
              </div>
              <div class="space-y-1.5">
                <Label class="text-xs text-muted-foreground">{t('suppliers.tags', $locale)}</Label>
                <Input 
                  bind:value={tagsInput}
                  placeholder={t('suppliers.tagsPlaceholder', $locale)}
                  class="bg-input/50"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Contact Person Section -->
        <div>
          <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <User size={14} />
            {t('suppliers.contactPerson', $locale)}
          </h4>
          <div class="grid sm:grid-cols-2 gap-3">
            <Input 
              bind:value={form.contactPerson}
              placeholder={t('suppliers.contactPerson', $locale)}
              class="bg-input/50"
            />
            <Input 
              bind:value={form.contactPhone}
              placeholder={t('suppliers.contactPhone', $locale)}
              class="bg-input/50"
            />
          </div>
        </div>

        <!-- Business Terms -->
        <div>
          <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <CreditCard size={14} />
            {t('suppliers.businessTerms', $locale)}
          </h4>
          <div class="grid sm:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <Label class="text-xs text-muted-foreground">{t('suppliers.category', $locale)}</Label>
              <Select.Root 
                selected={form.category ? { value: form.category, label: getCategoryLabel(form.category) } : { value: 'Distributor', label: getCategoryLabel('Distributor') }}
                onSelectedChange={(v) => { if (v?.value) form.category = v.value; }}
              >
                <Select.Trigger class="w-full bg-input/50">
                  <Select.Value placeholder={t('suppliers.categories.all', $locale)} />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="Distributor" label={t('suppliers.categories.Distributor', $locale)}>{t('suppliers.categories.Distributor', $locale)}</Select.Item>
                  <Select.Item value="Manufacturer" label={t('suppliers.categories.Manufacturer', $locale)}>{t('suppliers.categories.Manufacturer', $locale)}</Select.Item>
                  <Select.Item value="Wholesaler" label={t('suppliers.categories.Wholesaler', $locale)}>{t('suppliers.categories.Wholesaler', $locale)}</Select.Item>
                  <Select.Item value="Service" label={t('suppliers.categories.Service', $locale)}>{t('suppliers.categories.Service', $locale)}</Select.Item>
                  <Select.Item value="Other" label={t('suppliers.categories.Other', $locale)}>{t('suppliers.categories.Other', $locale)}</Select.Item>
                </Select.Content>
              </Select.Root>
            </div>
            <div class="space-y-1.5">
              <Label class="text-xs text-muted-foreground">{t('suppliers.creditDays', $locale)}</Label>
              <Input 
                bind:value={form.defaultCreditDays}
                type="number"
                placeholder="30"
                class="bg-input/50"
              />
            </div>
          </div>
          <div class="flex items-center gap-3 mt-4">
            <Switch bind:checked={form.isActive} id="active-supplier-switch" />
            <Label for="active-supplier-switch" class="text-muted-foreground cursor-pointer">{t('suppliers.activeSupplier', $locale)}</Label>
          </div>
        </div>

        <!-- Notes -->
        <div class="space-y-1.5">
          <Label class="text-xs text-muted-foreground">{t('suppliers.notes', $locale)}</Label>
          <textarea 
            bind:value={form.notes}
            placeholder={t('suppliers.notesPlaceholder', $locale)}
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
          {t('common.cancel', $locale)}
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
          {t('common.save', $locale)}
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
                {getCategoryLabel(selectedSupplier.category)}
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
              <div class="text-xs text-muted-foreground mb-1">{t('suppliers.rnc', $locale)}</div>
              <div class="font-mono">{selectedSupplier.rnc}</div>
            </div>
          {/if}
          
          {#if selectedSupplier.phone}
            <a href="tel:{selectedSupplier.phone}" class="bg-muted/50 rounded-lg p-3 hover:bg-muted transition-colors">
              <div class="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Phone size={12} /> {t('suppliers.phone', $locale)}
              </div>
              <div>{selectedSupplier.phone}</div>
            </a>
          {/if}
          
          {#if selectedSupplier.mobile}
            <a href="tel:{selectedSupplier.mobile}" class="bg-muted/50 rounded-lg p-3 hover:bg-muted transition-colors">
              <div class="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Smartphone size={12} /> {t('suppliers.mobile', $locale)}
              </div>
              <div>{selectedSupplier.mobile}</div>
            </a>
          {/if}
          
          {#if selectedSupplier.email}
            <a href="mailto:{selectedSupplier.email}" class="bg-muted/50 rounded-lg p-3 hover:bg-muted transition-colors">
              <div class="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Mail size={12} /> {t('suppliers.email', $locale)}
              </div>
              <div class="truncate">{selectedSupplier.email}</div>
            </a>
          {/if}
          
          {#if selectedSupplier.website}
            <a href={selectedSupplier.website} target="_blank" class="bg-muted/50 rounded-lg p-3 hover:bg-muted transition-colors">
              <div class="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Globe size={12} /> {t('suppliers.website', $locale)}
              </div>
              <div class="text-primary truncate">{selectedSupplier.website}</div>
            </a>
          {/if}
          
          {#if selectedSupplier.address}
            <div class="bg-muted/50 rounded-lg p-3 sm:col-span-2">
              <div class="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <MapPin size={12} /> {t('suppliers.address', $locale)}
              </div>
              <div>
                {selectedSupplier.address}
                {#if selectedSupplier.address2}<br>{selectedSupplier.address2}{/if}
                {#if selectedSupplier.city || selectedSupplier.state || selectedSupplier.postalCode}
                  <br>
                  {[selectedSupplier.city, selectedSupplier.state, selectedSupplier.postalCode].filter(Boolean).join(', ')}
                {/if}
                {#if selectedSupplier.country}<br>{selectedSupplier.country}{/if}
              </div>
            </div>
          {/if}
          
          {#if selectedSupplier.contactPerson}
            <div class="bg-muted/50 rounded-lg p-3">
              <div class="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <User size={12} /> {t('suppliers.contactPerson', $locale)}
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
                <CreditCard size={12} /> {t('suppliers.credit', $locale)}
              </div>
              <div>{selectedSupplier.defaultCreditDays} {t('suppliers.days', $locale)}</div>
            </div>
          {/if}
        </div>

        <!-- Tags -->
        {#if selectedSupplier.tags && selectedSupplier.tags.length > 0}
          <div class="flex flex-wrap gap-2">
            {#each selectedSupplier.tags as tag}
              <Badge variant="outline" class="text-xs">
                <Tag size={10} class="mr-1" />
                {tag}
              </Badge>
            {/each}
          </div>
        {/if}

        {#if selectedSupplier.notes}
          <div class="bg-muted/50 rounded-lg p-3">
            <div class="text-xs text-muted-foreground mb-1">{t('suppliers.notes', $locale)}</div>
            <div class="text-muted-foreground text-sm whitespace-pre-wrap">{selectedSupplier.notes}</div>
          </div>
        {/if}

        <!-- Recent Invoices -->
        <div>
          <h4 class="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
            <FileText size={14} />
            {t('suppliers.recentInvoices', $locale)}
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
              <p class="text-sm">{t('suppliers.noInvoices', $locale)}</p>
            </div>
          {/if}
        </div>
      </div>

      <div class="p-4 border-t border-border">
        <a 
          href="/invoices?supplier={encodeURIComponent(selectedSupplier.name)}"
          class="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
        >
          <FileText size={18} />
          {t('suppliers.viewAllInvoices', $locale)}
        </a>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Supplier Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{t('suppliers.deleteSupplier', $locale)}</AlertDialog.Title>
      <AlertDialog.Description>
        {t('suppliers.deleteConfirm', $locale).replace('{name}', supplierToDelete?.name || '')}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={() => { deleteDialogOpen = false; supplierToDelete = null; }}>{t('common.cancel', $locale)}</AlertDialog.Cancel>
      <AlertDialog.Action class="bg-destructive text-destructive-foreground hover:bg-destructive/90" on:click={executeDeleteSupplier}>{t('common.delete', $locale)}</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
