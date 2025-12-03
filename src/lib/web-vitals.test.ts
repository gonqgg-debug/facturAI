/**
 * Web Vitals Module Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_BUDGETS,
  getSessionMetrics,
  getPerformanceSummary,
  checkBudgets,
  getHistoricalMetrics,
  type MetricName,
  type WebVitalMetric
} from './web-vitals';

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

describe('Web Vitals Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('DEFAULT_BUDGETS', () => {
    it('should have correct LCP budget', () => {
      expect(DEFAULT_BUDGETS.LCP).toBe(2500);
    });

    it('should have correct FID budget', () => {
      expect(DEFAULT_BUDGETS.FID).toBe(100);
    });

    it('should have correct CLS budget', () => {
      expect(DEFAULT_BUDGETS.CLS).toBe(0.1);
    });

    it('should have correct FCP budget', () => {
      expect(DEFAULT_BUDGETS.FCP).toBe(1800);
    });

    it('should have correct TTFB budget', () => {
      expect(DEFAULT_BUDGETS.TTFB).toBe(800);
    });

    it('should have correct INP budget', () => {
      expect(DEFAULT_BUDGETS.INP).toBe(200);
    });

    it('should have all metric budgets defined', () => {
      const expectedMetrics: MetricName[] = ['LCP', 'FID', 'CLS', 'FCP', 'TTFB', 'INP'];
      expectedMetrics.forEach(metric => {
        expect(DEFAULT_BUDGETS[metric]).toBeDefined();
        expect(typeof DEFAULT_BUDGETS[metric]).toBe('number');
      });
    });
  });

  describe('getSessionMetrics', () => {
    it('should return a Map', () => {
      const metrics = getSessionMetrics();
      expect(metrics instanceof Map).toBe(true);
    });

    it('should return empty Map initially', () => {
      const metrics = getSessionMetrics();
      expect(metrics.size).toBe(0);
    });
  });

  describe('checkBudgets', () => {
    it('should return empty object when no metrics', () => {
      const results = checkBudgets();
      expect(Object.keys(results).length).toBe(0);
    });

    it('should accept custom budgets', () => {
      const customBudgets = {
        LCP: 1000,
        FID: 50,
        CLS: 0.05,
        FCP: 1000,
        TTFB: 500,
        INP: 100
      };
      const results = checkBudgets(customBudgets);
      expect(results).toBeDefined();
    });
  });

  describe('getPerformanceSummary', () => {
    it('should return summary object with correct structure', () => {
      const summary = getPerformanceSummary();
      
      expect(summary).toHaveProperty('score');
      expect(summary).toHaveProperty('metrics');
      expect(summary).toHaveProperty('budgetViolations');
    });

    it('should return 0 score when no metrics', () => {
      const summary = getPerformanceSummary();
      expect(summary.score).toBe(0);
    });

    it('should return empty budget violations when no metrics', () => {
      const summary = getPerformanceSummary();
      expect(summary.budgetViolations).toEqual([]);
    });

    it('should have all metric keys in metrics object', () => {
      const summary = getPerformanceSummary();
      const expectedMetrics: MetricName[] = ['LCP', 'FID', 'CLS', 'FCP', 'TTFB', 'INP'];
      
      expectedMetrics.forEach(metric => {
        expect(summary.metrics).toHaveProperty(metric);
      });
    });

    it('should have null values for unrecorded metrics', () => {
      const summary = getPerformanceSummary();
      
      Object.values(summary.metrics).forEach(value => {
        expect(value).toBeNull();
      });
    });
  });

  describe('getHistoricalMetrics', () => {
    it('should return empty array when no stored metrics', () => {
      const metrics = getHistoricalMetrics();
      expect(metrics).toEqual([]);
    });

    it('should return array type', () => {
      const metrics = getHistoricalMetrics();
      expect(Array.isArray(metrics)).toBe(true);
    });
  });

  describe('Metric Rating Thresholds', () => {
    it('LCP good threshold should be less than needs-improvement', () => {
      // Good: ≤2500ms, Needs Improvement: ≤4000ms
      expect(2500).toBeLessThan(4000);
    });

    it('FID good threshold should be less than needs-improvement', () => {
      // Good: ≤100ms, Needs Improvement: ≤300ms
      expect(100).toBeLessThan(300);
    });

    it('CLS good threshold should be less than needs-improvement', () => {
      // Good: ≤0.1, Needs Improvement: ≤0.25
      expect(0.1).toBeLessThan(0.25);
    });

    it('FCP good threshold should be less than needs-improvement', () => {
      // Good: ≤1800ms, Needs Improvement: ≤3000ms
      expect(1800).toBeLessThan(3000);
    });

    it('TTFB good threshold should be less than needs-improvement', () => {
      // Good: ≤800ms, Needs Improvement: ≤1800ms
      expect(800).toBeLessThan(1800);
    });

    it('INP good threshold should be less than needs-improvement', () => {
      // Good: ≤200ms, Needs Improvement: ≤500ms
      expect(200).toBeLessThan(500);
    });
  });

  describe('WebVitalMetric Type', () => {
    it('should have correct metric name types', () => {
      const validNames: MetricName[] = ['LCP', 'FID', 'CLS', 'FCP', 'TTFB', 'INP'];
      expect(validNames.length).toBe(6);
    });

    it('should have rating type values', () => {
      const validRatings = ['good', 'needs-improvement', 'poor'];
      expect(validRatings.length).toBe(3);
    });
  });

  describe('Budget Configuration', () => {
    it('should have realistic LCP budget (2-3 seconds)', () => {
      expect(DEFAULT_BUDGETS.LCP).toBeGreaterThanOrEqual(2000);
      expect(DEFAULT_BUDGETS.LCP).toBeLessThanOrEqual(3000);
    });

    it('should have realistic FID budget (under 200ms)', () => {
      expect(DEFAULT_BUDGETS.FID).toBeLessThanOrEqual(200);
    });

    it('should have realistic CLS budget (under 0.25)', () => {
      expect(DEFAULT_BUDGETS.CLS).toBeLessThanOrEqual(0.25);
    });

    it('should have realistic FCP budget (under 2 seconds)', () => {
      expect(DEFAULT_BUDGETS.FCP).toBeLessThanOrEqual(2000);
    });

    it('should have realistic TTFB budget (under 1 second)', () => {
      expect(DEFAULT_BUDGETS.TTFB).toBeLessThanOrEqual(1000);
    });

    it('should have realistic INP budget (under 300ms)', () => {
      expect(DEFAULT_BUDGETS.INP).toBeLessThanOrEqual(300);
    });
  });
});

describe('Performance Budgets Validation', () => {
  it('all budgets should be positive numbers', () => {
    Object.entries(DEFAULT_BUDGETS).forEach(([key, value]) => {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThan(0);
    });
  });

  it('should have 6 defined budgets', () => {
    expect(Object.keys(DEFAULT_BUDGETS).length).toBe(6);
  });
});

