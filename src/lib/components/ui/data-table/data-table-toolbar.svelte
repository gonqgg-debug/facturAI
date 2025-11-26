<script lang="ts">
  import { Search, X, SlidersHorizontal, Columns3 } from 'lucide-svelte';
  import { Input } from '$lib/components/ui/input';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { Checkbox } from '$lib/components/ui/checkbox';
  
  export let globalFilter: string = '';
  export let onGlobalFilterChange: (value: string) => void = () => {};
  export let columns: { id: string; title: string; visible: boolean }[] = [];
  export let onColumnVisibilityChange: (columnId: string, visible: boolean) => void = () => {};
  export let selectedCount: number = 0;
  export let totalCount: number = 0;
  export let placeholder: string = 'Search...';
</script>

<div class="flex items-center justify-between gap-4 py-4">
  <div class="flex items-center gap-4 flex-1">
    <!-- Global Search -->
    <div class="relative flex-1 max-w-sm">
      <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-10" size={16} />
      <Input 
        type="text"
        {placeholder}
        value={globalFilter}
        on:input={(e) => onGlobalFilterChange(e.currentTarget.value)}
        class="h-10 pl-9 bg-card"
      />
      {#if globalFilter}
        <button 
          class="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded"
          on:click={() => onGlobalFilterChange('')}
        >
          <X size={14} />
        </button>
      {/if}
    </div>
    
    <!-- Selection Info -->
    {#if selectedCount > 0}
      <div class="text-sm text-muted-foreground">
        <span class="font-medium text-primary">{selectedCount}</span> of {totalCount} row(s) selected
      </div>
    {/if}
  </div>
  
  <div class="flex items-center gap-2">
    <!-- Column Visibility Toggle -->
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild let:builder>
        <button 
          use:builder.action
          {...builder}
          class="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground bg-card border border-border rounded-lg hover:bg-muted hover:text-foreground transition-colors"
        >
          <Columns3 size={16} />
          <span class="hidden sm:inline">Columns</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" class="w-48">
        <DropdownMenu.Label>Toggle columns</DropdownMenu.Label>
        <DropdownMenu.Separator />
        {#each columns.filter(col => col.id !== 'select' && col.id !== 'actions') as column}
          <DropdownMenu.CheckboxItem
            checked={column.visible}
            onCheckedChange={(checked) => onColumnVisibilityChange(column.id, !!checked)}
          >
            {column.title}
          </DropdownMenu.CheckboxItem>
        {/each}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
    
    <slot name="actions" />
  </div>
</div>

