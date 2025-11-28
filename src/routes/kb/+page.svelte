<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '$lib/db';
  import { apiKey, locale } from '$lib/stores';
  import { t } from '$lib/i18n';
  import { 
    Send, Save, Trash2, Bot, User, FileText, Upload, Plus, Search, 
    Download, Brain, TrendingUp, Filter, X, Edit2, Copy, Star, 
    StarOff, BarChart3, Package, Calendar, Sparkles, ArrowUpDown,
    ArrowUp, ArrowDown, CheckCircle2, AlertCircle, Clock
  } from 'lucide-svelte';
  import type { Supplier, GlobalContextItem } from '$lib/types';
  import { extractTextFromFile } from '$lib/fileParser';
  import { getCsrfHeader } from '$lib/csrf';
  import * as Select from '$lib/components/ui/select';
  import * as Tabs from '$lib/components/ui/tabs';
  import * as Card from '$lib/components/ui/card';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import * as XLSX from 'xlsx';

  let suppliers: Supplier[] = [];
  let globalContexts: GlobalContextItem[] = [];
  let selectedSupplier: Supplier | null = null;
  let selectedContext: GlobalContextItem | null = null;
  let activeTab: 'global' | 'suppliers' | 'templates' | 'analytics' = 'global';
  
  // Search & Filter
  let searchQuery = '';
  let selectedCategory: 'all' | 'tax' | 'conversion' | 'business_logic' | 'pricing_rule' = 'all';
  let sortBy: 'date' | 'title' | 'category' = 'date';
  let sortDirection: 'asc' | 'desc' = 'desc';
  
  // Chat
  let chatInput = '';
  let chatHistory: { role: 'user' | 'assistant', content: string }[] = [];
  let customRules = '';
  let isSendingMessage = false;
  
  // Global Context Form
  let newContextTitle = '';
  let newContextContent = '';
  let newContextCategory: 'tax' | 'conversion' | 'business_logic' | 'pricing_rule' = 'business_logic';
  let isUploading = false;
  let showAddDialog = false;
  let editingContext: GlobalContextItem | null = null;
  
  // Selection
  let selectedIds: Set<number> = new Set();

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    suppliers = await db.suppliers.toArray();
    globalContexts = await db.globalContext.toArray();
  }

  // Statistics
  $: totalContextItems = globalContexts.length;
  $: contextByCategory = {
    tax: globalContexts.filter(c => c.category === 'tax').length,
    conversion: globalContexts.filter(c => c.category === 'conversion').length,
    business_logic: globalContexts.filter(c => !c.category || c.category === 'business_logic').length,
    pricing_rule: globalContexts.filter(c => c.category === 'pricing_rule').length
  };
  $: suppliersWithRules = suppliers.filter(s => s.customRules && s.customRules.trim().length > 0).length;
  $: lastUpdated = globalContexts.length > 0 
    ? new Date(Math.max(...globalContexts.map(c => c.createdAt ? new Date(c.createdAt).getTime() : 0)))
    : null;

  // Filtering & Sorting
  $: filteredContexts = globalContexts.filter(ctx => {
    const matchesSearch = !searchQuery || 
      ctx.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ctx.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || ctx.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  $: sortedContexts = [...filteredContexts].sort((a, b) => {
    let aVal: any, bVal: any;
    switch (sortBy) {
      case 'date':
        aVal = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bVal = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        break;
      case 'title':
        aVal = a.title.toLowerCase();
        bVal = b.title.toLowerCase();
        break;
      case 'category':
        aVal = a.category || 'business_logic';
        bVal = b.category || 'business_logic';
        break;
      default:
        return 0;
    }
    
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return sortDirection === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  function getCategoryColor(category?: string): string {
    switch (category) {
      case 'tax': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'conversion': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'pricing_rule': return 'bg-green-500/10 text-green-600 border-green-500/20';
      default: return 'bg-purple-500/10 text-purple-600 border-purple-500/20';
    }
  }

  function getCategoryLabel(category?: string): string {
    switch (category) {
      case 'tax': return 'Tax Rules';
      case 'conversion': return 'Conversions';
      case 'pricing_rule': return 'Pricing Rules';
      default: return 'Business Logic';
    }
  }

  function getCategoryIcon(category?: string) {
    switch (category) {
      case 'tax': return '📋';
      case 'conversion': return '🔄';
      case 'pricing_rule': return '💰';
      default: return '🧠';
    }
  }

  function selectSupplier(s: Supplier) {
    // Switch to suppliers tab first
    activeTab = 'suppliers';
    // Then set the supplier (this ensures the view updates)
    selectedSupplier = s;
    selectedContext = null;
    customRules = s.customRules || '';
    chatHistory = [
      { role: 'assistant', content: `Hello! I'm ready to help you with rules for ${s.name}. How can I assist you today?` }
    ];
  }

  function openAddDialog() {
    editingContext = null;
    newContextTitle = '';
    newContextContent = '';
    newContextCategory = 'business_logic';
    showAddDialog = true;
  }

  function openEditDialog(ctx: GlobalContextItem) {
    editingContext = ctx;
    newContextTitle = ctx.title;
    newContextContent = ctx.content;
    newContextCategory = ctx.category || 'business_logic';
    showAddDialog = true;
  }

  function closeAddDialog() {
    showAddDialog = false;
    editingContext = null;
    newContextTitle = '';
    newContextContent = '';
  }

  async function saveGlobalContext() {
    if (!newContextTitle || !newContextContent) return;
    
    if (editingContext && editingContext.id) {
      await db.globalContext.update(editingContext.id, {
        title: newContextTitle,
        content: newContextContent,
        category: newContextCategory
      });
    } else {
      await db.globalContext.add({
        title: newContextTitle,
        content: newContextContent,
        type: 'text',
        category: newContextCategory,
        createdAt: new Date()
      });
    }
    
    closeAddDialog();
    await loadData();
  }

  async function deleteContext(id?: number) {
    if (!id) return;
    if (confirm('Delete this context item?')) {
      await db.globalContext.delete(id);
      await loadData();
      selectedIds.delete(id);
      selectedIds = new Set(selectedIds);
    }
  }

  async function duplicateContext(ctx: GlobalContextItem) {
    await db.globalContext.add({
      title: `${ctx.title} (Copy)`,
      content: ctx.content,
      type: ctx.type,
      category: ctx.category,
      createdAt: new Date()
    });
    await loadData();
  }

  async function toggleFavorite(ctx: GlobalContextItem) {
    if (ctx.id) {
      await db.globalContext.update(ctx.id, {
        favorite: !ctx.favorite
      });
      await loadData();
    }
  }

  async function saveRules() {
    if (!selectedSupplier || !selectedSupplier.id) return;
    await db.suppliers.update(selectedSupplier.id, { customRules });
    selectedSupplier.customRules = customRules;
    // Show success feedback
    const saveBtn = document.querySelector('[data-save-rules]');
    if (saveBtn) {
      const originalText = saveBtn.textContent;
      saveBtn.textContent = 'Saved!';
      setTimeout(() => {
        if (saveBtn) saveBtn.textContent = originalText;
      }, 2000);
    }
  }

  async function sendMessage() {
    if (!chatInput.trim() || isSendingMessage) return;
    
    const userMsg = chatInput;
    chatHistory = [...chatHistory, { role: 'user', content: userMsg }];
    chatInput = '';
    isSendingMessage = true;

    // Build Context
    const globalContextItems = await db.globalContext.toArray();
    
    const taxRules = globalContextItems.filter(i => i.category === 'tax').map(i => `- ${i.title}: ${i.content}`).join('\n');
    const conversions = globalContextItems.filter(i => i.category === 'conversion').map(i => `- ${i.title}: ${i.content}`).join('\n');
    const businessLogic = globalContextItems.filter(i => !i.category || i.category === 'business_logic').map(i => `- ${i.title}: ${i.content}`).join('\n');
    const pricingRules = globalContextItems.filter(i => i.category === 'pricing_rule').map(i => `- ${i.title}: ${i.content}`).join('\n');

    let systemPrompt = `You are a helpful assistant for managing invoice extraction rules for a Minimarket in the Dominican Republic.
    
    GLOBAL KNOWLEDGE BASE:
    [TAX RULES]
    ${taxRules || 'No tax rules defined.'}

    [CONVERSIONS]
    ${conversions || 'No conversions defined.'}

    [BUSINESS LOGIC]
    ${businessLogic || 'No business logic defined.'}

    [PRICING RULES]
    ${pricingRules || 'No pricing rules defined.'}
    `;

    if (selectedSupplier) {
      systemPrompt += `
      CURRENT SUPPLIER: ${selectedSupplier.name}
      SUPPLIER SPECIFIC RULES:
      ${customRules || 'No supplier-specific rules defined.'}
      `;
    }

    try {
      const response = await fetch('/api/grok', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          ...getCsrfHeader()
        },
        body: JSON.stringify({
          model: 'grok-3',
          messages: [
            { role: 'system', content: systemPrompt },
            ...chatHistory
          ]
        })
      });

      const data = await response.json();
      if (data.choices && data.choices[0]) {
        const reply = data.choices[0].message.content;
        chatHistory = [...chatHistory, { role: 'assistant', content: reply }];
      } else {
        chatHistory = [...chatHistory, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }];
      }
    } catch (e) {
      chatHistory = [...chatHistory, { role: 'assistant', content: 'Error connecting to Grok. Please check your API key in Settings.' }];
    } finally {
      isSendingMessage = false;
    }
  }

  async function handleContextUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      isUploading = true;
      const file = input.files[0];
      try {
        const text = await extractTextFromFile(file);
        newContextContent = text;
        if (!newContextTitle) newContextTitle = file.name.replace(/\.[^/.]+$/, '');
      } catch (e) {
        alert('Failed to extract text from file');
      } finally {
        isUploading = false;
      }
    }
  }

  async function handleSupplierRuleUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      isUploading = true;
      const file = input.files[0];
      try {
        const text = await extractTextFromFile(file);
        const separator = customRules ? '\n\n--- IMPORTED CONTEXT ---\n' : '';
        customRules += `${separator}${text}`;
      } catch (e) {
        alert('Failed to extract text from file');
      } finally {
        isUploading = false;
      }
    }
  }

  function handleChatKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
      const target = e.target as HTMLTextAreaElement;
      target.style.height = 'auto';
    }
  }

  function handleChatInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    target.style.height = 'auto';
    target.style.height = target.scrollHeight + 'px';
  }

  function getAccuracy(s: Supplier) {
    const count = s.examples?.length || 0;
    return Math.min(count * 20, 100);
  }

  function toggleSort(column: 'date' | 'title' | 'category') {
    if (sortBy === column) {
      if (sortDirection === 'asc') sortDirection = 'desc';
      else if (sortDirection === 'desc') { sortDirection = 'desc'; sortBy = 'date'; }
      else sortDirection = 'desc';
    } else {
      sortBy = column;
      sortDirection = 'desc';
    }
  }

  function toggleSelect(id: number) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    selectedIds = new Set(selectedIds);
  }

  function toggleSelectAll() {
    if (selectedIds.size === sortedContexts.length) {
      selectedIds = new Set();
    } else {
      selectedIds = new Set(sortedContexts.filter(c => c.id).map(c => c.id!));
    }
  }

  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    if (confirm(`Delete ${selectedIds.size} item(s)?`)) {
      for (const id of selectedIds) {
        await db.globalContext.delete(id);
      }
      selectedIds = new Set();
      await loadData();
    }
  }

  function exportKnowledgeBase() {
    const data = globalContexts.map(ctx => ({
      Title: ctx.title,
      Category: getCategoryLabel(ctx.category),
      Content: ctx.content,
      Created: ctx.createdAt ? new Date(ctx.createdAt).toLocaleDateString() : '',
      Type: ctx.type
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Knowledge Base');
    XLSX.writeFile(wb, `knowledge_base_${new Date().toISOString().split('T')[0]}.xlsx`);
  }

  function exportJSON() {
    const data = JSON.stringify(globalContexts, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `knowledge_base_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Templates
  const templates = [
    {
      name: 'Product Conversions',
      category: 'conversion' as const,
      content: 'Define pack sizes here:\n- Coca Cola 20oz: Box = 24 units\n- Aceite 1gal: Box = 4 units\n- Arroz 10lb: Sack = 1 unit'
    },
    {
      name: 'ITBIS Exempt Products',
      category: 'tax' as const,
      content: 'Products exempt from ITBIS:\n- Basic food items (rice, beans, oil)\n- Medicines\n- Educational materials'
    },
    {
      name: 'Pricing Rounding Rules',
      category: 'pricing_rule' as const,
      content: 'Pricing rounding rules:\n- Items under $50: round to nearest $5\n- Items $50-$200: round to nearest $10\n- Items over $200: round to nearest $50\n- Never use pennies (e.g., $14.99 → $15.00)'
    }
  ];

  function useTemplate(template: typeof templates[0]) {
    newContextTitle = template.name;
    newContextContent = template.content;
    newContextCategory = template.category;
    showAddDialog = true;
  }
</script>

<div class="p-6 max-w-7xl mx-auto pb-24">
  <!-- Header -->
  <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
    <div>
      <h1 class="text-3xl font-bold text-foreground flex items-center space-x-2">
        <Brain class="text-primary" size={32} />
        <span>{t('knowledgeBase.title', $locale)}</span>
      </h1>
      <p class="text-muted-foreground text-sm mt-1">{t('knowledgeBase.subtitle', $locale)}</p>
    </div>

    <div class="flex flex-wrap gap-2">
      <Button variant="outline" size="default" on:click={exportKnowledgeBase} class="flex items-center space-x-2">
        <Download size={16} />
        <span>Export Excel</span>
      </Button>
      <Button variant="outline" size="default" on:click={exportJSON} class="flex items-center space-x-2">
        <Download size={16} />
        <span>Export JSON</span>
      </Button>
      <Button 
        variant="default" 
        size="default" 
        on:click={openAddDialog}
        class="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-0 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 flex items-center space-x-2"
      >
        <Plus size={16} />
        <span>Add Context</span>
      </Button>
    </div>
  </div>

  <!-- Helper Guide -->
  <Card.Root class="mb-6 border-primary/20 bg-primary/5">
    <Card.Content class="p-6">
      <div class="flex items-start gap-4">
        <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Brain size={24} class="text-primary" />
        </div>
        <div class="flex-1">
          <h3 class="text-lg font-bold mb-2 flex items-center gap-2">
            {t('knowledgeBase.howItWorks', $locale)}
          </h3>
          <div class="space-y-3 text-sm text-muted-foreground">
            <div class="flex items-start gap-3">
              <div class="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <span class="text-xs font-bold text-primary">1</span>
              </div>
              <div>
                <p class="font-medium text-foreground mb-1">{t('knowledgeBase.step1Title', $locale)}</p>
                <p>{t('knowledgeBase.step1Description', $locale)}</p>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <div class="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <span class="text-xs font-bold text-primary">2</span>
              </div>
              <div>
                <p class="font-medium text-foreground mb-1">{t('knowledgeBase.step2Title', $locale)}</p>
                <p>{t('knowledgeBase.step2Description', $locale)}</p>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <div class="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <span class="text-xs font-bold text-primary">3</span>
              </div>
              <div>
                <p class="font-medium text-foreground mb-1">{t('knowledgeBase.step3Title', $locale)}</p>
                <p>{t('knowledgeBase.step3Description', $locale)}</p>
              </div>
            </div>
            <div class="flex items-start gap-3">
              <div class="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                <span class="text-xs font-bold text-primary">4</span>
              </div>
              <div>
                <p class="font-medium text-foreground mb-1">{t('knowledgeBase.step4Title', $locale)}</p>
                <p>{t('knowledgeBase.step4Description', $locale)}</p>
              </div>
            </div>
          </div>
          <div class="mt-4 pt-4 border-t border-border">
            <Button 
              variant="default" 
              size="sm"
              on:click={openAddDialog}
              class="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500"
            >
              <Plus size={14} class="mr-2" />
              {t('knowledgeBase.getStarted', $locale)}
            </Button>
          </div>
        </div>
      </div>
    </Card.Content>
  </Card.Root>

  <!-- Search & Filters -->
  <div class="flex flex-col md:flex-row items-center gap-4 mb-6">
    <div class="relative flex-1 max-w-md">
      <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-10" size={16} />
      <Input 
        bind:value={searchQuery} 
        placeholder="Search context items..." 
        class="h-10 pl-9 bg-card" 
      />
    </div>
    
    <div class="flex gap-2 flex-wrap">
      <Button 
        variant={selectedCategory === 'all' ? 'default' : 'outline'} 
        size="sm"
        on:click={() => selectedCategory = 'all'}
      >
        All
      </Button>
      <Button 
        variant={selectedCategory === 'tax' ? 'default' : 'outline'} 
        size="sm"
        on:click={() => selectedCategory = 'tax'}
        class="bg-red-500/10 text-red-600 border-red-500/20 data-[variant=default]:bg-red-500 data-[variant=default]:text-white"
      >
        Tax
      </Button>
      <Button 
        variant={selectedCategory === 'conversion' ? 'default' : 'outline'} 
        size="sm"
        on:click={() => selectedCategory = 'conversion'}
        class="bg-blue-500/10 text-blue-600 border-blue-500/20 data-[variant=default]:bg-blue-500 data-[variant=default]:text-white"
      >
        Conversion
      </Button>
      <Button 
        variant={selectedCategory === 'business_logic' ? 'default' : 'outline'} 
        size="sm"
        on:click={() => selectedCategory = 'business_logic'}
        class="bg-purple-500/10 text-purple-600 border-purple-500/20 data-[variant=default]:bg-purple-500 data-[variant=default]:text-white"
      >
        Business Logic
      </Button>
      <Button 
        variant={selectedCategory === 'pricing_rule' ? 'default' : 'outline'} 
        size="sm"
        on:click={() => selectedCategory = 'pricing_rule'}
        class="bg-green-500/10 text-green-600 border-green-500/20 data-[variant=default]:bg-green-500 data-[variant=default]:text-white"
      >
        Pricing Rules
      </Button>
    </div>

    <div class="flex items-center gap-2">
      <Button 
        variant="ghost" 
        size="sm" 
        on:click={() => toggleSort('date')}
        class="flex items-center gap-1"
      >
        <ArrowUpDown size={14} />
        Sort
      </Button>
    </div>
  </div>

  <!-- Bulk Actions -->
  {#if selectedIds.size > 0}
    <div class="flex items-center gap-4 px-4 py-3 mb-4 bg-primary/10 border border-primary/20 rounded-xl">
      <span class="text-sm font-medium text-primary">{selectedIds.size} item{selectedIds.size > 1 ? 's' : ''} selected</span>
      <div class="flex items-center gap-2 ml-auto">
        <Button variant="ghost" size="sm" on:click={bulkDelete} class="text-destructive hover:bg-destructive/10">
          <Trash2 size={14} class="mr-1" />Delete
        </Button>
        <Button variant="ghost" size="sm" on:click={() => selectedIds = new Set()}>
          Clear
        </Button>
      </div>
    </div>
  {/if}

  <!-- Tabs -->
  <Tabs.Root bind:value={activeTab}>
    <Tabs.List class="bg-card border border-border h-12 p-1 rounded-xl gap-1 mb-6">
      <Tabs.Trigger 
        value="global" 
        class="rounded-lg px-6 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
      >
        <FileText size={16} />
        Global Context
      </Tabs.Trigger>
      <Tabs.Trigger 
        value="suppliers" 
        class="rounded-lg px-6 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
      >
        <Package size={16} />
        Suppliers
      </Tabs.Trigger>
      <Tabs.Trigger 
        value="templates" 
        class="rounded-lg px-6 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
      >
        <Sparkles size={16} />
        Templates
      </Tabs.Trigger>
      <Tabs.Trigger 
        value="analytics" 
        class="rounded-lg px-6 gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
      >
        <BarChart3 size={16} />
        Analytics
      </Tabs.Trigger>
    </Tabs.List>

    <!-- Global Context Tab -->
    <Tabs.Content value="global" class="space-y-4">
      {#if sortedContexts.length === 0}
        <Card.Root>
          <Card.Content class="p-12 text-center">
            <FileText size={64} class="mx-auto mb-4 opacity-20" />
            <p class="text-lg font-medium text-muted-foreground">No context items found</p>
            <p class="text-sm text-muted-foreground mt-2">Create your first context item to get started</p>
            <Button variant="default" class="mt-4" on:click={openAddDialog}>
              <Plus size={16} class="mr-2" />
              Add Context Item
            </Button>
          </Card.Content>
        </Card.Root>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each sortedContexts as ctx}
            {@const isSelected = ctx.id && selectedIds.has(ctx.id)}
            <Card.Root class="group hover:shadow-lg transition-all duration-200 {isSelected ? 'ring-2 ring-primary' : ''}">
              <Card.Content class="p-4">
                <div class="flex items-start justify-between mb-2">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-2">
                      <input 
                        type="checkbox" 
                        checked={isSelected}
                        on:change={() => ctx.id && toggleSelect(ctx.id)}
                        class="w-4 h-4"
                      />
                      <h3 class="font-bold text-foreground truncate">{ctx.title}</h3>
                      {#if ctx.favorite}
                        <Star size={14} class="text-yellow-500 fill-yellow-500" />
                      {/if}
                    </div>
                    <Badge variant="outline" class="{getCategoryColor(ctx.category)} text-xs">
                      {getCategoryIcon(ctx.category)} {getCategoryLabel(ctx.category)}
                    </Badge>
                  </div>
                  <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      class="h-7 w-7"
                      on:click={() => toggleFavorite(ctx)}
                    >
                      {#if ctx.favorite}
                        <Star size={14} class="text-yellow-500 fill-yellow-500" />
                      {:else}
                        <StarOff size={14} />
                      {/if}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      class="h-7 w-7"
                      on:click={() => openEditDialog(ctx)}
                    >
                      <Edit2 size={14} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      class="h-7 w-7"
                      on:click={() => duplicateContext(ctx)}
                    >
                      <Copy size={14} />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      class="h-7 w-7 text-destructive hover:text-destructive"
                      on:click={() => deleteContext(ctx.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
                <div class="bg-secondary/50 rounded-lg p-3 text-muted-foreground text-xs font-mono max-h-32 overflow-y-auto whitespace-pre-wrap line-clamp-4">
                  {ctx.content}
                </div>
                {#if ctx.createdAt}
                  <div class="text-[10px] text-muted-foreground mt-2">
                    Created {new Date(ctx.createdAt).toLocaleDateString()}
                  </div>
                {/if}
              </Card.Content>
            </Card.Root>
          {/each}
        </div>
      {/if}
    </Tabs.Content>

    <!-- Suppliers Tab -->
    <Tabs.Content value="suppliers" class="space-y-6">
      {#if selectedSupplier}
        <!-- Supplier Detail View -->
        <Card.Root>
          <Card.Header>
            <div class="flex justify-between items-start">
              <div>
                <Card.Title class="text-2xl">{selectedSupplier.name}</Card.Title>
                <Card.Description>RNC: {selectedSupplier.rnc}</Card.Description>
                {#if selectedSupplier.category}
                  <Badge variant="outline" class="mt-2">{selectedSupplier.category}</Badge>
                {/if}
              </div>
              <Button variant="outline" on:click={() => selectedSupplier = null}>
                <X size={16} class="mr-2" />
                Back
              </Button>
            </div>
          </Card.Header>
          <Card.Content class="space-y-6">
            <!-- Custom Rules -->
            <div>
              <div class="flex justify-between items-center mb-2">
                <Label class="block text-sm font-bold text-foreground">Extraction Rules (Prompt Context)</Label>
                <label class="flex items-center space-x-2 text-primary cursor-pointer hover:text-foreground transition-colors text-xs">
                  <Upload size={14} />
                  <span>Import from File/Image</span>
                  <input type="file" accept=".pdf,.xlsx,.xls,.csv,.txt,.jpg,.jpeg,.png" class="hidden" on:change={handleSupplierRuleUpload} />
                </label>
              </div>
              <textarea 
                bind:value={customRules}
                class="w-full h-40 bg-secondary border border-border rounded-xl p-4 text-foreground font-mono text-sm focus:border-primary outline-none"
                placeholder="e.g., 'Always treat items starting with * as tax-exempt'"
              ></textarea>
              <Button 
                on:click={saveRules} 
                data-save-rules
                class="mt-2 bg-green-600 text-white hover:bg-green-700"
              >
                <Save size={16} class="mr-2" />
                Save Rules
              </Button>
            </div>

            <!-- Enhanced Chat Interface -->
            <Card.Root class="border-2">
              <Card.Header>
                <Card.Title class="flex items-center gap-2">
                  <Bot size={18} class="text-primary" />
                  AI Assistant
                </Card.Title>
                <Card.Description>Ask questions about this supplier's extraction rules</Card.Description>
              </Card.Header>
              <Card.Content class="p-0">
                <div class="flex flex-col h-96">
                  <div class="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20">
                    {#each chatHistory as msg}
                      <div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
                        <div class="flex items-start gap-2 max-w-[80%]">
                          {#if msg.role === 'assistant'}
                            <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <Bot size={16} class="text-primary" />
                            </div>
                          {/if}
                          <div class="rounded-2xl px-4 py-3 text-sm 
                                      {msg.role === 'user' 
                                        ? 'bg-primary text-primary-foreground rounded-tr-none' 
                                        : 'bg-secondary text-foreground border border-border rounded-tl-none'}">
                            {msg.content}
                          </div>
                          {#if msg.role === 'user'}
                            <div class="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                              <User size={16} />
                            </div>
                          {/if}
                        </div>
                      </div>
                    {/each}
                    {#if isSendingMessage}
                      <div class="flex justify-start">
                        <div class="flex items-start gap-2">
                          <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot size={16} class="text-primary animate-pulse" />
                          </div>
                          <div class="bg-secondary border border-border rounded-2xl rounded-tl-none px-4 py-3">
                            <div class="flex gap-1">
                              <div class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                              <div class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                              <div class="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    {/if}
                  </div>
                  
                  <div class="p-4 bg-muted/30 border-t border-border flex gap-2 items-end">
                    <textarea 
                      bind:value={chatInput}
                      on:keydown={handleChatKeydown}
                      on:input={handleChatInput}
                      placeholder="Ask a question... (Shift+Enter for new line)"
                      rows="1"
                      disabled={isSendingMessage}
                      class="flex-1 bg-background border border-border rounded-2xl px-4 py-3 text-foreground text-sm focus:border-primary outline-none resize-none min-h-[44px] max-h-32 disabled:opacity-50"
                    ></textarea>
                    <Button 
                      on:click={sendMessage} 
                      disabled={!chatInput.trim() || isSendingMessage}
                      class="p-2 bg-primary rounded-full text-primary-foreground mb-1 disabled:opacity-50"
                    >
                      <Send size={18} />
                    </Button>
                  </div>
                </div>
              </Card.Content>
            </Card.Root>

            <!-- Training Examples -->
            {#if selectedSupplier.examples && selectedSupplier.examples.length > 0}
              <div>
                <h3 class="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  Training Examples ({selectedSupplier.examples.length})
                </h3>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {#each selectedSupplier.examples.slice(0, 8) as ex}
                    <Card.Root class="hover:shadow-md transition-shadow">
                      <Card.Content class="p-3">
                        <div class="text-xs text-muted-foreground mb-1">{ex.issueDate}</div>
                        <div class="font-bold text-foreground text-sm">DOP {ex.total.toFixed(2)}</div>
                        <div class="text-[10px] text-muted-foreground truncate font-mono">{ex.ncf}</div>
                      </Card.Content>
                    </Card.Root>
                  {/each}
                </div>
              </div>
            {/if}
          </Card.Content>
        </Card.Root>
      {:else}
        <!-- Suppliers List -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {#each suppliers as s}
            <button
              type="button"
              class="text-left w-full"
              on:click={() => selectSupplier(s)}
            >
              <Card.Root 
                class="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary/50 h-full"
              >
                <Card.Content class="p-4">
                <div class="flex items-start justify-between mb-2">
                  <div class="flex-1">
                    <Card.Title class="text-lg">{s.name}</Card.Title>
                    <Card.Description class="font-mono text-xs">{s.rnc}</Card.Description>
                  </div>
                  <div class="text-right">
                    <div class="text-xs font-mono {getAccuracy(s) > 80 ? 'text-green-500' : getAccuracy(s) > 50 ? 'text-yellow-500' : 'text-red-500'}">
                      {getAccuracy(s)}%
                    </div>
                    <div class="text-[10px] text-muted-foreground">Accuracy</div>
                  </div>
                </div>
                {#if s.category}
                  <Badge variant="outline" class="mt-2">{s.category}</Badge>
                {/if}
                {#if s.customRules && s.customRules.trim().length > 0}
                  <div class="mt-2 text-xs text-muted-foreground">
                    ✓ Has custom rules
                  </div>
                {:else}
                  <div class="mt-2 text-xs text-muted-foreground">
                    No rules defined
                  </div>
                {/if}
              </Card.Content>
            </Card.Root>
            </button>
          {/each}
        </div>
      {/if}
    </Tabs.Content>

    <!-- Templates Tab -->
    <Tabs.Content value="templates" class="space-y-4">
      <div class="mb-4">
        <h3 class="text-lg font-bold mb-2">Quick Start Templates</h3>
        <p class="text-sm text-muted-foreground">Click on any template to use it as a starting point for creating a new context item</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        {#each templates as template}
          <Card.Root class="hover:shadow-lg transition-all h-full flex flex-col">
            <Card.Content class="p-6 flex flex-col flex-1">
              <div class="flex items-center gap-3 mb-3">
                <div class="text-3xl">{getCategoryIcon(template.category)}</div>
                <div>
                  <Card.Title>{template.name}</Card.Title>
                  <Badge variant="outline" class="{getCategoryColor(template.category)} text-xs mt-1">
                    {getCategoryLabel(template.category)}
                  </Badge>
                </div>
              </div>
              <Card.Description class="text-sm line-clamp-4 whitespace-pre-wrap flex-1 mb-4">
                {template.content}
              </Card.Description>
              <Button 
                variant="default" 
                class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500"
                on:click={() => useTemplate(template)}
              >
                <Plus size={14} class="mr-2" />
                Use Template
              </Button>
            </Card.Content>
          </Card.Root>
        {/each}
      </div>
      
      <!-- Additional Help Section -->
      <Card.Root class="mt-6 border-dashed">
        <Card.Content class="p-6">
          <div class="flex items-start gap-4">
            <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles size={24} class="text-primary" />
            </div>
            <div class="flex-1">
              <h4 class="font-bold mb-2">Need a Custom Template?</h4>
              <p class="text-sm text-muted-foreground mb-4">
                Templates help you quickly create common context items. After using a template, you can customize the content to fit your specific needs.
              </p>
              <Button variant="outline" on:click={openAddDialog}>
                <Plus size={14} class="mr-2" />
                Create Custom Context Item
              </Button>
            </div>
          </div>
        </Card.Content>
      </Card.Root>
    </Tabs.Content>

    <!-- Analytics Tab -->
    <Tabs.Content value="analytics" class="space-y-6">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Category Distribution -->
        <Card.Root>
          <Card.Header>
            <Card.Title>Category Distribution</Card.Title>
          </Card.Header>
          <Card.Content>
            <div class="space-y-3">
              {#each Object.entries(contextByCategory) as [category, count]}
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span class="text-lg">{getCategoryIcon(category)}</span>
                    <span class="font-medium">{getCategoryLabel(category)}</span>
                  </div>
                  <div class="flex items-center gap-3">
                    <div class="w-32 bg-secondary rounded-full h-2">
                      <div 
                        class="h-2 rounded-full {category === 'tax' ? 'bg-red-500' : category === 'conversion' ? 'bg-blue-500' : category === 'pricing_rule' ? 'bg-green-500' : 'bg-purple-500'}"
                        style="width: {totalContextItems > 0 ? (count / totalContextItems) * 100 : 0}%"
                      ></div>
                    </div>
                    <span class="font-bold w-8 text-right">{count}</span>
                  </div>
                </div>
              {/each}
            </div>
          </Card.Content>
        </Card.Root>

        <!-- Supplier Statistics -->
        <Card.Root>
          <Card.Header>
            <Card.Title>Supplier Statistics</Card.Title>
          </Card.Header>
          <Card.Content>
            <div class="space-y-4">
              <div class="flex justify-between items-center">
                <span class="text-muted-foreground">Total Suppliers</span>
                <span class="text-2xl font-bold">{suppliers.length}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-muted-foreground">With Custom Rules</span>
                <span class="text-2xl font-bold text-green-500">{suppliersWithRules}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-muted-foreground">Without Rules</span>
                <span class="text-2xl font-bold text-muted-foreground">{suppliers.length - suppliersWithRules}</span>
              </div>
            </div>
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Recent Activity -->
      <Card.Root>
        <Card.Header>
          <Card.Title>Recent Activity</Card.Title>
        </Card.Header>
        <Card.Content>
          <div class="space-y-2">
            {#each sortedContexts.slice(0, 10) as ctx}
              <div class="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg">
                <div class="flex items-center gap-3">
                  <div class="text-lg">{getCategoryIcon(ctx.category)}</div>
                  <div>
                    <div class="font-medium">{ctx.title}</div>
                    <div class="text-xs text-muted-foreground">
                      {ctx.createdAt ? new Date(ctx.createdAt).toLocaleDateString() : 'Unknown date'}
                    </div>
                  </div>
                </div>
                <Badge variant="outline" class="{getCategoryColor(ctx.category)} text-xs">
                  {getCategoryLabel(ctx.category)}
                </Badge>
              </div>
            {/each}
          </div>
        </Card.Content>
      </Card.Root>
    </Tabs.Content>
  </Tabs.Root>
</div>

<!-- Add/Edit Context Dialog -->
<Dialog.Root bind:open={showAddDialog}>
  <Dialog.Content class="max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>{editingContext ? 'Edit Context Item' : 'Add New Context Item'}</Dialog.Title>
      <Dialog.Description>
        {editingContext ? 'Update the context item details below.' : 'Create a new context item to enhance AI extraction accuracy.'}
      </Dialog.Description>
    </Dialog.Header>
    
    <div class="space-y-4 py-4">
      <div>
        <Label for="title">Title</Label>
        <Input 
          id="title"
          bind:value={newContextTitle}
          placeholder="e.g., 'Exempt Products List'"
          class="mt-1"
        />
      </div>
      
      <div>
        <Label for="category">Category</Label>
        <Select.Root 
          selected={{ value: newContextCategory, label: getCategoryLabel(newContextCategory) }}
          onSelectedChange={(v) => { if (v?.value) newContextCategory = v.value; }}
        >
          <Select.Trigger class="w-full mt-1">
            <Select.Value placeholder="Select category..." />
          </Select.Trigger>
          <Select.Content>
            <Select.Item value="business_logic" label="Business Logic (General)">Business Logic (General)</Select.Item>
            <Select.Item value="tax" label="Tax Rules (ITBIS, Exemptions)">Tax Rules (ITBIS, Exemptions)</Select.Item>
            <Select.Item value="conversion" label="Unit Conversions (Packs, Boxes)">Unit Conversions (Packs, Boxes)</Select.Item>
            <Select.Item value="pricing_rule" label="Pricing Rules (Margins, Rounding)">Pricing Rules (Margins, Rounding)</Select.Item>
          </Select.Content>
        </Select.Root>
      </div>
      
      <div>
        <Label for="content">Content</Label>
        <textarea 
          id="content"
          bind:value={newContextContent}
          placeholder="Paste text content here or upload a file..."
          class="w-full h-48 bg-secondary border border-border rounded-lg p-3 text-foreground font-mono text-sm focus:border-primary outline-none mt-1"
        ></textarea>
      </div>

      <div class="flex justify-between items-center">
        <label class="flex items-center space-x-2 text-primary cursor-pointer hover:text-foreground transition-colors">
          <Upload size={18} />
          <span class="text-sm font-medium">{isUploading ? 'Extracting...' : 'Upload File (PDF/Excel/Txt)'}</span>
          <input type="file" accept=".pdf,.xlsx,.xls,.csv,.txt" class="hidden" on:change={handleContextUpload} />
        </label>
      </div>
    </div>

    <Dialog.Footer>
      <Button variant="outline" on:click={closeAddDialog}>Cancel</Button>
      <Button 
        variant="default" 
        on:click={saveGlobalContext}
        disabled={!newContextTitle || !newContextContent}
        class="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500"
      >
        {editingContext ? 'Update' : 'Add'} Context
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
