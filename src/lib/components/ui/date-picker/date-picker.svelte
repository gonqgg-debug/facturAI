<script lang="ts">
	import { Calendar as CalendarIcon } from "lucide-svelte";
	import { type DateValue, DateFormatter, getLocalTimeZone, CalendarDate } from "@internationalized/date";
	import { cn } from "$lib/utils.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Calendar } from "$lib/components/ui/calendar/index.js";
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { createEventDispatcher } from "svelte";

	export let value: string = "";
	export let placeholder: string = "Seleccionar fecha";
	export let locale: string = "es-DO";
	export let disabled: boolean = false;
	let className: string = "";
	export { className as class };

	const dispatch = createEventDispatcher<{ change: string }>();

	const df = new DateFormatter(locale, {
		dateStyle: "medium"
	});

	let calendarValue: DateValue | undefined = undefined;
	let open = false;

	// Convert string date to DateValue
	$: {
		if (value) {
			try {
				const [year, month, day] = value.split('-').map(Number);
				if (year && month && day) {
					calendarValue = new CalendarDate(year, month, day);
				}
			} catch {
				calendarValue = undefined;
			}
		} else {
			calendarValue = undefined;
		}
	}

	function handleSelect(newValue: DateValue | undefined) {
		if (newValue) {
			calendarValue = newValue;
			value = `${newValue.year}-${String(newValue.month).padStart(2, '0')}-${String(newValue.day).padStart(2, '0')}`;
			dispatch('change', value);
			open = false;
		}
	}

	function getDisplayText(): string {
		if (calendarValue) {
			try {
				return df.format(calendarValue.toDate(getLocalTimeZone()));
			} catch {
				return value;
			}
		}
		return placeholder;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			open = false;
		}
	}
</script>

<svelte:window on:keydown={open ? handleKeydown : undefined} />

<Popover.Root bind:open>
	<Popover.Trigger asChild let:builder>
		<Button
			variant="outline"
			class={cn(
				"justify-start text-left font-normal",
				!value && "text-muted-foreground",
				className
			)}
			builders={[builder]}
			{disabled}
		>
			<CalendarIcon class="mr-2 h-4 w-4" />
			{getDisplayText()}
		</Button>
	</Popover.Trigger>
	<Popover.Content class="w-auto p-0" align="start">
		<Calendar 
			value={calendarValue} 
			{locale}
			onValueChange={handleSelect}
		/>
	</Popover.Content>
</Popover.Root>
