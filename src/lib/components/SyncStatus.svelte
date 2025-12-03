<script lang="ts">
    import { 
        syncStatus, 
        syncMessage, 
        isSyncing, 
        hasPendingChanges,
        canSync,
        isOnline
    } from '$lib/sync-store';
    import { triggerSync } from '$lib/sync-service';
    import { deviceAuth, isDeviceRegistered } from '$lib/device-auth';
    import { isSupabaseConfigured } from '$lib/supabase';
    import { 
        IconCloud, 
        IconCloudOff, 
        IconCloudCheck, 
        IconCloudExclamation,
        IconLoader2,
        IconRefresh,
        IconWifi,
        IconWifiOff,
        IconDevices
    } from '@tabler/icons-svelte';
    
    export let showLabel = true;
    export let size = 20;
    
    let isRefreshing = false;
    
    async function handleManualSync() {
        if (!$canSync || isRefreshing) return;
        isRefreshing = true;
        try {
            await triggerSync();
        } finally {
            setTimeout(() => {
                isRefreshing = false;
            }, 1000);
        }
    }
    
    // Determine icon and color based on sync state
    $: iconColor = (() => {
        switch ($syncStatus.state) {
            case 'idle':
                return 'text-green-500';
            case 'syncing':
                return 'text-blue-500';
            case 'pending':
                return 'text-orange-500';
            case 'offline':
                return 'text-yellow-500';
            case 'error':
                return 'text-red-500';
            case 'not_registered':
            default:
                return 'text-gray-400';
        }
    })();
    
    $: statusColor = (() => {
        switch ($syncStatus.state) {
            case 'idle':
                return 'bg-green-500/10 border-green-500/30';
            case 'syncing':
                return 'bg-blue-500/10 border-blue-500/30';
            case 'pending':
                return 'bg-orange-500/10 border-orange-500/30';
            case 'offline':
                return 'bg-yellow-500/10 border-yellow-500/30';
            case 'error':
                return 'bg-red-500/10 border-red-500/30';
            case 'not_registered':
            default:
                return 'bg-gray-500/10 border-gray-500/30';
        }
    })();
</script>

{#if isSupabaseConfigured() && $isDeviceRegistered}
    <div 
        class="flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors {statusColor}"
        title={$syncMessage}
    >
        <!-- Status Icon -->
        <div class="relative {iconColor}">
            {#if $syncStatus.state === 'syncing' || isRefreshing}
                <IconLoader2 {size} class="animate-spin" />
            {:else if $syncStatus.state === 'idle'}
                <IconCloudCheck {size} />
            {:else if $syncStatus.state === 'offline'}
                <IconCloudOff {size} />
            {:else if $syncStatus.state === 'error'}
                <IconCloudExclamation {size} />
            {:else if $syncStatus.state === 'pending'}
                <IconCloud {size} />
            {:else}
                <IconCloud {size} />
            {/if}
            
            <!-- Pending changes indicator -->
            {#if $hasPendingChanges && $syncStatus.pendingChangesCount > 0}
                <span 
                    class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white"
                >
                    {$syncStatus.pendingChangesCount > 99 ? '99+' : $syncStatus.pendingChangesCount}
                </span>
            {/if}
        </div>
        
        <!-- Status Label -->
        {#if showLabel}
            <span class="text-sm text-muted-foreground whitespace-nowrap">
                {#if $syncStatus.state === 'idle'}
                    {$syncMessage}
                {:else if $syncStatus.state === 'syncing'}
                    Sincronizando...
                {:else if $syncStatus.state === 'pending'}
                    {$syncStatus.pendingChangesCount} pendiente{$syncStatus.pendingChangesCount !== 1 ? 's' : ''}
                {:else if $syncStatus.state === 'offline'}
                    Sin conexión
                {:else if $syncStatus.state === 'error'}
                    Error
                {:else}
                    Local
                {/if}
            </span>
        {/if}
        
        <!-- Online/Offline indicator -->
        <div class="ml-1" title={$isOnline ? 'Conectado' : 'Sin internet'}>
            {#if $isOnline}
                <IconWifi size={14} class="text-green-500" />
            {:else}
                <IconWifiOff size={14} class="text-red-500" />
            {/if}
        </div>
        
        <!-- Manual sync button -->
        {#if $canSync && !$isSyncing}
            <button
                on:click={handleManualSync}
                class="ml-1 p-1 rounded-full hover:bg-muted transition-colors"
                title="Sincronizar ahora"
                disabled={isRefreshing}
            >
                <IconRefresh 
                    size={14} 
                    class="text-muted-foreground hover:text-foreground transition-colors {isRefreshing ? 'animate-spin' : ''}" 
                />
            </button>
        {/if}
    </div>
{:else if isSupabaseConfigured()}
    <!-- Supabase configured but device not registered -->
    <div 
        class="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-amber-500/10 border-amber-500/30"
        title="Dispositivo no vinculado. Ve a Configuración para vincular este dispositivo."
    >
        <IconDevices {size} class="text-amber-500" />
        {#if showLabel}
            <span class="text-sm text-muted-foreground">No vinculado</span>
        {/if}
    </div>
{:else}
    <!-- Supabase not configured - show offline mode indicator -->
    <div 
        class="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-gray-500/10 border-gray-500/30"
        title="Modo sin conexión (Supabase no configurado)"
    >
        <IconCloudOff {size} class="text-gray-400" />
        {#if showLabel}
            <span class="text-sm text-muted-foreground">Local</span>
        {/if}
    </div>
{/if}

<style>
    /* Pulse animation for syncing state */
    :global(.animate-pulse-subtle) {
        animation: pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    
    @keyframes pulse-subtle {
        0%, 100% {
            opacity: 1;
        }
        50% {
            opacity: 0.7;
        }
    }
</style>
