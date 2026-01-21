import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { cubicOut } from "svelte/easing";
import type { TransitionConfig } from "svelte/transition";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

type FlyAndScaleParams = {
	y?: number;
	x?: number;
	start?: number;
	duration?: number;
};

export const flyAndScale = (
	node: Element,
	params: FlyAndScaleParams = { y: -8, x: 0, start: 0.95, duration: 150 }
): TransitionConfig => {
	const style = getComputedStyle(node);
	const transform = style.transform === "none" ? "" : style.transform;

	const scaleConversion = (
		valueA: number,
		scaleA: [number, number],
		scaleB: [number, number]
	) => {
		const [minA, maxA] = scaleA;
		const [minB, maxB] = scaleB;

		const percentage = (valueA - minA) / (maxA - minA);
		const valueB = percentage * (maxB - minB) + minB;

		return valueB;
	};

	const styleToString = (
		style: Record<string, number | string | undefined>
	): string => {
		return Object.keys(style).reduce((str, key) => {
			if (style[key] === undefined) return str;
			return str + `${key}:${style[key]};`;
		}, "");
	};

	return {
		duration: params.duration ?? 200,
		delay: 0,
		css: (t) => {
			const y = scaleConversion(t, [0, 1], [params.y ?? 5, 0]);
			const x = scaleConversion(t, [0, 1], [params.x ?? 0, 0]);
			const scale = scaleConversion(t, [0, 1], [params.start ?? 0.95, 1]);

			return styleToString({
				transform: `${transform} translate3d(${x}px, ${y}px, 0) scale(${scale})`,
				opacity: t
			});
		},
		easing: cubicOut
	};
};

/**
 * Generate a unique Purchase Order number in format PO-YYYY-XXXX
 * Uses localStorage counter to track sequence per year
 */
export async function generatePONumber(): Promise<string> {
	const year = new Date().getFullYear();
	const storageKey = `po_counter_${year}`;
	
	// Get current counter from localStorage or start at 1
	let count = 1;
	if (typeof window !== 'undefined') {
		const stored = localStorage.getItem(storageKey);
		if (stored) {
			count = parseInt(stored, 10) + 1;
		}
		localStorage.setItem(storageKey, count.toString());
	}
	
	return `PO-${year}-${String(count).padStart(4, '0')}`;
}

/**
 * Generate a unique Receipt number in format REC-YYYY-XXXX
 * Uses localStorage counter to track sequence per year
 */
export async function generateReceiptNumber(): Promise<string> {
	const year = new Date().getFullYear();
	const storageKey = `receipt_counter_${year}`;
	
	// Get current counter from localStorage or start at 1
	let count = 1;
	if (typeof window !== 'undefined') {
		const stored = localStorage.getItem(storageKey);
		if (stored) {
			count = parseInt(stored, 10) + 1;
		}
		localStorage.setItem(storageKey, count.toString());
	}
	
	return `REC-${year}-${String(count).padStart(4, '0')}`;
}

/**
 * Format a number as currency
 * @param value - The number to format
 * @param showSymbol - Whether to show the DOP symbol (default true)
 * @param decimals - Number of decimal places (default 0)
 * @returns Formatted currency string
 */
export function formatCurrency(
	value: number | null | undefined, 
	showSymbol = true, 
	decimals = 0
): string {
	const numValue = value ?? 0;
	const formatted = numValue.toLocaleString('en-US', { 
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals 
	});
	return showSymbol ? `DOP ${formatted}` : formatted;
}

/**
 * Format a number as a short currency (e.g., $1.5K, $2.3M)
 * @param value - The number to format
 * @param showSymbol - Whether to show the $ symbol (default true)
 * @returns Formatted short currency string
 */
export function formatShortCurrency(
	value: number | null | undefined,
	showSymbol = true
): string {
	const numValue = value ?? 0;
	const prefix = showSymbol ? '$' : '';
	
	if (Math.abs(numValue) >= 1_000_000) {
		return `${prefix}${(numValue / 1_000_000).toFixed(1)}M`;
	}
	if (Math.abs(numValue) >= 1_000) {
		return `${prefix}${(numValue / 1_000).toFixed(1)}K`;
	}
	return `${prefix}${numValue.toFixed(0)}`;
}