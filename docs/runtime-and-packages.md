# Runtime And Supported Packages

## How The Local Viewer Works

The local viewer uses a Vite dev server plus a WebSocket bridge:

1. Vite handles JSX and TSX transpilation and HMR.
2. The requested artifact is copied into a transient runtime slot.
3. Vite reloads the slot in the browser.
4. A WebSocket bridge handles drag/drop, upload, paste, and toolbar actions.
5. On exit, the transient slot is cleared.

`component/View.tsx` remains a tracked placeholder file for the repo and
package. `npm run slot:reset` restores that placeholder and clears inactive
runtime slots and stale temp cache entries for the current workspace.

## Built-In Packages

These packages are available in the local viewer with no extra install step:

| Package | Version | Notes |
| ------- | ------- | ----- |
| react | 18.x | Hooks and component runtime |
| react-dom | 18.x | DOM rendering |
| recharts | 2.x | Charts and graphs |
| lucide-react | 0.383.x | Icons |
| d3 | 7.x | Data visualization |
| three | 0.164.x | 3D graphics |
| lodash | 4.x | Utilities |
| mathjs | 13.x | Math operations |
| papaparse | 5.x | CSV parsing |
| chart.js | 4.x | Canvas charts |
| tone | 15.x | Audio synthesis |

If your local artifact imports something else, install it in the repo and
restart the viewer.

## Browser Mode Runtime Allowlist

The hosted Pages mode only supports repo-shipped runtime modules for this
allowlist:

- `react`
- `react-dom`
- `react-dom/client`
- `react/jsx-runtime`
- `react/jsx-dev-runtime`
- `recharts`
- `lucide-react`
- `d3`
- `three`
- `lodash`
- `mathjs`
- `papaparse`
- `chart.js`
- `tone`

Unsupported bare imports fail early with a direct error.

## Tailwind

The local viewer compiles Tailwind CSS v3 locally through PostCSS, so arbitrary
utility classes in loaded artifacts work there without a CDN.

The hosted Pages mode does not compile arbitrary Tailwind classes from uploaded
artifacts. Prefer inline styles there, or use the local viewer when Tailwind
compilation matters.

## Related Docs

- [Modes and limitations](modes.md)
- [Usage guide](usage.md)
- [Development and maintenance](development.md)
