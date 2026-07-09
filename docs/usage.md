# Usage Guide

`jsx-viewer` has two workflows:

- local viewer: run the Vite/WebSocket app on your machine
- website/browser mode: use the hosted Pages app for single-file artifacts

See [modes and limitations](modes.md) for the full comparison.

## Website / Browser Mode

Use the hosted site for trusted single-file artifacts:

- public site: [pszemraj.github.io/jsx-viewer](https://pszemraj.github.io/jsx-viewer/)
- local fast loop: `npm run dev:browser`
- local deployment-faithful check: `npm run preview:browser`

The browser path supports drag-and-drop, upload, and paste. Browser-mode support and rejection rules are listed in [modes and limitations](modes.md).

Use the local viewer instead when the artifact depends on relative imports, repo-local packages, or a full local Tailwind pipeline.

## Local Viewer

Start with a file when you want the smoothest workflow. The viewer watches it for changes and refreshes in the browser as you save.

```bash
node bin/jsx-viewer.mjs path/to/Component.tsx
# optional after global install or link:
jsx-viewer path/to/Component.tsx
```

`.tsx` is the preferred format, but `.jsx` also works.

You can also start empty with:

```bash
npm start
```

Then load an artifact by:

- dragging and dropping a `.jsx` or `.tsx` file into the window
- using the upload button
- pasting source with `Ctrl+V` or `Cmd+V`

When a file is already loaded, use `swap file` to replace it or `clear` to return to the empty state.

Example artifacts:

- `example/PolyField.tsx` exercises advanced TSX typing, `forwardRef`, context, and imperative handles
- `example/DataTable.jsx` exercises compound components, render props, context, and `Suspense`
- `example/Dashboard.tsx` exercises package imports and Tailwind-heavy styling

Quickest preload:

```bash
npm run demo
```

## CLI options

```bash
node bin/jsx-viewer.mjs [options] [file.jsx|file.tsx]

  -p, --port <n>   Viewer HTTP port (default: 3142, max: 65534)
                   WebSocket listens on port + 1
  -v, --version    Show version
  -h, --help       Show help
```

Pass zero or one `.jsx` or `.tsx` file. Unknown flags, duplicate `--port` arguments, unsupported extensions, and extra positional arguments fail fast.

The viewer auto-opens in the browser unless `CI` is already set.

## Component requirements

Your artifact needs a default export that is renderable as a React component:

```tsx
export default function MyComponent() {
  return <div>Hello</div>;
}
```

Wrapped defaults created with `React.memo(...)`, `forwardRef(...)`, and `lazy(...)` are supported as long as the default export is still renderable.

## Related Docs

- [Modes and limitations](modes.md)
- [Runtime and supported packages](runtime-and-packages.md)
- [Privacy and security](privacy-and-security.md)
- [GitHub Pages deployment](deployment.md)
