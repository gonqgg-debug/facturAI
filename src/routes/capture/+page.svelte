<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { Camera, Zap, Image as ImageIcon, Settings, Upload, Brain, Info, FileText, Truck, CheckCircle2 } from 'lucide-svelte';
  import { processImage } from '$lib/ocr';
  import { parseInvoiceWithGrok } from '$lib/grok';
  import { currentInvoice, isProcessing, locale } from '$lib/stores';
  import { db } from '$lib/db';
  import * as Dialog from '$lib/components/ui/dialog';
  import * as Select from '$lib/components/ui/select';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Button } from '$lib/components/ui/button';
  import * as Card from '$lib/components/ui/card';
  import { t } from '$lib/i18n';
  import type { Invoice } from '$lib/types';

  let video: HTMLVideoElement;
  let canvas: HTMLCanvasElement;
  let stream: MediaStream | null = null;
  let error: string = '';
  let isCameraActive = false;
  
  // Camera Capabilities
  let track: MediaStreamTrack | null = null;
  let capabilities: any = {};
  let flashOn = false;
  let zoom = 1;

  // Onboarding State
  let showOnboarding = false;
  let pendingFiles: Blob[] = [];
  let hints: {
    isMultiPage: boolean;
    supplierName: string;
    total: string;
    itbis: string;
    category: Invoice['category'];
  } = {
    isMultiPage: false,
    supplierName: '',
    total: '',
    itbis: '',
    category: 'Inventory'
  };

  // API keys are now configured server-side via environment variables
  // No client-side check needed

  onDestroy(() => {
    stopCamera();
  });

  async function startCamera() {
    try {
      isCameraActive = true;
      stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          zoom: true // Request zoom capability
        } as any
      });
      
      if (video) {
        video.srcObject = stream;
      }

      // Get track capabilities
      track = stream.getVideoTracks()[0];
      if (track) {
        // Wait a moment for the track to initialize
        setTimeout(async () => {
          if (!track) return;
          capabilities = track.getCapabilities ? track.getCapabilities() : {};
          
          // Apply initial zoom if supported
          if (capabilities.zoom) {
            zoom = capabilities.zoom.min || 1;
          }
        }, 500);
      }

    } catch (e) {
      error = t('capture.cameraAccessDenied', $locale);
      console.error(e);
      isCameraActive = false;
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
      stream = null;
      track = null;
    }
    isCameraActive = false;
    flashOn = false;
    zoom = 1;
  }

  async function toggleFlash() {
    if (!track) return;
    flashOn = !flashOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: flashOn }]
      } as any);
    } catch (e) {
      console.error('Flash toggle failed', e);
      flashOn = !flashOn; // Revert on failure
    }
  }

  async function handleZoom(e: Event) {
    if (!track) return;
    const input = e.target as HTMLInputElement;
    zoom = parseFloat(input.value);
    try {
      await track.applyConstraints({
        advanced: [{ zoom: zoom }]
      } as any);
    } catch (e) {
      console.error('Zoom failed', e);
    }
  }



  async function captureAndProcess() {
    // API key is now configured server-side, no check needed
    if (!video || !canvas) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0);
    
    try {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
      if (!blob) throw new Error('Failed to create image blob');
      
      pendingFiles = [...pendingFiles, blob];
      showOnboarding = true;
      stopCamera();

    } catch (e: any) {
      error = e.message || 'Capture failed';
    }
  }

  async function handleFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      // API key is now configured server-side, no check needed
      pendingFiles = [...pendingFiles, file];
      showOnboarding = true;
    }
    // Reset input
    input.value = '';
  }

  function addAnotherPage() {
    showOnboarding = false;
    startCamera();
  }

  function removePage(index: number) {
    pendingFiles = pendingFiles.filter((_, i) => i !== index);
    if (pendingFiles.length === 0) {
      showOnboarding = false;
    }
  }

  function cancelOnboarding() {
    showOnboarding = false;
    pendingFiles = [];
    hints = { isMultiPage: false, supplierName: '', total: '', itbis: '', category: 'Inventory' };
  }

  let processingStatus = '';
  let progress = 0;

  async function confirmProcessing() {
    if (pendingFiles.length === 0) return;
    showOnboarding = false;
    isProcessing.set(true);
    processingStatus = 'Initializing...';
    progress = 5;

    try {
      await processBlobs(pendingFiles);
    } catch (e: any) {
      error = e.message;
      isProcessing.set(false);
    } finally {
      pendingFiles = [];
    }
  }

  async function processBlobs(blobs: Blob[]) {
    let fullText = '';
    let finalQr = '';
    
    // 1. Process all pages in parallel
    processingStatus = `Scanning ${blobs.length} pages...`;
    progress = 10;
    
    let completedCount = 0;
    const processPromises = blobs.map(async (blob, index) => {
      try {
        const result = await processImage(blob);
        completedCount++;
        processingStatus = `Scanning pages (${completedCount}/${blobs.length})...`;
        progress = 10 + (completedCount / blobs.length) * 30; // 10% to 40%
        return result;
      } catch (err) {
        console.error(`Error processing page ${index + 1}:`, err);
        throw new Error(`Failed to scan page ${index + 1}`);
      }
    });

    const results = await Promise.all(processPromises);

    // Combine results in order
    results.forEach((res, i) => {
      fullText += `\n--- PAGE ${i + 1} ---\n${res.text}`;
      if (res.qrCode && !finalQr) finalQr = res.qrCode;
    });

    console.log('Combined OCR Result:', fullText);

    // 2. Grok Extraction with Hints
    processingStatus = 'Consulting AI...';
    progress = 50;
    
    const userHints = {
      supplierName: hints.supplierName,
      total: parseFloat(hints.total) || undefined,
      itbis: parseFloat(hints.itbis) || undefined,
      isMultiPage: hints.isMultiPage || blobs.length > 1
    };

    // Offline Handling
    if (!navigator.onLine) {
      processingStatus = 'Offline: Saving for later...';
      
      // Create a partial invoice
      const offlineInvoice: any = {
        providerName: hints.supplierName || 'Pending Extraction',
        providerRnc: '',
        issueDate: new Date().toISOString().split('T')[0],
        ncf: '',
        currency: 'DOP',
        items: [],
        subtotal: 0,
        discount: 0,
        itbisTotal: 0,
        total: parseFloat(hints.total) || 0,
        rawText: fullText,
        imageUrl: URL.createObjectURL(blobs[0]),
        status: 'needs_extraction',
        createdAt: new Date()
      };

      if (finalQr) {
        offlineInvoice.securityCode = finalQr;
        offlineInvoice.isEcf = true;
        offlineInvoice.qrUrl = finalQr;
      }

      await db.invoices.add(offlineInvoice);
      isProcessing.set(false);
      alert('You are offline. Invoice saved to Invoices for later extraction.');
      goto('/invoices');
      return;
    }

    // Simulate progress for AI wait time (since we can't track real progress)
    const progressInterval = setInterval(() => {
      if (progress < 90) progress += 1;
    }, 100);

    try {
      const invoiceData = await parseInvoiceWithGrok(fullText, undefined, userHints);
      clearInterval(progressInterval);
      progress = 95;
      
      // 3. Merge QR data if available
      if (finalQr) {
        invoiceData.securityCode = finalQr;
        invoiceData.isEcf = true;
        invoiceData.qrUrl = finalQr;
      }

      // 4. Store (use first image as thumbnail)
      processingStatus = 'Finalizing...';
      progress = 100;
      currentInvoice.set({
        ...invoiceData,
        rawText: fullText,
        imageUrl: URL.createObjectURL(blobs[0]),
        status: 'draft',
        category: hints.category,
        createdAt: new Date()
      });

      isProcessing.set(false);
      goto('/validation');
    } catch (e: any) {
      clearInterval(progressInterval);
      console.error('Error processing invoice:', e);
      error = e.message || e.toString() || 'Failed to process invoice. Check console for details.';
      isProcessing.set(false);
      alert(error);
    }
  }
</script>

<div class="w-full flex flex-col bg-background">
  <!-- Helper Info Card - Collapsible -->
  <div class="w-full p-4 pb-2">
    <Card.Root class="border-amber-500/30 bg-amber-500/5 shadow-sm">
      <Card.Content class="py-4">
        <div class="flex items-center gap-3">
          <div class="p-2 bg-amber-500/10 rounded-lg">
            <Zap class="text-amber-500" size={24} />
          </div>
          <div class="flex-1">
            <h3 class="font-bold text-foreground text-lg">Quick Capture</h3>
            <p class="text-sm text-muted-foreground">
              Snap the invoice, let AI extract everything — <strong>no Purchase Order needed</strong>
            </p>
          </div>
        </div>
        <div class="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div class="bg-background/50 rounded-lg p-3">
            <Camera class="mx-auto text-primary mb-1" size={20} />
            <span class="text-xs text-muted-foreground">Snap Photo</span>
          </div>
          <div class="bg-background/50 rounded-lg p-3">
            <Brain class="mx-auto text-primary mb-1" size={20} />
            <span class="text-xs text-muted-foreground">AI Extracts</span>
          </div>
          <div class="bg-background/50 rounded-lg p-3">
            <FileText class="mx-auto text-primary mb-1" size={20} />
            <span class="text-xs text-muted-foreground">Validate</span>
          </div>
          <div class="bg-background/50 rounded-lg p-3">
            <Truck class="mx-auto text-primary mb-1" size={20} />
            <span class="text-xs text-muted-foreground">Update Stock</span>
          </div>
        </div>
        <p class="text-xs text-muted-foreground mt-3 text-center">
          Perfect for: <strong>Live truck ordering</strong> • Emergency restocking • Utility bills
        </p>
      </Card.Content>
    </Card.Root>
  </div>

  <!-- Main Content Area -->
  <div class="flex-1 relative overflow-hidden flex flex-col" style="min-height: calc(100vh - 300px);">
    
    {#if isCameraActive}
      <!-- Camera View -->
      <!-- svelte-ignore a11y-media-has-caption -->
      <video 
        bind:this={video} 
        autoplay 
        playsinline 
        class="absolute inset-0 w-full h-full object-cover z-0"
      ></video>
      
      <!-- Camera Overlay -->
      <div class="absolute inset-0 pointer-events-none border-2 border-white/20 m-8 rounded-lg"></div>
      
      <!-- Close Camera Button -->
      <button 
        class="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full z-20"
        on:click={stopCamera}
      >
        ✕
      </button>

      <!-- Flash Button (Only if supported) -->
      {#if capabilities.torch}
        <button 
          class="absolute top-4 left-4 bg-black/50 text-white p-2 rounded-full z-20 transition-colors {flashOn ? 'text-yellow-400' : ''}"
          on:click={toggleFlash}
        >
          <Zap size={24} fill={flashOn ? "currentColor" : "none"} />
        </button>
      {/if}

      <!-- Zoom Slider (Only if supported) -->
      {#if capabilities.zoom}
        <div class="absolute bottom-32 left-8 right-8 z-20 flex items-center space-x-2">
          <span class="text-xs text-white font-bold drop-shadow-md">1x</span>
          <input 
            type="range" 
            min={capabilities.zoom.min} 
            max={capabilities.zoom.max} 
            step={capabilities.zoom.step || 0.1} 
            bind:value={zoom}
            on:input={handleZoom}
            class="flex-1 accent-primary h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
          />
          <span class="text-xs text-white font-bold drop-shadow-md">{capabilities.zoom.max}x</span>
        </div>
      {/if}

      <!-- Capture Button (Camera Mode) -->
      <div class="absolute bottom-0 left-0 right-0 p-6 pb-24 md:pb-6 flex justify-center items-center bg-black/50 backdrop-blur">
         <button 
          class="h-20 w-20 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:bg-white/40 transition-all"
          on:click={captureAndProcess}
        >
          <div class="h-16 w-16 rounded-full bg-white"></div>
        </button>
      </div>

    {:else}
      <!-- Upload / Start View -->
      <div class="flex-1 flex flex-col items-center justify-center p-6 space-y-6 bg-background overflow-y-auto">
        {#if error}
          <div class="bg-destructive/10 border border-destructive text-destructive p-3 rounded-lg text-sm max-w-md mx-auto">
            {error}
          </div>
        {/if}

        <!-- Two Big Action Buttons -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg">
          <!-- Camera Button (Primary) -->
          <button 
            on:click={startCamera}
            class="aspect-square bg-primary/10 border-2 border-primary/30 rounded-3xl flex flex-col items-center justify-center space-y-3 cursor-pointer hover:bg-primary/20 hover:border-primary/50 transition-all group"
          >
            <div class="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Camera size={40} class="text-primary" />
            </div>
            <span class="text-foreground font-bold text-lg">Take Photo</span>
            <span class="text-xs text-muted-foreground">Recommended for speed</span>
          </button>

          <!-- Upload Button -->
          <label class="aspect-square bg-card border-2 border-dashed border-border rounded-3xl flex flex-col items-center justify-center space-y-3 cursor-pointer hover:bg-accent hover:border-primary/30 transition-all group">
            <input type="file" accept="image/*" class="hidden" on:change={handleFileUpload} />
            <div class="w-20 h-20 rounded-full bg-muted flex items-center justify-center group-hover:scale-110 transition-transform">
              <Upload size={40} class="text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <span class="text-foreground font-bold text-lg">Upload Image</span>
            <span class="text-xs text-muted-foreground">From gallery or files</span>
          </label>
        </div>

        <!-- Quick Tips -->
        <div class="text-center max-w-md">
          <p class="text-xs text-muted-foreground">
            <strong>Pro tip:</strong> Flatten the invoice and ensure good lighting for best OCR results
          </p>
        </div>
      </div>
    {/if}
    
    <!-- Processing Overlay -->
    <!-- Processing Overlay -->
    {#if $isProcessing}
      <div class="absolute inset-0 bg-background/80 backdrop-blur-md z-50 flex flex-col items-center justify-center p-8">
        <!-- Pulse Animation -->
        <div class="relative mb-8">
          <div class="absolute inset-0 bg-primary/30 rounded-full animate-ping opacity-75"></div>
          <div class="relative bg-card p-6 rounded-full border border-primary shadow-[0_0_30px_rgba(0,122,255,0.3)]">
            <Brain size={48} class="text-primary animate-pulse" />
          </div>
        </div>

        <h3 class="text-2xl font-bold text-foreground mb-2 text-center tracking-wide">{processingStatus}</h3>
        
        <!-- Progress Bar -->
        <div class="w-full max-w-xs bg-secondary rounded-full h-2 mb-4 overflow-hidden border border-border">
          <div 
            class="bg-primary h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(0,122,255,0.5)]"
            style="width: {progress}%"
          ></div>
        </div>
        
        <p class="text-muted-foreground text-sm font-mono">{Math.round(progress)}% Complete</p>
      </div>
    {/if}
  </div>



  <canvas bind:this={canvas} class="hidden"></canvas>

  <!-- Onboarding Dialog -->
  <Dialog.Root bind:open={showOnboarding} onOpenChange={(open) => { if (!open) cancelOnboarding(); }}>
    <Dialog.Content class="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
      <Dialog.Header>
        <Dialog.Title>{t('capture.invoiceDetails', $locale)}</Dialog.Title>
        <Dialog.Description>
          {t('capture.helpAiContext', $locale)}
        </Dialog.Description>
      </Dialog.Header>

      <div class="space-y-4 overflow-y-auto flex-1 py-4">
        <!-- Page Type -->
        <div class="flex bg-secondary p-1 rounded-lg">
          <button 
            class="flex-1 py-2 rounded-md text-sm font-medium transition-colors { !hints.isMultiPage ? 'bg-background shadow text-foreground' : 'text-muted-foreground' }"
            on:click={() => hints.isMultiPage = false}
          >
            {t('capture.singlePage', $locale)}
          </button>
          <button 
            class="flex-1 py-2 rounded-md text-sm font-medium transition-colors { hints.isMultiPage ? 'bg-background shadow text-foreground' : 'text-muted-foreground' }"
            on:click={() => hints.isMultiPage = true}
          >
            {t('capture.multiPage', $locale)}
          </button>
        </div>

        <!-- Page Thumbnails (Only if Multi Page) -->
        {#if hints.isMultiPage}
          <div class="space-y-2">
            <span class="block text-xs text-muted-foreground uppercase font-bold">Pages ({pendingFiles.length})</span>
            <div class="flex space-x-2 overflow-x-auto pb-2">
              {#each pendingFiles as file, i}
                <div class="relative flex-shrink-0 w-20 h-28 bg-secondary rounded-lg border border-border overflow-hidden group">
                  <img src={URL.createObjectURL(file)} class="w-full h-full object-cover" alt="Page {i+1}" />
                  <button 
                    class="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    on:click={() => removePage(i)}
                  >
                    <div class="w-3 h-3 flex items-center justify-center text-[10px]">✕</div>
                  </button>
                  <div class="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-1">
                    Page {i+1}
                  </div>
                </div>
              {/each}
              
              <!-- Add Page Button -->
              <div class="flex-shrink-0 w-20 h-28 bg-secondary/50 rounded-lg border border-border border-dashed flex flex-col items-center justify-center space-y-2">
                <button class="p-2 bg-primary/10 rounded-full text-primary" on:click={addAnotherPage}>
                  <Camera size={16} />
                </button>
                <label class="p-2 bg-primary/10 rounded-full text-primary cursor-pointer">
                  <input type="file" accept="image/*" class="hidden" on:change={handleFileUpload} />
                  <Upload size={16} />
                </label>
              </div>
            </div>
          </div>
        {/if}

        <!-- Supplier -->
        <div class="space-y-1.5">
          <Label for="hint-supplier" class="text-xs uppercase">{t('capture.supplierName', $locale)}</Label>
          <Input 
            id="hint-supplier"
            bind:value={hints.supplierName}
            placeholder="e.g. Supermercado Nacional"
            class="h-11"
          />
        </div>

        <!-- Amounts -->
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-1.5">
            <Label for="hint-total" class="text-xs uppercase">{t('capture.expectedTotal', $locale)}</Label>
            <Input 
              id="hint-total"
              type="number"
              bind:value={hints.total}
              placeholder="0.00"
              class="h-11"
            />
          </div>
          <div class="space-y-1.5">
            <Label for="hint-itbis" class="text-xs uppercase">{t('capture.expectedItbis', $locale)}</Label>
            <Input 
              id="hint-itbis"
              type="number"
              bind:value={hints.itbis}
              placeholder="0.00"
              class="h-11"
            />
          </div>
        </div>
        
        <!-- Category -->
        <div class="space-y-1.5">
          <Label class="text-xs uppercase">Category</Label>
          <Select.Root 
            selected={hints.category ? { value: hints.category, label: hints.category === 'Inventory' ? 'Inventory (Resale)' : hints.category } : { value: 'Inventory', label: 'Inventory (Resale)' }}
            onSelectedChange={(v) => { 
              if (v?.value) {
                const val = v.value;
                if (val === 'Inventory' || val === 'Utilities' || val === 'Maintenance' || val === 'Payroll' || val === 'Other') {
                  hints.category = val;
                }
              }
            }}
          >
            <Select.Trigger class="w-full h-11">
              <Select.Value placeholder="Select category..." />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="Inventory" label="Inventory (Resale)">Inventory (Resale)</Select.Item>
              <Select.Item value="Utilities" label="Utilities">Utilities</Select.Item>
              <Select.Item value="Maintenance" label="Maintenance">Maintenance</Select.Item>
              <Select.Item value="Payroll" label="Payroll">Payroll</Select.Item>
              <Select.Item value="Other" label="Other">Other</Select.Item>
            </Select.Content>
          </Select.Root>
          <p class="text-xs text-muted-foreground mt-1">
            {#if hints.category === 'Inventory'}
              Stock will be automatically updated when saved.
            {:else}
              Non-inventory expense - stock will not be affected.
            {/if}
          </p>
        </div>
      </div>

      <Dialog.Footer class="pt-4 border-t border-border gap-3">
        <Button 
          variant="secondary"
          size="default"
          on:click={cancelOnboarding}
          class="flex-1 font-bold"
        >
          {t('capture.cancel', $locale)}
        </Button>
        <Button 
          variant="default"
          size="default"
          on:click={confirmProcessing}
          class="flex-1 font-bold"
        >
          {t('capture.process', $locale)}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
</div>
