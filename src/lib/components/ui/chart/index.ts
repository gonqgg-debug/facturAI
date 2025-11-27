import Container from "./chart-container.svelte";
import Tooltip from "./chart-tooltip.svelte";

export type ChartConfig = {
  [key: string]: {
    label: string;
    color: string;
    icon?: any;
  };
};

export { Container, Tooltip };

