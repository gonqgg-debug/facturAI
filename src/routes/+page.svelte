<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '$lib/db';
  import { goto } from '$app/navigation';
  import { 
    Camera, Upload, FileText, 
    TrendingUp, TrendingDown, DollarSign, 
    CreditCard, Users, Activity,
    ShoppingBag, BarChart3, Package
  } from 'lucide-svelte';
  import type { Invoice } from '$lib/types';
  import * as Card from '$lib/components/ui/card';

  // Metrics
  let monthlyExpenses = 0;
  let monthlyExpensesDiff = 0; // % vs prev month
  let itbisPaid = 0;
  let topSupplier = { name: '-', amount: 0 };
  
  // Key Metrics
  let avgInvoiceValue = 0;
  let totalInvoicesCount = 0;
  let activeSuppliersCount = 0;
  let lastInvoiceDate = '-';
  
  // Chart Data
  let chartData: { month: string; costs: number; sales: number }[] = [];
  let maxChartValue = 0;

  onMount(async () => {
    await loadDashboardData();
  });

  async function loadDashboardData() {
    const invoices = await db.invoices.toArray();
    
    // 1. Monthly Expenses (Current Month)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

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

    // 2. ITBIS Paid (Current Month)
    itbisPaid = currentMonthInvoices.reduce((sum, i) => sum + (i.itbisTotal || 0), 0);

    // 3. Top Supplier (All Time or Month? Usually Month for dashboard, but let's do All Time for stability if month is empty)
    // Let's do Current Month to match context, fallback to all time if empty
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

    // 4. Key Metrics
    totalInvoicesCount = invoices.length;
    const totalSpend = invoices.reduce((sum, i) => sum + (i.total || 0), 0);
    avgInvoiceValue = totalInvoicesCount > 0 ? totalSpend / totalInvoicesCount : 0;
    
    const uniqueSuppliers = new Set(invoices.map(i => i.providerName));
    activeSuppliersCount = uniqueSuppliers.size;
    
    if (invoices.length > 0) {
      // Sort by date desc
      const sorted = [...invoices].sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
      lastInvoiceDate = sorted[0].issueDate;
    }

    // 5. Chart Data (Last 6 Months)
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = d.toLocaleString('default', { month: 'short' });
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // YYYY-MM format for matching
      months.push({ name: monthName, key });
    }

    chartData = months.map(m => {
      const monthInvoices = invoices.filter(i => i.issueDate.startsWith(m.key));
      const costs = monthInvoices.reduce((sum, i) => sum + (i.total || 0), 0);
      // Placeholder for Sales if we had them
      const sales = 0; 
      return { month: m.name, costs, sales };
    });

    maxChartValue = Math.max(...chartData.map(d => d.costs), 1000); // Min 1000 scale
  }

  // Quick Actions
  function goCapture() { goto('/capture'); }
  function goHistory() { goto('/history'); }
  function goCatalog() { goto('/catalog'); }
  function goValidation() { goto('/validation'); } // Or last invoice

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
</script>

<div class="flex-1 p-6 space-y-8 pb-24">
  
  <!-- Header: 3 Horizontal Cards -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    
    <!-- Monthly Expenses -->
    <Card.Root class="rounded-xl relative overflow-hidden group hover:bg-accent/50 transition-colors">
      <Card.Header class="flex flex-row justify-between items-start pb-2">
        <div class="p-2 bg-destructive/10 rounded-lg">
          <DollarSign class="text-destructive" size={24} />
        </div>
        {#if monthlyExpensesDiff !== 0}
          <div class="flex items-center space-x-1 text-xs font-bold {monthlyExpensesDiff > 0 ? 'text-destructive' : 'text-green-500'} bg-accent px-2 py-1 rounded-full">
            {#if monthlyExpensesDiff > 0}
              <TrendingUp size={12} />
            {:else}
              <TrendingDown size={12} />
            {/if}
            <span>{Math.abs(monthlyExpensesDiff).toFixed(0)}%</span>
          </div>
        {/if}
      </Card.Header>
      <Card.Content class="pt-0">
        <div class="text-sm text-muted-foreground font-medium mb-1">Monthly Expenses</div>
        <div class="text-3xl font-bold tracking-tight">DOP {monthlyExpenses.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
        <div class="text-xs text-muted-foreground mt-2">vs. previous month</div>
      </Card.Content>
    </Card.Root>

    <!-- ITBIS Paid -->
    <Card.Root class="rounded-xl group hover:bg-accent/50 transition-colors">
      <Card.Header class="flex flex-row justify-between items-start pb-2">
        <div class="p-2 bg-primary/10 rounded-lg">
          <CreditCard class="text-primary" size={24} />
        </div>
      </Card.Header>
      <Card.Content class="pt-0">
        <div class="text-sm text-muted-foreground font-medium mb-1">ITBIS Paid</div>
        <div class="text-3xl font-bold tracking-tight">DOP {itbisPaid.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
        <div class="text-xs text-muted-foreground mt-2">Tax credit available</div>
      </Card.Content>
    </Card.Root>

    <!-- Top Supplier -->
    <Card.Root class="rounded-xl group hover:bg-accent/50 transition-colors">
      <Card.Header class="flex flex-row justify-between items-start pb-2">
        <div class="p-2 bg-yellow-500/10 rounded-lg">
          <Users class="text-yellow-500" size={24} />
        </div>
      </Card.Header>
      <Card.Content class="pt-0">
        <div class="text-sm text-muted-foreground font-medium mb-1">Top Supplier</div>
        <div class="text-xl font-bold truncate" title={topSupplier.name}>{topSupplier.name}</div>
        <div class="text-sm text-muted-foreground mt-1">DOP {topSupplier.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
      </Card.Content>
    </Card.Root>

  </div>

  <!-- Central Grid -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    
    <!-- Key Metrics -->
    <Card.Root class="rounded-xl">
      <Card.Header>
        <Card.Title class="flex items-center space-x-2">
          <Activity size={20} class="text-primary" />
          <span>Key Metrics</span>
        </Card.Title>
      </Card.Header>
      <Card.Content>
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-muted/50 rounded-lg p-4 border border-border">
            <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Avg. Invoice</div>
            <div class="text-lg font-bold">DOP {avgInvoiceValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
          </div>
          
          <div class="bg-muted/50 rounded-lg p-4 border border-border">
            <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Total Invoices</div>
            <div class="text-lg font-bold">{totalInvoicesCount}</div>
          </div>

          <div class="bg-muted/50 rounded-lg p-4 border border-border">
            <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Active Suppliers</div>
            <div class="text-lg font-bold">{activeSuppliersCount}</div>
          </div>

          <div class="bg-muted/50 rounded-lg p-4 border border-border">
            <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Last Activity</div>
            <div class="text-lg font-bold truncate">{lastInvoiceDate}</div>
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Sales vs Costs Chart -->
    <Card.Root class="rounded-xl flex flex-col">
      <Card.Header class="flex flex-row justify-between items-center pb-4">
        <Card.Title class="flex items-center space-x-2">
          <BarChart3 size={20} class="text-primary" />
          <span>Monthly Costs</span>
        </Card.Title>
        <!-- Legend -->
        <div class="flex items-center space-x-4 text-xs">
          <div class="flex items-center space-x-1">
            <div class="w-2 h-2 rounded-full bg-primary"></div>
            <span class="text-muted-foreground">Costs</span>
          </div>
        </div>
      </Card.Header>

      <Card.Content class="flex-1 pt-0">
        <!-- Chart Container -->
        <div class="flex-1 w-full h-[300px] relative">
          {#if chartData.length > 0}
            <svg class="w-full h-full overflow-visible" viewBox="0 0 300 300" preserveAspectRatio="none">
              <!-- Grid Lines -->
              <line x1="0" y1="0" x2="300" y2="0" stroke="rgba(255,255,255,0.1)" stroke-dasharray="4 4" />
              <line x1="0" y1="150" x2="300" y2="150" stroke="rgba(255,255,255,0.1)" stroke-dasharray="4 4" />
              <line x1="0" y1="300" x2="300" y2="300" stroke="rgba(255,255,255,0.1)" stroke-dasharray="4 4" />

              <!-- Area -->
              <path 
                d={getAreaPath(chartData.map(d => d.costs), 300, 300)} 
                fill="url(#gradientCosts)" 
                opacity="0.2"
              />
              
              <!-- Line -->
              <path 
                d={getLinePath(chartData.map(d => d.costs), 300, 300)} 
                fill="none" 
                stroke="#0A84FF" 
                stroke-width="3" 
                stroke-linecap="round" 
                stroke-linejoin="round"
              />

              <!-- Gradients -->
              <defs>
                <linearGradient id="gradientCosts" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#0A84FF" stop-opacity="1" />
                  <stop offset="100%" stop-color="#0A84FF" stop-opacity="0" />
                </linearGradient>
              </defs>
            </svg>

            <!-- X Axis Labels -->
            <div class="flex justify-between mt-2 text-[10px] text-muted-foreground font-mono uppercase">
              {#each chartData as d}
                <span>{d.month}</span>
              {/each}
            </div>
          {:else}
            <div class="w-full h-full flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          {/if}
        </div>
      </Card.Content>
    </Card.Root>

  </div>

  <!-- Quick Actions -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    
    <button 
      class="bg-primary text-primary-foreground p-4 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-primary/90 transition-colors group shadow-lg shadow-primary/20"
      on:click={goCapture}
    >
      <div class="p-3 bg-white/20 rounded-full group-hover:scale-110 transition-transform">
        <Camera size={24} class="text-inherit" />
      </div>
      <span class="font-bold text-sm">New Invoice</span>
    </button>

    <button 
      class="bg-card text-card-foreground border border-border p-4 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-accent transition-colors group"
      on:click={goHistory}
    >
      <div class="p-3 bg-secondary rounded-full group-hover:scale-110 transition-transform">
        <FileText size={24} class="text-primary" />
      </div>
      <span class="font-medium text-sm">History</span>
    </button>

    <button 
      class="bg-card text-card-foreground border border-border p-4 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-accent transition-colors group"
      on:click={goCatalog}
    >
      <div class="p-3 bg-secondary rounded-full group-hover:scale-110 transition-transform">
        <Package size={24} class="text-green-500" />
      </div>
      <span class="font-medium text-sm">Catalog</span>
    </button>

    <button 
      class="bg-card text-card-foreground border border-border p-4 rounded-xl flex flex-col items-center justify-center space-y-2 hover:bg-accent transition-colors group"
      on:click={() => goto('/kb')}
    >
      <div class="p-3 bg-secondary rounded-full group-hover:scale-110 transition-transform">
        <ShoppingBag size={24} class="text-yellow-500" />
      </div>
      <span class="font-medium text-sm">Suppliers</span>
    </button>

  </div>

</div>
