import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'happy-dom',
		exclude: [
			'node_modules/**',
			'dist/**',
			'.svelte-kit/**',
			'.vercel/**',
			'e2e/**'
		],
		setupFiles: ['./vitest.setup.ts']
	},
	plugins: [sveltekit()]
});
