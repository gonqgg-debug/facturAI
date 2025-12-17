<script lang="ts">
  import type { IncomeStatement } from '$lib/types';
  import { ACCOUNT_NAMES } from '$lib/types';
  import { TrendingUp, TrendingDown, Minus } from 'lucide-svelte';

  export let statement: IncomeStatement;

  const format = (n: number) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  
  $: grossMargin = statement.totalRevenue > 0 
    ? ((statement.grossProfit / statement.totalRevenue) * 100).toFixed(1) 
    : '0.0';
  
  $: netMargin = statement.totalRevenue > 0 
    ? ((statement.netIncome / statement.totalRevenue) * 100).toFixed(1) 
    : '0.0';
</script>

<div class="space-y-6">
  <!-- Summary Cards -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <div class="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
      <div class="text-sm text-emerald-700 font-medium mb-1">Ingresos Totales</div>
      <div class="text-2xl font-bold text-emerald-800">{format(statement.totalRevenue)}</div>
    </div>
    <div class="bg-amber-50 rounded-xl p-4 border border-amber-100">
      <div class="text-sm text-amber-700 font-medium mb-1">Costo de Ventas</div>
      <div class="text-2xl font-bold text-amber-800">{format(statement.costOfGoodsSold)}</div>
    </div>
    <div class="bg-blue-50 rounded-xl p-4 border border-blue-100">
      <div class="text-sm text-blue-700 font-medium mb-1">Utilidad Bruta</div>
      <div class="text-2xl font-bold text-blue-800">{format(statement.grossProfit)}</div>
      <div class="text-xs text-blue-600 mt-1">Margen: {grossMargin}%</div>
    </div>
    <div class="rounded-xl p-4 border {statement.netIncome >= 0 ? 'bg-green-50 border-green-100' : 'bg-rose-50 border-rose-100'}">
      <div class="text-sm font-medium mb-1 {statement.netIncome >= 0 ? 'text-green-700' : 'text-rose-700'}">Utilidad Neta</div>
      <div class="text-2xl font-bold {statement.netIncome >= 0 ? 'text-green-800' : 'text-rose-800'}">{format(statement.netIncome)}</div>
      <div class="text-xs mt-1 {statement.netIncome >= 0 ? 'text-green-600' : 'text-rose-600'}">Margen: {netMargin}%</div>
    </div>
  </div>

  <!-- Detailed Breakdown -->
  <div class="border rounded-xl overflow-hidden">
    <!-- Revenue Section -->
    <div class="p-5 bg-gradient-to-r from-emerald-50 to-green-50 border-b">
      <div class="flex items-center gap-2 mb-4">
        <div class="p-1.5 rounded-lg bg-emerald-100">
          <TrendingUp size={16} class="text-emerald-700" />
        </div>
        <h3 class="font-semibold text-emerald-900">Ingresos</h3>
      </div>
      <div class="space-y-2">
        {#each statement.revenue as line}
          <div class="flex justify-between items-center text-sm py-1.5 px-3 rounded-lg hover:bg-emerald-100/50 transition-colors">
            <span class="text-emerald-800">{ACCOUNT_NAMES[line.account] || line.account}</span>
            <span class="font-mono font-medium text-emerald-900">{format(line.amount)}</span>
          </div>
        {/each}
        {#if statement.revenue.length === 0}
          <div class="text-sm text-emerald-600 italic py-2 px-3">Sin ingresos en este período</div>
        {/if}
        <div class="flex justify-between items-center text-sm font-semibold pt-3 mt-2 border-t border-emerald-200">
          <span class="text-emerald-900">Total Ingresos</span>
          <span class="font-mono text-lg text-emerald-900">{format(statement.totalRevenue)}</span>
        </div>
      </div>
    </div>

    <!-- COGS & Gross Profit -->
    <div class="p-5 bg-white border-b">
      <div class="space-y-3">
        <div class="flex justify-between items-center py-2 px-3 rounded-lg bg-amber-50">
          <div class="flex items-center gap-2">
            <Minus size={16} class="text-amber-600" />
            <span class="text-amber-800 font-medium">Costo de Mercancía Vendida</span>
          </div>
          <span class="font-mono font-semibold text-amber-900">{format(statement.costOfGoodsSold)}</span>
        </div>
        <div class="flex justify-between items-center py-3 px-4 rounded-lg bg-blue-100 border border-blue-200">
          <span class="text-blue-900 font-semibold">= Utilidad Bruta</span>
          <div class="text-right">
            <span class="font-mono font-bold text-lg text-blue-900">{format(statement.grossProfit)}</span>
            <div class="text-xs text-blue-700">({grossMargin}% margen)</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Operating Expenses -->
    <div class="p-5 bg-gradient-to-r from-slate-50 to-gray-50 border-b">
      <div class="flex items-center gap-2 mb-4">
        <div class="p-1.5 rounded-lg bg-slate-200">
          <TrendingDown size={16} class="text-slate-700" />
        </div>
        <h3 class="font-semibold text-slate-900">Gastos Operativos</h3>
      </div>
      <div class="space-y-2">
        {#each statement.operatingExpenses as line}
          <div class="flex justify-between items-center text-sm py-1.5 px-3 rounded-lg hover:bg-slate-100 transition-colors">
            <span class="text-slate-700">{ACCOUNT_NAMES[line.account] || line.account}</span>
            <span class="font-mono font-medium text-slate-800">{format(line.amount)}</span>
          </div>
        {/each}
        {#if statement.operatingExpenses.length === 0}
          <div class="text-sm text-slate-500 italic py-2 px-3">Sin gastos registrados</div>
        {/if}
        <div class="flex justify-between items-center text-sm font-semibold pt-3 mt-2 border-t border-slate-200">
          <span class="text-slate-900">Total Gastos</span>
          <span class="font-mono text-lg text-slate-900">{format(statement.totalExpenses)}</span>
        </div>
      </div>
    </div>

    <!-- Net Income -->
    <div class="p-5 {statement.netIncome >= 0 ? 'bg-gradient-to-r from-green-100 to-emerald-100' : 'bg-gradient-to-r from-rose-100 to-red-100'}">
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-xl {statement.netIncome >= 0 ? 'bg-green-200' : 'bg-rose-200'}">
            {#if statement.netIncome >= 0}
              <TrendingUp size={24} class="text-green-700" />
            {:else}
              <TrendingDown size={24} class="text-rose-700" />
            {/if}
          </div>
          <div>
            <div class="text-sm {statement.netIncome >= 0 ? 'text-green-700' : 'text-rose-700'}">Resultado del Período</div>
            <div class="font-bold text-lg {statement.netIncome >= 0 ? 'text-green-900' : 'text-rose-900'}">
              {statement.netIncome >= 0 ? 'UTILIDAD NETA' : 'PÉRDIDA NETA'}
            </div>
          </div>
        </div>
        <div class="text-right">
          <div class="font-mono font-bold text-3xl {statement.netIncome >= 0 ? 'text-green-900' : 'text-rose-900'}">
            {format(Math.abs(statement.netIncome))}
          </div>
          <div class="text-sm {statement.netIncome >= 0 ? 'text-green-700' : 'text-rose-700'}">
            Margen neto: {netMargin}%
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
