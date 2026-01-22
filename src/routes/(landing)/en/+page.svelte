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
    Wifi, WifiOff, Printer, Server, Lock,
    ChevronDown, ChevronUp, Store, Coffee, Wrench, Shirt, UtensilsCrossed, Pill, Briefcase,
    Monitor, FileText, PieChart, Bot, Check, X, ShieldCheck, Clock, Headphones, RefreshCw
  } from 'lucide-svelte';

  // State for FAQ accordion
  let openFaqIndex: number | null = null;
  
  // State for industry tabs
  let activeIndustry = 'retail';
  
  // State for catalog sequence animation
  let catalogStep = 0; // 0 = full view, 1 = zoom to button, 2 = show result
  let catalogTimeout: ReturnType<typeof setTimeout>;
  
  function runCatalogAnimation() {
    catalogStep = 0;
    
    // Show full view for 2s
    catalogTimeout = setTimeout(() => {
      catalogStep = 1; // Zoom to button
      
      // After 2s, show result
      catalogTimeout = setTimeout(() => {
        catalogStep = 2; // Show AI result
        
        // Loop back after 4s
        catalogTimeout = setTimeout(() => {
          runCatalogAnimation();
        }, 4000);
      }, 2000);
    }, 2500);
  }
  
  // State for pricing sequence animation
  let pricingStep = 0; // 0 = full view, 1 = zoom to button, 2 = show result
  let pricingTimeout: ReturnType<typeof setTimeout>;
  
  function runPricingAnimation() {
    pricingStep = 0;
    
    // Show full view for 2.5s
    pricingTimeout = setTimeout(() => {
      pricingStep = 1; // Zoom to Start Analysis button
      
      // After 2s, show result
      pricingTimeout = setTimeout(() => {
        pricingStep = 2; // Show AI analysis result
        
        // Loop back after 4s
        pricingTimeout = setTimeout(() => {
          runPricingAnimation();
        }, 4000);
      }, 2000);
    }, 2500);
  }
  
  // State for insights sequence animation
  let insightsStep = 0; // 0 = segments, 1 = patterns, 2 = predictions
  let insightsTimeout: ReturnType<typeof setTimeout>;
  
  function runInsightsAnimation() {
    insightsStep = 0;
    
    // Show segments for 3s
    insightsTimeout = setTimeout(() => {
      insightsStep = 1; // Patterns
      
      // After 3s, show predictions
      insightsTimeout = setTimeout(() => {
        insightsStep = 2; // Predictions
        
        // Loop back after 3s
        insightsTimeout = setTimeout(() => {
          runInsightsAnimation();
        }, 3500);
      }, 3000);
    }, 3000);
  }
  
  // State for capture sequence animation
  let captureStep = 0; // 0 = upload options, 1 = processing, 2 = validation result
  let captureTimeout: ReturnType<typeof setTimeout>;
  
  function runCaptureAnimation() {
    captureStep = 0;
    
    // Show upload options for 2.5s
    captureTimeout = setTimeout(() => {
      captureStep = 1; // Processing
      
      // After 2s, show validation result
      captureTimeout = setTimeout(() => {
        captureStep = 2; // Validation
        
        // Loop back after 4s
        captureTimeout = setTimeout(() => {
          runCaptureAnimation();
        }, 4000);
      }, 2000);
    }, 2500);
  }
  
  function toggleFaq(index: number) {
    openFaqIndex = openFaqIndex === index ? null : index;
  }
  
  const industries = [
    { id: 'retail', name: 'Retail & Mini-markets', icon: Store, description: 'Full inventory control, dynamic pricing, automatic promotions, supplier management.' },
    { id: 'bakery', name: 'Bakeries & Cafes', icon: Coffee, description: 'Recipes, ingredient control, perishable products, time-based discounts.' },
    { id: 'hardware', name: 'Hardware & Auto Parts', icon: Wrench, description: 'Complex inventory, SKU-based products, multiple suppliers, serial number tracking.' },
    { id: 'clothing', name: 'Clothing Stores', icon: Shirt, description: 'Sizes, colors, seasons, consignments, smart returns.' },
    { id: 'restaurant', name: 'Restaurants & Delivery', icon: UtensilsCrossed, description: 'Tables, orders, kitchen, integrated delivery, waste control.' },
    { id: 'pharmacy', name: 'Pharmacies', icon: Pill, description: 'Batches, expiration dates, controlled substances, medical prescriptions.' },
    { id: 'services', name: 'Professional Services', icon: Briefcase, description: 'Project billing, time tracking, expenses, multiple services.' }
  ];
  
  const faqs = [
    { question: 'What makes Cuadra different from other systems?', answer: 'Integrated artificial intelligence. Other systems only record what happened. Cuadra predicts what will happen and tells you what to do about it.' },
    { question: 'Is it difficult to use?', answer: 'On the contrary. You can configure complex rules simply by talking to the system. If you know how to explain what you need, Cuadra understands it.' },
    { question: 'Does it work without internet?', answer: 'Yes, completely. You can sell all day without connection and when the internet comes back, everything syncs automatically.' },
    { question: 'Is it tax compliant?', answer: '100%. Electronic invoices, all tax reports, automatically. Compatible with multiple jurisdictions.' },
    { question: 'Can I try it before paying?', answer: 'Yes, 14 days free, no credit card required. If you are not convinced, you pay nothing.' },
    { question: 'What happens to my data if I cancel?', answer: 'It is yours. You can export everything at any time. No data hostage.' },
    { question: 'Do I need to buy special hardware?', answer: 'No. It works on any PC, laptop, tablet or phone. If you already have a thermal printer, it connects. If not, you can use any regular printer.' }
  ];
  
  const comparisonFeatures = [
    { feature: 'Custom configuration', traditional: 'Support ticket, days of waiting', cuadra: 'Talk to the system, 30 seconds', cuadraWins: true },
    { feature: 'Artificial intelligence', traditional: 'Not included', cuadra: '6 AI modules included', cuadraWins: true },
    { feature: 'Needs prediction', traditional: 'Only historical reports', cuadra: 'Active prediction', cuadraWins: true },
    { feature: 'Document recognition', traditional: 'All manual', cuadra: 'AI reads invoices automatically', cuadraWins: true },
    { feature: 'Works offline', traditional: 'Depends on internet', cuadra: 'Complete offline operation', cuadraWins: true },
    { feature: 'Tax compliance', traditional: 'Requires configuration', cuadra: 'Automatic from day 1', cuadraWins: true },
    { feature: 'Business adaptation', traditional: 'Rigid or expensive customization', cuadra: 'Unlimited configuration included', cuadraWins: true },
    { feature: 'Price', traditional: '$25-50/month + extras', cuadra: '$35-45/month all included', cuadraWins: true }
  ];

  let promptText = "";
  let isAnimating = false;
  let showResult = false;
  
  // Vibe Coding animation state
  let vibeCodingText = "";
  let vibeCodingStep = 0; // 0 = idle, 1 = typing, 2 = processing, 3 = done
  let vibeCodingTimeout: ReturnType<typeof setTimeout>;
  
  const vibeCodingPrompt = "Give me 15% off on bakery products after 6pm";
  
  function runVibeCodingAnimation() {
    vibeCodingText = "";
    vibeCodingStep = 0;
    
    // Start typing after 1s
    vibeCodingTimeout = setTimeout(() => {
      vibeCodingStep = 1;
      let i = 0;
      const typeInterval = setInterval(() => {
        vibeCodingText += vibeCodingPrompt.charAt(i);
        i++;
        if (i >= vibeCodingPrompt.length) {
          clearInterval(typeInterval);
          // Show processing after typing
          setTimeout(() => {
            vibeCodingStep = 2;
            // Show result after processing
            setTimeout(() => {
              vibeCodingStep = 3;
              // Loop after showing result
              setTimeout(() => {
                runVibeCodingAnimation();
              }, 4000);
            }, 1500);
          }, 800);
        }
      }, 50);
    }, 1000);
  }

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
    const text = "I don't send orders to suppliers, the truck arrives and I buy on the spot. Create the whole flow: scan entry, update inventory, and pay in cash or transfer.";
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
    
    // Start vibe coding animation
    runVibeCodingAnimation();
    
    // Start catalog animation
    runCatalogAnimation();
    
    // Start pricing animation (with offset to not sync with catalog)
    setTimeout(() => runPricingAnimation(), 1500);
    
    // Start insights animation (with offset)
    setTimeout(() => runInsightsAnimation(), 3000);
    
    // Start capture animation (with offset)
    setTimeout(() => runCaptureAnimation(), 4500);

    return () => {
      clearTimeout(timer);
      clearTimeout(heroTimeout);
      clearTimeout(vibeCodingTimeout);
      clearTimeout(catalogTimeout);
      clearTimeout(pricingTimeout);
      clearTimeout(insightsTimeout);
      clearTimeout(captureTimeout);
    };
  });

  function goToLogin() {
    goto('/login');
  }
  
  // Trial form state
  let trialForm = {
    name: '',
    email: '',
    phone: '',
    businessName: '',
    businessType: ''
  };
  let isSubmitting = false;
  let formSubmitted = false;
  let formError = '';
  
  function scrollToTrialForm() {
    const element = document.getElementById('trial-form');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }
  
  async function submitTrialForm() {
    // Validate
    if (!trialForm.name || !trialForm.email || !trialForm.businessName) {
      formError = 'Please fill in the required fields';
      return;
    }
    
    isSubmitting = true;
    formError = '';
    
    try {
      // Here you would send to your backend/CRM
      // For now, simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Success
      formSubmitted = true;
      
      // Optional: redirect to login after delay
      setTimeout(() => {
        goto('/login');
      }, 3000);
    } catch (err) {
      formError = 'There was an error. Please try again.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Cuadra - Invoicing, Inventory & POS Software with AI</title>
  <meta name="description" content="Software that adapts to your business, not the other way around. Invoicing, inventory, and point of sale with artificial intelligence included." />
</svelte:head>

<div class="min-h-screen bg-white text-[#1F2937] font-sans selection:bg-[#BADBF7] selection:text-[#0D4373]">
  
  <!-- Navbar -->
  <nav class="fixed top-0 w-full bg-white/90 backdrop-blur-md z-50 border-b border-[#BADBF7]/50">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <img src="/cuadra_logo.png" alt="Cuadra" class="h-7 sm:h-8 w-auto" />
      </div>
      <!-- Navigation Links -->
      <div class="hidden md:flex items-center gap-6">
        <a href="#features" class="text-[#1F2937]/70 hover:text-[#1E88E6] font-medium transition-colors text-sm">Features</a>
        <a href="#industries" class="text-[#1F2937]/70 hover:text-[#1E88E6] font-medium transition-colors text-sm">Industries</a>
        <a href="#pricing" class="text-[#1F2937]/70 hover:text-[#1E88E6] font-medium transition-colors text-sm">Pricing</a>
        <a href="#faq" class="text-[#1F2937]/70 hover:text-[#1E88E6] font-medium transition-colors text-sm">FAQ</a>
      </div>
      <div class="flex items-center gap-2 sm:gap-4">
        <button on:click={goToLogin} class="hidden sm:block text-[#1F2937]/80 hover:text-[#1E88E6] font-medium transition-colors">Sign In</button>
        <button on:click={scrollToTrialForm} class="bg-[#1E88E6] text-white hover:bg-[#1778CF] rounded-full px-4 sm:px-6 py-1.5 sm:py-2 text-sm sm:text-base font-medium transition-colors">Free 14-day trial</button>
        <a href="/" class="text-xs text-[#1F2937]/40 hover:text-[#1E88E6] transition-colors ml-1">ES</a>
      </div>
    </div>
  </nav>

  <!-- Hero -->
  <header class="pt-32 pb-20 px-6 bg-gradient-to-b from-[#BADBF7]/20 to-white">
    <div class="max-w-4xl mx-auto text-center">
      <!-- Headline -->
      <h1 class="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-[#1F2937] leading-[1.1]">
        Software that adapts to your business, <span class="text-[#1E88E6]">not the other way around</span>
      </h1>
      
      <!-- Subheadline -->
      <p class="text-xl md:text-2xl text-[#1F2937]/70 font-medium max-w-3xl mx-auto mb-6 leading-relaxed">
        Invoicing, inventory and point of sale with <span class="text-[#1E88E6] font-bold">artificial intelligence included</span>.
      </p>

      <!-- Trust Badges -->
      <div class="flex flex-wrap justify-center gap-4 mb-10">
        <div class="flex items-center gap-2 bg-[#BADBF7]/30 px-4 py-2 rounded-full text-sm font-medium text-[#0D4373]">
          <Wand2 size={16} />
          <span>Natural language configuration</span>
        </div>
        <div class="flex items-center gap-2 bg-[#BADBF7]/30 px-4 py-2 rounded-full text-sm font-medium text-[#0D4373]">
          <Brain size={16} />
          <span>Automatic demand prediction</span>
        </div>
        <div class="flex items-center gap-2 bg-[#BADBF7]/30 px-4 py-2 rounded-full text-sm font-medium text-[#0D4373]">
          <ShieldCheck size={16} />
          <span>100% tax compliant</span>
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
                <p class="text-emerald-600 text-sm font-bold">Now it works exactly the way YOU work</p>
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
          on:click={scrollToTrialForm}
        >
          Free 14-day trial
        </button>
        <button 
          class="bg-white hover:bg-gray-50 text-[#1E88E6] text-xl px-10 py-5 rounded-full shadow-lg border-2 border-[#1E88E6] transition-all hover:scale-105 font-bold" 
          on:click={scrollToTrialForm}
        >
          Watch live demo
        </button>
      </div>
      <p class="text-center text-gray-500 text-sm mt-6">No credit card required. Cancel anytime.</p>
    </div>
  </header>

  <!-- Vibe Coding Section -->
  <section id="vibe-coding" class="py-24 px-6 bg-gradient-to-b from-white via-purple-50/30 to-white overflow-hidden">
    <div class="max-w-5xl mx-auto">
      <div class="text-center mb-16">
        <span class="inline-flex items-center gap-2 bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 px-5 py-2.5 rounded-full text-sm font-bold mb-6 shadow-sm">
          <Sparkles size={18} class="animate-pulse" /> Cuadra Exclusive
        </span>
        <h2 class="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
          <span class="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Natural Language</span> Configuration
        </h2>
        <p class="text-xl text-gray-600 max-w-2xl mx-auto">Forget technical manuals and support calls. Simply tell it what you need.</p>
      </div>
      
      <!-- Interactive Demo -->
      <div class="relative max-w-4xl mx-auto mb-16">
        <!-- Glow effect behind -->
        <div class="absolute inset-0 bg-gradient-to-r from-purple-400/20 via-indigo-400/20 to-cyan-400/20 blur-3xl -z-10 scale-110"></div>
        
        <!-- Browser Window -->
        <div class="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
          <!-- Browser Chrome -->
          <div class="bg-gray-100 px-4 py-3 flex items-center gap-3 border-b border-gray-200">
            <div class="flex gap-1.5">
              <div class="w-3 h-3 rounded-full bg-red-400"></div>
              <div class="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div class="w-3 h-3 rounded-full bg-green-400"></div>
            </div>
            <div class="flex-1 mx-4">
              <div class="bg-white rounded-lg px-4 py-1.5 text-sm text-gray-500 text-center border border-gray-200 max-w-xs mx-auto">
                cuadra.app/configure
              </div>
            </div>
          </div>
          
          <!-- Demo Content -->
          <div class="p-8 md:p-12 min-h-[400px] bg-gradient-to-br from-gray-50 to-white">
            <!-- Input Area -->
            <div class="mb-8">
              <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Wand2 size={20} class="text-white" />
                </div>
                <span class="font-bold text-gray-700">Configuration Assistant</span>
                <span class="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">AI Active</span>
              </div>
              
              <!-- Typing Animation Container -->
              <div class="relative">
                <div class="bg-white border-2 border-purple-200 rounded-xl p-5 shadow-sm min-h-[80px] flex items-center">
                  <p class="text-lg text-gray-800 font-medium">
                    {vibeCodingText}<span class="inline-block w-0.5 h-6 bg-purple-500 ml-1 animate-pulse"></span>
                  </p>
                </div>
                {#if vibeCodingStep >= 1}
                  <div class="absolute -right-2 -bottom-2 bg-purple-500 text-white rounded-full p-2 shadow-lg animate-bounce">
                    <ArrowRight size={16} />
                  </div>
                {/if}
              </div>
            </div>
            
            <!-- Result Area -->
            {#if vibeCodingStep >= 2}
              <div class="animate-slideUp">
                <!-- Processing indicator -->
                {#if vibeCodingStep === 2}
                  <div class="flex items-center justify-center gap-3 py-8">
                    <div class="flex gap-1">
                      <div class="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                      <div class="w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                      <div class="w-3 h-3 bg-cyan-500 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                    </div>
                    <span class="text-purple-600 font-medium">Configuring automatically...</span>
                  </div>
                {/if}
                
                <!-- Success Result -->
                {#if vibeCodingStep >= 3}
                  <div class="bg-gradient-to-r from-emerald-50 to-cyan-50 border-2 border-emerald-200 rounded-xl p-6 shadow-lg animate-scaleIn">
                    <div class="flex items-center justify-between mb-4">
                      <div class="flex items-center gap-2">
                        <div class="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center">
                          <CheckCircle2 size={18} class="text-white" />
                        </div>
                        <span class="font-bold text-emerald-800">Configuration Created!</span>
                      </div>
                      <span class="text-xs text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full font-medium">Active now</span>
                    </div>
                    
                    <!-- Generated Config Preview -->
                    <div class="bg-white rounded-lg p-4 border border-emerald-100">
                      <div class="grid grid-cols-2 gap-4 text-sm">
                        <div class="flex items-center gap-2">
                          <div class="w-2 h-2 bg-purple-500 rounded-full"></div>
                          <span class="text-gray-600">Category:</span>
                          <span class="font-medium text-gray-800">Bakery</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <div class="w-2 h-2 bg-indigo-500 rounded-full"></div>
                          <span class="text-gray-600">Discount:</span>
                          <span class="font-medium text-gray-800">15%</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <div class="w-2 h-2 bg-cyan-500 rounded-full"></div>
                          <span class="text-gray-600">Schedule:</span>
                          <span class="font-medium text-gray-800">6:00 PM - Close</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <div class="w-2 h-2 bg-emerald-500 rounded-full"></div>
                          <span class="text-gray-600">Status:</span>
                          <span class="font-medium text-emerald-600">Active</span>
                        </div>
                      </div>
                    </div>
                    
                    <p class="text-center text-emerald-700 mt-4 font-medium">
                      ✨ Done in <span class="font-bold">3 seconds</span>. No code. No waiting.
                    </p>
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>
      </div>
      
      <!-- Other Examples -->
      <div class="text-center mb-8">
        <p class="text-gray-500 mb-4">Other things you can configure:</p>
      </div>
      <div class="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
        <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-200 transition-all cursor-pointer group">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <Bell size={16} class="text-amber-600" />
            </div>
            <p class="text-sm text-gray-700">"Alert me when less than 10 units left"</p>
          </div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-200 transition-all cursor-pointer group">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShoppingCart size={16} class="text-emerald-600" />
            </div>
            <p class="text-sm text-gray-700">"Buy-2-get-1-free on drinks on weekends"</p>
          </div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-200 transition-all cursor-pointer group">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users size={16} class="text-blue-600" />
            </div>
            <p class="text-sm text-gray-700">"Max $500 credit for new customers"</p>
          </div>
        </div>
      </div>
      
      <div class="text-center mt-12">
        <p class="text-2xl font-bold text-gray-800 mb-2">No programmers. No waiting. No extra costs.</p>
        <p class="text-purple-600 font-medium">We call it <span class="font-bold">Vibe Coding</span> — AI configuration that understands your business.</p>
      </div>
    </div>
  </section>

  <!-- 6 AI Superpowers -->
  <section id="features" class="py-24 px-6 bg-white">
    <div class="max-w-6xl mx-auto">
      <div class="text-center mb-12">
        <span class="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm font-bold mb-4">
          <Brain size={16} /> Artificial Intelligence
        </span>
        <h2 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">AI That Works for You</h2>
        <p class="text-xl text-gray-600 max-w-2xl mx-auto"><strong>Other systems show you reports from the past.</strong> Cuadra predicts your future.</p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Card 1: Smart Stock Prediction -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-emerald-200 hover:shadow-emerald-200 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 group-hover:from-emerald-100 to-transparent rounded-bl-full -mr-8 -mt-8 transition-all duration-500 group-hover:scale-110"></div>
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-emerald-100 group-hover:text-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-emerald-100 group-hover:scale-110 transition-all duration-300">
            <Package size={24} class="group-hover:rotate-12 transition-transform duration-500" />
          </div>
          <h3 class="text-xl font-bold mb-3 text-gray-900">Smart Stock Prediction</h3>
          <p class="text-gray-600 text-sm mb-6">AI analyzes your sales patterns and tells you exactly how much to buy, when to buy it, and detects trends before you see them.</p>
          
          <!-- Animated Visual -->
          <div class="bg-blue-50/50 rounded-xl p-3 mb-2 border border-blue-100 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-colors duration-300">
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs font-medium text-gray-600">Whole Milk</span>
              <span class="text-xs font-bold text-amber-500 bg-amber-100 px-2 py-0.5 rounded-full group-hover:text-emerald-600 group-hover:bg-emerald-200 transition-colors duration-500">
                <span class="group-hover:hidden">Order 24 units</span>
                <span class="hidden group-hover:inline">Order Ready</span>
              </span>
            </div>
            <div class="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div class="h-full bg-amber-400 w-[25%] rounded-full group-hover:w-[85%] group-hover:bg-emerald-500 transition-all duration-1000 ease-out"></div>
            </div>
          </div>
        </div>

        <!-- Card 2: Price Recommendations -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-purple-200 hover:shadow-purple-200 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 group-hover:from-purple-100 to-transparent rounded-bl-full -mr-8 -mt-8 transition-all duration-500 group-hover:scale-110"></div>
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-purple-100 group-hover:text-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-purple-100 group-hover:scale-110 transition-all duration-300">
            <TrendingUp size={24} class="group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform duration-500" />
          </div>
          <h3 class="text-xl font-bold mb-3 text-gray-900">Price Recommendations</h3>
          <p class="text-gray-600 text-sm mb-6">New product? AI analyzes your market, margins and competition to recommend the price that maximizes your profit.</p>
          
          <!-- Animated Visual -->
          <div class="bg-blue-50/50 rounded-xl p-3 mb-2 border border-blue-100 group-hover:bg-purple-50 group-hover:border-purple-100 flex items-center justify-between transition-colors duration-300">
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

        <!-- Card 3: Predictive Trend Analysis -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-pink-200 hover:shadow-pink-200 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 group-hover:from-pink-100 to-transparent rounded-bl-full -mr-8 -mt-8 transition-all duration-500 group-hover:scale-110"></div>
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-pink-100 group-hover:text-pink-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-pink-100 group-hover:scale-110 transition-all duration-300">
            <BarChart3 size={24} class="group-hover:scale-110 transition-transform duration-500" />
          </div>
          <h3 class="text-xl font-bold mb-3 text-gray-900">Predictive Trend Analysis</h3>
          <p class="text-gray-600 text-sm mb-6">Discover hidden patterns: "Sales of X rise 35% when it rains" or "Tuesdays you sell 60% more of category Y".</p>
          
          <!-- Animated Visual -->
          <div class="bg-blue-50/50 rounded-xl p-3 mb-2 border border-blue-100 group-hover:bg-pink-50 group-hover:border-pink-100 relative h-[60px] flex items-end gap-1 overflow-hidden transition-colors duration-300">
             <div class="w-1/5 bg-gray-200 group-hover:bg-pink-300 h-[40%] rounded-t-sm transition-colors duration-500"></div>
             <div class="w-1/5 bg-gray-200 group-hover:bg-pink-300 h-[60%] rounded-t-sm transition-colors duration-500 delay-75"></div>
             <div class="w-1/5 bg-gray-300 group-hover:bg-pink-400 h-[50%] rounded-t-sm transition-colors duration-500 delay-150"></div>
             <div class="w-1/5 bg-gray-400 group-hover:bg-pink-500 h-[75%] rounded-t-sm relative transition-colors duration-500 delay-200"></div>
             <div class="w-1/5 bg-[#1E88E6] group-hover:bg-pink-600 h-0 group-hover:h-[90%] transition-all duration-1000 ease-out rounded-t-sm relative border-t-2 border-dashed border-white/50 delay-300">
               <div class="absolute -top-8 right-0 bg-pink-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity delay-700 whitespace-nowrap">
                 +35% Forecast
               </div>
             </div>
          </div>
        </div>

        <!-- Card 4: Document Recognition -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-rose-200 hover:shadow-rose-200 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 group-hover:from-rose-100 to-transparent rounded-bl-full -mr-8 -mt-8 transition-all duration-500 group-hover:scale-110"></div>
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-rose-100 group-hover:text-rose-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-rose-100 group-hover:scale-110 transition-all duration-300">
            <Scan size={24} class="group-hover:scale-110 transition-transform duration-500" />
          </div>
          <h3 class="text-xl font-bold mb-3 text-gray-900">Document Recognition</h3>
          <p class="text-gray-600 text-sm mb-6">Take a photo of supplier invoices and Cuadra registers them automatically. AI-powered OCR that understands any document format.</p>
          
          <!-- Animated Visual -->
          <div class="relative bg-blue-50/50 rounded-xl p-3 mb-2 border border-blue-100 group-hover:bg-rose-50 group-hover:border-rose-100 overflow-hidden transition-colors duration-300 h-[60px] flex items-center justify-center">
             <div class="w-10 h-12 bg-white border border-gray-200 shadow-sm flex flex-col gap-1 p-1 items-center justify-center">
               <div class="w-6 h-0.5 bg-gray-300"></div>
               <div class="w-6 h-0.5 bg-gray-300"></div>
               <div class="w-4 h-0.5 bg-gray-300 self-start ml-1"></div>
             </div>
             <div class="absolute top-0 left-0 w-full h-0.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] opacity-0 group-hover:opacity-100 group-hover:animate-[scan_1.5s_ease-in-out_infinite]"></div>
             <div class="absolute right-4 top-1/2 -translate-y-1/2 scale-0 group-hover:scale-100 transition-transform delay-500 duration-300 bg-green-500 text-white rounded-full p-1 shadow-sm">
               <CheckCircle2 size={12} />
             </div>
          </div>
        </div>

        <!-- Card 5: Smart Customer Profiles -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-amber-200 hover:shadow-amber-200 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 group-hover:from-amber-100 to-transparent rounded-bl-full -mr-8 -mt-8 transition-all duration-500 group-hover:scale-110"></div>
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-amber-100 group-hover:text-amber-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-amber-100 group-hover:scale-110 transition-all duration-300">
            <Users size={24} class="group-hover:scale-110 transition-transform duration-500" />
          </div>
          <h3 class="text-xl font-bold mb-3 text-gray-900">Smart Customer Profiles</h3>
          <p class="text-gray-600 text-sm mb-6">Automatic history: what they buy, frequency, preferences, credit. AI suggests what to offer them to increase sales.</p>
          
          <!-- Animated Visual -->
          <div class="bg-blue-50/50 rounded-xl p-3 mb-2 border border-blue-100 group-hover:bg-amber-50 group-hover:border-amber-100 flex items-center justify-between transition-colors duration-300">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 shadow-sm">JP</div>
              <div class="flex flex-col">
                <span class="text-xs font-medium text-gray-600">John Perez</span>
                <span class="text-[10px] bg-white border border-gray-100 text-gray-500 px-1.5 rounded group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500 transition-all duration-500 shadow-sm">VIP</span>
              </div>
            </div>
            <button class="opacity-50 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500 bg-green-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1">
              <MessageCircle size={10} /> Offer
            </button>
          </div>
        </div>

        <!-- Card 6: Unlimited Customization -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-cyan-200 hover:shadow-cyan-200 transition-all duration-500 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-50 group-hover:from-cyan-100 to-transparent rounded-bl-full -mr-4 -mt-4 transition-all duration-700 group-hover:scale-150"></div>
          
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-cyan-100 group-hover:text-cyan-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-cyan-100 group-hover:scale-110 transition-all duration-300">
            <Wand2 size={24} />
          </div>
          
          <h3 class="text-xl font-bold mb-3 text-gray-900">Unlimited Customization</h3>
          <p class="text-gray-600 text-sm mb-6">Any business rule you can imagine, Cuadra can configure. Talk to the system like you'd talk to your accountant.</p>
          
          <!-- Animated Visual -->
          <div class="bg-blue-50/50 rounded-xl p-3 mb-2 border border-blue-100 group-hover:bg-cyan-50 group-hover:border-cyan-100 flex flex-col gap-2 transition-colors duration-300">
            <div class="bg-white border border-gray-200 group-hover:border-cyan-200 rounded px-2 py-1.5 text-[10px] text-gray-400 flex items-center gap-1 shadow-sm relative overflow-hidden transition-colors">
              <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
              <span class="w-1 h-1 rounded-full bg-[#1E88E6] group-hover:bg-cyan-400 transition-colors"></span>
              <span class="group-hover:hidden">Write your rule...</span>
              <span class="hidden group-hover:inline-block text-gray-600">10% discount if...</span>
            </div>
            <div class="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity delay-500 h-4">
               <ArrowRight size={12} class="text-cyan-500 rotate-90" />
            </div>
            <div class="bg-white border border-gray-200 rounded p-2 shadow-sm opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-1000 flex items-center justify-center">
              <div class="h-5 bg-emerald-500 text-white text-[10px] font-bold px-3 rounded flex items-center justify-center shadow-md">
                 <CheckCircle2 size={10} class="mr-1" /> Rule Active
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Screenshots Section -->
  <section class="py-20 px-6 bg-gray-50">
    <div class="max-w-6xl mx-auto">
      <div class="text-center mb-12">
        <h2 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">See Cuadra in Action</h2>
        <p class="text-xl text-gray-600 max-w-2xl mx-auto">A clean and fast interface, designed for your daily business operations.</p>
      </div>
      
      <!-- Feature Showcase: AI Shopping List -->
      <div class="mb-16">
        <div class="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200 p-6 md:p-8">
          <!-- Feature Header -->
          <div class="flex items-center gap-3 mb-6">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Brain class="text-white" size={24} />
            </div>
            <div>
              <h3 class="text-xl font-bold text-gray-800">Smart Shopping List</h3>
              <p class="text-sm text-gray-500">AI analyzes your inventory and generates purchase orders automatically</p>
            </div>
          </div>
          
          <!-- Step Indicators -->
          <div class="flex items-center justify-center gap-2 mb-6">
            <button 
              class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all {catalogStep === 0 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(catalogTimeout); catalogStep = 0; }}
            >
              <span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
              View Alerts
            </button>
            <ArrowRight size={16} class="text-gray-300" />
            <button 
              class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all {catalogStep === 1 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(catalogTimeout); catalogStep = 1; }}
            >
              <span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
              Generate List
            </button>
            <ArrowRight size={16} class="text-gray-300" />
            <button 
              class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all {catalogStep === 2 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(catalogTimeout); catalogStep = 2; }}
            >
              <span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">3</span>
              AI Suggests
            </button>
          </div>
          
          <!-- Screenshot Container with Animation -->
          <div class="relative rounded-2xl overflow-hidden bg-gray-900 shadow-inner">
            <!-- Browser Chrome -->
            <div class="bg-gray-800 px-4 py-3 flex items-center gap-2">
              <div class="flex gap-1.5">
                <div class="w-3 h-3 rounded-full bg-red-500"></div>
                <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div class="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div class="flex-1 mx-4">
                <div class="bg-gray-700 rounded-md px-3 py-1 text-gray-400 text-sm">app.cuadra.io/catalog</div>
              </div>
            </div>
            
            <!-- Screenshot with zoom effect -->
            <div class="relative aspect-[16/10] overflow-hidden">
              <!-- Step 0 & 1: Catalog view -->
              <div 
                class="absolute inset-0 transition-all duration-1000 ease-out"
                style="opacity: {catalogStep <= 1 ? 1 : 0}; transform: scale({catalogStep === 1 ? 2 : 1}) translate({catalogStep === 1 ? '-25%' : '0'}, {catalogStep === 1 ? '-15%' : '0'});"
              >
                <img 
                  src="/screenshots/localhost_5173_catalog.png" 
                  alt="Inventory Alerts" 
                  class="w-full h-full object-cover object-top"
                />
              </div>
              
              <!-- Step 1: Highlight button overlay -->
              {#if catalogStep === 1}
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none animate-fadeIn">
                  <div class="relative">
                    <div class="absolute inset-0 bg-blue-500 rounded-lg animate-ping opacity-30"></div>
                    <div class="bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-xl border-2 border-blue-500 flex items-center gap-2">
                      <Sparkles class="text-blue-500" size={18} />
                      <span class="font-semibold text-gray-800">Click: Generate List</span>
                    </div>
                  </div>
                </div>
              {/if}
              
              <!-- Step 2: AI Result view -->
              <div 
                class="absolute inset-0 transition-all duration-700 ease-out"
                style="opacity: {catalogStep === 2 ? 1 : 0}; transform: translateX({catalogStep === 2 ? '0' : '100%'});"
              >
                <img 
                  src="/screenshots/localhost_5173_catalog (1).png" 
                  alt="Smart Shopping List" 
                  class="w-full h-full object-cover object-top"
                />
              </div>
            </div>
          </div>
          
          <!-- Feature description based on step -->
          <div class="mt-6 text-center">
            {#if catalogStep === 0}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Step 1:</strong> The system detects products with low stock and displays smart alerts with reorder suggestions.
              </p>
            {:else if catalogStep === 1}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Step 2:</strong> With one click on "Generate List", AI analyzes sales patterns, seasons, and trends.
              </p>
            {:else}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Step 3:</strong> Get an executive summary with optimal quantities, estimated costs, and purchase priorities.
              </p>
            {/if}
          </div>
        </div>
      </div>
      
      <!-- Feature Showcase: AI Price Analysis -->
      <div class="mb-16">
        <div class="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200 p-6 md:p-8">
          <!-- Feature Header -->
          <div class="flex items-center gap-3 mb-6">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <TrendingUp class="text-white" size={24} />
            </div>
            <div>
              <h3 class="text-xl font-bold text-gray-800">AI Price Analysis</h3>
              <p class="text-sm text-gray-500">AI analyzes costs, margins and market to recommend the optimal price</p>
            </div>
          </div>
          
          <!-- Step Indicators -->
          <div class="flex items-center justify-center gap-2 mb-6">
            <button 
              class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all {pricingStep === 0 ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(pricingTimeout); pricingStep = 0; }}
            >
              <span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
              View Product
            </button>
            <ArrowRight size={16} class="text-gray-300" />
            <button 
              class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all {pricingStep === 1 ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(pricingTimeout); pricingStep = 1; }}
            >
              <span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
              Start Analysis
            </button>
            <ArrowRight size={16} class="text-gray-300" />
            <button 
              class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all {pricingStep === 2 ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(pricingTimeout); pricingStep = 2; }}
            >
              <span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">3</span>
              AI Recommendation
            </button>
          </div>
          
          <!-- Screenshot Container with Animation -->
          <div class="relative rounded-2xl overflow-hidden bg-gray-900 shadow-inner">
            <!-- Browser Chrome -->
            <div class="bg-gray-800 px-4 py-3 flex items-center gap-2">
              <div class="flex gap-1.5">
                <div class="w-3 h-3 rounded-full bg-red-500"></div>
                <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div class="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div class="flex-1 mx-4">
                <div class="bg-gray-700 rounded-md px-3 py-1 text-gray-400 text-sm">app.cuadra.io/pricing</div>
              </div>
            </div>
            
            <!-- Screenshot with zoom effect -->
            <div class="relative aspect-[16/10] overflow-hidden">
              <!-- Step 0 & 1: Pricing view before analysis -->
              <div 
                class="absolute inset-0 transition-all duration-1000 ease-out"
                style="opacity: {pricingStep <= 1 ? 1 : 0}; transform: scale({pricingStep === 1 ? 1.6 : 1}) translate({pricingStep === 1 ? '-20%' : '0'}, {pricingStep === 1 ? '5%' : '0'});"
              >
                <img 
                  src="/screenshots/cuadrapos.com_pricing(Comp).png" 
                  alt="Price Analysis" 
                  class="w-full h-full object-cover object-top"
                />
              </div>
              
              <!-- Step 1: Highlight button overlay -->
              {#if pricingStep === 1}
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none animate-fadeIn">
                  <div class="relative">
                    <div class="absolute inset-0 bg-emerald-500 rounded-lg animate-ping opacity-30"></div>
                    <div class="bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-xl border-2 border-emerald-500 flex items-center gap-2">
                      <Sparkles class="text-emerald-500" size={18} />
                      <span class="font-semibold text-gray-800">Click: Start Analysis</span>
                    </div>
                  </div>
                </div>
              {/if}
              
              <!-- Step 2: AI Result view -->
              <div 
                class="absolute inset-0 transition-all duration-700 ease-out"
                style="opacity: {pricingStep === 2 ? 1 : 0}; transform: translateX({pricingStep === 2 ? '0' : '100%'});"
              >
                <img 
                  src="/screenshots/localhost_5173_pricing.png" 
                  alt="AI Price Recommendation" 
                  class="w-full h-full object-cover object-top"
                />
              </div>
            </div>
          </div>
          
          <!-- Feature description based on step -->
          <div class="mt-6 text-center">
            {#if pricingStep === 0}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Step 1:</strong> Select a product to view costs, historical prices and supply chain.
              </p>
            {:else if pricingStep === 1}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Step 2:</strong> Click "Start Analysis" for AI to evaluate margins, volume and price elasticity.
              </p>
            {:else}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Step 3:</strong> Get suggested price ($145.00), rating (RAISE PRICE), detailed explanation and "Out of the Box" ideas.
              </p>
            {/if}
          </div>
        </div>
      </div>
      
      <!-- Feature Showcase: AI Insights -->
      <div class="mb-16">
        <div class="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200 p-6 md:p-8">
          <!-- Feature Header -->
          <div class="flex items-center gap-3 mb-6">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <PieChart class="text-white" size={24} />
            </div>
            <div>
              <h3 class="text-xl font-bold text-gray-800">Smart Insights</h3>
              <p class="text-sm text-gray-500">AI analyzes sales patterns, segments customers and predicts trends</p>
            </div>
          </div>
          
          <!-- Step Indicators -->
          <div class="flex items-center justify-center gap-2 mb-6">
            <button 
              class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all {insightsStep === 0 ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(insightsTimeout); insightsStep = 0; }}
            >
              <span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
              Segments
            </button>
            <ArrowRight size={16} class="text-gray-300" />
            <button 
              class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all {insightsStep === 1 ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(insightsTimeout); insightsStep = 1; }}
            >
              <span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
              Patterns
            </button>
            <ArrowRight size={16} class="text-gray-300" />
            <button 
              class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all {insightsStep === 2 ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(insightsTimeout); insightsStep = 2; }}
            >
              <span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">3</span>
              Predictions
            </button>
          </div>
          
          <!-- Screenshot Container with Animation -->
          <div class="relative rounded-2xl overflow-hidden bg-gray-900 shadow-inner">
            <!-- Browser Chrome -->
            <div class="bg-gray-800 px-4 py-3 flex items-center gap-2">
              <div class="flex gap-1.5">
                <div class="w-3 h-3 rounded-full bg-red-500"></div>
                <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div class="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div class="flex-1 mx-4">
                <div class="bg-gray-700 rounded-md px-3 py-1 text-gray-400 text-sm">app.cuadra.io/insights</div>
              </div>
            </div>
            
            <!-- Screenshot carousel -->
            <div class="relative aspect-[16/10] overflow-hidden">
              <!-- Step 0: Segments -->
              <div 
                class="absolute inset-0 transition-all duration-700 ease-out"
                style="opacity: {insightsStep === 0 ? 1 : 0}; transform: translateX({insightsStep === 0 ? '0' : insightsStep > 0 ? '-100%' : '100%'});"
              >
                <img 
                  src="/screenshots/cuadrapos.com_insights(Comp) (2).png" 
                  alt="Customer Segments" 
                  class="w-full h-full object-cover object-top"
                />
              </div>
              
              <!-- Step 1: Patterns -->
              <div 
                class="absolute inset-0 transition-all duration-700 ease-out"
                style="opacity: {insightsStep === 1 ? 1 : 0}; transform: translateX({insightsStep === 1 ? '0' : insightsStep > 1 ? '-100%' : '100%'});"
              >
                <img 
                  src="/screenshots/cuadrapos.com_insights(Comp) (1).png" 
                  alt="Sales Patterns" 
                  class="w-full h-full object-cover object-top"
                />
              </div>
              
              <!-- Step 2: Predictions -->
              <div 
                class="absolute inset-0 transition-all duration-700 ease-out"
                style="opacity: {insightsStep === 2 ? 1 : 0}; transform: translateX({insightsStep === 2 ? '0' : '100%'});"
              >
                <img 
                  src="/screenshots/cuadrapos.com_insights(Comp).png" 
                  alt="Weekly Predictions" 
                  class="w-full h-full object-cover object-top"
                />
              </div>
            </div>
          </div>
          
          <!-- Feature description based on step -->
          <div class="mt-6 text-center">
            {#if insightsStep === 0}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Segments:</strong> Customers automatically grouped by time of day, basket value and product preferences.
              </p>
            {:else if insightsStep === 1}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Patterns:</strong> Seasonal multipliers, category distribution and traffic heatmap by hour.
              </p>
            {:else}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Predictions:</strong> Weekly forecast with expected revenue, transactions and peak hours per day.
              </p>
            {/if}
          </div>
        </div>
      </div>
      
      <!-- Feature Showcase: Invoice Capture -->
      <div class="mb-16">
        <div class="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-200 p-6 md:p-8">
          <!-- Feature Header -->
          <div class="flex items-center gap-3 mb-6">
            <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center">
              <Scan class="text-white" size={24} />
            </div>
            <div>
              <h3 class="text-xl font-bold text-gray-800">Smart Invoice Capture</h3>
              <p class="text-sm text-gray-500">Photograph invoices and AI extracts all data automatically</p>
            </div>
          </div>
          
          <!-- Step Indicators -->
          <div class="flex items-center justify-center gap-2 mb-6">
            <button 
              class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all {captureStep === 0 ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(captureTimeout); captureStep = 0; }}
            >
              <span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
              Capture
            </button>
            <ArrowRight size={16} class="text-gray-300" />
            <button 
              class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all {captureStep === 1 ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(captureTimeout); captureStep = 1; }}
            >
              <span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
              AI Processes
            </button>
            <ArrowRight size={16} class="text-gray-300" />
            <button 
              class="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all {captureStep === 2 ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(captureTimeout); captureStep = 2; }}
            >
              <span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">3</span>
              Validate
            </button>
          </div>
          
          <!-- Screenshot Container with Animation -->
          <div class="relative rounded-2xl overflow-hidden bg-gray-900 shadow-inner">
            <!-- Browser Chrome -->
            <div class="bg-gray-800 px-4 py-3 flex items-center gap-2">
              <div class="flex gap-1.5">
                <div class="w-3 h-3 rounded-full bg-red-500"></div>
                <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
                <div class="w-3 h-3 rounded-full bg-green-500"></div>
              </div>
              <div class="flex-1 mx-4">
                <div class="bg-gray-700 rounded-md px-3 py-1 text-gray-400 text-sm">app.cuadra.io/capture</div>
              </div>
            </div>
            
            <!-- Screenshot carousel -->
            <div class="relative aspect-[16/10] overflow-hidden">
              <!-- Step 0: Upload options -->
              <div 
                class="absolute inset-0 transition-all duration-700 ease-out"
                style="opacity: {captureStep === 0 ? 1 : 0}; transform: translateX({captureStep === 0 ? '0' : captureStep > 0 ? '-100%' : '100%'});"
              >
                <img 
                  src="/screenshots/cuadrapos.com_capture(Comp) (1).png" 
                  alt="Capture Options" 
                  class="w-full h-full object-cover object-top"
                />
              </div>
              
              <!-- Step 1: Processing -->
              <div 
                class="absolute inset-0 transition-all duration-700 ease-out"
                style="opacity: {captureStep === 1 ? 1 : 0}; transform: translateX({captureStep === 1 ? '0' : captureStep > 1 ? '-100%' : '100%'});"
              >
                <img 
                  src="/screenshots/cuadrapos.com_capture(Comp).png" 
                  alt="AI Processing" 
                  class="w-full h-full object-cover object-top"
                />
              </div>
              
              <!-- Step 2: Validation -->
              <div 
                class="absolute inset-0 transition-all duration-700 ease-out"
                style="opacity: {captureStep === 2 ? 1 : 0}; transform: translateX({captureStep === 2 ? '0' : '100%'});"
              >
                <img 
                  src="/screenshots/cuadrapos.com_validation(Comp).png" 
                  alt="Invoice Validation" 
                  class="w-full h-full object-cover object-top"
                />
              </div>
            </div>
          </div>
          
          <!-- Feature description based on step -->
          <div class="mt-6 text-center">
            {#if captureStep === 0}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Step 1:</strong> Take a photo of the invoice or upload an image from your gallery.
              </p>
            {:else if captureStep === 1}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Step 2:</strong> AI analyzes the document, extracts supplier, products, quantities and prices.
              </p>
            {:else}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Step 3:</strong> Review extracted data, adjust if needed and update your inventory with one click.
              </p>
            {/if}
          </div>
        </div>
      </div>
      
      <!-- And Much More CTA -->
      <div class="text-center py-12 px-6 bg-gradient-to-br from-gray-50 to-white rounded-3xl border border-gray-200">
        <div class="flex justify-center gap-3 mb-6">
          <div class="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
          <div class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" style="animation-delay: 0.2s"></div>
          <div class="w-3 h-3 rounded-full bg-purple-500 animate-pulse" style="animation-delay: 0.4s"></div>
          <div class="w-3 h-3 rounded-full bg-rose-500 animate-pulse" style="animation-delay: 0.6s"></div>
        </div>
        <h3 class="text-2xl md:text-3xl font-bold text-gray-800 mb-3">And much more to discover...</h3>
        <p class="text-gray-600 max-w-xl mx-auto mb-6">
          Point of sale, employee management, tax reports, multiple locations, integrations and hundreds of features that adapt to your business.
        </p>
        <a 
          href="#pricing" 
          class="inline-flex items-center gap-2 bg-gradient-to-r from-[#1E88E6] to-[#1565C0] text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all"
        >
          Start your free trial
          <ArrowRight size={20} />
        </a>
      </div>
    </div>
  </section>

  <!-- Industries Section -->
  <section id="industries" class="py-20 px-6 bg-white">
    <div class="max-w-5xl mx-auto">
      <div class="text-center mb-12">
        <h2 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">For All Business Types</h2>
        <p class="text-xl text-gray-600 max-w-2xl mx-auto">Is your business different? That's exactly why we created Cuadra. Tell us what you need and the system adapts.</p>
      </div>
      
      <!-- Industry Tabs -->
      <div class="flex flex-wrap justify-center gap-2 mb-8">
        {#each industries as industry}
          <button 
            class="px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2
                   {activeIndustry === industry.id 
                     ? 'bg-[#1E88E6] text-white shadow-lg' 
                     : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}"
            on:click={() => activeIndustry = industry.id}
          >
            <svelte:component this={industry.icon} size={16} />
            <span class="hidden sm:inline">{industry.name}</span>
          </button>
        {/each}
      </div>
      
      <!-- Industry Content -->
      {#each industries as industry}
        {#if activeIndustry === industry.id}
          <div class="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 animate-fadeIn">
            <div class="flex items-start gap-6">
              <div class="w-16 h-16 bg-[#BADBF7]/50 rounded-2xl flex items-center justify-center shrink-0">
                <svelte:component this={industry.icon} size={32} class="text-[#1E88E6]" />
              </div>
              <div>
                <h3 class="text-2xl font-bold text-gray-800 mb-3">{industry.name}</h3>
                <p class="text-gray-600 text-lg">{industry.description}</p>
              </div>
            </div>
          </div>
        {/if}
      {/each}
    </div>
  </section>

  <!-- Comparison Table -->
  <section class="py-20 px-6 bg-white">
    <div class="max-w-5xl mx-auto">
      <div class="text-center mb-12">
        <h2 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Honest Comparison</h2>
        <p class="text-xl text-gray-600">Pay a little more. Get 10x more intelligence.</p>
      </div>
      
      <div class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr>
              <th class="text-left p-4 bg-gray-50 rounded-tl-xl font-bold text-gray-700">Feature</th>
              <th class="text-center p-4 bg-gray-50 font-bold text-gray-500">Traditional Systems</th>
              <th class="text-center p-4 bg-[#1E88E6] rounded-tr-xl font-bold text-white">Cuadra</th>
            </tr>
          </thead>
          <tbody>
            {#each comparisonFeatures as row, i}
              <tr class="border-b border-gray-100 {i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}">
                <td class="p-4 font-medium text-gray-800">{row.feature}</td>
                <td class="p-4 text-center text-gray-500">
                  <div class="flex items-center justify-center gap-2">
                    <X size={16} class="text-red-400" />
                    <span class="text-sm">{row.traditional}</span>
                  </div>
                </td>
                <td class="p-4 text-center bg-[#BADBF7]/20">
                  <div class="flex items-center justify-center gap-2">
                    <Check size={16} class="text-emerald-500" />
                    <span class="text-sm font-medium text-gray-800">{row.cuadra}</span>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <!-- Made for Local Reality -->
  <section class="py-20 px-6 bg-[#BADBF7]/10 border-y border-[#8CC2F2]/30">
    <div class="max-w-5xl mx-auto">
      <div class="text-center mb-12">
        <h2 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Built for Real Business Conditions</h2>
        <p class="text-xl text-gray-600">Other systems come from abroad and charge you for "local adaptations". Cuadra was born here.</p>
      </div>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 size={20} class="text-emerald-600" />
            </div>
            <h3 class="font-bold text-gray-800">Automatic Tax Compliance</h3>
          </div>
          <p class="text-sm text-gray-600">Electronic invoices, tax reports, all automatic.</p>
        </div>

        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <WifiOff size={20} class="text-blue-600" />
            </div>
            <h3 class="font-bold text-gray-800">Works Offline</h3>
          </div>
          <p class="text-sm text-gray-600">Sell even when connection drops. Everything syncs when it's back.</p>
        </div>

        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <RefreshCw size={20} class="text-purple-600" />
            </div>
            <h3 class="font-bold text-gray-800">Smart Sync</h3>
          </div>
          <p class="text-sm text-gray-600">When internet returns, everything updates automatically.</p>
        </div>

        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Store size={20} class="text-amber-600" />
            </div>
            <h3 class="font-bold text-gray-800">Multiple Locations</h3>
          </div>
          <p class="text-sm text-gray-600">Branches, warehouses, mobile sellers, all connected.</p>
        </div>

        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
              <Headphones size={20} class="text-rose-600" />
            </div>
            <h3 class="font-bold text-gray-800">Local Support</h3>
          </div>
          <p class="text-sm text-gray-600">Support that understands your local business reality.</p>
        </div>

        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
              <Monitor size={20} class="text-cyan-600" />
            </div>
            <h3 class="font-bold text-gray-800">Any Device</h3>
          </div>
          <p class="text-sm text-gray-600">PC, tablet, phone, all synchronized.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Pricing Section -->
  <section id="pricing" class="py-24 px-6 bg-white">
    <div class="max-w-6xl mx-auto">
      <div class="text-center mb-12">
        <h2 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Simple & Transparent Pricing</h2>
        <p class="text-xl text-gray-600">No surprises. No contracts. Cancel anytime.</p>
      </div>
      
      <div class="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        <!-- Basic Plan -->
        <div class="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm hover:shadow-lg transition-all">
          <div class="text-center mb-6">
            <h3 class="text-xl font-bold text-gray-800 mb-2">Basic Plan</h3>
            <p class="text-gray-500 text-sm">Perfect to get started</p>
            <div class="mt-4">
              <span class="text-4xl font-bold text-gray-900">$35</span>
              <span class="text-gray-500">/month</span>
            </div>
          </div>
          <ul class="space-y-3 mb-8">
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>1 point of sale</span>
            </li>
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>POS + Inventory + Invoicing</span>
            </li>
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>Basic AI: stock prediction</span>
            </li>
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>Up to 1,000 products</span>
            </li>
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>Essential reports</span>
            </li>
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>Email support</span>
            </li>
          </ul>
          <button 
            class="w-full py-3 rounded-full border-2 border-[#1E88E6] text-[#1E88E6] font-bold hover:bg-[#1E88E6] hover:text-white transition-all"
            on:click={scrollToTrialForm}
          >
            Start free
          </button>
        </div>
        
        <!-- Pro Plan (Highlighted) -->
        <div class="bg-[#1E88E6] rounded-2xl p-8 shadow-xl relative transform md:-translate-y-4">
          <div class="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-gray-900 px-4 py-1 rounded-full text-sm font-bold">
            Most Popular
          </div>
          <div class="text-center mb-6">
            <h3 class="text-xl font-bold text-white mb-2">Pro Plan</h3>
            <p class="text-white/70 text-sm">For growing businesses</p>
            <div class="mt-4">
              <span class="text-4xl font-bold text-white">$45</span>
              <span class="text-white/70">/month</span>
            </div>
          </div>
          <ul class="space-y-3 mb-8">
            <li class="flex items-center gap-2 text-white text-sm">
              <Check size={16} class="text-amber-400 shrink-0" />
              <span>Up to 3 points of sale</span>
            </li>
            <li class="flex items-center gap-2 text-white text-sm">
              <Check size={16} class="text-amber-400 shrink-0" />
              <span>Everything in Basic +</span>
            </li>
            <li class="flex items-center gap-2 text-white text-sm">
              <Check size={16} class="text-amber-400 shrink-0" />
              <span><strong>Full AI: 6 modules activated</strong></span>
            </li>
            <li class="flex items-center gap-2 text-white text-sm">
              <Check size={16} class="text-amber-400 shrink-0" />
              <span>Unlimited products</span>
            </li>
            <li class="flex items-center gap-2 text-white text-sm">
              <Check size={16} class="text-amber-400 shrink-0" />
              <span><strong>Unlimited Vibe Coding</strong></span>
            </li>
            <li class="flex items-center gap-2 text-white text-sm">
              <Check size={16} class="text-amber-400 shrink-0" />
              <span>Multiple branches</span>
            </li>
            <li class="flex items-center gap-2 text-white text-sm">
              <Check size={16} class="text-amber-400 shrink-0" />
              <span>Advanced reports</span>
            </li>
            <li class="flex items-center gap-2 text-white text-sm">
              <Check size={16} class="text-amber-400 shrink-0" />
              <span>Priority support</span>
            </li>
          </ul>
          <button 
            class="w-full py-3 rounded-full bg-white text-[#1E88E6] font-bold hover:bg-gray-100 transition-all"
            on:click={goToLogin}
          >
            Start free
          </button>
        </div>
        
        <!-- Enterprise Plan -->
        <div class="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm hover:shadow-lg transition-all">
          <div class="text-center mb-6">
            <h3 class="text-xl font-bold text-gray-800 mb-2">Enterprise Plan</h3>
            <p class="text-gray-500 text-sm">For complex operations</p>
            <div class="mt-4">
              <span class="text-2xl font-bold text-gray-900">Custom</span>
            </div>
          </div>
          <ul class="space-y-3 mb-8">
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>Unlimited points of sale</span>
            </li>
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>Dedicated customization</span>
            </li>
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>API for integrations</span>
            </li>
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>Training included</span>
            </li>
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>Dedicated account manager</span>
            </li>
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>Guaranteed SLA</span>
            </li>
          </ul>
          <button 
            class="w-full py-3 rounded-full border-2 border-[#1E88E6] text-[#1E88E6] font-bold hover:bg-[#1E88E6] hover:text-white transition-all"
            on:click={goToLogin}
          >
            Contact sales
          </button>
        </div>
      </div>
      
      <!-- All plans include -->
      <div class="mt-12 text-center">
        <p class="text-gray-600 mb-4 font-medium">All plans include:</p>
        <div class="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
          <span class="flex items-center gap-1"><Check size={14} class="text-emerald-500" /> 14-day free trial</span>
          <span class="flex items-center gap-1"><Check size={14} class="text-emerald-500" /> No credit card</span>
          <span class="flex items-center gap-1"><Check size={14} class="text-emerald-500" /> No contracts</span>
          <span class="flex items-center gap-1"><Check size={14} class="text-emerald-500" /> Automatic updates</span>
          <span class="flex items-center gap-1"><Check size={14} class="text-emerald-500" /> Daily backup</span>
        </div>
      </div>
    </div>
  </section>

  <!-- FAQ Section -->
  <section id="faq" class="py-20 px-6 bg-gray-50">
    <div class="max-w-3xl mx-auto">
      <div class="text-center mb-12">
        <h2 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Frequently Asked Questions</h2>
      </div>
      
      <div class="space-y-4">
        {#each faqs as faq, i}
          <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button 
              class="w-full p-6 text-left flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
              on:click={() => toggleFaq(i)}
            >
              <span class="font-bold text-gray-800">{faq.question}</span>
              {#if openFaqIndex === i}
                <ChevronUp size={20} class="text-gray-400 shrink-0" />
              {:else}
                <ChevronDown size={20} class="text-gray-400 shrink-0" />
              {/if}
            </button>
            {#if openFaqIndex === i}
              <div class="px-6 pb-6 text-gray-600 animate-fadeIn">
                {faq.answer}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </section>

  <!-- Guarantee Section -->
  <section class="py-20 px-6 bg-white">
    <div class="max-w-3xl mx-auto text-center">
      <div class="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <ShieldCheck size={40} class="text-emerald-600" />
      </div>
      <h2 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Satisfaction Guarantee</h2>
      <h3 class="text-xl text-[#1E88E6] font-bold mb-6">30-day money-back guarantee</h3>
      <p class="text-lg text-gray-600 mb-6">
        Try Cuadra risk-free. If in the first 30 days you decide it's not for you, we'll refund 100% of your investment. No questions asked.
      </p>
      <p class="text-gray-500">
        Why? Because we're confident that once you experience having AI working for you, you won't want to go back to traditional systems.
      </p>
    </div>
  </section>

  <!-- Final CTA -->
  <section class="py-24 px-6 text-center bg-gradient-to-b from-white to-[#BADBF7]/20">
    <div class="max-w-3xl mx-auto">
      <h2 class="text-3xl md:text-5xl font-bold mb-4 text-[#1F2937]">Ready to manage your business with artificial intelligence?</h2>
      <p class="text-xl text-gray-600 mb-8">
        The future of business isn't just recording sales. It's <strong>predicting demand, optimizing prices, and automating decisions</strong>.
      </p>
      <p class="text-lg text-[#1E88E6] font-bold mb-8">Cuadra gives you that intelligence. From $35/month.</p>
      
      <div class="flex flex-col sm:flex-row justify-center gap-4 mb-6">
        <button 
          class="bg-[#1E88E6] hover:bg-[#1778CF] text-white text-xl px-12 py-5 rounded-full shadow-2xl shadow-[#1E88E6]/30 hover:shadow-[#1E88E6]/40 transition-all hover:scale-105 font-bold" 
          on:click={goToLogin}
        >
          Start your free trial - 14 days
        </button>
        <button 
          class="bg-white hover:bg-gray-50 text-[#1E88E6] text-xl px-12 py-5 rounded-full shadow-lg border-2 border-[#1E88E6] transition-all hover:scale-105 font-bold" 
          on:click={goToLogin}
        >
          Schedule a personalized demo
        </button>
      </div>
      <p class="text-gray-500 text-sm">Join businesses already managing with artificial intelligence.</p>
    </div>
  </section>

  <!-- Footer -->
  <footer class="py-12 px-6 bg-[#1F2937] text-white">
    <div class="max-w-6xl mx-auto">
      <!-- Trust Badges -->
      <div class="flex flex-wrap justify-center gap-6 mb-12 pb-12 border-b border-white/10">
        <div class="flex items-center gap-2 text-white/80 text-sm">
          <ShieldCheck size={16} class="text-emerald-400" />
          <span>Automatic tax compliance</span>
        </div>
        <div class="flex items-center gap-2 text-white/80 text-sm">
          <Lock size={16} class="text-purple-400" />
          <span>Encrypted and secure data</span>
        </div>
        <div class="flex items-center gap-2 text-white/80 text-sm">
          <RefreshCw size={16} class="text-amber-400" />
          <span>Automatic daily backup</span>
        </div>
        <div class="flex items-center gap-2 text-white/80 text-sm">
          <Headphones size={16} class="text-rose-400" />
          <span>Dedicated support</span>
        </div>
        <div class="flex items-center gap-2 text-white/80 text-sm">
          <Sparkles size={16} class="text-cyan-400" />
          <span>Free updates</span>
        </div>
        <div class="flex items-center gap-2 text-white/80 text-sm">
          <WifiOff size={16} class="text-blue-400" />
          <span>Works offline</span>
        </div>
      </div>
      
      <!-- Footer Content -->
      <div class="grid md:grid-cols-4 gap-8 mb-12">
        <!-- Logo & Description -->
        <div class="md:col-span-2">
          <img src="/cuadra_logo_white.png" alt="Cuadra" class="h-8 w-auto mb-4" />
          <p class="text-white/60 text-sm max-w-md">
            Invoicing, inventory and POS software with artificial intelligence. Designed for real businesses.
          </p>
        </div>
        
        <!-- Links -->
        <div>
          <h4 class="font-bold text-white mb-4">Product</h4>
          <ul class="space-y-2 text-sm text-white/60">
            <li><a href="#features" class="hover:text-white transition-colors">Features</a></li>
            <li><a href="#industries" class="hover:text-white transition-colors">Industries</a></li>
            <li><a href="#pricing" class="hover:text-white transition-colors">Pricing</a></li>
            <li><a href="#faq" class="hover:text-white transition-colors">FAQ</a></li>
          </ul>
        </div>
        
        <!-- Contact -->
        <div>
          <h4 class="font-bold text-white mb-4">Contact</h4>
          <ul class="space-y-2 text-sm text-white/60">
            <li>support@cuadrapos.com</li>
            <li>Santo Domingo, DR</li>
          </ul>
        </div>
      </div>
      
      <!-- Copyright -->
      <div class="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <p class="text-white/40 text-sm">© 2026 Cuadra. All rights reserved.</p>
        <div class="flex gap-6 text-sm text-white/40">
          <a href="#" class="hover:text-white transition-colors">Terms of Service</a>
          <a href="#" class="hover:text-white transition-colors">Privacy Policy</a>
        </div>
      </div>
    </div>
  </footer>

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
  
  .animate-slideUp {
    animation: slideUpIn 0.5s ease-out;
  }
  
  @keyframes slideUpIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .animate-scaleIn {
    animation: scaleIn 0.4s ease-out;
  }
  
  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
</style>
