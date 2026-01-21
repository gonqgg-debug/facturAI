<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '$lib/db';
  import { BarChart3, FileText, Package, ClipboardList, Calendar, DollarSign, TrendingUp, ChevronDown, ChevronRight, Check, Clock, AlertCircle, ExternalLink } from 'lucide-svelte';
  import type { PurchaseOrder, Receipt, Invoice, Supplier } from '$lib/types';
  import * as Table from '$lib/components/ui/table';
  import * as Select from '$lib/components/ui/select';
  import * as Card from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import { DatePicker } from '$lib/components/ui/date-picker';
  import { locale } from '$lib/stores';
  import { t } from '$lib/i18n';
  import { goto } from '$app/navigation';
  import { slide } from 'svelte/transition';

  let purchaseOrders: PurchaseOrder[] = [];
  let receipts: Receipt[] = [];
  let invoices: Invoice[] = [];
  let suppliers: Supplier[] = [];

  let supplierFilter: string | null = null;
  let statusFilter: string | null = null;
  let startDate = '';
  let endDate = '';
  let searchQuery = '';
  let expandedPOs: Set<string> = new Set();

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    purchaseOrders = await db.purchaseOrders.toArray();
    receipts = await db.receipts.toArray();
    invoices = await db.invoices.toArray();
    suppliers = await db.suppliers.toArray();
  }

  // Create a consolidated view with POs as main items
  interface ConsolidatedPO {
    po: PurchaseOrder;
    receipt: Receipt | null;
    invoice: Invoice | null;
    status: 'draft' | 'sent' | 'received' | 'invoiced' | 'paid';
  }

  $: consolidatedData = (() => {
    let data: ConsolidatedPO[] = [];

    purchaseOrders.forEach(po => {
      if (!po.id) return;

      // Apply filters
      if (supplierFilter && po.supplierId !== supplierFilter) return;
      if (startDate && po.orderDate < startDate) return;
      if (endDate && po.orderDate > endDate) return;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!po.poNumber.toLowerCase().includes(query) &&
            !po.supplierName?.toLowerCase().includes(query)) return;
      }

      // Find linked receipt
      const receipt = receipts.find(r => r.purchaseOrderId === po.id) || null;
      
      // Find linked invoice (through receipt or by matching supplier/date)
      let invoice: Invoice | null = null;
      if (receipt?.invoiceId) {
        invoice = invoices.find(i => i.id === receipt.invoiceId) || null;
      }

      // Determine consolidated status
      let status: ConsolidatedPO['status'] = 'draft';
      if (po.status === 'sent') status = 'sent';
      if (receipt) status = 'received';
      if (invoice) status = 'invoiced';
      if (invoice?.paymentStatus === 'paid') status = 'paid';

      // Apply status filter
      if (statusFilter && status !== statusFilter) return;

      data.push({ po, receipt, invoice, status });
    });

    return data.sort((a, b) => b.po.orderDate.localeCompare(a.po.orderDate));
  })();

  // Metrics
  $: totalPurchases = consolidatedData.reduce((sum, item) => sum + item.po.total, 0);
  $: draftCount = consolidatedData.filter(item => item.status === 'draft' || item.status === 'sent').length;
  $: receivedCount = consolidatedData.filter(item => item.receipt !== null).length;
  $: invoicedCount = consolidatedData.filter(item => item.invoice !== null).length;
  $: paidCount = consolidatedData.filter(item => item.status === 'paid').length;

  function toggleExpand(poId: string) {
    if (expandedPOs.has(poId)) {
      expandedPOs.delete(poId);
    } else {
      expandedPOs.add(poId);
    }
    expandedPOs = expandedPOs; // Trigger reactivity
  }

  function getStatusColor(status: ConsolidatedPO['status']) {
    switch (status) {
      case 'draft': return 'bg-gray-500/20 text-gray-400';
      case 'sent': return 'bg-blue-500/20 text-blue-400';
      case 'received': return 'bg-yellow-500/20 text-yellow-400';
      case 'invoiced': return 'bg-orange-500/20 text-orange-400';
      case 'paid': return 'bg-green-500/20 text-green-400';
      default: return 'bg-muted text-muted-foreground';
    }
  }

  function getStatusLabel(status: ConsolidatedPO['status']) {
    switch (status) {
      case 'draft': return 'Draft';
      case 'sent': return 'Sent';
      case 'received': return 'Received';
      case 'invoiced': return 'Invoiced';
      case 'paid': return 'Paid';
      default: return status;
    }
  }

  function getStatusIcon(status: ConsolidatedPO['status']) {
    switch (status) {
      case 'draft': return Clock;
      case 'sent': return ExternalLink;
      case 'received': return Package;
      case 'invoiced': return FileText;
      case 'paid': return Check;
      default: return Clock;
    }
  }

  function navigateToPO(poId: string) {
    goto(`/purchases/orders?id=${poId}`);
  }

  function navigateToReceipt(receiptId: string) {
    goto(`/purchases/receiving?id=${receiptId}`);
  }

  function navigateToInvoice(invoiceId: string) {
    goto(`/invoices?id=${invoiceId}`);
  }

  // Wrapper to handle click with stopPropagation for component buttons
  function handleReceiptClick(event: MouseEvent, receiptId: string | undefined) {
    event.stopPropagation();
    if (receiptId) navigateToReceipt(receiptId);
  }

  function handleInvoiceClick(event: MouseEvent, invoiceId: string | undefined) {
    event.stopPropagation();
    if (invoiceId) navigateToInvoice(invoiceId);
  }
</script>

<div class="p-4 max-w-7xl mx-auto pb-24">
  <div class="mb-6">
    <h1 class="text-2xl font-bold">Purchase History</h1>
    <p class="text-muted-foreground text-sm mt-1">Track purchase orders from creation to payment</p>
  </div>

  <!-- Metrics - Now showing the purchase lifecycle -->
  <div class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Total Value</div>
        <div class="text-2xl font-bold">${totalPurchases.toLocaleString()}</div>
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Orders</div>
        <div class="text-2xl font-bold">{consolidatedData.length}</div>
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Pending</div>
        <div class="text-2xl font-bold text-yellow-500">{draftCount}</div>
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Received</div>
        <div class="text-2xl font-bold text-blue-500">{receivedCount}</div>
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Paid</div>
        <div class="text-2xl font-bold text-green-500">{paidCount}</div>
      </Card.Content>
    </Card.Root>
  </div>

  <!-- Filters -->
  <div class="flex flex-wrap gap-2 mb-6">
    <div class="relative flex-1 min-w-[200px]">
      <Input 
        bind:value={searchQuery} 
        placeholder="Search by PO number or supplier..." 
        class="bg-card"
      />
    </div>
    <Select.Root bind:value={statusFilter}>
      <Select.Trigger class="w-40">
        <Select.Value placeholder="All Status" />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value={null}>All Status</Select.Item>
        <Select.Item value="draft">Draft</Select.Item>
        <Select.Item value="sent">Sent</Select.Item>
        <Select.Item value="received">Received</Select.Item>
        <Select.Item value="invoiced">Invoiced</Select.Item>
        <Select.Item value="paid">Paid</Select.Item>
      </Select.Content>
    </Select.Root>
    <Select.Root bind:value={supplierFilter}>
      <Select.Trigger class="w-48">
        <Select.Value placeholder="All Suppliers" />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value={null}>All Suppliers</Select.Item>
        {#each suppliers as supplier}
          {#if supplier.id}
            <Select.Item value={supplier.id}>{supplier.name}</Select.Item>
          {/if}
        {/each}
      </Select.Content>
    </Select.Root>
    <DatePicker bind:value={startDate} placeholder="From" class="w-40" />
    <DatePicker bind:value={endDate} placeholder="To" class="w-40" />
  </div>

  <!-- Consolidated Table -->
  <div class="bg-card rounded-xl border border-border overflow-hidden">
    <Table.Root>
      <Table.Header class="bg-muted/50">
        <Table.Row>
          <Table.Head class="w-10"></Table.Head>
          <Table.Head>PO Number</Table.Head>
          <Table.Head>Supplier</Table.Head>
          <Table.Head>Date</Table.Head>
          <Table.Head>Status</Table.Head>
          <Table.Head class="text-center">Documents</Table.Head>
          <Table.Head class="text-right">Total</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#if consolidatedData.length === 0}
          <Table.Row>
            <Table.Cell colspan="7" class="text-center py-10 text-muted-foreground">
              No purchase orders found
            </Table.Cell>
          </Table.Row>
        {:else}
          {#each consolidatedData as item}
            {@const isExpanded = item.po.id && expandedPOs.has(item.po.id)}
            {@const hasDocuments = item.receipt || item.invoice}
            
            <!-- Main PO Row -->
            <Table.Row 
              class="hover:bg-muted/30 {hasDocuments ? 'cursor-pointer' : ''}"
              on:click={() => hasDocuments && item.po.id && toggleExpand(item.po.id)}
            >
              <Table.Cell class="w-10">
                {#if hasDocuments}
                  <button class="p-1 hover:bg-muted rounded transition-transform {isExpanded ? 'rotate-90' : ''}">
                    <ChevronRight size={16} />
                  </button>
                {/if}
              </Table.Cell>
              <Table.Cell>
                <button 
                  class="font-mono font-semibold text-primary hover:underline"
                  on:click|stopPropagation={() => item.po.id && navigateToPO(item.po.id)}
                >
                  {item.po.poNumber}
                </button>
              </Table.Cell>
              <Table.Cell>{item.po.supplierName || 'Unknown'}</Table.Cell>
              <Table.Cell class="font-mono text-sm">{item.po.orderDate}</Table.Cell>
              <Table.Cell>
                <span class="px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit {getStatusColor(item.status)}">
                  <svelte:component this={getStatusIcon(item.status)} size={12} />
                  {getStatusLabel(item.status)}
                </span>
              </Table.Cell>
              <Table.Cell class="text-center">
                <div class="flex items-center justify-center gap-2">
                  <!-- Receipt indicator -->
                  <div 
                    class="w-6 h-6 rounded-full flex items-center justify-center {item.receipt ? 'bg-green-500/20 text-green-500' : 'bg-muted text-muted-foreground'}"
                    title={item.receipt ? `Receipt: ${item.receipt.receiptNumber}` : 'No receipt yet'}
                  >
                    <Package size={12} />
                  </div>
                  <!-- Invoice indicator -->
                  <div 
                    class="w-6 h-6 rounded-full flex items-center justify-center {item.invoice ? 'bg-blue-500/20 text-blue-500' : 'bg-muted text-muted-foreground'}"
                    title={item.invoice ? `Invoice: ${item.invoice.ncf}` : 'No invoice yet'}
                  >
                    <FileText size={12} />
                  </div>
                </div>
              </Table.Cell>
              <Table.Cell class="text-right font-mono font-bold">
                ${item.po.total.toLocaleString()}
              </Table.Cell>
            </Table.Row>

            <!-- Expanded Documents Section -->
            {#if isExpanded && hasDocuments}
              <Table.Row>
                <Table.Cell colspan="7" class="p-0 bg-muted/20">
                  <div transition:slide={{ duration: 200 }} class="p-4 pl-12 space-y-3">
                    <!-- Receipt -->
                    {#if item.receipt}
                      <div class="flex items-center justify-between p-3 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors">
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                            <Package size={16} class="text-green-500" />
                          </div>
                          <div>
                            <div class="font-semibold text-sm">Receipt</div>
                            <div class="font-mono text-xs text-muted-foreground">{item.receipt.receiptNumber}</div>
                          </div>
                        </div>
                        <div class="flex items-center gap-4">
                          <div class="text-right">
                            <div class="text-xs text-muted-foreground">Received</div>
                            <div class="font-mono text-sm">{item.receipt.receiptDate}</div>
                          </div>
                          <div class="text-right">
                            <div class="text-xs text-muted-foreground">Total</div>
                            <div class="font-mono font-bold">${item.receipt.total.toLocaleString()}</div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            on:click={(e) => handleReceiptClick(e, item.receipt?.id)}
                          >
                            View <ExternalLink size={14} class="ml-1" />
                          </Button>
                        </div>
                      </div>
                    {/if}

                    <!-- Invoice -->
                    {#if item.invoice}
                      <div class="flex items-center justify-between p-3 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors">
                        <div class="flex items-center gap-3">
                          <div class="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <FileText size={16} class="text-blue-500" />
                          </div>
                          <div>
                            <div class="font-semibold text-sm">Invoice</div>
                            <div class="font-mono text-xs text-muted-foreground">{item.invoice.ncf}</div>
                          </div>
                        </div>
                        <div class="flex items-center gap-4">
                          <div class="text-right">
                            <div class="text-xs text-muted-foreground">Status</div>
                            <span class="px-2 py-0.5 rounded text-xs font-bold {
                              item.invoice.paymentStatus === 'paid' ? 'bg-green-500/20 text-green-500' :
                              item.invoice.paymentStatus === 'overdue' ? 'bg-red-500/20 text-red-500' :
                              'bg-yellow-500/20 text-yellow-500'
                            }">
                              {item.invoice.paymentStatus || 'pending'}
                            </span>
                          </div>
                          <div class="text-right">
                            <div class="text-xs text-muted-foreground">Total</div>
                            <div class="font-mono font-bold">${item.invoice.total.toLocaleString()}</div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            on:click={(e) => handleInvoiceClick(e, item.invoice?.id)}
                          >
                            View <ExternalLink size={14} class="ml-1" />
                          </Button>
                        </div>
                      </div>
                    {/if}
                  </div>
                </Table.Cell>
              </Table.Row>
            {/if}
          {/each}
        {/if}
      </Table.Body>
    </Table.Root>
  </div>

  <!-- Legend -->
  <div class="mt-4 flex items-center gap-6 text-xs text-muted-foreground">
    <div class="flex items-center gap-2">
      <div class="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
        <Package size={10} class="text-green-500" />
      </div>
      <span>Receipt attached</span>
    </div>
    <div class="flex items-center gap-2">
      <div class="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center">
        <FileText size={10} class="text-blue-500" />
      </div>
      <span>Invoice attached</span>
    </div>
    <div class="flex items-center gap-2">
      <div class="w-4 h-4 rounded-full bg-muted flex items-center justify-center">
        <Package size={10} class="text-muted-foreground" />
      </div>
      <span>Not yet attached</span>
    </div>
  </div>
</div>

