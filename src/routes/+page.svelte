<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '$lib/db';
  import { goto } from '$app/navigation';
  import TrendingDownIcon from "@tabler/icons-svelte/icons/trending-down";
  import TrendingUpIcon from "@tabler/icons-svelte/icons/trending-up";
  import { 
    Camera, FileText, 
    TrendingUp, TrendingDown, DollarSign, 
    CreditCard, Users, Activity,
    ShoppingBag, BarChart3, Package, ShoppingCart,
    Receipt, ArrowUpRight, ArrowDownRight, AlertTriangle,
    Wallet, CircleDollarSign, RotateCcw
  } from 'lucide-svelte';
  import type { Invoice, Sale, Customer, Product, Return } from '$lib/types';
  import * as Card from '$lib/components/ui/card';
  import { Badge } from '$lib/components/ui/badge/index.js';
  import { locale } from '$lib/stores';
  import { t } from '$lib/i18n';
  import { LineChart } from 'layerchart';
  import { scaleTime } from 'd3-scale';
  import { curveNatural } from 'd3-shape';

  // ============ EXPENSES METRICS ============
  let monthlyExpenses = 0;
  let monthlyExpensesDiff = 0;
  let itbisPaid = 0;
  let topSupplier = { name: '-', amount: 0 };
  
  // ============ SALES METRICS ============
  let monthlySales = 0;
  let monthlySalesDiff = 0;
  let itbisCollected = 0;
  let grossProfit = 0;
  let profitMargin = 0;
  
  // Today's quick stats
  let todaySales = 0;
  let todaySalesCount = 0;
  let pendingCredit = 0;
  let lowStockCount = 0;
  
  // Key Metrics (combined)
  let avgTicket = 0;
  let totalSalesCount = 0;
  let activeCustomersCount = 0;
  let monthlyReturns = 0;
  
  // Purchase metrics
  let avgInvoiceValue = 0;
  let totalInvoicesCount = 0;
  let activeSuppliersCount = 0;
  
  // Chart Data
  let chartData: { date: Date; month: string; costs: number; sales: number }[] = [];
  let maxChartValue = 0;

  onMount(async () => {
    await loadDashboardData();
  });

  async function loadDashboardData() {
    const invoices = await db.invoices.toArray();
    const sales = await db.sales.toArray();
    const customers = await db.customers.toArray();
    const products = await db.products.toArray();
    const returns = await db.returns.toArray();
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // ============ EXPENSES CALCULATIONS ============
    const currentMonthInvoices = invoices.filter(i => {
      const d = new Date(i.issueDate);
      return d >= startOfMonth;
    });

    const prevMonthInvoices = invoices.filter(i => {
      const d = new Date(i.issueDate);
      return d >= startOfPrevMonth && d <= endOfPrevMonth;
    });

    monthlyExpenses = currentMonthInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
    const prevMonthlyExpenses = prevMonthInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
    
    if (prevMonthlyExpenses > 0) {
      monthlyExpensesDiff = ((monthlyExpenses - prevMonthlyExpenses) / prevMonthlyExpenses) * 100;
    } else {
      monthlyExpensesDiff = monthlyExpenses > 0 ? 100 : 0;
    }

    itbisPaid = currentMonthInvoices.reduce((sum, i) => sum + (i.itbisTotal || 0), 0);

    // Top Supplier
    const targetInvoices = currentMonthInvoices.length > 0 ? currentMonthInvoices : invoices;
    const supplierMap: Record<string, number> = {};
    targetInvoices.forEach(i => {
      const name = i.providerName || 'Unknown';
      supplierMap[name] = (supplierMap[name] || 0) + (i.total || 0);
    });
    
    let maxVal = 0;
    let maxName = '-';
    Object.entries(supplierMap).forEach(([name, val]) => {
      if (val > maxVal) {
        maxVal = val;
        maxName = name;
      }
    });
    topSupplier = { name: maxName, amount: maxVal };

    // Purchase metrics
    totalInvoicesCount = invoices.length;
    const totalSpend = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
    avgInvoiceValue = totalInvoicesCount > 0 ? totalSpend / totalInvoicesCount : 0;
    
    const uniqueSuppliers = new Set(invoices.map(i => i.providerName));
    activeSuppliersCount = uniqueSuppliers.size;

    // ============ SALES CALCULATIONS ============
    const currentMonthSales = sales.filter(s => {
      const d = new Date(s.date);
      return d >= startOfMonth;
    });

    const prevMonthSales = sales.filter(s => {
      const d = new Date(s.date);
      return d >= startOfPrevMonth && d <= endOfPrevMonth;
    });

    monthlySales = currentMonthSales.reduce((sum, s) => sum + (s.total || 0), 0);
    const prevMonthlySales = prevMonthSales.reduce((sum, s) => sum + (s.total || 0), 0);
    
    if (prevMonthlySales > 0) {
      monthlySalesDiff = ((monthlySales - prevMonthlySales) / prevMonthlySales) * 100;
    } else {
      monthlySalesDiff = monthlySales > 0 ? 100 : 0;
    }

    itbisCollected = currentMonthSales.reduce((sum, s) => sum + (s.itbisTotal || 0), 0);
    
    // Gross Profit (Sales - Costs)
    grossProfit = monthlySales - monthlyExpenses;
    profitMargin = monthlySales > 0 ? (grossProfit / monthlySales) * 100 : 0;

    // Monthly returns
    const currentMonthReturns = returns.filter(r => {
      const d = new Date(r.date);
      return d >= startOfMonth;
    });
    monthlyReturns = currentMonthReturns.reduce((sum, r) => sum + (r.total || 0), 0);

    // Today's stats
    const todaySalesArray = sales.filter(s => s.date === today);
    todaySales = todaySalesArray.reduce((sum, s) => sum + (s.total || 0), 0);
    todaySalesCount = todaySalesArray.length;

    // Pending credit
    const creditSales = sales.filter(s => s.paymentStatus === 'pending' || s.paymentStatus === 'partial');
    pendingCredit = creditSales.reduce((sum, s) => sum + (s.total - s.paidAmount), 0);

    // Low stock products
    lowStockCount = products.filter(p => {
      const stock = p.currentStock ?? 0;
      const reorder = p.reorderPoint ?? 5;
      return stock <= reorder && stock > 0;
    }).length;

    // Sales metrics
    totalSalesCount = sales.length;
    avgTicket = totalSalesCount > 0 ? sales.reduce((sum, s) => sum + s.total, 0) / totalSalesCount : 0;
    
    // Active customers (with sales in last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentCustomerIds = new Set(
      sales
        .filter(s => new Date(s.date) >= thirtyDaysAgo && s.customerId)
        .map(s => s.customerId)
    );
    activeCustomersCount = recentCustomerIds.size;

    // ============ CHART DATA (Last 6 Months) ============
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = d.toLocaleString('default', { month: 'short' });
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push({ date: d, name: monthName, key });
    }

    chartData = months.map(m => {
      const monthInvoices = invoices.filter(i => i.issueDate.startsWith(m.key));
      const costs = monthInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
      
      const monthSales = sales.filter(s => s.date.startsWith(m.key));
      const salesTotal = monthSales.reduce((sum, s) => sum + (s.total || 0), 0);
      
      return { date: m.date, month: m.name, costs, sales: salesTotal };
    });

    maxChartValue = Math.max(
      ...chartData.map(d => Math.max(d.costs, d.sales)),
      1000
    );
  }

  // Quick Actions
  function goCapture() { goto('/capture'); }
  function goInvoices() { goto('/invoices'); }
  function goCatalog() { goto('/catalog'); }
  function goPos() { goto('/sales'); }
  function goOrders() { goto('/sales/orders'); }
  function goReports() { goto('/reports'); }

  // SVG Chart Helpers
  function getX(index: number, width: number) {
    return (index / (chartData.length - 1)) * width;
  }
  function getY(value: number, height: number) {
    return height - (value / maxChartValue) * height;
  }
  function getAreaPath(data: number[], width: number, height: number) {
    if (data.length === 0) return '';
    let d = `M0,${height} `;
    data.forEach((val, i) => {
      d += `L${getX(i, width)},${getY(val, height)} `;
    });
    d += `L${width},${height} Z`;
    return d;
  }
  function getLinePath(data: number[], width: number, height: number) {
    if (data.length === 0) return '';
    let d = `M0,${getY(data[0], height)} `;
    data.forEach((val, i) => {
      d += `L${getX(i, width)},${getY(val, height)} `;
    });
    return d;
  }

  function formatCurrency(value: number): string {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
</script>

<div class="flex-1 space-y-6 pb-24 pt-8 md:pt-12">
  
  <!-- Top Cards: Sales vs Expenses -->
  <div class="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:shadow-xs grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t lg:px-6">
    
    <!-- Monthly Sales -->
    <Card.Root class="@container/card" data-slot="card">
      <Card.Header>
        <Card.Description>{t('home.monthlySales', $locale)}</Card.Description>
        <Card.Title class="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
          DOP {formatCurrency(monthlySales)}
        </Card.Title>
        {#if monthlySalesDiff !== 0}
          <Card.Action>
            <Badge variant="outline" class={monthlySalesDiff > 0 ? "text-green-500 border-green-500/50" : "text-red-500 border-red-500/50"}>
            {#if monthlySalesDiff > 0}
                <TrendingUpIcon class="w-3 h-3 text-green-500" />
            {:else}
                <TrendingDownIcon class="w-3 h-3 text-red-500" />
            {/if}
              <span class={monthlySalesDiff > 0 ? "text-green-500" : "text-red-500"}>
                {monthlySalesDiff > 0 ? '+' : ''}{monthlySalesDiff.toFixed(1)}%
              </span>
            </Badge>
          </Card.Action>
        {/if}
      </Card.Header>
      <Card.Footer class="flex-col items-start gap-1.5 text-sm">
        <div class="line-clamp-1 flex gap-2 font-medium">
          {#if monthlySalesDiff > 0}
            {$locale === 'es' ? 'Aumentando este mes' : 'Trending up this month'}
          {:else if monthlySalesDiff < 0}
            {$locale === 'es' ? 'Bajando este mes' : 'Trending down this month'}
          {:else}
            {$locale === 'es' ? 'Sin cambios' : 'No change'}
          {/if}
        </div>
        <div class="text-muted-foreground">{t('home.vsPreviousMonth', $locale)}</div>
      </Card.Footer>
    </Card.Root>

    <!-- Monthly Expenses -->
    <Card.Root class="@container/card" data-slot="card">
      <Card.Header>
        <Card.Description>{t('home.monthlyExpenses', $locale)}</Card.Description>
        <Card.Title class="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
          DOP {formatCurrency(monthlyExpenses)}
        </Card.Title>
        {#if monthlyExpensesDiff !== 0}
          <Card.Action>
            <Badge variant="outline" class={monthlyExpensesDiff > 0 ? "text-red-500 border-red-500/50" : "text-red-500 border-red-500/50"}>
              {#if monthlyExpensesDiff > 0}
                <TrendingUpIcon class="w-3 h-3 text-red-500" />
              {:else}
                <TrendingDownIcon class="w-3 h-3 text-red-500" />
              {/if}
              <span class="text-red-500">
                {monthlyExpensesDiff > 0 ? '+' : ''}{monthlyExpensesDiff.toFixed(1)}%
              </span>
            </Badge>
          </Card.Action>
        {/if}
      </Card.Header>
      <Card.Footer class="flex-col items-start gap-1.5 text-sm">
        <div class="line-clamp-1 flex gap-2 font-medium">
          {#if monthlyExpensesDiff > 0}
            {$locale === 'es' ? 'Aumentando este período' : 'Up this period'}
          {:else if monthlyExpensesDiff < 0}
            {$locale === 'es' ? 'Bajando este período' : 'Down this period'}
          {:else}
            {$locale === 'es' ? 'Sin cambios' : 'No change'}
          {/if}
        </div>
        <div class="text-muted-foreground">{t('home.vsPreviousMonth', $locale)}</div>
      </Card.Footer>
    </Card.Root>

    <!-- Gross Profit -->
    <Card.Root class="@container/card" data-slot="card">
      <Card.Header>
        <Card.Description>{t('home.grossProfit', $locale)}</Card.Description>
        <Card.Title class="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
          DOP {formatCurrency(Math.abs(grossProfit))}
          {#if grossProfit < 0}<span class="text-sm">({$locale === 'es' ? 'pérdida' : 'loss'})</span>{/if}
        </Card.Title>
        {#if profitMargin !== 0}
          <Card.Action>
            <Badge variant="outline" class={grossProfit >= 0 ? "text-green-500 border-green-500/50" : "text-red-500 border-red-500/50"}>
              {#if grossProfit >= 0}
                <TrendingUpIcon class="w-3 h-3 text-green-500" />
              {:else}
                <TrendingDownIcon class="w-3 h-3 text-red-500" />
              {/if}
              <span class={grossProfit >= 0 ? "text-green-500" : "text-red-500"}>
            {profitMargin.toFixed(1)}%
              </span>
            </Badge>
          </Card.Action>
        {/if}
      </Card.Header>
      <Card.Footer class="flex-col items-start gap-1.5 text-sm">
        <div class="line-clamp-1 flex gap-2 font-medium">
          {#if grossProfit >= 0}
            {$locale === 'es' ? 'Rentabilidad positiva' : 'Positive profitability'}
          {:else}
            {$locale === 'es' ? 'Pérdida detectada' : 'Loss detected'}
          {/if}
        </div>
        <div class="text-muted-foreground">{t('home.profitMargin', $locale)}: {profitMargin.toFixed(1)}%</div>
      </Card.Footer>
    </Card.Root>

    <!-- ITBIS Balance -->
    <Card.Root class="@container/card" data-slot="card">
      <Card.Header>
        <Card.Description>ITBIS Balance</Card.Description>
        <Card.Title class="@[250px]/card:text-3xl text-2xl font-semibold tabular-nums">
          DOP {formatCurrency(Math.abs(itbisCollected - itbisPaid))}
        </Card.Title>
        <Card.Action>
          <Badge variant="outline" class={(itbisCollected - itbisPaid) >= 0 ? "text-yellow-500 border-yellow-500/50" : "text-green-500 border-green-500/50"}>
            {#if (itbisCollected - itbisPaid) >= 0}
              <TrendingUpIcon class="w-3 h-3 text-yellow-500" />
            {:else}
              <TrendingDownIcon class="w-3 h-3 text-green-500" />
            {/if}
            <span class={(itbisCollected - itbisPaid) >= 0 ? "text-yellow-500" : "text-green-500"}>
              {#if (itbisCollected - itbisPaid) >= 0}
                {$locale === 'es' ? 'Debe' : 'Owed'}
              {:else}
                {$locale === 'es' ? 'Crédito' : 'Credit'}
              {/if}
            </span>
          </Badge>
        </Card.Action>
      </Card.Header>
      <Card.Footer class="flex-col items-start gap-1.5 text-sm">
        <div class="line-clamp-1 flex gap-2 font-medium">
            <span class="text-green-500">+{formatCurrency(itbisCollected)}</span>
          <span class="text-muted-foreground">/</span>
            <span class="text-red-500">-{formatCurrency(itbisPaid)}</span>
        </div>
        <div class="text-muted-foreground">
          {(itbisCollected - itbisPaid) >= 0 ? t('home.taxLiability', $locale) : t('home.taxCreditAvailable', $locale)}
        </div>
      </Card.Footer>
    </Card.Root>

  </div>

  <!-- Quick Stats Row -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 lg:px-6">
    <div class="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div class="p-2 bg-green-500/10 rounded-lg">
        <DollarSign class="text-green-500" size={20} />
      </div>
      <div>
        <div class="text-xs text-muted-foreground uppercase font-medium">{t('home.todaySales', $locale)}</div>
        <div class="text-lg font-bold">${formatCurrency(todaySales)}</div>
        <div class="text-xs text-muted-foreground">{todaySalesCount} {todaySalesCount === 1 ? 'venta' : 'ventas'}</div>
      </div>
    </div>
    
    <div class="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div class="p-2 bg-yellow-500/10 rounded-lg">
        <CreditCard class="text-yellow-500" size={20} />
      </div>
      <div>
        <div class="text-xs text-muted-foreground uppercase font-medium">{t('home.pendingCredit', $locale)}</div>
        <div class="text-lg font-bold text-yellow-500">${formatCurrency(pendingCredit)}</div>
        <div class="text-xs text-muted-foreground">CxC</div>
      </div>
    </div>
    
    <div class="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div class="p-2 bg-orange-500/10 rounded-lg">
        <RotateCcw class="text-orange-500" size={20} />
      </div>
      <div>
        <div class="text-xs text-muted-foreground uppercase font-medium">{t('home.returnsAmount', $locale)}</div>
        <div class="text-lg font-bold text-orange-500">${formatCurrency(monthlyReturns)}</div>
        <div class="text-xs text-muted-foreground">{$locale === 'es' ? 'este mes' : 'this month'}</div>
      </div>
    </div>
    
    <div class="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
      <div class="p-2 {lowStockCount > 0 ? 'bg-red-500/10' : 'bg-green-500/10'} rounded-lg">
        <AlertTriangle class="{lowStockCount > 0 ? 'text-red-500' : 'text-green-500'}" size={20} />
      </div>
      <div>
        <div class="text-xs text-muted-foreground uppercase font-medium">{t('home.lowStockItems', $locale)}</div>
        <div class="text-lg font-bold {lowStockCount > 0 ? 'text-red-500' : 'text-green-500'}">{lowStockCount}</div>
        <div class="text-xs text-muted-foreground">{$locale === 'es' ? 'productos' : 'products'}</div>
      </div>
    </div>
  </div>

  <!-- Central Grid -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4 lg:px-6">
    
    <!-- Sales Metrics -->
    <Card.Root class="rounded-xl">
      <Card.Header>
        <Card.Title class="flex items-center space-x-2">
          <Activity size={20} class="text-green-500" />
          <span>{t('home.salesMetrics', $locale)}</span>
        </Card.Title>
      </Card.Header>
      <Card.Content>
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-muted/50 rounded-lg p-4 border border-border">
            <div class="text-muted-foreground text-xs uppercase font-bold mb-1">{t('home.avgTicket', $locale)}</div>
            <div class="text-lg font-bold text-green-500">DOP {formatCurrency(avgTicket)}</div>
          </div>
          
          <div class="bg-muted/50 rounded-lg p-4 border border-border">
            <div class="text-muted-foreground text-xs uppercase font-bold mb-1">{t('home.totalSales', $locale)}</div>
            <div class="text-lg font-bold">{totalSalesCount}</div>
          </div>

          <div class="bg-muted/50 rounded-lg p-4 border border-border">
            <div class="text-muted-foreground text-xs uppercase font-bold mb-1">{t('home.activeCustomers', $locale)}</div>
            <div class="text-lg font-bold">{activeCustomersCount}</div>
          </div>

          <div class="bg-muted/50 rounded-lg p-4 border border-border">
            <div class="text-muted-foreground text-xs uppercase font-bold mb-1">{t('home.activeSuppliers', $locale)}</div>
            <div class="text-lg font-bold">{activeSuppliersCount}</div>
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Sales vs Costs Chart -->
    <Card.Root class="rounded-xl flex flex-col">
      <Card.Header class="pb-2">
        <Card.Title class="flex items-center space-x-2">
          <BarChart3 size={20} class="text-primary" />
          <span>{t('home.salesVsCosts', $locale)}</span>
        </Card.Title>
        <Card.Description>
          {$locale === 'es' ? 'Últimos 6 meses' : 'Last 6 months'}
        </Card.Description>
      </Card.Header>

      <Card.Content class="flex-1 pt-0">
        {#if chartData.length > 0}
          <div class="h-[250px] w-full">
            <LineChart
              data={chartData}
              x="date"
              xScale={scaleTime()}
              axis="x"
              series={[
                {
                  key: "sales",
                  label: t('home.sales', $locale),
                  color: "hsl(var(--chart-2))",
                  props: { fill: "none" }
                },
                {
                  key: "costs",
                  label: t('home.costs', $locale),
                  color: "hsl(var(--chart-1))",
                  props: { fill: "none" }
                },
              ]}
              props={{
                spline: { curve: curveNatural, strokeWidth: 2, fill: "none" },
                xAxis: {
                  format: (v) => v instanceof Date ? v.toLocaleString('default', { month: 'short' }) : v,
                },
                highlight: { points: { r: 5 } },
              }}
              tooltip={{ mode: 'bisect-x' }}
            />
          </div>
        {:else}
          <div class="w-full h-[250px] flex items-center justify-center text-muted-foreground">
            {t('home.noDataAvailable', $locale)}
          </div>
        {/if}
      </Card.Content>
      <Card.Footer>
        <div class="flex w-full items-start gap-4 text-sm">
          <div class="flex items-center gap-2">
            <div class="h-2 w-2 rounded-full" style="background-color: hsl(var(--chart-2))"></div>
            <span class="text-muted-foreground">{t('home.sales', $locale)}</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="h-2 w-2 rounded-full" style="background-color: hsl(var(--chart-1))"></div>
            <span class="text-muted-foreground">{t('home.costs', $locale)}</span>
          </div>
        </div>
      </Card.Footer>
    </Card.Root>

  </div>

  <!-- Top Supplier Card (smaller) -->
  <div class="px-4 lg:px-6">
  <Card.Root class="rounded-xl">
    <Card.Header class="pb-3">
      <Card.Title class="flex items-center space-x-2 text-base">
        <Users size={18} class="text-yellow-500" />
        <span>{t('home.topSupplier', $locale)}</span>
      </Card.Title>
    </Card.Header>
    <Card.Content class="pt-0">
      <div class="flex items-center justify-between">
        <div class="font-bold text-lg truncate" title={topSupplier.name}>{topSupplier.name}</div>
        <div class="text-muted-foreground">DOP {formatCurrency(topSupplier.amount)}</div>
      </div>
    </Card.Content>
  </Card.Root>
  </div>

  <!-- Quick Actions -->
  <div class="grid grid-cols-2 md:grid-cols-6 gap-3 px-4 lg:px-6">
    
    <!-- POS (Primary) -->
    <button 
      class="md:col-span-2 bg-green-500 text-white p-4 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-green-600 transition-colors group shadow-lg shadow-green-500/20"
      on:click={goPos}
    >
      <div class="p-3 bg-white/20 rounded-full group-hover:scale-110 transition-transform">
        <ShoppingCart size={24} class="text-inherit" />
      </div>
      <span class="font-bold text-sm">{t('home.openPos', $locale)}</span>
    </button>

    <button 
      class="bg-card text-card-foreground border border-border p-4 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-accent transition-colors group"
      on:click={goOrders}
    >
      <div class="p-3 bg-secondary rounded-full group-hover:scale-110 transition-transform">
        <FileText size={22} class="text-primary" />
      </div>
      <span class="font-medium text-sm">{t('home.viewOrders', $locale)}</span>
    </button>

    <button 
      class="bg-card text-card-foreground border border-border p-4 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-accent transition-colors group"
      on:click={goCapture}
    >
      <div class="p-3 bg-secondary rounded-full group-hover:scale-110 transition-transform">
        <Camera size={22} class="text-blue-500" />
      </div>
      <span class="font-medium text-sm">{t('home.newInvoice', $locale)}</span>
    </button>

    <button 
      class="bg-card text-card-foreground border border-border p-4 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-accent transition-colors group"
      on:click={goCatalog}
    >
      <div class="p-3 bg-secondary rounded-full group-hover:scale-110 transition-transform">
        <Package size={22} class="text-purple-500" />
      </div>
      <span class="font-medium text-sm">{t('home.catalog', $locale)}</span>
    </button>

    <button 
      class="bg-card text-card-foreground border border-border p-4 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-accent transition-colors group"
      on:click={goReports}
    >
      <div class="p-3 bg-secondary rounded-full group-hover:scale-110 transition-transform">
        <BarChart3 size={22} class="text-yellow-500" />
      </div>
      <span class="font-medium text-sm">{t('home.reports', $locale)}</span>
    </button>

  </div>

</div>
