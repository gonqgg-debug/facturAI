/**
 * Performance Configuration and Monitoring
 * 
 * Centralized performance configuration including budgets,
 * monitoring utilities, and optimization helpers.
 * 
 * @module performance
 */

import { browser } from '$app/environment';
import { logger } from './logger';
import type { PerformanceBudget, MetricName } from './web-vitals';

/**
 * Performance budgets for the application
 * Based on Google's Core Web Vitals recommendations
 */
export const PERFORMANCE_BUDGETS: PerformanceBudget = {
  // Core Web Vitals
  LCP: 2500,    // Largest Contentful Paint - Target: ≤2.5s
  FID: 100,     // First Input Delay - Target: ≤100ms
  CLS: 0.1,     // Cumulative Layout Shift - Target: ≤0.1
  INP: 200,     // Interaction to Next Paint - Target: ≤200ms
  
  // Additional metrics
  FCP: 1800,    // First Contentful Paint - Target: ≤1.8s
  TTFB: 800     // Time to First Byte - Target: ≤800ms
};

/**
 * Bundle size budgets (in KB)
 */
export const BUNDLE_SIZE_BUDGETS = {
  // Main bundle
  main: 200,
  
  // Individual chunk limits
  vendor: {
    svelte: 50,
    dexie: 100,
    charts: 150,
    pdf: 300,
    ocr: 500,
    utils: 50,
    xlsx: 200,
    sentry: 100
  },
  
  // Total JavaScript budget
  totalJs: 1000,
  
  // Total CSS budget
  totalCss: 100,
  
  // Total assets (images, fonts, etc.)
  totalAssets: 500
};

/**
 * Resource hints configuration
 */
export const RESOURCE_HINTS = {
  // Domains to preconnect to
  preconnect: [
    'https://cdn.jsdelivr.net',
    'https://api.x.ai',
    'https://api.openweathermap.org'
  ],
  
  // Critical resources to preload
  preload: [
    // Fonts
    { href: '/fonts/inter-var.woff2', as: 'font', type: 'font/woff2' }
  ],
  
  // Resources to prefetch for likely navigation
  prefetch: [
    '/sales',
    '/catalog',
    '/invoices'
  ]
};

/**
 * Image optimization settings
 */
export const IMAGE_OPTIMIZATION = {
  // Default quality for JPEG/WebP
  quality: 80,
  
  // Lazy load threshold (pixels from viewport)
  lazyLoadThreshold: 100,
  
  // Maximum dimensions for responsive images
  maxWidth: 1920,
  maxHeight: 1080,
  
  // Supported formats (in order of preference)
  formats: ['avif', 'webp', 'jpg'] as const,
  
  // Responsive breakpoints
  breakpoints: [320, 640, 768, 1024, 1280, 1536]
};

/**
 * Animation performance settings
 */
export const ANIMATION_CONFIG = {
  // Prefer reduced motion
  respectReducedMotion: true,
  
  // Default animation duration (ms)
  duration: 200,
  
  // Easing functions
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)'
  },
  
  // Will-change hints for common animations
  willChange: {
    transform: 'transform',
    opacity: 'opacity',
    both: 'transform, opacity'
  }
};

/**
 * Caching strategies
 */
export const CACHE_CONFIG = {
  // Static assets (images, fonts, etc.)
  staticAssets: {
    maxAge: 60 * 60 * 24 * 365, // 1 year
    staleWhileRevalidate: 60 * 60 * 24 * 7 // 7 days
  },
  
  // API responses
  api: {
    maxAge: 60 * 5, // 5 minutes
    staleWhileRevalidate: 60 * 60 // 1 hour
  },
  
  // HTML pages
  html: {
    maxAge: 0,
    staleWhileRevalidate: 60 * 60 * 24 // 24 hours
  }
};

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (!browser) return false;
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  } catch {
    return false;
  }
}

/**
 * Check if device has slow connection
 */
export function hasSlowConnection(): boolean {
  if (!browser) return false;
  
  const connection = (navigator as Navigator & { connection?: { effectiveType?: string; saveData?: boolean } }).connection;
  
  if (!connection) return false;
  
  // Check for save-data preference
  if (connection.saveData) return true;
  
  // Check connection type
  const slowTypes = ['slow-2g', '2g', '3g'];
  return slowTypes.includes(connection.effectiveType || '');
}

/**
 * Check if device is low-end
 */
export function isLowEndDevice(): boolean {
  if (!browser) return false;
  
  // Check hardware concurrency (CPU cores)
  const cores = navigator.hardwareConcurrency || 4;
  if (cores <= 2) return true;
  
  // Check device memory if available
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (memory && memory <= 2) return true;
  
  return false;
}

/**
 * Get optimal image quality based on device/connection
 */
export function getOptimalImageQuality(): number {
  if (hasSlowConnection() || isLowEndDevice()) {
    return 60; // Lower quality for constrained environments
  }
  return IMAGE_OPTIMIZATION.quality;
}

/**
 * Measure and log performance of a function
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => T | Promise<T>
): Promise<T> {
  const start = performance.now();
  
  try {
    const result = await fn();
    const duration = performance.now() - start;
    
    logger.debug(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
    
    // Log warning if operation is slow
    if (duration > 100) {
      logger.warn(`[Performance] Slow operation: ${name} took ${duration.toFixed(2)}ms`);
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    logger.error(`[Performance] ${name} failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
}

/**
 * Debounce function for performance
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle function for performance
 */
export function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let lastRun = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastRun >= limit) {
      lastRun = now;
      fn(...args);
    }
  };
}

/**
 * Request idle callback with fallback
 */
export function requestIdleCallback(
  callback: () => void,
  options: { timeout?: number } = {}
): number {
  if (!browser) return 0;
  
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, options);
  }
  
  // Fallback to setTimeout
  return window.setTimeout(callback, options.timeout || 1) as unknown as number;
}

/**
 * Cancel idle callback
 */
export function cancelIdleCallback(id: number): void {
  if (!browser) return;
  
  if ('cancelIdleCallback' in window) {
    window.cancelIdleCallback(id);
  } else {
    window.clearTimeout(id);
  }
}

/**
 * Defer non-critical work until browser is idle
 */
export function deferWork(fn: () => void): void {
  requestIdleCallback(fn, { timeout: 2000 });
}

/**
 * Check performance budget violations
 */
export function checkBudgetViolation(
  metric: MetricName,
  value: number
): { violated: boolean; budget: number; excess: number } {
  const budget = PERFORMANCE_BUDGETS[metric];
  const violated = value > budget;
  const excess = violated ? value - budget : 0;
  
  return { violated, budget, excess };
}

/**
 * Get performance report for current session
 */
export interface PerformanceReport {
  timestamp: number;
  url: string;
  metrics: Record<string, number>;
  violations: { metric: string; value: number; budget: number }[];
  deviceInfo: {
    cores: number;
    memory?: number;
    connection?: string;
    reducedMotion: boolean;
  };
}

export function generatePerformanceReport(): PerformanceReport {
  const report: PerformanceReport = {
    timestamp: Date.now(),
    url: browser ? window.location.href : '',
    metrics: {},
    violations: [],
    deviceInfo: {
      cores: browser ? navigator.hardwareConcurrency || 0 : 0,
      memory: browser ? (navigator as Navigator & { deviceMemory?: number }).deviceMemory : undefined,
      connection: browser ? (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType : undefined,
      reducedMotion: prefersReducedMotion()
    }
  };

  // Collect navigation timing
  if (browser && performance.getEntriesByType) {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    if (nav) {
      report.metrics.domContentLoaded = nav.domContentLoadedEventEnd - nav.startTime;
      report.metrics.load = nav.loadEventEnd - nav.startTime;
      report.metrics.ttfb = nav.responseStart - nav.startTime;
    }
  }

  return report;
}

/**
 * Log performance marks for debugging
 */
export function logPerformanceMarks(): void {
  if (!browser) return;

  const marks = performance.getEntriesByType('mark');
  const measures = performance.getEntriesByType('measure');

  logger.debug('[Performance Marks]', marks);
  logger.debug('[Performance Measures]', measures);
}

/**
 * Create a performance mark
 */
export function mark(name: string): void {
  if (!browser) return;
  performance.mark(name);
}

/**
 * Create a performance measure
 */
export function measure(name: string, startMark: string, endMark?: string): void {
  if (!browser) return;
  
  try {
    if (endMark) {
      performance.measure(name, startMark, endMark);
    } else {
      performance.measure(name, startMark);
    }
  } catch (error) {
    logger.debug(`Failed to measure ${name}:`, error);
  }
}

