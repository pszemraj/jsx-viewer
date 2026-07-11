# jsx-viewer

Preview standalone React `.jsx` and `.tsx` files without scaffolding a temporary app.

![JSX Viewer Preview](assets/ui.png)

`jsx-viewer` is for AI-generated UI artifacts, quick prototypes, and component examples that need to be rendered before they are copied into a project. Use the hosted viewer for trusted single-file artifacts, or run the local viewer for watched files, local dependencies, relative imports, and Tailwind compilation.

> [!TIP]
> You can clone, build, and run `jsx-viewer` entirely on your own machine. For most people, the easiest option is the [hosted viewer](https://pszemraj.github.io/jsx-viewer/), which still compiles and renders your file locally in your browser rather than uploading it to a backend.

## Hosted viewer

Open [pszemraj.github.io/jsx-viewer](https://pszemraj.github.io/jsx-viewer/) and paste, upload, or drag and drop a trusted `.jsx` or `.tsx` file.

The hosted viewer transpiles and renders in the browser. Source files are not uploaded to a backend, and the app has no analytics or telemetry. Browser mode is intentionally narrower than the local viewer; see [modes and limitations](docs/modes.md), [runtime and supported packages](docs/runtime-and-packages.md), and [privacy and security](docs/privacy-and-security.md).

## Local viewer

Requires Node.js `^20.19.0` or `>=22.12.0` and npm.

```bash
git clone https://github.com/pszemraj/jsx-viewer.git
cd jsx-viewer
npm install

npm start
```

Start with a file:

```bash
node bin/jsx-viewer.mjs path/to/Component.tsx
```

Run the example dashboard:

```bash
npm run demo
```

See the [usage guide](docs/usage.md) for input methods, CLI options, component requirements, and example artifacts.

## Documentation

- [Usage guide](docs/usage.md)
- [Modes and limitations](docs/modes.md)
- [Runtime and supported packages](docs/runtime-and-packages.md)
- [Privacy and security](docs/privacy-and-security.md)
- [GitHub Pages deployment](docs/deployment.md)
- [Development and maintenance](docs/development.md)
- [Browser mode smoke matrix](docs/browser-mode-smoke-matrix.md)

## License

MIT
