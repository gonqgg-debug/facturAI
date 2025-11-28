<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { Zap, ArrowRight } from 'lucide-svelte';
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';

  // Auto-redirect after a short delay
  onMount(() => {
    const timeout = setTimeout(() => {
      goto('/capture');
    }, 3000);
    
    return () => clearTimeout(timeout);
  });
</script>

<div class="p-4 max-w-2xl mx-auto pb-24 flex flex-col items-center justify-center min-h-[60vh]">
  <Card.Root class="w-full border-amber-500/30 bg-amber-500/5">
    <Card.Content class="pt-8 pb-8 text-center">
      <div class="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
        <Zap class="text-amber-500" size={32} />
      </div>
      
      <h1 class="text-2xl font-bold mb-2">This page has moved!</h1>
      
      <p class="text-muted-foreground mb-6">
        Invoice capture is now part of <strong>Quick Capture</strong> — the fastest way to process invoices with OCR.
      </p>
      
      <Button on:click={() => goto('/capture')} size="lg" class="gap-2">
        Go to Quick Capture
        <ArrowRight size={18} />
      </Button>
      
      <p class="text-xs text-muted-foreground mt-4">
        Redirecting automatically in 3 seconds...
      </p>
    </Card.Content>
  </Card.Root>
  
  <div class="mt-8 text-center">
    <p class="text-sm text-muted-foreground mb-2">Looking for something else?</p>
    <div class="flex gap-4 justify-center">
      <Button variant="outline" size="sm" on:click={() => goto('/purchases')}>
        Purchasing Hub
      </Button>
      <Button variant="outline" size="sm" on:click={() => goto('/purchases/receiving')}>
        Receive Against PO
      </Button>
    </div>
  </div>
</div>
