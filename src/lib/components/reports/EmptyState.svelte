<script lang="ts">
  import { FileText } from 'lucide-svelte';

  export let title: string;
  export let description: string;
  export let positive: boolean = false;
</script>

<div class="text-center py-12">
  <div class="w-16 h-16 rounded-full {positive ? 'bg-emerald-100' : 'bg-slate-100'} mx-auto mb-4 flex items-center justify-center">
    {#if positive}
      <svg class="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
    {:else}
      <FileText size={32} class="text-slate-400" />
    {/if}
  </div>
  <h3 class="font-semibold text-lg mb-1">{title}</h3>
  <p class="text-muted-foreground max-w-md mx-auto">{description}</p>
</div>

