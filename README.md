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

## Public PredictOS research (October 31, 2026)

This release uses the approved purple desktop/mobile visual source and the five-tab Home / Markets / Performance / Insights / About navigation. It does **not** use the illustrative prices, BUY calls, fabricated results or example stories from the original design prototype.

A separate sanitized **provisional research** feed is available through the read-only Cloudflare GET /v1/addy route, stored in an ADDY_PUBLIC_RESEARCH KV namespace. The publisher on WilliamsLaptop reads canonical ADDY final decisions in SQLite mode=ro, allowlists only timestamped public research fields, and uploads a snapshot every 2 minutes while the user session and Cloudflare authentication remain available. The source is labeled NOT_INDEPENDENTLY_ATTESTED. YES/NO/PASS research is **not** an approved public BUY/DON'T BUY/PASS signal, trading authorization, realized accuracy statistic, or independently authenticated prediction origin. PASS is an abstention, not a win.

Kalshi contract quotes continue to come only from the public Kalshi REST relay. A focused series can be checked via GET /v1/quote/<ticker> with approximately a two-to-three-second cache when the market page is visible; full market coverage uses batched GET /v1/live/N requests and a 10-second cache. Rate limits, network delay, poll intervals and publishing gaps mean neither feed is a guaranteed exchange-grade real-time stream. The browser accurately marks expired quotes, market series with missing source data, and stale/absent PredictOS records.

No account balances, trading orders, credentials, private Guardian controls, private runtime endpoints, or strategy implementation are published. Approved performance and public trading signals remain unavailable pending independent evidence and reconciliation.
