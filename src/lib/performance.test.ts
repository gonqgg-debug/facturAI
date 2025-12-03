/**
 * Performance Module Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  PERFORMANCE_BUDGETS,
  BUNDLE_SIZE_BUDGETS,
  RESOURCE_HINTS,
  IMAGE_OPTIMIZATION,
  ANIMATION_CONFIG,
  CACHE_CONFIG,
  prefersReducedMotion,
  hasSlowConnection,
  isLowEndDevice,
  getOptimalImageQuality,
  measurePerformance,
  debounce,
  throttle,
  checkBudgetViolation,
  generatePerformanceReport
} from './performance';

// Mock browser environment
vi.mock('$app/environment', () => ({
  browser: true
}));

// Mock logger
vi.mock('./logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Performance Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('PERFORMANCE_BUDGETS', () => {
    it('should have LCP budget of 2500ms', () => {
      expect(PERFORMANCE_BUDGETS.LCP).toBe(2500);
    });

    it('should have FID budget of 100ms', () => {
      expect(PERFORMANCE_BUDGETS.FID).toBe(100);
    });

    it('should have CLS budget of 0.1', () => {
      expect(PERFORMANCE_BUDGETS.CLS).toBe(0.1);
    });

    it('should have FCP budget of 1800ms', () => {
      expect(PERFORMANCE_BUDGETS.FCP).toBe(1800);
    });

    it('should have TTFB budget of 800ms', () => {
      expect(PERFORMANCE_BUDGETS.TTFB).toBe(800);
    });

    it('should have INP budget of 200ms', () => {
      expect(PERFORMANCE_BUDGETS.INP).toBe(200);
    });
  });

  describe('BUNDLE_SIZE_BUDGETS', () => {
    it('should have main bundle budget', () => {
      expect(BUNDLE_SIZE_BUDGETS.main).toBe(200);
    });

    it('should have vendor chunk budgets', () => {
      expect(BUNDLE_SIZE_BUDGETS.vendor).toBeDefined();
      expect(BUNDLE_SIZE_BUDGETS.vendor.svelte).toBeDefined();
      expect(BUNDLE_SIZE_BUDGETS.vendor.dexie).toBeDefined();
      expect(BUNDLE_SIZE_BUDGETS.vendor.charts).toBeDefined();
    });

    it('should have total JS budget', () => {
      expect(BUNDLE_SIZE_BUDGETS.totalJs).toBe(1000);
    });

    it('should have total CSS budget', () => {
      expect(BUNDLE_SIZE_BUDGETS.totalCss).toBe(100);
    });

    it('should have total assets budget', () => {
      expect(BUNDLE_SIZE_BUDGETS.totalAssets).toBe(500);
    });
  });

  describe('RESOURCE_HINTS', () => {
    it('should have preconnect domains', () => {
      expect(RESOURCE_HINTS.preconnect).toBeInstanceOf(Array);
      expect(RESOURCE_HINTS.preconnect.length).toBeGreaterThan(0);
    });

    it('should include CDN in preconnect', () => {
      expect(RESOURCE_HINTS.preconnect).toContain('https://cdn.jsdelivr.net');
    });

    it('should have prefetch routes', () => {
      expect(RESOURCE_HINTS.prefetch).toBeInstanceOf(Array);
      expect(RESOURCE_HINTS.prefetch.length).toBeGreaterThan(0);
    });
  });

  describe('IMAGE_OPTIMIZATION', () => {
    it('should have quality setting', () => {
      expect(IMAGE_OPTIMIZATION.quality).toBe(80);
    });

    it('should have lazy load threshold', () => {
      expect(IMAGE_OPTIMIZATION.lazyLoadThreshold).toBe(100);
    });

    it('should have max dimensions', () => {
      expect(IMAGE_OPTIMIZATION.maxWidth).toBe(1920);
      expect(IMAGE_OPTIMIZATION.maxHeight).toBe(1080);
    });

    it('should have supported formats', () => {
      expect(IMAGE_OPTIMIZATION.formats).toContain('avif');
      expect(IMAGE_OPTIMIZATION.formats).toContain('webp');
      expect(IMAGE_OPTIMIZATION.formats).toContain('jpg');
    });

    it('should have responsive breakpoints', () => {
      expect(IMAGE_OPTIMIZATION.breakpoints).toBeInstanceOf(Array);
      expect(IMAGE_OPTIMIZATION.breakpoints.length).toBeGreaterThan(0);
    });
  });

  describe('ANIMATION_CONFIG', () => {
    it('should respect reduced motion by default', () => {
      expect(ANIMATION_CONFIG.respectReducedMotion).toBe(true);
    });

    it('should have default duration', () => {
      expect(ANIMATION_CONFIG.duration).toBe(200);
    });

    it('should have easing functions', () => {
      expect(ANIMATION_CONFIG.easing.default).toBeDefined();
      expect(ANIMATION_CONFIG.easing.easeIn).toBeDefined();
      expect(ANIMATION_CONFIG.easing.easeOut).toBeDefined();
      expect(ANIMATION_CONFIG.easing.easeInOut).toBeDefined();
    });
  });

  describe('CACHE_CONFIG', () => {
    it('should have static assets config', () => {
      expect(CACHE_CONFIG.staticAssets.maxAge).toBeGreaterThan(0);
      expect(CACHE_CONFIG.staticAssets.staleWhileRevalidate).toBeGreaterThan(0);
    });

    it('should have API cache config', () => {
      expect(CACHE_CONFIG.api.maxAge).toBeGreaterThan(0);
      expect(CACHE_CONFIG.api.staleWhileRevalidate).toBeGreaterThan(0);
    });

    it('should have HTML cache config with no-cache', () => {
      expect(CACHE_CONFIG.html.maxAge).toBe(0);
    });
  });

  describe('prefersReducedMotion', () => {
    it('should return boolean', () => {
      const result = prefersReducedMotion();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('hasSlowConnection', () => {
    it('should return boolean', () => {
      const result = hasSlowConnection();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isLowEndDevice', () => {
    it('should return boolean', () => {
      const result = isLowEndDevice();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getOptimalImageQuality', () => {
    it('should return a number', () => {
      const quality = getOptimalImageQuality();
      expect(typeof quality).toBe('number');
    });

    it('should return quality between 0 and 100', () => {
      const quality = getOptimalImageQuality();
      expect(quality).toBeGreaterThanOrEqual(0);
      expect(quality).toBeLessThanOrEqual(100);
    });
  });

  describe('measurePerformance', () => {
    it('should execute sync function', async () => {
      const result = await measurePerformance('test', () => 42);
      expect(result).toBe(42);
    });

    it('should execute async function', async () => {
      const result = await measurePerformance('test', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'async result';
      });
      expect(result).toBe('async result');
    });

    it('should throw on error', async () => {
      await expect(
        measurePerformance('test', () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
    });
  });

  describe('debounce', () => {
    it('should delay function execution', async () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      
      debounced();
      expect(fn).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
      
      vi.useRealTimers();
    });

    it('should cancel previous calls', async () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const debounced = debounce(fn, 100);
      
      debounced();
      debounced();
      debounced();
      
      vi.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledTimes(1);
      
      vi.useRealTimers();
    });
  });

  describe('throttle', () => {
    it('should limit function execution rate', () => {
      vi.useFakeTimers();
      const fn = vi.fn();
      const throttled = throttle(fn, 100);
      
      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
      
      throttled();
      expect(fn).toHaveBeenCalledTimes(1);
      
      vi.advanceTimersByTime(100);
      throttled();
      expect(fn).toHaveBeenCalledTimes(2);
      
      vi.useRealTimers();
    });
  });

  describe('checkBudgetViolation', () => {
    it('should detect LCP violation', () => {
      const result = checkBudgetViolation('LCP', 3000);
      expect(result.violated).toBe(true);
      expect(result.budget).toBe(2500);
      expect(result.excess).toBe(500);
    });

    it('should not flag within budget', () => {
      const result = checkBudgetViolation('LCP', 2000);
      expect(result.violated).toBe(false);
      expect(result.excess).toBe(0);
    });

    it('should detect FID violation', () => {
      const result = checkBudgetViolation('FID', 150);
      expect(result.violated).toBe(true);
      expect(result.budget).toBe(100);
    });

    it('should detect CLS violation', () => {
      const result = checkBudgetViolation('CLS', 0.2);
      expect(result.violated).toBe(true);
      expect(result.budget).toBe(0.1);
    });

    it('should detect FCP violation', () => {
      const result = checkBudgetViolation('FCP', 2000);
      expect(result.violated).toBe(true);
      expect(result.budget).toBe(1800);
    });

    it('should detect TTFB violation', () => {
      const result = checkBudgetViolation('TTFB', 1000);
      expect(result.violated).toBe(true);
      expect(result.budget).toBe(800);
    });

    it('should detect INP violation', () => {
      const result = checkBudgetViolation('INP', 300);
      expect(result.violated).toBe(true);
      expect(result.budget).toBe(200);
    });
  });

  describe('generatePerformanceReport', () => {
    it('should return report object', () => {
      const report = generatePerformanceReport();
      
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('url');
      expect(report).toHaveProperty('metrics');
      expect(report).toHaveProperty('violations');
      expect(report).toHaveProperty('deviceInfo');
    });

    it('should have device info', () => {
      const report = generatePerformanceReport();
      
      expect(report.deviceInfo).toHaveProperty('cores');
      expect(report.deviceInfo).toHaveProperty('reducedMotion');
    });

    it('should have timestamp as number', () => {
      const report = generatePerformanceReport();
      expect(typeof report.timestamp).toBe('number');
    });
  });
});

