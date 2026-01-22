<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import { Home, Camera, CheckSquare, FileText, BookOpen, Settings, Tag, Package, Search, Sun, Moon, ChevronDown, ChevronRight, Users, X, ShoppingCart, ClipboardList, BarChart3, Receipt, Brain, FileCheck, Zap, RefreshCw, User, UsersRound, CreditCard, Landmark, History } from 'lucide-svelte';

  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';
  import { db } from '$lib/db';
  import { initializeFirebase, trackScreenView, trackLogin, isFirebaseAuthenticated, isFirebaseLoading, firebaseAuth, firebaseUserEmail, getCurrentUser } from '$lib/firebase';
  import { loginWithFirebase } from '$lib/auth';
  import { initializeSyncService, triggerSync } from '$lib/sync-service';
  import { initializeRealtimeService, stopRealtimeService } from '$lib/realtime-service';
  import { initializeDeviceAuth, ensureStoreExists, signalStoreReady } from '$lib/device-auth';
  import { isSyncing, syncMessage, hasPendingChanges } from '$lib/sync-store';
  import { currentRole, userPermissions, hasPermission } from '$lib/auth';
  import type { PermissionKey } from '$lib/types';
  import Fuse from 'fuse.js';
  import type { Product, Invoice } from '$lib/types';
  import { Input } from '$lib/components/ui/input';
  import { locale, isPosMode } from '$lib/stores';
  import { t, type Locale } from '$lib/i18n';
  import { Toaster } from 'svelte-sonner';
  import { toast } from 'svelte-sonner';
  import { injectAnalytics } from '@vercel/analytics/sveltekit';

  // Initialize Vercel Analytics
  injectAnalytics();

  // Route to permission mapping
  const routePermissions: Record<string, PermissionKey> = {
    '/sales': 'pos.access',
    '/sales/orders': 'pos.access',
    '/customers': 'customers.view',
    '/purchases': 'invoices.view',
    '/purchases/orders': 'invoices.view',
    '/purchases/receiving': 'inventory.adjust',
    '/capture': 'invoices.capture',
    '/purchases/history': 'invoices.view',
    '/suppliers': 'invoices.view',
    '/catalog': 'catalog.view',
    '/pricing': 'catalog.edit',
    '/inventory-adjustments': 'inventory.adjust',
    '/reports': 'reports.view',
    '/reports/financial': 'reports.view',
    '/card-settlements': 'reports.view',
    '/reports/journal': 'reports.view',
    '/reports/audit': 'reports.view',
    '/reports/dgii': 'reports.view',
    '/invoices': 'invoices.view',
    '/settings/ncf': 'settings.view',
    '/team': 'users.manage',
    '/settings': 'settings.view',
    '/settings/receipt': 'settings.view',
    '/import-history': 'catalog.import',
    '/account': 'settings.view' // Everyone can access their own account
  };

  // Grouped Navigation for Sidebar - labels will be reactive
  // Using stable keys for group identification
  // Reference $locale to make this reactive to locale changes
  $: allSidebarGroups = [
    {
      key: 'sales',
      title: t('nav.sales', $locale as Locale),
      items: [
        { href: '/sales', labelKey: 'nav.pos', icon: ShoppingCart, permission: 'pos.access' as PermissionKey },
        { href: '/sales/orders', labelKey: 'nav.orders', icon: Receipt, permission: 'pos.access' as PermissionKey },
        { href: '/customers', labelKey: 'nav.customers', icon: Users, permission: 'customers.view' as PermissionKey }
      ]
    },
    {
      key: 'purchases',
      title: t('nav.purchases', $locale as Locale),
      items: [
        { href: '/purchases', labelKey: 'nav.purchasingHub', icon: ClipboardList, permission: 'invoices.view' as PermissionKey },
        { href: '/purchases/orders', labelKey: 'nav.purchaseOrders', icon: FileCheck, permission: 'invoices.view' as PermissionKey },
        { href: '/purchases/receiving', labelKey: 'nav.receiving', icon: Package, permission: 'inventory.adjust' as PermissionKey },
        { href: '/purchases/vault', labelKey: 'nav.invoiceVault', icon: Camera, permission: 'invoices.view' as PermissionKey },
        { href: '/capture', labelKey: 'nav.quickCapture', icon: Zap, permission: 'invoices.capture' as PermissionKey },
        { href: '/purchases/history', labelKey: 'nav.purchaseHistory', icon: BarChart3, permission: 'invoices.view' as PermissionKey },
        { href: '/suppliers', labelKey: 'nav.suppliers', icon: Users, permission: 'invoices.view' as PermissionKey }
      ]
    },
    {
      key: 'inventory',
      title: t('nav.inventory', $locale as Locale),
      items: [
        { href: '/catalog', labelKey: 'nav.catalog', icon: Package, permission: 'catalog.view' as PermissionKey },
        { href: '/pricing', labelKey: 'nav.pricing', icon: Tag, permission: 'catalog.edit' as PermissionKey },
        { href: '/inventory-adjustments', labelKey: 'nav.adjustments', icon: ClipboardList, permission: 'inventory.adjust' as PermissionKey }
      ]
    },
    {
      key: 'finance',
      title: t('nav.finance', $locale as Locale),
      items: [
        { href: '/reports', labelKey: 'nav.businessAnalytics', icon: BarChart3, permission: 'reports.view' as PermissionKey },
        { href: '/reports/financial', labelKey: 'nav.financialReports', icon: Landmark, permission: 'reports.view' as PermissionKey },
        { href: '/card-settlements', labelKey: 'nav.bankReconciliation', icon: CreditCard, permission: 'reports.view' as PermissionKey },
        { href: '/reports/journal', labelKey: 'nav.accountingJournal', icon: BookOpen, permission: 'reports.view' as PermissionKey },
        { href: '/reports/audit', labelKey: 'nav.auditLog', icon: History, permission: 'reports.view' as PermissionKey }
      ]
    },
    {
      key: 'taxes',
      title: t('nav.taxes', $locale as Locale),
      items: [
        { href: '/reports/dgii', labelKey: 'nav.dgiiReports', icon: FileCheck, permission: 'reports.view' as PermissionKey },
        { href: '/invoices', labelKey: 'nav.purchaseInvoices', icon: FileText, permission: 'invoices.view' as PermissionKey },
        { href: '/settings/ncf', labelKey: 'nav.ncf', icon: FileCheck, permission: 'settings.view' as PermissionKey }
      ]
    },
    {
      key: 'resources',
      title: t('nav.resources', $locale as Locale),
      items: [
        { href: '/kb', labelKey: 'nav.kb', icon: BookOpen, permission: undefined }, // No permission required
        { href: '/insights', labelKey: 'nav.insights', icon: Brain, permission: undefined } // No permission required
      ]
    },
    {
      key: 'system',
      title: t('nav.system', $locale as Locale),
      items: [
        { href: '/team', labelKey: 'nav.team', icon: UsersRound, permission: 'users.manage' as PermissionKey },
        { href: '/import-history', labelKey: 'nav.importHistory', icon: History, permission: 'catalog.import' as PermissionKey },
        { href: '/settings/receipt', labelKey: 'nav.receiptSettings', icon: Receipt, permission: 'settings.view' as PermissionKey },
        { href: '/settings', labelKey: 'nav.settings', icon: Settings, permission: 'settings.view' as PermissionKey },
        { href: '/account', labelKey: 'nav.account', icon: User, permission: undefined } // Everyone can access
      ]
    }
  ];

  // Check if role has permissions loaded (fallback: treat as admin if not)
  $: hasRolePermissions = $currentRole?.permissions && $currentRole.permissions.length > 0;

  // Filter sidebar groups based on permissions
  $: sidebarGroups = allSidebarGroups.map(group => ({
    ...group,
    items: group.items.filter(item => {
      // If no permission required, show it
      if (!item.permission) return true;
      // If role not loaded or has no permissions, show all (treat as admin)
      if (!hasRolePermissions) return true;
      // Check if user has the required permission
      return hasPermission(item.permission);
    })
  })).filter(group => group.items.length > 0); // Remove empty groups

  // Check if user is cashier (Cajero role) - only if role is properly loaded
  $: isCashierMode = hasRolePermissions && $currentRole?.name === 'Cajero';

  $: homeTab = { href: '/dashboard', labelKey: 'nav.home', icon: Home };
  
  // Flattened tabs for Mobile Nav (filtered by permissions)
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

  // Public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/en'];
  
  // Check if current route is public (including dynamic routes like /invite/[token])
  $: isPublicRoute = publicRoutes.includes($page.url.pathname) || $page.url.pathname.startsWith('/invite/');
  
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

  // Track if we've already checked permissions for this route to prevent loops
  let lastCheckedPath = '';
  
  // Cashier mode: redirect to POS and check route permissions
  // Only enforce permissions if role is properly loaded with permissions
  $: if (browser && $currentRole && hasRolePermissions && !isPublicRoute && $isFirebaseAuthenticated) {
    const currentPath = $page.url.pathname;
    
    // Only check once per route change
    if (lastCheckedPath !== currentPath) {
      lastCheckedPath = currentPath;
      
      // Cashier mode: allow /sales, /dashboard, and /account routes
      if (isCashierMode) {
        const allowedCashierRoutes = ['/sales', '/dashboard', '/account'];
        const isAllowed = allowedCashierRoutes.some(route => 
          currentPath === route || currentPath.startsWith(route + '/')
        );
        if (!isAllowed) {
          console.log('[Layout] Cashier attempting to access', currentPath, '- redirecting to /sales');
          goto('/sales');
        }
      } else if (currentPath !== '/dashboard') {
        // Check route permissions for non-cashiers (dashboard is always accessible)
        // Find the best matching route (exact match first, then prefix match)
        let requiredPermission: PermissionKey | undefined = routePermissions[currentPath];
        if (!requiredPermission) {
          // Try prefix matching - find the longest matching route
          const matchingRoute = Object.keys(routePermissions)
            .filter(route => currentPath.startsWith(route))
            .sort((a, b) => b.length - a.length)[0];
          if (matchingRoute) {
            requiredPermission = routePermissions[matchingRoute];
          }
        }
        
        if (requiredPermission && !hasPermission(requiredPermission)) {
          console.log('[Layout] User lacks permission', requiredPermission, 'for route', currentPath);
          toast.error($locale === 'es' ? 'No tienes permiso para acceder a esta página' : 'You do not have permission to access this page');
          goto('/dashboard');
        }
      }
    }
  }

  // Track if we've already initialized services to avoid duplicate calls
  let servicesInitialized = false;
  
  onMount(() => {
    // Subscribe to Firebase authentication state (including loading state)
    // We subscribe to firebaseAuth directly to properly handle loading completion
    const unsubscribe = firebaseAuth.subscribe(async (authState) => {
      const { user, loading } = authState;
      const isAuthenticated = !!user && !loading;
      const currentPath = $page.url.pathname;
      const isPublic = publicRoutes.includes(currentPath) || currentPath.startsWith('/invite/');
      console.log('[Layout] Firebase auth state:', { user: !!user, loading, isAuthenticated, path: currentPath, isPublic });
      
      // Skip if still loading
      if (loading) {
        return;
      }
      
      // If authenticated and on login page, redirect to dashboard
      if (isAuthenticated && currentPath === '/login') {
        console.log('[Layout] Authenticated on login page, redirecting to dashboard');
        goto('/dashboard');
        return;
      }
      
      // If not authenticated and on protected route, redirect to login
      if (!isAuthenticated && !isPublic) {
        console.log('[Layout] Not authenticated on protected route, redirecting to login');
        goto('/login');
        return;
      }
      
      // Initialize sync and load data when authenticated
      // isAuthenticated is only true when loading is complete, so we don't need to check loading
      if (isAuthenticated && !servicesInitialized) {
        servicesInitialized = true;
        console.log('[Layout] Authenticated, initializing services...');
        
        try {
          // First ensure store exists (registers device with Supabase)
          console.log('[Layout] Calling ensureStoreExists...');
          const storeId = await ensureStoreExists();
          console.log('[Layout] Store ID:', storeId);
          
          // Then initialize device auth state
          await initializeDeviceAuth();
          console.log('[Layout] Device auth initialized');
          
          // Login with Firebase to set up local user and role with permissions
          const firebaseUser = getCurrentUser();
          if (firebaseUser) {
            console.log('[Layout] Setting up local user for Firebase user:', firebaseUser.email);
            await loginWithFirebase({
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              uid: firebaseUser.uid
            });
            console.log('[Layout] Local user and role set up');
          }
          
          // Then start sync service and wait for initial sync
          console.log('[Layout] Starting sync service...');
          const syncResult = await initializeSyncService();
          console.log('[Layout] Sync service initialized, pulled:', syncResult.pulled, 'records');
          
          // Start realtime subscriptions for instant sync
          console.log('[Layout] Starting realtime service...');
          initializeRealtimeService();
          console.log('[Layout] Realtime service started');
          
          // Signal that store is ready AFTER sync completes
          // This unblocks pages waiting for data
          signalStoreReady(storeId);
          console.log('[Layout] Store ready signaled');
        } catch (err) {
          console.error('[Layout] Service initialization failed:', err);
        }
        
        loadSearchData();
      }
    });

    // Dark Mode Init - with Safari private browsing safety
    try {
      const storedTheme = localStorage.getItem('theme');
      if (storedTheme === 'dark' || (storedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        isDark = true;
      } else {
        document.documentElement.classList.remove('dark');
        isDark = false;
      }
    } catch (e) {
      // Safari private browsing - use system preference
      console.warn('localStorage access failed:', e);
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
        isDark = true;
      }
    }

    // Load search data if already authenticated
    if ($isFirebaseAuthenticated) {
      loadSearchData();
    }

    // Add click outside listener
    if (browser) {
      document.addEventListener('click', handleClickOutside);
      
      // Initialize Firebase (Analytics + Push Notifications)
      initializeFirebase();
    }

    return () => {
      unsubscribe();
      stopRealtimeService();
      if (browser) {
        document.removeEventListener('click', handleClickOutside);
      }
    };
  });

  function toggleTheme() {
    isDark = !isDark;
    if (isDark) {
      document.documentElement.classList.add('dark');
      try { localStorage.setItem('theme', 'dark'); } catch (e) { /* Safari private */ }
    } else {
      document.documentElement.classList.remove('dark');
      try { localStorage.setItem('theme', 'light'); } catch (e) { /* Safari private */ }
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

{#if $isFirebaseLoading}
<!-- Loading state while Firebase initializes -->
<div class="flex items-center justify-center h-screen bg-background">
  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
</div>
{:else if isPublicRoute}
<!-- Public routes (landing page, login) - no sidebar -->
<slot />
{:else if $isFirebaseAuthenticated}
<div class="flex flex-col h-screen w-full overflow-hidden bg-background text-foreground transition-colors duration-300">
  
  <!-- Cashier mode: Minimal header with exit option, no sidebar -->
  {#if isCashierMode}
    {#if !$isPosMode}
    <header class="fixed top-0 left-0 right-0 h-14 bg-card border-b border-border z-40 flex items-center px-4 justify-between">
      <div class="flex items-center gap-3">
        <img src={isDark ? "/cuadra_logo_white.png" : "/cuadra_logo.png"} alt="Cuadra" class="h-8 w-auto" />
      </div>
      <div class="flex items-center gap-2">
        <a 
          href="/dashboard" 
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                 {$page.url.pathname === '/dashboard' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}"
        >
          <Home size={18} />
          <span class="hidden sm:inline">{t('nav.home', $locale)}</span>
        </a>
        <a 
          href="/sales" 
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                 {$page.url.pathname === '/sales' || $page.url.pathname.startsWith('/sales/') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}"
        >
          <ShoppingCart size={18} />
          <span class="hidden sm:inline">{t('nav.pos', $locale)}</span>
        </a>
        <a 
          href="/account" 
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                 {$page.url.pathname === '/account' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}"
        >
          <User size={18} />
          <span class="hidden sm:inline">{t('nav.account', $locale)}</span>
        </a>
        <button on:click={toggleTheme} class="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors ml-2">
          {#if isDark}
            <Sun size={18} />
          {:else}
            <Moon size={18} />
          {/if}
        </button>
      </div>
    </header>
    {/if}
    <main class="flex-1 overflow-y-auto {$isPosMode ? '' : 'pt-14'} bg-background">
      <slot />
    </main>
  {:else}
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

    <!-- Sync Button -->
    <button 
      on:click={async () => {
        console.log('[Layout] Sync button clicked');
        const result = await triggerSync();
        console.log('[Layout] Sync result:', result);
        // If we pulled data, reload the page to show it
        if (result && result.pulled > 0) {
          console.log('[Layout] Data pulled, reloading page...');
          window.location.reload();
        }
      }}
      disabled={$isSyncing}
      class="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors ml-2 relative group"
      title={$syncMessage}
    >
      <RefreshCw size={20} class={$isSyncing ? 'animate-spin' : ''} />
      {#if $hasPendingChanges}
        <span class="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full"></span>
      {/if}
      <!-- Tooltip -->
      <span class="absolute top-full right-0 mt-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
        {$syncMessage}
      </span>
    </button>

    <!-- Dark Mode Toggle -->
    <button on:click={toggleTheme} class="p-2 rounded-lg hover:bg-secondary text-muted-foreground transition-colors ml-2">
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
      <img src={isDark ? "/cuadra_logo_white.png" : "/cuadra_logo.png"} alt="Cuadra" class="h-10 w-auto" />
    </div>
    
    <nav class="space-y-6">
      <!-- Home Standalone -->
      <div>
        <a 
          href={homeTab.href} 
          class="flex items-center space-x-3 px-4 py-2 rounded-lg transition-all duration-200
                 {($page.url.pathname === '/dashboard') 
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
    <div class="mt-auto pt-6 border-t border-border space-y-3">
        <div class="px-4 flex items-center justify-between">
            <div class="text-xs text-muted-foreground">
                v0.0.1
            </div>
            <!-- Desktop Dark Toggle (Optional secondary location) -->
        </div>
    </div>
  </aside>
  {/if}
  {/if}
</div>
{:else}
  <slot />
{/if}

<!-- Global Toast Notifications -->
<Toaster richColors position="top-center" />

<style>
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom);
  }
  
  /* Hide scrollbar for mobile nav */
  nav::-webkit-scrollbar {
    display: none;
  }
</style>
