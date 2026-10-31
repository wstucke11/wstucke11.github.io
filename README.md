# ADDY Intelligence — Public Crypto15 PWA

This is the **public-only** ADDY Intelligence dashboard. Its five pages are Home, Markets, Performance, Insights and About. The website is read-only and does not connect to the private Sphere Workspace, Guardian administration, brokerage credentials or funded trading.

## Publishing

A GitHub Pages workflow publishes the `site/` directory at the owner’s user Pages address. It refreshes the sanitized Crypto15 market directory from unauthenticated Kalshi GET `/series` and `/markets` endpoints on the schedule defined in `.github/workflows/publish.yml`. Scheduled GitHub Actions can be delayed; publication is not real-time trading data. Catalog ages above 10 minutes and quotes older than two minutes are treated as stale. Prices are Kalshi contract bid/ask, **not cryptocurrency spot prices**.

The PWA also retrieves near-real-time **public contract quotes** from an independently hosted, read-only Cloudflare Worker at `addy-public-kalshi-quotes.addy-intelligence-wstucke11.workers.dev`. It uses seven-series batches, checks approximately every 18 seconds while visible, and shows source coverage and capture age. These quote snapshots expire after 30 seconds and the interface falls back to the clearly labeled, delayed GitHub directory when the relay cannot respond. The Worker is not a guaranteed real-time exchange feed; it does not provide private ADDY strategy data or trading access.

The public signal feed remains explicitly unpublished until approved evidence and qualification exist. NO SIGNAL is not PASS, BUY or DON'T BUY. The Results and Insights pages show evidence-unavailable states rather than invented returns or commentary.

## Safety

- Only allowlisted files in `site/` are deployed.
- No API secrets, personal account balances, positions, orders, or private telemetry are published.
- Failed market refreshes emit an `UNAVAILABLE` feed rather than presenting stale data as current.
- Service-worker integrity checks protect the static shell; the service worker does not cache the market feed.
- GitHub Actions validates the published assets and feed schema on every deployment.

To run the source checks on Windows, use `py -3 -B scripts\\verify_public_release.py`. The generated public site works over HTTPS and supports PWA installation where permitted by the device/browser.
