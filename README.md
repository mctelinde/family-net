# family-net

Family Net is a markdown-first family planning notebook built with SvelteKit.

## Features

- Secure markdown editor and live notebook preview
- Export notebook content to a clean HTML document
- Responsive interface designed for desktop and mobile
- Vercel adapter configured for deployment

## Security notes

- Markdown output is sanitized and only allows safe link protocols (`http`, `https`, `mailto`), root-relative links, and anchors.
- Raw HTML from markdown input is escaped before rendering.

## Local development

```sh
npm install
npm run dev
```

## Quality checks

```sh
npm run check
npm test
npm run build
```

## Deployment

This project is configured for Vercel via `@sveltejs/adapter-vercel`.
