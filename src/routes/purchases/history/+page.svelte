<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '$lib/db';
  import { BarChart3, FileText, Package, ClipboardList, Calendar, DollarSign, TrendingUp } from 'lucide-svelte';
  import type { PurchaseOrder, Receipt, Invoice, Supplier } from '$lib/types';
  import * as Tabs from '$lib/components/ui/tabs';
  import * as Table from '$lib/components/ui/table';
  import * as Select from '$lib/components/ui/select';
  import * as Card from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { DatePicker } from '$lib/components/ui/date-picker';
  import { locale } from '$lib/stores';
  import { t } from '$lib/i18n';
  import { goto } from '$app/navigation';

  let purchaseOrders: PurchaseOrder[] = [];
  let receipts: Receipt[] = [];
  let invoices: Invoice[] = [];
  let suppliers: Supplier[] = [];

  let typeFilter: 'all' | 'po' | 'receipt' | 'invoice' = 'all';
  let supplierFilter: number | null = null;
  let startDate = '';
  let endDate = '';
  let searchQuery = '';

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    purchaseOrders = await db.purchaseOrders.toArray();
    receipts = await db.receipts.toArray();
    invoices = await db.invoices.toArray();
    suppliers = await db.suppliers.toArray();
  }

  $: filteredData = (() => {
    let data: Array<{
      type: 'po' | 'receipt' | 'invoice';
      id: number;
      number: string;
      supplier: string;
      date: string;
      total: number;
      status?: string;
    }> = [];

    // Add POs
    if (typeFilter === 'all' || typeFilter === 'po') {
      purchaseOrders.forEach(po => {
        if (supplierFilter && po.supplierId !== supplierFilter) return;
        if (startDate && po.orderDate < startDate) return;
        if (endDate && po.orderDate > endDate) return;
        if (searchQuery && !po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !po.supplierName?.toLowerCase().includes(searchQuery.toLowerCase())) return;

        if (po.id) {
          data.push({
            type: 'po',
            id: po.id,
            number: po.poNumber,
            supplier: po.supplierName || 'Unknown',
            date: po.orderDate,
            total: po.total,
            status: po.status
          });
        }
      });
    }

    // Add Receipts
    if (typeFilter === 'all' || typeFilter === 'receipt') {
      receipts.forEach(rec => {
        if (supplierFilter && rec.supplierId !== supplierFilter) return;
        if (startDate && rec.receiptDate < startDate) return;
        if (endDate && rec.receiptDate > endDate) return;
        if (searchQuery && !rec.receiptNumber.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !rec.supplierName?.toLowerCase().includes(searchQuery.toLowerCase())) return;

        if (rec.id) {
          data.push({
            type: 'receipt',
            id: rec.id,
            number: rec.receiptNumber,
            supplier: rec.supplierName || 'Unknown',
            date: rec.receiptDate,
            total: rec.total
          });
        }
      });
    }

    // Add Invoices
    if (typeFilter === 'all' || typeFilter === 'invoice') {
      invoices.forEach(inv => {
        if (supplierFilter) {
          const supplier = suppliers.find(s => s.name === inv.providerName);
          if (!supplier || supplier.id !== supplierFilter) return;
        }
        if (startDate && inv.issueDate < startDate) return;
        if (endDate && inv.issueDate > endDate) return;
        if (searchQuery && !inv.ncf.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !inv.providerName.toLowerCase().includes(searchQuery.toLowerCase())) return;

        if (inv.id) {
          data.push({
            type: 'invoice',
            id: inv.id,
            number: inv.ncf,
            supplier: inv.providerName,
            date: inv.issueDate,
            total: inv.total,
            status: inv.paymentStatus
          });
        }
      });
    }

    return data.sort((a, b) => b.date.localeCompare(a.date));
  })();

  $: totalPurchases = filteredData.reduce((sum, item) => sum + item.total, 0);
  $: poCount = filteredData.filter(item => item.type === 'po').length;
  $: receiptCount = filteredData.filter(item => item.type === 'receipt').length;
  $: invoiceCount = filteredData.filter(item => item.type === 'invoice').length;

  function getTypeIcon(type: string) {
    switch (type) {
      case 'po': return ClipboardList;
      case 'receipt': return Package;
      case 'invoice': return FileText;
      default: return FileText;
    }
  }

  function getTypeLabel(type: string) {
    switch (type) {
      case 'po': return 'PO';
      case 'receipt': return 'Receipt';
      case 'invoice': return 'Invoice';
      default: return type;
    }
  }

  function handleRowClick(item: typeof filteredData[0]) {
    switch (item.type) {
      case 'po':
        goto(`/purchases/orders`);
        break;
      case 'receipt':
        goto(`/purchases/receiving`);
        break;
      case 'invoice':
        goto(`/invoices`);
        break;
    }
  }
</script>

<div class="p-4 max-w-7xl mx-auto pb-24">
  <div class="mb-6">
    <h1 class="text-2xl font-bold">Purchase History</h1>
    <p class="text-muted-foreground text-sm mt-1">View all purchase orders, receipts, and invoices</p>
  </div>

  <!-- Metrics -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Total Purchases</div>
        <div class="text-2xl font-bold">${totalPurchases.toLocaleString()}</div>
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Purchase Orders</div>
        <div class="text-2xl font-bold">{poCount}</div>
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Receipts</div>
        <div class="text-2xl font-bold">{receiptCount}</div>
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Invoices</div>
        <div class="text-2xl font-bold">{invoiceCount}</div>
      </Card.Content>
    </Card.Root>
  </div>

  <!-- Filters -->
  <div class="flex flex-wrap gap-2 mb-6">
    <div class="relative flex-1 min-w-[200px]">
      <Input 
        bind:value={searchQuery} 
        placeholder="Search..." 
        class="bg-card"
      />
    </div>
    <Select.Root bind:value={typeFilter}>
      <Select.Trigger class="w-40">
        <Select.Value placeholder="All Types" />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="all">All Types</Select.Item>
        <Select.Item value="po">Purchase Orders</Select.Item>
        <Select.Item value="receipt">Receipts</Select.Item>
        <Select.Item value="invoice">Invoices</Select.Item>
      </Select.Content>
    </Select.Root>
    <Select.Root bind:value={supplierFilter}>
      <Select.Trigger class="w-48">
        <Select.Value placeholder="All Suppliers" />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value={null}>All Suppliers</Select.Item>
        {#each suppliers as supplier}
          <Select.Item value={supplier.id}>{supplier.name}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
    <DatePicker bind:value={startDate} placeholder="From" class="w-40" />
    <DatePicker bind:value={endDate} placeholder="To" class="w-40" />
  </div>

  <!-- Table -->
  <div class="bg-card rounded-xl border border-border overflow-hidden">
    <Table.Root>
      <Table.Header class="bg-muted/50">
        <Table.Row>
          <Table.Head>Type</Table.Head>
          <Table.Head>Number</Table.Head>
          <Table.Head>Supplier</Table.Head>
          <Table.Head>Date</Table.Head>
          <Table.Head>Status</Table.Head>
          <Table.Head class="text-right">Total</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#if filteredData.length === 0}
          <Table.Row>
            <Table.Cell colspan="6" class="text-center py-10 text-muted-foreground">
              No purchases found
            </Table.Cell>
          </Table.Row>
        {:else}
          {#each filteredData as item}
            <Table.Row 
              class="hover:bg-muted/30 cursor-pointer"
              on:click={() => handleRowClick(item)}
            >
              <Table.Cell>
                <div class="flex items-center gap-2">
                  <svelte:component this={getTypeIcon(item.type)} size={16} class="text-primary" />
                  <span class="text-xs font-medium">{getTypeLabel(item.type)}</span>
                </div>
              </Table.Cell>
              <Table.Cell class="font-mono font-semibold">{item.number}</Table.Cell>
              <Table.Cell>{item.supplier}</Table.Cell>
              <Table.Cell class="font-mono text-sm">{item.date}</Table.Cell>
              <Table.Cell>
                {#if item.status}
                  <span class="px-2 py-1 rounded text-xs font-bold bg-muted">
                    {item.status}
                  </span>
                {:else}
                  <span class="text-muted-foreground">-</span>
                {/if}
              </Table.Cell>
              <Table.Cell class="text-right font-mono font-bold">
                ${item.total.toLocaleString()}
              </Table.Cell>
            </Table.Row>
          {/each}
        {/if}
      </Table.Body>
    </Table.Root>
  </div>
</div>

