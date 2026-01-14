<script lang="ts">
	import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-svelte";
	import { cn } from "$lib/utils.js";
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { createEventDispatcher } from "svelte";

	export let value: string = "";
	export let placeholder: string = "Seleccionar fecha";
	export let locale: string = "es-DO";
	export let disabled: boolean = false;
	let className: string = "";
	export { className as class };

	const dispatch = createEventDispatcher<{ change: string }>();

	let open = false;
	let viewYear: number;
	let viewMonth: number; // 0-indexed

	// Initialize view to current date or selected date
	$: {
		if (value) {
			const [y, m] = value.split('-').map(Number);
			if (y && m) {
				viewYear = y;
				viewMonth = m - 1;
			}
		} else {
			const now = new Date();
			viewYear = now.getFullYear();
			viewMonth = now.getMonth();
		}
	}

	const weekdays = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

	function getDaysInMonth(year: number, month: number): number {
		return new Date(year, month + 1, 0).getDate();
	}

	function getFirstDayOfMonth(year: number, month: number): number {
		return new Date(year, month, 1).getDay();
	}

	function getMonthName(month: number): string {
		const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
		                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
		return months[month];
	}

	function formatDisplayDate(dateStr: string): string {
		if (!dateStr) return placeholder;
		try {
			const [year, month, day] = dateStr.split('-').map(Number);
			const date = new Date(year, month - 1, day);
			return date.toLocaleDateString(locale, { dateStyle: 'medium' });
		} catch {
			return dateStr;
		}
	}

	function prevMonth() {
		if (viewMonth === 0) {
			viewMonth = 11;
			viewYear--;
		} else {
			viewMonth--;
		}
	}

	function nextMonth() {
		if (viewMonth === 11) {
			viewMonth = 0;
			viewYear++;
		} else {
			viewMonth++;
		}
	}

	function selectDate(day: number) {
		const newValue = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		value = newValue;
		dispatch('change', newValue);
		open = false;
	}

	function isSelected(day: number): boolean {
		if (!value) return false;
		const [y, m, d] = value.split('-').map(Number);
		return y === viewYear && m === viewMonth + 1 && d === day;
	}

	function isToday(day: number): boolean {
		const today = new Date();
		return today.getFullYear() === viewYear && 
		       today.getMonth() === viewMonth && 
		       today.getDate() === day;
	}

	$: daysInMonth = getDaysInMonth(viewYear, viewMonth);
	$: firstDay = getFirstDayOfMonth(viewYear, viewMonth);
	$: calendarDays = Array.from({ length: 42 }, (_, i) => {
		const day = i - firstDay + 1;
		if (day < 1 || day > daysInMonth) return null;
		return day;
	});
</script>

<Popover.Root bind:open>
	<Popover.Trigger
		class={cn(
			"inline-flex w-full items-center justify-start whitespace-nowrap rounded-md text-sm font-normal ring-offset-background transition-colors",
			"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
			"disabled:pointer-events-none disabled:opacity-50",
			"border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2",
			!value && "text-muted-foreground",
			className
		)}
		{disabled}
	>
		<CalendarIcon class="mr-2 h-4 w-4" />
		{formatDisplayDate(value)}
	</Popover.Trigger>
	<Popover.Content class="w-auto p-0 z-[100]" align="start">
		<div class="p-3">
			<!-- Header with navigation -->
			<div class="flex items-center justify-between mb-4">
				<Button variant="outline" size="icon" class="h-7 w-7" on:click={prevMonth}>
					<ChevronLeft class="h-4 w-4" />
				</Button>
				<div class="font-medium text-sm">
					{getMonthName(viewMonth)} {viewYear}
				</div>
				<Button variant="outline" size="icon" class="h-7 w-7" on:click={nextMonth}>
					<ChevronRight class="h-4 w-4" />
				</Button>
			</div>

			<!-- Weekday headers -->
			<div class="grid grid-cols-7 gap-1 mb-1">
				{#each weekdays as day}
					<div class="h-9 w-9 flex items-center justify-center text-xs text-muted-foreground font-medium">
						{day}
					</div>
				{/each}
			</div>

			<!-- Calendar grid -->
			<div class="grid grid-cols-7 gap-1">
				{#each calendarDays as day}
					{#if day === null}
						<div class="h-9 w-9"></div>
					{:else}
						<button
							type="button"
							class={cn(
								"h-9 w-9 rounded-md text-sm font-normal transition-colors",
								"hover:bg-accent hover:text-accent-foreground",
								"focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
								isSelected(day) && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
								isToday(day) && !isSelected(day) && "bg-accent text-accent-foreground"
							)}
							on:click={() => selectDate(day)}
						>
							{day}
						</button>
					{/if}
				{/each}
			</div>
		</div>
	</Popover.Content>
</Popover.Root>
