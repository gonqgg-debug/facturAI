<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { db, generateId } from '$lib/db';
  import { 
    CreditCard, Building, DollarSign, Percent, Calendar,
    CheckCircle2, Clock, AlertCircle, Plus, Download, Receipt
  } from 'lucide-svelte';
  import type { Sale, CardSettlement, BankAccount } from '$lib/types';
  import { createCardSettlementEntry } from '$lib/journal';
  import { recordCardRetention } from '$lib/itbis';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Card from '$lib/components/ui/card';
  import * as Table from '$lib/components/ui/table';
  import * as Select from '$lib/components/ui/select';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Separator } from '$lib/components/ui/separator';
  import { locale } from '$lib/stores';
  import { t } from '$lib/i18n';

  // Data
  let pendingCardSales: Sale[] = [];
  let settlements: CardSettlement[] = [];
  let bankAccounts: BankAccount[] = [];
  
  // Period selection
  let selectedStartDate = new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0];
  let selectedEndDate = new Date().toISOString().split('T')[0];
  
  // New settlement form
  let newSettlementDialogOpen = false;
  let selectedSaleIds: Set<string> = new Set();
  let grossAmount = 0;
  let commissionRate = 0.038; // Default 3.8% (your processor's rate)
  let itbisRetentionRate = 0.02; // Default 2%
  let settlementDate = new Date().toISOString().split('T')[0];
  let selectedBankAccountId: string | undefined;
  let depositReference = '';
  let processing = false;
  
  // Calculated values
  $: commissionAmount = grossAmount * commissionRate;
  $: itbisRetentionAmount = grossAmount * itbisRetentionRate;
  $: netDeposit = grossAmount - commissionAmount - itbisRetentionAmount;
  
  // Totals for selected sales
  $: selectedTotal = [...selectedSaleIds].reduce((sum, id) => {
    const sale = pendingCardSales.find(s => s.id === id);
    return sum + (sale?.total ?? 0);
  }, 0);

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    if (!browser) return;
    
    console.log('[CardSettlements] Starting loadData...');
    
    // Load ALL sales and filter for cards
    const allSalesInDb = await db.sales.toArray();
    console.log('[CardSettlements] Total sales in DB:', allSalesInDb.length);
    
    // Show all unique payment methods in the database
    const paymentMethods = [...new Set(allSalesInDb.map(s => s.paymentMethod))];
    console.log('[CardSettlements] All payment methods in DB:', paymentMethods);
    
    // Filter for card payments (credit_card or debit_card) that are paid
    const cardSales = allSalesInDb.filter(s => 
      (s.paymentMethod === 'credit_card' || s.paymentMethod === 'debit_card') && 
      s.paymentStatus === 'paid'
    );
    console.log('[CardSettlements] Card sales found:', cardSales.length);
    
    // Get already settled sale IDs
    const allSettlements = await db.cardSettlements.toArray();
    const settledSaleIds = new Set<string>();
    for (const settlement of allSettlements) {
      for (const saleId of settlement.saleIds) {
        settledSaleIds.add(String(saleId));
      }
    }
    console.log('[CardSettlements] Total settlements:', allSettlements.length);
    console.log('[CardSettlements] Already settled sale IDs count:', settledSaleIds.size);
    
    // Filter out already settled sales
    pendingCardSales = cardSales.filter(s => {
      const saleId = String(s.id);
      const isSettled = settledSaleIds.has(saleId);
      return s.id && !isSettled;
    });
    console.log('[CardSettlements] Card sales total:', cardSales.length, '| Already settled:', settledSaleIds.size, '| Pending:', pendingCardSales.length);
    
    settlements = allSettlements.sort((a, b) => 
      new Date(b.settlementDate).getTime() - new Date(a.settlementDate).getTime()
    );
    
    // Load bank accounts (filter active ones)
    const allBankAccounts = await db.bankAccounts.toArray();
    bankAccounts = allBankAccounts.filter(a => a.isActive !== false);
  }

  function toggleSaleSelection(saleId: string) {
    if (selectedSaleIds.has(saleId)) {
      selectedSaleIds.delete(saleId);
    } else {
      selectedSaleIds.add(saleId);
    }
    selectedSaleIds = selectedSaleIds;
    // Auto-sync gross amount with selected sales
    updateGrossAmount();
  }

  function selectAll() {
    if (selectedSaleIds.size === pendingCardSales.length) {
      selectedSaleIds.clear();
    } else {
      pendingCardSales.forEach(s => {
        if (s.id) selectedSaleIds.add(String(s.id));
      });
    }
    selectedSaleIds = selectedSaleIds;
    // Auto-sync gross amount with selected sales
    updateGrossAmount();
  }
  
  function updateGrossAmount() {
    // Calculate total from selected sales
    const total = [...selectedSaleIds].reduce((sum, id) => {
      const sale = pendingCardSales.find(s => s.id === id);
      return sum + (sale?.total ?? 0);
    }, 0);
    grossAmount = total;
  }

  async function openNewSettlement() {
    // Reload all data fresh when opening dialog
    await loadData();
    
    selectedSaleIds.clear();
    selectedSaleIds = selectedSaleIds;
    grossAmount = 0;
    commissionRate = 0.038; // 3.8% processor commission
    itbisRetentionRate = 0.02;
    settlementDate = new Date().toISOString().split('T')[0];
    selectedBankAccountId = bankAccounts.find(a => a.isDefault)?.id;
    depositReference = '';
    newSettlementDialogOpen = true;
  }

  async function createSettlement() {
    if (!browser) return;
    
    // Validate gross amount
    if (grossAmount <= 0) {
      alert($locale === 'es' ? 'Ingrese el monto bruto del depósito.' : 'Enter the gross deposit amount.');
      return;
    }
    
    // Validate bank account
    if (!selectedBankAccountId) {
      alert($locale === 'es' ? 'Seleccione la cuenta bancaria del depósito.' : 'Choose the bank account for the deposit.');
      return;
    }
    
    // If sales are selected, validate they match (but allow manual entry without sales)
    if (selectedSaleIds.size > 0 && Math.abs(grossAmount - selectedTotal) > 0.01) {
      const message = $locale === 'es'
        ? `El monto bruto (${grossAmount.toFixed(2)}) no coincide con el total de las ventas seleccionadas (${selectedTotal.toFixed(2)}). Ajuste el monto o la selección.`
        : `Gross amount (${grossAmount.toFixed(2)}) does not match selected sales total (${selectedTotal.toFixed(2)}). Adjust amount or selection.`;
      alert(message);
      return;
    }
    
    processing = true;
    
    try {
      // Determine period from selected sales
      const saleDates = [...selectedSaleIds].map(id => {
        const sale = pendingCardSales.find(s => s.id === id);
        return sale?.date || '';
      }).filter(d => d);
      
      const periodStart = saleDates.length > 0 ? saleDates.sort()[0] : settlementDate;
      const periodEnd = saleDates.length > 0 ? saleDates.sort().reverse()[0] : settlementDate;
      
      console.log('[Settlement] Creating settlement:', { grossAmount, commissionRate, itbisRetentionRate, settlementDate });
      
      // Create settlement record
      const settlement: CardSettlement = {
        id: generateId(),
        settlementDate,
        periodStart,
        periodEnd,
        grossAmount,
        commissionRate,
        commissionAmount,
        itbisRetentionRate,
        itbisRetentionAmount,
        netDeposit,
        bankAccountId: selectedBankAccountId,
        depositReference: depositReference || undefined,
        saleIds: [...selectedSaleIds],
        status: 'reconciled',
        reconciledAt: new Date(),
        createdAt: new Date()
      };
      
      console.log('[Settlement] Saving settlement record...');
      await db.cardSettlements.add(settlement);
      console.log('[Settlement] Settlement saved with ID:', settlement.id);
      
      // Create journal entry
      console.log('[Settlement] Creating journal entry...');
      let journalEntry;
      try {
        journalEntry = await createCardSettlementEntry(
          grossAmount,
          commissionRate,
          itbisRetentionRate,
          settlementDate,
          depositReference || `Liquidación ${periodStart} a ${periodEnd}`
        );
        console.log('[Settlement] Journal entry created:', journalEntry.id);
      } catch (journalError) {
        console.error('[Settlement] Journal entry failed:', journalError);
        // Continue without journal entry - settlement is still valid
      }
      
      // Update settlement with journal entry ID
      if (journalEntry?.id && settlement.id) {
        await db.cardSettlements.update(settlement.id, {
          journalEntryId: journalEntry.id
        });
      }
      
      // Record ITBIS retention for tax reporting
      console.log('[Settlement] Recording ITBIS retention...');
      try {
        await recordCardRetention(settlementDate, itbisRetentionAmount);
        console.log('[Settlement] ITBIS retention recorded');
      } catch (itbisError) {
        console.error('[Settlement] ITBIS retention failed:', itbisError);
        // Continue - not critical
      }
      
      newSettlementDialogOpen = false;
      await loadData();
      
    } catch (e) {
      console.error('Error creating settlement:', e);
      const errorMsg = e instanceof Error ? e.message : String(e);
      alert($locale === 'es' 
        ? `Error al crear la liquidación: ${errorMsg}` 
        : `Error creating settlement: ${errorMsg}`);
    } finally {
      processing = false;
    }
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString($locale === 'es' ? 'es-DO' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
</script>

<div class="p-6 max-w-7xl mx-auto">
  <!-- Header -->
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
    <div>
      <h1 class="text-3xl font-bold tracking-tight flex items-center gap-3">
        <CreditCard class="text-primary" size={32} />
        {$locale === 'es' ? 'Bancos y Tarjetas' : 'Bank & Cards'}
      </h1>
      <p class="text-muted-foreground mt-1">
        {$locale === 'es' 
          ? 'Concilia los depósitos de Cardnet/Visa con tu banco. Registra comisiones y retención ITBIS 2%.' 
          : 'Reconcile card processor deposits with your bank. Record fees and 2% ITBIS retention.'}
      </p>
    </div>
    
    <Button variant="default" class="gap-2" on:click={openNewSettlement}>
      <Plus size={16} />
      {$locale === 'es' ? 'Registrar Depósito' : 'Record Deposit'}
    </Button>
  </div>

  <!-- Summary Cards -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
    <Card.Root>
      <Card.Content class="p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg bg-yellow-500/10">
            <Clock size={20} class="text-yellow-500" />
          </div>
          <div>
            <div class="text-xs uppercase text-muted-foreground">Pendientes</div>
            <div class="text-2xl font-bold">{pendingCardSales.length}</div>
            <div class="text-sm text-muted-foreground">
              ${pendingCardSales.reduce((sum, s) => sum + s.total, 0).toLocaleString()}
            </div>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
    
    <Card.Root>
      <Card.Content class="p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg bg-green-500/10">
            <CheckCircle2 size={20} class="text-green-500" />
          </div>
          <div>
            <div class="text-xs uppercase text-muted-foreground">Liquidados</div>
            <div class="text-2xl font-bold">{settlements.length}</div>
            <div class="text-sm text-muted-foreground">
              ${settlements.reduce((sum, s) => sum + s.netDeposit, 0).toLocaleString()}
            </div>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
    
    <Card.Root>
      <Card.Content class="p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg bg-blue-500/10">
            <Percent size={20} class="text-blue-500" />
          </div>
          <div>
            <div class="text-xs uppercase text-muted-foreground">Comisiones Pagadas</div>
            <div class="text-2xl font-bold">
              ${settlements.reduce((sum, s) => sum + s.commissionAmount, 0).toLocaleString()}
            </div>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
    
    <Card.Root>
      <Card.Content class="p-4">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-lg bg-orange-500/10">
            <Receipt size={20} class="text-orange-500" />
          </div>
          <div>
            <div class="text-xs uppercase text-muted-foreground">ITBIS Retenido</div>
            <div class="text-2xl font-bold">
              ${settlements.reduce((sum, s) => sum + s.itbisRetentionAmount, 0).toLocaleString()}
            </div>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  </div>

  <!-- Pending Card Sales -->
  {#if pendingCardSales.length > 0}
    <Card.Root class="mb-8">
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <Clock size={18} class="text-yellow-500" />
          {$locale === 'es' ? 'Ventas con Tarjeta Pendientes de Liquidar' : 'Pending Card Sales'}
        </Card.Title>
      </Card.Header>
      <Card.Content class="p-0">
        <div class="max-h-[400px] overflow-auto">
          <Table.Root>
            <Table.Header class="bg-muted/50 sticky top-0">
              <Table.Row>
                <Table.Head class="text-xs uppercase">Recibo</Table.Head>
                <Table.Head class="text-xs uppercase">Fecha</Table.Head>
                <Table.Head class="text-xs uppercase">Cliente</Table.Head>
                <Table.Head class="text-xs uppercase">Método</Table.Head>
                <Table.Head class="text-xs uppercase text-right">Total</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each pendingCardSales as sale}
                <Table.Row>
                  <Table.Cell class="font-mono text-sm">{sale.receiptNumber || '-'}</Table.Cell>
                  <Table.Cell class="text-sm">{formatDate(sale.date)}</Table.Cell>
                  <Table.Cell class="text-sm">{sale.customerName || 'Consumidor Final'}</Table.Cell>
                  <Table.Cell>
                    <Badge variant="outline" class="text-blue-500 border-blue-500">
                      {sale.paymentMethod === 'credit_card' ? 'Crédito' : 'Débito'}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell class="text-right font-mono font-bold">${sale.total.toLocaleString()}</Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>
      </Card.Content>
    </Card.Root>
  {/if}

  <!-- Settlement History -->
  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <CheckCircle2 size={18} class="text-green-500" />
        {$locale === 'es' ? 'Historial de Liquidaciones' : 'Settlement History'}
      </Card.Title>
    </Card.Header>
    <Card.Content class="p-0">
      <div class="max-h-[500px] overflow-auto">
        <Table.Root>
          <Table.Header class="bg-muted/50 sticky top-0">
            <Table.Row>
              <Table.Head class="text-xs uppercase">Fecha</Table.Head>
              <Table.Head class="text-xs uppercase">Período</Table.Head>
              <Table.Head class="text-xs uppercase text-right">Bruto</Table.Head>
              <Table.Head class="text-xs uppercase text-right">Comisión</Table.Head>
              <Table.Head class="text-xs uppercase text-right">Ret. ITBIS</Table.Head>
              <Table.Head class="text-xs uppercase text-right">Neto</Table.Head>
              <Table.Head class="text-xs uppercase">Referencia</Table.Head>
              <Table.Head class="text-xs uppercase text-center">Ventas</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each settlements as settlement}
              <Table.Row>
                <Table.Cell class="font-medium">{formatDate(settlement.settlementDate)}</Table.Cell>
                <Table.Cell class="text-sm text-muted-foreground">
                  {formatDate(settlement.periodStart)} - {formatDate(settlement.periodEnd)}
                </Table.Cell>
                <Table.Cell class="text-right font-mono">${settlement.grossAmount.toLocaleString()}</Table.Cell>
                <Table.Cell class="text-right font-mono text-red-500">
                  -${settlement.commissionAmount.toFixed(2)}
                  <span class="text-xs text-muted-foreground ml-1">({(settlement.commissionRate * 100).toFixed(1)}%)</span>
                </Table.Cell>
                <Table.Cell class="text-right font-mono text-orange-500">
                  -${settlement.itbisRetentionAmount.toFixed(2)}
                </Table.Cell>
                <Table.Cell class="text-right font-mono font-bold text-green-500">
                  ${settlement.netDeposit.toLocaleString()}
                </Table.Cell>
                <Table.Cell class="text-sm">{settlement.depositReference || '-'}</Table.Cell>
                <Table.Cell class="text-center">
                  <Badge variant="outline">{settlement.saleIds.length}</Badge>
                </Table.Cell>
              </Table.Row>
            {:else}
              <Table.Row>
                <Table.Cell colspan={8} class="h-32 text-center text-muted-foreground">
                  {$locale === 'es' ? 'No hay liquidaciones registradas' : 'No settlements recorded'}
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </div>
    </Card.Content>
  </Card.Root>
</div>

<!-- New Settlement Dialog -->
<Dialog.Root bind:open={newSettlementDialogOpen}>
  <Dialog.Content class="max-w-2xl max-h-[90vh] overflow-auto">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <CreditCard size={20} class="text-primary" />
        {$locale === 'es' ? 'Nueva Liquidación de Tarjetas' : 'New Card Settlement'}
      </Dialog.Title>
      <Dialog.Description>
        {$locale === 'es' 
          ? 'Selecciona las ventas con tarjeta e ingresa los datos del depósito bancario.' 
          : 'Select card sales and enter bank deposit details.'}
      </Dialog.Description>
    </Dialog.Header>
    
    <div class="py-4 space-y-6">
      <!-- Pending Sales Selection (collapsible) -->
      {#if pendingCardSales.length > 0}
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>{$locale === 'es' ? 'Ventas con Tarjeta Pendientes' : 'Pending Card Sales'}</Label>
            <Button variant="ghost" size="sm" on:click={selectAll}>
              {selectedSaleIds.size === pendingCardSales.length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
            </Button>
          </div>
          
          <div class="border rounded-lg max-h-48 overflow-auto">
            <Table.Root>
              <Table.Body>
                {#each pendingCardSales as sale}
                  <Table.Row 
                    class="cursor-pointer hover:bg-muted/50 {selectedSaleIds.has(String(sale.id)) ? 'bg-primary/10' : ''}"
                    on:click={() => toggleSaleSelection(String(sale.id))}
                  >
                    <Table.Cell class="w-8">
                      <input 
                        type="checkbox" 
                        checked={selectedSaleIds.has(String(sale.id))}
                        class="rounded"
                      />
                    </Table.Cell>
                    <Table.Cell class="font-mono text-sm">{sale.receiptNumber}</Table.Cell>
                    <Table.Cell class="text-sm">{formatDate(sale.date)}</Table.Cell>
                    <Table.Cell class="text-right font-mono font-bold">${sale.total.toLocaleString()}</Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </div>
          <div class="text-sm text-muted-foreground">
            {selectedSaleIds.size} {$locale === 'es' ? 'ventas seleccionadas' : 'sales selected'} = <span class="font-bold">${selectedTotal.toLocaleString()}</span>
          </div>
        </div>
      {:else}
        <div class="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg">
          <div class="flex items-center gap-2">
            <CheckCircle2 size={16} class="text-green-500" />
            {$locale === 'es' 
              ? 'Todas las ventas con tarjeta han sido liquidadas. Puede registrar un depósito manual ingresando el monto bruto abajo.' 
              : 'All card sales have been settled. You can record a manual deposit by entering the gross amount below.'}
          </div>
        </div>
      {/if}

      <Separator />

      <!-- Settlement Details -->
      <div class="grid grid-cols-2 gap-4">
        <div class="space-y-2">
          <Label for="grossAmount">
            {$locale === 'es' ? 'Monto Bruto' : 'Gross Amount'}
            {#if selectedSaleIds.size > 0}
              <span class="text-xs text-green-500 ml-2">({$locale === 'es' ? 'desde ventas' : 'from sales'})</span>
            {:else}
              <span class="text-xs text-blue-500 ml-2">({$locale === 'es' ? 'entrada manual' : 'manual entry'})</span>
            {/if}
          </Label>
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input 
              id="grossAmount"
              type="number" 
              step="0.01"
              bind:value={grossAmount}
              class="pl-8"
              placeholder={$locale === 'es' ? 'Ingrese el monto del depósito' : 'Enter deposit amount'}
            />
          </div>
        </div>
        
        <div class="space-y-2">
          <Label for="settlementDate">{$locale === 'es' ? 'Fecha de Depósito' : 'Deposit Date'}</Label>
          <Input 
            id="settlementDate"
            type="date"
            bind:value={settlementDate}
          />
        </div>
        
        <div class="space-y-2">
          <Label for="commissionRate">{$locale === 'es' ? 'Tasa de Comisión' : 'Commission Rate'}</Label>
          <div class="relative">
            <Input 
              id="commissionRate"
              type="number" 
              step="0.001"
              min="0"
              max="0.1"
              bind:value={commissionRate}
              class="pr-8"
            />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              ({(commissionRate * 100).toFixed(1)}%)
            </span>
          </div>
        </div>
        
        <div class="space-y-2">
          <Label for="itbisRate">{$locale === 'es' ? 'Retención ITBIS' : 'ITBIS Retention'}</Label>
          <div class="relative">
            <Input 
              id="itbisRate"
              type="number" 
              step="0.001"
              min="0"
              max="0.1"
              bind:value={itbisRetentionRate}
              class="pr-8"
            />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              ({(itbisRetentionRate * 100).toFixed(1)}%)
            </span>
          </div>
        </div>
        
        <div class="space-y-2">
          <Label for="bankAccount">{$locale === 'es' ? 'Cuenta Bancaria' : 'Bank Account'}</Label>
          {#if bankAccounts.length === 0}
            <div class="text-sm text-muted-foreground p-3 border border-dashed rounded-lg">
              {$locale === 'es' 
                ? 'No hay cuentas bancarias registradas. Vaya a Configuración para agregar una.' 
                : 'No bank accounts registered. Go to Settings to add one.'}
            </div>
          {:else}
            <Select.Root onSelectedChange={(s) => { if (s) selectedBankAccountId = String(s.value); }}>
              <Select.Trigger>
                <Select.Value placeholder="Seleccionar cuenta">
                  {bankAccounts.find(a => a.id === selectedBankAccountId)?.accountName || 'Seleccionar cuenta'}
                </Select.Value>
              </Select.Trigger>
              <Select.Content>
                {#each bankAccounts as account}
                  <Select.Item value={account.id}>{account.bankName} - {account.accountName}</Select.Item>
                {/each}
              </Select.Content>
            </Select.Root>
          {/if}
        </div>
        
        <div class="space-y-2">
          <Label for="reference">{$locale === 'es' ? 'Referencia de Depósito' : 'Deposit Reference'}</Label>
          <Input 
            id="reference"
            type="text"
            bind:value={depositReference}
            placeholder="Ej: DEP-001234"
          />
        </div>
      </div>

      <!-- Calculation Summary -->
      <div class="bg-muted/50 rounded-lg p-4 space-y-2">
        <div class="flex justify-between text-sm">
          <span>{$locale === 'es' ? 'Monto Bruto:' : 'Gross Amount:'}</span>
          <span class="font-mono font-bold">${grossAmount.toLocaleString()}</span>
        </div>
        <div class="flex justify-between text-sm text-red-500">
          <span>- Comisión ({(commissionRate * 100).toFixed(1)}%):</span>
          <span class="font-mono">${commissionAmount.toFixed(2)}</span>
        </div>
        <div class="flex justify-between text-sm text-orange-500">
          <span>- Retención ITBIS ({(itbisRetentionRate * 100).toFixed(1)}%):</span>
          <span class="font-mono">${itbisRetentionAmount.toFixed(2)}</span>
        </div>
        <Separator />
        <div class="flex justify-between font-bold">
          <span>{$locale === 'es' ? 'Depósito Neto:' : 'Net Deposit:'}</span>
          <span class="font-mono text-green-500">${netDeposit.toFixed(2)}</span>
        </div>
      </div>
    </div>
    
    <Dialog.Footer>
      <Button variant="ghost" on:click={() => newSettlementDialogOpen = false} disabled={processing}>
        {$locale === 'es' ? 'Cancelar' : 'Cancel'}
      </Button>
      <Button variant="default" on:click={createSettlement} disabled={processing || grossAmount <= 0}>
        {#if processing}
          <span class="animate-spin mr-2">⏳</span>
        {/if}
        {$locale === 'es' ? 'Crear Liquidación' : 'Create Settlement'}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

