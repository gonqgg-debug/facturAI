<script lang="ts">
  import { isAuthenticated } from '$lib/auth';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { Lock } from 'lucide-svelte';
  import { Input } from '$lib/components/ui/input';

  let pin = '';
  let error = '';
  let isDark = false;

  onMount(() => {
    // Check theme on mount
    isDark = document.documentElement.classList.contains('dark') || 
             localStorage.theme === 'dark' || 
             (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    
    // Apply dark class if needed (for standalone login page access)
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  });

  function handleLogin() {
    if (isAuthenticated.login(pin)) {
      goto('/capture');
    } else {
      error = 'Invalid Access Code';
      pin = '';
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleLogin();
  }
</script>

<div class="h-screen flex flex-col items-center justify-center bg-background p-4 transition-colors">
  <div class="w-full max-w-sm bg-card border border-border rounded-2xl p-8 text-center shadow-2xl transition-colors">
    <div class="w-80 h-80 mx-auto mb-6">
      <img src={isDark ? "/2.svg" : "/1.svg"} alt="FacturAI Logo" class="w-full h-full object-contain" />
    </div>
    
    <h1 class="text-2xl font-bold text-foreground mb-2">FacturAI</h1>
    <p class="text-muted-foreground mb-8">Enter access code to continue</p>
    
    <Input 
      type="password" 
      bind:value={pin} 
      on:keydown={handleKeydown}
      placeholder="PIN" 
      class="h-12 text-center text-lg tracking-widest bg-secondary rounded-xl mb-4"
      maxlength="4"
    />
    
    {#if error}
      <p class="text-destructive text-sm mb-4">{error}</p>
    {/if}
    
    <button 
      on:click={handleLogin}
      class="w-full bg-primary text-primary-foreground font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors"
    >
      Unlock
    </button>
  </div>
</div>
