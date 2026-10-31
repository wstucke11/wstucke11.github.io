"""Fail-closed GitHub Pages public deployment validation."""
from __future__ import annotations
import json, hashlib, re
from pathlib import Path
from catalog_export import validate_feed
ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
PUBLIC_ROUTES = {
    "index.html", "offline.html", "assets/app.css", "assets/app.js",
    "assets/model.js", "manifest.webmanifest", "service-worker.js",
    "icons/icon-192.png", "icons/icon-512.png", "public_catalog.json",
    "version.json", ".nojekyll", "robots.txt"
}
def verify():
    actual = {str(p.relative_to(SITE)).replace("\\","/") for p in SITE.rglob("*") if p.is_file()}
    if actual != PUBLIC_ROUTES:
        raise ValueError("RELEASE_PATH_ALLOWLIST_MISMATCH: "+repr(actual ^ PUBLIC_ROUTES))
    for relative in actual:
        p = SITE / relative
        if p.is_symlink() or not p.resolve().is_relative_to(SITE.resolve()) or p.stat().st_size > 1024*1024:
            raise ValueError("RELEASE_UNSAFE_FILE: "+relative)
    feed = json.loads((SITE / "public_catalog.json").read_text("utf8"))
    validate_feed(feed)
    html = (SITE / "index.html").read_text("utf8")
    if "READ-ONLY PREVIEW" in html or "LOCAL PREVIEW" in html or "127.0.0.1" in html or "localhost" in html:
        raise ValueError("PUBLIC_HTML_PREVIEW_OR_LOOPBACK_LEAK")
    manifest = json.loads((SITE / "manifest.webmanifest").read_text("utf8"))
    if not (manifest.get("start_url")=="/" and manifest.get("scope")=="/" and manifest.get("display")=="standalone"):
        raise ValueError("PWA_MANIFEST_SCOPE_INVALID")
    model = (SITE / "assets/model.js").read_text("utf8")
    if "QUOTE STALE" not in model or "600000" not in model or "120000" not in model:
        raise ValueError("PUBLIC_STALENESS_POLICY_MISSING")
    worker = (SITE / "service-worker.js").read_text("utf8")
    match = re.search(r"const SHELL_HASHES = (\{[^;]+\});", worker)
    if not match: raise ValueError("WORKER_SHELL_INTEGRITY_MISSING")
    hashes = json.loads(match.group(1))
    expected = {
        "/": "index.html",
        "/offline.html": "offline.html",
        "/assets/app.css": "assets/app.css",
        "/assets/app.js": "assets/app.js",
        "/assets/model.js": "assets/model.js",
        "/manifest.webmanifest": "manifest.webmanifest",
        "/icons/icon-192.png": "icons/icon-192.png",
        "/icons/icon-512.png": "icons/icon-512.png"
    }
    if set(hashes) != set(expected): raise ValueError("WORKER_ASSET_LIST_MISMATCH")
    for route,filename in expected.items():
        digest = hashlib.sha256((SITE/filename).read_bytes()).hexdigest()
        if digest != hashes[route]: raise ValueError("WORKER_SHELL_HASH_MISMATCH: "+route)
    version=json.loads((SITE/"version.json").read_text("utf8"))
    if not re.fullmatch(r"[0-9a-f]{16}",version.get("build_id","")):raise ValueError("INVALID_BUILD_ID")
    print(json.dumps({"public_only":True,"files":len(actual),"build_id":version["build_id"],"signals":0,"performance":"UNPUBLISHED","catalog_status":feed["catalog_status"],"quotes_ttl_seconds":120,"series_ttl_seconds":600}))
if __name__ == "__main__":
    verify()
