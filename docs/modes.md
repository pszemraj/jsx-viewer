# Modes and Limitations

`jsx-viewer` ships two distinct paths:

- local viewer: the default Node/Vite/WebSocket workflow
- website/browser mode: the GitHub Pages-hosted single-file viewer

The website path uses a dedicated same-origin preview frame. It is a trusted-artifact path, not a sandbox.

## Capability Matrix

| Capability | Local viewer | Website / browser mode |
| --- | --- | --- |
| Single-file `.jsx` / `.tsx` | Yes | Yes |
| Basic React rendering | Yes | Yes |
| Hooks (`useState`, `useEffect`, `useRef`, etc.) | Yes | Yes |
| Fragments / multi-child JSX | Yes | Yes |
| `React.memo`, `forwardRef`, `lazy` default exports | Yes | Yes |
| Drag and drop, upload, paste | Yes | Yes |
| Standard React imports (`react`, `react-dom`) | Local packages | Same-origin runtime modules |
| npm package imports | Local `node_modules` | CDN-backed ESM |
| Multi-file relative imports | Yes | No |
| Arbitrary local npm package resolution | Yes | No |
| Tailwind utility classes in uploaded artifact | Yes | Yes |
| CLI preload | Yes | No |
| Live file watching / HMR on save | Yes | No |
| Stronger isolation requirements | Better fit | Not the goal |

## What Browser Mode Supports

Browser mode is meant to handle real single-file React artifacts well. That includes:

- `.jsx` and `.tsx`
- default-exported React 18 components
- hooks and normal event handlers
- fragments and multi-child JSX
- wrapped default exports such as `memo`, `forwardRef`, and `lazy`
- React and npm package imports described in [runtime and supported packages](runtime-and-packages.md#browser-mode-package-resolution)
- Tailwind utility classes described in [runtime and supported packages](runtime-and-packages.md#tailwind)
- standard `import.meta.url` access inside the uploaded module
- browser network requests described in [privacy and security](privacy-and-security.md#network-behavior)
- rendering inside a dedicated preview frame so clear and swap fully tear down prior module state

## What Browser Mode Rejects

Browser mode intentionally fails fast on:

- relative imports such as `./Foo`
- absolute path imports such as `/foo`
- URL-scheme imports such as `http:`, `https:`, `file:`, `node:`, or `npm:`
- package stylesheet imports such as `react-datepicker/dist/react-datepicker.css`
- CommonJS (`require`, `module.*`, `exports.*`)
- `process` globals such as `process.env` or `process.version`
- `import.meta` helpers other than `import.meta.url` such as `import.meta.env` or `import.meta.glob`
- packages that still depend on unsupported browser or Node globals even after CDN resolution

If you need those capabilities, use the local viewer instead.

## Why The Browser Mode Is Narrower

Browser mode stays predictable by handling a single uploaded module instead of becoming a local project bundler.

Reasonable future expansion would be:

- adding more compatibility coverage for common React patterns
- tightening package compatibility heuristics and error reporting
- supporting a real multi-file upload flow with a virtual module graph

## Related Docs

- [Usage guide](usage.md)
- [Runtime and supported packages](runtime-and-packages.md)
- [Privacy and security](privacy-and-security.md)
- [Browser mode smoke matrix](browser-mode-smoke-matrix.md)
