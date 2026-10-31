"""Read-only Kalshi public Crypto15 series discovery and sanitized PWA snapshot.

No private project imports, credentials, account/position endpoints, or order URLs.
Trading signal publication remains disabled; the market directory is public.
"""
from __future__ import annotations
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import argparse, json, re, os, time
ROOT=Path(__file__).resolve().parents[1]
API="https://external-api.kalshi.com/trade-api/v2/"
SERIES_RE=re.compile(r"^KX([A-Z0-9]{2,24})15M$")
WINDOW_RE=re.compile(r"^KX[A-Z0-9]{2,24}15M-[A-Za-z0-9-]+$")
MAX_CATALOG=250
MAX_FEED_BYTES=32*1024*1024
SRC="KALSHI_PUBLIC_API"
def utcnow():
    return datetime.now(timezone.utc).isoformat().replace("+00:00","Z")
def parse_iso(s):
    if not isinstance(s,str) or not s.endswith("Z"):return None
    try:return datetime.fromisoformat(s[:-1]+"+00:00")
    except (TypeError,ValueError):return None
def fetch_public(endpoint,query=None,timeout=13):
    assert endpoint in ("series","markets"),"NONPUBLIC_ENDPOINT_FORBIDDEN"
    path=API+endpoint+("?"+urlencode(query) if query else "")
    req=Request(path,headers={"Accept":"application/json","User-Agent":"ADDYPublicCatalogReview/1.0"})
    with urlopen(req,timeout=timeout) as reply:
        if reply.status!=200:raise RuntimeError("PUBLIC_HTTP_"+str(reply.status))
        raw=reply.read(MAX_FEED_BYTES+1)
        if len(raw)>MAX_FEED_BYTES:raise ValueError("FEED_TOO_LARGE")
        return json.loads(raw)
def is_crypto15_series(item):
    if type(item) is not dict:return False
    ticker=item.get("ticker")
    freq=item.get("frequency")
    if not isinstance(ticker,str) or not SERIES_RE.fullmatch(ticker):return False
    if freq!="fifteen_min":return False
    cats=item.get("categories") or []
    return str(item.get("category") or "").lower()=="crypto" or (type(cats) is list and any(str(x).lower()=="crypto" for x in cats))
def extract_series(items):
    if not isinstance(items,list):raise ValueError("SERIES_LIST_REQUIRED")
    result={}
    for entry in items:
        if not is_crypto15_series(entry):continue
        ticker=entry["ticker"]
        if ticker in result:raise ValueError("DUPLICATE_SERIES_"+ticker)
        symbol=SERIES_RE.fullmatch(ticker).group(1)
        name=str(entry.get("title") or symbol)[:90]
        tags=entry.get("tags") or []
        is_multi=any(v in name.lower() for v in ("comparison","coin race")) or (isinstance(tags,list) and any(str(x).lower()=="head to heads" for x in tags))
        aliases=sorted({str(t)[:40] for t in tags if isinstance(t,str) and 2<=len(t)<=40 and re.fullmatch(r"[A-Za-z0-9 &.\-]{2,40}",t) and t.lower() not in ("crypto","15 min","15 min markets")})[:8]
        result[ticker]={"ticker":ticker,"symbol":symbol,"name":name,"aliases":aliases,"kind":"multi_asset" if is_multi else "asset","window":None}
    if len(result)>MAX_CATALOG:raise ValueError("CATALOG_CAP")
    return [result[k] for k in sorted(result)]
def select_window(markets,now=None):
    now=now or datetime.now(timezone.utc)
    if not isinstance(markets,list):return None
    valid=[]
    for entry in markets:
        if not isinstance(entry,dict):continue
        t=entry.get("ticker");open_=parse_iso(entry.get("open_time"));close=parse_iso(entry.get("close_time"))
        if not isinstance(t,str) or not WINDOW_RE.fullmatch(t) or not open_ or not close or not(open_<=now<close):continue
        if entry.get("status") not in ("active","open"):continue
        window={"ticker":t,"open_time":entry["open_time"],"close_time":entry["close_time"],"status":"OPEN"}
        # Only display prices explicitly returned as dollar-strings; never imply coin spot price.
        for key in ("yes_bid_dollars","yes_ask_dollars"):
            v=entry.get(key)
            if isinstance(v,str) and re.fullmatch(r"(?:0|1)(?:\.\d{1,6})?",v):window[key]=v
        valid.append(window)
    return min(valid,key=lambda v:v["close_time"]) if valid else None
def empty_feed(state="UNAVAILABLE"):
    return {"schema_version":1,"source":SRC,"as_of":utcnow(),"publication_enabled":False,
            "catalog_status":state,"series":[],"signals":[],"performance":None,"insights":[]}
def discover(fetcher=fetch_public,include_windows=True):
    published=fetcher("series")
    if type(published) is not dict or not isinstance(published.get("series"),list):
        raise ValueError("PUBLIC_SERIES_UNEXPECTED")
    entries=extract_series(published["series"])
    out=empty_feed("AVAILABLE")
    out["series"]=entries
    if include_windows:
        for row in entries:
            try:
                data=fetcher("markets",{"series_ticker":row["ticker"],"status":"open","limit":10})
                row["window"]=select_window(data.get("markets",[])) if type(data) is dict else None
            except (OSError,ValueError,TimeoutError,RuntimeError,KeyError,TypeError):
                # Incomplete venue snapshot is not an active/confirmed window.
                row["window"]=None
    out["as_of"]=utcnow()
    validate_feed(out)
    return out
def validate_feed(obj):
    top={"schema_version","source","as_of","publication_enabled","catalog_status","series","signals","performance","insights"}
    if type(obj) is not dict or set(obj)!=top or obj["schema_version"]!=1 or obj["source"]!=SRC or obj["publication_enabled"] is not False or obj["catalog_status"] not in ("AVAILABLE","UNAVAILABLE") or not parse_iso(obj["as_of"]):
        raise ValueError("PUBLIC_SCHEMA_INVALID")
    if type(obj["series"]) is not list or len(obj["series"])>MAX_CATALOG:raise ValueError("SERIES_INVALID")
    if obj["catalog_status"]=="UNAVAILABLE" and obj["series"]:raise ValueError("UNAVAILABLE_WITH_SERIES")
    if obj["signals"]!=[] or obj["performance"] is not None or obj["insights"]!=[]:
        raise ValueError("UNVERIFIED_PUBLIC_DATA_FORBIDDEN")
    used=set()
    for row in obj["series"]:
        if type(row) is not dict or set(row)!={"ticker","symbol","name","aliases","kind","window"}:
            raise ValueError("SERIES_FIELDS_INVALID")
        ticker=row["ticker"]
        if not isinstance(ticker,str) or not SERIES_RE.fullmatch(ticker) or ticker in used or row["symbol"]!=SERIES_RE.fullmatch(ticker).group(1) or row["kind"] not in ("asset","multi_asset") or not isinstance(row["name"],str) or not(1<=len(row["name"])<=90):
            raise ValueError("SERIES_ID_INVALID")
        if not isinstance(row["aliases"],list) or len(row["aliases"])>8 or any(not isinstance(x,str) or not re.fullmatch(r"[A-Za-z0-9 &.\-]{2,40}",x) for x in row["aliases"]):
            raise ValueError("ALIASES_INVALID")
        used.add(ticker)
        window=row["window"]
        if window is None:continue
        if type(window) is not dict or not({"ticker","open_time","close_time","status"}<=set(window)<= {"ticker","open_time","close_time","status","yes_bid_dollars","yes_ask_dollars"}):
            raise ValueError("WINDOW_FIELDS_INVALID")
        if not WINDOW_RE.fullmatch(window["ticker"]) or not window["ticker"].startswith(ticker+"-") or window["status"]!="OPEN" or not parse_iso(window["open_time"]) or not parse_iso(window["close_time"]) or parse_iso(window["open_time"])>=parse_iso(window["close_time"]):
            raise ValueError("WINDOW_INVALID")
        for key in ("yes_bid_dollars","yes_ask_dollars"):
            if key in window and (type(window[key]) is not str or not re.fullmatch(r"(?:0|1)(?:\.\d{1,6})?",window[key])):
                raise ValueError("PRICE_INVALID")
    return obj
def main():
    parser=argparse.ArgumentParser();parser.add_argument("--output",default=str(ROOT/"pwa_source"/"public_catalog.json"))
    parser.add_argument("--no-windows",action="store_true");args=parser.parse_args()
    dest=Path(args.output).resolve()
    if not dest.is_relative_to(ROOT):raise ValueError("OUTPUT_OUTSIDE_RELEASE")
    try:out=discover(include_windows=not args.no_windows)
    except Exception as exc:
        print("PUBLIC_DISCOVERY_UNAVAILABLE "+type(exc).__name__+" "+str(exc)[:180])
        raise SystemExit(3)
    raw=json.dumps(out,sort_keys=True,separators=(",",":"),ensure_ascii=True).encode()
    if len(raw)>250000:raise ValueError("PUBLIC_RELEASE_TOO_LARGE")
    dest.parent.mkdir(parents=True,exist_ok=True)
    tmp=dest.with_name(dest.name+".new")
    tmp.write_bytes(raw);os.replace(tmp,dest)
    print(json.dumps({"catalog_status":out["catalog_status"],"as_of":out["as_of"],"series_count":len(out["series"]),"asset_count":sum(s["kind"]=="asset" for s in out["series"]),"multi_asset_series_count":sum(s["kind"]=="multi_asset" for s in out["series"]),"open_windows":sum(s["window"] is not None for s in out["series"]),"output":str(dest),"private_fields":False,"publication_enabled":False}))
if __name__=="__main__":main()
