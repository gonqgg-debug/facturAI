<script lang="ts">
	import { Calendar as CalendarPrimitive } from "bits-ui";
	import { ChevronLeft, ChevronRight } from "lucide-svelte";
	import { cn } from "$lib/utils.js";
	import { buttonVariants } from "$lib/components/ui/button/index.js";
	import type { DateValue } from "@internationalized/date";

	type $$Props = CalendarPrimitive.Props & {
		onValueChange?: (value: DateValue | undefined) => void;
	};

	export let value: DateValue | undefined = undefined;
	export let placeholder: $$Props["placeholder"] = undefined;
	export let weekdayFormat: $$Props["weekdayFormat"] = "short";
	export let locale: string = "es-DO";
	export let onValueChange: ((value: DateValue | undefined) => void) | undefined = undefined;

	let className: $$Props["class"] = undefined;
	export { className as class };

	function handleValueChange(newValue: DateValue | DateValue[] | undefined) {
		// Handle both single and array values (convert array to single if needed)
		const singleValue = Array.isArray(newValue) ? newValue[0] : newValue;
		value = singleValue;
		onValueChange?.(singleValue);
	}
</script>

<CalendarPrimitive.Root
	bind:value
	bind:placeholder
	{weekdayFormat}
	{locale}
	class={cn("p-3", className)}
	{...$$restProps}
	on:keydown
	onValueChange={handleValueChange}
	let:months
	let:weekdays
>
	<CalendarPrimitive.Header class="relative flex w-full items-center justify-between pt-1">
		<CalendarPrimitive.PrevButton
			class={cn(
				buttonVariants({ variant: "outline" }),
				"h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
			)}
		>
			<ChevronLeft class="h-4 w-4" />
		</CalendarPrimitive.PrevButton>
		<CalendarPrimitive.Heading class="text-sm font-medium" />
		<CalendarPrimitive.NextButton
			class={cn(
				buttonVariants({ variant: "outline" }),
				"h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
			)}
		>
			<ChevronRight class="h-4 w-4" />
		</CalendarPrimitive.NextButton>
	</CalendarPrimitive.Header>
	<div class="flex flex-col space-y-4 pt-4 sm:flex-row sm:space-x-4 sm:space-y-0">
		{#each months as month}
			<CalendarPrimitive.Grid class="w-full border-collapse space-y-1">
				<CalendarPrimitive.GridHead>
					<CalendarPrimitive.GridRow class="flex">
						{#each weekdays as weekday}
							<CalendarPrimitive.HeadCell
								class="w-9 rounded-md text-[0.8rem] font-normal text-muted-foreground"
							>
								{weekday.slice(0, 2)}
							</CalendarPrimitive.HeadCell>
						{/each}
					</CalendarPrimitive.GridRow>
				</CalendarPrimitive.GridHead>
				<CalendarPrimitive.GridBody>
					{#each month.weeks as weekDates}
						<CalendarPrimitive.GridRow class="mt-2 flex w-full">
							{#each weekDates as date}
								<CalendarPrimitive.Cell
									{date}
									class="relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([data-selected])]:rounded-md [&:has([data-selected])]:bg-accent [&:has([data-selected][data-outside-month])]:bg-accent/50"
								>
									<CalendarPrimitive.Day
										{date}
										month={month.value}
										class={cn(
											buttonVariants({ variant: "ghost" }),
											"h-9 w-9 p-0 font-normal",
											"data-[selected]:bg-primary data-[selected]:text-primary-foreground data-[selected]:opacity-100 data-[selected]:hover:bg-primary data-[selected]:hover:text-primary-foreground data-[selected]:focus:bg-primary data-[selected]:focus:text-primary-foreground",
											"data-[today]:bg-accent data-[today]:text-accent-foreground",
											"data-[outside-month]:pointer-events-none data-[outside-month]:text-muted-foreground data-[outside-month]:opacity-50",
											"data-[disabled]:text-muted-foreground data-[disabled]:opacity-50",
											"data-[unavailable]:text-destructive data-[unavailable]:line-through"
										)}
									/>
								</CalendarPrimitive.Cell>
							{/each}
						</CalendarPrimitive.GridRow>
					{/each}
				</CalendarPrimitive.GridBody>
			</CalendarPrimitive.Grid>
		{/each}
	</div>
</CalendarPrimitive.Root>
