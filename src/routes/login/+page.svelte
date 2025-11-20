<script lang="ts">
  import { isAuthenticated } from '$lib/auth';
  import { goto } from '$app/navigation';
  import { Lock } from 'lucide-svelte';

  let pin = '';
  let error = '';

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

<div class="h-screen flex flex-col items-center justify-center bg-ios-bg p-4">
  <div class="w-full max-w-sm bg-ios-card border border-ios-separator rounded-2xl p-8 text-center shadow-2xl">
    <div class="bg-ios-blue/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
      <Lock size={32} class="text-ios-blue" />
    </div>
    
    <h1 class="text-2xl font-bold text-white mb-2">FacturAI</h1>
    <p class="text-gray-400 mb-8">Enter access code to continue</p>
    
    <input 
      type="password" 
      bind:value={pin} 
      on:keydown={handleKeydown}
      placeholder="PIN" 
      class="w-full bg-black/50 border border-ios-separator rounded-xl px-4 py-3 text-center text-white text-lg tracking-widest focus:border-ios-blue outline-none mb-4"
      maxlength="4"
    />
    
    {#if error}
      <p class="text-red-500 text-sm mb-4">{error}</p>
    {/if}
    
    <button 
      on:click={handleLogin}
      class="w-full bg-ios-blue text-white font-bold py-3 rounded-xl hover:bg-blue-600 transition-colors"
    >
      Unlock
    </button>
  </div>
</div>
