<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { Mail, Lock, Eye, EyeOff } from 'lucide-svelte';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import { locale } from '$lib/stores';
  import { 
    isFirebaseAuthenticated,
    isFirebaseLoading,
    signInWithEmail, 
    signUpWithEmail, 
    signInWithGoogle,
    resetPassword,
    initializeFirebase
  } from '$lib/firebase';
  import { ensureStoreExists } from '$lib/device-auth';

  // Auth mode: 'signin' | 'signup' | 'reset'
  type AuthMode = 'signin' | 'signup' | 'reset';
  let authMode: AuthMode = 'signin';
  
  // Form state
  let email = '';
  let password = '';
  let confirmPassword = '';
  let error = '';
  let successMessage = '';
  let isLoading = false;
  let showPassword = false;
  let isDark = false;
  
  // Prevent double redirects
  let isRedirecting = false;

  // Handle successful authentication
  async function handleSuccessfulAuth() {
    if (isRedirecting) return;
    isRedirecting = true;
    
    console.log('[Login] Authentication successful, setting up...');
    
    // Try to setup store for sync (non-blocking)
    try {
      await ensureStoreExists();
      console.log('[Login] Store setup complete');
    } catch (err) {
      console.warn('[Login] Store setup failed (sync disabled):', err);
    }
    
    // Redirect to dashboard
    console.log('[Login] Redirecting to dashboard...');
    window.location.href = '/dashboard';
  }

  // Reactive: redirect when Firebase is authenticated
  $: if ($isFirebaseAuthenticated && !isRedirecting && browser && !$isFirebaseLoading) {
    console.log('[Login] Firebase auth detected, redirecting...');
    handleSuccessfulAuth();
  }

  onMount(() => {
    console.log('[Login] Page mounted');
    
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
      }
    } catch (e) {
      console.warn('[Login] Theme setup failed:', e);
    }
  });

  // Sign in with email/password
  async function handleEmailSignIn() {
    if (!email || !password) {
      error = $locale === 'es' ? 'Ingresa tu email y contraseña' : 'Enter your email and password';
      return;
    }
    
    isLoading = true;
    error = '';
    
    try {
      console.log('[Login] Signing in with email...');
      await signInWithEmail(email, password);
      // Reactive statement will handle redirect
    } catch (err) {
      console.error('[Login] Sign in failed:', err);
      error = (err as Error).message;
      isLoading = false;
    }
  }

  // Sign up with email/password
  async function handleEmailSignUp() {
    if (!email || !password) {
      error = $locale === 'es' ? 'Ingresa tu email y contraseña' : 'Enter your email and password';
      return;
    }
    
    if (password !== confirmPassword) {
      error = $locale === 'es' ? 'Las contraseñas no coinciden' : 'Passwords do not match';
      return;
    }
    
    if (password.length < 6) {
      error = $locale === 'es' ? 'La contraseña debe tener al menos 6 caracteres' : 'Password must be at least 6 characters';
      return;
    }
    
    isLoading = true;
    error = '';
    
    try {
      console.log('[Login] Signing up with email...');
      await signUpWithEmail(email, password);
      // Reactive statement will handle redirect
    } catch (err) {
      console.error('[Login] Sign up failed:', err);
      error = (err as Error).message;
      isLoading = false;
    }
  }

  // Sign in with Google
  async function handleGoogleSignIn() {
    isLoading = true;
    error = '';
    
    try {
      console.log('[Login] Signing in with Google...');
      await signInWithGoogle();
      // Reactive statement will handle redirect
    } catch (err) {
      console.error('[Login] Google sign in failed:', err);
      error = (err as Error).message;
      isLoading = false;
    }
  }

  // Password reset
  async function handlePasswordReset() {
    if (!email) {
      error = $locale === 'es' ? 'Ingresa tu email' : 'Enter your email';
      return;
    }
    
    isLoading = true;
    error = '';
    
    try {
      await resetPassword(email);
      successMessage = $locale === 'es' 
        ? 'Se envió un email para restablecer tu contraseña' 
        : 'Password reset email sent';
      authMode = 'signin';
    } catch (err) {
      error = (err as Error).message;
    } finally {
      isLoading = false;
    }
  }

  function switchMode(mode: AuthMode) {
    authMode = mode;
    error = '';
    successMessage = '';
  }
</script>

<svelte:head>
  <title>{$locale === 'es' ? 'Iniciar Sesión' : 'Sign In'} | Cuadra</title>
</svelte:head>

<!-- Show loading while Firebase initializes -->
{#if $isFirebaseLoading}
  <div class="min-h-screen flex items-center justify-center bg-background">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
{:else}
  <div class="min-h-screen flex items-center justify-center bg-background p-4">
    <div class="w-full max-w-md">
      <!-- Logo -->
      <div class="text-center mb-8">
        <div class="w-32 mx-auto mb-4">
          <img src={isDark ? "/cuadra_logo_white.png" : "/cuadra_logo.png"} alt="Cuadra" class="w-full h-auto object-contain" />
        </div>
        <p class="text-muted-foreground">
          {#if authMode === 'signin'}
            {$locale === 'es' ? 'Inicia sesión en tu tienda' : 'Sign in to your store'}
          {:else if authMode === 'signup'}
            {$locale === 'es' ? 'Crea tu cuenta' : 'Create your account'}
          {:else}
            {$locale === 'es' ? 'Restablecer contraseña' : 'Reset password'}
          {/if}
        </p>
      </div>

      <!-- Login Card -->
      <div class="bg-card text-card-foreground rounded-2xl p-8 shadow-lg border border-border">
        
        <!-- Success Message -->
        {#if successMessage}
          <div class="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-600 dark:text-green-400 text-sm">
            {successMessage}
          </div>
        {/if}

        <!-- Error Message -->
        {#if error}
          <div class="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
            {error}
          </div>
        {/if}

        <!-- Google Sign In Button -->
        {#if authMode !== 'reset'}
          <button
            type="button"
            on:click={handleGoogleSignIn}
            disabled={isLoading}
            class="w-full flex items-center justify-center gap-3 px-4 py-3 mb-6 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-border"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {$locale === 'es' ? 'Continuar con Google' : 'Continue with Google'}
          </button>

          <div class="relative mb-6">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-border"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-4 bg-card text-muted-foreground">
                {$locale === 'es' ? 'o con email' : 'or with email'}
              </span>
            </div>
          </div>
        {/if}

        <!-- Email Form -->
        <form on:submit|preventDefault={authMode === 'signin' ? handleEmailSignIn : authMode === 'signup' ? handleEmailSignUp : handlePasswordReset}>
          <!-- Email Input -->
          <div class="mb-4">
            <label for="email" class="block text-sm font-medium text-foreground mb-2">
              Email
            </label>
            <div class="relative">
              <Mail class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <Input
                id="email"
                type="email"
                bind:value={email}
                placeholder="tu@email.com"
                class="pl-10"
                disabled={isLoading}
              />
            </div>
          </div>

          <!-- Password Input (not for reset mode) -->
          {#if authMode !== 'reset'}
            <div class="mb-4">
              <label for="password" class="block text-sm font-medium text-foreground mb-2">
                {$locale === 'es' ? 'Contraseña' : 'Password'}
              </label>
              <div class="relative">
                <Lock class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  bind:value={password}
                  placeholder="••••••••"
                  class="pl-10 pr-10"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  on:click={() => showPassword = !showPassword}
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {#if showPassword}
                    <EyeOff size={18} />
                  {:else}
                    <Eye size={18} />
                  {/if}
                </button>
              </div>
            </div>
          {/if}

          <!-- Confirm Password (signup only) -->
          {#if authMode === 'signup'}
            <div class="mb-4">
              <label for="confirmPassword" class="block text-sm font-medium text-foreground mb-2">
                {$locale === 'es' ? 'Confirmar Contraseña' : 'Confirm Password'}
              </label>
              <div class="relative">
                <Lock class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  bind:value={confirmPassword}
                  placeholder="••••••••"
                  class="pl-10"
                  disabled={isLoading}
                />
              </div>
            </div>
          {/if}

          <!-- Forgot Password Link (signin only) -->
          {#if authMode === 'signin'}
            <div class="mb-4 text-right">
              <button
                type="button"
                on:click={() => switchMode('reset')}
                class="text-sm text-primary hover:text-primary/80"
              >
                {$locale === 'es' ? '¿Olvidaste tu contraseña?' : 'Forgot password?'}
              </button>
            </div>
          {/if}

          <!-- Submit Button -->
          <Button
            type="submit"
            disabled={isLoading}
            class="w-full py-3"
          >
            {#if isLoading}
              <span class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {$locale === 'es' ? 'Cargando...' : 'Loading...'}
              </span>
            {:else if authMode === 'signin'}
              {$locale === 'es' ? 'Iniciar Sesión' : 'Sign In'}
            {:else if authMode === 'signup'}
              {$locale === 'es' ? 'Crear Cuenta' : 'Create Account'}
            {:else}
              {$locale === 'es' ? 'Enviar Email' : 'Send Email'}
            {/if}
          </Button>
        </form>

        <!-- Mode Switch Links -->
        <div class="mt-6 text-center text-sm">
          {#if authMode === 'signin'}
            <span class="text-muted-foreground">
              {$locale === 'es' ? '¿No tienes cuenta?' : "Don't have an account?"}
            </span>
            <button
              type="button"
              on:click={() => switchMode('signup')}
              class="ml-2 text-primary hover:text-primary/80 font-medium"
            >
              {$locale === 'es' ? 'Regístrate' : 'Sign up'}
            </button>
          {:else}
            <button
              type="button"
              on:click={() => switchMode('signin')}
              class="text-primary hover:text-primary/80 font-medium"
            >
              {$locale === 'es' ? '← Volver a iniciar sesión' : '← Back to sign in'}
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
