<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { 
    FileText, Download, AlertTriangle, CheckCircle2, 
    Calendar, Building2, ShoppingCart, Receipt, 
    ChevronLeft, ChevronRight, RefreshCw, FileCheck
  } from 'lucide-svelte';
  import { 
    generate606Records, generate606Content, download606, get606Summary, validate606Records,
    generate607Records, generate607Content, download607, get607Summary,
    type DGII606Record, type DGII607Record, type ValidationIssue
  } from '$lib/dgii';
  import { getITBISSummary, markPeriodFiled, closePeriod, recalculatePeriodITBIS } from '$lib/itbis';
  import type { ITBISSummary } from '$lib/types';
  import * as Card from '$lib/components/ui/card';
  import * as Tabs from '$lib/components/ui/tabs';
  import * as Table from '$lib/components/ui/table';
  import * as Dialog from '$lib/components/ui/dialog';
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
  
  // Tab state
  let activeTab = '606';
  
  // Data
  let records606: DGII606Record[] = [];
  let records607: DGII607Record[] = [];
  let summary606: Awaited<ReturnType<typeof get606Summary>> | null = null;
  let summary607: Awaited<ReturnType<typeof get607Summary>> | null = null;
  let itbisSummary: ITBISSummary | null = null;
  let validationIssues606: Map<number, ValidationIssue[]> = new Map();
  
  // Loading states
  let loading = false;
  let downloading = false;
  
  // File confirmation dialog
  let confirmDialogOpen = false;
  let confirmationType: '606' | '607' = '606';
  let dgiiConfirmationNumber = '';

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

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    if (!browser) return;
    loading = true;
    
    try {
      const period = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
      
      // Load both formats in parallel
      const [r606, r607, s606, s607] = await Promise.all([
        generate606Records(selectedMonth, selectedYear),
        generate607Records(selectedMonth, selectedYear),
        get606Summary(selectedMonth, selectedYear),
        get607Summary(selectedMonth, selectedYear)
      ]);
      
      records606 = r606;
      records607 = r607;
      summary606 = s606;
      summary607 = s607;
      
      // Always recalculate ITBIS summary from source data to ensure accuracy
      // This also creates the summary if it doesn't exist
      itbisSummary = await recalculatePeriodITBIS(period);
      
      // Validate 606 records
      validationIssues606 = validate606Records(records606);
    } catch (e) {
      console.error('Error loading DGII data:', e);
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

  async function handleDownload606() {
    downloading = true;
    try {
      const content = await generate606Content(selectedMonth, selectedYear);
      download606(content, selectedMonth, selectedYear);
    } finally {
      downloading = false;
    }
  }

  async function handleDownload607() {
    downloading = true;
    try {
      const content = await generate607Content(selectedMonth, selectedYear);
      download607(content, selectedMonth, selectedYear);
    } finally {
      downloading = false;
    }
  }

  function openConfirmDialog(type: '606' | '607') {
    confirmationType = type;
    dgiiConfirmationNumber = '';
    confirmDialogOpen = true;
  }

  async function markAsFiled() {
    const period = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
    await markPeriodFiled(period, dgiiConfirmationNumber || undefined);
    confirmDialogOpen = false;
    await loadData();
  }

  function hasErrors(): boolean {
    for (const issues of validationIssues606.values()) {
      if (issues.some(i => i.severity === 'error')) return true;
    }
    return false;
  }

  function getErrorCount(): number {
    let count = 0;
    for (const issues of validationIssues606.values()) {
      count += issues.filter(i => i.severity === 'error').length;
    }
    return count;
  }

  function getWarningCount(): number {
    let count = 0;
    for (const issues of validationIssues606.values()) {
      count += issues.filter(i => i.severity === 'warning').length;
    }
    return count;
  }

  $: periodLabel = `${months.find(m => m.value === selectedMonth)?.label} ${selectedYear}`;
</script>

<div class="p-6 max-w-7xl mx-auto">
  <!-- Header -->
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
    <div>
      <h1 class="text-3xl font-bold tracking-tight flex items-center gap-3">
        <FileText class="text-primary" size={32} />
        {$locale === 'es' ? 'Reportes DGII' : 'DGII Tax Reports'}
      </h1>
      <p class="text-muted-foreground mt-1">
        {$locale === 'es' ? 'Genera y descarga los formatos 606 y 607 para declaración mensual' : 'Generate and download 606 and 607 formats for monthly tax filing'}
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

  <!-- ITBIS Summary Card -->
  {#if itbisSummary}
    <Card.Root class="mb-6 border-primary/30 bg-primary/5">
      <Card.Content class="p-6">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-bold text-lg flex items-center gap-2">
            <Receipt size={20} class="text-primary" />
            {$locale === 'es' ? 'Resumen ITBIS del Período' : 'Period ITBIS Summary'}
          </h3>
          <Badge variant={itbisSummary.status === 'filed' ? 'default' : itbisSummary.status === 'closed' ? 'secondary' : 'outline'}>
            {itbisSummary.status === 'filed' ? 'Declarado' : itbisSummary.status === 'closed' ? 'Cerrado' : 'Abierto'}
          </Badge>
        </div>
        
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div class="bg-background/50 rounded-lg p-4">
            <div class="text-xs uppercase text-muted-foreground mb-1">ITBIS Cobrado</div>
            <div class="text-2xl font-bold text-green-500">${itbisSummary.totalItbisCollected.toLocaleString()}</div>
            <div class="text-xs text-muted-foreground mt-1">
              18%: ${itbisSummary.itbis18Collected.toFixed(2)} | 16%: ${itbisSummary.itbis16Collected.toFixed(2)}
            </div>
          </div>
          
          <div class="bg-background/50 rounded-lg p-4">
            <div class="text-xs uppercase text-muted-foreground mb-1">ITBIS Pagado</div>
            <div class="text-2xl font-bold text-blue-500">${itbisSummary.totalItbisPaid.toLocaleString()}</div>
            <div class="text-xs text-muted-foreground mt-1">
              18%: ${itbisSummary.itbis18Paid.toFixed(2)} | 16%: ${itbisSummary.itbis16Paid.toFixed(2)}
            </div>
          </div>
          
          <div class="bg-background/50 rounded-lg p-4">
            <div class="text-xs uppercase text-muted-foreground mb-1">ITBIS Retenido</div>
            <div class="text-2xl font-bold text-orange-500">${itbisSummary.totalItbisRetained.toLocaleString()}</div>
            <div class="text-xs text-muted-foreground mt-1">
              Tarjetas: ${itbisSummary.itbisRetainedByCards.toFixed(2)}
            </div>
          </div>
          
          <div class="bg-background/50 rounded-lg p-4 border-2 {itbisSummary.netItbisDue >= 0 ? 'border-destructive/50' : 'border-green-500/50'}">
            <div class="text-xs uppercase text-muted-foreground mb-1">Neto a Pagar DGII</div>
            <div class="text-2xl font-bold {itbisSummary.netItbisDue >= 0 ? 'text-destructive' : 'text-green-500'}">
              ${Math.abs(itbisSummary.netItbisDue).toLocaleString()}
              {itbisSummary.netItbisDue < 0 ? ' (Crédito)' : ''}
            </div>
            <div class="text-xs text-muted-foreground mt-1">
              Cobrado - Pagado - Retenido
            </div>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  {/if}

  <!-- Report Tabs -->
  <Tabs.Root bind:value={activeTab}>
    <Tabs.List class="bg-card border border-border h-12 p-1 rounded-xl gap-1 mb-6">
      <Tabs.Trigger 
        value="606" 
        class="rounded-lg px-6 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
      >
        <Building2 size={16} />
        606 - Compras
        {#if records606.length > 0}
          <Badge variant="secondary" class="ml-2">{records606.length}</Badge>
        {/if}
      </Tabs.Trigger>
      <Tabs.Trigger 
        value="607" 
        class="rounded-lg px-6 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
      >
        <ShoppingCart size={16} />
        607 - Ventas
        {#if records607.length > 0}
          <Badge variant="secondary" class="ml-2">{records607.length}</Badge>
        {/if}
      </Tabs.Trigger>
    </Tabs.List>

    <!-- 606 Tab Content -->
    <Tabs.Content value="606" class="space-y-6">
      <!-- Summary & Actions -->
      <div class="flex flex-col md:flex-row gap-4">
        <!-- Summary Cards -->
        <div class="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card.Root>
            <Card.Content class="p-4">
              <div class="text-xs uppercase text-muted-foreground mb-1">Registros</div>
              <div class="text-2xl font-bold">{summary606?.recordCount ?? 0}</div>
            </Card.Content>
          </Card.Root>
          <Card.Root>
            <Card.Content class="p-4">
              <div class="text-xs uppercase text-muted-foreground mb-1">Total Facturado</div>
              <div class="text-2xl font-bold">${(summary606?.totalFacturado ?? 0).toLocaleString()}</div>
            </Card.Content>
          </Card.Root>
          <Card.Root>
            <Card.Content class="p-4">
              <div class="text-xs uppercase text-muted-foreground mb-1">ITBIS 18%</div>
              <div class="text-2xl font-bold">${(summary606?.totalItbis18 ?? 0).toLocaleString()}</div>
            </Card.Content>
          </Card.Root>
          <Card.Root>
            <Card.Content class="p-4">
              <div class="text-xs uppercase text-muted-foreground mb-1">ITBIS 16%</div>
              <div class="text-2xl font-bold">${(summary606?.totalItbis16 ?? 0).toLocaleString()}</div>
            </Card.Content>
          </Card.Root>
        </div>
        
        <!-- Download Button -->
        <Card.Root class="md:w-64">
          <Card.Content class="p-4 flex flex-col justify-center h-full gap-2">
            {#if hasErrors()}
              <div class="flex items-center gap-2 text-destructive text-sm mb-2">
                <AlertTriangle size={16} />
                {getErrorCount()} errores, {getWarningCount()} advertencias
              </div>
            {:else if validationIssues606.size > 0}
              <div class="flex items-center gap-2 text-yellow-500 text-sm mb-2">
                <AlertTriangle size={16} />
                {getWarningCount()} advertencias
              </div>
            {:else if records606.length > 0}
              <div class="flex items-center gap-2 text-green-500 text-sm mb-2">
                <CheckCircle2 size={16} />
                Listo para descargar
              </div>
            {/if}
            <Button 
              variant="default" 
              class="w-full gap-2" 
              on:click={handleDownload606}
              disabled={downloading || records606.length === 0 || hasErrors()}
            >
              <Download size={16} />
              Descargar 606.txt
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              class="w-full gap-2" 
              on:click={() => openConfirmDialog('606')}
              disabled={records606.length === 0}
            >
              <FileCheck size={14} />
              Marcar como Declarado
            </Button>
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Records Table -->
      <Card.Root>
        <Card.Content class="p-0">
          <div class="max-h-[500px] overflow-auto">
            <Table.Root>
              <Table.Header class="bg-muted/50 sticky top-0">
                <Table.Row>
                  <Table.Head class="text-xs uppercase w-8">#</Table.Head>
                  <Table.Head class="text-xs uppercase">RNC/Cédula</Table.Head>
                  <Table.Head class="text-xs uppercase">NCF</Table.Head>
                  <Table.Head class="text-xs uppercase">Fecha</Table.Head>
                  <Table.Head class="text-xs uppercase text-right">Bienes</Table.Head>
                  <Table.Head class="text-xs uppercase text-right">Servicios</Table.Head>
                  <Table.Head class="text-xs uppercase text-right">Total</Table.Head>
                  <Table.Head class="text-xs uppercase text-right">ITBIS 18%</Table.Head>
                  <Table.Head class="text-xs uppercase text-right">ITBIS 16%</Table.Head>
                  <Table.Head class="text-xs uppercase text-center">Estado</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each records606 as record, i}
                  {@const issues = validationIssues606.get(i) || []}
                  {@const hasError = issues.some(i => i.severity === 'error')}
                  {@const hasWarning = issues.some(i => i.severity === 'warning')}
                  <Table.Row class={hasError ? 'bg-destructive/5' : hasWarning ? 'bg-yellow-500/5' : ''}>
                    <Table.Cell class="font-mono text-muted-foreground">{i + 1}</Table.Cell>
                    <Table.Cell class="font-mono text-sm">{record.RNC_Cedula}</Table.Cell>
                    <Table.Cell class="font-mono text-sm">{record.NCF}</Table.Cell>
                    <Table.Cell class="font-mono text-sm">
                      {record.Fecha_Comprobante.slice(0, 4)}-{record.Fecha_Comprobante.slice(4, 6)}-{record.Fecha_Comprobante.slice(6, 8)}
                    </Table.Cell>
                    <Table.Cell class="text-right font-mono">${record.Monto_Facturado_Bienes.toFixed(2)}</Table.Cell>
                    <Table.Cell class="text-right font-mono">${record.Monto_Facturado_Servicios.toFixed(2)}</Table.Cell>
                    <Table.Cell class="text-right font-mono font-bold">${record.Total_Monto_Facturado.toFixed(2)}</Table.Cell>
                    <Table.Cell class="text-right font-mono">${record.ITBIS_Facturado_18.toFixed(2)}</Table.Cell>
                    <Table.Cell class="text-right font-mono">${record.ITBIS_Facturado_16.toFixed(2)}</Table.Cell>
                    <Table.Cell class="text-center">
                      {#if hasError}
                        <Badge variant="destructive">Error</Badge>
                      {:else if hasWarning}
                        <Badge variant="outline" class="text-yellow-500 border-yellow-500">Advertencia</Badge>
                      {:else}
                        <Badge variant="outline" class="text-green-500 border-green-500">OK</Badge>
                      {/if}
                    </Table.Cell>
                  </Table.Row>
                {:else}
                  <Table.Row>
                    <Table.Cell colspan={10} class="h-32 text-center text-muted-foreground">
                      {loading ? 'Cargando...' : 'No hay compras para este período'}
                    </Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </div>
        </Card.Content>
      </Card.Root>
    </Tabs.Content>

    <!-- 607 Tab Content -->
    <Tabs.Content value="607" class="space-y-6">
      <!-- Summary & Actions -->
      <div class="flex flex-col md:flex-row gap-4">
        <!-- Summary Cards -->
        <div class="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card.Root>
            <Card.Content class="p-4">
              <div class="text-xs uppercase text-muted-foreground mb-1">Registros</div>
              <div class="text-2xl font-bold">{summary607?.recordCount ?? 0}</div>
            </Card.Content>
          </Card.Root>
          <Card.Root>
            <Card.Content class="p-4">
              <div class="text-xs uppercase text-muted-foreground mb-1">Total Facturado</div>
              <div class="text-2xl font-bold">${(summary607?.totalFacturado ?? 0).toLocaleString()}</div>
            </Card.Content>
          </Card.Root>
          <Card.Root>
            <Card.Content class="p-4">
              <div class="text-xs uppercase text-muted-foreground mb-1">ITBIS Total</div>
              <div class="text-2xl font-bold">${(summary607?.totalItbis ?? 0).toLocaleString()}</div>
            </Card.Content>
          </Card.Root>
          <Card.Root>
            <Card.Content class="p-4">
              <div class="text-xs uppercase text-muted-foreground mb-1">Efectivo</div>
              <div class="text-2xl font-bold text-green-500">${(summary607?.totalEfectivo ?? 0).toLocaleString()}</div>
            </Card.Content>
          </Card.Root>
        </div>
        
        <!-- Download Button -->
        <Card.Root class="md:w-64">
          <Card.Content class="p-4 flex flex-col justify-center h-full gap-2">
            {#if records607.length > 0}
              <div class="flex items-center gap-2 text-green-500 text-sm mb-2">
                <CheckCircle2 size={16} />
                Listo para descargar
              </div>
            {/if}
            <Button 
              variant="default" 
              class="w-full gap-2" 
              on:click={handleDownload607}
              disabled={downloading || records607.length === 0}
            >
              <Download size={16} />
              Descargar 607.txt
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              class="w-full gap-2" 
              on:click={() => openConfirmDialog('607')}
              disabled={records607.length === 0}
            >
              <FileCheck size={14} />
              Marcar como Declarado
            </Button>
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Records Table -->
      <Card.Root>
        <Card.Content class="p-0">
          <div class="max-h-[500px] overflow-auto">
            <Table.Root>
              <Table.Header class="bg-muted/50 sticky top-0">
                <Table.Row>
                  <Table.Head class="text-xs uppercase w-8">#</Table.Head>
                  <Table.Head class="text-xs uppercase">RNC/Cédula</Table.Head>
                  <Table.Head class="text-xs uppercase">Fecha</Table.Head>
                  <Table.Head class="text-xs uppercase text-right">Bienes</Table.Head>
                  <Table.Head class="text-xs uppercase text-right">Total</Table.Head>
                  <Table.Head class="text-xs uppercase text-right">ITBIS 18%</Table.Head>
                  <Table.Head class="text-xs uppercase text-right">Efectivo</Table.Head>
                  <Table.Head class="text-xs uppercase text-right">Tarjeta</Table.Head>
                  <Table.Head class="text-xs uppercase text-right">Crédito</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each records607 as record, i}
                  <Table.Row>
                    <Table.Cell class="font-mono text-muted-foreground">{i + 1}</Table.Cell>
                    <Table.Cell class="font-mono text-sm">
                      {record.RNC_Cedula || '(Consumidor Final)'}
                    </Table.Cell>
                    <Table.Cell class="font-mono text-sm">
                      {record.Fecha_Comprobante.slice(0, 4)}-{record.Fecha_Comprobante.slice(4, 6)}-{record.Fecha_Comprobante.slice(6, 8)}
                    </Table.Cell>
                    <Table.Cell class="text-right font-mono">${record.Monto_Facturado_Bienes.toFixed(2)}</Table.Cell>
                    <Table.Cell class="text-right font-mono font-bold">${record.Total_Monto_Facturado.toFixed(2)}</Table.Cell>
                    <Table.Cell class="text-right font-mono">${record.ITBIS_Facturado_18.toFixed(2)}</Table.Cell>
                    <Table.Cell class="text-right font-mono text-green-500">${record.Efectivo.toFixed(2)}</Table.Cell>
                    <Table.Cell class="text-right font-mono text-blue-500">${record.Tarjeta.toFixed(2)}</Table.Cell>
                    <Table.Cell class="text-right font-mono text-yellow-500">${record.Credito.toFixed(2)}</Table.Cell>
                  </Table.Row>
                {:else}
                  <Table.Row>
                    <Table.Cell colspan={9} class="h-32 text-center text-muted-foreground">
                      {loading ? 'Cargando...' : 'No hay ventas para este período'}
                    </Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
          </div>
        </Card.Content>
      </Card.Root>
    </Tabs.Content>
  </Tabs.Root>
</div>

<!-- Confirmation Dialog -->
<Dialog.Root bind:open={confirmDialogOpen}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <FileCheck size={20} class="text-primary" />
        Marcar Formato {confirmationType} como Declarado
      </Dialog.Title>
      <Dialog.Description>
        Confirma que has subido el archivo a la DGII y registra el número de confirmación (opcional).
      </Dialog.Description>
    </Dialog.Header>
    
    <div class="py-4 space-y-4">
      <div class="bg-muted/50 rounded-lg p-4">
        <div class="text-sm text-muted-foreground mb-1">Período</div>
        <div class="font-bold">{periodLabel}</div>
      </div>
      
      <div class="space-y-2">
        <Label for="confirmation">Número de Confirmación DGII (opcional)</Label>
        <Input 
          id="confirmation"
          type="text"
          bind:value={dgiiConfirmationNumber}
          placeholder="Ej: 2024-001234567"
        />
      </div>
    </div>
    
    <Dialog.Footer>
      <Button variant="ghost" on:click={() => confirmDialogOpen = false}>
        Cancelar
      </Button>
      <Button variant="default" on:click={markAsFiled}>
        Confirmar Declaración
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

