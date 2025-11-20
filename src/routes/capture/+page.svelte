<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { Camera, Zap, Image as ImageIcon, Settings, Upload } from 'lucide-svelte';
  import { processImage } from '$lib/ocr';
  import { parseInvoiceWithGrok } from '$lib/grok';
  import { apiKey, currentInvoice, isProcessing } from '$lib/stores';
  import { db } from '$lib/db';

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
  let hints = {
    isMultiPage: false,
    supplierName: '',
    total: '',
    itbis: ''
  };

  let hasApiKey = false;

  onMount(async () => {
    const storedKey = localStorage.getItem('xai_api_key');
    if (storedKey) {
      apiKey.set(storedKey);
      hasApiKey = true;
    } else {
      hasApiKey = false;
    }
  });

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
        } 
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
      error = 'Camera access denied or not available.';
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
    if (!$apiKey) {
      alert('Please set your xAI API Key first.');
      goto('/settings');
      return;
    }

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
      if (!$apiKey) {
        alert('Please set your xAI API Key first.');
        goto('/settings');
        return;
      }
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

  let processingStatus = '';

  async function confirmProcessing() {
    if (pendingFiles.length === 0) return;
    showOnboarding = false;
    isProcessing.set(true);
    processingStatus = 'Initializing...';

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
    
    let completedCount = 0;
    const processPromises = blobs.map(async (blob, index) => {
      try {
        const result = await processImage(blob);
        completedCount++;
        processingStatus = `Scanning pages (${completedCount}/${blobs.length})...`;
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
      alert('You are offline. Invoice saved to History for later extraction.');
      goto('/history');
      return;
    }

    const invoiceData = await parseInvoiceWithGrok(fullText, $apiKey, undefined, userHints);
    
    // 3. Merge QR data if available
    if (finalQr) {
      invoiceData.securityCode = finalQr;
      invoiceData.isEcf = true;
      invoiceData.qrUrl = finalQr;
    }

    // 4. Store (use first image as thumbnail)
    processingStatus = 'Finalizing...';
    currentInvoice.set({
      ...invoiceData,
      rawText: fullText,
      imageUrl: URL.createObjectURL(blobs[0]),
      status: 'draft',
      createdAt: new Date()
    });

    isProcessing.set(false);
    goto('/validation');
  }
</script>

<div class="relative h-full flex flex-col bg-black">
  <!-- Main Content Area -->
  <div class="flex-1 relative overflow-hidden flex flex-col">
    
    {#if isCameraActive}
      <!-- Camera View -->
      <!-- svelte-ignore a11y-media-has-caption -->
      <video 
        bind:this={video} 
        autoplay 
        playsinline 
        class="absolute inset-0 w-full h-full object-cover"
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
            class="flex-1 accent-ios-blue h-1 bg-white/30 rounded-lg appearance-none cursor-pointer"
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

    {:else if !hasApiKey}
      <!-- No API Key State -->
      <div class="flex-1 flex flex-col items-center justify-center p-6 space-y-6 bg-ios-bg text-center">
        <div class="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center mb-4">
          <Settings size={40} class="text-yellow-500" />
        </div>
        <h1 class="text-2xl font-bold text-white">Setup Required</h1>
        <p class="text-gray-400 max-w-xs">To start scanning invoices, you need to configure your AI API Key.</p>
        
        <button 
          class="bg-ios-blue text-white font-bold py-3 px-8 rounded-xl hover:bg-blue-600 transition-colors"
          on:click={() => goto('/settings')}
        >
          Go to Settings
        </button>
      </div>

    {:else}
      <!-- Upload / Start View -->
      <div class="flex-1 flex flex-col items-center justify-center p-6 space-y-8 bg-ios-bg">
        <div class="text-center space-y-2">
          <h1 class="text-3xl font-bold text-white">New Invoice</h1>
          <p class="text-gray-400">Upload a photo or scan to start</p>
          {#if error}
            <div class="bg-red-500/20 border border-red-500 text-red-200 p-3 rounded-lg text-sm max-w-xs mx-auto mt-4">
              {error}
            </div>
          {/if}
        </div>

        <!-- Big Upload Button -->
        <label class="w-full max-w-xs aspect-square bg-ios-card border-2 border-dashed border-ios-separator rounded-3xl flex flex-col items-center justify-center space-y-4 cursor-pointer hover:bg-white/5 transition-colors group">
          <input type="file" accept="image/*" class="hidden" on:change={handleFileUpload} />
          <div class="w-20 h-20 rounded-full bg-ios-blue/10 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Upload size={40} class="text-ios-blue" />
          </div>
          <span class="text-white font-medium text-lg">Upload Photo</span>
        </label>

        <!-- Camera Button -->
        <button 
          class="flex items-center space-x-2 text-ios-blue font-medium px-6 py-3 rounded-full bg-ios-blue/10 hover:bg-ios-blue/20 transition-colors"
          on:click={startCamera}
        >
          <Camera size={20} />
          <span>Use Camera</span>
        </button>
      </div>
    {/if}
    
    <!-- Processing Overlay -->
    {#if $isProcessing}
      <div class="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-50">
        <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ios-blue mb-4"></div>
        <p class="text-white font-medium">{processingStatus}</p>
        <p class="text-gray-400 text-sm mt-2">Please wait...</p>
      </div>
    {/if}
  </div>



  <canvas bind:this={canvas} class="hidden"></canvas>

  <!-- Onboarding Modal -->
  {#if showOnboarding}
    <div class="absolute inset-0 bg-black/90 z-50 flex items-center justify-center p-6 overflow-y-auto">
      <div class="bg-ios-card w-full max-w-md p-6 rounded-2xl border border-ios-separator space-y-6 my-auto">
        <div class="text-center">
          <h2 class="text-xl font-bold text-white">Invoice Details</h2>
          <p class="text-gray-400 text-sm">Help the AI by providing some context</p>
        </div>

        <div class="space-y-4">
          <!-- Page Type -->
          <div class="flex bg-black/50 p-1 rounded-lg">
            <button 
              class="flex-1 py-2 rounded-md text-sm font-medium transition-colors { !hints.isMultiPage ? 'bg-ios-blue text-white' : 'text-gray-400' }"
              on:click={() => hints.isMultiPage = false}
            >
              Single Page
            </button>
            <button 
              class="flex-1 py-2 rounded-md text-sm font-medium transition-colors { hints.isMultiPage ? 'bg-ios-blue text-white' : 'text-gray-400' }"
              on:click={() => hints.isMultiPage = true}
            >
              Multi Page
            </button>
          </div>

          <!-- Page Thumbnails (Only if Multi Page) -->
          {#if hints.isMultiPage}
            <div class="space-y-2">
              <label class="block text-xs text-gray-500 uppercase font-bold">Pages ({pendingFiles.length})</label>
              <div class="flex space-x-2 overflow-x-auto pb-2">
                {#each pendingFiles as file, i}
                  <div class="relative flex-shrink-0 w-20 h-28 bg-black/50 rounded-lg border border-ios-separator overflow-hidden group">
                    <img src={URL.createObjectURL(file)} class="w-full h-full object-cover" alt="Page {i+1}" />
                    <button 
                      class="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
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
                <div class="flex-shrink-0 w-20 h-28 bg-black/30 rounded-lg border border-ios-separator border-dashed flex flex-col items-center justify-center space-y-2">
                  <button class="p-2 bg-ios-blue/20 rounded-full text-ios-blue" on:click={addAnotherPage}>
                    <Camera size={16} />
                  </button>
                  <label class="p-2 bg-ios-blue/20 rounded-full text-ios-blue cursor-pointer">
                    <input type="file" accept="image/*" class="hidden" on:change={handleFileUpload} />
                    <Upload size={16} />
                  </label>
                </div>
              </div>
            </div>
          {/if}

          <!-- Supplier -->
          <div>
            <label class="block text-xs text-gray-500 mb-1 uppercase font-bold">Supplier Name (Optional)</label>
            <input 
              bind:value={hints.supplierName}
              placeholder="e.g. Supermercado Nacional"
              class="w-full bg-black/50 border border-ios-separator rounded-lg p-3 text-white focus:border-ios-blue outline-none"
            />
          </div>

          <!-- Amounts -->
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-gray-500 mb-1 uppercase font-bold">Total Amount</label>
              <input 
                type="number"
                bind:value={hints.total}
                placeholder="0.00"
                class="w-full bg-black/50 border border-ios-separator rounded-lg p-3 text-white focus:border-ios-blue outline-none"
              />
            </div>
            <div>
              <label class="block text-xs text-gray-500 mb-1 uppercase font-bold">ITBIS Amount</label>
              <input 
                type="number"
                bind:value={hints.itbis}
                placeholder="0.00"
                class="w-full bg-black/50 border border-ios-separator rounded-lg p-3 text-white focus:border-ios-blue outline-none"
              />
            </div>
          </div>
        </div>

        <div class="flex space-x-3">
          <button 
            class="flex-1 bg-white/10 text-white font-bold py-3 rounded-lg"
            on:click={() => { showOnboarding = false; pendingFiles = []; }}
          >
            Cancel
          </button>
          <button 
            class="flex-1 bg-ios-blue text-white font-bold py-3 rounded-lg"
            on:click={confirmProcessing}
          >
            Process Invoice
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>
