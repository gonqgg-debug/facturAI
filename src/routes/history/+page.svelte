<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '$lib/db';
  import { liveQuery } from 'dexie';
  import { ChevronDown, ChevronRight, FileText, Download, Trash2, Search, RefreshCw, Eye, X } from 'lucide-svelte';
  // ... (imports remain the same)

  let selectedInvoice: Invoice | null = null;

  // ... (existing functions)

  function viewInvoice(invoice: Invoice) {
    selectedInvoice = invoice;
  }

  function closeInvoice() {
    selectedInvoice = null;
  }
</script>

<div class="p-4 max-w-5xl mx-auto pb-24">
  <!-- ... (Header and Dashboard remain the same) ... -->

  <div class="space-y-4">
    {#each Object.entries(groupedInvoices) as [provider, items]}
      <div class="bg-ios-card rounded-xl border border-ios-separator overflow-hidden">
        <!-- ... (Provider Header remains the same) ... -->

        {#if expandedProviders[provider]}
          <div class="border-t border-ios-separator bg-gray-500/10">
            {#each items as invoice}
              <div class="p-4 border-b border-ios-separator last:border-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <!-- ... (Invoice Info remains the same) ... -->
                
                <div class="flex items-center space-x-6 w-full md:w-auto justify-between md:justify-end">
                  <!-- ... (Totals remain the same) ... -->
                  
                  <div class="flex items-center space-x-2">
                    <!-- Sync Button (remains the same) -->
                    
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
    
    <!-- ... (Empty State remains the same) ... -->
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
