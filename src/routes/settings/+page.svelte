<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { apiKey, locale, weatherApiKey, storeLocation } from '$lib/stores';
  import { db } from '$lib/db';
  import { currentUser, userPermissions } from '$lib/auth';
  import { Save, Download, Upload, Trash2, AlertTriangle, Eye, EyeOff, Plus, Building2, CreditCard, X, Check, Edit2, Star, Languages, Users, Shield, UserPlus, CloudRain, MapPin, RefreshCw } from 'lucide-svelte';
  import type { BankAccount, User, Role } from '$lib/types';
  import * as Select from '$lib/components/ui/select';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import { t } from '$lib/i18n';
  import { testWeatherConnection, type CurrentWeather } from '$lib/weather';

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
    keyInput = get(apiKey);
    weatherKeyInput = get(weatherApiKey);
    weatherLocationInput = get(storeLocation);
    await loadBankAccounts();
    
    // Ensure database defaults are initialized
    await db.initializeDefaults();
    
    await loadUsersAndRoles();
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
    weatherApiKey.set(weatherKeyInput.trim());
    storeLocation.set(weatherLocationInput.trim());
    showWeatherSaveSuccess = true;
    setTimeout(() => {
      showWeatherSaveSuccess = false;
      isSavingWeather = false;
    }, 2000);
  }

  async function testWeatherApi() {
    if (!weatherKeyInput.trim() || !weatherLocationInput.trim()) {
      weatherTestResult = {
        success: false,
        message: $locale === 'es' ? 'Por favor ingresa la clave API y la ubicación' : 'Please enter API key and location'
      };
      return;
    }

    isTestingWeather = true;
    weatherTestResult = null;

    try {
      const result = await testWeatherConnection(weatherLocationInput.trim(), weatherKeyInput.trim());
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
        
        if (!confirm($locale === 'es' ? 'Esto SOBRESCRIBIRÁ tus datos actuales. ¿Estás seguro?' : 'This will OVERWRITE your current data. Are you sure?')) return;

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

        alert($locale === 'es' ? '¡Restauración exitosa!' : 'Restore successful!');
      } catch (err) {
        alert('Error restoring data: ' + err);
      }
    };

    reader.readAsText(file);
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
        <Label for="api-key-input">{$locale === 'es' ? 'Clave API xAI' : 'xAI API Key'}</Label>
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
            <span>{isSaving ? ($locale === 'es' ? 'Guardando...' : 'Saving...') : ($locale === 'es' ? 'Guardar' : 'Save')}</span>
          </button>
        </div>
        {#if showSaveSuccess}
          <p class="text-green-500 text-xs mt-2 flex items-center gap-1">
            <span class="inline-block w-1.5 h-1.5 bg-green-500 rounded-full"></span>
            {$locale === 'es' ? 'Clave API guardada exitosamente.' : 'API Key saved successfully.'}
          </p>
        {/if}
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
      <!-- Weather API Key -->
      <div class="space-y-2">
        <Label for="weather-api-key">{$locale === 'es' ? 'Clave API de OpenWeatherMap' : 'OpenWeatherMap API Key'}</Label>
        <div class="flex space-x-2">
          <div class="flex-1 relative">
            {#if showWeatherKey}
              <Input 
                id="weather-api-key-text"
                type="text" 
                bind:value={weatherKeyInput} 
                placeholder="abc123..." 
                class="pr-10 bg-input/50"
              />
            {:else}
              <Input 
                id="weather-api-key-password"
                type="password" 
                bind:value={weatherKeyInput} 
                placeholder="abc123..." 
                class="pr-10 bg-input/50"
              />
            {/if}
            <button 
              type="button"
              on:click={() => showWeatherKey = !showWeatherKey}
              class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
              title={showWeatherKey ? 'Hide API Key' : 'Show API Key'}
            >
              {#if showWeatherKey}
                <EyeOff size={16} />
              {:else}
                <Eye size={16} />
              {/if}
            </button>
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
          disabled={isTestingWeather || !weatherKeyInput.trim() || !weatherLocationInput.trim()}
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

  <!-- Data Management Section -->
  <div class="bg-card text-card-foreground border border-border rounded-xl p-4 mb-6">
    <h2 class="text-lg font-semibold mb-4">{$locale === 'es' ? 'Gestión de Datos' : 'Data Management'}</h2>
    <div class="space-y-4">
      
      <!-- Backup -->
      <div class="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border/50">
        <div>
          <div class="font-medium">{$locale === 'es' ? 'Respaldar Datos' : 'Backup Data'}</div>
          <div class="text-xs text-muted-foreground">{$locale === 'es' ? 'Descarga una copia JSON de todos tus datos.' : 'Download a JSON copy of all your data.'}</div>
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
          <div class="font-medium">{$locale === 'es' ? 'Restaurar Datos' : 'Restore Data'}</div>
          <div class="text-xs text-muted-foreground">{$locale === 'es' ? 'Restaura desde un archivo JSON de respaldo.' : 'Restore from a JSON backup file.'}</div>
        </div>
        <label class="text-primary hover:bg-primary/10 p-2 rounded-lg transition-colors cursor-pointer">
          <Upload size={20} />
          <input type="file" accept=".json" on:change={restoreData} class="hidden" />
        </label>
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
