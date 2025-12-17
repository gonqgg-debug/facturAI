<script lang="ts">
  import { onMount } from 'svelte';
  import type { Sale, CashRegisterShift, ReceiptSettings } from '$lib/types';
  import { DEFAULT_RECEIPT_SETTINGS } from '$lib/types';
  import { db } from '$lib/db';
  import { locale } from '$lib/stores';
  import { t } from '$lib/i18n';
  import { Printer, Mail, X } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import { browser } from '$app/environment';

  export let sale: Sale;
  export let shift: CashRegisterShift | null = null;
  export let cashierName = '';
  export let cashReceived = 0;
  export let change = 0;
  export let onClose: () => void = () => {};

  // Settings loaded from DB
  let settings: ReceiptSettings = { ...DEFAULT_RECEIPT_SETTINGS };

  onMount(async () => {
    if (!browser) return;
    try {
      const stored = await db.receiptSettings.toArray();
      if (stored.length > 0) {
        settings = stored[0];
      }
    } catch (e) {
      console.error('Error loading receipt settings', e);
    }
  });

  // Format date and time
  $: saleDate = sale.createdAt ? new Date(sale.createdAt) : new Date();
  $: formattedDate = saleDate.toLocaleDateString($locale === 'es' ? 'es-DO' : 'en-US');
  $: formattedTime = saleDate.toLocaleTimeString($locale === 'es' ? 'es-DO' : 'en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  // Payment method display
  function getPaymentMethodLabel(method: string, isCredit: boolean): string {
    if (isCredit) return t('sales.credit', $locale);
    switch (method) {
      case 'cash': return t('sales.cash', $locale);
      case 'credit_card':
      case 'debit_card': return t('sales.card', $locale);
      case 'bank_transfer': return t('sales.transfer', $locale);
      default: return method;
    }
  }

  function handlePrint() {
    // Open print dialog for the receipt
    const printContent = document.getElementById('receipt-content');
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) return;

    const doc = printWindow.document;
    doc.open();
    doc.write('<!DOCTYPE html><html><head></head><body></body></html>');
    doc.close();

    // Set title
    doc.title = 'Receipt #' + (sale.receiptNumber || sale.id);

    // Create and configure style element using DOM APIs to avoid PostCSS parsing
    const styleEl = doc.createElement('style');
    const fontSize = settings.fontSize === 'small' ? '10px' : settings.fontSize === 'large' ? '14px' : '12px';
    const pw = settings.paperWidth === '58mm' ? '58mm' : '80mm';
    
    // Build styles using cssText to avoid PostCSS interference
    styleEl.textContent = getPrintStyles(pw, fontSize);
    doc.head.appendChild(styleEl);

    // Add content
    doc.body.innerHTML = printContent.innerHTML;

    printWindow.focus();
    
    // Wait for content to load then print
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }

  // Separate function to build print styles - keeps CSS out of main function scope
  function getPrintStyles(paperWidth: string, fontSize: string): string {
    const rules: string[] = [];
    rules.push('@page { size: ' + paperWidth + ' auto; margin: 0; }');
    rules.push('body { font-family: "Courier New", monospace; font-size: ' + fontSize + '; line-height: 1.4; padding: 10px; max-width: ' + paperWidth + '; margin: 0 auto; }');
    rules.push('.header { text-align: center; margin-bottom: 10px; }');
    rules.push('.header h1 { font-size: 16px; margin: 0; font-weight: bold; }');
    rules.push('.header p { margin: 2px 0; font-size: 11px; }');
    rules.push('.divider { border-top: 1px dashed #000; margin: 8px 0; }');
    rules.push('.info-row { display: flex; justify-content: space-between; }');
    rules.push('.items { margin: 10px 0; }');
    rules.push('.item { margin-bottom: 4px; }');
    rules.push('.item-name { font-weight: bold; }');
    rules.push('.item-details { display: flex; justify-content: space-between; padding-left: 10px; font-size: 11px; }');
    rules.push('.totals { margin-top: 10px; }');
    rules.push('.total-row { display: flex; justify-content: space-between; }');
    rules.push('.total-row.grand { font-weight: bold; font-size: 14px; margin-top: 5px; }');
    rules.push('.payment { margin-top: 10px; }');
    rules.push('.footer { text-align: center; margin-top: 15px; font-size: 11px; }');
    rules.push('.footer p { margin: 2px 0; }');
    return rules.join(' ');
  }
</script>

<div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
  <div class="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl max-w-sm w-full max-h-[90vh] overflow-hidden flex flex-col">
    <!-- Close button -->
    <div class="flex justify-end p-2 border-b border-border">
      <Button variant="ghost" size="icon" on:click={onClose}>
        <X size={18} />
      </Button>
    </div>

    <!-- Receipt Content -->
    <div class="flex-1 overflow-y-auto p-4" id="receipt-content">
      <div class="font-mono text-sm text-foreground" style="font-size: {settings.fontSize === 'small' ? '10px' : settings.fontSize === 'large' ? '14px' : '12px'};">
        <!-- Header -->
        <div class="header text-center mb-4">
          <h1 class="text-lg font-bold">{settings.businessName}</h1>
          {#if settings.showRnc && settings.rnc}
            <p class="text-xs text-muted-foreground">RNC: {settings.rnc}</p>
          {/if}
          {#if settings.showAddress && settings.address}
            <p class="text-xs text-muted-foreground">{settings.address}</p>
          {/if}
          {#if settings.showPhone && settings.phone}
            <p class="text-xs text-muted-foreground">Tel: {settings.phone}</p>
          {/if}
          {#if settings.showEmail && settings.email}
            <p class="text-xs text-muted-foreground">{settings.email}</p>
          {/if}
          {#if settings.showWebsite && settings.website}
            <p class="text-xs text-muted-foreground">{settings.website}</p>
          {/if}
        </div>

        <div class="border-t border-dashed border-border my-3"></div>

        <!-- Receipt Title -->
        <div class="text-center font-bold mb-3">
          {t('receipt.receipt', $locale)}
        </div>

        <!-- Receipt Info -->
        <div class="space-y-1 text-xs">
          <div class="flex justify-between">
            <span>{t('sales.receiptNumber', $locale)}</span>
            <span class="font-bold">{sale.receiptNumber || String(sale.id).padStart(6, '0')}</span>
          </div>
          {#if settings.showNcf && sale.ncf}
            <div class="flex justify-between">
              <span>NCF:</span>
              <span class="font-bold font-mono">{sale.ncf}</span>
            </div>
          {/if}
          <div class="flex justify-between">
            <span>{t('receipt.date', $locale)}:</span>
            <span>{formattedDate}</span>
          </div>
          <div class="flex justify-between">
            <span>{t('receipt.time', $locale)}:</span>
            <span>{formattedTime}</span>
          </div>
          {#if settings.showShiftNumber && shift}
            <div class="flex justify-between">
              <span>{t('shifts.shiftNumber', $locale)}</span>
              <span>{shift.shiftNumber}</span>
            </div>
          {/if}
          {#if settings.showCashierName && cashierName}
            <div class="flex justify-between">
              <span>{t('receipt.cashier', $locale)}:</span>
              <span>{cashierName}</span>
            </div>
          {/if}
          {#if sale.customerName}
            <div class="flex justify-between">
              <span>{t('sales.customer', $locale)}:</span>
              <span>{sale.customerName}</span>
            </div>
          {:else}
            <div class="flex justify-between">
              <span>{t('sales.customer', $locale)}:</span>
              <span>{t('sales.cashSale', $locale)}</span>
            </div>
          {/if}
        </div>

        <div class="border-t border-dashed border-border my-3"></div>

        <!-- Items -->
        <div class="space-y-2">
          <!-- Table Header -->
          <div class="flex text-xs font-bold border-b border-border pb-1">
            <span class="flex-1">{t('receipt.item', $locale)}</span>
            <span class="w-12 text-center">{t('receipt.qty', $locale)}</span>
            <span class="w-16 text-right">{t('receipt.price', $locale)}</span>
            <span class="w-20 text-right">{t('receipt.amount', $locale)}</span>
          </div>
          
          {#each sale.items as item}
            <div class="text-xs">
              <div class="font-medium truncate">{item.description}</div>
              {#if settings.showItemSku && item.sku}
                <div class="text-muted-foreground text-[10px]">SKU: {item.sku}</div>
              {/if}
              <div class="flex pl-2 text-muted-foreground">
                <span class="flex-1"></span>
                <span class="w-12 text-center">{item.quantity}</span>
                <span class="w-16 text-right">${item.unitPrice.toFixed(2)}</span>
                <span class="w-20 text-right">${item.amount.toFixed(2)}</span>
              </div>
            </div>
          {/each}
        </div>

        <div class="border-t border-dashed border-border my-3"></div>

        <!-- Totals -->
        <div class="space-y-1 text-xs">
          <div class="flex justify-between">
            <span>{t('receipt.subtotal', $locale)}:</span>
            <span>${sale.subtotal.toFixed(2)}</span>
          </div>
          {#if settings.showTaxBreakdown}
            <div class="flex justify-between">
              <span>{t('receipt.tax', $locale)}:</span>
              <span>${sale.itbisTotal.toFixed(2)}</span>
            </div>
          {/if}
          {#if sale.discount > 0}
            <div class="flex justify-between text-green-600">
              <span>Descuento:</span>
              <span>-${sale.discount.toFixed(2)}</span>
            </div>
          {/if}
          <div class="border-t border-border my-2"></div>
          <div class="flex justify-between text-base font-bold">
            <span>{t('receipt.total', $locale)}:</span>
            <span>${sale.total.toFixed(2)}</span>
          </div>
        </div>

        {#if settings.showPaymentDetails}
          <div class="border-t border-dashed border-border my-3"></div>

          <!-- Payment Info -->
          <div class="space-y-1 text-xs">
            <div class="flex justify-between">
              <span>{t('receipt.paymentMethod', $locale)}:</span>
              <span class="font-medium">
                {getPaymentMethodLabel(sale.paymentMethod, sale.paymentStatus === 'pending')}
              </span>
            </div>
            {#if sale.paymentMethod === 'cash' && sale.paymentStatus === 'paid'}
              {#if cashReceived > 0}
                <div class="flex justify-between">
                  <span>{t('receipt.cashReceived', $locale)}:</span>
                  <span>${cashReceived.toFixed(2)}</span>
                </div>
                <div class="flex justify-between font-bold text-green-600">
                  <span>{t('receipt.change', $locale)}:</span>
                  <span>${change.toFixed(2)}</span>
                </div>
              {/if}
            {/if}
          </div>
        {/if}

        <div class="border-t border-dashed border-border my-3"></div>

        <!-- Footer -->
        <div class="text-center text-xs space-y-1">
          {#if settings.footerLine1}
            <p class="font-bold">{settings.footerLine1}</p>
          {/if}
          {#if settings.footerLine2}
            <p class="text-muted-foreground">{settings.footerLine2}</p>
          {/if}
          {#if settings.footerLine3}
            <p class="text-muted-foreground">{settings.footerLine3}</p>
          {/if}
          {#if settings.showNoReturnsPolicy && settings.noReturnsPolicyText}
            <p class="text-muted-foreground text-[10px] mt-2">{settings.noReturnsPolicyText}</p>
          {/if}
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="p-4 border-t border-border flex gap-2">
      <Button variant="default" class="flex-1 gap-2" on:click={handlePrint}>
        <Printer size={16} />
        {t('receipt.print', $locale)}
      </Button>
      <Button variant="outline" class="flex-1 gap-2" on:click={onClose}>
        {t('sales.newSale', $locale)}
      </Button>
    </div>
  </div>
</div>

<style>
  /* Print-specific styles */
  @media print {
    .fixed {
      position: static;
      background: white !important;
    }
    
    .border-t, .p-4.border-t {
      display: none;
    }
  }
</style>
