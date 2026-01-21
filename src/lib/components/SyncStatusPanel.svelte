<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { syncStatus, syncStats, syncMessage, simpleSyncStatus, getLastSyncTimestamp } from '$lib/sync-store';
  import { getStoreId, getDeviceId, deviceAuth } from '$lib/device-auth';
  import { syncService } from '$lib/sync-service';
  import { db } from '$lib/db';
  import { locale } from '$lib/stores';
  import { 
    RefreshCw, 
    Cloud, 
    CloudOff, 
    AlertCircle, 
    CheckCircle2, 
    Clock, 
    Database,
    Smartphone,
    Store,
    Upload,
    Download,
    Loader2,
    RotateCcw
  } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import * as Tooltip from '$lib/components/ui/tooltip';

  // Local state
  let pendingChangesCount = 0;
  let lastSync: string | null = null;
  let storeId: string | null = null;
  let deviceId: string | null = null;
  let isSyncing = false;
  let isFullSyncing = false;
  let updateInterval: ReturnType<typeof setInterval>;

  // Translations
  $: t = {
    title: $locale === 'es' ? 'Estado de Sincronización' : 'Sync Status',
    storeId: $locale === 'es' ? 'ID de Tienda' : 'Store ID',
    deviceId: $locale === 'es' ? 'ID de Dispositivo' : 'Device ID',
    lastSync: $locale === 'es' ? 'Última Sincronización' : 'Last Sync',
    pendingChanges: $locale === 'es' ? 'Cambios Pendientes' : 'Pending Changes',
    syncNow: $locale === 'es' ? 'Sincronizar Ahora' : 'Sync Now',
    fullSync: $locale === 'es' ? 'Sincronización Completa' : 'Full Sync',
    syncing: $locale === 'es' ? 'Sincronizando...' : 'Syncing...',
    totalPushed: $locale === 'es' ? 'Total Enviados' : 'Total Pushed',
    totalPulled: $locale === 'es' ? 'Total Recibidos' : 'Total Pulled',
    online: $locale === 'es' ? 'En Línea' : 'Online',
    offline: $locale === 'es' ? 'Sin Conexión' : 'Offline',
    registered: $locale === 'es' ? 'Registrado' : 'Registered',
    notRegistered: $locale === 'es' ? 'No Registrado' : 'Not Registered',
    never: $locale === 'es' ? 'Nunca' : 'Never',
    copied: $locale === 'es' ? '¡Copiado!' : 'Copied!',
    clickToCopy: $locale === 'es' ? 'Click para copiar' : 'Click to copy',
    fullSyncDesc: $locale === 'es' ? 'Descarga todos los datos desde el servidor' : 'Downloads all data from server'
  };

  // Update local state from stores
  function updateState() {
    storeId = getStoreId();
    deviceId = getDeviceId();
    lastSync = getLastSyncTimestamp();
    
    if (db?.pendingChanges) {
      db.pendingChanges.count().then(count => {
        pendingChangesCount = count;
      });
    }
  }

  onMount(() => {
    updateState();
    // Update every 5 seconds
    updateInterval = setInterval(updateState, 5000);
  });

  onDestroy(() => {
    if (updateInterval) {
      clearInterval(updateInterval);
    }
  });

  // Sync actions
  async function handleSyncNow() {
    isSyncing = true;
    try {
      await syncService.syncNow();
      updateState();
    } finally {
      isSyncing = false;
    }
  }

  async function handleFullSync() {
    isFullSyncing = true;
    try {
      await syncService.forceFullSync();
      updateState();
    } finally {
      isFullSyncing = false;
    }
  }

  // Copy to clipboard
  let copiedField: string | null = null;
  async function copyToClipboard(value: string, field: string) {
    try {
      await navigator.clipboard.writeText(value);
      copiedField = field;
      setTimeout(() => {
        copiedField = null;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  // Format date
  function formatDate(dateStr: string | null): string {
    if (!dateStr) return t.never;
    try {
      const date = new Date(dateStr);
      return date.toLocaleString($locale === 'es' ? 'es-DO' : 'en-US', {
        dateStyle: 'short',
        timeStyle: 'medium'
      });
    } catch {
      return dateStr;
    }
  }

  // Get status icon and color
  function getStatusInfo(state: string) {
    switch (state) {
      case 'idle':
        return { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900/30' };
      case 'syncing':
        return { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' };
      case 'pending':
        return { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900/30' };
      case 'error':
        return { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' };
      case 'offline':
        return { icon: CloudOff, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' };
      case 'not_registered':
        return { icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/30' };
      default:
        return { icon: Cloud, color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-800' };
    }
  }

  $: statusInfo = getStatusInfo($syncStatus.state);
  $: StatusIcon = statusInfo.icon;
</script>

<Card.Root class="w-full">
  <Card.Header class="pb-3">
    <div class="flex items-center justify-between">
      <Card.Title class="flex items-center gap-2 text-lg">
        <Cloud class="w-5 h-5" />
        {t.title}
      </Card.Title>
      <div class="flex items-center gap-2">
        <!-- Status Badge -->
        <div class="flex items-center gap-1.5 px-2 py-1 rounded-full {statusInfo.bg}">
          <svelte:component 
            this={StatusIcon} 
            class="w-4 h-4 {statusInfo.color} {$syncStatus.state === 'syncing' ? 'animate-spin' : ''}" 
          />
          <span class="text-xs font-medium {statusInfo.color}">
            {$syncMessage}
          </span>
        </div>
      </div>
    </div>
  </Card.Header>

  <Card.Content class="space-y-4">
    <!-- Connection Info -->
    <div class="grid grid-cols-2 gap-4">
      <!-- Store ID -->
      <div class="space-y-1">
        <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Store class="w-3 h-3" />
          {t.storeId}
        </div>
        <Tooltip.Root>
          <Tooltip.Trigger asChild let:builder>
            <button 
              {...builder}
              use:builder.action
              class="font-mono text-xs truncate max-w-full text-left hover:bg-muted px-1 py-0.5 rounded cursor-pointer"
              on:click={() => storeId && copyToClipboard(storeId, 'store')}
            >
              {storeId ? storeId.slice(0, 8) + '...' : '-'}
              {#if copiedField === 'store'}
                <span class="text-green-500 ml-1">✓</span>
              {/if}
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>
            <p class="font-mono text-xs">{storeId || '-'}</p>
            <p class="text-xs text-muted-foreground">{t.clickToCopy}</p>
          </Tooltip.Content>
        </Tooltip.Root>
      </div>

      <!-- Device ID -->
      <div class="space-y-1">
        <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Smartphone class="w-3 h-3" />
          {t.deviceId}
        </div>
        <Tooltip.Root>
          <Tooltip.Trigger asChild let:builder>
            <button 
              {...builder}
              use:builder.action
              class="font-mono text-xs truncate max-w-full text-left hover:bg-muted px-1 py-0.5 rounded cursor-pointer"
              on:click={() => deviceId && copyToClipboard(deviceId, 'device')}
            >
              {deviceId ? deviceId.slice(0, 8) + '...' : '-'}
              {#if copiedField === 'device'}
                <span class="text-green-500 ml-1">✓</span>
              {/if}
            </button>
          </Tooltip.Trigger>
          <Tooltip.Content>
            <p class="font-mono text-xs">{deviceId || '-'}</p>
            <p class="text-xs text-muted-foreground">{t.clickToCopy}</p>
          </Tooltip.Content>
        </Tooltip.Root>
      </div>
    </div>

    <!-- Sync Stats -->
    <div class="grid grid-cols-3 gap-3">
      <!-- Last Sync -->
      <div class="p-2 rounded-lg bg-muted/50">
        <div class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          <Clock class="w-3 h-3" />
          {t.lastSync}
        </div>
        <div class="text-sm font-medium truncate" title={formatDate(lastSync)}>
          {formatDate(lastSync)}
        </div>
      </div>

      <!-- Pending Changes -->
      <div class="p-2 rounded-lg bg-muted/50">
        <div class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          <Upload class="w-3 h-3" />
          {t.pendingChanges}
        </div>
        <div class="text-sm font-medium {pendingChangesCount > 0 ? 'text-yellow-600 dark:text-yellow-400' : ''}">
          {pendingChangesCount}
        </div>
      </div>

      <!-- Total Synced -->
      <div class="p-2 rounded-lg bg-muted/50">
        <div class="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
          <Download class="w-3 h-3" />
          {t.totalPulled}
        </div>
        <div class="text-sm font-medium">
          {$syncStats.totalPulled}
        </div>
      </div>
    </div>

    <!-- Online/Offline Status -->
    <div class="flex items-center justify-between text-sm">
      <div class="flex items-center gap-2">
        {#if $syncStatus.isOnline}
          <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
          <span class="text-green-600 dark:text-green-400">{t.online}</span>
        {:else}
          <div class="w-2 h-2 rounded-full bg-gray-500"></div>
          <span class="text-gray-500">{t.offline}</span>
        {/if}
      </div>
      <div class="flex items-center gap-2 text-muted-foreground text-xs">
        {#if $deviceAuth.state === 'registered'}
          <CheckCircle2 class="w-3 h-3 text-green-500" />
          <span>{t.registered}</span>
        {:else}
          <AlertCircle class="w-3 h-3 text-orange-500" />
          <span>{t.notRegistered}</span>
        {/if}
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex gap-2 pt-2">
      <Button
        variant="outline"
        size="sm"
        class="flex-1"
        disabled={isSyncing || isFullSyncing || !$syncStatus.isOnline || $deviceAuth.state !== 'registered'}
        on:click={handleSyncNow}
      >
        {#if isSyncing}
          <Loader2 class="w-4 h-4 mr-2 animate-spin" />
          {t.syncing}
        {:else}
          <RefreshCw class="w-4 h-4 mr-2" />
          {t.syncNow}
        {/if}
      </Button>

      <Tooltip.Root>
        <Tooltip.Trigger asChild let:builder>
          <Button
            {...builder}
            variant="secondary"
            size="sm"
            disabled={isSyncing || isFullSyncing || !$syncStatus.isOnline || $deviceAuth.state !== 'registered'}
            on:click={handleFullSync}
          >
            {#if isFullSyncing}
              <Loader2 class="w-4 h-4 animate-spin" />
            {:else}
              <RotateCcw class="w-4 h-4" />
            {/if}
          </Button>
        </Tooltip.Trigger>
        <Tooltip.Content>
          <p class="font-semibold">{t.fullSync}</p>
          <p class="text-xs text-muted-foreground">{t.fullSyncDesc}</p>
        </Tooltip.Content>
      </Tooltip.Root>
    </div>

    <!-- Error Display -->
    {#if $syncStatus.error}
      <div class="p-2 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs">
        <div class="flex items-start gap-2">
          <AlertCircle class="w-4 h-4 shrink-0 mt-0.5" />
          <span>{$syncStatus.error}</span>
        </div>
      </div>
    {/if}
  </Card.Content>
</Card.Root>

