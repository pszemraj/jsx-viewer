# Development And Maintenance

## Common Commands

| Command | Purpose |
| --- | --- |
| `npm start` or `npm run dev` | Launch the empty local drop/upload/paste UI |
| `npm run demo` | Preload and watch `example/Dashboard.tsx` |
| `npm run dev:browser` | Launch the fast browser-only dev entry locally |
| `npm run preview:browser` | Build the finalized Pages artifact and serve it locally |
| `npm run slot:reset` | Restore `component/View.tsx` and clear inactive runtime slots for this checkout |
| `npm run guard:slot` | Fail if `component/View.tsx` differs from the tracked placeholder |
| `npm test` | Run the CLI, protocol, runtime, and UI test suite |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript and checked-JS type-checking |
| `npm run build` | Production build to `dist/` |
| `npm run build:browser` | Production browser build to `dist-browser/` |

## Hook Behavior

On non-Windows systems, `npm install` also configures a repo-local pre-commit hook that blocks commits when `component/View.tsx` has been changed away from the tracked placeholder.

On Windows, hook installation is skipped by default because Git-for-Windows shell hooks can be flaky in some environments. The guard still exists as:

```powershell
npm run guard:slot
```

If you still want the hook on Windows, opt in explicitly before install:

```powershell
$env:JSX_VIEWER_ENABLE_GIT_HOOKS='1'
npm install
```

For POSIX shells:

```bash
JSX_VIEWER_ENABLE_GIT_HOOKS=1 npm install
```

## Maintenance Notes

- `component/View.tsx` should remain the tracked placeholder, not a loaded artifact
- `dist/` and `dist-browser/` are build outputs and should stay uncommitted
- Pages deployment behavior is documented in [deployment.md](deployment.md)

## Browser Mode Validation Paths

- `npm run dev:browser` is the fast inner loop for transpiler/runtime work. It intentionally serves the source `index.browser.html` without the deployed CSP so Vite can inject its dev client.
- `npm run preview:browser` is the deployment-faithful local check. It builds `dist-browser/`, finalizes `index.html`, preserves the Pages CSP, and serves the result through `vite preview`.
- Browser-mode validation can include CDN-backed npm packages, Tailwind utility classes, remote images, and artifact-authored data requests. Network behavior is covered in [privacy and security](privacy-and-security.md#network-behavior).
- When validating non-root Pages paths locally, pass the same `VITE_BASE_PATH` you expect in deployment and open that prefixed route in preview mode.

## Related Docs

- [Usage guide](usage.md)
- [Runtime and supported packages](runtime-and-packages.md)
