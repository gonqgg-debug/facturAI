<script lang="ts">
  import { setContext } from "svelte";
  import type { ChartConfig } from "./index.js";
  import { cn } from "$lib/utils.js";

  export let config: ChartConfig;
  let className: string | undefined = undefined;
  export { className as class };

  setContext("chartConfig", config);
</script>

<div
  class={cn(
    "flex aspect-video justify-center text-xs [&_.layerchart-tooltip]:bg-background [&_.layerchart-tooltip]:rounded-lg [&_.layerchart-tooltip]:border [&_.layerchart-tooltip]:border-border [&_.layerchart-tooltip]:shadow-xl",
    className
  )}
  {...$$restProps}
>
  <slot />
</div>

