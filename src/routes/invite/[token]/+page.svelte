<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { 
    validateInvite, 
    acceptInvite, 
    getStoredEmailForSignIn,
    isFirebaseSignInLink,
    completeEmailSignIn
  } from '$lib/team-invites';
  import { 
    signUpWithEmail, 
    signInWithGoogle,
    initializeFirebase,
    firebaseUser,
    firebaseSignOut
  } from '$lib/firebase';
  import { db } from '$lib/db';
  import type { TeamInvite, User, Role } from '$lib/types';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { 
    Mail, 
    Lock, 
    UserPlus, 
    CheckCircle2, 
    XCircle, 
    Loader2, 
    Shield,
    Store,
    AlertTriangle,
    KeyRound,
    Eye,
    EyeOff,
    Sparkles
  } from 'lucide-svelte';
  import { toast } from 'svelte-sonner';
  
  // Password visibility
  let showPassword = false;
  let showConfirmPassword = false;

  // State
  let loading = true;
  let submitting = false;
  let error = '';
  let success = false;
  let emailAlreadyExists = false; // Track if email is already registered
  
  // Invite data
  let invite: TeamInvite | null = null;
  let user: User | null = null;
  let role: Role | null = null;
  
  // Form data
  let email = '';
  let manualEmail = ''; // For when email link is detected but email is unknown
  let password = '';
  let confirmPassword = '';
  
  // Get token from URL
  $: token = $page.params.token;

  onMount(async () => {
    if (!browser) return;
    
    // Initialize Firebase
    initializeFirebase();
    
    // Check if this is a Firebase email link sign-in callback
    const currentUrl = window.location.href;
    console.log('[Invite] Current URL:', currentUrl);
    
    if (isFirebaseSignInLink(currentUrl)) {
      console.log('[Invite] Firebase sign-in link detected');
      await handleEmailLinkSignIn(currentUrl);
      return;
    }
    
    // Validate the invite token
    console.log('[Invite] Standard invite link detected');
    await loadInvite();
  });

  async function loadInvite() {
    loading = true;
    error = '';
    
    try {
      if (!token) {
        error = 'Token de invitación inválido.';
        loading = false;
        return;
      }
      
      console.log('[Invite] Loading invite for token:', token.slice(0, 8) + '...');
      // Don't enforce storeId when loading invite for display
      // Team members on new devices won't have a storeId yet
      invite = await validateInvite(token, false);
      
      if (!invite) {
        console.warn('[Invite] validateInvite returned null');
        error = 'Esta invitación no es válida o ha expirado.';
        loading = false;
        return;
      }
      
      console.log('[Invite] Invite loaded successfully:', invite.id);
      
      // Load user and role info (might have been cached by validateInvite)
      user = await db.users.get(invite.userId) ?? null;
      if (user) {
        console.log('[Invite] User loaded from cache:', user.id);
        role = await db.localRoles.get(user.roleId) ?? null;
        email = invite.email;
      } else {
        console.warn('[Invite] User not found in local cache after validation');
        // Try one more time after a short delay in case Dexie is slow
        await new Promise(r => setTimeout(r, 500));
        user = await db.users.get(invite.userId) ?? null;
        if (user) {
          role = await db.localRoles.get(user.roleId) ?? null;
          email = invite.email;
        } else {
          // User not in cache - this is common for new devices
          // Create a minimal user object so we can still show the form
          console.log('[Invite] Creating minimal user from invite data');
          user = {
            id: invite.userId,
            username: invite.email.split('@')[0],
            displayName: invite.email.split('@')[0],
            pin: '0000', // Will be set properly when account is created
            roleId: 1, // Default, will be updated from Supabase
            isActive: true
          };
          email = invite.email;
          
          // Try to fetch role name directly from Supabase
          try {
            const { getSupabase } = await import('$lib/supabase');
            const supabase = getSupabase();
            if (supabase) {
              // Try RPC first
              const { data: rpcData, error: rpcError } = await supabase
                .rpc('get_user_for_invite', { 
                  p_local_id: invite.userId, 
                  p_store_id: invite.storeId 
                });
              
              if (!rpcError && rpcData && rpcData.length > 0) {
                console.log('[Invite] Fetched user via RPC:', rpcData[0]);
                user = {
                  id: rpcData[0].local_id,
                  username: rpcData[0].username || invite.email.split('@')[0],
                  displayName: rpcData[0].display_name || invite.email.split('@')[0],
                  pin: rpcData[0].pin || '0000',
                  roleId: rpcData[0].role_id,
                  roleName: rpcData[0].role_name,
                  isActive: rpcData[0].is_active !== false
                };
                
                // Cache locally - handle potential PIN conflicts by clearing first
                try {
                  // Clear any existing users with same PIN to avoid constraint error
                  const existingWithPin = await db.users.where('pin').equals(user.pin).first();
                  if (existingWithPin && existingWithPin.id !== user.id) {
                    await db.users.delete(existingWithPin.id!);
                    console.log('[Invite] Removed conflicting user with same PIN');
                  }
                  await db.users.put(user);
                  console.log('[Invite] Cached user locally');
                } catch (cacheErr) {
                  console.warn('[Invite] Could not cache user locally:', cacheErr);
                  // Continue without caching - we still have the user object
                }
                
                // Try to get role
                if (rpcData[0].role_id) {
                  const { data: roleData } = await supabase
                    .rpc('get_role_for_invite', { 
                      p_local_id: rpcData[0].role_id, 
                      p_store_id: invite.storeId 
                    });
                  if (roleData && roleData.length > 0) {
                    role = {
                      id: roleData[0].local_id,
                      name: roleData[0].name,
                      description: roleData[0].description,
                      permissions: roleData[0].permissions || [],
                      isSystem: roleData[0].is_system
                    };
                    try {
                      await db.localRoles.put(role);
                      console.log('[Invite] Fetched and cached role:', role.name);
                    } catch (roleErr) {
                      console.warn('[Invite] Could not cache role locally:', roleErr);
                    }
                  }
                }
              } else {
                console.warn('[Invite] RPC failed or returned no data:', rpcError?.message);
              }
            }
          } catch (fetchErr) {
            console.warn('[Invite] Could not fetch user/role from Supabase:', fetchErr);
          }
        }
      }
    } catch (e) {
      console.error('[Invite] Failed to load invite:', e);
      error = 'Error al cargar la invitación.';
    } finally {
      loading = false;
    }
  }

  async function handleEmailLinkSignIn(url: string) {
    try {
      loading = true;
      error = '';
      
      // Get stored email from localStorage
      let storedEmail = getStoredEmailForSignIn();
      console.log('[Invite] Stored email in localStorage:', storedEmail);
      
      // If email not in localStorage, try to get it from the invite using the token
      if (!storedEmail && token) {
        console.log('[Invite] Email not in localStorage, fetching from invite via token...');
        const inviteData = await validateInvite(token, false);
        if (inviteData) {
          storedEmail = inviteData.email;
          console.log('[Invite] Found email from invite database:', storedEmail);
        }
      }
      
      if (!storedEmail) {
        console.log('[Invite] Email still unknown, checking invite status...');
        // Still no email, we need the user to enter it to complete sign-in
        loading = false;
        
        // Load the invite to see if it's even valid
        await loadInvite();
        
        // If loadInvite already set a critical error (e.g. expired or missing user), 
        // don't overwrite it with the email prompt.
        if (!error) {
          error = 'Por favor, ingresa tu email para completar el registro.';
        }
        return;
      }
      
      // Complete sign-in
      console.log('[Invite] Completing sign-in for email:', storedEmail);
      const firebaseUser = await completeEmailSignIn(storedEmail, url);
      console.log('[Invite] Firebase sign-in complete, uid:', firebaseUser.uid);
      
      // Load invite to accept it
      let inviteToAccept = await db.teamInvites
        .where('email')
        .equals(storedEmail.toLowerCase())
        .and(i => i.status === 'pending')
        .first();
      
      // Fallback: try to find by token if not found by email
      if (!inviteToAccept && token) {
        inviteToAccept = await validateInvite(token, false);
      }
      
      if (inviteToAccept) {
        console.log('[Invite] Accepting invite:', inviteToAccept.id);
        await acceptInvite(inviteToAccept.token, firebaseUser.uid);
        
        console.log('[Invite] Logging in with Firebase user...');
        await loginWithFirebase({ 
          email: firebaseUser.email, 
          displayName: firebaseUser.displayName,
          uid: firebaseUser.uid
        });
        
        success = true;
        loading = false;
        
        // Redirect to login after short delay
        setTimeout(() => {
          goto('/login');
        }, 2000);
      } else {
        console.warn('[Invite] No pending invite found for email:', storedEmail);
        error = 'No se encontró una invitación válida para este email.';
        loading = false;
      }
    } catch (e: any) {
      console.error('[Invite] Email link sign-in failed:', e);
      error = e.message || 'Error al completar el registro. Por favor intenta de nuevo.';
      loading = false;
    }
  }

  /**
   * Handle manual email entry for Firebase link sign-in
   */
  async function handleManualEmailSignIn() {
    if (!manualEmail || !manualEmail.includes('@')) {
      error = 'Por favor ingresa un email válido.';
      return;
    }
    
    // Store it and retry the link sign-in flow
    if (browser) {
      localStorage.setItem('emailForSignIn', manualEmail.trim());
      const currentUrl = window.location.href;
      await handleEmailLinkSignIn(currentUrl);
    }
  }

  async function handleEmailSignUp() {
    if (!invite || !token) return;
    
    // Validate form
    if (!password || password.length < 6) {
      error = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }
    
    if (password !== confirmPassword) {
      error = 'Las contraseñas no coinciden.';
      return;
    }
    
    submitting = true;
    error = '';
    
    try {
      console.log('[Invite] Creating Firebase account...');
      // Create Firebase account
      const firebaseUserResult = await signUpWithEmail(email, password);
      console.log('[Invite] Firebase account created:', firebaseUserResult.uid);
      
      // Accept invite and link accounts
      console.log('[Invite] Accepting invite...');
      await acceptInvite(token, firebaseUserResult.uid);
      console.log('[Invite] Invite accepted');
      
      // Sign out so user has to log in fresh (avoids race condition with layout)
      console.log('[Invite] Signing out...');
      await firebaseSignOut();
      console.log('[Invite] Signed out');
      
      success = true;
      
      // Redirect to login after short delay
      setTimeout(() => {
        goto('/login');
      }, 2000);
    } catch (e: any) {
      console.error('[Invite] Sign up failed:', e);
      // Check if email already exists - offer login instead
      if (e.message?.includes('ya está registrado') || e.code === 'auth/email-already-in-use') {
        emailAlreadyExists = true;
        error = 'Este email ya tiene una cuenta. Ingresa tu contraseña existente para vincular tu cuenta.';
      } else {
        error = e.message || 'Error al crear la cuenta. Por favor intenta de nuevo.';
      }
    } finally {
      submitting = false;
    }
  }
  
  async function handleExistingLogin() {
    if (!invite || !token || !password) return;
    
    submitting = true;
    error = '';
    
    try {
      console.log('[Invite] Signing in with existing account...');
      const { signInWithEmail } = await import('$lib/firebase');
      const firebaseUserResult = await signInWithEmail(email, password);
      console.log('[Invite] Sign-in successful:', firebaseUserResult.uid);
      
      // Accept invite and link accounts
      console.log('[Invite] Accepting invite...');
      await acceptInvite(token, firebaseUserResult.uid);
      console.log('[Invite] Invite accepted');
      
      // Sign out so user has to log in fresh
      console.log('[Invite] Signing out...');
      await firebaseSignOut();
      console.log('[Invite] Signed out');
      
      success = true;
      
      // Redirect to login after short delay
      setTimeout(() => {
        goto('/login');
      }, 2000);
    } catch (e: any) {
      console.error('[Invite] Login failed:', e);
      error = e.message || 'Contraseña incorrecta. Por favor intenta de nuevo.';
    } finally {
      submitting = false;
    }
  }

  async function handleGoogleSignUp() {
    if (!invite || !token) return;
    
    submitting = true;
    error = '';
    
    try {
      console.log('[Invite] Signing in with Google...');
      // Sign in with Google
      const firebaseUserResult = await signInWithGoogle();
      
      // Check if email matches invite
      if (firebaseUserResult.email?.toLowerCase() !== invite.email.toLowerCase()) {
        error = `Por favor usa la cuenta de Google asociada a ${invite.email}`;
        submitting = false;
        return;
      }
      
      console.log('[Invite] Google sign-in successful:', firebaseUserResult.uid);
      
      // Accept invite and link accounts
      console.log('[Invite] Accepting invite...');
      await acceptInvite(token, firebaseUserResult.uid);
      console.log('[Invite] Invite accepted');
      
      // Sign out so user has to log in fresh (avoids race condition with layout)
      console.log('[Invite] Signing out...');
      await firebaseSignOut();
      console.log('[Invite] Signed out');
      
      success = true;
      
      // Redirect to login after short delay
      setTimeout(() => {
        goto('/login');
      }, 2000);
    } catch (e: any) {
      console.error('[Invite] Google sign up failed:', e);
      if (e.message?.includes('cancelado') || e.message?.includes('cancelled')) {
        error = '';
      } else {
        error = e.message || 'Error al iniciar sesión con Google.';
      }
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Aceptar Invitación | Cuadra</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950/50 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
  <!-- Animated background elements -->
  <div class="absolute inset-0 overflow-hidden pointer-events-none">
    <div class="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-pulse"></div>
    <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style="animation-delay: 1s;"></div>
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl"></div>
  </div>
  
  <div class="w-full max-w-md relative z-10">
    {#if loading}
      <!-- Loading State -->
      <div class="bg-card/95 backdrop-blur-xl border border-white/10 rounded-3xl p-10 text-center shadow-2xl shadow-black/20">
        <div class="relative">
          <div class="w-20 h-20 mx-auto mb-6 relative">
            <div class="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-spin" style="animation-duration: 2s;"></div>
            <div class="absolute inset-1 bg-card rounded-full flex items-center justify-center">
              <Loader2 size={32} class="text-indigo-400 animate-spin" />
            </div>
          </div>
        </div>
        <p class="text-muted-foreground text-lg">Verificando invitación...</p>
      </div>
    {:else if success}
      <!-- Success State -->
      <div class="bg-card/95 backdrop-blur-xl border border-white/10 rounded-3xl p-10 text-center shadow-2xl shadow-black/20">
        <div class="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 mx-auto mb-6 flex items-center justify-center shadow-lg shadow-emerald-500/30 animate-bounce" style="animation-duration: 2s;">
          <CheckCircle2 size={48} class="text-white" />
        </div>
        <h1 class="text-3xl font-bold mb-3 bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">¡Cuenta Creada!</h1>
        <p class="text-muted-foreground mb-6 text-lg">
          Tu cuenta ha sido vinculada exitosamente.
        </p>
        <div class="flex items-center justify-center gap-2 text-emerald-400">
          <Loader2 size={20} class="animate-spin" />
          <span>Redirigiendo al inicio de sesión...</span>
        </div>
      </div>
    {:else if error}
      <!-- Error State (invalid invite or missing email) -->
      <div class="bg-card/95 backdrop-blur-xl border border-white/10 rounded-3xl p-10 text-center shadow-2xl shadow-black/20">
        {#if error.includes('email')}
          <!-- Manual Email Entry for Link Sign-in -->
          <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 mx-auto mb-6 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Mail size={36} class="text-white" />
          </div>
          <h1 class="text-2xl font-bold mb-3">Completar Registro</h1>
          <p class="text-muted-foreground mb-8">
            Por seguridad, necesitamos que ingreses tu email para confirmar que eres tú.
          </p>
          
          <div class="space-y-5 text-left">
            <div class="space-y-2">
              <Label for="manual-email" class="text-sm font-medium">Tu Email</Label>
              <div class="relative">
                <Mail class="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input 
                  id="manual-email"
                  type="email"
                  bind:value={manualEmail}
                  placeholder="ejemplo@email.com"
                  class="pl-11 h-12 bg-white/5 border-white/10 rounded-xl focus:border-indigo-500 focus:ring-indigo-500/20"
                />
              </div>
            </div>
            <button 
              on:click={handleManualEmailSignIn}
              disabled={!manualEmail || !manualEmail.includes('@')}
              class="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white px-6 py-3.5 rounded-xl font-semibold transition-all duration-200 shadow-lg shadow-indigo-500/25"
            >
              Confirmar y Continuar
            </button>
          </div>
        {:else}
          <!-- Real Error -->
          <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500 to-rose-500 mx-auto mb-6 flex items-center justify-center shadow-lg shadow-red-500/30">
            <XCircle size={40} class="text-white" />
          </div>
          <h1 class="text-2xl font-bold mb-3">Invitación Inválida</h1>
          <p class="text-muted-foreground mb-8 max-w-sm mx-auto">{error}</p>
          <a 
            href="/login" 
            class="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all duration-200 font-semibold shadow-lg shadow-indigo-500/25"
          >
            Ir a Iniciar Sesión
          </a>
        {/if}
      </div>
    {:else if invite && user}
      <!-- Invite Form -->
      <div class="bg-card/95 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-black/20">
        <!-- Header -->
        <div class="relative bg-gradient-to-br from-indigo-500/20 via-purple-500/10 to-transparent p-8 text-center border-b border-white/5">
          <div class="absolute top-4 right-4">
            <Sparkles size={20} class="text-indigo-400/50" />
          </div>
          <div class="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 mx-auto mb-5 flex items-center justify-center shadow-lg shadow-indigo-500/30 rotate-3 hover:rotate-0 transition-transform duration-300">
            <UserPlus size={36} class="text-white" />
          </div>
          <h1 class="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">Únete al Equipo</h1>
          <p class="text-muted-foreground text-lg">
            Has sido invitado a unirte como miembro del equipo
          </p>
        </div>

        <!-- Invite Info -->
        <div class="p-6 border-b border-white/5 bg-white/[0.02]">
          <div class="grid gap-4">
            <div class="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
                <Store size={22} class="text-blue-400" />
              </div>
              <div>
                <p class="text-xs text-muted-foreground uppercase tracking-wider">Tienda</p>
                <p class="font-semibold text-lg">Mini Market</p>
              </div>
            </div>
            
            <div class="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                <Shield size={22} class="text-amber-400" />
              </div>
              <div>
                <p class="text-xs text-muted-foreground uppercase tracking-wider">Tu Rol</p>
                <p class="font-semibold text-lg">{role?.name || 'Usuario'}</p>
              </div>
            </div>
            
            <div class="flex items-center gap-4 p-3 rounded-xl bg-white/5 border border-white/5">
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center">
                <Mail size={22} class="text-emerald-400" />
              </div>
              <div>
                <p class="text-xs text-muted-foreground uppercase tracking-wider">Email</p>
                <p class="font-semibold text-lg truncate max-w-[200px]">{invite.email}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Sign Up / Sign In Form -->
        <form on:submit|preventDefault={emailAlreadyExists ? handleExistingLogin : handleEmailSignUp} class="p-6 space-y-5">
          {#if error}
            <div class="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-3">
              <AlertTriangle size={18} class="flex-shrink-0" />
              <span>{error}</span>
            </div>
          {/if}

          <div class="space-y-2">
            <Label for="email" class="text-sm font-medium text-muted-foreground">Email</Label>
            <div class="relative">
              <Mail class="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input 
                id="email"
                type="email"
                value={email}
                disabled
                class="pl-11 h-12 bg-white/5 border-white/10 rounded-xl text-muted-foreground cursor-not-allowed"
              />
            </div>
            <p class="text-xs text-muted-foreground/70 pl-1">
              El email está predefinido por la invitación
            </p>
          </div>

          <div class="space-y-2">
            <Label for="password" class="text-sm font-medium">{emailAlreadyExists ? 'Tu Contraseña' : 'Crear Contraseña'}</Label>
            <div class="relative">
              <Lock class="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input 
                id="password"
                type={showPassword ? 'text' : 'password'}
                bind:value={password}
                placeholder={emailAlreadyExists ? 'Ingresa tu contraseña' : 'Mínimo 6 caracteres'}
                disabled={submitting}
                class="pl-11 pr-11 h-12 bg-white/5 border-white/10 rounded-xl focus:border-indigo-500 focus:ring-indigo-500/20"
              />
              <button
                type="button"
                on:click={() => showPassword = !showPassword}
                class="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {#if showPassword}
                  <EyeOff size={18} />
                {:else}
                  <Eye size={18} />
                {/if}
              </button>
            </div>
          </div>

          {#if !emailAlreadyExists}
            <div class="space-y-2">
              <Label for="confirmPassword" class="text-sm font-medium">Confirmar Contraseña</Label>
              <div class="relative">
                <Lock class="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input 
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  bind:value={confirmPassword}
                  placeholder="Repite la contraseña"
                  disabled={submitting}
                  class="pl-11 pr-11 h-12 bg-white/5 border-white/10 rounded-xl focus:border-indigo-500 focus:ring-indigo-500/20"
                />
                <button
                  type="button"
                  on:click={() => showConfirmPassword = !showConfirmPassword}
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {#if showConfirmPassword}
                    <EyeOff size={18} />
                  {:else}
                    <Eye size={18} />
                  {/if}
                </button>
              </div>
            </div>
          {/if}

          <button
            type="submit"
            disabled={submitting || !password || (!emailAlreadyExists && !confirmPassword)}
            class="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all duration-200 shadow-lg shadow-indigo-500/25 disabled:shadow-none mt-2"
          >
            {#if submitting}
              <Loader2 size={20} class="animate-spin" />
              {emailAlreadyExists ? 'Vinculando cuenta...' : 'Creando cuenta...'}
            {:else if emailAlreadyExists}
              <KeyRound size={20} />
              Iniciar Sesión y Vincular
            {:else}
              <UserPlus size={20} />
              Crear Cuenta
            {/if}
          </button>
          
          {#if emailAlreadyExists}
            <button
              type="button"
              on:click={() => { emailAlreadyExists = false; error = ''; password = ''; }}
              class="w-full text-sm text-muted-foreground hover:text-indigo-400 transition-colors py-2"
            >
              ← Volver a crear cuenta nueva
            </button>
          {/if}

          {#if !emailAlreadyExists}
            <div class="relative py-2">
              <div class="absolute inset-0 flex items-center">
                <span class="w-full border-t border-white/10" />
              </div>
              <div class="relative flex justify-center text-xs uppercase">
                <span class="bg-card px-4 text-muted-foreground/70">O continúa con</span>
              </div>
            </div>

            <button
              type="button"
              on:click={handleGoogleSignUp}
              disabled={submitting}
              class="w-full bg-white hover:bg-gray-100 disabled:bg-gray-200 disabled:cursor-not-allowed text-gray-900 px-6 py-3.5 rounded-xl font-medium flex items-center justify-center gap-3 transition-all duration-200 shadow-md"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continuar con Google
            </button>
          {/if}
        </form>

        <!-- Footer -->
        <div class="p-5 border-t border-white/5 bg-white/[0.02] text-center">
          <p class="text-xs text-muted-foreground/60">
            Al crear tu cuenta, aceptas nuestros términos y condiciones.
          </p>
        </div>
      </div>
    {/if}
  </div>
</div>

