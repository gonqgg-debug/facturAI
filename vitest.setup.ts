import { vi } from 'vitest';

// Provide a deterministic matchMedia implementation for tests that rely on it
if (!globalThis.matchMedia) {
	globalThis.matchMedia = vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		addListener: vi.fn(),
		removeListener: vi.fn(),
		dispatchEvent: vi.fn()
	})) as unknown as typeof globalThis.matchMedia;
}

// Polyfill ResizeObserver for happy-dom
if (!('ResizeObserver' in globalThis)) {
	class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	}

	// @ts-expect-error - happy-dom doesn't expose this by default
	globalThis.ResizeObserver = ResizeObserver;
}

// Ensure navigator properties accessed in performance utilities exist
const navigatorRef = globalThis.navigator ?? ({} as Navigator);
if (!('hardwareConcurrency' in navigatorRef)) {
	Object.defineProperty(navigatorRef, 'hardwareConcurrency', {
		value: 4,
		configurable: true
	});
}

if (!('deviceMemory' in navigatorRef)) {
	Object.defineProperty(navigatorRef, 'deviceMemory', {
		value: 4,
		configurable: true
	});
}

if (!('connection' in navigatorRef)) {
	Object.defineProperty(navigatorRef, 'connection', {
		value: { effectiveType: '4g', saveData: false },
		configurable: true
	});
}

// Attach back to global navigator if it wasn't set already
if (!globalThis.navigator) {
	// @ts-expect-error - assign the mocked navigator
	globalThis.navigator = navigatorRef;
}
