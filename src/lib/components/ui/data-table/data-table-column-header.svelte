<script lang="ts">
  import { ArrowUpDown, ArrowUp, ArrowDown, EyeOff } from 'lucide-svelte';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { cn } from '$lib/utils';
  
  export let title: string;
  export let sortDirection: 'asc' | 'desc' | undefined = undefined;
  export let canSort: boolean = true;
  export let canHide: boolean = true;
  export let onSort: () => void = () => {};
  export let onHide: () => void = () => {};
  
  let className: string = '';
  export { className as class };
</script>

{#if !canSort}
  <div class={cn("flex items-center", className)}>
    <span class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{title}</span>
  </div>
{:else}
  <div class={cn("flex items-center space-x-2", className)}>
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild let:builder>
        <button 
          use:builder.action
          {...builder}
          class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors -ml-3 px-3 py-1.5 rounded-md hover:bg-muted"
        >
          <span>{title}</span>
          {#if sortDirection === 'desc'}
            <ArrowDown size={14} />
          {:else if sortDirection === 'asc'}
            <ArrowUp size={14} />
          {:else}
            <ArrowUpDown size={14} class="opacity-50" />
          {/if}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start">
        <DropdownMenu.Item on:click={onSort}>
          <ArrowUp size={14} class="mr-2 text-muted-foreground" />
          Asc
        </DropdownMenu.Item>
        <DropdownMenu.Item on:click={onSort}>
          <ArrowDown size={14} class="mr-2 text-muted-foreground" />
          Desc
        </DropdownMenu.Item>
        {#if canHide}
          <DropdownMenu.Separator />
          <DropdownMenu.Item on:click={onHide}>
            <EyeOff size={14} class="mr-2 text-muted-foreground" />
            Hide
          </DropdownMenu.Item>
        {/if}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
{/if}

