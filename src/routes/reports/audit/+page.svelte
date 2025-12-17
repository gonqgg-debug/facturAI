<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { getAuditLog, type AuditFilters } from '$lib/accounting-audit';
  import type { AccountingAuditEntry, AuditAction } from '$lib/types';
  import { Button } from '$lib/components/ui/button';
  import * as Select from '$lib/components/ui/select';
  import { Input } from '$lib/components/ui/input';
  import { Badge } from '$lib/components/ui/badge';

  const actions: AuditAction[] = [
    'journal_entry_created',
    'journal_entry_voided',
    'ncf_issued',
    'ncf_voided',
    'period_closed',
    'period_reopened',
    'itbis_recalculated',
    'settlement_created',
    'fifo_lot_created',
    'fifo_consumption'
  ];

  const entityTypes: AccountingAuditEntry['entityType'][] = ['journal_entry', 'ncf', 'itbis_period', 'settlement', 'fifo_lot'];

  let records: AccountingAuditEntry[] = [];
  let loading = false;

  let filters: AuditFilters = {
    startDate: '',
    endDate: '',
    actions: [],
    entityType: undefined
  };

  async function loadData() {
    if (!browser) return;
    loading = true;
    try {
      records = await getAuditLog(filters);
    } catch (e) {
      console.error('Failed to load audit log', e);
      alert('No se pudo cargar el registro de auditoría.');
    } finally {
      loading = false;
    }
  }

  function toggleAction(action: AuditAction) {
    const set = new Set(filters.actions || []);
    if (set.has(action)) set.delete(action);
    else set.add(action);
    filters.actions = [...set];
  }

  function handleEntityTypeChange(v: { value: string } | undefined) {
    filters.entityType = (v?.value || undefined) as AccountingAuditEntry['entityType'];
  }

  onMount(loadData);
</script>

<div class="p-6 max-w-6xl mx-auto space-y-6">
  <div class="flex items-center justify-between flex-wrap gap-3">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">Auditoría Contable</h1>
      <p class="text-muted-foreground">Historial de acciones contables</p>
    </div>
    <Button variant="ghost" size="sm" on:click={loadData} disabled={loading}>
      {loading ? 'Cargando...' : 'Refrescar'}
    </Button>
  </div>

  <div class="grid md:grid-cols-4 gap-3 border rounded-lg p-4 bg-muted/30">
    <div class="space-y-1">
      <label class="text-xs uppercase text-muted-foreground">Desde</label>
      <Input type="date" bind:value={filters.startDate} />
    </div>
    <div class="space-y-1">
      <label class="text-xs uppercase text-muted-foreground">Hasta</label>
      <Input type="date" bind:value={filters.endDate} />
    </div>
    <div class="space-y-1">
      <label class="text-xs uppercase text-muted-foreground">Entidad</label>
      <Select.Root onSelectedChange={handleEntityTypeChange} value={filters.entityType ? { value: filters.entityType, label: filters.entityType } : null}>
        <Select.Trigger><Select.Value placeholder="Todas" /></Select.Trigger>
        <Select.Content>
          <Select.Item value="">Todas</Select.Item>
          {#each entityTypes as type}
            <Select.Item value={type}>{type}</Select.Item>
          {/each}
        </Select.Content>
      </Select.Root>
    </div>
    <div class="space-y-1">
      <label class="text-xs uppercase text-muted-foreground">Acciones</label>
      <div class="flex flex-wrap gap-1">
        {#each actions as action}
          <Badge
            on:click={() => toggleAction(action)}
            class="cursor-pointer"
            variant={(filters.actions || []).includes(action) ? 'default' : 'outline'}>
            {action}
          </Badge>
        {/each}
      </div>
    </div>
    <div class="md:col-span-4 flex justify-end">
      <Button on:click={loadData} disabled={loading}>Aplicar Filtros</Button>
    </div>
  </div>

  <div class="border rounded-lg overflow-auto">
    <table class="min-w-full text-sm">
      <thead class="bg-muted/50">
        <tr>
          <th class="px-3 py-2 text-left">Fecha</th>
          <th class="px-3 py-2 text-left">Acción</th>
          <th class="px-3 py-2 text-left">Entidad</th>
          <th class="px-3 py-2 text-left">Usuario</th>
          <th class="px-3 py-2 text-left">Detalles</th>
        </tr>
      </thead>
      <tbody>
        {#if records.length === 0}
          <tr>
            <td colspan="5" class="px-3 py-4 text-center text-muted-foreground">Sin registros</td>
          </tr>
        {:else}
          {#each records as r}
            <tr class="border-t">
              <td class="px-3 py-2">{new Date(r.timestamp).toLocaleString()}</td>
              <td class="px-3 py-2"><Badge variant="outline">{r.action}</Badge></td>
              <td class="px-3 py-2">{r.entityType} · {r.entityId}</td>
              <td class="px-3 py-2">{r.userName || '-'}</td>
              <td class="px-3 py-2">
                <details class="text-xs">
                  <summary class="cursor-pointer text-blue-600">Ver</summary>
                  <pre class="mt-1 bg-muted/50 p-2 rounded overflow-auto">{JSON.stringify(r.details, null, 2)}</pre>
                  {#if r.previousState}
                    <div class="mt-1 text-muted-foreground">Previo:</div>
                    <pre class="mt-1 bg-muted/30 p-2 rounded overflow-auto">{JSON.stringify(r.previousState, null, 2)}</pre>
                  {/if}
                </details>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>
</div>

