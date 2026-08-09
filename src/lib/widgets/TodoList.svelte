<script lang="ts">
	import type { NotebookEntry } from '$lib/types';
	import { CheckCircle2, Circle, Plus, Trash2, RefreshCw } from 'lucide-svelte';

	interface TodoItem {
		id: string;
		text: string;
		done: boolean;
		dueDate?: string;
		recurring?: 'daily' | 'weekly' | 'monthly' | 'yearly';
		completedAt?: string; // ISO date string — used to determine when to auto-reset
	}

	const RECURRENCE_MS: Record<NonNullable<TodoItem['recurring']>, number> = {
		daily:   1000 * 60 * 60 * 24,
		weekly:  1000 * 60 * 60 * 24 * 7,
		monthly: 1000 * 60 * 60 * 24 * 30,
		yearly:  1000 * 60 * 60 * 24 * 365,
	};

	function isDueForReset(todo: TodoItem): boolean {
		if (!todo.done || !todo.recurring || !todo.completedAt) return false;
		const elapsed = Date.now() - new Date(todo.completedAt).getTime();
		return elapsed >= RECURRENCE_MS[todo.recurring];
	}

	let { entry }: { entry: NotebookEntry } = $props();

	let todos = $state<TodoItem[]>([]);
	let newTodoText = $state('');
	let newTodoRecurring = $state<'daily' | 'weekly' | 'monthly' | 'yearly' | 'none'>('none');
	let isSaving = $state(false);
	let error = $state('');

	// Initialize from entry.data, auto-resetting any overdue recurring items
	$effect(() => {
		const data = entry.data as { items?: TodoItem[] };
		const loaded = data.items ?? [];
		const needsReset = loaded.some(isDueForReset);
		if (needsReset) {
			todos = loaded.map((t) => isDueForReset(t) ? { ...t, done: false, completedAt: undefined } : t);
			saveTodos();
		} else {
			todos = loaded;
		}
	});

	function generateId() {
		return `todo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	async function addTodo(e: Event) {
		e.preventDefault();
		if (!newTodoText.trim()) return;

		const newTodo: TodoItem = {
			id: generateId(),
			text: newTodoText.trim(),
			done: false,
			recurring: newTodoRecurring !== 'none' ? (newTodoRecurring as any) : undefined,
		};

		todos = [...todos, newTodo];
		newTodoText = '';
		newTodoRecurring = 'none';
		await saveTodos();
	}

	async function toggleTodo(id: string) {
		const todo = todos.find((t) => t.id === id);
		if (todo) {
			todo.done = !todo.done;
			todo.completedAt = todo.done ? new Date().toISOString() : undefined;
			todos = todos;
			await saveTodos();
		}
	}

	async function removeTodo(id: string) {
		todos = todos.filter((t) => t.id !== id);
		await saveTodos();
	}

	async function resetRecurringTodo(id: string) {
		const todo = todos.find((t) => t.id === id);
		if (todo && todo.recurring) {
			todo.done = false;
			todo.completedAt = undefined;
			todos = todos;
			await saveTodos();
		}
	}

	async function saveTodos() {
		isSaving = true;
		error = '';
		try {
			const formData = new FormData();
			formData.append('items', JSON.stringify(todos));

			const response = await fetch('?/updateTodos', {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) {
				error = 'Failed to save todos';
				console.error('Save error:', response.statusText);
			}
		} catch (err) {
			error = 'Error saving todos: ' + (err instanceof Error ? err.message : 'Unknown error');
			console.error('Error saving todos:', err);
		} finally {
			isSaving = false;
		}
	}

	function formatRelative(isoDate: string): string {
		const diff = Date.now() - new Date(isoDate).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hrs = Math.floor(mins / 60);
		if (hrs < 24) return `${hrs}h ago`;
		return `${Math.floor(hrs / 24)}d ago`;
	}

	const activeTodos = $derived(todos.filter((t) => !t.done));
	const completedTodos = $derived(todos.filter((t) => t.done));

</script>

<article class="widget-todo">
	<header>
		<h1>{entry.title}</h1>
		{#if entry.tags.length}
			<div class="tags">
				{#each entry.tags as tag}
					<span class="tag">{tag}</span>
				{/each}
			</div>
		{/if}
		<p class="meta">Updated {entry.updated}</p>
	</header>

	{#if error}
		<div class="error-message">{error}</div>
	{/if}

	<section class="add-todo">
		<form onsubmit={addTodo} class="add-form">
			<input
				type="text"
				placeholder="Add a new todo..."
				bind:value={newTodoText}
				class="add-input"
			/>
			<select bind:value={newTodoRecurring} class="recurring-select">
				<option value="none">Once</option>
				<option value="daily">Daily</option>
				<option value="weekly">Weekly</option>
				<option value="monthly">Monthly</option>
				<option value="yearly">Yearly</option>
			</select>
			<button type="submit" disabled={isSaving || !newTodoText.trim()} class="add-btn">
				<Plus size={18} />
				Add
			</button>
		</form>
	</section>

	<section class="todo-list">
		{#if activeTodos.length > 0}
			<div class="section-header">
				<h2>Active</h2>
				<span class="count">{activeTodos.length}</span>
			</div>
			<ul class="todos active-list">
				{#each activeTodos as todo (todo.id)}
					<li class="todo-item">
						<button
							class="checkbox"
							onclick={() => toggleTodo(todo.id)}
							title="Mark as complete"
						>
							<Circle size={20} />
						</button>
						<span class="todo-text">{todo.text}</span>
						{#if todo.recurring}
							<span class="recurring-badge" title={`Repeats ${todo.recurring}`}>
								<RefreshCw size={14} />
								{todo.recurring}
							</span>
						{/if}
						<button
							class="delete-btn"
							onclick={() => removeTodo(todo.id)}
							title="Delete todo"
						>
							<Trash2 size={16} />
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if completedTodos.length > 0}
			<div class="section-header completed">
				<h2>Completed</h2>
				<span class="count">{completedTodos.length}</span>
			</div>
			<ul class="todos completed-list">
				{#each completedTodos as todo (todo.id)}
					<li class="todo-item completed">
						<button
							class="checkbox"
							onclick={() => toggleTodo(todo.id)}
							title="Mark as incomplete"
						>
							<CheckCircle2 size={20} />
						</button>
						<span class="todo-text">{todo.text}</span>
							{#if todo.recurring}
								<span class="recurring-info" title="Will auto-reset after one {todo.recurring}">
									<RefreshCw size={13} />
									{todo.recurring}
									{#if todo.completedAt}
										· done {formatRelative(todo.completedAt)}
									{/if}
								</span>
							{/if}
						<button
							class="delete-btn"
							onclick={() => removeTodo(todo.id)}
							title="Delete todo"
						>
							<Trash2 size={16} />
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		{#if todos.length === 0}
			<div class="empty-state">
				<p>No todos yet. Add one to get started!</p>
			</div>
		{/if}
	</section>
</article>

<style>
	.widget-todo {
		max-width: 720px;
	}

	header {
		margin-bottom: 2rem;
		padding-bottom: 1.25rem;
		border-bottom: 1px solid #e5e3de;
	}

	h1 {
		margin: 0 0 0.5rem;
		font-size: clamp(1.4rem, 3vw, 2rem);
		font-weight: 700;
		color: #1a1a2e;
		line-height: 1.25;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		margin-bottom: 0.5rem;
	}

	.tag {
		padding: 0.2rem 0.6rem;
		background: #f0eff9;
		color: #4f46e5;
		border-radius: 99px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.meta {
		margin: 0;
		font-size: 0.8rem;
		color: #9b9baa;
	}

	.error-message {
		padding: 0.75rem 1rem;
		background: #fee2e2;
		border: 1px solid #fecaca;
		border-radius: 6px;
		color: #dc2626;
		font-size: 0.9rem;
		margin-bottom: 1rem;
	}

	.add-todo {
		margin-bottom: 2rem;
		padding: 1rem;
		background: #fafaf8;
		border-radius: 8px;
		border: 1px solid #e5e3de;
	}

	.add-form {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.add-input {
		flex: 1;
		min-width: 200px;
		padding: 0.75rem 1rem;
		border: 1px solid #d9d6cf;
		border-radius: 6px;
		font-size: 0.95rem;
		font-family: inherit;
		color: #1a1a2e;
		background: #fff;
	}

	.add-input::placeholder {
		color: #9b9baa;
	}

	.add-input:focus {
		outline: none;
		border-color: #4f46e5;
		box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
	}

	.recurring-select {
		padding: 0.75rem 0.75rem;
		border: 1px solid #d9d6cf;
		border-radius: 6px;
		font-size: 0.9rem;
		font-family: inherit;
		color: #1a1a2e;
		background: #fff;
		cursor: pointer;
	}

	.recurring-select:focus {
		outline: none;
		border-color: #4f46e5;
		box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.1);
	}

	.add-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.25rem;
		background: #4f46e5;
		color: #fff;
		border: none;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.12s;
	}

	.add-btn:hover:not(:disabled) {
		background: #4338ca;
	}

	.add-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.todo-list {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.section-header h2 {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #1a1a2e;
	}

	.section-header.completed h2 {
		color: #6b7280;
	}

	.count {
		padding: 0.2rem 0.6rem;
		background: #4f46e5;
		color: #fff;
		border-radius: 99px;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.section-header.completed .count {
		background: #9ca3af;
	}

	.todos {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.todo-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 0.85rem;
		background: #fff;
		border: 1px solid #e5e3de;
		border-radius: 6px;
		transition: background 0.12s, border-color 0.12s;
	}

	.todo-item:hover {
		background: #fafaf8;
		border-color: #d9d6cf;
	}

	.todo-item.completed {
		background: #f3f4f6;
		border-color: #e5e7eb;
	}

	.todo-item.completed .todo-text {
		color: #9ca3af;
		text-decoration: line-through;
	}

	.checkbox {
		background: none;
		border: none;
		cursor: pointer;
		color: #4f46e5;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: color 0.12s;
	}

	.checkbox:hover {
		color: #4338ca;
	}

	.todo-item.completed .checkbox {
		color: #10b981;
	}

	.todo-text {
		flex: 1;
		font-size: 0.95rem;
		color: #1a1a2e;
		word-break: break-word;
	}

	.recurring-badge {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.25rem 0.6rem;
		background: #fef3c7;
		color: #92400e;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: capitalize;
		flex-shrink: 0;
	}

	.recurring-info {
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.25rem 0.6rem;
		background: #f0f9ff;
		color: #0369a1;
		border-radius: 4px;
		font-size: 0.75rem;
		font-weight: 500;
		flex-shrink: 0;
	}

	.delete-btn {
		background: none;
		border: none;
		cursor: pointer;
		color: #9ca3af;
		padding: 0.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		transition: color 0.12s;
	}

	.delete-btn:hover {
		color: #ef4444;
	}

	.empty-state {
		padding: 2rem 1rem;
		text-align: center;
		color: #9b9baa;
	}

	.empty-state p {
		margin: 0;
		font-size: 0.95rem;
	}
</style>
