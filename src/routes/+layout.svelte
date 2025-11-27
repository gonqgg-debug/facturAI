<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { Home, Camera, CheckSquare, FileText, BookOpen, Settings, Tag, Package, Search, Sun, Moon, ChevronDown, ChevronRight, Users, X, ShoppingCart, ClipboardList, BarChart3, Receipt, Brain } from 'lucide-svelte';

  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { isAuthenticated, restoreSession, currentUser } from '$lib/auth';
  import { browser } from '$app/environment';
  import { db } from '$lib/db';
  import Fuse from 'fuse.js';
  import type { Product, Invoice } from '$lib/types';
  import { Input } from '$lib/components/ui/input';
  import { locale, isPosMode } from '$lib/stores';
  import { t, type Locale } from '$lib/i18n';

  // Grouped Navigation for Sidebar - labels will be reactive
  // Using stable keys for group identification
  // Reference $locale to make this reactive to locale changes
  $: sidebarGroups = [
    {
      key: 'sales',
      title: t('nav.sales', $locale as Locale),
      items: [
        { href: '/sales', labelKey: 'nav.pos', icon: ShoppingCart },
        { href: '/sales/orders', labelKey: 'nav.orders', icon: Receipt },
        { href: '/customers', labelKey: 'nav.customers', icon: Users }
      ]
    },
    {
      key: 'inputs',
      title: t('nav.inputs', $locale as Locale),
      items: [
        { href: '/capture', labelKey: 'nav.capture', icon: Camera },
        { href: '/validation', labelKey: 'nav.validate', icon: CheckSquare }
      ]
    },
    {
      key: 'inventory',
      title: t('nav.inventory', $locale as Locale),
      items: [
        { href: '/catalog', labelKey: 'nav.catalog', icon: Package },
        { href: '/pricing', labelKey: 'nav.pricing', icon: Tag },
        { href: '/inventory-adjustments', labelKey: 'nav.adjustments', icon: ClipboardList }
      ]
    },
    {
      key: 'finance',
      title: t('nav.finance', $locale as Locale),
      items: [
        { href: '/invoices', labelKey: 'nav.invoices', icon: FileText },
        { href: '/suppliers', labelKey: 'nav.suppliers', icon: Users },
        { href: '/reports', labelKey: 'nav.reports', icon: BarChart3 }
      ]
    },
    {
      key: 'resources',
      title: t('nav.resources', $locale as Locale),
      items: [
        { href: '/kb', labelKey: 'nav.kb', icon: BookOpen },
        { href: '/insights', labelKey: 'nav.insights', icon: Brain }
      ]
    },
    {
      key: 'system',
      title: t('nav.system', $locale as Locale),
      items: [
        { href: '/settings', labelKey: 'nav.settings', icon: Settings }
      ]
    }
  ];

  $: homeTab = { href: '/', labelKey: 'nav.home', icon: Home };
  
  // Flattened tabs for Mobile Nav
  $: tabs = [
    { href: homeTab.href, labelKey: homeTab.labelKey, icon: homeTab.icon },
    ...sidebarGroups.flatMap(g => g.items)
  ];

  let isDark = false;
  // Initialize all groups as collapsed by default (using stable keys)
  let expandedGroups: Record<string, boolean> = {};

  function toggleGroup(key: string) {
    expandedGroups[key] = !expandedGroups[key];
  }

  // Check if a nav item is active - exact match only
  // Since we have explicit nav items for sub-routes (like /sales and /sales/orders),
  // we only want exact matches to avoid highlighting parent routes
  function isNavItemActive(href: string, currentPath: string): boolean {
    return currentPath === href;
  }

  // Auto-expand the group containing the current route
  $: {
    const currentPath = $page.url.pathname;
    // Find which group contains the current route
    for (const group of sidebarGroups) {
      // For auto-expand, check if current path matches or starts with any item's href
      const hasActiveItem = group.items.some(item => 
        currentPath === item.href || currentPath.startsWith(item.href + '/')
      );
      if (hasActiveItem) {
        expandedGroups[group.key] = true;
      }
    }
  }

  onMount(() => {
    // Try to restore existing session (fire and forget)
    if (browser) {
      restoreSession();
    }
    
    const unsubscribe = isAuthenticated.subscribe(value => {
      if (!value && $page.url.pathname !== '/login') {
        goto('/login');
      } else if (value) {
        // Load search data when authenticated
        loadSearchData();
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

    // Load search data if already authenticated
    if ($isAuthenticated) {
      loadSearchData();
    }

    // Add click outside listener
    if (browser) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      unsubscribe();
      if (browser) {
        document.removeEventListener('click', handleClickOutside);
      }
    };
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

  // Search functionality
  let searchQuery = '';
  let searchResults: Array<{ type: 'product' | 'invoice'; item: Product | Invoice; score?: number }> = [];
  let showSearchResults = false;
  let searchTimeout: ReturnType<typeof setTimeout> | null = null;
  let products: Product[] = [];
  let invoices: Invoice[] = [];

  // Load data for search
  async function loadSearchData() {
    if (!browser || !db) return;
    
    try {
      [products, invoices] = await Promise.all([
        db.products.toArray(),
        db.invoices.toArray()
      ]);
    } catch (error) {
      console.error('Error loading search data:', error);
    }
  }

  // Perform search
  function performSearch(query: string) {
    if (!query.trim() || query.length < 2) {
      searchResults = [];
      showSearchResults = false;
      return;
    }

    const results: typeof searchResults = [];

    // Search products
    if (products.length > 0) {
      const productFuse = new Fuse(products, {
        keys: ['name', 'barcode', 'productId', 'category'],
        threshold: 0.4,
        includeScore: true
      });
      
      const productResults = productFuse.search(query).slice(0, 5);
      productResults.forEach(result => {
        results.push({
          type: 'product',
          item: result.item,
          score: result.score
        });
      });
    }

    // Search invoices
    if (invoices.length > 0) {
      const invoiceFuse = new Fuse(invoices, {
        keys: ['providerName', 'ncf', 'providerRnc'],
        threshold: 0.4,
        includeScore: true
      });
      
      const invoiceResults = invoiceFuse.search(query).slice(0, 5);
      invoiceResults.forEach(result => {
        results.push({
          type: 'invoice',
          item: result.item,
          score: result.score
        });
      });
    }

    // Sort by score (lower is better)
    results.sort((a, b) => (a.score || 1) - (b.score || 1));
    searchResults = results.slice(0, 8); // Limit to 8 results
    showSearchResults = searchResults.length > 0 && query.trim().length > 0;
  }

  // Debounced search
  $: if (searchQuery !== undefined) {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);
  }

  // Handle search result click
  function handleResultClick(result: typeof searchResults[0]) {
    if (result.type === 'product') {
      goto('/catalog');
    } else if (result.type === 'invoice') {
      goto('/invoices');
    }
    searchQuery = '';
    showSearchResults = false;
  }

  // Helper functions to get display text
  function getResultName(result: typeof searchResults[0]): string {
    if (result.type === 'product') {
      return (result.item as Product).name;
    } else {
      return (result.item as Invoice).providerName;
    }
  }

  function getResultSubtext(result: typeof searchResults[0]): string {
    if (result.type === 'product') {
      const product = result.item as Product;
      return product.category || 'Product';
    } else {
      const invoice = result.item as Invoice;
      return `NCF: ${invoice.ncf} • ${invoice.issueDate}`;
    }
  }

  // Close search results
  function closeSearch() {
    showSearchResults = false;
    searchQuery = '';
  }

  // Handle search input focus
  function handleSearchFocus() {
    if (searchQuery.trim().length >= 2 && searchResults.length > 0) {
      showSearchResults = true;
    }
  }

  // Handle escape key
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      closeSearch();
    }
  }

  // Handle click outside to close search results
  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const searchContainer = target.closest('[role="search"]');
    if (!searchContainer && showSearchResults) {
      showSearchResults = false;
    }
  }
</script>

{#if $isAuthenticated}
<div class="flex flex-col h-screen w-full overflow-hidden bg-background text-foreground transition-colors duration-300">
  
  <!-- Top Bar (Desktop/Tablet) - Hidden in POS mode -->
  {#if !$isPosMode}
  <header class="hidden md:flex fixed top-0 right-0 left-64 h-16 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border z-40 items-center px-6">
    <!-- Global Search - Centered -->
    <div class="relative flex-1 max-w-2xl mx-auto" role="search">
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10 pointer-events-none" size={18} />
        <Input 
          type="text" 
          bind:value={searchQuery}
          on:focus={handleSearchFocus}
          on:keydown={handleKeydown}
          placeholder={t('search.placeholder', $locale)} 
          class="pl-10 pr-10 bg-secondary"
        />
        {#if searchQuery}
          <button 
            on:click={closeSearch}
            class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors z-10"
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        {/if}
      </div>

      <!-- Search Results Dropdown - Using design system classes -->
      {#if showSearchResults && searchQuery.trim().length >= 2}
        <div class="absolute top-full left-0 right-0 mt-2 bg-popover text-popover-foreground border border-border rounded-md shadow-md max-h-96 overflow-y-auto z-50">
          <div class="p-1">
            {#if searchResults.length > 0}
              {#each searchResults as result}
                <button
                  on:click={() => handleResultClick(result)}
                  class="w-full text-left px-4 py-3 rounded-md hover:bg-accent hover:text-accent-foreground transition-colors flex items-start space-x-3 group focus:bg-accent focus:text-accent-foreground focus:outline-none"
                >
                  <div class="flex-shrink-0 mt-0.5">
                    {#if result.type === 'product'}
                      <Package class="text-primary" size={18} />
                    {:else}
                      <FileText class="text-primary" size={18} />
                    {/if}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                      {getResultName(result)}
                    </div>
                    <div class="text-xs text-muted-foreground mt-0.5">
                      {getResultSubtext(result)}
                    </div>
                  </div>
                </button>
              {/each}
            {:else}
              <div class="px-4 py-8 text-center text-muted-foreground">
                <p class="text-sm">{t('search.noResults', $locale)}</p>
                <p class="text-xs mt-1">{t('search.noResultsDescription', $locale)}</p>
              </div>
            {/if}
          </div>
        </div>
      {/if}
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
  {/if}

  <!-- Main Content -->
  <!-- Adjusts padding based on POS mode -->
  <main class="flex-1 overflow-y-auto {$isPosMode ? '' : 'pb-20 md:pb-0 md:pt-16 md:pl-64'} safe-bottom bg-background">
    <slot />
  </main>

  <!-- Mobile Bottom Tab Bar - Hidden in POS mode -->
  {#if !$isPosMode}
  <nav class="md:hidden fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-lg border-t border-border pb-safe safe-bottom z-50">
    <div class="flex justify-around items-center h-16 px-2 overflow-x-auto">
      {#each tabs as tab}
        <a 
          href={tab.href} 
          class="flex flex-col items-center justify-center min-w-[60px] h-full space-y-1 
                 {isNavItemActive(tab.href, $page.url.pathname) ? 'text-primary' : 'text-muted-foreground'}"
        >
          <svelte:component this={tab.icon} size={20} />
          <span class="text-[10px] font-medium truncate max-w-[60px]">{t(tab.labelKey, $locale)}</span>
        </a>
      {/each}
    </div>
  </nav>
  {/if}

  <!-- Tablet/Desktop Sidebar - Hidden in POS mode -->
  {#if !$isPosMode}
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
          <span class="font-medium text-sm">{t(homeTab.labelKey, $locale)}</span>
        </a>
      </div>

      {#each sidebarGroups as group}
        <div>
          <button 
            on:click={() => toggleGroup(group.key)}
            class="w-full px-4 mb-2 flex items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-primary transition-colors"
          >
            <span>{group.title}</span>
            {#if expandedGroups[group.key]}
              <ChevronDown size={14} />
            {:else}
              <ChevronRight size={14} />
            {/if}
          </button>
          
          {#if expandedGroups[group.key]}
            <div class="space-y-1">
              {#each group.items as tab}
                <a 
                  href={tab.href} 
                  class="flex items-center space-x-3 px-4 py-2 rounded-lg transition-all duration-200
                         {isNavItemActive(tab.href, $page.url.pathname) 
                           ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' 
                           : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}"
                >
                  <svelte:component this={tab.icon} size={18} />
                  <span class="font-medium text-sm">{t(tab.labelKey, $locale)}</span>
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
  {/if}
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
