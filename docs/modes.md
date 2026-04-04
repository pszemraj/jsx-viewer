# Modes And Limitations

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
| Allowlisted runtime package imports | Yes | Yes |
| Managed-browser diagnostics | No | Yes |
| Multi-file relative imports | Yes | No |
| Arbitrary local npm package resolution | Yes | No |
| CommonJS, `process.*`, unsupported `import.meta.*` helpers in uploaded artifact | Yes | No |
| Arbitrary Tailwind utility compilation from uploaded artifact | Yes | No |
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
- allowlisted bare imports rewritten to repo-shipped runtime modules
- standard `import.meta.url` access inside the uploaded module
- rendering inside a dedicated preview frame so clear and swap fully tear down prior module state

## What Browser Mode Rejects

Browser mode intentionally fails fast on:

- relative imports such as `./Foo`
- absolute path imports such as `/foo`
- remote URL imports
- CommonJS (`require`, `module.*`, `exports.*`)
- `process` globals such as `process.env` or `process.version`
- `import.meta` helpers other than `import.meta.url` such as `import.meta.env` or `import.meta.glob`
- arbitrary package imports outside the runtime allowlist

If you need those capabilities, use the local viewer instead.

## Why The Browser Mode Is Narrower

The browser mode is meant to stay predictable. Once it starts resolving arbitrary package graphs, relative imports, or environment-dependent code, it stops being a simple single-file viewer and turns into a browser bundler. That is not the goal for the hosted Pages path.

Reasonable future expansion would be:

- widening the runtime allowlist to additional repo-shipped packages
- adding more compatibility coverage for common React patterns
- supporting a real multi-file upload flow with a virtual module graph

## Related Docs

- [Usage guide](usage.md)
- [Runtime and supported packages](runtime-and-packages.md)
- [Privacy and security](privacy-and-security.md)
- [Browser mode smoke matrix](browser-mode-smoke-matrix.md)
