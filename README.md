# ADDY Intelligence — Public Crypto15 PWA

This is the **public-only** ADDY Intelligence dashboard. Its five pages are Home, Markets, Performance, Insights and About. The website is read-only and does not connect to the private Sphere Workspace, Guardian administration, brokerage credentials or funded trading.

## Publishing

A GitHub Pages workflow publishes the `site/` directory at the owner’s user Pages address. It refreshes the sanitized Crypto15 market directory from unauthenticated Kalshi GET `/series` and `/markets` endpoints on the schedule defined in `.github/workflows/publish.yml`. Scheduled GitHub Actions can be delayed; publication is not real-time trading data. Catalog ages above 10 minutes and quotes older than two minutes are treated as stale. Prices are Kalshi contract bid/ask, **not cryptocurrency spot prices**.

The public signal feed remains explicitly unpublished until approved evidence and qualification exist. NO SIGNAL is not PASS, BUY or DON'T BUY. The Results and Insights pages show evidence-unavailable states rather than invented returns or commentary.

## Safety

- Only allowlisted files in `site/` are deployed.
- No API secrets, personal account balances, positions, orders, or private telemetry are published.
- Failed market refreshes emit an `UNAVAILABLE` feed rather than presenting stale data as current.
- Service-worker integrity checks protect the static shell; the service worker does not cache the market feed.
- GitHub Actions validates the published assets and feed schema on every deployment.

To run the source checks on Windows, use `py -3 -B scripts\\verify_public_release.py`. The generated public site works over HTTPS and supports PWA installation where permitted by the device/browser.
