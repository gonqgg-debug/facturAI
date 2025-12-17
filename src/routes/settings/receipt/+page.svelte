<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { db, generateId } from '$lib/db';
  import type { ReceiptSettings } from '$lib/types';
  import { DEFAULT_RECEIPT_SETTINGS } from '$lib/types';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import * as Select from '$lib/components/ui/select';
  import { Switch } from '$lib/components/ui/switch';
  import { Receipt, Save, RotateCcw, Eye, Store, FileText, Settings2, Type } from 'lucide-svelte';

  let settings: ReceiptSettings = { ...DEFAULT_RECEIPT_SETTINGS };
  let loading = true;
  let saving = false;
  let showPreview = false;

  async function loadSettings() {
    if (!browser) return;
    loading = true;
    try {
      const existing = await db.receiptSettings.toArray();
      if (existing.length > 0) {
        settings = existing[0];
      }
    } catch (e) {
      console.error('Error loading receipt settings', e);
    } finally {
      loading = false;
    }
  }

  async function saveSettings() {
    if (!browser) return;
    saving = true;
    try {
      const existing = await db.receiptSettings.toArray();
      if (existing.length > 0) {
        await db.receiptSettings.update(existing[0].id!, {
          ...settings,
          updatedAt: new Date()
        });
      } else {
        await db.receiptSettings.add({
          ...settings,
          id: generateId(),
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      alert('Configuración guardada correctamente');
    } catch (e) {
      console.error('Error saving receipt settings', e);
      alert('Error al guardar la configuración');
    } finally {
      saving = false;
    }
  }

  function resetToDefaults() {
    if (confirm('¿Restablecer toda la configuración a los valores por defecto?')) {
      settings = { ...DEFAULT_RECEIPT_SETTINGS, id: settings.id };
    }
  }

  function handlePaperWidthChange(v: { value: string } | undefined) {
    settings.paperWidth = (v?.value ?? '80mm') as '58mm' | '80mm';
  }

  function handleFontSizeChange(v: { value: string } | undefined) {
    settings.fontSize = (v?.value ?? 'medium') as 'small' | 'medium' | 'large';
  }

  onMount(loadSettings);

  // Sample receipt data for preview
  const sampleSale = {
    receiptNumber: '000123',
    ncf: 'B0200000001234',
    date: new Date().toLocaleDateString('es-DO'),
    time: new Date().toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' }),
    shiftNumber: 5,
    cashierName: 'María García',
    customerName: 'Cliente General',
    items: [
      { description: 'Leche Entera 1L', sku: 'LEC001', quantity: 2, unitPrice: 85.00, amount: 170.00 },
      { description: 'Pan de Agua', sku: 'PAN002', quantity: 3, unitPrice: 25.00, amount: 75.00 },
      { description: 'Café Molido 250g', sku: 'CAF003', quantity: 1, unitPrice: 195.00, amount: 195.00 }
    ],
    subtotal: 440.00,
    itbisTotal: 79.20,
    total: 519.20,
    paymentMethod: 'Efectivo',
    cashReceived: 600.00,
    change: 80.80
  };
</script>

<div class="p-6 max-w-6xl mx-auto space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between flex-wrap gap-4">
    <div class="flex items-center gap-3">
      <div class="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-200">
        <Receipt size={24} />
      </div>
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Configurar Ticket</h1>
        <p class="text-muted-foreground">Personaliza el recibo de venta</p>
      </div>
    </div>
    <div class="flex gap-2">
      <Button variant="outline" on:click={resetToDefaults} class="gap-2">
        <RotateCcw size={16} />
        Restablecer
      </Button>
      <Button variant="outline" on:click={() => showPreview = !showPreview} class="gap-2">
        <Eye size={16} />
        {showPreview ? 'Ocultar' : 'Ver'} Vista Previa
      </Button>
      <Button on:click={saveSettings} disabled={saving} class="gap-2">
        <Save size={16} />
        {saving ? 'Guardando...' : 'Guardar'}
      </Button>
    </div>
  </div>

  <div class="grid lg:grid-cols-2 gap-6">
    <!-- Settings Form -->
    <div class="space-y-6">
      <!-- Business Info -->
      <div class="border rounded-xl overflow-hidden">
        <div class="px-4 py-3 bg-slate-50 border-b flex items-center gap-2">
          <Store size={18} class="text-slate-500" />
          <span class="font-semibold">Información del Negocio</span>
        </div>
        <div class="p-4 space-y-4">
          <div class="space-y-1">
            <label class="text-sm font-medium">Nombre del Negocio</label>
            <Input bind:value={settings.businessName} placeholder="Mi Negocio" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="text-sm font-medium">RNC</label>
              <Input bind:value={settings.rnc} placeholder="000-00000-0" />
            </div>
            <div class="space-y-1">
              <label class="text-sm font-medium">Teléfono</label>
              <Input bind:value={settings.phone} placeholder="809-000-0000" />
            </div>
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium">Dirección</label>
            <Input bind:value={settings.address} placeholder="Calle, Ciudad" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <label class="text-sm font-medium">Email</label>
              <Input type="email" bind:value={settings.email} placeholder="correo@ejemplo.com" />
            </div>
            <div class="space-y-1">
              <label class="text-sm font-medium">Sitio Web</label>
              <Input bind:value={settings.website} placeholder="www.ejemplo.com" />
            </div>
          </div>
        </div>
      </div>

      <!-- Display Options -->
      <div class="border rounded-xl overflow-hidden">
        <div class="px-4 py-3 bg-slate-50 border-b flex items-center gap-2">
          <Settings2 size={18} class="text-slate-500" />
          <span class="font-semibold">Opciones de Visualización</span>
        </div>
        <div class="p-4 space-y-3">
          <div class="flex items-center justify-between py-2">
            <span class="text-sm">Mostrar RNC</span>
            <Switch bind:checked={settings.showRnc} />
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-sm">Mostrar Dirección</span>
            <Switch bind:checked={settings.showAddress} />
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-sm">Mostrar Teléfono</span>
            <Switch bind:checked={settings.showPhone} />
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-sm">Mostrar Email</span>
            <Switch bind:checked={settings.showEmail} />
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-sm">Mostrar Sitio Web</span>
            <Switch bind:checked={settings.showWebsite} />
          </div>
        </div>
      </div>

      <!-- Receipt Content -->
      <div class="border rounded-xl overflow-hidden">
        <div class="px-4 py-3 bg-slate-50 border-b flex items-center gap-2">
          <FileText size={18} class="text-slate-500" />
          <span class="font-semibold">Contenido del Recibo</span>
        </div>
        <div class="p-4 space-y-3">
          <div class="flex items-center justify-between py-2">
            <div>
              <span class="text-sm">Mostrar NCF</span>
              <p class="text-xs text-muted-foreground">Número de Comprobante Fiscal</p>
            </div>
            <Switch bind:checked={settings.showNcf} />
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-sm">Mostrar Número de Turno</span>
            <Switch bind:checked={settings.showShiftNumber} />
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-sm">Mostrar Nombre del Cajero</span>
            <Switch bind:checked={settings.showCashierName} />
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-sm">Mostrar SKU de Productos</span>
            <Switch bind:checked={settings.showItemSku} />
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-sm">Mostrar Desglose de ITBIS</span>
            <Switch bind:checked={settings.showTaxBreakdown} />
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-sm">Mostrar Detalles de Pago</span>
            <Switch bind:checked={settings.showPaymentDetails} />
          </div>
        </div>
      </div>

      <!-- Footer Messages -->
      <div class="border rounded-xl overflow-hidden">
        <div class="px-4 py-3 bg-slate-50 border-b flex items-center gap-2">
          <Type size={18} class="text-slate-500" />
          <span class="font-semibold">Mensajes del Pie</span>
        </div>
        <div class="p-4 space-y-4">
          <div class="space-y-1">
            <label class="text-sm font-medium">Línea 1</label>
            <Input bind:value={settings.footerLine1} placeholder="¡Gracias por su compra!" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium">Línea 2</label>
            <Input bind:value={settings.footerLine2} placeholder="Vuelva pronto" />
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium">Línea 3 (opcional)</label>
            <Input bind:value={settings.footerLine3} placeholder="" />
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-sm">Mostrar Política de Devoluciones</span>
            <Switch bind:checked={settings.showNoReturnsPolicy} />
          </div>
          {#if settings.showNoReturnsPolicy}
            <div class="space-y-1">
              <label class="text-sm font-medium">Texto de Política</label>
              <Input bind:value={settings.noReturnsPolicyText} placeholder="No se aceptan devoluciones sin recibo" />
            </div>
          {/if}
        </div>
      </div>

      <!-- Format Options -->
      <div class="border rounded-xl overflow-hidden">
        <div class="px-4 py-3 bg-slate-50 border-b flex items-center gap-2">
          <Receipt size={18} class="text-slate-500" />
          <span class="font-semibold">Formato de Impresión</span>
        </div>
        <div class="p-4 space-y-4">
          <div class="space-y-1">
            <label class="text-sm font-medium">Ancho de Papel</label>
            <Select.Root 
              onSelectedChange={handlePaperWidthChange}
              value={{ value: settings.paperWidth, label: settings.paperWidth === '58mm' ? '58mm (pequeño)' : '80mm (estándar)' }}
            >
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="58mm">58mm (pequeño)</Select.Item>
                <Select.Item value="80mm">80mm (estándar)</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>
          <div class="space-y-1">
            <label class="text-sm font-medium">Tamaño de Fuente</label>
            <Select.Root 
              onSelectedChange={handleFontSizeChange}
              value={{ value: settings.fontSize, label: settings.fontSize === 'small' ? 'Pequeño' : settings.fontSize === 'large' ? 'Grande' : 'Mediano' }}
            >
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="small">Pequeño</Select.Item>
                <Select.Item value="medium">Mediano</Select.Item>
                <Select.Item value="large">Grande</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>
        </div>
      </div>
    </div>

    <!-- Preview -->
    {#if showPreview}
      <div class="lg:sticky lg:top-6">
        <div class="border rounded-xl overflow-hidden">
          <div class="px-4 py-3 bg-slate-800 text-white flex items-center gap-2">
            <Eye size={18} />
            <span class="font-semibold">Vista Previa</span>
          </div>
          <div class="p-4 bg-slate-100 flex justify-center">
            <div 
              class="bg-white shadow-lg font-mono text-foreground"
              style="width: {settings.paperWidth === '58mm' ? '220px' : '300px'}; font-size: {settings.fontSize === 'small' ? '10px' : settings.fontSize === 'large' ? '14px' : '12px'};"
            >
              <div class="p-4">
                <!-- Header -->
                <div class="text-center mb-3">
                  <div class="font-bold text-lg">{settings.businessName || 'Mi Negocio'}</div>
                  {#if settings.showRnc && settings.rnc}
                    <div class="text-xs text-muted-foreground">RNC: {settings.rnc}</div>
                  {/if}
                  {#if settings.showAddress && settings.address}
                    <div class="text-xs text-muted-foreground">{settings.address}</div>
                  {/if}
                  {#if settings.showPhone && settings.phone}
                    <div class="text-xs text-muted-foreground">Tel: {settings.phone}</div>
                  {/if}
                  {#if settings.showEmail && settings.email}
                    <div class="text-xs text-muted-foreground">{settings.email}</div>
                  {/if}
                  {#if settings.showWebsite && settings.website}
                    <div class="text-xs text-muted-foreground">{settings.website}</div>
                  {/if}
                </div>

                <div class="border-t border-dashed border-slate-300 my-2"></div>

                <!-- Receipt Title -->
                <div class="text-center font-bold mb-2">RECIBO DE VENTA</div>

                <!-- Info -->
                <div class="text-xs space-y-0.5 mb-2">
                  <div class="flex justify-between">
                    <span>Recibo #</span>
                    <span class="font-bold">{sampleSale.receiptNumber}</span>
                  </div>
                  {#if settings.showNcf}
                    <div class="flex justify-between">
                      <span>NCF:</span>
                      <span class="font-bold font-mono">{sampleSale.ncf}</span>
                    </div>
                  {/if}
                  <div class="flex justify-between">
                    <span>Fecha:</span>
                    <span>{sampleSale.date}</span>
                  </div>
                  <div class="flex justify-between">
                    <span>Hora:</span>
                    <span>{sampleSale.time}</span>
                  </div>
                  {#if settings.showShiftNumber}
                    <div class="flex justify-between">
                      <span>Turno #</span>
                      <span>{sampleSale.shiftNumber}</span>
                    </div>
                  {/if}
                  {#if settings.showCashierName}
                    <div class="flex justify-between">
                      <span>Cajero:</span>
                      <span>{sampleSale.cashierName}</span>
                    </div>
                  {/if}
                  <div class="flex justify-between">
                    <span>Cliente:</span>
                    <span>{sampleSale.customerName}</span>
                  </div>
                </div>

                <div class="border-t border-dashed border-slate-300 my-2"></div>

                <!-- Items -->
                <div class="text-xs space-y-1 mb-2">
                  {#each sampleSale.items as item}
                    <div>
                      <div class="font-medium">{item.description}</div>
                      {#if settings.showItemSku}
                        <div class="text-muted-foreground text-[10px]">SKU: {item.sku}</div>
                      {/if}
                      <div class="flex justify-between text-muted-foreground pl-2">
                        <span>{item.quantity} x ${item.unitPrice.toFixed(2)}</span>
                        <span>${item.amount.toFixed(2)}</span>
                      </div>
                    </div>
                  {/each}
                </div>

                <div class="border-t border-dashed border-slate-300 my-2"></div>

                <!-- Totals -->
                <div class="text-xs space-y-0.5 mb-2">
                  <div class="flex justify-between">
                    <span>Subtotal:</span>
                    <span>${sampleSale.subtotal.toFixed(2)}</span>
                  </div>
                  {#if settings.showTaxBreakdown}
                    <div class="flex justify-between">
                      <span>ITBIS (18%):</span>
                      <span>${sampleSale.itbisTotal.toFixed(2)}</span>
                    </div>
                  {/if}
                  <div class="border-t border-slate-200 my-1"></div>
                  <div class="flex justify-between font-bold text-sm">
                    <span>TOTAL:</span>
                    <span>${sampleSale.total.toFixed(2)}</span>
                  </div>
                </div>

                {#if settings.showPaymentDetails}
                  <div class="border-t border-dashed border-slate-300 my-2"></div>
                  <div class="text-xs space-y-0.5 mb-2">
                    <div class="flex justify-between">
                      <span>Forma de Pago:</span>
                      <span class="font-medium">{sampleSale.paymentMethod}</span>
                    </div>
                    <div class="flex justify-between">
                      <span>Efectivo Recibido:</span>
                      <span>${sampleSale.cashReceived.toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between font-bold text-emerald-600">
                      <span>Cambio:</span>
                      <span>${sampleSale.change.toFixed(2)}</span>
                    </div>
                  </div>
                {/if}

                <div class="border-t border-dashed border-slate-300 my-2"></div>

                <!-- Footer -->
                <div class="text-center text-xs space-y-0.5">
                  {#if settings.footerLine1}
                    <div class="font-bold">{settings.footerLine1}</div>
                  {/if}
                  {#if settings.footerLine2}
                    <div class="text-muted-foreground">{settings.footerLine2}</div>
                  {/if}
                  {#if settings.footerLine3}
                    <div class="text-muted-foreground">{settings.footerLine3}</div>
                  {/if}
                  {#if settings.showNoReturnsPolicy && settings.noReturnsPolicyText}
                    <div class="text-muted-foreground text-[10px] mt-2">{settings.noReturnsPolicyText}</div>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

