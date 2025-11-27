<script lang="ts">
  import { getContext } from "svelte";
  import { Tooltip } from "layerchart";
  import type { ChartConfig } from "./index.js";

  type $$Props = {
    hideLabel?: boolean;
    hideIndicator?: boolean;
    indicator?: "line" | "dot" | "dashed";
    nameKey?: string;
  };

  export let hideLabel = false;
  export let hideIndicator = false;
  export let indicator: "line" | "dot" | "dashed" = "dot";
  export let nameKey: string | undefined = undefined;

  const config = getContext<ChartConfig>("chartConfig");

  function getLabel(key: string): string {
    if (config && config[key]) {
      return config[key].label || key;
    }
    return key;
  }

  function getColor(key: string): string {
    if (config && config[key]) {
      return config[key].color || "var(--chart-1)";
    }
    return "var(--chart-1)";
  }
</script>

<Tooltip.Root let:data>
  <div class="bg-card border border-border rounded-lg shadow-xl p-2 min-w-[120px]">
    {#if data}
      <div class="flex flex-col gap-1.5">
        {#each Object.entries(data).filter(([key]) => key !== 'date' && key !== 'month') as [key, value]}
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-1.5">
              {#if !hideIndicator}
                {#if indicator === "dot"}
                  <div
                    class="h-2 w-2 rounded-full"
                    style="background-color: {getColor(key)}"
                  ></div>
                {:else if indicator === "line"}
                  <div
                    class="h-0.5 w-3"
                    style="background-color: {getColor(key)}"
                  ></div>
                {:else}
                  <div
                    class="h-0.5 w-3 border-t-2 border-dashed"
                    style="border-color: {getColor(key)}"
                  ></div>
                {/if}
              {/if}
              {#if !hideLabel}
                <span class="text-muted-foreground text-xs">{getLabel(key)}</span>
              {/if}
            </div>
            <span class="font-mono font-medium text-xs">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</Tooltip.Root>

