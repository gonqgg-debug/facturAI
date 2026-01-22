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
    { id: 'retail', name: 'Retail y Minimarkets', icon: Store, description: 'Control total de inventario, precios dinámicos, promociones automáticas, gestión de proveedores.' },
    { id: 'bakery', name: 'Panaderías y Cafeterías', icon: Coffee, description: 'Recetas, control de insumos, productos perecederos, descuentos por hora del día.' },
    { id: 'hardware', name: 'Ferreterías y Repuestos', icon: Wrench, description: 'Inventario complejo, productos por SKU, proveedores múltiples, control de series.' },
    { id: 'clothing', name: 'Tiendas de Ropa', icon: Shirt, description: 'Tallas, colores, temporadas, consignaciones, devoluciones inteligentes.' },
    { id: 'restaurant', name: 'Restaurantes y Delivery', icon: UtensilsCrossed, description: 'Mesas, comandas, cocina, delivery integrado, control de desperdicio.' },
    { id: 'pharmacy', name: 'Farmacias', icon: Pill, description: 'Lotes, vencimientos, productos controlados, recetas médicas.' },
    { id: 'services', name: 'Servicios Profesionales', icon: Briefcase, description: 'Facturación por proyecto, tiempo facturado, gastos, múltiples servicios.' }
  ];
  
  const faqs = [
    { question: '¿Qué hace diferente a Cuadra de otros sistemas?', answer: 'La inteligencia artificial integrada. Otros sistemas solo registran lo que sucedió. Cuadra predice lo que va a suceder y te dice qué hacer al respecto.' },
    { question: '¿Es difícil de usar?', answer: 'Al contrario. Puedes configurar reglas complejas simplemente hablándole al sistema. Si sabes explicar lo que necesitas, Cuadra lo entiende.' },
    { question: '¿Funciona sin internet?', answer: 'Sí, completamente. Puedes vender todo el día sin conexión y cuando vuelva el internet, todo se sincroniza automáticamente.' },
    { question: '¿Cumple con normativas fiscales?', answer: '100%. Facturas electrónicas, todos los reportes fiscales, automáticamente. Compatible con múltiples jurisdicciones.' },
    { question: '¿Puedo probarlo antes de pagar?', answer: 'Sí, 14 días gratis, sin tarjeta de crédito. Si no te convence, no pagas nada.' },
    { question: '¿Qué pasa con mis datos si cancelo?', answer: 'Son tuyos. Puedes exportar todo en cualquier momento. Sin secuestro de datos.' },
    { question: '¿Necesito comprar hardware especial?', answer: 'No. Funciona en cualquier PC, laptop, tablet o celular. Si ya tienes impresora térmica, se conecta. Si no, puedes usar cualquier impresora normal.' }
  ];
  
  const comparisonFeatures = [
    { feature: 'Configuración personalizada', traditional: 'Ticket a soporte, días de espera', cuadra: 'Hablarle al sistema, 30 segundos', cuadraWins: true },
    { feature: 'Inteligencia artificial', traditional: 'No incluida', cuadra: '6 módulos de IA incluidos', cuadraWins: true },
    { feature: 'Predicción de necesidades', traditional: 'Solo reportes históricos', cuadra: 'Predicción activa', cuadraWins: true },
    { feature: 'Reconocimiento de documentos', traditional: 'Todo manual', cuadra: 'IA lee facturas automáticamente', cuadraWins: true },
    { feature: 'Funciona offline', traditional: 'Depende del internet', cuadra: 'Operación offline completa', cuadraWins: true },
    { feature: 'Cumplimiento fiscal', traditional: 'Requiere configuración', cuadra: 'Automático desde día 1', cuadraWins: true },
    { feature: 'Adaptación al negocio', traditional: 'Rígido o personalización $$$$', cuadra: 'Configuración ilimitada incluida', cuadraWins: true },
    { feature: 'Precio', traditional: '$25-50/mes + extras', cuadra: '$35-45/mes todo incluido', cuadraWins: true }
  ];

  let promptText = "";
  let isAnimating = false;
  let showResult = false;
  
  // Vibe Coding animation state
  let vibeCodingText = "";
  let vibeCodingStep = 0; // 0 = idle, 1 = typing, 2 = processing, 3 = done
  let vibeCodingTimeout: ReturnType<typeof setTimeout>;
  
  const vibeCodingPrompt = "Dame 15% de descuento en productos de panadería después de las 6pm";
  
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
    const text = "Yo no mando órdenes a proveedores, el camión llega y le compro en vivo. Crea todo el flujo: escanear entrada, actualizar inventario y pagar en efectivo o transferencia.";
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
      formError = 'Por favor completa los campos requeridos';
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
      formError = 'Hubo un error. Por favor intenta de nuevo.';
    } finally {
      isSubmitting = false;
    }
  }
</script>

<svelte:head>
  <title>Cuadra - Software de Facturación, Inventario y POS con IA</title>
  <meta name="description" content="El software que se adapta a tu negocio, no al revés. Facturación, inventario y punto de venta con inteligencia artificial incluida. 100% DGII." />
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
        <a href="#funciones" class="text-[#1F2937]/70 hover:text-[#1E88E6] font-medium transition-colors text-sm">Funciones</a>
        <a href="#industrias" class="text-[#1F2937]/70 hover:text-[#1E88E6] font-medium transition-colors text-sm">Industrias</a>
        <a href="#precios" class="text-[#1F2937]/70 hover:text-[#1E88E6] font-medium transition-colors text-sm">Precios</a>
        <a href="#faq" class="text-[#1F2937]/70 hover:text-[#1E88E6] font-medium transition-colors text-sm">FAQ</a>
      </div>
      <div class="flex items-center gap-2 sm:gap-4">
        <button on:click={goToLogin} class="hidden sm:block text-[#1F2937]/80 hover:text-[#1E88E6] font-medium transition-colors">Entrar</button>
        <button on:click={scrollToTrialForm} class="bg-[#1E88E6] text-white hover:bg-[#1778CF] rounded-full px-4 sm:px-6 py-1.5 sm:py-2 text-sm sm:text-base font-medium transition-colors">Prueba gratis 14 días</button>
        <a href="/en" class="text-xs text-[#1F2937]/40 hover:text-[#1E88E6] transition-colors ml-1">EN</a>
      </div>
    </div>
  </nav>

  <!-- Hero -->
  <header class="pt-32 pb-20 px-6 bg-gradient-to-b from-[#BADBF7]/20 to-white">
    <div class="max-w-4xl mx-auto text-center">
      <!-- Headline -->
      <h1 class="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-[#1F2937] leading-[1.1]">
        El software que se adapta a tu negocio, <span class="text-[#1E88E6]">no al revés</span>
      </h1>
      
      <!-- Subheadline -->
      <p class="text-xl md:text-2xl text-[#1F2937]/70 font-medium max-w-3xl mx-auto mb-6 leading-relaxed">
        Facturación, inventario y punto de venta con <span class="text-[#1E88E6] font-bold">inteligencia artificial incluida</span>.
      </p>

      <!-- Trust Badges -->
      <div class="flex flex-wrap justify-center gap-4 mb-10">
        <div class="flex items-center gap-2 bg-[#BADBF7]/30 px-4 py-2 rounded-full text-sm font-medium text-[#0D4373]">
          <Wand2 size={16} />
          <span>Configuración en lenguaje natural</span>
        </div>
        <div class="flex items-center gap-2 bg-[#BADBF7]/30 px-4 py-2 rounded-full text-sm font-medium text-[#0D4373]">
          <Brain size={16} />
          <span>Predicción automática de demanda</span>
        </div>
        <div class="flex items-center gap-2 bg-[#BADBF7]/30 px-4 py-2 rounded-full text-sm font-medium text-[#0D4373]">
          <ShieldCheck size={16} />
          <span>Cumplimiento fiscal automático</span>
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
                  <span class="text-gray-400 text-xs uppercase tracking-wider">Otros sistemas</span>
                  <h3 class="text-gray-800 font-bold text-lg">POS Tradicional</h3>
                </div>
                <div class="bg-red-100 text-red-600 text-xs px-3 py-1 rounded-full border border-red-200">
                  Rígido y genérico
                </div>
              </div>

              <!-- Traditional grid - looks cluttered and overwhelming -->
              <div class="grid grid-cols-3 gap-2 opacity-60">
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                  <ShoppingCart size={18} class="text-gray-400" />
                  <span class="text-gray-500 text-xs">Ventas</span>
                </div>
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                  <Users size={18} class="text-gray-400" />
                  <span class="text-gray-500 text-xs">Clientes</span>
                </div>
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                  <Receipt size={18} class="text-gray-400" />
                  <span class="text-gray-500 text-xs">Facturas</span>
                </div>
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                  <Package size={18} class="text-gray-400" />
                  <span class="text-gray-500 text-xs">Inventario</span>
                </div>
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                  <BarChart3 size={18} class="text-gray-400" />
                  <span class="text-gray-500 text-xs">Reportes</span>
                </div>
                <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 flex flex-col items-center justify-center gap-1">
                  <CreditCard size={18} class="text-gray-400" />
                  <span class="text-gray-500 text-xs">Pagos</span>
                </div>
              </div>

              <!-- Frustration message -->
              <div class="mt-6 text-center">
                <p class="text-gray-400 text-sm italic">"Esto no funciona como yo trabajo..."</p>
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
                    <span class="text-lg font-bold block">Personalizar con IA</span>
                    <span class="text-sm text-gray-800">Dile cómo quieres que funcione</span>
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
                <span class="text-[#1E88E6] text-sm font-medium">Transformando tu sistema...</span>
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
                    <Sparkles size={12} class="text-purple-500" /> Cuadra con IA
                  </span>
                  <h3 class="text-gray-800 font-bold text-lg">Tu Sistema Personalizado</h3>
                </div>
                <div class="bg-emerald-100 text-emerald-700 text-xs px-3 py-1 rounded-full border border-emerald-300 flex items-center gap-1 font-medium">
                  <CheckCircle2 size={12} /> Listo
                </div>
              </div>

              <!-- AI-powered modules - vibrant and organized -->
              <div class="grid grid-cols-3 gap-3">
                <div class="bg-gradient-to-br from-purple-100 to-purple-50 border-2 border-purple-400 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-all cursor-pointer shadow-md hover:shadow-purple-200">
                  <div class="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
                    <Brain size={20} class="text-white" />
                  </div>
                  <span class="text-gray-800 text-xs font-bold">Precios IA</span>
                  <span class="text-purple-600 text-[10px] font-medium">Auto-ajuste</span>
                </div>
                <div class="bg-gradient-to-br from-emerald-100 to-emerald-50 border-2 border-emerald-400 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-all cursor-pointer shadow-md hover:shadow-emerald-200">
                  <div class="w-10 h-10 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg">
                    <Target size={20} class="text-white" />
                  </div>
                  <span class="text-gray-800 text-xs font-bold">Predicción</span>
                  <span class="text-emerald-600 text-[10px] font-medium">Stock óptimo</span>
                </div>
                <div class="bg-gradient-to-br from-rose-100 to-rose-50 border-2 border-rose-400 rounded-xl p-4 flex flex-col items-center justify-center gap-2 hover:scale-105 transition-all cursor-pointer shadow-md hover:shadow-rose-200">
                  <div class="w-10 h-10 bg-gradient-to-br from-rose-500 to-rose-600 rounded-lg flex items-center justify-center shadow-lg">
                    <Users size={20} class="text-white" />
                  </div>
                  <span class="text-gray-800 text-xs font-bold">Análisis Clientes</span>
                  <span class="text-rose-600 text-[10px] font-medium">Inteligente</span>
                </div>
              </div>

              <!-- Quick actions row -->
              <div class="mt-4 flex gap-2">
                <button class="flex-1 bg-gray-100 text-gray-700 rounded-xl py-4 font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-all border border-gray-300">
                  <Scan size={20} />
                  Cobrar
                </button>
                <button class="flex-1 bg-[#1E88E6] text-white rounded-xl py-4 font-bold flex items-center justify-center gap-2 hover:bg-[#1778CF] transition-all shadow-md">
                  <CreditCard size={20} />
                  Pagar
                </button>
              </div>

              <!-- Success message -->
              <div class="mt-4 text-center">
                <p class="text-emerald-600 text-sm font-bold">✨ Ahora funciona exactamente como TÚ trabajas</p>
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
          class="bg-[#1E88E6] hover:bg-[#1778CF] text-white text-base sm:text-xl px-6 sm:px-10 py-3 sm:py-5 rounded-full shadow-xl shadow-[#1E88E6]/25 transition-all hover:scale-105 font-bold" 
          on:click={scrollToTrialForm}
        >
          Prueba gratis 14 días
        </button>
        <button 
          class="bg-white hover:bg-gray-50 text-[#1E88E6] text-base sm:text-xl px-6 sm:px-10 py-3 sm:py-5 rounded-full shadow-lg border-2 border-[#1E88E6] transition-all hover:scale-105 font-bold" 
          on:click={scrollToTrialForm}
        >
          Ver demo en vivo
        </button>
      </div>
      <p class="text-center text-gray-500 text-sm mt-6">Sin tarjeta de crédito. Cancela cuando quieras.</p>
    </div>
  </header>

  <!-- Vibe Coding Section -->
  <section id="vibe-coding" class="py-24 px-6 bg-gradient-to-b from-white via-purple-50/30 to-white overflow-hidden">
    <div class="max-w-5xl mx-auto">
      <div class="text-center mb-16">
        <span class="inline-flex items-center gap-2 bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-700 px-5 py-2.5 rounded-full text-sm font-bold mb-6 shadow-sm">
          <Sparkles size={18} class="animate-pulse" /> Exclusivo de Cuadra
        </span>
        <h2 class="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
          Configuración en <span class="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Lenguaje Natural</span>
        </h2>
        <p class="text-xl text-gray-600 max-w-2xl mx-auto">Olvídate de manuales técnicos y llamadas a soporte. Simplemente dile lo que necesitas.</p>
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
                cuadra.app/configurar
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
                <span class="font-bold text-gray-700">Asistente de Configuración</span>
                <span class="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-medium">IA Activa</span>
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
                    <span class="text-purple-600 font-medium">Configurando automáticamente...</span>
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
                        <span class="font-bold text-emerald-800">¡Configuración Creada!</span>
                      </div>
                      <span class="text-xs text-emerald-600 bg-emerald-100 px-3 py-1 rounded-full font-medium">Activa ahora</span>
                    </div>
                    
                    <!-- Generated Config Preview -->
                    <div class="bg-white rounded-lg p-3 sm:p-4 border border-emerald-100">
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                        <div class="flex items-center gap-2">
                          <div class="w-2 h-2 bg-purple-500 rounded-full shrink-0"></div>
                          <span class="text-gray-600">Categoría:</span>
                          <span class="font-medium text-gray-800">Panadería</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <div class="w-2 h-2 bg-indigo-500 rounded-full shrink-0"></div>
                          <span class="text-gray-600">Descuento:</span>
                          <span class="font-medium text-gray-800">15%</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <div class="w-2 h-2 bg-cyan-500 rounded-full shrink-0"></div>
                          <span class="text-gray-600">Horario:</span>
                          <span class="font-medium text-gray-800">6:00 PM - Cierre</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <div class="w-2 h-2 bg-emerald-500 rounded-full shrink-0"></div>
                          <span class="text-gray-600">Estado:</span>
                          <span class="font-medium text-emerald-600">Activo</span>
                        </div>
                      </div>
                    </div>
                    
                    <p class="text-center text-emerald-700 mt-4 font-medium">
                      ✨ Listo en <span class="font-bold">3 segundos</span>. Sin código. Sin esperas.
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
        <p class="text-gray-500 mb-4">Otros ejemplos de lo que puedes configurar:</p>
      </div>
      <div class="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
        <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-200 transition-all cursor-pointer group">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <Bell size={16} class="text-amber-600" />
            </div>
            <p class="text-sm text-gray-700">"Avísame cuando queden menos de 10 unidades"</p>
          </div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-200 transition-all cursor-pointer group">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShoppingCart size={16} class="text-emerald-600" />
            </div>
            <p class="text-sm text-gray-700">"Promoción 3x2 en bebidas los fines de semana"</p>
          </div>
        </div>
        <div class="bg-white rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md hover:border-purple-200 transition-all cursor-pointer group">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users size={16} class="text-blue-600" />
            </div>
            <p class="text-sm text-gray-700">"Crédito máximo de $500 para clientes nuevos"</p>
          </div>
        </div>
      </div>
      
      <div class="text-center mt-12">
        <p class="text-2xl font-bold text-gray-800 mb-2">Sin programadores. Sin esperas. Sin costos extra.</p>
      </div>
    </div>
  </section>

  <!-- 6 AI Superpowers -->
  <section id="funciones" class="py-24 px-6 bg-white">
    <div class="max-w-6xl mx-auto">
      <div class="text-center mb-12">
        <span class="inline-flex items-center gap-2 bg-purple-100 text-purple-700 px-4 py-2 rounded-full text-sm font-bold mb-4">
          <Brain size={16} /> Inteligencia Artificial
        </span>
        <h2 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Inteligencia Artificial que Trabaja para Ti</h2>
        <p class="text-xl text-gray-600 max-w-2xl mx-auto"><strong>Otros sistemas te muestran reportes del pasado.</strong> Cuadra predice tu futuro.</p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Card 1: Predicción Inteligente de Stock -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-emerald-200 hover:shadow-emerald-200 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 group-hover:from-emerald-100 to-transparent rounded-bl-full -mr-8 -mt-8 transition-all duration-500 group-hover:scale-110"></div>
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-emerald-100 group-hover:text-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-emerald-100 group-hover:scale-110 transition-all duration-300">
            <Package size={24} class="group-hover:rotate-12 transition-transform duration-500" />
          </div>
          <h3 class="text-xl font-bold mb-3 text-gray-900">Predicción Inteligente de Stock</h3>
          <p class="text-gray-600 text-sm mb-6">La IA analiza tus patrones de venta y te dice exactamente cuánto comprar, cuándo comprarlo, y detecta tendencias antes que las veas.</p>
          
          <!-- Animated Visual: Stock Prediction -->
          <div class="bg-blue-50/50 rounded-xl p-3 mb-2 border border-blue-100 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-colors duration-300">
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs font-medium text-gray-600">Leche Entera</span>
              <span class="text-xs font-bold text-amber-500 bg-amber-100 px-2 py-0.5 rounded-full group-hover:text-emerald-600 group-hover:bg-emerald-200 transition-colors duration-500">
                <span class="group-hover:hidden">Pedir 24 uds</span>
                <span class="hidden group-hover:inline">Pedido Listo</span>
              </span>
            </div>
            <div class="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div class="h-full bg-amber-400 w-[25%] rounded-full group-hover:w-[85%] group-hover:bg-emerald-500 transition-all duration-1000 ease-out"></div>
            </div>
          </div>
        </div>

        <!-- Card 2: Recomendaciones de Precio -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-purple-200 hover:shadow-purple-200 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 group-hover:from-purple-100 to-transparent rounded-bl-full -mr-8 -mt-8 transition-all duration-500 group-hover:scale-110"></div>
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-purple-100 group-hover:text-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-purple-100 group-hover:scale-110 transition-all duration-300">
            <TrendingUp size={24} class="group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform duration-500" />
          </div>
          <h3 class="text-xl font-bold mb-3 text-gray-900">Recomendaciones de Precio</h3>
          <p class="text-gray-600 text-sm mb-6">¿Nuevo producto? La IA analiza tu mercado, márgenes y competencia para recomendarte el precio que maximiza tu ganancia.</p>
          
          <!-- Animated Visual: Price Change -->
          <div class="bg-blue-50/50 rounded-xl p-3 mb-2 border border-blue-100 group-hover:bg-purple-50 group-hover:border-purple-100 flex items-center justify-between transition-colors duration-300">
            <div class="flex flex-col">
              <span class="text-xs text-gray-400 line-through">$150.00</span>
              <span class="text-lg font-bold text-gray-700 group-hover:text-purple-600 flex items-center gap-1 transition-colors">
                $165.00 
                <TrendingUp size={14} class="inline text-[#1E88E6] group-hover:text-purple-600" />
              </span>
            </div>
            <div class="text-xs font-bold text-[#1E88E6] group-hover:text-purple-500 bg-white px-2 py-1 rounded-md shadow-sm transition-colors">
              +10% Margen
            </div>
          </div>
        </div>

        <!-- Card 3: Análisis Predictivo de Tendencias -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-pink-200 hover:shadow-pink-200 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 group-hover:from-pink-100 to-transparent rounded-bl-full -mr-8 -mt-8 transition-all duration-500 group-hover:scale-110"></div>
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-pink-100 group-hover:text-pink-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-pink-100 group-hover:scale-110 transition-all duration-300">
            <BarChart3 size={24} class="group-hover:scale-110 transition-transform duration-500" />
          </div>
          <h3 class="text-xl font-bold mb-3 text-gray-900">Análisis Predictivo de Tendencias</h3>
          <p class="text-gray-600 text-sm mb-6">Descubre patrones ocultos: "Las ventas de X suben 35% cuando llueve" o "Los martes vendes 60% más en Y".</p>
          
          <!-- Animated Visual: Forecast Chart -->
          <div class="bg-blue-50/50 rounded-xl p-3 mb-2 border border-blue-100 group-hover:bg-pink-50 group-hover:border-pink-100 relative h-[60px] flex items-end gap-1 overflow-hidden transition-colors duration-300">
             <div class="w-1/5 bg-gray-200 group-hover:bg-pink-300 h-[40%] rounded-t-sm transition-colors duration-500"></div>
             <div class="w-1/5 bg-gray-200 group-hover:bg-pink-300 h-[60%] rounded-t-sm transition-colors duration-500 delay-75"></div>
             <div class="w-1/5 bg-gray-300 group-hover:bg-pink-400 h-[50%] rounded-t-sm transition-colors duration-500 delay-150"></div>
             <div class="w-1/5 bg-gray-400 group-hover:bg-pink-500 h-[75%] rounded-t-sm relative transition-colors duration-500 delay-200"></div>
             <div class="w-1/5 bg-[#1E88E6] group-hover:bg-pink-600 h-0 group-hover:h-[90%] transition-all duration-1000 ease-out rounded-t-sm relative border-t-2 border-dashed border-white/50 delay-300">
               <div class="absolute -top-8 right-0 bg-pink-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity delay-700 whitespace-nowrap">
                 +35% Previsto
               </div>
             </div>
          </div>
        </div>

        <!-- Card 4: Reconocimiento de Documentos -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-rose-200 hover:shadow-rose-200 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 group-hover:from-rose-100 to-transparent rounded-bl-full -mr-8 -mt-8 transition-all duration-500 group-hover:scale-110"></div>
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-rose-100 group-hover:text-rose-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-rose-100 group-hover:scale-110 transition-all duration-300">
            <Scan size={24} class="group-hover:scale-110 transition-transform duration-500" />
          </div>
          <h3 class="text-xl font-bold mb-3 text-gray-900">Reconocimiento de Documentos</h3>
          <p class="text-gray-600 text-sm mb-6">Toma foto a facturas de proveedores y Cuadra las registra automáticamente. OCR con IA que entiende cualquier formato de documento.</p>
          
          <!-- Animated Visual: Scanning Effect -->
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

        <!-- Card 5: Perfil Inteligente de Clientes -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-amber-200 hover:shadow-amber-200 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 group-hover:from-amber-100 to-transparent rounded-bl-full -mr-8 -mt-8 transition-all duration-500 group-hover:scale-110"></div>
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-amber-100 group-hover:text-amber-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-amber-100 group-hover:scale-110 transition-all duration-300">
            <Users size={24} class="group-hover:scale-110 transition-transform duration-500" />
          </div>
          <h3 class="text-xl font-bold mb-3 text-gray-900">Perfil Inteligente de Clientes</h3>
          <p class="text-gray-600 text-sm mb-6">Historial automático: qué compra, frecuencia, preferencias, crédito. La IA te sugiere qué ofrecerle para que compre más.</p>
          
          <!-- Animated Visual: Customer Profile -->
          <div class="bg-blue-50/50 rounded-xl p-3 mb-2 border border-blue-100 group-hover:bg-amber-50 group-hover:border-amber-100 flex items-center justify-between transition-colors duration-300">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 shadow-sm">JP</div>
              <div class="flex flex-col">
                <span class="text-xs font-medium text-gray-600">Juan Perez</span>
                <span class="text-[10px] bg-white border border-gray-100 text-gray-500 px-1.5 rounded group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500 transition-all duration-500 shadow-sm">VIP</span>
              </div>
            </div>
            <button class="opacity-50 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500 bg-green-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1">
              <MessageCircle size={10} /> Oferta
            </button>
          </div>
        </div>

        <!-- Card 6: Personalización Sin Límites -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-cyan-200 hover:shadow-cyan-200 transition-all duration-500 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-blue-50 group-hover:from-cyan-100 to-transparent rounded-bl-full -mr-4 -mt-4 transition-all duration-700 group-hover:scale-150"></div>
          
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-cyan-100 group-hover:text-cyan-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-cyan-100 group-hover:scale-110 transition-all duration-300">
            <Wand2 size={24} />
          </div>
          
          <h3 class="text-xl font-bold mb-3 text-gray-900">Personalización Sin Límites</h3>
          <p class="text-gray-600 text-sm mb-6">Cualquier regla de negocio que imagines, Cuadra la puede configurar. Habla con el sistema como hablarías con tu contador.</p>
          
          <!-- Animated Visual: Prompt to UI -->
          <div class="bg-blue-50/50 rounded-xl p-3 mb-2 border border-blue-100 group-hover:bg-cyan-50 group-hover:border-cyan-100 flex flex-col gap-2 transition-colors duration-300">
            <div class="bg-white border border-gray-200 group-hover:border-cyan-200 rounded px-2 py-1.5 text-[10px] text-gray-400 flex items-center gap-1 shadow-sm relative overflow-hidden transition-colors">
              <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
              <span class="w-1 h-1 rounded-full bg-[#1E88E6] group-hover:bg-cyan-400 transition-colors"></span>
              <span class="group-hover:hidden">Escribe tu regla...</span>
              <span class="hidden group-hover:inline-block text-gray-600">Descuento 10% si...</span>
            </div>
            <div class="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity delay-500 h-4">
               <ArrowRight size={12} class="text-cyan-500 rotate-90" />
            </div>
            <div class="bg-white border border-gray-200 rounded p-2 shadow-sm opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-1000 flex items-center justify-center">
              <div class="h-5 bg-emerald-500 text-white text-[10px] font-bold px-3 rounded flex items-center justify-center shadow-md">
                 <CheckCircle2 size={10} class="mr-1" /> Regla Activa
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
        <h2 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Mira Cuadra en Acción</h2>
        <p class="text-xl text-gray-600 max-w-2xl mx-auto">Una interfaz limpia y rápida, diseñada para el día a día de tu negocio.</p>
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
              <h3 class="text-xl font-bold text-gray-800">Lista de Compras Inteligente</h3>
              <p class="text-sm text-gray-500">La IA analiza tu inventario y genera órdenes de compra automáticamente</p>
            </div>
          </div>
          
          <!-- Step Indicators -->
          <div class="flex items-center justify-center gap-1 sm:gap-2 mb-6 flex-wrap">
            <button 
              class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all {catalogStep === 0 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(catalogTimeout); catalogStep = 0; }}
            >
              <span class="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
              <span class="hidden xs:inline">Ver</span> Alertas
            </button>
            <ArrowRight size={14} class="text-gray-300 hidden sm:block" />
            <button 
              class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all {catalogStep === 1 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(catalogTimeout); catalogStep = 1; }}
            >
              <span class="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
              <span class="hidden xs:inline">Generar</span> Lista
            </button>
            <ArrowRight size={14} class="text-gray-300 hidden sm:block" />
            <button 
              class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all {catalogStep === 2 ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(catalogTimeout); catalogStep = 2; }}
            >
              <span class="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">3</span>
              IA <span class="hidden xs:inline">Sugiere</span>
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
                  alt="Alertas de Inventario" 
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
                      <span class="font-semibold text-gray-800">Click: Generar Lista</span>
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
                  alt="Lista Inteligente de Compras" 
                  class="w-full h-full object-cover object-top"
                />
              </div>
            </div>
          </div>
          
          <!-- Feature description based on step -->
          <div class="mt-6 text-center">
            {#if catalogStep === 0}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Paso 1:</strong> El sistema detecta productos con stock bajo y muestra alertas inteligentes con sugerencias de reorden.
              </p>
            {:else if catalogStep === 1}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Paso 2:</strong> Con un click en "Generar Lista", la IA analiza patrones de venta, temporadas y tendencias.
              </p>
            {:else}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Paso 3:</strong> Recibe un resumen ejecutivo con cantidades óptimas, costos estimados y prioridades de compra.
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
              <h3 class="text-xl font-bold text-gray-800">Análisis de Precios con IA</h3>
              <p class="text-sm text-gray-500">La IA analiza costos, márgenes y mercado para recomendarte el precio óptimo</p>
            </div>
          </div>
          
          <!-- Step Indicators -->
          <div class="flex items-center justify-center gap-1 sm:gap-2 mb-6 flex-wrap">
            <button 
              class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all {pricingStep === 0 ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(pricingTimeout); pricingStep = 0; }}
            >
              <span class="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
              Producto
            </button>
            <ArrowRight size={14} class="text-gray-300 hidden sm:block" />
            <button 
              class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all {pricingStep === 1 ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(pricingTimeout); pricingStep = 1; }}
            >
              <span class="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
              Análisis
            </button>
            <ArrowRight size={14} class="text-gray-300 hidden sm:block" />
            <button 
              class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all {pricingStep === 2 ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(pricingTimeout); pricingStep = 2; }}
            >
              <span class="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">3</span>
              IA
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
                  alt="Análisis de Precios" 
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
                  alt="Recomendación de Precio IA" 
                  class="w-full h-full object-cover object-top"
                />
              </div>
            </div>
          </div>
          
          <!-- Feature description based on step -->
          <div class="mt-6 text-center">
            {#if pricingStep === 0}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Paso 1:</strong> Selecciona un producto para ver costos, precios históricos y cadena de suministro.
              </p>
            {:else if pricingStep === 1}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Paso 2:</strong> Haz click en "Start Analysis" para que la IA evalúe márgenes, volumen y elasticidad de precio.
              </p>
            {:else}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Paso 3:</strong> Recibe precio sugerido ($145.00), rating (RAISE PRICE), explicación detallada e ideas "Out of the Box".
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
              <h3 class="text-xl font-bold text-gray-800">Insights Inteligentes</h3>
              <p class="text-sm text-gray-500">La IA analiza patrones de venta, segmenta clientes y predice tendencias</p>
            </div>
          </div>
          
          <!-- Step Indicators -->
          <div class="flex items-center justify-center gap-1 sm:gap-2 mb-6 flex-wrap">
            <button 
              class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all {insightsStep === 0 ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(insightsTimeout); insightsStep = 0; }}
            >
              <span class="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
              Segmentos
            </button>
            <ArrowRight size={14} class="text-gray-300 hidden sm:block" />
            <button 
              class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all {insightsStep === 1 ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(insightsTimeout); insightsStep = 1; }}
            >
              <span class="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
              Patrones
            </button>
            <ArrowRight size={14} class="text-gray-300 hidden sm:block" />
            <button 
              class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all {insightsStep === 2 ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(insightsTimeout); insightsStep = 2; }}
            >
              <span class="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">3</span>
              Predicción
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
                  alt="Segmentos de Clientes" 
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
                  alt="Patrones de Venta" 
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
                  alt="Predicciones Semanales" 
                  class="w-full h-full object-cover object-top"
                />
              </div>
            </div>
          </div>
          
          <!-- Feature description based on step -->
          <div class="mt-6 text-center">
            {#if insightsStep === 0}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Segmentos:</strong> Clientes agrupados automáticamente por hora del día, valor de canasta y preferencias de producto.
              </p>
            {:else if insightsStep === 1}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Patrones:</strong> Multiplicadores estacionales, distribución de categorías y mapa de calor de tráfico por hora.
              </p>
            {:else}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Predicciones:</strong> Pronóstico semanal con ingresos esperados, transacciones y horas pico por día.
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
              <h3 class="text-xl font-bold text-gray-800">Captura Inteligente de Facturas</h3>
              <p class="text-sm text-gray-500">Fotografía facturas y la IA extrae todos los datos automáticamente</p>
            </div>
          </div>
          
          <!-- Step Indicators -->
          <div class="flex items-center justify-center gap-1 sm:gap-2 mb-6 flex-wrap">
            <button 
              class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all {captureStep === 0 ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(captureTimeout); captureStep = 0; }}
            >
              <span class="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">1</span>
              Capturar
            </button>
            <ArrowRight size={14} class="text-gray-300 hidden sm:block" />
            <button 
              class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all {captureStep === 1 ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(captureTimeout); captureStep = 1; }}
            >
              <span class="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">2</span>
              Procesa
            </button>
            <ArrowRight size={14} class="text-gray-300 hidden sm:block" />
            <button 
              class="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all {captureStep === 2 ? 'bg-rose-500 text-white' : 'bg-gray-100 text-gray-600'}"
              on:click={() => { clearTimeout(captureTimeout); captureStep = 2; }}
            >
              <span class="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">3</span>
              Validar
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
                  alt="Opciones de Captura" 
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
                  alt="IA Procesando" 
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
                  alt="Validación de Factura" 
                  class="w-full h-full object-cover object-top"
                />
              </div>
            </div>
          </div>
          
          <!-- Feature description based on step -->
          <div class="mt-6 text-center">
            {#if captureStep === 0}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Paso 1:</strong> Toma una foto de la factura o sube una imagen desde tu galería.
              </p>
            {:else if captureStep === 1}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Paso 2:</strong> La IA analiza el documento, extrae proveedor, productos, cantidades y precios.
              </p>
            {:else}
              <p class="text-gray-600 animate-fadeIn">
                <strong class="text-gray-800">Paso 3:</strong> Revisa los datos extraídos, ajusta si es necesario y actualiza tu inventario con un click.
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
        <h3 class="text-2xl md:text-3xl font-bold text-gray-800 mb-3">Y mucho más por descubrir...</h3>
        <p class="text-gray-600 max-w-xl mx-auto mb-6">
          Punto de venta, gestión de empleados, reportes fiscales, múltiples sucursales, integraciones y cientos de funciones que se adaptan a tu negocio.
        </p>
        <button 
          on:click={scrollToTrialForm}
          class="inline-flex items-center gap-2 bg-gradient-to-r from-[#1E88E6] to-[#1565C0] text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg hover:shadow-xl hover:scale-105 transition-all"
        >
          Empieza tu prueba gratis
          <ArrowRight size={20} />
        </button>
      </div>
    </div>
  </section>

  <!-- Industries Section -->
  <section id="industrias" class="py-20 px-6 bg-white">
    <div class="max-w-5xl mx-auto">
      <div class="text-center mb-12">
        <h2 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Para Todo Tipo de Negocio</h2>
        <p class="text-xl text-gray-600 max-w-2xl mx-auto">¿Tu negocio es diferente? Exactamente por eso creamos Cuadra. Dinos qué necesitas y el sistema se adapta.</p>
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
        <h2 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Comparación Honesta</h2>
        <p class="text-xl text-gray-600">Paga un poco más. Obtén 10x más inteligencia.</p>
      </div>
      
      <!-- Comparison Table -->
      <div class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr>
              <th class="text-left p-4 bg-gray-50 rounded-tl-xl font-bold text-gray-700">Característica</th>
              <th class="text-center p-4 bg-gray-50 font-bold text-gray-500">Sistemas Tradicionales</th>
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

  <!-- Confiabilidad Operacional -->
  <section class="py-20 px-6 bg-[#BADBF7]/10 border-y border-[#8CC2F2]/30">
    <div class="max-w-5xl mx-auto">
      <div class="text-center mb-12">
        <h2 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Diseñado para la Realidad de tu Negocio</h2>
        <p class="text-xl text-gray-600">Otros sistemas requieren condiciones perfectas. Cuadra funciona en el mundo real.</p>
      </div>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Cumplimiento Fiscal -->
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 size={20} class="text-emerald-600" />
            </div>
            <h3 class="font-bold text-gray-800">Cumplimiento Fiscal Automático</h3>
          </div>
          <p class="text-sm text-gray-600">Facturas electrónicas, reportes fiscales, todo automático.</p>
        </div>

        <!-- Funciona offline -->
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <WifiOff size={20} class="text-blue-600" />
            </div>
            <h3 class="font-bold text-gray-800">Funciona sin internet</h3>
          </div>
          <p class="text-sm text-gray-600">Vende aunque se vaya la conexión. Todo se sincroniza cuando vuelve.</p>
        </div>

        <!-- Sincronización -->
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <RefreshCw size={20} class="text-purple-600" />
            </div>
            <h3 class="font-bold text-gray-800">Sincronización inteligente</h3>
          </div>
          <p class="text-sm text-gray-600">Cuando vuelva el internet, todo se actualiza solo.</p>
        </div>

        <!-- Múltiples puntos -->
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
              <Store size={20} class="text-amber-600" />
            </div>
            <h3 class="font-bold text-gray-800">Múltiples puntos de venta</h3>
          </div>
          <p class="text-sm text-gray-600">Sucursales, bodegas, vendedores móviles, todo conectado.</p>
        </div>

        <!-- Soporte dedicado -->
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center">
              <Headphones size={20} class="text-rose-600" />
            </div>
            <h3 class="font-bold text-gray-800">Soporte dedicado</h3>
          </div>
          <p class="text-sm text-gray-600">En español, que entiende tu negocio.</p>
        </div>

        <!-- Cualquier dispositivo -->
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-10 h-10 bg-cyan-100 rounded-xl flex items-center justify-center">
              <Monitor size={20} class="text-cyan-600" />
            </div>
            <h3 class="font-bold text-gray-800">Acceso desde cualquier dispositivo</h3>
          </div>
          <p class="text-sm text-gray-600">PC, tablet, celular, todo sincronizado.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Trial Form Section -->
  <section id="trial-form" class="py-24 px-6 bg-gradient-to-br from-[#1E88E6] to-[#1565C0]">
    <div class="max-w-4xl mx-auto">
      <div class="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 md:p-12">
        {#if formSubmitted}
          <!-- Success State -->
          <div class="text-center py-8">
            <div class="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 class="text-emerald-500" size={40} />
            </div>
            <h2 class="text-3xl font-bold text-gray-800 mb-4">¡Gracias por tu interés!</h2>
            <p class="text-xl text-gray-600 mb-2">Hemos recibido tu solicitud.</p>
            <p class="text-gray-500">Te contactaremos pronto para activar tu prueba gratuita.</p>
            <p class="text-sm text-gray-400 mt-6">Redirigiendo al login en unos segundos...</p>
          </div>
        {:else}
          <!-- Form -->
          <div class="text-center mb-8">
            <span class="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-bold mb-4">
              <Sparkles size={16} /> 14 días gratis, sin tarjeta
            </span>
            <h2 class="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-4">Comienza tu Prueba Gratis</h2>
            <p class="text-lg sm:text-xl text-gray-600">Completa el formulario y te ayudaremos a configurar tu cuenta.</p>
          </div>
          
          {#if formError}
            <div class="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-center">
              {formError}
            </div>
          {/if}
          
          <form on:submit|preventDefault={submitTrialForm} class="space-y-6">
            <div class="grid md:grid-cols-2 gap-4 sm:gap-6">
              <!-- Name -->
              <div>
                <label for="trial-name" class="block text-sm font-medium text-gray-700 mb-2">
                  Nombre completo <span class="text-red-500">*</span>
                </label>
                <input 
                  id="trial-name"
                  type="text" 
                  bind:value={trialForm.name}
                  placeholder="Tu nombre"
                  class="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#1E88E6] focus:ring-2 focus:ring-[#1E88E6]/20 outline-none transition-all"
                  required
                />
              </div>
              
              <!-- Email -->
              <div>
                <label for="trial-email" class="block text-sm font-medium text-gray-700 mb-2">
                  Email <span class="text-red-500">*</span>
                </label>
                <input 
                  id="trial-email"
                  type="email" 
                  bind:value={trialForm.email}
                  placeholder="tu@email.com"
                  class="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#1E88E6] focus:ring-2 focus:ring-[#1E88E6]/20 outline-none transition-all"
                  required
                />
              </div>
              
              <!-- Phone -->
              <div>
                <label for="trial-phone" class="block text-sm font-medium text-gray-700 mb-2">
                  Teléfono / WhatsApp
                </label>
                <input 
                  id="trial-phone"
                  type="tel" 
                  bind:value={trialForm.phone}
                  placeholder="+1 809 555 1234"
                  class="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#1E88E6] focus:ring-2 focus:ring-[#1E88E6]/20 outline-none transition-all"
                />
              </div>
              
              <!-- Business Name -->
              <div>
                <label for="trial-business" class="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del negocio <span class="text-red-500">*</span>
                </label>
                <input 
                  id="trial-business"
                  type="text" 
                  bind:value={trialForm.businessName}
                  placeholder="Mi Negocio"
                  class="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#1E88E6] focus:ring-2 focus:ring-[#1E88E6]/20 outline-none transition-all"
                  required
                />
              </div>
            </div>
            
            <!-- Business Type -->
            <div>
              <label for="trial-type" class="block text-sm font-medium text-gray-700 mb-2">
                Tipo de negocio
              </label>
              <select 
                id="trial-type"
                bind:value={trialForm.businessType}
                class="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-[#1E88E6] focus:ring-2 focus:ring-[#1E88E6]/20 outline-none transition-all bg-white"
              >
                <option value="">Selecciona una opción</option>
                <option value="minimarket">Minimarket / Colmado</option>
                <option value="retail">Tienda de Retail</option>
                <option value="restaurant">Restaurante / Cafetería</option>
                <option value="pharmacy">Farmacia</option>
                <option value="hardware">Ferretería</option>
                <option value="clothing">Tienda de Ropa</option>
                <option value="services">Servicios Profesionales</option>
                <option value="other">Otro</option>
              </select>
            </div>
            
            <!-- Submit Button -->
            <button 
              type="submit"
              disabled={isSubmitting}
              class="w-full bg-gradient-to-r from-[#1E88E6] to-[#1565C0] text-white py-4 rounded-xl font-bold text-lg hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
            >
              {#if isSubmitting}
                <svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Enviando...
              {:else}
                Comenzar mi prueba gratis
                <ArrowRight size={20} />
              {/if}
            </button>
            
            <!-- Trust badges -->
            <div class="flex flex-wrap justify-center gap-4 text-sm text-gray-500 pt-4">
              <span class="flex items-center gap-1"><CheckCircle2 size={14} class="text-emerald-500" /> Sin tarjeta de crédito</span>
              <span class="flex items-center gap-1"><CheckCircle2 size={14} class="text-emerald-500" /> Configuración asistida</span>
              <span class="flex items-center gap-1"><CheckCircle2 size={14} class="text-emerald-500" /> Cancela cuando quieras</span>
            </div>
          </form>
        {/if}
      </div>
    </div>
  </section>

  <!-- Pricing Section -->
  <section id="precios" class="py-24 px-6 bg-white">
    <div class="max-w-6xl mx-auto">
      <div class="text-center mb-12">
        <h2 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Precios Simples y Transparentes</h2>
        <p class="text-xl text-gray-600">Sin sorpresas. Sin contratos. Cancela cuando quieras.</p>
      </div>
      
      <div class="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        <!-- Plan Básico -->
        <div class="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm hover:shadow-lg transition-all">
          <div class="text-center mb-6">
            <h3 class="text-xl font-bold text-gray-800 mb-2">Plan Básico</h3>
            <p class="text-gray-500 text-sm">Perfecto para comenzar</p>
            <div class="mt-4">
              <span class="text-4xl font-bold text-gray-900">$35</span>
              <span class="text-gray-500">/mes</span>
            </div>
          </div>
          <ul class="space-y-3 mb-8">
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>1 punto de venta</span>
            </li>
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>POS + Inventario + Facturación</span>
            </li>
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>IA básica: predicción de stock</span>
            </li>
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>Hasta 1,000 productos</span>
            </li>
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>Reportes esenciales</span>
            </li>
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>Soporte por email</span>
            </li>
          </ul>
          <button 
            class="w-full py-3 rounded-full border-2 border-[#1E88E6] text-[#1E88E6] font-bold hover:bg-[#1E88E6] hover:text-white transition-all"
            on:click={scrollToTrialForm}
          >
            Comenzar gratis
          </button>
        </div>
        
        <!-- Plan Pro (Highlighted) -->
        <div class="bg-[#1E88E6] rounded-2xl p-8 shadow-xl relative transform md:-translate-y-4">
          <div class="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-gray-900 px-4 py-1 rounded-full text-sm font-bold">
            Más Popular
          </div>
          <div class="text-center mb-6">
            <h3 class="text-xl font-bold text-white mb-2">Plan Pro</h3>
            <p class="text-white/70 text-sm">Para negocios en crecimiento</p>
            <div class="mt-4">
              <span class="text-4xl font-bold text-white">$45</span>
              <span class="text-white/70">/mes</span>
            </div>
          </div>
          <ul class="space-y-3 mb-8">
            <li class="flex items-center gap-2 text-white text-sm">
              <Check size={16} class="text-amber-400 shrink-0" />
              <span>Hasta 3 puntos de venta</span>
            </li>
            <li class="flex items-center gap-2 text-white text-sm">
              <Check size={16} class="text-amber-400 shrink-0" />
              <span>Todo lo del plan Básico +</span>
            </li>
            <li class="flex items-center gap-2 text-white text-sm">
              <Check size={16} class="text-amber-400 shrink-0" />
              <span><strong>IA completa: 6 módulos activados</strong></span>
            </li>
            <li class="flex items-center gap-2 text-white text-sm">
              <Check size={16} class="text-amber-400 shrink-0" />
              <span>Productos ilimitados</span>
            </li>
            <li class="flex items-center gap-2 text-white text-sm">
              <Check size={16} class="text-amber-400 shrink-0" />
              <span><strong>Vibe Coding ilimitado</strong></span>
            </li>
            <li class="flex items-center gap-2 text-white text-sm">
              <Check size={16} class="text-amber-400 shrink-0" />
              <span>Múltiples sucursales</span>
            </li>
            <li class="flex items-center gap-2 text-white text-sm">
              <Check size={16} class="text-amber-400 shrink-0" />
              <span>Reportes avanzados</span>
            </li>
            <li class="flex items-center gap-2 text-white text-sm">
              <Check size={16} class="text-amber-400 shrink-0" />
              <span>Soporte prioritario</span>
            </li>
          </ul>
          <button 
            class="w-full py-3 rounded-full bg-white text-[#1E88E6] font-bold hover:bg-gray-100 transition-all"
            on:click={scrollToTrialForm}
          >
            Comenzar gratis
          </button>
        </div>
        
        <!-- Plan Empresarial -->
        <div class="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm hover:shadow-lg transition-all">
          <div class="text-center mb-6">
            <h3 class="text-xl font-bold text-gray-800 mb-2">Plan Empresarial</h3>
            <p class="text-gray-500 text-sm">Para operaciones complejas</p>
            <div class="mt-4">
              <span class="text-2xl font-bold text-gray-900">Personalizado</span>
            </div>
          </div>
          <ul class="space-y-3 mb-8">
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>Puntos de venta ilimitados</span>
            </li>
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>Personalización dedicada</span>
            </li>
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>API para integraciones</span>
            </li>
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>Capacitación incluida</span>
            </li>
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>Gerente de cuenta dedicado</span>
            </li>
            <li class="flex items-center gap-2 text-gray-600 text-sm">
              <Check size={16} class="text-emerald-500 shrink-0" />
              <span>SLA garantizado</span>
            </li>
          </ul>
          <button 
            class="w-full py-3 rounded-full border-2 border-[#1E88E6] text-[#1E88E6] font-bold hover:bg-[#1E88E6] hover:text-white transition-all"
            on:click={goToLogin}
          >
            Contactar ventas
          </button>
        </div>
      </div>
      
      <!-- All plans include -->
      <div class="mt-12 text-center">
        <p class="text-gray-600 mb-4 font-medium">Todos los planes incluyen:</p>
        <div class="flex flex-wrap justify-center gap-4 text-sm text-gray-500">
          <span class="flex items-center gap-1"><Check size={14} class="text-emerald-500" /> Prueba gratis 14 días</span>
          <span class="flex items-center gap-1"><Check size={14} class="text-emerald-500" /> Sin tarjeta de crédito</span>
          <span class="flex items-center gap-1"><Check size={14} class="text-emerald-500" /> Sin contratos</span>
          <span class="flex items-center gap-1"><Check size={14} class="text-emerald-500" /> Actualizaciones automáticas</span>
          <span class="flex items-center gap-1"><Check size={14} class="text-emerald-500" /> Backup diario</span>
        </div>
      </div>
    </div>
  </section>

  <!-- FAQ Section -->
  <section id="faq" class="py-20 px-6 bg-gray-50">
    <div class="max-w-3xl mx-auto">
      <div class="text-center mb-12">
        <h2 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Preguntas Frecuentes</h2>
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
      <h2 class="text-3xl md:text-4xl font-bold text-gray-800 mb-4">Garantía de Satisfacción</h2>
      <h3 class="text-xl text-[#1E88E6] font-bold mb-6">30 días de garantía o te devolvemos tu dinero</h3>
      <p class="text-lg text-gray-600 mb-6">
        Prueba Cuadra sin riesgo. Si en los primeros 30 días decides que no es para ti, te devolvemos el 100% de tu inversión. Sin preguntas.
      </p>
      <p class="text-gray-500">
        ¿Por qué? Porque estamos seguros que cuando pruebes la diferencia de tener IA trabajando para ti, no querrás volver a sistemas tradicionales.
      </p>
    </div>
  </section>

  <!-- Final CTA -->
  <section class="py-24 px-6 text-center bg-gradient-to-b from-white to-[#BADBF7]/20">
    <div class="max-w-3xl mx-auto">
      <h2 class="text-3xl md:text-5xl font-bold mb-4 text-[#1F2937]">¿Listo para gestionar tu negocio con inteligencia artificial?</h2>
      <p class="text-xl text-gray-600 mb-8">
        El futuro de los negocios no es solo registrar ventas. Es <strong>predecir demanda, optimizar precios, y automatizar decisiones</strong>.
      </p>
      <p class="text-lg text-[#1E88E6] font-bold mb-8">Cuadra te da esa inteligencia. Desde $35 al mes.</p>
      
      <div class="flex flex-col sm:flex-row justify-center gap-4 mb-6">
        <button 
          class="bg-[#1E88E6] hover:bg-[#1778CF] text-white text-base sm:text-xl px-6 sm:px-12 py-3 sm:py-5 rounded-full shadow-2xl shadow-[#1E88E6]/30 hover:shadow-[#1E88E6]/40 transition-all hover:scale-105 font-bold" 
          on:click={scrollToTrialForm}
        >
          Empieza tu prueba gratis
        </button>
        <button 
          class="bg-white hover:bg-gray-50 text-[#1E88E6] text-base sm:text-xl px-6 sm:px-12 py-3 sm:py-5 rounded-full shadow-lg border-2 border-[#1E88E6] transition-all hover:scale-105 font-bold" 
          on:click={scrollToTrialForm}
        >
          Agenda una demo personalizada
        </button>
      </div>
      <p class="text-gray-500 text-sm">Únete a los negocios que ya gestionan con inteligencia artificial.</p>
    </div>
  </section>

  <!-- Footer -->
  <footer class="py-12 px-6 bg-[#1F2937] text-white">
    <div class="max-w-6xl mx-auto">
      <!-- Trust Badges -->
      <div class="flex flex-wrap justify-center gap-6 mb-12 pb-12 border-b border-white/10">
        <div class="flex items-center gap-2 text-white/80 text-sm">
          <ShieldCheck size={16} class="text-emerald-400" />
          <span>Cumplimiento fiscal automático</span>
        </div>
        <div class="flex items-center gap-2 text-white/80 text-sm">
          <Lock size={16} class="text-purple-400" />
          <span>Datos encriptados y seguros</span>
        </div>
        <div class="flex items-center gap-2 text-white/80 text-sm">
          <RefreshCw size={16} class="text-amber-400" />
          <span>Backup automático diario</span>
        </div>
        <div class="flex items-center gap-2 text-white/80 text-sm">
          <Headphones size={16} class="text-rose-400" />
          <span>Soporte dedicado</span>
        </div>
        <div class="flex items-center gap-2 text-white/80 text-sm">
          <Sparkles size={16} class="text-cyan-400" />
          <span>Actualizaciones sin costo</span>
        </div>
        <div class="flex items-center gap-2 text-white/80 text-sm">
          <WifiOff size={16} class="text-blue-400" />
          <span>Funciona offline</span>
        </div>
      </div>
      
      <!-- Footer Content -->
      <div class="grid md:grid-cols-4 gap-8 mb-12">
        <!-- Logo & Description -->
        <div class="md:col-span-2">
          <img src="/cuadra_logo_white.png" alt="Cuadra" class="h-8 w-auto mb-4" />
          <p class="text-white/60 text-sm max-w-md">
            Software de facturación, inventario y POS con inteligencia artificial. Diseñado para negocios reales.
          </p>
        </div>
        
        <!-- Links -->
        <div>
          <h4 class="font-bold text-white mb-4">Producto</h4>
          <ul class="space-y-2 text-sm text-white/60">
            <li><a href="#funciones" class="hover:text-white transition-colors">Funciones</a></li>
            <li><a href="#industrias" class="hover:text-white transition-colors">Industrias</a></li>
            <li><a href="#precios" class="hover:text-white transition-colors">Precios</a></li>
            <li><a href="#faq" class="hover:text-white transition-colors">FAQ</a></li>
          </ul>
        </div>
        
        <!-- Contact -->
        <div>
          <h4 class="font-bold text-white mb-4">Contacto</h4>
          <ul class="space-y-2 text-sm text-white/60">
            <li>soporte@cuadrapos.com</li>
            <li>Santo Domingo, RD</li>
          </ul>
        </div>
      </div>
      
      <!-- Copyright -->
      <div class="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
        <p class="text-white/40 text-sm">© 2026 Cuadra. Todos los derechos reservados.</p>
        <div class="flex gap-6 text-sm text-white/40">
          <a href="#" class="hover:text-white transition-colors">Términos de Servicio</a>
          <a href="#" class="hover:text-white transition-colors">Política de Privacidad</a>
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

