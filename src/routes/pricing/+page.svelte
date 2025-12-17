<script lang="ts">
    import { onMount } from "svelte";
    import { browser } from '$app/environment';
    import { db } from "$lib/db";
    import {
        Tag,
        TrendingUp,
        TrendingDown,
        X,
        Sparkles,
        FileSpreadsheet,
        Download,
        DollarSign,
        Search,
        ArrowUpDown,
        ArrowUp,
        ArrowDown,
        Columns3,
    } from "lucide-svelte";
    import type { Product, Supplier } from "$lib/types";
    import { calculateMarginExTax, getProductCostExTax, getProductPriceExTax, ITBIS_RATE } from '$lib/tax';
    import { getCsrfHeader } from '$lib/csrf';
    import * as XLSX from 'xlsx';
    import * as Select from "$lib/components/ui/select";
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
    import * as Table from '$lib/components/ui/table';
    import * as Tooltip from '$lib/components/ui/tooltip';
    import * as AlertDialog from '$lib/components/ui/alert-dialog';
    import { Input } from "$lib/components/ui/input";
    import { Checkbox } from '$lib/components/ui/checkbox';
    import { Button } from "$lib/components/ui/button";
    import { Badge } from "$lib/components/ui/badge";
    import * as Card from "$lib/components/ui/card";

    type ProductWithSupplier = Product & { supplierName?: string };

    let products: ProductWithSupplier[] = [];
    let suppliers: Supplier[] = [];
    let selectedCategory = "All";
    let activeTab: "catalog" | "suggestions" = "catalog";

    // Analysis State
    let isAnalyzing = false;

    // History Modal
    let selectedProduct: ProductWithSupplier | null = null;
    let productHistory: { date: string; price: number; invoiceId?: number }[] = [];
    let showHistory = false;
    
    // Apply AI Suggestions confirmation state
    let applyDialogOpen = false;
    let productsToApply: ProductWithSupplier[] = [];

    // Table state
    let searchQuery = '';
    let sortColumn: string | null = null;
    let sortDirection: 'asc' | 'desc' | null = null;
    let selectedIds: Set<number | string> = new Set();
    let pageIndex = 0;
    let pageSize = 20;
    
    // Column visibility
    let columnVisibility: Record<string, boolean> = {
        name: true,
        salesVolume: true,
        cost: true,
        price: true,
        margin: true,
        aiSuggestion: true,
        reasoning: true,
        actions: true
    };

    onMount(async () => {
        await loadData();
    });

    async function loadData() {
        if (!browser) return;
        suppliers = await db.suppliers.toArray();
        const rawProducts = await db.products.toArray();

        products = rawProducts
            .map((p) => ({
                ...p,
                supplierName: suppliers.find((s) => s.id === p.supplierId)?.name || "Unknown",
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    // Filtering
    $: categoryFiltered = products.filter((p) => {
        const matchesCategory = selectedCategory === "All" || p.category === selectedCategory;
        if (activeTab === "suggestions") {
            const currentMargin = calculateMargin(p);
            const target = p.targetMargin || 0.3;
            const hasAiSuggestion = !!p.aiSuggestedPrice;
            return matchesCategory && (currentMargin < target || hasAiSuggestion);
        }
        return matchesCategory;
    });

    $: searchFiltered = searchQuery
        ? categoryFiltered.filter(p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.supplierName?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : categoryFiltered;

    // Sorting
    $: sortedProducts = sortColumn && sortDirection
        ? [...searchFiltered].sort((a, b) => {
            let aVal: any, bVal: any;
            switch (sortColumn) {
                case 'name': aVal = a.name; bVal = b.name; break;
                case 'salesVolume': aVal = a.salesVolume ?? 0; bVal = b.salesVolume ?? 0; break;
                case 'cost': aVal = a.lastPrice; bVal = b.lastPrice; break;
                case 'price': aVal = a.sellingPrice ?? 0; bVal = b.sellingPrice ?? 0; break;
                case 'margin': aVal = calculateMargin(a); bVal = calculateMargin(b); break;
                case 'aiSuggestion': aVal = a.aiSuggestedPrice ?? 0; bVal = b.aiSuggestedPrice ?? 0; break;
                default: return 0;
            }
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
            }
            return sortDirection === 'asc'
                ? String(aVal || '').localeCompare(String(bVal || ''))
                : String(bVal || '').localeCompare(String(aVal || ''));
          })
        : searchFiltered;

    // Pagination
    $: totalRows = sortedProducts.length;
    $: pageCount = Math.ceil(totalRows / pageSize);
    $: paginatedProducts = sortedProducts.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

    // Selection
    $: selectedProducts = products.filter(p => selectedIds.has(p.id ?? p.name));
    $: isAllSelected = paginatedProducts.length > 0 && paginatedProducts.every(p => selectedIds.has(p.id ?? p.name));
    $: isSomeSelected = paginatedProducts.some(p => selectedIds.has(p.id ?? p.name)) && !isAllSelected;

    function toggleSort(column: string) {
        if (sortColumn === column) {
            if (sortDirection === 'asc') sortDirection = 'desc';
            else if (sortDirection === 'desc') { sortDirection = null; sortColumn = null; }
        } else {
            sortColumn = column;
            sortDirection = 'asc';
        }
    }

    function toggleSelectAll() {
        if (isAllSelected) {
            paginatedProducts.forEach(p => selectedIds.delete(p.id ?? p.name));
        } else {
            paginatedProducts.forEach(p => selectedIds.add(p.id ?? p.name));
        }
        selectedIds = new Set(selectedIds);
    }

    function toggleSelect(product: ProductWithSupplier) {
        const id = product.id ?? product.name;
        if (selectedIds.has(id)) selectedIds.delete(id);
        else selectedIds.add(id);
        selectedIds = new Set(selectedIds);
    }

    function clearSelection() {
        selectedIds = new Set();
    }

    // Calculate margin using tax-exclusive values for accurate comparison
    function calculateMargin(product: Product): number {
        return calculateMarginExTax(product);
    }
    
    // Helper to get tax-exclusive cost for display
    function getCostExTax(product: Product): number {
        return getProductCostExTax(product);
    }
    
    // Helper to get tax-exclusive price for display
    function getPriceExTax(product: Product): number {
        return getProductPriceExTax(product);
    }

    async function analyzeWithAI() {
        // API key is now configured server-side via environment variable (XAI_API_KEY)
        // No client-side key check needed

        isAnalyzing = true;
        const productsToAnalyze = selectedProducts.length > 0
            ? selectedProducts
            : products.filter((p) => !p.aiSuggestedPrice || activeTab === "suggestions");

        const globalContextItems = await db.globalContext.toArray();
        const pricingRules = globalContextItems
            .filter((i) => i.category === "pricing_rule")
            .map((i) => `- ${i.title}: ${i.content}`)
            .join("\n");

        const batchSize = 5;
        let processed = 0;
        let errors = 0;

        try {
            for (let i = 0; i < productsToAnalyze.length; i += batchSize) {
                const batch = productsToAnalyze.slice(i, i + batchSize);
                // Include tax-exclusive costs and current margins for accurate analysis
                const itemsText = batch.map((p) => {
                    const costExTax = getCostExTax(p);
                    const priceExTax = getPriceExTax(p);
                    const currentMargin = calculateMargin(p);
                    const taxRate = p.isExempt ? 0 : (p.taxRate ?? ITBIS_RATE);
                    const taxLabel = taxRate === 0 ? 'Exempt' : `${(taxRate * 100).toFixed(0)}% ITBIS`;
                    return `- ${p.name} (Category: ${p.category || "Unknown"}, Cost ex-tax: $${costExTax.toFixed(2)}, Current Price ex-tax: $${priceExTax > 0 ? priceExTax.toFixed(2) : "N/A"}, Current Margin: ${(currentMargin * 100).toFixed(1)}%, Tax: ${taxLabel}, Sales Vol: ${p.salesVolume || "Unknown"})`;
                }).join("\n");

                const prompt = `Analyze the pricing for these Dominican Republic Colmado products.
                
                GLOBAL PRICING RULES (FROM KNOWLEDGE BASE):
                ${pricingRules || "No specific custom rules found. Use general logic."}

                TAX RULES (ITBIS):
                - All costs and prices shown are TAX-EXCLUSIVE (sin ITBIS)
                - Your suggested prices should also be TAX-EXCLUSIVE
                - Standard ITBIS rate is 18%, some products have 16% or are exempt (0%)
                - Margins should be calculated on tax-exclusive values for accuracy
                - The system will automatically add ITBIS when displaying final prices to customers

                GENERAL LOGIC:
                1. "Fria" (Beer) = Low margin (15-20%), traffic driver.
                2. "Surtido" (Rice, Oil) = Competitive margin (20-25%).
                3. "Antojos" (Snacks, Rum) = High margin (30-50%).
                
                CRITICAL CONSTRAINTS:
                1. Suggested Price (ex-tax) MUST be greater than Cost (ex-tax).
                2. Round prices to nearest $5 or $10. No pennies.
                3. Return JSON array with: { name, suggestedPriceExTax, suggestedMargin, reasoning }.

                Products:
${itemsText}`;

                try {
                    const response = await fetch("/api/grok", {
                            method: "POST",
                            credentials: "same-origin",
                        headers: { 
                            "Content-Type": "application/json",
                            ...getCsrfHeader()
                        },
                            body: JSON.stringify({
                                messages: [
                                { role: "system", content: "You are an expert Pricing Analyst for a Dominican Colmado. Return ONLY a valid JSON array. Do not include markdown formatting like ```json." },
                                { role: "user", content: prompt }
                                ],
                                model: "grok-3",
                                stream: false,
                                temperature: 0.1,
                            }),
                    });

                    const result = await response.json();
                    if (!response.ok) throw new Error(`API Error (${response.status})`);
                    if (!result.choices || result.choices.length === 0) throw new Error("No choices returned from AI");

                    const content = result.choices[0].message.content;
                    const jsonStr = content.replace(/```json\n?|```/g, "").trim();
                    const suggestions = JSON.parse(jsonStr);

                    for (const s of suggestions) {
                        const product = batch.find((p) => p.name.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(p.name.toLowerCase()));
                        if (product && product.id) {
                            // AI returns tax-exclusive price
                            let suggestedPriceExTax = s.suggestedPriceExTax ?? s.suggestedPrice; // Support both formats
                            const costExTax = getCostExTax(product);
                            
                            // Validate: price must be greater than cost
                            if (suggestedPriceExTax <= costExTax) {
                                suggestedPriceExTax = costExTax * 1.15;
                                s.reasoning += " [Auto-corrected: Price was <= Cost]";
                            }
                            
                            // Convert to tax-inclusive if product is configured that way
                            const taxRate = product.isExempt ? 0 : (product.taxRate ?? ITBIS_RATE);
                            const priceIncludesTax = product.priceIncludesTax ?? true;
                            const finalPrice = priceIncludesTax 
                                ? suggestedPriceExTax * (1 + taxRate) 
                                : suggestedPriceExTax;
                            
                            // Calculate margin on tax-exclusive values
                            const margin = (suggestedPriceExTax - costExTax) / suggestedPriceExTax;
                            
                            await db.products.update(product.id, {
                                aiSuggestedPrice: Number(finalPrice.toFixed(2)),
                                aiSuggestedMargin: Number(margin.toFixed(4)),
                                aiReasoning: s.reasoning + (priceIncludesTax ? ` [Price inc. ${(taxRate * 100).toFixed(0)}% ITBIS]` : ' [Price ex-tax]'),
                            });
                        }
                    }
                    processed += batch.length;
                } catch (batchError) {
                    console.error(`Error processing batch ${i}:`, batchError);
                    errors++;
                }
            }
            alert(`Analysis Complete! Processed ${processed} products. Errors: ${errors}`);
        } catch (e) {
            console.error(e);
            alert("Critical error during AI analysis: " + e);
        } finally {
            await loadData();
            isAnalyzing = false;
            clearSelection();
        }
    }

    async function openHistory(product: ProductWithSupplier) {
        selectedProduct = product;
        showHistory = true;
        productHistory = [];

        const invoices = await db.invoices.toArray();
        const history: typeof productHistory = [];

        invoices.forEach((inv) => {
            if (inv.items) {
                const item = inv.items.find((i) => i.description?.toLowerCase() === product.name.toLowerCase());
                if (item && item.unitPrice) {
                    history.push({ date: inv.issueDate || "Unknown", price: item.unitPrice, invoiceId: inv.id });
                }
            }
        });

        productHistory = history.sort((a, b) => a.date.localeCompare(b.date));
    }

    let chatHistory: { role: "user" | "assistant"; content: string }[] = [];

    function calculateProductScore(product: Product): number {
        let score = 50;
        const margin = calculateMargin(product);
        if (margin > 0.4) score += 20;
        else if (margin > 0.25) score += 10;
        else if (margin < 0.15) score -= 10;
        const volume = product.salesVolume || 0;
        if (volume > 100) score += 30;
        else if (volume > 50) score += 15;
        else if (volume < 10) score -= 10;
        return Math.min(100, Math.max(0, score));
    }

    async function chatWithAI(message: string) {
        if (!message.trim() || !selectedProduct) return;
        chatHistory = [...chatHistory, { role: "user", content: message }];

        try {
            const response = await fetch("/api/grok", {
                    method: "POST",
                    credentials: "same-origin",
                headers: { 
                    "Content-Type": "application/json",
                    ...getCsrfHeader()
                },
                    body: JSON.stringify({
                        messages: [
                        { role: "system", content: "You are a helpful Pricing Analyst assistant. Keep answers short and conversational." },
                        { role: "user", content: `Product: ${selectedProduct.name}. Context: ${selectedProduct.aiReasoning}. User Question: ${message}` }
                        ],
                        model: "grok-3",
                        stream: false,
                    }),
            });
            const result = await response.json();
            const aiMsg = result.choices[0].message.content;
            chatHistory = [...chatHistory, { role: "assistant", content: aiMsg }];
        } catch (e) {
            chatHistory = [...chatHistory, { role: "assistant", content: "Sorry, I couldn't connect to the analyst server." }];
        }
    }

    async function analyzeSingleProduct(product: ProductWithSupplier) {
        isAnalyzing = true;
        chatHistory = [];

        try {
            const globalContextItems = await db.globalContext.toArray();
            const pricingRules = globalContextItems.filter((i) => i.category === "pricing_rule").map((i) => `- ${i.title}: ${i.content}`).join("\n");

            const prompt = `Analyze this product for a Dominican Colmado. Act as a Wall Street Analyst but for groceries.
            
            PRODUCT: ${product.name}
            Supplier: ${product.supplierName}
            Cost: $${product.lastPrice}
            Price: $${product.sellingPrice}
            Volume: ${product.salesVolume} units
            
            RULES:
            ${pricingRules}

            OUTPUT JSON:
            {
                "suggestedPrice": number,
                "suggestedMargin": number,
                "reasoning": "Short, punchy analysis.",
                "analystRating": "BUY" | "SELL" | "HOLD",
                "creativeIdea": "One specific, out-of-the-box idea (e.g. 'Bundle with Coke', 'Flash Sale Friday')."
}`;

            const response = await fetch("/api/grok", {
                    method: "POST",
                    credentials: "same-origin",
                headers: { 
                    "Content-Type": "application/json",
                    ...getCsrfHeader()
                },
                    body: JSON.stringify({
                        messages: [
                        { role: "system", content: "You are an expert Pricing Analyst. Return ONLY valid JSON." },
                        { role: "user", content: prompt }
                        ],
                        model: "grok-3",
                        stream: false,
                        temperature: 0.1,
                    }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error?.message || "API Error");

            const content = result.choices[0].message.content;
            const jsonStr = content.replace(/```json\n?|```/g, "").trim();
            const suggestion = JSON.parse(jsonStr);

            await db.products.update(product.id!, {
                aiSuggestedPrice: suggestion.suggestedPrice,
                aiSuggestedMargin: suggestion.suggestedMargin,
                aiReasoning: suggestion.reasoning,
                aiAnalystRating: suggestion.analystRating,
                aiCreativeIdea: suggestion.creativeIdea,
            });

            selectedProduct = {
                ...selectedProduct,
                aiSuggestedPrice: suggestion.suggestedPrice,
                aiSuggestedMargin: suggestion.suggestedMargin,
                aiReasoning: suggestion.reasoning,
                aiAnalystRating: suggestion.analystRating,
                aiCreativeIdea: suggestion.creativeIdea,
            } as any;

            await loadData();
        } catch (e) {
            console.error(e);
            alert("Analysis failed: " + e);
        } finally {
            isAnalyzing = false;
        }
    }

    function closeHistory() {
        showHistory = false;
        selectedProduct = null;
        chatHistory = [];
    }

    function confirmApplyAISuggestions() {
        const toApply = selectedProducts.length > 0
            ? selectedProducts.filter(p => p.aiSuggestedPrice)
            : sortedProducts.filter(p => p.aiSuggestedPrice);

        if (toApply.length === 0) { alert('No AI suggestions to apply'); return; }
        productsToApply = toApply;
        applyDialogOpen = true;
    }

    async function executeApplyAISuggestions() {
        for (const product of productsToApply) {
            if (product.id && product.aiSuggestedPrice) {
                await db.products.update(product.id, { sellingPrice: product.aiSuggestedPrice, targetMargin: product.aiSuggestedMargin });
            }
        }

        const count = productsToApply.length;
        applyDialogOpen = false;
        productsToApply = [];
        await loadData();
        clearSelection();
        alert(`Applied AI suggestions to ${count} products`);
    }

    function exportPricing() {
        const toExport = selectedProducts.length > 0 ? selectedProducts : sortedProducts;
        
        const data = toExport.map(p => {
            const costExTax = getCostExTax(p);
            const priceExTax = getPriceExTax(p);
            const margin = calculateMargin(p);
            const taxRate = p.isExempt ? 0 : (p.taxRate ?? ITBIS_RATE);
            
            return {
                Name: p.name,
                Supplier: p.supplierName || '',
                Category: p.category || '',
                'Cost (stored)': p.lastPrice,
                'Cost (ex-tax)': costExTax.toFixed(2),
                'Cost Inc Tax': p.costIncludesTax ?? true ? 'Yes' : 'No',
                'Price (stored)': p.sellingPrice || '',
                'Price (ex-tax)': priceExTax > 0 ? priceExTax.toFixed(2) : '',
                'Price Inc Tax': p.priceIncludesTax ?? true ? 'Yes' : 'No',
                'Tax Rate': `${(taxRate * 100).toFixed(0)}%`,
                'Margin (ex-tax)': margin > 0 ? (margin * 100).toFixed(1) + '%' : '',
                AISuggestedPrice: p.aiSuggestedPrice || '',
                AISuggestedMargin: p.aiSuggestedMargin ? (p.aiSuggestedMargin * 100).toFixed(1) + '%' : '',
                AIReasoning: p.aiReasoning || '',
                SalesVolume: p.salesVolume || ''
            };
        });
        
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Pricing");
        XLSX.writeFile(wb, `pricing_export_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
</script>

<div class="p-4 max-w-6xl mx-auto pb-24">
    <!-- Header -->
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
            <h1 class="text-2xl font-bold text-foreground flex items-center space-x-2">
                <Tag class="text-primary" />
                <span>Pricing Analytics</span>
            </h1>
            <p class="text-muted-foreground text-sm">AI-powered margin optimization and insights</p>
        </div>

        <div class="flex flex-wrap gap-2">
            <Button variant="outline" size="default" on:click={exportPricing} class="flex items-center space-x-2">
                <Download size={16} />
                <span>{selectedProducts.length > 0 ? `Export (${selectedProducts.length})` : 'Export'}</span>
            </Button>
            <Button variant="default" size="default" on:click={analyzeWithAI} disabled={isAnalyzing} class="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-0 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300 flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0">
                <Sparkles size={16} class={isAnalyzing ? "animate-spin" : "text-blue-100"} />
                <span class="font-medium tracking-wide">{isAnalyzing ? "Analyzing..." : selectedProducts.length > 0 ? `Analyze (${selectedProducts.length})` : "Analyze All"}</span>
            </Button>
        </div>
    </div>

    <!-- Tabs -->
    <div class="flex space-x-1 bg-card p-1 rounded-xl mb-6 border border-border w-full md:w-auto inline-flex">
        <Button variant="ghost" size="default" class="px-4 py-2 rounded-lg text-sm font-medium transition-all {activeTab === 'catalog' ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}" on:click={() => activeTab = "catalog"}>Catalog</Button>
        <Button variant="ghost" size="default" class="px-4 py-2 rounded-lg text-sm font-medium transition-all {activeTab === 'suggestions' ? 'bg-secondary text-secondary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}" on:click={() => activeTab = "suggestions"}>Suggestions</Button>
    </div>

    <!-- Search & Filters -->
    <div class="flex items-center gap-4 mb-4">
        <div class="relative flex-1 max-w-sm">
            <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground z-10" size={16} />
            <Input bind:value={searchQuery} placeholder="Search product or supplier..." class="h-10 pl-9 bg-card" />
        </div>
        
        <Select.Root selected={{ value: selectedCategory, label: selectedCategory === 'All' ? 'All Categories' : selectedCategory }} onSelectedChange={(v) => { if (v?.value) selectedCategory = v.value; }}>
            <Select.Trigger class="w-[180px] bg-card"><Select.Value placeholder="All Categories" /></Select.Trigger>
            <Select.Content>
                <Select.Item value="All" label="All Categories">All Categories</Select.Item>
                <Select.Item value="Inventory" label="Inventory">Inventory</Select.Item>
                <Select.Item value="Utilities" label="Utilities">Utilities</Select.Item>
                <Select.Item value="Maintenance" label="Maintenance">Maintenance</Select.Item>
                <Select.Item value="Payroll" label="Payroll">Payroll</Select.Item>
                <Select.Item value="Other" label="Other">Other</Select.Item>
            </Select.Content>
        </Select.Root>

        {#if selectedIds.size > 0}
            <span class="text-sm text-muted-foreground"><span class="font-medium text-primary">{selectedIds.size}</span> selected</span>
        {/if}

        <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild let:builder>
                <Button builders={[builder]} variant="outline" size="default" class="inline-flex items-center gap-2">
                    <Columns3 size={16} /><span class="hidden sm:inline">Columns</span>
                </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" class="w-48">
                <DropdownMenu.Label>Toggle columns</DropdownMenu.Label>
                <DropdownMenu.Separator />
                <DropdownMenu.CheckboxItem checked={columnVisibility.name} onCheckedChange={(v) => columnVisibility.name = !!v}>Product</DropdownMenu.CheckboxItem>
                <DropdownMenu.CheckboxItem checked={columnVisibility.salesVolume} onCheckedChange={(v) => columnVisibility.salesVolume = !!v}>Sales Vol</DropdownMenu.CheckboxItem>
                <DropdownMenu.CheckboxItem checked={columnVisibility.cost} onCheckedChange={(v) => columnVisibility.cost = !!v}>Cost</DropdownMenu.CheckboxItem>
                <DropdownMenu.CheckboxItem checked={columnVisibility.price} onCheckedChange={(v) => columnVisibility.price = !!v}>Price</DropdownMenu.CheckboxItem>
                <DropdownMenu.CheckboxItem checked={columnVisibility.margin} onCheckedChange={(v) => columnVisibility.margin = !!v}>Margin</DropdownMenu.CheckboxItem>
                {#if activeTab === 'suggestions'}
                    <DropdownMenu.CheckboxItem checked={columnVisibility.aiSuggestion} onCheckedChange={(v) => columnVisibility.aiSuggestion = !!v}>AI Suggestion</DropdownMenu.CheckboxItem>
                    <DropdownMenu.CheckboxItem checked={columnVisibility.reasoning} onCheckedChange={(v) => columnVisibility.reasoning = !!v}>Reasoning</DropdownMenu.CheckboxItem>
                {/if}
            </DropdownMenu.Content>
        </DropdownMenu.Root>
    </div>

    <!-- Bulk Actions Bar -->
    {#if selectedIds.size > 0}
        <div class="flex items-center gap-4 px-4 py-3 mb-4 bg-primary/10 border border-primary/20 rounded-xl">
            <span class="text-sm font-medium text-primary">{selectedIds.size} item{selectedIds.size > 1 ? 's' : ''} selected</span>
            <div class="flex items-center gap-2 ml-auto">
                <Button variant="ghost" size="sm" on:click={analyzeWithAI} disabled={isAnalyzing} class="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800 border border-indigo-200 shadow-sm transition-all duration-200 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Sparkles size={14} class="text-indigo-600" />Analyze ({selectedIds.size})
                </Button>
                {#if selectedProducts.some(p => p.aiSuggestedPrice)}
                    <Button variant="ghost" size="sm" on:click={confirmApplyAISuggestions} class="text-green-500 bg-green-500/10 hover:bg-green-500/20 flex items-center gap-1">
                        <DollarSign size={14} />Apply Suggestions
                    </Button>
                {/if}
                <Button variant="ghost" size="sm" on:click={exportPricing} class="text-muted-foreground bg-muted hover:bg-muted/80">Export ({selectedIds.size})</Button>
                <Button variant="ghost" size="sm" on:click={clearSelection} class="text-muted-foreground hover:text-foreground">Clear selection</Button>
            </div>
        </div>
    {/if}

    <!-- Table -->
    <Card.Root class="overflow-hidden min-h-[400px]">
        <Card.Content class="p-0">
            <Table.Root>
            <Table.Header class="bg-muted/50">
                <Table.Row class="hover:bg-muted/50">
                    <Table.Head class="w-12">
                        <Checkbox checked={isAllSelected ? true : isSomeSelected ? 'indeterminate' : false} onCheckedChange={toggleSelectAll} aria-label="Select all" />
                    </Table.Head>
                    {#if columnVisibility.name}
                        <Table.Head>
                            <Button variant="ghost" size="sm" class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground h-auto p-0" on:click={() => toggleSort('name')}>
                                Product {#if sortColumn === 'name'}{#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}{:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
                            </Button>
                        </Table.Head>
                    {/if}
                    {#if columnVisibility.salesVolume}
                        <Table.Head class="text-right">
                            <Button variant="ghost" size="sm" class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground ml-auto h-auto p-0" on:click={() => toggleSort('salesVolume')}>
                                Sales Vol {#if sortColumn === 'salesVolume'}{#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}{:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
                            </Button>
                        </Table.Head>
                    {/if}
                    {#if columnVisibility.cost}
                        <Table.Head class="text-right">
                            <Button variant="ghost" size="sm" class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground ml-auto h-auto p-0" on:click={() => toggleSort('cost')}>
                                Cost {#if sortColumn === 'cost'}{#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}{:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
                            </Button>
                        </Table.Head>
                    {/if}
                    {#if columnVisibility.price}
                        <Table.Head class="text-right">
                            <Button variant="ghost" size="sm" class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground ml-auto h-auto p-0" on:click={() => toggleSort('price')}>
                                Price {#if sortColumn === 'price'}{#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}{:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
                            </Button>
                        </Table.Head>
                    {/if}
                    {#if columnVisibility.margin}
                        <Table.Head class="text-right">
                            <Button variant="ghost" size="sm" class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground ml-auto h-auto p-0" on:click={() => toggleSort('margin')}>
                                Margin {#if sortColumn === 'margin'}{#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}{:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
                            </Button>
                        </Table.Head>
                    {/if}
                    {#if activeTab === 'suggestions' && columnVisibility.aiSuggestion}
                        <Table.Head class="text-right">
                            <Button variant="ghost" size="sm" class="flex items-center gap-1 text-xs uppercase tracking-wider font-semibold text-primary ml-auto h-auto p-0" on:click={() => toggleSort('aiSuggestion')}>
                                AI Suggestion {#if sortColumn === 'aiSuggestion'}{#if sortDirection === 'asc'}<ArrowUp size={14} />{:else}<ArrowDown size={14} />{/if}{:else}<ArrowUpDown size={14} class="opacity-50" />{/if}
                            </Button>
                        </Table.Head>
                    {/if}
                    {#if activeTab === 'suggestions' && columnVisibility.reasoning}
                        <Table.Head class="text-xs uppercase">Reasoning</Table.Head>
                    {/if}
                    {#if columnVisibility.actions}<Table.Head class="text-xs uppercase text-right">Actions</Table.Head>{/if}
                </Table.Row>
            </Table.Header>
            <Table.Body>
                {#each paginatedProducts as product}
                    {@const margin = calculateMargin(product)}
                    {@const target = product.targetMargin || 0.3}
                    {@const isLowMargin = margin < target}
                    {@const isSelected = selectedIds.has(product.id ?? product.name)}

                    <Table.Row class="group {isSelected ? 'bg-primary/5' : ''}">
                        <Table.Cell class="w-12">
                            <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(product)} aria-label="Select row" />
                        </Table.Cell>
                        {#if columnVisibility.name}
                        <Table.Cell>
                                <div class="font-medium text-foreground">{product.name}</div>
                                <div class="text-xs text-muted-foreground">{product.supplierName} • {product.category || "Uncategorized"}</div>
                        </Table.Cell>
                        {/if}
                        {#if columnVisibility.salesVolume}<Table.Cell class="text-right font-mono text-muted-foreground">{product.salesVolume || "-"}</Table.Cell>{/if}
                        {#if columnVisibility.cost}<Table.Cell class="text-right font-mono text-foreground">${product.lastPrice.toFixed(2)}</Table.Cell>{/if}
                        {#if columnVisibility.price}<Table.Cell class="text-right font-mono text-foreground font-bold">{product.sellingPrice ? `$${product.sellingPrice.toFixed(2)}` : "-"}</Table.Cell>{/if}
                        {#if columnVisibility.margin}
                        <Table.Cell class="text-right">
                            {#if product.sellingPrice}
                                    <Badge variant={isLowMargin ? "destructive" : "default"} class="text-xs font-bold">{(margin * 100).toFixed(1)}%</Badge>
                            {:else}
                                <span class="text-muted-foreground">-</span>
                            {/if}
                        </Table.Cell>
                        {/if}
                        {#if activeTab === 'suggestions' && columnVisibility.aiSuggestion}
                            <Table.Cell class="text-right font-mono text-primary font-bold">
                                {#if product.aiSuggestedPrice}
                                    ${product.aiSuggestedPrice.toFixed(2)}
                                    <div class="text-[10px] text-primary/70">{((product.aiSuggestedMargin || 0) * 100).toFixed(1)}%</div>
                                {:else}-{/if}
                            </Table.Cell>
                        {/if}
                        {#if activeTab === 'suggestions' && columnVisibility.reasoning}
                            <Table.Cell class="text-xs text-muted-foreground max-w-xs truncate">{product.aiReasoning || "-"}</Table.Cell>
                        {/if}
                        {#if columnVisibility.actions}
                        <Table.Cell class="text-right">
                            <Tooltip.Root>
                                <Tooltip.Trigger asChild let:builder>
                                    <Button builders={[builder]} variant="ghost" size="icon" class="text-muted-foreground hover:text-foreground" on:click={() => openHistory(product)}>
                                        <TrendingUp size={16} />
                                    </Button>
                                </Tooltip.Trigger>
                                <Tooltip.Content>View History & Analysis</Tooltip.Content>
                            </Tooltip.Root>
                            </Table.Cell>
                        {/if}
                    </Table.Row>
                {:else}
                    <Table.Row>
                        <Table.Cell colspan={10} class="h-48">
                            <div class="flex flex-col items-center justify-center text-muted-foreground">
                                <FileSpreadsheet size={48} class="mb-4 opacity-20" />
                                <p class="text-lg font-medium">No products found.</p>
                                <p class="text-sm">Try importing a catalog or changing your filters.</p>
                            </div>
                        </Table.Cell>
                    </Table.Row>
                {/each}
            </Table.Body>
        </Table.Root>
        </Card.Content>
    </Card.Root>

    <!-- Pagination -->
    {#if totalRows > 0}
        <div class="flex items-center justify-between px-2 py-4">
            <div class="text-sm text-muted-foreground">{totalRows} row(s) total.</div>
            <div class="flex items-center space-x-6">
                <div class="flex items-center space-x-2">
                    <span class="text-sm text-muted-foreground">Rows per page</span>
                    <Select.Root selected={{ value: String(pageSize), label: String(pageSize) }} onSelectedChange={(v) => { if (v?.value) { pageSize = Number(v.value); pageIndex = 0; } }}>
                        <Select.Trigger class="h-8 w-[70px]"><Select.Value /></Select.Trigger>
                        <Select.Content side="top">{#each [10, 20, 30, 50, 100] as size}<Select.Item value={String(size)} label={String(size)}>{size}</Select.Item>{/each}</Select.Content>
                    </Select.Root>
            </div>
                <div class="text-sm font-medium">Page {pageIndex + 1} of {pageCount || 1}</div>
                <div class="flex items-center space-x-2">
                    <Button variant="outline" size="icon" disabled={pageIndex === 0} on:click={() => pageIndex = 0} class="h-8 w-8">«</Button>
                    <Button variant="outline" size="icon" disabled={pageIndex === 0} on:click={() => pageIndex--} class="h-8 w-8">‹</Button>
                    <Button variant="outline" size="icon" disabled={pageIndex >= pageCount - 1} on:click={() => pageIndex++} class="h-8 w-8">›</Button>
                    <Button variant="outline" size="icon" disabled={pageIndex >= pageCount - 1} on:click={() => pageIndex = pageCount - 1} class="h-8 w-8">»</Button>
    </div>
            </div>
        </div>
    {/if}
</div>

<!-- Stock App Style Deep Dive Modal -->
{#if showHistory && selectedProduct}
    <div class="fixed inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
        <div class="bg-card border border-border rounded-2xl w-full max-w-6xl h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <!-- Stock Ticker Header -->
            <div class="p-6 border-b border-border flex justify-between items-start bg-muted/20">
                <div>
                    <div class="flex items-center space-x-3 mb-2">
                        <span class="px-2 py-1 rounded text-[10px] font-bold bg-secondary text-secondary-foreground uppercase tracking-wider">{selectedProduct.category || "Uncategorized"}</span>
                        <span class="text-xs text-muted-foreground font-mono">{selectedProduct.supplierName}</span>
                        {#if selectedProduct.productId}<span class="text-xs text-muted-foreground font-mono border border-border px-1 rounded">ID: {selectedProduct.productId}</span>{/if}
                    </div>
                    <div class="flex items-end space-x-4">
                        <h2 class="text-4xl font-bold text-foreground tracking-tight">{selectedProduct.name}</h2>
                        <div class="flex items-baseline space-x-2 pb-1">
                            <span class="text-2xl font-mono font-bold text-foreground">${selectedProduct.sellingPrice?.toFixed(2) || "-"}</span>
                            {#if selectedProduct.sellingPrice && selectedProduct.lastPrice}
                                {@const margin = calculateMargin(selectedProduct)}
                                <span class="text-sm font-bold {margin > 0.3 ? 'text-green-500' : 'text-red-500'}">{margin > 0.3 ? "+" : ""}{(margin * 100).toFixed(1)}%</span>
                            {/if}
                        </div>
                    </div>
                </div>
                <div class="flex items-center space-x-4">
                    {#if selectedProduct}
                        {@const score = calculateProductScore(selectedProduct)}
                        <div class="flex flex-col items-end">
                            <span class="text-[10px] uppercase text-muted-foreground font-bold">Score</span>
                            <div class="w-8 h-8 rounded-full border-2 {score >= 70 ? 'border-green-500 text-green-500' : score >= 40 ? 'border-yellow-500 text-yellow-500' : 'border-red-500 text-red-500'} flex items-center justify-center font-bold text-sm bg-secondary">{score}</div>
                        </div>
                    {/if}
                    <Button variant="ghost" size="icon" on:click={closeHistory} class="text-muted-foreground hover:text-foreground rounded-full"><X size={24} /></Button>
                </div>
            </div>

            <div class="flex-1 overflow-hidden flex flex-col md:flex-row">
                <!-- LEFT COLUMN: Data & Charts -->
                <div class="flex-1 overflow-y-auto p-6 border-r border-border space-y-8">
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div class="bg-secondary/50 p-4 rounded-xl border border-border">
                            <div class="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Cost Basis</div>
                            <div class="text-xl font-bold text-foreground font-mono">${selectedProduct.lastPrice.toFixed(2)}</div>
                            </div>
                        <div class="bg-secondary/50 p-4 rounded-xl border border-border">
                            <div class="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Current Price</div>
                            <div class="text-xl font-bold text-foreground font-mono">${selectedProduct.sellingPrice?.toFixed(2) || "-"}</div>
                            </div>
                        <div class="bg-primary/10 p-4 rounded-xl border border-primary/20">
                            <div class="text-xs text-primary mb-1 uppercase tracking-wider">AI Suggested</div>
                            <div class="text-xl font-bold text-primary font-mono">${selectedProduct.aiSuggestedPrice?.toFixed(2) || "-"}</div>
                        </div>
                        <div class="bg-secondary/50 p-4 rounded-xl border border-border">
                            <div class="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Volume (30d)</div>
                            <div class="text-xl font-bold text-primary font-mono">{selectedProduct.salesVolume || 0}</div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="bg-card rounded-xl p-6 border border-border">
                            <h3 class="text-sm font-bold text-muted-foreground uppercase mb-6 flex items-center space-x-2"><TrendingDown size={16} /><span>Product Cost</span></h3>
                            <div class="h-48 flex items-end space-x-1">
                                {#if productHistory.length > 0}
                                    {#each productHistory as point}
                                        {@const maxPrice = Math.max(...productHistory.map(h => h.price)) * 1.1}
                                        {@const height = (point.price / maxPrice) * 100}
                                        <div class="flex-1 flex flex-col items-center group relative">
                                            <div class="w-full bg-gradient-to-t from-orange-500/20 to-orange-500 hover:from-orange-500/40 hover:to-orange-500/80 transition-all rounded-t-sm min-w-[4px]" style="height: {height}%"></div>
                                        </div>
                                    {/each}
                                {:else}
                                    <div class="w-full h-full flex items-center justify-center text-muted-foreground text-sm">No cost data</div>
                                {/if}
                            </div>
                        </div>

                        <div class="bg-card rounded-xl p-6 border border-border">
                            <h3 class="text-sm font-bold text-muted-foreground uppercase mb-4 flex items-center space-x-2"><TrendingUp size={16} /><span>Historical Price</span></h3>
                            <div class="space-y-2 max-h-48 overflow-y-auto">
                                {#if productHistory.length > 0}
                                    {#each [...productHistory].reverse() as h}
                                        <div class="flex justify-between items-center p-2 bg-secondary/50 rounded-lg border border-border hover:bg-secondary transition-colors">
                                            <span class="text-sm text-muted-foreground">{h.date}</span>
                                            <span class="text-sm font-mono text-foreground font-bold">${h.price.toFixed(2)}</span>
                                        </div>
                                    {/each}
                                {:else}
                                    <div class="text-center text-muted-foreground text-sm py-8">No price history</div>
                                {/if}
                            </div>
                        </div>
                    </div>

                    <div class="bg-card rounded-xl p-6 border border-border">
                        <h3 class="text-sm font-bold text-muted-foreground uppercase mb-4 flex items-center space-x-2"><FileSpreadsheet size={16} /><span>Supply Chain</span></h3>
                        <div class="space-y-3">
                            {#each [...productHistory].reverse().slice(0, 3) as h}
                                <div class="flex justify-between items-center p-3 bg-secondary/50 rounded-lg border border-border">
                                    <div class="flex-1">
                                        <div class="text-sm text-foreground font-medium">NCF: {h.invoiceId || "N/A"}</div>
                                        <div class="text-xs text-muted-foreground">{h.date} • {selectedProduct.supplierName}</div>
                                    </div>
                                    <div class="text-right">
                                        <div class="text-sm font-mono text-foreground">${h.price.toFixed(2)}</div>
                                        <div class="text-[10px] text-muted-foreground">Unit Cost</div>
                                    </div>
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>

                <!-- RIGHT COLUMN: AI Analyst -->
                <div class="w-full md:w-[450px] bg-card flex flex-col border-l border-border">
                    <div class="p-6 border-b border-border">
                        <h3 class="text-sm font-bold text-muted-foreground uppercase mb-4 flex items-center space-x-2"><Sparkles size={16} class="text-primary" /><span>AI Analyst Rating</span></h3>

                        {#if selectedProduct.aiAnalystRating}
                            <div class="space-y-4">
                                <div class="flex items-center justify-between">
                                    <div class="text-3xl font-black tracking-tighter {selectedProduct.aiAnalystRating === 'BUY' ? 'text-green-500' : selectedProduct.aiAnalystRating === 'SELL' ? 'text-red-500' : 'text-yellow-500'}">{selectedProduct.aiAnalystRating}</div>
                                    </div>
                                <div class="grid grid-cols-2 gap-3">
                                    <div class="bg-secondary p-3 rounded-lg border border-border">
                                        <div class="text-[10px] text-muted-foreground uppercase mb-1">Current Price</div>
                                        <div class="text-lg font-bold text-foreground font-mono">${selectedProduct.sellingPrice?.toFixed(2) || "-"}</div>
                                        </div>
                                    <div class="bg-primary/10 p-3 rounded-lg border border-primary/20">
                                        <div class="text-[10px] text-primary uppercase mb-1">AI Target</div>
                                        <div class="text-lg font-bold text-primary font-mono">${selectedProduct.aiSuggestedPrice?.toFixed(2)}</div>
                                    </div>
                                </div>
                            </div>
                        {:else}
                            <div class="text-center py-4 text-muted-foreground text-sm">Run analysis to get a rating.</div>
                        {/if}

                        {#if !isAnalyzing && !selectedProduct.aiAnalystRating}
                            <Button 
                                variant="default" 
                                size="lg" 
                                on:click={() => selectedProduct && analyzeSingleProduct(selectedProduct)}
                                class="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-0 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 font-medium tracking-wide flex items-center justify-center space-x-2"
                            >
                                <Sparkles size={18} class="text-blue-100" /><span>Start Analysis</span>
                            </Button>
                        {/if}
                    </div>

                    <div class="flex-1 overflow-y-auto p-6 space-y-4">
                        {#if isAnalyzing}
                            <div class="flex flex-col items-center justify-center h-full text-primary animate-pulse">
                                <Sparkles size={32} class="mb-2 animate-spin" />
                                <p class="text-sm">Crunching numbers...</p>
                            </div>
                        {:else if selectedProduct.aiReasoning}
                            <div class="flex items-start space-x-3">
                                <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary mt-1"><Sparkles size={14} /></div>
                                <div class="bg-secondary rounded-2xl rounded-tl-none p-4 text-sm text-foreground leading-relaxed border border-border">
                                    <p class="mb-2">{selectedProduct.aiReasoning}</p>
                                    {#if selectedProduct.aiCreativeIdea}
                                        <div class="mt-3 pt-3 border-t border-border">
                                            <div class="text-xs font-bold text-primary uppercase mb-1">💡 Out of the Box Idea</div>
                                            <p class="text-muted-foreground italic">{selectedProduct.aiCreativeIdea}</p>
                                        </div>
                                    {/if}
                                </div>
                            </div>

                            {#each chatHistory as msg}
                                <div class="flex items-start space-x-3 {msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}">
                                    <div class="w-8 h-8 rounded-full {msg.role === 'user' ? 'bg-secondary' : 'bg-primary/10 text-primary'} flex items-center justify-center mt-1">
                                        {#if msg.role === "user"}<span class="text-xs">You</span>{:else}<Sparkles size={14} />{/if}
                                    </div>
                                    <div class="{msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-none' : 'bg-secondary text-foreground rounded-tl-none'} rounded-2xl p-3 text-sm max-w-[80%]">{msg.content}</div>
                                </div>
                            {/each}
                        {/if}
                    </div>

                    <div class="p-4 border-t border-border bg-muted/20">
                        <div class="relative">
                            <Input type="text" placeholder="Ask about pricing, suppliers, or strategy..." class="pr-12 h-11 bg-background rounded-xl" on:keydown={(e) => e.key === "Enter" && chatWithAI(e.currentTarget.value)} />
                            <Button variant="ghost" size="icon" class="absolute right-2 top-1/2 transform -translate-y-1/2 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors rounded-full"><Sparkles size={16} /></Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- Apply AI Suggestions Confirmation Dialog -->
<AlertDialog.Root bind:open={applyDialogOpen}>
    <AlertDialog.Content>
        <AlertDialog.Header>
            <AlertDialog.Title>Apply AI Suggestions</AlertDialog.Title>
            <AlertDialog.Description>Apply AI suggested prices to <strong>{productsToApply.length}</strong> product{productsToApply.length > 1 ? 's' : ''}? This will update the selling prices.</AlertDialog.Description>
        </AlertDialog.Header>
        <AlertDialog.Footer>
            <AlertDialog.Cancel on:click={() => { applyDialogOpen = false; productsToApply = []; }}>Cancel</AlertDialog.Cancel>
            <AlertDialog.Action class="bg-primary text-primary-foreground hover:bg-primary/90" on:click={executeApplyAISuggestions}>Apply</AlertDialog.Action>
        </AlertDialog.Footer>
    </AlertDialog.Content>
</AlertDialog.Root>
