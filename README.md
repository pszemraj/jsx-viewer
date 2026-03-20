# jsx-viewer

Render `.jsx` and `.tsx` files as easily as `.html`. One command, one file, rendered.

![JSX Viewer Preview](assets/ui.png)

You get a `.tsx` or `.jsx` artifact from Claude, ChatGPT, or wherever. To actually *see* it, you'd normally scaffold a React app, install deps, wire up imports, run a dev server. That's 5 minutes of ceremony for 2 seconds of viewing. `jsx-viewer` skips all of it.

```bash
git clone https://github.com/pszemraj/jsx-viewer.git
cd jsx-viewer
npm install

npm start        # empty drop/upload/paste UI
# npm run demo     # preloads the example dashboard
```

The viewer opens in your browser. You're done.

## Usage

There are four ways to get a component on screen:

**Start with a file** (recommended) - pass it directly and it's watched for changes. Save in your editor, browser updates.

```bash
node bin/jsx-viewer.mjs path/to/Component.tsx
# optional, only after global install/link:
jsx-viewer path/to/Component.tsx
```

`.tsx` is the preferred artifact format, but `.jsx` continues to work.

**Drag and drop** - start with no args (`npm start`), drag a `.jsx` or `.tsx` file onto the browser window.

**Upload a file** - start with no args (`npm start`), click `upload artifact`, and choose a local `.jsx` or `.tsx` file.

**Paste source** - start with no args, focus the viewer window, and press `Ctrl+V` / `Cmd+V`. No extra paste button is required.

An included TSX example dashboard is available via `npm run demo`.

When a file is already loaded, use the toolbar `clear` button to return to the empty drop/upload/paste state before loading the next one.

### Options

```bash
node bin/jsx-viewer.mjs [options] [file.tsx]

  -p, --port <n>   Dev server port (default: 3142)
  -h, --help       Show help
```

If you globally install/link the package, the same command becomes `jsx-viewer [options] [file.tsx]`.

WebSocket runs on port + 1 (default: 3143).

### Component requirements

Your JSX/TSX file needs a **default export** of a React component:

```tsx
export default function MyComponent() {
  return <div>Hello</div>;
}
```

## Reference

### How it works

1. **Vite dev server** handles JSX/TSX transpilation and HMR
2. Your file is copied to a **slot** (`component/View.tsx`) - the single render target
3. Vite picks up the change and hot-reloads the browser instantly
4. A **WebSocket bridge** connects the browser UI to the CLI for drag-and-drop/paste
5. On exit, the slot resets to a placeholder - your file is never committed, the repo stays clean

If the viewer still shows a previously loaded component after an abnormal stop, run `npm run slot:reset` before starting again.

### Pre-installed libraries

These are available for `import` in your JSX/TSX files with no setup:

| Package      | Version | Notes              |
| ------------ | ------- | ------------------ |
| react        | 18.x    | Hooks, etc.        |
| react-dom    | 18.x    |                    |
| recharts     | 2.x     | Charts/graphs      |
| lucide-react | 0.383.x | Icons              |
| d3           | 7.x     | Data visualization |
| three        | 0.164.x | 3D graphics        |
| lodash       | 4.x     | Utilities          |
| mathjs       | 13.x    | Math operations    |
| papaparse    | 5.x     | CSV parsing        |
| chart.js     | 4.x     | Canvas charts      |
| tone         | 15.x    | Audio synthesis    |

**Tailwind CSS v3** is compiled locally via PostCSS - no CDN, no external network calls. Works fully offline and behind corporate firewalls. JIT recompiles on every slot swap, so arbitrary utility classes just work.

If your artifact imports something not listed here, `npm install` it and restart the viewer. Vite picks it up automatically.

### Dev commands

| Command                     | Purpose                                         |
| --------------------------- | ----------------------------------------------- |
| `npm start` / `npm run dev` | Launch the empty drop/upload/paste UI           |
| `npm run demo`              | Preload and watch `example/Dashboard.tsx`       |
| `npm run slot:reset`        | Restore `component/View.tsx` to the placeholder |
| `npm run guard:slot`        | Fail if the slot contains loaded artifact code  |
| `npm run lint`              | Run ESLint                                      |
| `npm run typecheck`         | Run TypeScript type-checking                    |
| `npm run build`             | Production build to `dist/`                     |

On non-Windows systems, `npm install` also configures a repo-local pre-commit hook that blocks commits when `component/View.tsx` contains loaded artifact code instead of the tracked placeholder.

On Windows, hook installation is skipped by default because Git-for-Windows shell hooks can be flaky in some environments. The guard still exists as `npm run guard:slot`, and you can opt into the hook manually with `JSX_VIEWER_ENABLE_GIT_HOOKS=1 npm install`.

## License

MIT
