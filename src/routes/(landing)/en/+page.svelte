<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { 
    Zap, ShoppingCart, BarChart3, Users, 
    MessageCircle, TrendingUp, ArrowRight, 
    CheckCircle2, Star, Shield, Globe,
    Package, CreditCard, Scan, Receipt,
    Sparkles, Wand2, Brain, Target, Bell,
    Layers, Calculator, AlertTriangle, Wallet,
    Wifi, WifiOff, Printer, Server, Lock
  } from 'lucide-svelte';

  let promptText = "";
  let isAnimating = false;
  let showResult = false;

  // Hero animation state - 3 steps: Traditional -> Magic Button -> AI-Powered
  let heroStep = 0; // 0 = traditional, 1 = magic transformation, 2 = AI-powered
  let heroTimeout: ReturnType<typeof setTimeout>;

  function runHeroAnimation() {
    // Step 0: Show traditional POS for 2.5s
    heroStep = 0;
    heroTimeout = setTimeout(() => {
      // Step 1: Show magic button for 2s
      heroStep = 1;
      heroTimeout = setTimeout(() => {
        // Step 2: Show AI-powered for 3s
        heroStep = 2;
        heroTimeout = setTimeout(() => {
          // Loop back
          runHeroAnimation();
        }, 3500);
      }, 2000);
    }, 2500);
  }

  function startDemo() {
    if (isAnimating) return;
    isAnimating = true;
    showResult = false;
    promptText = "";
    const text = "I don't send orders to suppliers, the truck arrives and I buy live. Create the entire flow: scan entry, update inventory, and pay in cash or transfer.";
    let i = 0;
    
    const typeInterval = setInterval(() => {
      promptText += text.charAt(i);
      i++;
      if (i >= text.length) {
        clearInterval(typeInterval);
        setTimeout(() => {
          showResult = true;
          isAnimating = false;
        }, 1000);
      }
    }, 30);
  }

  onMount(() => {
    // Auto start demo after a few seconds
    const timer = setTimeout(startDemo, 2000);

    // Start hero animation
    runHeroAnimation();

    return () => {
      clearTimeout(timer);
      clearTimeout(heroTimeout);
    };
  });

  function goToLogin() {
    goto('/login');
  }
</script>

<svelte:head>
  <title>Cuadra - The POS for mini-markets that adapts to your business</title>
  <meta name="description" content="Automate inventory and purchasing. Tax compliant. Works offline. With optional AI that learns from you." />
</svelte:head>

<div class="min-h-screen bg-white text-[#1F2937] font-sans selection:bg-[#BADBF7] selection:text-[#0D4373]">
  
  <!-- Navbar -->
  <nav class="fixed top-0 w-full bg-white/90 backdrop-blur-md z-50 border-b border-[#BADBF7]/50">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <img src="/cuadra_logo.png" alt="Cuadra" class="h-7 sm:h-8 w-auto" />
      </div>
      <div class="flex items-center gap-2 sm:gap-4">
        <button on:click={goToLogin} class="hidden sm:block text-[#1F2937]/80 hover:text-[#1E88E6] font-medium transition-colors">Sign In</button>
        <button on:click={goToLogin} class="bg-[#1E88E6] text-white hover:bg-[#1778CF] rounded-full px-4 sm:px-6 py-1.5 sm:py-2 text-sm sm:text-base font-medium transition-colors">Free Trial</button>
        <a href="/" class="text-xs text-[#1F2937]/40 hover:text-[#1E88E6] transition-colors ml-1">ES</a>
      </div>
    </div>
  </nav>

  <!-- Hero -->
  <header class="pt-32 pb-20 px-6 bg-gradient-to-b from-[#BADBF7]/20 to-white">
    <div class="max-w-4xl mx-auto text-center">
      <!-- Headline -->
      <h1 class="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-[#1F2937] leading-[1.1]">
        The POS for mini-markets <br />
        that adapts to your business
      </h1>
      
      <!-- Subheadline -->
      <p class="text-xl md:text-2xl text-[#1E88E6] font-medium max-w-3xl mx-auto mb-6 leading-relaxed">
        Automate inventory and purchasing. Tax compliant. Works offline. With optional AI that learns from you.
      </p>

      <!-- Trust Badges -->
      <div class="flex flex-wrap justify-center gap-4 mb-10">
        <div class="flex items-center gap-2 bg-[#BADBF7]/30 px-4 py-2 rounded-full text-sm font-medium text-[#0D4373]">
          <Shield size={16} />
          <span>Offline-first</span>
        </div>
        <div class="flex items-center gap-2 bg-[#BADBF7]/30 px-4 py-2 rounded-full text-sm font-medium text-[#0D4373]">
          <Package size={16} />
          <span>Multi-warehouse</span>
        </div>
        <div class="flex items-center gap-2 bg-[#BADBF7]/30 px-4 py-2 rounded-full text-sm font-medium text-[#0D4373]">
          <Globe size={16} />
          <span>Tax: DR, MX, CO, PE, CL</span>
        </div>
      </div>
      
      <!-- Interactive Demo - 3 Step Transformation -->
      <div class="relative mx-auto max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-300 mb-12">
        <!-- Browser Chrome -->
        <div class="bg-gray-100 px-4 py-3 flex items-center gap-2 border-b border-gray-300">
          <div class="flex gap-1.5">
            <div class="w-3 h-3 rounded-full bg-red-500"></div>
            <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div class="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div class="flex-1 mx-4">
            <div class="bg-white rounded-md px-4 py-1.5 text-xs text-gray-700 text-center border border-gray-200 shadow-sm">
              cuadrapos.com
            </div>
          </div>
        </div>
        
        <!-- App Content -->
        <div class="p-6 min-h-[340px] relative bg-white">
          
          <!-- STEP 0: Traditional POS -->
          {#if heroStep === 0}
            <div class="animate-fadeIn">
              <!-- Header with "boring" label -->
              <div class="mb-4 flex items-center justify-between">
                <div>
                  <span class="text-gray-400 text-xs uppercase tracking-wider">Other systems</span>
                  <h3 class="text-gray-800 font-bold text-lg">Traditional POS</h3>
                </div>
                <div class="bg-red-100 text-red-600 text-xs px-3 py-1 rounded-full border border-red-200">
                  Rigid & generic
                </div>
              </div>

              <!-- Traditional grid - looks cluttered and overwhelming -->
              <div class="grid grid-cols-3 gap-2 opacity-60">
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                  <ShoppingCart size={18} class="text-gray-400" />
                  <span class="text-gray-500 text-xs">Sales</span>
                </div>
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                  <Users size={18} class="text-gray-400" />
                  <span class="text-gray-500 text-xs">Customers</span>
                </div>
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                  <Receipt size={18} class="text-gray-400" />
                  <span class="text-gray-500 text-xs">Invoices</span>
                </div>
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                  <Package size={18} class="text-gray-400" />
                  <span class="text-gray-500 text-xs">Inventory</span>
                </div>
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                  <BarChart3 size={18} class="text-gray-400" />
                  <span class="text-gray-500 text-xs">Reports</span>
                </div>
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                  <CreditCard size={18} class="text-gray-400" />
                  <span class="text-gray-500 text-xs">Payments</span>
                </div>
              </div>

              <!-- Frustration message -->
              <div class="mt-6 text-center">
                <p class="text-gray-400 text-sm italic">"This doesn't work the way I work..."</p>
              </div>
            </div>
          {/if}

          <!-- STEP 1: Magic Transformation Button -->
          {#if heroStep === 1}
            <div class="animate-fadeIn flex flex-col items-center justify-center h-full min-h-[280px]">
              <!-- Glowing magic button -->
              <div class="relative">
                <div class="absolute inset-0 bg-amber-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
                <button class="relative bg-amber-500 text-gray-900 px-8 py-6 rounded-2xl shadow-2xl flex items-center gap-4 transform hover:scale-105 transition-all border-2 border-amber-300/50 hover:bg-amber-600">
                  <div class="w-14 h-14 bg-white/30 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Wand2 size={28} class="animate-wiggle text-gray-900" />
                  </div>
                  <div class="text-left">
                    <span class="text-lg font-bold block">Customize with AI</span>
                    <span class="text-sm text-gray-800">Tell it how you want it to work</span>
                  </div>
                  <Sparkles size={24} class="text-white animate-pulse" />
                </button>
              </div>

              <!-- Typing indicator -->
              <div class="mt-8 bg-blue-50 rounded-full px-6 py-3 flex items-center gap-3 border border-blue-100">
                <div class="flex gap-1">
                  <div class="w-2 h-2 bg-[#1E88E6] rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                  <div class="w-2 h-2 bg-[#1E88E6] rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                  <div class="w-2 h-2 bg-[#1E88E6] rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                </div>
                <span class="text-[#1E88E6] text-sm font-medium">Transforming your system...</span>
              </div>
            </div>
          {/if}

          <!-- STEP 2: AI-Powered POS -->
          {#if heroStep === 2}
            <div class="animate-fadeIn">
              <!-- Header with success -->
              <div class="mb-4 flex items-center justify-between">
                <div>
                  <span class="text-[#1E88E6] text-xs uppercase tracking-wider flex items-center gap-1 font-bold">
                    <Sparkles size={12} class="text-purple-500" /> Cuadra with AI
                  </span>
                  <h3 class="text-gray-800 font-bold text-lg">Your Custom System</h3>
                </div>
                <div class="bg-emerald-100 text-emerald-700 text-xs px-3 py-1 rounded-full border border-emerald-300 flex items-center gap-1 font-medium">
                  <CheckCircle2 size={12} /> Ready
                </div>
              </div>

              <!-- AI-powered modules - vibrant and organized -->
              <div class="grid grid-cols-3 gap-3">
                <div class="bg-gradient-to-br from-purple-100 to-purple-50 border-2 border-purple-400 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-all cursor-pointer shadow-md hover:shadow-purple-200">
                  <div class="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                    <Brain size={20} class="text-white" />
                  </div>
                  <span class="text-gray-800 text-xs font-bold">AI Pricing</span>
                  <span class="text-purple-600 text-[10px] font-medium">Auto-adjust</span>
                </div>
                <div class="bg-gradient-to-br from-emerald-100 to-emerald-50 border-2 border-emerald-400 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-all cursor-pointer shadow-md hover:shadow-emerald-200">
                  <div class="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg">
                    <Target size={20} class="text-white" />
                  </div>
                  <span class="text-gray-800 text-xs font-bold">Prediction</span>
                  <span class="text-emerald-600 text-[10px] font-medium">Optimal stock</span>
                </div>
                <div class="bg-gradient-to-br from-rose-100 to-rose-50 border-2 border-rose-400 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-all cursor-pointer shadow-md hover:shadow-rose-200">
                  <div class="w-10 h-10 bg-gradient-to-br from-rose-500 to-rose-600 rounded-lg flex items-center justify-center shadow-lg">
                    <Users size={20} class="text-white" />
                  </div>
                  <span class="text-gray-800 text-xs font-bold">Customer Analysis</span>
                  <span class="text-rose-600 text-[10px] font-medium">Smart</span>
                </div>
              </div>

              <!-- Quick actions row -->
              <div class="mt-4 flex gap-2">
                <button class="flex-1 bg-gray-100 text-gray-700 rounded-xl py-4 font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-all border border-gray-300">
                  <Scan size={20} />
                  Checkout
                </button>
                <button class="flex-1 bg-[#1E88E6] text-white rounded-xl py-4 font-bold flex items-center justify-center gap-2 hover:bg-[#1778CF] transition-all shadow-md">
                  <CreditCard size={20} />
                  Pay
                </button>
              </div>

              <!-- Success message -->
              <div class="mt-4 text-center">
                <p class="text-emerald-600 text-sm font-bold">✨ Now it works exactly the way YOU work</p>
              </div>
            </div>
          {/if}

          <!-- Progress indicator -->
          <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            <div class="w-2 h-2 rounded-full transition-all duration-300 {heroStep === 0 ? 'bg-gray-400 w-6' : 'bg-gray-200'}"></div>
            <div class="w-2 h-2 rounded-full transition-all duration-300 {heroStep === 1 ? 'bg-[#1E88E6] w-6' : 'bg-gray-200'}"></div>
            <div class="w-2 h-2 rounded-full transition-all duration-300 {heroStep === 2 ? 'bg-emerald-500 w-6' : 'bg-gray-200'}"></div>
          </div>
        </div>
      </div>

      <!-- CTA Buttons -->
      <div class="flex flex-col sm:flex-row justify-center gap-4">
        <button 
          class="bg-[#1E88E6] hover:bg-[#1778CF] text-white text-xl px-10 py-5 rounded-full shadow-xl shadow-[#1E88E6]/25 transition-all hover:scale-105 font-bold" 
          on:click={goToLogin}
        >
          Watch 2-minute demo
        </button>
        <button 
          class="bg-white hover:bg-gray-50 text-[#1E88E6] text-xl px-10 py-5 rounded-full shadow-lg border-2 border-[#1E88E6] transition-all hover:scale-105 font-bold" 
          on:click={goToLogin}
        >
          Request a demo
        </button>
      </div>
      <p class="text-center text-gray-500 text-sm mt-6">Starting at $29/month. Migration and support included.</p>
    </div>
  </header>

  <!-- Origin Story -->
  <section class="py-20 px-6 bg-[#BADBF7]/10 border-y border-[#8CC2F2]/30">
    <div class="max-w-3xl mx-auto text-center">
      <p class="text-xl md:text-2xl leading-relaxed text-[#1F2937]/80 font-medium">
        "Because existing systems never understood the Latin American reality, we built it from scratch in a real store. Today it's in closed beta with the first businesses experiencing the change."
      </p>
    </div>
  </section>

  <!-- Mini-Market Pain Points -->
  <section class="py-20 px-6 bg-white">
    <div class="max-w-5xl mx-auto">
      <h2 class="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-800">Designed for real mini-market challenges</h2>
      <p class="text-center text-gray-600 mb-12 max-w-2xl mx-auto">We understand how your business works because we built it in a real one.</p>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <!-- Unified SKUs -->
        <div class="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-[#1E88E6]/30 hover:shadow-lg transition-all">
          <div class="w-12 h-12 bg-[#BADBF7]/50 rounded-xl flex items-center justify-center mb-4">
            <Layers size={24} class="text-[#1E88E6]" />
          </div>
          <h3 class="font-bold text-gray-800 mb-2">Unified SKUs</h3>
          <p class="text-sm text-gray-600">Same product, different supplier names — the system unifies them automatically.</p>
        </div>

        <!-- Purchase suggestions -->
        <div class="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-[#1E88E6]/30 hover:shadow-lg transition-all">
          <div class="w-12 h-12 bg-[#BADBF7]/50 rounded-xl flex items-center justify-center mb-4">
            <Calculator size={24} class="text-[#1E88E6]" />
          </div>
          <h3 class="font-bold text-gray-800 mb-2">Purchase suggestions</h3>
          <p class="text-sm text-gray-600">Based on your sales history, we suggest what to order and when.</p>
        </div>

        <!-- Shrinkage control -->
        <div class="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-[#1E88E6]/30 hover:shadow-lg transition-all">
          <div class="w-12 h-12 bg-[#BADBF7]/50 rounded-xl flex items-center justify-center mb-4">
            <AlertTriangle size={24} class="text-[#1E88E6]" />
          </div>
          <h3 class="font-bold text-gray-800 mb-2">Shrinkage control</h3>
          <p class="text-sm text-gray-600">Easily record losses and inventory adjustments. Know what's lost and why.</p>
        </div>

        <!-- Cash reconciliation -->
        <div class="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-[#1E88E6]/30 hover:shadow-lg transition-all">
          <div class="w-12 h-12 bg-[#BADBF7]/50 rounded-xl flex items-center justify-center mb-4">
            <Wallet size={24} class="text-[#1E88E6]" />
          </div>
          <h3 class="font-bold text-gray-800 mb-2">Cash reconciliation</h3>
          <p class="text-sm text-gray-600">Balance cash, transfers, and cards in one place.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- 6 AI Superpowers -->
  <section class="py-24 px-6 bg-white">
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-800">Key processes powered by AI</h2>
      <p class="text-center text-gray-600 mb-12 max-w-2xl mx-auto">Automate the repetitive. Get smart suggestions where it matters most.</p>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Card 1: Smart Pricing -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-purple-200 hover:shadow-purple-200 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 group-hover:from-purple-100 to-transparent rounded-bl-full -mr-8 -mt-8 transition-all duration-500 group-hover:scale-110"></div>
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-purple-100 group-hover:text-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-purple-100 group-hover:scale-110 transition-all duration-300">
            <TrendingUp size={24} class="group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform duration-500" />
          </div>
          <h3 class="text-2xl font-bold mb-3 text-gray-900">Recommended Pricing</h3>
          <p class="text-gray-600 text-sm mb-6">Suggests price adjustments based on costs, competition, and margins. You review and approve each change.</p>
          
          <!-- Animated Visual: Price Change -->
          <div class="bg-blue-50/50 rounded-xl p-3 mb-6 border border-blue-100 group-hover:bg-purple-50 group-hover:border-purple-100 flex items-center justify-between transition-colors duration-300">
            <div class="flex flex-col">
              <span class="text-xs text-gray-400 line-through">$150.00</span>
              <span class="text-lg font-bold text-gray-700 group-hover:text-purple-600 flex items-center gap-1 transition-colors">
                $165.00 
                <TrendingUp size={14} class="inline text-[#1E88E6] group-hover:text-purple-600" />
              </span>
            </div>
            <div class="text-xs font-bold text-[#1E88E6] group-hover:text-purple-500 bg-white px-2 py-1 rounded-md shadow-sm transition-colors">
              +10% Margin
            </div>
          </div>

        </div>

        <!-- Card 2: Predictive Purchasing -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-emerald-200 hover:shadow-emerald-200 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 group-hover:from-emerald-100 to-transparent rounded-bl-full -mr-8 -mt-8 transition-all duration-500 group-hover:scale-110"></div>
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-emerald-100 group-hover:text-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-emerald-100 group-hover:scale-110 transition-all duration-300">
            <ShoppingCart size={24} class="group-hover:rotate-12 transition-transform duration-500" />
          </div>
          <h3 class="text-2xl font-bold mb-3 text-gray-900">Purchase Suggestions</h3>
          <p class="text-gray-600 text-sm mb-6">Based on past sales, we suggest what to order and how much. You decide whether to generate the order.</p>
          
          <!-- Animated Visual: Stock Alert -->
          <div class="bg-blue-50/50 rounded-xl p-3 mb-6 border border-blue-100 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-colors duration-300">
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs font-medium text-gray-600">Whole Milk</span>
              <span class="text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full group-hover:text-emerald-600 group-hover:bg-emerald-200 transition-colors duration-500">
                <span class="group-hover:hidden">Low Stock</span>
                <span class="hidden group-hover:inline">Order Generated</span>
              </span>
            </div>
            <div class="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div class="h-full bg-red-400 w-[15%] rounded-full group-hover:w-[85%] group-hover:bg-emerald-500 transition-all duration-1000 ease-out"></div>
            </div>
          </div>

        </div>

        <!-- Card 3: Smart Invoice Scanning -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-rose-200 hover:shadow-rose-200 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 group-hover:from-rose-100 to-transparent rounded-bl-full -mr-8 -mt-8 transition-all duration-500 group-hover:scale-110"></div>
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-rose-100 group-hover:text-rose-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-rose-100 group-hover:scale-110 transition-all duration-300">
            <Scan size={24} class="group-hover:scale-110 transition-transform duration-500" />
          </div>
          <h3 class="text-2xl font-bold mb-3 text-gray-900">Invoice Recognition</h3>
          <p class="text-gray-600 text-sm mb-6">Photograph any supplier invoice. The system extracts the data and you review before confirming.</p>
          
          <!-- Animated Visual: Scanning Effect -->
          <div class="relative bg-blue-50/50 rounded-xl p-3 mb-6 border border-blue-100 group-hover:bg-rose-50 group-hover:border-rose-100 overflow-hidden transition-colors duration-300 h-[60px] flex items-center justify-center">
             <!-- Document -->
             <div class="w-10 h-12 bg-white border border-gray-200 shadow-sm flex flex-col gap-1 p-1 items-center justify-center">
               <div class="w-6 h-0.5 bg-gray-300"></div>
               <div class="w-6 h-0.5 bg-gray-300"></div>
               <div class="w-4 h-0.5 bg-gray-300 self-start ml-1"></div>
             </div>
             
             <!-- Scan Line -->
             <div class="absolute top-0 left-0 w-full h-0.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] opacity-0 group-hover:opacity-100 group-hover:animate-[scan_1.5s_ease-in-out_infinite]"></div>
             
             <!-- Success Check -->
             <div class="absolute right-4 top-1/2 -translate-y-1/2 scale-0 group-hover:scale-100 transition-transform delay-500 duration-300 bg-green-500 text-white rounded-full p-1 shadow-sm">
               <CheckCircle2 size={12} />
             </div>
          </div>

        </div>

        <!-- Card 4: Customer Analysis + Segmentation -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-amber-200 hover:shadow-amber-200 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 group-hover:from-amber-100 to-transparent rounded-bl-full -mr-8 -mt-8 transition-all duration-500 group-hover:scale-110"></div>
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-amber-100 group-hover:text-amber-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-amber-100 group-hover:scale-110 transition-all duration-300">
            <Users size={24} class="group-hover:scale-110 transition-transform duration-500" />
          </div>
          <h3 class="text-2xl font-bold mb-3 text-gray-900">Customer History</h3>
          <p class="text-gray-600 text-sm mb-6">See who buys what and when. Identify your best customers and decide whether to offer promotions.</p>
          
          <!-- Animated Visual: Customer Segmentation -->
          <div class="bg-blue-50/50 rounded-xl p-3 mb-6 border border-blue-100 group-hover:bg-amber-50 group-hover:border-amber-100 flex items-center justify-between transition-colors duration-300">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 shadow-sm">JP</div>
              <div class="flex flex-col">
                <span class="text-xs font-medium text-gray-600">John Perez</span>
                <span class="text-[10px] bg-white border border-gray-100 text-gray-500 px-1.5 rounded group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500 transition-all duration-500 shadow-sm">Regular</span>
              </div>
            </div>
            
            <!-- Action Button Appearing -->
            <button class="opacity-50 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500 bg-green-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1">
              <MessageCircle size={10} /> Send Promo
            </button>
          </div>

        </div>

        <!-- Card 5: Sales Forecast -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-pink-200 hover:shadow-pink-200 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 group-hover:from-pink-100 to-transparent rounded-bl-full -mr-8 -mt-8 transition-all duration-500 group-hover:scale-110"></div>
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-pink-100 group-hover:text-pink-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-pink-100 group-hover:scale-110 transition-all duration-300">
            <TrendingUp size={24} class="group-hover:scale-110 transition-transform duration-500" />
          </div>
          <h3 class="text-2xl font-bold mb-3 text-gray-900">Sales Trends</h3>
          <p class="text-gray-600 text-sm mb-6">Compare weeks, detect patterns, and anticipate demand with data from your own business.</p>
          
          <!-- Animated Visual: Forecast Chart -->
          <div class="bg-blue-50/50 rounded-xl p-3 mb-6 border border-blue-100 group-hover:bg-pink-50 group-hover:border-pink-100 relative h-[60px] flex items-end gap-1 overflow-hidden transition-colors duration-300">
             <!-- Bars -->
             <div class="w-1/5 bg-gray-200 group-hover:bg-pink-300 h-[40%] rounded-t-sm transition-colors duration-500"></div>
             <div class="w-1/5 bg-gray-200 group-hover:bg-pink-300 h-[60%] rounded-t-sm transition-colors duration-500 delay-75"></div>
             <div class="w-1/5 bg-gray-300 group-hover:bg-pink-400 h-[50%] rounded-t-sm transition-colors duration-500 delay-150"></div>
             <div class="w-1/5 bg-gray-400 group-hover:bg-pink-500 h-[75%] rounded-t-sm relative group/bar transition-colors duration-500 delay-200">
                <div class="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity">Today</div>
             </div>
             <!-- Forecast Bar (Animated) -->
             <div class="w-1/5 bg-[#1E88E6] group-hover:bg-pink-600 h-0 group-hover:h-[90%] transition-all duration-1000 ease-out rounded-t-sm relative border-t-2 border-dashed border-white/50 delay-300">
               <div class="absolute -top-8 right-0 bg-pink-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity delay-700 whitespace-nowrap">
                 +20% Tomorrow
               </div>
             </div>
          </div>

        </div>

        <!-- Card 6: Total Adaptation with AI -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-cyan-200 hover:shadow-cyan-200 transition-all duration-500 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-50 group-hover:from-cyan-100 to-transparent rounded-bl-full -mr-4 -mt-4 transition-all duration-700 group-hover:scale-150"></div>
          
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-cyan-100 group-hover:text-cyan-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-cyan-100 group-hover:scale-110 transition-all duration-300">
            <Wand2 size={24} />
          </div>
          
          <h3 class="text-2xl font-bold mb-3 text-gray-900">Custom Configuration</h3>
          <p class="text-gray-600 text-sm mb-6">The system adapts to your processes. AI suggests improvements based on how you work — you decide what to accept.</p>
          
          <!-- Animated Visual: Prompt to UI -->
          <div class="bg-blue-50/50 rounded-xl p-3 mb-6 border border-blue-100 group-hover:bg-cyan-50 group-hover:border-cyan-100 flex flex-col gap-2 transition-colors duration-300">
            <!-- Input Box -->
            <div class="bg-white border border-gray-200 group-hover:border-cyan-200 rounded px-2 py-1.5 text-[10px] text-gray-400 flex items-center gap-1 shadow-sm relative overflow-hidden transition-colors">
              <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
              <span class="w-1 h-1 rounded-full bg-[#1E88E6] group-hover:bg-cyan-400 transition-colors"></span>
              <span class="group-hover:hidden">Request your change...</span>
              <span class="hidden group-hover:inline-block text-gray-600 animate-[typing_2.5s_steps(30)_infinite]">Add 'Store Credit' button...</span>
            </div>
            
            <!-- Transformation Arrow -->
            <div class="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity delay-500 h-4">
               <ArrowRight size={12} class="text-cyan-500 rotate-90" />
            </div>
            
            <!-- Result UI Element -->
            <div class="bg-white border border-gray-200 rounded p-2 shadow-sm opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-1000 flex items-center justify-center gap-2">
              <div class="h-6 bg-indigo-500 text-white text-[10px] font-bold px-3 rounded flex items-center justify-center shadow-md w-full">
                 <span class="mr-1">📝</span> Store Credit
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  </section>

  <!-- Operational Robustness -->
  <section class="py-20 px-6 bg-[#BADBF7]/10 border-y border-[#8CC2F2]/30">
    <div class="max-w-5xl mx-auto">
      <h2 class="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-800">The reliability your business needs</h2>
      <p class="text-center text-gray-600 mb-12 max-w-2xl mx-auto">Designed to work in real Latin American conditions.</p>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <!-- Offline-first -->
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all text-center">
          <div class="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <WifiOff size={28} class="text-emerald-600" />
          </div>
          <h3 class="font-bold text-gray-800 mb-2">Works offline</h3>
          <p class="text-sm text-gray-600">Keep selling even when internet goes down. Syncs when it's back.</p>
        </div>

        <!-- Hardware compatible -->
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all text-center">
          <div class="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Printer size={28} class="text-blue-600" />
          </div>
          <h3 class="font-bold text-gray-800 mb-2">Hardware compatible</h3>
          <p class="text-sm text-gray-600">Fiscal printers, barcode scanners, cash drawers, and payment terminals.</p>
        </div>

        <!-- Secure data -->
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all text-center">
          <div class="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={28} class="text-purple-600" />
          </div>
          <h3 class="font-bold text-gray-800 mb-2">Secure data</h3>
          <p class="text-sm text-gray-600">Automatic backups. Full transaction audit trail. Your data protected.</p>
        </div>

        <!-- Tax compliance -->
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all text-center">
          <div class="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Receipt size={28} class="text-amber-600" />
          </div>
          <h3 class="font-bold text-gray-800 mb-2">Tax compliance</h3>
          <p class="text-sm text-gray-600">Compatible with regulations in DR, Mexico, Colombia, Peru, and Chile.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- The Real Magic -->
  <section class="py-24 px-6 bg-white overflow-hidden relative">
    <div class="max-w-4xl mx-auto relative z-10">
      <div class="text-center mb-12">
        <h2 class="text-3xl md:text-4xl font-bold mb-4 leading-tight text-gray-800">We configure your workflow for you</h2>
        <p class="text-gray-600 max-w-xl mx-auto">AI learns from your business and suggests improvements — you decide what to accept.</p>
      </div>

      <!-- Browser Container -->
      <div class="relative mx-auto max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-300 mb-12">
        <!-- Browser Chrome -->
        <div class="bg-gray-100 px-4 py-3 flex items-center gap-2 border-b border-gray-300">
          <div class="flex gap-1.5">
            <div class="w-3 h-3 rounded-full bg-red-500"></div>
            <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div class="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          <div class="flex-1 mx-4">
            <div class="bg-white rounded-md px-4 py-1.5 text-xs text-gray-700 text-center border border-gray-200 shadow-sm">
              cuadrapos.com
            </div>
          </div>
        </div>
        
        <!-- Browser Content -->
        <div class="p-6 md:p-10 bg-white min-h-[400px]">
          <!-- Prompt Box -->
          <div class="flex items-start gap-4 mb-8">
            <div class="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center shrink-0 shadow-md">
              <Zap size={24} class="text-gray-900" />
            </div>
            <div class="flex-1">
              <div class="bg-gray-50 border-2 border-gray-200 rounded-xl p-6 min-h-[120px] text-lg md:text-xl font-mono text-gray-800 relative shadow-sm">
                {promptText}<span class="animate-pulse text-amber-500">|</span>
              </div>
            </div>
          </div>

          <!-- Live Result Animation Placeholder -->
          {#if showResult}
            <div class="bg-white border-2 border-emerald-200 rounded-xl p-6 animate-in fade-in slide-in-from-top-4 duration-700 shadow-lg">
              <div class="flex items-center justify-between mb-4 border-b border-gray-200 pb-4">
                <span class="font-bold text-gray-800 uppercase text-xs tracking-wider">New screen created</span>
                <span class="text-emerald-600 flex items-center gap-2 text-sm font-bold"><CheckCircle2 size={16} /> Active</span>
              </div>
              <div class="grid grid-cols-3 gap-4">
                <div class="h-24 bg-gradient-to-br from-blue-100 to-blue-50 border-2 border-blue-300 rounded-lg flex flex-col items-center justify-center gap-2 text-blue-700 hover:scale-105 transition-all cursor-pointer shadow-sm">
                  <Scan size={24} class="text-blue-600" />
                  <span class="text-xs font-bold">Scan Entry</span>
                </div>
                <div class="h-24 bg-gradient-to-br from-emerald-100 to-emerald-50 border-2 border-emerald-300 rounded-lg flex flex-col items-center justify-center gap-2 text-emerald-700 hover:scale-105 transition-all cursor-pointer shadow-sm">
                  <BarChart3 size={24} class="text-emerald-600" />
                  <span class="text-xs font-bold">Inventory</span>
                </div>
                <div class="h-24 bg-gradient-to-br from-amber-100 to-amber-50 border-2 border-amber-300 rounded-lg flex flex-col items-center justify-center gap-2 text-amber-700 hover:scale-105 transition-all cursor-pointer shadow-sm">
                  <CreditCard size={24} class="text-amber-600" />
                  <span class="text-xs font-bold">Quick Pay</span>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <div class="text-center">
        <p class="text-2xl md:text-4xl font-bold text-gray-800 leading-tight">
          In seconds your system works exactly like YOU. <br />
          <span class="text-[#1E88E6]">You give the final OK.</span>
        </p>
      </div>
    </div>
  </section>

  <!-- Final CTA -->
  <section class="py-32 px-6 text-center bg-gradient-to-b from-white to-[#BADBF7]/20">
    <div class="max-w-3xl mx-auto">
      <h2 class="text-4xl md:text-6xl font-bold mb-6 text-[#1F2937]">Ready to simplify your business?</h2>
      <div class="flex flex-wrap justify-center gap-6 text-lg text-[#1F2937]/70 font-medium mb-12">
        <span>Migration included</span>
        <span class="text-[#8CC2F2]">•</span>
        <span>Personalized support</span>
        <span class="text-[#8CC2F2]">•</span>
        <span>Cancel anytime</span>
      </div>
      
      <div class="flex flex-col sm:flex-row justify-center gap-4 mb-6">
        <button 
          class="bg-[#1E88E6] hover:bg-[#1778CF] text-white text-xl px-12 py-5 rounded-full shadow-2xl shadow-[#1E88E6]/30 hover:shadow-[#1E88E6]/40 transition-all hover:scale-105 font-bold" 
          on:click={goToLogin}
        >
          Watch 2-minute demo
        </button>
        <button 
          class="bg-white hover:bg-gray-50 text-[#1E88E6] text-xl px-12 py-5 rounded-full shadow-lg border-2 border-[#1E88E6] transition-all hover:scale-105 font-bold" 
          on:click={goToLogin}
        >
          Request a guided demo
        </button>
      </div>
      <p class="text-gray-500">Starting at $29/month. Setup and training included.</p>
    </div>
  </section>


</div>

<style>
  @keyframes slideUp {
    0% { transform: translateY(20px); opacity: 0; }
    20% { transform: translateY(0); opacity: 1; }
    80% { transform: translateY(0); opacity: 1; }
    100% { transform: translateY(-20px); opacity: 0; }
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fadeIn {
    animation: fadeIn 0.5s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .animate-wiggle {
    animation: wiggle 1s ease-in-out infinite;
  }

  @keyframes wiggle {
    0%, 100% { transform: rotate(-5deg); }
    50% { transform: rotate(5deg); }
  }
</style>

