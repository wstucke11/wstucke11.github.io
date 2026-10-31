"""Public-only scheduled Kalshi snapshot for GitHub Pages. No private ADDY imports or credentials."""
from __future__ import annotations
import json, os, time
from pathlib import Path
from catalog_export import discover, fetch_public, empty_feed, validate_feed
SITE = Path(__file__).resolve().parents[1] / "site"
DEST = SITE / "public_catalog.json"
def main():
    assert DEST.resolve().is_relative_to(SITE.resolve())
    deadline = time.monotonic() + 28.0
    def bounded(endpoint, query=None):
        remaining = deadline - time.monotonic()
        if remaining < 0.7:
            raise TimeoutError("PUBLIC_UPSTREAM_BUDGET")
        return fetch_public(endpoint, query, timeout=min(7, remaining))
    try:
        output = discover(fetcher=bounded)
        status = "AVAILABLE"
    except Exception as exc:
        # Fail closed: do not recycle expired market windows as fresh.
        output = empty_feed("UNAVAILABLE")
        status = "UNAVAILABLE_" + type(exc).__name__
    validate_feed(output)
    raw = json.dumps(output, sort_keys=True, separators=(",",":"), ensure_ascii=True).encode()
    if len(raw) > 250000: raise ValueError("PUBLIC_SNAPSHOT_TOO_LARGE")
    tmp = DEST.with_name("public_catalog.json.next")
    tmp.write_bytes(raw)
    os.replace(tmp, DEST)
    print(json.dumps({"result":status,"as_of":output["as_of"],"series":len(output["series"]),"publication_enabled":False,"bytes":len(raw)}))
if __name__ == "__main__":
    main()
