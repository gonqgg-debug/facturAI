<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { db } from '$lib/db';
  import { 
    Search, Eye, RotateCcw, Calendar, User, CreditCard, Banknote, 
    Receipt, X, CheckCircle2, ChevronLeft, Package, Clock,
    AlertTriangle, Minus, Plus, Filter, Download, Printer,
    ArrowUpDown, ArrowUp, ArrowDown, Columns3, PenLine
  } from 'lucide-svelte';
  import type { Sale, Customer, Return, ReturnItem, Payment, StockMovement, PaymentMethodType } from '$lib/types';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Select from '$lib/components/ui/select';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import * as Table from '$lib/components/ui/table';
  import * as Card from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { Separator } from '$lib/components/ui/separator';
  import { DatePicker } from '$lib/components/ui/date-picker';
  import { locale, activeShift, activeShiftId, hasActiveShift } from '$lib/stores';
  import { currentUser, userPermissions } from '$lib/auth';
  import { t } from '$lib/i18n';
  import SaleReceipt from '$lib/components/SaleReceipt.svelte';
  import { goto } from '$app/navigation';
  import * as XLSX from 'xlsx';

  // Data
  let sales: Sale[] = [];
  let customers: Customer[] = [];
  let returns: Return[] = [];
  
  // Filters
  let searchQuery = '';
  let dateFilter: 'today' | 'week' | 'month' | 'all' = 'all';
  let statusFilter: 'all' | 'paid' | 'pending' | 'with_returns' = 'all';
  let startDate = '';
  let endDate = '';
  
  // Table state
  let sortColumn: string | null = 'date';
  let sortDirection: 'asc' | 'desc' | null = 'desc';
  let selectedIds: Set<number> = new Set();
  let isAllSelected = false;
  let isSomeSelected = false;
  let bulkSelectionState: boolean | 'indeterminate' = false;
  
  // Column visibility
  let columnVisibility: Record<string, boolean> = {
    receipt: true,
    date: true,
    customer: true,
    items: true,
    payment: true,
    status: true,
    total: true,
    actions: true
  };
  
  // Pagination
  let currentPage = 1;
  let pageSize = 20;
  
  // Selected order for detail view
  let selectedSale: Sale | null = null;
  let showDetailModal = false;
  let saleReturns: Return[] = [];
  
  // Receipt
  let showReceipt = false;
  let receiptSale: Sale | null = null;
  
  // Return processing state
  let showReturnModal = false;
  let returnSale: Sale | null = null;
  let returnItems: { item: Sale['items'][0]; index: number; maxQty: number; returnQty: number; selected: boolean }[] = [];
  let returnReason: Return['reason'] = 'customer_changed_mind';
  let returnNotes = '';
  let returnRefundMethod: PaymentMethodType = 'cash';
  let returnProcessing = false;
  let returnComplete = false;
  let lastReturn: Return | null = null;

  // Payment edit state
  let showEditPaymentModal = false;
  let paymentSale: Sale | null = null;
  let paymentMethodDraft: PaymentMethodType = 'cash';
  let paymentEditProcessing = false;
  let paymentEditError = '';

  // Loading
  let loading = true;

  onMount(async () => {
    await loadData();
    await loadActiveShift();
  });

  async function loadData() {
    if (!browser) return;
    loading = true;
    
    try {
      const allSales = await db.sales.toArray();
      sales = allSales.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        if (a.createdAt && b.createdAt) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return 0;
      });
      
      customers = await db.customers.toArray();
      returns = await db.returns.toArray();

      if (selectedSale?.id) {
        const refreshedSale = sales.find(s => s.id === selectedSale?.id);
        if (refreshedSale) {
          selectedSale = refreshedSale;
        }
      }

      if (returnSale?.id) {
        const refreshedReturnSale = sales.find(s => s.id === returnSale?.id);
        if (refreshedReturnSale) {
          returnSale = refreshedReturnSale;
        }
      }

      if (paymentSale?.id) {
        const refreshedPaymentSale = sales.find(s => s.id === paymentSale?.id);
        if (refreshedPaymentSale) {
          paymentSale = refreshedPaymentSale;
        }
      }
    } catch (e) {
      console.error('Error loading data:', e);
    } finally {
      loading = false;
    }
  }

  async function loadActiveShift() {
    if (!browser) return;
    
    const shiftId = $activeShiftId;
    if (shiftId) {
      const shift = await db.shifts.get(shiftId);
      if (shift && shift.status === 'open') {
        activeShift.set(shift);
      } else {
        activeShiftId.set(null);
        activeShift.set(null);
      }
    }
  }

  // Filtered sales
  $: filteredSales = filterSales(sales, searchQuery, dateFilter, statusFilter, startDate, endDate);
  
  function filterSales(
    allSales: Sale[], 
    query: string, 
    dateF: typeof dateFilter, 
    statusF: typeof statusFilter,
    start: string,
    end: string
  ): Sale[] {
    let result = [...allSales];
    
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    if (dateF === 'today') {
      result = result.filter(s => s.date === today);
    } else if (dateF === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      result = result.filter(s => s.date >= weekAgo);
    } else if (dateF === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      result = result.filter(s => s.date >= monthAgo);
    }
    
    if (start) result = result.filter(s => s.date >= start);
    if (end) result = result.filter(s => s.date <= end);
    
    if (statusF === 'paid') {
      result = result.filter(s => s.paymentStatus === 'paid');
    } else if (statusF === 'pending') {
      result = result.filter(s => s.paymentStatus !== 'paid');
    } else if (statusF === 'with_returns') {
      result = result.filter(s => s.hasReturns);
    }
    
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(s => 
        s.receiptNumber?.toLowerCase().includes(q) ||
        s.customerName?.toLowerCase().includes(q) ||
        s.items.some(item => item.description.toLowerCase().includes(q))
      );
    }
    
    return result;
  }
  
  // Sorted sales
  $: sortedSales = sortColumn && sortDirection
    ? [...filteredSales].sort((a, b) => {
        let aVal: any, bVal: any;
        switch (sortColumn) {
          case 'receipt': aVal = a.receiptNumber || ''; bVal = b.receiptNumber || ''; break;
          case 'date': 
            aVal = new Date(a.createdAt || a.date).getTime(); 
            bVal = new Date(b.createdAt || b.date).getTime(); 
            break;
          case 'customer': aVal = a.customerName || ''; bVal = b.customerName || ''; break;
          case 'items': aVal = a.items.length; bVal = b.items.length; break;
          case 'total': aVal = a.total; bVal = b.total; break;
          case 'status': aVal = a.paymentStatus; bVal = b.paymentStatus; break;
          default: return 0;
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return sortDirection === 'asc' 
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      })
    : filteredSales;
  
  // Paginated sales
  $: paginatedSales = sortedSales.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  $: totalPages = Math.ceil(sortedSales.length / pageSize);
  $: pageCount = totalPages || 1;
  
  // Selection
  $: selectedSales = sales.filter(s => s.id && selectedIds.has(s.id));
  $: isAllSelected = paginatedSales.length > 0 && paginatedSales.every(s => s.id && selectedIds.has(s.id));
  $: isSomeSelected = paginatedSales.some(s => s.id && selectedIds.has(s.id)) && !isAllSelected;
  $: bulkSelectionState = (isAllSelected ? true : (isSomeSelected ? 'indeterminate' : false)) as boolean | 'indeterminate';
  
  // Stats
  $: todaySales = sales.filter(s => s.date === new Date().toISOString().split('T')[0]);
  $: todayTotal = todaySales.reduce((sum, s) => sum + s.total, 0);
  $: todayCount = todaySales.length;

  function toggleSort(column: string) {
    if (sortColumn === column) {
      if (sortDirection === 'asc') sortDirection = 'desc';
      else if (sortDirection === 'desc') { sortDirection = null; sortColumn = null; }
    } else {
      sortColumn = column;
      sortDirection = 'desc';
    }
    currentPage = 1;
  }
  
  function toggleSelectAll() {
    if (isAllSelected) {
      paginatedSales.forEach(s => { if (s.id) selectedIds.delete(s.id); });
    } else {
      paginatedSales.forEach(s => { if (s.id) selectedIds.add(s.id); });
    }
    selectedIds = new Set(selectedIds);
  }
  
  function toggleSelect(sale: Sale) {
    if (!sale.id) return;
    if (selectedIds.has(sale.id)) {
      selectedIds.delete(sale.id);
    } else {
      selectedIds.add(sale.id);
    }
    selectedIds = new Set(selectedIds);
  }
  
  function clearSelection() {
    selectedIds = new Set();
  }

  function formatCurrency(amount: number): string {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString($locale === 'es' ? 'es-DO' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }
  
  function formatTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (!d || isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString($locale === 'es' ? 'es-DO' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  function getPaymentMethodLabel(method: PaymentMethodType, isCredit: boolean): string {
    if (isCredit) return t('sales.credit', $locale);
    const labels: Record<PaymentMethodType, { en: string; es: string }> = {
      cash: { en: 'Cash', es: 'Efectivo' },
      credit_card: { en: 'Card', es: 'Tarjeta' },
      debit_card: { en: 'Debit', es: 'Débito' },
      bank_transfer: { en: 'Transfer', es: 'Transferencia' },
      check: { en: 'Check', es: 'Cheque' },
      mobile_payment: { en: 'Mobile', es: 'Móvil' },
      other: { en: 'Other', es: 'Otro' }
    };
    return labels[method][$locale === 'es' ? 'es' : 'en'];
  }
  
  function getPaymentStatusBadge(sale: Sale): { text: string; class: string } {
    if (sale.paymentStatus === 'paid') {
      return { 
        text: $locale === 'es' ? 'Pagado' : 'Paid', 
        class: 'bg-green-500/10 text-green-500 border-green-500/30' 
      };
    }
    if (sale.paymentStatus === 'partial') {
      return { 
        text: $locale === 'es' ? 'Parcial' : 'Partial', 
        class: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/30' 
      };
    }
    return { 
      text: $locale === 'es' ? 'Pendiente' : 'Pending', 
      class: 'bg-orange-500/10 text-orange-500 border-orange-500/30' 
    };
  }

  // View order details
  async function viewOrder(sale: Sale) {
    selectedSale = sale;
    if (sale.id) {
      saleReturns = await db.returns.where('originalSaleId').equals(sale.id).toArray();
    } else {
      saleReturns = [];
    }
    showDetailModal = true;
  }
  
  function closeDetailModal() {
    showDetailModal = false;
    selectedSale = null;
    saleReturns = [];
  }
  
  // Print receipt
  function printReceipt(sale: Sale) {
    receiptSale = sale;
    showReceipt = true;
  }
  
  function closeReceipt() {
    showReceipt = false;
    receiptSale = null;
  }
  
  // Export selected orders
  function exportOrders() {
    const toExport = selectedSales.length > 0 ? selectedSales : sortedSales;
    
    const data = toExport.map(s => ({
      Receipt: s.receiptNumber || '',
      Date: s.date,
      Time: s.createdAt ? formatTime(s.createdAt) : '',
      Customer: s.customerName || ($locale === 'es' ? 'Venta de contado' : 'Cash sale'),
      Items: s.items.length,
      Subtotal: s.subtotal,
      ITBIS: s.itbisTotal,
      Total: s.total,
      PaymentMethod: getPaymentMethodLabel(s.paymentMethod, false),
      Status: s.paymentStatus,
      HasReturns: s.hasReturns ? 'Yes' : 'No',
      ReturnedAmount: s.returnedAmount || 0
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Orders");
    XLSX.writeFile(wb, `orders_export_${new Date().toISOString().split('T')[0]}.xlsx`);
  }
  
  // ============ RETURN PROCESSING ============
  
  async function openReturnModal(sale: Sale) {
    if (!$hasActiveShift) {
      alert($locale === 'es' ? 'Debes abrir un turno primero' : 'You must open a shift first');
      return;
    }
    
    returnSale = sale;
    
    const existingReturns = sale.id 
      ? await db.returns.where('originalSaleId').equals(sale.id).toArray()
      : [];
    
    const returnedQtys: Record<number, number> = {};
    for (const ret of existingReturns) {
      for (const item of ret.items) {
        const idx = item.originalSaleItemIndex ?? 0;
        returnedQtys[idx] = (returnedQtys[idx] || 0) + item.quantity;
      }
    }
    
    returnItems = sale.items.map((item, index) => {
      const alreadyReturned = returnedQtys[index] || 0;
      const maxQty = item.quantity - alreadyReturned;
      return {
        item,
        index,
        maxQty,
        returnQty: 0,
        selected: false
      };
    }).filter(ri => ri.maxQty > 0);
    
    returnReason = 'customer_changed_mind';
    returnNotes = '';
    returnRefundMethod = 'cash';
    returnProcessing = false;
    returnComplete = false;
    lastReturn = null;
    
    showReturnModal = true;
  }
  
  function closeReturnModal() {
    showReturnModal = false;
    returnSale = null;
    returnItems = [];
    returnComplete = false;
    lastReturn = null;
  }
  
  function toggleReturnItem(index: number) {
    const ri = returnItems.find(r => r.index === index);
    if (ri) {
      ri.selected = !ri.selected;
      if (ri.selected && ri.returnQty === 0) {
        ri.returnQty = ri.maxQty;
      }
      returnItems = [...returnItems];
    }
  }
  
  function updateReturnQty(index: number, qty: number) {
    const ri = returnItems.find(r => r.index === index);
    if (ri) {
      ri.returnQty = Math.max(0, Math.min(qty, ri.maxQty));
      ri.selected = ri.returnQty > 0;
      returnItems = [...returnItems];
    }
  }
  
  $: selectedReturnItems = returnItems.filter(ri => ri.selected && ri.returnQty > 0);
  $: returnSubtotal = selectedReturnItems.reduce((sum, ri) => sum + (ri.item.unitPrice * ri.returnQty), 0);
  $: returnItbisTotal = selectedReturnItems.reduce((sum, ri) => sum + (ri.item.unitPrice * ri.returnQty * (ri.item.taxRate ?? 0.18)), 0);
  $: returnTotal = returnSubtotal + returnItbisTotal;
  
  async function processReturn() {
    if (!returnSale || selectedReturnItems.length === 0 || !$activeShift?.id) return;
    
    returnProcessing = true;
    
    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      
      const items: ReturnItem[] = selectedReturnItems.map(ri => ({
        description: ri.item.description,
        productId: ri.item.productId,
        quantity: ri.returnQty,
        unitPrice: ri.item.unitPrice,
        taxRate: ri.item.taxRate,
        value: ri.item.unitPrice * ri.returnQty,
        itbis: ri.item.unitPrice * ri.returnQty * (ri.item.taxRate ?? 0.18),
        amount: ri.item.unitPrice * ri.returnQty * (1 + (ri.item.taxRate ?? 0.18)),
        originalSaleItemIndex: ri.index
      }));
      
      const returnRecord: Return = {
        date: dateStr,
        originalSaleId: returnSale.id!,
        originalReceiptNumber: returnSale.receiptNumber,
        customerId: returnSale.customerId,
        customerName: returnSale.customerName,
        items,
        subtotal: returnSubtotal,
        itbisTotal: returnItbisTotal,
        total: returnTotal,
        refundMethod: returnRefundMethod,
        refundStatus: 'completed',
        reason: returnReason,
        reasonNotes: returnNotes || undefined,
        shiftId: $activeShift.id,
        processedBy: $currentUser?.id,
        processedByName: $currentUser?.displayName,
        createdAt: now
      };
      
      const returnId = await db.returns.add(returnRecord);
      lastReturn = { ...returnRecord, id: returnId as number };
      
      for (const ri of selectedReturnItems) {
        if (ri.item.productId) {
          const productId = parseInt(ri.item.productId);
          const product = await db.products.get(productId);
          
          if (product) {
            const movement: StockMovement = {
              productId,
              type: 'return',
              quantity: ri.returnQty,
              returnId: returnId as number,
              date: dateStr,
              notes: `${$locale === 'es' ? 'Devolución' : 'Return'} - ${returnSale.receiptNumber}`
            };
            await db.stockMovements.add(movement);
            
            await db.products.update(productId, {
              currentStock: Number(product.currentStock ?? 0) + Number(ri.returnQty),
              lastStockUpdate: dateStr
            });
          }
        }
      }
      
      await db.sales.update(returnSale.id!, {
        hasReturns: true,
        returnedAmount: Number(returnSale.returnedAmount ?? 0) + Number(returnTotal)
      });
      
      const payment: Payment = {
        returnId: returnId as number,
        customerId: returnSale.customerId,
        amount: returnTotal,
        currency: 'DOP',
        paymentDate: dateStr,
        paymentMethod: returnRefundMethod,
        isRefund: true,
        notes: `${$locale === 'es' ? 'Reembolso devolución' : 'Return refund'} - ${returnSale.receiptNumber}`,
        createdAt: now
      };
      await db.payments.add(payment);
      
      if (returnSale.customerId && returnSale.paymentMethod === 'other') {
        const customer = await db.customers.get(returnSale.customerId);
        if (customer) {
          await db.customers.update(returnSale.customerId, {
            currentBalance: Math.max(0, (customer.currentBalance ?? 0) - returnTotal)
          });
        }
      }
      
      returnComplete = true;
      await loadData();
      
    } catch (e) {
      console.error('Error processing return:', e);
      alert($locale === 'es' ? 'Error al procesar devolución' : 'Error processing return');
    } finally {
      returnProcessing = false;
    }
  }
  
  function getReturnReasonLabel(reason: Return['reason']): string {
    const reasons: Record<Return['reason'], { en: string; es: string }> = {
      defective: { en: 'Defective product', es: 'Producto defectuoso' },
      wrong_item: { en: 'Wrong item', es: 'Artículo equivocado' },
      customer_changed_mind: { en: 'Customer changed mind', es: 'Cliente cambió de opinión' },
      damaged: { en: 'Damaged', es: 'Dañado' },
      expired: { en: 'Expired', es: 'Vencido' },
      other: { en: 'Other', es: 'Otro' }
    };
    return reasons[reason][$locale === 'es' ? 'es' : 'en'];
  }
  
  function setReturnReason(value: string) {
    returnReason = value as Return['reason'];
  }
  
  function canEditPaymentMethod(sale: Sale): boolean {
    return sale.paymentStatus === 'paid' && ['cash', 'credit_card', 'debit_card'].includes(sale.paymentMethod);
  }

  function openEditPaymentModal(sale: Sale) {
    if (!sale.id || !canEditPaymentMethod(sale)) return;
    paymentSale = sale;
    paymentMethodDraft = sale.paymentMethod;
    paymentEditError = '';
    showEditPaymentModal = true;
  }

  function closeEditPaymentModal() {
    showEditPaymentModal = false;
    paymentSale = null;
    paymentEditError = '';
    paymentMethodDraft = 'cash';
  }

  async function savePaymentMethodChange() {
    if (!paymentSale?.id) return;
    paymentEditProcessing = true;
    paymentEditError = '';

    try {
      await db.sales.update(paymentSale.id, { paymentMethod: paymentMethodDraft });

      const relatedPayments = await db.payments.where('saleId').equals(paymentSale.id).toArray();
      await Promise.all(
        relatedPayments
          .filter(payment => !payment.isRefund && payment.id)
          .map(payment => db.payments.update(payment.id!, { paymentMethod: paymentMethodDraft }))
      );

      if (selectedSale?.id === paymentSale.id) {
        selectedSale = { ...selectedSale, paymentMethod: paymentMethodDraft };
      }

      await loadData();
      closeEditPaymentModal();
    } catch (error) {
      console.error('Error updating payment method:', error);
      paymentEditError = $locale === 'es'
        ? 'No se pudo actualizar el método de pago'
        : 'Unable to update the payment method';
    } finally {
      paymentEditProcessing = false;
    }
  }

  function goBack() {
    goto('/sales');
  }
  
  function canProcessReturn(sale: Sale): boolean {
    if (sale.paymentStatus !== 'paid') return false;
    
    const existingReturns = returns.filter(r => r.originalSaleId === sale.id);
    
    return sale.items.some((item, idx) => {
      const returnedQty = existingReturns.reduce((sum, ret) => 
        sum + ret.items.filter(ri => ri.originalSaleItemIndex === idx).reduce((s, ri) => s + ri.quantity, 0), 0);
      return item.quantity > returnedQty;
    });
  }
</script>

<div class="p-4 max-w-7xl mx-auto pb-24">
  <!-- Header -->
  <div class="flex items-center gap-4 mb-6">
    <Button variant="ghost" size="icon" on:click={goBack}>
      <ChevronLeft size={20} />
    </Button>
    <div class="flex-1">
      <h1 class="text-2xl font-bold">{t('orders.title', $locale)}</h1>
      <p class="text-muted-foreground text-sm">{t('orders.subtitle', $locale)}</p>
    </div>
    <Button variant="outline" on:click={exportOrders}>
      <Download size={16} class="mr-2" />
      {selectedIds.size > 0 ? `${$locale === 'es' ? 'Exportar' : 'Export'} (${selectedIds.size})` : ($locale === 'es' ? 'Exportar' : 'Export')}
    </Button>
  </div>

  <!-- Stats Cards -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1">{t('orders.todaySales', $locale)}</div>
        <div class="text-2xl font-bold text-primary">{formatCurrency(todayTotal)}</div>
        <div class="text-xs text-muted-foreground">{todayCount} {todayCount === 1 ? t('sales.item', $locale) : t('sales.items', $locale)}</div>
      </Card.Content>
    </Card.Root>
    
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1">{t('orders.totalOrders', $locale)}</div>
        <div class="text-2xl font-bold">{sortedSales.length}</div>
        <div class="text-xs text-muted-foreground">{t('orders.filtered', $locale)}</div>
      </Card.Content>
    </Card.Root>
    
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1">{t('orders.pendingPayments', $locale)}</div>
        <div class="text-2xl font-bold text-orange-500">
          {formatCurrency(filteredSales.filter(s => s.paymentStatus !== 'paid').reduce((sum, s) => sum + (s.total - s.paidAmount), 0))}
        </div>
      </Card.Content>
    </Card.Root>
    
    <Card.Root>
      <Card.Content class="p-4">
        <div class="text-muted-foreground text-xs uppercase font-bold mb-1">{t('orders.returnsCount', $locale)}</div>
        <div class="text-2xl font-bold text-red-500">{returns.length}</div>
      </Card.Content>
    </Card.Root>
  </div>

  <!-- Filters -->
  <div class="bg-card border border-border rounded-xl p-4 mb-6">
    <div class="flex flex-wrap gap-4 items-end">
      <!-- Search -->
      <div class="flex-1 min-w-[200px]">
        <Label class="text-xs text-muted-foreground mb-1 block">{t('common.search', $locale)}</Label>
        <div class="relative">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
          <Input 
            bind:value={searchQuery} 
            placeholder={t('orders.searchPlaceholder', $locale)}
            class="pl-9"
          />
        </div>
      </div>
      
      <!-- Date Filter Buttons -->
      <div>
        <Label class="text-xs text-muted-foreground mb-1 block">{t('orders.period', $locale)}</Label>
        <div class="flex gap-1">
          <Button 
            variant={dateFilter === 'today' ? 'default' : 'outline'} 
            size="sm"
            on:click={() => { dateFilter = 'today'; startDate = ''; endDate = ''; currentPage = 1; }}
          >
            {t('orders.today', $locale)}
          </Button>
          <Button 
            variant={dateFilter === 'week' ? 'default' : 'outline'} 
            size="sm"
            on:click={() => { dateFilter = 'week'; startDate = ''; endDate = ''; currentPage = 1; }}
          >
            {t('orders.week', $locale)}
          </Button>
          <Button 
            variant={dateFilter === 'month' ? 'default' : 'outline'} 
            size="sm"
            on:click={() => { dateFilter = 'month'; startDate = ''; endDate = ''; currentPage = 1; }}
          >
            {t('orders.month', $locale)}
          </Button>
          <Button 
            variant={dateFilter === 'all' ? 'default' : 'outline'} 
            size="sm"
            on:click={() => { dateFilter = 'all'; startDate = ''; endDate = ''; currentPage = 1; }}
          >
            {t('orders.all', $locale)}
          </Button>
        </div>
      </div>
      
      <!-- Status Filter -->
      <div>
        <Label class="text-xs text-muted-foreground mb-1 block">{t('orders.status', $locale)}</Label>
        <div class="flex gap-1">
          <Button 
            variant={statusFilter === 'all' ? 'default' : 'outline'} 
            size="sm"
            on:click={() => { statusFilter = 'all'; currentPage = 1; }}
          >
            {t('catalog.all', $locale)}
          </Button>
          <Button 
            variant={statusFilter === 'paid' ? 'default' : 'outline'} 
            size="sm"
            class={statusFilter === 'paid' ? 'bg-green-500 hover:bg-green-600' : ''}
            on:click={() => { statusFilter = 'paid'; currentPage = 1; }}
          >
            {t('orders.paid', $locale)}
          </Button>
          <Button 
            variant={statusFilter === 'pending' ? 'default' : 'outline'} 
            size="sm"
            class={statusFilter === 'pending' ? 'bg-orange-500 hover:bg-orange-600' : ''}
            on:click={() => { statusFilter = 'pending'; currentPage = 1; }}
          >
            {t('orders.pending', $locale)}
          </Button>
          <Button 
            variant={statusFilter === 'with_returns' ? 'default' : 'outline'} 
            size="sm"
            class={statusFilter === 'with_returns' ? 'bg-red-500 hover:bg-red-600' : ''}
            on:click={() => { statusFilter = 'with_returns'; currentPage = 1; }}
          >
            {t('orders.withReturns', $locale)}
          </Button>
        </div>
      </div>
      
      <!-- Column Toggle -->
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild let:builder>
          <Button builders={[builder]} variant="outline" size="sm" class="inline-flex items-center gap-2">
            <Columns3 size={16} /><span class="hidden sm:inline">{t('catalog.columns', $locale)}</span>
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="end" class="w-48">
          <DropdownMenu.Label>{$locale === 'es' ? 'Mostrar columnas' : 'Toggle columns'}</DropdownMenu.Label>
          <DropdownMenu.Separator />
          <DropdownMenu.CheckboxItem checked={columnVisibility.receipt} onCheckedChange={(v) => columnVisibility.receipt = !!v}>{$locale === 'es' ? 'Recibo' : 'Receipt'}</DropdownMenu.CheckboxItem>
          <DropdownMenu.CheckboxItem checked={columnVisibility.date} onCheckedChange={(v) => columnVisibility.date = !!v}>{$locale === 'es' ? 'Fecha' : 'Date'}</DropdownMenu.CheckboxItem>
          <DropdownMenu.CheckboxItem checked={columnVisibility.customer} onCheckedChange={(v) => columnVisibility.customer = !!v}>{$locale === 'es' ? 'Cliente' : 'Customer'}</DropdownMenu.CheckboxItem>
          <DropdownMenu.CheckboxItem checked={columnVisibility.items} onCheckedChange={(v) => columnVisibility.items = !!v}>{$locale === 'es' ? 'Artículos' : 'Items'}</DropdownMenu.CheckboxItem>
          <DropdownMenu.CheckboxItem checked={columnVisibility.payment} onCheckedChange={(v) => columnVisibility.payment = !!v}>{$locale === 'es' ? 'Pago' : 'Payment'}</DropdownMenu.CheckboxItem>
          <DropdownMenu.CheckboxItem checked={columnVisibility.status} onCheckedChange={(v) => columnVisibility.status = !!v}>{$locale === 'es' ? 'Estado' : 'Status'}</DropdownMenu.CheckboxItem>
          <DropdownMenu.CheckboxItem checked={columnVisibility.total} onCheckedChange={(v) => columnVisibility.total = !!v}>Total</DropdownMenu.CheckboxItem>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
    
    <!-- Custom Date Range -->
    <div class="flex gap-4 mt-4 pt-4 border-t border-border">
      <div>
        <Label class="text-xs text-muted-foreground mb-1 block">{t('orders.fromDate', $locale)}</Label>
        <DatePicker 
          bind:value={startDate}
          on:change={() => { dateFilter = 'all'; currentPage = 1; }}
          placeholder={t('orders.fromDate', $locale)}
          locale={$locale === 'es' ? 'es-DO' : 'en-US'}
          class="w-44"
        />
      </div>
      <div>
        <Label class="text-xs text-muted-foreground mb-1 block">{t('orders.toDate', $locale)}</Label>
        <DatePicker 
          bind:value={endDate}
          on:change={() => { dateFilter = 'all'; currentPage = 1; }}
          placeholder={t('orders.toDate', $locale)}
          locale={$locale === 'es' ? 'es-DO' : 'en-US'}
          class="w-44"
        />
      </div>
    </div>
  </div>
  
  <!-- Bulk Actions Bar -->
  {#if selectedIds.size > 0}
    <div class="flex items-center gap-4 px-4 py-3 mb-4 bg-primary/10 border border-primary/20 rounded-xl">
      <span class="text-sm font-medium text-primary">{selectedIds.size} {$locale === 'es' ? 'orden(es) seleccionada(s)' : 'order(s) selected'}</span>
      <div class="flex items-center gap-2 ml-auto">
        <Button variant="outline" size="sm" on:click={exportOrders} class="text-primary bg-primary/10 hover:bg-primary/20">
          <Download size={14} class="mr-1" />
          {$locale === 'es' ? 'Exportar' : 'Export'} ({selectedIds.size})
        </Button>
        <Button variant="ghost" size="sm" on:click={clearSelection}>{$locale === 'es' ? 'Limpiar selección' : 'Clear selection'}</Button>
      </div>
    </div>
  {/if}

  <!-- Orders Table -->
  {#if loading}
    <div class="text-center py-12">
      <div class="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
      <p class="text-muted-foreground">{t('common.loading', $locale)}</p>
    </div>
  {:else if paginatedSales.length === 0}
    <div class="text-center py-12 bg-card border border-border rounded-xl">
      <Package size={48} class="mx-auto mb-4 text-muted-foreground opacity-20" />
      <p class="text-lg font-medium text-muted-foreground">{t('orders.noOrders', $locale)}</p>
      <p class="text-sm text-muted-foreground">{t('orders.noOrdersDescription', $locale)}</p>
    </div>
  {:else}
    <Card.Root class="overflow-hidden shadow-sm">
      <Card.Content class="p-0">
        <Table.Root>
          <Table.Header class="bg-muted/50">
            <Table.Row class="hover:bg-muted/50">
              <Table.Head class="w-12">
                <Checkbox checked={bulkSelectionState} onCheckedChange={toggleSelectAll} aria-label="Select all" />
              </Table.Head>
              {#if columnVisibility.receipt}
                <Table.Head>
                  <button class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors" on:click={() => toggleSort('receipt')}>
                    {$locale === 'es' ? 'Recibo' : 'Receipt'}
                    {#if sortColumn === 'receipt'}
                      {#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}
                    {:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
                  </button>
                </Table.Head>
              {/if}
              {#if columnVisibility.date}
                <Table.Head>
                  <button class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors" on:click={() => toggleSort('date')}>
                    {$locale === 'es' ? 'Fecha' : 'Date'}
                    {#if sortColumn === 'date'}
                      {#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}
                    {:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
                  </button>
                </Table.Head>
              {/if}
              {#if columnVisibility.customer}
                <Table.Head>
                  <button class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors" on:click={() => toggleSort('customer')}>
                    {$locale === 'es' ? 'Cliente' : 'Customer'}
                    {#if sortColumn === 'customer'}
                      {#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}
                    {:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
                  </button>
                </Table.Head>
              {/if}
              {#if columnVisibility.items}
                <Table.Head class="text-center">
                  <button class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors mx-auto" on:click={() => toggleSort('items')}>
                    {$locale === 'es' ? 'Items' : 'Items'}
                    {#if sortColumn === 'items'}
                      {#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}
                    {:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
                  </button>
                </Table.Head>
              {/if}
              {#if columnVisibility.payment}
                <Table.Head class="text-xs uppercase tracking-wider">{$locale === 'es' ? 'Pago' : 'Payment'}</Table.Head>
              {/if}
              {#if columnVisibility.status}
                <Table.Head class="text-xs uppercase tracking-wider">{$locale === 'es' ? 'Estado' : 'Status'}</Table.Head>
              {/if}
              {#if columnVisibility.total}
                <Table.Head class="text-right">
                  <button class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition-colors ml-auto" on:click={() => toggleSort('total')}>
                    Total
                    {#if sortColumn === 'total'}
                      {#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}
                    {:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
                  </button>
                </Table.Head>
              {/if}
              {#if columnVisibility.actions}
                <Table.Head class="text-xs uppercase tracking-wider text-center">{$locale === 'es' ? 'Acciones' : 'Actions'}</Table.Head>
              {/if}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each paginatedSales as sale}
              {@const isSelected = sale.id && selectedIds.has(sale.id)}
              {@const statusBadge = getPaymentStatusBadge(sale)}
              <Table.Row class="group {isSelected ? 'bg-primary/5' : ''}">
                <Table.Cell class="w-12">
                  <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(sale)} aria-label="Select row" />
                </Table.Cell>
                {#if columnVisibility.receipt}
                  <Table.Cell>
                    <div class="flex items-center gap-2">
                      <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Receipt size={14} class="text-primary" />
                      </div>
                      <div>
                        <span class="font-bold">#{sale.receiptNumber}</span>
                        {#if sale.hasReturns}
                          <Badge variant="outline" class="ml-2 text-xs bg-red-500/10 text-red-500 border-red-500/30">
                            <RotateCcw size={10} class="mr-1" />
                          </Badge>
                        {/if}
                      </div>
                    </div>
                  </Table.Cell>
                {/if}
                {#if columnVisibility.date}
                  <Table.Cell>
                    <div class="text-sm">{formatDate(sale.date)}</div>
                    <div class="text-xs text-muted-foreground">{formatTime(sale.createdAt)}</div>
                  </Table.Cell>
                {/if}
                {#if columnVisibility.customer}
                  <Table.Cell>
                    <span class="text-sm">{sale.customerName || ($locale === 'es' ? 'Contado' : 'Cash')}</span>
                  </Table.Cell>
                {/if}
                {#if columnVisibility.items}
                  <Table.Cell class="text-center">
                    <span class="font-mono font-bold">{sale.items.length}</span>
                  </Table.Cell>
                {/if}
                {#if columnVisibility.payment}
                  <Table.Cell>
                    <div class="flex items-center gap-1 text-sm text-muted-foreground">
                      {#if sale.paymentMethod === 'cash'}
                        <Banknote size={14} />
                      {:else if sale.paymentMethod === 'credit_card' || sale.paymentMethod === 'debit_card'}
                        <CreditCard size={14} />
                      {:else}
                        <Receipt size={14} />
                      {/if}
                      <span>{getPaymentMethodLabel(sale.paymentMethod, sale.paymentStatus === 'pending' && !sale.paidAmount)}</span>
                    </div>
                  </Table.Cell>
                {/if}
                {#if columnVisibility.status}
                  <Table.Cell>
                    <Badge variant="outline" class={statusBadge.class}>{statusBadge.text}</Badge>
                  </Table.Cell>
                {/if}
                {#if columnVisibility.total}
                  <Table.Cell class="text-right">
                    <div class="font-bold text-primary">{formatCurrency(sale.total)}</div>
                    {#if sale.returnedAmount && sale.returnedAmount > 0}
                      <div class="text-xs text-red-500">-{formatCurrency(sale.returnedAmount)}</div>
                    {/if}
                  </Table.Cell>
                {/if}
                {#if columnVisibility.actions}
                  <Table.Cell>
                    <div class="flex justify-center space-x-1">
                      <Button variant="ghost" size="icon" class="h-8 w-8" on:click={() => viewOrder(sale)}>
                        <Eye size={16} />
                      </Button>
                      <Button variant="ghost" size="icon" class="h-8 w-8" on:click={() => printReceipt(sale)}>
                        <Printer size={16} />
                      </Button>
                      {#if canEditPaymentMethod(sale)}
                        <Button
                          variant="ghost"
                          size="icon"
                          class="h-8 w-8 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                          on:click={() => openEditPaymentModal(sale)}
                        >
                          <PenLine size={16} />
                        </Button>
                      {/if}
                      {#if $userPermissions.has('pos.process_return') && canProcessReturn(sale)}
                        <Button variant="ghost" size="icon" class="h-8 w-8 text-orange-500 hover:text-orange-600 hover:bg-orange-500/10" on:click={() => openReturnModal(sale)}>
                          <RotateCcw size={16} />
                        </Button>
                      {/if}
                    </div>
                  </Table.Cell>
                {/if}
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </Card.Content>
    </Card.Root>
    
    <!-- Pagination -->
    {#if sortedSales.length > 0}
      <div class="flex items-center justify-between px-2 py-4">
        <div class="text-sm text-muted-foreground">{sortedSales.length} {$locale === 'es' ? 'orden(es) en total' : 'order(s) total'}.</div>
        <div class="flex items-center space-x-6">
          <div class="flex items-center space-x-2">
            <span class="text-sm text-muted-foreground">{$locale === 'es' ? 'Por página' : 'Per page'}</span>
            <Select.Root selected={{ value: String(pageSize), label: String(pageSize) }} onSelectedChange={(v) => { if (v?.value) { pageSize = Number(v.value); currentPage = 1; } }}>
              <Select.Trigger class="h-8 w-[70px]"><Select.Value /></Select.Trigger>
              <Select.Content side="top">
                {#each [10, 20, 30, 50, 100] as size}<Select.Item value={String(size)} label={String(size)}>{size}</Select.Item>{/each}
              </Select.Content>
            </Select.Root>
          </div>
          <div class="text-sm font-medium">{t('orders.page', $locale)} {currentPage} {t('orders.of', $locale)} {pageCount}</div>
          <div class="flex items-center space-x-2">
            <Button variant="outline" size="icon" class="h-8 w-8" disabled={currentPage === 1} on:click={() => currentPage = 1}>«</Button>
            <Button variant="outline" size="icon" class="h-8 w-8" disabled={currentPage === 1} on:click={() => currentPage--}>‹</Button>
            <Button variant="outline" size="icon" class="h-8 w-8" disabled={currentPage >= pageCount} on:click={() => currentPage++}>›</Button>
            <Button variant="outline" size="icon" class="h-8 w-8" disabled={currentPage >= pageCount} on:click={() => currentPage = pageCount}>»</Button>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<!-- Order Detail Modal -->
<Dialog.Root bind:open={showDetailModal}>
  <Dialog.Content class="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
    {#if selectedSale}
      <Dialog.Header>
        <Dialog.Title class="flex items-center gap-2">
          <Receipt size={20} class="text-primary" />
          {t('orders.orderDetails', $locale)} #{selectedSale.receiptNumber}
        </Dialog.Title>
        <Dialog.Description>
          {formatDate(selectedSale.date)} • {formatTime(selectedSale.createdAt)}
        </Dialog.Description>
      </Dialog.Header>
      
      <div class="flex-1 overflow-y-auto py-4 space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-muted/50 rounded-lg p-3">
            <div class="text-xs text-muted-foreground uppercase mb-1">{t('sales.customer', $locale)}</div>
            <div class="font-medium">{selectedSale.customerName || t('sales.cashSale', $locale)}</div>
          </div>
          <div class="bg-muted/50 rounded-lg p-3">
            <div class="text-xs text-muted-foreground uppercase mb-1">{t('sales.payment', $locale)}</div>
            <div class="font-medium">{getPaymentMethodLabel(selectedSale.paymentMethod, selectedSale.paymentStatus === 'pending')}</div>
          </div>
        </div>
        
        <div>
          <h4 class="font-bold mb-2">{t('orders.items', $locale)}</h4>
          <div class="border border-border rounded-lg divide-y divide-border">
            {#each selectedSale.items as item, idx}
              <div class="p-3 flex items-center gap-4">
                <div class="w-8 h-8 bg-muted rounded flex items-center justify-center text-sm font-bold">{idx + 1}</div>
                <div class="flex-1">
                  <div class="font-medium">{item.description}</div>
                  <div class="text-sm text-muted-foreground">
                    {formatCurrency(item.unitPrice)} × {item.quantity}
                  </div>
                </div>
                <div class="font-bold">{formatCurrency(item.amount)}</div>
              </div>
            {/each}
          </div>
        </div>
        
        <div class="bg-muted/50 rounded-lg p-4">
          <div class="space-y-2">
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">{t('sales.subtotal', $locale)}</span>
              <span>{formatCurrency(selectedSale.subtotal)}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">{t('sales.itbis', $locale)} (18%)</span>
              <span>{formatCurrency(selectedSale.itbisTotal)}</span>
            </div>
            {#if selectedSale.discount > 0}
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">{t('orders.discount', $locale)}</span>
                <span class="text-green-500">-{formatCurrency(selectedSale.discount)}</span>
              </div>
            {/if}
            {#if selectedSale.returnedAmount && selectedSale.returnedAmount > 0}
              <div class="flex justify-between text-sm">
                <span class="text-red-500">{t('orders.returned', $locale)}</span>
                <span class="text-red-500">-{formatCurrency(selectedSale.returnedAmount)}</span>
              </div>
            {/if}
            <Separator />
            <div class="flex justify-between text-lg font-bold">
              <span>{t('sales.total', $locale)}</span>
              <span class="text-primary">{formatCurrency(selectedSale.total)}</span>
            </div>
          </div>
        </div>
        
        {#if saleReturns.length > 0}
          <div>
            <h4 class="font-bold mb-2 flex items-center gap-2 text-red-500">
              <RotateCcw size={16} />
              {t('orders.returnsHistory', $locale)}
            </h4>
            <div class="space-y-2">
              {#each saleReturns as ret}
                <div class="border border-red-500/30 bg-red-500/5 rounded-lg p-3">
                  <div class="flex justify-between items-start mb-2">
                    <div>
                      <div class="text-sm font-medium">{t('returns.returnNumber', $locale)} #{ret.id}</div>
                      <div class="text-xs text-muted-foreground">{formatDate(ret.date)} • {getReturnReasonLabel(ret.reason)}</div>
                    </div>
                    <div class="text-red-500 font-bold">-{formatCurrency(ret.total)}</div>
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {ret.items.length} {ret.items.length === 1 ? t('sales.item', $locale) : t('sales.items', $locale)}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
      
      <Dialog.Footer class="flex gap-2">
        <Button variant="outline" on:click={() => selectedSale && printReceipt(selectedSale)}>
          <Printer size={16} class="mr-2" />
          {t('sales.print', $locale)}
        </Button>
        {#if canEditPaymentMethod(selectedSale)}
          <Button
            variant="outline"
            class="text-blue-500 hover:text-blue-600"
            on:click={() => selectedSale && openEditPaymentModal(selectedSale)}
          >
            <PenLine size={16} class="mr-2" />
            {$locale === 'es' ? 'Editar pago' : 'Edit payment'}
          </Button>
        {/if}
        {#if $userPermissions.has('pos.process_return') && canProcessReturn(selectedSale)}
          <Button variant="outline" class="text-orange-500 hover:text-orange-600" on:click={() => {
            const sale = selectedSale;
            if (!sale) return;
            closeDetailModal();
            openReturnModal(sale);
          }}>
            <RotateCcw size={16} class="mr-2" />
            {t('returns.processReturn', $locale)}
          </Button>
        {/if}
        <Button on:click={closeDetailModal}>{t('common.close', $locale)}</Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<!-- Return Processing Modal -->
<Dialog.Root bind:open={showReturnModal} onOpenChange={(open) => { if (!open && !returnComplete) closeReturnModal(); }}>
  <Dialog.Content class="max-w-xl max-h-[90vh] overflow-hidden flex flex-col">
    {#if returnComplete && lastReturn}
      <div class="text-center py-8">
        <div class="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={48} class="text-green-500" />
        </div>
        <h3 class="text-2xl font-bold mb-2">{t('returns.returnComplete', $locale)}</h3>
        <p class="text-muted-foreground mb-1">
          {t('returns.returnNumber', $locale)} <span class="font-mono font-bold">#{lastReturn.id}</span>
        </p>
        <div class="text-3xl font-bold text-orange-500 mb-6">{formatCurrency(returnTotal)}</div>
        
        <div class="bg-muted/50 rounded-lg p-4 mb-6 text-left">
          <div class="text-sm text-muted-foreground mb-2">
            {t('returns.refundInfo', $locale)
              .replace('{amount}', formatCurrency(returnTotal))
              .replace('{method}', getPaymentMethodLabel(returnRefundMethod, false))}
          </div>
          <div class="text-sm">{t('returns.stockRestored', $locale)}</div>
        </div>
        
        <Button variant="default" class="w-full h-12" on:click={closeReturnModal}>
          {t('common.close', $locale)}
        </Button>
      </div>
    {:else if returnSale}
      <Dialog.Header>
        <Dialog.Title class="flex items-center gap-2">
          <RotateCcw size={20} class="text-orange-500" />
          {t('returns.processReturn', $locale)}
        </Dialog.Title>
        <Dialog.Description>
          {t('orders.orderDetails', $locale)} #{returnSale.receiptNumber}
        </Dialog.Description>
      </Dialog.Header>
      
      <div class="flex-1 overflow-y-auto py-4 space-y-4">
        {#if returnItems.length > 0}
          <div>
            <Label class="text-sm font-medium mb-2 block">{t('returns.selectItemsToReturn', $locale)}</Label>
            <div class="space-y-2">
              {#each returnItems as ri}
                <div 
                  class="border rounded-lg p-3 transition-colors cursor-pointer {ri.selected ? 'border-orange-500 bg-orange-500/5' : 'border-border hover:border-muted-foreground'}"
                  on:click={() => toggleReturnItem(ri.index)}
                  on:keydown={(e) => e.key === 'Enter' && toggleReturnItem(ri.index)}
                  role="button"
                  tabindex="0"
                >
                  <div class="flex items-start gap-3">
                    <div class="w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 shrink-0 {ri.selected ? 'border-orange-500 bg-orange-500' : 'border-muted-foreground'}">
                      {#if ri.selected}
                        <CheckCircle2 size={12} class="text-white" />
                      {/if}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-sm">{ri.item.description}</div>
                      <div class="text-xs text-muted-foreground">
                        {formatCurrency(ri.item.unitPrice)} × {ri.item.quantity} = {formatCurrency(ri.item.amount)}
                      </div>
                      <div class="text-xs text-muted-foreground">
                        {t('returns.maxQty', $locale).replace('{qty}', String(ri.maxQty))}
                      </div>
                    </div>
                    {#if ri.selected}
                      <div class="flex items-center gap-1" on:click|stopPropagation on:keydown|stopPropagation role="none">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          class="h-7 w-7"
                          on:click={() => updateReturnQty(ri.index, ri.returnQty - 1)}
                        >
                          <Minus size={12} />
                        </Button>
                        <input 
                          type="number" 
                          value={ri.returnQty}
                          on:change={(e) => updateReturnQty(ri.index, parseInt(e.currentTarget.value) || 0)}
                          class="w-12 h-7 text-center text-sm font-bold bg-transparent border border-border rounded-md"
                          min="1"
                          max={ri.maxQty}
                        />
                        <Button 
                          variant="outline" 
                          size="icon" 
                          class="h-7 w-7"
                          on:click={() => updateReturnQty(ri.index, ri.returnQty + 1)}
                        >
                          <Plus size={12} />
                        </Button>
                      </div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </div>
          
          {#if selectedReturnItems.length > 0}
            <div>
              <Label class="text-sm font-medium mb-2 block">{t('returns.reason', $locale)}</Label>
              <Select.Root 
                selected={{ value: returnReason, label: getReturnReasonLabel(returnReason) }}
                onSelectedChange={(v) => { if (v?.value) setReturnReason(v.value); }}
              >
                <Select.Trigger class="w-full">
                  <Select.Value placeholder={t('returns.reason', $locale)} />
                </Select.Trigger>
                <Select.Content>
                  <Select.Item value="defective" label={getReturnReasonLabel('defective')} />
                  <Select.Item value="wrong_item" label={getReturnReasonLabel('wrong_item')} />
                  <Select.Item value="customer_changed_mind" label={getReturnReasonLabel('customer_changed_mind')} />
                  <Select.Item value="damaged" label={getReturnReasonLabel('damaged')} />
                  <Select.Item value="expired" label={getReturnReasonLabel('expired')} />
                  <Select.Item value="other" label={getReturnReasonLabel('other')} />
                </Select.Content>
              </Select.Root>
            </div>
            
            <div>
              <Label class="text-sm font-medium mb-2 block">{t('returns.reasonNotes', $locale)}</Label>
              <Input 
                bind:value={returnNotes}
                placeholder={$locale === 'es' ? 'Notas adicionales (opcional)' : 'Additional notes (optional)'}
              />
            </div>
            
            <div>
              <Label class="text-sm font-medium mb-2 block">{t('returns.refundMethod', $locale)}</Label>
              <div class="grid grid-cols-3 gap-2">
                <Button 
                  variant={returnRefundMethod === 'cash' ? 'default' : 'outline'} 
                  class="h-12 flex-col gap-1 text-xs"
                  on:click={() => returnRefundMethod = 'cash'}
                >
                  <Banknote size={16} />
                  {t('sales.cash', $locale)}
                </Button>
                <Button 
                  variant={returnRefundMethod === 'credit_card' ? 'default' : 'outline'} 
                  class="h-12 flex-col gap-1 text-xs"
                  on:click={() => returnRefundMethod = 'credit_card'}
                >
                  <CreditCard size={16} />
                  {t('sales.card', $locale)}
                </Button>
                <Button 
                  variant={returnRefundMethod === 'bank_transfer' ? 'default' : 'outline'} 
                  class="h-12 flex-col gap-1 text-xs"
                  on:click={() => returnRefundMethod = 'bank_transfer'}
                >
                  <Receipt size={16} />
                  {t('sales.transfer', $locale)}
                </Button>
              </div>
            </div>
            
            <div class="bg-orange-500/10 rounded-lg p-4">
              <div class="space-y-2">
                <div class="flex justify-between text-sm">
                  <span class="text-muted-foreground">{t('sales.subtotal', $locale)}</span>
                  <span>{formatCurrency(returnSubtotal)}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-muted-foreground">{t('sales.itbis', $locale)} (18%)</span>
                  <span>{formatCurrency(returnItbisTotal)}</span>
                </div>
                <Separator />
                <div class="flex justify-between text-lg font-bold">
                  <span>{t('returns.refundAmount', $locale)}</span>
                  <span class="text-orange-500">{formatCurrency(returnTotal)}</span>
                </div>
              </div>
            </div>
          {/if}
        {:else}
          <div class="text-center py-8 text-muted-foreground">
            <RotateCcw size={48} class="mx-auto mb-4 opacity-20" />
            <p>{$locale === 'es' ? 'Todos los artículos ya fueron devueltos' : 'All items have already been returned'}</p>
          </div>
        {/if}
      </div>
      
      {#if selectedReturnItems.length > 0}
        <Dialog.Footer>
          <Button variant="outline" on:click={closeReturnModal}>{t('common.cancel', $locale)}</Button>
          <Button 
            variant="default" 
            class="bg-orange-500 hover:bg-orange-600"
            on:click={processReturn}
            disabled={returnProcessing}
          >
            {#if returnProcessing}
              <div class="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2"></div>
            {:else}
              <RotateCcw size={16} class="mr-2" />
            {/if}
            {t('returns.processReturnBtn', $locale)}
          </Button>
        </Dialog.Footer>
      {/if}
    {/if}
  </Dialog.Content>
</Dialog.Root>

<!-- Edit Payment Modal -->
<Dialog.Root bind:open={showEditPaymentModal} onOpenChange={(open) => { if (!open) closeEditPaymentModal(); }}>
  <Dialog.Content class="max-w-md">
    {#if paymentSale}
      <Dialog.Header>
        <Dialog.Title class="flex items-center gap-2">
          <PenLine size={18} class="text-blue-500" />
          {$locale === 'es' ? 'Editar método de pago' : 'Edit payment method'}
        </Dialog.Title>
        <Dialog.Description>
          {t('orders.orderDetails', $locale)} #{paymentSale.receiptNumber}
        </Dialog.Description>
      </Dialog.Header>

      <div class="space-y-4 py-4">
        <div class="bg-muted/50 rounded-lg p-3 text-sm">
          <div class="flex justify-between">
            <span class="text-muted-foreground">{t('sales.total', $locale)}</span>
            <span class="font-bold text-primary">{formatCurrency(paymentSale.total)}</span>
          </div>
          <div class="flex justify-between text-xs text-muted-foreground mt-1">
            <span>{$locale === 'es' ? 'Actualmente:' : 'Current method:'}</span>
            <span class="font-medium text-foreground">{getPaymentMethodLabel(paymentSale.paymentMethod, false)}</span>
          </div>
        </div>

        <div>
          <Label class="text-sm font-medium mb-2 block">
            {$locale === 'es' ? 'Selecciona el método correcto' : 'Select the correct method'}
          </Label>
          <div class="grid grid-cols-3 gap-2">
            <Button
              variant={paymentMethodDraft === 'cash' ? 'default' : 'outline'}
              class={`h-12 flex-col gap-1 text-xs ${paymentMethodDraft === 'cash' ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
              on:click={() => paymentMethodDraft = 'cash'}
            >
              <Banknote size={16} />
              {t('sales.cash', $locale)}
            </Button>
            <Button
              variant={paymentMethodDraft === 'credit_card' ? 'default' : 'outline'}
              class={`h-12 flex-col gap-1 text-xs ${paymentMethodDraft === 'credit_card' ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
              on:click={() => paymentMethodDraft = 'credit_card'}
            >
              <CreditCard size={16} />
              {t('sales.card', $locale)}
            </Button>
            <Button
              variant={paymentMethodDraft === 'debit_card' ? 'default' : 'outline'}
              class={`h-12 flex-col gap-1 text-xs ${paymentMethodDraft === 'debit_card' ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
              on:click={() => paymentMethodDraft = 'debit_card'}
            >
              <CreditCard size={16} />
              {$locale === 'es' ? 'Débito' : 'Debit'}
            </Button>
          </div>
        </div>

        <p class="text-xs text-muted-foreground">
          {$locale === 'es'
            ? 'Solo disponible para ventas marcadas como pagadas en efectivo o tarjeta.'
            : 'Only available for sales marked as paid with cash or cards.'}
        </p>

        {#if paymentEditError}
          <div class="text-sm text-red-500">{paymentEditError}</div>
        {/if}
      </div>

      <Dialog.Footer>
        <Button variant="outline" on:click={closeEditPaymentModal}>
          {t('common.cancel', $locale)}
        </Button>
        <Button
          class="bg-blue-500 hover:bg-blue-600"
          disabled={paymentEditProcessing}
          on:click={savePaymentMethodChange}
        >
          {#if paymentEditProcessing}
            <div class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
          {:else}
            <PenLine size={16} class="mr-2" />
          {/if}
          {$locale === 'es' ? 'Guardar cambios' : 'Save changes'}
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<!-- Receipt Modal -->
{#if showReceipt && receiptSale}
  <SaleReceipt 
    sale={receiptSale}
    shift={$activeShift}
    cashReceived={receiptSale.paymentMethod === 'cash' ? receiptSale.total : 0}
    change={0}
    onClose={closeReceipt}
  />
{/if}
