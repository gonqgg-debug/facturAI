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
  import { loginWithFirebase } from '$lib/auth';
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
  import { toast, Toaster } from 'svelte-sonner';
  
  // Password visibility
  let showPassword = false;
  let showConfirmPassword = false;

  // State
  let loading = true;
  let submitting = false;
  let error = '';
  let success = false;
  let emailAlreadyExists = false; // Track if email is already registered
  let isDark = false;
  
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
    
    // Setup dark mode
    try {
      const storedTheme = localStorage.getItem('theme');
      isDark = document.documentElement.classList.contains('dark') ||
        storedTheme === 'dark' ||
        (storedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches);
      
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (e) {
      console.warn('[Invite] Theme setup failed:', e);
    }
    
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
      toast.error('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    
    if (password !== confirmPassword) {
      error = 'Las contraseñas no coinciden.';
      toast.error('Las contraseñas no coinciden.');
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
      toast.success('¡Cuenta creada exitosamente!');
      
      // Redirect to login after short delay
      setTimeout(() => {
        goto('/login');
      }, 2000);
    } catch (e: any) {
      console.error('[Invite] Sign up failed:', e);
      // Check if email already exists - offer login instead
      if (e.message?.includes('ya está registrado') || e.code === 'auth/email-already-in-use') {
        emailAlreadyExists = true;
        // Don't set error - we want to show the form with login option instead
        error = '';
        toast.warning('Este email ya tiene una cuenta', {
          description: 'Ingresa tu contraseña existente para vincular tu cuenta.'
        });
      } else {
        error = e.message || 'Error al crear la cuenta. Por favor intenta de nuevo.';
        toast.error(error);
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
      toast.success('¡Cuenta vinculada exitosamente!');
      
      // Redirect to login after short delay
      setTimeout(() => {
        goto('/login');
      }, 2000);
    } catch (e: any) {
      console.error('[Invite] Login failed:', e);
      error = e.message || 'Contraseña incorrecta. Por favor intenta de nuevo.';
      toast.error(error);
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
        toast.error('Email incorrecto', {
          description: `Por favor usa la cuenta de Google asociada a ${invite.email}`
        });
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
      toast.success('¡Cuenta vinculada exitosamente!');
      
      // Redirect to login after short delay
      setTimeout(() => {
        goto('/login');
      }, 2000);
    } catch (e: any) {
      console.error('[Invite] Google sign up failed:', e);
      if (e.message?.includes('cancelado') || e.message?.includes('cancelled') || e.message?.includes('popup-closed')) {
        error = '';
        // Don't show toast for user-cancelled actions
      } else {
        error = e.message || 'Error al iniciar sesión con Google.';
        toast.error(error);
      }
    } finally {
      submitting = false;
    }
  }
</script>

<svelte:head>
  <title>Únete al Equipo | Cuadra</title>
</svelte:head>

<div class="min-h-screen bg-background flex items-center justify-center p-4">
  <div class="w-full max-w-md">
    <!-- Logo -->
    <div class="text-center mb-8">
      <div class="w-32 mx-auto mb-4">
        <img src={isDark ? "/cuadra_logo_white.png" : "/cuadra_logo.png"} alt="Cuadra" class="w-full h-auto object-contain" />
      </div>
      <p class="text-muted-foreground">
        {#if success}
          ¡Registro exitoso!
        {:else if loading}
          Verificando tu invitación...
        {:else}
          Configura tu acceso al equipo
        {/if}
      </p>
    </div>

    {#if loading}
      <!-- Loading State -->
      <div class="bg-card text-card-foreground rounded-2xl p-8 shadow-lg border border-border text-center">
        <Loader2 size={32} class="mx-auto mb-4 text-primary animate-spin" />
        <p class="text-muted-foreground">Verificando invitación...</p>
      </div>
    {:else if success}
      <!-- Success State -->
      <div class="bg-card text-card-foreground rounded-2xl p-8 shadow-lg border border-border text-center">
        <div class="w-16 h-16 rounded-full bg-green-500/10 mx-auto mb-4 flex items-center justify-center">
          <CheckCircle2 size={32} class="text-green-500" />
        </div>
        <h1 class="text-2xl font-bold mb-2">¡Cuenta Creada!</h1>
        <p class="text-muted-foreground mb-6">
          Tu cuenta ha sido vinculada exitosamente. Serás redirigido al inicio de sesión en un momento...
        </p>
        <div class="flex items-center justify-center gap-2 text-primary">
          <Loader2 size={18} class="animate-spin" />
          <span>Redirigiendo...</span>
        </div>
      </div>
    {:else if error}
      <!-- Error State -->
      <div class="bg-card text-card-foreground rounded-2xl p-8 shadow-lg border border-border text-center">
        {#if error.includes('email')}
          <!-- Manual Email Entry for Link Sign-in -->
          <div class="w-16 h-16 rounded-full bg-primary/10 mx-auto mb-4 flex items-center justify-center">
            <Mail size={32} class="text-primary" />
          </div>
          <h1 class="text-2xl font-bold mb-2">Completar Registro</h1>
          <p class="text-muted-foreground mb-6">
            Por seguridad, necesitamos que ingreses tu email para confirmar que eres tú.
          </p>
          
          <div class="space-y-4 text-left">
            <div class="space-y-2">
              <Label for="manual-email">Tu Email</Label>
              <Input 
                id="manual-email"
                type="email"
                bind:value={manualEmail}
                placeholder="ejemplo@email.com"
              />
            </div>
            <button 
              on:click={handleManualEmailSignIn}
              disabled={!manualEmail || !manualEmail.includes('@')}
              class="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-4 py-3 rounded-xl font-bold transition-all"
            >
              Confirmar y Continuar
            </button>
          </div>
        {:else}
          <!-- Real Error -->
          <div class="w-16 h-16 rounded-full bg-destructive/10 mx-auto mb-4 flex items-center justify-center">
            <XCircle size={32} class="text-destructive" />
          </div>
          <h1 class="text-2xl font-bold mb-2">Invitación Inválida</h1>
          <p class="text-muted-foreground mb-6">{error}</p>
          <a 
            href="/login" 
            class="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-bold"
          >
            Ir a Iniciar Sesión
          </a>
        {/if}
      </div>
    {:else if invite && user}
      <!-- Invite Form -->
      <div class="bg-card text-card-foreground rounded-2xl shadow-lg border border-border overflow-hidden">
        <!-- Invite Header Info -->
        <div class="p-6 border-b border-border bg-muted/30">
          <h2 class="text-lg font-bold mb-4 flex items-center gap-2">
            <UserPlus size={20} class="text-primary" />
            Invitación de equipo
          </h2>
          <div class="grid gap-3">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-background flex items-center justify-center border border-border">
                <Store size={16} class="text-primary" />
              </div>
              <div>
                <p class="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Tienda</p>
                <p class="text-sm font-medium">Mini Market</p>
              </div>
            </div>
            
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-background flex items-center justify-center border border-border">
                <Shield size={16} class="text-primary" />
              </div>
              <div>
                <p class="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Tu Rol</p>
                <p class="text-sm font-medium">{role?.name || 'Usuario'}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Sign Up / Sign In Form -->
        <form on:submit|preventDefault={emailAlreadyExists ? handleExistingLogin : handleEmailSignUp} class="p-8 space-y-6">
          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input 
              id="email"
              type="email"
              value={email}
              disabled
              class="bg-muted cursor-not-allowed"
            />
          </div>

          <div class="space-y-2">
            <Label for="password">{emailAlreadyExists ? 'Contraseña' : 'Crear Contraseña'}</Label>
            <div class="relative">
              <Lock class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input 
                id="password"
                type={showPassword ? 'text' : 'password'}
                bind:value={password}
                placeholder={emailAlreadyExists ? 'Ingresa tu contraseña' : 'Mínimo 6 caracteres'}
                disabled={submitting}
                class="pl-10 pr-10"
              />
              <button
                type="button"
                on:click={() => showPassword = !showPassword}
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
              <Label for="confirmPassword">Confirmar Contraseña</Label>
              <div class="relative">
                <Lock class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input 
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  bind:value={confirmPassword}
                  placeholder="Repite la contraseña"
                  disabled={submitting}
                  class="pl-10 pr-10"
                />
                <button
                  type="button"
                  on:click={() => showConfirmPassword = !showConfirmPassword}
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
            class="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white px-4 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20"
          >
            {#if submitting}
              <Loader2 size={20} class="animate-spin" />
              {emailAlreadyExists ? 'Vinculando...' : 'Creando cuenta...'}
            {:else}
              <UserPlus size={20} />
              {emailAlreadyExists ? 'Iniciar Sesión y Vincular' : 'Completar Registro'}
            {/if}
          </button>
          
          {#if emailAlreadyExists}
            <button
              type="button"
              on:click={() => { emailAlreadyExists = false; error = ''; password = ''; }}
              class="w-full text-sm text-primary hover:underline transition-colors"
            >
              ← Volver a crear cuenta nueva
            </button>
          {/if}

          {#if !emailAlreadyExists}
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <span class="w-full border-t border-border" />
              </div>
              <div class="relative flex justify-center text-xs uppercase">
                <span class="bg-card px-2 text-muted-foreground">O continúa con</span>
              </div>
            </div>

            <button
              type="button"
              on:click={handleGoogleSignUp}
              disabled={submitting}
              class="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 disabled:opacity-50 px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-3 transition-all border border-border"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google
            </button>
          {/if}
        </form>

        <!-- Footer -->
        <div class="p-6 border-t border-border bg-muted/20 text-center">
          <p class="text-xs text-muted-foreground">
            Al registrarte aceptas nuestros términos y condiciones.
          </p>
        </div>
      </div>
    {/if}
  </div>
</div>

<!-- Toast Notifications -->
<Toaster richColors position="top-center" />
