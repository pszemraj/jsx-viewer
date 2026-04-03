# jsx-viewer

Render `.jsx` and `.tsx` files as easily as `.html`. One command, one file, rendered.

![JSX Viewer Preview](assets/ui.png)

You get a `.tsx` or `.jsx` artifact from Claude, ChatGPT, or wherever. To actually *see* it, you'd normally scaffold a React app, install deps, wire up imports, run a dev server. That's 5 minutes of ceremony for 2 seconds of viewing. `jsx-viewer` skips all of it.

## Hosted Site (no install)

Go to **[pszemraj.github.io/jsx-viewer](https://pszemraj.github.io/jsx-viewer/)** and use it, web-app style.

Paste, upload, or drag-and-drop a single `.jsx`/`.tsx` file. Transpilation and rendering happen entirely client-side - nothing is sent to a backend, no analytics, no telemetry. Supports default-exported React 18 components and a [built-in allowlist of runtime packages](docs/runtime-and-packages.md).

> [!NOTE]
> The hosted site cannot resolve multi-file imports, arbitrary npm packages, or arbitrary Tailwind classes, and does not sandbox uploaded code. More detail in [Modes and limitations](docs/modes.md) and [Privacy and security](docs/privacy-and-security.md).

## Local Viewer

For the full development workflow: multi-file imports, live file watching, local package resolution, and Tailwind compilation.

Requires **Node 20.19.0+ or 22.12.0+**.

```bash
git clone https://github.com/pszemraj/jsx-viewer.git
cd jsx-viewer
npm install

npm start        # empty drop/upload/paste UI
# npm run demo   # preloads the example dashboard
```

The viewer opens in your browser (*with instructions*). You're done.

Start with a file already loaded:

```bash
node bin/jsx-viewer.mjs path/to/Component.tsx
```

See the [usage guide](docs/usage.md) for all input methods (drag-and-drop, paste, upload), CLI options, and component requirements.

## Modes at a Glance

| Mode         | Best for                                               | Notable limits                                           |
| ------------ | ------------------------------------------------------ | -------------------------------------------------------- |
| Local viewer | Day-to-day development, multi-file work, live watching | Requires Node and a local dev server                     |
| Hosted site  | Quick single-file preview and sharing                  | No multi-file imports, no arbitrary packages, no sandbox |

## Docs

- [Usage guide](docs/usage.md)
- [Modes and limitations](docs/modes.md)
- [Runtime and supported packages](docs/runtime-and-packages.md)
- [Privacy and security](docs/privacy-and-security.md)
- [GitHub Pages deployment](docs/deployment.md)
- [Development and maintenance](docs/development.md)
- [Browser mode smoke matrix](docs/browser-mode-smoke-matrix.md)

## License

MIT
