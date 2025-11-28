<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { db } from '$lib/db';
  import { 
    ClipboardList, Package, Zap, ArrowRight, Clock, AlertTriangle, 
    CheckCircle2, TrendingUp, Calendar, Truck, FileText, BarChart3,
    ChevronRight
  } from 'lucide-svelte';
  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';
  import type { PurchaseOrder, Receipt, Invoice, Supplier } from '$lib/types';
  import { locale } from '$lib/stores';
  import { t } from '$lib/i18n';

  // Data
  let purchaseOrders: PurchaseOrder[] = [];
  let receipts: Receipt[] = [];
  let invoices: Invoice[] = [];
  let suppliers: Supplier[] = [];
  let isLoading = true;

  // Computed metrics
  $: pendingPOs = purchaseOrders.filter(po => 
    po.status === 'sent' || po.status === 'partial'
  );
  
  $: draftPOs = purchaseOrders.filter(po => po.status === 'draft');
  
  $: recentReceipts = receipts
    .sort((a, b) => new Date(b.receiptDate).getTime() - new Date(a.receiptDate).getTime())
    .slice(0, 5);
  
  $: unmatchedReceipts = receipts.filter(r => !r.invoiceId);
  
  $: thisMonthPOs = purchaseOrders.filter(po => {
    const poDate = new Date(po.orderDate);
    const now = new Date();
    return poDate.getMonth() === now.getMonth() && poDate.getFullYear() === now.getFullYear();
  });
  
  $: thisMonthTotal = thisMonthPOs.reduce((sum, po) => sum + po.total, 0);
  
  $: overduePOs = pendingPOs.filter(po => {
    if (!po.expectedDate) return false;
    return new Date(po.expectedDate) < new Date();
  });

  // Get days until expected delivery
  function getDaysUntil(dateStr: string | undefined): number | null {
    if (!dateStr) return null;
    const diff = new Date(dateStr).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  function getSupplierName(supplierId: number): string {
    return suppliers.find(s => s.id === supplierId)?.name || 'Unknown';
  }

  onMount(async () => {
    try {
      [purchaseOrders, receipts, invoices, suppliers] = await Promise.all([
        db.purchaseOrders.toArray(),
        db.receipts.toArray(),
        db.invoices.toArray(),
        db.suppliers.toArray()
      ]);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      isLoading = false;
    }
  });
</script>

<div class="p-4 md:p-6 max-w-7xl mx-auto pb-24">
  <!-- Header -->
  <div class="mb-8">
    <h1 class="text-3xl font-bold text-foreground">Purchasing</h1>
    <p class="text-muted-foreground mt-1">Manage orders, receive goods, and capture invoices</p>
  </div>

  <!-- Workflow Cards - Three Paths -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
    <!-- Purchase Orders Card -->
    <Card.Root class="group hover:border-primary/50 transition-all cursor-pointer relative overflow-hidden" on:click={() => goto('/purchases/orders')}>
      <div class="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <Card.Header class="pb-2">
        <div class="flex items-center gap-3">
          <div class="p-3 bg-blue-500/10 rounded-xl">
            <ClipboardList class="text-blue-500" size={24} />
          </div>
          <div>
            <Card.Title class="text-lg">Purchase Orders</Card.Title>
            <p class="text-xs text-muted-foreground">Plan ahead</p>
          </div>
        </div>
      </Card.Header>
      <Card.Content>
        <p class="text-sm text-muted-foreground mb-4">
          Create orders for scheduled deliveries. Track what you ordered and when it's expected.
        </p>
        <div class="flex items-center justify-between">
          <div class="text-sm">
            <span class="font-bold text-2xl text-foreground">{draftPOs.length + pendingPOs.length}</span>
            <span class="text-muted-foreground ml-1">active</span>
          </div>
          <ChevronRight class="text-muted-foreground group-hover:text-primary transition-colors" size={20} />
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Receiving Card -->
    <Card.Root class="group hover:border-primary/50 transition-all cursor-pointer relative overflow-hidden" on:click={() => goto('/purchases/receiving')}>
      <div class="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <Card.Header class="pb-2">
        <div class="flex items-center gap-3">
          <div class="p-3 bg-green-500/10 rounded-xl">
            <Package class="text-green-500" size={24} />
          </div>
          <div>
            <Card.Title class="text-lg">Receive Goods</Card.Title>
            <p class="text-xs text-muted-foreground">Against PO</p>
          </div>
        </div>
      </Card.Header>
      <Card.Content>
        <p class="text-sm text-muted-foreground mb-4">
          Compare what you ordered vs. what arrived. Update inventory and track variances.
        </p>
        <div class="flex items-center justify-between">
          <div class="text-sm">
            <span class="font-bold text-2xl text-foreground">{pendingPOs.length}</span>
            <span class="text-muted-foreground ml-1">awaiting</span>
          </div>
          <ChevronRight class="text-muted-foreground group-hover:text-primary transition-colors" size={20} />
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Quick Capture Card -->
    <Card.Root class="group hover:border-primary/50 transition-all cursor-pointer relative overflow-hidden" on:click={() => goto('/capture')}>
      <div class="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <Card.Header class="pb-2">
        <div class="flex items-center gap-3">
          <div class="p-3 bg-amber-500/10 rounded-xl">
            <Zap class="text-amber-500" size={24} />
          </div>
          <div>
            <Card.Title class="text-lg">Quick Capture</Card.Title>
            <p class="text-xs text-muted-foreground">Live ordering</p>
          </div>
        </div>
      </Card.Header>
      <Card.Content>
        <p class="text-sm text-muted-foreground mb-4">
          Truck arrives? Snap the invoice and let AI extract everything. No PO needed.
        </p>
        <div class="flex items-center justify-between">
          <div class="text-sm text-amber-600 font-medium">
            Fastest workflow
          </div>
          <ChevronRight class="text-muted-foreground group-hover:text-primary transition-colors" size={20} />
        </div>
      </Card.Content>
    </Card.Root>
  </div>

  <!-- When to Use Each - Workflow Guide -->
  <Card.Root class="mb-8 border-dashed">
    <Card.Header class="pb-3">
      <Card.Title class="text-base flex items-center gap-2">
        <BarChart3 size={18} class="text-primary" />
        Which workflow should I use?
      </Card.Title>
    </Card.Header>
    <Card.Content>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-blue-500 font-semibold text-sm">
            <ClipboardList size={16} />
            Purchase Orders
          </div>
          <ul class="text-xs text-muted-foreground space-y-1 ml-6">
            <li>• Recurring weekly orders</li>
            <li>• Large orders arriving in parts</li>
            <li>• Budgeting & planning</li>
            <li>• Need delivery tracking</li>
          </ul>
        </div>
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-green-500 font-semibold text-sm">
            <Package size={16} />
            Receiving
          </div>
          <ul class="text-xs text-muted-foreground space-y-1 ml-6">
            <li>• Goods arrived for a PO</li>
            <li>• Need to verify quantities</li>
            <li>• Track partial deliveries</li>
            <li>• Record damaged items</li>
          </ul>
        </div>
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-amber-500 font-semibold text-sm">
            <Zap size={16} />
            Quick Capture
          </div>
          <ul class="text-xs text-muted-foreground space-y-1 ml-6">
            <li>• Truck just showed up</li>
            <li>• Emergency restocking</li>
            <li>• No time to create a PO</li>
            <li>• Utility bills & services</li>
          </ul>
        </div>
      </div>
    </Card.Content>
  </Card.Root>

  <!-- Metrics Row -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
    <Card.Root>
      <Card.Content class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-muted-foreground uppercase font-bold">This Month</p>
            <p class="text-2xl font-bold mt-1">${thisMonthTotal.toLocaleString()}</p>
          </div>
          <TrendingUp class="text-green-500" size={24} />
        </div>
      </Card.Content>
    </Card.Root>
    
    <Card.Root>
      <Card.Content class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-muted-foreground uppercase font-bold">Pending Orders</p>
            <p class="text-2xl font-bold mt-1">{pendingPOs.length}</p>
          </div>
          <Clock class="text-blue-500" size={24} />
        </div>
      </Card.Content>
    </Card.Root>
    
    <Card.Root class={overduePOs.length > 0 ? 'border-amber-500/50' : ''}>
      <Card.Content class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-muted-foreground uppercase font-bold">Overdue</p>
            <p class="text-2xl font-bold mt-1 {overduePOs.length > 0 ? 'text-amber-500' : ''}">{overduePOs.length}</p>
          </div>
          <AlertTriangle class={overduePOs.length > 0 ? 'text-amber-500' : 'text-muted-foreground'} size={24} />
        </div>
      </Card.Content>
    </Card.Root>
    
    <Card.Root>
      <Card.Content class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-xs text-muted-foreground uppercase font-bold">Unmatched Receipts</p>
            <p class="text-2xl font-bold mt-1">{unmatchedReceipts.length}</p>
          </div>
          <FileText class="text-purple-500" size={24} />
        </div>
      </Card.Content>
    </Card.Root>
  </div>

  <!-- Two Column Layout: Pending POs & Recent Activity -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Pending Purchase Orders -->
    <Card.Root>
      <Card.Header class="flex flex-row items-center justify-between pb-2">
        <Card.Title class="text-base">Pending Deliveries</Card.Title>
        <Button variant="ghost" size="sm" on:click={() => goto('/purchases/orders')}>
          View All
          <ArrowRight size={14} class="ml-1" />
        </Button>
      </Card.Header>
      <Card.Content>
        {#if isLoading}
          <div class="text-center py-8 text-muted-foreground">Loading...</div>
        {:else if pendingPOs.length === 0}
          <div class="text-center py-8">
            <Truck class="mx-auto text-muted-foreground mb-2" size={32} />
            <p class="text-muted-foreground text-sm">No pending deliveries</p>
            <Button variant="outline" size="sm" class="mt-3" on:click={() => goto('/purchases/orders')}>
              Create Purchase Order
            </Button>
          </div>
        {:else}
          <div class="space-y-3">
            {#each pendingPOs.slice(0, 5) as po}
              {@const daysUntil = getDaysUntil(po.expectedDate)}
              <button 
                class="w-full text-left p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                on:click={() => goto('/purchases/orders')}
              >
                <div class="flex items-start justify-between">
                  <div>
                    <div class="font-mono font-bold text-sm">{po.poNumber}</div>
                    <div class="text-sm text-muted-foreground">{po.supplierName || getSupplierName(po.supplierId)}</div>
                  </div>
                  <div class="text-right">
                    <div class="font-mono font-bold">${po.total.toLocaleString()}</div>
                    {#if daysUntil !== null}
                      <div class="text-xs {daysUntil < 0 ? 'text-red-500' : daysUntil <= 2 ? 'text-amber-500' : 'text-muted-foreground'}">
                        {#if daysUntil < 0}
                          {Math.abs(daysUntil)} days overdue
                        {:else if daysUntil === 0}
                          Due today
                        {:else}
                          In {daysUntil} days
                        {/if}
                      </div>
                    {/if}
                  </div>
                </div>
                <div class="flex items-center gap-2 mt-2">
                  <span class="px-2 py-0.5 rounded text-xs font-medium
                    {po.status === 'sent' ? 'bg-blue-500/10 text-blue-500' : 
                     po.status === 'partial' ? 'bg-amber-500/10 text-amber-500' : 
                     'bg-muted text-muted-foreground'}">
                    {po.status === 'sent' ? 'Awaiting' : po.status === 'partial' ? 'Partial' : po.status}
                  </span>
                  <span class="text-xs text-muted-foreground">{po.items.length} items</span>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </Card.Content>
    </Card.Root>

    <!-- Recent Receipts -->
    <Card.Root>
      <Card.Header class="flex flex-row items-center justify-between pb-2">
        <Card.Title class="text-base">Recent Receipts</Card.Title>
        <Button variant="ghost" size="sm" on:click={() => goto('/purchases/history')}>
          View All
          <ArrowRight size={14} class="ml-1" />
        </Button>
      </Card.Header>
      <Card.Content>
        {#if isLoading}
          <div class="text-center py-8 text-muted-foreground">Loading...</div>
        {:else if recentReceipts.length === 0}
          <div class="text-center py-8">
            <Package class="mx-auto text-muted-foreground mb-2" size={32} />
            <p class="text-muted-foreground text-sm">No receipts yet</p>
            <Button variant="outline" size="sm" class="mt-3" on:click={() => goto('/purchases/receiving')}>
              Receive Goods
            </Button>
          </div>
        {:else}
          <div class="space-y-3">
            {#each recentReceipts as receipt}
              <div class="p-3 rounded-lg bg-muted/30">
                <div class="flex items-start justify-between">
                  <div>
                    <div class="font-mono font-bold text-sm">{receipt.receiptNumber}</div>
                    <div class="text-sm text-muted-foreground">{receipt.supplierName || getSupplierName(receipt.supplierId)}</div>
                  </div>
                  <div class="text-right">
                    <div class="font-mono font-bold">${receipt.total.toLocaleString()}</div>
                    <div class="text-xs text-muted-foreground">{receipt.receiptDate}</div>
                  </div>
                </div>
                <div class="flex items-center gap-2 mt-2">
                  {#if receipt.purchaseOrderId}
                    <span class="px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-500">
                      Linked to PO
                    </span>
                  {:else}
                    <span class="px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                      Direct Receipt
                    </span>
                  {/if}
                  {#if !receipt.invoiceId}
                    <span class="px-2 py-0.5 rounded text-xs font-medium bg-purple-500/10 text-purple-500">
                      No Invoice
                    </span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </Card.Content>
    </Card.Root>
  </div>

  <!-- Quick Actions Footer -->
  <div class="mt-8 flex flex-wrap gap-3 justify-center">
    <Button variant="outline" on:click={() => goto('/purchases/orders')}>
      <ClipboardList size={16} class="mr-2" />
      New Purchase Order
    </Button>
    <Button variant="outline" on:click={() => goto('/purchases/receiving')}>
      <Package size={16} class="mr-2" />
      Receive Goods
    </Button>
    <Button on:click={() => goto('/capture')}>
      <Zap size={16} class="mr-2" />
      Quick Capture
    </Button>
  </div>
</div>
