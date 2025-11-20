```
<script>
  import '../app.css';
  import { page } from '$app/stores';
  import { Camera, CheckSquare, History, BookOpen, Settings, Tag } from 'lucide-svelte';

  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { isAuthenticated } from '$lib/auth';

  const tabs = [
    { href: '/capture', label: 'Capture', icon: Camera },
    { href: '/validation', label: 'Validate', icon: CheckSquare },
    { href: '/history', label: 'History', icon: History },
    { href: '/pricing', label: 'Pricing', icon: Tag },
    { href: '/kb', label: 'KB', icon: BookOpen },
    { href: '/settings', label: 'Settings', icon: Settings }
  ];

  onMount(() => {
    const unsubscribe = isAuthenticated.subscribe(value => {
      if (!value && $page.url.pathname !== '/login') {
        goto('/login');
      }
    });
    return unsubscribe;
  });
</script>

{#if $isAuthenticated}
<div class="flex flex-col h-screen w-full overflow-hidden bg-ios-bg">
  <!-- Main Content -->
  <main class="flex-1 overflow-y-auto pb-20 md:pb-0 md:pl-64 safe-bottom">
    <slot />
  </main>

  <!-- Mobile Bottom Tab Bar -->
  <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-ios-card/90 backdrop-blur-lg border-t border-ios-separator pb-safe safe-bottom z-50">
    <div class="flex justify-around items-center h-16">
      {#each tabs as tab}
        <a 
          href={tab.href} 
          class="flex flex-col items-center justify-center w-full h-full space-y-1 
                 {$page.url.pathname.startsWith(tab.href) ? 'text-ios-blue' : 'text-ios-gray'}"
        >
          <svelte:component this={tab.icon} size={24} />
          <span class="text-[10px] font-medium">{tab.label}</span>
        </a>
      {/each}
    </div>
  </nav>

  <!-- Tablet/Desktop Sidebar -->
  <aside class="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-ios-card border-r border-ios-separator p-4">
    <h1 class="text-2xl font-bold text-white mb-8 px-2">FacturAI</h1>
    <nav class="space-y-2">
      {#each tabs as tab}
        <a 
          href={tab.href} 
          class="flex items-center space-x-3 px-4 py-3 rounded-xl transition-colors
                 {$page.url.pathname.startsWith(tab.href) ? 'bg-ios-blue text-white' : 'text-ios-gray hover:bg-white/5'}"
        >
          <svelte:component this={tab.icon} size={20} />
          <span class="font-medium">{tab.label}</span>
        </a>
      {/each}
    </nav>
  </aside>
</div>
{:else}
  <slot />
{/if}

<style>
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom);
  }
</style>
