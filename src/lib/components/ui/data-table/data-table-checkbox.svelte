<script lang="ts">
  import { Checkbox } from '$lib/components/ui/checkbox';
  
  export let checked: boolean | 'indeterminate' = false;
  export let onCheckedChange: (value: boolean) => void = () => {};
  export let ariaLabel: string = 'Select row';
</script>

<Checkbox 
  {checked}
  onCheckedChange={(value) => onCheckedChange(!!value)}
  aria-label={ariaLabel}
  class="translate-y-[2px]"
/>

