<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { db, generateId } from '$lib/db';
  import { ClipboardList, Plus, Search, Eye, Edit, Trash2, X, Check, Calendar, Package, ArrowUpDown, ArrowUp, ArrowDown, FileText, Truck, ChevronDown, ChevronUp, Copy, Clock, AlertTriangle, CheckCircle2, Circle, Send, PackageCheck } from 'lucide-svelte';
  import * as Card from '$lib/components/ui/card';
  import type { PurchaseOrder, Supplier, Product, PurchaseOrderItem, Receipt } from '$lib/types';
  import { generatePONumber } from '$lib/utils';
  import { recalculatePurchaseOrder, calculatePOItemTax, TAX_RATES } from '$lib/tax';
  import * as Table from '$lib/components/ui/table';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import * as Select from '$lib/components/ui/select';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Button } from '$lib/components/ui/button';
  import { DatePicker } from '$lib/components/ui/date-picker';
  import { locale } from '$lib/stores';
  import { t } from '$lib/i18n';
  import { goto } from '$app/navigation';
  import { Checkbox } from '$lib/components/ui/checkbox';

  let purchaseOrders: PurchaseOrder[] = [];
  let suppliers: Supplier[] = [];
  let products: Product[] = [];
  let searchQuery = '';
  let statusFilter: 'all' | PurchaseOrder['status'] = 'all';
  let supplierFilter: string | null = null;
  let startDate = '';
  let endDate = '';

  // PO Creation/Edit State
  let showPOModal = false;
  let editingPO: PurchaseOrder | null = null;
  let poSupplierId: string | null = null;
  let poOrderDate = new Date().toISOString().split('T')[0];
  let poExpectedDate = '';
  let poNotes = '';
  let poItems: PurchaseOrderItem[] = [];
  let newItemProductId: string | null = null;
  let newItemProductName = '';
  let newItemQuantity = 1;
  let newItemUnitPrice = 0;
  let newItemTaxRate: number = 0.18;
  let newItemPriceIncludesTax = false;
  let newItemNotes = '';
  let showProductSearch = false;

  // PO Detail View
  let selectedPO: PurchaseOrder | null = null;
  let showPODetail = false;
  let linkedReceipts: Receipt[] = [];

  // Delete confirmation
  let deleteDialogOpen = false;
  let poToDelete: number | null = null;
  
  // Tax rate dropdown state
  let openTaxDropdownIndex: number | null = null;

  type SortColumn = 'orderDate' | 'poNumber' | 'supplier' | 'total' | 'status';
  let sortColumn: SortColumn = 'orderDate';
  let sortDirection: 'asc' | 'desc' = 'desc';
  
  // Info card collapse state
  let showInfoCard = true;
  
  function toggleInfoCard() {
    showInfoCard = !showInfoCard;
    if (browser) {
      localStorage.setItem('po-info-card-collapsed', (!showInfoCard).toString());
    }
  }

  $: filteredPOs = purchaseOrders.filter(po => {
    if (statusFilter !== 'all' && po.status !== statusFilter) return false;
    if (supplierFilter && po.supplierId !== supplierFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!po.poNumber.toLowerCase().includes(q) && 
          !po.supplierName?.toLowerCase().includes(q)) return false;
    }
    if (startDate && po.orderDate < startDate) return false;
    if (endDate && po.orderDate > endDate) return false;
    return true;
  });

  $: sortedPOs = [...filteredPOs].sort((a, b) => {
    switch (sortColumn) {
      case 'poNumber': {
        return sortDirection === 'asc' 
          ? a.poNumber.localeCompare(b.poNumber)
          : b.poNumber.localeCompare(a.poNumber);
      }
      case 'supplier': {
        const aName = (a.supplierName || '').toLowerCase();
        const bName = (b.supplierName || '').toLowerCase();
        return sortDirection === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName);
      }
      case 'total': {
        return sortDirection === 'asc' ? a.total - b.total : b.total - a.total;
      }
      case 'status': {
        return sortDirection === 'asc' 
          ? a.status.localeCompare(b.status)
          : b.status.localeCompare(a.status);
      }
      case 'orderDate':
      default: {
        const aDate = new Date(a.orderDate).getTime();
        const bDate = new Date(b.orderDate).getTime();
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
      }
    }
  });

  // PO totals (reactive)
  let poSubtotal = 0;
  let poItbisTotal = 0;
  let poTotal = 0;

  // Recalculate totals with tax - reactive to poItems changes
  // This runs automatically whenever poItems array changes (add, remove, or edit items)
  $: {
    if (poItems.length === 0) {
      poSubtotal = 0;
      poItbisTotal = 0;
      poTotal = 0;
    } else {
      // Create a temporary PO object to use the recalculation function
      const tempPO: PurchaseOrder = {
        poNumber: '',
        supplierId: 0,
        orderDate: poOrderDate,
        status: 'draft',
        items: poItems.map(item => ({
          ...item,
          quantity: Number(item.quantity) || 0,
          unitPrice: Number(item.unitPrice) || 0
        })),
        subtotal: 0,
        itbisTotal: 0,
        total: 0,
        createdAt: new Date()
      };
      const calculatedPO = recalculatePurchaseOrder(tempPO);
      poSubtotal = calculatedPO.subtotal;
      poItbisTotal = calculatedPO.itbisTotal;
      poTotal = calculatedPO.total;
    }
  }

  onMount(async () => {
    // Load info card preference from localStorage
    if (browser) {
      const saved = localStorage.getItem('po-info-card-collapsed');
      if (saved === 'true') {
        showInfoCard = false;
      }
    }
    await loadData();
  });

  async function loadData() {
    try {
      purchaseOrders = await db.purchaseOrders.toArray();
      // Load all suppliers - filter to show only active ones
      const allSuppliers = await db.suppliers.toArray();
      suppliers = allSuppliers.filter(s => s.isActive !== false);
      
      // If no suppliers found, show all (might be a new setup)
      if (suppliers.length === 0) {
        suppliers = allSuppliers;
      }
      
      products = await db.products.toArray();
      
      // Denormalize supplier names and ensure backward compatibility
      purchaseOrders = purchaseOrders.map(po => {
        const supplier = suppliers.find(s => s.id === po.supplierId);
        const updatedPO = { ...po, supplierName: supplier?.name || 'Unknown' };
        
        // Backward compatibility: ensure itbisTotal exists
        if (updatedPO.itbisTotal === undefined) {
          // Calculate from items or default to 0
          const calculated = recalculatePurchaseOrder(updatedPO);
          updatedPO.itbisTotal = calculated.itbisTotal;
        }
        
        return updatedPO;
      });
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error loading data. Please refresh the page.');
    }
  }

  async function openCreatePO() {
    editingPO = null;
    poSupplierId = null;
    previousSupplierId = null; // Reset tracking for new modal
    poOrderDate = new Date().toISOString().split('T')[0];
    poExpectedDate = '';
    poNotes = '';
    poItems = [];
    newItemProductId = null;
    newItemProductName = '';
    newItemQuantity = 1;
    newItemUnitPrice = 0;
    newItemTaxRate = 0.18;
    newItemPriceIncludesTax = false;
    newItemNotes = '';
    showProductSearch = false;
    
    // Ensure products and suppliers are loaded
    if (suppliers.length === 0 || products.length === 0) {
      await loadData();
    }
    
    showPOModal = true;
  }

  function openEditPO(po: PurchaseOrder) {
    editingPO = po;
    poSupplierId = po.supplierId;
    previousSupplierId = po.supplierId; // Initialize tracking with current supplier
    poOrderDate = po.orderDate;
    poExpectedDate = po.expectedDate || '';
    poNotes = po.notes || '';
    // Ensure backward compatibility - recalculate items that may not have tax fields
    poItems = po.items.map(item => {
      // If item already has tax fields, use them; otherwise calculate
      if (item.value !== undefined && item.itbis !== undefined && item.amount !== undefined) {
        return item;
      }
      // Backward compatibility: calculate tax for old items
      const taxRate = item.taxRate ?? 0.18;
      const priceIncludesTax = item.priceIncludesTax ?? false;
      const tempItem: PurchaseOrderItem = {
        ...item,
        taxRate,
        priceIncludesTax,
        value: 0,
        itbis: 0,
        amount: 0
      };
      return calculatePOItemTax(tempItem);
    });
    showPOModal = true;
  }

  function closePOModal() {
    showPOModal = false;
    editingPO = null;
  }

  function addItem() {
    if (!newItemProductName.trim() || newItemQuantity <= 0 || newItemUnitPrice <= 0) {
      alert('Please fill in product name, quantity, and unit price');
      return;
    }

    // Create item with tax fields
    const newItem: PurchaseOrderItem = {
      productId: newItemProductId || undefined,
      productName: newItemProductName,
      quantity: newItemQuantity,
      unitPrice: newItemUnitPrice,
      taxRate: newItemTaxRate,
      priceIncludesTax: newItemPriceIncludesTax,
      value: 0, // Will be calculated
      itbis: 0, // Will be calculated
      amount: 0, // Will be calculated
      notes: newItemNotes || undefined
    };

    // Calculate tax for the new item
    const calculatedItem = calculatePOItemTax(newItem);
    // Reassign array to trigger reactivity for totals calculation
    poItems = [...poItems, calculatedItem];

    // Reset form
    newItemProductId = null;
    newItemProductName = '';
    newItemQuantity = 1;
    newItemUnitPrice = 0;
    newItemTaxRate = 0.18;
    newItemPriceIncludesTax = false;
    newItemNotes = '';
    showProductSearch = false;
  }

  function updateItem(index: number) {
    if (index < 0 || index >= poItems.length) return;
    
    const item = poItems[index];
    // Recalculate this item's tax breakdown
    const updatedItem = calculatePOItemTax({
      ...item,
      quantity: Number(item.quantity) || 0,
      unitPrice: Number(item.unitPrice) || 0,
      taxRate: item.taxRate ?? 0.18,
      priceIncludesTax: item.priceIncludesTax ?? false
    });
    
    // Update the item in the array
    poItems[index] = updatedItem;
    // Trigger reactivity by reassigning the array
    poItems = [...poItems];
  }

  function removeItem(index: number) {
    poItems = poItems.filter((_, i) => i !== index);
  }

  async function savePO(asDraft: boolean = true) {
    if (!poSupplierId) {
      alert('Please select a supplier');
      return;
    }
    if (poItems.length === 0) {
      alert('Please add at least one item');
      return;
    }

    const supplier = suppliers.find(s => s.id === poSupplierId);
    const poNumber = editingPO?.poNumber || await generatePONumber();

    // Determine status:
    // - If saving as draft → 'draft'
    // - If submitting a new order → 'sent'
    // - If submitting an existing draft → 'sent'
    // - Otherwise keep existing status
    let newStatus: PurchaseOrder['status'];
    if (asDraft) {
      newStatus = 'draft';
    } else if (!editingPO) {
      // New order being submitted
      newStatus = 'sent';
    } else if (editingPO.status === 'draft') {
      // Existing draft being submitted
      newStatus = 'sent';
    } else {
      // Keep existing status
      newStatus = editingPO.status;
    }

    // Recalculate to ensure totals are correct
    const tempPO: PurchaseOrder = {
      ...(editingPO || {}),
      id: editingPO?.id || generateId(), // Generate new ID for new POs
      poNumber,
      supplierId: poSupplierId,
      supplierName: supplier?.name,
      orderDate: poOrderDate,
      expectedDate: poExpectedDate || undefined,
      status: newStatus,
      items: poItems,
      subtotal: 0,
      itbisTotal: 0,
      total: 0,
      notes: poNotes || undefined,
      createdAt: editingPO?.createdAt || new Date(),
      updatedAt: new Date()
    };

    const poData = recalculatePurchaseOrder(tempPO);

    if (editingPO?.id) {
      await db.purchaseOrders.update(editingPO.id, poData);
    } else {
      await db.purchaseOrders.add(poData);
    }

    closePOModal();
    await loadData();
  }

  async function viewPODetail(po: PurchaseOrder) {
    selectedPO = po;
    // Load linked receipts
    if (po.id) {
      linkedReceipts = await db.receipts.where('purchaseOrderId').equals(po.id).toArray();
    }
    showPODetail = true;
  }

  function closePODetail() {
    showPODetail = false;
    selectedPO = null;
    linkedReceipts = [];
  }

  async function createReceiptFromPO(po: PurchaseOrder) {
    // Navigate to receiving page with PO pre-selected
    if (po.id) {
      goto(`/purchases/receiving?po=${po.id}`);
    }
  }

  async function updatePOStatus(po: PurchaseOrder, newStatus: PurchaseOrder['status']) {
    if (po.id) {
      await db.purchaseOrders.update(po.id, { status: newStatus, updatedAt: new Date() });
      await loadData();
    }
  }

  function confirmDeletePO(id: number) {
    poToDelete = id;
    deleteDialogOpen = true;
  }

  async function executeDeletePO() {
    if (poToDelete) {
      await db.purchaseOrders.delete(poToDelete);
      deleteDialogOpen = false;
      poToDelete = null;
      await loadData();
    }
  }

  function getStatusColor(status: PurchaseOrder['status']): string {
    switch (status) {
      case 'draft': return 'bg-gray-500/10 text-gray-500';
      case 'sent': return 'bg-blue-500/10 text-blue-500';
      case 'partial': return 'bg-yellow-500/10 text-yellow-500';
      case 'received': return 'bg-green-500/10 text-green-500';
      case 'closed': return 'bg-purple-500/10 text-purple-500';
      case 'cancelled': return 'bg-red-500/10 text-red-500';
      default: return 'bg-gray-500/10 text-gray-500';
    }
  }

  function getStatusLabel(status: PurchaseOrder['status']): string {
    switch (status) {
      case 'draft': return 'Draft';
      case 'sent': return 'Sent';
      case 'partial': return 'Partial';
      case 'received': return 'Received';
      case 'closed': return 'Closed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  }

  // Get days until expected delivery
  function getDaysUntilDelivery(expectedDate: string | undefined): { days: number | null; label: string; class: string } {
    if (!expectedDate) return { days: null, label: '', class: '' };
    
    const diff = new Date(expectedDate).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) {
      return { days, label: `${Math.abs(days)}d overdue`, class: 'text-red-500' };
    } else if (days === 0) {
      return { days, label: 'Due today', class: 'text-amber-500' };
    } else if (days <= 2) {
      return { days, label: `In ${days}d`, class: 'text-amber-500' };
    } else {
      return { days, label: `In ${days}d`, class: 'text-muted-foreground' };
    }
  }

  // Duplicate/Reorder from existing PO
  async function duplicatePO(po: PurchaseOrder) {
    editingPO = null;
    poSupplierId = po.supplierId;
    previousSupplierId = po.supplierId; // Initialize tracking with duplicated supplier
    poOrderDate = new Date().toISOString().split('T')[0];
    poExpectedDate = '';
    poNotes = po.notes ? `Reorder from ${po.poNumber}` : '';
    poItems = po.items.map(item => ({
      ...item,
      // Reset calculated fields, they'll be recalculated
    }));
    newItemProductId = null;
    newItemProductName = '';
    newItemQuantity = 1;
    newItemUnitPrice = 0;
    newItemTaxRate = 0.18;
    newItemPriceIncludesTax = false;
    newItemNotes = '';
    showProductSearch = false;
    showPOModal = true;
  }

  // Status workflow steps
  const STATUS_STEPS = [
    { status: 'draft', label: 'Draft', icon: Circle },
    { status: 'sent', label: 'Sent', icon: Send },
    { status: 'partial', label: 'Partial', icon: Package },
    { status: 'received', label: 'Received', icon: PackageCheck },
    { status: 'closed', label: 'Closed', icon: CheckCircle2 }
  ];

  function getStatusStepIndex(status: PurchaseOrder['status']): number {
    if (status === 'cancelled') return -1;
    return STATUS_STEPS.findIndex(s => s.status === status);
  }

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = column === 'orderDate' || column === 'total' ? 'desc' : 'asc';
    }
  }

  // Track previous supplier to detect actual changes
  let previousSupplierId: string | null = null;
  
  // Reset product search only when supplier actually changes (not on every keystroke)
  $: if (poSupplierId !== previousSupplierId) {
    // Only clear if supplier actually changed to a new value (not initial load)
    if (previousSupplierId !== null && poSupplierId !== null) {
      newItemProductName = '';
      newItemProductId = null;
      showProductSearch = false;
    }
    previousSupplierId = poSupplierId;
  }

  // Product search for adding items - show all products, but prioritize those from selected supplier
  $: productSearchResults = (showProductSearch && newItemProductName.trim().length > 0 && products.length > 0)
    ? products.filter(p => {
        const searchTerm = newItemProductName.toLowerCase().trim();
        return (
          p.name?.toLowerCase().includes(searchTerm) ||
          p.productId?.toLowerCase().includes(searchTerm) ||
          p.barcode?.toLowerCase().includes(searchTerm) ||
          p.aliases?.some(alias => alias.toLowerCase().includes(searchTerm))
        );
      })
      // Sort: supplier-matching products first, then by name
      .sort((a, b) => {
        const aFromSupplier = poSupplierId && a.supplierId === poSupplierId;
        const bFromSupplier = poSupplierId && b.supplierId === poSupplierId;
        if (aFromSupplier && !bFromSupplier) return -1;
        if (!aFromSupplier && bFromSupplier) return 1;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 8) // Show more results
    : [];

  // Get latest transaction price from invoices for a product
  async function getLatestTransactionPrice(productId: number | undefined, productName: string): Promise<number> {
    try {
      const invoices = await db.invoices.toArray();
      const purchaseOrders = await db.purchaseOrders.toArray();
      const product = products.find(p => (p.id === productId) || (p.name.toLowerCase() === productName.toLowerCase()));
      
      // Find matching items in invoices (prioritize invoices as they're actual purchases)
      const transactionPrices: { date: string; price: number; source: 'invoice' | 'po' }[] = [];
      
      invoices.forEach((inv) => {
        if (inv.items) {
          inv.items.forEach((item) => {
            // Match by productId (if available), barcode, or name
            const matchesById = productId && item.productId && (
              item.productId === String(productId) ||
              (product?.barcode && item.productId === product.barcode)
            );
            
            const matchesByName = item.description?.toLowerCase() === productName.toLowerCase() ||
              (product && product.aliases?.some(alias => 
                item.description?.toLowerCase().includes(alias.toLowerCase())
              ));
            
            if ((matchesById || matchesByName) && item.unitPrice && item.unitPrice > 0) {
              transactionPrices.push({ 
                date: inv.issueDate || inv.createdAt?.toString() || '', 
                price: item.unitPrice,
                source: 'invoice'
              });
            }
          });
        }
      });

      // Find matching items in purchase orders (secondary source)
      purchaseOrders.forEach((po) => {
        if (po.items) {
          po.items.forEach((item) => {
            const matches = 
              (productId && item.productId === productId) ||
              item.productName?.toLowerCase() === productName.toLowerCase() ||
              (product && product.aliases?.some(alias => 
                item.productName?.toLowerCase().includes(alias.toLowerCase())
              ));
            
            if (matches && item.unitPrice && item.unitPrice > 0) {
              transactionPrices.push({ 
                date: po.orderDate || po.createdAt?.toString() || '', 
                price: item.unitPrice,
                source: 'po'
              });
            }
          });
        }
      });

      // Sort by date (most recent first) and source (invoices first), return latest price
      if (transactionPrices.length > 0) {
        transactionPrices.sort((a, b) => {
          // First sort by date (most recent first)
          const dateCompare = b.date.localeCompare(a.date);
          if (dateCompare !== 0) return dateCompare;
          // If same date, prioritize invoices over POs
          return a.source === 'invoice' ? -1 : 1;
        });
        return transactionPrices[0].price;
      }

      // Fallback to product's lastPrice
      return product?.lastPrice || 0;
    } catch (error) {
      console.error('Error getting latest transaction price:', error);
      // Fallback to product's lastPrice
      const product = products.find(p => (p.id === productId) || (p.name.toLowerCase() === productName.toLowerCase()));
      return product?.lastPrice || 0;
    }
  }
</script>

<div class="p-4 max-w-7xl mx-auto pb-24">
  <!-- Header -->
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
    <div>
      <h1 class="text-2xl font-bold">{t('nav.purchaseOrders', $locale)}</h1>
      <p class="text-muted-foreground text-sm mt-1">Manage purchase orders and track deliveries</p>
    </div>
    <Button on:click={openCreatePO} class="flex items-center gap-2">
      <Plus size={18} />
      <span>New Purchase Order</span>
    </Button>
  </div>

  <!-- Helper Info Card -->
  <Card.Root class="mb-6 border-primary/20 bg-primary/5">
    <button 
      class="w-full text-left"
      on:click={toggleInfoCard}
    >
      <Card.Header class="pb-2">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <ClipboardList class="text-primary" size={20} />
            <Card.Title class="text-base font-semibold">Purchase Orders - Plan Ahead</Card.Title>
          </div>
          {#if showInfoCard}
            <ChevronUp size={18} class="text-muted-foreground" />
          {:else}
            <ChevronDown size={18} class="text-muted-foreground" />
          {/if}
        </div>
      </Card.Header>
    </button>
    {#if showInfoCard}
      <Card.Content class="pt-2">
        <div class="space-y-3">
          <p class="text-sm text-muted-foreground">
            Create Purchase Orders for <strong>scheduled deliveries</strong> so you can track what you ordered and when it should arrive.
          </p>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 class="font-semibold text-sm text-foreground mb-2">Best for:</h4>
              <ul class="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Weekly recurring orders</li>
                <li>Large orders arriving in parts</li>
                <li>Delivery date tracking</li>
                <li>Budget planning</li>
              </ul>
            </div>
            <div>
              <h4 class="font-semibold text-sm text-foreground mb-2">Next steps:</h4>
              <ul class="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Create PO → Send to supplier</li>
                <li>When goods arrive → <a href="/purchases/receiving" class="text-primary hover:underline">Receive</a></li>
                <li>Need to reorder? Click <Copy size={12} class="inline" /> to duplicate</li>
              </ul>
            </div>
          </div>
          <div class="border-t border-border pt-3 mt-3">
            <h4 class="font-semibold text-sm text-foreground mb-2">Order Lifecycle:</h4>
            <div class="flex flex-wrap items-center gap-2 text-xs">
              <span class="px-2 py-1 bg-gray-500/10 text-gray-500 rounded font-medium">Draft</span>
              <span class="text-muted-foreground">→</span>
              <span class="px-2 py-1 bg-blue-500/10 text-blue-500 rounded font-medium">Sent</span>
              <span class="text-muted-foreground">→</span>
              <span class="px-2 py-1 bg-yellow-500/10 text-yellow-500 rounded font-medium">Partial</span>
              <span class="text-muted-foreground">→</span>
              <span class="px-2 py-1 bg-green-500/10 text-green-500 rounded font-medium">Received</span>
              <span class="text-muted-foreground">→</span>
              <span class="px-2 py-1 bg-purple-500/10 text-purple-500 rounded font-medium">Closed</span>
            </div>
          </div>
          <p class="text-xs text-muted-foreground mt-2 italic border-t border-border pt-2">
            💡 <strong>No PO?</strong> For live truck ordering, use <a href="/capture" class="text-primary hover:underline font-medium">Quick Capture</a> instead — just snap the invoice!
          </p>
        </div>
      </Card.Content>
    {/if}
  </Card.Root>

  <!-- Filters -->
  <div class="flex flex-wrap gap-2 mb-6">
    <div class="relative flex-1 min-w-[200px]">
      <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
      <Input 
        bind:value={searchQuery} 
        placeholder="Search PO number, supplier..." 
        class="pl-10 bg-card"
      />
    </div>
    <Select.Root 
      selected={{ value: statusFilter, label: statusFilter === 'all' ? 'All Status' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1) }}
      onSelectedChange={(v) => { if (v) statusFilter = v.value; }}
    >
      <Select.Trigger class="w-40">
        <Select.Value placeholder="All Status" />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="all">All Status</Select.Item>
        <Select.Item value="draft">Draft</Select.Item>
        <Select.Item value="sent">Sent</Select.Item>
        <Select.Item value="partial">Partial</Select.Item>
        <Select.Item value="received">Received</Select.Item>
        <Select.Item value="closed">Closed</Select.Item>
        <Select.Item value="cancelled">Cancelled</Select.Item>
      </Select.Content>
    </Select.Root>
    <Select.Root 
      selected={supplierFilter ? { value: supplierFilter, label: suppliers.find(s => s.id === supplierFilter)?.name || 'Unknown' } : { value: '', label: 'All Suppliers' }}
      onSelectedChange={(v) => { supplierFilter = v?.value ? v.value : null; }}
    >
      <Select.Trigger class="w-48">
        <Select.Value placeholder="All Suppliers" />
      </Select.Trigger>
      <Select.Content>
        <Select.Item value="">All Suppliers</Select.Item>
        {#each suppliers as supplier}
          <Select.Item value={supplier.id ?? ''}>{supplier.name}</Select.Item>
        {/each}
      </Select.Content>
    </Select.Root>
    <DatePicker bind:value={startDate} placeholder="From" class="w-40" />
    <DatePicker bind:value={endDate} placeholder="To" class="w-40" />
  </div>

  <!-- PO Table -->
  <div class="bg-card rounded-xl border border-border overflow-hidden">
    <Table.Root>
      <Table.Header class="bg-muted/50">
        <Table.Row>
          <Table.Head>
            <button class="flex items-center gap-1 text-xs uppercase" on:click={() => toggleSort('orderDate')}>
              Date
              {#if sortColumn === 'orderDate'}
                {#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}
              {:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
            </button>
          </Table.Head>
          <Table.Head>
            <button class="flex items-center gap-1 text-xs uppercase" on:click={() => toggleSort('poNumber')}>
              PO Number
              {#if sortColumn === 'poNumber'}
                {#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}
              {:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
            </button>
          </Table.Head>
          <Table.Head>
            <button class="flex items-center gap-1 text-xs uppercase" on:click={() => toggleSort('supplier')}>
              Supplier
              {#if sortColumn === 'supplier'}
                {#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}
              {:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
            </button>
          </Table.Head>
          <Table.Head class="text-center">Items</Table.Head>
          <Table.Head>
            <button class="flex items-center gap-1 text-xs uppercase" on:click={() => toggleSort('status')}>
              Status
              {#if sortColumn === 'status'}
                {#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}
              {:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
            </button>
          </Table.Head>
          <Table.Head class="text-center">Delivery</Table.Head>
          <Table.Head class="text-right">
            <button class="flex items-center gap-1 text-xs uppercase ml-auto" on:click={() => toggleSort('total')}>
              Total
              {#if sortColumn === 'total'}
                {#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}
              {:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
            </button>
          </Table.Head>
          <Table.Head class="text-center">Actions</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#if sortedPOs.length === 0}
          <Table.Row>
            <Table.Cell colspan="8" class="text-center py-10 text-muted-foreground">
              No purchase orders found
            </Table.Cell>
          </Table.Row>
        {:else}
          {#each sortedPOs as po}
            {@const deliveryInfo = getDaysUntilDelivery(po.expectedDate)}
            <Table.Row class="hover:bg-muted/30">
              <Table.Cell class="font-mono text-sm">{po.orderDate}</Table.Cell>
              <Table.Cell class="font-mono font-semibold">{po.poNumber}</Table.Cell>
              <Table.Cell>{po.supplierName || 'Unknown'}</Table.Cell>
              <Table.Cell class="text-center">{po.items.length}</Table.Cell>
              <Table.Cell>
                <span class="px-2 py-1 rounded text-xs font-bold {getStatusColor(po.status)}">
                  {getStatusLabel(po.status)}
                </span>
              </Table.Cell>
              <Table.Cell class="text-center">
                {#if po.status === 'received' || po.status === 'closed' || po.status === 'cancelled'}
                  <span class="text-muted-foreground text-xs">—</span>
                {:else if deliveryInfo.days !== null}
                  <div class="flex items-center justify-center gap-1 {deliveryInfo.class}">
                    {#if deliveryInfo.days < 0}
                      <AlertTriangle size={14} />
                    {:else}
                      <Clock size={14} />
                    {/if}
                    <span class="text-xs font-medium">{deliveryInfo.label}</span>
                  </div>
                {:else}
                  <span class="text-muted-foreground text-xs">No date</span>
                {/if}
              </Table.Cell>
              <Table.Cell class="text-right font-mono font-bold">
                ${po.total.toLocaleString()}
              </Table.Cell>
              <Table.Cell>
                <div class="flex items-center justify-center gap-1">
                  <button 
                    on:click={() => viewPODetail(po)}
                    class="p-2 text-muted-foreground hover:text-primary transition-colors"
                    title="View Details"
                  >
                    <Eye size={16} />
                  </button>
                  {#if po.status === 'draft'}
                    <button 
                      on:click={() => openEditPO(po)}
                      class="p-2 text-muted-foreground hover:text-primary transition-colors"
                      title="Edit"
                    >
                      <Edit size={16} />
                    </button>
                  {/if}
                  {#if po.status !== 'received' && po.status !== 'closed' && po.status !== 'cancelled'}
                    <button 
                      on:click={() => createReceiptFromPO(po)}
                      class="p-2 text-green-500 hover:text-green-600 transition-colors"
                      title="Receive Goods"
                    >
                      <Truck size={16} />
                    </button>
                  {/if}
                  <button 
                    on:click={() => duplicatePO(po)}
                    class="p-2 text-muted-foreground hover:text-blue-500 transition-colors"
                    title="Duplicate / Reorder"
                  >
                    <Copy size={16} />
                  </button>
                  {#if po.id}
                    <button 
                      on:click={() => confirmDeletePO(po.id)}
                      class="p-2 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  {/if}
                </div>
              </Table.Cell>
            </Table.Row>
          {/each}
        {/if}
      </Table.Body>
    </Table.Root>
  </div>
</div>

<!-- PO Creation/Edit Modal -->
<Dialog.Root bind:open={showPOModal}>
  <Dialog.Content class="max-w-6xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
    <Dialog.Header>
      <Dialog.Title>{editingPO ? 'Edit Purchase Order' : 'New Purchase Order'}</Dialog.Title>
      <Dialog.Description>
        {editingPO ? 'Update purchase order details' : 'Create a new purchase order'}
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4">
      <!-- Supplier Selection -->
      <div>
        <Label>Supplier *</Label>
        <Select.Root 
          selected={poSupplierId ? { value: poSupplierId, label: suppliers.find(s => s.id === poSupplierId)?.name || 'Unknown' } : undefined}
          onSelectedChange={(v) => { poSupplierId = v?.value ?? null; }}
        >
          <Select.Trigger>
            <Select.Value placeholder="Select supplier" />
          </Select.Trigger>
          <Select.Content>
            {#if suppliers.length === 0}
              <div class="px-2 py-1.5 text-sm text-muted-foreground">No suppliers found</div>
            {:else}
              {#each suppliers as supplier}
                <Select.Item value={supplier.id ?? ''}>
                  {supplier.name}
                </Select.Item>
              {/each}
            {/if}
          </Select.Content>
        </Select.Root>
      </div>

      <!-- Dates -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <Label>Order Date *</Label>
          <DatePicker bind:value={poOrderDate} class="w-full" />
        </div>
        <div>
          <Label>Expected Delivery Date</Label>
          <DatePicker bind:value={poExpectedDate} class="w-full" />
        </div>
      </div>

      <!-- Items -->
      <div>
        <Label>Items *</Label>
        <div class="border border-border rounded-lg p-4 space-y-3">
          <!-- Items Table -->
          {#if poItems.length > 0}
            <div>
            <Table.Root class="w-full">
              <Table.Header>
                <Table.Row>
                  <Table.Head>Product</Table.Head>
                  <Table.Head class="text-right">Quantity</Table.Head>
                  <Table.Head class="text-right">Unit Price</Table.Head>
                  <Table.Head class="text-right w-[140px]">Tax Rate</Table.Head>
                  <Table.Head class="text-center w-[100px]">Tax Included</Table.Head>
                  <Table.Head class="text-right">Subtotal</Table.Head>
                  <Table.Head class="text-right">Tax</Table.Head>
                  <Table.Head class="text-right">Total</Table.Head>
                  <Table.Head class="w-12"></Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {#each poItems as item, index (index)}
                  <Table.Row>
                    <Table.Cell>
                      <div class="font-medium">{item.productName}</div>
                      {#if item.notes}
                        <div class="text-xs text-muted-foreground">{item.notes}</div>
                      {/if}
                    </Table.Cell>
                    <Table.Cell class="text-right">
                      <Input 
                        type="number"
                        bind:value={item.quantity}
                        min="0.01"
                        step="0.01"
                        on:input={() => updateItem(index)}
                        class="w-full max-w-[80px] text-right font-mono h-8 text-sm"
                      />
                    </Table.Cell>
                    <Table.Cell class="text-right">
                      <Input 
                        type="number"
                        bind:value={item.unitPrice}
                        min="0"
                        step="0.01"
                        on:input={() => updateItem(index)}
                        class="w-full max-w-[100px] text-right font-mono h-8 text-sm"
                        placeholder="0.00"
                      />
                    </Table.Cell>
                    <Table.Cell class="text-right w-[140px]">
                      {@const itemTaxRate = item.taxRate ?? 0.18}
                      {@const normalizedTaxRate = itemTaxRate === 0.18 ? 0.18 : itemTaxRate === 0.16 ? 0.16 : itemTaxRate === 0 ? 0 : 0.18}
                      {@const taxRateOption = TAX_RATES.find(r => r.value === normalizedTaxRate) || TAX_RATES[0]}
                      {@const isTaxDropdownOpen = openTaxDropdownIndex === index}
                      <div class="relative inline-block w-full">
                        <button
                          type="button"
                          class="w-full min-w-[130px] h-8 text-xs px-3 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
                          on:click={() => {
                            openTaxDropdownIndex = isTaxDropdownOpen ? null : index;
                          }}
                          on:click outside={() => {
                            if (isTaxDropdownOpen) openTaxDropdownIndex = null;
                          }}
                        >
                          <span>{taxRateOption.label}</span>
                          <svg class="h-4 w-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {#if isTaxDropdownOpen}
                          <div 
                            class="absolute top-full left-0 mt-1 w-[140px] bg-popover border border-border rounded-md shadow-xl"
                            style="z-index: 99999;"
                            on:click outside={() => {
                              if (openTaxDropdownIndex === index) openTaxDropdownIndex = null;
                            }}
                          >
                            {#each TAX_RATES as rate, rateIndex (rate.value)}
                              <button
                                type="button"
                                class="w-full text-left px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground transition-colors block whitespace-nowrap {rate.value === normalizedTaxRate ? 'bg-accent font-medium' : ''} {rateIndex === 0 ? 'rounded-t-md' : ''} {rateIndex === TAX_RATES.length - 1 ? 'rounded-b-md' : ''}"
                                on:click={() => {
                                  const newTaxRate = rate.value;
                                  // Create updated item with new tax rate
                                  const updatedItem = { 
                                    ...poItems[index], 
                                    taxRate: newTaxRate,
                                    quantity: Number(poItems[index].quantity) || 0,
                                    unitPrice: Number(poItems[index].unitPrice) || 0,
                                    priceIncludesTax: poItems[index].priceIncludesTax ?? false
                                  };
                                  
                                  // Recalculate the item with new tax rate
                                  const recalculatedItem = calculatePOItemTax(updatedItem);
                                  
                                  // Update in array and trigger reactivity by creating new array
                                  const updatedItems = [...poItems];
                                  updatedItems[index] = recalculatedItem;
                                  poItems = updatedItems;
                                  
                                  // Close dropdown
                                  openTaxDropdownIndex = null;
                                }}
                              >
                                {rate.label}
                              </button>
                            {/each}
                          </div>
                        {/if}
                      </div>
                    </Table.Cell>
                    <Table.Cell class="text-center">
                      <div class="flex justify-center items-center">
                        <Checkbox 
                          bind:checked={item.priceIncludesTax}
                          onCheckedChange={(checked) => {
                            item.priceIncludesTax = checked ?? false;
                            const updatedItem = { 
                              ...poItems[index], 
                              priceIncludesTax: checked ?? false,
                              quantity: Number(poItems[index].quantity) || 0,
                              unitPrice: Number(poItems[index].unitPrice) || 0,
                              taxRate: poItems[index].taxRate ?? 0.18
                            };
                            const recalculatedItem = calculatePOItemTax(updatedItem);
                            const updatedItems = [...poItems];
                            updatedItems[index] = recalculatedItem;
                            poItems = updatedItems;
                          }}
                          id="price-includes-tax-{index}"
                        />
                      </div>
                    </Table.Cell>
                    <Table.Cell class="text-right font-mono">${Number(item.value || 0).toFixed(2)}</Table.Cell>
                    <Table.Cell class="text-right font-mono text-sm">${Number(item.itbis || 0).toFixed(2)}</Table.Cell>
                    <Table.Cell class="text-right font-mono font-bold">${Number(item.amount || 0).toFixed(2)}</Table.Cell>
                    <Table.Cell>
                      <button 
                        on:click={() => removeItem(index)}
                        class="p-1 text-destructive hover:bg-destructive/10 rounded"
                        title="Remove item"
                      >
                        <X size={16} />
                      </button>
                    </Table.Cell>
                  </Table.Row>
                {/each}
              </Table.Body>
            </Table.Root>
            </div>
          {/if}

          <!-- Add Item Form -->
          <div class="border-t border-border pt-3 space-y-2">
            <Input 
              bind:value={newItemProductName}
              on:focus={() => showProductSearch = true}
              on:input={() => showProductSearch = true}
              placeholder="Search product or enter name..."
              class="w-full"
            />
            {#if productSearchResults.length > 0}
              <div class="bg-popover border border-border rounded-lg p-1 max-h-40 overflow-y-auto">
                {#each productSearchResults as product}
                  {@const displayPrice = Number(product.lastPrice || 0).toFixed(2)}
                  <button
                    on:click={async () => {
                      newItemProductId = product.id || null;
                      const selectedProductName = product.name;
                      
                      // Get latest transaction price from invoices/POs
                      const latestPrice = await getLatestTransactionPrice(product.id, selectedProductName);
                      
                      // Set form fields
                      newItemProductName = selectedProductName;
                      newItemUnitPrice = latestPrice || product.lastPrice || 0;
                      newItemTaxRate = product.costTaxRate || 0.18;
                      newItemPriceIncludesTax = product.costIncludesTax ?? false;
                      
                      // Hide search dropdown
                      showProductSearch = false;
                    }}
                    class="w-full text-left px-3 py-2 hover:bg-accent rounded text-sm transition-colors"
                    type="button"
                  >
                    <div class="flex justify-between items-center">
                      <span class="font-medium">{product.name}</span>
                      <span class="text-muted-foreground font-mono text-xs">
                        ${displayPrice}
                      </span>
                    </div>
                    {#if product.supplierId}
                      {@const supplierName = suppliers.find(s => s.id === product.supplierId)?.name}
                      {#if supplierName}
                        <div class="text-xs text-muted-foreground mt-0.5">{supplierName}</div>
                      {/if}
                    {/if}
                  </button>
                {/each}
              </div>
            {/if}
            <div class="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
              <div class="space-y-1.5">
                <Label class="text-xs uppercase">Quantity</Label>
                <Input 
                  type="number"
                  bind:value={newItemQuantity}
                  placeholder="Quantity"
                  min="1"
                  step="1"
                />
              </div>
              <div class="space-y-1.5">
                <Label class="text-xs uppercase">Price</Label>
                <Input 
                  type="number"
                  bind:value={newItemUnitPrice}
                  placeholder="Unit Price"
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <Select.Root 
                  selected={{ value: newItemTaxRate.toString(), label: TAX_RATES.find(r => r.value === newItemTaxRate)?.label || '18%' }}
                  onSelectedChange={(v) => { if (v) newItemTaxRate = parseFloat(v.value); }}
                >
                  <Select.Trigger>
                    <Select.Value placeholder="Tax" />
                  </Select.Trigger>
                  <Select.Content>
                    {#each TAX_RATES as rate}
                      <Select.Item value={rate.value.toString()}>{rate.label}</Select.Item>
                    {/each}
                  </Select.Content>
                </Select.Root>
              </div>
              <div>
                <Button on:click={addItem} class="w-full">Add Item</Button>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <Checkbox bind:checked={newItemPriceIncludesTax} id="price-includes-tax" />
              <Label for="price-includes-tax" class="text-sm cursor-pointer">
                Price includes tax
              </Label>
            </div>
            <Input 
              bind:value={newItemNotes}
              placeholder="Notes (optional)"
              class="w-full"
            />
          </div>
        </div>
      </div>

      <!-- Totals (Always visible, updates live) -->
      <div class="flex justify-end border-t border-border pt-4 mt-4">
        <div class="w-72 space-y-2 bg-muted/30 p-4 rounded-lg border border-border">
          <div class="flex justify-between text-sm">
            <span class="text-muted-foreground font-medium">Subtotal</span>
            <span class="font-mono font-semibold">${poSubtotal.toFixed(2)}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-muted-foreground font-medium">Tax (ITBIS)</span>
            <span class="font-mono font-semibold">${poItbisTotal.toFixed(2)}</span>
          </div>
          <div class="flex justify-between text-lg font-bold border-t-2 border-border pt-2 mt-2">
            <span>Grand Total</span>
            <span class="font-mono text-primary">${poTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <!-- Notes -->
      <div>
        <Label>Notes</Label>
        <Input bind:value={poNotes} placeholder="Additional notes..." />
      </div>
    </div>

    <Dialog.Footer>
      <Button variant="outline" on:click={closePOModal}>Cancel</Button>
      {#if editingPO?.status === 'draft' || !editingPO}
        <Button variant="outline" on:click={() => savePO(true)}>
          Save Draft
        </Button>
      {/if}
      <Button on:click={() => savePO(false)}>
        {editingPO?.status === 'draft' ? 'Submit Order' : editingPO ? 'Update Order' : 'Create & Submit'}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- PO Detail Modal -->
<Dialog.Root bind:open={showPODetail}>
  <Dialog.Content class="max-w-3xl max-h-[90vh] overflow-y-auto">
    <Dialog.Header>
      <Dialog.Title>Purchase Order Details</Dialog.Title>
      <Dialog.Description>{selectedPO?.poNumber}</Dialog.Description>
    </Dialog.Header>

    {#if selectedPO}
      {@const currentStepIndex = getStatusStepIndex(selectedPO.status)}
      {@const deliveryInfo = getDaysUntilDelivery(selectedPO.expectedDate)}
      <div class="space-y-4">
        <!-- Status Timeline -->
        {#if selectedPO.status !== 'cancelled'}
          <div class="bg-muted/30 rounded-lg p-4">
            <div class="flex items-center justify-between">
              {#each STATUS_STEPS as step, index}
                {@const isCompleted = index <= currentStepIndex}
                {@const isCurrent = index === currentStepIndex}
                <div class="flex flex-col items-center flex-1">
                  <div class="relative">
                    <div class="w-10 h-10 rounded-full flex items-center justify-center transition-all
                      {isCompleted ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}
                      {isCurrent ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}">
                      <svelte:component this={step.icon} size={18} />
                    </div>
                  </div>
                  <span class="text-xs mt-2 font-medium {isCompleted ? 'text-primary' : 'text-muted-foreground'}">
                    {step.label}
                  </span>
                </div>
                {#if index < STATUS_STEPS.length - 1}
                  <div class="flex-1 h-1 mx-2 rounded {index < currentStepIndex ? 'bg-primary' : 'bg-muted'}"></div>
                {/if}
              {/each}
            </div>
          </div>
        {:else}
          <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-center">
            <span class="text-red-500 font-medium">This order was cancelled</span>
          </div>
        {/if}

        <!-- Delivery Alert -->
        {#if selectedPO.status === 'sent' || selectedPO.status === 'partial'}
          {#if deliveryInfo.days !== null && deliveryInfo.days < 0}
            <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle class="text-red-500" size={18} />
              <span class="text-sm font-medium text-red-500">
                This delivery is {Math.abs(deliveryInfo.days)} days overdue
              </span>
            </div>
          {:else if deliveryInfo.days !== null && deliveryInfo.days <= 2}
            <div class="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-center gap-2">
              <Clock class="text-amber-500" size={18} />
              <span class="text-sm font-medium text-amber-500">
                {deliveryInfo.days === 0 ? 'Expected delivery today' : `Expected in ${deliveryInfo.days} day${deliveryInfo.days > 1 ? 's' : ''}`}
              </span>
            </div>
          {/if}
        {/if}

        <!-- Info Grid -->
        <div class="grid grid-cols-2 gap-4">
          <div class="bg-muted/50 p-3 rounded-lg">
            <div class="text-xs text-muted-foreground uppercase mb-1">Supplier</div>
            <div class="font-medium">{selectedPO.supplierName}</div>
          </div>
          <div class="bg-muted/50 p-3 rounded-lg">
            <div class="text-xs text-muted-foreground uppercase mb-1">Status</div>
            <span class="px-2 py-1 rounded text-xs font-bold {getStatusColor(selectedPO.status)}">
              {getStatusLabel(selectedPO.status)}
            </span>
          </div>
          <div class="bg-muted/50 p-3 rounded-lg">
            <div class="text-xs text-muted-foreground uppercase mb-1">Order Date</div>
            <div class="font-medium">{selectedPO.orderDate}</div>
          </div>
          {#if selectedPO.expectedDate}
            <div class="bg-muted/50 p-3 rounded-lg">
              <div class="text-xs text-muted-foreground uppercase mb-1">Expected Delivery</div>
              <div class="font-medium flex items-center gap-2">
                {selectedPO.expectedDate}
                {#if deliveryInfo.days !== null}
                  <span class="text-xs {deliveryInfo.class}">({deliveryInfo.label})</span>
                {/if}
              </div>
            </div>
          {/if}
        </div>

        <!-- Items Table -->
        <div>
          <h3 class="font-bold mb-2">Items</h3>
          <Table.Root>
            <Table.Header>
              <Table.Row>
                <Table.Head>Product</Table.Head>
                <Table.Head class="text-center">Quantity</Table.Head>
                <Table.Head class="text-right">Unit Price</Table.Head>
                <Table.Head class="text-right">Tax Rate</Table.Head>
                <Table.Head class="text-right">Subtotal</Table.Head>
                <Table.Head class="text-right">Tax</Table.Head>
                <Table.Head class="text-right">Total</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {#each selectedPO.items as item}
                <Table.Row>
                  <Table.Cell>
                    <div class="font-medium">{item.productName}</div>
                    {#if item.notes}
                      <div class="text-xs text-muted-foreground">{item.notes}</div>
                    {/if}
                  </Table.Cell>
                  <Table.Cell class="text-center font-mono">{item.quantity}</Table.Cell>
                  <Table.Cell class="text-right font-mono">${Number(item.unitPrice || 0).toFixed(2)}</Table.Cell>
                  <Table.Cell class="text-right text-sm">
                    {((item.taxRate || 0) * 100)}%
                  </Table.Cell>
                  <Table.Cell class="text-right font-mono">${Number(item.value || (item.quantity * item.unitPrice) || 0).toFixed(2)}</Table.Cell>
                  <Table.Cell class="text-right font-mono text-sm">${Number(item.itbis || 0).toFixed(2)}</Table.Cell>
                  <Table.Cell class="text-right font-mono font-bold">
                    ${Number(item.amount || (item.quantity * item.unitPrice) || 0).toFixed(2)}
                  </Table.Cell>
                </Table.Row>
              {/each}
            </Table.Body>
          </Table.Root>
        </div>

        <!-- Linked Receipts -->
        {#if linkedReceipts.length > 0}
          <div>
            <h3 class="font-bold mb-2">Linked Receipts</h3>
            <div class="space-y-2">
              {#each linkedReceipts as receipt}
                <div class="bg-muted/50 p-3 rounded-lg flex justify-between items-center">
                  <div>
                    <div class="font-medium">{receipt.receiptNumber}</div>
                    <div class="text-sm text-muted-foreground">{receipt.receiptDate}</div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    on:click={() => { closePODetail(); goto(`/purchases/receiving?receipt=${receipt.id}`); }}
                  >
                    View Receipt
                  </Button>
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Totals -->
        <div class="flex justify-end">
          <div class="w-64 space-y-1">
            <div class="flex justify-between text-sm">
              <span class="text-muted-foreground">Subtotal</span>
              <span class="font-mono">${Number(selectedPO.subtotal || 0).toFixed(2)}</span>
            </div>
            {#if selectedPO.itbisTotal !== undefined && selectedPO.itbisTotal > 0}
              <div class="flex justify-between text-sm">
                <span class="text-muted-foreground">Tax (ITBIS)</span>
                <span class="font-mono">${Number(selectedPO.itbisTotal || 0).toFixed(2)}</span>
              </div>
            {/if}
            <div class="flex justify-between text-lg font-bold border-t border-border pt-1">
              <span>Total</span>
              <span class="font-mono">${Number(selectedPO.total || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>

        {#if selectedPO.notes}
          <div>
            <h3 class="font-bold mb-2">Notes</h3>
            <p class="text-sm text-muted-foreground">{selectedPO.notes}</p>
          </div>
        {/if}
      </div>
    {/if}

    <Dialog.Footer class="flex-wrap gap-2">
      <Button variant="outline" on:click={() => { 
        if (selectedPO) {
          const po = selectedPO;
          closePODetail(); 
          duplicatePO(po); 
        }
      }}>
        <Copy size={16} class="mr-2" />
        Reorder
      </Button>
      {#if selectedPO && selectedPO.status !== 'received' && selectedPO.status !== 'closed' && selectedPO.status !== 'cancelled'}
        <Button on:click={() => { 
          if (selectedPO) {
            const po = selectedPO;
            closePODetail(); 
            createReceiptFromPO(po); 
          }
        }}>
          <Truck size={16} class="mr-2" />
          Receive Goods
        </Button>
      {/if}
      <Button variant="outline" on:click={closePODetail}>Close</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Delete Confirmation -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Delete Purchase Order</AlertDialog.Title>
      <AlertDialog.Description>
        Are you sure you want to delete this purchase order? This action cannot be undone.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel on:click={() => { deleteDialogOpen = false; poToDelete = null; }}>
        Cancel
      </AlertDialog.Cancel>
      <AlertDialog.Action 
        class="bg-destructive text-destructive-foreground" 
        on:click={executeDeletePO}
      >
        Delete
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

