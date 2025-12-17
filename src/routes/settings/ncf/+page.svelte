<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { db } from '$lib/db';
  import { addNCFRange, getNCFRangeStatus } from '$lib/ncf';
  import type { NCFRange, NCFUsage, NCFType } from '$lib/types';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import { AlertCircle } from 'lucide-svelte';

  const ncfTypes: NCFType[] = ['B01', 'B02', 'B03', 'B04', 'B11', 'B13', 'B14', 'B15'];

  let ranges: Array<NCFRange & { remaining: number }> = [];
  let usage: NCFUsage[] = [];
  let loading = false;
  let saving = false;

  function handleTypeChange(v: { value: string } | undefined) {
    form.type = (v?.value ?? 'B02') as NCFType;
  }

  let form: Partial<NCFRange> = {
    type: 'B02',
    prefix: 'B02',
    startNumber: 1,
    endNumber: 1000,
    currentNumber: 1,
    expirationDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
    isActive: true
  };

  async function loadData() {
    if (!browser) return;
    loading = true;
    try {
      ranges = await getNCFRangeStatus();
      usage = await db.ncfUsage.orderBy('issuedAt').reverse().limit(50).toArray();
    } catch (e) {
      console.error('Error loading NCF data', e);
      alert('No se pudieron cargar los NCF.');
    } finally {
      loading = false;
    }
  }

  async function saveRange() {
    if (!form.type || !form.prefix || !form.startNumber || !form.endNumber) return;
    saving = true;
    try {
      await addNCFRange({
        type: form.type,
        prefix: form.prefix,
        startNumber: Number(form.startNumber),
        endNumber: Number(form.endNumber),
        currentNumber: Number(form.currentNumber ?? form.startNumber),
        expirationDate: form.expirationDate!,
        isActive: form.isActive ?? true,
        createdAt: new Date()
      });
      await loadData();
    } catch (e) {
      console.error('Error creating NCF range', e);
      alert('No se pudo crear el rango de NCF.');
    } finally {
      saving = false;
    }
  }

  onMount(loadData);
</script>

<div class="p-6 max-w-5xl mx-auto space-y-6">
  <div class="flex items-center justify-between flex-wrap gap-3">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">NCF</h1>
      <p class="text-muted-foreground">Gestiona rangos y uso de NCF</p>
    </div>
    {#if ranges.some(r => r.remaining < 100)}
      <div class="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
        <AlertCircle size={16} />
        <span class="text-sm">Quedan pocos NCF en un rango activo</span>
      </div>
    {/if}
  </div>

  <div class="grid md:grid-cols-2 gap-4">
    <div class="border rounded-lg p-4 space-y-3">
      <h2 class="font-semibold">Nuevo Rango</h2>
      <div class="grid grid-cols-2 gap-3">
        <div class="col-span-2 space-y-1">
          <label class="text-xs uppercase text-muted-foreground">Tipo</label>
          <Select.Root
            onSelectedChange={handleTypeChange}
            value={{ value: form.type ?? 'B02', label: form.type ?? 'B02' }}>
            <Select.Trigger><Select.Value placeholder="Tipo" /></Select.Trigger>
            <Select.Content>
              {#each ncfTypes as type}
                <Select.Item value={type}>{type}</Select.Item>
              {/each}
            </Select.Content>
          </Select.Root>
        </div>
        <div class="space-y-1">
          <label class="text-xs uppercase text-muted-foreground">Prefijo</label>
          <Input bind:value={form.prefix} />
        </div>
        <div class="space-y-1">
          <label class="text-xs uppercase text-muted-foreground">Expira</label>
          <Input type="date" bind:value={form.expirationDate} />
        </div>
        <div class="space-y-1">
          <label class="text-xs uppercase text-muted-foreground">Inicio</label>
          <Input type="number" min="1" bind:value={form.startNumber} />
        </div>
        <div class="space-y-1">
          <label class="text-xs uppercase text-muted-foreground">Fin</label>
          <Input type="number" min="{form.startNumber ?? 1}" bind:value={form.endNumber} />
        </div>
        <div class="space-y-1">
          <label class="text-xs uppercase text-muted-foreground">Próximo</label>
          <Input type="number" min="{form.startNumber ?? 1}" bind:value={form.currentNumber} />
        </div>
        <div class="space-y-1 flex items-end">
          <Button class="w-full" on:click={saveRange} disabled={saving}>
            {saving ? 'Guardando...' : 'Crear Rango'}
          </Button>
        </div>
      </div>
    </div>

    <div class="border rounded-lg p-4">
      <div class="flex items-center justify-between mb-2">
        <h2 class="font-semibold">Rangos Activos</h2>
        <Button variant="ghost" size="sm" on:click={loadData} disabled={loading}>Refrescar</Button>
      </div>
      <div class="space-y-2 max-h-80 overflow-auto">
        {#if ranges.length === 0}
          <div class="text-sm text-muted-foreground">No hay rangos configurados.</div>
        {:else}
          {#each ranges as range}
            <div class="border rounded p-3 flex justify-between items-center">
              <div>
                <div class="font-semibold">{range.type} - {range.prefix}</div>
                <div class="text-xs text-muted-foreground">#{range.currentNumber} de {range.endNumber} · Expira {range.expirationDate}</div>
              </div>
              <div class="text-sm font-semibold">{range.remaining} restantes</div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>

  <div class="border rounded-lg p-4">
    <div class="flex items-center justify-between mb-2">
      <h2 class="font-semibold">Últimos NCF emitidos</h2>
      <span class="text-xs text-muted-foreground">Mostrando 50 más recientes</span>
    </div>
    <div class="overflow-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-muted/50">
          <tr>
            <th class="px-3 py-2 text-left">NCF</th>
            <th class="px-3 py-2 text-left">Tipo</th>
            <th class="px-3 py-2 text-left">Venta</th>
            <th class="px-3 py-2 text-left">Fecha</th>
            <th class="px-3 py-2 text-right">Monto</th>
            <th class="px-3 py-2 text-left">Estado</th>
          </tr>
        </thead>
        <tbody>
          {#if usage.length === 0}
            <tr>
              <td colspan="6" class="px-3 py-4 text-center text-muted-foreground">Sin NCF emitidos</td>
            </tr>
          {:else}
            {#each usage as u}
              <tr class="border-t">
                <td class="px-3 py-2 font-mono">{u.ncf}</td>
                <td class="px-3 py-2">{u.type}</td>
                <td class="px-3 py-2">{u.saleId || '-'}</td>
                <td class="px-3 py-2">{new Date(u.issuedAt).toISOString().split('T')[0]}</td>
                <td class="px-3 py-2 text-right">${(u.amount || 0).toLocaleString()}</td>
                <td class="px-3 py-2">
                  {#if u.voided}
                    <span class="text-xs bg-destructive/10 text-destructive px-2 py-1 rounded">Anulado</span>
                  {:else}
                    <span class="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded">Vigente</span>
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</div>

