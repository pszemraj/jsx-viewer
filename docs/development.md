# Development And Maintenance

## Common Commands

| Command | Purpose |
| ------- | ------- |
| `npm start` or `npm run dev` | Launch the empty local drop/upload/paste UI |
| `npm run demo` | Preload and watch `example/Dashboard.tsx` |
| `npm run dev:browser` | Launch the browser-only entry locally |
| `npm run slot:reset` | Restore `component/View.tsx` and clear inactive runtime slots for this checkout |
| `npm run guard:slot` | Fail if `component/View.tsx` differs from the tracked placeholder |
| `npm test` | Run the CLI, protocol, runtime, and UI test suite |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript and checked-JS type-checking |
| `npm run build` | Production build to `dist/` |
| `npm run build:browser` | Production browser build to `dist-browser/` |

## Hook Behavior

On non-Windows systems, `npm install` also configures a repo-local pre-commit
hook that blocks commits when `component/View.tsx` has been changed away from
the tracked placeholder.

On Windows, hook installation is skipped by default because Git-for-Windows
shell hooks can be flaky in some environments. The guard still exists as:

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

## Related Docs

- [Usage guide](usage.md)
- [Runtime and supported packages](runtime-and-packages.md)
