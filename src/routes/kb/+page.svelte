<script lang="ts">
  import { onMount } from 'svelte';
  import { db } from '$lib/db';
  import { apiKey } from '$lib/stores';
  import { Send, Save, Trash2, Bot, User, FileText, Upload, Plus } from 'lucide-svelte';
  import type { Supplier, GlobalContextItem } from '$lib/types';
  import { extractTextFromFile } from '$lib/fileParser';
  import * as Select from '$lib/components/ui/select';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';

  let suppliers: Supplier[] = [];
  let globalContexts: GlobalContextItem[] = [];
  let selectedSupplier: Supplier | null = null;
  let selectedContext: GlobalContextItem | null = null;
  let viewMode: 'suppliers' | 'global' = 'suppliers';
  
  let chatInput = '';
  let chatHistory: { role: 'user' | 'assistant', content: string }[] = [];
  let customRules = '';
  
  // Global Context Form
  let newContextTitle = '';
  let newContextContent = '';
  let newContextCategory: 'tax' | 'conversion' | 'business_logic' = 'business_logic';
  let isUploading = false;

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    suppliers = await db.suppliers.toArray();
    globalContexts = await db.globalContext.toArray();
  }

  function selectSupplier(s: Supplier) {
    viewMode = 'suppliers';
    selectedSupplier = s;
    selectedContext = null;
    customRules = s.customRules || '';
    chatHistory = [
      { role: 'assistant', content: `Hello! I'm ready to help you with rules for ${s.name}.` }
    ];
  }

  function selectGlobal() {
    viewMode = 'global';
    selectedSupplier = null;
    selectedContext = null;
  }

  async function saveRules() {
    if (!selectedSupplier || !selectedSupplier.id) return;
    await db.suppliers.update(selectedSupplier.id, { customRules });
    selectedSupplier.customRules = customRules;
    alert('Rules saved!');
  }

  async function sendMessage() {
    if (!chatInput.trim() || !$apiKey) return;
    
    const userMsg = chatInput;
    chatHistory = [...chatHistory, { role: 'user', content: userMsg }];
    chatInput = '';

    // Build Context
    const globalContextItems = await db.globalContext.toArray();
    
    // Use the shared prompt generator for consistency, but we might want to tweak it for chat
    // For now, let's manually build a similar structure for the chat assistant
    const taxRules = globalContextItems.filter(i => i.category === 'tax').map(i => `- ${i.title}: ${i.content}`).join('\n');
    const conversions = globalContextItems.filter(i => i.category === 'conversion').map(i => `- ${i.title}: ${i.content}`).join('\n');
    const businessLogic = globalContextItems.filter(i => !i.category || i.category === 'business_logic').map(i => `- ${i.title}: ${i.content}`).join('\n');

    let systemPrompt = `You are a helpful assistant for managing invoice extraction rules for a Minimarket in the Dominican Republic.
    
    GLOBAL KNOWLEDGE BASE:
    [TAX RULES]
    ${taxRules}

    [CONVERSIONS]
    ${conversions}

    [BUSINESS LOGIC]
    ${businessLogic}
    `;

    if (selectedSupplier) {
      systemPrompt += `
      CURRENT SUPPLIER: ${selectedSupplier.name}
      SUPPLIER SPECIFIC RULES:
      ${customRules}
      `;
    }

    try {
      const response = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${$apiKey}`
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
      const reply = data.choices[0].message.content;
      chatHistory = [...chatHistory, { role: 'assistant', content: reply }];
    } catch (e) {
      chatHistory = [...chatHistory, { role: 'assistant', content: 'Error connecting to Grok.' }];
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
        if (!newContextTitle) newContextTitle = file.name;
      } catch (e) {
        alert('Failed to extract text from file');
      } finally {
        isUploading = false;
      }
    }
  }

  async function saveGlobalContext() {
    if (!newContextTitle || !newContextContent) return;
    
    await db.globalContext.add({
      title: newContextTitle,
      content: newContextContent,
      type: 'text', // Simplified for now
      category: newContextCategory,
      createdAt: new Date()
    });
    
    newContextTitle = '';
    newContextContent = '';
    await loadData();
  }

  async function deleteContext(id?: number) {
    if (!id) return;
    if (confirm('Delete this context item?')) {
      await db.globalContext.delete(id);
      await loadData();
    }
  }

  function getAccuracy(s: Supplier) {
    const count = s.examples?.length || 0;
    return Math.min(count * 20, 100);
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
</script>

<div class="flex h-full">
  <!-- Sidebar List -->
  <div class="w-1/3 border-r border-border bg-card flex flex-col">
    <div class="p-4 border-b border-border">
      <h2 class="text-xl font-bold text-foreground">Knowledge Base</h2>
    </div>
    
    <div class="flex-1 overflow-y-auto">
      <!-- Global Section -->
      <button 
        class="w-full p-4 text-left hover:bg-secondary transition-colors border-b border-border
               {viewMode === 'global' ? 'bg-primary/10 border-l-4 border-l-primary' : ''}"
        on:click={selectGlobal}
      >
        <div class="flex items-center space-x-2">
          <div class="bg-primary/20 p-2 rounded-lg">
            <FileText size={18} class="text-primary" />
          </div>
          <div>
            <div class="font-bold text-foreground">Global Context</div>
            <div class="text-xs text-muted-foreground">{globalContexts.length} items</div>
          </div>
        </div>
      </button>

      <!-- Suppliers Header -->
      <div class="px-4 py-2 bg-muted/50 text-xs font-bold text-muted-foreground uppercase mt-2">
        Suppliers
      </div>

      {#each suppliers as s}
        <button 
          class="w-full p-4 text-left hover:bg-secondary transition-colors border-b border-border last:border-0
                 {selectedSupplier?.id === s.id ? 'bg-primary/10 border-l-4 border-l-primary' : ''}"
          on:click={() => selectSupplier(s)}
        >
          <div class="font-bold text-foreground truncate">{s.name}</div>
          <div class="flex justify-between items-center mt-1">
            <span class="text-xs text-muted-foreground">{s.rnc}</span>
            <span class="text-xs font-mono {getAccuracy(s) > 80 ? 'text-green-500' : 'text-yellow-500'}">
              {getAccuracy(s)}% Acc
            </span>
          </div>
        </button>
      {/each}
    </div>
  </div>

  <!-- Main Content -->
  <div class="flex-1 flex flex-col bg-background">
    {#if viewMode === 'global'}
      <div class="p-4 border-b border-border bg-card">
        <div class="flex justify-between items-center">
          <h2 class="text-lg font-bold text-foreground">Global Context</h2>
          <button 
            class="text-xs text-primary hover:text-primary/80"
            on:click={() => {
              newContextTitle = "Product Conversions";
              newContextContent = "Define pack sizes here:\n- Coca Cola 20oz: Box = 24 units\n- Aceite 1gal: Box = 4 units\n- Arroz 10lb: Sack = 1 unit";
            }}
          >
            + Add Conversion Template
          </button>
        </div>
        <p class="text-xs text-muted-foreground">Information applied to ALL invoices (Regulations, Tax Rules, etc.)</p>
      </div>

      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        <!-- Add New Context -->
        <div class="bg-card border border-border rounded-xl p-4 space-y-4">
          <h3 class="text-foreground font-bold flex items-center space-x-2">
            <Plus size={18} />
            <span>Add New Context</span>
          </h3>
          
          <Input 
            bind:value={newContextTitle}
            placeholder="Title (e.g., 'Exempt Products List')"
            class="h-11 bg-secondary"
          />
          
          <Select.Root 
            selected={{ value: newContextCategory, label: { 'business_logic': 'Business Logic (General)', 'tax': 'Tax Rules (ITBIS, Exemptions)', 'conversion': 'Unit Conversions (Packs, Boxes)', 'pricing_rule': 'Pricing Rules (Margins, Rounding)' }[newContextCategory] || 'Business Logic (General)' }}
            onSelectedChange={(v) => { if (v?.value) newContextCategory = v.value as any; }}
          >
            <Select.Trigger class="w-full bg-secondary">
              <Select.Value placeholder="Select category..." />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="business_logic" label="Business Logic (General)">Business Logic (General)</Select.Item>
              <Select.Item value="tax" label="Tax Rules (ITBIS, Exemptions)">Tax Rules (ITBIS, Exemptions)</Select.Item>
              <Select.Item value="conversion" label="Unit Conversions (Packs, Boxes)">Unit Conversions (Packs, Boxes)</Select.Item>
              <Select.Item value="pricing_rule" label="Pricing Rules (Margins, Rounding)">Pricing Rules (Margins, Rounding)</Select.Item>
            </Select.Content>
          </Select.Root>
          
          <textarea 
            bind:value={newContextContent}
            placeholder="Paste text content here or upload a file..."
            class="w-full h-32 bg-secondary border border-border rounded-lg p-3 text-foreground font-mono text-sm focus:border-primary outline-none"
          ></textarea>

          <div class="flex justify-between items-center">
            <label class="flex items-center space-x-2 text-primary cursor-pointer hover:text-foreground transition-colors">
              <Upload size={18} />
              <span class="text-sm font-medium">{isUploading ? 'Extracting...' : 'Upload File (PDF/Excel/Txt)'}</span>
              <input type="file" accept=".pdf,.xlsx,.xls,.csv,.txt" class="hidden" on:change={handleContextUpload} />
            </label>

            <button 
              on:click={saveGlobalContext}
              disabled={!newContextTitle || !newContextContent}
              class="bg-green-600 text-white px-4 py-2 rounded-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Context
            </button>
          </div>
        </div>

        <!-- Existing Context List -->
        <div class="space-y-4">
          {#each globalContexts as ctx}
            <div class="bg-card border border-border rounded-xl p-4">
              <div class="flex justify-between items-start mb-2">
                <div class="flex items-center space-x-2">
                  <h4 class="text-foreground font-bold">{ctx.title}</h4>
                  <span class="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground uppercase border border-border">
                    {ctx.category || 'General'}
                  </span>
                </div>
                <button on:click={() => deleteContext(ctx.id)} class="text-muted-foreground hover:text-destructive">
                  <Trash2 size={18} />
                </button>
              </div>
              <div class="bg-secondary/50 rounded-lg p-3 text-muted-foreground text-xs font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
                {ctx.content}
              </div>
            </div>
          {/each}
        </div>
      </div>

    {:else if selectedSupplier}
      <div class="p-4 border-b border-border flex justify-between items-center bg-card">
        <div>
          <h2 class="text-xl font-bold text-foreground">{selectedSupplier.name}</h2>
          <p class="text-xs text-muted-foreground">RNC: {selectedSupplier.rnc}</p>
        </div>
        <button on:click={saveRules} class="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 text-sm font-bold">
          <Save size={16} />
          <span>Save Rules</span>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4 space-y-6">
        <!-- Custom Rules -->
        <div>
          <div class="flex justify-between items-center mb-2">
            <label class="block text-sm font-bold text-muted-foreground">Extraction Rules (Prompt Context)</label>
            <label class="flex items-center space-x-2 text-primary cursor-pointer hover:text-foreground transition-colors text-xs">
              <Upload size={14} />
              <span>Import from File/Image</span>
              <input type="file" accept=".pdf,.xlsx,.xls,.csv,.txt,.jpg,.jpeg,.png" class="hidden" on:change={handleSupplierRuleUpload} />
            </label>
          </div>
          <textarea 
            bind:value={customRules}
            class="w-full h-32 bg-secondary border border-border rounded-xl p-4 text-foreground font-mono text-sm focus:border-primary outline-none"
            placeholder="e.g., 'Always treat items starting with * as tax-exempt'"
          ></textarea>
        </div>

        <!-- Chat Interface -->
        <div class="flex-1 flex flex-col bg-muted/30 rounded-xl border border-border overflow-hidden h-96">
          <div class="p-3 bg-secondary/50 border-b border-border">
            <span class="text-sm font-bold text-muted-foreground">Ask Grok about this supplier</span>
          </div>
          
          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            {#each chatHistory as msg}
              <div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
                <div class="max-w-[80%] rounded-2xl px-4 py-2 text-sm 
                            {msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground border border-border'}">
                  {msg.content}
                </div>
              </div>
            {/each}
          </div>

          <div class="p-3 bg-secondary/50 border-t border-border flex gap-2 items-end">
            <textarea 
              bind:value={chatInput}
              on:keydown={handleChatKeydown}
              on:input={handleChatInput}
              placeholder="Ask a question... (Shift+Enter for new line)"
              rows="1"
              class="flex-1 bg-background border border-border rounded-2xl px-4 py-3 text-foreground text-sm focus:border-primary outline-none resize-none min-h-[44px] max-h-32"
            ></textarea>
            <button on:click={sendMessage} class="p-2 bg-primary rounded-full text-primary-foreground mb-1">
              <Send size={18} />
            </button>
          </div>
        </div>

        <!-- Examples Preview -->
        <div>
          <h3 class="text-sm font-bold text-muted-foreground mb-2">Training Examples ({selectedSupplier.examples?.length || 0})</h3>
          <div class="flex space-x-2 overflow-x-auto pb-2">
            {#each selectedSupplier.examples || [] as ex}
              <div class="w-40 flex-shrink-0 bg-card border border-border rounded-lg p-3">
                <div class="text-xs text-muted-foreground mb-1">{ex.issueDate}</div>
                <div class="font-bold text-foreground text-sm">DOP {ex.total}</div>
                <div class="text-[10px] text-muted-foreground truncate">{ex.ncf}</div>
              </div>
            {/each}
          </div>
        </div>
      </div>
    {:else}
      <div class="flex-1 flex items-center justify-center text-muted-foreground">
        Select a supplier or Global Context to manage
      </div>
    {/if}
  </div>
</div>
