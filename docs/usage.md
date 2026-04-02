# Usage Guide

`jsx-viewer` supports two main workflows:

- local viewer: run the Vite/WebSocket app on your machine
- website/browser mode: use the hosted Pages app for single-file artifacts

See [modes and limitations](modes.md) for the full comparison.

## Local Viewer

Start with a file when you want the smoothest workflow. The viewer watches it
for changes and refreshes in the browser as you save.

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

When a file is already loaded, use `swap file` to replace it or `clear` to
return to the empty state.

An example dashboard is included:

```bash
npm run demo
```

## CLI Options

```bash
node bin/jsx-viewer.mjs [options] [file.jsx|file.tsx]

  -p, --port <n>   Viewer HTTP port (default: 3142, max: 65534)
                   WebSocket listens on port + 1
  -v, --version    Show version
  -h, --help       Show help
```

Pass zero or one `.jsx` or `.tsx` file. Unknown flags, duplicate `--port`
arguments, unsupported extensions, and extra positional arguments fail fast.

The viewer auto-opens in the browser unless `CI` is already set.

## Component Requirements

Your artifact needs a default export that is renderable as a React component:

```tsx
export default function MyComponent() {
  return <div>Hello</div>;
}
```

Wrapped defaults created with `React.memo(...)`, `forwardRef(...)`, and
`lazy(...)` are supported as long as the default export is still renderable.

## Related Docs

- [Modes and limitations](modes.md)
- [Runtime and supported packages](runtime-and-packages.md)
- [GitHub Pages deployment](deployment.md)
