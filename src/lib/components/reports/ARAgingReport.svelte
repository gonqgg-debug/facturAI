<script lang="ts">
  import type { ARAgingReport } from '$lib/types';
  import { Users, AlertTriangle, Clock, CheckCircle } from 'lucide-svelte';
  import { Badge } from '$lib/components/ui/badge';

  export let report: ARAgingReport;

  const format = (n: number) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function getHealthColor(customer: ARAgingReport['customers'][0]) {
    const total = customer.aging.total;
    if (total === 0) return 'emerald';
    if (customer.aging.over90 > 0) return 'rose';
    if (customer.aging.days61to90 > 0) return 'orange';
    if (customer.aging.days31to60 > 0) return 'amber';
    return 'emerald';
  }

  $: totalOverdue = report.totals.days31to60 + report.totals.days61to90 + report.totals.over90;
  $: overduePercent = report.totals.total > 0 ? ((totalOverdue / report.totals.total) * 100).toFixed(0) : '0';
</script>

<div class="space-y-6">
  <!-- Summary Cards -->
  <div class="grid grid-cols-2 md:grid-cols-5 gap-4">
    <div class="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
      <div class="text-sm text-emerald-700 font-medium mb-1 flex items-center gap-1.5">
        <CheckCircle size={14} />
        Corriente (0-30)
      </div>
      <div class="text-xl font-bold text-emerald-800">{format(report.totals.current)}</div>
    </div>
    <div class="bg-amber-50 rounded-xl p-4 border border-amber-100">
      <div class="text-sm text-amber-700 font-medium mb-1 flex items-center gap-1.5">
        <Clock size={14} />
        31-60 días
      </div>
      <div class="text-xl font-bold text-amber-800">{format(report.totals.days31to60)}</div>
    </div>
    <div class="bg-orange-50 rounded-xl p-4 border border-orange-100">
      <div class="text-sm text-orange-700 font-medium mb-1 flex items-center gap-1.5">
        <Clock size={14} />
        61-90 días
      </div>
      <div class="text-xl font-bold text-orange-800">{format(report.totals.days61to90)}</div>
    </div>
    <div class="bg-rose-50 rounded-xl p-4 border border-rose-100">
      <div class="text-sm text-rose-700 font-medium mb-1 flex items-center gap-1.5">
        <AlertTriangle size={14} />
        +90 días
      </div>
      <div class="text-xl font-bold text-rose-800">{format(report.totals.over90)}</div>
    </div>
    <div class="bg-slate-800 rounded-xl p-4 text-white">
      <div class="text-sm text-slate-300 font-medium mb-1">Total CxC</div>
      <div class="text-xl font-bold">{format(report.totals.total)}</div>
      {#if totalOverdue > 0}
        <div class="text-xs text-rose-300 mt-1">{overduePercent}% vencido</div>
      {/if}
    </div>
  </div>

  <!-- Alert if there's overdue -->
  {#if report.totals.over90 > 0}
    <div class="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200">
      <AlertTriangle size={20} class="text-rose-600 shrink-0" />
      <div>
        <div class="font-semibold text-rose-800">Cuentas en riesgo</div>
        <div class="text-sm text-rose-700">Tienes {format(report.totals.over90)} con más de 90 días de antigüedad. Considera priorizar estas cobranzas.</div>
      </div>
    </div>
  {/if}

  <!-- Customer Table -->
  <div class="border rounded-xl overflow-hidden">
    <div class="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
      <div class="flex items-center gap-2">
        <Users size={18} class="text-slate-500" />
        <span class="font-semibold">Clientes con Balance</span>
      </div>
      <Badge variant="outline">{report.customers.length} clientes</Badge>
    </div>
    
    {#if report.customers.length === 0}
      <div class="p-8 text-center text-muted-foreground">
        <CheckCircle size={48} class="mx-auto mb-3 text-emerald-400" />
        <div class="font-medium">¡Sin cuentas por cobrar!</div>
        <div class="text-sm">Todos los clientes están al día.</div>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="bg-slate-100">
              <th class="px-4 py-3 text-left font-semibold">Cliente</th>
              <th class="px-4 py-3 text-right font-semibold text-emerald-700">Corriente</th>
              <th class="px-4 py-3 text-right font-semibold text-amber-700">31-60</th>
              <th class="px-4 py-3 text-right font-semibold text-orange-700">61-90</th>
              <th class="px-4 py-3 text-right font-semibold text-rose-700">+90</th>
              <th class="px-4 py-3 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody class="divide-y">
            {#each report.customers as customer}
              {@const health = getHealthColor(customer)}
              <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2">
                    <div class="w-2 h-2 rounded-full bg-{health}-500"></div>
                    <span class="font-medium">{customer.name}</span>
                  </div>
                </td>
                <td class="px-4 py-3 text-right font-mono {customer.aging.current > 0 ? 'text-emerald-700' : 'text-slate-400'}">
                  {customer.aging.current > 0 ? format(customer.aging.current) : '-'}
                </td>
                <td class="px-4 py-3 text-right font-mono {customer.aging.days31to60 > 0 ? 'text-amber-700 font-semibold' : 'text-slate-400'}">
                  {customer.aging.days31to60 > 0 ? format(customer.aging.days31to60) : '-'}
                </td>
                <td class="px-4 py-3 text-right font-mono {customer.aging.days61to90 > 0 ? 'text-orange-700 font-semibold' : 'text-slate-400'}">
                  {customer.aging.days61to90 > 0 ? format(customer.aging.days61to90) : '-'}
                </td>
                <td class="px-4 py-3 text-right font-mono {customer.aging.over90 > 0 ? 'text-rose-700 font-bold' : 'text-slate-400'}">
                  {customer.aging.over90 > 0 ? format(customer.aging.over90) : '-'}
                </td>
                <td class="px-4 py-3 text-right font-mono font-semibold">
                  {format(customer.aging.total)}
                </td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr class="bg-slate-100 font-semibold">
              <td class="px-4 py-3">Totales</td>
              <td class="px-4 py-3 text-right font-mono text-emerald-700">{format(report.totals.current)}</td>
              <td class="px-4 py-3 text-right font-mono text-amber-700">{format(report.totals.days31to60)}</td>
              <td class="px-4 py-3 text-right font-mono text-orange-700">{format(report.totals.days61to90)}</td>
              <td class="px-4 py-3 text-right font-mono text-rose-700">{format(report.totals.over90)}</td>
              <td class="px-4 py-3 text-right font-mono text-lg">{format(report.totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    {/if}
  </div>
</div>
