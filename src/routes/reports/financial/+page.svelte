<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { getIncomeStatement, getBalanceSheet, getCashFlowStatement, getARAgingReport, getAPAgingReport } from '$lib/financial-reports';
  import IncomeStatementReport from '$lib/components/reports/IncomeStatementReport.svelte';
  import BalanceSheetReport from '$lib/components/reports/BalanceSheetReport.svelte';
  import ARAgingReport from '$lib/components/reports/ARAgingReport.svelte';
  import APAgingReport from '$lib/components/reports/APAgingReport.svelte';
  import EmptyState from '$lib/components/reports/EmptyState.svelte';
  import type { IncomeStatement, BalanceSheet, CashFlowStatement, ARAgingReport as ARAgingReportType, APAgingReport as APAgingReportType } from '$lib/types';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Badge } from '$lib/components/ui/badge';
  import { TrendingUp, Scale, Banknote, Users, Building2, Calendar, RefreshCw, FileText, ArrowUpRight, ArrowDownRight, Info } from 'lucide-svelte';

  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
  const endOfMonth = today.toISOString().split('T')[0];

  let startDate = startOfMonth;
  let endDate = endOfMonth;
  let loading = false;
  let activeTab = 'pl';

  let income: IncomeStatement | null = null;
  let balance: BalanceSheet | null = null;
  let cash: CashFlowStatement | null = null;
  let arAging: ARAgingReportType | null = null;
  let apAging: APAgingReportType | null = null;

  const tabs = [
    { 
      id: 'pl', 
      name: 'Estado de Resultados', 
      shortName: 'P&L',
      icon: TrendingUp,
      description: 'Ingresos, costos y utilidad del período',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50'
    },
    { 
      id: 'balance', 
      name: 'Balance General', 
      shortName: 'Balance',
      icon: Scale,
      description: 'Activos, pasivos y patrimonio',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    { 
      id: 'cash', 
      name: 'Flujo de Efectivo', 
      shortName: 'Efectivo',
      icon: Banknote,
      description: 'Movimiento de caja del período',
      color: 'text-violet-600',
      bgColor: 'bg-violet-50'
    },
    { 
      id: 'ar', 
      name: 'Cuentas por Cobrar', 
      shortName: 'CxC',
      icon: Users,
      description: 'Antigüedad de deudas de clientes',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50'
    },
    { 
      id: 'ap', 
      name: 'Cuentas por Pagar', 
      shortName: 'CxP',
      icon: Building2,
      description: 'Antigüedad de deudas a proveedores',
      color: 'text-rose-600',
      bgColor: 'bg-rose-50'
    }
  ];

  function setDatePreset(preset: string) {
    const now = new Date();
    switch (preset) {
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
        break;
      case 'lastMonth':
        startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
        endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
        break;
      case 'thisQuarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
        break;
      case 'thisYear':
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        endDate = now.toISOString().split('T')[0];
        break;
    }
    loadReports();
  }

  async function loadReports() {
    if (!browser) return;
    loading = true;
    try {
      [income, balance, cash, arAging, apAging] = await Promise.all([
        getIncomeStatement(startDate, endDate),
        getBalanceSheet(endDate),
        getCashFlowStatement(startDate, endDate),
        getARAgingReport(),
        getAPAgingReport()
      ]);
    } catch (e) {
      console.error('Failed to load financial reports', e);
      alert('No se pudieron cargar los reportes financieros.');
    } finally {
      loading = false;
    }
  }

  function formatCurrency(n: number) {
    return `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  onMount(loadReports);

  $: currentTab = tabs.find(t => t.id === activeTab);
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
  <div class="p-6 max-w-7xl mx-auto space-y-6">
    <!-- Header -->
    <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
      <div class="space-y-2">
        <div class="flex items-center gap-3">
          <div class="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-200">
            <FileText size={24} />
          </div>
          <div>
            <h1 class="text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
              Estados Financieros
            </h1>
            <p class="text-muted-foreground">
              Análisis completo del estado financiero de tu negocio
            </p>
          </div>
        </div>
      </div>

      <!-- Date Controls -->
      <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        <div class="flex flex-wrap gap-1.5">
          <Button 
            variant="outline" 
            size="sm" 
            on:click={() => setDatePreset('thisMonth')}
            class="text-xs"
          >
            Este mes
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            on:click={() => setDatePreset('lastMonth')}
            class="text-xs"
          >
            Mes anterior
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            on:click={() => setDatePreset('thisQuarter')}
            class="text-xs"
          >
            Este trimestre
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            on:click={() => setDatePreset('thisYear')}
            class="text-xs"
          >
            Este año
          </Button>
        </div>
        <div class="flex gap-2 items-end">
          <div class="space-y-1">
            <label class="text-xs uppercase text-muted-foreground font-medium">Desde</label>
            <Input type="date" bind:value={startDate} max={endDate} class="w-36" />
          </div>
          <div class="space-y-1">
            <label class="text-xs uppercase text-muted-foreground font-medium">Hasta</label>
            <Input type="date" bind:value={endDate} min={startDate} class="w-36" />
          </div>
          <Button on:click={loadReports} disabled={loading} class="gap-2">
            <RefreshCw size={16} class={loading ? 'animate-spin' : ''} />
            {loading ? 'Cargando...' : 'Actualizar'}
          </Button>
        </div>
      </div>
    </div>

    <!-- Quick Summary Cards -->
    {#if income && balance}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-white rounded-xl border p-4 shadow-sm">
          <div class="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <TrendingUp size={14} />
            Ventas Netas
          </div>
          <div class="text-2xl font-bold text-emerald-600">{formatCurrency(income.totalRevenue)}</div>
        </div>
        <div class="bg-white rounded-xl border p-4 shadow-sm">
          <div class="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <ArrowUpRight size={14} />
            Utilidad Neta
          </div>
          <div class="text-2xl font-bold" class:text-emerald-600={income.netIncome >= 0} class:text-rose-600={income.netIncome < 0}>
            {formatCurrency(income.netIncome)}
          </div>
        </div>
        <div class="bg-white rounded-xl border p-4 shadow-sm">
          <div class="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Scale size={14} />
            Total Activos
          </div>
          <div class="text-2xl font-bold text-blue-600">{formatCurrency(balance.assets.total)}</div>
        </div>
        <div class="bg-white rounded-xl border p-4 shadow-sm">
          <div class="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Banknote size={14} />
            Efectivo
          </div>
          <div class="text-2xl font-bold text-violet-600">{formatCurrency(cash?.endingCash || 0)}</div>
        </div>
      </div>
    {/if}

    <!-- Tab Navigation -->
    <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {#each tabs as tab}
        <button
          type="button"
          on:click={() => { activeTab = tab.id; }}
          class="relative p-4 rounded-xl border-2 transition-all duration-200 text-left cursor-pointer
            {activeTab === tab.id 
              ? `border-slate-300 ${tab.bgColor} shadow-md` 
              : 'border-transparent bg-white hover:border-slate-200 hover:shadow-sm'}"
        >
          <div class="flex items-start gap-3">
            <div class="p-2 rounded-lg {activeTab === tab.id ? tab.bgColor : 'bg-slate-100'} {tab.color}">
              <svelte:component this={tab.icon} size={18} />
            </div>
            <div class="min-w-0 flex-1">
              <div class="font-semibold text-sm truncate {activeTab === tab.id ? tab.color : 'text-slate-900'}">
                {tab.shortName}
              </div>
              <div class="text-xs text-muted-foreground mt-0.5">
                {tab.description}
              </div>
            </div>
          </div>
        </button>
      {/each}
    </div>

    <!-- Report Content -->
    <div class="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <!-- Report Header -->
      {#if currentTab}
        <div class="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg {currentTab.bgColor} {currentTab.color}">
              <svelte:component this={currentTab.icon} size={20} />
            </div>
            <div>
              <h2 class="font-semibold text-lg">{currentTab.name}</h2>
              <p class="text-sm text-muted-foreground">{currentTab.description}</p>
            </div>
          </div>
          <Badge variant="outline" class="text-xs">
            <Calendar size={12} class="mr-1" />
            {startDate} — {endDate}
          </Badge>
        </div>
      {/if}

      <!-- Report Body -->
      <div class="p-6">
        {#if loading}
          <div class="flex items-center justify-center py-12">
            <RefreshCw size={32} class="animate-spin text-muted-foreground" />
          </div>
        {:else if activeTab === 'pl'}
          {#if income}
            <IncomeStatementReport statement={income} />
          {:else}
            <EmptyState 
              title="Sin datos de ingresos"
              description="No hay transacciones registradas en este período. Realiza ventas para ver tu estado de resultados."
            />
          {/if}
        {:else if activeTab === 'balance'}
          {#if balance}
            <BalanceSheetReport balance={balance} />
          {:else}
            <EmptyState 
              title="Sin datos de balance"
              description="No hay información suficiente para generar el balance general."
            />
          {/if}
        {:else if activeTab === 'cash'}
          {#if cash}
            <div class="max-w-xl mx-auto">
              <div class="space-y-4">
                <div class="flex items-center gap-2 p-3 rounded-lg bg-blue-50 text-blue-700 text-sm">
                  <Info size={16} />
                  <span>Este es un resumen simplificado del flujo de efectivo.</span>
                </div>
                
                <div class="border rounded-xl divide-y">
                  <div class="p-4 flex justify-between items-center">
                    <div>
                      <div class="font-medium">Saldo Inicial</div>
                      <div class="text-sm text-muted-foreground">Efectivo al inicio del período</div>
                    </div>
                    <span class="text-xl font-mono font-semibold">{formatCurrency(cash.beginningCash)}</span>
                  </div>
                  
                  <div class="p-4 flex justify-between items-center bg-slate-50">
                    <div>
                      <div class="font-medium flex items-center gap-2">
                        Variación Neta
                        {#if cash.netChange >= 0}
                          <ArrowUpRight size={16} class="text-emerald-600" />
                        {:else}
                          <ArrowDownRight size={16} class="text-rose-600" />
                        {/if}
                      </div>
                      <div class="text-sm text-muted-foreground">Entradas menos salidas</div>
                    </div>
                    <span class="text-xl font-mono font-semibold" class:text-emerald-600={cash.netChange >= 0} class:text-rose-600={cash.netChange < 0}>
                      {cash.netChange >= 0 ? '+' : ''}{formatCurrency(cash.netChange)}
                    </span>
                  </div>
                  
                  <div class="p-4 flex justify-between items-center bg-gradient-to-r from-violet-50 to-purple-50">
                    <div>
                      <div class="font-semibold text-violet-900">Saldo Final</div>
                      <div class="text-sm text-violet-600">Efectivo disponible actual</div>
                    </div>
                    <span class="text-2xl font-mono font-bold text-violet-700">{formatCurrency(cash.endingCash)}</span>
                  </div>
                </div>
              </div>
            </div>
          {:else}
            <EmptyState 
              title="Sin flujo de efectivo"
              description="No hay movimientos de efectivo registrados en este período."
            />
          {/if}
        {:else if activeTab === 'ar'}
          {#if arAging && arAging.customers.length > 0}
            <ARAgingReport report={arAging} />
          {:else}
            <EmptyState 
              title="Sin cuentas por cobrar"
              description="No tienes deudas pendientes de clientes. ¡Excelente gestión de cobranza!"
              positive={true}
            />
          {/if}
        {:else if activeTab === 'ap'}
          {#if apAging && apAging.suppliers.length > 0}
            <APAgingReport report={apAging} />
          {:else}
            <EmptyState 
              title="Sin cuentas por pagar"
              description="No tienes facturas pendientes de pago a proveedores."
              positive={true}
            />
          {/if}
        {/if}
      </div>
    </div>

    <!-- Help Section -->
    <div class="bg-gradient-to-r from-slate-100 to-slate-50 rounded-xl p-6 border">
      <h3 class="font-semibold mb-3 flex items-center gap-2">
        <Info size={18} class="text-slate-500" />
        ¿Qué significan estos reportes?
      </h3>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm text-muted-foreground">
        <div>
          <div class="font-medium text-slate-700 mb-1">Estado de Resultados (P&L)</div>
          <p>Muestra cuánto vendiste, cuánto costó y cuánto ganaste en un período. Es tu "¿cómo me fue este mes?"</p>
        </div>
        <div>
          <div class="font-medium text-slate-700 mb-1">Balance General</div>
          <p>Foto de lo que tienes (activos), lo que debes (pasivos) y lo que es tuyo (patrimonio) en un momento dado.</p>
        </div>
        <div>
          <div class="font-medium text-slate-700 mb-1">Flujo de Efectivo</div>
          <p>Rastrea el dinero que entra y sale de tu caja. Puedes tener ganancias pero quedarte sin efectivo.</p>
        </div>
        <div>
          <div class="font-medium text-slate-700 mb-1">Cuentas por Cobrar (CxC)</div>
          <p>Dinero que tus clientes te deben. La antigüedad ayuda a priorizar cobranzas.</p>
        </div>
        <div>
          <div class="font-medium text-slate-700 mb-1">Cuentas por Pagar (CxP)</div>
          <p>Dinero que debes a proveedores. Ayuda a planificar pagos y mantener buen crédito.</p>
        </div>
      </div>
    </div>
  </div>
</div>
