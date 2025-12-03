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
  <title>Cuadra - El POS para minimarkets que se adapta a tu negocio</title>
  <meta name="description" content="Automatiza inventario y compras. Cumple con fiscal. Funciona offline. Con IA opcional que aprende de ti." />
</svelte:head>

<div class="min-h-screen bg-white text-[#1F2937] font-sans selection:bg-[#BADBF7] selection:text-[#0D4373]">
  
  <!-- Navbar -->
  <nav class="fixed top-0 w-full bg-white/90 backdrop-blur-md z-50 border-b border-[#BADBF7]/50">
    <div class="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <img src="/cuadra_logo.png" alt="Cuadra" class="h-7 sm:h-8 w-auto" />
      </div>
      <div class="flex items-center gap-2 sm:gap-4">
        <button on:click={goToLogin} class="hidden sm:block text-[#1F2937]/80 hover:text-[#1E88E6] font-medium transition-colors">Entrar</button>
        <button on:click={goToLogin} class="bg-[#1E88E6] text-white hover:bg-[#1778CF] rounded-full px-4 sm:px-6 py-1.5 sm:py-2 text-sm sm:text-base font-medium transition-colors">Prueba gratis</button>
        <a href="/en" class="text-xs text-[#1F2937]/40 hover:text-[#1E88E6] transition-colors ml-1">EN</a>
      </div>
    </div>
  </nav>

  <!-- Hero -->
  <header class="pt-32 pb-20 px-6 bg-gradient-to-b from-[#BADBF7]/20 to-white">
    <div class="max-w-4xl mx-auto text-center">
      <!-- Headline -->
      <h1 class="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 text-[#1F2937] leading-[1.1]">
        El POS para minimarkets <br />
        que se adapta a tu negocio
      </h1>
      
      <!-- Subheadline -->
      <p class="text-xl md:text-2xl text-[#1E88E6] font-medium max-w-3xl mx-auto mb-6 leading-relaxed">
        Automatiza inventario y compras. Cumple con fiscal. Funciona offline. Con IA opcional que aprende de ti.
      </p>

      <!-- Trust Badges -->
      <div class="flex flex-wrap justify-center gap-4 mb-10">
        <div class="flex items-center gap-2 bg-[#BADBF7]/30 px-4 py-2 rounded-full text-sm font-medium text-[#0D4373]">
          <Shield size={16} />
          <span>Offline-first</span>
        </div>
        <div class="flex items-center gap-2 bg-[#BADBF7]/30 px-4 py-2 rounded-full text-sm font-medium text-[#0D4373]">
          <Package size={16} />
          <span>Multibodega</span>
        </div>
        <div class="flex items-center gap-2 bg-[#BADBF7]/30 px-4 py-2 rounded-full text-sm font-medium text-[#0D4373]">
          <Globe size={16} />
          <span>Fiscal: RD, MX, CO, PE, CL</span>
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
          class="bg-[#1E88E6] hover:bg-[#1778CF] text-white text-xl px-10 py-5 rounded-full shadow-xl shadow-[#1E88E6]/25 transition-all hover:scale-105 font-bold" 
          on:click={goToLogin}
        >
          Ver demo de 2 minutos
        </button>
        <button 
          class="bg-white hover:bg-gray-50 text-[#1E88E6] text-xl px-10 py-5 rounded-full shadow-lg border-2 border-[#1E88E6] transition-all hover:scale-105 font-bold" 
          on:click={goToLogin}
        >
          Solicitar demostración
        </button>
      </div>
      <p class="text-center text-gray-500 text-sm mt-6">Desde $29/mes. Migración y soporte incluidos.</p>
    </div>
  </header>

  <!-- Origin Story -->
  <section class="py-20 px-6 bg-[#BADBF7]/10 border-y border-[#8CC2F2]/30">
    <div class="max-w-3xl mx-auto text-center">
      <p class="text-xl md:text-2xl leading-relaxed text-[#1F2937]/80 font-medium">
        "Porque los sistemas existentes nunca entendieron la realidad latinoamericana, lo construimos desde cero en una tienda real. Hoy está en beta cerrada con los primeros comercios que están experimentando el cambio."
      </p>
    </div>
  </section>

  <!-- Mini-Market Pain Points -->
  <section class="py-20 px-6 bg-white">
    <div class="max-w-5xl mx-auto">
      <h2 class="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-800">Diseñado para los dolores reales del minimarket</h2>
      <p class="text-center text-gray-600 mb-12 max-w-2xl mx-auto">Entendemos cómo funciona tu negocio porque lo construimos en uno real.</p>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <!-- SKUs unificados -->
        <div class="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-[#1E88E6]/30 hover:shadow-lg transition-all">
          <div class="w-12 h-12 bg-[#BADBF7]/50 rounded-xl flex items-center justify-center mb-4">
            <Layers size={24} class="text-[#1E88E6]" />
          </div>
          <h3 class="font-bold text-gray-800 mb-2">SKUs unificados</h3>
          <p class="text-sm text-gray-600">Mismo producto, diferentes nombres de proveedor — el sistema los unifica automáticamente.</p>
        </div>

        <!-- Sugerencias de compra -->
        <div class="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-[#1E88E6]/30 hover:shadow-lg transition-all">
          <div class="w-12 h-12 bg-[#BADBF7]/50 rounded-xl flex items-center justify-center mb-4">
            <Calculator size={24} class="text-[#1E88E6]" />
          </div>
          <h3 class="font-bold text-gray-800 mb-2">Sugerencias de compra</h3>
          <p class="text-sm text-gray-600">Basado en tu historial de ventas, te sugerimos qué pedir y cuándo.</p>
        </div>

        <!-- Control de mermas -->
        <div class="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-[#1E88E6]/30 hover:shadow-lg transition-all">
          <div class="w-12 h-12 bg-[#BADBF7]/50 rounded-xl flex items-center justify-center mb-4">
            <AlertTriangle size={24} class="text-[#1E88E6]" />
          </div>
          <h3 class="font-bold text-gray-800 mb-2">Control de mermas</h3>
          <p class="text-sm text-gray-600">Registra pérdidas y ajustes de inventario fácilmente. Sabe qué se pierde y por qué.</p>
        </div>

        <!-- Conciliación de caja -->
        <div class="bg-gray-50 rounded-2xl p-6 border border-gray-100 hover:border-[#1E88E6]/30 hover:shadow-lg transition-all">
          <div class="w-12 h-12 bg-[#BADBF7]/50 rounded-xl flex items-center justify-center mb-4">
            <Wallet size={24} class="text-[#1E88E6]" />
          </div>
          <h3 class="font-bold text-gray-800 mb-2">Conciliación de caja</h3>
          <p class="text-sm text-gray-600">Cuadra efectivo, transferencias y tarjetas en un solo lugar.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- 6 AI Superpowers -->
  <section class="py-24 px-6 bg-white">
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-800">Procesos clave asistidos por IA</h2>
      <p class="text-center text-gray-600 mb-12 max-w-2xl mx-auto">Automatiza lo repetitivo. Recibe sugerencias inteligentes donde más importa.</p>
      
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <!-- Card 1: Smart Pricing -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-purple-200 hover:shadow-purple-200 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 group-hover:from-purple-100 to-transparent rounded-bl-full -mr-8 -mt-8 transition-all duration-500 group-hover:scale-110"></div>
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-purple-100 group-hover:text-purple-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-purple-100 group-hover:scale-110 transition-all duration-300">
            <TrendingUp size={24} class="group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform duration-500" />
          </div>
          <h3 class="text-2xl font-bold mb-3 text-gray-900">Precios Recomendados</h3>
          <p class="text-gray-600 text-sm mb-6">Te sugiere ajustes de precio basados en costos, competencia y márgenes. Tú revisas y apruebas cada cambio.</p>
          
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
              +10% Margen
            </div>
          </div>

        </div>

        <!-- Card 2: Predictive Purchasing -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-emerald-200 hover:shadow-emerald-200 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 group-hover:from-emerald-100 to-transparent rounded-bl-full -mr-8 -mt-8 transition-all duration-500 group-hover:scale-110"></div>
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-emerald-100 group-hover:text-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-emerald-100 group-hover:scale-110 transition-all duration-300">
            <ShoppingCart size={24} class="group-hover:rotate-12 transition-transform duration-500" />
          </div>
          <h3 class="text-2xl font-bold mb-3 text-gray-900">Sugerencias de Compra</h3>
          <p class="text-gray-600 text-sm mb-6">Basado en ventas pasadas, te sugerimos qué pedir y cuánto. Tú decides si generar el pedido.</p>
          
          <!-- Animated Visual: Stock Alert -->
          <div class="bg-blue-50/50 rounded-xl p-3 mb-6 border border-blue-100 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-colors duration-300">
            <div class="flex justify-between items-center mb-2">
              <span class="text-xs font-medium text-gray-600">Leche Entera</span>
              <span class="text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full group-hover:text-emerald-600 group-hover:bg-emerald-200 transition-colors duration-500">
                <span class="group-hover:hidden">Stock Bajo</span>
                <span class="hidden group-hover:inline">Pedido Generado</span>
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
          <h3 class="text-2xl font-bold mb-3 text-gray-900">Reconocimiento de Facturas</h3>
          <p class="text-gray-600 text-sm mb-6">Fotografía cualquier factura de proveedor. El sistema extrae los datos y tú revisas antes de confirmar.</p>
          
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
          <h3 class="text-2xl font-bold mb-3 text-gray-900">Historial de Clientes</h3>
          <p class="text-gray-600 text-sm mb-6">Ve quién compra qué y cuándo. Identifica tus mejores clientes y decide si ofrecer promociones.</p>
          
          <!-- Animated Visual: Customer Segmentation -->
          <div class="bg-blue-50/50 rounded-xl p-3 mb-6 border border-blue-100 group-hover:bg-amber-50 group-hover:border-amber-100 flex items-center justify-between transition-colors duration-300">
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 shadow-sm">JP</div>
              <div class="flex flex-col">
                <span class="text-xs font-medium text-gray-600">Juan Perez</span>
                <span class="text-[10px] bg-white border border-gray-100 text-gray-500 px-1.5 rounded group-hover:bg-amber-500 group-hover:text-white group-hover:border-amber-500 transition-all duration-500 shadow-sm">Regular</span>
              </div>
            </div>
            
            <!-- Action Button Appearing -->
            <button class="opacity-50 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-500 bg-green-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1">
              <MessageCircle size={10} /> Enviar Promo
            </button>
          </div>

        </div>

        <!-- Card 5: Sales Forecast -->
        <div class="bg-white rounded-3xl border border-blue-100 p-8 shadow-sm hover:shadow-xl hover:border-pink-200 hover:shadow-pink-200 transition-all duration-300 group hover:-translate-y-2 relative overflow-hidden">
          <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-50 group-hover:from-pink-100 to-transparent rounded-bl-full -mr-8 -mt-8 transition-all duration-500 group-hover:scale-110"></div>
          <div class="w-12 h-12 bg-blue-50 text-[#1E88E6] group-hover:bg-pink-100 group-hover:text-pink-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-50 group-hover:shadow-pink-100 group-hover:scale-110 transition-all duration-300">
            <TrendingUp size={24} class="group-hover:scale-110 transition-transform duration-500" />
          </div>
          <h3 class="text-2xl font-bold mb-3 text-gray-900">Tendencias de Venta</h3>
          <p class="text-gray-600 text-sm mb-6">Compara semanas, detecta patrones y anticípate a la demanda con datos de tu propio negocio.</p>
          
          <!-- Animated Visual: Forecast Chart -->
          <div class="bg-blue-50/50 rounded-xl p-3 mb-6 border border-blue-100 group-hover:bg-pink-50 group-hover:border-pink-100 relative h-[60px] flex items-end gap-1 overflow-hidden transition-colors duration-300">
             <!-- Bars -->
             <div class="w-1/5 bg-gray-200 group-hover:bg-pink-300 h-[40%] rounded-t-sm transition-colors duration-500"></div>
             <div class="w-1/5 bg-gray-200 group-hover:bg-pink-300 h-[60%] rounded-t-sm transition-colors duration-500 delay-75"></div>
             <div class="w-1/5 bg-gray-300 group-hover:bg-pink-400 h-[50%] rounded-t-sm transition-colors duration-500 delay-150"></div>
             <div class="w-1/5 bg-gray-400 group-hover:bg-pink-500 h-[75%] rounded-t-sm relative group/bar transition-colors duration-500 delay-200">
                <div class="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity">Hoy</div>
             </div>
             <!-- Forecast Bar (Animated) -->
             <div class="w-1/5 bg-[#1E88E6] group-hover:bg-pink-600 h-0 group-hover:h-[90%] transition-all duration-1000 ease-out rounded-t-sm relative border-t-2 border-dashed border-white/50 delay-300">
               <div class="absolute -top-8 right-0 bg-pink-600 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-opacity delay-700 whitespace-nowrap">
                 +20% Mañana
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
          
          <h3 class="text-2xl font-bold mb-3 text-gray-900">Configuración Personalizada</h3>
          <p class="text-gray-600 text-sm mb-6">El sistema se ajusta a tus procesos. La IA sugiere mejoras basadas en cómo trabajas — tú decides qué aceptar.</p>
          
          <!-- Animated Visual: Prompt to UI -->
          <div class="bg-blue-50/50 rounded-xl p-3 mb-6 border border-blue-100 group-hover:bg-cyan-50 group-hover:border-cyan-100 flex flex-col gap-2 transition-colors duration-300">
            <!-- Input Box -->
            <div class="bg-white border border-gray-200 group-hover:border-cyan-200 rounded px-2 py-1.5 text-[10px] text-gray-400 flex items-center gap-1 shadow-sm relative overflow-hidden transition-colors">
              <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
              <span class="w-1 h-1 rounded-full bg-[#1E88E6] group-hover:bg-cyan-400 transition-colors"></span>
              <span class="group-hover:hidden">Pide tu cambio...</span>
              <span class="hidden group-hover:inline-block text-gray-600 animate-[typing_2.5s_steps(30)_infinite]">Agregar botón de 'Fiado'...</span>
            </div>
            
            <!-- Transformation Arrow -->
            <div class="flex justify-center opacity-0 group-hover:opacity-100 transition-opacity delay-500 h-4">
               <ArrowRight size={12} class="text-cyan-500 rotate-90" />
            </div>
            
            <!-- Result UI Element -->
            <div class="bg-white border border-gray-200 rounded p-2 shadow-sm opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500 delay-1000 flex items-center justify-center gap-2">
              <div class="h-6 bg-indigo-500 text-white text-[10px] font-bold px-3 rounded flex items-center justify-center shadow-md w-full">
                 <span class="mr-1">📝</span> Fiado
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
      <h2 class="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-800">Confiabilidad que tu negocio necesita</h2>
      <p class="text-center text-gray-600 mb-12 max-w-2xl mx-auto">Diseñado para funcionar en las condiciones reales de Latinoamérica.</p>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <!-- Offline-first -->
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all text-center">
          <div class="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <WifiOff size={28} class="text-emerald-600" />
          </div>
          <h3 class="font-bold text-gray-800 mb-2">Funciona sin internet</h3>
          <p class="text-sm text-gray-600">Sigue vendiendo aunque se vaya la conexión. Se sincroniza cuando vuelve.</p>
        </div>

        <!-- Hardware compatible -->
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all text-center">
          <div class="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Printer size={28} class="text-blue-600" />
          </div>
          <h3 class="font-bold text-gray-800 mb-2">Hardware compatible</h3>
          <p class="text-sm text-gray-600">Impresoras fiscales, lectores de código, cajas y terminales de pago.</p>
        </div>

        <!-- Datos seguros -->
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all text-center">
          <div class="w-14 h-14 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock size={28} class="text-purple-600" />
          </div>
          <h3 class="font-bold text-gray-800 mb-2">Datos seguros</h3>
          <p class="text-sm text-gray-600">Respaldos automáticos. Auditoría de cada transacción. Tus datos protegidos.</p>
        </div>

        <!-- Cumplimiento fiscal -->
        <div class="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all text-center">
          <div class="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Receipt size={28} class="text-amber-600" />
          </div>
          <h3 class="font-bold text-gray-800 mb-2">Cumplimiento fiscal</h3>
          <p class="text-sm text-gray-600">Compatible con normativas de RD, México, Colombia, Perú y Chile.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- The Real Magic -->
  <section class="py-24 px-6 bg-white overflow-hidden relative">
    <div class="max-w-4xl mx-auto relative z-10">
      <div class="text-center mb-12">
        <h2 class="text-3xl md:text-4xl font-bold mb-4 leading-tight text-gray-800">Configuramos tu flujo por ti</h2>
        <p class="text-gray-600 max-w-xl mx-auto">La IA aprende de tu negocio y te sugiere mejoras — tú decides qué aceptar.</p>
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
                <span class="font-bold text-gray-800 uppercase text-xs tracking-wider">Nueva pantalla creada</span>
                <span class="text-emerald-600 flex items-center gap-2 text-sm font-bold"><CheckCircle2 size={16} /> Activo</span>
              </div>
              <div class="grid grid-cols-3 gap-4">
                <div class="h-24 bg-gradient-to-br from-blue-100 to-blue-50 border-2 border-blue-300 rounded-lg flex flex-col items-center justify-center gap-2 text-blue-700 hover:scale-105 transition-all cursor-pointer shadow-sm">
                  <Scan size={24} class="text-blue-600" />
                  <span class="text-xs font-bold">Escanear Entrada</span>
                </div>
                <div class="h-24 bg-gradient-to-br from-emerald-100 to-emerald-50 border-2 border-emerald-300 rounded-lg flex flex-col items-center justify-center gap-2 text-emerald-700 hover:scale-105 transition-all cursor-pointer shadow-sm">
                  <BarChart3 size={24} class="text-emerald-600" />
                  <span class="text-xs font-bold">Inventario</span>
                </div>
                <div class="h-24 bg-gradient-to-br from-amber-100 to-amber-50 border-2 border-amber-300 rounded-lg flex flex-col items-center justify-center gap-2 text-amber-700 hover:scale-105 transition-all cursor-pointer shadow-sm">
                  <CreditCard size={24} class="text-amber-600" />
                  <span class="text-xs font-bold">Pago Rápido</span>
                </div>
              </div>
            </div>
          {/if}
        </div>
      </div>

      <div class="text-center">
        <p class="text-2xl md:text-4xl font-bold text-gray-800 leading-tight">
          En segundos tu sistema funciona exactamente como TÚ. <br />
          <span class="text-[#1E88E6]">Tú das el OK final.</span>
        </p>
      </div>
    </div>
  </section>

  <!-- Final CTA -->
  <section class="py-32 px-6 text-center bg-gradient-to-b from-white to-[#BADBF7]/20">
    <div class="max-w-3xl mx-auto">
      <h2 class="text-4xl md:text-6xl font-bold mb-6 text-[#1F2937]">¿Listo para simplificar tu negocio?</h2>
      <div class="flex flex-wrap justify-center gap-6 text-lg text-[#1F2937]/70 font-medium mb-12">
        <span>Migración incluida</span>
        <span class="text-[#8CC2F2]">•</span>
        <span>Soporte personalizado</span>
        <span class="text-[#8CC2F2]">•</span>
        <span>Cancela cuando quieras</span>
      </div>
      
      <div class="flex flex-col sm:flex-row justify-center gap-4 mb-6">
        <button 
          class="bg-[#1E88E6] hover:bg-[#1778CF] text-white text-xl px-12 py-5 rounded-full shadow-2xl shadow-[#1E88E6]/30 hover:shadow-[#1E88E6]/40 transition-all hover:scale-105 font-bold" 
          on:click={goToLogin}
        >
          Ver demo de 2 minutos
        </button>
        <button 
          class="bg-white hover:bg-gray-50 text-[#1E88E6] text-xl px-12 py-5 rounded-full shadow-lg border-2 border-[#1E88E6] transition-all hover:scale-105 font-bold" 
          on:click={goToLogin}
        >
          Solicitar demostración guiada
        </button>
      </div>
      <p class="text-gray-500">Desde $29/mes. Instalación y capacitación incluidas.</p>
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

