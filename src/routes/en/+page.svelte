<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { 
    Zap, ShoppingCart, BarChart3, Users, 
    MessageCircle, TrendingUp, ArrowRight, 
    CheckCircle2, Star, Shield, Globe,
    Package, CreditCard, Scan, Receipt,
    Sparkles, Wand2, Brain, Target, Bell
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
  <title>Cuadra - Million-dollar software. Everyday price.</title>
  <meta name="description" content="The only POS + ERP that transforms with a single phrase to work exactly how YOU work." />
</svelte:head>

<div class="min-h-screen bg-white text-[#1F2937] font-sans selection:bg-[#BADBF7] selection:text-[#0D4373]">
  
  <!-- Navbar -->
  <nav class="fixed top-0 w-full bg-white/90 backdrop-blur-md z-50 border-b border-[#BADBF7]/50">
    <div class="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <img src="/cuadra_logo.png" alt="Cuadra" class="h-8 w-auto" />
      </div>
      <div class="flex items-center gap-4">
        <button on:click={goToLogin} class="text-[#1F2937]/80 hover:text-[#1E88E6] font-medium transition-colors">Sign In</button>
        <button on:click={goToLogin} class="bg-[#1E88E6] text-white hover:bg-[#1778CF] rounded-full px-6 py-2 font-medium transition-colors">Free Trial</button>
        <a href="/" class="text-xs text-[#1F2937]/40 hover:text-[#1E88E6] transition-colors">ES</a>
      </div>
    </div>
  </nav>

  <!-- Hero -->
  <header class="pt-32 pb-20 px-6 bg-gradient-to-b from-[#BADBF7]/20 to-white">
    <div class="max-w-4xl mx-auto text-center">
      <!-- Headline -->
      <h1 class="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-[#1F2937] leading-[1.1]">
        Million-dollar software. <br />
        Everyday price.
      </h1>
      
      <!-- Subheadline -->
      <p class="text-xl md:text-2xl text-[#1E88E6] font-medium max-w-3xl mx-auto mb-10 leading-relaxed">
        The only POS + ERP that transforms with a single phrase to work exactly how YOU work — not how it suits the vendor.
      </p>
      
      <!-- Interactive Demo - 3 Step Transformation -->
      <div class="relative mx-auto max-w-3xl bg-[#0D4373] rounded-2xl shadow-2xl overflow-hidden border border-[#125EA1] mb-12">
        <!-- Browser Chrome -->
        <div class="bg-[#125EA1] px-4 py-3 flex items-center gap-2 border-b border-[#1778CF]">
          <div class="flex gap-1.5">
            <div class="w-3 h-3 rounded-full bg-red-400"></div>
            <div class="w-3 h-3 rounded-full bg-yellow-400"></div>
            <div class="w-3 h-3 rounded-full bg-green-400"></div>
          </div>
          <div class="flex-1 mx-4">
            <div class="bg-[#0D4373] rounded-md px-3 py-1 text-xs text-[#8CC2F2] text-center">
              app.cuadra.io
            </div>
          </div>
        </div>
        
        <!-- App Content -->
        <div class="p-6 min-h-[340px] relative">
          
          <!-- STEP 0: Traditional POS -->
          {#if heroStep === 0}
            <div class="animate-fadeIn">
              <!-- Header with "boring" label -->
              <div class="mb-4 flex items-center justify-between">
                <div>
                  <span class="text-[#8CC2F2]/60 text-xs uppercase tracking-wider">Other systems</span>
                  <h3 class="text-white font-bold text-lg">Traditional POS</h3>
                </div>
                <div class="bg-red-500/20 text-red-300 text-xs px-3 py-1 rounded-full border border-red-500/30">
                  Rigid & generic
                </div>
              </div>

              <!-- Traditional grid - looks cluttered and overwhelming -->
              <div class="grid grid-cols-3 gap-2 opacity-60">
                <div class="bg-white/5 border border-white/10 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                  <ShoppingCart size={18} class="text-white/50" />
                  <span class="text-white/50 text-xs">Sales</span>
                </div>
                <div class="bg-white/5 border border-white/10 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                  <Users size={18} class="text-white/50" />
                  <span class="text-white/50 text-xs">Customers</span>
                </div>
                <div class="bg-white/5 border border-white/10 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                  <Receipt size={18} class="text-white/50" />
                  <span class="text-white/50 text-xs">Invoices</span>
                </div>
                <div class="bg-white/5 border border-white/10 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                  <Package size={18} class="text-white/50" />
                  <span class="text-white/50 text-xs">Inventory</span>
                </div>
                <div class="bg-white/5 border border-white/10 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                  <BarChart3 size={18} class="text-white/50" />
                  <span class="text-white/50 text-xs">Reports</span>
                </div>
                <div class="bg-white/5 border border-white/10 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                  <CreditCard size={18} class="text-white/50" />
                  <span class="text-white/50 text-xs">Payments</span>
                </div>
              </div>

              <!-- Frustration message -->
              <div class="mt-6 text-center">
                <p class="text-white/40 text-sm italic">"This doesn't work the way I work..."</p>
              </div>
            </div>
          {/if}

          <!-- STEP 1: Magic Transformation Button -->
          {#if heroStep === 1}
            <div class="animate-fadeIn flex flex-col items-center justify-center h-full min-h-[280px]">
              <!-- Glowing magic button -->
              <div class="relative">
                <div class="absolute inset-0 bg-[#1E88E6] rounded-2xl blur-xl opacity-50 animate-pulse"></div>
                <button class="relative bg-gradient-to-br from-[#1E88E6] to-[#1778CF] text-white px-8 py-6 rounded-2xl shadow-2xl flex items-center gap-4 transform hover:scale-105 transition-all border border-[#5EAAED]/30">
                  <div class="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                    <Wand2 size={28} class="animate-wiggle" />
                  </div>
                  <div class="text-left">
                    <span class="text-lg font-bold block">Customize with AI</span>
                    <span class="text-sm text-white/70">Tell it how you want it to work</span>
                  </div>
                  <Sparkles size={24} class="text-yellow-300 animate-pulse" />
                </button>
              </div>

              <!-- Typing indicator -->
              <div class="mt-8 bg-white/10 rounded-full px-6 py-3 flex items-center gap-3">
                <div class="flex gap-1">
                  <div class="w-2 h-2 bg-[#5EAAED] rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                  <div class="w-2 h-2 bg-[#5EAAED] rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                  <div class="w-2 h-2 bg-[#5EAAED] rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                </div>
                <span class="text-white/70 text-sm">Transforming your system...</span>
              </div>
            </div>
          {/if}

          <!-- STEP 2: AI-Powered POS -->
          {#if heroStep === 2}
            <div class="animate-fadeIn">
              <!-- Header with success -->
              <div class="mb-4 flex items-center justify-between">
                <div>
                  <span class="text-[#5EAAED] text-xs uppercase tracking-wider flex items-center gap-1">
                    <Sparkles size={12} /> Cuadra with AI
                  </span>
                  <h3 class="text-white font-bold text-lg">Your Custom System</h3>
                </div>
                <div class="bg-green-500/20 text-green-300 text-xs px-3 py-1 rounded-full border border-green-500/30 flex items-center gap-1">
                  <CheckCircle2 size={12} /> Ready
                </div>
              </div>

              <!-- AI-powered modules - vibrant and organized -->
              <div class="grid grid-cols-3 gap-3">
                <div class="bg-gradient-to-br from-[#1E88E6]/30 to-[#1E88E6]/10 border border-[#1E88E6]/50 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-all cursor-pointer">
                  <div class="w-10 h-10 bg-[#1E88E6] rounded-lg flex items-center justify-center">
                    <Brain size={20} class="text-white" />
                  </div>
                  <span class="text-white text-xs font-medium">AI Pricing</span>
                  <span class="text-[#5EAAED] text-[10px]">Auto-adjust</span>
                </div>
                <div class="bg-gradient-to-br from-[#5EAAED]/30 to-[#5EAAED]/10 border border-[#5EAAED]/50 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-all cursor-pointer">
                  <div class="w-10 h-10 bg-[#5EAAED] rounded-lg flex items-center justify-center">
                    <Target size={20} class="text-white" />
                  </div>
                  <span class="text-white text-xs font-medium">Prediction</span>
                  <span class="text-[#5EAAED] text-[10px]">Optimal stock</span>
                </div>
                <div class="bg-gradient-to-br from-[#8CC2F2]/30 to-[#8CC2F2]/10 border border-[#8CC2F2]/50 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-all cursor-pointer">
                  <div class="w-10 h-10 bg-[#8CC2F2] rounded-lg flex items-center justify-center">
                    <Bell size={20} class="text-[#0D4373]" />
                  </div>
                  <span class="text-white text-xs font-medium">Alerts</span>
                  <span class="text-[#5EAAED] text-[10px]">Proactive</span>
                </div>
              </div>

              <!-- Quick actions row -->
              <div class="mt-4 flex gap-2">
                <button class="flex-1 bg-white text-[#0D4373] rounded-xl py-4 font-bold flex items-center justify-center gap-2 hover:bg-[#BADBF7] transition-all">
                  <Scan size={20} />
                  Checkout
                </button>
                <button class="flex-1 bg-[#1E88E6] text-white rounded-xl py-4 font-bold flex items-center justify-center gap-2 hover:bg-[#1778CF] transition-all">
                  <CreditCard size={20} />
                  Pay
                </button>
              </div>

              <!-- Success message -->
              <div class="mt-4 text-center">
                <p class="text-[#5EAAED] text-sm font-medium">✨ Now it works exactly the way YOU work</p>
              </div>
            </div>
          {/if}

          <!-- Progress indicator -->
          <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            <div class="w-2 h-2 rounded-full transition-all duration-300 {heroStep === 0 ? 'bg-white w-6' : 'bg-white/30'}"></div>
            <div class="w-2 h-2 rounded-full transition-all duration-300 {heroStep === 1 ? 'bg-[#1E88E6] w-6' : 'bg-white/30'}"></div>
            <div class="w-2 h-2 rounded-full transition-all duration-300 {heroStep === 2 ? 'bg-green-400 w-6' : 'bg-white/30'}"></div>
          </div>
        </div>
      </div>

      <!-- CTA Button -->
      <div class="flex justify-center">
        <button 
          class="bg-[#1E88E6] hover:bg-[#1778CF] text-white text-xl px-10 py-5 rounded-full shadow-xl shadow-[#1E88E6]/25 transition-all hover:scale-105 font-bold" 
          on:click={goToLogin}
        >
          I want my free version (closed beta)
        </button>
      </div>
    </div>
  </header>

  <!-- Origin Story -->
  <section class="py-20 px-6 bg-[#BADBF7]/10 border-y border-[#8CC2F2]/30">
    <div class="max-w-3xl mx-auto text-center">
      <p class="text-xl md:text-2xl leading-relaxed text-[#1F2937]/80 font-medium">
        "Born because no system truly understood how grocery stores, pharmacies, hardware stores, and boutiques operate in Latin America. Today, dozens of owners aren't looking back."
      </p>
    </div>
  </section>

  <!-- 6 AI Superpowers -->
  <section class="py-24 px-6 bg-white">
    <div class="max-w-6xl mx-auto">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Card 1 -->
        <div class="bg-white rounded-3xl border border-[#8CC2F2]/40 p-8 hover:shadow-lg hover:shadow-[#1E88E6]/10 transition-all group hover:-translate-y-1">
          <div class="w-12 h-12 bg-[#BADBF7] text-[#0D4373] rounded-2xl flex items-center justify-center mb-6">
            <TrendingUp size={24} />
          </div>
          <h3 class="text-2xl font-bold mb-3 text-[#1F2937]">Dynamic pricing</h3>
          <p class="text-[#1F2937]/70 text-sm mb-6">Automatically adjust prices based on demand, competition, and target margins.</p>
          <div class="text-sm font-bold text-[#1E88E6] uppercase tracking-wider flex items-center gap-2 pt-4 border-t border-[#8CC2F2]/30">
            <Zap size={14} /> Premium Module
          </div>
        </div>

        <!-- Card 2 -->
        <div class="bg-white rounded-3xl border border-[#8CC2F2]/40 p-8 hover:shadow-lg hover:shadow-[#1E88E6]/10 transition-all group hover:-translate-y-1">
          <div class="w-12 h-12 bg-[#8CC2F2] text-[#0D4373] rounded-2xl flex items-center justify-center mb-6">
            <ShoppingCart size={24} />
          </div>
          <h3 class="text-2xl font-bold mb-3 text-[#1F2937]">Predictive purchasing</h3>
          <p class="text-[#1F2937]/70 text-sm mb-6">Predict which products you need before they run out with AI.</p>
          <div class="text-sm font-bold text-[#1E88E6] uppercase tracking-wider flex items-center gap-2 pt-4 border-t border-[#8CC2F2]/30">
            <Zap size={14} /> Premium Module
          </div>
        </div>

        <!-- Card 3 -->
        <div class="bg-white rounded-3xl border border-[#8CC2F2]/40 p-8 hover:shadow-lg hover:shadow-[#1E88E6]/10 transition-all group hover:-translate-y-1">
          <div class="w-12 h-12 bg-[#5EAAED] text-white rounded-2xl flex items-center justify-center mb-6">
            <BarChart3 size={24} />
          </div>
          <h3 class="text-2xl font-bold mb-3 text-[#1F2937]">Automatic clearance</h3>
          <p class="text-[#1F2937]/70 text-sm mb-6">Detect slow-moving products and generate smart discounts to move them.</p>
          <div class="text-sm font-bold text-[#1E88E6] uppercase tracking-wider flex items-center gap-2 pt-4 border-t border-[#8CC2F2]/30">
            <Zap size={14} /> Premium Module
          </div>
        </div>

        <!-- Card 4 -->
        <div class="bg-white rounded-3xl border border-[#8CC2F2]/40 p-8 hover:shadow-lg hover:shadow-[#1E88E6]/10 transition-all group hover:-translate-y-1">
          <div class="w-12 h-12 bg-[#1778CF] text-white rounded-2xl flex items-center justify-center mb-6">
            <Users size={24} />
          </div>
          <h3 class="text-2xl font-bold mb-3 text-[#1F2937]">Smart loyalty</h3>
          <p class="text-[#1F2937]/70 text-sm mb-6">Points and rewards program that learns from each customer.</p>
          <div class="text-sm font-bold text-[#1E88E6] uppercase tracking-wider flex items-center gap-2 pt-4 border-t border-[#8CC2F2]/30">
            <Zap size={14} /> Premium Module
          </div>
        </div>

        <!-- Card 5 -->
        <div class="bg-white rounded-3xl border border-[#8CC2F2]/40 p-8 hover:shadow-lg hover:shadow-[#1E88E6]/10 transition-all group hover:-translate-y-1">
          <div class="w-12 h-12 bg-[#125EA1] text-white rounded-2xl flex items-center justify-center mb-6">
            <Star size={24} />
          </div>
          <h3 class="text-2xl font-bold mb-3 text-[#1F2937]">Promotions that sell</h3>
          <p class="text-[#1F2937]/70 text-sm mb-6">Create combos and offers based on real purchase patterns.</p>
          <div class="text-sm font-bold text-[#1E88E6] uppercase tracking-wider flex items-center gap-2 pt-4 border-t border-[#8CC2F2]/30">
            <Zap size={14} /> Premium Module
          </div>
        </div>

        <!-- Card 6 -->
        <div class="bg-white rounded-3xl border border-[#8CC2F2]/40 p-8 hover:shadow-lg hover:shadow-[#1E88E6]/10 transition-all group hover:-translate-y-1">
          <div class="w-12 h-12 bg-[#0D4373] text-white rounded-2xl flex items-center justify-center mb-6">
            <Shield size={24} />
          </div>
          <h3 class="text-2xl font-bold mb-3 text-[#1F2937]">Supplier scoring</h3>
          <p class="text-[#1F2937]/70 text-sm mb-6">Evaluate and compare suppliers by price, quality, and fulfillment.</p>
          <div class="text-sm font-bold text-[#1E88E6] uppercase tracking-wider flex items-center gap-2 pt-4 border-t border-[#8CC2F2]/30">
            <Zap size={14} /> Premium Module
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- The Real Magic -->
  <section class="py-24 px-6 bg-[#0D4373] text-white overflow-hidden relative">
    <div class="absolute inset-0 bg-[url('/grid.svg')] opacity-5"></div>
    <div class="max-w-4xl mx-auto relative z-10">
      <div class="text-center mb-12">
        <h2 class="text-3xl md:text-4xl font-bold mb-4 leading-tight">Your way of working doesn't fit in any system… until today.</h2>
      </div>

      <div class="bg-[#125EA1] backdrop-blur border border-[#1778CF] rounded-2xl p-6 md:p-10 shadow-2xl mb-12">
        <!-- Prompt Box -->
        <div class="flex items-start gap-4 mb-8">
          <div class="w-12 h-12 rounded-full bg-[#1E88E6] flex items-center justify-center shrink-0">
            <Zap size={24} class="text-white" />
          </div>
          <div class="flex-1">
            <div class="bg-white border border-[#8CC2F2] rounded-xl p-6 min-h-[100px] text-lg md:text-xl font-mono text-[#1F2937] relative shadow-lg">
              {promptText}<span class="animate-pulse text-[#1E88E6]">|</span>
            </div>
          </div>
        </div>

        <!-- Live Result Animation Placeholder -->
        {#if showResult}
          <div class="bg-white border border-[#8CC2F2] rounded-xl p-6 animate-in fade-in slide-in-from-top-4 duration-700 shadow-lg">
            <div class="flex items-center justify-between mb-4 border-b border-[#BADBF7] pb-4">
              <span class="font-bold text-[#1F2937] uppercase text-xs tracking-wider">New screen created</span>
              <span class="text-green-600 flex items-center gap-2 text-sm font-bold"><CheckCircle2 size={16} /> Active</span>
            </div>
            <div class="grid grid-cols-3 gap-4">
              <div class="h-24 bg-[#BADBF7]/30 rounded-lg flex flex-col items-center justify-center gap-2 border border-[#8CC2F2] text-[#0D4373]">
                <ShoppingCart size={24} />
                <span class="text-xs font-medium">Scan Entry</span>
              </div>
              <div class="h-24 bg-[#BADBF7]/30 rounded-lg flex flex-col items-center justify-center gap-2 border border-[#8CC2F2] text-[#0D4373]">
                <BarChart3 size={24} />
                <span class="text-xs font-medium">Inventory</span>
              </div>
              <div class="h-24 bg-[#BADBF7]/30 rounded-lg flex flex-col items-center justify-center gap-2 border border-[#8CC2F2] text-[#0D4373]">
                <Zap size={24} />
                <span class="text-xs font-medium">Quick Pay</span>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <div class="text-center">
        <p class="text-2xl md:text-4xl font-bold text-white leading-tight">
          In seconds your system works exactly like YOU. <br />
          <span class="text-[#5EAAED]">You give the final OK.</span>
        </p>
      </div>
    </div>
  </section>

  <!-- Final CTA -->
  <section class="py-32 px-6 text-center bg-gradient-to-b from-white to-[#BADBF7]/20">
    <div class="max-w-3xl mx-auto">
      <h2 class="text-4xl md:text-6xl font-bold mb-6 text-[#1F2937]">Closed beta — last spots available</h2>
      <div class="flex flex-wrap justify-center gap-6 text-lg text-[#1F2937]/70 font-medium mb-12">
        <span>Free migration</span>
        <span class="text-[#8CC2F2]">•</span>
        <span>Cancel anytime</span>
        <span class="text-[#8CC2F2]">•</span>
        <span>Talk directly to the founder</span>
      </div>
      
      <div class="flex justify-center">
        <button 
          class="bg-[#1E88E6] hover:bg-[#1778CF] text-white text-xl px-12 py-5 rounded-full shadow-2xl shadow-[#1E88E6]/30 hover:shadow-[#1E88E6]/40 transition-all hover:scale-105 font-bold" 
          on:click={goToLogin}
        >
          I want my free version (closed beta)
        </button>
      </div>
    </div>
  </section>

  <!-- Floating WhatsApp -->
  <a 
    href="https://wa.me/1234567890" 
    target="_blank" 
    rel="noopener noreferrer"
    class="fixed bottom-8 right-8 bg-[#25D366] hover:bg-[#20BA5C] text-white px-6 py-4 rounded-full shadow-xl flex items-center gap-3 font-bold text-lg transition-all hover:scale-105 hover:-translate-y-1 z-50"
  >
    <MessageCircle size={24} />
    Chat now
  </a>

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
