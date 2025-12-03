/**
 * Lazy Component Loading Utilities
 * 
 * Provides utilities for lazy loading heavy components like charts,
 * PDF viewers, and OCR modules to improve initial page load performance.
 * 
 * @module lazy-components
 */

import { browser } from '$app/environment';
import { logger } from './logger';

/**
 * Loading state for lazy components
 */
export interface LazyLoadState<T> {
  loading: boolean;
  error: Error | null;
  module: T | null;
}

/**
 * Lazy load a module with error handling
 * 
 * @example
 * const { module: Chart } = await lazyLoadModule(() => import('layerchart'));
 */
export async function lazyLoadModule<T>(
  importFn: () => Promise<T>,
  retries = 3
): Promise<LazyLoadState<T>> {
  if (!browser) {
    return { loading: false, error: null, module: null };
  }

  const state: LazyLoadState<T> = {
    loading: true,
    error: null,
    module: null
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      state.module = await importFn();
      state.loading = false;
      return state;
    } catch (error) {
      logger.warn(`Lazy load attempt ${attempt}/${retries} failed:`, error);
      
      if (attempt === retries) {
        state.error = error instanceof Error ? error : new Error(String(error));
        state.loading = false;
      } else {
        // Exponential backoff before retry
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }
  }

  return state;
}

/**
 * Preload a module in the background
 * Useful for anticipating user navigation
 */
export function preloadModule(importFn: () => Promise<unknown>): void {
  if (!browser) return;

  // Use requestIdleCallback if available, otherwise setTimeout
  const schedule = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));
  
  schedule(() => {
    importFn().catch((error) => {
      logger.debug('Preload failed (non-critical):', error);
    });
  });
}

/**
 * Lazy load PDF.js with optimal configuration
 */
export async function loadPdfJs() {
  return lazyLoadModule(async () => {
    const pdfjs = await import('pdfjs-dist');
    
    // Configure worker
    if (browser) {
      const pdfjsWorker = await import('pdfjs-dist/build/pdf.worker.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
    }
    
    return pdfjs;
  });
}

/**
 * Lazy load Tesseract.js OCR engine
 */
export async function loadTesseract() {
  return lazyLoadModule(async () => {
    const Tesseract = await import('tesseract.js');
    return Tesseract;
  });
}

/**
 * Lazy load chart libraries
 */
export async function loadChartLibraries() {
  return lazyLoadModule(async () => {
    const [d3Scale, d3Shape, layerchart] = await Promise.all([
      import('d3-scale'),
      import('d3-shape'),
      import('layerchart')
    ]);
    
    return { d3Scale, d3Shape, layerchart };
  });
}

/**
 * Lazy load XLSX library for spreadsheet processing
 */
export async function loadXlsx() {
  return lazyLoadModule(async () => {
    const xlsx = await import('xlsx');
    return xlsx;
  });
}

/**
 * Lazy load Three.js for 3D graphics (if used)
 */
export async function loadThreeJs() {
  return lazyLoadModule(async () => {
    const THREE = await import('three');
    return THREE;
  });
}

/**
 * Lazy load Fuse.js for fuzzy search
 */
export async function loadFuseJs() {
  return lazyLoadModule(async () => {
    const Fuse = await import('fuse.js');
    return Fuse.default || Fuse;
  });
}

/**
 * Create an intersection observer for lazy loading
 * Triggers callback when element comes into view
 */
export function createLazyObserver(
  callback: () => void,
  options: IntersectionObserverInit = {}
): IntersectionObserver | null {
  if (!browser || !('IntersectionObserver' in window)) {
    // Fallback: execute immediately
    callback();
    return null;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          callback();
          observer.disconnect();
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '100px',
      ...options
    }
  );

  return observer;
}

/**
 * Prefetch critical assets during idle time
 */
export function prefetchCriticalAssets(urls: string[]): void {
  if (!browser) return;

  const schedule = window.requestIdleCallback || ((fn) => setTimeout(fn, 1));
  
  schedule(() => {
    urls.forEach((url) => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      link.as = url.endsWith('.js') ? 'script' : 
                url.endsWith('.css') ? 'style' : 
                url.endsWith('.woff2') ? 'font' : 'fetch';
      document.head.appendChild(link);
    });
  });
}

/**
 * Load script dynamically with promise
 */
export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!browser) {
      resolve();
      return;
    }

    // Check if already loaded
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
}

/**
 * Preconnect to external domains for faster resource loading
 */
export function preconnectToDomains(domains: string[]): void {
  if (!browser) return;

  domains.forEach((domain) => {
    // Preconnect
    const preconnect = document.createElement('link');
    preconnect.rel = 'preconnect';
    preconnect.href = domain;
    preconnect.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect);

    // DNS prefetch as fallback
    const dnsPrefetch = document.createElement('link');
    dnsPrefetch.rel = 'dns-prefetch';
    dnsPrefetch.href = domain;
    document.head.appendChild(dnsPrefetch);
  });
}

// Preconnect to commonly used domains on load
if (browser) {
  preconnectToDomains([
    'https://cdn.jsdelivr.net',       // CDN libraries
    'https://tessdata.projectnaptha.com', // Tesseract data
    'https://api.x.ai',               // Grok API
    'https://api.openweathermap.org'  // Weather API
  ]);
}

