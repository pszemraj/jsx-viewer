# jsx-viewer

Render single-file React `.jsx` and `.tsx` artifacts with minimal setup. Use
the local viewer for the full development workflow, or use the hosted site for
quick single-file previews.

![JSX Viewer Preview](assets/ui.png)

## Website

Live site: [pszemraj.github.io/jsx-viewer](https://pszemraj.github.io/jsx-viewer/)

The website can:

- paste, upload, or drag and drop a single `.jsx` or `.tsx` file
- transpile and render it client-side in the browser
- support default-exported React 18 components plus a repo-shipped allowlist of runtime packages

The website cannot:

- resolve relative imports or multi-file project graphs
- resolve arbitrary npm packages
- support CommonJS, `process.env`, or `import.meta.env`
- compile arbitrary Tailwind classes from uploaded artifacts
- sandbox untrusted code; uploaded code runs in the same page as the viewer

Privacy and execution:

- the app ships with no analytics, telemetry, or third-party trackers
- uploaded or pasted artifacts are not sent to a backend by the app
- the hosted site serves static assets; transpilation and rendering happen on your machine in the browser
- after initial load, browser mode should only fetch same-origin app and runtime assets

More detail: [Modes and limitations](docs/modes.md), [Privacy and security](docs/privacy-and-security.md), and the [browser smoke matrix](docs/browser-mode-smoke-matrix.md).

## Local Viewer

For local development, `jsx-viewer` runs a Vite/WebSocket viewer on your
machine and supports the broader workflow: multi-file imports, live watching,
local package resolution, and local Tailwind compilation.

Requirements: Node 20.19.0+ or 22.12.0+

```bash
git clone https://github.com/pszemraj/jsx-viewer.git
cd jsx-viewer
npm install
# spin up blank UI on localhost
npm start
```

Or start with a file already loaded:

```bash
# or preload a file
node bin/jsx-viewer.mjs path/to/Component.tsx
```


## Modes At A Glance

| Mode | Best for | Notable limits |
| ---- | -------- | -------------- |
| Local viewer | day-to-day development, multi-file work, live watching | requires Node and a local dev server |
| Website / Pages browser mode | quick single-file preview and sharing | no multi-file imports, no arbitrary packages, no sandbox |

## Docs

- [Usage guide](docs/usage.md)
- [Modes and limitations](docs/modes.md)
- [Runtime and supported packages](docs/runtime-and-packages.md)
- [GitHub Pages deployment](docs/deployment.md)
- [Privacy and security](docs/privacy-and-security.md)
- [Development and maintenance](docs/development.md)
- [Browser mode smoke matrix](docs/browser-mode-smoke-matrix.md)

## License

MIT
