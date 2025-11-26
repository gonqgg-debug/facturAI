<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { apiKey } from '$lib/stores';
  import { db } from '$lib/db';
  import { Save, Download, Upload, Trash2, AlertTriangle, Eye, EyeOff, Plus, Building2, CreditCard, X, Check, Edit2, Star } from 'lucide-svelte';
  import type { BankAccount } from '$lib/types';
  import * as Select from '$lib/components/ui/select';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';

  let keyInput = '';
  let showSaveSuccess = false;
  let showKey = false;
  let isSaving = false;

  // Bank Accounts
  let bankAccounts: BankAccount[] = [];
  let showBankModal = false;
  let editingBank: BankAccount | null = null;
  let bankForm: Partial<BankAccount> = getEmptyBankForm();
  
  // Delete confirmation state
  let deleteBankDialogOpen = false;
  let bankToDelete: BankAccount | null = null;

  function getEmptyBankForm(): Partial<BankAccount> {
    return {
      bankName: '',
      accountName: '',
      accountNumber: '',
      accountType: 'checking',
      currency: 'DOP',
      isDefault: false,
      isActive: true,
      color: '#3b82f6',
      notes: ''
    };
  }

  const bankColors = [
    { name: 'Azul', value: '#3b82f6' },
    { name: 'Verde', value: '#22c55e' },
    { name: 'Morado', value: '#a855f7' },
    { name: 'Naranja', value: '#f97316' },
    { name: 'Rosa', value: '#ec4899' },
    { name: 'Cyan', value: '#06b6d4' },
  ];

  // Initialize the input value on mount (browser-only)
  onMount(async () => {
    keyInput = get(apiKey);
    await loadBankAccounts();
  });

  async function loadBankAccounts() {
    bankAccounts = await db.bankAccounts.toArray();
  }

  function openAddBankModal() {
    editingBank = null;
    bankForm = getEmptyBankForm();
    showBankModal = true;
  }

  function openEditBankModal(bank: BankAccount) {
    editingBank = bank;
    bankForm = { ...bank };
    showBankModal = true;
  }

  function closeBankModal() {
    showBankModal = false;
    editingBank = null;
    bankForm = getEmptyBankForm();
  }

  function handleAccountTypeChange(value: string | undefined) {
    if (value) {
      bankForm.accountType = value as any;
    }
  }

  async function saveBankAccount() {
    if (!bankForm.bankName?.trim() || !bankForm.accountName?.trim()) {
      alert('El nombre del banco y el nombre de la cuenta son requeridos');
      return;
    }

    try {
      // If setting as default, unset others
      if (bankForm.isDefault) {
        await db.bankAccounts.toCollection().modify({ isDefault: false });
      }

      const accountData: BankAccount = {
        ...bankForm,
        bankName: bankForm.bankName!.trim(),
        accountName: bankForm.accountName!.trim(),
        accountNumber: bankForm.accountNumber?.trim() || '',
        accountType: bankForm.accountType || 'checking',
        currency: bankForm.currency || 'DOP',
        isActive: bankForm.isActive ?? true
      } as BankAccount;

      if (editingBank?.id) {
        await db.bankAccounts.update(editingBank.id, accountData);
      } else {
        await db.bankAccounts.add(accountData);
      }

      await loadBankAccounts();
      closeBankModal();
    } catch (e) {
      console.error('Error saving bank account:', e);
      alert('Error al guardar cuenta bancaria');
    }
  }

  function confirmDeleteBankAccount(bank: BankAccount) {
    if (!bank.id) return;
    bankToDelete = bank;
    deleteBankDialogOpen = true;
  }

  async function executeDeleteBankAccount() {
    if (!bankToDelete?.id) return;

    try {
      await db.bankAccounts.delete(bankToDelete.id);
      deleteBankDialogOpen = false;
      bankToDelete = null;
      await loadBankAccounts();
      closeBankModal();
    } catch (e) {
      console.error('Error deleting bank account:', e);
      alert('Error al eliminar cuenta');
    }
  }

  async function setDefaultBank(bank: BankAccount) {
    if (!bank.id) return;
    await db.bankAccounts.toCollection().modify({ isDefault: false });
    await db.bankAccounts.update(bank.id, { isDefault: true });
    await loadBankAccounts();
  }

  function saveKey() {
    if (!keyInput.trim()) return;
    isSaving = true;
    apiKey.set(keyInput.trim());
    showSaveSuccess = true;
    setTimeout(() => {
      showSaveSuccess = false;
      isSaving = false;
    }, 2000);
  }

  async function backupData() {
    const invoices = await db.invoices.toArray();
    const suppliers = await db.suppliers.toArray();
    const globalContext = await db.globalContext.toArray();
    const rules = await db.rules.toArray();
    const products = await db.products.toArray();
    const bankAccounts = await db.bankAccounts.toArray();
    const payments = await db.payments.toArray();

    const data = {
      version: 3,
      timestamp: new Date().toISOString(),
      invoices,
      suppliers,
      globalContext,
      rules,
      products,
      bankAccounts,
      payments
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `minimarket_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function restoreData(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        
        if (!confirm('This will OVERWRITE your current data. Are you sure?')) return;

        await db.transaction('rw', db.invoices, db.suppliers, db.globalContext, db.rules, db.products, db.bankAccounts, db.payments, async () => {
          await db.invoices.clear();
          await db.suppliers.clear();
          await db.globalContext.clear();
          await db.rules.clear();
          await db.products.clear();
          await db.bankAccounts.clear();
          await db.payments.clear();

          if (data.invoices) await db.invoices.bulkAdd(data.invoices);
          if (data.suppliers) await db.suppliers.bulkAdd(data.suppliers);
          if (data.globalContext) await db.globalContext.bulkAdd(data.globalContext);
          // Support both old 'kbRules' and new 'rules' backup format
          if (data.rules) await db.rules.bulkAdd(data.rules);
          else if (data.kbRules) await db.rules.bulkAdd(data.kbRules);
          if (data.products) await db.products.bulkAdd(data.products);
          if (data.bankAccounts) await db.bankAccounts.bulkAdd(data.bankAccounts);
          if (data.payments) await db.payments.bulkAdd(data.payments);
        });

        alert('Restore successful!');
      } catch (err) {
        alert('Error restoring data: ' + err);
      }
    };

    reader.readAsText(file);
  }

  async function resetData() {
    if (confirm('DANGER: This will delete ALL data permanently. Are you sure?')) {
      if (confirm('Really? There is no going back.')) {
        await db.delete();
        await db.open();
        alert('All data has been reset.');
        window.location.reload();
      }
    }
  }
</script>

<div class="p-4 max-w-2xl mx-auto pb-24">
  <h1 class="text-2xl font-bold mb-6">Settings</h1>

  <!-- API Key Section -->
  <div class="bg-card text-card-foreground border border-border rounded-xl p-4 mb-6">
    <h2 class="text-lg font-semibold mb-4">AI Configuration</h2>
    <div class="space-y-4">
      <div class="space-y-2">
        <Label for="api-key-input">xAI API Key</Label>
        <div class="flex space-x-2">
          <div class="flex-1 relative">
            {#if showKey}
              <Input 
                id="api-key-input-text"
                type="text" 
                bind:value={keyInput} 
                placeholder="xai-..." 
                class="pr-10 bg-input/50"
              />
            {:else}
              <Input 
                id="api-key-input-password"
                type="password" 
                bind:value={keyInput} 
                placeholder="xai-..." 
                class="pr-10 bg-input/50"
              />
            {/if}
            <button 
              type="button"
              on:click={() => showKey = !showKey}
              class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
              title={showKey ? 'Hide API Key' : 'Show API Key'}
            >
              {#if showKey}
                <EyeOff size={16} />
              {:else}
                <Eye size={16} />
              {/if}
            </button>
          </div>
          <button 
            on:click={saveKey}
            disabled={isSaving || !keyInput.trim()}
            class="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-bold text-sm flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            <Save size={16} />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
        {#if showSaveSuccess}
          <p class="text-green-500 text-xs mt-2 flex items-center gap-1">
            <span class="inline-block w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            API Key saved successfully.
          </p>
        {/if}
        <p class="text-xs text-muted-foreground mt-2">
          Required for invoice extraction. Get one at <a href="https://console.x.ai" target="_blank" class="text-primary hover:underline">console.x.ai</a>.
        </p>
      </div>
    </div>
  </div>

  <!-- Bank Accounts Section -->
  <div class="bg-card text-card-foreground border border-border rounded-xl p-4 mb-6">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-lg font-semibold">Bank Accounts</h2>
        <p class="text-xs text-muted-foreground">Manage your payment accounts</p>
      </div>
      <button 
        on:click={openAddBankModal}
        class="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1 transition-colors"
      >
        <Plus size={16} />
        Add
      </button>
    </div>

    <div class="space-y-2">
      {#each bankAccounts as bank}
        <div class="flex items-center justify-between p-3 bg-muted/30 rounded-lg group border border-border/50">
          <div class="flex items-center gap-3">
            <div 
              class="w-10 h-10 rounded-lg flex items-center justify-center"
              style="background-color: {bank.color || '#3b82f6'}20"
            >
              <Building2 size={18} style="color: {bank.color || '#3b82f6'}" />
            </div>
            <div>
              <div class="font-medium flex items-center gap-2">
                {bank.bankName}
                {#if bank.isDefault}
                  <span class="text-xs bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                    <Star size={10} /> Default
                  </span>
                {/if}
              </div>
              <div class="text-xs text-muted-foreground">
                {bank.accountName}
                {#if bank.accountNumber}
                  · ****{bank.accountNumber.slice(-4)}
                {/if}
                · {bank.currency}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {#if !bank.isDefault}
              <Tooltip.Root>
                <Tooltip.Trigger asChild let:builder>
                  <button 
                    use:builder.action
                    {...builder}
                    on:click={() => setDefaultBank(bank)}
                    class="text-muted-foreground hover:text-yellow-500 p-2 rounded-lg hover:bg-muted transition-colors"
                  >
                    <Star size={16} />
                  </button>
                </Tooltip.Trigger>
                <Tooltip.Content>Set as default</Tooltip.Content>
              </Tooltip.Root>
            {/if}
            <button 
              on:click={() => openEditBankModal(bank)}
              class="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-muted transition-colors"
            >
              <Edit2 size={16} />
            </button>
          </div>
        </div>
      {/each}

      {#if bankAccounts.length === 0}
        <div class="text-center py-6 text-muted-foreground">
          <CreditCard size={32} class="mx-auto mb-2 opacity-50" />
          <p class="text-sm">No bank accounts added yet</p>
          <button 
            on:click={openAddBankModal}
            class="text-primary hover:underline text-sm mt-2"
          >
            Add your first account
          </button>
        </div>
      {/if}
    </div>
  </div>

  <!-- Data Management Section -->
  <div class="bg-card text-card-foreground border border-border rounded-xl p-4 mb-6">
    <h2 class="text-lg font-semibold mb-4">Data Management</h2>
    <div class="space-y-4">
      
      <!-- Backup -->
      <div class="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
        <div>
          <div class="font-medium">Backup Data</div>
          <div class="text-xs text-muted-foreground">Download a JSON copy of all your data.</div>
        </div>
        <button 
          on:click={backupData}
          class="text-primary hover:bg-primary/10 p-2 rounded-lg transition-colors"
        >
          <Download size={20} />
        </button>
      </div>

      <!-- Restore -->
      <div class="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
        <div>
          <div class="font-medium">Restore Data</div>
          <div class="text-xs text-muted-foreground">Restore from a JSON backup file.</div>
        </div>
        <label class="text-primary hover:bg-primary/10 p-2 rounded-lg transition-colors cursor-pointer">
          <Upload size={20} />
          <input type="file" accept=".json" on:change={restoreData} class="hidden" />
        </label>
      </div>

      <!-- Reset -->
      <div class="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/20">
        <div>
          <div class="text-red-500 font-medium">Factory Reset</div>
          <div class="text-xs text-red-400/70">Delete all data and reset the app.</div>
        </div>
        <button 
          on:click={resetData}
          class="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
        >
          <AlertTriangle size={20} />
        </button>
      </div>

    </div>
  </div>

  <div class="text-center text-muted-foreground text-xs">
    <p>FacturAI PWA v1.1.0</p>
  </div>
</div>

<!-- Bank Account Modal -->
{#if showBankModal}
  <div class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" on:click|self={closeBankModal}>
    <div class="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden text-card-foreground">
      <div class="p-4 border-b border-border flex justify-between items-center">
        <h3 class="font-bold text-lg">
          {editingBank ? 'Edit Account' : 'New Bank Account'}
        </h3>
        <button on:click={closeBankModal} class="text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg">
          <X size={20} />
        </button>
      </div>

      <div class="p-4 space-y-4">
        <div class="space-y-1.5">
          <Label for="bank-name">Bank Name *</Label>
          <Input 
            id="bank-name"
            bind:value={bankForm.bankName}
            placeholder="e.g., Banco Popular, BHD León"
            class="bg-input/50"
          />
        </div>

        <div class="space-y-1.5">
          <Label for="account-name">Account Name *</Label>
          <Input 
            id="account-name"
            bind:value={bankForm.accountName}
            placeholder="e.g., Business Checking"
            class="bg-input/50"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <Label for="account-number">Account Number</Label>
            <Input 
              id="account-number"
              bind:value={bankForm.accountNumber}
              placeholder="Last 4 digits"
              class="bg-input/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="currency">Currency</Label>
            <Select.Root 
              selected={{ value: bankForm.currency || 'DOP', label: bankForm.currency === 'USD' ? 'USD (Dollars)' : 'DOP (Pesos)' }}
              onSelectedChange={(v) => { if (v?.value) bankForm.currency = v.value; }}
            >
              <Select.Trigger class="w-full bg-input/50">
                <Select.Value placeholder="Select currency..." />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="DOP" label="DOP (Pesos)">DOP (Pesos)</Select.Item>
                <Select.Item value="USD" label="USD (Dollars)">USD (Dollars)</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>
        </div>

        <div class="space-y-1.5">
          <Label for="account-type">Account Type</Label>
          <Select.Root 
            selected={{ value: bankForm.accountType || 'checking', label: { 'checking': 'Checking (Corriente)', 'savings': 'Savings (Ahorro)', 'credit': 'Credit (Crédito)' }[bankForm.accountType || 'checking'] || 'Checking (Corriente)' }}
            onSelectedChange={(v) => handleAccountTypeChange(v?.value)}
          >
            <Select.Trigger class="w-full bg-input/50">
              <Select.Value placeholder="Select account type..." />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="checking" label="Checking (Corriente)">Checking (Corriente)</Select.Item>
              <Select.Item value="savings" label="Savings (Ahorro)">Savings (Ahorro)</Select.Item>
              <Select.Item value="credit" label="Credit (Crédito)">Credit (Crédito)</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>

        <div class="space-y-2">
          <Label>Color</Label>
          <div class="flex gap-2 flex-wrap">
            {#each bankColors as color}
              <button 
                type="button"
                class="w-8 h-8 rounded-lg transition-transform {bankForm.color === color.value ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'}"
                style="background-color: {color.value}"
                on:click={() => bankForm.color = color.value}
                title={color.name}
              ></button>
            {/each}
          </div>
        </div>

        <div class="space-y-1.5">
          <Label for="bank-notes">Notes</Label>
          <Input 
            id="bank-notes"
            bind:value={bankForm.notes}
            placeholder="Optional notes..."
            class="bg-input/50"
          />
        </div>

        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <Switch bind:checked={bankForm.isDefault} id="default-account-switch" />
            <Label for="default-account-switch" class="text-sm cursor-pointer">Default account</Label>
          </div>
        </div>
      </div>

      <div class="p-4 border-t border-border flex gap-3">
        {#if editingBank}
          <button 
            on:click={() => editingBank && confirmDeleteBankAccount(editingBank)}
            class="px-4 py-2.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
          >
            <Trash2 size={18} />
          </button>
        {/if}
        <div class="flex-1"></div>
        <button 
          on:click={closeBankModal}
          class="px-6 py-2.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button 
          on:click={saveBankAccount}
          disabled={!bankForm.bankName?.trim() || !bankForm.accountName?.trim()}
          class="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-colors"
        >
          <Check size={18} />
          Save
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Bank Account Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteBankDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete Bank Account</AlertDialog.Title>
      <AlertDialog.Description>¿Eliminar la cuenta <strong>"{bankToDelete?.accountName}"</strong> de {bankToDelete?.bankName}? Esta acción no se puede deshacer.</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={() => { deleteBankDialogOpen = false; bankToDelete = null; }}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action class="bg-destructive text-destructive-foreground hover:bg-destructive/90" on:click={executeDeleteBankAccount}>Delete</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
