# Runtime and Supported Packages

## How the Local Viewer Works

The local viewer uses a Vite dev server plus a WebSocket bridge:

1. Vite handles JSX and TSX transpilation and HMR.
2. The requested artifact is copied into a transient runtime slot.
3. Vite reloads the slot in the browser.
4. A WebSocket bridge handles drag/drop, upload, paste, and toolbar actions.
5. On exit, the transient slot is cleared.

`component/View.tsx` remains a tracked placeholder file for the repo and package. `npm run slot:reset` restores that placeholder and clears inactive runtime slots and stale temp cache entries for the current workspace.

## Built-in Packages

These packages are available in the local viewer with no extra install step:

| Package      | Version | Notes                       |
| ------------ | ------- | --------------------------- |
| react        | 18.x    | Hooks and component runtime |
| react-dom    | 18.x    | DOM rendering               |
| recharts     | 2.x     | Charts and graphs           |
| lucide-react | 0.383.x | Icons                       |
| d3           | 7.x     | Data visualization          |
| three        | 0.164.x | 3D graphics                 |
| lodash       | 4.x     | Utilities                   |
| mathjs       | 13.x    | Math operations             |
| papaparse    | 5.x     | CSV parsing                 |
| chart.js     | 4.x     | Canvas charts               |
| tone         | 15.x    | Audio synthesis             |

If your local artifact imports something else, install it in the repo and restart the viewer.

## Browser Mode Package Resolution

The hosted Pages mode keeps React on same-origin runtime modules so uploaded
artifacts share the viewer's React instance. The preview frame carries an import
map for these runtime specifiers:

- `react`
- `react-dom`
- `react-dom/client`
- `react/jsx-runtime`
- `react/jsx-dev-runtime`

The browser transpiler rewrites other bare imports to `https://esm.sh/`. Those
CDN URLs force `react` and `react-dom` peer resolution to the React 18 versions
shipped by this viewer, so package builds share the same React instance as the
preview frame.

Browser mode can therefore handle many npm-backed single-file artifacts such as
icon packages or charting helpers without asking the user to run a local dev
server first. If the artifact imports a non-runtime package as
`package@version`, that version is preserved; otherwise `esm.sh` resolves the
current package build. React runtime versions and subpaths outside the import
map are rejected instead of being sent to the CDN, because loading a second
React instance would break hooks and renderer identity. Packages still need to
execute in a plain browser and tolerate the viewer-owned React runtime.
Unsupported import forms and Node-only globals are listed in [modes and
limitations](modes.md).

## Tailwind

The local viewer compiles Tailwind CSS v3 locally through PostCSS, so arbitrary utility classes in loaded artifacts work there without a CDN.

The hosted Pages mode detects class-based artifacts and loads Tailwind's
browser runtime from `https://cdn.tailwindcss.com/` before rendering. That lets
normal utility-class-heavy single-file artifacts render in the hosted site.

The hosted path still does not read your local Tailwind config, custom plugins,
or local design tokens. Use the local viewer when you need the repo's Tailwind
pipeline rather than the browser runtime defaults.

## Related Docs

- [Modes and limitations](modes.md)
- [Usage guide](usage.md)
- [Browser mode smoke matrix](browser-mode-smoke-matrix.md)
- [Development and maintenance](development.md)
