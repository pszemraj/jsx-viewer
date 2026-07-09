# Privacy And Security

## Analytics And Telemetry

The app ships with no analytics, telemetry, or third-party trackers.

That means there is no in-app analytics SDK, no event beaconing, and no upload endpoint that receives your pasted or selected artifact source.

The hosted site is still served by GitHub Pages as static hosting, so normal page requests can still hit the hosting platform. The statement here is about the app itself: it does not include analytics or ship your artifact to an application backend.

## Execution Model

### Local Viewer

The local viewer runs on your machine through a local Vite dev server plus a local WebSocket bridge. Loaded artifacts are executed locally in the browser against that local runtime.

### Website / Browser Mode

The website serves static assets from GitHub Pages. After the page loads:

- transpilation happens in the browser on your machine
- uploaded and pasted artifacts stay client-side in the app
- the compiled artifact is imported from a `blob:` URL
- React runtime dependencies are loaded from same-origin Pages assets
- npm package imports can be fetched from `https://esm.sh/`
- class-heavy artifacts can load Tailwind's browser runtime from `https://cdn.tailwindcss.com/`

There is no app backend that receives your component source.

## Network Behavior

Expected network behavior for the hosted site:

- initial page load fetches static assets from `https://pszemraj.github.io/jsx-viewer/`
- React runtime modules are fetched from same-origin Pages assets
- artifacts with npm package imports can fetch module code from `https://esm.sh/`
- artifacts with Tailwind-style classes can fetch the Tailwind browser runtime from `https://cdn.tailwindcss.com/`
- uploaded artifacts can load remote HTTPS images, stylesheets, fonts, media, frames, and make normal browser `fetch` or WebSocket requests when their code does so, subject to the browser's own CORS, mixed-content, and permission rules

For local reproduction of that hosted behavior, prefer `npm run preview:browser`. `npm run dev:browser` is a Vite development server and intentionally does not enforce the deployed CSP.

## Trust Model

Browser mode runs uploaded code in a dedicated preview frame on the same origin. That improves teardown between previews, but it is still not a security sandbox.

Use the hosted mode for trusted single-file artifacts. Use the local viewer when
you need multi-file support, repo-local package resolution, or a more
controlled preview path.

## Related Docs

- [Modes and limitations](modes.md)
- [GitHub Pages deployment](deployment.md)
- [Browser mode smoke matrix](browser-mode-smoke-matrix.md)
