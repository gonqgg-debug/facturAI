<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  /** Image source URL */
  export let src: string;
  
  /** Alt text for accessibility */
  export let alt: string;
  
  /** Optional width */
  export let width: number | string | undefined = undefined;
  
  /** Optional height */
  export let height: number | string | undefined = undefined;
  
  /** CSS class */
  let className: string = '';
  export { className as class };
  
  /** Placeholder image or blur hash */
  export let placeholder: string = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23e5e7eb" width="100" height="100"/%3E%3C/svg%3E';
  
  /** Loading strategy */
  export let loading: 'lazy' | 'eager' = 'lazy';
  
  /** Decode strategy */
  export let decoding: 'async' | 'sync' | 'auto' = 'async';
  
  /** Fetch priority */
  export let fetchpriority: 'high' | 'low' | 'auto' = 'auto';
  
  /** Threshold for intersection observer (0-1) */
  export let threshold: number = 0.1;
  
  /** Root margin for intersection observer */
  export let rootMargin: string = '50px';
  
  /** Callback when image loads */
  export let onLoad: (() => void) | undefined = undefined;
  
  /** Callback when image fails to load */
  export let onError: ((error: Error) => void) | undefined = undefined;

  let imageElement: HTMLImageElement;
  let isLoaded = false;
  let hasError = false;
  let isIntersecting = false;

  // Use native lazy loading if supported, otherwise fall back to IntersectionObserver
  $: shouldLoad = loading === 'eager' || isIntersecting;
  $: currentSrc = shouldLoad ? src : placeholder;

  onMount(() => {
    if (!browser) return;

    // Check if native lazy loading is supported
    const supportsNativeLazy = 'loading' in HTMLImageElement.prototype;

    if (loading === 'lazy' && !supportsNativeLazy) {
      // Use Intersection Observer for browsers without native lazy loading
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              isIntersecting = true;
              observer.disconnect();
            }
          });
        },
        {
          threshold,
          rootMargin
        }
      );

      if (imageElement) {
        observer.observe(imageElement);
      }

      return () => observer.disconnect();
    } else {
      // Native lazy loading is supported or eager loading requested
      isIntersecting = true;
    }
  });

  function handleLoad() {
    isLoaded = true;
    hasError = false;
    onLoad?.();
  }

  function handleError(event: Event) {
    hasError = true;
    isLoaded = false;
    const error = new Error(`Failed to load image: ${src}`);
    onError?.(error);
    console.error(error);
  }
</script>

<div 
  class="lazy-image-container relative overflow-hidden {className}"
  style:width={typeof width === 'number' ? `${width}px` : width}
  style:height={typeof height === 'number' ? `${height}px` : height}
>
  <!-- Placeholder shown while loading -->
  {#if !isLoaded && !hasError}
    <div 
      class="absolute inset-0 bg-muted animate-pulse"
      style:background-image={`url(${placeholder})`}
      style:background-size="cover"
      style:background-position="center"
    />
  {/if}

  <!-- Error state -->
  {#if hasError}
    <div class="absolute inset-0 flex items-center justify-center bg-muted text-muted-foreground">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  {/if}

  <!-- Actual image -->
  <img
    bind:this={imageElement}
    src={currentSrc}
    {alt}
    {width}
    {height}
    {loading}
    {decoding}
    {fetchpriority}
    on:load={handleLoad}
    on:error={handleError}
    class="w-full h-full object-cover transition-opacity duration-300 {isLoaded ? 'opacity-100' : 'opacity-0'}"
  />
</div>

<style>
  .lazy-image-container {
    display: block;
  }
</style>

