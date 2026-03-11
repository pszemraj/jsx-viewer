# jsx-viewer

Render `.jsx` files as easily as `.html`. Built for previewing React component artifacts from Claude, ChatGPT, or any AI that outputs JSX.

## The Problem

You get a `.jsx` artifact. To see it rendered, you need to scaffold a React app, install dependencies, wire up imports, run a dev server. That's 5 minutes of ceremony for 2 seconds of viewing.

**jsx-viewer** makes it instant: one command, one file, rendered.

## Quick Start

```bash
# Install dependencies (once)
npm install

# View a file
node bin/jsx-viewer.mjs dashboard.jsx

# Or start the drop/paste UI
node bin/jsx-viewer.mjs
```

The viewer opens in your browser. The component renders. You're done.

## Install Globally (Optional)

```bash
npm link
# Now available everywhere:
jsx-viewer my-component.jsx
```

## How It Works

1. **Vite dev server** handles JSX transpilation and hot module replacement
2. Your file is copied to a **slot** (`component/View.jsx`) - the single render target
3. **Vite HMR** picks up the change and hot-reloads the browser instantly
4. A **WebSocket bridge** connects the browser UI to the CLI for drag-and-drop/paste
5. On exit, the slot resets to a placeholder - your file is never committed

The loaded component is ephemeral. The repo stays clean.

## Three Ways to Load JSX

### 1. CLI argument (recommended)

```bash
jsx-viewer path/to/Component.jsx
```

File is watched - save your editor, browser updates.

### 2. Drag and drop

Start `jsx-viewer` with no args, drag a `.jsx` file onto the browser window.

### 3. Paste

Start `jsx-viewer`, click "paste jsx", paste source code, click "load".

## Pre-installed Libraries

These are available for `import` in your JSX files - no setup needed:

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

**Tailwind CSS v3** is compiled locally via PostCSS - no CDN, no external network calls. Works fully offline and behind corporate firewalls. Tailwind JIT recompiles on every slot swap, so arbitrary utility classes in your artifacts just work.

## Options

```
jsx-viewer [options] [file.jsx]

  -p, --port <n>   Dev server port (default: 3142)
  -h, --help       Show help
```

WebSocket runs on port + 1 (default: 3143).

## Example

```bash
jsx-viewer example/Dashboard.jsx
```

This renders the included example - a dark-mode metrics dashboard using recharts and lucide-react.

## Adding More Dependencies

If your artifact imports something not listed above:

```bash
npm install some-package
# Restart jsx-viewer
```

Vite will pick it up automatically.

## Component Requirements

Your JSX file should have a **default export** of a React component:

```jsx
// Works
export default function MyComponent() {
  return <div>Hello</div>;
}

// Also works
const App = () => <div>Hello</div>;
export default App;
```

## License

MIT

