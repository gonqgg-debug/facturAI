<script lang="ts">
  import { loginWithPin, restoreSession } from '$lib/auth';
  import { goto } from '$app/navigation';
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import { db } from '$lib/db';
  import { User, Lock, ChevronLeft, Shield } from 'lucide-svelte';
  import { Input } from '$lib/components/ui/input';
  import { Button } from '$lib/components/ui/button';
  import { locale } from '$lib/stores';
  import { t } from '$lib/i18n';
  import type { User as UserType } from '$lib/types';
  import * as THREE from 'three';

  let pin = '';
  let error = '';
  let isDark = false;
  let isLoading = true;
  let users: UserType[] = [];
  let selectedUser: UserType | null = null;
  let isLoggingIn = false;
  let backgroundEl: HTMLDivElement | null = null;
  let cleanupBackground: (() => void) | null = null;

  onMount(() => {
    let mounted = true;

    const setupBackground = async () => {
      if (!browser) return;
      await tick();
      if (!mounted) return;
      if (backgroundEl && !cleanupBackground) {
        cleanupBackground = initWaveBackground(backgroundEl);
      }
    };
    setupBackground();

    const init = async () => {
      if (!browser) {
        isLoading = false;
        return;
      }

      isDark = document.documentElement.classList.contains('dark') ||
        localStorage.theme === 'dark' ||
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);

      if (isDark) {
        document.documentElement.classList.add('dark');
      }

      const hasSession = await restoreSession();
      if (!mounted) return;

      if (hasSession) {
        goto('/');
        return;
      }

      await loadUsers();
      if (!mounted) return;
      isLoading = false;
    };

    init();

    return () => {
      mounted = false;
      cleanupBackground?.();
    };
  });

  async function loadUsers() {
    if (!browser) return;
    users = await db.users.where('isActive').equals(1).toArray();
    
    // If there's only one user, auto-select them
    if (users.length === 1) {
      selectedUser = users[0];
    }
  }

  function selectUser(user: UserType) {
    selectedUser = user;
    pin = '';
    error = '';
  }

  function goBack() {
    selectedUser = null;
    pin = '';
    error = '';
  }

  async function handleLogin() {
    if (!pin) return;
    
    isLoggingIn = true;
    error = '';
    
    try {
      const user = await loginWithPin(pin);
      
      if (user) {
        // Successful login
        goto('/');
      } else {
        error = t('loginUser.wrongPin', $locale);
        pin = '';
      }
    } catch (e) {
      console.error('Login error:', e);
      error = t('common.error', $locale);
    } finally {
      isLoggingIn = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleLogin();
    // Allow only numbers for PIN
    if (!/^\d$/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
      e.preventDefault();
    }
  }
  
  function handlePinInput(e: Event) {
    const input = e.target as HTMLInputElement;
    // Remove non-numeric characters
    input.value = input.value.replace(/\D/g, '');
    pin = input.value;
  }

  function getUserInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  function getUserColor(id: number | undefined): string {
    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
      'bg-pink-500', 'bg-cyan-500', 'bg-yellow-500', 'bg-red-500'
    ];
    return colors[(id ?? 0) % colors.length];
  }

  function initWaveBackground(target: HTMLDivElement): () => void {
    if (!browser) return () => {};

    const GRID_SIZE = 140;
    const SPACING = 0.15;
    const REPEL_STRENGTH = 0.085;
    const RETURN_FORCE = 0.055;
    const DAMPING = 0.86;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.pointerEvents = 'none';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0xffffff, 1);
    target.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 0, 12);

    const geometry = new THREE.InstancedBufferGeometry();
    const instanceCount = GRID_SIZE * GRID_SIZE;
    geometry.instanceCount = instanceCount;

    const baseGeometry = new THREE.CircleGeometry(0.0024, 10);
    const basePosition = baseGeometry.getAttribute('position');
    geometry.setAttribute('position', basePosition.clone());
    if (baseGeometry.index) {
      geometry.setIndex(baseGeometry.index.clone());
    }
    baseGeometry.dispose();

    const offsets = new Float32Array(instanceCount * 3);
    let ptr = 0;
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        offsets[ptr++] = (x - GRID_SIZE / 2) * SPACING;
        offsets[ptr++] = (y - GRID_SIZE / 2) * SPACING;
        offsets[ptr++] = 0;
      }
    }
    const offsetAttr = new THREE.InstancedBufferAttribute(offsets, 3);
    geometry.setAttribute('instanceOffset', offsetAttr);

    const displacements = new Float32Array(instanceCount * 3);
    const displacementAttr = new THREE.InstancedBufferAttribute(displacements, 3);
    geometry.setAttribute('instanceDisplacement', displacementAttr);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }
      },
      transparent: true,
      depthWrite: false,
      vertexShader: `
        uniform float uTime;
        attribute vec3 instanceOffset;
        attribute vec3 instanceDisplacement;
        varying float vInfluence;

        float layer(vec2 p, float freq, float speed, float phase) {
          return sin(p.x * freq + uTime * speed + phase);
        }

        void main() {
          vec3 pos = instanceOffset;
          float w1 = layer(pos.xy, 0.42, 0.05, 0.0);
          float w2 = layer(pos.yx, 0.24, 0.035, 1.3);
          float w3 = layer(pos.xy + 1.2, 0.15, 0.02, 2.7);
          float w4 = layer(pos.xy * 0.6, 0.08, 0.012, 4.1);
          pos.z = (w1 + w2 * 0.7 + w3 * 0.6 + w4 * 0.5) * 0.04;

          pos += instanceDisplacement;
          vInfluence = smoothstep(0.0, 0.6, length(instanceDisplacement));
          float scale = 1.0 + vInfluence * 1.3;

          vec3 transformed = position * scale;
          vec4 mvPosition = modelViewMatrix * vec4(pos + transformed, 1.0);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        varying float vInfluence;
        void main() {
          float alpha = 0.75 + vInfluence * 0.25;
          gl_FragColor = vec4(vec3(0.07), alpha);
        }
      `
    });

    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2(0, 0);
    const pointerTarget = new THREE.Vector2(0, 0);
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const mousePosition = new THREE.Vector3(9999, 9999, 0);

    const velocities = new Float32Array(instanceCount * 3);
    let worldRepelRadius = 2;

    const updateRendererSize = () => {
      const width = target.clientWidth || window.innerWidth;
      const height = target.clientHeight || window.innerHeight;
      renderer.setSize(width, height, false);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const worldHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.z;
      worldRepelRadius = (180 / height) * worldHeight;
    };

    updateRendererSize();

    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(updateRendererSize)
      : null;

    if (resizeObserver) {
      resizeObserver.observe(target);
    } else {
      window.addEventListener('resize', updateRendererSize);
    }

    const handlePointerMove = (event: PointerEvent) => {
      const rect = target.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      pointerTarget.set(x, y);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerMove, { passive: true });

    let animationFrame = 0;
    let lastTime = performance.now();

    const animate = (now: number) => {
      animationFrame = requestAnimationFrame(animate);
      const delta = Math.min((now - lastTime) / 1000, 0.033);
      lastTime = now;
      material.uniforms.uTime.value += delta;

      pointer.lerp(pointerTarget, 0.25);
      raycaster.setFromCamera(pointer, camera);
      raycaster.ray.intersectPlane(plane, mousePosition);

      const timeScale = delta * 60;
      for (let idx = 0; idx < instanceCount; idx++) {
        const i3 = idx * 3;
        const worldX = offsets[i3] + displacements[i3];
        const worldY = offsets[i3 + 1] + displacements[i3 + 1];

        const dx = worldX - mousePosition.x;
        const dy = worldY - mousePosition.y;
        const dist = Math.hypot(dx, dy);

        if (dist < worldRepelRadius) {
          const invDist = dist === 0 ? 0 : 1 / dist;
          const force = (worldRepelRadius - dist) / worldRepelRadius;
          const strength = REPEL_STRENGTH * force * timeScale;
          velocities[i3] += dx * invDist * strength;
          velocities[i3 + 1] += dy * invDist * strength;
        }

        velocities[i3] += -displacements[i3] * RETURN_FORCE * timeScale;
        velocities[i3 + 1] += -displacements[i3 + 1] * RETURN_FORCE * timeScale;

        velocities[i3] *= Math.pow(DAMPING, timeScale);
        velocities[i3 + 1] *= Math.pow(DAMPING, timeScale);

        displacements[i3] += velocities[i3] * timeScale;
        displacements[i3 + 1] += velocities[i3 + 1] * timeScale;
      }

      displacementAttr.needsUpdate = true;
      renderer.render(scene, camera);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerMove);
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener('resize', updateRendererSize);
      }
      scene.remove(mesh);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === target) {
        target.removeChild(renderer.domElement);
      }
    };
  }
</script>

<style>
  .login-background {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    z-index: 0;
    pointer-events: none;
    background: #ffffff;
  }

  .login-background canvas {
    width: 100%;
    height: 100%;
    display: block;
  }

  .login-container {
    position: relative;
    z-index: 10;
  }
</style>

<div class="h-screen flex flex-col items-center justify-center bg-background p-4 transition-colors relative">
  <!-- Animated background -->
  <div class="login-background" bind:this={backgroundEl}></div>

  <!-- Login component -->
  <div class="login-container w-full max-w-sm bg-card border border-border rounded-2xl p-8 text-center shadow-2xl transition-colors">
    {#if isLoading}
      <!-- Loading State -->
      <div class="py-12">
        <div class="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p class="text-muted-foreground">{t('common.loading', $locale)}</p>
      </div>
    {:else if selectedUser}
      <!-- PIN Entry for Selected User -->
      <div class="mb-6">
        <Button 
          variant="ghost" 
          size="sm" 
          class="absolute top-4 left-4"
          on:click={goBack}
        >
          <ChevronLeft size={16} />
          <span class="ml-1">{$locale === 'es' ? 'Volver' : 'Back'}</span>
        </Button>
      </div>
      
      <!-- Selected User Avatar -->
      <div class="w-20 h-20 {getUserColor(selectedUser.id)} rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold shadow-lg">
        {getUserInitials(selectedUser.displayName)}
      </div>
      
      <h2 class="text-xl font-bold text-foreground mb-1">{selectedUser.displayName}</h2>
      <div class="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
        <Shield size={14} />
        <span>{selectedUser.roleName}</span>
      </div>
      
      <p class="text-muted-foreground mb-4">{t('loginUser.enterPin', $locale)}</p>
      
      <Input 
        type="password" 
        bind:value={pin}
        on:keydown={handleKeydown}
        on:input={handlePinInput}
        placeholder="• • • •" 
        class="h-14 text-center text-2xl tracking-[0.5em] bg-secondary rounded-xl mb-4 font-mono"
        maxlength="6"
        inputmode="numeric"
        pattern="[0-9]*"
        autofocus
      />
      
      {#if error}
        <p class="text-destructive text-sm mb-4 animate-in fade-in">{error}</p>
      {/if}
      
      <Button 
        on:click={handleLogin}
        class="w-full h-12 text-lg font-bold"
        disabled={pin.length < 4 || isLoggingIn}
      >
        {#if isLoggingIn}
          <div class="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full mr-2"></div>
        {:else}
          <Lock size={18} class="mr-2" />
        {/if}
        {t('login.unlock', $locale)}
      </Button>
      
    {:else if users.length > 0}
      <!-- User Selection -->
      <div class="w-48 h-48 mx-auto mb-6">
        <img src={isDark ? "/2.svg" : "/1.svg"} alt="Logo" class="w-full h-full object-contain" />
      </div>
      
      <p class="text-muted-foreground mb-6">{t('loginUser.selectUser', $locale)}</p>
      
      <div class="space-y-2 max-h-64 overflow-y-auto">
        {#each users as user}
          <button
            class="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all"
            on:click={() => selectUser(user)}
          >
            <div class="w-10 h-10 {getUserColor(user.id)} rounded-full flex items-center justify-center text-white font-bold shrink-0">
              {getUserInitials(user.displayName)}
            </div>
            <div class="flex-1 text-left">
              <div class="font-medium">{user.displayName}</div>
              <div class="text-xs text-muted-foreground flex items-center gap-1">
                <Shield size={10} />
                {user.roleName}
              </div>
            </div>
          </button>
        {/each}
      </div>
      
    {:else}
      <!-- No Users - Direct PIN entry (fallback) -->
      <div class="w-80 h-80 mx-auto mb-6">
        <img src={isDark ? "/2.svg" : "/1.svg"} alt="Logo" class="w-full h-full object-contain" />
      </div>
      
      <p class="text-muted-foreground mb-8">{t('login.enterAccessCode', $locale)}</p>
      
      <Input 
        type="password" 
        bind:value={pin} 
        on:keydown={handleKeydown}
        on:input={handlePinInput}
        placeholder={t('login.pin', $locale)} 
        class="h-12 text-center text-lg tracking-widest bg-secondary rounded-xl mb-4"
        maxlength="6"
        inputmode="numeric"
      />
      
      {#if error}
        <p class="text-destructive text-sm mb-4">{error}</p>
      {/if}
      
      <Button 
        on:click={handleLogin}
        class="w-full h-12 font-bold"
        disabled={pin.length < 4}
      >
        {t('login.unlock', $locale)}
      </Button>
    {/if}
  </div>
</div>
