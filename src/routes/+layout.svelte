<script>
  import '../app.css';
  import { page } from '$app/stores';
  import { Home, Camera, CheckSquare, FileText, BookOpen, Settings, Tag, Package, Search, Sun, Moon, ChevronDown, ChevronRight, Users } from 'lucide-svelte';

  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { isAuthenticated } from '$lib/auth';

  // Grouped Navigation for Sidebar
  const sidebarGroups = [
    {
      title: 'Inputs',
      items: [
        { href: '/capture', label: 'Capture', icon: Camera },
        { href: '/validation', label: 'Validate', icon: CheckSquare }
      ]
    },
    {
      title: 'Inventory',
      items: [
        { href: '/catalog', label: 'Catalog', icon: Package },
        { href: '/pricing', label: 'Pricing', icon: Tag }
      ]
    },
    {
      title: 'Finance',
      items: [
        { href: '/history', label: 'Invoices', icon: FileText },
        { href: '/suppliers', label: 'Suppliers', icon: Users }
      ]
    },
    {
      title: 'Resources',
      items: [
        { href: '/kb', label: 'KB', icon: BookOpen }
      ]
    },
    {
      title: 'System',
      items: [
        { href: '/settings', label: 'Settings', icon: Settings }
      ]
    }
  ];

  const homeTab = { href: '/', label: 'Home', icon: Home };
  
  // Flattened tabs for Mobile Nav
  const tabs = [homeTab, ...sidebarGroups.flatMap(g => g.items)];

  let isDark = false;
  // Initialize all groups as collapsed by default
  /** @type {Record<string, boolean>} */
  let expandedGroups = sidebarGroups.reduce((/** @type {Record<string, boolean>} */ acc, g) => {
    acc[g.title] = false;
    return acc;
  }, /** @type {Record<string, boolean>} */ ({}));

  /** @param {string} title */
  function toggleGroup(title) {
    expandedGroups[title] = !expandedGroups[title];
  }

  onMount(() => {
    const unsubscribe = isAuthenticated.subscribe(value => {
      if (!value && $page.url.pathname !== '/login') {
        goto('/login');
      }
    });

    // Dark Mode Init
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      isDark = true;
    } else {
      document.documentElement.classList.remove('dark');
      isDark = false;
    }

    return unsubscribe;
  });

  function toggleTheme() {
    isDark = !isDark;
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    }
  }
</script>

{#if $isAuthenticated}
<div class="flex flex-col h-screen w-full overflow-hidden bg-background text-foreground transition-colors duration-300">
  
  <!-- Top Bar (Desktop/Tablet) -->
  <header class="hidden md:flex fixed top-0 right-0 left-64 h-16 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border z-40 items-center px-6 justify-between">
    <!-- Global Search -->
    <div class="relative w-full max-w-md">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
      <input 
        type="text" 
        placeholder="Search product or invoice" 
        class="w-full bg-secondary border border-input rounded-lg pl-10 pr-4 py-2 text-sm focus:border-primary outline-none transition-colors placeholder-muted-foreground text-foreground"
      />
    </div>

    <!-- Dark Mode Toggle -->
    <button on:click={toggleTheme} class="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors">
      {#if isDark}
        <Sun size={20} />
      {:else}
        <Moon size={20} />
      {/if}
    </button>
  </header>

  <!-- Main Content -->
  <!-- Added pt-16 to account for fixed Top Bar -->
  <main class="flex-1 overflow-y-auto pb-20 md:pb-0 md:pt-16 md:pl-64 safe-bottom bg-background">
    <slot />
  </main>

  <!-- Mobile Bottom Tab Bar -->
  <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-lg border-t border-border pb-safe safe-bottom z-50">
    <div class="flex justify-around items-center h-16 px-2 overflow-x-auto">
      {#each tabs as tab}
        <a 
          href={tab.href} 
          class="flex flex-col items-center justify-center min-w-[60px] h-full space-y-1 
                 {(tab.href === '/' ? $page.url.pathname === '/' : $page.url.pathname.startsWith(tab.href)) ? 'text-primary' : 'text-muted-foreground'}"
        >
          <svelte:component this={tab.icon} size={20} />
          <span class="text-[10px] font-medium truncate max-w-[60px]">{tab.label}</span>
        </a>
      {/each}
    </div>
  </nav>

  <!-- Tablet/Desktop Sidebar -->
  <aside class="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border p-4 overflow-y-auto">
    <div class="mb-6 px-2 flex justify-center">
      <img src={isDark ? "/2.svg" : "/1.svg"} alt="FacturAI" class="h-24 w-auto" />
    </div>
    
    <nav class="space-y-6">
      <!-- Home Standalone -->
      <div>
        <a 
          href={homeTab.href} 
          class="flex items-center space-x-3 px-4 py-2 rounded-lg transition-all duration-200
                 {($page.url.pathname === '/') 
                   ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                   : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}"
        >
          <svelte:component this={homeTab.icon} size={18} />
          <span class="font-medium text-sm">{homeTab.label}</span>
        </a>
      </div>

      {#each sidebarGroups as group}
        <div>
          <button 
            on:click={() => toggleGroup(group.title)}
            class="w-full px-4 mb-2 flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-primary transition-colors"
          >
            <span>{group.title}</span>
            {#if expandedGroups[group.title]}
              <ChevronDown size={14} />
            {:else}
              <ChevronRight size={14} />
            {/if}
          </button>
          
          {#if expandedGroups[group.title]}
            <div class="space-y-1">
              {#each group.items as tab}
                <a 
                  href={tab.href} 
                  class="flex items-center space-x-3 px-4 py-2 rounded-lg transition-all duration-200
                         {(tab.href === '/' ? $page.url.pathname === '/' : $page.url.pathname.startsWith(tab.href)) 
                           ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                           : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}"
                >
                  <svelte:component this={tab.icon} size={18} />
                  <span class="font-medium text-sm">{tab.label}</span>
                </a>
              {/each}
            </div>
          {/if}
        </div>
      {/each}
    </nav>

    <!-- Sidebar Footer / Settings could go here if not in group -->
    <div class="mt-auto pt-6 border-t border-border">
        <div class="px-4 flex items-center justify-between">
            <div class="text-xs text-muted-foreground">
                v0.0.1
            </div>
            <!-- Desktop Dark Toggle (Optional secondary location) -->
        </div>
    </div>
  </aside>
</div>
{:else}
  <slot />
{/if}

<style>
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom);
  }
  
  /* Hide scrollbar for mobile nav */
  nav::-webkit-scrollbar {
    display: none;
  }
</style>
