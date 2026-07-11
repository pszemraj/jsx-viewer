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

Pull requests run the test, typecheck, lint, and both build paths without receiving deployment permissions; the Pages configuration, artifact upload, and deployment steps run only for `main` pushes or manual dispatches. Build and deploy jobs each have a 15-minute cap, and production deployments are serialized without canceling one that is already in progress.

## Runtime Shape

The deployed site uses the browser mode described in [modes and limitations](modes.md). Deployment adds two static HTML entries:

- `index.html`, renamed from the built `index.browser.html`
- `preview-frame.html`, the same-origin preview document used for loaded artifacts

The browser CSP is generated from `shared/browser-csp.mjs`. The finalizer checks the built runtime exports, preview import map, and generated CSP before the artifact is served or uploaded.

## Validation

Useful checks for this path:

- `npm run preview:browser`
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run build:browser`
- manual verification against the [browser mode smoke matrix](browser-mode-smoke-matrix.md)

Use `npm run dev:browser` for fast iteration on browser-mode code. Use `npm run preview:browser` when you need the deployment-faithful entry URL, finalized `index.html`, preview document, and production CSP.

## Related Docs

- [Modes and limitations](modes.md)
- [Privacy and security](privacy-and-security.md)
- [Development and maintenance](development.md)
