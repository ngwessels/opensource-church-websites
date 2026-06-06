<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Verification

Do **not** run `npm run build` as a routine check after every change. Running production builds repeatedly interferes with local development (locks, stale output, and conflicts with `next dev`).

Prefer lighter verification instead:

- **Lint / typecheck** when available (e.g. `npm run lint`, or the IDE linter on edited files).
- **Targeted checks** — curl or fetch a specific route, run a focused script, or inspect the changed module.
- **`next dev`** — if the dev server is already running, confirm behavior in the browser or via API requests.
- **`npm run build`** — only when the user explicitly asks for a production build, or when validating a release/deploy-specific issue that cannot be checked another way.
