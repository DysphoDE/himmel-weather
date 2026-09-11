Radar regression checks:

- `npm test` tests timeline pairing, source readiness, published DWD times, and metadata caching/recovery.
- Start `npm run dev -- --host 127.0.0.1`, then run `npm run test:radar:browser` with Playwright installed and its Chromium browser available. If Playwright is supplied by an external runtime, set `PLAYWRIGHT_MODULE` to its absolute `index.mjs` path.

The browser suite uses `radar-harness.html` and mocks provider responses. It checks StrictMode mounting, delayed tiles, failures/retries, seeking, zoom/pan recovery, and playback. The harness can also be opened directly without mocks to check live DWD/RainViewer data. It is not a production build entry point.
