<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { db } from '$lib/db';
  import { 
    BookOpen, Calendar, Filter, ChevronLeft, ChevronRight, 
    RefreshCw, Eye, XCircle, ArrowUpRight, ArrowDownRight,
    FileText, ShoppingCart, Package, CreditCard, Receipt
  } from 'lucide-svelte';
  import type { JournalEntry, JournalEntryLine, AccountCode } from '$lib/types';
  import { ACCOUNT_NAMES } from '$lib/types';
  import { getJournalEntriesForPeriod, getTrialBalance, voidJournalEntry } from '$lib/journal';
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

  // Period selection
  let selectedYear = new Date().getFullYear();
  let selectedMonth = new Date().getMonth() + 1;
  
  // Filters
  let sourceTypeFilter: string = 'all';
  let statusFilter: string = 'posted';
  
  // Data
  let entries: JournalEntry[] = [];
  let trialBalance: Map<AccountCode, { debit: number; credit: number; balance: number }> = new Map();
  let loading = false;
  
  // Entry detail dialog
  let selectedEntry: JournalEntry | null = null;
  let entryDetailDialogOpen = false;
  
  // Void dialog
  let voidDialogOpen = false;
  let voidReason = '';
  let voiding = false;

  const months = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
  ];

  const sourceTypes = [
    { value: 'all', label: 'Todos' },
    { value: 'sale', label: 'Ventas' },
    { value: 'purchase', label: 'Compras' },
    { value: 'shift_close', label: 'Cierre de Turno' },
    { value: 'adjustment', label: 'Ajustes' },
    { value: 'card_settlement', label: 'Liquidación Tarjetas' },
    { value: 'return', label: 'Devoluciones' },
    { value: 'manual', label: 'Manual' }
  ];

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    if (!browser) return;
    loading = true;
    
    try {
      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
      const endDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${lastDay}`;
      
      // Load journal entries
      const allEntries = await getJournalEntriesForPeriod(startDate, endDate);
      
      // Apply filters
      entries = allEntries.filter(entry => {
        if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
        if (sourceTypeFilter !== 'all' && entry.sourceType !== sourceTypeFilter) return false;
        return true;
      });
      
      // Sort by date descending, then by entry number
      entries.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return b.entryNumber.localeCompare(a.entryNumber);
      });
      
      // Load trial balance
      trialBalance = await getTrialBalance(startDate, endDate);
      
    } catch (e) {
      console.error('Error loading journal data:', e);
    } finally {
      loading = false;
    }
  }

  function navigatePeriod(delta: number) {
    let newMonth = selectedMonth + delta;
    let newYear = selectedYear;
    
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    
    selectedMonth = newMonth;
    selectedYear = newYear;
    loadData();
  }

  function openEntryDetail(entry: JournalEntry) {
    selectedEntry = entry;
    entryDetailDialogOpen = true;
  }

  function openVoidDialog(entry: JournalEntry) {
    selectedEntry = entry;
    voidReason = '';
    voidDialogOpen = true;
  }

  async function handleVoidEntry() {
    if (!selectedEntry?.id || !voidReason.trim()) return;
    voiding = true;
    
    try {
      await voidJournalEntry(selectedEntry.id, voidReason);
      voidDialogOpen = false;
      await loadData();
    } catch (e) {
      console.error('Error voiding entry:', e);
      alert('Error al anular el asiento');
    } finally {
      voiding = false;
    }
  }

  function getSourceIcon(sourceType: JournalEntry['sourceType']) {
    switch (sourceType) {
      case 'sale': return ShoppingCart;
      case 'purchase': return FileText;
      case 'adjustment': return Package;
      case 'card_settlement': return CreditCard;
      case 'shift_close': return Receipt;
      default: return BookOpen;
    }
  }

  function getSourceLabel(sourceType: JournalEntry['sourceType']): string {
    const labels: Record<JournalEntry['sourceType'], string> = {
      'sale': 'Venta',
      'purchase': 'Compra',
      'adjustment': 'Ajuste',
      'card_settlement': 'Tarjetas',
      'shift_close': 'Cierre',
      'return': 'Devolución',
      'manual': 'Manual'
    };
    return labels[sourceType] || sourceType;
  }

  // Calculate totals
  $: totalDebits = entries.reduce((sum, e) => sum + e.totalDebit, 0);
  $: totalCredits = entries.reduce((sum, e) => sum + e.totalCredit, 0);
  $: periodLabel = `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`;
  
  // Trial balance totals
  $: tbTotalDebit = [...trialBalance.values()].reduce((sum, b) => sum + b.debit, 0);
  $: tbTotalCredit = [...trialBalance.values()].reduce((sum, b) => sum + b.credit, 0);
</script>

<div class="p-6 max-w-7xl mx-auto">
  <!-- Header -->
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
    <div>
      <h1 class="text-3xl font-bold tracking-tight flex items-center gap-3">
        <BookOpen class="text-primary" size={32} />
        {$locale === 'es' ? 'Libro Contable' : 'Accounting Journal'}
      </h1>
      <p class="text-muted-foreground mt-1">
        {$locale === 'es' ? 'Registro automático de todas las transacciones financieras' : 'Automatic record of all financial transactions'}
      </p>
    </div>
    
    <!-- Period Selector -->
    <div class="flex items-center gap-2 bg-card border border-border rounded-xl p-2">
      <Button variant="ghost" size="icon" on:click={() => navigatePeriod(-1)}>
        <ChevronLeft size={18} />
      </Button>
      
      <div class="flex items-center gap-2 px-3">
        <Calendar size={16} class="text-muted-foreground" />
        <span class="font-medium min-w-[140px] text-center">{periodLabel}</span>
      </div>
      
      <Button variant="ghost" size="icon" on:click={() => navigatePeriod(1)}>
        <ChevronRight size={18} />
      </Button>
      
      <Button variant="ghost" size="icon" on:click={loadData} disabled={loading}>
        <RefreshCw size={16} class={loading ? 'animate-spin' : ''} />
      </Button>
    </div>
  </div>

  <!-- Filters & Summary -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
    <!-- Filters -->
    <Card.Root>
      <Card.Content class="p-4">
        <Label class="text-xs uppercase text-muted-foreground mb-2 block">Tipo de Asiento</Label>
        <Select.Root onSelectedChange={(s) => { sourceTypeFilter = s ? String(s.value) : 'all'; loadData(); }}>
          <Select.Trigger>
            <Select.Value placeholder="Todos">
              {sourceTypes.find(st => st.value === sourceTypeFilter)?.label || 'Todos'}
            </Select.Value>
          </Select.Trigger>
          <Select.Content>
            {#each sourceTypes as type}
              <Select.Item value={type.value}>{type.label}</Select.Item>
            {/each}
          </Select.Content>
        </Select.Root>
      </Card.Content>
    </Card.Root>
    
    <!-- Summary Cards -->
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-xs uppercase text-muted-foreground mb-1">Asientos</div>
        <div class="text-2xl font-bold">{entries.length}</div>
      </Card.Content>
    </Card.Root>
    
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-xs uppercase text-muted-foreground mb-1">Total Débitos</div>
        <div class="text-2xl font-bold text-blue-500 flex items-center gap-1">
          <ArrowUpRight size={18} />
          ${totalDebits.toLocaleString()}
        </div>
      </Card.Content>
    </Card.Root>
    
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-xs uppercase text-muted-foreground mb-1">Total Créditos</div>
        <div class="text-2xl font-bold text-green-500 flex items-center gap-1">
          <ArrowDownRight size={18} />
          ${totalCredits.toLocaleString()}
        </div>
      </Card.Content>
    </Card.Root>
  </div>

  <!-- Journal Entries Table -->
  <Card.Root class="mb-8">
    <Card.Header>
      <Card.Title>Asientos del Período</Card.Title>
    </Card.Header>
    <Card.Content class="p-0">
      <div class="max-h-[500px] overflow-auto">
        <Table.Root>
          <Table.Header class="bg-muted/50 sticky top-0">
            <Table.Row>
              <Table.Head class="text-xs uppercase w-32">Número</Table.Head>
              <Table.Head class="text-xs uppercase">Fecha</Table.Head>
              <Table.Head class="text-xs uppercase">Descripción</Table.Head>
              <Table.Head class="text-xs uppercase text-center">Tipo</Table.Head>
              <Table.Head class="text-xs uppercase text-right">Débito</Table.Head>
              <Table.Head class="text-xs uppercase text-right">Crédito</Table.Head>
              <Table.Head class="text-xs uppercase text-center">Estado</Table.Head>
              <Table.Head class="text-xs uppercase text-center">Acciones</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each entries as entry}
              <Table.Row class={entry.status === 'voided' ? 'opacity-50 line-through' : ''}>
                <Table.Cell class="font-mono text-sm">{entry.entryNumber}</Table.Cell>
                <Table.Cell class="text-sm">{entry.date}</Table.Cell>
                <Table.Cell class="text-sm max-w-xs truncate" title={entry.description}>
                  {entry.description}
                </Table.Cell>
                <Table.Cell class="text-center">
                  <Badge variant="outline" class="gap-1">
                    <svelte:component this={getSourceIcon(entry.sourceType)} size={12} />
                    {getSourceLabel(entry.sourceType)}
                  </Badge>
                </Table.Cell>
                <Table.Cell class="text-right font-mono text-blue-500">${entry.totalDebit.toLocaleString()}</Table.Cell>
                <Table.Cell class="text-right font-mono text-green-500">${entry.totalCredit.toLocaleString()}</Table.Cell>
                <Table.Cell class="text-center">
                  <Badge variant={entry.status === 'posted' ? 'default' : entry.status === 'voided' ? 'destructive' : 'secondary'}>
                    {entry.status === 'posted' ? 'Contabilizado' : entry.status === 'voided' ? 'Anulado' : 'Borrador'}
                  </Badge>
                </Table.Cell>
                <Table.Cell class="text-center">
                  <div class="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="icon" class="h-8 w-8" on:click={() => openEntryDetail(entry)}>
                      <Eye size={14} />
                    </Button>
                    {#if entry.status === 'posted'}
                      <Button variant="ghost" size="icon" class="h-8 w-8 text-destructive" on:click={() => openVoidDialog(entry)}>
                        <XCircle size={14} />
                      </Button>
                    {/if}
                  </div>
                </Table.Cell>
              </Table.Row>
            {:else}
              <Table.Row>
                <Table.Cell colspan={8} class="h-32 text-center text-muted-foreground">
                  {loading ? 'Cargando...' : 'No hay asientos para este período'}
                </Table.Cell>
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </div>
    </Card.Content>
  </Card.Root>

  <!-- Trial Balance -->
  {#if trialBalance.size > 0}
    <Card.Root>
      <Card.Header>
        <Card.Title>Balance de Comprobación</Card.Title>
      </Card.Header>
      <Card.Content class="p-0">
        <Table.Root>
          <Table.Header class="bg-muted/50">
            <Table.Row>
              <Table.Head class="text-xs uppercase">Código</Table.Head>
              <Table.Head class="text-xs uppercase">Cuenta</Table.Head>
              <Table.Head class="text-xs uppercase text-right">Débitos</Table.Head>
              <Table.Head class="text-xs uppercase text-right">Créditos</Table.Head>
              <Table.Head class="text-xs uppercase text-right">Saldo</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each [...trialBalance.entries()] as [code, balance]}
              <Table.Row>
                <Table.Cell class="font-mono">{code}</Table.Cell>
                <Table.Cell>{ACCOUNT_NAMES[code]}</Table.Cell>
                <Table.Cell class="text-right font-mono">${balance.debit.toFixed(2)}</Table.Cell>
                <Table.Cell class="text-right font-mono">${balance.credit.toFixed(2)}</Table.Cell>
                <Table.Cell class="text-right font-mono font-bold {balance.balance >= 0 ? 'text-blue-500' : 'text-green-500'}">
                  ${Math.abs(balance.balance).toFixed(2)}
                </Table.Cell>
              </Table.Row>
            {/each}
            <Table.Row class="bg-muted/30 font-bold">
              <Table.Cell colspan={2}>TOTALES</Table.Cell>
              <Table.Cell class="text-right font-mono">${tbTotalDebit.toFixed(2)}</Table.Cell>
              <Table.Cell class="text-right font-mono">${tbTotalCredit.toFixed(2)}</Table.Cell>
              <Table.Cell class="text-right font-mono {Math.abs(tbTotalDebit - tbTotalCredit) < 0.01 ? 'text-green-500' : 'text-red-500'}">
                {Math.abs(tbTotalDebit - tbTotalCredit) < 0.01 ? '✓ Cuadrado' : 'Descuadre: $' + Math.abs(tbTotalDebit - tbTotalCredit).toFixed(2)}
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Root>
      </Card.Content>
    </Card.Root>
  {/if}
</div>

<!-- Entry Detail Dialog -->
<Dialog.Root bind:open={entryDetailDialogOpen}>
  <Dialog.Content class="max-w-2xl">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <BookOpen size={20} class="text-primary" />
        {selectedEntry?.entryNumber}
      </Dialog.Title>
      <Dialog.Description>
        {selectedEntry?.description}
      </Dialog.Description>
    </Dialog.Header>
    
    {#if selectedEntry}
      <div class="py-4 space-y-4">
        <!-- Entry Info -->
        <div class="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span class="text-muted-foreground">Fecha:</span>
            <span class="font-medium ml-2">{selectedEntry.date}</span>
          </div>
          <div>
            <span class="text-muted-foreground">Tipo:</span>
            <Badge variant="outline" class="ml-2">{getSourceLabel(selectedEntry.sourceType)}</Badge>
          </div>
          <div>
            <span class="text-muted-foreground">Estado:</span>
            <Badge variant={selectedEntry.status === 'posted' ? 'default' : 'destructive'} class="ml-2">
              {selectedEntry.status === 'posted' ? 'Contabilizado' : 'Anulado'}
            </Badge>
          </div>
        </div>
        
        <Separator />
        
        <!-- Entry Lines -->
        <Table.Root>
          <Table.Header class="bg-muted/50">
            <Table.Row>
              <Table.Head class="text-xs uppercase">Código</Table.Head>
              <Table.Head class="text-xs uppercase">Cuenta</Table.Head>
              <Table.Head class="text-xs uppercase">Descripción</Table.Head>
              <Table.Head class="text-xs uppercase text-right">Débito</Table.Head>
              <Table.Head class="text-xs uppercase text-right">Crédito</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each selectedEntry.lines as line}
              <Table.Row>
                <Table.Cell class="font-mono">{line.accountCode}</Table.Cell>
                <Table.Cell>{line.accountName}</Table.Cell>
                <Table.Cell class="text-sm text-muted-foreground">{line.description || '-'}</Table.Cell>
                <Table.Cell class="text-right font-mono {line.debit > 0 ? 'text-blue-500 font-bold' : ''}">
                  {line.debit > 0 ? `$${line.debit.toFixed(2)}` : '-'}
                </Table.Cell>
                <Table.Cell class="text-right font-mono {line.credit > 0 ? 'text-green-500 font-bold' : ''}">
                  {line.credit > 0 ? `$${line.credit.toFixed(2)}` : '-'}
                </Table.Cell>
              </Table.Row>
            {/each}
            <Table.Row class="bg-muted/30 font-bold">
              <Table.Cell colspan={3}>TOTAL</Table.Cell>
              <Table.Cell class="text-right font-mono">${selectedEntry.totalDebit.toFixed(2)}</Table.Cell>
              <Table.Cell class="text-right font-mono">${selectedEntry.totalCredit.toFixed(2)}</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Root>
        
        {#if selectedEntry.status === 'voided' && selectedEntry.voidReason}
          <div class="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
            <div class="text-sm font-medium text-destructive mb-1">Motivo de Anulación:</div>
            <div class="text-sm">{selectedEntry.voidReason}</div>
          </div>
        {/if}
      </div>
    {/if}
    
    <Dialog.Footer>
      <Button variant="ghost" on:click={() => entryDetailDialogOpen = false}>
        Cerrar
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Void Entry Dialog -->
<Dialog.Root bind:open={voidDialogOpen}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2 text-destructive">
        <XCircle size={20} />
        Anular Asiento
      </Dialog.Title>
      <Dialog.Description>
        Esta acción creará un asiento de reversión. El asiento original quedará marcado como anulado.
      </Dialog.Description>
    </Dialog.Header>
    
    <div class="py-4">
      <div class="bg-muted/50 rounded-lg p-4 mb-4">
        <div class="font-mono text-sm">{selectedEntry?.entryNumber}</div>
        <div class="text-sm text-muted-foreground">{selectedEntry?.description}</div>
        <div class="text-lg font-bold mt-2">${selectedEntry?.totalDebit.toFixed(2)}</div>
      </div>
      
      <div class="space-y-2">
        <Label for="voidReason">Motivo de Anulación *</Label>
        <Input 
          id="voidReason"
          type="text"
          bind:value={voidReason}
          placeholder="Ej: Error de registro, duplicado, etc."
        />
      </div>
    </div>
    
    <Dialog.Footer>
      <Button variant="ghost" on:click={() => voidDialogOpen = false} disabled={voiding}>
        Cancelar
      </Button>
      <Button variant="destructive" on:click={handleVoidEntry} disabled={voiding || !voidReason.trim()}>
        {#if voiding}
          <span class="animate-spin mr-2">⏳</span>
        {/if}
        Anular Asiento
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

