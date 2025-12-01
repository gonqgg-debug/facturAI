<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import { apiKey, locale, weatherApiKey, storeLocation } from '$lib/stores';
  import { db } from '$lib/db';
  import { currentUser, userPermissions } from '$lib/auth';
  import { Save, Download, Upload, Trash2, AlertTriangle, Eye, EyeOff, Plus, Building2, CreditCard, X, Check, Edit2, Star, Languages, Users, Shield, UserPlus, CloudRain, MapPin, RefreshCw, FlaskConical, Database, RotateCcw, Lock, Unlock, FileCheck, Clock, HardDrive, ShieldCheck, FileWarning } from 'lucide-svelte';
  import { isTestMode, hasBackup, getBackupInfo, activateTestData, deactivateTestData, type SeedProgress, type SeedResult } from '$lib/seed-test-data';
  import type { BankAccount, User, Role } from '$lib/types';
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
  
  // Users & Roles
  let users: User[] = [];
  let roles: Role[] = [];
  let showUserModal = false;
  let editingUser: User | null = null;
  let userForm: Partial<User> = getEmptyUserForm();
  let deleteUserDialogOpen = false;
  let userToDelete: User | null = null;
  let userFormError = '';

  // Weather Integration
  let weatherKeyInput = '';
  let weatherLocationInput = '';
  let showWeatherKey = false;
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

  function getEmptyUserForm(): Partial<User> {
    return {
      username: '',
      displayName: '',
      pin: '',
      roleId: 0,
      email: '',
      phone: '',
      isActive: true
    };
  }

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
    // API keys are now server-side, only load location
    weatherLocationInput = get(storeLocation);
    await loadBankAccounts();
    
    // Ensure database defaults are initialized
    await db.initializeDefaults();
    
    await loadUsersAndRoles();

    // Check test data mode status
    testModeActive = isTestMode();
    backupAvailable = hasBackup();
    backupInfo = getBackupInfo();

    // Initialize auto-backup system
    autoBackupInfo = getAutoBackupInfo();
    if (autoBackupEnabled) {
      startScheduledBackups(4); // Every 4 hours
    }
  });

  onDestroy(() => {
    stopScheduledBackups();
  });

  async function loadBankAccounts() {
    bankAccounts = await db.bankAccounts.toArray();
  }
  
  async function loadUsersAndRoles() {
    users = await db.users.toArray();
    roles = await db.roles.toArray();
    
    // Populate role names for users
    users = users.map(u => {
      const role = roles.find(r => r.id === u.roleId);
      return { ...u, roleName: role?.name };
    });
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
  
  // User Management Functions
  function openAddUserModal() {
    editingUser = null;
    userForm = getEmptyUserForm();
    // Set default role to Cajero
    const cashierRole = roles.find(r => r.name === 'Cajero');
    if (cashierRole?.id) {
      userForm.roleId = cashierRole.id;
    }
    userFormError = '';
    showUserModal = true;
  }
  
  function openEditUserModal(user: User) {
    editingUser = user;
    userForm = { ...user };
    userFormError = '';
    showUserModal = true;
  }
  
  function closeUserModal() {
    showUserModal = false;
    editingUser = null;
    userForm = getEmptyUserForm();
    userFormError = '';
  }
  
  async function saveUser() {
    userFormError = '';
    
    // Validation
    if (!userForm.username?.trim()) {
      userFormError = $locale === 'es' ? 'El nombre de usuario es requerido' : 'Username is required';
      return;
    }
    if (!userForm.displayName?.trim()) {
      userFormError = $locale === 'es' ? 'El nombre para mostrar es requerido' : 'Display name is required';
      return;
    }
    if (!userForm.pin || userForm.pin.length < 4) {
      userFormError = $locale === 'es' ? 'El PIN debe tener al menos 4 dígitos' : 'PIN must be at least 4 digits';
      return;
    }
    if (!userForm.roleId) {
      userFormError = $locale === 'es' ? 'Debe seleccionar un rol' : 'Must select a role';
      return;
    }
    
    // Check PIN uniqueness
    const existingUser = await db.users.where('pin').equals(userForm.pin).first();
    if (existingUser && existingUser.id !== editingUser?.id) {
      userFormError = t('users.pinInUse', $locale);
      return;
    }
    
    try {
      const role = roles.find(r => r.id === userForm.roleId);
      
      const userData: User = {
        username: userForm.username!.trim(),
        displayName: userForm.displayName!.trim(),
        pin: userForm.pin!,
        roleId: userForm.roleId!,
        roleName: role?.name,
        email: userForm.email?.trim() || undefined,
        phone: userForm.phone?.trim() || undefined,
        isActive: userForm.isActive ?? true,
        createdAt: editingUser?.createdAt || new Date(),
        createdBy: editingUser?.createdBy || $currentUser?.id
      };
      
      if (editingUser?.id) {
        await db.users.update(editingUser.id, userData);
      } else {
        await db.users.add(userData);
      }
      
      await loadUsersAndRoles();
      closeUserModal();
    } catch (e) {
      console.error('Error saving user:', e);
      userFormError = $locale === 'es' ? 'Error al guardar usuario' : 'Error saving user';
    }
  }
  
  function confirmDeleteUser(user: User) {
    if (!user.id) return;
    // Prevent deleting self
    if (user.id === $currentUser?.id) {
      alert(t('users.cannotDeleteSelf', $locale));
      return;
    }
    userToDelete = user;
    deleteUserDialogOpen = true;
  }
  
  async function executeDeleteUser() {
    if (!userToDelete?.id) return;
    
    try {
      await db.users.delete(userToDelete.id);
      deleteUserDialogOpen = false;
      userToDelete = null;
      await loadUsersAndRoles();
      closeUserModal();
    } catch (e) {
      console.error('Error deleting user:', e);
      alert($locale === 'es' ? 'Error al eliminar usuario' : 'Error deleting user');
    }
  }
  
  function getUserInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  function getUserColor(id: number | undefined): string {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
      'bg-pink-500', 'bg-cyan-500', 'bg-yellow-500', 'bg-red-500'
    ];
    return colors[(id ?? 0) % colors.length];
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

  function saveWeatherSettings() {
    isSavingWeather = true;
    // Weather API key is now server-side, only save location
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
        
        // Show success and reload after a short delay
        setTimeout(() => {
          window.location.reload();
        }, 2000);
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
        duration: 0,
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
        
        // Reload to show real data
        setTimeout(() => {
          window.location.reload();
        }, 1500);
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

  // Enhanced backup with encryption support
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
        onProgress: (progress) => {
          backupProgress = progress;
        }
      });
      
      backupResult = result;
      
      if (result.success) {
        // Update auto-backup info
        autoBackupInfo = getAutoBackupInfo();
      }
    } catch (error) {
      backupResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      isBackingUp = false;
      backupPassword = '';
    }
  }

  // Enhanced restore with validation
  async function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    
    selectedBackupFile = input.files[0];
    isValidating = true;
    validationResult = null;
    
    try {
      const result = await validateBackup(selectedBackupFile);
      validationResult = result;
      
      if (result.encrypted) {
        // Will need password
        showRestoreDialog = true;
      } else if (result.valid) {
        showRestoreDialog = true;
      }
    } catch (error) {
      validationResult = {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        warnings: []
      };
    } finally {
      isValidating = false;
      // Reset file input
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
        onProgress: (progress) => {
          backupProgress = progress;
        }
      });
      
      restoreResult = result;
      
      if (result.success) {
        showRestoreDialog = false;
        // Reload to show restored data
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      restoreResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
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
</script>

<div class="p-4 max-w-2xl mx-auto pb-24">
  <h1 class="text-2xl font-bold mb-6">{$locale === 'es' ? 'Configuración' : 'Settings'}</h1>

  <!-- Language Section -->
  <div class="bg-card text-card-foreground border border-border rounded-xl p-4 mb-6">
    <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
      <Languages size={18} />
      {$locale === 'es' ? 'Idioma' : 'Language'}
    </h2>
    <div class="space-y-4">
      <div class="space-y-2">
        <Label for="language-select">{$locale === 'es' ? 'Seleccionar idioma' : 'Select Language'}</Label>
        <Select.Root 
          selected={{ 
            value: $locale, 
            label: $locale === 'es' ? 'Español' : 'English' 
          }}
          onSelectedChange={(v) => { 
            if (v?.value) {
              locale.set(v.value);
            }
          }}
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
  </div>

  <!-- API Key Section -->
  <div class="bg-card text-card-foreground border border-border rounded-xl p-4 mb-6">
    <h2 class="text-lg font-semibold mb-4">{$locale === 'es' ? 'Configuración de IA' : 'AI Configuration'}</h2>
    <div class="space-y-4">
      <div class="space-y-2">
        <Label>{$locale === 'es' ? 'Clave API xAI' : 'xAI API Key'}</Label>
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
                ? 'La clave API está configurada de forma segura en el servidor mediante variables de entorno. No se requiere configuración adicional.'
                : 'API key is securely configured on the server via environment variables. No additional setup required.'}
            </p>
          </div>
        </div>
        <p class="text-xs text-muted-foreground mt-2">
          {$locale === 'es' ? 'Requerida para extracción de facturas. Obtén una en' : 'Required for invoice extraction. Get one at'} <a href="https://console.x.ai" target="_blank" class="text-primary hover:underline">console.x.ai</a>.
        </p>
      </div>
    </div>
  </div>

  <!-- Weather Integration Section -->
  <div class="bg-card text-card-foreground border border-border rounded-xl p-4 mb-6">
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
      <!-- Weather API Key Info -->
      <div class="space-y-2">
        <Label>{$locale === 'es' ? 'Clave API de OpenWeatherMap' : 'OpenWeatherMap API Key'}</Label>
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
        <p class="text-xs text-muted-foreground">
          {$locale === 'es' ? 'Obtén una clave gratuita en' : 'Get a free key at'} <a href="https://openweathermap.org/api" target="_blank" class="text-primary hover:underline">openweathermap.org</a>
        </p>
      </div>

      <!-- Store Location -->
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
        <p class="text-xs text-muted-foreground">
          {$locale === 'es' ? 'Nombre de la ciudad para obtener datos del clima' : 'City name to fetch weather data'}
        </p>
      </div>

      <!-- Action Buttons -->
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
          {$locale === 'es' ? 'Probar Conexión' : 'Test Connection'}
        </button>
        <button 
          on:click={saveWeatherSettings}
          disabled={isSavingWeather}
          class="bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
        >
          <Save size={16} />
          {isSavingWeather ? ($locale === 'es' ? 'Guardando...' : 'Saving...') : ($locale === 'es' ? 'Guardar' : 'Save')}
        </button>
      </div>

      <!-- Test Result -->
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
          {$locale === 'es' ? 'Configuración guardada exitosamente.' : 'Settings saved successfully.'}
        </p>
      {/if}
    </div>
  </div>

  <!-- Bank Accounts Section -->
  <div class="bg-card text-card-foreground border border-border rounded-xl p-4 mb-6">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-lg font-semibold">{$locale === 'es' ? 'Cuentas Bancarias' : 'Bank Accounts'}</h2>
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

  <!-- Users Management Section -->
  <!-- Show if user has permission OR if no currentUser (initial setup / legacy mode) -->
  {#if $userPermissions.has('users.manage') || !$currentUser}
    <div class="bg-card text-card-foreground border border-border rounded-xl p-4 mb-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-lg font-semibold flex items-center gap-2">
            <Users size={18} />
            {t('users.title', $locale)}
          </h2>
          <p class="text-xs text-muted-foreground">{$locale === 'es' ? 'Gestionar usuarios y permisos' : 'Manage users and permissions'}</p>
        </div>
        <button 
          on:click={openAddUserModal}
          class="bg-primary hover:bg-primary/90 text-primary-foreground px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-1 transition-colors"
        >
          <UserPlus size={16} />
          {t('users.addUser', $locale)}
        </button>
      </div>

      <div class="space-y-2">
        {#each users as user}
          <div class="flex items-center justify-between p-3 bg-muted/30 rounded-lg group border border-border/50 {!user.isActive ? 'opacity-60' : ''}">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 {getUserColor(user.id)} rounded-full flex items-center justify-center text-white font-bold text-sm">
                {getUserInitials(user.displayName)}
              </div>
              <div>
                <div class="font-medium flex items-center gap-2">
                  {user.displayName}
                  {#if user.id === $currentUser?.id}
                    <span class="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                      {$locale === 'es' ? 'Tú' : 'You'}
                    </span>
                  {/if}
                  {#if !user.isActive}
                    <span class="text-xs bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded">
                      {t('users.inactive', $locale)}
                    </span>
                  {/if}
                </div>
                <div class="text-xs text-muted-foreground flex items-center gap-2">
                  <span class="font-mono">@{user.username}</span>
                  <span>·</span>
                  <span class="flex items-center gap-1">
                    <Shield size={10} />
                    {user.roleName}
                  </span>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                on:click={() => openEditUserModal(user)}
                class="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <Edit2 size={16} />
              </button>
            </div>
          </div>
        {/each}

        {#if users.length === 0}
          <div class="text-center py-6 text-muted-foreground">
            <Users size={32} class="mx-auto mb-2 opacity-50" />
            <p class="text-sm">{t('users.noUsers', $locale)}</p>
            <button 
              on:click={openAddUserModal}
              class="text-primary hover:underline text-sm mt-2"
            >
              {t('users.addUser', $locale)}
            </button>
          </div>
        {/if}
      </div>
      
      <!-- Available Roles -->
      <div class="mt-4 pt-4 border-t border-border">
        <h3 class="text-sm font-semibold mb-3 flex items-center gap-2">
          <Shield size={14} />
          {t('users.roles', $locale)}
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {#each roles as role}
            <div class="p-3 bg-muted/30 rounded-lg border border-border/50">
              <div class="font-medium text-sm flex items-center gap-2">
                {role.name}
                {#if role.isSystem}
                  <span class="text-[10px] bg-blue-500/20 text-blue-500 px-1 py-0.5 rounded">
                    {t('users.systemRole', $locale)}
                  </span>
                {/if}
              </div>
              {#if role.description}
                <div class="text-xs text-muted-foreground mt-1">{role.description}</div>
              {/if}
              <div class="text-xs text-muted-foreground mt-1">
                {role.permissions.length} {$locale === 'es' ? 'permisos' : 'permissions'}
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}

  <!-- Data Management Section (Enhanced) -->
  <div class="bg-card text-card-foreground border border-border rounded-xl p-4 mb-6">
    <h2 class="text-lg font-semibold mb-2 flex items-center gap-2">
      <HardDrive size={18} />
      {$locale === 'es' ? 'Gestión de Datos' : 'Data Management'}
    </h2>
    <p class="text-xs text-muted-foreground mb-4">
      {$locale === 'es' 
        ? 'Respalda y restaura todos tus datos con encriptación opcional.'
        : 'Backup and restore all your data with optional encryption.'}
    </p>

    <div class="space-y-4">
      
      <!-- Full Backup -->
      <div class="p-4 bg-muted/30 rounded-lg border border-border/50">
        <div class="flex items-center justify-between mb-3">
          <div>
            <div class="font-medium flex items-center gap-2">
              <Download size={16} class="text-primary" />
              {$locale === 'es' ? 'Respaldo Completo' : 'Full Backup'}
            </div>
            <div class="text-xs text-muted-foreground">
              {$locale === 'es' 
                ? 'Exporta todas las 20 tablas con verificación de integridad.'
                : 'Export all 20 tables with integrity verification.'}
            </div>
          </div>
        </div>
        
        <!-- Encryption Toggle -->
        <div class="flex items-center gap-4 mb-3 p-2 bg-background/50 rounded-lg">
          <div class="flex items-center gap-2">
            <Switch bind:checked={encryptBackup} id="encrypt-backup-switch" />
            <Label for="encrypt-backup-switch" class="text-sm cursor-pointer flex items-center gap-1">
              {#if encryptBackup}
                <Lock size={14} class="text-green-500" />
              {:else}
                <Unlock size={14} class="text-muted-foreground" />
              {/if}
              {$locale === 'es' ? 'Encriptar respaldo' : 'Encrypt backup'}
            </Label>
          </div>
          {#if encryptBackup}
            <span class="text-xs text-green-600 dark:text-green-400">
              {$locale === 'es' ? 'AES-256-GCM' : 'AES-256-GCM'}
            </span>
          {/if}
        </div>
        
        <!-- Backup Progress -->
        {#if isBackingUp}
          <div class="mb-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
            <div class="flex items-center gap-2 mb-2">
              <RefreshCw size={16} class="animate-spin text-primary" />
              <span class="text-sm font-medium">{backupProgress.stage}</span>
              {#if backupProgress.currentTable}
                <span class="text-xs text-muted-foreground">({backupProgress.currentTable})</span>
              {/if}
            </div>
            <div class="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div 
                class="h-full bg-primary transition-all duration-300"
                style="width: {backupProgress.percent}%"
              ></div>
            </div>
          </div>
        {/if}
        
        <!-- Backup Result -->
        {#if backupResult}
          <div class="mb-3 p-3 rounded-lg {backupResult.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}">
            <div class="flex items-center gap-2">
              {#if backupResult.success}
                <Check size={16} class="text-green-500" />
                <span class="text-sm font-medium text-green-600 dark:text-green-400">
                  {$locale === 'es' ? '¡Respaldo creado!' : 'Backup created!'}
                </span>
              {:else}
                <AlertTriangle size={16} class="text-red-500" />
                <span class="text-sm font-medium text-red-600 dark:text-red-400">
                  {backupResult.error}
                </span>
              {/if}
            </div>
            {#if backupResult.success}
              <div class="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                <span>📁 {backupResult.filename}</span>
                <span>📊 {backupResult.recordCount?.toLocaleString()} {$locale === 'es' ? 'registros' : 'records'}</span>
                <span>💾 {((backupResult.size || 0) / 1024).toFixed(1)} KB</span>
              </div>
            {/if}
          </div>
        {/if}
        
        <button 
          on:click={handleBackup}
          disabled={isBackingUp}
          class="w-full bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
        >
          {#if isBackingUp}
            <RefreshCw size={16} class="animate-spin" />
            {$locale === 'es' ? 'Creando respaldo...' : 'Creating backup...'}
          {:else}
            <Download size={16} />
            {$locale === 'es' ? 'Descargar Respaldo' : 'Download Backup'}
          {/if}
        </button>
      </div>

      <!-- Restore -->
      <div class="p-4 bg-muted/30 rounded-lg border border-border/50">
        <div class="flex items-center justify-between mb-3">
          <div>
            <div class="font-medium flex items-center gap-2">
              <Upload size={16} class="text-blue-500" />
              {$locale === 'es' ? 'Restaurar Datos' : 'Restore Data'}
            </div>
            <div class="text-xs text-muted-foreground">
              {$locale === 'es' 
                ? 'Restaura desde un archivo de respaldo (validación automática).'
                : 'Restore from a backup file (automatic validation).'}
            </div>
          </div>
        </div>
        
        <!-- Validation Progress -->
        {#if isValidating}
          <div class="mb-3 p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div class="flex items-center gap-2">
              <RefreshCw size={16} class="animate-spin text-blue-500" />
              <span class="text-sm">{$locale === 'es' ? 'Validando archivo...' : 'Validating file...'}</span>
            </div>
          </div>
        {/if}
        
        <!-- Validation Result (inline for quick feedback) -->
        {#if validationResult && !showRestoreDialog}
          <div class="mb-3 p-3 rounded-lg {validationResult.valid ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}">
            <div class="flex items-center gap-2 mb-1">
              {#if validationResult.valid}
                <FileCheck size={16} class="text-green-500" />
                <span class="text-sm font-medium text-green-600 dark:text-green-400">
                  {$locale === 'es' ? 'Archivo válido' : 'Valid file'}
                </span>
              {:else}
                <FileWarning size={16} class="text-red-500" />
                <span class="text-sm font-medium text-red-600 dark:text-red-400">
                  {$locale === 'es' ? 'Archivo inválido' : 'Invalid file'}
                </span>
              {/if}
              {#if validationResult.encrypted}
                <span class="text-xs bg-yellow-500/20 text-yellow-600 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Lock size={10} /> {$locale === 'es' ? 'Encriptado' : 'Encrypted'}
                </span>
              {/if}
            </div>
            {#if validationResult.errors.length > 0}
              <ul class="text-xs text-red-500 list-disc list-inside">
                {#each validationResult.errors as error}
                  <li>{error}</li>
                {/each}
              </ul>
            {/if}
          </div>
        {/if}
        
        <label class="w-full bg-muted hover:bg-muted/80 text-foreground px-4 py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer {isValidating ? 'opacity-50 cursor-not-allowed' : ''}">
          <Upload size={16} />
          {$locale === 'es' ? 'Seleccionar Archivo' : 'Select File'}
          <input 
            type="file" 
            accept=".json" 
            on:change={handleFileSelect} 
            class="hidden"
            disabled={isValidating}
          />
        </label>
      </div>

      <!-- Auto-Backup Status -->
      <div class="p-4 bg-muted/30 rounded-lg border border-border/50">
        <div class="flex items-center justify-between mb-2">
          <div class="font-medium flex items-center gap-2">
            <Clock size={16} class="text-purple-500" />
            {$locale === 'es' ? 'Auto-Respaldo Local' : 'Local Auto-Backup'}
          </div>
          <Switch 
            bind:checked={autoBackupEnabled} 
            on:change={() => {
              if (autoBackupEnabled) {
                startScheduledBackups(4);
              } else {
                stopScheduledBackups();
              }
            }}
          />
        </div>
        <p class="text-xs text-muted-foreground mb-2">
          {$locale === 'es' 
            ? 'Guarda tablas críticas en localStorage cada 4 horas (para recuperación de emergencia).'
            : 'Saves critical tables to localStorage every 4 hours (for emergency recovery).'}
        </p>
        {#if autoBackupInfo}
          <div class="flex items-center gap-2 text-xs">
            <span class="text-green-500 flex items-center gap-1">
              <ShieldCheck size={12} />
              {$locale === 'es' ? 'Último respaldo:' : 'Last backup:'}
            </span>
            <span class="text-muted-foreground">
              {new Date(autoBackupInfo.timestamp).toLocaleString()}
            </span>
            <span class="text-muted-foreground">
              ({(autoBackupInfo.size / 1024).toFixed(1)} KB)
            </span>
          </div>
        {:else}
          <div class="text-xs text-muted-foreground">
            {$locale === 'es' ? 'Sin respaldo automático aún' : 'No auto-backup yet'}
          </div>
        {/if}
        <button
          on:click={triggerManualAutoBackup}
          class="mt-2 text-xs text-primary hover:underline flex items-center gap-1"
        >
          <RefreshCw size={12} />
          {$locale === 'es' ? 'Crear respaldo ahora' : 'Create backup now'}
        </button>
      </div>

      <!-- Reset -->
      <div class="flex items-center justify-between p-3 bg-red-500/10 rounded-lg border border-red-500/20">
        <div>
          <div class="text-red-500 font-medium">{$locale === 'es' ? 'Restablecer de Fábrica' : 'Factory Reset'}</div>
          <div class="text-xs text-red-400/70">{$locale === 'es' ? 'Eliminar todos los datos y restablecer la aplicación.' : 'Delete all data and reset the app.'}</div>
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

  <!-- Test Data Mode Section -->
  <div class="bg-card text-card-foreground border border-border rounded-xl p-4 mb-6">
    <h2 class="text-lg font-semibold mb-2 flex items-center gap-2">
      <FlaskConical size={18} class="text-purple-500" />
      {$locale === 'es' ? 'Modo de Datos de Prueba' : 'Test Data Mode'}
    </h2>
    <p class="text-xs text-muted-foreground mb-4">
      {$locale === 'es' 
        ? 'Genera datos de prueba realistas para explorar la aplicación sin afectar tus datos reales.'
        : 'Generate realistic test data to explore the app without affecting your real data.'}
    </p>

    <!-- Current Mode Status -->
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
            {$locale === 'es' ? 'Usando Datos Reales' : 'Using Real Data'}
          </span>
        {/if}
      </div>
      {#if testModeActive && backupInfo}
        <p class="text-xs text-muted-foreground mt-1">
          {$locale === 'es' ? 'Respaldo creado:' : 'Backup created:'} {new Date(backupInfo.date).toLocaleString()}
        </p>
      {/if}
    </div>

    <!-- Progress indicator -->
    {#if isSeedingData}
      <div class="mb-4 p-4 bg-muted/30 rounded-lg border border-border/50">
        <div class="flex items-center gap-2 mb-2">
          <RefreshCw size={16} class="animate-spin text-primary" />
          <span class="text-sm font-medium">{seedProgress.stage}</span>
        </div>
        <div class="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div 
            class="h-full bg-primary transition-all duration-300"
            style="width: {seedProgress.percent}%"
          ></div>
        </div>
        <p class="text-xs text-muted-foreground mt-1">{seedProgress.percent}%</p>
      </div>
    {/if}

    <!-- Success Result -->
    {#if seedResult?.success}
      <div class="mb-4 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
        <div class="flex items-center gap-2 mb-2">
          <Check size={16} class="text-green-500" />
          <span class="font-medium text-green-600 dark:text-green-400">
            {$locale === 'es' ? '¡Datos de prueba creados!' : 'Test data created!'}
          </span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs text-muted-foreground">
          <div>📦 {seedResult.products} {$locale === 'es' ? 'productos' : 'products'}</div>
          <div>🏭 {seedResult.suppliers} {$locale === 'es' ? 'proveedores' : 'suppliers'}</div>
          <div>👥 {seedResult.customers} {$locale === 'es' ? 'clientes' : 'customers'}</div>
          <div>🛒 {seedResult.sales} {$locale === 'es' ? 'ventas' : 'sales'}</div>
          <div>📄 {seedResult.invoices} {$locale === 'es' ? 'facturas' : 'invoices'}</div>
        </div>
        <p class="text-xs text-muted-foreground mt-2">
          {$locale === 'es' ? 'Recargando página...' : 'Reloading page...'}
        </p>
      </div>
    {/if}

    <!-- Action Buttons -->
    <div class="space-y-3">
      {#if !testModeActive}
        <!-- Activate Test Data -->
        <div class="flex items-center justify-between p-3 bg-purple-500/10 rounded-lg border border-purple-500/20">
          <div>
            <div class="font-medium text-purple-600 dark:text-purple-400 flex items-center gap-2">
              <FlaskConical size={16} />
              {$locale === 'es' ? 'Activar Datos de Prueba' : 'Activate Test Data'}
            </div>
            <div class="text-xs text-muted-foreground">
              {$locale === 'es' 
                ? 'Genera 3 meses de datos simulados (desde hace 3 meses hasta hoy). Tus datos reales se respaldarán automáticamente.'
                : 'Generate 3 months of simulated data (from 3 months ago to today). Your real data will be backed up automatically.'}
            </div>
          </div>
          <button 
            on:click={confirmActivateTestData}
            disabled={isSeedingData}
            class="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FlaskConical size={16} />
            {$locale === 'es' ? 'Activar' : 'Activate'}
          </button>
        </div>
      {:else}
        <!-- Restore Real Data -->
        <div class="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/20">
          <div>
            <div class="font-medium text-green-600 dark:text-green-400 flex items-center gap-2">
              <RotateCcw size={16} />
              {$locale === 'es' ? 'Restaurar Datos Reales' : 'Restore Real Data'}
            </div>
            <div class="text-xs text-muted-foreground">
              {$locale === 'es' 
                ? 'Elimina los datos de prueba y restaura tus datos reales desde el respaldo.'
                : 'Clear test data and restore your real data from backup.'}
            </div>
          </div>
          <button 
            on:click={confirmRestoreRealData}
            disabled={isSeedingData || !backupAvailable}
            class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RotateCcw size={16} />
            {$locale === 'es' ? 'Restaurar' : 'Restore'}
          </button>
        </div>
      {/if}
    </div>

    <p class="text-xs text-muted-foreground mt-4 flex items-center gap-1">
      <AlertTriangle size={12} />
      {$locale === 'es' 
        ? 'Tip: Se descargará automáticamente una copia de seguridad de tus datos reales.'
        : 'Tip: A backup file of your real data will be automatically downloaded.'}
    </p>
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
          {editingBank ? ($locale === 'es' ? 'Editar Cuenta' : 'Edit Account') : ($locale === 'es' ? 'Nueva Cuenta Bancaria' : 'New Bank Account')}
        </h3>
        <button on:click={closeBankModal} class="text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg">
          <X size={20} />
        </button>
      </div>

      <div class="p-4 space-y-4">
        <div class="space-y-1.5">
          <Label for="bank-name">{$locale === 'es' ? 'Nombre del Banco' : 'Bank Name'} *</Label>
          <Input 
            id="bank-name"
            bind:value={bankForm.bankName}
            placeholder="e.g., Banco Popular, BHD León"
            class="bg-input/50"
          />
        </div>

        <div class="space-y-1.5">
          <Label for="account-name">{$locale === 'es' ? 'Nombre de la Cuenta' : 'Account Name'} *</Label>
          <Input 
            id="account-name"
            bind:value={bankForm.accountName}
            placeholder="e.g., Business Checking"
            class="bg-input/50"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <Label for="account-number">{$locale === 'es' ? 'Número de Cuenta' : 'Account Number'}</Label>
            <Input 
              id="account-number"
              bind:value={bankForm.accountNumber}
              placeholder="Last 4 digits"
              class="bg-input/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="currency">{$locale === 'es' ? 'Moneda' : 'Currency'}</Label>
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
          <Label for="account-type">{$locale === 'es' ? 'Tipo de Cuenta' : 'Account Type'}</Label>
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
          <Label>{$locale === 'es' ? 'Color' : 'Color'}</Label>
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
          <Label for="bank-notes">{$locale === 'es' ? 'Notas' : 'Notes'}</Label>
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
            <Label for="default-account-switch" class="text-sm cursor-pointer">{$locale === 'es' ? 'Cuenta por defecto' : 'Default account'}</Label>
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

<!-- Delete Bank Account Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteBankDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{$locale === 'es' ? 'Eliminar Cuenta Bancaria' : 'Delete Bank Account'}</AlertDialog.Title>
      <AlertDialog.Description>
        {$locale === 'es' 
          ? `¿Eliminar la cuenta "${bankToDelete?.accountName}" de ${bankToDelete?.bankName}? Esta acción no se puede deshacer.`
          : `Delete the account "${bankToDelete?.accountName}" from ${bankToDelete?.bankName}? This action cannot be undone.`}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={() => { deleteBankDialogOpen = false; bankToDelete = null; }}>{$locale === 'es' ? 'Cancelar' : 'Cancel'}</AlertDialog.Cancel>
      <AlertDialog.Action class="bg-destructive text-destructive-foreground hover:bg-destructive/90" on:click={executeDeleteBankAccount}>{$locale === 'es' ? 'Eliminar' : 'Delete'}</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<!-- User Modal -->
{#if showUserModal}
  <div class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" on:click|self={closeUserModal}>
    <div class="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden text-card-foreground">
      <div class="p-4 border-b border-border flex justify-between items-center">
        <h3 class="font-bold text-lg flex items-center gap-2">
          <Users size={20} />
          {editingUser ? t('users.editUser', $locale) : t('users.addUser', $locale)}
        </h3>
        <button on:click={closeUserModal} class="text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg">
          <X size={20} />
        </button>
      </div>

      <div class="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        {#if userFormError}
          <div class="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2">
            <AlertTriangle size={16} />
            {userFormError}
          </div>
        {/if}
        
        <div class="space-y-1.5">
          <Label for="user-username">{t('users.username', $locale)} *</Label>
          <Input 
            id="user-username"
            bind:value={userForm.username}
            placeholder="e.g., jdoe"
            class="bg-input/50"
          />
        </div>
        
        <div class="space-y-1.5">
          <Label for="user-displayname">{t('users.displayName', $locale)} *</Label>
          <Input 
            id="user-displayname"
            bind:value={userForm.displayName}
            placeholder="e.g., John Doe"
            class="bg-input/50"
          />
        </div>

        <div class="space-y-1.5">
          <Label for="user-pin">{t('users.pin', $locale)} *</Label>
          <Input 
            id="user-pin"
            type="password"
            bind:value={userForm.pin}
            placeholder={t('users.pinPlaceholder', $locale)}
            class="bg-input/50 tracking-widest font-mono"
            maxlength="6"
            inputmode="numeric"
          />
          <p class="text-xs text-muted-foreground">{$locale === 'es' ? 'PIN único de 4-6 dígitos para acceder al sistema' : 'Unique 4-6 digit PIN for system access'}</p>
        </div>

        <div class="space-y-1.5">
          <Label for="user-role">{t('users.role', $locale)} *</Label>
          <Select.Root 
            selected={roles.find(r => r.id === userForm.roleId) ? { value: String(userForm.roleId), label: roles.find(r => r.id === userForm.roleId)?.name || '' } : undefined}
            onSelectedChange={(v) => { if (v?.value) userForm.roleId = Number(v.value); }}
          >
            <Select.Trigger class="w-full bg-input/50">
              <Select.Value placeholder={$locale === 'es' ? 'Seleccionar rol...' : 'Select role...'} />
            </Select.Trigger>
            <Select.Content>
              {#each roles as role}
                <Select.Item value={String(role.id)} label={role.name}>
                  <div class="flex items-center gap-2">
                    <Shield size={14} />
                    <span>{role.name}</span>
                    {#if role.isSystem}
                      <span class="text-[10px] text-muted-foreground">({t('users.systemRole', $locale)})</span>
                    {/if}
                  </div>
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <Label for="user-email">{t('users.email', $locale)}</Label>
            <Input 
              id="user-email"
              type="email"
              bind:value={userForm.email}
              placeholder="email@example.com"
              class="bg-input/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="user-phone">{t('users.phone', $locale)}</Label>
            <Input 
              id="user-phone"
              type="tel"
              bind:value={userForm.phone}
              placeholder="809-555-1234"
              class="bg-input/50"
            />
          </div>
        </div>

        <div class="flex items-center gap-4 pt-2">
          <div class="flex items-center gap-2">
            <Switch bind:checked={userForm.isActive} id="user-active-switch" />
            <Label for="user-active-switch" class="text-sm cursor-pointer">
              {userForm.isActive ? t('users.active', $locale) : t('users.inactive', $locale)}
            </Label>
          </div>
        </div>
        
        {#if editingUser?.lastLogin}
          <div class="text-xs text-muted-foreground pt-2 border-t border-border">
            {t('users.lastLogin', $locale)}: {new Date(editingUser.lastLogin).toLocaleString()}
          </div>
        {/if}
      </div>

      <div class="p-4 border-t border-border flex gap-3">
        {#if editingUser && editingUser.id !== $currentUser?.id}
          <button 
            on:click={() => editingUser && confirmDeleteUser(editingUser)}
            class="px-4 py-2.5 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
          >
            <Trash2 size={18} />
          </button>
        {/if}
        <div class="flex-1"></div>
        <button 
          on:click={closeUserModal}
          class="px-6 py-2.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          {t('common.cancel', $locale)}
        </button>
        <button 
          on:click={saveUser}
          disabled={!userForm.username?.trim() || !userForm.displayName?.trim() || !userForm.pin || !userForm.roleId}
          class="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-colors"
        >
          <Check size={18} />
          {t('common.save', $locale)}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete User Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteUserDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{t('users.deleteUser', $locale)}</AlertDialog.Title>
      <AlertDialog.Description>
        {t('users.deleteConfirm', $locale).replace('{name}', userToDelete?.displayName || '')}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={() => { deleteUserDialogOpen = false; userToDelete = null; }}>{t('common.cancel', $locale)}</AlertDialog.Cancel>
      <AlertDialog.Action class="bg-destructive text-destructive-foreground hover:bg-destructive/90" on:click={executeDeleteUser}>{t('common.delete', $locale)}</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<!-- Activate Test Data Confirmation Dialog -->
<AlertDialog.Root bind:open={showTestDataConfirmDialog}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title class="flex items-center gap-2">
        <FlaskConical size={20} class="text-purple-500" />
        {$locale === 'es' ? '¿Activar Datos de Prueba?' : 'Activate Test Data?'}
      </AlertDialog.Title>
      <AlertDialog.Description class="space-y-3">
        <p>
          {$locale === 'es' 
            ? 'Esta acción realizará lo siguiente:'
            : 'This action will:'}
        </p>
        <ul class="list-disc list-inside space-y-1 text-sm">
          <li>{$locale === 'es' ? 'Crear un respaldo de tus datos actuales' : 'Create a backup of your current data'}</li>
          <li>{$locale === 'es' ? 'Descargar el respaldo como archivo JSON' : 'Download the backup as a JSON file'}</li>
          <li>{$locale === 'es' ? 'Reemplazar temporalmente con datos de prueba' : 'Temporarily replace with test data'}</li>
          <li>{$locale === 'es' ? 'Generar 3 meses de ventas simuladas (~2,250 transacciones)' : 'Generate 3 months of simulated sales (~2,250 transactions)'}</li>
        </ul>
        <p class="text-sm text-muted-foreground">
          {$locale === 'es' 
            ? 'Podrás restaurar tus datos reales en cualquier momento.'
            : 'You can restore your real data at any time.'}
        </p>
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={() => showTestDataConfirmDialog = false}>
        {$locale === 'es' ? 'Cancelar' : 'Cancel'}
      </AlertDialog.Cancel>
      <AlertDialog.Action class="bg-purple-500 text-white hover:bg-purple-600" on:click={handleActivateTestData}>
        {$locale === 'es' ? 'Activar Datos de Prueba' : 'Activate Test Data'}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<!-- Restore Real Data Confirmation Dialog -->
<AlertDialog.Root bind:open={showRestoreConfirmDialog}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title class="flex items-center gap-2">
        <RotateCcw size={20} class="text-green-500" />
        {$locale === 'es' ? '¿Restaurar Datos Reales?' : 'Restore Real Data?'}
      </AlertDialog.Title>
      <AlertDialog.Description class="space-y-3">
        <p>
          {$locale === 'es' 
            ? 'Esta acción realizará lo siguiente:'
            : 'This action will:'}
        </p>
        <ul class="list-disc list-inside space-y-1 text-sm">
          <li>{$locale === 'es' ? 'Eliminar todos los datos de prueba' : 'Delete all test data'}</li>
          <li>{$locale === 'es' ? 'Restaurar tus datos reales desde el respaldo' : 'Restore your real data from backup'}</li>
          <li>{$locale === 'es' ? 'Desactivar el modo de prueba' : 'Disable test mode'}</li>
        </ul>
        {#if backupInfo}
          <p class="text-sm text-muted-foreground">
            {$locale === 'es' ? 'Respaldo de:' : 'Backup from:'} {new Date(backupInfo.date).toLocaleString()}
          </p>
        {/if}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={() => showRestoreConfirmDialog = false}>
        {$locale === 'es' ? 'Cancelar' : 'Cancel'}
      </AlertDialog.Cancel>
      <AlertDialog.Action class="bg-green-500 text-white hover:bg-green-600" on:click={handleRestoreRealData}>
        {$locale === 'es' ? 'Restaurar Datos Reales' : 'Restore Real Data'}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<!-- Backup Password Dialog -->
<AlertDialog.Root bind:open={showBackupPasswordDialog}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title class="flex items-center gap-2">
        <Lock size={20} class="text-primary" />
        {$locale === 'es' ? 'Contraseña de Encriptación' : 'Encryption Password'}
      </AlertDialog.Title>
      <AlertDialog.Description class="space-y-3">
        <p>
          {$locale === 'es' 
            ? 'Ingresa una contraseña para proteger tu respaldo. Necesitarás esta contraseña para restaurarlo.'
            : 'Enter a password to protect your backup. You will need this password to restore it.'}
        </p>
        <div class="space-y-2">
          <Label for="backup-password">{$locale === 'es' ? 'Contraseña' : 'Password'}</Label>
          <Input 
            id="backup-password"
            type="password" 
            bind:value={backupPassword}
            placeholder={$locale === 'es' ? 'Ingresa contraseña...' : 'Enter password...'}
            class="bg-input/50"
          />
        </div>
        <p class="text-xs text-muted-foreground flex items-center gap-1">
          <AlertTriangle size={12} class="text-yellow-500" />
          {$locale === 'es' 
            ? 'IMPORTANTE: No hay forma de recuperar la contraseña si la olvidas.'
            : 'IMPORTANT: There is no way to recover the password if you forget it.'}
        </p>
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={() => { showBackupPasswordDialog = false; backupPassword = ''; }}>
        {$locale === 'es' ? 'Cancelar' : 'Cancel'}
      </AlertDialog.Cancel>
      <AlertDialog.Action 
        class="bg-primary text-primary-foreground hover:bg-primary/90" 
        on:click={executeBackup}
        disabled={!backupPassword}
      >
        {$locale === 'es' ? 'Crear Respaldo Encriptado' : 'Create Encrypted Backup'}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<!-- Restore from Backup File Dialog -->
<AlertDialog.Root bind:open={showRestoreDialog}>
  <AlertDialog.Content class="max-w-lg">
    <AlertDialog.Header>
      <AlertDialog.Title class="flex items-center gap-2">
        <Upload size={20} class="text-blue-500" />
        {$locale === 'es' ? 'Restaurar Respaldo' : 'Restore Backup'}
      </AlertDialog.Title>
      <AlertDialog.Description class="space-y-4">
        {#if validationResult}
          <!-- Validation Summary -->
          <div class="p-3 rounded-lg {validationResult.valid ? 'bg-green-500/10 border border-green-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'}">
            <div class="flex items-center gap-2 mb-2">
              {#if validationResult.valid}
                <FileCheck size={16} class="text-green-500" />
                <span class="font-medium text-green-600 dark:text-green-400">
                  {$locale === 'es' ? 'Archivo válido' : 'Valid file'}
                </span>
              {:else}
                <FileWarning size={16} class="text-yellow-500" />
                <span class="font-medium text-yellow-600 dark:text-yellow-400">
                  {$locale === 'es' ? 'Advertencias' : 'Warnings'}
                </span>
              {/if}
              {#if validationResult.encrypted}
                <span class="text-xs bg-yellow-500/20 text-yellow-600 px-1.5 py-0.5 rounded flex items-center gap-1 ml-auto">
                  <Lock size={10} /> {$locale === 'es' ? 'Encriptado' : 'Encrypted'}
                </span>
              {/if}
            </div>
            
            {#if validationResult.recordCounts}
              <div class="grid grid-cols-2 gap-1 text-xs text-muted-foreground mt-2">
                {#each Object.entries(validationResult.recordCounts).filter(([_, count]) => count > 0) as [table, count]}
                  <div class="flex items-center gap-1">
                    <span class="w-2 h-2 rounded-full bg-primary/50"></span>
                    {table}: {count}
                  </div>
                {/each}
              </div>
            {/if}
          </div>
          
          <!-- Warnings -->
          {#if validationResult.warnings.length > 0}
            <div class="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div class="text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-1 flex items-center gap-1">
                <AlertTriangle size={14} />
                {$locale === 'es' ? 'Advertencias' : 'Warnings'}
              </div>
              <ul class="text-xs text-muted-foreground list-disc list-inside space-y-1">
                {#each validationResult.warnings as warning}
                  <li>{warning}</li>
                {/each}
              </ul>
            </div>
          {/if}
          
          <!-- Password Input for encrypted backups -->
          {#if validationResult.encrypted}
            <div class="space-y-2">
              <Label for="restore-password">{$locale === 'es' ? 'Contraseña de Respaldo' : 'Backup Password'}</Label>
              <Input 
                id="restore-password"
                type="password" 
                bind:value={restorePassword}
                placeholder={$locale === 'es' ? 'Ingresa la contraseña...' : 'Enter password...'}
                class="bg-input/50"
              />
            </div>
          {/if}
          
          <!-- Warning about data loss -->
          <div class="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p class="text-sm text-red-600 dark:text-red-400 flex items-start gap-2">
              <AlertTriangle size={16} class="flex-shrink-0 mt-0.5" />
              <span>
                {$locale === 'es' 
                  ? 'Esta acción SOBRESCRIBIRÁ todos tus datos actuales. Asegúrate de tener un respaldo antes de continuar.'
                  : 'This action will OVERWRITE all your current data. Make sure you have a backup before proceeding.'}
              </span>
            </p>
          </div>
        {/if}
        
        <!-- Restore Progress -->
        {#if isRestoring}
          <div class="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <div class="flex items-center gap-2 mb-2">
              <RefreshCw size={16} class="animate-spin text-blue-500" />
              <span class="text-sm font-medium">{backupProgress.stage}</span>
            </div>
            <div class="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div 
                class="h-full bg-blue-500 transition-all duration-300"
                style="width: {backupProgress.percent}%"
              ></div>
            </div>
          </div>
        {/if}
        
        <!-- Restore Result -->
        {#if restoreResult}
          <div class="p-3 rounded-lg {restoreResult.success ? 'bg-green-500/10 border border-green-500/20' : 'bg-red-500/10 border border-red-500/20'}">
            {#if restoreResult.success}
              <div class="flex items-center gap-2 mb-1">
                <Check size={16} class="text-green-500" />
                <span class="font-medium text-green-600 dark:text-green-400">
                  {$locale === 'es' ? '¡Restauración exitosa!' : 'Restore successful!'}
                </span>
              </div>
              <p class="text-xs text-muted-foreground">
                {restoreResult.recordsRestored?.toLocaleString()} {$locale === 'es' ? 'registros restaurados' : 'records restored'}. 
                {$locale === 'es' ? 'Recargando página...' : 'Reloading page...'}
              </p>
            {:else}
              <div class="flex items-center gap-2">
                <AlertTriangle size={16} class="text-red-500" />
                <span class="font-medium text-red-600 dark:text-red-400">
                  {restoreResult.error}
                </span>
              </div>
            {/if}
          </div>
        {/if}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={cancelRestore} disabled={isRestoring}>
        {$locale === 'es' ? 'Cancelar' : 'Cancel'}
      </AlertDialog.Cancel>
      <AlertDialog.Action 
        class="bg-blue-500 text-white hover:bg-blue-600" 
        on:click={executeRestore}
        disabled={isRestoring || (validationResult?.encrypted && !restorePassword) || restoreResult?.success}
      >
        {#if isRestoring}
          <RefreshCw size={16} class="animate-spin mr-2" />
          {$locale === 'es' ? 'Restaurando...' : 'Restoring...'}
        {:else}
          {$locale === 'es' ? 'Restaurar Datos' : 'Restore Data'}
        {/if}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
