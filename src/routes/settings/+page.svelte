<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { locale, storeLocation } from '$lib/stores';
  import { db, generateId } from '$lib/db';
  import { Save, Download, Upload, Trash2, AlertTriangle, Plus, Building2, CreditCard, X, Check, Edit2, Star, Languages, CloudRain, MapPin, RefreshCw, FlaskConical, Database, RotateCcw, Lock, Unlock, FileCheck, Clock, HardDrive, ShieldCheck, FileWarning } from 'lucide-svelte';
  import { isTestMode, hasBackup, getBackupInfo, activateTestData, deactivateTestData, type SeedProgress, type SeedResult } from '$lib/seed-test-data';
  import type { BankAccount } from '$lib/types';
  import * as Select from '$lib/components/ui/select';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import { t } from '$lib/i18n';
  import { testWeatherConnection, type CurrentWeather } from '$lib/weather';
  import { 
    createBackup, 
    restoreBackup, 
    validateBackup, 
    createAutoBackup,
    getAutoBackupInfo,
    startScheduledBackups,
    stopScheduledBackups,
    type BackupProgress,
    type BackupResult,
    type RestoreResult,
    type ValidationResult
  } from '$lib/backup';

  // Active tab
  type Tab = 'general' | 'integrations' | 'data';
  let activeTab: Tab = 'general';

  // Bank Accounts
  let bankAccounts: BankAccount[] = [];
  let showBankModal = false;
  let editingBank: BankAccount | null = null;
  let bankForm: Partial<BankAccount> = getEmptyBankForm();
  let deleteBankDialogOpen = false;
  let bankToDelete: BankAccount | null = null;

  // Weather Integration
  let weatherLocationInput = '';
  let isTestingWeather = false;
  let weatherTestResult: { success: boolean; message: string; data?: CurrentWeather } | null = null;
  let isSavingWeather = false;
  let showWeatherSaveSuccess = false;

  // Test Data Mode
  let testModeActive = false;
  let backupAvailable = false;
  let backupInfo: { date: string; tables: string[] } | null = null;
  let isSeedingData = false;
  let seedProgress: SeedProgress = { stage: '', percent: 0 };
  let seedResult: SeedResult | null = null;
  let showTestDataConfirmDialog = false;
  let showRestoreConfirmDialog = false;

  // Enhanced Backup System
  let isBackingUp = false;
  let isRestoring = false;
  let isValidating = false;
  let backupProgress: BackupProgress = { stage: '', percent: 0 };
  let backupResult: BackupResult | null = null;
  let restoreResult: RestoreResult | null = null;
  let validationResult: ValidationResult | null = null;
  let backupPassword = '';
  let restorePassword = '';
  let encryptBackup = false;
  let selectedBackupFile: File | null = null;
  let showBackupPasswordDialog = false;
  let showRestoreDialog = false;
  let autoBackupInfo: { timestamp: string; size: number } | null = null;
  let autoBackupEnabled = true;

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

  onMount(async () => {
    weatherLocationInput = get(storeLocation);
    await loadBankAccounts();
    await db.initializeDefaults();

    testModeActive = isTestMode();
    backupAvailable = hasBackup();
    backupInfo = getBackupInfo();
    
    if (testModeActive && !backupAvailable) {
      localStorage.removeItem('minimarket_test_mode');
      localStorage.removeItem('minimarket_real_data_backup');
      testModeActive = false;
    }

    autoBackupInfo = getAutoBackupInfo();
    if (autoBackupEnabled) {
      startScheduledBackups(4);
    }
  });

  onDestroy(() => {
    stopScheduledBackups();
  });

  async function loadBankAccounts() {
    bankAccounts = await db.bankAccounts.toArray();
    console.log('[Settings] Loaded bank accounts:', bankAccounts);
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
      alert($locale === 'es' ? 'El nombre del banco y el nombre de la cuenta son requeridos' : 'Bank name and account name are required');
      return;
    }

    try {
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
        accountData.id = generateId();
        await db.bankAccounts.add(accountData);
      }

      await loadBankAccounts();
      closeBankModal();
    } catch (e) {
      console.error('Error saving bank account:', e);
      alert($locale === 'es' ? 'Error al guardar cuenta bancaria' : 'Error saving bank account');
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
      alert($locale === 'es' ? 'Error al eliminar cuenta' : 'Error deleting account');
    }
  }

  async function setDefaultBank(bank: BankAccount) {
    if (!bank.id) return;
    await db.bankAccounts.toCollection().modify({ isDefault: false });
    await db.bankAccounts.update(bank.id, { isDefault: true });
    await loadBankAccounts();
  }

  function saveWeatherSettings() {
    isSavingWeather = true;
    storeLocation.set(weatherLocationInput.trim());
    showWeatherSaveSuccess = true;
    setTimeout(() => {
      showWeatherSaveSuccess = false;
      isSavingWeather = false;
    }, 2000);
  }

  async function testWeatherApi() {
    if (!weatherLocationInput.trim()) {
      weatherTestResult = {
        success: false,
        message: $locale === 'es' ? 'Por favor ingresa la ubicación' : 'Please enter location'
      };
      return;
    }

    isTestingWeather = true;
    weatherTestResult = null;

    try {
      const result = await testWeatherConnection(weatherLocationInput.trim());
      weatherTestResult = result;
    } catch (error) {
      weatherTestResult = {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed'
      };
    } finally {
      isTestingWeather = false;
    }
  }

  // Test Data Mode Functions
  function confirmActivateTestData() {
    showTestDataConfirmDialog = true;
  }

  function confirmRestoreRealData() {
    showRestoreConfirmDialog = true;
  }

  async function handleActivateTestData() {
    showTestDataConfirmDialog = false;
    isSeedingData = true;
    seedResult = null;
    
    try {
      const result = await activateTestData((progress) => {
        seedProgress = progress;
      });
      seedResult = result;
      
      if (result.success) {
        testModeActive = true;
        backupAvailable = true;
        backupInfo = getBackupInfo();
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (error) {
      console.error('Failed to activate test data:', error);
      seedResult = { 
        success: false, 
        suppliers: 0, 
        products: 0, 
        customers: 0, 
        sales: 0, 
        invoices: 0, 
        purchaseOrders: 0,
        inventoryLots: 0,
        journalEntries: 0,
        cardSettlements: 0,
        duration: 0 
      };
    } finally {
      isSeedingData = false;
    }
  }

  async function handleRestoreRealData() {
    showRestoreConfirmDialog = false;
    isSeedingData = true;
    seedProgress = { stage: 'Restoring real data...', percent: 50 };
    
    try {
      const success = await deactivateTestData();
      
      if (success) {
        testModeActive = false;
        backupInfo = null;
        seedProgress = { stage: 'Complete!', percent: 100 };
        setTimeout(() => window.location.reload(), 1500);
      } else {
        seedProgress = { stage: 'Failed to restore', percent: 0 };
      }
    } catch (error) {
      console.error('Failed to restore real data:', error);
      seedProgress = { stage: 'Error: ' + (error instanceof Error ? error.message : 'Unknown'), percent: 0 };
    } finally {
      isSeedingData = false;
    }
  }

  // Backup Functions
  async function handleBackup() {
    if (encryptBackup && !backupPassword) {
      showBackupPasswordDialog = true;
      return;
    }
    await executeBackup();
  }

  async function executeBackup() {
    isBackingUp = true;
    backupResult = null;
    showBackupPasswordDialog = false;
    
    try {
      const result = await createBackup({
        password: encryptBackup ? backupPassword : undefined,
        includeAnalytics: true,
        onProgress: (progress) => { backupProgress = progress; }
      });
      backupResult = result;
      if (result.success) {
        autoBackupInfo = getAutoBackupInfo();
      }
    } catch (error) {
      backupResult = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    } finally {
      isBackingUp = false;
      backupPassword = '';
    }
  }

  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    
    selectedBackupFile = input.files[0];
    isValidating = true;
    validationResult = null;
    
    try {
      const result = await validateBackup(selectedBackupFile);
      validationResult = result;
      if (result.encrypted || result.valid) {
        showRestoreDialog = true;
      }
    } catch (error) {
      validationResult = { valid: false, errors: [error instanceof Error ? error.message : 'Unknown error'], warnings: [] };
    } finally {
      isValidating = false;
      input.value = '';
    }
  }

  async function executeRestore() {
    if (!selectedBackupFile) return;
    
    isRestoring = true;
    restoreResult = null;
    
    try {
      const result = await restoreBackup(selectedBackupFile, {
        password: validationResult?.encrypted ? restorePassword : undefined,
        clearExisting: true,
        onProgress: (progress) => { backupProgress = progress; }
      });
      restoreResult = result;
      if (result.success) {
        showRestoreDialog = false;
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (error) {
      restoreResult = { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    } finally {
      isRestoring = false;
      restorePassword = '';
    }
  }

  function cancelRestore() {
    showRestoreDialog = false;
    selectedBackupFile = null;
    validationResult = null;
    restorePassword = '';
  }

  async function triggerManualAutoBackup() {
    const success = await createAutoBackup();
    if (success) {
      autoBackupInfo = getAutoBackupInfo();
    }
  }

  async function resetData() {
    if (confirm($locale === 'es' ? 'PELIGRO: Esto eliminará TODOS los datos permanentemente. ¿Estás seguro?' : 'DANGER: This will delete ALL data permanently. Are you sure?')) {
      if (confirm($locale === 'es' ? '¿Realmente? No hay vuelta atrás.' : 'Really? There is no going back.')) {
        await db.delete();
        await db.open();
        alert($locale === 'es' ? 'Todos los datos han sido restablecidos.' : 'All data has been reset.');
        window.location.reload();
      }
    }
  }

  const tabs: { id: Tab; labelEs: string; labelEn: string; icon: any }[] = [
    { id: 'general', labelEs: 'General', labelEn: 'General', icon: Languages },
    { id: 'integrations', labelEs: 'Integraciones', labelEn: 'Integrations', icon: CloudRain },
    { id: 'data', labelEs: 'Datos', labelEn: 'Data', icon: Database }
  ];
</script>

<svelte:head>
  <title>{$locale === 'es' ? 'Configuración' : 'Settings'} | Cuadra</title>
</svelte:head>

<div class="p-4 md:p-6 max-w-3xl mx-auto pb-24">
  <h1 class="text-2xl font-bold mb-6">{$locale === 'es' ? 'Configuración' : 'Settings'}</h1>

  <!-- Tab Navigation -->
  <div class="flex gap-1 p-1 bg-muted/50 rounded-xl mb-6">
    {#each tabs as tab}
      <button
        class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors {activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
        on:click={() => activeTab = tab.id}
      >
        <svelte:component this={tab.icon} size={16} />
        {$locale === 'es' ? tab.labelEs : tab.labelEn}
      </button>
    {/each}
  </div>

  <!-- General Tab -->
  {#if activeTab === 'general'}
    <div class="space-y-6">
      <!-- Language Section -->
      <div class="bg-card text-card-foreground border border-border rounded-xl p-5">
        <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <Languages size={18} />
          {$locale === 'es' ? 'Idioma' : 'Language'}
        </h2>
        <div class="space-y-2">
          <Label for="language-select">{$locale === 'es' ? 'Seleccionar idioma' : 'Select Language'}</Label>
          <Select.Root 
            selected={{ value: $locale, label: $locale === 'es' ? 'Español' : 'English' }}
            onSelectedChange={(v) => { if (v?.value) locale.set(v.value); }}
          >
            <Select.Trigger class="w-full bg-input/50">
              <Select.Value placeholder={$locale === 'es' ? 'Seleccionar idioma...' : 'Select language...'} />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="en" label="English">English</Select.Item>
              <Select.Item value="es" label="Español">Español</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>
      </div>

      <!-- Bank Accounts Section -->
      <div class="bg-card text-card-foreground border border-border rounded-xl p-5">
        <div class="flex items-center justify-between mb-4">
          <div>
            <h2 class="text-lg font-semibold flex items-center gap-2">
              <CreditCard size={18} />
              {$locale === 'es' ? 'Cuentas Bancarias' : 'Bank Accounts'}
            </h2>
            <p class="text-xs text-muted-foreground">{$locale === 'es' ? 'Administra tus cuentas de pago' : 'Manage your payment accounts'}</p>
          </div>
          <button 
            on:click={openAddBankModal}
            class="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1 transition-colors"
          >
            <Plus size={16} />
            {$locale === 'es' ? 'Agregar' : 'Add'}
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
                        <Star size={10} /> {$locale === 'es' ? 'Por defecto' : 'Default'}
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
                    <Tooltip.Content>{$locale === 'es' ? 'Establecer como predeterminada' : 'Set as default'}</Tooltip.Content>
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
              <p class="text-sm">{$locale === 'es' ? 'No se han agregado cuentas bancarias aún' : 'No bank accounts added yet'}</p>
              <button 
                on:click={openAddBankModal}
                class="text-primary hover:underline text-sm mt-2"
              >
                {$locale === 'es' ? 'Agrega tu primera cuenta' : 'Add your first account'}
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Integrations Tab -->
  {#if activeTab === 'integrations'}
    <div class="space-y-6">
      <!-- AI Configuration -->
      <div class="bg-card text-card-foreground border border-border rounded-xl p-5">
        <h2 class="text-lg font-semibold mb-4">{$locale === 'es' ? 'Configuración de IA' : 'AI Configuration'}</h2>
        <div class="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-start gap-3">
          <div class="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Check size={14} class="text-white" />
          </div>
          <div class="flex-1">
            <p class="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
              {$locale === 'es' ? 'Configurada en el servidor' : 'Configured on Server'}
            </p>
            <p class="text-xs text-muted-foreground">
              {$locale === 'es' 
                ? 'La clave API está configurada de forma segura en el servidor mediante variables de entorno.'
                : 'API key is securely configured on the server via environment variables.'}
            </p>
          </div>
        </div>
        <p class="text-xs text-muted-foreground mt-3">
          {$locale === 'es' ? 'Requerida para extracción de facturas. Obtén una en' : 'Required for invoice extraction. Get one at'} <a href="https://console.x.ai" target="_blank" class="text-primary hover:underline">console.x.ai</a>.
        </p>
      </div>

      <!-- Weather Integration -->
      <div class="bg-card text-card-foreground border border-border rounded-xl p-5">
        <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <CloudRain size={18} class="text-blue-500" />
          {$locale === 'es' ? 'Integración del Clima' : 'Weather Integration'}
        </h2>
        <p class="text-xs text-muted-foreground mb-4">
          {$locale === 'es' 
            ? 'Conecta con OpenWeatherMap para correlacionar el clima con el comportamiento del cliente.'
            : 'Connect to OpenWeatherMap to correlate weather with customer behavior.'}
        </p>
        <div class="space-y-4">
          <div class="bg-green-500/10 border border-green-500/20 rounded-lg p-4 flex items-start gap-3">
            <div class="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Check size={14} class="text-white" />
            </div>
            <div class="flex-1">
              <p class="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
                {$locale === 'es' ? 'API Configurada' : 'API Configured'}
              </p>
              <p class="text-xs text-muted-foreground">
                {$locale === 'es' 
                  ? 'La clave API está configurada en el servidor.'
                  : 'API key is configured on the server.'}
              </p>
            </div>
          </div>

          <div class="space-y-2">
            <Label for="store-location" class="flex items-center gap-2">
              <MapPin size={14} />
              {$locale === 'es' ? 'Ubicación de la Tienda' : 'Store Location'}
            </Label>
            <Input 
              id="store-location"
              type="text" 
              bind:value={weatherLocationInput} 
              placeholder={$locale === 'es' ? 'Ej: Santo Domingo, DO' : 'e.g., Santo Domingo, DO'}
              class="bg-input/50"
            />
          </div>

          <div class="flex gap-2">
            <button 
              on:click={testWeatherApi}
              disabled={isTestingWeather || !weatherLocationInput.trim()}
              class="bg-muted hover:bg-muted/80 text-foreground px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {#if isTestingWeather}
                <RefreshCw size={16} class="animate-spin" />
              {:else}
                <CloudRain size={16} />
              {/if}
              {$locale === 'es' ? 'Probar' : 'Test'}
            </button>
            <button 
              on:click={saveWeatherSettings}
              disabled={isSavingWeather}
              class="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              <Save size={16} />
              {$locale === 'es' ? 'Guardar' : 'Save'}
            </button>
          </div>

          {#if weatherTestResult}
            <div class="p-3 rounded-lg {weatherTestResult.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}">
              <p class="{weatherTestResult.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'} text-sm flex items-center gap-2">
                {#if weatherTestResult.success}
                  <Check size={16} />
                {:else}
                  <AlertTriangle size={16} />
                {/if}
                {weatherTestResult.message}
              </p>
              {#if weatherTestResult.data}
                <div class="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
                  <img 
                    src="https://openweathermap.org/img/wn/{weatherTestResult.data.icon}@2x.png" 
                    alt={weatherTestResult.data.description}
                    class="w-10 h-10"
                  />
                  <div>
                    <div class="font-medium text-foreground">{weatherTestResult.data.temperature}°C</div>
                    <div class="capitalize">{weatherTestResult.data.description}</div>
                  </div>
                </div>
              {/if}
            </div>
          {/if}

          {#if showWeatherSaveSuccess}
            <p class="text-green-500 text-xs flex items-center gap-1">
              <span class="inline-block w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              {$locale === 'es' ? 'Guardado' : 'Saved'}
            </p>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Data Tab -->
  {#if activeTab === 'data'}
    <div class="space-y-6">
      <!-- Backup Section -->
      <div class="bg-card text-card-foreground border border-border rounded-xl p-5">
        <h2 class="text-lg font-semibold mb-2 flex items-center gap-2">
          <HardDrive size={18} />
          {$locale === 'es' ? 'Respaldo de Datos' : 'Data Backup'}
        </h2>
        <p class="text-xs text-muted-foreground mb-4">
          {$locale === 'es' 
            ? 'Respalda y restaura todos tus datos con encriptación opcional.'
            : 'Backup and restore all your data with optional encryption.'}
        </p>

        <div class="space-y-4">
          <!-- Backup -->
          <div class="p-4 bg-muted/30 rounded-lg border border-border/50">
            <div class="flex items-center justify-between mb-3">
              <div>
                <div class="font-medium flex items-center gap-2">
                  <Download size={16} class="text-primary" />
                  {$locale === 'es' ? 'Crear Respaldo' : 'Create Backup'}
                </div>
                <div class="text-xs text-muted-foreground">
                  {$locale === 'es' ? 'Exporta todas las tablas' : 'Export all tables'}
                </div>
              </div>
            </div>
            
            <div class="flex items-center gap-4 mb-3 p-2 bg-background/50 rounded-lg">
              <div class="flex items-center gap-2">
                <Switch bind:checked={encryptBackup} id="encrypt-backup-switch" />
                <Label for="encrypt-backup-switch" class="text-sm cursor-pointer flex items-center gap-1">
                  {#if encryptBackup}
                    <Lock size={14} class="text-green-500" />
                  {:else}
                    <Unlock size={14} class="text-muted-foreground" />
                  {/if}
                  {$locale === 'es' ? 'Encriptar' : 'Encrypt'}
                </Label>
              </div>
            </div>

            {#if isBackingUp}
              <div class="mb-3 p-3 bg-primary/10 rounded-lg">
                <div class="flex items-center gap-2 mb-2">
                  <RefreshCw size={16} class="animate-spin text-primary" />
                  <span class="text-sm">{backupProgress.stage}</span>
                </div>
                <div class="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div class="h-full bg-primary transition-all" style="width: {backupProgress.percent}%"></div>
                </div>
              </div>
            {/if}

            {#if backupResult}
              <div class="mb-3 p-3 rounded-lg {backupResult.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}">
                <div class="flex items-center gap-2">
                  {#if backupResult.success}
                    <Check size={16} class="text-green-500" />
                    <span class="text-sm text-green-600 dark:text-green-400">{$locale === 'es' ? '¡Respaldo creado!' : 'Backup created!'}</span>
                  {:else}
                    <AlertTriangle size={16} class="text-red-500" />
                    <span class="text-sm text-red-600">{backupResult.error}</span>
                  {/if}
                </div>
              </div>
            {/if}
            
            <button 
              on:click={handleBackup}
              disabled={isBackingUp}
              class="w-full bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <Download size={16} />
              {$locale === 'es' ? 'Descargar Respaldo' : 'Download Backup'}
            </button>
          </div>

          <!-- Restore -->
          <div class="p-4 bg-muted/30 rounded-lg border border-border/50">
            <div class="font-medium flex items-center gap-2 mb-2">
              <Upload size={16} class="text-blue-500" />
              {$locale === 'es' ? 'Restaurar Datos' : 'Restore Data'}
            </div>
            <div class="text-xs text-muted-foreground mb-3">
              {$locale === 'es' ? 'Restaura desde un archivo de respaldo' : 'Restore from a backup file'}
            </div>

            {#if isValidating}
              <div class="mb-3 p-3 bg-blue-500/10 rounded-lg flex items-center gap-2">
                <RefreshCw size={16} class="animate-spin text-blue-500" />
                <span class="text-sm">{$locale === 'es' ? 'Validando...' : 'Validating...'}</span>
              </div>
            {/if}
            
            <label class="w-full bg-muted hover:bg-muted/80 text-foreground px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer">
              <Upload size={16} />
              {$locale === 'es' ? 'Seleccionar Archivo' : 'Select File'}
              <input type="file" accept=".json" on:change={handleFileSelect} class="hidden" disabled={isValidating} />
            </label>
          </div>

          <!-- Auto-Backup -->
          <div class="p-4 bg-muted/30 rounded-lg border border-border/50">
            <div class="flex items-center justify-between mb-2">
              <div class="font-medium flex items-center gap-2">
                <Clock size={16} class="text-purple-500" />
                {$locale === 'es' ? 'Auto-Respaldo' : 'Auto-Backup'}
              </div>
              <Switch 
                bind:checked={autoBackupEnabled} 
                on:change={() => {
                  if (autoBackupEnabled) startScheduledBackups(4);
                  else stopScheduledBackups();
                }}
              />
            </div>
            <p class="text-xs text-muted-foreground mb-2">
              {$locale === 'es' ? 'Guarda en localStorage cada 4 horas' : 'Saves to localStorage every 4 hours'}
            </p>
            {#if autoBackupInfo}
              <div class="text-xs text-green-500">
                {$locale === 'es' ? 'Último:' : 'Last:'} {new Date(autoBackupInfo.timestamp).toLocaleString()}
              </div>
            {/if}
          </div>

          <!-- Factory Reset -->
          <div class="flex items-center justify-between p-4 bg-red-500/10 rounded-lg border border-red-500/20">
            <div>
              <div class="text-red-500 font-medium">{$locale === 'es' ? 'Restablecer' : 'Factory Reset'}</div>
              <div class="text-xs text-red-400/70">{$locale === 'es' ? 'Eliminar todos los datos' : 'Delete all data'}</div>
            </div>
            <button on:click={resetData} class="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors">
              <AlertTriangle size={20} />
            </button>
          </div>
        </div>
      </div>

      <!-- Test Data Mode -->
      <div class="bg-card text-card-foreground border border-border rounded-xl p-5">
        <h2 class="text-lg font-semibold mb-2 flex items-center gap-2">
          <FlaskConical size={18} class="text-purple-500" />
          {$locale === 'es' ? 'Modo de Prueba' : 'Test Mode'}
        </h2>
        <p class="text-xs text-muted-foreground mb-4">
          {$locale === 'es' 
            ? 'Genera datos de prueba para explorar la aplicación.'
            : 'Generate test data to explore the app.'}
        </p>

        <div class="mb-4 p-3 rounded-lg {testModeActive ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-green-500/10 border border-green-500/20'}">
          <div class="flex items-center gap-2">
            {#if testModeActive}
              <FlaskConical size={16} class="text-purple-500" />
              <span class="font-medium text-purple-600 dark:text-purple-400">
                {$locale === 'es' ? 'Modo de Prueba Activo' : 'Test Mode Active'}
              </span>
            {:else}
              <Database size={16} class="text-green-500" />
              <span class="font-medium text-green-600 dark:text-green-400">
                {$locale === 'es' ? 'Datos Reales' : 'Real Data'}
              </span>
            {/if}
          </div>
        </div>

        {#if isSeedingData}
          <div class="mb-4 p-4 bg-muted/30 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
              <RefreshCw size={16} class="animate-spin text-primary" />
              <span class="text-sm">{seedProgress.stage}</span>
            </div>
            <div class="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div class="h-full bg-primary transition-all" style="width: {seedProgress.percent}%"></div>
            </div>
          </div>
        {/if}

        {#if seedResult?.success}
          <div class="mb-4 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
            <div class="flex items-center gap-2 mb-2">
              <Check size={16} class="text-green-500" />
              <span class="font-medium text-green-600">{$locale === 'es' ? '¡Datos creados!' : 'Data created!'}</span>
            </div>
            <p class="text-xs text-muted-foreground">{$locale === 'es' ? 'Recargando...' : 'Reloading...'}</p>
          </div>
        {/if}

        {#if !testModeActive}
          <button 
            on:click={confirmActivateTestData}
            disabled={isSeedingData}
            class="w-full bg-purple-500 hover:bg-purple-600 text-white px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            <FlaskConical size={16} />
            {$locale === 'es' ? 'Activar Datos de Prueba' : 'Activate Test Data'}
          </button>
        {:else}
          <button 
            on:click={confirmRestoreRealData}
            disabled={isSeedingData || !backupAvailable}
            class="w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
          >
            <RotateCcw size={16} />
            {$locale === 'es' ? 'Restaurar Datos Reales' : 'Restore Real Data'}
          </button>
        {/if}
      </div>
    </div>
  {/if}

  <div class="text-center text-muted-foreground text-xs mt-8">
    <p>Cuadra v1.1.0</p>
  </div>
</div>

<!-- Bank Account Modal -->
{#if showBankModal}
  <div class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" on:click|self={closeBankModal}>
    <div class="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden text-card-foreground">
      <div class="p-4 border-b border-border flex justify-between items-center">
        <h3 class="font-bold text-lg">
          {editingBank ? ($locale === 'es' ? 'Editar Cuenta' : 'Edit Account') : ($locale === 'es' ? 'Nueva Cuenta' : 'New Account')}
        </h3>
        <button on:click={closeBankModal} class="text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg">
          <X size={20} />
        </button>
      </div>

      <div class="p-4 space-y-4">
        <div class="space-y-1.5">
          <Label for="bank-name">{$locale === 'es' ? 'Nombre del Banco' : 'Bank Name'} *</Label>
          <Input id="bank-name" bind:value={bankForm.bankName} placeholder="e.g., Banco Popular" class="bg-input/50" />
        </div>

        <div class="space-y-1.5">
          <Label for="account-name">{$locale === 'es' ? 'Nombre de la Cuenta' : 'Account Name'} *</Label>
          <Input id="account-name" bind:value={bankForm.accountName} placeholder="e.g., Business Checking" class="bg-input/50" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <Label for="account-number">{$locale === 'es' ? 'Número' : 'Number'}</Label>
            <Input id="account-number" bind:value={bankForm.accountNumber} placeholder="Last 4 digits" class="bg-input/50" />
          </div>
          <div class="space-y-1.5">
            <Label for="currency">{$locale === 'es' ? 'Moneda' : 'Currency'}</Label>
            <Select.Root 
              selected={{ value: bankForm.currency || 'DOP', label: bankForm.currency === 'USD' ? 'USD' : 'DOP' }}
              onSelectedChange={(v) => { if (v?.value) bankForm.currency = v.value; }}
            >
              <Select.Trigger class="w-full bg-input/50">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="DOP" label="DOP">DOP</Select.Item>
                <Select.Item value="USD" label="USD">USD</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>
        </div>

        <div class="space-y-1.5">
          <Label for="account-type">{$locale === 'es' ? 'Tipo' : 'Type'}</Label>
          <Select.Root 
            selected={{ value: bankForm.accountType || 'checking', label: { 'checking': 'Checking', 'savings': 'Savings', 'credit': 'Credit' }[bankForm.accountType || 'checking'] || 'Checking' }}
            onSelectedChange={(v) => handleAccountTypeChange(v?.value)}
          >
            <Select.Trigger class="w-full bg-input/50">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="checking" label="Checking">Checking</Select.Item>
              <Select.Item value="savings" label="Savings">Savings</Select.Item>
              <Select.Item value="credit" label="Credit">Credit</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>

        <div class="space-y-2">
          <Label>{$locale === 'es' ? 'Color' : 'Color'}</Label>
          <div class="flex gap-2 flex-wrap">
            {#each bankColors as color}
              <button 
                type="button"
                class="w-8 h-8 rounded-lg transition-transform {bankForm.color === color.value ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'hover:scale-105'}"
                style="background-color: {color.value}"
                on:click={() => bankForm.color = color.value}
              ></button>
            {/each}
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Switch bind:checked={bankForm.isDefault} id="default-account-switch" />
          <Label for="default-account-switch" class="text-sm cursor-pointer">{$locale === 'es' ? 'Por defecto' : 'Default'}</Label>
        </div>
      </div>

      <div class="p-4 border-t border-border flex gap-3">
        {#if editingBank}
          <button on:click={() => editingBank && confirmDeleteBankAccount(editingBank)} class="px-4 py-2.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors">
            <Trash2 size={18} />
          </button>
        {/if}
        <div class="flex-1"></div>
        <button on:click={closeBankModal} class="px-6 py-2.5 text-muted-foreground hover:text-foreground transition-colors">
          {$locale === 'es' ? 'Cancelar' : 'Cancel'}
        </button>
        <button 
          on:click={saveBankAccount}
          disabled={!bankForm.bankName?.trim() || !bankForm.accountName?.trim()}
          class="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-colors"
        >
          <Check size={18} />
          {$locale === 'es' ? 'Guardar' : 'Save'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete Bank Account Dialog -->
<AlertDialog.Root bind:open={deleteBankDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{$locale === 'es' ? 'Eliminar Cuenta' : 'Delete Account'}</AlertDialog.Title>
      <AlertDialog.Description>
        {$locale === 'es' 
          ? `¿Eliminar "${bankToDelete?.accountName}"?`
          : `Delete "${bankToDelete?.accountName}"?`}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={() => { deleteBankDialogOpen = false; bankToDelete = null; }}>{$locale === 'es' ? 'Cancelar' : 'Cancel'}</AlertDialog.Cancel>
      <AlertDialog.Action class="bg-destructive text-destructive-foreground hover:bg-destructive/90" on:click={executeDeleteBankAccount}>{$locale === 'es' ? 'Eliminar' : 'Delete'}</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<!-- Test Data Confirm Dialog -->
<AlertDialog.Root bind:open={showTestDataConfirmDialog}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title class="flex items-center gap-2">
        <FlaskConical size={20} class="text-purple-500" />
        {$locale === 'es' ? '¿Activar Datos de Prueba?' : 'Activate Test Data?'}
      </AlertDialog.Title>
      <AlertDialog.Description>
        <p class="mb-2">{$locale === 'es' ? 'Esto hará:' : 'This will:'}</p>
        <ul class="list-disc list-inside text-sm space-y-1">
          <li>{$locale === 'es' ? 'Respaldar tus datos actuales' : 'Backup your current data'}</li>
          <li>{$locale === 'es' ? 'Generar 3 meses de datos de prueba' : 'Generate 3 months of test data'}</li>
        </ul>
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={() => showTestDataConfirmDialog = false}>{$locale === 'es' ? 'Cancelar' : 'Cancel'}</AlertDialog.Cancel>
      <AlertDialog.Action class="bg-purple-500 text-white hover:bg-purple-600" on:click={handleActivateTestData}>{$locale === 'es' ? 'Activar' : 'Activate'}</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<!-- Restore Real Data Dialog -->
<AlertDialog.Root bind:open={showRestoreConfirmDialog}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title class="flex items-center gap-2">
        <RotateCcw size={20} class="text-green-500" />
        {$locale === 'es' ? '¿Restaurar Datos Reales?' : 'Restore Real Data?'}
      </AlertDialog.Title>
      <AlertDialog.Description>
        {$locale === 'es' 
          ? 'Eliminará los datos de prueba y restaurará tus datos reales.'
          : 'Will delete test data and restore your real data.'}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={() => showRestoreConfirmDialog = false}>{$locale === 'es' ? 'Cancelar' : 'Cancel'}</AlertDialog.Cancel>
      <AlertDialog.Action class="bg-green-500 text-white hover:bg-green-600" on:click={handleRestoreRealData}>{$locale === 'es' ? 'Restaurar' : 'Restore'}</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<!-- Backup Password Dialog -->
<AlertDialog.Root bind:open={showBackupPasswordDialog}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title class="flex items-center gap-2">
        <Lock size={20} class="text-primary" />
        {$locale === 'es' ? 'Contraseña' : 'Password'}
      </AlertDialog.Title>
      <AlertDialog.Description>
        <div class="space-y-3">
          <p>{$locale === 'es' ? 'Ingresa una contraseña para proteger tu respaldo.' : 'Enter a password to protect your backup.'}</p>
          <Input type="password" bind:value={backupPassword} placeholder={$locale === 'es' ? 'Contraseña...' : 'Password...'} class="bg-input/50" />
          <p class="text-xs text-yellow-600 flex items-center gap-1">
            <AlertTriangle size={12} />
            {$locale === 'es' ? 'No hay recuperación si la olvidas.' : 'No recovery if you forget it.'}
          </p>
        </div>
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={() => { showBackupPasswordDialog = false; backupPassword = ''; }}>{$locale === 'es' ? 'Cancelar' : 'Cancel'}</AlertDialog.Cancel>
      <AlertDialog.Action class="bg-primary text-primary-foreground" on:click={executeBackup} disabled={!backupPassword}>{$locale === 'es' ? 'Crear Respaldo' : 'Create Backup'}</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<!-- Restore Dialog -->
<AlertDialog.Root bind:open={showRestoreDialog}>
  <AlertDialog.Content class="max-w-lg">
    <AlertDialog.Header>
      <AlertDialog.Title class="flex items-center gap-2">
        <Upload size={20} class="text-blue-500" />
        {$locale === 'es' ? 'Restaurar Respaldo' : 'Restore Backup'}
      </AlertDialog.Title>
      <AlertDialog.Description>
        {#if validationResult}
          <div class="space-y-4">
            <div class="p-3 rounded-lg {validationResult.valid ? 'bg-green-500/10 border border-green-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'}">
              <div class="flex items-center gap-2">
                {#if validationResult.valid}
                  <FileCheck size={16} class="text-green-500" />
                  <span class="font-medium text-green-600">{$locale === 'es' ? 'Archivo válido' : 'Valid file'}</span>
                {:else}
                  <FileWarning size={16} class="text-yellow-500" />
                  <span class="font-medium text-yellow-600">{$locale === 'es' ? 'Advertencias' : 'Warnings'}</span>
                {/if}
                {#if validationResult.encrypted}
                  <span class="text-xs bg-yellow-500/20 text-yellow-600 px-1.5 py-0.5 rounded flex items-center gap-1 ml-auto">
                    <Lock size={10} /> {$locale === 'es' ? 'Encriptado' : 'Encrypted'}
                  </span>
                {/if}
              </div>
            </div>

            {#if validationResult.encrypted}
              <div class="space-y-2">
                <Label>{$locale === 'es' ? 'Contraseña' : 'Password'}</Label>
                <Input type="password" bind:value={restorePassword} class="bg-input/50" />
              </div>
            {/if}

            <div class="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p class="text-sm text-red-600 flex items-start gap-2">
                <AlertTriangle size={16} class="flex-shrink-0 mt-0.5" />
                {$locale === 'es' ? 'Sobrescribirá todos tus datos actuales.' : 'Will overwrite all your current data.'}
              </p>
            </div>

            {#if isRestoring}
              <div class="p-3 bg-blue-500/10 rounded-lg">
                <div class="flex items-center gap-2 mb-2">
                  <RefreshCw size={16} class="animate-spin text-blue-500" />
                  <span class="text-sm">{backupProgress.stage}</span>
                </div>
                <div class="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div class="h-full bg-blue-500 transition-all" style="width: {backupProgress.percent}%"></div>
                </div>
              </div>
            {/if}

            {#if restoreResult}
              <div class="p-3 rounded-lg {restoreResult.success ? 'bg-green-500/10' : 'bg-red-500/10'}">
                {#if restoreResult.success}
                  <div class="flex items-center gap-2">
                    <Check size={16} class="text-green-500" />
                    <span class="text-green-600">{$locale === 'es' ? '¡Restaurado!' : 'Restored!'}</span>
                  </div>
                {:else}
                  <div class="flex items-center gap-2">
                    <AlertTriangle size={16} class="text-red-500" />
                    <span class="text-red-600">{restoreResult.error}</span>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={cancelRestore} disabled={isRestoring}>{$locale === 'es' ? 'Cancelar' : 'Cancel'}</AlertDialog.Cancel>
      <AlertDialog.Action 
        class="bg-blue-500 text-white hover:bg-blue-600" 
        on:click={executeRestore}
        disabled={isRestoring || (validationResult?.encrypted && !restorePassword) || restoreResult?.success}
      >
        {$locale === 'es' ? 'Restaurar' : 'Restore'}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
