<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '$lib/db';
  import { ChevronDown, ChevronRight, FileText, Download, Trash2, Search, RefreshCw, Eye, X, Check, Clock, AlertTriangle, DollarSign, Calendar, CreditCard, Building2, Banknote, Smartphone } from 'lucide-svelte';
  import * as XLSX from 'xlsx';
  import type { Invoice, BankAccount, PaymentMethodType, Payment } from '$lib/types';
  import { parseInvoiceWithGrok } from '$lib/grok';
  import { apiKey } from '$lib/stores';
  import { checkInvoiceDueDates, calculatePendingPayments, type InvoiceAlert } from '$lib/alerts';
  import * as Table from '$lib/components/ui/table';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';

  let invoices: Invoice[] = [];
  let groupedInvoices: Record<string, Invoice[]> = {};
  let expandedProviders: Record<string, boolean> = {};
  let searchQuery = '';
  let startDate = '';
  let endDate = '';
  let isSyncing = false;
  
  // Delete confirmation state
  let deleteDialogOpen = false;
  let invoiceToDelete: number | null = null;

  // Payment Filter
  type PaymentFilter = 'all' | 'pending' | 'paid' | 'overdue';
  let paymentFilter: PaymentFilter = 'all';

  // Dashboard Metrics
  let totalSpend = 0;
  let totalItbis = 0;
  let topSupplier = { name: '-', amount: 0 };
  
  // Payment Metrics
  let totalPending = 0;
  let dueThisWeek = 0;
  let overdueTotal = 0;
  let invoiceAlerts: InvoiceAlert[] = [];

  let selectedInvoice: Invoice | null = null;
  let showPaymentModal = false;
  let paymentInvoice: Invoice | null = null;
  let paymentAmount = 0;
  
  // Enhanced Payment State
  let bankAccounts: BankAccount[] = [];
  let selectedPaymentMethod: PaymentMethodType = 'cash';
  let selectedBankAccountId: number | null = null;
  let paymentReference = '';
  let paymentNotes = '';
  let paymentDate = new Date().toISOString().split('T')[0];

  const paymentMethods: { value: PaymentMethodType; label: string; icon: string }[] = [
    { value: 'cash', label: 'Efectivo', icon: '💵' },
    { value: 'bank_transfer', label: 'Transferencia', icon: '🏦' },
    { value: 'check', label: 'Cheque', icon: '📝' },
    { value: 'credit_card', label: 'Tarjeta Crédito', icon: '💳' },
    { value: 'debit_card', label: 'Tarjeta Débito', icon: '💳' },
    { value: 'mobile_payment', label: 'Pago Móvil', icon: '📱' },
    { value: 'other', label: 'Otro', icon: '📋' }
  ];

  onMount(async () => {
    await loadInvoices();
    await loadBankAccounts();
  });

  async function loadBankAccounts() {
    bankAccounts = await db.bankAccounts.where('isActive').equals(1).toArray();
    // Also get accounts where isActive is undefined (legacy) or true
    const allAccounts = await db.bankAccounts.toArray();
    bankAccounts = allAccounts.filter(a => a.isActive !== false);
    
    // Auto-select default account
    const defaultAccount = bankAccounts.find(a => a.isDefault);
    if (defaultAccount?.id) {
      selectedBankAccountId = defaultAccount.id;
    }
  }

  async function loadInvoices() {
    let collection = db.invoices.orderBy('issueDate').reverse();
    
    if (startDate && endDate) {
      collection = collection.filter(i => i.issueDate >= startDate && i.issueDate <= endDate);
    }

    let allInvoices = await collection.toArray();
    
    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      allInvoices = allInvoices.filter(i => 
        i.providerName.toLowerCase().includes(q) || 
        i.ncf.toLowerCase().includes(q)
      );
    }
    
    // Calculate payment metrics before filtering
    const paymentStats = calculatePendingPayments(allInvoices);
    totalPending = paymentStats.totalPending;
    dueThisWeek = paymentStats.dueThisWeek;
    overdueTotal = paymentStats.overdueTotal;
    
    // Check for due date alerts
    invoiceAlerts = checkInvoiceDueDates(allInvoices);
    
    // Apply payment filter
    if (paymentFilter !== 'all') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      allInvoices = allInvoices.filter(inv => {
        const status = inv.paymentStatus ?? 'pending';
        
        if (paymentFilter === 'paid') {
          return status === 'paid';
        } else if (paymentFilter === 'overdue') {
          if (status === 'paid') return false;
          if (!inv.dueDate) return false;
          const dueDate = new Date(inv.dueDate);
          return dueDate < today;
        } else if (paymentFilter === 'pending') {
          return status !== 'paid';
        }
        return true;
      });
    }
    
    invoices = allInvoices;

    // Calculate Metrics
    totalSpend = 0;
    totalItbis = 0;
    const supplierSpend: Record<string, number> = {};

    invoices.forEach(inv => {
      totalSpend += inv.total || 0;
      totalItbis += inv.itbisTotal || 0;
      
      const provider = inv.providerName || 'Unknown';
      supplierSpend[provider] = (supplierSpend[provider] || 0) + (inv.total || 0);
    });

    // Find Top Supplier
    let maxSpend = 0;
    let maxSupplier = '-';
    Object.entries(supplierSpend).forEach(([name, amount]) => {
      if (amount > maxSpend) {
        maxSpend = amount;
        maxSupplier = name;
      }
    });
    topSupplier = { name: maxSupplier, amount: maxSpend };

    // Group
    groupedInvoices = invoices.reduce((acc, inv) => {
      const provider = inv.providerName || 'Unknown';
      if (!acc[provider]) acc[provider] = [];
      acc[provider].push(inv);
      return acc;
    }, {} as Record<string, Invoice[]>);
  }

  function toggleProvider(provider: string) {
    expandedProviders[provider] = !expandedProviders[provider];
  }

  function confirmDeleteInvoice(id?: number) {
    if (!id) return;
    invoiceToDelete = id;
    deleteDialogOpen = true;
  }

  async function executeDeleteInvoice() {
    if (!invoiceToDelete) return;
    await db.invoices.delete(invoiceToDelete);
    deleteDialogOpen = false;
    invoiceToDelete = null;
    await loadInvoices();
  }

  async function syncInvoice(invoice: Invoice) {
    if (!$apiKey) {
      alert('Please set your API Key first');
      return;
    }
    if (!invoice.rawText) {
      alert('No OCR text found for this invoice');
      return;
    }

    isSyncing = true;
    try {
      const updatedData = await parseInvoiceWithGrok(invoice.rawText, $apiKey);
      
      const newInvoice = { ...invoice, ...updatedData, status: 'draft' as const };
      if (invoice.id) {
        await db.invoices.update(invoice.id, newInvoice);
      }
      
      alert('Invoice synced successfully!');
      await loadInvoices();
    } catch (e: any) {
      alert('Sync failed: ' + e.message);
    } finally {
      isSyncing = false;
    }
  }
  
  function openPaymentModal(invoice: Invoice) {
    paymentInvoice = invoice;
    paymentAmount = invoice.total - (invoice.paidAmount ?? 0);
    paymentDate = new Date().toISOString().split('T')[0];
    paymentReference = '';
    paymentNotes = '';
    selectedPaymentMethod = 'cash';
    // Select default bank account
    const defaultAccount = bankAccounts.find(a => a.isDefault);
    selectedBankAccountId = defaultAccount?.id || null;
    showPaymentModal = true;
  }
  
  function closePaymentModal() {
    showPaymentModal = false;
    paymentInvoice = null;
    paymentAmount = 0;
    paymentReference = '';
    paymentNotes = '';
  }
  
  async function recordPayment(full: boolean = true) {
    if (!paymentInvoice || !paymentInvoice.id) return;
    
    const amountToPay = full ? (paymentInvoice.total - (paymentInvoice.paidAmount ?? 0)) : paymentAmount;
    const newPaidAmount = (paymentInvoice.paidAmount ?? 0) + amountToPay;
    const isPaidInFull = newPaidAmount >= paymentInvoice.total;
    
    // Create payment record
    const payment: Payment = {
      invoiceId: paymentInvoice.id,
      amount: amountToPay,
      currency: paymentInvoice.currency || 'DOP',
      paymentDate: paymentDate,
      paymentMethod: selectedPaymentMethod,
      bankAccountId: needsBankAccount(selectedPaymentMethod) ? selectedBankAccountId || undefined : undefined,
      referenceNumber: paymentReference || undefined,
      notes: paymentNotes || undefined,
      createdAt: new Date()
    };
    
    await db.payments.add(payment);
    
    // Update invoice
    await db.invoices.update(paymentInvoice.id, {
      paymentStatus: isPaidInFull ? 'paid' : 'partial',
      paidAmount: newPaidAmount,
      paidDate: isPaidInFull ? paymentDate : undefined
    });
    
    closePaymentModal();
    await loadInvoices();
  }
  
  function needsBankAccount(method: PaymentMethodType): boolean {
    return ['bank_transfer', 'check', 'credit_card', 'debit_card'].includes(method);
  }
  
  async function quickMarkPaid(invoice: Invoice) {
    if (!invoice.id) return;
    
    // Create a quick cash payment record
    const payment: Payment = {
      invoiceId: invoice.id,
      amount: invoice.total - (invoice.paidAmount ?? 0),
      currency: invoice.currency || 'DOP',
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'cash',
      notes: 'Quick payment',
      createdAt: new Date()
    };
    
    await db.payments.add(payment);
    
    await db.invoices.update(invoice.id, {
      paymentStatus: 'paid',
      paidAmount: invoice.total,
      paidDate: new Date().toISOString().split('T')[0]
    });
    
    await loadInvoices();
  }

  function exportToExcel() {
    const data = invoices.map(i => ({
      Provider: i.providerName,
      RNC: i.providerRnc,
      Date: i.issueDate,
      DueDate: i.dueDate || '',
      NCF: i.ncf,
      Total: i.total,
      ITBIS: i.itbisTotal,
      Status: i.status,
      PaymentStatus: i.paymentStatus || 'pending',
      PaidAmount: i.paidAmount || 0
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");
    XLSX.writeFile(wb, `invoices_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  }
  
  function exportInvoice(invoice: Invoice) {
    const header = [
      ['Provider', invoice.providerName],
      ['RNC', invoice.providerRnc],
      ['NCF', invoice.ncf],
      ['Date', invoice.issueDate],
      ['Due Date', invoice.dueDate || 'N/A'],
      ['Total', invoice.total],
      ['ITBIS', invoice.itbisTotal],
      ['Payment Status', invoice.paymentStatus || 'pending'],
      [],
      ['Description', 'Quantity', 'Unit Price', 'ITBIS', 'Total']
    ];

    const items = invoice.items.map(item => [
      item.description,
      item.quantity,
      item.unitPrice,
      item.itbis,
      item.amount
    ]);

    const ws = XLSX.utils.aoa_to_sheet([...header, ...items]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoice");
    
    XLSX.writeFile(wb, `invoice_${invoice.providerName}_${invoice.ncf}.xlsx`);
  }

  function viewInvoice(invoice: Invoice) {
    selectedInvoice = invoice;
  }

  function closeInvoice() {
    selectedInvoice = null;
  }
  
  function getPaymentStatusColor(invoice: Invoice): string {
    const status = invoice.paymentStatus ?? 'pending';
    if (status === 'paid') return 'text-green-500 bg-green-500/10';
    if (status === 'partial') return 'text-yellow-500 bg-yellow-500/10';
    
    // Check if overdue
    if (invoice.dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(invoice.dueDate);
      if (dueDate < today) return 'text-red-500 bg-red-500/10';
    }
    
    return 'text-gray-400 bg-gray-500/10';
  }
  
  function getPaymentStatusText(invoice: Invoice): string {
    const status = invoice.paymentStatus ?? 'pending';
    if (status === 'paid') return 'Paid';
    if (status === 'partial') return `Partial (${((invoice.paidAmount ?? 0) / invoice.total * 100).toFixed(0)}%)`;
    
    // Check if overdue
    if (invoice.dueDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(invoice.dueDate);
      if (dueDate < today) {
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        return `Overdue (${daysOverdue}d)`;
      }
    }
    
    return 'Pending';
  }
  
  function getDaysUntilDue(invoice: Invoice): string {
    if (!invoice.dueDate || invoice.paymentStatus === 'paid') return '';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(invoice.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 0) return 'Due today';
    return `${diffDays}d left`;
  }
  
  function formatCurrency(amount: number): string {
    return `DOP ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
</script>

<div class="p-4 max-w-5xl mx-auto pb-24">
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
    <h1 class="text-2xl font-bold">Invoices</h1>
    
    <div class="flex flex-wrap gap-2 w-full md:w-auto">
      <div class="relative flex-1 md:w-64">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
        <input 
          bind:value={searchQuery} 
          on:input={loadInvoices}
          placeholder="Search provider, NCF..." 
          class="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-foreground focus:border-primary outline-none"
        />
      </div>
      <input 
        type="date" 
        bind:value={startDate} 
        on:change={loadInvoices}
        class="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground"
      />
      <input 
        type="date" 
        bind:value={endDate} 
        on:change={loadInvoices}
        class="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground"
      />
      <button 
        on:click={exportToExcel}
        class="bg-primary text-primary-foreground px-4 py-2 rounded-lg flex items-center space-x-2 text-sm font-bold hover:bg-primary/90"
      >
        <Download size={16} />
        <span>Export All</span>
      </button>
    </div>
  </div>

  <!-- Payment Filter Tabs -->
  <div class="flex space-x-2 mb-6 overflow-x-auto pb-2">
    <button 
      class="px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap {paymentFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}"
      on:click={() => { paymentFilter = 'all'; loadInvoices(); }}
    >
      All Invoices
    </button>
    <button 
      class="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 whitespace-nowrap {paymentFilter === 'pending' ? 'bg-yellow-500 text-black' : 'bg-card text-muted-foreground hover:text-foreground'}"
      on:click={() => { paymentFilter = 'pending'; loadInvoices(); }}
    >
      <Clock size={14} />
      <span>Pending</span>
    </button>
    <button 
      class="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 whitespace-nowrap {paymentFilter === 'overdue' ? 'bg-destructive text-destructive-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}"
      on:click={() => { paymentFilter = 'overdue'; loadInvoices(); }}
    >
      <AlertTriangle size={14} />
      <span>Overdue</span>
    </button>
    <button 
      class="px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2 whitespace-nowrap {paymentFilter === 'paid' ? 'bg-green-500 text-white' : 'bg-card text-muted-foreground hover:text-foreground'}"
      on:click={() => { paymentFilter = 'paid'; loadInvoices(); }}
    >
      <Check size={14} />
      <span>Paid</span>
    </button>
  </div>

  <!-- Dashboard Cards -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <!-- Total Spend -->
    <div class="bg-card text-card-foreground border border-border rounded-xl p-4">
      <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Total Spend</div>
      <div class="text-xl font-bold">{formatCurrency(totalSpend)}</div>
    </div>

    <!-- Total ITBIS -->
    <div class="bg-card text-card-foreground border border-border rounded-xl p-4">
      <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Total ITBIS</div>
      <div class="text-xl font-bold text-primary">{formatCurrency(totalItbis)}</div>
    </div>

    <!-- Pending Payments -->
    <div class="bg-card text-card-foreground border border-border rounded-xl p-4 {totalPending > 0 ? 'border-yellow-500/30' : ''}">
      <div class="text-muted-foreground text-xs uppercase font-bold mb-1 flex items-center space-x-1">
        <DollarSign size={12} />
        <span>Pending</span>
      </div>
      <div class="text-xl font-bold text-yellow-500">{formatCurrency(totalPending)}</div>
      {#if dueThisWeek > 0}
        <div class="text-xs text-yellow-500 mt-1">{formatCurrency(dueThisWeek)} this week</div>
      {/if}
    </div>

    <!-- Overdue -->
    <div class="bg-card text-card-foreground border border-border rounded-xl p-4 {overdueTotal > 0 ? 'border-destructive/30' : ''}">
      <div class="text-muted-foreground text-xs uppercase font-bold mb-1 flex items-center space-x-1">
        <AlertTriangle size={12} />
        <span>Overdue</span>
      </div>
      <div class="text-xl font-bold {overdueTotal > 0 ? 'text-destructive' : 'text-green-500'}">
        {overdueTotal > 0 ? formatCurrency(overdueTotal) : 'None'}
      </div>
    </div>
  </div>
  
  <!-- Due Soon Alerts -->
  {#if invoiceAlerts.length > 0 && paymentFilter !== 'paid'}
    <div class="mb-6 bg-card border border-yellow-500/30 rounded-xl p-4">
      <h3 class="text-sm font-bold text-yellow-500 mb-3 flex items-center space-x-2">
        <Calendar size={16} />
        <span>Payment Reminders</span>
      </h3>
      <div class="space-y-2">
        {#each invoiceAlerts.slice(0, 5) as alert}
          <div class="flex items-center justify-between p-2 rounded-lg {
            alert.severity === 'critical' ? 'bg-destructive/10' :
            alert.severity === 'warning' ? 'bg-yellow-500/10' :
            'bg-muted'
          }">
            <div class="flex items-center space-x-2">
              <span>{alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : '📅'}</span>
              <span class="text-sm text-foreground">{alert.message}</span>
            </div>
            <span class="text-sm font-mono font-bold {
              alert.severity === 'critical' ? 'text-destructive' :
              alert.severity === 'warning' ? 'text-yellow-500' :
              'text-muted-foreground'
            }">{formatCurrency(alert.amount)}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <div class="space-y-4">
    {#each Object.entries(groupedInvoices) as [provider, items]}
      <div class="bg-card text-card-foreground rounded-xl border border-border overflow-hidden">
        <button 
          class="w-full p-4 flex justify-between items-center hover:bg-muted/50 transition-colors"
          on:click={() => toggleProvider(provider)}
        >
          <div class="flex items-center space-x-3">
            {#if expandedProviders[provider]}
              <ChevronDown size={20} class="text-muted-foreground" />
            {:else}
              <ChevronRight size={20} class="text-muted-foreground" />
            {/if}
            <span class="font-bold">{provider}</span>
            <span class="bg-muted text-muted-foreground text-xs px-2 py-1 rounded-full">{items.length}</span>
          </div>
          <span class="text-green-500 font-mono font-bold">
            {formatCurrency(items.reduce((sum, i) => sum + (i.total || 0), 0))}
          </span>
        </button>

        {#if expandedProviders[provider]}
          <div class="border-t border-border bg-muted/30">
            {#each items as invoice}
              <div class="p-4 border-b border-border last:border-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div class="flex items-start space-x-4">
                  <div class="w-10 h-10 rounded bg-background flex items-center justify-center flex-shrink-0 border border-border">
                    <FileText size={20} class="text-primary" />
                  </div>
                  <div>
                    <div class="font-medium flex items-center space-x-2">
                      <span>{invoice.issueDate}</span>
                      {#if invoice.dueDate && invoice.paymentStatus !== 'paid'}
                        <span class="text-xs {getDaysUntilDue(invoice).includes('overdue') ? 'text-destructive' : 'text-muted-foreground'}">
                          ({getDaysUntilDue(invoice)})
                        </span>
                      {/if}
                    </div>
                    <div class="text-muted-foreground text-xs font-mono">{invoice.ncf}</div>
                  </div>
                </div>
                
                <div class="flex items-center space-x-4 w-full md:w-auto justify-between md:justify-end">
                  <!-- Payment Status Badge -->
                  <div class="flex flex-col items-end">
                    <span class="px-2 py-1 rounded text-xs font-bold {getPaymentStatusColor(invoice)}">
                      {getPaymentStatusText(invoice)}
                    </span>
                  </div>
                  
                  <div class="text-right">
                    <div class="font-mono font-bold">{formatCurrency(invoice.total)}</div>
                    <div class="text-muted-foreground text-xs">ITBIS: {invoice.itbisTotal?.toFixed(2)}</div>
                  </div>
                  
                  <div class="flex items-center space-x-1">
                    {#if invoice.paymentStatus !== 'paid'}
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild let:builder>
                          <button 
                            use:builder.action
                            {...builder}
                            on:click={() => openPaymentModal(invoice)}
                            class="p-2 text-green-500 hover:text-green-600 transition-colors bg-green-500/10 rounded-lg"
                          >
                            <DollarSign size={16} />
                          </button>
                        </Tooltip.Trigger>
                        <Tooltip.Content>Record Payment</Tooltip.Content>
                      </Tooltip.Root>
                    {/if}
                    
                    {#if invoice.status === 'needs_extraction'}
                      <Tooltip.Root>
                        <Tooltip.Trigger asChild let:builder>
                          <button 
                            use:builder.action
                            {...builder}
                            on:click={() => syncInvoice(invoice)}
                            class="p-2 text-yellow-500 hover:text-yellow-600 transition-colors bg-yellow-500/10 rounded-lg"
                            disabled={isSyncing}
                          >
                            <RefreshCw size={16} class={isSyncing ? 'animate-spin' : ''} />
                          </button>
                        </Tooltip.Trigger>
                        <Tooltip.Content>Sync with AI</Tooltip.Content>
                      </Tooltip.Root>
                    {/if}
                    
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild let:builder>
                        <button 
                          use:builder.action
                          {...builder}
                          on:click={() => viewInvoice(invoice)}
                          class="p-2 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Eye size={16} />
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Content>View Details</Tooltip.Content>
                    </Tooltip.Root>

                    <Tooltip.Root>
                      <Tooltip.Trigger asChild let:builder>
                        <button 
                          use:builder.action
                          {...builder}
                          on:click={() => exportInvoice(invoice)}
                          class="p-2 text-muted-foreground hover:text-primary transition-colors"
                        >
                          <Download size={16} />
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Content>Export Excel</Tooltip.Content>
                    </Tooltip.Root>
                    
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild let:builder>
                        <button 
                          use:builder.action
                          {...builder}
                          on:click={() => confirmDeleteInvoice(invoice.id)}
                          class="p-2 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Content>Delete</Tooltip.Content>
                    </Tooltip.Root>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
    
    {#if Object.keys(groupedInvoices).length === 0}
      <div class="text-center text-muted-foreground py-10">
        No invoices found.
      </div>
    {/if}
  </div>
</div>

<!-- Enhanced Payment Modal -->
{#if showPaymentModal && paymentInvoice}
  <div class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" on:click|self={closePaymentModal}>
    <div class="bg-card text-card-foreground w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden my-auto">
      <div class="p-4 border-b border-border flex justify-between items-center bg-green-500/10">
        <div class="flex items-center space-x-2">
          <DollarSign size={20} class="text-green-500" />
          <h3 class="font-bold">Registrar Pago</h3>
        </div>
        <button on:click={closePaymentModal} class="text-muted-foreground hover:text-foreground p-1 hover:bg-muted rounded-lg">
          <X size={20} />
        </button>
      </div>
      
      <div class="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        <!-- Invoice Info -->
        <div class="bg-muted/50 rounded-lg p-3">
          <div class="text-muted-foreground text-xs">Factura de</div>
          <div class="font-bold">{paymentInvoice.providerName}</div>
          <div class="text-muted-foreground text-xs font-mono">{paymentInvoice.ncf}</div>
        </div>
        
        <!-- Totals -->
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-muted/50 p-3 rounded-lg">
            <div class="text-xs text-muted-foreground uppercase">Total</div>
            <div class="font-bold">{formatCurrency(paymentInvoice.total)}</div>
          </div>
          <div class="bg-muted/50 p-3 rounded-lg">
            <div class="text-xs text-muted-foreground uppercase">Pendiente</div>
            <div class="text-yellow-500 font-bold">{formatCurrency(paymentInvoice.total - (paymentInvoice.paidAmount ?? 0))}</div>
          </div>
        </div>

        <!-- Payment Method Selection -->
        <div>
          <label class="block text-xs text-muted-foreground uppercase mb-2">Método de Pago</label>
          <div class="grid grid-cols-4 gap-2">
            {#each paymentMethods.slice(0, 4) as method}
              <button 
                type="button"
                class="p-2 rounded-lg border text-center transition-all {selectedPaymentMethod === method.value ? 'border-green-500 bg-green-500/10' : 'border-border hover:border-muted-foreground'}"
                on:click={() => selectedPaymentMethod = method.value}
              >
                <span class="text-xl">{method.icon}</span>
                <div class="text-[10px] text-muted-foreground mt-1 truncate">{method.label}</div>
              </button>
            {/each}
          </div>
          <div class="grid grid-cols-3 gap-2 mt-2">
            {#each paymentMethods.slice(4) as method}
              <button 
                type="button"
                class="p-2 rounded-lg border text-center transition-all {selectedPaymentMethod === method.value ? 'border-green-500 bg-green-500/10' : 'border-border hover:border-muted-foreground'}"
                on:click={() => selectedPaymentMethod = method.value}
              >
                <span class="text-lg">{method.icon}</span>
                <div class="text-[10px] text-muted-foreground mt-1 truncate">{method.label}</div>
              </button>
            {/each}
          </div>
        </div>

        <!-- Bank Account Selection (shown for relevant methods) -->
        {#if needsBankAccount(selectedPaymentMethod)}
          <div>
            <label class="block text-xs text-muted-foreground uppercase mb-2">Cuenta Bancaria</label>
            {#if bankAccounts.length > 0}
              <div class="space-y-2">
                {#each bankAccounts as bank}
                  <button 
                    type="button"
                    class="w-full p-3 rounded-lg border text-left flex items-center gap-3 transition-all {selectedBankAccountId === bank.id ? 'border-green-500 bg-green-500/10' : 'border-border hover:border-muted-foreground'}"
                    on:click={() => selectedBankAccountId = bank.id || null}
                  >
                    <div 
                      class="w-10 h-10 rounded-lg flex items-center justify-center"
                      style="background-color: {bank.color || '#3b82f6'}20"
                    >
                      <Building2 size={18} style="color: {bank.color || '#3b82f6'}" />
                    </div>
                    <div class="flex-1">
                      <div class="font-medium">{bank.bankName}</div>
                      <div class="text-xs text-muted-foreground">
                        {bank.accountName}
                        {#if bank.accountNumber}· ****{bank.accountNumber.slice(-4)}{/if}
                      </div>
                    </div>
                    {#if selectedBankAccountId === bank.id}
                      <Check size={18} class="text-green-500" />
                    {/if}
                  </button>
                {/each}
              </div>
            {:else}
              <div class="text-center py-4 bg-muted/50 rounded-lg">
                <p class="text-muted-foreground text-sm">No hay cuentas bancarias</p>
                <a href="/settings" class="text-primary text-sm hover:underline">Agregar en Configuración</a>
              </div>
            {/if}
          </div>
        {/if}

        <!-- Amount & Date -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-muted-foreground uppercase mb-2">Monto</label>
            <input 
              type="number" 
              step="0.01"
              bind:value={paymentAmount}
              class="w-full bg-input/50 border border-input rounded-lg p-3 font-mono focus:border-green-500 outline-none"
            />
          </div>
          <div>
            <label class="block text-xs text-muted-foreground uppercase mb-2">Fecha</label>
            <input 
              type="date"
              bind:value={paymentDate}
              class="w-full bg-input/50 border border-input rounded-lg p-3 focus:border-green-500 outline-none"
            />
          </div>
        </div>

        <!-- Reference Number (for transfers/checks) -->
        {#if selectedPaymentMethod === 'bank_transfer' || selectedPaymentMethod === 'check'}
          <div>
            <label class="block text-xs text-muted-foreground uppercase mb-2">
              {selectedPaymentMethod === 'check' ? 'Número de Cheque' : 'Número de Referencia'}
            </label>
            <input 
              type="text"
              bind:value={paymentReference}
              placeholder={selectedPaymentMethod === 'check' ? 'Ej: 001234' : 'Ej: TRF-123456'}
              class="w-full bg-input/50 border border-input rounded-lg p-3 focus:border-green-500 outline-none"
            />
          </div>
        {/if}

        <!-- Notes -->
        <div>
          <label class="block text-xs text-muted-foreground uppercase mb-2">Notas (opcional)</label>
          <input 
            type="text"
            bind:value={paymentNotes}
            placeholder="Notas adicionales..."
            class="w-full bg-input/50 border border-input rounded-lg p-3 focus:border-green-500 outline-none"
          />
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="p-4 border-t border-border flex gap-3">
        <button 
          on:click={() => recordPayment(false)}
          disabled={paymentAmount <= 0}
          class="flex-1 bg-yellow-500/20 text-yellow-500 px-4 py-3 rounded-xl font-bold hover:bg-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Pago Parcial
        </button>
        <button 
          on:click={() => recordPayment(true)}
          class="flex-1 bg-green-500 text-black px-4 py-3 rounded-xl font-bold hover:bg-green-400 transition-colors flex items-center justify-center gap-2"
        >
          <Check size={18} />
          Pagar Todo
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Invoice Detail Modal -->
{#if selectedInvoice}
  <div class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
    <div class="bg-card text-card-foreground border border-border rounded-2xl w-full max-w-3xl shadow-2xl my-auto relative flex flex-col max-h-[90vh]">
      <!-- Modal Header -->
      <div class="p-4 border-b border-border flex justify-between items-center bg-muted sticky top-0 z-10 rounded-t-2xl">
        <div>
          <h2 class="text-xl font-bold">Invoice Details</h2>
          <p class="text-sm text-muted-foreground">{selectedInvoice.providerName} • {selectedInvoice.ncf}</p>
        </div>
        <button on:click={closeInvoice} class="text-muted-foreground hover:text-foreground bg-muted/50 p-2 rounded-full transition-colors">
          <X size={24} />
        </button>
      </div>

      <!-- Modal Content -->
      <div class="p-6 overflow-y-auto">
        <!-- Info Grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-muted/50 p-3 rounded-lg">
            <div class="text-xs text-muted-foreground uppercase font-bold mb-1">Issue Date</div>
            <div class="font-medium">{selectedInvoice.issueDate}</div>
          </div>
          <div class="bg-muted/50 p-3 rounded-lg">
            <div class="text-xs text-muted-foreground uppercase font-bold mb-1">Due Date</div>
            <div class="font-medium">{selectedInvoice.dueDate || 'N/A'}</div>
          </div>
          <div class="bg-muted/50 p-3 rounded-lg">
            <div class="text-xs text-muted-foreground uppercase font-bold mb-1">RNC</div>
            <div class="font-medium">{selectedInvoice.providerRnc}</div>
          </div>
          <div class="bg-muted/50 p-3 rounded-lg">
            <div class="text-xs text-muted-foreground uppercase font-bold mb-1">Payment</div>
            <div class="font-medium {getPaymentStatusColor(selectedInvoice).split(' ')[0]}">
              {getPaymentStatusText(selectedInvoice)}
            </div>
          </div>
        </div>

        <!-- Items Table -->
        <div class="border border-border rounded-lg overflow-hidden mb-6">
          <Table.Root>
            <Table.Header class="bg-muted">
              <Table.Row class="hover:bg-muted">
                <Table.Head class="text-xs uppercase p-3">Description</Table.Head>
                <Table.Head class="text-xs uppercase p-3 text-center">Qty</Table.Head>
                <Table.Head class="text-xs uppercase p-3 text-right">Price</Table.Head>
                <Table.Head class="text-xs uppercase p-3 text-right">ITBIS</Table.Head>
                <Table.Head class="text-xs uppercase p-3 text-right">Total</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each selectedInvoice.items || [] as item}
                <Table.Row>
                  <Table.Cell class="p-3">{item.description}</Table.Cell>
                  <Table.Cell class="p-3 text-center">{item.quantity}</Table.Cell>
                  <Table.Cell class="p-3 text-right font-mono">{item.unitPrice?.toFixed(2)}</Table.Cell>
                  <Table.Cell class="p-3 text-muted-foreground text-right font-mono">{item.itbis?.toFixed(2)}</Table.Cell>
                  <Table.Cell class="p-3 text-right font-mono font-bold">{item.amount?.toFixed(2)}</Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>

        <!-- Totals -->
        <div class="flex justify-end">
          <div class="w-full md:w-1/3 space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">Subtotal</span>
              <span class="font-mono">{selectedInvoice.subtotal?.toFixed(2)}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">ITBIS</span>
              <span class="font-mono">{selectedInvoice.itbisTotal?.toFixed(2)}</span>
            </div>
            {#if selectedInvoice.paidAmount && selectedInvoice.paidAmount > 0}
              <div class="flex justify-between text-sm">
                <span class="text-green-500">Paid</span>
                <span class="text-green-500 font-mono">-{selectedInvoice.paidAmount?.toFixed(2)}</span>
              </div>
            {/if}
            <div class="border-t border-border pt-2 flex justify-between items-center">
              <span class="font-bold text-lg">
                {selectedInvoice.paymentStatus === 'paid' ? 'Total' : 'Balance'}
              </span>
              <span class="text-green-500 font-bold text-xl font-mono">
                {formatCurrency(selectedInvoice.total - (selectedInvoice.paidAmount ?? 0))}
              </span>
            </div>
          </div>
        </div>
        
        <!-- Payment Actions -->
        {#if selectedInvoice.paymentStatus !== 'paid'}
          <div class="mt-6 pt-4 border-t border-border flex justify-end space-x-3">
            <button 
              on:click={() => { closeInvoice(); openPaymentModal(selectedInvoice); }}
              class="bg-green-500 text-black px-6 py-2 rounded-xl font-bold hover:bg-green-400 transition-colors flex items-center space-x-2"
            >
              <DollarSign size={18} />
              <span>Record Payment</span>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Delete Invoice Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete Invoice</AlertDialog.Title>
      <AlertDialog.Description>Are you sure you want to delete this invoice? This action cannot be undone.</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={() => { deleteDialogOpen = false; invoiceToDelete = null; }}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action class="bg-destructive text-destructive-foreground hover:bg-destructive/90" on:click={executeDeleteInvoice}>Delete</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
