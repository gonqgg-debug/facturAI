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
    firebaseUser
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
    AlertTriangle
  } from 'lucide-svelte';

  // State
  let loading = true;
  let submitting = false;
  let error = '';
  let success = false;
  
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
          error = 'Error al cargar los datos del usuario. Por favor intenta recargar la página.';
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
      // Create Firebase account
      const firebaseUserResult = await signUpWithEmail(email, password);
      
      // Accept invite and link accounts
      await acceptInvite(token, firebaseUserResult.uid);
      
      // Log in with the new account
      await loginWithFirebase({
        email: firebaseUserResult.email,
        displayName: firebaseUserResult.displayName || user?.displayName || null,
        uid: firebaseUserResult.uid
      });
      
      success = true;
      
      // Redirect to login after short delay
      setTimeout(() => {
        goto('/login');
      }, 2000);
    } catch (e: any) {
      console.error('Sign up failed:', e);
      error = e.message || 'Error al crear la cuenta. Por favor intenta de nuevo.';
    } finally {
      submitting = false;
    }
  }

  async function handleGoogleSignUp() {
    if (!invite || !token) return;
    
    submitting = true;
    error = '';
    
    try {
      // Sign in with Google
      const firebaseUserResult = await signInWithGoogle();
      
      // Check if email matches invite
      if (firebaseUserResult.email?.toLowerCase() !== invite.email.toLowerCase()) {
        error = `Por favor usa la cuenta de Google asociada a ${invite.email}`;
        submitting = false;
        return;
      }
      
      // Accept invite and link accounts
      await acceptInvite(token, firebaseUserResult.uid);
      
      // Log in with the new account
      await loginWithFirebase({
        email: firebaseUserResult.email,
        displayName: firebaseUserResult.displayName,
        uid: firebaseUserResult.uid
      });
      
      success = true;
      
      // Redirect to login after short delay
      setTimeout(() => {
        goto('/login');
      }, 2000);
    } catch (e: any) {
      console.error('Google sign up failed:', e);
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

<div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
  <div class="w-full max-w-md">
    {#if loading}
      <!-- Loading State -->
      <div class="bg-card border border-border rounded-2xl p-8 text-center">
        <Loader2 size={48} class="mx-auto mb-4 text-primary animate-spin" />
        <p class="text-muted-foreground">Verificando invitación...</p>
      </div>
    {:else if success}
      <!-- Success State -->
      <div class="bg-card border border-border rounded-2xl p-8 text-center">
        <div class="w-16 h-16 rounded-full bg-emerald-500/20 mx-auto mb-4 flex items-center justify-center">
          <CheckCircle2 size={32} class="text-emerald-500" />
        </div>
        <h1 class="text-2xl font-bold mb-2">¡Cuenta Creada!</h1>
        <p class="text-muted-foreground mb-4">
          Tu cuenta ha sido creada exitosamente. Serás redirigido al inicio de sesión...
        </p>
        <Loader2 size={24} class="mx-auto text-primary animate-spin" />
      </div>
    {:else if error}
      <!-- Error State (invalid invite or missing email) -->
      <div class="bg-card border border-border rounded-2xl p-8 text-center shadow-xl">
        {#if error.includes('email')}
          <!-- Manual Email Entry for Link Sign-in -->
          <div class="w-16 h-16 rounded-full bg-primary/20 mx-auto mb-4 flex items-center justify-center">
            <Mail size={32} class="text-primary" />
          </div>
          <h1 class="text-2xl font-bold mb-2">Completar Registro</h1>
          <p class="text-muted-foreground mb-6">
            Por seguridad, necesitamos que ingreses tu email para confirmar que eres tú.
          </p>
          
          <div class="space-y-4 text-left">
            <div class="space-y-1.5">
              <Label for="manual-email">Tu Email</Label>
              <Input 
                id="manual-email"
                type="email"
                bind:value={manualEmail}
                placeholder="ejemplo@email.com"
                class="bg-input/50"
              />
            </div>
            <button 
              on:click={handleManualEmailSignIn}
              disabled={!manualEmail || !manualEmail.includes('@')}
              class="w-full bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-3 rounded-xl font-bold transition-colors"
            >
              Confirmar y Continuar
            </button>
          </div>
        {:else}
          <!-- Real Error -->
          <div class="w-16 h-16 rounded-full bg-destructive/20 mx-auto mb-4 flex items-center justify-center">
            <XCircle size={32} class="text-destructive" />
          </div>
          <h1 class="text-2xl font-bold mb-2">Invitación Inválida</h1>
          <p class="text-muted-foreground mb-6">{error}</p>
          <a 
            href="/login" 
            class="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Ir a Iniciar Sesión
          </a>
        {/if}
      </div>
    {:else if invite && user}
      <!-- Invite Form -->
      <div class="bg-card border border-border rounded-2xl overflow-hidden">
        <!-- Header -->
        <div class="bg-primary/10 border-b border-border p-6 text-center">
          <div class="w-16 h-16 rounded-full bg-primary/20 mx-auto mb-4 flex items-center justify-center">
            <UserPlus size={32} class="text-primary" />
          </div>
          <h1 class="text-2xl font-bold mb-1">Únete al Equipo</h1>
          <p class="text-muted-foreground">
            Has sido invitado a unirte como miembro del equipo
          </p>
        </div>

        <!-- Invite Info -->
        <div class="p-6 border-b border-border bg-muted/30">
          <div class="grid gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Store size={20} class="text-primary" />
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Tienda</p>
                <p class="font-medium">Mini Market</p>
              </div>
            </div>
            
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield size={20} class="text-primary" />
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Tu Rol</p>
                <p class="font-medium">{role?.name || 'Usuario'}</p>
              </div>
            </div>
            
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Mail size={20} class="text-primary" />
              </div>
              <div>
                <p class="text-xs text-muted-foreground">Email</p>
                <p class="font-medium">{invite.email}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Sign Up Form -->
        <form on:submit|preventDefault={handleEmailSignUp} class="p-6 space-y-4">
          {#if error}
            <div class="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm flex items-center gap-2">
              <AlertTriangle size={16} />
              {error}
            </div>
          {/if}

          <div class="space-y-1.5">
            <Label for="email">Email</Label>
            <Input 
              id="email"
              type="email"
              value={email}
              disabled
              class="bg-muted/50"
            />
            <p class="text-xs text-muted-foreground">
              El email está predefinido por la invitación
            </p>
          </div>

          <div class="space-y-1.5">
            <Label for="password">Contraseña</Label>
            <Input 
              id="password"
              type="password"
              bind:value={password}
              placeholder="Mínimo 6 caracteres"
              disabled={submitting}
              class="bg-input/50"
            />
          </div>

          <div class="space-y-1.5">
            <Label for="confirmPassword">Confirmar Contraseña</Label>
            <Input 
              id="confirmPassword"
              type="password"
              bind:value={confirmPassword}
              placeholder="Repite la contraseña"
              disabled={submitting}
              class="bg-input/50"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !password || !confirmPassword}
            class="w-full bg-primary hover:bg-primary/90 disabled:bg-muted disabled:cursor-not-allowed text-primary-foreground px-4 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {#if submitting}
              <Loader2 size={18} class="animate-spin" />
              Creando cuenta...
            {:else}
              <UserPlus size={18} />
              Crear Cuenta
            {/if}
          </button>

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
            class="w-full bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-3 transition-colors border border-gray-200"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google
          </button>
        </form>

        <!-- Footer -->
        <div class="p-4 border-t border-border bg-muted/30 text-center">
          <p class="text-xs text-muted-foreground">
            Al crear tu cuenta, aceptas nuestros términos y condiciones.
          </p>
        </div>
      </div>
    {/if}
  </div>
</div>

