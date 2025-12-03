/**
 * Web Vitals Tracking Module
 * 
 * Tracks Core Web Vitals metrics for performance monitoring:
 * - LCP (Largest Contentful Paint) - Loading performance
 * - FID (First Input Delay) - Interactivity
 * - CLS (Cumulative Layout Shift) - Visual stability
 * - FCP (First Contentful Paint) - First paint timing
 * - TTFB (Time to First Byte) - Server response time
 * - INP (Interaction to Next Paint) - Responsiveness
 * 
 * @module web-vitals
 */

import { browser } from '$app/environment';
import { logger } from './logger';

/** Web Vitals metric types */
export type MetricName = 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB' | 'INP';

/** Web Vitals metric entry */
export interface WebVitalMetric {
  name: MetricName;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
  navigationType: string;
  timestamp: number;
}

/** Performance budget thresholds */
export interface PerformanceBudget {
  LCP: number;  // milliseconds
  FID: number;  // milliseconds
  CLS: number;  // score
  FCP: number;  // milliseconds
  TTFB: number; // milliseconds
  INP: number;  // milliseconds
}

/** Default performance budgets based on Google's recommendations */
export const DEFAULT_BUDGETS: PerformanceBudget = {
  LCP: 2500,   // Good: ≤2.5s, Needs Improvement: ≤4s, Poor: >4s
  FID: 100,    // Good: ≤100ms, Needs Improvement: ≤300ms, Poor: >300ms
  CLS: 0.1,    // Good: ≤0.1, Needs Improvement: ≤0.25, Poor: >0.25
  FCP: 1800,   // Good: ≤1.8s, Needs Improvement: ≤3s, Poor: >3s
  TTFB: 800,   // Good: ≤800ms, Needs Improvement: ≤1.8s, Poor: >1.8s
  INP: 200     // Good: ≤200ms, Needs Improvement: ≤500ms, Poor: >500ms
};

/** Thresholds for rating metrics */
const THRESHOLDS: Record<MetricName, [number, number]> = {
  LCP: [2500, 4000],
  FID: [100, 300],
  CLS: [0.1, 0.25],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
  INP: [200, 500]
};

/** Storage key for metrics history */
const METRICS_STORAGE_KEY = 'web-vitals-metrics';

/** Maximum metrics to store */
const MAX_STORED_METRICS = 100;

/** Callback type for metric reporting */
export type MetricCallback = (metric: WebVitalMetric) => void;

/** Registered metric callbacks */
const callbacks: Set<MetricCallback> = new Set();

/** Collected metrics for the current session */
const sessionMetrics: Map<MetricName, WebVitalMetric> = new Map();

/**
 * Get rating for a metric value
 */
function getRating(name: MetricName, value: number): 'good' | 'needs-improvement' | 'poor' {
  const [good, poor] = THRESHOLDS[name];
  if (value <= good) return 'good';
  if (value <= poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Generate unique ID for metric
 */
function generateId(): string {
  return `v${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Report metric to all registered callbacks
 */
function reportMetric(metric: WebVitalMetric): void {
  sessionMetrics.set(metric.name, metric);
  
  callbacks.forEach(callback => {
    try {
      callback(metric);
    } catch (error) {
      logger.error('Error in Web Vitals callback:', error);
    }
  });

  // Log metric
  const emoji = metric.rating === 'good' ? '✅' : metric.rating === 'needs-improvement' ? '⚠️' : '❌';
  logger.info(`${emoji} Web Vital: ${metric.name} = ${metric.value.toFixed(2)} (${metric.rating})`);
}

/**
 * Observe Largest Contentful Paint (LCP)
 */
function observeLCP(): void {
  if (!browser || !('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
      
      if (lastEntry) {
        reportMetric({
          name: 'LCP',
          value: lastEntry.startTime,
          rating: getRating('LCP', lastEntry.startTime),
          delta: lastEntry.startTime,
          id: generateId(),
          navigationType: getNavigationType(),
          timestamp: Date.now()
        });
      }
    });

    observer.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch (error) {
    logger.warn('LCP observation not supported:', error);
  }
}

/**
 * Observe First Input Delay (FID)
 */
function observeFID(): void {
  if (!browser || !('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries() as (PerformanceEntry & { processingStart: number; startTime: number })[];
      
      entries.forEach((entry) => {
        const delay = entry.processingStart - entry.startTime;
        
        reportMetric({
          name: 'FID',
          value: delay,
          rating: getRating('FID', delay),
          delta: delay,
          id: generateId(),
          navigationType: getNavigationType(),
          timestamp: Date.now()
        });
      });
    });

    observer.observe({ type: 'first-input', buffered: true });
  } catch (error) {
    logger.warn('FID observation not supported:', error);
  }
}

/**
 * Observe Cumulative Layout Shift (CLS)
 */
function observeCLS(): void {
  if (!browser || !('PerformanceObserver' in window)) return;

  let clsValue = 0;
  let clsEntries: PerformanceEntry[] = [];

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries() as (PerformanceEntry & { hadRecentInput: boolean; value: number })[];

      entries.forEach((entry) => {
        // Only count layout shifts without recent user input
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          clsEntries.push(entry);
        }
      });
    });

    observer.observe({ type: 'layout-shift', buffered: true });

    // Report final CLS on page visibility change or unload
    const reportFinalCLS = () => {
      if (clsEntries.length > 0) {
        reportMetric({
          name: 'CLS',
          value: clsValue,
          rating: getRating('CLS', clsValue),
          delta: clsValue,
          id: generateId(),
          navigationType: getNavigationType(),
          timestamp: Date.now()
        });
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        reportFinalCLS();
      }
    });

    window.addEventListener('beforeunload', reportFinalCLS);
  } catch (error) {
    logger.warn('CLS observation not supported:', error);
  }
}

/**
 * Observe First Contentful Paint (FCP)
 */
function observeFCP(): void {
  if (!browser || !('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
      
      if (fcpEntry) {
        reportMetric({
          name: 'FCP',
          value: fcpEntry.startTime,
          rating: getRating('FCP', fcpEntry.startTime),
          delta: fcpEntry.startTime,
          id: generateId(),
          navigationType: getNavigationType(),
          timestamp: Date.now()
        });
      }
    });

    observer.observe({ type: 'paint', buffered: true });
  } catch (error) {
    logger.warn('FCP observation not supported:', error);
  }
}

/**
 * Observe Time to First Byte (TTFB)
 */
function observeTTFB(): void {
  if (!browser || !('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries() as (PerformanceEntry & { responseStart: number })[];
      
      entries.forEach((entry) => {
        if (entry.responseStart > 0) {
          reportMetric({
            name: 'TTFB',
            value: entry.responseStart,
            rating: getRating('TTFB', entry.responseStart),
            delta: entry.responseStart,
            id: generateId(),
            navigationType: getNavigationType(),
            timestamp: Date.now()
          });
        }
      });
    });

    observer.observe({ type: 'navigation', buffered: true });
  } catch (error) {
    logger.warn('TTFB observation not supported:', error);
  }
}

/**
 * Observe Interaction to Next Paint (INP)
 */
function observeINP(): void {
  if (!browser || !('PerformanceObserver' in window)) return;

  const interactions: number[] = [];

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries() as (PerformanceEntry & { duration: number; interactionId?: number })[];

      entries.forEach((entry) => {
        if (entry.interactionId) {
          interactions.push(entry.duration);
        }
      });
    });

    observer.observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);

    // Report INP on page visibility change
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && interactions.length > 0) {
        // INP is the 98th percentile of interactions
        interactions.sort((a, b) => b - a);
        const idx = Math.floor(interactions.length * 0.02);
        const inp = interactions[idx] || interactions[0];

        reportMetric({
          name: 'INP',
          value: inp,
          rating: getRating('INP', inp),
          delta: inp,
          id: generateId(),
          navigationType: getNavigationType(),
          timestamp: Date.now()
        });
      }
    });
  } catch (error) {
    logger.warn('INP observation not supported:', error);
  }
}

/**
 * Get navigation type
 */
function getNavigationType(): string {
  if (!browser) return 'unknown';
  
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  return nav?.type || 'unknown';
}

/**
 * Initialize Web Vitals tracking
 * Call this once on app initialization
 */
export function initWebVitals(callback?: MetricCallback): void {
  if (!browser) return;

  if (callback) {
    callbacks.add(callback);
  }

  // Start observing all metrics
  observeLCP();
  observeFID();
  observeCLS();
  observeFCP();
  observeTTFB();
  observeINP();

  logger.info('Web Vitals tracking initialized');
}

/**
 * Register a callback to receive metric updates
 */
export function onMetric(callback: MetricCallback): () => void {
  callbacks.add(callback);
  return () => callbacks.delete(callback);
}

/**
 * Get current session metrics
 */
export function getSessionMetrics(): Map<MetricName, WebVitalMetric> {
  return new Map(sessionMetrics);
}

/**
 * Get a specific metric from the current session
 */
export function getMetric(name: MetricName): WebVitalMetric | undefined {
  return sessionMetrics.get(name);
}

/**
 * Store metrics to localStorage for historical analysis
 */
export function persistMetrics(): void {
  if (!browser) return;

  try {
    const currentMetrics = Array.from(sessionMetrics.values());
    if (currentMetrics.length === 0) return;

    const stored = localStorage.getItem(METRICS_STORAGE_KEY);
    let history: WebVitalMetric[] = stored ? JSON.parse(stored) : [];

    // Add current metrics
    history.push(...currentMetrics);

    // Keep only the last MAX_STORED_METRICS
    if (history.length > MAX_STORED_METRICS) {
      history = history.slice(-MAX_STORED_METRICS);
    }

    localStorage.setItem(METRICS_STORAGE_KEY, JSON.stringify(history));
    logger.debug('Web Vitals metrics persisted:', currentMetrics.length);
  } catch (error) {
    logger.error('Failed to persist Web Vitals metrics:', error);
  }
}

/**
 * Get historical metrics from localStorage
 */
export function getHistoricalMetrics(): WebVitalMetric[] {
  if (!browser) return [];

  try {
    const stored = localStorage.getItem(METRICS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Clear historical metrics
 */
export function clearHistoricalMetrics(): void {
  if (!browser) return;
  localStorage.removeItem(METRICS_STORAGE_KEY);
}

/**
 * Check if metrics meet performance budgets
 */
export function checkBudgets(budgets: PerformanceBudget = DEFAULT_BUDGETS): Record<MetricName, boolean> {
  const results: Record<MetricName, boolean> = {} as Record<MetricName, boolean>;

  for (const [name, metric] of sessionMetrics) {
    const budget = budgets[name];
    results[name] = metric.value <= budget;
  }

  return results;
}

/**
 * Get performance summary for the current session
 */
export function getPerformanceSummary(): {
  score: number;
  metrics: Record<MetricName, { value: number; rating: string } | null>;
  budgetViolations: MetricName[];
} {
  const metrics: Record<MetricName, { value: number; rating: string } | null> = {
    LCP: null,
    FID: null,
    CLS: null,
    FCP: null,
    TTFB: null,
    INP: null
  };

  let totalScore = 0;
  let metricCount = 0;
  const budgetViolations: MetricName[] = [];

  for (const [name, metric] of sessionMetrics) {
    metrics[name] = {
      value: metric.value,
      rating: metric.rating
    };

    // Calculate score (good = 100, needs-improvement = 50, poor = 0)
    const scoreMap = { good: 100, 'needs-improvement': 50, poor: 0 };
    totalScore += scoreMap[metric.rating];
    metricCount++;

    // Check budget violations
    if (metric.value > DEFAULT_BUDGETS[name]) {
      budgetViolations.push(name);
    }
  }

  return {
    score: metricCount > 0 ? Math.round(totalScore / metricCount) : 0,
    metrics,
    budgetViolations
  };
}

/**
 * Send metrics to Sentry for monitoring
 */
export function reportToSentry(): void {
  if (!browser) return;

  try {
    // Import Sentry dynamically to avoid bundling issues
    import('@sentry/sveltekit').then(({ captureMessage, setTag }) => {
      const summary = getPerformanceSummary();
      
      // Set performance tags
      setTag('performance.score', summary.score.toString());
      
      for (const [name, metric] of sessionMetrics) {
        setTag(`web_vital.${name.toLowerCase()}`, metric.rating);
      }

      // Report if performance is poor
      if (summary.score < 50) {
        captureMessage('Poor Web Vitals performance detected', {
          level: 'warning',
          extra: {
            metrics: Object.fromEntries(sessionMetrics),
            summary
          }
        });
      }
    }).catch(() => {
      // Sentry not available, skip reporting
    });
  } catch {
    // Ignore errors
  }
}

// Auto-persist metrics on page unload
if (browser) {
  window.addEventListener('beforeunload', () => {
    persistMetrics();
    reportToSentry();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      persistMetrics();
    }
  });
}

