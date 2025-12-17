<script lang="ts">
  import type { BalanceSheet } from '$lib/types';
  import { ACCOUNT_NAMES } from '$lib/types';
  import { Wallet, CreditCard, Building, CheckCircle2 } from 'lucide-svelte';

  export let balance: BalanceSheet;

  const format = (n: number) => `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  $: isBalanced = Math.abs(balance.assets.total - (balance.liabilities.total + balance.equity.total)) < 0.01;
</script>

<div class="space-y-6">
  <!-- Balance Indicator -->
  <div class="flex items-center justify-center gap-2 py-3 px-4 rounded-xl {isBalanced ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}">
    {#if isBalanced}
      <CheckCircle2 size={20} class="text-emerald-600" />
      <span class="text-emerald-800 font-medium">Balance cuadrado correctamente</span>
    {:else}
      <span class="text-amber-800 font-medium">⚠️ El balance tiene una diferencia de {format(balance.assets.total - balance.liabilities.total - balance.equity.total)}</span>
    {/if}
  </div>

  <!-- Summary Cards -->
  <div class="grid grid-cols-3 gap-4">
    <div class="bg-blue-50 rounded-xl p-4 border border-blue-100 text-center">
      <div class="text-sm text-blue-700 font-medium mb-1">Total Activos</div>
      <div class="text-2xl font-bold text-blue-800">{format(balance.assets.total)}</div>
    </div>
    <div class="bg-rose-50 rounded-xl p-4 border border-rose-100 text-center">
      <div class="text-sm text-rose-700 font-medium mb-1">Total Pasivos</div>
      <div class="text-2xl font-bold text-rose-800">{format(balance.liabilities.total)}</div>
    </div>
    <div class="bg-emerald-50 rounded-xl p-4 border border-emerald-100 text-center">
      <div class="text-sm text-emerald-700 font-medium mb-1">Patrimonio</div>
      <div class="text-2xl font-bold text-emerald-800">{format(balance.equity.total)}</div>
    </div>
  </div>

  <!-- Equation Display -->
  <div class="flex items-center justify-center gap-4 py-4 px-6 rounded-xl bg-slate-100 text-slate-700 font-mono text-sm">
    <span class="font-bold text-blue-700">Activos</span>
    <span>=</span>
    <span class="font-bold text-rose-700">Pasivos</span>
    <span>+</span>
    <span class="font-bold text-emerald-700">Patrimonio</span>
  </div>

  <!-- Detailed View -->
  <div class="grid md:grid-cols-2 gap-6">
    <!-- Assets -->
    <div class="border rounded-xl overflow-hidden">
      <div class="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <div class="flex items-center gap-2">
          <Wallet size={20} />
          <h3 class="font-semibold">Activos</h3>
        </div>
        <p class="text-blue-100 text-sm mt-1">Lo que la empresa posee</p>
      </div>
      <div class="p-4 space-y-2 bg-blue-50/30">
        {#each balance.assets.current as line}
          <div class="flex justify-between items-center text-sm py-2 px-3 rounded-lg hover:bg-blue-100/50 transition-colors">
            <span class="text-slate-700">{ACCOUNT_NAMES[line.account] || line.account}</span>
            <span class="font-mono font-medium text-slate-900">{format(line.balance)}</span>
          </div>
        {/each}
        {#if balance.assets.current.length === 0}
          <div class="text-sm text-slate-500 italic py-3 px-3">Sin activos registrados</div>
        {/if}
      </div>
      <div class="p-4 bg-blue-100 border-t border-blue-200">
        <div class="flex justify-between items-center font-semibold">
          <span class="text-blue-900">Total Activos</span>
          <span class="font-mono text-xl text-blue-900">{format(balance.assets.total)}</span>
        </div>
      </div>
    </div>

    <!-- Liabilities & Equity -->
    <div class="space-y-4">
      <!-- Liabilities -->
      <div class="border rounded-xl overflow-hidden">
        <div class="p-4 bg-gradient-to-r from-rose-500 to-rose-600 text-white">
          <div class="flex items-center gap-2">
            <CreditCard size={20} />
            <h3 class="font-semibold">Pasivos</h3>
          </div>
          <p class="text-rose-100 text-sm mt-1">Lo que la empresa debe</p>
        </div>
        <div class="p-4 space-y-2 bg-rose-50/30">
          {#each balance.liabilities.current as line}
            <div class="flex justify-between items-center text-sm py-2 px-3 rounded-lg hover:bg-rose-100/50 transition-colors">
              <span class="text-slate-700">{ACCOUNT_NAMES[line.account] || line.account}</span>
              <span class="font-mono font-medium text-slate-900">{format(line.balance)}</span>
            </div>
          {/each}
          {#if balance.liabilities.current.length === 0}
            <div class="text-sm text-slate-500 italic py-3 px-3">Sin pasivos registrados</div>
          {/if}
        </div>
        <div class="p-3 bg-rose-100 border-t border-rose-200">
          <div class="flex justify-between items-center font-semibold text-sm">
            <span class="text-rose-900">Total Pasivos</span>
            <span class="font-mono text-rose-900">{format(balance.liabilities.total)}</span>
          </div>
        </div>
      </div>

      <!-- Equity -->
      <div class="border rounded-xl overflow-hidden">
        <div class="p-4 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
          <div class="flex items-center gap-2">
            <Building size={20} />
            <h3 class="font-semibold">Patrimonio</h3>
          </div>
          <p class="text-emerald-100 text-sm mt-1">Valor neto de los dueños</p>
        </div>
        <div class="p-4 space-y-2 bg-emerald-50/30">
          <div class="flex justify-between items-center text-sm py-2 px-3 rounded-lg hover:bg-emerald-100/50 transition-colors">
            <span class="text-slate-700">Utilidades Retenidas</span>
            <span class="font-mono font-medium text-slate-900">{format(balance.equity.retained)}</span>
          </div>
        </div>
        <div class="p-3 bg-emerald-100 border-t border-emerald-200">
          <div class="flex justify-between items-center font-semibold text-sm">
            <span class="text-emerald-900">Total Patrimonio</span>
            <span class="font-mono text-emerald-900">{format(balance.equity.total)}</span>
          </div>
        </div>
      </div>

      <!-- Liabilities + Equity Total -->
      <div class="p-4 rounded-xl bg-gradient-to-r from-slate-700 to-slate-800 text-white">
        <div class="flex justify-between items-center">
          <span class="font-medium">Pasivos + Patrimonio</span>
          <span class="font-mono font-bold text-xl">{format(balance.liabilities.total + balance.equity.total)}</span>
        </div>
      </div>
    </div>
  </div>
</div>
