<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { captureException } from '$lib/sentry';
  import { Button } from '$lib/components/ui/button';
  import { AlertTriangle, Home, RefreshCw } from 'lucide-svelte';

  export let error: App.Error;
  export let status: number;
  export let message: string;

  // Determine error message and status
  $: errorStatus = status || error?.status || 500;
  $: errorMessage = message || error?.message || 'An unexpected error occurred';

  onMount(() => {
    // Capture error in Sentry
    if (error) {
      captureException(new Error(errorMessage), {
        status: errorStatus,
        url: $page.url.href,
        path: $page.url.pathname,
        errorId: error?.id
      });
    }
  });

  function goHome() {
    goto('/dashboard');
  }

  function reload() {
    window.location.reload();
  }
</script>

<div class="min-h-screen flex items-center justify-center bg-background p-4">
  <div class="max-w-md w-full space-y-6 text-center">
    <div class="flex justify-center">
      <div class="rounded-full bg-destructive/10 p-4">
        <AlertTriangle class="h-12 w-12 text-destructive" />
      </div>
    </div>

    <div class="space-y-2">
      <h1 class="text-4xl font-bold text-foreground">
        {errorStatus}
      </h1>
      <h2 class="text-2xl font-semibold text-foreground">
        {errorStatus === 404 ? 'Page Not Found' : 'Something went wrong'}
      </h2>
      <p class="text-muted-foreground">
        {errorStatus === 404 
          ? "The page you're looking for doesn't exist." 
          : errorMessage}
      </p>
    </div>

    {#if errorStatus === 500 && error?.stack && import.meta.env.DEV}
      <details class="text-left">
        <summary class="cursor-pointer text-sm text-muted-foreground mb-2">
          Technical details (development only)
        </summary>
        <pre class="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-64">{error.stack}</pre>
      </details>
    {/if}

    <div class="flex gap-4 justify-center">
      <Button onclick={goHome} variant="default">
        <Home class="mr-2 h-4 w-4" />
        Go Home
      </Button>
      <Button onclick={reload} variant="outline">
        <RefreshCw class="mr-2 h-4 w-4" />
        Reload
      </Button>
    </div>
  </div>
</div>

