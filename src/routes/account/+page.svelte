<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { locale } from '$lib/stores';
  import { 
    firebaseUser, 
    isFirebaseAuthenticated, 
    firebaseSignOut,
    sendPasswordResetToCurrentUser,
    updateFirebaseDisplayName,
    reauthenticateWithPassword,
    reauthenticateWithGoogle,
    deleteCurrentUser
  } from '$lib/firebase';
  import { currentUser, logout } from '$lib/auth';
  import { clearStoreContext } from '$lib/supabase';
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
    AlertCircle,
    Trash2,
    KeyRound,
    Save
  } from 'lucide-svelte';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { toast } from 'svelte-sonner';
  import { deviceAuth, getStoreId, getDeviceId, clearLocalDeviceAuth } from '$lib/device-auth';
  import { syncStatus, getLastSyncTimestamp, clearSyncStatus } from '$lib/sync-store';
  import { stopSyncService } from '$lib/sync-service';

  let isSigningOut = false;
  let deviceInfo: { deviceId: string | null; storeId: string | null } | null = null;
  let lastSyncTime: string | null = null;
  let displayNameInput = '';
  let displayNameTouched = false;
  let isUpdatingProfile = false;
  let isSendingReset = false;
  let deleteDialogOpen = false;
  let deletePassword = '';
  let deleteConfirm = '';
  let isDeleting = false;
  let deleteError = '';
  let providerIds: string[] = [];
  
  onMount(() => {
    const storeId = getStoreId();
    const deviceId = getDeviceId();
    if (storeId || deviceId) {
      deviceInfo = { deviceId, storeId };
    }
    lastSyncTime = getLastSyncTimestamp();
  });

  $: providerIds = $firebaseUser?.providerData?.map(p => p.providerId) || [];
  $: if ($firebaseUser && !displayNameTouched) {
    displayNameInput = $firebaseUser.displayName || '';
  }

  async function clearLocalSession(): Promise<void> {
    stopSyncService();
    await logout();
    clearLocalDeviceAuth();
    await clearStoreContext();
    clearSyncStatus();
  }

  async function handleSignOut() {
    if (isSigningOut) return;
    isSigningOut = true;
    try {
      await firebaseSignOut();
      await clearLocalSession();
      window.location.href = '/login';
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error($locale === 'es' ? 'Error al cerrar sesión' : 'Sign out failed');
    } finally {
      isSigningOut = false;
    }
  }

  async function handleUpdateProfile() {
    const trimmed = displayNameInput.trim();
    if (!trimmed) {
      toast.error($locale === 'es' ? 'El nombre no puede estar vacío' : 'Display name cannot be empty');
      return;
    }
    isUpdatingProfile = true;
    try {
      await updateFirebaseDisplayName(trimmed);
      if ($currentUser?.id) {
        const { db } = await import('$lib/db');
        await db.users.update($currentUser.id, { displayName: trimmed });
        currentUser.set({ ...$currentUser, displayName: trimmed });
      }
      displayNameTouched = false;
      toast.success($locale === 'es' ? 'Perfil actualizado' : 'Profile updated');
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error($locale === 'es' ? 'No se pudo actualizar el perfil' : 'Failed to update profile');
    } finally {
      isUpdatingProfile = false;
    }
  }

  async function handleSendPasswordReset() {
    if (isSendingReset) return;
    isSendingReset = true;
    try {
      await sendPasswordResetToCurrentUser();
      toast.success($locale === 'es' ? 'Email de restablecimiento enviado' : 'Password reset email sent');
    } catch (error) {
      console.error('Password reset error:', error);
      toast.error($locale === 'es' ? 'No se pudo enviar el email' : 'Failed to send reset email');
    } finally {
      isSendingReset = false;
    }
  }

  async function handleDeleteAccount() {
    if (isDeleting) return;
    deleteError = '';
    isDeleting = true;
    try {
      const isPasswordProvider = providerIds.includes('password');
      const isGoogleProvider = providerIds.includes('google.com');
      if (isPasswordProvider) {
        if (!deletePassword) {
          deleteError = $locale === 'es' ? 'Ingresa tu contraseña para continuar' : 'Enter your password to continue';
          return;
        }
        await reauthenticateWithPassword(deletePassword);
      } else if (isGoogleProvider) {
        await reauthenticateWithGoogle();
      } else {
        deleteError = $locale === 'es' ? 'Este proveedor requiere reautenticación manual' : 'This provider requires manual reauthentication';
        return;
      }
      await deleteCurrentUser();
      await clearLocalSession();
      window.location.href = '/login';
    } catch (error) {
      console.error('Delete account error:', error);
      deleteError = $locale === 'es' ? 'No se pudo eliminar la cuenta' : 'Failed to delete account';
    } finally {
      isDeleting = false;
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
            {lastSyncTime ? formatDate(lastSyncTime) : ($locale === 'es' ? 'Nunca' : 'Never')}
          </span>
        </div>
      </div>
    </div>

    <!-- Account Actions -->
    <div class="bg-card text-card-foreground border border-border rounded-xl p-6 mb-6">
      <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
        <UserIcon size={18} class="text-primary" />
        {$locale === 'es' ? 'Cuenta' : 'Account'}
      </h3>

      <div class="space-y-4">
        <div>
          <label for="displayName" class="block text-sm font-medium mb-2">
            {$locale === 'es' ? 'Nombre para Mostrar' : 'Display Name'}
          </label>
          <div class="flex gap-2">
            <Input
              id="displayName"
              bind:value={displayNameInput}
              on:input={() => { displayNameTouched = true; }}
              placeholder={$locale === 'es' ? 'Tu nombre' : 'Your name'}
              class="bg-input/50"
              disabled={isUpdatingProfile}
            />
            <Button
              on:click={handleUpdateProfile}
              disabled={isUpdatingProfile || !displayNameInput.trim()}
              class="whitespace-nowrap"
            >
              <Save size={16} />
              {$locale === 'es' ? 'Guardar' : 'Save'}
            </Button>
          </div>
        </div>

        <div class="flex items-center justify-between border-t border-border/50 pt-4">
          <div>
            <p class="text-sm font-medium">{$locale === 'es' ? 'Restablecer contraseña' : 'Reset password'}</p>
            <p class="text-xs text-muted-foreground">
              {$locale === 'es' ? 'Enviamos un email de restablecimiento a tu cuenta.' : 'We will email a reset link to your account.'}
            </p>
          </div>
          <Button variant="outline" on:click={handleSendPasswordReset} disabled={isSendingReset}>
            <KeyRound size={16} />
            {$locale === 'es' ? 'Enviar' : 'Send'}
          </Button>
        </div>
      </div>
    </div>

    <!-- Sign Out -->
    <div class="bg-card text-card-foreground border border-border rounded-xl p-6 mb-6">
      <h3 class="text-lg font-semibold mb-2">
        {$locale === 'es' ? 'Cerrar Sesión' : 'Sign Out'}
      </h3>
      <p class="text-sm text-muted-foreground mb-4">
        {$locale === 'es' 
          ? 'Cierra tu sesión y limpia los datos locales de este dispositivo.'
          : 'Sign out and clear local data from this device.'}
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

    <!-- Delete Account -->
    <div class="bg-card text-card-foreground border border-border rounded-xl p-6">
      <h3 class="text-lg font-semibold mb-2 text-destructive">
        {$locale === 'es' ? 'Eliminar Cuenta' : 'Delete Account'}
      </h3>
      <p class="text-sm text-muted-foreground mb-4">
        {$locale === 'es'
          ? 'Elimina tu cuenta de acceso. Esto no borra los datos de la tienda.'
          : 'Deletes your login account. This does not remove store data.'}
      </p>
      <Button variant="destructive" on:click={() => { deleteDialogOpen = true; deletePassword = ''; deleteConfirm = ''; deleteError = ''; }}>
        <Trash2 size={16} />
        {$locale === 'es' ? 'Eliminar Cuenta' : 'Delete Account'}
      </Button>
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

<!-- Delete Account Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>
        {$locale === 'es' ? 'Confirmar eliminación' : 'Confirm deletion'}
      </AlertDialog.Title>
      <AlertDialog.Description>
        {$locale === 'es'
          ? 'Escribe DELETE para confirmar. Si tu cuenta es con contraseña, ingrésala para continuar.'
          : 'Type DELETE to confirm. If your account uses a password, enter it to continue.'}
      </AlertDialog.Description>
    </AlertDialog.Header>

    <div class="space-y-3">
      <Input
        placeholder="DELETE"
        bind:value={deleteConfirm}
        class="bg-input/50"
      />
      {#if providerIds.includes('password')}
        <Input
          type="password"
          placeholder={$locale === 'es' ? 'Contraseña' : 'Password'}
          bind:value={deletePassword}
          class="bg-input/50"
        />
      {/if}
      {#if deleteError}
        <p class="text-sm text-destructive">{deleteError}</p>
      {/if}
    </div>

    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={() => { deleteDialogOpen = false; deleteError = ''; }}>
        {$locale === 'es' ? 'Cancelar' : 'Cancel'}
      </AlertDialog.Cancel>
      <AlertDialog.Action
        class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
        on:click={handleDeleteAccount}
        disabled={isDeleting || deleteConfirm !== 'DELETE'}
      >
        {#if isDeleting}
          <RefreshCw size={16} class="animate-spin" />
          {$locale === 'es' ? 'Eliminando...' : 'Deleting...'}
        {:else}
          {$locale === 'es' ? 'Eliminar' : 'Delete'}
        {/if}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

