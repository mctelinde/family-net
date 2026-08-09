export type WidgetType = 'note' | 'business-plan' | 'fitness-goals' | 'finance-tracker' | 'todo-list';
export type Visibility = 'private' | 'family';
export type UserRole = 'admin' | 'member';

export interface NotebookEntry {
	slug: string;
	title: string;
	type: WidgetType;
	owner: string;
	visibility: Visibility;
	tags: string[];
	created: string;
	updated: string;
	/** Rendered HTML from markdown body */
	body: string;
	/** Raw frontmatter data (type-specific fields) */
	data: Record<string, unknown>;
}

export interface NotebookEntryMeta extends Omit<NotebookEntry, 'body'> {}

export interface User {
	id: string;
	name: string;
	email: string;
	passwordHash: string;
	role: UserRole;
}

export interface AuthSession {
	userId: string;
	name: string;
	email: string;
	role: UserRole;
	exp: number;
}
