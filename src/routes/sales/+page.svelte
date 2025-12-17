<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import { db, generateId } from '$lib/db';
  import { 
    Search, Plus, Minus, Trash2, ShoppingCart, User, CreditCard, Banknote, 
    Receipt, Sparkles, AlertTriangle, X, CheckCircle2, Clock, Printer,
    Grid3X3, List, Scan, Home, ChevronLeft, Package, RotateCcw, Hash,
    Truck, MapPin, Phone, FileText, CircleDot
  } from 'lucide-svelte';
  import type { Product, Customer, Sale, InvoiceItem, StockMovement, Payment, PaymentMethodType, CashRegisterShift, Return, ReturnItem } from '$lib/types';
import { getCartItemBreakdown, ITBIS_RATE, getProductCostExTax } from '$lib/tax';
import { consumeFIFO, getActiveLots, getAvailableQuantity, restoreConsumptionForReturn } from '$lib/fifo';
import { recordSaleITBIS, reverseSaleITBIS } from '$lib/itbis';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Select from '$lib/components/ui/select';
  import * as Card from '$lib/components/ui/card';
  import * as Tooltip from '$lib/components/ui/tooltip';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Separator } from '$lib/components/ui/separator';
  import { locale, activeShift, activeShiftId, hasActiveShift, isPosMode } from '$lib/stores';
  import { firebaseUser, firebaseUserEmail } from '$lib/firebase';
  import { t } from '$lib/i18n';
  import ShiftManager from '$lib/components/ShiftManager.svelte';
  import SaleReceipt from '$lib/components/SaleReceipt.svelte';
  import { goto } from '$app/navigation';

  // Data
  let products: Product[] = [];
  let customers: Customer[] = [];
  let categories: string[] = [];
  
  // Search & Barcode
  let searchQuery = '';
  let searchResults: Product[] = [];
  let showSearchResults = false;
  let barcodeBuffer = '';
  let barcodeTimeout: ReturnType<typeof setTimeout> | null = null;
  let searchInputRef: HTMLInputElement | any;
  let lastBarcodeTime = 0;
  
  // Product Grid
  let selectedCategory: string | null = null;
  let filteredProducts: Product[] = [];
  let viewMode: 'grid' | 'list' = 'grid';
  
  // Cart
  interface CartItem extends InvoiceItem {
    productRef: Product;
  }
  let cart: CartItem[] = [];
  
  // Selected customer
  let selectedCustomer: Customer | null = null;
  let customerSearchOpen = false;
  
  // Payment
  let paymentMethod: PaymentMethodType = 'cash';
  let isCredit = false;
  let cashReceived = 0;
  
  // Quick cash buttons
  const quickCashAmounts = [100, 200, 500, 1000, 2000];
  
  // Sale confirmation
  let confirmDialogOpen = false;
  let saleComplete = false;
  let lastSaleId: number | null = null;
  let lastSale: Sale | null = null;
  
  // Delivery state
  let isDelivery = false;
  let deliveryDialogOpen = false;
  let deliveryAddress = '';
  let deliveryPhone = '';
  let deliveryNotes = '';
  let pendingDeliveries: Sale[] = [];
  let showPendingDeliveries = false;
  let selectedDelivery: Sale | null = null;
  let completeDeliveryDialogOpen = false;
  let deliveryPaymentMethod: PaymentMethodType = 'cash';
  
  // Receipt
  let showReceipt = false;
  
  // Shift panel visibility
  let showShiftPanel = false;
  
  // Reference to ShiftManager
  let shiftManagerRef: ShiftManager;
  
  // ============ RETURNS STATE ============
  let showReturnPanel = false;
  let returnReceiptSearch = '';
  let returnSearching = false;
  let foundSale: Sale | null = null;
  let returnItems: { item: InvoiceItem; index: number; maxQty: number; returnQty: number; selected: boolean }[] = [];
  let returnReason: Return['reason'] = 'customer_changed_mind';
  let returnNotes = '';
  let returnRefundMethod: PaymentMethodType = 'cash';
  let returnProcessing = false;
  let returnComplete = false;
  let lastReturn: Return | null = null;

  // Enable POS mode on mount, disable on destroy
  onMount(async () => {
    isPosMode.set(true);
    await loadData();
    await loadActiveShift();
    await loadPendingDeliveries();
    
    // Add global keydown listener for barcode scanning
    if (browser) {
      window.addEventListener('keydown', handleBarcodeInput);
    }
  });

  onDestroy(() => {
    isPosMode.set(false);
    if (browser) {
      window.removeEventListener('keydown', handleBarcodeInput);
    }
    if (barcodeTimeout) clearTimeout(barcodeTimeout);
  });

  // Barcode scanner detection
  // Barcode scanners typically send characters very fast (< 50ms between chars)
  // and end with Enter key
  function handleBarcodeInput(event: KeyboardEvent) {
    const now = Date.now();
    const target = event.target as HTMLElement;
    
    // Don't interfere if user is typing in an input field (except search)
    if (target.tagName === 'INPUT' && target !== searchInputRef) {
      return;
    }
    
    // Check if this is rapid input (barcode scanner)
    const timeSinceLastKey = now - lastBarcodeTime;
    lastBarcodeTime = now;
    
    if (event.key === 'Enter') {
      // End of barcode - process it
      if (barcodeBuffer.length >= 4) {
        processBarcodeInput(barcodeBuffer);
      }
      barcodeBuffer = '';
      if (barcodeTimeout) clearTimeout(barcodeTimeout);
      event.preventDefault();
      return;
    }
    
    // Only accept alphanumeric characters for barcode
    if (event.key.length === 1 && /[a-zA-Z0-9]/.test(event.key)) {
      // If it's been more than 100ms since last key, start fresh
      if (timeSinceLastKey > 100) {
        barcodeBuffer = '';
      }
      
      barcodeBuffer += event.key;
      
      // Clear buffer after 100ms of no input
      if (barcodeTimeout) clearTimeout(barcodeTimeout);
      barcodeTimeout = setTimeout(() => {
        // If we have a substantial buffer, it might be a barcode without Enter
        if (barcodeBuffer.length >= 8) {
          processBarcodeInput(barcodeBuffer);
        }
        barcodeBuffer = '';
      }, 100);
      
      // Prevent default if it looks like barcode input (rapid)
      if (timeSinceLastKey < 50 && barcodeBuffer.length > 1) {
        event.preventDefault();
      }
    }
  }

  function processBarcodeInput(barcode: string) {
    const product = products.find(p => 
      p.barcode?.toLowerCase() === barcode.toLowerCase() ||
      p.productId?.toLowerCase() === barcode.toLowerCase()
    );
    
    if (product) {
      addToCart(product);
      showBarcodeSuccess(product.name);
    } else {
      showBarcodeNotFound(barcode);
    }
  }
  
  let barcodeNotification: { show: boolean; message: string; type: 'success' | 'error' } = {
    show: false,
    message: '',
    type: 'success'
  };
  
  function showBarcodeSuccess(productName: string) {
    barcodeNotification = {
      show: true,
      message: `✓ ${productName} ${t('sales.productAdded', $locale)}`,
      type: 'success'
    };
    setTimeout(() => barcodeNotification.show = false, 1500);
  }
  
  function showBarcodeNotFound(barcode: string) {
    barcodeNotification = {
      show: true,
      message: `✗ ${t('sales.productNotFound', $locale)}: ${barcode}`,
      type: 'error'
    };
    setTimeout(() => barcodeNotification.show = false, 2500);
  }

  async function loadData() {
    if (!browser) return;
    products = await db.products.toArray();
    customers = await db.customers.filter(c => c.isActive === true).toArray();
    
    // Extract unique categories
    const categorySet = new Set<string>();
    products.forEach(p => {
      if (p.category) categorySet.add(p.category);
    });
    categories = Array.from(categorySet).sort();
    
    // Initialize filtered products (show all or first category)
    updateFilteredProducts();
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
  
  // ============ DELIVERY FUNCTIONS ============
  
  async function loadPendingDeliveries() {
    if (!browser) return;
    const allSales = await db.sales.toArray();
    pendingDeliveries = allSales.filter(s => 
      s.isDelivery === true && s.paymentStatus === 'delivery'
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
  
  function openDeliveryDialog() {
    if (cart.length === 0) {
      alert($locale === 'es' 
        ? 'Agregue productos al carrito antes de crear un delivery.' 
        : 'Add products to cart before creating a delivery.');
      return;
    }
    deliveryAddress = selectedCustomer?.address || '';
    deliveryPhone = selectedCustomer?.phone || '';
    deliveryNotes = '';
    deliveryDialogOpen = true;
  }
  
  async function createDeliveryOrder() {
    if (!browser) return;
    if (!$activeShift?.id) {
      alert($locale === 'es'
        ? 'Debe abrir un turno antes de crear deliveries.'
        : 'You must open a shift before creating deliveries.');
      return;
    }
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const receiptNumber = await generateReceiptNumber();
    
    // Create delivery order (no stock movement yet - will happen when completed)
    const saleUuid = generateId();
    const sale: Sale = {
      id: saleUuid,
      date: dateStr,
      customerId: selectedCustomer?.id ? String(selectedCustomer.id) : undefined,
      customerName: selectedCustomer?.name,
      items: cart.map(item => ({
        description: item.description,
        productId: item.productId ? String(item.productId) : undefined,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate ?? 0.18,
        priceIncludesTax: item.priceIncludesTax ?? true,
        value: item.value,
        itbis: item.itbis,
        amount: item.amount
      })),
      subtotal,
      discount: 0,
      itbisTotal,
      total,
      paymentMethod: 'cash', // Will be updated when delivery is completed
      paymentStatus: 'delivery',
      paidAmount: 0,
      isDelivery: true,
      deliveryAddress: deliveryAddress || undefined,
      deliveryPhone: deliveryPhone || undefined,
      deliveryNotes: deliveryNotes || undefined,
      shiftId: $activeShift.id,
      receiptNumber,
      createdAt: now
    };
    
    await db.sales.add(sale);
    lastSale = sale;
    
    // Close dialog and show receipt
    deliveryDialogOpen = false;
    saleComplete = true;
    showReceipt = true;
    
    // Clear cart
    cart = [];
    selectedCustomer = null;
    
    // Refresh pending deliveries
    await loadPendingDeliveries();
  }
  
  function openCompleteDeliveryDialog(delivery: Sale) {
    selectedDelivery = delivery;
    deliveryPaymentMethod = 'cash';
    completeDeliveryDialogOpen = true;
  }
  
  async function completeDelivery() {
    if (!browser || !selectedDelivery?.id) return;
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    
    try {
      // Process stock movements (deduct from inventory)
      for (const item of selectedDelivery.items) {
        if (item.productId) {
          const productIdStr = String(item.productId);
          
          // Consume FIFO inventory
          const { totalCost, avgUnitCost } = await consumeFIFO(
            productIdStr,
            item.quantity,
            { saleId: selectedDelivery.id }
          );
          
          // Create stock movement
          const movement: StockMovement = {
            id: generateId(),
            productId: productIdStr,
            type: 'out',
            quantity: item.quantity,
            saleId: selectedDelivery.id,
            date: dateStr,
            notes: `Delivery #${selectedDelivery.receiptNumber}`,
            unitCost: avgUnitCost,
            totalCost: totalCost
          };
          await db.stockMovements.add(movement);
          
          // Update product stock
          const remainingLots = await getActiveLots(productIdStr);
          const lotStock = remainingLots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
          const hasLots = remainingLots.length > 0;
          const product = await db.products.get(productIdStr);
          const newStock = hasLots 
            ? lotStock 
            : Math.max(0, Number(product?.currentStock ?? 0) - Number(item.quantity));
          
          await db.products.update(productIdStr, {
            currentStock: newStock,
            lastStockUpdate: dateStr,
            salesVolume: Number(product?.salesVolume ?? 0) + Number(item.quantity),
            lastSaleDate: dateStr
          });
        }
      }
      
      // Update sale status
      await db.sales.update(selectedDelivery.id, {
        paymentMethod: deliveryPaymentMethod,
        paymentStatus: 'paid',
        paidAmount: selectedDelivery.total,
        deliveredAt: now
      });
      
      // Create payment record
      const payment: Payment = {
        id: generateId(),
        saleId: selectedDelivery.id,
        customerId: selectedDelivery.customerId,
        amount: selectedDelivery.total,
        currency: 'DOP',
        paymentDate: dateStr,
        paymentMethod: deliveryPaymentMethod,
        notes: `Delivery payment #${selectedDelivery.receiptNumber}`,
        createdAt: now
      };
      await db.payments.add(payment);
      
      // Record ITBIS
      try {
        await recordSaleITBIS({ ...selectedDelivery, paymentStatus: 'paid' });
      } catch (e) {
        console.error('Error recording ITBIS:', e);
      }
      
      // Close dialog and refresh
      completeDeliveryDialogOpen = false;
      selectedDelivery = null;
      await loadPendingDeliveries();
      
      if (shiftManagerRef) {
        await shiftManagerRef.refreshSales();
      }
      
      alert($locale === 'es' ? '¡Delivery completado!' : 'Delivery completed!');
    } catch (e) {
      console.error('Error completing delivery:', e);
      alert($locale === 'es' 
        ? 'Error al completar el delivery. Intente nuevamente.' 
        : 'Error completing delivery. Please try again.');
    }
  }
  
  async function cancelDelivery(delivery: Sale) {
    if (!delivery.id) return;
    
    const confirmCancel = confirm($locale === 'es'
      ? `¿Cancelar delivery #${delivery.receiptNumber}? Esta acción no se puede deshacer.`
      : `Cancel delivery #${delivery.receiptNumber}? This action cannot be undone.`);
    
    if (!confirmCancel) return;
    
    await db.sales.update(delivery.id, {
      paymentStatus: 'pending',
      notes: (delivery.notes || '') + '\n[CANCELLED]'
    });
    
    await loadPendingDeliveries();
  }

  // Update filtered products based on category
  function updateFilteredProducts() {
    if (selectedCategory) {
      filteredProducts = products.filter(p => p.category === selectedCategory);
    } else {
      // Show top selling or all products
      filteredProducts = products
        .filter(p => (p.currentStock ?? 0) > 0)
        .sort((a, b) => (b.salesVolume ?? 0) - (a.salesVolume ?? 0))
        .slice(0, 40);
    }
  }
  
  $: {
    selectedCategory;
    updateFilteredProducts();
  }

  // Generate next receipt number for the current shift
  async function generateReceiptNumber(): Promise<string> {
    if (!$activeShift?.id) return '000001';
    
    const shiftSales = await db.sales.where('shiftId').equals($activeShift.id).count();
    return String(shiftSales + 1).padStart(6, '0');
  }

  // Search products
  $: {
    if (searchQuery.length >= 2) {
      const query = searchQuery.toLowerCase();
      searchResults = products.filter(p => 
        p.name.toLowerCase().includes(query) ||
        p.barcode?.toLowerCase().includes(query) ||
        p.productId?.toLowerCase().includes(query)
      ).slice(0, 10);
      showSearchResults = true;
    } else {
      searchResults = [];
      showSearchResults = false;
    }
  }
  
  // Cart totals
  $: subtotal = cart.reduce((sum, item) => sum + item.value, 0);
  $: itbisTotal = cart.reduce((sum, item) => sum + item.itbis, 0);
  $: total = cart.reduce((sum, item) => sum + item.amount, 0);
  $: change = Math.max(0, cashReceived - total);
  
  function addToCart(product: Product) {
    // Check if shift is active
    if (!$hasActiveShift) {
      showShiftPanel = true;
      return;
    }
    
    // Check stock
    if ((product.currentStock ?? 0) <= 0) {
      return;
    }
    
    const existing = cart.find(item => item.productRef.id === product.id);
    
    if (existing) {
      // Check if we can add more
      const stock = product.currentStock ?? 0;
      if (existing.quantity >= stock) {
        return;
      }
      
      existing.quantity += 1;
      // Recalculate using proper tax handling
      const breakdown = getCartItemBreakdown(existing.productRef, existing.quantity, existing.unitPrice);
      existing.value = breakdown.value;
      existing.itbis = breakdown.itbis;
      existing.amount = breakdown.amount;
      existing.taxRate = breakdown.taxRate; // Ensure taxRate is always set
      existing.priceIncludesTax = breakdown.priceIncludesTax;
      cart = [...cart];
    } else {
      // Use the tax utility to properly calculate values based on product tax configuration
      const breakdown = getCartItemBreakdown(product, 1);
      
      cart = [...cart, {
        description: product.name,
        productId: product.id?.toString(),
        quantity: 1,
        unitPrice: breakdown.unitPrice,
        taxRate: breakdown.taxRate,
        priceIncludesTax: breakdown.priceIncludesTax,
        value: breakdown.value,
        itbis: breakdown.itbis,
        amount: breakdown.amount,
        productRef: product
      }];
    }
    
    searchQuery = '';
    showSearchResults = false;
  }
  
  function updateQuantity(index: number, delta: number) {
    const item = cart[index];
    const newQty = item.quantity + delta;
    
    if (newQty <= 0) {
      removeFromCart(index);
      return;
    }
    
    // Check stock
    const stock = item.productRef.currentStock ?? 0;
    if (newQty > stock) {
      return;
    }
    
    item.quantity = newQty;
    // Recalculate using proper tax handling
    const breakdown = getCartItemBreakdown(item.productRef, item.quantity, item.unitPrice);
    item.value = breakdown.value;
    item.itbis = breakdown.itbis;
    item.amount = breakdown.amount;
    item.taxRate = breakdown.taxRate; // Ensure taxRate is always set
    item.priceIncludesTax = breakdown.priceIncludesTax;
    cart = [...cart];
  }
  
  function setQuantity(index: number, qty: number) {
    const item = cart[index];
    const stock = item.productRef.currentStock ?? 0;
    const newQty = Math.max(1, Math.min(qty, stock));
    
    item.quantity = newQty;
    // Recalculate using proper tax handling
    const breakdown = getCartItemBreakdown(item.productRef, item.quantity, item.unitPrice);
    item.value = breakdown.value;
    item.itbis = breakdown.itbis;
    item.amount = breakdown.amount;
    item.taxRate = breakdown.taxRate; // Ensure taxRate is always set
    item.priceIncludesTax = breakdown.priceIncludesTax;
    cart = [...cart];
  }
  
  function removeFromCart(index: number) {
    cart = cart.filter((_, i) => i !== index);
  }
  
  function clearCart() {
    cart = [];
    selectedCustomer = null;
    paymentMethod = 'cash';
    isCredit = false;
    cashReceived = 0;
  }
  
  function selectCustomer(customer: Customer) {
    selectedCustomer = customer;
    customerSearchOpen = false;
  }
  
  function clearCustomer() {
    selectedCustomer = null;
  }
  
async function openConfirmDialog() {
    if (!$hasActiveShift) {
      showShiftPanel = true;
      return;
    }
    
    if (cart.length === 0) {
      return;
    }
    
    try {
      // Ensure each item has a tax rate set (check this first, before async operations)
      for (const item of cart) {
        // If taxRate is missing, recalculate from product
        if (item.taxRate === undefined || item.taxRate === null) {
          const breakdown = getCartItemBreakdown(item.productRef, item.quantity, item.unitPrice);
          item.taxRate = breakdown.taxRate;
          item.priceIncludesTax = breakdown.priceIncludesTax;
          item.value = breakdown.value;
          item.itbis = breakdown.itbis;
          item.amount = breakdown.amount;
        }
      }
      
      // Validate stock against FIFO lots to prevent negative inventory
      for (const item of cart) {
        if (!item.productRef.id) continue;
        try {
          const available = await getAvailableQuantity(item.productRef.id);
          if (item.quantity > available) {
            alert($locale === 'es'
              ? `Stock insuficiente para ${item.description}. Disponible: ${available}, solicitado: ${item.quantity}.`
              : `Not enough stock for ${item.description}. Available: ${available}, requested: ${item.quantity}.`);
            return;
          }
        } catch (e) {
          console.error(`Error checking stock for ${item.description}:`, e);
          // If we can't check stock, use currentStock as fallback
          const currentStock = item.productRef.currentStock ?? 0;
          if (item.quantity > currentStock) {
            alert($locale === 'es'
              ? `Stock insuficiente para ${item.description}. Disponible: ${currentStock}, solicitado: ${item.quantity}.`
              : `Not enough stock for ${item.description}. Available: ${currentStock}, requested: ${item.quantity}.`);
            return;
          }
        }
      }
      
      // For credit sales, require a customer
      if (isCredit && !selectedCustomer) {
        alert($locale === 'es'
          ? 'Debe seleccionar un cliente para ventas a crédito.'
          : 'You must select a customer for credit sales.');
        return;
      }
      
      // Check credit limit
      if (isCredit && selectedCustomer) {
        const limit = selectedCustomer.creditLimit ?? 0;
        const balance = selectedCustomer.currentBalance ?? 0;
        if (limit > 0 && (balance + total) > limit) {
          alert($locale === 'es'
            ? `El cliente ha excedido su límite de crédito. Límite: $${limit.toLocaleString()}, Balance actual: $${balance.toLocaleString()}, Total venta: $${total.toLocaleString()}`
            : `Customer has exceeded credit limit. Limit: $${limit.toLocaleString()}, Current balance: $${balance.toLocaleString()}, Sale total: $${total.toLocaleString()}`);
          return;
        }
      }
      
      // All validations passed - show confirmation dialog
      confirmDialogOpen = true;
    } catch (e) {
      console.error('Error in openConfirmDialog:', e);
      alert($locale === 'es' 
        ? 'Error al validar la venta. Por favor intente nuevamente.'
        : 'Error validating sale. Please try again.');
    }
  }
  
  async function confirmSale() {
    try {
      if (!browser) return;
      if (!$activeShift?.id) {
        alert($locale === 'es' 
          ? 'Debe abrir un turno antes de realizar ventas. Vaya a Configuración > Gestión de Turnos.'
          : 'You must open a shift before making sales. Go to Settings > Shift Management.');
        console.error('Cannot create sale: No active shift');
        return;
      }
      
      // Ensure tax rate is present (fallback to recalculation)
      for (const item of cart) {
        if (item.taxRate === undefined || item.taxRate === null) {
          const breakdown = getCartItemBreakdown(item.productRef, item.quantity, item.unitPrice);
          item.taxRate = breakdown.taxRate;
          item.priceIncludesTax = breakdown.priceIncludesTax;
          item.value = breakdown.value;
          item.itbis = breakdown.itbis;
          item.amount = breakdown.amount;
        }
      }
      
      // Final stock validation (avoid race conditions)
      for (const item of cart) {
        if (!item.productRef.id) continue;
        const available = await getAvailableQuantity(item.productRef.id);
        if (item.quantity > available) {
          alert($locale === 'es'
            ? `Stock insuficiente para ${item.description}. Disponible: ${available}, solicitado: ${item.quantity}.`
            : `Not enough stock for ${item.description}. Available: ${available}, requested: ${item.quantity}.`);
          return;
        }
      }
      
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const receiptNumber = await generateReceiptNumber();
    
    // Generate UUID for the sale (required by current schema)
    const saleUuid = generateId();
    
    // Create sale record - ensure all IDs are strings
    const sale: Sale = {
      id: saleUuid,
      date: dateStr,
      customerId: selectedCustomer?.id ? String(selectedCustomer.id) : undefined,
      customerName: selectedCustomer?.name,
      items: cart.map(item => ({
        description: item.description,
        productId: item.productId ? String(item.productId) : undefined,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate ?? 0.18,
        priceIncludesTax: item.priceIncludesTax ?? true,
        value: item.value,
        itbis: item.itbis,
        amount: item.amount
      })),
      subtotal,
      discount: 0,
      itbisTotal,
      total,
      paymentMethod: isCredit ? 'other' : paymentMethod,
      paymentStatus: isCredit ? 'pending' : 'paid',
      paidAmount: isCredit ? 0 : total,
      shiftId: $activeShift.id,
      receiptNumber,
      createdAt: now
    };
    
    // Save sale
    await db.sales.add(sale);
    lastSale = sale;
    
    // Create stock movements, update product stock, and consume FIFO inventory
    for (const item of cart) {
      if (item.productRef.id) {
        // Keep the original ID type for database operations
        const originalProductId = item.productRef.id;
        // Use string version for FIFO (which expects strings)
        const productIdStr = String(originalProductId);
        
        try {
          // Consume inventory using FIFO (oldest lots first)
          // This tracks the exact cost of goods sold
          // Note: strict=false allows selling legacy products without lots
          const { totalCost, avgUnitCost } = await consumeFIFO(
            productIdStr,
            item.quantity,
            { saleId: saleUuid }
          );
          
          // Create stock movement with FIFO cost
          const movement: StockMovement = {
            id: generateId(),
            productId: productIdStr,
            type: 'out',
            quantity: item.quantity,
            saleId: saleUuid,
            date: dateStr,
            notes: `${$locale === 'es' ? 'Venta' : 'Sale'} #${receiptNumber}`,
            unitCost: avgUnitCost,
            totalCost: totalCost
          };
          await db.stockMovements.add(movement);
          
          // Sync stock: use lot quantities if available, otherwise decrement currentStock
          const remainingLots = await getActiveLots(productIdStr);
          const lotStock = remainingLots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
          const hasLots = remainingLots.length > 0;
          const newStock = hasLots 
            ? lotStock 
            : Math.max(0, Number(item.productRef.currentStock ?? 0) - Number(item.quantity));
          
          // Use original product ID type (could be number or string depending on DB version)
          await db.products.update(originalProductId, {
            currentStock: newStock,
            lastStockUpdate: dateStr,
            salesVolume: Number(item.productRef.salesVolume ?? 0) + Number(item.quantity),
            lastSaleDate: dateStr
          });
        } catch (stockError) {
          console.error('Error processing stock for product:', originalProductId, stockError);
          // Continue with other items - don't fail the entire sale
        }
      }
    }
    
    // If paid immediately, record payment
    if (!isCredit) {
      try {
        const payment: Payment = {
          id: generateId(),
          saleId: saleUuid,
          customerId: selectedCustomer?.id ? String(selectedCustomer.id) : undefined,
          amount: total,
          currency: 'DOP',
          paymentDate: dateStr,
          paymentMethod,
          notes: `${$locale === 'es' ? 'Pago venta' : 'Sale payment'} #${receiptNumber}`,
          createdAt: now
        };
        await db.payments.add(payment);
      } catch (paymentError) {
        console.error('Error recording payment (non-critical):', paymentError);
      }
    }
    
    // Update customer balance if credit
    if (isCredit && selectedCustomer?.id) {
      try {
        const newBalance = (selectedCustomer.currentBalance ?? 0) + total;
        await db.customers.update(selectedCustomer.id, {
          currentBalance: newBalance
        });
      } catch (customerError) {
        console.error('Error updating customer balance (non-critical):', customerError);
      }
    }
    
    // Record ITBIS by rate for tax reporting (DGII compliance)
    // This tracks ITBIS collected at 18%, 16%, and 0% rates
    try {
      await recordSaleITBIS(lastSale as Sale);
    } catch (itbisError) {
      console.error('Error recording ITBIS (non-critical):', itbisError);
      // Non-critical - don't fail the sale
    }
    
    // Refresh the shift manager
    if (shiftManagerRef) {
      await shiftManagerRef.refreshSales();
    }
    
    saleComplete = true;
    } catch (e) {
      console.error('Error confirming sale:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      alert($locale === 'es'
        ? `Error al confirmar la venta: ${errorMessage}`
        : `Error confirming sale: ${errorMessage}`);
    }
  }
  
  function showReceiptModal() {
    confirmDialogOpen = false;
    showReceipt = true;
  }
  
  function finishSale() {
    confirmDialogOpen = false;
    saleComplete = false;
    showReceipt = false;
    lastSale = null;
    clearCart();
    loadData();
  }
  
  function getStockStatus(product: Product): { text: string; class: string; level: 'ok' | 'low' | 'out' } {
    const stock = product.currentStock ?? 0;
    const reorder = product.reorderPoint ?? 5;
    
    if (stock === 0) return { text: t('sales.outOfStock', $locale), class: 'text-red-500 bg-red-500/10', level: 'out' };
    if (stock <= reorder) return { text: `${stock}`, class: 'text-yellow-500 bg-yellow-500/10', level: 'low' };
    return { text: `${stock}`, class: 'text-green-500 bg-green-500/10', level: 'ok' };
  }

  function handleShiftOpened(event: CustomEvent<CashRegisterShift>) {
    loadActiveShift();
    showShiftPanel = false;
  }

  function handleShiftClosed(event: CustomEvent<CashRegisterShift>) {
    if (cart.length > 0) {
      clearCart();
    }
    loadActiveShift();
  }

  function exitPOS() {
    goto('/dashboard');
  }
  
  // ============ RETURNS FUNCTIONS ============
  
  function openReturnPanel() {
    if (!$hasActiveShift) {
      showShiftPanel = true;
      return;
    }
    resetReturnState();
    showReturnPanel = true;
  }
  
  function resetReturnState() {
    returnReceiptSearch = '';
    foundSale = null;
    returnItems = [];
    returnReason = 'customer_changed_mind';
    returnNotes = '';
    returnRefundMethod = 'cash';
    returnProcessing = false;
    returnComplete = false;
    lastReturn = null;
  }
  
  async function searchSaleForReturn() {
    if (!returnReceiptSearch.trim()) return;
    
    returnSearching = true;
    foundSale = null;
    returnItems = [];
    
    try {
      // Search by receipt number
      const sale = await db.sales.where('receiptNumber').equals(returnReceiptSearch.trim()).first();
      
      if (sale) {
        foundSale = sale;
        
        // Get existing returns for this sale to calculate remaining quantities
        const existingReturns = await db.returns.where('originalSaleId').equals(sale.id!).toArray();
        
        // Calculate already returned quantities per item
        const returnedQtys: Record<number, number> = {};
        for (const ret of existingReturns) {
          for (const item of ret.items) {
            const idx = item.originalSaleItemIndex ?? 0;
            returnedQtys[idx] = (returnedQtys[idx] || 0) + item.quantity;
          }
        }
        
        // Build return items list
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
        }).filter(ri => ri.maxQty > 0); // Only show items that can still be returned
      }
    } catch (e) {
      console.error('Error searching sale:', e);
    } finally {
      returnSearching = false;
    }
  }
  
  function toggleReturnItem(index: number) {
    const ri = returnItems.find(r => r.index === index);
    if (ri) {
      ri.selected = !ri.selected;
      if (ri.selected && ri.returnQty === 0) {
        ri.returnQty = ri.maxQty; // Default to max qty when selecting
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
    if (!foundSale || selectedReturnItems.length === 0 || !$activeShift?.id) return;
    
    returnProcessing = true;
    
    try {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      
      // Create return items
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
      
      // Create return record
      const returnUuid = generateId();
      const returnRecord: Return = {
        id: returnUuid,
        date: dateStr,
        originalSaleId: foundSale.id!,
        originalReceiptNumber: foundSale.receiptNumber,
        customerId: foundSale.customerId,
        customerName: foundSale.customerName,
        items,
        subtotal: returnSubtotal,
        itbisTotal: returnItbisTotal,
        total: returnTotal,
        refundMethod: returnRefundMethod,
        refundStatus: 'completed',
        reason: returnReason,
        reasonNotes: returnNotes || undefined,
        shiftId: $activeShift.id,
        processedBy: undefined,
        processedByName: $firebaseUser?.displayName || $firebaseUserEmail || undefined,
        createdAt: now
      };
      
      await db.returns.add(returnRecord);
      const returnId = returnUuid;
      lastReturn = { ...returnRecord, id: String(returnId) };
      
      // Reverse ITBIS collected for the returned items
      await reverseSaleITBIS({
        ...(foundSale as Sale),
        items,
        subtotal: returnSubtotal,
        itbisTotal: returnItbisTotal,
        total: returnTotal,
        date: dateStr
      });
      
      // Restore stock for returned items
      for (const ri of selectedReturnItems) {
        if (ri.item.productId) {
          const productId = String(ri.item.productId);
          
          const { restored, avgUnitCost, totalCost } = await restoreConsumptionForReturn(
            String(foundSale.id),
            productId,
            ri.returnQty
          );
          
          // Create stock movement (return = stock in) with restored cost
          if (restored > 0) {
            const movement: StockMovement = {
              id: generateId(),
              productId,
              type: 'return',
              quantity: restored,
              returnId: String(returnId),
              date: dateStr,
              notes: `${$locale === 'es' ? 'Devolución' : 'Return'} - ${foundSale.receiptNumber}`,
              unitCost: avgUnitCost,
              totalCost
            };
            await db.stockMovements.add(movement);
          }
          
          // Sync product stock: use lot quantities if available, otherwise add to current
          const remainingLots = await getActiveLots(productId);
          const lotStock = remainingLots.reduce((sum, lot) => sum + lot.remainingQuantity, 0);
          const hasLots = remainingLots.length > 0;
          const product = await db.products.get(productId);
          const currentStock = Number(product?.currentStock ?? 0);
          const newStock = hasLots ? lotStock : currentStock + ri.returnQty;
          
          await db.products.update(productId, {
            currentStock: newStock,
            lastStockUpdate: dateStr
          });
        }
      }
      
      // Update original sale to mark it has returns
      await db.sales.update(foundSale.id!, {
        hasReturns: true,
        returnedAmount: Number(foundSale.returnedAmount ?? 0) + Number(returnTotal)
      });
      
      // Record refund payment
      const payment: Payment = {
        id: generateId(),
        returnId: String(returnId),
        customerId: foundSale.customerId ? String(foundSale.customerId) : undefined,
        amount: returnTotal,
        currency: 'DOP',
        paymentDate: dateStr,
        paymentMethod: returnRefundMethod,
        isRefund: true,
        notes: `${$locale === 'es' ? 'Reembolso devolución' : 'Return refund'} - ${foundSale.receiptNumber}`,
        createdAt: now
      };
      await db.payments.add(payment);
      
      // If customer had credit, update their balance
      if (foundSale.customerId && foundSale.paymentMethod === 'other') {
        const customer = await db.customers.get(foundSale.customerId);
        if (customer) {
          await db.customers.update(foundSale.customerId, {
            currentBalance: Math.max(0, (customer.currentBalance ?? 0) - returnTotal)
          });
        }
      }
      
      // Refresh shift data
      if (shiftManagerRef) {
        await shiftManagerRef.refreshSales();
      }
      
      returnComplete = true;
      
    } catch (e) {
      console.error('Error processing return:', e);
      alert($locale === 'es' ? 'Error al procesar devolución' : 'Error processing return');
    } finally {
      returnProcessing = false;
    }
  }
  
  function closeReturnPanel() {
    showReturnPanel = false;
    resetReturnState();
    loadData(); // Refresh products to show updated stock
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
</script>

<!-- Full Screen POS Layout -->
<div class="fixed inset-0 bg-background flex flex-col">
  
  <!-- Barcode Notification Toast -->
  {#if barcodeNotification.show}
    <div 
      class="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-xl shadow-2xl text-lg font-bold animate-in fade-in slide-in-from-top-2 duration-200
             {barcodeNotification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}"
    >
      {barcodeNotification.message}
    </div>
  {/if}

  <!-- Top Bar -->
  <header class="h-14 bg-card border-b border-border flex items-center px-4 gap-4 shrink-0">
    <!-- Exit Button -->
    <Button variant="ghost" size="sm" class="gap-2" on:click={exitPOS}>
      <ChevronLeft size={18} />
      <span class="hidden sm:inline">{t('sales.exit', $locale)}</span>
    </Button>
    
    <!-- Title -->
    <div class="flex-1 flex items-center gap-3">
      <ShoppingCart size={20} class="text-primary" />
      <h1 class="font-bold text-lg">{t('sales.title', $locale)}</h1>
      {#if $activeShift}
        <Badge variant="secondary" class="hidden sm:flex gap-1">
          <Clock size={12} class="text-green-500" />
          {t('shifts.shiftNumber', $locale)} {$activeShift.shiftNumber}
        </Badge>
      {/if}
    </div>
    
    <!-- Search Bar -->
    <div class="relative w-72 lg:w-96">
      <Scan class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
      <Input 
        bind:this={searchInputRef}
        bind:value={searchQuery} 
        placeholder={t('sales.scanOrSearch', $locale)}
        class="h-10 pl-10 text-base bg-secondary"
        disabled={!$hasActiveShift}
        on:focus={() => { if (searchQuery.length >= 2) showSearchResults = true; }}
      />
      
      <!-- Search Results Dropdown -->
      {#if showSearchResults && searchResults.length > 0}
        <div class="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-border rounded-xl shadow-2xl max-h-80 overflow-auto">
          {#each searchResults as product}
            {@const stockStatus = getStockStatus(product)}
            <button 
              class="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted transition-colors text-left border-b border-border last:border-0 disabled:opacity-50"
              on:click={() => addToCart(product)}
              disabled={stockStatus.level === 'out'}
            >
              <div class="flex-1 min-w-0">
                <div class="font-medium truncate">{product.name}</div>
                <div class="text-sm text-muted-foreground flex items-center gap-2">
                  {#if product.barcode}<span class="font-mono text-xs">{product.barcode}</span>{/if}
                </div>
              </div>
              <Badge variant="outline" class="{stockStatus.class}">{stockStatus.text}</Badge>
              <div class="font-bold text-lg">${(product.sellingPrice || product.lastPrice * 1.3).toFixed(0)}</div>
            </button>
          {/each}
        </div>
      {/if}
    </div>
    
    <!-- Returns Button -->
    {#if $firebaseUser}
      <Button 
        variant="outline" 
        size="sm" 
        class="gap-2"
        on:click={openReturnPanel}
        disabled={!$hasActiveShift}
      >
        <RotateCcw size={16} class="text-orange-500" />
        <span class="hidden sm:inline">{t('returns.title', $locale)}</span>
      </Button>
    {/if}
    
    <!-- Shift Toggle -->
    <Button 
      variant={$hasActiveShift ? "outline" : "default"} 
      size="sm" 
      class="gap-2"
      on:click={() => showShiftPanel = !showShiftPanel}
    >
      <Clock size={16} class={$hasActiveShift ? 'text-green-500' : ''} />
      <span class="hidden sm:inline">{t('sales.shift', $locale)}</span>
    </Button>
  </header>

  <!-- Shift Required Alert -->
  {#if !$hasActiveShift}
    <div class="bg-yellow-500/10 border-b border-yellow-500/30 px-4 py-3 flex items-center gap-3">
      <AlertTriangle size={20} class="text-yellow-500 shrink-0" />
      <div class="flex-1">
        <p class="font-medium text-yellow-500">{t('sales.openShiftFirst', $locale)}</p>
      </div>
      <Button variant="default" size="sm" on:click={() => showShiftPanel = true}>
        {t('shifts.openShift', $locale)}
      </Button>
    </div>
  {/if}

  <!-- Main Content -->
  <div class="flex-1 flex overflow-hidden">
    
    <!-- Left: Product Grid -->
    <div class="flex-1 flex flex-col overflow-hidden">
      
      <!-- Category Tabs -->
      <div class="bg-card/50 border-b border-border p-2 flex gap-2 overflow-x-auto shrink-0">
        <Button
          variant={selectedCategory === null ? "default" : "ghost"}
          size="sm"
          class="shrink-0 h-10 px-4"
          on:click={() => selectedCategory = null}
        >
          <Sparkles size={16} class="mr-1" />
          {t('sales.popular', $locale)}
        </Button>
        {#each categories as category}
          <Button
            variant={selectedCategory === category ? "default" : "ghost"}
            size="sm"
            class="shrink-0 h-10 px-4"
            on:click={() => selectedCategory = category}
          >
            {category}
          </Button>
        {/each}
      </div>
      
      <!-- Product Grid -->
      <div class="flex-1 overflow-auto p-3">
        {#if filteredProducts.length === 0}
          <div class="h-full flex flex-col items-center justify-center text-muted-foreground">
            <Package size={64} class="mb-4 opacity-20" />
            <p class="text-lg font-medium">
              {selectedCategory ? t('sales.noProductsInCategory', $locale).replace('{category}', selectedCategory) : t('sales.noProductsAvailable', $locale)}
            </p>
          </div>
        {:else}
          <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2">
            {#each filteredProducts as product}
              {@const stockStatus = getStockStatus(product)}
              <button
                class="relative bg-card border border-border rounded-xl p-3 flex flex-col items-center text-center 
                       hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200
                       active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed
                       {stockStatus.level === 'out' ? 'opacity-50' : ''}"
                on:click={() => addToCart(product)}
                disabled={stockStatus.level === 'out' || !$hasActiveShift}
              >
                <!-- Stock Badge -->
                <div class="absolute top-1 right-1">
                  <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full {stockStatus.class}">
                    {stockStatus.text}
                  </span>
                </div>
                
                <!-- Product Icon/Image placeholder -->
                <div class="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mb-2">
                  <Package size={24} class="text-muted-foreground" />
                </div>
                
                <!-- Name -->
                <div class="text-xs font-medium line-clamp-2 min-h-[2.5rem] mb-1">
                  {product.name}
                </div>
                
                <!-- Price -->
                <div class="text-base font-bold text-primary">
                  ${(product.sellingPrice || product.lastPrice * 1.3).toFixed(0)}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Right: Cart & Payment -->
    <div class="w-80 lg:w-96 bg-card border-l border-border flex flex-col shrink-0">
      
      <!-- Cart Items -->
      <div class="flex-1 overflow-auto">
        {#if cart.length === 0}
          <div class="h-full flex flex-col items-center justify-center text-muted-foreground p-4">
            <ShoppingCart size={48} class="mb-3 opacity-20" />
            <p class="font-medium">{t('sales.emptyCart', $locale)}</p>
            <p class="text-sm text-center mt-1">{t('sales.scanOrSelectProducts', $locale)}</p>
          </div>
        {:else}
          <div class="divide-y divide-border">
            {#each cart as item, index}
              <div class="p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors">
                <!-- Product Info -->
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-sm truncate">{item.description}</div>
                  <div class="text-xs text-muted-foreground">
                    ${item.unitPrice.toFixed(2)} × {item.quantity}
                  </div>
                </div>
                
                <!-- Quantity Controls -->
                <div class="flex items-center gap-1">
                  <Button 
                    variant="outline" 
                    size="icon" 
                    class="h-8 w-8 shrink-0"
                    on:click={() => updateQuantity(index, -1)}
                  >
                    <Minus size={14} />
                  </Button>
                  <input 
                    type="number" 
                    value={item.quantity}
                    on:change={(e) => setQuantity(index, parseInt(e.currentTarget.value) || 1)}
                    class="w-10 h-8 text-center text-sm font-bold bg-transparent border border-border rounded-md"
                    min="1"
                    max={item.productRef.currentStock ?? 999}
                  />
                  <Button 
                    variant="outline" 
                    size="icon" 
                    class="h-8 w-8 shrink-0"
                    on:click={() => updateQuantity(index, 1)}
                  >
                    <Plus size={14} />
                  </Button>
                </div>
                
                <!-- Total & Remove -->
                <div class="text-right shrink-0">
                  <div class="font-bold">${item.amount.toFixed(2)}</div>
                </div>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  class="h-8 w-8 text-muted-foreground hover:text-red-500 shrink-0"
                  on:click={() => removeFromCart(index)}
                >
                  <X size={14} />
                </Button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
      
      <!-- Customer Selection (Collapsible) -->
      {#if cart.length > 0}
        <div class="p-3 border-t border-border">
          {#if selectedCustomer}
            <div class="flex items-center justify-between bg-primary/10 rounded-lg p-2">
              <div class="flex items-center gap-2">
                <User size={16} class="text-primary" />
                <span class="text-sm font-medium">{selectedCustomer.name}</span>
              </div>
              <Button variant="ghost" size="icon" class="h-6 w-6" on:click={clearCustomer}>
                <X size={14} />
              </Button>
            </div>
          {:else}
            <Select.Root onSelectedChange={(v) => { if (v?.value) { const cust = customers.find(c => String(c.id) === String(v.value)); if (cust) selectCustomer(cust); } }}>
              <Select.Trigger class="w-full h-9 text-sm">
                <Select.Value placeholder={t('sales.customerOptional', $locale)} />
              </Select.Trigger>
              <Select.Content>
                {#each customers as customer}
                  <Select.Item value={String(customer.id)} label={customer.name} />
                {/each}
              </Select.Content>
            </Select.Root>
          {/if}
        </div>
      {/if}
      
      <!-- Payment Method -->
      {#if cart.length > 0}
        <div class="p-3 border-t border-border">
          <div class="grid grid-cols-4 gap-2">
            <Button 
              variant={!isCredit && paymentMethod === 'cash' ? 'default' : 'outline'} 
              class="h-14 flex-col gap-1 text-xs"
              on:click={() => { isCredit = false; paymentMethod = 'cash'; }}
            >
              <Banknote size={18} />
              {t('sales.cash', $locale)}
            </Button>
            <Button 
              variant={!isCredit && paymentMethod === 'credit_card' ? 'default' : 'outline'} 
              class="h-14 flex-col gap-1 text-xs"
              on:click={() => { isCredit = false; paymentMethod = 'credit_card'; }}
            >
              <CreditCard size={18} />
              {t('sales.card', $locale)}
            </Button>
            <Button 
              variant={!isCredit && paymentMethod === 'bank_transfer' ? 'default' : 'outline'} 
              class="h-14 flex-col gap-1 text-xs"
              on:click={() => { isCredit = false; paymentMethod = 'bank_transfer'; }}
            >
              <Receipt size={18} />
              {t('sales.transfer', $locale)}
            </Button>
            <Button 
              variant={isCredit ? 'default' : 'outline'} 
              class="h-14 flex-col gap-1 text-xs {isCredit ? 'bg-yellow-500 hover:bg-yellow-600 text-yellow-950' : ''}"
              on:click={() => { isCredit = true; }}
            >
              <User size={18} />
              {t('sales.credit', $locale)}
            </Button>
          </div>
          
          {#if isCredit && !selectedCustomer}
            <div class="mt-2 p-2 bg-red-500/10 rounded-lg text-red-500 text-xs flex items-center gap-2">
              <AlertTriangle size={12} />
              {t('sales.selectCustomerForCredit', $locale)}
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- Cash Input & Quick Buttons -->
      {#if !isCredit && paymentMethod === 'cash' && cart.length > 0}
        <div class="p-3 border-t border-border">
          <div class="flex gap-2 mb-2">
            <Input 
              type="number" 
              step="1"
              bind:value={cashReceived}
              class="h-12 text-xl font-bold text-right"
              placeholder={t('sales.received', $locale)}
            />
          </div>
          <div class="grid grid-cols-5 gap-1">
            {#each quickCashAmounts as amount}
              <Button 
                variant="outline" 
                size="sm" 
                class="text-xs font-bold"
                on:click={() => cashReceived = amount}
              >
                ${amount}
              </Button>
            {/each}
          </div>
          {#if cashReceived >= total && cashReceived > 0}
            <div class="mt-2 text-center p-2 bg-green-500/10 rounded-lg">
              <span class="text-sm text-muted-foreground">{t('sales.change', $locale)}: </span>
              <span class="text-xl font-bold text-green-500">${change.toFixed(2)}</span>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- Totals & Actions -->
      <div class="p-4 bg-muted/50 border-t border-border mt-auto">
        <div class="space-y-1 mb-3">
          <div class="flex justify-between text-sm text-muted-foreground">
            <span>{t('sales.subtotal', $locale)}</span>
            <span class="font-mono">${subtotal.toFixed(2)}</span>
          </div>
          <div class="flex justify-between text-sm text-muted-foreground">
            <span>{t('sales.itbis', $locale)} (18%)</span>
            <span class="font-mono">${itbisTotal.toFixed(2)}</span>
          </div>
          <Separator />
          <div class="flex justify-between text-2xl font-bold">
            <span>{t('sales.total', $locale)}</span>
            <span class="font-mono text-primary">${total.toFixed(2)}</span>
          </div>
        </div>
        
        <div class="grid grid-cols-3 gap-2">
          <Button variant="outline" class="h-12" on:click={clearCart} disabled={cart.length === 0}>
            <Trash2 size={16} class="mr-2" />
            {t('sales.clear', $locale)}
          </Button>
          <Button 
            variant="outline" 
            class="h-12 text-orange-500 border-orange-500 hover:bg-orange-500/10"
            on:click={openDeliveryDialog}
            disabled={cart.length === 0 || !$hasActiveShift}
          >
            <Truck size={16} class="mr-2" />
            Delivery
          </Button>
          <Button 
            variant="default" 
            class="h-12 text-lg font-bold shadow-lg shadow-primary/30"
            on:click={openConfirmDialog}
            disabled={cart.length === 0 || !$hasActiveShift || (isCredit && !selectedCustomer)}
          >
            {t('sales.checkout', $locale)}
          </Button>
        </div>
        
        <!-- Pending Deliveries Badge -->
        {#if pendingDeliveries.length > 0}
          <Button 
            variant="ghost" 
            class="w-full mt-2 text-orange-500 hover:bg-orange-500/10"
            on:click={() => showPendingDeliveries = !showPendingDeliveries}
          >
            <Truck size={16} class="mr-2" />
            {pendingDeliveries.length} {$locale === 'es' ? 'deliveries pendientes' : 'pending deliveries'}
            <CircleDot size={12} class="ml-2 animate-pulse" />
          </Button>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- Shift Panel (Slide Over) -->
{#if showShiftPanel}
  <div 
    class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" 
    on:click={() => showShiftPanel = false} 
    on:keydown={(e) => e.key === 'Escape' && (showShiftPanel = false)} 
    role="button" 
    tabindex="0"
    aria-label={t('common.close', $locale)}
  >
    <div 
      class="absolute right-0 top-0 bottom-0 w-96 bg-card shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200" 
      on:click|stopPropagation 
      on:keydown|stopPropagation
      role="dialog"
      aria-label={t('sales.shiftManagement', $locale)}
    >
      <div class="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
        <h2 class="font-bold text-lg flex items-center gap-2">
          <Clock size={20} class={$hasActiveShift ? 'text-green-500' : 'text-muted-foreground'} />
          {t('sales.shiftManagement', $locale)}
        </h2>
        <Button variant="ghost" size="icon" on:click={() => showShiftPanel = false}>
          <X size={18} />
        </Button>
      </div>
      <div class="p-4">
        <ShiftManager 
          bind:this={shiftManagerRef}
          on:shiftOpened={handleShiftOpened}
          on:shiftClosed={handleShiftClosed}
        />
      </div>
    </div>
  </div>
{/if}

<!-- Confirm Sale Dialog -->
<Dialog.Root bind:open={confirmDialogOpen} onOpenChange={(open) => { if (!open && !saleComplete) confirmDialogOpen = false; }}>
  <Dialog.Content class="max-w-md">
    {#if saleComplete && lastSale}
      <div class="text-center py-6">
        <div class="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={48} class="text-green-500" />
        </div>
        <h2 class="text-2xl font-bold mb-2">{t('sales.saleComplete', $locale)}</h2>
        <p class="text-muted-foreground mb-1">
          {t('sales.receiptNumber', $locale)} <span class="font-mono font-bold">{lastSale.receiptNumber}</span>
        </p>
        <div class="text-4xl font-bold text-primary mb-4">${total.toFixed(2)}</div>
        
        {#if !isCredit && paymentMethod === 'cash' && change > 0}
          <div class="bg-green-500/10 rounded-xl p-4 mb-6">
            <div class="text-sm text-muted-foreground">{t('sales.change', $locale)}</div>
            <div class="text-3xl font-bold text-green-500">${change.toFixed(2)}</div>
          </div>
        {/if}
        
        <div class="flex gap-2">
          <Button variant="outline" class="flex-1 h-12 gap-2" on:click={showReceiptModal}>
            <Printer size={18} />
            {t('sales.print', $locale)}
          </Button>
          <Button variant="default" class="flex-1 h-12 text-lg font-bold" on:click={finishSale}>
            {t('sales.newSale', $locale)}
          </Button>
        </div>
      </div>
    {:else}
      <Dialog.Header>
        <Dialog.Title>{t('sales.confirmSale', $locale)}</Dialog.Title>
        <Dialog.Description>{t('sales.reviewBeforeConfirm', $locale)}</Dialog.Description>
      </Dialog.Header>
      
      <div class="py-4 space-y-4">
        <!-- Customer -->
        <div class="flex justify-between">
          <span class="text-muted-foreground">{t('sales.customer', $locale)}</span>
          <span class="font-medium">{selectedCustomer?.name ?? t('sales.cashSale', $locale)}</span>
        </div>
        
        <!-- Payment -->
        <div class="flex justify-between">
          <span class="text-muted-foreground">{t('sales.payment', $locale)}</span>
          <span class="font-medium">
            {#if isCredit}
              <Badge variant="outline" class="text-yellow-500 border-yellow-500">{t('sales.credit', $locale)}</Badge>
            {:else if paymentMethod === 'cash'}
              {t('sales.cash', $locale)}
            {:else if paymentMethod === 'credit_card'}
              {t('sales.card', $locale)}
            {:else}
              {t('sales.transfer', $locale)}
            {/if}
          </span>
        </div>
        
        <Separator />
        
        <!-- Items summary -->
        <div class="max-h-40 overflow-auto space-y-1">
          {#each cart as item}
            <div class="flex justify-between text-sm">
              <span class="truncate">{item.quantity}× {item.description}</span>
              <span class="font-mono">${item.amount.toFixed(2)}</span>
            </div>
          {/each}
        </div>
        
        <Separator />
        
        <div class="flex justify-between text-2xl font-bold">
          <span>{t('sales.total', $locale)}</span>
          <span class="text-primary">${total.toFixed(2)}</span>
        </div>
        
        {#if isCredit && selectedCustomer}
          <div class="bg-yellow-500/10 rounded-lg p-3 text-sm">
            <div class="flex justify-between">
              <span>{t('sales.currentBalance', $locale)}</span>
              <span>${(selectedCustomer.currentBalance ?? 0).toLocaleString()}</span>
            </div>
            <div class="flex justify-between font-bold">
              <span>{t('sales.newBalance', $locale)}</span>
              <span>${((selectedCustomer.currentBalance ?? 0) + total).toLocaleString()}</span>
            </div>
          </div>
        {/if}
      </div>
      
      <Dialog.Footer>
        <Button variant="ghost" on:click={() => confirmDialogOpen = false}>{t('common.cancel', $locale)}</Button>
        <Button variant="default" class="font-bold" on:click={confirmSale}>
          {t('common.confirm', $locale)}
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<!-- Receipt Modal -->
{#if showReceipt && lastSale}
  <SaleReceipt 
    sale={lastSale}
    shift={$activeShift}
    cashReceived={cashReceived}
    change={change}
    onClose={finishSale}
  />
{/if}

<!-- Returns Panel (Slide Over) -->
{#if showReturnPanel}
  <div 
    class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" 
    on:click={closeReturnPanel} 
    on:keydown={(e) => e.key === 'Escape' && closeReturnPanel()} 
    role="button" 
    tabindex="0"
    aria-label={t('common.close', $locale)}
  >
    <div 
      class="absolute right-0 top-0 bottom-0 w-[500px] max-w-full bg-card shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200 flex flex-col" 
      on:click|stopPropagation 
      on:keydown|stopPropagation
      role="dialog"
      aria-label={t('returns.processReturn', $locale)}
    >
      <!-- Header -->
      <div class="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between z-10">
        <h2 class="font-bold text-lg flex items-center gap-2">
          <RotateCcw size={20} class="text-orange-500" />
          {t('returns.processReturn', $locale)}
        </h2>
        <Button variant="ghost" size="icon" on:click={closeReturnPanel}>
          <X size={18} />
        </Button>
      </div>
      
      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4">
        {#if returnComplete && lastReturn}
          <!-- Return Complete -->
          <div class="text-center py-8">
            <div class="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={48} class="text-green-500" />
            </div>
            <h3 class="text-2xl font-bold mb-2">{t('returns.returnComplete', $locale)}</h3>
            <p class="text-muted-foreground mb-1">
              {t('returns.returnNumber', $locale)} <span class="font-mono font-bold">#{lastReturn.id}</span>
            </p>
            <div class="text-3xl font-bold text-orange-500 mb-6">${returnTotal.toFixed(2)}</div>
            
            <div class="bg-muted/50 rounded-lg p-4 mb-6 text-left">
              <div class="text-sm text-muted-foreground mb-2">{t('returns.refundInfo', $locale)
                .replace('{amount}', `$${returnTotal.toFixed(2)}`)
                .replace('{method}', returnRefundMethod === 'cash' ? t('sales.cash', $locale) : returnRefundMethod === 'credit_card' ? t('sales.card', $locale) : t('sales.transfer', $locale))}</div>
              <div class="text-sm">{t('returns.stockRestored', $locale)}</div>
            </div>
            
            <Button variant="default" class="w-full h-12" on:click={closeReturnPanel}>
              {t('common.close', $locale)}
            </Button>
          </div>
        {:else}
          <!-- Search Section -->
          <div class="mb-6">
            <Label class="text-sm font-medium mb-2 block">{t('returns.searchSale', $locale)}</Label>
            <div class="flex gap-2">
              <div class="relative flex-1">
                <Hash class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input 
                  bind:value={returnReceiptSearch}
                  placeholder={t('returns.receiptNumber', $locale)}
                  class="pl-9"
                  on:keydown={(e) => e.key === 'Enter' && searchSaleForReturn()}
                />
              </div>
              <Button 
                variant="default" 
                on:click={searchSaleForReturn}
                disabled={returnSearching || !returnReceiptSearch.trim()}
              >
                {#if returnSearching}
                  <div class="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                {:else}
                  <Search size={16} />
                {/if}
              </Button>
            </div>
          </div>
          
          {#if foundSale}
            <!-- Found Sale Info -->
            <div class="bg-muted/50 rounded-lg p-4 mb-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-sm text-muted-foreground">{t('returns.originalSale', $locale)}</span>
                <Badge variant="outline">#{foundSale.receiptNumber}</Badge>
              </div>
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="text-muted-foreground">{t('returns.saleDate', $locale)}:</span>
                  <span class="ml-1 font-medium">{foundSale.date}</span>
                </div>
                <div>
                  <span class="text-muted-foreground">{t('returns.saleTotal', $locale)}:</span>
                  <span class="ml-1 font-medium">${foundSale.total.toFixed(2)}</span>
                </div>
              </div>
              {#if foundSale.customerName}
                <div class="mt-2 flex items-center gap-2 text-sm">
                  <User size={14} class="text-muted-foreground" />
                  <span>{foundSale.customerName}</span>
                </div>
              {/if}
              {#if foundSale.hasReturns}
                <div class="mt-2 flex items-center gap-2 text-xs text-orange-500">
                  <AlertTriangle size={12} />
                  <span>{$locale === 'es' ? 'Esta venta ya tiene devoluciones previas' : 'This sale has previous returns'}</span>
                </div>
              {/if}
            </div>
            
            <!-- Items to Return -->
            {#if returnItems.length > 0}
              <div class="mb-4">
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
                            ${ri.item.unitPrice.toFixed(2)} × {ri.item.quantity} = ${ri.item.amount.toFixed(2)}
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
                <!-- Reason -->
                <div class="mb-4">
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
                
                <!-- Notes -->
                <div class="mb-4">
                  <Label class="text-sm font-medium mb-2 block">{t('returns.reasonNotes', $locale)}</Label>
                  <Input 
                    bind:value={returnNotes}
                    placeholder={$locale === 'es' ? 'Notas adicionales (opcional)' : 'Additional notes (optional)'}
                  />
                </div>
                
                <!-- Refund Method -->
                <div class="mb-4">
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
              {/if}
            {:else}
              <div class="text-center py-8 text-muted-foreground">
                <RotateCcw size={48} class="mx-auto mb-4 opacity-20" />
                <p>{$locale === 'es' ? 'Todos los artículos ya fueron devueltos' : 'All items have already been returned'}</p>
              </div>
            {/if}
          {:else if returnReceiptSearch && !returnSearching}
            <div class="text-center py-8 text-muted-foreground">
              <Search size={48} class="mx-auto mb-4 opacity-20" />
              <p>{t('returns.saleNotFound', $locale)}</p>
            </div>
          {:else}
            <div class="text-center py-8 text-muted-foreground">
              <Hash size={48} class="mx-auto mb-4 opacity-20" />
              <p>{t('returns.enterReceiptNumber', $locale)}</p>
            </div>
          {/if}
        {/if}
      </div>
      
      <!-- Footer with totals and action button -->
      {#if !returnComplete && foundSale && selectedReturnItems.length > 0}
        <div class="border-t border-border bg-muted/50 p-4">
          <div class="space-y-1 mb-3">
            <div class="flex justify-between text-sm text-muted-foreground">
              <span>{t('sales.subtotal', $locale)}</span>
              <span class="font-mono">${returnSubtotal.toFixed(2)}</span>
            </div>
            <div class="flex justify-between text-sm text-muted-foreground">
              <span>{t('sales.itbis', $locale)} (18%)</span>
              <span class="font-mono">${returnItbisTotal.toFixed(2)}</span>
            </div>
            <Separator />
            <div class="flex justify-between text-xl font-bold">
              <span>{t('returns.refundAmount', $locale)}</span>
              <span class="text-orange-500">${returnTotal.toFixed(2)}</span>
            </div>
          </div>
          
          <Button 
            variant="default" 
            class="w-full h-12 bg-orange-500 hover:bg-orange-600 text-white font-bold"
            on:click={processReturn}
            disabled={returnProcessing}
          >
            {#if returnProcessing}
              <div class="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full mr-2"></div>
            {:else}
              <RotateCcw size={18} class="mr-2" />
            {/if}
            {t('returns.processReturnBtn', $locale)}
          </Button>
        </div>
      {/if}
    </div>
  </div>
{/if}

<!-- Delivery Dialog -->
<Dialog.Root bind:open={deliveryDialogOpen}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <Truck size={20} class="text-orange-500" />
        {$locale === 'es' ? 'Crear Orden de Delivery' : 'Create Delivery Order'}
      </Dialog.Title>
      <Dialog.Description>
        {$locale === 'es' 
          ? 'La orden quedará pendiente hasta confirmar el pago al entregar.' 
          : 'Order will remain pending until payment is confirmed on delivery.'}
      </Dialog.Description>
    </Dialog.Header>
    
    <div class="py-4 space-y-4">
      <!-- Order Summary -->
      <div class="bg-muted/50 rounded-lg p-3">
        <div class="flex justify-between mb-2">
          <span class="text-muted-foreground">{$locale === 'es' ? 'Artículos:' : 'Items:'}</span>
          <span class="font-bold">{cart.length}</span>
        </div>
        <div class="flex justify-between text-lg">
          <span class="font-bold">{$locale === 'es' ? 'Total:' : 'Total:'}</span>
          <span class="font-bold text-primary">${total.toFixed(2)}</span>
        </div>
      </div>
      
      <!-- Delivery Info -->
      <div class="space-y-3">
        <div class="space-y-2">
          <Label class="flex items-center gap-2">
            <MapPin size={14} />
            {$locale === 'es' ? 'Dirección de Entrega' : 'Delivery Address'}
          </Label>
          <Input 
            bind:value={deliveryAddress}
            placeholder={$locale === 'es' ? 'Calle, número, sector...' : 'Street, number, area...'}
          />
        </div>
        
        <div class="space-y-2">
          <Label class="flex items-center gap-2">
            <Phone size={14} />
            {$locale === 'es' ? 'Teléfono de Contacto' : 'Contact Phone'}
          </Label>
          <Input 
            bind:value={deliveryPhone}
            placeholder="809-000-0000"
            type="tel"
          />
        </div>
        
        <div class="space-y-2">
          <Label class="flex items-center gap-2">
            <FileText size={14} />
            {$locale === 'es' ? 'Notas de Entrega' : 'Delivery Notes'}
          </Label>
          <Input 
            bind:value={deliveryNotes}
            placeholder={$locale === 'es' ? 'Instrucciones especiales...' : 'Special instructions...'}
          />
        </div>
      </div>
      
      {#if selectedCustomer}
        <div class="text-sm text-muted-foreground flex items-center gap-2">
          <User size={14} />
          {$locale === 'es' ? 'Cliente:' : 'Customer:'} {selectedCustomer.name}
        </div>
      {/if}
    </div>
    
    <Dialog.Footer>
      <Button variant="outline" on:click={() => deliveryDialogOpen = false}>
        {$locale === 'es' ? 'Cancelar' : 'Cancel'}
      </Button>
      <Button 
        variant="default" 
        class="bg-orange-500 hover:bg-orange-600"
        on:click={createDeliveryOrder}
      >
        <Truck size={16} class="mr-2" />
        {$locale === 'es' ? 'Crear Delivery' : 'Create Delivery'}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Pending Deliveries Panel -->
{#if showPendingDeliveries}
  <div class="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" on:click={() => showPendingDeliveries = false}>
    <div 
      class="fixed right-0 top-0 h-full w-full max-w-md bg-card border-l border-border shadow-2xl overflow-auto"
      on:click|stopPropagation
    >
      <div class="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between">
        <h2 class="font-bold text-lg flex items-center gap-2">
          <Truck size={20} class="text-orange-500" />
          {$locale === 'es' ? 'Deliveries Pendientes' : 'Pending Deliveries'}
          <Badge variant="secondary">{pendingDeliveries.length}</Badge>
        </h2>
        <Button variant="ghost" size="icon" on:click={() => showPendingDeliveries = false}>
          <X size={18} />
        </Button>
      </div>
      
      <div class="p-4 space-y-3">
        {#if pendingDeliveries.length === 0}
          <div class="text-center py-8 text-muted-foreground">
            <Truck size={48} class="mx-auto mb-4 opacity-20" />
            <p>{$locale === 'es' ? 'No hay deliveries pendientes' : 'No pending deliveries'}</p>
          </div>
        {:else}
          {#each pendingDeliveries as delivery}
            <Card.Root class="border-orange-500/30">
              <Card.Content class="p-4">
                <div class="flex justify-between items-start mb-2">
                  <div>
                    <div class="font-mono font-bold">#{delivery.receiptNumber}</div>
                    <div class="text-sm text-muted-foreground">
                      {new Date(delivery.createdAt).toLocaleTimeString($locale === 'es' ? 'es-DO' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="text-lg font-bold text-primary">${delivery.total.toFixed(2)}</div>
                    <Badge variant="outline" class="text-orange-500 border-orange-500">
                      {$locale === 'es' ? 'Pendiente' : 'Pending'}
                    </Badge>
                  </div>
                </div>
                
                {#if delivery.customerName}
                  <div class="text-sm flex items-center gap-1 mb-1">
                    <User size={12} />
                    {delivery.customerName}
                  </div>
                {/if}
                
                {#if delivery.deliveryAddress}
                  <div class="text-sm flex items-center gap-1 mb-1 text-muted-foreground">
                    <MapPin size={12} />
                    {delivery.deliveryAddress}
                  </div>
                {/if}
                
                {#if delivery.deliveryPhone}
                  <div class="text-sm flex items-center gap-1 mb-2 text-muted-foreground">
                    <Phone size={12} />
                    {delivery.deliveryPhone}
                  </div>
                {/if}
                
                <div class="text-xs text-muted-foreground mb-3">
                  {delivery.items.length} {$locale === 'es' ? 'artículos' : 'items'}
                </div>
                
                <div class="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    class="flex-1 text-red-500 border-red-500/50 hover:bg-red-500/10"
                    on:click={() => cancelDelivery(delivery)}
                  >
                    <X size={14} class="mr-1" />
                    {$locale === 'es' ? 'Cancelar' : 'Cancel'}
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    class="flex-1 bg-green-500 hover:bg-green-600"
                    on:click={() => openCompleteDeliveryDialog(delivery)}
                  >
                    <CheckCircle2 size={14} class="mr-1" />
                    {$locale === 'es' ? 'Completar' : 'Complete'}
                  </Button>
                </div>
              </Card.Content>
            </Card.Root>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<!-- Complete Delivery Dialog -->
<Dialog.Root bind:open={completeDeliveryDialogOpen}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <CheckCircle2 size={20} class="text-green-500" />
        {$locale === 'es' ? 'Completar Delivery' : 'Complete Delivery'}
      </Dialog.Title>
      <Dialog.Description>
        {$locale === 'es' 
          ? 'Confirme el método de pago utilizado por el cliente.' 
          : 'Confirm the payment method used by the customer.'}
      </Dialog.Description>
    </Dialog.Header>
    
    {#if selectedDelivery}
      <div class="py-4 space-y-4">
        <!-- Order Info -->
        <div class="bg-muted/50 rounded-lg p-4">
          <div class="flex justify-between mb-2">
            <span class="font-mono">#{selectedDelivery.receiptNumber}</span>
            {#if selectedDelivery.customerName}
              <span>{selectedDelivery.customerName}</span>
            {/if}
          </div>
          <div class="text-2xl font-bold text-center text-primary">
            ${selectedDelivery.total.toFixed(2)}
          </div>
        </div>
        
        <!-- Payment Method Selection -->
        <div class="space-y-2">
          <Label>{$locale === 'es' ? 'Método de Pago Real' : 'Actual Payment Method'}</Label>
          <div class="grid grid-cols-3 gap-2">
            <Button 
              variant={deliveryPaymentMethod === 'cash' ? 'default' : 'outline'} 
              class="h-14 flex-col gap-1 text-xs"
              on:click={() => deliveryPaymentMethod = 'cash'}
            >
              <Banknote size={18} />
              {$locale === 'es' ? 'Efectivo' : 'Cash'}
            </Button>
            <Button 
              variant={deliveryPaymentMethod === 'credit_card' ? 'default' : 'outline'} 
              class="h-14 flex-col gap-1 text-xs"
              on:click={() => deliveryPaymentMethod = 'credit_card'}
            >
              <CreditCard size={18} />
              {$locale === 'es' ? 'Tarjeta' : 'Card'}
            </Button>
            <Button 
              variant={deliveryPaymentMethod === 'bank_transfer' ? 'default' : 'outline'} 
              class="h-14 flex-col gap-1 text-xs"
              on:click={() => deliveryPaymentMethod = 'bank_transfer'}
            >
              <Receipt size={18} />
              {$locale === 'es' ? 'Transfer.' : 'Transfer'}
            </Button>
          </div>
        </div>
        
        {#if selectedDelivery.deliveryAddress}
          <div class="text-sm text-muted-foreground flex items-center gap-2">
            <MapPin size={14} />
            {selectedDelivery.deliveryAddress}
          </div>
        {/if}
      </div>
    {/if}
    
    <Dialog.Footer>
      <Button variant="outline" on:click={() => completeDeliveryDialogOpen = false}>
        {$locale === 'es' ? 'Cancelar' : 'Cancel'}
      </Button>
      <Button 
        variant="default" 
        class="bg-green-500 hover:bg-green-600"
        on:click={completeDelivery}
      >
        <CheckCircle2 size={16} class="mr-2" />
        {$locale === 'es' ? 'Confirmar Pago' : 'Confirm Payment'}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<style>
  /* Custom scrollbar for cart */
  :global(.overflow-auto)::-webkit-scrollbar {
    width: 6px;
  }
  :global(.overflow-auto)::-webkit-scrollbar-track {
    background: transparent;
  }
  :global(.overflow-auto)::-webkit-scrollbar-thumb {
    background: hsl(var(--muted-foreground) / 0.3);
    border-radius: 3px;
  }
  :global(.overflow-auto)::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--muted-foreground) / 0.5);
  }
</style>
