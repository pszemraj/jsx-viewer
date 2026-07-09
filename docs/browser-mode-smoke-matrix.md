# Browser Mode Smoke Matrix

Use these snippets directly in the deployed Pages/browser mode at:

- `https://pszemraj.github.io/jsx-viewer/`

For a local run that matches the finalized Pages artifact more closely, use `npm run preview:browser` instead of `npm run dev:browser`.

These cases exercise single-file React artifacts, package-backed files, utility-class-heavy uploads, remote resources, and expected rejections.

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

### 5. Remote Image + Data Request

Paste or upload:

```jsx
import { useEffect, useState } from "react";

export default function RemoteNetworkCase() {
  const [message, setMessage] = useState("loading");

  useEffect(() => {
    fetch("https://api.github.com/zen")
      .then((response) => response.text())
      .then(setMessage)
      .catch((error) => setMessage(error.message));
  }, []);

  return (
    <div style={{ padding: 24, display: "grid", gap: 12 }}>
      <img src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" alt="GitHub mark" width="48" />
      <p>{message}</p>
    </div>
  );
}
```

Expected:

- remote image loads
- `fetch` completes or returns a service error from the remote endpoint, not a CSP violation

### 6. Package Import + Tailwind Utilities

Paste or upload:

```jsx
import { AlarmClock } from "lucide-react";

export default function LucideCase() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <div className="inline-flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3">
        <AlarmClock size={20} />
        <span>browser mode now resolves package imports and utility classes</span>
      </div>
    </div>
  );
}
```

Expected:

- package import resolves without a browser-mode transpile error
- Tailwind utility classes style the card and page background
- no duplicate-React or invalid-hook runtime error

### 7. Repo-Shipped Hard Fixtures

Suggested artifacts:

- `example/PolyField.tsx`
- `example/DataTable.jsx`
- `example/Dashboard.tsx`

Expected:

- `PolyField.tsx` compiles advanced TSX patterns such as polymorphic components, generic `forwardRef`, context, and `useImperativeHandle`
- `DataTable.jsx` renders compound components, render props, keyed fragments, and `Suspense`
- `Dashboard.tsx` resolves `lucide-react` and `recharts` while Tailwind utility classes style the page

## Expected Fail Cases

These should still fail loudly, because browser mode is still not a full local bundler.

### 8. Relative Import

```jsx
import "./other-file";

export default function BadRelative() {
  return <div>should fail</div>;
}
```

Expected:

- clear browser-mode error about relative imports not being supported

### 9. Vite Env Access

```jsx
export default function BadEnv() {
  return <div>{import.meta.env.MODE}</div>;
}
```

Expected:

- clear browser-mode error about `import.meta.env`

### 10. CommonJS

```jsx
const React = require("react");

module.exports = function BadCjs() {
  return React.createElement("div", null, "should fail");
};
```

Expected:

- clear browser-mode error about CommonJS not being supported

## Notes

- Browser-mode rules are listed in [modes and limitations](modes.md).
- Network behavior is listed in [privacy and security](privacy-and-security.md#network-behavior).
- If the deployed site behaves strangely after a fix, do a hard refresh or use a fresh/private window so stable runtime URLs are not served from stale browser cache.
- If a pass case fails, capture the exact error panel text or a screenshot and compare it against the deployed runtime files under `<basePath>/runtime/*.js`.
