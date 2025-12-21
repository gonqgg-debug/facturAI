<script lang="ts">
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { goto } from '$app/navigation';
    import { locale } from '$lib/stores';
    import { 
        Upload, FileSpreadsheet, Package, ShoppingCart, Users, Building2, FileText,
        ArrowRight, ArrowLeft, Check, X, AlertTriangle, Download, RefreshCw,
        CheckCircle, XCircle, HelpCircle, Sparkles, ChevronDown, History
    } from 'lucide-svelte';
    import { Button } from '$lib/components/ui/button';
    import { Input } from '$lib/components/ui/input';
    import { Label } from '$lib/components/ui/label';
    import * as Card from '$lib/components/ui/card';
    import * as Select from '$lib/components/ui/select';
    import * as Table from '$lib/components/ui/table';
    import * as AlertDialog from '$lib/components/ui/alert-dialog';
    import { Badge } from '$lib/components/ui/badge';
    import { 
        parseFile, 
        createImportPreview,
        getFieldDefinitions,
        executeImport,
        generateTemplate,
        type ImportType,
        type ImportPreview,
        type ImportProgress,
        type ImportResult
    } from '$lib/history-import';

    // Wizard steps
    type Step = 'select-type' | 'upload' | 'mapping' | 'preview' | 'importing' | 'complete';
    let currentStep: Step = 'select-type';

    // Import state
    let selectedType: ImportType | null = null;
    let uploadedFile: File | null = null;
    let preview: ImportPreview | null = null;
    let columnMappings: Record<string, string> = {};
    let importProgress: ImportProgress = { stage: '', percent: 0 };
    let importResult: ImportResult | null = null;
    let isProcessing = false;

    // Error state
    let errorMessage = '';

    // Import type options
    const importTypes: { type: ImportType; icon: typeof Package; labelEs: string; labelEn: string; descEs: string; descEn: string }[] = [
        { 
            type: 'products', 
            icon: Package, 
            labelEs: 'Productos', 
            labelEn: 'Products',
            descEs: 'Importa tu catálogo de productos con precios, stock y categorías',
            descEn: 'Import your product catalog with prices, stock, and categories'
        },
        { 
            type: 'sales', 
            icon: ShoppingCart, 
            labelEs: 'Ventas', 
            labelEn: 'Sales',
            descEs: 'Importa historial de ventas para análisis y reportes',
            descEn: 'Import sales history for analytics and reports'
        },
        { 
            type: 'customers', 
            icon: Users, 
            labelEs: 'Clientes', 
            labelEn: 'Customers',
            descEs: 'Importa tu base de clientes con información de contacto',
            descEn: 'Import your customer database with contact information'
        },
        { 
            type: 'suppliers', 
            icon: Building2, 
            labelEs: 'Proveedores', 
            labelEn: 'Suppliers',
            descEs: 'Importa tus proveedores y sus datos de contacto',
            descEn: 'Import your suppliers and contact details'
        },
        { 
            type: 'invoices', 
            icon: FileText, 
            labelEs: 'Facturas de Compra', 
            labelEn: 'Purchase Invoices',
            descEs: 'Importa historial de facturas de compras a proveedores',
            descEn: 'Import purchase invoice history from suppliers'
        }
    ];

    function getTypeLabel(type: ImportType): string {
        const item = importTypes.find(t => t.type === type);
        if (!item) return type;
        return $locale === 'es' ? item.labelEs : item.labelEn;
    }

    // Step navigation
    function goToStep(step: Step) {
        currentStep = step;
        errorMessage = '';
    }

    function selectType(type: ImportType) {
        selectedType = type;
        goToStep('upload');
    }

    function goBack() {
        switch (currentStep) {
            case 'upload':
                selectedType = null;
                uploadedFile = null;
                goToStep('select-type');
                break;
            case 'mapping':
                preview = null;
                goToStep('upload');
                break;
            case 'preview':
                goToStep('mapping');
                break;
            case 'complete':
                resetWizard();
                break;
        }
    }

    function resetWizard() {
        currentStep = 'select-type';
        selectedType = null;
        uploadedFile = null;
        preview = null;
        columnMappings = {};
        importProgress = { stage: '', percent: 0 };
        importResult = null;
        errorMessage = '';
    }

    // File handling
    async function handleFileUpload(event: Event) {
        const target = event.target as HTMLInputElement;
        if (!target.files || target.files.length === 0 || !selectedType) return;

        uploadedFile = target.files[0];
        errorMessage = '';
        isProcessing = true;

        try {
            const { headers, rows } = await parseFile(uploadedFile);
            
            if (rows.length === 0) {
                errorMessage = $locale === 'es' 
                    ? 'El archivo no contiene datos' 
                    : 'The file contains no data';
                isProcessing = false;
                return;
            }

            preview = createImportPreview(headers, rows, selectedType);
            columnMappings = { ...preview.suggestedMappings };
            console.log('[Import] File parsed, initial columnMappings:', columnMappings);
            console.log('[Import] Preview headers:', preview.headers);
            goToStep('mapping');
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : 'Failed to parse file';
        } finally {
            isProcessing = false;
        }
    }

    function handleDrop(event: DragEvent) {
        event.preventDefault();
        
        if (!event.dataTransfer?.files || event.dataTransfer.files.length === 0 || !selectedType) return;

        const file = event.dataTransfer.files[0];
        const extension = file.name.split('.').pop()?.toLowerCase();
        
        if (!['csv', 'xlsx', 'xls'].includes(extension || '')) {
            errorMessage = $locale === 'es' 
                ? 'Por favor sube un archivo CSV o Excel (.xlsx, .xls)' 
                : 'Please upload a CSV or Excel file (.xlsx, .xls)';
            return;
        }

        // Trigger file upload handler
        const dt = new DataTransfer();
        dt.items.add(file);
        const input = document.getElementById('file-input') as HTMLInputElement;
        if (input) {
            input.files = dt.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function handleDragOver(event: DragEvent) {
        event.preventDefault();
    }

    // Mapping handling
    function updateMapping(sourceColumn: string, targetField: string) {
        console.log('[Import] updateMapping called:', { sourceColumn, targetField });
        columnMappings = {
            ...columnMappings,
            [sourceColumn]: targetField
        };
        console.log('[Import] columnMappings after update:', columnMappings);
    }

    function getMappingStatus(): { valid: boolean; missing: string[] } {
        if (!selectedType) return { valid: false, missing: [] };
        
        const fields = getFieldDefinitions(selectedType);
        const requiredFields = fields.filter(f => f.required).map(f => f.field);
        const mappedFields = Object.values(columnMappings).filter(v => v && v !== 'skip');
        const missing = requiredFields.filter(f => !mappedFields.includes(f));
        
        console.log('[Import] getMappingStatus:', {
            selectedType,
            requiredFields,
            mappedFields,
            columnMappings,
            missing
        });
        
        return {
            valid: missing.length === 0,
            missing
        };
    }

    $: mappingStatus = getMappingStatus();

    // Import execution
    async function startImport() {
        if (!selectedType || !preview) return;

        goToStep('importing');
        isProcessing = true;

        try {
            importResult = await executeImport(
                selectedType,
                preview.rows,
                columnMappings,
                (progress) => { importProgress = progress; }
            );
            goToStep('complete');
        } catch (err) {
            errorMessage = err instanceof Error ? err.message : 'Import failed';
            goToStep('preview');
        } finally {
            isProcessing = false;
        }
    }

    // Template download
    function downloadTemplate() {
        if (!selectedType) return;
        generateTemplate(selectedType, $locale === 'es' ? 'es' : 'en');
    }
</script>

<svelte:head>
    <title>{$locale === 'es' ? 'Importar Historial' : 'Import History'} | Cuadra</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
    <div class="p-4 md:p-8 max-w-5xl mx-auto">
        <!-- Header -->
        <div class="mb-8">
            <div class="flex items-center gap-3 mb-2">
                <div class="p-2 bg-primary/10 rounded-xl">
                    <History size={24} class="text-primary" />
                </div>
                <h1 class="text-3xl font-bold tracking-tight">
                    {$locale === 'es' ? 'Importar Historial' : 'Import History'}
                </h1>
            </div>
            <p class="text-muted-foreground">
                {$locale === 'es' 
                    ? 'Importa los datos de tu tienda desde archivos Excel o CSV'
                    : 'Import your store data from Excel or CSV files'}
            </p>
        </div>

        <!-- Progress Steps -->
        <div class="mb-8">
            <div class="flex items-center justify-between max-w-2xl mx-auto">
                {#each ['select-type', 'upload', 'mapping', 'preview', 'complete'] as step, i}
                    {@const stepLabels = {
                        'select-type': $locale === 'es' ? 'Tipo' : 'Type',
                        'upload': $locale === 'es' ? 'Archivo' : 'File',
                        'mapping': $locale === 'es' ? 'Mapeo' : 'Mapping',
                        'preview': $locale === 'es' ? 'Vista Previa' : 'Preview',
                        'complete': $locale === 'es' ? 'Completado' : 'Complete'
                    }}
                    {@const steps = ['select-type', 'upload', 'mapping', 'preview', 'complete']}
                    {@const currentIndex = steps.indexOf(currentStep === 'importing' ? 'preview' : currentStep)}
                    {@const isActive = currentIndex >= i}
                    {@const isCurrent = currentStep === step || (currentStep === 'importing' && step === 'preview')}
                    
                    {#if i > 0}
                        <div class="flex-1 h-0.5 mx-2 {isActive ? 'bg-primary' : 'bg-muted'}"></div>
                    {/if}
                    
                    <div class="flex flex-col items-center gap-1">
                        <div 
                            class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all
                                   {isCurrent ? 'bg-primary text-primary-foreground ring-4 ring-primary/20' : 
                                    isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}"
                        >
                            {#if isActive && !isCurrent}
                                <Check size={16} />
                            {:else}
                                {i + 1}
                            {/if}
                        </div>
                        <span class="text-xs font-medium {isCurrent ? 'text-primary' : 'text-muted-foreground'} hidden sm:block">
                            {stepLabels[step]}
                        </span>
                    </div>
                {/each}
            </div>
        </div>

        <!-- Error Message -->
        {#if errorMessage}
            <Card.Root class="mb-6 border-destructive/50 bg-destructive/10">
                <Card.Content class="p-4 flex items-center gap-3">
                    <AlertTriangle class="text-destructive flex-shrink-0" size={20} />
                    <p class="text-destructive">{errorMessage}</p>
                    <button on:click={() => errorMessage = ''} class="ml-auto p-1 hover:bg-destructive/20 rounded">
                        <X size={16} class="text-destructive" />
                    </button>
                </Card.Content>
            </Card.Root>
        {/if}

        <!-- Step 1: Select Import Type -->
        {#if currentStep === 'select-type'}
            <div class="space-y-6">
                <div class="text-center mb-8">
                    <h2 class="text-xl font-semibold mb-2">
                        {$locale === 'es' ? '¿Qué deseas importar?' : 'What would you like to import?'}
                    </h2>
                    <p class="text-muted-foreground">
                        {$locale === 'es' 
                            ? 'Selecciona el tipo de datos que quieres importar a tu tienda'
                            : 'Select the type of data you want to import to your store'}
                    </p>
                </div>

                <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {#each importTypes as item}
                        <button
                            on:click={() => selectType(item.type)}
                            class="group p-6 bg-card border border-border rounded-2xl text-left hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                        >
                            <div class="flex items-start gap-4">
                                <div class="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors">
                                    <svelte:component this={item.icon} size={24} class="text-primary" />
                                </div>
                                <div class="flex-1">
                                    <h3 class="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">
                                        {$locale === 'es' ? item.labelEs : item.labelEn}
                                    </h3>
                                    <p class="text-sm text-muted-foreground">
                                        {$locale === 'es' ? item.descEs : item.descEn}
                                    </p>
                                </div>
                                <ArrowRight size={20} class="text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                            </div>
                        </button>
                    {/each}
                </div>
            </div>
        {/if}

        <!-- Step 2: Upload File -->
        {#if currentStep === 'upload'}
            <div class="space-y-6">
                <div class="flex items-center justify-between">
                    <Button variant="ghost" on:click={goBack}>
                        <ArrowLeft size={18} class="mr-2" />
                        {$locale === 'es' ? 'Atrás' : 'Back'}
                    </Button>
                    {#if selectedType}
                        <Badge variant="outline" class="text-sm">
                            {getTypeLabel(selectedType)}
                        </Badge>
                    {/if}
                </div>

                <Card.Root>
                    <Card.Header>
                        <Card.Title class="flex items-center gap-2">
                            <FileSpreadsheet size={20} />
                            {$locale === 'es' ? 'Subir Archivo' : 'Upload File'}
                        </Card.Title>
                        <Card.Description>
                            {$locale === 'es' 
                                ? 'Arrastra un archivo o haz clic para seleccionar. Formatos soportados: CSV, Excel (.xlsx, .xls)'
                                : 'Drag and drop a file or click to select. Supported formats: CSV, Excel (.xlsx, .xls)'}
                        </Card.Description>
                    </Card.Header>
                    <Card.Content>
                        <!-- Drop Zone -->
                        <div 
                            on:drop={handleDrop}
                            on:dragover={handleDragOver}
                            class="border-2 border-dashed border-border rounded-xl p-12 text-center hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
                        >
                            <input 
                                type="file" 
                                id="file-input"
                                accept=".csv,.xlsx,.xls"
                                on:change={handleFileUpload}
                                class="hidden"
                            />
                            <label for="file-input" class="cursor-pointer">
                                {#if isProcessing}
                                    <RefreshCw size={48} class="mx-auto mb-4 text-primary animate-spin" />
                                    <p class="font-medium">{$locale === 'es' ? 'Procesando archivo...' : 'Processing file...'}</p>
                                {:else if uploadedFile}
                                    <FileSpreadsheet size={48} class="mx-auto mb-4 text-primary" />
                                    <p class="font-medium">{uploadedFile.name}</p>
                                    <p class="text-sm text-muted-foreground mt-1">
                                        {$locale === 'es' ? 'Haz clic para cambiar archivo' : 'Click to change file'}
                                    </p>
                                {:else}
                                    <Upload size={48} class="mx-auto mb-4 text-muted-foreground" />
                                    <p class="font-medium mb-2">
                                        {$locale === 'es' ? 'Arrastra tu archivo aquí' : 'Drag your file here'}
                                    </p>
                                    <p class="text-sm text-muted-foreground">
                                        {$locale === 'es' ? 'o haz clic para seleccionar' : 'or click to browse'}
                                    </p>
                                {/if}
                            </label>
                        </div>

                        <!-- Template Download -->
                        <div class="mt-6 p-4 bg-muted/30 rounded-xl flex items-center justify-between">
                            <div class="flex items-center gap-3">
                                <HelpCircle size={20} class="text-muted-foreground" />
                                <div>
                                    <p class="font-medium text-sm">
                                        {$locale === 'es' ? '¿No tienes el formato correcto?' : "Don't have the right format?"}
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        {$locale === 'es' 
                                            ? 'Descarga nuestra plantilla y complétala con tus datos'
                                            : 'Download our template and fill it with your data'}
                                    </p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" on:click={downloadTemplate}>
                                <Download size={16} class="mr-2" />
                                {$locale === 'es' ? 'Plantilla' : 'Template'}
                            </Button>
                        </div>
                    </Card.Content>
                </Card.Root>
            </div>
        {/if}

        <!-- Step 3: Column Mapping -->
        {#if currentStep === 'mapping' && preview && selectedType}
            <div class="space-y-6">
                <div class="flex items-center justify-between">
                    <Button variant="ghost" on:click={goBack}>
                        <ArrowLeft size={18} class="mr-2" />
                        {$locale === 'es' ? 'Atrás' : 'Back'}
                    </Button>
                    <div class="flex items-center gap-2">
                        <Badge variant="outline">{getTypeLabel(selectedType)}</Badge>
                        <Badge variant="secondary">{preview.totalRows} {$locale === 'es' ? 'filas' : 'rows'}</Badge>
                    </div>
                </div>

                <Card.Root>
                    <Card.Header>
                        <Card.Title class="flex items-center gap-2">
                            <Sparkles size={20} class="text-primary" />
                            {$locale === 'es' ? 'Mapear Columnas' : 'Map Columns'}
                        </Card.Title>
                        <Card.Description>
                            {$locale === 'es' 
                                ? 'Conecta las columnas de tu archivo con los campos del sistema. Hemos detectado automáticamente algunas coincidencias.'
                                : 'Connect your file columns to system fields. We auto-detected some matches.'}
                        </Card.Description>
                    </Card.Header>
                    <Card.Content>
                        <div class="space-y-4">
                            {#each preview.headers as header}
                                {@const fields = getFieldDefinitions(selectedType)}
                                {@const currentMapping = columnMappings[header]}
                                {@const mappedField = fields.find(f => f.field === currentMapping)}
                                
                                <div class="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                                    <div class="flex-1">
                                        <div class="font-medium text-sm">{header}</div>
                                        <div class="text-xs text-muted-foreground truncate">
                                            {$locale === 'es' ? 'Ejemplo:' : 'Sample:'} {preview.sampleRows[0]?.[header] || '-'}
                                        </div>
                                    </div>
                                    
                                    <ArrowRight size={16} class="text-muted-foreground flex-shrink-0" />
                                    
                                    <div class="w-48">
                                        <Select.Root 
                                            selected={currentMapping 
                                                ? { value: currentMapping, label: mappedField ? ($locale === 'es' ? mappedField.labelEs : mappedField.label) : currentMapping }
                                                : { value: 'skip', label: $locale === 'es' ? '— Omitir —' : '— Skip —' }
                                            }
                                            onSelectedChange={(v) => updateMapping(header, v?.value || 'skip')}
                                        >
                                            <Select.Trigger class="w-full bg-background">
                                                <Select.Value />
                                            </Select.Trigger>
                                            <Select.Content>
                                                <Select.Item value="skip" label={$locale === 'es' ? '— Omitir —' : '— Skip —'}>
                                                    {$locale === 'es' ? '— Omitir —' : '— Skip —'}
                                                </Select.Item>
                                                {#each fields as field}
                                                    <Select.Item value={field.field} label={$locale === 'es' ? field.labelEs : field.label}>
                                                        <span class="flex items-center gap-2">
                                                            {$locale === 'es' ? field.labelEs : field.label}
                                                            {#if field.required}
                                                                <span class="text-destructive">*</span>
                                                            {/if}
                                                        </span>
                                                    </Select.Item>
                                                {/each}
                                            </Select.Content>
                                        </Select.Root>
                                    </div>
                                    
                                    {#if mappedField}
                                        <Badge variant={mappedField.required ? 'default' : 'secondary'} class="flex-shrink-0">
                                            {mappedField.required ? ($locale === 'es' ? 'Requerido' : 'Required') : 'OK'}
                                        </Badge>
                                    {:else if currentMapping && currentMapping !== 'skip'}
                                        <Badge variant="outline" class="flex-shrink-0">
                                            {$locale === 'es' ? 'Personalizado' : 'Custom'}
                                        </Badge>
                                    {:else}
                                        <div class="w-16"></div>
                                    {/if}
                                </div>
                            {/each}
                        </div>

                        <!-- Mapping Validation -->
                        <div class="mt-6 p-4 rounded-xl {mappingStatus.valid ? 'bg-green-500/10 border border-green-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'}">
                            <div class="flex items-start gap-3">
                                {#if mappingStatus.valid}
                                    <CheckCircle size={20} class="text-green-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p class="font-medium text-green-600 dark:text-green-400">
                                            {$locale === 'es' ? '¡Mapeo completo!' : 'Mapping complete!'}
                                        </p>
                                        <p class="text-sm text-muted-foreground">
                                            {$locale === 'es' 
                                                ? 'Todos los campos requeridos están mapeados. Puedes continuar.'
                                                : 'All required fields are mapped. You can proceed.'}
                                        </p>
                                    </div>
                                {:else}
                                    <AlertTriangle size={20} class="text-yellow-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p class="font-medium text-yellow-600 dark:text-yellow-400">
                                            {$locale === 'es' ? 'Campos requeridos faltantes' : 'Missing required fields'}
                                        </p>
                                        <p class="text-sm text-muted-foreground">
                                            {$locale === 'es' ? 'Por favor mapea:' : 'Please map:'} 
                                            {#if selectedType && mappingStatus.missing.length > 0}
                                                {mappingStatus.missing.map(f => {
                                                    const fields = getFieldDefinitions(selectedType);
                                                    const field = fields.find(fd => fd.field === f);
                                                    return field ? ($locale === 'es' ? field.labelEs : field.label) : f;
                                                }).join(', ')}
                                            {:else}
                                                {mappingStatus.missing.join(', ')}
                                            {/if}
                                        </p>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    </Card.Content>
                    <Card.Footer class="justify-end">
                        <Button 
                            on:click={() => goToStep('preview')}
                            disabled={!mappingStatus.valid}
                        >
                            {$locale === 'es' ? 'Continuar' : 'Continue'}
                            <ArrowRight size={16} class="ml-2" />
                        </Button>
                    </Card.Footer>
                </Card.Root>
            </div>
        {/if}

        <!-- Step 4: Preview -->
        {#if currentStep === 'preview' && preview && selectedType}
            <div class="space-y-6">
                <div class="flex items-center justify-between">
                    <Button variant="ghost" on:click={goBack}>
                        <ArrowLeft size={18} class="mr-2" />
                        {$locale === 'es' ? 'Atrás' : 'Back'}
                    </Button>
                    <div class="flex items-center gap-2">
                        <Badge variant="outline">{getTypeLabel(selectedType)}</Badge>
                        <Badge variant="secondary">{preview.totalRows} {$locale === 'es' ? 'filas' : 'rows'}</Badge>
                    </div>
                </div>

                <Card.Root>
                    <Card.Header>
                        <Card.Title>{$locale === 'es' ? 'Vista Previa' : 'Preview'}</Card.Title>
                        <Card.Description>
                            {$locale === 'es' 
                                ? 'Revisa los datos antes de importar. Se muestran las primeras 5 filas.'
                                : 'Review your data before importing. Showing first 5 rows.'}
                        </Card.Description>
                    </Card.Header>
                    <Card.Content>
                        <div class="overflow-x-auto rounded-lg border border-border">
                            <Table.Root>
                                <Table.Header>
                                    <Table.Row class="bg-muted/50">
                                        <Table.Head class="text-xs font-bold">#</Table.Head>
                                        {#each Object.entries(columnMappings).filter(([_, v]) => v && v !== 'skip') as [source, target]}
                                            {@const field = getFieldDefinitions(selectedType).find(f => f.field === target)}
                                            <Table.Head class="text-xs font-bold">
                                                {field ? ($locale === 'es' ? field.labelEs : field.label) : target}
                                            </Table.Head>
                                        {/each}
                                    </Table.Row>
                                </Table.Header>
                                <Table.Body>
                                    {#each preview.sampleRows as row, i}
                                        <Table.Row>
                                            <Table.Cell class="text-muted-foreground">{i + 1}</Table.Cell>
                                            {#each Object.entries(columnMappings).filter(([_, v]) => v && v !== 'skip') as [source]}
                                                <Table.Cell class="max-w-[200px] truncate">
                                                    {row[source] ?? '-'}
                                                </Table.Cell>
                                            {/each}
                                        </Table.Row>
                                    {/each}
                                </Table.Body>
                            </Table.Root>
                        </div>

                        {#if preview.totalRows > 5}
                            <p class="text-sm text-muted-foreground mt-4 text-center">
                                {$locale === 'es' 
                                    ? `... y ${preview.totalRows - 5} filas más`
                                    : `... and ${preview.totalRows - 5} more rows`}
                            </p>
                        {/if}
                    </Card.Content>
                    <Card.Footer class="justify-between">
                        <p class="text-sm text-muted-foreground">
                            {$locale === 'es' 
                                ? 'Los registros existentes serán actualizados si coinciden por nombre, código o RNC.'
                                : 'Existing records will be updated if they match by name, code, or RNC.'}
                        </p>
                        <Button on:click={startImport}>
                            <Upload size={16} class="mr-2" />
                            {$locale === 'es' ? 'Importar' : 'Import'} ({preview.totalRows})
                        </Button>
                    </Card.Footer>
                </Card.Root>
            </div>
        {/if}

        <!-- Step 5: Importing -->
        {#if currentStep === 'importing'}
            <Card.Root>
                <Card.Content class="py-16">
                    <div class="text-center space-y-6">
                        <div class="relative inline-flex">
                            <RefreshCw size={64} class="text-primary animate-spin" />
                        </div>
                        <div>
                            <h2 class="text-xl font-semibold mb-2">
                                {$locale === 'es' ? 'Importando...' : 'Importing...'}
                            </h2>
                            <p class="text-muted-foreground">{importProgress.stage}</p>
                        </div>
                        <div class="max-w-md mx-auto">
                            <div class="w-full h-3 bg-muted rounded-full overflow-hidden">
                                <div 
                                    class="h-full bg-primary transition-all duration-300 rounded-full"
                                    style="width: {importProgress.percent}%"
                                ></div>
                            </div>
                            {#if importProgress.currentRow && importProgress.totalRows}
                                <p class="text-sm text-muted-foreground mt-2">
                                    {importProgress.currentRow} / {importProgress.totalRows}
                                </p>
                            {/if}
                        </div>
                    </div>
                </Card.Content>
            </Card.Root>
        {/if}

        <!-- Step 6: Complete -->
        {#if currentStep === 'complete' && importResult}
            <Card.Root>
                <Card.Content class="py-12">
                    <div class="text-center space-y-6">
                        {#if importResult.success && importResult.errors.length === 0}
                            <div class="inline-flex p-4 bg-green-500/10 rounded-full">
                                <CheckCircle size={64} class="text-green-500" />
                            </div>
                            <div>
                                <h2 class="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
                                    {$locale === 'es' ? '¡Importación Exitosa!' : 'Import Successful!'}
                                </h2>
                                <p class="text-muted-foreground">
                                    {$locale === 'es' ? 'Tus datos han sido importados correctamente.' : 'Your data has been imported successfully.'}
                                </p>
                            </div>
                        {:else}
                            <div class="inline-flex p-4 bg-yellow-500/10 rounded-full">
                                <AlertTriangle size={64} class="text-yellow-500" />
                            </div>
                            <div>
                                <h2 class="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mb-2">
                                    {$locale === 'es' ? 'Importación Completada con Advertencias' : 'Import Completed with Warnings'}
                                </h2>
                                <p class="text-muted-foreground">
                                    {$locale === 'es' ? 'Algunos registros no pudieron ser importados.' : 'Some records could not be imported.'}
                                </p>
                            </div>
                        {/if}

                        <!-- Stats -->
                        <div class="flex justify-center gap-6">
                            <div class="text-center">
                                <div class="text-3xl font-bold text-green-500">{importResult.imported}</div>
                                <div class="text-sm text-muted-foreground">{$locale === 'es' ? 'Nuevos' : 'New'}</div>
                            </div>
                            <div class="text-center">
                                <div class="text-3xl font-bold text-blue-500">{importResult.updated}</div>
                                <div class="text-sm text-muted-foreground">{$locale === 'es' ? 'Actualizados' : 'Updated'}</div>
                            </div>
                            {#if importResult.skipped > 0}
                                <div class="text-center">
                                    <div class="text-3xl font-bold text-yellow-500">{importResult.skipped}</div>
                                    <div class="text-sm text-muted-foreground">{$locale === 'es' ? 'Omitidos' : 'Skipped'}</div>
                                </div>
                            {/if}
                        </div>

                        <!-- Warnings -->
                        {#if importResult.warnings.length > 0}
                            <div class="max-w-md mx-auto p-4 bg-muted/30 rounded-lg text-left">
                                <p class="font-medium text-sm mb-2">{$locale === 'es' ? 'Notas:' : 'Notes:'}</p>
                                <ul class="text-sm text-muted-foreground space-y-1">
                                    {#each importResult.warnings.slice(0, 5) as warning}
                                        <li class="flex items-start gap-2">
                                            <span class="text-yellow-500">•</span>
                                            {warning}
                                        </li>
                                    {/each}
                                    {#if importResult.warnings.length > 5}
                                        <li class="text-muted-foreground">
                                            ... {$locale === 'es' ? 'y' : 'and'} {importResult.warnings.length - 5} {$locale === 'es' ? 'más' : 'more'}
                                        </li>
                                    {/if}
                                </ul>
                            </div>
                        {/if}

                        <!-- Errors -->
                        {#if importResult.errors.length > 0}
                            <div class="max-w-md mx-auto p-4 bg-destructive/10 rounded-lg text-left">
                                <p class="font-medium text-sm text-destructive mb-2">
                                    {$locale === 'es' ? 'Errores:' : 'Errors:'}
                                </p>
                                <ul class="text-sm text-destructive/80 space-y-1">
                                    {#each importResult.errors.slice(0, 5) as error}
                                        <li class="flex items-start gap-2">
                                            <span>•</span>
                                            {$locale === 'es' ? 'Fila' : 'Row'} {error.row}: {error.message}
                                        </li>
                                    {/each}
                                    {#if importResult.errors.length > 5}
                                        <li class="text-destructive/60">
                                            ... {$locale === 'es' ? 'y' : 'and'} {importResult.errors.length - 5} {$locale === 'es' ? 'errores más' : 'more errors'}
                                        </li>
                                    {/if}
                                </ul>
                            </div>
                        {/if}

                        <!-- Actions -->
                        <div class="flex justify-center gap-4 pt-4">
                            <Button variant="outline" on:click={resetWizard}>
                                <RefreshCw size={16} class="mr-2" />
                                {$locale === 'es' ? 'Importar Más' : 'Import More'}
                            </Button>
                            <Button on:click={() => goto('/dashboard')}>
                                {$locale === 'es' ? 'Ir al Dashboard' : 'Go to Dashboard'}
                                <ArrowRight size={16} class="ml-2" />
                            </Button>
                        </div>
                    </div>
                </Card.Content>
            </Card.Root>
        {/if}
    </div>
</div>

