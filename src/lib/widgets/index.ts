import type { NotebookEntry } from '$lib/types';
import type { Component } from 'svelte';
import Note from './Note.svelte';
import BusinessPlan from './BusinessPlan.svelte';
import FitnessGoals from './FitnessGoals.svelte';
import FinanceTracker from './FinanceTracker.svelte';
import type { WidgetType } from '$lib/types';

export { Note, BusinessPlan, FitnessGoals, FinanceTracker };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry: Record<WidgetType, Component<any>> = {
	'note': Note,
	'business-plan': BusinessPlan,
	'fitness-goals': FitnessGoals,
	'finance-tracker': FinanceTracker,
};

export function getWidget(type: string): Component<{ entry: NotebookEntry }> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (registry[type as WidgetType] ?? Note) as Component<{ entry: NotebookEntry }>;
}
