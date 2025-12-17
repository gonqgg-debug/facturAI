<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { db } from '$lib/db';
  import type { CashRegisterShift, CashDenomination, Sale, User } from '$lib/types';
  import { activeShift, activeShiftId, locale } from '$lib/stores';
  import { t } from '$lib/i18n';
  import { getCOGSForShift } from '$lib/fifo';
  import { createShiftCOGSEntry } from '$lib/journal';
  import { loginWithPin, currentUser } from '$lib/auth';
  import { 
    Clock, DollarSign, TrendingUp, ShoppingCart, 
    CreditCard, Banknote, ArrowRightLeft, AlertTriangle,
    CheckCircle2, XCircle, Plus, Minus, Calculator, History, Key, Users
  } from 'lucide-svelte';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Card from '$lib/components/ui/card';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Button } from '$lib/components/ui/button';
  import { Separator } from '$lib/components/ui/separator';
  import { Badge } from '$lib/components/ui/badge';

  const dispatch = createEventDispatcher();

  // Expose refresh function so parent can call it after a sale
  export async function refreshSales() {
    if (currentShift?.id) {
      await loadShiftSales(currentShift.id);
    }
  }

  // State
  let currentShift: CashRegisterShift | null = null;
  let shiftHistory: CashRegisterShift[] = [];
  let shiftSales: Sale[] = [];
  let grossMargin = 0;
  let estimatedCOGS = 0;
  
  // Opening Shift
  let openShiftDialogOpen = false;
  let openingCash = 0;
  let cashierName = '';
  
  // PIN Authentication
  let pinValue = '';
  let pinError = '';
  let isVerifyingPin = false;
  let selectedUserId: number | null = null;  // User selected from dropdown
  let selectedUser: User | null = null;       // Full user object
  let authenticatedUser: User | null = null;  // User after PIN verification
  let availableUsers: User[] = [];
  let requirePinAuth = false; // Will be set to true if there are users with PINs
  
  // Closing Shift
  let closeShiftDialogOpen = false;
  let closingNotes = '';
  let showDenominations = false;
  
  // Cash counting - direct entry mode
  let directCashEntry = 0;
  
  // Cash counting by denomination (Dominican Pesos)
  let denominations: CashDenomination[] = [
    { denomination: 2000, quantity: 0, total: 0 },
    { denomination: 1000, quantity: 0, total: 0 },
    { denomination: 500, quantity: 0, total: 0 },
    { denomination: 200, quantity: 0, total: 0 },
    { denomination: 100, quantity: 0, total: 0 },
    { denomination: 50, quantity: 0, total: 0 },
    { denomination: 25, quantity: 0, total: 0 },
    { denomination: 10, quantity: 0, total: 0 },
    { denomination: 5, quantity: 0, total: 0 },
    { denomination: 1, quantity: 0, total: 0 }
  ];
  
  // Total counted: if using denominations, sum them; otherwise use direct entry
  // Ensure numeric values
  $: totalCounted = showDenominations 
    ? denominations.reduce((sum, d) => sum + Number(d.total || 0), 0)
    : Number(directCashEntry || 0);
  
  // Cash In/Out
  let cashMovementDialogOpen = false;
  let cashMovementType: 'in' | 'out' = 'in';
  let cashMovementAmount = 0;
  let cashMovementNotes = '';

  // Calculate totals from sales (ensure numeric values)
  $: totalCashSales = shiftSales.filter(s => s.paymentMethod === 'cash' && s.paymentStatus === 'paid').reduce((sum, s) => sum + Number(s.total || 0), 0);
  $: totalCardSales = shiftSales.filter(s => ['credit_card', 'debit_card'].includes(s.paymentMethod) && s.paymentStatus === 'paid').reduce((sum, s) => sum + Number(s.total || 0), 0);
  $: totalTransferSales = shiftSales.filter(s => s.paymentMethod === 'bank_transfer' && s.paymentStatus === 'paid').reduce((sum, s) => sum + Number(s.total || 0), 0);
  $: totalCreditSales = shiftSales.filter(s => s.paymentStatus === 'pending').reduce((sum, s) => sum + Number(s.total || 0), 0);
  $: totalSales = shiftSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  $: salesCount = shiftSales.length;
  $: grossMargin = Number(totalSales - (currentShift?.cogsTotal ?? estimatedCOGS ?? 0));

  // Expected cash calculation
  // Formula: Opening Cash + Cash Sales + Cash In - Cash Out
  // Use Number() to ensure numeric operations (inputs can return strings)
  $: expectedCash = currentShift 
    ? Number(currentShift.openingCash || 0) + 
      Number(totalCashSales) +
      Number(currentShift.cashIn || 0) - 
      Number(currentShift.cashOut || 0)
    : 0;

  onMount(async () => {
    await loadActiveShift();
    await loadAvailableUsers();
  });
  
  async function loadAvailableUsers() {
    if (!browser) return;
    // Load users that have PINs configured
    availableUsers = await db.users.filter(u => u.isActive && u.pin).toArray();
    // If there are users with PINs, require PIN authentication
    requirePinAuth = availableUsers.length > 0;
    
    // If user is already logged in (from Firebase/session), pre-populate
    if ($currentUser) {
      authenticatedUser = $currentUser;
      selectedUser = $currentUser;
      selectedUserId = $currentUser.id || null;
      cashierName = $currentUser.displayName;
    }
  }
  
  function selectUser(userId: number | null) {
    selectedUserId = userId;
    selectedUser = userId ? availableUsers.find(u => u.id === userId) || null : null;
    // Reset authentication when changing user
    authenticatedUser = null;
    pinValue = '';
    pinError = '';
  }

  async function loadActiveShift() {
    if (!browser) return;
    
    const shiftId = $activeShiftId;
    if (shiftId) {
      const shift = await db.shifts.get(shiftId);
      if (shift && shift.status === 'open') {
        currentShift = shift;
        activeShift.set(shift);
        await loadShiftSales(shiftId);
      } else {
        // Shift was closed or doesn't exist
        activeShiftId.set(null);
        activeShift.set(null);
        currentShift = null;
      }
    }
    
    // Load history
    shiftHistory = await db.shifts.orderBy('openedAt').reverse().limit(10).toArray();
  }

  async function loadShiftSales(shiftId: number) {
    if (!browser) return;
    shiftSales = await db.sales.where('shiftId').equals(shiftId).toArray();
  }
  
  async function openCloseDialog() {
    if (!browser || !currentShift?.id) return;
    estimatedCOGS = await getCOGSForShift(currentShift.id);
    grossMargin = Number(totalSales - estimatedCOGS);
    closeShiftDialogOpen = true;
  }

  async function generateShiftNumber(): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    // Count shifts today
    const todayStart = new Date(year, now.getMonth(), now.getDate()).toISOString();
    const todayShifts = await db.shifts.where('openedAt').above(new Date(todayStart)).count();
    
    return `${year}${month}${day}-${String(todayShifts + 1).padStart(3, '0')}`;
  }
  
  async function verifyPin() {
    if (!selectedUser) {
      pinError = $locale === 'es' ? 'Selecciona un cajero primero' : 'Select a cashier first';
      return;
    }
    
    if (!pinValue || pinValue.length < 4) {
      pinError = $locale === 'es' ? 'Ingresa un PIN de al menos 4 dígitos' : 'Enter a PIN of at least 4 digits';
      return;
    }
    
    isVerifyingPin = true;
    pinError = '';
    
    try {
      // Verify PIN matches the selected user's PIN
      if (selectedUser.pin === pinValue) {
        authenticatedUser = selectedUser;
        cashierName = selectedUser.displayName;
        pinError = '';
        
        // Update last login
        if (selectedUser.id) {
          await db.users.update(selectedUser.id, { lastLogin: new Date() });
        }
      } else {
        pinError = t('users.wrongPin', $locale);
        authenticatedUser = null;
      }
    } catch (e: any) {
      pinError = e.message || t('users.wrongPin', $locale);
      authenticatedUser = null;
    } finally {
      isVerifyingPin = false;
    }
  }
  
  function clearPinAuth() {
    pinValue = '';
    pinError = '';
    authenticatedUser = null;
    selectedUser = null;
    selectedUserId = null;
    cashierName = '';
  }

  async function openShift() {
    if (!browser) return;
    
    // If PIN auth is required but user not authenticated, don't proceed
    if (requirePinAuth && !authenticatedUser) {
      pinError = $locale === 'es' ? 'Debes ingresar tu PIN para abrir un turno' : 'You must enter your PIN to open a shift';
      return;
    }
    
    const shiftNumber = await generateShiftNumber();
    const now = new Date();
    
    // Ensure openingCash is a number (input fields return strings)
    const parsedOpeningCash = Number(openingCash) || 0;
    
    const newShift: CashRegisterShift = {
      shiftNumber,
      cashierName: authenticatedUser?.displayName || cashierName || undefined,
      cashierId: authenticatedUser?.id,
      openedAt: now,
      openingCash: parsedOpeningCash,
      status: 'open',
      cashIn: 0,
      cashOut: 0
    };
    
    const id = await db.shifts.add(newShift);
    newShift.id = id as number;
    
    currentShift = newShift;
    activeShiftId.set(id as number);
    activeShift.set(newShift);
    
    openShiftDialogOpen = false;
    openingCash = 0;
    cashierName = '';
    // Reset PIN state but keep authenticatedUser for session
    pinValue = '';
    pinError = '';
    selectedUserId = authenticatedUser?.id || null;
    selectedUser = authenticatedUser;
    
    dispatch('shiftOpened', newShift);
    await loadActiveShift();
  }

  async function closeShift() {
    if (!browser || !currentShift?.id) return;
    if (currentShift.status === 'closed') return;
    
    const now = new Date();
    
    // Calculate COGS using FIFO for this shift
    // This is the "magic entry" that turns purchases into real expense
    const totalCOGS = await getCOGSForShift(currentShift.id);
    estimatedCOGS = totalCOGS;
    const calculatedGrossMargin = Number(totalSales - totalCOGS);
    grossMargin = calculatedGrossMargin;
    
    const updates: Partial<CashRegisterShift> = {
      closedAt: now,
      closingCash: totalCounted,
      expectedCash: expectedCash,
      cashDifference: totalCounted - expectedCash,
      totalSales,
      totalCashSales,
      totalCardSales,
      totalTransferSales,
      totalCreditSales,
      salesCount,
      cogsTotal: totalCOGS,
      grossMargin: calculatedGrossMargin,
      status: 'closed',
      closingNotes: closingNotes || undefined
    };
    
    await db.shifts.update(currentShift.id, updates);
    
    const closedShift = { ...currentShift, ...updates };
    
    // Create the COGS journal entry (Debit COGS, Credit Inventory)
    // This automatically posts the accounting entry for cost of goods sold
    if (totalCOGS > 0) {
      const entry = await createShiftCOGSEntry(closedShift as CashRegisterShift, totalCOGS);
      if (entry?.id) {
        closedShift.cogsJournalEntryId = entry.id;
        await db.shifts.update(currentShift.id, { cogsJournalEntryId: entry.id });
      }
      console.log(`Created COGS journal entry for shift #${closedShift.shiftNumber}: $${totalCOGS.toFixed(2)}`);
    }
    
    currentShift = null;
    activeShiftId.set(null);
    activeShift.set(null);
    
    closeShiftDialogOpen = false;
    closingNotes = '';
    resetDenominations();
    
    dispatch('shiftClosed', closedShift);
    await loadActiveShift();
  }

  async function addCashMovement() {
    if (!browser || !currentShift?.id) return;
    
    // Ensure amount is a number
    const amount = Number(cashMovementAmount) || 0;
    
    if (cashMovementType === 'in') {
      await db.shifts.update(currentShift.id, {
        cashIn: Number(currentShift.cashIn || 0) + amount,
        cashInNotes: cashMovementNotes ? 
          `${currentShift.cashInNotes || ''}\n${new Date().toLocaleTimeString()}: +$${amount} - ${cashMovementNotes}`.trim() : 
          currentShift.cashInNotes
      });
    } else {
      await db.shifts.update(currentShift.id, {
        cashOut: Number(currentShift.cashOut || 0) + amount,
        cashOutNotes: cashMovementNotes ? 
          `${currentShift.cashOutNotes || ''}\n${new Date().toLocaleTimeString()}: -$${amount} - ${cashMovementNotes}`.trim() : 
          currentShift.cashOutNotes
      });
    }
    
    cashMovementDialogOpen = false;
    cashMovementAmount = 0;
    cashMovementNotes = '';
    await loadActiveShift();
  }

  function updateDenomination(index: number, qty: number) {
    denominations[index].quantity = Math.max(0, qty);
    denominations[index].total = denominations[index].denomination * denominations[index].quantity;
    denominations = [...denominations];
  }

  function resetDenominations() {
    denominations = denominations.map(d => ({ ...d, quantity: 0, total: 0 }));
    directCashEntry = 0;
  }

  function formatDuration(start: Date, end?: Date): string {
    const endTime = end || new Date();
    const diff = endTime.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  function getDifferenceStatus(diff: number): { label: string; class: string; icon: typeof CheckCircle2 } {
    if (diff === 0) return { label: t('shifts.exact', $locale), class: 'text-green-500', icon: CheckCircle2 };
    if (diff > 0) return { label: t('shifts.over', $locale), class: 'text-blue-500', icon: TrendingUp };
    return { label: t('shifts.short', $locale), class: 'text-destructive', icon: AlertTriangle };
  }
</script>

<div class="space-y-4">
  {#if currentShift}
    <!-- Active Shift Card -->
    <Card.Root class="border-green-500/50 bg-green-500/5">
      <Card.Header class="pb-2">
        <div class="flex items-center justify-between">
          <Card.Title class="flex items-center gap-2 text-green-500">
            <Clock size={18} class="animate-pulse" />
            {t('shifts.currentShift', $locale)}
          </Card.Title>
          <Badge variant="outline" class="text-green-500 border-green-500">
            {currentShift.shiftNumber}
          </Badge>
        </div>
      </Card.Header>
      <Card.Content class="space-y-4">
        <!-- Shift Info -->
        <div class="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span class="text-muted-foreground">{t('shifts.openedAt', $locale)}:</span>
            <div class="font-medium">
              {currentShift.openedAt.toLocaleTimeString($locale === 'es' ? 'es-DO' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          <div>
            <span class="text-muted-foreground">{t('shifts.duration', $locale)}:</span>
            <div class="font-medium">{formatDuration(currentShift.openedAt)}</div>
          </div>
          {#if currentShift.cashierName}
            <div class="col-span-2">
              <span class="text-muted-foreground">{t('receipt.cashier', $locale)}:</span>
              <div class="font-medium">{currentShift.cashierName}</div>
            </div>
          {/if}
        </div>

        <Separator />

        <!-- Sales Summary -->
        <div class="grid grid-cols-2 gap-3">
          <div class="bg-muted/50 rounded-lg p-3">
            <div class="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <ShoppingCart size={14} />
              {t('shifts.totalSales', $locale)}
            </div>
            <div class="text-lg font-bold">${totalSales.toLocaleString()}</div>
            <div class="text-xs text-muted-foreground">{salesCount} {$locale === 'es' ? 'ventas' : 'sales'}</div>
          </div>
          
          <div class="bg-muted/50 rounded-lg p-3">
            <div class="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Banknote size={14} />
              {t('shifts.expectedCash', $locale)}
            </div>
            <div class="text-lg font-bold">${expectedCash.toLocaleString()}</div>
          </div>
        </div>

        <!-- Breakdown by payment method -->
        <div class="grid grid-cols-4 gap-2 text-center text-xs">
          <div class="p-2 bg-green-500/10 rounded-lg">
            <Banknote size={14} class="mx-auto mb-1 text-green-500" />
            <div class="font-medium">${totalCashSales.toLocaleString()}</div>
            <div class="text-muted-foreground">{t('sales.cash', $locale)}</div>
          </div>
          <div class="p-2 bg-blue-500/10 rounded-lg">
            <CreditCard size={14} class="mx-auto mb-1 text-blue-500" />
            <div class="font-medium">${totalCardSales.toLocaleString()}</div>
            <div class="text-muted-foreground">{t('sales.card', $locale)}</div>
          </div>
          <div class="p-2 bg-purple-500/10 rounded-lg">
            <ArrowRightLeft size={14} class="mx-auto mb-1 text-purple-500" />
            <div class="font-medium">${totalTransferSales.toLocaleString()}</div>
            <div class="text-muted-foreground">{t('sales.transfer', $locale)}</div>
          </div>
          <div class="p-2 bg-yellow-500/10 rounded-lg">
            <DollarSign size={14} class="mx-auto mb-1 text-yellow-500" />
            <div class="font-medium">${totalCreditSales.toLocaleString()}</div>
            <div class="text-muted-foreground">{t('sales.credit', $locale)}</div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-2">
          <Button 
            variant="outline" 
            class="flex-1 gap-2"
            on:click={() => { cashMovementType = 'in'; cashMovementDialogOpen = true; }}
          >
            <Plus size={14} />
            {t('shifts.cashIn', $locale)}
          </Button>
          <Button 
            variant="outline" 
            class="flex-1 gap-2"
            on:click={() => { cashMovementType = 'out'; cashMovementDialogOpen = true; }}
          >
            <Minus size={14} />
            {t('shifts.cashOut', $locale)}
          </Button>
        </div>

        <Button 
          variant="destructive" 
          class="w-full gap-2"
          on:click={openCloseDialog}
        >
          <XCircle size={16} />
          {t('shifts.closeShift', $locale)}
        </Button>
      </Card.Content>
    </Card.Root>
  {:else}
    <!-- No Active Shift -->
    <Card.Root class="border-dashed">
      <Card.Content class="py-8 text-center">
        <Clock size={48} class="mx-auto mb-4 text-muted-foreground opacity-50" />
        <h3 class="text-lg font-medium mb-2">{t('shifts.noActiveShift', $locale)}</h3>
        <p class="text-sm text-muted-foreground mb-4">{t('shifts.shiftRequired', $locale)}</p>
        <Button variant="default" class="gap-2" on:click={() => openShiftDialogOpen = true}>
          <Clock size={16} />
          {t('shifts.openShift', $locale)}
        </Button>
      </Card.Content>
    </Card.Root>
  {/if}

  <!-- Shift History (collapsible) -->
  {#if shiftHistory.length > 0}
    <details class="group">
      <summary class="flex items-center gap-2 cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        <History size={14} />
        {t('shifts.history', $locale)} ({shiftHistory.length})
      </summary>
      <div class="mt-3 space-y-2">
        {#each shiftHistory.slice(0, 5) as shift}
          <div class="bg-muted/30 rounded-lg p-3 text-xs">
            <div class="flex justify-between items-start">
              <div>
                <div class="font-medium">{shift.shiftNumber}</div>
                <div class="text-muted-foreground">
                  {shift.openedAt.toLocaleDateString()} - {shift.closedAt ? formatDuration(shift.openedAt, shift.closedAt) : 'En progreso'}
                </div>
              </div>
              <div class="text-right">
                <div class="font-bold">${(shift.totalSales || 0).toLocaleString()}</div>
                {#if shift.cashDifference !== undefined}
                  {@const status = getDifferenceStatus(shift.cashDifference)}
                  <div class="flex items-center gap-1 justify-end {status.class}">
                    <svelte:component this={status.icon} size={12} />
                    <span>${Math.abs(shift.cashDifference).toFixed(2)}</span>
                  </div>
                {/if}
                {#if shift.cogsTotal !== undefined}
                  <div class="text-muted-foreground mt-1">
                    COGS: ${(shift.cogsTotal || 0).toLocaleString()} • GM: ${((shift.grossMargin ?? (shift.totalSales || 0) - (shift.cogsTotal || 0))).toLocaleString()}
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    </details>
  {/if}
</div>

<!-- Open Shift Dialog -->
<Dialog.Root bind:open={openShiftDialogOpen} onOpenChange={(open) => { if (!open) { clearPinAuth(); } }}>
  <Dialog.Content class="max-w-sm">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        <Clock size={20} class="text-primary" />
        {t('shifts.openShift', $locale)}
      </Dialog.Title>
      <Dialog.Description>
        {requirePinAuth 
          ? ($locale === 'es' ? 'Selecciona tu usuario e ingresa tu PIN para comenzar.' : 'Select your user and enter your PIN to begin.')
          : ($locale === 'es' ? 'Ingresa el efectivo inicial en caja para comenzar el turno.' : 'Enter the starting cash to begin the shift.')}
      </Dialog.Description>
    </Dialog.Header>
    
    <div class="space-y-4 py-4">
      {#if requirePinAuth}
        <!-- Cashier Selection & PIN Authentication Section -->
        {#if authenticatedUser}
          <!-- User authenticated - show success state -->
          <div class="space-y-2">
            <Label class="flex items-center gap-2">
              <CheckCircle2 size={14} class="text-green-500" />
              {$locale === 'es' ? 'Cajero Verificado' : 'Cashier Verified'}
            </Label>
            <div class="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 size={20} class="text-green-500" />
                </div>
                <div>
                  <div class="font-medium">{authenticatedUser.displayName}</div>
                  <div class="text-xs text-muted-foreground">{authenticatedUser.roleName}</div>
                </div>
              </div>
              <Button variant="ghost" size="sm" on:click={clearPinAuth}>
                {$locale === 'es' ? 'Cambiar' : 'Change'}
              </Button>
            </div>
          </div>
        {:else}
          <!-- Step 1: Select Cashier -->
          <div class="space-y-2">
            <Label for="cashier-select" class="flex items-center gap-2">
              <Users size={14} />
              {$locale === 'es' ? 'Seleccionar Cajero' : 'Select Cashier'} *
            </Label>
            <div class="grid gap-2">
              {#each availableUsers as user}
                <button
                  type="button"
                  class="flex items-center gap-3 p-3 rounded-lg border transition-all text-left
                         {selectedUserId === user.id 
                           ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                           : 'border-border hover:border-primary/50 hover:bg-muted/50'}"
                  on:click={() => selectUser(user.id || null)}
                >
                  <div class="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                    {user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium truncate">{user.displayName}</div>
                    <div class="text-xs text-muted-foreground">{user.roleName || user.username}</div>
                  </div>
                  {#if selectedUserId === user.id}
                    <CheckCircle2 size={18} class="text-primary shrink-0" />
                  {/if}
                </button>
              {/each}
            </div>
          </div>
          
          <!-- Step 2: Enter PIN (only if user selected) -->
          {#if selectedUser}
            <div class="space-y-2 pt-2">
              <Label for="cashier-pin" class="flex items-center gap-2">
                <Key size={14} />
                {t('users.enterPin', $locale)} *
              </Label>
              <div class="flex gap-2">
                <Input 
                  id="cashier-pin"
                  type="password"
                  inputmode="numeric"
                  bind:value={pinValue}
                  placeholder="••••"
                  class="tracking-widest font-mono text-lg text-center flex-1"
                  maxlength="6"
                  on:keydown={(e) => e.key === 'Enter' && verifyPin()}
                />
                <Button 
                  variant="default" 
                  on:click={verifyPin}
                  disabled={isVerifyingPin || pinValue.length < 4}
                >
                  {#if isVerifyingPin}
                    <div class="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                  {:else}
                    <CheckCircle2 size={16} />
                  {/if}
                </Button>
              </div>
              
              {#if pinError}
                <div class="flex items-center gap-2 text-destructive text-sm">
                  <AlertTriangle size={14} />
                  {pinError}
                </div>
              {/if}
              
              <p class="text-xs text-muted-foreground">
                {$locale === 'es' 
                  ? `Ingresa el PIN de ${selectedUser.displayName}` 
                  : `Enter the PIN for ${selectedUser.displayName}`}
              </p>
            </div>
          {/if}
        {/if}
        
        <Separator />
      {:else}
        <!-- No PIN required - optional cashier name -->
        <div class="space-y-2">
          <Label for="cashier">{t('receipt.cashier', $locale)} ({$locale === 'es' ? 'Opcional' : 'Optional'})</Label>
          <Input 
            id="cashier"
            type="text" 
            bind:value={cashierName} 
            placeholder={$locale === 'es' ? 'Nombre del cajero' : 'Cashier name'}
          />
        </div>
      {/if}
      
      <div class="space-y-2">
        <Label for="opening-cash">{t('shifts.openingCash', $locale)} *</Label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input 
            id="opening-cash"
            type="number" 
            step="1"
            bind:value={openingCash} 
            class="pl-8 text-xl font-bold text-right"
            placeholder="0"
          />
        </div>
      </div>
    </div>
    
    <Dialog.Footer>
      <Button variant="ghost" on:click={() => { openShiftDialogOpen = false; clearPinAuth(); }}>
        {t('common.cancel', $locale)}
      </Button>
      <Button 
        variant="default" 
        on:click={openShift}
        disabled={requirePinAuth && !authenticatedUser}
      >
        {t('shifts.openShift', $locale)}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Close Shift Dialog -->
<Dialog.Root bind:open={closeShiftDialogOpen}>
  <Dialog.Content class="max-w-md">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2 text-destructive">
        <XCircle size={20} />
        {t('shifts.closeShift', $locale)}
      </Dialog.Title>
      <Dialog.Description>
        {t('shifts.closeWarning', $locale)}
      </Dialog.Description>
    </Dialog.Header>
    
    <div class="space-y-4 py-4">
      <!-- Summary -->
      <div class="bg-muted/50 rounded-lg p-4 space-y-2">
        <div class="flex justify-between text-sm">
          <span>{t('shifts.openingCash', $locale)}:</span>
          <span>${(currentShift?.openingCash || 0).toLocaleString()}</span>
        </div>
        <div class="flex justify-between text-sm text-green-500">
          <span>+ {t('shifts.cashSales', $locale)}:</span>
          <span>${totalCashSales.toLocaleString()}</span>
        </div>
        {#if currentShift?.cashIn}
          <div class="flex justify-between text-sm text-blue-500">
            <span>+ {t('shifts.cashIn', $locale)}:</span>
            <span>${currentShift.cashIn.toLocaleString()}</span>
          </div>
        {/if}
        {#if currentShift?.cashOut}
          <div class="flex justify-between text-sm text-destructive">
            <span>- {t('shifts.cashOut', $locale)}:</span>
            <span>${currentShift.cashOut.toLocaleString()}</span>
          </div>
        {/if}
        <Separator />
        <div class="flex justify-between font-bold">
          <span>{t('shifts.expectedCash', $locale)}:</span>
          <span>${expectedCash.toLocaleString()}</span>
        </div>
        <div class="flex justify-between text-sm pt-2">
          <span>COGS (FIFO):</span>
          <span>${(estimatedCOGS || 0).toLocaleString()}</span>
        </div>
        <div class="flex justify-between text-sm font-medium">
          <span>Margen bruto:</span>
          <span>${grossMargin.toLocaleString()}</span>
        </div>
      </div>

      <!-- Cash Counting -->
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label class="flex items-center gap-2">
            <Calculator size={14} />
            {t('shifts.countCash', $locale)}
          </Label>
          <Button 
            variant="ghost" 
            size="sm"
            on:click={() => showDenominations = !showDenominations}
          >
            {showDenominations ? ($locale === 'es' ? 'Ocultar' : 'Hide') : ($locale === 'es' ? 'Por denominación' : 'By denomination')}
          </Button>
        </div>
        
        {#if showDenominations}
          <div class="bg-muted/30 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
            {#each denominations as denom, i}
              <div class="flex items-center gap-2 text-sm">
                <span class="w-20 font-mono">RD$ {denom.denomination.toLocaleString()}</span>
                <span class="text-muted-foreground">×</span>
                <Input 
                  type="number" 
                  min="0"
                  bind:value={denom.quantity}
                  on:input={() => updateDenomination(i, denom.quantity)}
                  class="w-16 h-8 text-center"
                />
                <span class="text-muted-foreground">=</span>
                <span class="w-24 text-right font-mono">${denom.total.toLocaleString()}</span>
              </div>
            {/each}
          </div>
        {:else}
          <div class="relative">
            <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
            <Input 
              type="number"
              step="1"
              bind:value={directCashEntry}
              class="pl-8 text-xl font-bold text-right"
              placeholder="0"
            />
          </div>
        {/if}
        
        <div class="flex justify-between font-bold text-lg pt-2 border-t">
          <span>{t('shifts.totalCounted', $locale)}:</span>
          <span>${totalCounted.toLocaleString()}</span>
        </div>
      </div>

      <!-- Difference -->
      {#if totalCounted > 0}
        {@const diff = totalCounted - expectedCash}
        {@const status = getDifferenceStatus(diff)}
        <div class="flex items-center justify-between p-3 rounded-lg {diff === 0 ? 'bg-green-500/10' : diff > 0 ? 'bg-blue-500/10' : 'bg-destructive/10'}">
          <div class="flex items-center gap-2 {status.class}">
            <svelte:component this={status.icon} size={18} />
            <span class="font-medium">{t('shifts.difference', $locale)}: {status.label}</span>
          </div>
          <span class="font-bold {status.class}">${Math.abs(diff).toFixed(2)}</span>
        </div>
      {/if}

      <!-- Notes -->
      <div class="space-y-2">
        <Label for="closing-notes">{t('shifts.notes', $locale)} ({$locale === 'es' ? 'Opcional' : 'Optional'})</Label>
        <Input 
          id="closing-notes"
          type="text" 
          bind:value={closingNotes} 
          placeholder={$locale === 'es' ? 'Notas del cierre...' : 'Closing notes...'}
        />
      </div>
    </div>
    
    <Dialog.Footer>
      <Button variant="ghost" on:click={() => closeShiftDialogOpen = false}>
        {t('common.cancel', $locale)}
      </Button>
      <Button variant="destructive" on:click={closeShift} disabled={totalCounted === 0}>
        {t('shifts.closeShift', $locale)}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Cash Movement Dialog -->
<Dialog.Root bind:open={cashMovementDialogOpen}>
  <Dialog.Content class="max-w-sm">
    <Dialog.Header>
      <Dialog.Title class="flex items-center gap-2">
        {#if cashMovementType === 'in'}
          <Plus size={20} class="text-green-500" />
          {t('shifts.cashIn', $locale)}
        {:else}
          <Minus size={20} class="text-destructive" />
          {t('shifts.cashOut', $locale)}
        {/if}
      </Dialog.Title>
    </Dialog.Header>
    
    <div class="space-y-4 py-4">
      <div class="space-y-2">
        <Label>{$locale === 'es' ? 'Monto' : 'Amount'}</Label>
        <div class="relative">
          <span class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <Input 
            type="number" 
            step="1"
            bind:value={cashMovementAmount} 
            class="pl-8 text-xl font-bold text-right"
          />
        </div>
      </div>
      
      <div class="space-y-2">
        <Label>{t('shifts.notes', $locale)}</Label>
        <Input 
          type="text" 
          bind:value={cashMovementNotes} 
          placeholder={$locale === 'es' ? 'Motivo del movimiento...' : 'Reason for movement...'}
        />
      </div>
    </div>
    
    <Dialog.Footer>
      <Button variant="ghost" on:click={() => cashMovementDialogOpen = false}>
        {t('common.cancel', $locale)}
      </Button>
      <Button 
        variant={cashMovementType === 'in' ? 'default' : 'destructive'} 
        on:click={addCashMovement}
        disabled={cashMovementAmount <= 0}
      >
        {t('common.confirm', $locale)}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

