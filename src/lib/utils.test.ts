/**
 * Unit Tests for Utility Functions
 * Tests className merging and Svelte transitions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cn, flyAndScale } from './utils';

describe('cn (className utility)', () => {
    it('should merge class names', () => {
        expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
        expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
        expect(cn('foo', true && 'bar', 'baz')).toBe('foo bar baz');
    });

    it('should merge Tailwind classes correctly', () => {
        // twMerge should deduplicate conflicting classes
        const result = cn('px-2 py-1', 'px-4');
        expect(result).toContain('px-4');
        expect(result).toContain('py-1');
        expect(result).not.toContain('px-2');
    });

    it('should handle empty inputs', () => {
        expect(cn()).toBe('');
        expect(cn('', null, undefined)).toBe('');
    });

    it('should handle arrays', () => {
        expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
    });

    it('should handle objects', () => {
        expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
    });

    it('should handle mixed inputs', () => {
        expect(cn('foo', ['bar', 'baz'], { qux: true })).toBe('foo bar baz qux');
    });
});

describe('flyAndScale (Svelte transition)', () => {
    let mockElement: HTMLElement;
    let mockGetComputedStyle: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        mockElement = document.createElement('div');
        mockGetComputedStyle = vi.fn(() => ({
            transform: 'none'
        }));
        Object.defineProperty(window, 'getComputedStyle', {
            value: mockGetComputedStyle,
            writable: true
        });
    });

    it('should return a transition config object', () => {
        const config = flyAndScale(mockElement);
        expect(config).toHaveProperty('duration');
        expect(config).toHaveProperty('delay');
        expect(config).toHaveProperty('css');
        expect(config).toHaveProperty('easing');
    });

    it('should use default parameters', () => {
        const config = flyAndScale(mockElement);
        expect(config.duration).toBe(150);
        expect(config.delay).toBe(0);
        expect(typeof config.css).toBe('function');
    });

    it('should accept custom parameters', () => {
        const config = flyAndScale(mockElement, {
            y: -10,
            x: 5,
            start: 0.9,
            duration: 200
        });
        expect(config.duration).toBe(200);
    });

    it('should handle existing transform', () => {
        mockGetComputedStyle.mockReturnValue({
            transform: 'translateX(10px)'
        });
        const config = flyAndScale(mockElement);
        const cssResult = config.css(0.5);
        expect(cssResult).toContain('translateX(10px)');
    });

    it('should generate CSS with transform and opacity', () => {
        const config = flyAndScale(mockElement);
        const cssResult = config.css(0.5);
        
        expect(cssResult).toContain('transform');
        expect(cssResult).toContain('opacity');
        expect(cssResult).toContain('translate3d');
        expect(cssResult).toContain('scale');
    });

    it('should animate from start scale to 1', () => {
        const config = flyAndScale(mockElement, { start: 0.8 });
        const startCss = config.css(0);
        const endCss = config.css(1);
        
        expect(startCss).toContain('scale(0.8)');
        expect(endCss).toContain('scale(1)');
    });

    it('should animate opacity from 0 to 1', () => {
        const config = flyAndScale(mockElement);
        const startCss = config.css(0);
        const endCss = config.css(1);
        
        expect(startCss).toContain('opacity:0');
        expect(endCss).toContain('opacity:1');
    });

    it('should handle y parameter', () => {
        const config = flyAndScale(mockElement, { y: -20 });
        const cssResult = config.css(0);
        expect(cssResult).toContain('translate3d');
    });

    it('should handle x parameter', () => {
        const config = flyAndScale(mockElement, { x: 10 });
        const cssResult = config.css(0.5);
        expect(cssResult).toContain('translate3d');
    });

    it('should use cubicOut easing', () => {
        const config = flyAndScale(mockElement);
        expect(config.easing).toBeDefined();
    });
});

