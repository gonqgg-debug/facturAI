<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { locale } from '$lib/stores';
  import { firebaseUser, firebaseUserEmail, isFirebaseAuthenticated, firebaseSignOut } from '$lib/firebase';
  import { t } from '$lib/i18n';
  import { 
    User as UserIcon, 
    Mail, 
    LogOut, 
    Shield, 
    Smartphone, 
    RefreshCw,
    Calendar,
    Store,
    Cloud,
    CheckCircle2,
    AlertCircle
  } from 'lucide-svelte';
  import { deviceAuth, getStoreId, getDeviceId } from '$lib/device-auth';
  import { syncStatus, lastSyncTime } from '$lib/sync-store';

  let isSigningOut = false;
  let deviceInfo: { deviceId: string | null; storeId: string | null } | null = null;
  
  onMount(() => {
    const storeId = getStoreId();
    const deviceId = getDeviceId();
    if (storeId || deviceId) {
      deviceInfo = { deviceId, storeId };
    }
  });

  async function handleSignOut() {
    if (isSigningOut) return;
    isSigningOut = true;
    try {
      await firebaseSignOut();
      window.location.href = '/login';
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      isSigningOut = false;
    }
  }

  function formatDate(date: Date | string | null): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString($locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<svelte:head>
  <title>{$locale === 'es' ? 'Mi Cuenta' : 'My Account'} | Cuadra</title>
</svelte:head>

<div class="p-4 md:p-6 max-w-2xl mx-auto pb-24">
  <h1 class="text-2xl font-bold mb-6">{$locale === 'es' ? 'Mi Cuenta' : 'My Account'}</h1>

  {#if $isFirebaseAuthenticated && $firebaseUser}
    <!-- Profile Card -->
    <div class="bg-card text-card-foreground border border-border rounded-xl overflow-hidden mb-6">
      <!-- Header with gradient -->
      <div class="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent"></div>
      
      <!-- Profile Info -->
      <div class="px-6 pb-6 -mt-12">
        <div class="flex items-end gap-4 mb-4">
          {#if $firebaseUser.photoURL}
            <img 
              src={$firebaseUser.photoURL} 
              alt="Profile" 
              class="w-20 h-20 rounded-2xl border-4 border-card shadow-lg"
            />
          {:else}
            <div class="w-20 h-20 rounded-2xl bg-primary/20 border-4 border-card shadow-lg flex items-center justify-center">
              <UserIcon size={32} class="text-primary" />
            </div>
          {/if}
          
          <div class="flex-1 pb-1">
            <h2 class="text-xl font-bold">
              {$firebaseUser.displayName || ($locale === 'es' ? 'Usuario' : 'User')}
            </h2>
            <p class="text-sm text-muted-foreground flex items-center gap-1">
              <Mail size={14} />
              {$firebaseUser.email}
            </p>
          </div>
        </div>

        <!-- Account Details -->
        <div class="space-y-3 mt-6">
          <div class="flex items-center justify-between py-2 border-b border-border/50">
            <span class="text-sm text-muted-foreground flex items-center gap-2">
              <Shield size={16} />
              {$locale === 'es' ? 'Rol' : 'Role'}
            </span>
            <span class="text-sm font-medium">
              {$locale === 'es' ? 'Propietario' : 'Owner'}
            </span>
          </div>
          
          <div class="flex items-center justify-between py-2 border-b border-border/50">
            <span class="text-sm text-muted-foreground flex items-center gap-2">
              <Calendar size={16} />
              {$locale === 'es' ? 'Cuenta creada' : 'Account created'}
            </span>
            <span class="text-sm font-medium">
              {$firebaseUser.metadata?.creationTime 
                ? formatDate($firebaseUser.metadata.creationTime)
                : '-'}
            </span>
          </div>

          <div class="flex items-center justify-between py-2 border-b border-border/50">
            <span class="text-sm text-muted-foreground flex items-center gap-2">
              <Calendar size={16} />
              {$locale === 'es' ? 'Último acceso' : 'Last sign in'}
            </span>
            <span class="text-sm font-medium">
              {$firebaseUser.metadata?.lastSignInTime 
                ? formatDate($firebaseUser.metadata.lastSignInTime) 
                : '-'}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Device & Sync Status -->
    <div class="bg-card text-card-foreground border border-border rounded-xl p-6 mb-6">
      <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
        <Cloud size={18} class="text-primary" />
        {$locale === 'es' ? 'Sincronización' : 'Sync Status'}
      </h3>
      
      <div class="space-y-3">
        <div class="flex items-center justify-between py-2 border-b border-border/50">
          <span class="text-sm text-muted-foreground flex items-center gap-2">
            <Store size={16} />
            {$locale === 'es' ? 'Tienda' : 'Store'}
          </span>
          <span class="text-sm font-medium">
            {#if deviceInfo?.storeId}
              <span class="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle2 size={14} />
                {$locale === 'es' ? 'Conectada' : 'Connected'}
              </span>
            {:else}
              <span class="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                <AlertCircle size={14} />
                {$locale === 'es' ? 'No conectada' : 'Not connected'}
              </span>
            {/if}
          </span>
        </div>

        <div class="flex items-center justify-between py-2 border-b border-border/50">
          <span class="text-sm text-muted-foreground flex items-center gap-2">
            <Smartphone size={16} />
            {$locale === 'es' ? 'Dispositivo' : 'Device'}
          </span>
          <span class="text-sm font-medium">
            {#if $deviceAuth.state === 'registered'}
              <span class="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle2 size={14} />
                {$locale === 'es' ? 'Registrado' : 'Registered'}
              </span>
            {:else}
              <span class="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                <AlertCircle size={14} />
                {$deviceAuth.state}
              </span>
            {/if}
          </span>
        </div>

        <div class="flex items-center justify-between py-2">
          <span class="text-sm text-muted-foreground flex items-center gap-2">
            <RefreshCw size={16} />
            {$locale === 'es' ? 'Última sincronización' : 'Last sync'}
          </span>
          <span class="text-sm font-medium">
            {$lastSyncTime ? formatDate($lastSyncTime) : ($locale === 'es' ? 'Nunca' : 'Never')}
          </span>
        </div>
      </div>
    </div>

    <!-- Sign Out -->
    <div class="bg-card text-card-foreground border border-border rounded-xl p-6">
      <h3 class="text-lg font-semibold mb-2">
        {$locale === 'es' ? 'Cerrar Sesión' : 'Sign Out'}
      </h3>
      <p class="text-sm text-muted-foreground mb-4">
        {$locale === 'es' 
          ? 'Cierra tu sesión en este dispositivo. Tus datos permanecerán sincronizados.'
          : 'Sign out from this device. Your data will remain synced.'}
      </p>
      
      <button
        class="w-full px-6 py-3 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 font-semibold disabled:opacity-50"
        on:click={handleSignOut}
        disabled={isSigningOut}
      >
        {#if isSigningOut}
          <RefreshCw size={18} class="animate-spin" />
          {$locale === 'es' ? 'Cerrando sesión...' : 'Signing out...'}
        {:else}
          <LogOut size={18} />
          {$locale === 'es' ? 'Cerrar Sesión' : 'Sign Out'}
        {/if}
      </button>
    </div>

  {:else}
    <!-- Not logged in -->
    <div class="bg-card text-card-foreground border border-border rounded-xl p-8 text-center">
      <UserIcon size={48} class="mx-auto mb-4 text-muted-foreground opacity-50" />
      <h2 class="text-lg font-semibold mb-2">
        {$locale === 'es' ? 'No has iniciado sesión' : 'Not signed in'}
      </h2>
      <p class="text-sm text-muted-foreground mb-4">
        {$locale === 'es' 
          ? 'Inicia sesión para acceder a tu cuenta.'
          : 'Sign in to access your account.'}
      </p>
      <a
        href="/login"
        class="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors"
      >
        {$locale === 'es' ? 'Iniciar Sesión' : 'Sign In'}
      </a>
    </div>
  {/if}
</div>

