<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { db } from '$lib/db';
  import { Search, Plus, Edit2, Trash2, Users, Phone, Mail, DollarSign, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-svelte';
  import type { Customer } from '$lib/types';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import * as Select from '$lib/components/ui/select';
  import * as Table from '$lib/components/ui/table';
  import * as Tabs from '$lib/components/ui/tabs';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Badge } from '$lib/components/ui/badge';
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import { locale } from '$lib/stores';
  import { t } from '$lib/i18n';

  let customers: Customer[] = [];
  
  // Filter state
  type TypeFilter = 'all' | 'retail' | 'wholesale' | 'corporate';
  let typeFilter: TypeFilter = 'all';
  
  function handleTypeFilterChange(value: string | undefined) {
    if (value) typeFilter = value as TypeFilter;
  }

  // Editing State
  let editingCustomer: Customer | null = null;
  let isCreating = false;
  let dialogOpen = false;
  
  // Delete confirmation state
  let deleteDialogOpen = false;
  let customerToDelete: Customer | null = null;
  
  // Table state
  let searchQuery = '';
  let sortColumn: string | null = null;
  let sortDirection: 'asc' | 'desc' | null = null;
  let selectedIds: Set<number> = new Set();
  let pageIndex = 0;
  let pageSize = 20;

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    if (!browser) return;
    customers = await db.customers.toArray();
  }

  // Filtering
  $: filteredByType = customers.filter(c => {
    if (typeFilter === 'all') return true;
    return c.type === typeFilter;
  });
  
  $: searchFiltered = searchQuery 
    ? filteredByType.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.rnc?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredByType;
  
  // Sorting
  $: sortedCustomers = sortColumn && sortDirection
    ? [...searchFiltered].sort((a, b) => {
        let aVal: any, bVal: any;
        switch (sortColumn) {
          case 'name': aVal = a.name; bVal = b.name; break;
          case 'type': aVal = a.type; bVal = b.type; break;
          case 'balance': aVal = a.currentBalance ?? 0; bVal = b.currentBalance ?? 0; break;
          case 'creditLimit': aVal = a.creditLimit ?? 0; bVal = b.creditLimit ?? 0; break;
          default: return 0;
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return sortDirection === 'asc' 
          ? String(aVal || '').localeCompare(String(bVal || ''))
          : String(bVal || '').localeCompare(String(aVal || ''));
      })
    : searchFiltered;
  
  // Pagination
  $: totalRows = sortedCustomers.length;
  $: pageCount = Math.ceil(totalRows / pageSize);
  $: paginatedCustomers = sortedCustomers.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
  
  // Selection
  $: selectedCustomers = customers.filter(c => selectedIds.has(c.id ?? -1));
  $: isAllSelected = paginatedCustomers.length > 0 && paginatedCustomers.every(c => selectedIds.has(c.id ?? -1));
  $: isSomeSelected = paginatedCustomers.some(c => selectedIds.has(c.id ?? -1)) && !isAllSelected;
  
  // Stats
  $: totalCustomers = customers.length;
  $: activeCustomers = customers.filter(c => c.isActive).length;
  $: totalReceivables = customers.reduce((sum, c) => sum + (c.currentBalance ?? 0), 0);
  $: totalCreditLimit = customers.reduce((sum, c) => sum + (c.creditLimit ?? 0), 0);

  function toggleSort(column: string) {
    if (sortColumn === column) {
      if (sortDirection === 'asc') sortDirection = 'desc';
      else if (sortDirection === 'desc') { sortDirection = null; sortColumn = null; }
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
  }
  
  function toggleSelectAll() {
    if (isAllSelected) {
      paginatedCustomers.forEach(c => selectedIds.delete(c.id ?? -1));
    } else {
      paginatedCustomers.forEach(c => selectedIds.add(c.id ?? -1));
    }
    selectedIds = new Set(selectedIds);
  }
  
  function toggleSelect(customer: Customer) {
    const id = customer.id ?? -1;
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    selectedIds = new Set(selectedIds);
  }
  
  function clearSelection() {
    selectedIds = new Set();
  }

  function startEdit(customer: Customer) {
    editingCustomer = { ...customer };
    isCreating = false;
    dialogOpen = true;
  }

  function startCreate() {
    editingCustomer = {
      name: '',
      type: 'retail',
      isActive: true,
      createdAt: new Date()
    };
    isCreating = true;
    dialogOpen = true;
  }
  
  function closeDialog() {
    dialogOpen = false;
    editingCustomer = null;
  }

  async function saveCustomer() {
    if (!editingCustomer) return;

    const data = {
      name: editingCustomer.name,
      type: editingCustomer.type,
      rnc: editingCustomer.rnc,
      phone: editingCustomer.phone,
      email: editingCustomer.email,
      address: editingCustomer.address,
      creditLimit: editingCustomer.creditLimit,
      currentBalance: editingCustomer.currentBalance ?? 0,
      isActive: editingCustomer.isActive,
      notes: editingCustomer.notes
    };

    if (isCreating) {
      await db.customers.add({
        ...data,
        createdAt: new Date()
      });
    } else if (editingCustomer.id) {
      await db.customers.update(editingCustomer.id, data);
    }

    closeDialog();
    await loadData();
  }

  function confirmDelete(customer: Customer) {
    customerToDelete = customer;
    deleteDialogOpen = true;
  }

  async function executeDelete() {
    if (!customerToDelete?.id) return;
    await db.customers.delete(customerToDelete.id);
    deleteDialogOpen = false;
    customerToDelete = null;
    await loadData();
  }
  
  function getTypeVariant(type: string): "default" | "outline" | "secondary" {
    switch (type) {
      case 'wholesale': return 'secondary';
      case 'corporate': return 'default';
      default: return 'outline';
    }
  }
  
  function getTypeLabel(type: string): string {
    switch (type) {
      case 'retail': return 'Retail';
      case 'wholesale': return 'Wholesale';
      case 'corporate': return 'Corporate';
      default: return type;
    }
  }
</script>

<div class="p-6 max-w-7xl mx-auto">
  <!-- Header -->
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">{t('nav.customers', $locale)}</h1>
      <p class="text-muted-foreground mt-1">Manage your customers and accounts receivable.</p>
    </div>
    <div class="flex space-x-3">
      <Button 
        variant="default" 
        size="default"
        on:click={startCreate}
        class="font-bold shadow-lg shadow-primary/20"
      >
        <Plus size={18} />
        <span>Add Customer</span>
      </Button>
    </div>
  </div>
  
  <!-- Summary Cards -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Total Customers</div>
        <div class="text-2xl font-bold">{totalCustomers}</div>
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1 flex items-center space-x-1">
          <Users size={12} class="text-green-500" />
          <span>Active</span>
        </div>
        <div class="text-2xl font-bold text-green-500">{activeCustomers}</div>
      </Card.Content>
    </Card.Root>
    <Card.Root class="{totalReceivables > 0 ? 'border-yellow-500/30' : ''}">
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1 flex items-center space-x-1">
          <DollarSign size={12} class="text-yellow-500" />
          <span>Receivables (CxC)</span>
        </div>
        <div class="text-2xl font-bold {totalReceivables > 0 ? 'text-yellow-500' : 'text-green-500'}">${totalReceivables.toLocaleString()}</div>
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Total Credit Limit</div>
        <div class="text-2xl font-bold">${totalCreditLimit.toLocaleString()}</div>
      </Card.Content>
    </Card.Root>
  </div>

  <!-- Type Filter Tabs -->
  <Tabs.Root value={typeFilter} onValueChange={handleTypeFilterChange} class="mb-4">
    <Tabs.List class="bg-card border border-border h-11 p-1 rounded-xl gap-1">
      <Tabs.Trigger 
        value="all" 
        class="rounded-lg px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
      >
        All
      </Tabs.Trigger>
      <Tabs.Trigger 
        value="retail" 
        class="rounded-lg px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
      >
        Retail
      </Tabs.Trigger>
      <Tabs.Trigger 
        value="wholesale" 
        class="rounded-lg px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
      >
        Wholesale
      </Tabs.Trigger>
      <Tabs.Trigger 
        value="corporate" 
        class="rounded-lg px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
      >
        Corporate
      </Tabs.Trigger>
    </Tabs.List>
  </Tabs.Root>

  <!-- Search -->
  <div class="flex items-center gap-4 mb-4">
    <div class="relative flex-1 max-w-sm">
      <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-10" size={16} />
      <Input bind:value={searchQuery} placeholder="Search by name, phone, email, or RNC..." class="h-10 pl-9 bg-card" />
    </div>
    
    {#if selectedIds.size > 0}
      <span class="text-sm text-muted-foreground"><span class="font-medium text-primary">{selectedIds.size}</span> selected</span>
      <Button variant="ghost" size="sm" on:click={clearSelection}>Clear selection</Button>
    {/if}
  </div>

  <!-- Table -->
  <Card.Root class="overflow-hidden shadow-sm">
    <Card.Content class="p-0">
      <Table.Root>
      <Table.Header class="bg-muted/50">
        <Table.Row class="hover:bg-muted/50">
          <Table.Head class="w-12">
            <Checkbox checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false} onCheckedChange={toggleSelectAll} aria-label="Select all" />
          </Table.Head>
          <Table.Head>
            <button class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors" on:click={() => toggleSort('name')}>
              Customer
              {#if sortColumn === 'name'}
                {#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}
              {:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
            </button>
          </Table.Head>
          <Table.Head>
            <button class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors" on:click={() => toggleSort('type')}>
              Type
              {#if sortColumn === 'type'}
                {#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}
              {:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
            </button>
          </Table.Head>
          <Table.Head class="text-xs uppercase tracking-wider">Contact</Table.Head>
          <Table.Head class="text-right">
            <button class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors ml-auto" on:click={() => toggleSort('balance')}>
              Balance
              {#if sortColumn === 'balance'}
                {#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}
              {:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
            </button>
          </Table.Head>
          <Table.Head class="text-right">
            <button class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors ml-auto" on:click={() => toggleSort('creditLimit')}>
              Credit Limit
              {#if sortColumn === 'creditLimit'}
                {#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}
              {:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
            </button>
          </Table.Head>
          <Table.Head class="text-xs uppercase tracking-wider text-center">Status</Table.Head>
          <Table.Head class="text-xs uppercase tracking-wider text-center">Actions</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each paginatedCustomers as customer}
          {@const isSelected = selectedIds.has(customer.id ?? -1)}
          <Table.Row class="group {isSelected ? 'bg-primary/5' : ''}">
            <Table.Cell class="w-12">
              <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(customer)} aria-label="Select row" />
            </Table.Cell>
            <Table.Cell>
              <div class="font-medium">{customer.name}</div>
              {#if customer.rnc}
                <div class="text-xs text-muted-foreground font-mono">RNC: {customer.rnc}</div>
              {/if}
            </Table.Cell>
            <Table.Cell>
              <Badge variant={getTypeVariant(customer.type)}>{getTypeLabel(customer.type)}</Badge>
            </Table.Cell>
            <Table.Cell>
              <div class="flex flex-col space-y-1">
                {#if customer.phone}
                  <span class="text-sm text-muted-foreground flex items-center space-x-1">
                    <Phone size={12} /><span>{customer.phone}</span>
                  </span>
                {/if}
                {#if customer.email}
                  <span class="text-sm text-muted-foreground flex items-center space-x-1">
                    <Mail size={12} /><span>{customer.email}</span>
                  </span>
                {/if}
                {#if !customer.phone && !customer.email}
                  <span class="text-muted-foreground">-</span>
                {/if}
              </div>
            </Table.Cell>
            <Table.Cell class="text-right font-mono {(customer.currentBalance ?? 0) > 0 ? 'text-yellow-500 font-bold' : 'text-muted-foreground'}">
              ${(customer.currentBalance ?? 0).toLocaleString()}
            </Table.Cell>
            <Table.Cell class="text-right font-mono text-muted-foreground">
              {customer.creditLimit ? `$${customer.creditLimit.toLocaleString()}` : '-'}
            </Table.Cell>
            <Table.Cell class="text-center">
              <Badge variant={customer.isActive ? 'default' : 'outline'} class="{customer.isActive ? 'bg-green-500' : ''}">
                {customer.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </Table.Cell>
            <Table.Cell>
              <div class="flex justify-center space-x-2">
                <Tooltip.Root>
                  <Tooltip.Trigger asChild let:builder>
                    <button use:builder.action {...builder} class="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors" on:click={() => startEdit(customer)}>
                      <Edit2 size={16} />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Edit</Tooltip.Content>
                </Tooltip.Root>
                <Tooltip.Root>
                  <Tooltip.Trigger asChild let:builder>
                    <button use:builder.action {...builder} class="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors" on:click={() => confirmDelete(customer)}>
                      <Trash2 size={16} />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Content>Delete</Tooltip.Content>
                </Tooltip.Root>
              </div>
            </Table.Cell>
          </Table.Row>
        {:else}
          <Table.Row>
            <Table.Cell colspan={8} class="h-48">
              <div class="flex flex-col items-center justify-center text-muted-foreground">
                <Users size={48} class="mb-4 opacity-20" />
                <p class="text-lg font-medium">No customers found.</p>
                <p class="text-sm">Add your first customer to get started.</p>
              </div>
            </Table.Cell>
          </Table.Row>
        {/each}
      </Table.Body>
    </Table.Root>
    </Card.Content>
  </Card.Root>
  
  <!-- Pagination -->
  {#if totalRows > 0}
    <div class="flex items-center justify-between px-2 py-4">
      <div class="text-sm text-muted-foreground">{totalRows} row(s) total.</div>
      <div class="flex items-center space-x-6">
        <div class="flex items-center space-x-2">
          <span class="text-sm text-muted-foreground">Rows per page</span>
          <Select.Root selected={{ value: String(pageSize), label: String(pageSize) }} onSelectedChange={(v) => { if (v?.value) { pageSize = Number(v.value); pageIndex = 0; } }}>
            <Select.Trigger class="h-8 w-[70px]"><Select.Value /></Select.Trigger>
            <Select.Content side="top">
              {#each [10, 20, 30, 50, 100] as size}<Select.Item value={String(size)} label={String(size)}>{size}</Select.Item>{/each}
            </Select.Content>
          </Select.Root>
        </div>
        <div class="text-sm font-medium">Page {pageIndex + 1} of {pageCount || 1}</div>
        <div class="flex items-center space-x-2">
          <Button variant="outline" size="icon" disabled={pageIndex === 0} on:click={() => pageIndex = 0}>«</Button>
          <Button variant="outline" size="icon" disabled={pageIndex === 0} on:click={() => pageIndex--}>‹</Button>
          <Button variant="outline" size="icon" disabled={pageIndex >= pageCount - 1} on:click={() => pageIndex++}>›</Button>
          <Button variant="outline" size="icon" disabled={pageIndex >= pageCount - 1} on:click={() => pageIndex = pageCount - 1}>»</Button>
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Edit/Create Dialog -->
<Dialog.Root bind:open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
  <Dialog.Content class="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
    <Dialog.Header>
      <Dialog.Title>{isCreating ? 'Add Customer' : 'Edit Customer'}</Dialog.Title>
      <Dialog.Description>{isCreating ? 'Create a new customer in your database.' : 'Update customer information.'}</Dialog.Description>
    </Dialog.Header>
    
    {#if editingCustomer}
    <div class="space-y-4 overflow-y-auto flex-1 py-4">
      <div class="space-y-1.5">
        <Label for="customer-name" class="text-xs uppercase">Customer Name *</Label>
        <Input id="customer-name" bind:value={editingCustomer.name} class="h-11 bg-input/50" placeholder="e.g. Juan Pérez" />
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1.5">
          <Label for="customer-type" class="text-xs uppercase">Type</Label>
          <Select.Root 
            selected={{ value: editingCustomer.type, label: getTypeLabel(editingCustomer.type) }} 
            onSelectedChange={(v) => { if (editingCustomer && v?.value) editingCustomer.type = v.value; }}
          >
            <Select.Trigger class="w-full bg-input/50"><Select.Value /></Select.Trigger>
            <Select.Content>
              <Select.Item value="retail" label="Retail">Retail</Select.Item>
              <Select.Item value="wholesale" label="Wholesale">Wholesale</Select.Item>
              <Select.Item value="corporate" label="Corporate">Corporate</Select.Item>
            </Select.Content>
          </Select.Root>
        </div>
        <div class="space-y-1.5">
          <Label for="customer-rnc" class="text-xs uppercase">RNC (Tax ID)</Label>
          <Input id="customer-rnc" bind:value={editingCustomer.rnc} class="h-11 bg-input/50 font-mono" placeholder="Optional" />
        </div>
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-1.5">
          <Label for="customer-phone" class="text-xs uppercase">Phone</Label>
          <Input id="customer-phone" bind:value={editingCustomer.phone} class="h-11 bg-input/50" placeholder="e.g. 809-555-1234" />
        </div>
        <div class="space-y-1.5">
          <Label for="customer-email" class="text-xs uppercase">Email</Label>
          <Input id="customer-email" type="email" bind:value={editingCustomer.email} class="h-11 bg-input/50" placeholder="email@example.com" />
        </div>
      </div>
      
      <div class="space-y-1.5">
        <Label for="customer-address" class="text-xs uppercase">Address</Label>
        <Input id="customer-address" bind:value={editingCustomer.address} class="h-11 bg-input/50" placeholder="Optional" />
      </div>

      <div class="pt-4 border-t border-border">
        <h4 class="text-sm font-bold text-muted-foreground mb-3 flex items-center space-x-2"><DollarSign size={16} /><span>Credit Settings</span></h4>
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <Label for="credit-limit" class="text-xs uppercase">Credit Limit</Label>
            <Input id="credit-limit" type="number" step="100" bind:value={editingCustomer.creditLimit} class="h-11 bg-input/50" placeholder="0" />
          </div>
          <div class="space-y-1.5">
            <Label for="current-balance" class="text-xs uppercase">Current Balance</Label>
            <Input id="current-balance" type="number" step="0.01" bind:value={editingCustomer.currentBalance} class="h-11 bg-input/50" placeholder="0" />
            <p class="text-xs text-muted-foreground">Amount owed by customer</p>
          </div>
        </div>
      </div>
      
      <div class="space-y-1.5">
        <Label for="customer-notes" class="text-xs uppercase">Notes</Label>
        <Input id="customer-notes" bind:value={editingCustomer.notes} class="h-11 bg-input/50" placeholder="Optional notes..." />
      </div>
      
      <div class="flex items-center space-x-2 pt-2">
        <Checkbox id="customer-active" checked={editingCustomer.isActive} onCheckedChange={(v) => { if (editingCustomer) editingCustomer.isActive = !!v; }} />
        <Label for="customer-active" class="text-sm">Active customer</Label>
      </div>
    </div>
    {/if}

    <Dialog.Footer class="pt-4 border-t border-border">
      <Button variant="ghost" on:click={closeDialog}>Cancel</Button>
      <Button variant="default" on:click={saveCustomer} class="font-bold shadow-lg shadow-primary/20">{isCreating ? 'Create Customer' : 'Save Changes'}</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete Customer</AlertDialog.Title>
      <AlertDialog.Description>Are you sure you want to delete <strong>{customerToDelete?.name}</strong>? This action cannot be undone.</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={() => { deleteDialogOpen = false; customerToDelete = null; }}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action class="bg-destructive text-destructive-foreground hover:bg-destructive/90" on:click={executeDelete}>Delete</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

