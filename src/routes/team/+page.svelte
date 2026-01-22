<script lang="ts">
  import { onMount } from 'svelte';
  import { locale } from '$lib/stores';
  import { db } from '$lib/db';
  import { firebaseUser, firebaseUserEmail } from '$lib/firebase';
  import { t } from '$lib/i18n';
  import * as Select from '$lib/components/ui/select';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import { Button } from '$lib/components/ui/button';
  import { 
    Users, 
    UserPlus, 
    Shield, 
    Edit2, 
    Trash2, 
    X, 
    Check, 
    AlertTriangle,
    Mail,
    Phone,
    Key,
    Clock,
    Send,
    Link,
    Copy,
    CheckCircle2,
    Loader2,
    RefreshCw,
    ExternalLink
  } from 'lucide-svelte';
  import type { User, Role, TeamInvite } from '$lib/types';
  import { 
    getPendingInvite, 
    revokeInvite, 
    resendInvite,
    deleteUserFromSupabase,
    syncUserToSupabase
  } from '$lib/team-invites';
  import { getStoreId } from '$lib/device-auth';
  import { currentUser, hasPermission, currentRole } from '$lib/auth';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { toast } from 'svelte-sonner';

  let users: User[] = [];
  let roles: Role[] = [];
  let userInvites: Map<number, TeamInvite | null> = new Map();
  let showUserModal = false;
  let editingUser: User | null = null;
  let userForm: Partial<User> = getEmptyUserForm();
  let deleteUserDialogOpen = false;
  let userToDelete: User | null = null;
  let userFormError = '';
  
  // Invite modal state
  let showInviteModal = false;
  let inviteUser: User | null = null;
  let inviteEmail = '';
  let inviteSending = false;
  let inviteError = '';
  let inviteSuccess = false;
  let inviteLink = '';
  let copiedLink = false;

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

  onMount(async () => {
    // Permission guard: Only admins can access team management
    // If role has no permissions loaded, allow access (treat as admin - fallback)
    const role = get(currentRole);
    const hasRolePermissions = role?.permissions && role.permissions.length > 0;
    
    if (hasRolePermissions && !hasPermission('users.manage')) {
      toast.error($locale === 'es' ? 'No tienes permiso para acceder a esta página' : 'You do not have permission to access this page');
      goto('/dashboard');
      return;
    }
    
    await loadUsersAndRoles();
  });

  async function loadUsersAndRoles() {
    users = await db.users.toArray();
    roles = await db.localRoles.toArray();
    
    users = users.map(u => {
      const role = roles.find(r => r.id === u.roleId);
      return { ...u, roleName: role?.name };
    });
    
    // Load pending invites for each user
    for (const user of users) {
      if (user.id && !user.firebaseUid) {
        const invite = await getPendingInvite(user.id);
        userInvites.set(user.id, invite);
      }
    }
    userInvites = userInvites; // Trigger reactivity
  }

  function openAddUserModal() {
    editingUser = null;
    userForm = getEmptyUserForm();
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
    
    const existingUser = await db.users.where('pin').equals(userForm.pin).first();
    if (existingUser && existingUser.id !== editingUser?.id) {
      userFormError = t('users.pinInUse', $locale);
      return;
    }
    
    // Check for duplicate email (if email is provided)
    if (userForm.email?.trim()) {
      const normalizedEmail = userForm.email.trim().toLowerCase();
      
      // Check local DB first
      const existingEmailUser = await db.users.where('email').equals(normalizedEmail).first();
      if (existingEmailUser && existingEmailUser.id !== editingUser?.id) {
        userFormError = $locale === 'es' 
          ? 'Este email ya está en uso por otro usuario' 
          : 'This email is already in use by another user';
        return;
      }
      
      // Also check Supabase for email conflicts (in case of sync issues)
      const storeIdForCheck = getStoreId();
      if (storeIdForCheck) {
        try {
          const { getSupabase } = await import('$lib/supabase');
          const supabase = getSupabase();
          if (supabase) {
            const { data: supabaseConflict } = await supabase
              .from('users')
              .select('local_id, display_name')
              .eq('email', normalizedEmail)
              .eq('store_id', storeIdForCheck)
              .neq('local_id', editingUser?.id || 0)
              .maybeSingle();
            
            if (supabaseConflict) {
              const conflictData = supabaseConflict as { local_id: number; display_name: string };
              userFormError = $locale === 'es' 
                ? `Este email ya está en uso por "${conflictData.display_name}"` 
                : `This email is already in use by "${conflictData.display_name}"`;
              return;
            }
          }
        } catch (supabaseErr) {
          console.warn('Could not check Supabase for email conflict:', supabaseErr);
          // Continue - local check passed
        }
      }
    }
    
    try {
      const role = roles.find(r => r.id === userForm.roleId);
      const storeId = getStoreId();
      
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
        createdBy: editingUser?.createdBy || undefined
      };
      
      let savedUserId: number;
      if (editingUser?.id) {
        await db.users.update(editingUser.id, userData);
        savedUserId = editingUser.id;
      } else {
        savedUserId = await db.users.add(userData) as number;
      }
      
      // Sync to Supabase so other devices can see the user
      if (storeId) {
        const savedUser = await db.users.get(savedUserId);
        if (savedUser) {
          await syncUserToSupabase(savedUser, storeId);
        }
      }
      
      await loadUsersAndRoles();
      closeUserModal();
      
      toast.success($locale === 'es' ? 'Usuario guardado' : 'User saved');
    } catch (e) {
      console.error('Error saving user:', e);
      userFormError = $locale === 'es' ? 'Error al guardar usuario' : 'Error saving user';
    }
  }

  function confirmDeleteUser(user: User) {
    if (!user.id) return;
    if (user.email && user.email === $firebaseUserEmail) {
      alert(t('users.cannotDeleteSelf', $locale));
      return;
    }
    userToDelete = user;
    deleteUserDialogOpen = true;
  }

  async function executeDeleteUser() {
    if (!userToDelete?.id) return;
    
    try {
      const userId = userToDelete.id;
      const storeId = getStoreId();
      
      // Delete from local database
      await db.users.delete(userId);
      
      // Also delete from Supabase to keep databases in sync
      if (storeId) {
        await deleteUserFromSupabase(userId, storeId);
      }
      
      deleteUserDialogOpen = false;
      userToDelete = null;
      await loadUsersAndRoles();
      closeUserModal();
      
      toast.success($locale === 'es' ? 'Usuario eliminado' : 'User deleted');
    } catch (e) {
      console.error('Error deleting user:', e);
      toast.error($locale === 'es' ? 'Error al eliminar usuario' : 'Error deleting user');
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

  // Invite functions
  function openInviteModal(user: User) {
    inviteUser = user;
    inviteEmail = user.email || '';
    inviteError = '';
    inviteSuccess = false;
    inviteLink = '';
    copiedLink = false;
    showInviteModal = true;
  }

  function closeInviteModal() {
    showInviteModal = false;
    inviteUser = null;
    inviteEmail = '';
    inviteError = '';
    inviteSuccess = false;
    inviteLink = '';
  }

  async function sendInvite(sendEmail: boolean = true) {
    if (!inviteUser?.id || !inviteEmail) return;
    
    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      inviteError = $locale === 'es' ? 'Por favor ingresa un email válido' : 'Please enter a valid email';
      return;
    }
    
    inviteSending = true;
    inviteError = '';
    
    try {
      // Import the separate functions
      const { createInvite, sendInviteEmail, getInviteUrl: getUrl } = await import('$lib/team-invites');
      
      // First create the invite (this syncs to Supabase)
      const invite = await createInvite(
        inviteUser.id,
        inviteEmail,
        $currentUser?.id || 0
      );
      
      inviteLink = getUrl(invite.token);
      
      // Update local state
      userInvites.set(inviteUser.id, invite);
      userInvites = userInvites;
      
      // Update user email if changed
      if (inviteUser.email !== inviteEmail) {
        await db.users.update(inviteUser.id, { email: inviteEmail });
        await loadUsersAndRoles();
      }
      
      // NOTE: We no longer use Firebase Email Link (sendSignInLinkToEmail) because:
      // 1. It conflicts with password-based signup flow
      // 2. It requires complex Email Link configuration in Firebase
      // 3. The simple invite link + password signup is more reliable
      // Instead, just show success and let admin share the link manually or via their own email
      inviteSuccess = true;
      
      if (sendEmail) {
        // Show a message that they should share the link manually
        // In the future, we could integrate a proper email service here
        inviteError = $locale === 'es' 
          ? 'Comparte el enlace con el usuario por WhatsApp, email u otro medio.'
          : 'Share the link with the user via WhatsApp, email or other means.';
      }
    } catch (e: any) {
      console.error('Failed to create invite:', e);
      inviteError = e.message || ($locale === 'es' ? 'Error al crear invitación' : 'Failed to create invite');
    } finally {
      inviteSending = false;
    }
  }

  async function handleResendInvite(user: User) {
    if (!user.id) return;
    
    const invite = userInvites.get(user.id);
    if (!invite?.id) return;
    
    try {
      const newInvite = await resendInvite(invite.id);
      userInvites.set(user.id, newInvite);
      userInvites = userInvites;
      alert($locale === 'es' ? 'Invitación reenviada' : 'Invite resent');
    } catch (e: any) {
      console.error('Failed to resend invite:', e);
      alert(e.message || ($locale === 'es' ? 'Error al reenviar' : 'Failed to resend'));
    }
  }

  async function handleRevokeInvite(user: User) {
    if (!user.id) return;
    
    const invite = userInvites.get(user.id);
    if (!invite?.id) return;
    
    if (!confirm($locale === 'es' ? '¿Cancelar esta invitación?' : 'Cancel this invite?')) {
      return;
    }
    
    try {
      await revokeInvite(invite.id);
      userInvites.set(user.id, null);
      userInvites = userInvites;
    } catch (e: any) {
      console.error('Failed to revoke invite:', e);
      alert(e.message || ($locale === 'es' ? 'Error al cancelar' : 'Failed to cancel'));
    }
  }

  async function copyInviteLink() {
    if (!inviteLink) return;
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      copiedLink = true;
      setTimeout(() => { copiedLink = false; }, 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  }

  function getInviteStatus(user: User): 'none' | 'pending' | 'linked' {
    if (user.firebaseUid) return 'linked';
    if (user.id && userInvites.get(user.id)) return 'pending';
    return 'none';
  }
</script>

<svelte:head>
  <title>{$locale === 'es' ? 'Equipo' : 'Team'} | Cuadra</title>
</svelte:head>

<div class="p-4 md:p-6 max-w-4xl mx-auto pb-24">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div>
      <h1 class="text-2xl font-bold">{$locale === 'es' ? 'Equipo' : 'Team'}</h1>
      <p class="text-sm text-muted-foreground">
        {$locale === 'es' ? 'Gestiona los usuarios y permisos de tu tienda' : 'Manage your store users and permissions'}
      </p>
    </div>
    <button 
      on:click={openAddUserModal}
      class="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors"
    >
      <UserPlus size={18} />
      {$locale === 'es' ? 'Agregar Usuario' : 'Add User'}
    </button>
  </div>

  <!-- Info Banner -->
  <div class="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6">
    <h3 class="font-medium text-primary mb-1">
      {$locale === 'es' ? '¿Cómo funciona?' : 'How it works'}
    </h3>
    <p class="text-sm text-muted-foreground">
      {$locale === 'es' 
        ? 'Los usuarios acceden al punto de venta con un PIN único de 4-6 dígitos. Cada usuario tiene un rol que determina sus permisos en el sistema.'
        : 'Users access the point of sale with a unique 4-6 digit PIN. Each user has a role that determines their permissions in the system.'}
    </p>
  </div>

  <!-- Users Grid -->
  <div class="grid gap-4 mb-8">
    {#if users.length === 0}
      <div class="bg-card text-card-foreground border border-border rounded-xl p-12 text-center">
        <Users size={48} class="mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 class="text-lg font-semibold mb-2">
          {$locale === 'es' ? 'Sin usuarios aún' : 'No users yet'}
        </h3>
        <p class="text-sm text-muted-foreground mb-4">
          {$locale === 'es' 
            ? 'Agrega usuarios para que puedan acceder al punto de venta.'
            : 'Add users so they can access the point of sale.'}
        </p>
        <button 
          on:click={openAddUserModal}
          class="text-primary hover:underline text-sm font-medium"
        >
          {$locale === 'es' ? 'Agregar primer usuario' : 'Add first user'}
        </button>
      </div>
    {:else}
      {#each users as user}
        {@const inviteStatus = getInviteStatus(user)}
        <div class="bg-card text-card-foreground border border-border rounded-xl p-4 group hover:border-primary/30 transition-colors {!user.isActive ? 'opacity-60' : ''}">
          <div class="flex items-center gap-4">
            <!-- Avatar -->
            <div class="w-14 h-14 {getUserColor(user.id)} rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 relative">
              {getUserInitials(user.displayName)}
              {#if inviteStatus === 'linked'}
                <div class="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-card">
                  <CheckCircle2 size={12} class="text-white" />
                </div>
              {/if}
            </div>
            
            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 class="font-semibold truncate">{user.displayName}</h3>
                {#if user.email && user.email === $firebaseUserEmail}
                  <span class="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                    {$locale === 'es' ? 'Tú' : 'You'}
                  </span>
                {/if}
                {#if !user.isActive}
                  <span class="text-xs bg-red-500/20 text-red-500 px-2 py-0.5 rounded-full">
                    {$locale === 'es' ? 'Inactivo' : 'Inactive'}
                  </span>
                {/if}
                {#if inviteStatus === 'linked'}
                  <span class="text-xs bg-emerald-500/20 text-emerald-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 size={10} />
                    {$locale === 'es' ? 'Cuenta Vinculada' : 'Account Linked'}
                  </span>
                {:else if inviteStatus === 'pending'}
                  <span class="text-xs bg-amber-500/20 text-amber-600 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Clock size={10} />
                    {$locale === 'es' ? 'Invitación Pendiente' : 'Invite Pending'}
                  </span>
                {:else}
                  <span class="text-xs bg-slate-500/20 text-slate-500 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Key size={10} />
                    {$locale === 'es' ? 'Solo PIN' : 'PIN Only'}
                  </span>
                {/if}
              </div>
              
              <div class="text-sm text-muted-foreground flex items-center gap-3 mt-1 flex-wrap">
                <span class="font-mono">@{user.username}</span>
                <span class="flex items-center gap-1">
                  <Shield size={12} />
                  {user.roleName}
                </span>
                {#if user.email}
                  <span class="flex items-center gap-1">
                    <Mail size={12} />
                    {user.email}
                  </span>
                {/if}
              </div>
            </div>
            
            <!-- Actions -->
            <div class="flex items-center gap-1">
              {#if inviteStatus === 'none' && user.email !== $firebaseUserEmail}
                <button 
                  on:click={() => openInviteModal(user)}
                  class="text-primary hover:bg-primary/10 p-2 rounded-lg transition-colors"
                  title={$locale === 'es' ? 'Enviar Invitación' : 'Send Invite'}
                >
                  <Send size={18} />
                </button>
              {:else if inviteStatus === 'pending'}
                <button 
                  on:click={() => handleResendInvite(user)}
                  class="text-amber-500 hover:bg-amber-500/10 p-2 rounded-lg transition-colors"
                  title={$locale === 'es' ? 'Reenviar Invitación' : 'Resend Invite'}
                >
                  <RefreshCw size={18} />
                </button>
                <button 
                  on:click={() => handleRevokeInvite(user)}
                  class="text-muted-foreground hover:text-red-500 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                  title={$locale === 'es' ? 'Cancelar Invitación' : 'Cancel Invite'}
                >
                  <X size={18} />
                </button>
              {/if}
              <button 
                on:click={() => openEditUserModal(user)}
                class="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-muted transition-colors"
                title={$locale === 'es' ? 'Editar' : 'Edit'}
              >
                <Edit2 size={18} />
              </button>
              {#if !user.email || user.email !== $firebaseUserEmail}
                <button 
                  on:click={() => confirmDeleteUser(user)}
                  class="text-muted-foreground hover:text-red-500 p-2 rounded-lg hover:bg-red-500/10 transition-colors"
                  title={$locale === 'es' ? 'Eliminar' : 'Delete'}
                >
                  <Trash2 size={18} />
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Roles Section -->
  <div class="bg-card text-card-foreground border border-border rounded-xl p-6">
    <h2 class="text-lg font-semibold mb-4 flex items-center gap-2">
      <Shield size={18} />
      {$locale === 'es' ? 'Roles Disponibles' : 'Available Roles'}
    </h2>
    <p class="text-sm text-muted-foreground mb-4">
      {$locale === 'es' 
        ? 'Los roles determinan qué acciones puede realizar cada usuario en el sistema.'
        : 'Roles determine what actions each user can perform in the system.'}
    </p>
    
    <div class="grid sm:grid-cols-3 gap-3">
      {#each roles as role}
        <div class="p-4 bg-muted/30 rounded-xl border border-border/50">
          <div class="flex items-center gap-2 mb-2">
            <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield size={16} class="text-primary" />
            </div>
            <div>
              <div class="font-medium text-sm">{role.name}</div>
              {#if role.isSystem}
                <span class="text-[10px] text-muted-foreground">
                  {$locale === 'es' ? 'Sistema' : 'System'}
                </span>
              {/if}
            </div>
          </div>
          {#if role.description}
            <p class="text-xs text-muted-foreground mb-2">{role.description}</p>
          {/if}
          <div class="text-xs text-muted-foreground">
            {role.permissions.length} {$locale === 'es' ? 'permisos' : 'permissions'}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<!-- User Modal -->
{#if showUserModal}
  <div class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" on:click|self={closeUserModal}>
    <div class="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden text-card-foreground">
      <div class="p-4 border-b border-border flex justify-between items-center">
        <h3 class="font-bold text-lg flex items-center gap-2">
          <Users size={20} />
          {editingUser ? ($locale === 'es' ? 'Editar Usuario' : 'Edit User') : ($locale === 'es' ? 'Nuevo Usuario' : 'New User')}
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
          <Label for="user-displayname" class="flex items-center gap-2">
            {$locale === 'es' ? 'Nombre completo' : 'Full name'} *
          </Label>
          <Input 
            id="user-displayname"
            bind:value={userForm.displayName}
            placeholder={$locale === 'es' ? 'Ej: Juan Pérez' : 'e.g., John Doe'}
            class="bg-input/50"
          />
        </div>

        <div class="space-y-1.5">
          <Label for="user-username" class="flex items-center gap-2">
            {$locale === 'es' ? 'Nombre de usuario' : 'Username'} *
          </Label>
          <Input 
            id="user-username"
            bind:value={userForm.username}
            placeholder={$locale === 'es' ? 'Ej: jperez' : 'e.g., jdoe'}
            class="bg-input/50"
          />
        </div>

        <div class="space-y-1.5">
          <Label for="user-pin" class="flex items-center gap-2">
            <Key size={14} />
            PIN *
          </Label>
          <Input 
            id="user-pin"
            type="password"
            bind:value={userForm.pin}
            placeholder="••••"
            class="bg-input/50 tracking-widest font-mono text-lg"
            maxlength="6"
            inputmode="numeric"
          />
          <p class="text-xs text-muted-foreground">
            {$locale === 'es' ? 'PIN único de 4-6 dígitos para acceder al punto de venta' : 'Unique 4-6 digit PIN for POS access'}
          </p>
        </div>

        <div class="space-y-1.5">
          <Label for="user-role" class="flex items-center gap-2">
            <Shield size={14} />
            {$locale === 'es' ? 'Rol' : 'Role'} *
          </Label>
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
                  </div>
                </Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <Label for="user-email" class="flex items-center gap-2">
              <Mail size={14} />
              Email
            </Label>
            <Input 
              id="user-email"
              type="email"
              bind:value={userForm.email}
              placeholder="email@ejemplo.com"
              class="bg-input/50"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="user-phone" class="flex items-center gap-2">
              <Phone size={14} />
              {$locale === 'es' ? 'Teléfono' : 'Phone'}
            </Label>
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
              {userForm.isActive 
                ? ($locale === 'es' ? 'Usuario activo' : 'User active')
                : ($locale === 'es' ? 'Usuario inactivo' : 'User inactive')}
            </Label>
          </div>
        </div>
        
        {#if editingUser?.lastLogin}
          <div class="text-xs text-muted-foreground pt-2 border-t border-border flex items-center gap-1">
            <Clock size={12} />
            {$locale === 'es' ? 'Último acceso:' : 'Last login:'} {new Date(editingUser.lastLogin).toLocaleString()}
          </div>
        {/if}
      </div>

      <div class="p-4 border-t border-border flex gap-3">
        {#if editingUser && (!editingUser.email || editingUser.email !== $firebaseUserEmail)}
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
          {$locale === 'es' ? 'Cancelar' : 'Cancel'}
        </button>
        <button 
          on:click={saveUser}
          disabled={!userForm.username?.trim() || !userForm.displayName?.trim() || !userForm.pin || !userForm.roleId}
          class="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-colors"
        >
          <Check size={18} />
          {$locale === 'es' ? 'Guardar' : 'Save'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Delete User Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteUserDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{$locale === 'es' ? 'Eliminar Usuario' : 'Delete User'}</AlertDialog.Title>
      <AlertDialog.Description>
        {$locale === 'es' 
          ? `¿Estás seguro de eliminar a "${userToDelete?.displayName}"? Esta acción no se puede deshacer.`
          : `Are you sure you want to delete "${userToDelete?.displayName}"? This action cannot be undone.`}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={() => { deleteUserDialogOpen = false; userToDelete = null; }}>
        {$locale === 'es' ? 'Cancelar' : 'Cancel'}
      </AlertDialog.Cancel>
      <AlertDialog.Action class="bg-destructive text-destructive-foreground hover:bg-destructive/90" on:click={executeDeleteUser}>
        {$locale === 'es' ? 'Eliminar' : 'Delete'}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<!-- Send Invite Modal -->
<Dialog.Root bind:open={showInviteModal}>
  <Dialog.Content class="sm:max-w-xl">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <Send size={20} />
        {$locale === 'es' ? 'Enviar Invitación' : 'Send Invite'}
      </Dialog.Title>
      <Dialog.Description>
        {$locale === 'es' 
          ? `Invita a ${inviteUser?.displayName} a crear una cuenta completa para acceder desde cualquier dispositivo.`
          : `Invite ${inviteUser?.displayName} to create a full account for access from any device.`}
      </Dialog.Description>
    </Dialog.Header>
    
    {#if inviteSuccess}
      <!-- Success State -->
      <div class="py-6 text-center space-y-4">
        <div class="w-16 h-16 rounded-full bg-emerald-500/20 mx-auto flex items-center justify-center">
          <CheckCircle2 size={32} class="text-emerald-500" />
        </div>
        <div>
          <h3 class="font-semibold text-lg">
            {$locale === 'es' ? '¡Enlace de Invitación Listo!' : 'Invite Link Ready!'}
          </h3>
          <p class="text-sm text-muted-foreground mt-1">
            {$locale === 'es' 
              ? `Comparte este enlace con ${inviteEmail} por WhatsApp, email u otro medio.`
              : `Share this link with ${inviteEmail} via WhatsApp, email or other means.`}
          </p>
        </div>
        
        <!-- Copy Link Section -->
        <div class="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
          <p class="text-sm font-medium text-primary">
            {$locale === 'es' 
              ? 'Enlace de invitación:'
              : 'Invite link:'}
          </p>
          <div class="flex gap-2">
            <input 
              type="text" 
              readonly 
              value={inviteLink}
              class="flex-1 text-xs bg-background border border-border rounded px-2 py-1.5 truncate"
            />
            <Button 
              variant="outline" 
              size="sm" 
              on:click={copyInviteLink}
              class="flex-shrink-0"
            >
              {#if copiedLink}
                <Check size={14} class="mr-1" />
                {$locale === 'es' ? 'Copiado' : 'Copied'}
              {:else}
                <Copy size={14} class="mr-1" />
                {$locale === 'es' ? 'Copiar' : 'Copy'}
              {/if}
            </Button>
          </div>
        </div>
      </div>
      
      <Dialog.Footer>
        <Button on:click={closeInviteModal}>
          {$locale === 'es' ? 'Cerrar' : 'Close'}
        </Button>
      </Dialog.Footer>
    {:else}
      <!-- Form State -->
      <div class="space-y-4 py-4">
        {#if inviteError}
          <div class="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2">
            <AlertTriangle size={16} />
            {inviteError}
          </div>
        {/if}
        
        <div class="space-y-2">
          <Label for="invite-email">{$locale === 'es' ? 'Email del Usuario' : 'User Email'}</Label>
          <Input 
            id="invite-email"
            type="email"
            bind:value={inviteEmail}
            placeholder="email@ejemplo.com"
            disabled={inviteSending}
          />
          <p class="text-xs text-muted-foreground">
            {$locale === 'es' 
              ? 'Se generará un enlace que puedes compartir por WhatsApp, email u otro medio.'
              : 'A link will be generated that you can share via WhatsApp, email or other means.'}
          </p>
        </div>
        
        <!-- Info about what happens -->
        <div class="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
          <h4 class="text-sm font-medium text-primary">
            {$locale === 'es' ? '¿Qué incluye la cuenta completa?' : 'What does full access include?'}
          </h4>
          <ul class="text-xs text-muted-foreground space-y-1">
            <li class="flex items-center gap-2">
              <Check size={12} class="text-emerald-500" />
              {$locale === 'es' ? 'Acceso desde cualquier dispositivo' : 'Access from any device'}
            </li>
            <li class="flex items-center gap-2">
              <Check size={12} class="text-emerald-500" />
              {$locale === 'es' ? 'Login con email y contraseña' : 'Login with email and password'}
            </li>
            <li class="flex items-center gap-2">
              <Check size={12} class="text-emerald-500" />
              {$locale === 'es' ? 'Mantiene los mismos permisos de su rol' : 'Keeps same role permissions'}
            </li>
            <li class="flex items-center gap-2">
              <Check size={12} class="text-emerald-500" />
              {$locale === 'es' ? 'PIN sigue funcionando para POS rápido' : 'PIN still works for quick POS access'}
            </li>
          </ul>
        </div>
      </div>
      
      <Dialog.Footer class="flex gap-2">
        <Button variant="outline" on:click={closeInviteModal} disabled={inviteSending}>
          {$locale === 'es' ? 'Cancelar' : 'Cancel'}
        </Button>
        <Button 
          on:click={() => sendInvite(false)} 
          disabled={inviteSending || !inviteEmail}
        >
          {#if inviteSending}
            <Loader2 size={16} class="mr-2 animate-spin" />
            {$locale === 'es' ? 'Generando...' : 'Generating...'}
          {:else}
            <Link size={16} class="mr-2" />
            {$locale === 'es' ? 'Generar Enlace' : 'Generate Link'}
          {/if}
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>

