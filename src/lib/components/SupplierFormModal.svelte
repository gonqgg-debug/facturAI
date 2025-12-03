<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { db } from '$lib/db';
  import { saveSupplier } from '$lib/db-operations';
  import type { Supplier } from '$lib/types';
  import { 
    X, Check, Phone, MapPin, Building2, User, CreditCard, Trash2
  } from 'lucide-svelte';
  import * as Select from '$lib/components/ui/select';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import { Button } from '$lib/components/ui/button';
  import { locale } from '$lib/stores';
  import { t } from '$lib/i18n';

  export let open = false;
  export let editingSupplier: Supplier | null = null;
  export let initialName = '';
  export let initialRnc = '';

  const dispatch = createEventDispatcher<{
    close: void;
    saved: { supplier: Supplier };
  }>();

  let isSaving = false;
  let tagsInput = '';

  // Form state
  let form: Partial<Supplier> = getEmptyForm();

  function getEmptyForm(): Partial<Supplier> {
    return {
      name: initialName,
      rnc: initialRnc,
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

  // Reset form when modal opens
  $: if (open) {
    if (editingSupplier) {
      form = { ...editingSupplier };
      tagsInput = (editingSupplier.tags || []).join(', ');
    } else {
      form = getEmptyForm();
      form.name = initialName;
      form.rnc = initialRnc;
      tagsInput = '';
    }
  }

  function getCategoryLabel(category?: string): string {
    if (!category) return '';
    const key = `suppliers.categories.${category}` as any;
    return t(key, $locale) || category;
  }

  function parseTags(input: string): string[] {
    return input
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  }

  function handleClose() {
    open = false;
    dispatch('close');
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

      let savedSupplier: Supplier;

      if (editingSupplier?.id) {
        // Update existing supplier using tracked operation
        const updatedData = { ...supplierData, id: editingSupplier.id };
        await saveSupplier(updatedData as Supplier);
        savedSupplier = updatedData as Supplier;
      } else {
        // Create new supplier using tracked operation
        const id = await saveSupplier(supplierData as Supplier);
        savedSupplier = { ...supplierData, id } as Supplier;
      }

      dispatch('saved', { supplier: savedSupplier });
      handleClose();
    } catch (e) {
      console.error('Error saving supplier:', e);
      alert(t('common.error', $locale));
    } finally {
      isSaving = false;
    }
  }
</script>

{#if open}
  <div class="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4" on:click|self={handleClose} role="dialog" aria-modal="true">
    <div class="bg-card text-card-foreground w-full max-w-3xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
      <div class="p-4 border-b border-border flex justify-between items-center">
        <h3 class="font-bold text-lg">
          {editingSupplier ? t('suppliers.editSupplier', $locale) : t('suppliers.newSupplier', $locale)}
        </h3>
        <button on:click={handleClose} class="text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg">
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

        <!-- Name Section -->
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
            <Switch bind:checked={form.isActive} id="supplier-form-active-switch" />
            <Label for="supplier-form-active-switch" class="text-muted-foreground cursor-pointer">{t('suppliers.activeSupplier', $locale)}</Label>
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
        <div class="flex-1"></div>
        <Button 
          variant="ghost"
          size="default"
          on:click={handleClose}
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

