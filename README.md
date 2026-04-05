# jsx-viewer

Render `.jsx` and `.tsx` files as easily as `.html`. One command, one file, rendered.

![JSX Viewer Preview](assets/ui.png)

You get a `.tsx` or `.jsx` artifact from Claude, ChatGPT, or wherever. To actually *see* it, you'd normally scaffold a React app, install deps, wire up imports, run a dev server. That's 5 minutes of ceremony for 2 seconds of viewing. `jsx-viewer` skips all of it.

## Hosted Site (no install)

Go to **[pszemraj.github.io/jsx-viewer](https://pszemraj.github.io/jsx-viewer/)** and use it, web-app style.

Paste, upload, or drag-and-drop a single `.jsx`/`.tsx` file. Transpilation and rendering happen entirely client-side - nothing is sent to a backend, no analytics, no telemetry. Hosted mode keeps React on same-origin runtime modules, resolves many bare npm package imports through `esm.sh`, and can opt into Tailwind's browser runtime when the uploaded artifact uses utility classes.

> [!NOTE]
> The hosted site still does not resolve multi-file relative imports and does not sandbox uploaded code. Package-heavy or class-heavy artifacts can trigger network fetches to `esm.sh` and `cdn.tailwindcss.com`. More detail in [Modes and limitations](https://github.com/pszemraj/jsx-viewer/blob/main/docs/modes.md) and [Privacy and security](https://github.com/pszemraj/jsx-viewer/blob/main/docs/privacy-and-security.md).

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

Additional repo-shipped example artifacts:

- `example/PolyField.tsx` for advanced TSX typing, `forwardRef`, context, and imperative handles
- `example/DataTable.jsx` for compound components, render props, context, and `Suspense`
- `example/Dashboard.tsx` for CDN-backed package imports and Tailwind utilities

Start with a file already loaded:

```bash
node bin/jsx-viewer.mjs path/to/Component.tsx
```

See the [usage guide](https://github.com/pszemraj/jsx-viewer/blob/main/docs/usage.md) for all input methods (drag-and-drop, paste, upload), CLI options, and component requirements.

## Modes at a Glance

| Mode         | Best for                                               | Notable limits                                           |
| ------------ | ------------------------------------------------------ | -------------------------------------------------------- |
| Local viewer | Day-to-day development, multi-file work, live watching | Requires Node and a local dev server                     |
| Hosted site  | Quick single-file preview and sharing                  | No multi-file imports, trusted code only, CDN-backed package/style runtime |

## Docs

- [Usage guide](https://github.com/pszemraj/jsx-viewer/blob/main/docs/usage.md)
- [Modes and limitations](https://github.com/pszemraj/jsx-viewer/blob/main/docs/modes.md)
- [Runtime and supported packages](https://github.com/pszemraj/jsx-viewer/blob/main/docs/runtime-and-packages.md)
- [Privacy and security](https://github.com/pszemraj/jsx-viewer/blob/main/docs/privacy-and-security.md)
- [GitHub Pages deployment](https://github.com/pszemraj/jsx-viewer/blob/main/docs/deployment.md)
- [Development and maintenance](https://github.com/pszemraj/jsx-viewer/blob/main/docs/development.md)
- [Browser mode smoke matrix](https://github.com/pszemraj/jsx-viewer/blob/main/docs/browser-mode-smoke-matrix.md)

## License

MIT
