# Browser Mode Smoke Matrix

Use these snippets directly in the deployed Pages/browser mode at:

- `https://pszemraj.github.io/jsx-viewer/`

For a local run that matches the finalized Pages artifact more closely, use `npm run preview:browser` instead of `npm run dev:browser`.

Goal: verify that browser mode handles real single-file React artifacts, not just trivial `.jsx`.

## Expected Pass Cases

### 1. Basic JSX

Paste or upload:

```jsx
export default function BasicJsx() {
  return <div style={{ padding: 24 }}>hello from basic jsx</div>;
}
```

Expected:

- renders immediately
- no import/runtime error

### 2. Basic TSX + Hooks

Paste or upload:

```tsx
import { useEffect, useState } from "react";

export default function BasicTsx() {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCount((value) => value + 1);
    }, 500);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "monospace" }}>count: {count}</div>
  );
}
```

Expected:

- `.tsx` compiles cleanly
- state updates on screen
- no type-syntax parse failure

### 3. Fragments / Multi-Child JSX

Paste or upload:

```jsx
export default function FragmentCase() {
  return (
    <>
      <div style={{ padding: "24px 24px 8px" }}>top row</div>
      <div style={{ padding: "0 24px 24px" }}>bottom row</div>
    </>
  );
}
```

Expected:

- both rows render
- no `react-jsx-runtime` named export error

### 4. React.memo Default Export

Paste or upload:

```jsx
import { memo } from "react";

export default memo(function MemoCase() {
  return <div style={{ padding: 24 }}>memo export works</div>;
});
```

Expected:

- renders normally
- default-export wrapper is accepted

### 5. Realistic TSX Single-File Artifact

Suggested artifact:

- `MinuteRice.jsx`

Expected:

- uploads cleanly
- renders without the previous `react-jsx-runtime` export error
- timer behavior works in-page

## Expected Fail Cases

These should fail loudly, because browser mode is intentionally not a full bundler.

### 6. Unsupported Package Import

Paste or upload:

```jsx
import { AlarmClock } from "lucide-react";

export default function LucideCase() {
  return (
    <div
      style={{ padding: 24, display: "flex", gap: 12, alignItems: "center" }}
    >
      <AlarmClock size={20} />
      <span>allowlisted import works</span>
    </div>
  );
}
```

Expected:

- clear browser-mode error about unsupported bare imports outside the React runtime

### 7. Relative Import

```jsx
import "./other-file";

export default function BadRelative() {
  return <div>should fail</div>;
}
```

Expected:

- clear browser-mode error about relative imports not being supported

### 8. Vite Env Access

```jsx
export default function BadEnv() {
  return <div>{import.meta.env.MODE}</div>;
}
```

Expected:

- clear browser-mode error about `import.meta.env`

### 9. CommonJS

```jsx
const React = require("react");

module.exports = function BadCjs() {
  return React.createElement("div", null, "should fail");
};
```

Expected:

- clear browser-mode error about CommonJS not being supported

## Notes

- Browser mode is for **trusted single-file artifacts**.
- If the deployed site behaves strangely after a fix, do a hard refresh or use a fresh/private window so stable runtime URLs are not served from stale browser cache.
- If a pass case fails, capture the exact error panel text or a screenshot and compare it against the deployed runtime files under `/runtime/*.js`.
