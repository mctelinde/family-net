export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

/** Reads the persisted theme preference, falling back to the OS preference. */
export function getPreferredTheme(): Theme {
	if (typeof window === 'undefined') return 'light';
	const stored = window.localStorage.getItem(STORAGE_KEY);
	if (stored === 'light' || stored === 'dark') return stored;
	return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Applies the theme to the document root and persists the choice. */
export function applyTheme(theme: Theme) {
	if (typeof document === 'undefined') return;
	document.documentElement.setAttribute('data-theme', theme);
	window.localStorage.setItem(STORAGE_KEY, theme);
}
