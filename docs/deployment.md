# GitHub Pages Deployment

Live site: [pszemraj.github.io/jsx-viewer](https://pszemraj.github.io/jsx-viewer/)

The repository includes a browser-only entry that can be deployed to GitHub
Pages without changing the existing local Node/Vite/WebSocket viewer.

## Browser Build Commands

```bash
npm run dev:browser
npm run build:browser
```

`npm run build:browser` emits `dist-browser/` and then finalizes it into a
Pages-ready artifact.

## Build And Deploy Flow

The Pages workflow does the following:

1. builds the browser entry with `vite.config.browser.ts`
2. injects `VITE_BASE_PATH` from `actions/configure-pages`
3. emits `dist-browser/`
4. renames `index.browser.html` to `index.html`
5. writes `.nojekyll`
6. uploads the Pages artifact
7. deploys it with `actions/deploy-pages`

Using the configured base path avoids hardcoding the repository name and keeps
the deployment compatible with nested repo paths and a future custom domain.

## Design Notes

The Pages mode does not use an iframe. It:

1. accepts pasted, uploaded, or dropped `.jsx` and `.tsx`
2. transpiles the artifact in the browser
3. rewrites supported bare imports to repo-owned runtime modules
4. imports the compiled result from a `blob:` URL
5. renders the component directly into the app shell

That gives a more literal in-page preview, but it also means browser mode is a
trusted-artifact path rather than a sandbox.

## Validation

Useful checks for this path:

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run build:browser`
- manual verification against the [browser mode smoke matrix](browser-mode-smoke-matrix.md)

## Related Docs

- [Modes and limitations](modes.md)
- [Privacy and security](privacy-and-security.md)
- [Development and maintenance](development.md)
