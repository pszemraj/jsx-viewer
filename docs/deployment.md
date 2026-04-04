# GitHub Pages Deployment

Live site: [pszemraj.github.io/jsx-viewer](https://pszemraj.github.io/jsx-viewer/)

The repository includes a browser-only entry that can be deployed to GitHub Pages without changing the existing local Node/Vite/WebSocket viewer.

## Browser Build Commands

```bash
npm run dev:browser
npm run build:browser
npm run preview:browser
```

`npm run build:browser` emits `dist-browser/` and then finalizes it into a Pages-ready artifact.
`npm run preview:browser` runs that same finalized artifact locally through `vite preview`, which makes it the correct path for checking the deployed CSP and base-path behavior before shipping.

## Build And Deploy Flow

The Pages workflow does the following:

1. builds the browser entry with `vite.config.browser.ts`
2. injects `VITE_BASE_PATH` from `actions/configure-pages`
3. emits `dist-browser/`
4. renames `index.browser.html` to `index.html`
5. writes `.nojekyll`
6. uploads the Pages artifact
7. deploys it with `actions/deploy-pages`

Using the configured base path avoids hardcoding the repository name and keeps the deployment compatible with nested repo paths and a future custom domain.

## Design Notes

The Pages mode runs the uploaded artifact inside a dedicated preview frame. It:

1. accepts pasted, uploaded, or dropped `.jsx` and `.tsx`
2. transpiles the artifact in the browser
3. rewrites supported bare imports to repo-owned runtime modules
4. imports the compiled result from a `blob:` URL
5. renders the component inside an isolated preview document on the same origin

That keeps clear and swap from leaking module-scope timers or listeners across previews, but browser mode is still a trusted-artifact path rather than a security sandbox.
The preview document is emitted as `preview-frame.html` and initialized after load, which keeps the deployed CSP at `script-src 'self' blob:` without reintroducing inline bootstrap code.

## Validation

Useful checks for this path:

- `npm run preview:browser`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run build:browser`
- manual verification against the [browser mode smoke matrix](browser-mode-smoke-matrix.md)

Use `npm run dev:browser` for fast iteration on browser-mode code. Use `npm run preview:browser` when you need the deployment-faithful entry URL, finalized `index.html`, and production CSP.

## Related Docs

- [Modes and limitations](modes.md)
- [Privacy and security](privacy-and-security.md)
- [Development and maintenance](development.md)
