<script lang="ts" context="module">
  export type ColumnDef<T> = {
    id: string;
    accessorKey?: keyof T | string;
    accessorFn?: (row: T) => any;
    header: string;
    enableSorting?: boolean;
    enableHiding?: boolean;
    meta?: {
      class?: string;
      headerClass?: string;
    };
  };
</script>

<script lang="ts" generics="T">
  import { createEventDispatcher } from 'svelte';
  import * as Table from '$lib/components/ui/table';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import DataTableColumnHeader from './data-table-column-header.svelte';
  import DataTableToolbar from './data-table-toolbar.svelte';
  import DataTablePagination from './data-table-pagination.svelte';
  import { FileSpreadsheet } from 'lucide-svelte';
  
  // Props
  export let data: T[] = [];
  export let columns: ColumnDef<T>[] = [];
  export let enableRowSelection: boolean = true;
  export let enableSorting: boolean = true;
  export let enableFiltering: boolean = true;
  export let enablePagination: boolean = true;
  export let enableColumnVisibility: boolean = true;
  export let pageSize: number = 10;
  export let searchPlaceholder: string = 'Search...';
  export let emptyMessage: string = 'No results found.';
  export let emptyDescription: string = 'Try adjusting your search or filters.';
  export let getRowId: (row: T) => string | number = (row: any) => row.id;
  
  
  const dispatch = createEventDispatcher<{
    selectionChange: { selectedRows: T[] };
    rowClick: { row: T };
  }>();
  
  // State
  let globalFilter = '';
  let sortColumn: string | null = null;
  let sortDirection: 'asc' | 'desc' | undefined = undefined;
  let selectedRowIds: Set<string | number> = new Set();
  let pageIndex = 0;
  let currentPageSize = pageSize;
  let columnVisibility: Record<string, boolean> = {};
  
  // Initialize column visibility
  $: {
    columns.forEach(col => {
      if (columnVisibility[col.id] === undefined) {
        columnVisibility[col.id] = true;
      }
    });
  }
  
  // Get accessor value from row
  function getAccessorValue(row: T, column: ColumnDef<T>): any {
    if (column.accessorFn) {
      return column.accessorFn(row);
    }
    if (column.accessorKey) {
      const keys = String(column.accessorKey).split('.');
      let value: any = row;
      for (const key of keys) {
        value = value?.[key];
      }
      return value;
    }
    return undefined;
  }
  
  // Filtering
  $: filteredData = enableFiltering && globalFilter 
    ? data.filter(row => {
        const searchLower = globalFilter.toLowerCase();
        return columns.some(col => {
          const value = getAccessorValue(row, col);
          if (value == null) return false;
          return String(value).toLowerCase().includes(searchLower);
        });
      })
    : data;
  
  // Sorting
  $: sortedData = enableSorting && sortColumn && sortDirection
    ? [...filteredData].sort((a, b) => {
        const column = columns.find(c => c.id === sortColumn);
        if (!column) return 0;
        
        const aVal = getAccessorValue(a, column);
        const bVal = getAccessorValue(b, column);
        
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortDirection === 'asc' ? 1 : -1;
        if (bVal == null) return sortDirection === 'asc' ? -1 : 1;
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        
        if (sortDirection === 'asc') {
          return aStr.localeCompare(bStr);
        }
        return bStr.localeCompare(aStr);
      })
    : filteredData;
  
  // Pagination
  $: totalRows = sortedData.length;
  $: pageCount = Math.ceil(totalRows / currentPageSize);
  $: paginatedData = enablePagination 
    ? sortedData.slice(pageIndex * currentPageSize, (pageIndex + 1) * currentPageSize)
    : sortedData;
  
  // Visible columns
  $: visibleColumns = columns.filter(col => columnVisibility[col.id] !== false);
  
  // Column metadata for toolbar
  $: columnMeta = columns.map(col => ({
    id: col.id,
    title: col.header,
    visible: columnVisibility[col.id] !== false
  }));
  
  // Selection helpers - exported so parent can access
  export let selectedRows: T[] = [];
  $: selectedRows = data.filter(row => selectedRowIds.has(getRowId(row)));
  $: isAllSelected = paginatedData.length > 0 && paginatedData.every(row => selectedRowIds.has(getRowId(row)));
  $: isSomeSelected = paginatedData.some(row => selectedRowIds.has(getRowId(row))) && !isAllSelected;
  
  function toggleSort(columnId: string) {
    if (sortColumn === columnId) {
      if (sortDirection === 'asc') {
        sortDirection = 'desc';
      } else if (sortDirection === 'desc') {
        sortDirection = undefined;
        sortColumn = null;
      }
    } else {
      sortColumn = columnId;
      sortDirection = 'asc';
    }
  }
  
  function toggleRowSelection(row: T) {
    const id = getRowId(row);
    const newSet = new Set(selectedRowIds);
    
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    
    selectedRowIds = newSet;
    dispatch('selectionChange', { selectedRows: data.filter(r => selectedRowIds.has(getRowId(r))) });
  }
  
  function toggleAllRows() {
    if (isAllSelected) {
      // Deselect all on current page
      const newSet = new Set(selectedRowIds);
      paginatedData.forEach(row => newSet.delete(getRowId(row)));
      selectedRowIds = newSet;
    } else {
      // Select all on current page
      const newSet = new Set(selectedRowIds);
      paginatedData.forEach(row => newSet.add(getRowId(row)));
      selectedRowIds = newSet;
    }
    dispatch('selectionChange', { selectedRows: data.filter(r => selectedRowIds.has(getRowId(r))) });
  }
  
  function handleRowClick(row: T) {
    dispatch('rowClick', { row });
  }
  
  function handleColumnVisibilityChange(columnId: string, visible: boolean) {
    columnVisibility = { ...columnVisibility, [columnId]: visible };
  }
  
  function handlePageChange(newPageIndex: number) {
    pageIndex = Math.max(0, Math.min(newPageIndex, pageCount - 1));
  }
  
  function handlePageSizeChange(newPageSize: number) {
    currentPageSize = newPageSize;
    pageIndex = 0;
  }
  
  function handleGlobalFilterChange(value: string) {
    globalFilter = value;
    pageIndex = 0; // Reset to first page on filter change
  }
  
  // Export functions for parent components
  export function getSelectedRows(): T[] {
    return selectedRows;
  }
  
  export function clearSelection() {
    selectedRowIds = new Set();
    dispatch('selectionChange', { selectedRows: [] });
  }
  
  export function selectAll() {
    selectedRowIds = new Set(data.map(row => getRowId(row)));
    dispatch('selectionChange', { selectedRows: [...data] });
  }
</script>

<div class="w-full">
  <!-- Toolbar -->
  {#if enableFiltering || enableColumnVisibility}
    <DataTableToolbar 
      {globalFilter}
      onGlobalFilterChange={handleGlobalFilterChange}
      columns={columnMeta}
      onColumnVisibilityChange={handleColumnVisibilityChange}
      selectedCount={selectedRowIds.size}
      totalCount={totalRows}
      placeholder={searchPlaceholder}
    >
      <slot name="toolbar-actions" />
    </DataTableToolbar>
  {/if}
  
  <!-- Selected Actions Bar -->
  {#if selectedRowIds.size > 0}
    <div class="flex items-center gap-4 px-4 py-3 mb-4 bg-primary/10 border border-primary/20 rounded-xl">
      <span class="text-sm font-medium text-primary">
        {selectedRowIds.size} item{selectedRowIds.size > 1 ? 's' : ''} selected
      </span>
      <div class="flex items-center gap-2 ml-auto">
        <slot name="bulk-actions" />
        <button 
          class="text-sm text-muted-foreground hover:text-foreground transition-colors"
          on:click={clearSelection}
        >
          Clear selection
        </button>
      </div>
    </div>
  {/if}
  
  <!-- Table -->
  <div class="bg-card text-card-foreground border border-border rounded-2xl overflow-hidden shadow-sm">
    <Table.Root>
      <Table.Header class="bg-muted/50">
        <Table.Row class="hover:bg-muted/50">
          <!-- Selection column -->
          {#if enableRowSelection}
            <Table.Head class="w-12">
              <Checkbox 
                checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false}
                onCheckedChange={toggleAllRows}
                aria-label="Select all"
              />
            </Table.Head>
          {/if}
          
          <!-- Data columns -->
          {#each visibleColumns as column}
            {@const isSortable = enableSorting && column.enableSorting !== false}
            {@const isHideable = enableColumnVisibility && column.enableHiding !== false}
            <Table.Head class={column.meta?.headerClass || ''}>
              {#if isSortable}
                <DataTableColumnHeader 
                  title={column.header}
                  sortDirection={sortColumn === column.id ? sortDirection : undefined}
                  canSort={true}
                  canHide={isHideable}
                  onSort={() => toggleSort(column.id)}
                  onHide={() => handleColumnVisibilityChange(column.id, false)}
                />
              {:else}
                <span class="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
                  {column.header}
                </span>
              {/if}
            </Table.Head>
          {/each}
        </Table.Row>
      </Table.Header>
      
      <Table.Body>
        {#each paginatedData as row}
          {@const rowId = getRowId(row)}
          {@const isSelected = selectedRowIds.has(rowId)}
          
          <Table.Row 
            class="group {isSelected ? 'bg-primary/5' : ''}"
            on:click={() => handleRowClick(row)}
          >
            <!-- Selection checkbox -->
            {#if enableRowSelection}
              <Table.Cell class="w-12">
                <div on:click|stopPropagation on:keydown|stopPropagation role="presentation">
                  <Checkbox 
                    checked={isSelected}
                    onCheckedChange={() => toggleRowSelection(row)}
                    aria-label="Select row"
                  />
                </div>
              </Table.Cell>
            {/if}
            
            <!-- Data cells -->
            {#each visibleColumns as column}
              {@const cellValue = getAccessorValue(row, column)}
              <Table.Cell class={column.meta?.class || ''}>
                {cellValue ?? '-'}
              </Table.Cell>
            {/each}
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell 
              colspan={visibleColumns.length + (enableRowSelection ? 1 : 0)}
              class="h-48"
            >
              <div class="flex flex-col items-center justify-center text-muted-foreground">
                <FileSpreadsheet size={48} class="mb-4 opacity-20" />
                <p class="text-lg font-medium">{emptyMessage}</p>
                <p class="text-sm">{emptyDescription}</p>
              </div>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
  </div>
  
  <!-- Pagination -->
  {#if enablePagination && totalRows > 0}
    <DataTablePagination 
      {pageIndex}
      pageSize={currentPageSize}
      {pageCount}
      totalRows={totalRows}
      selectedCount={selectedRowIds.size}
      canPreviousPage={pageIndex > 0}
      canNextPage={pageIndex < pageCount - 1}
      onPageChange={handlePageChange}
      onPageSizeChange={handlePageSizeChange}
    />
  {/if}
</div>
