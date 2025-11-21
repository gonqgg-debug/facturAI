<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '$lib/db';
  import { liveQuery } from 'dexie';
  import { ChevronDown, ChevronRight, FileText, Download, Trash2, Search, RefreshCw, Eye, X } from 'lucide-svelte';
  import * as XLSX from 'xlsx';
  import type { Invoice } from '$lib/types';
  import { parseInvoiceWithGrok } from '$lib/grok';
  import { apiKey } from '$lib/stores';
  import { goto } from '$app/navigation';

  let invoices: Invoice[] = [];
  let groupedInvoices: Record<string, Invoice[]> = {};
  let expandedProviders: Record<string, boolean> = {};
  let searchQuery = '';
  let startDate = '';
  let endDate = '';
  let isSyncing = false;

  // Dashboard Metrics
  let totalSpend = 0;
  let totalItbis = 0;
  let topSupplier = { name: '-', amount: 0 };

  let selectedInvoice: Invoice | null = null;

  onMount(async () => {
    // Initial load
    await loadInvoices();
  });

  async function loadInvoices() {
    let collection = db.invoices.orderBy('issueDate').reverse();
    
    if (startDate && endDate) {
      collection = collection.filter(i => i.issueDate >= startDate && i.issueDate <= endDate);
    }

    invoices = await collection.toArray();
    
    // Filter by search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      invoices = invoices.filter(i => 
        i.providerName.toLowerCase().includes(q) || 
        i.ncf.toLowerCase().includes(q)
      );
    }

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

  async function deleteInvoice(id?: number) {
    if (!id) return;
    if (confirm('Delete this invoice?')) {
      await db.invoices.delete(id);
      await loadInvoices();
    }
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
      
      // Merge and update
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

  function exportToExcel() {
    const data = invoices.map(i => ({
      Provider: i.providerName,
      RNC: i.providerRnc,
      Date: i.issueDate,
      NCF: i.ncf,
      Total: i.total,
      ITBIS: i.itbisTotal,
      Status: i.status
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoices");
    XLSX.writeFile(wb, `invoices_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  }
  function exportInvoice(invoice: Invoice) {
    // 1. Header Info
    const header = [
      ['Provider', invoice.providerName],
      ['RNC', invoice.providerRnc],
      ['NCF', invoice.ncf],
      ['Date', invoice.issueDate],
      ['Total', invoice.total],
      ['ITBIS', invoice.itbisTotal],
      [],
      ['Description', 'Quantity', 'Unit Price', 'ITBIS', 'Total']
    ];

    // 2. Items
    const items = invoice.items.map(item => [
      item.description,
      item.quantity,
      item.unitPrice,
      item.itbis,
      item.amount
    ]);

    // 3. Create Sheet
    const ws = XLSX.utils.aoa_to_sheet([...header, ...items]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Invoice");
    
    // 4. Download
    XLSX.writeFile(wb, `invoice_${invoice.providerName}_${invoice.ncf}.xlsx`);
  }

  function viewInvoice(invoice: Invoice) {
    selectedInvoice = invoice;
  }

  function closeInvoice() {
    selectedInvoice = null;
  }
</script>

<div class="p-4 max-w-5xl mx-auto pb-24">
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
    <h1 class="text-2xl font-bold text-white">History</h1>
    
    <div class="flex flex-wrap gap-2 w-full md:w-auto">
      <div class="relative flex-1 md:w-64">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={16} />
        <input 
          bind:value={searchQuery} 
          on:input={loadInvoices}
          placeholder="Search provider, NCF..." 
          class="w-full bg-ios-card border border-ios-separator rounded-lg pl-10 pr-4 py-2 text-white text-sm"
        />
      </div>
      <input 
        type="date" 
        bind:value={startDate} 
        on:change={loadInvoices}
        class="bg-ios-card border border-ios-separator rounded-lg px-3 py-2 text-white text-sm"
      />
      <input 
        type="date" 
        bind:value={endDate} 
        on:change={loadInvoices}
        class="bg-ios-card border border-ios-separator rounded-lg px-3 py-2 text-white text-sm"
      />
      <button 
        on:click={exportToExcel}
        class="bg-ios-blue text-white px-4 py-2 rounded-lg flex items-center space-x-2 text-sm font-bold"
      >
        <Download size={16} />
        <span>Export All</span>
      </button>
    </div>
  </div>

  <!-- Dashboard Cards -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
    <!-- Total Spend -->
    <div class="bg-ios-card border border-ios-separator rounded-xl p-4">
      <div class="text-gray-400 text-xs uppercase font-bold mb-1">Total Spend</div>
      <div class="text-2xl font-bold text-white">DOP {totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    </div>

    <!-- Total ITBIS -->
    <div class="bg-ios-card border border-ios-separator rounded-xl p-4">
      <div class="text-gray-400 text-xs uppercase font-bold mb-1">Total ITBIS</div>
      <div class="text-2xl font-bold text-ios-blue">DOP {totalItbis.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    </div>

    <!-- Top Supplier -->
    <div class="bg-ios-card border border-ios-separator rounded-xl p-4">
      <div class="text-gray-400 text-xs uppercase font-bold mb-1">Top Supplier</div>
      <div class="text-lg font-bold text-white truncate">{topSupplier.name}</div>
      <div class="text-xs text-gray-500">DOP {topSupplier.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    </div>
  </div>

  <div class="space-y-4">
    {#each Object.entries(groupedInvoices) as [provider, items]}
      <div class="bg-ios-card rounded-xl border border-ios-separator overflow-hidden">
        <button 
          class="w-full p-4 flex justify-between items-center hover:bg-white/5 transition-colors"
          on:click={() => toggleProvider(provider)}
        >
          <div class="flex items-center space-x-3">
            {#if expandedProviders[provider]}
              <ChevronDown size={20} class="text-gray-400" />
            {:else}
              <ChevronRight size={20} class="text-gray-400" />
            {/if}
            <span class="font-bold text-white">{provider}</span>
            <span class="bg-white/10 text-gray-400 text-xs px-2 py-1 rounded-full">{items.length}</span>
          </div>
          <span class="text-ios-green font-mono font-bold">
            DOP {items.reduce((sum, i) => sum + (i.total || 0), 0).toFixed(2)}
          </span>
        </button>

        {#if expandedProviders[provider]}
          <div class="border-t border-ios-separator bg-black/20">
            {#each items as invoice}
              <div class="p-4 border-b border-ios-separator last:border-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div class="flex items-start space-x-4">
                  <div class="w-10 h-10 rounded bg-white/10 flex items-center justify-center flex-shrink-0">
                    <FileText size={20} class="text-ios-blue" />
                  </div>
                  <div>
                    <div class="text-white font-medium">{invoice.issueDate}</div>
                    <div class="text-gray-500 text-xs font-mono">{invoice.ncf}</div>
                  </div>
                </div>
                
                <div class="flex items-center space-x-6 w-full md:w-auto justify-between md:justify-end">
                  <div class="text-right">
                    <div class="text-white font-mono font-bold">DOP {invoice.total?.toFixed(2)}</div>
                    <div class="text-gray-500 text-xs">ITBIS: {invoice.itbisTotal?.toFixed(2)}</div>
                  </div>
                  
                  <div class="flex items-center space-x-2">
                    {#if invoice.status === 'needs_extraction'}
                      <button 
                        on:click={() => syncInvoice(invoice)}
                        class="p-2 text-yellow-500 hover:text-yellow-400 transition-colors flex items-center space-x-1 bg-yellow-500/10 rounded-lg"
                        title="Sync with AI"
                        disabled={isSyncing}
                      >
                        <RefreshCw size={18} class={isSyncing ? 'animate-spin' : ''} />
                        <span class="text-xs font-bold">Sync</span>
                      </button>
                    {/if}
                    
                    <button 
                      on:click={() => viewInvoice(invoice)}
                      class="p-2 text-gray-500 hover:text-ios-blue transition-colors"
                      title="View Details"
                    >
                      <Eye size={18} />
                    </button>

                    <button 
                      on:click={() => exportInvoice(invoice)}
                      class="p-2 text-gray-500 hover:text-ios-blue transition-colors"
                      title="Export Excel"
                    >
                      <Download size={18} />
                    </button>
                    <button 
                      on:click={() => deleteInvoice(invoice.id)}
                      class="p-2 text-gray-500 hover:text-ios-red transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
    
    {#if Object.keys(groupedInvoices).length === 0}
      <div class="text-center text-gray-500 py-10">
        No invoices found.
      </div>
    {/if}
  </div>
</div>

<!-- Invoice Detail Modal -->
{#if selectedInvoice}
  <div class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
    <div class="bg-ios-card border border-ios-separator rounded-2xl w-full max-w-3xl shadow-2xl my-auto relative flex flex-col max-h-[90vh]">
      <!-- Modal Header -->
      <div class="p-4 border-b border-ios-separator flex justify-between items-center bg-gray-500/10 sticky top-0 z-10 rounded-t-2xl">
        <div>
          <h2 class="text-xl font-bold text-ios-text">Invoice Details</h2>
          <p class="text-sm text-gray-400">{selectedInvoice.providerName} • {selectedInvoice.ncf}</p>
        </div>
        <button on:click={closeInvoice} class="text-gray-500 hover:text-ios-text bg-gray-500/20 p-2 rounded-full transition-colors">
          <X size={24} />
        </button>
      </div>

      <!-- Modal Content -->
      <div class="p-6 overflow-y-auto">
        <!-- Info Grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-gray-500/10 p-3 rounded-lg">
            <div class="text-xs text-gray-500 uppercase font-bold mb-1">Date</div>
            <div class="text-ios-text font-medium">{selectedInvoice.issueDate}</div>
          </div>
          <div class="bg-gray-500/10 p-3 rounded-lg">
            <div class="text-xs text-gray-500 uppercase font-bold mb-1">RNC</div>
            <div class="text-ios-text font-medium">{selectedInvoice.providerRnc}</div>
          </div>
          <div class="bg-gray-500/10 p-3 rounded-lg">
            <div class="text-xs text-gray-500 uppercase font-bold mb-1">NCF</div>
            <div class="text-ios-text font-medium truncate" title={selectedInvoice.ncf}>{selectedInvoice.ncf}</div>
          </div>
          <div class="bg-gray-500/10 p-3 rounded-lg">
            <div class="text-xs text-gray-500 uppercase font-bold mb-1">Category</div>
            <div class="text-ios-text font-medium">{selectedInvoice.category || 'Uncategorized'}</div>
          </div>
        </div>

        <!-- Items Table -->
        <div class="border border-ios-separator rounded-lg overflow-hidden mb-6">
          <table class="w-full text-left text-sm">
            <thead class="bg-gray-500/10 text-gray-400 text-xs uppercase">
              <tr>
                <th class="p-3 font-medium">Description</th>
                <th class="p-3 font-medium text-center">Qty</th>
                <th class="p-3 font-medium text-right">Price</th>
                <th class="p-3 font-medium text-right">ITBIS</th>
                <th class="p-3 font-medium text-right">Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-ios-separator">
              {#each selectedInvoice.items || [] as item}
                <tr class="hover:bg-gray-500/5 transition-colors">
                  <td class="p-3 text-ios-text">{item.description}</td>
                  <td class="p-3 text-ios-text text-center">{item.quantity}</td>
                  <td class="p-3 text-ios-text text-right font-mono">{item.unitPrice?.toFixed(2)}</td>
                  <td class="p-3 text-gray-400 text-right font-mono">{item.itbis?.toFixed(2)}</td>
                  <td class="p-3 text-ios-text text-right font-mono font-bold">{item.amount?.toFixed(2)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

        <!-- Totals -->
        <div class="flex justify-end">
          <div class="w-full md:w-1/3 space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-gray-400">Subtotal</span>
              <span class="text-ios-text font-mono">{selectedInvoice.subtotal?.toFixed(2)}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-gray-400">ITBIS</span>
              <span class="text-ios-text font-mono">{selectedInvoice.itbisTotal?.toFixed(2)}</span>
            </div>
            <div class="border-t border-ios-separator pt-2 flex justify-between items-center">
              <span class="text-ios-text font-bold text-lg">Total</span>
              <span class="text-ios-green font-bold text-xl font-mono">DOP {selectedInvoice.total?.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
