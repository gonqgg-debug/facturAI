
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/" | "/capture" | "/history" | "/kb" | "/login" | "/pricing" | "/settings" | "/validation";
		RouteParams(): {
			
		};
		LayoutParams(): {
			"/": Record<string, never>;
			"/capture": Record<string, never>;
			"/history": Record<string, never>;
			"/kb": Record<string, never>;
			"/login": Record<string, never>;
			"/pricing": Record<string, never>;
			"/settings": Record<string, never>;
			"/validation": Record<string, never>
		};
		Pathname(): "/" | "/capture" | "/capture/" | "/history" | "/history/" | "/kb" | "/kb/" | "/login" | "/login/" | "/pricing" | "/pricing/" | "/settings" | "/settings/" | "/validation" | "/validation/";
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): string & {};
	}
}