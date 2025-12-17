<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { db } from '$lib/db';
  import { BarChart3, Package, DollarSign, TrendingUp, TrendingDown, Calendar, FileText, Download, Receipt } from 'lucide-svelte';
  import type { Product, Sale, Invoice, JournalEntry, AccountCode } from '$lib/types';
  import { getProductCostExTax, getProductPriceExTax, ITBIS_RATE } from '$lib/tax';
  import { getAccountBalance, getJournalEntriesForPeriod } from '$lib/journal';
  import { getITBISSummary } from '$lib/itbis';
  import { getTotalInventoryValuation, getCOGSForPeriod } from '$lib/fifo';
  import * as Card from '$lib/components/ui/card';
  import * as Tabs from '$lib/components/ui/tabs';
  import * as Table from '$lib/components/ui/table';
  import * as Select from '$lib/components/ui/select';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Separator } from '$lib/components/ui/separator';
  import { DatePicker } from '$lib/components/ui/date-picker';
  import { locale } from '$lib/stores';
  import * as XLSX from 'xlsx';

  // Data
  let products: Product[] = [];
  let sales: Sale[] = [];
  let invoices: Invoice[] = [];
  let journalEntries: JournalEntry[] = [];
  
  // Journal-based P&L data
  let journalCOGS = 0;
  let journalShrinkage = 0;
  let journalCardFees = 0;
  let journalOtherExpenses = 0;
  let fifoInventoryValue = 0;
  let itbisNetDue = 0;
  let cardReceivablesBalance = 0;
  let inventoryGLBalance = 0;
  
  // Date filters
  let startDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  let endDate = new Date().toISOString().split('T')[0];
  
  // Active tab
  let activeTab = 'sales';

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    if (!browser) return;
    products = await db.products.toArray();
    sales = await db.sales.toArray();
    invoices = await db.invoices.toArray();
    
    // Load journal-based data
    await loadJournalData();
  }
  
  async function loadJournalData() {
    if (!browser) return;
    
    try {
      // Get journal entries for the period
      journalEntries = await getJournalEntriesForPeriod(startDate, endDate);
      
      // Calculate COGS from journal
      const cogsBalance = await getAccountBalance('5101', startDate, endDate);
      journalCOGS = cogsBalance.debit; // COGS is a debit balance
      
      // Calculate shrinkage/waste from journal
      const shrinkageBalance1 = await getAccountBalance('6101', startDate, endDate);
      const shrinkageBalance2 = await getAccountBalance('6102', startDate, endDate);
      const shrinkageBalance3 = await getAccountBalance('6103', startDate, endDate);
      journalShrinkage = shrinkageBalance1.debit + shrinkageBalance2.debit + shrinkageBalance3.debit;
      
      // Calculate card fees from journal
      const cardFeesBalance = await getAccountBalance('6104', startDate, endDate);
      journalCardFees = cardFeesBalance.debit;
      
      // Reconciliations
      const itbis = await getITBISSummary(startDate.slice(0, 7));
      itbisNetDue = itbis?.netItbisDue ?? 0;
      
      const cardReceivables = await getAccountBalance('1106', startDate, endDate);
      cardReceivablesBalance = cardReceivables.balance;
      
      const inventoryBalance = await getAccountBalance('1201', startDate, endDate);
      inventoryGLBalance = inventoryBalance.balance;
      
      // Calculate other operating expenses
      const utilitiesBalance = await getAccountBalance('6105', startDate, endDate);
      const maintenanceBalance = await getAccountBalance('6106', startDate, endDate);
      const payrollBalance = await getAccountBalance('6107', startDate, endDate);
      const otherBalance = await getAccountBalance('6199', startDate, endDate);
      journalOtherExpenses = utilitiesBalance.debit + maintenanceBalance.debit + payrollBalance.debit + otherBalance.debit;
      
      // Get FIFO inventory valuation
      const fifoValuation = await getTotalInventoryValuation();
      fifoInventoryValue = fifoValuation.totalValue;
      
    } catch (e) {
      console.error('Error loading journal data:', e);
    }
  }
  
  // Reload journal data when dates change
  $: if (browser && startDate && endDate) {
    loadJournalData();
  }

  // Filter by date range
  $: filteredSales = sales.filter(s => s.date >= startDate && s.date <= endDate);
  $: filteredInvoices = invoices.filter(i => i.issueDate >= startDate && i.issueDate <= endDate);

  // ============ SALES REPORT ============
  $: totalSalesRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
  $: totalSalesCount = filteredSales.length;
  $: totalItemsSold = filteredSales.reduce((sum, s) => sum + s.items.reduce((isum, item) => isum + item.quantity, 0), 0);
  $: averageTicket = totalSalesCount > 0 ? totalSalesRevenue / totalSalesCount : 0;
  
  // Sales by day
  $: salesByDay = filteredSales.reduce((acc, sale) => {
    const date = sale.date;
    if (!acc[date]) {
      acc[date] = { date, count: 0, total: 0, items: 0 };
    }
    acc[date].count++;
    acc[date].total += sale.total;
    acc[date].items += sale.items.reduce((sum, item) => sum + item.quantity, 0);
    return acc;
  }, {} as Record<string, { date: string; count: number; total: number; items: number }>);
  
  $: salesByDayArray = Object.values(salesByDay).sort((a, b) => b.date.localeCompare(a.date));
  
  // Payment method breakdown
  $: salesByPayment = filteredSales.reduce((acc, sale) => {
    const method = sale.paymentStatus === 'pending' ? 'credit' : sale.paymentMethod;
    if (!acc[method]) {
      acc[method] = { method, count: 0, total: 0 };
    }
    acc[method].count++;
    acc[method].total += sale.total;
    return acc;
  }, {} as Record<string, { method: string; count: number; total: number }>);
  
  $: paymentBreakdown = Object.values(salesByPayment);

  // ============ INVENTORY VALUATION ============
  // Use tax-exclusive costs for accurate inventory valuation
  $: inventoryItems = products.map(p => {
    const costExTax = getProductCostExTax(p);
    const priceExTax = getProductPriceExTax(p) || costExTax * 1.3;
    const stock = Number(p.currentStock ?? 0);
    return {
      ...p,
      costExTax,
      priceExTax,
      stockValue: stock * costExTax,
      potentialValue: stock * priceExTax
    };
  }).filter(p => Number(p.currentStock ?? 0) > 0).sort((a, b) => b.stockValue - a.stockValue);
  
  $: totalInventoryValue = inventoryItems.reduce((sum, p) => sum + Number(p.stockValue), 0);
  $: totalPotentialValue = inventoryItems.reduce((sum, p) => sum + Number(p.potentialValue), 0);
  $: totalUnits = inventoryItems.reduce((sum, p) => sum + Number(p.currentStock ?? 0), 0);

  // ============ P&L STATEMENT ============
  // Revenue breakdown: Total sales = Net Sales + ITBIS Collected
  $: totalGrossRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
  $: totalItbisCollected = filteredSales.reduce((sum, s) => sum + s.itbisTotal, 0);
  $: netSalesRevenue = filteredSales.reduce((sum, s) => sum + s.subtotal, 0);
  
  // Revenue for P&L should be net of ITBIS (tax is pass-through)
  $: revenue = netSalesRevenue;
  
  // Cost of goods sold - prefer journal-based FIFO COGS if available
  $: costOfGoodsSold = journalCOGS > 0 ? journalCOGS : filteredSales.reduce((sum, sale) => {
    return sum + sale.items.reduce((itemSum, item) => {
      const product = products.find(p => p.id?.toString() === item.productId);
      // Use tax-exclusive cost for accurate COGS
      const costExTax = product ? getProductCostExTax(product) : (item.unitPrice * 0.7);
      return itemSum + (costExTax * Number(item.quantity));
    }, 0);
  }, 0);
  
  $: grossProfit = revenue - costOfGoodsSold;
  $: grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  
  // Operating expenses - combine journal-based and invoice-based
  $: operatingExpensesFromInvoices = filteredInvoices
    .filter(inv => inv.category !== 'Inventory')
    .reduce((sum, inv) => sum + inv.total, 0);
  
  // Total operating expenses with journal-based breakdown
  $: operatingExpenses = journalOtherExpenses > 0 
    ? journalOtherExpenses + journalShrinkage + journalCardFees
    : operatingExpensesFromInvoices;
  
  $: expensesByCategory = {
    ...(filteredInvoices
      .filter(inv => inv.category !== 'Inventory')
      .reduce((acc, inv) => {
        const cat = inv.category || 'Other';
        if (!acc[cat]) acc[cat] = 0;
        acc[cat] += inv.total;
        return acc;
      }, {} as Record<string, number>)),
    // Add journal-based expenses
    ...(journalShrinkage > 0 ? { 'Merma/Rotura': journalShrinkage } : {}),
    ...(journalCardFees > 0 ? { 'Comisiones Tarjetas': journalCardFees } : {})
  };
  
  $: netProfit = grossProfit - operatingExpenses;
  $: netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  
  // Use FIFO inventory valuation if available
  $: displayInventoryValue = fifoInventoryValue > 0 ? fifoInventoryValue : totalInventoryValue;
  $: inventoryGap = displayInventoryValue - inventoryGLBalance;

  function getPaymentMethodLabel(method: string): string {
    switch (method) {
      case 'cash': return 'Efectivo';
      case 'credit_card': return 'Tarjeta';
      case 'bank_transfer': return 'Transferencia';
      case 'credit': return 'Crédito';
      default: return method;
    }
  }
  
  function exportSalesReport() {
    const data = salesByDayArray.map(day => ({
      Fecha: day.date,
      Ventas: day.count,
      Items: day.items,
      Total: day.total
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales Report");
    XLSX.writeFile(wb, `sales_report_${startDate}_${endDate}.xlsx`);
  }
  
  function exportInventoryReport() {
    const data = inventoryItems.map(p => ({
      Producto: p.name,
      SKU: p.productId || '',
      Stock: p.currentStock,
      'Costo (ex-ITBIS)': p.costExTax,
      'Valor Stock': p.stockValue,
      'Precio (ex-ITBIS)': p.priceExTax,
      'Valor Potencial': p.potentialValue
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory Valuation");
    XLSX.writeFile(wb, `inventory_valuation_${new Date().toISOString().split('T')[0]}.xlsx`);
  }
</script>

<div class="p-6 max-w-7xl mx-auto">
  <!-- Header -->
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">
        {$locale === 'es' ? 'Análisis del Negocio' : 'Business Analytics'}
      </h1>
      <p class="text-muted-foreground mt-1">
        {$locale === 'es' ? 'Ventas, rentabilidad y desempeño del negocio' : 'Sales, profitability and business performance'}
      </p>
    </div>
    
    <!-- Date Range Picker -->
    <div class="flex items-center gap-2">
      <DatePicker 
        bind:value={startDate} 
        placeholder="Start date"
        class="w-44 h-9" 
      />
      <span class="text-muted-foreground">to</span>
      <DatePicker 
        bind:value={endDate} 
        placeholder="End date"
        class="w-44 h-9" 
      />
    </div>
  </div>
  
  <!-- Audit & Reconciliation -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
    <Card.Root>
      <Card.Content class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-xs uppercase text-muted-foreground">ITBIS Net Due</div>
            <div class="text-2xl font-bold">${itbisNetDue.toLocaleString()}</div>
            <div class="text-xs text-muted-foreground">Collected - Paid - Retentions</div>
          </div>
          <Receipt class="text-primary" size={24} />
        </div>
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Content class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-xs uppercase text-muted-foreground">Card Receivables</div>
            <div class="text-2xl font-bold">${cardReceivablesBalance.toLocaleString()}</div>
            <div class="text-xs text-muted-foreground">Account 1106</div>
          </div>
          <DollarSign class="text-blue-500" size={24} />
        </div>
      </Card.Content>
    </Card.Root>
    <Card.Root>
      <Card.Content class="p-4">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-xs uppercase text-muted-foreground">Inventory vs GL</div>
            <div class="text-2xl font-bold">{inventoryGap >= 0 ? '+' : ''}{inventoryGap.toLocaleString()}</div>
            <div class="text-xs text-muted-foreground">FIFO ${displayInventoryValue.toLocaleString()} vs 1201 ${inventoryGLBalance.toLocaleString()}</div>
          </div>
          <Package class="text-green-500" size={24} />
        </div>
      </Card.Content>
    </Card.Root>
  </div>
  
  <!-- Report Tabs -->
  <Tabs.Root bind:value={activeTab}>
    <Tabs.List class="bg-card border border-border h-12 p-1 rounded-xl gap-1 mb-6">
      <Tabs.Trigger 
        value="sales" 
        class="rounded-lg px-6 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
      >
        <BarChart3 size={16} />
        Sales Report
      </Tabs.Trigger>
      <Tabs.Trigger 
        value="inventory" 
        class="rounded-lg px-6 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
      >
        <Package size={16} />
        Inventory Valuation
      </Tabs.Trigger>
      <Tabs.Trigger 
        value="pnl" 
        class="rounded-lg px-6 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
      >
        <FileText size={16} />
        P&L Statement
      </Tabs.Trigger>
    </Tabs.List>
    
    <!-- Sales Report Tab -->
    <Tabs.Content value="sales" class="space-y-6">
      <!-- KPIs -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card.Root>
          <Card.Content class="p-4">
            <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Total Revenue</div>
            <div class="text-2xl font-bold">${totalSalesRevenue.toLocaleString()}</div>
          </Card.Content>
        </Card.Root>
        <Card.Root>
          <Card.Content class="p-4">
            <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Sales Count</div>
            <div class="text-2xl font-bold">{totalSalesCount}</div>
          </Card.Content>
        </Card.Root>
        <Card.Root>
          <Card.Content class="p-4">
            <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Items Sold</div>
            <div class="text-2xl font-bold">{totalItemsSold}</div>
          </Card.Content>
        </Card.Root>
        <Card.Root>
          <Card.Content class="p-4">
            <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Avg. Ticket</div>
            <div class="text-2xl font-bold">${averageTicket.toFixed(2)}</div>
          </Card.Content>
        </Card.Root>
      </div>
      
      <div class="grid md:grid-cols-3 gap-6">
        <!-- Sales by Day -->
        <Card.Root class="md:col-span-2">
          <Card.Content class="p-0">
            <div class="p-4 border-b border-border flex justify-between items-center">
              <h3 class="font-bold">Sales by Day</h3>
              <Button variant="outline" size="sm" on:click={exportSalesReport}>
                <Download size={14} class="mr-1" /> Export
              </Button>
            </div>
            <div class="max-h-96 overflow-auto">
              <Table.Root>
                <Table.Header class="bg-muted/50 sticky top-0">
                  <Table.Row>
                    <Table.Head class="text-xs uppercase">Date</Table.Head>
                    <Table.Head class="text-xs uppercase text-center">Sales</Table.Head>
                    <Table.Head class="text-xs uppercase text-center">Items</Table.Head>
                    <Table.Head class="text-xs uppercase text-right">Total</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {#each salesByDayArray as day}
                    <Table.Row>
                      <Table.Cell class="font-mono">{day.date}</Table.Cell>
                      <Table.Cell class="text-center">{day.count}</Table.Cell>
                      <Table.Cell class="text-center">{day.items}</Table.Cell>
                      <Table.Cell class="text-right font-mono font-bold">${day.total.toLocaleString()}</Table.Cell>
                    </Table.Row>
                  {:else}
                    <Table.Row>
                      <Table.Cell colspan={4} class="h-24 text-center text-muted-foreground">
                        No sales in selected period
                      </Table.Cell>
                    </Table.Row>
                  {/each}
                </Table.Body>
              </Table.Root>
            </div>
          </Card.Content>
        </Card.Root>
        
        <!-- Payment Breakdown -->
        <Card.Root>
          <Card.Content class="p-4">
            <h3 class="font-bold mb-4">Payment Methods</h3>
            <div class="space-y-3">
              {#each paymentBreakdown as pm}
                <div class="flex justify-between items-center">
                  <div>
                    <div class="font-medium">{getPaymentMethodLabel(pm.method)}</div>
                    <div class="text-sm text-muted-foreground">{pm.count} sales</div>
                  </div>
                  <div class="text-right">
                    <div class="font-bold">${pm.total.toLocaleString()}</div>
                    <div class="text-xs text-muted-foreground">
                      {totalSalesRevenue > 0 ? ((pm.total / totalSalesRevenue) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                </div>
              {:else}
                <div class="text-muted-foreground text-center py-4">No data</div>
              {/each}
            </div>
          </Card.Content>
        </Card.Root>
      </div>
    </Tabs.Content>
    
    <!-- Inventory Valuation Tab -->
    <Tabs.Content value="inventory" class="space-y-6">
      <!-- KPIs -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card.Root>
          <Card.Content class="p-4">
            <div class="text-muted-foreground text-xs uppercase font-bold mb-1">Total Units</div>
            <div class="text-2xl font-bold">{totalUnits.toLocaleString()}</div>
          </Card.Content>
        </Card.Root>
        <Card.Root>
          <Card.Content class="p-4">
            <div class="text-muted-foreground text-xs uppercase font-bold mb-1">SKUs in Stock</div>
            <div class="text-2xl font-bold">{inventoryItems.length}</div>
          </Card.Content>
        </Card.Root>
        <Card.Root>
          <Card.Content class="p-4">
            <div class="text-muted-foreground text-xs uppercase font-bold mb-1 flex items-center gap-1">
              <DollarSign size={12} />
              Inventory Value (Cost)
            </div>
            <div class="text-2xl font-bold">${totalInventoryValue.toLocaleString()}</div>
          </Card.Content>
        </Card.Root>
        <Card.Root class="border-green-500/30">
          <Card.Content class="p-4">
            <div class="text-muted-foreground text-xs uppercase font-bold mb-1 flex items-center gap-1">
              <TrendingUp size={12} class="text-green-500" />
              Potential Revenue
            </div>
            <div class="text-2xl font-bold text-green-500">${totalPotentialValue.toLocaleString()}</div>
          </Card.Content>
        </Card.Root>
      </div>
      
      <!-- Inventory Table -->
      <Card.Root>
        <Card.Content class="p-0">
          <div class="p-4 border-b border-border flex justify-between items-center">
            <h3 class="font-bold">Inventory by Product</h3>
            <Button variant="outline" size="sm" on:click={exportInventoryReport}>
              <Download size={14} class="mr-1" /> Export
            </Button>
          </div>
          <div class="max-h-[500px] overflow-auto">
            <Table.Root>
              <Table.Header class="bg-muted/50 sticky top-0">
                <Table.Row>
                  <Table.Head class="text-xs uppercase">Product</Table.Head>
                  <Table.Head class="text-xs uppercase text-center">Stock</Table.Head>
                  <Table.Head class="text-xs uppercase text-right">Unit Cost (ex-tax)</Table.Head>
                  <Table.Head class="text-xs uppercase text-right">Stock Value</Table.Head>
                  <Table.Head class="text-xs uppercase text-right">Price (ex-tax)</Table.Head>
                  <Table.Head class="text-xs uppercase text-right">Potential</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each inventoryItems as item}
                  <Table.Row>
                    <Table.Cell>
                      <div class="font-medium">{item.name}</div>
                      {#if item.productId}
                        <div class="text-xs text-muted-foreground font-mono">{item.productId}</div>
                      {/if}
                    </Table.Cell>
                    <Table.Cell class="text-center font-mono font-bold">{item.currentStock}</Table.Cell>
                    <Table.Cell class="text-right font-mono text-muted-foreground">${item.costExTax.toFixed(2)}</Table.Cell>
                    <Table.Cell class="text-right font-mono font-bold">${item.stockValue.toLocaleString()}</Table.Cell>
                    <Table.Cell class="text-right font-mono text-muted-foreground">${item.priceExTax.toFixed(2)}</Table.Cell>
                    <Table.Cell class="text-right font-mono font-bold text-green-500">${item.potentialValue.toLocaleString()}</Table.Cell>
                  </Table.Row>
                {:else}
                  <Table.Row>
                    <Table.Cell colspan={6} class="h-24 text-center text-muted-foreground">
                      No inventory data
                    </Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </div>
        </Card.Content>
      </Card.Root>
    </Tabs.Content>
    
    <!-- P&L Statement Tab -->
    <Tabs.Content value="pnl" class="space-y-6">
      <Card.Root>
        <Card.Content class="p-6">
          <h3 class="text-xl font-bold mb-6">Profit & Loss Statement</h3>
          <p class="text-sm text-muted-foreground mb-6">
            Period: {startDate} to {endDate}
          </p>
          
          <!-- Revenue Section -->
          <div class="space-y-3 mb-6">
            <div class="flex justify-between items-center text-lg">
              <span class="font-bold flex items-center gap-2">
                <TrendingUp size={18} class="text-green-500" />
                Net Revenue
              </span>
              <span class="font-bold text-green-500">${revenue.toLocaleString()}</span>
            </div>
            <div class="pl-6 text-sm space-y-1">
              <div class="flex justify-between text-muted-foreground">
                <span>Gross Sales ({filteredSales.length} transactions)</span>
                <span>${totalGrossRevenue.toLocaleString()}</span>
              </div>
              <div class="flex justify-between text-blue-500">
                <span class="flex items-center gap-1">
                  <Receipt size={12} />
                  ITBIS Collected (pass-through)
                </span>
                <span>-${totalItbisCollected.toLocaleString()}</span>
              </div>
              <div class="flex justify-between font-medium border-t border-border pt-1 mt-1">
                <span>Net Sales Revenue</span>
                <span>${netSalesRevenue.toLocaleString()}</span>
              </div>
            </div>
          </div>
          
          <Separator class="my-4" />
          
          <!-- Cost of Goods Sold -->
          <div class="space-y-3 mb-6">
            <div class="flex justify-between items-center text-lg">
              <span class="font-bold flex items-center gap-2">
                <Package size={18} class="text-muted-foreground" />
                Cost of Goods Sold
              </span>
              <span class="font-bold text-destructive">-${costOfGoodsSold.toLocaleString()}</span>
            </div>
          </div>
          
          <Separator class="my-4" />
          
          <!-- Gross Profit -->
          <div class="flex justify-between items-center text-lg mb-6 bg-muted/50 p-4 rounded-lg">
            <span class="font-bold">Gross Profit</span>
            <div class="text-right">
              <div class="font-bold {grossProfit >= 0 ? 'text-green-500' : 'text-destructive'}">
                ${grossProfit.toLocaleString()}
              </div>
              <div class="text-sm text-muted-foreground">
                {grossMargin.toFixed(1)}% margin
              </div>
            </div>
          </div>
          
          <!-- Operating Expenses -->
          <div class="space-y-3 mb-6">
            <div class="flex justify-between items-center text-lg">
              <span class="font-bold flex items-center gap-2">
                <TrendingDown size={18} class="text-destructive" />
                Operating Expenses
              </span>
              <span class="font-bold text-destructive">-${operatingExpenses.toLocaleString()}</span>
            </div>
            <div class="pl-6 text-sm space-y-1">
              {#each Object.entries(expensesByCategory) as [category, amount]}
                <div class="flex justify-between text-muted-foreground">
                  <span>{category}</span>
                  <span>-${amount.toLocaleString()}</span>
                </div>
              {/each}
              {#if Object.keys(expensesByCategory).length === 0}
                <div class="text-muted-foreground">No operating expenses in period</div>
              {/if}
            </div>
          </div>
          
          <Separator class="my-4" />
          
          <!-- Net Profit -->
          <div class="flex justify-between items-center text-xl p-6 rounded-xl {netProfit >= 0 ? 'bg-green-500/10 border border-green-500/30' : 'bg-destructive/10 border border-destructive/30'}">
            <span class="font-bold">Net Profit</span>
            <div class="text-right">
              <div class="text-2xl font-bold {netProfit >= 0 ? 'text-green-500' : 'text-destructive'}">
                ${netProfit.toLocaleString()}
              </div>
              <div class="text-sm text-muted-foreground">
                {netMargin.toFixed(1)}% net margin
              </div>
            </div>
          </div>
          
          <!-- Summary Cards -->
          <div class="grid grid-cols-3 gap-4 mt-6">
            <Card.Root>
              <Card.Content class="p-4 text-center">
                <div class="text-xs uppercase text-muted-foreground mb-1">Gross Margin</div>
                <div class="text-xl font-bold {grossMargin >= 20 ? 'text-green-500' : 'text-yellow-500'}">
                  {grossMargin.toFixed(1)}%
                </div>
              </Card.Content>
            </Card.Root>
            <Card.Root>
              <Card.Content class="p-4 text-center">
                <div class="text-xs uppercase text-muted-foreground mb-1">Net Margin</div>
                <div class="text-xl font-bold {netMargin >= 10 ? 'text-green-500' : netMargin >= 0 ? 'text-yellow-500' : 'text-destructive'}">
                  {netMargin.toFixed(1)}%
                </div>
              </Card.Content>
            </Card.Root>
            <Card.Root>
              <Card.Content class="p-4 text-center">
                <div class="text-xs uppercase text-muted-foreground mb-1">Expense Ratio</div>
                <div class="text-xl font-bold">
                  {revenue > 0 ? ((operatingExpenses / revenue) * 100).toFixed(1) : 0}%
                </div>
              </Card.Content>
            </Card.Root>
          </div>
        </Card.Content>
      </Card.Root>
    </Tabs.Content>
  </Tabs.Root>
</div>

