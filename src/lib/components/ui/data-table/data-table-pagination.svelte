<script lang="ts">
  import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-svelte';
  import * as Select from '$lib/components/ui/select';
  
  export let pageIndex: number = 0;
  export let pageSize: number = 10;
  export let pageCount: number = 0;
  export let totalRows: number = 0;
  export let selectedCount: number = 0;
  export let canPreviousPage: boolean = false;
  export let canNextPage: boolean = false;
  export let onPageChange: (pageIndex: number) => void = () => {};
  export let onPageSizeChange: (pageSize: number) => void = () => {};
  
  const pageSizeOptions = [10, 20, 30, 50, 100];
</script>

<div class="flex items-center justify-between px-2 py-4">
  <div class="flex-1 text-sm text-muted-foreground">
    {#if selectedCount > 0}
      {selectedCount} of {totalRows} row(s) selected.
    {:else}
      {totalRows} row(s) total.
    {/if}
  </div>
  
  <div class="flex items-center space-x-6 lg:space-x-8">
    <!-- Rows per page -->
    <div class="flex items-center space-x-2">
      <p class="text-sm font-medium text-muted-foreground">Rows per page</p>
      <Select.Root 
        selected={{ value: String(pageSize), label: String(pageSize) }}
        onSelectedChange={(v) => { if (v?.value) onPageSizeChange(Number(v.value)); }}
      >
        <Select.Trigger class="h-8 w-[70px]">
          <Select.Value placeholder={String(pageSize)} />
        </Select.Trigger>
        <Select.Content side="top">
          {#each pageSizeOptions as size}
            <Select.Item value={String(size)} label={String(size)}>{size}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>
    
    <!-- Page info -->
    <div class="flex w-[100px] items-center justify-center text-sm font-medium">
      Page {pageIndex + 1} of {pageCount || 1}
    </div>
    
    <!-- Navigation buttons -->
    <div class="flex items-center space-x-2">
      <button
        class="h-8 w-8 p-0 flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        disabled={!canPreviousPage}
        on:click={() => onPageChange(0)}
        title="Go to first page"
      >
        <ChevronsLeft size={16} />
      </button>
      <button
        class="h-8 w-8 p-0 flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        disabled={!canPreviousPage}
        on:click={() => onPageChange(pageIndex - 1)}
        title="Go to previous page"
      >
        <ChevronLeft size={16} />
      </button>
      <button
        class="h-8 w-8 p-0 flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        disabled={!canNextPage}
        on:click={() => onPageChange(pageIndex + 1)}
        title="Go to next page"
      >
        <ChevronRight size={16} />
      </button>
      <button
        class="h-8 w-8 p-0 flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        disabled={!canNextPage}
        on:click={() => onPageChange(pageCount - 1)}
        title="Go to last page"
      >
        <ChevronsRight size={16} />
      </button>
    </div>
  </div>
</div>

