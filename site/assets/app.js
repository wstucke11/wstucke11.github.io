'use strict';
const ADDY_BUILD_ID='b81d2b02de3e21e5';
const M=AddyPublicModel, el=id=>document.getElementById(id);
const LIVE_ORIGIN='https://addy-public-kalshi-quotes.addy-intelligence-wstucke11.workers.dev';
let catalog=null,sourceMode='UNAVAILABLE',sourceCoverage=null,loading=false,filterMode='all',searchText='',installPrompt=null;
let installRegistration=null;
const PAGE_NAMES=['home','markets','performance','insights','about'];
const FEATURED=['BTC','ETH','SOL','XRP'];
function dom(tag,value,cls){
  const n=document.createElement(tag);
  if(value!==null&&value!==undefined)n.textContent=String(value);
  if(cls)n.className=cls;
  return n;
}
function formatAt(value){
  if(!value||!Number.isFinite(Date.parse(value)))return 'Time unavailable';
  return new Date(value).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
}
function statusText(){
  const basic=M.freshness(catalog,Date.now(),navigator.onLine);
  if(basic!=='RECENT SNAPSHOT')return basic;
  if(sourceMode==='LIVE'){
    if(Date.now()-Date.parse(catalog.as_of)>30000)return 'STALE';
    return sourceCoverage?.ok===sourceCoverage?.total?'LIVE':'PARTIAL';
  }
  return 'PUBLISHED';
}
function statusLabel(){
  const status=statusText();
  if(status==='LIVE')return 'LIVE VENUE QUOTES';
  if(status==='PARTIAL')return 'PARTIAL VENUE COVERAGE';
  if(status==='PUBLISHED')return 'DELAYED PUBLISHED SNAPSHOT';
  if(status==='STALE')return 'DATA STALE';
  if(status==='OFFLINE')return 'OFFLINE';
  return 'PUBLIC DATA UNAVAILABLE';
}
function renderStatus(){
  const status=statusText();
  el('connection-label').textContent=status==='LIVE'?'Live Kalshi data':status==='PARTIAL'?'Partial market data':status==='PUBLISHED'?'Published snapshot':status==='STALE'?'Data outdated':status==='OFFLINE'?'Offline':'Feed unavailable';
  document.querySelector('.live-dot').className='live-dot'+(status==='LIVE'?' recent':'');
  el('as-of').textContent=catalog?'Captured '+formatAt(catalog.as_of):'Source time unavailable';
  const age=catalog?Math.max(0,Math.floor((Date.now()-Date.parse(catalog.as_of))/1000)):null;
  const covered=sourceCoverage?' · '+sourceCoverage.ok+'/'+sourceCoverage.total+' markets checked':'';
  el('catalog-health').textContent=statusLabel()+covered+(age===null?'':' · '+Math.floor(age/60)+'m '+String(age%60).padStart(2,'0')+'s old');
  el('catalog-health').className='status-pill'+(status==='LIVE'?' fresh':'');
}
function renderCard(record){
  const card=dom('article',null,'market-card');
  const heading=dom('div',null,'market-head');
  const icon=dom('span',record.kind==='multi_asset'?'◇':record.symbol.slice(0,2),'coin-icon');
  const h=dom('div',null,'market-title'),title=dom('h3',record.symbol),sub=dom('p',record.name);
  h.append(title,sub);
  heading.append(icon,h);
  card.append(heading);
  const signal=dom('span','NO SIGNAL','signal-tag no-signal');
  signal.setAttribute('aria-label','No published ADDY signal');
  const quoteAge=catalog?Date.now()-Date.parse(catalog.as_of):Infinity;
  const win=sourceMode==='LIVE'&&quoteAge>30000?'QUOTE STALE':M.windowStatus(record,catalog,Date.now(),navigator.onLine);
  const windowState=dom('span',win,'window-tag'+(win==='OPEN AT SNAPSHOT'?' opened':''));
  const bands=dom('div',null,'status-bands');bands.append(signal,windowState);card.append(bands);
  if(record.window&&win==='OPEN AT SNAPSHOT'){
    const quote=dom('div',null,'quote');
    if(record.window.yes_bid_dollars)quote.append(dom('span','YES bid $'+record.window.yes_bid_dollars,'quote-value'));
    if(record.window.yes_ask_dollars)quote.append(dom('span','YES ask $'+record.window.yes_ask_dollars,'quote-value'));
    if(quote.childElementCount)card.append(quote);
    card.append(dom('p',(sourceMode==='LIVE'?'Kalshi quote checked recently':'Delayed published quote')+' · Window closes '+formatAt(record.window.close_time),'card-note'));
    if(record.kind==='multi_asset')card.append(dom('p','Representative contract only; this series may contain multiple simultaneous markets.','card-note'));
  }else{
    card.append(dom('p','Window data is not currently verified. No price or trading signal is implied.','card-note'));
  }
  const bottom=dom('div',null,'card-bottom');
  bottom.append(dom('span',record.ticker,'ticker'));
  bottom.append(dom('span',record.kind==='multi_asset'?'Multi-asset series':'15-minute series','series-type'));
  card.append(bottom);
  return card;
}
function fillCards(host,records,emptyMessage){
  host.replaceChildren();
  if(!records.length){
    const empty=dom('div',null,'empty');empty.append(dom('h3','Nothing to show'),dom('p',emptyMessage));
    host.append(empty);return;
  }
  for(const r of records)host.append(renderCard(r));
}
function render(){
  renderStatus();
  const rows=catalog?.series||[],recent=['LIVE','PARTIAL','PUBLISHED'].includes(statusText());
  const metrics=M.totals(catalog,Date.now(),navigator.onLine);
  el('metric-series').textContent=metrics.series===null?'—':String(metrics.series);
  el('metric-open').textContent=sourceMode==='LIVE'&&sourceCoverage?.ok!==sourceCoverage?.total?'—':metrics.open===null?'—':String(metrics.open);
  el('metric-signals').textContent=metrics.signals===null?'—':String(metrics.signals);
  const preferred=FEATURED.map(k=>rows.find(r=>r.symbol===k)).filter(Boolean);
  const featured=[...preferred,...rows.filter(r=>!preferred.includes(r)&&r.kind==='asset')].slice(0,4);
  fillCards(el('featured-grid'),featured,catalog?'No individually listed markets in this snapshot.':'Public market snapshot unavailable.');
  const filtered=M.filterSeries(rows,searchText,filterMode,catalog);
  el('market-count').textContent=catalog?filtered.length+' of '+rows.length+' discovered series':'No market records loaded';
  const empty=filterMode==='signal'?'No approved ADDY signals have been published. Listings and signals are independent.':
      searchText?'No markets match this search. Try another symbol or ticker.':
      catalog?'No market series in the current public snapshot.':'Public catalog unavailable. Retry when the source is available.';
  fillCards(el('market-grid'),filtered,empty);
  for(const card of document.querySelectorAll('.market-card')){
    if(!recent)card.setAttribute('data-stale','true');
  }
}
async function fetchLiveVenue(){
  const batches=[];let ok=0,total=0,groupCount=null;
  for(let index=0;index<(groupCount??1);index++){
    const response=await fetch(LIVE_ORIGIN+'/v1/live/'+index,{mode:'cors',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('LIVE_HTTP_'+response.status);
    const batch=M.validate(await response.json());
    const count=Number(response.headers.get('X-ADDY-Group-Count'));
    if(!Number.isInteger(count)||count<1||count>36||groupCount!==null&&count!==groupCount)throw Error('LIVE_GROUP_COUNT_INVALID');
    groupCount=count;
    const coverage=response.headers.get('X-ADDY-Market-Coverage')||'';
    if(!/^\d+\/\d+$/.test(coverage))throw Error('LIVE_COVERAGE_INVALID');
    const [good,expected]=coverage.split('/').map(Number);
    if(expected!==batch.series.length||good>expected||good<1)throw Error('LIVE_COVERAGE_CONTRACT');
    batches.push(batch);ok+=good;total+=expected;
    if(index+1<groupCount)await new Promise(resolve=>setTimeout(resolve,1800));
  }
  return {feed:M.combineLiveBatches(batches),coverage:{ok,total}};
}
async function loadCatalog(){
  if(loading)return;
  loading=true;el('connection-label').textContent='Checking Kalshi quotes…';
  let live=null;
  try{live=await fetchLiveVenue()}catch(e){/* Preserve the independent public fallback. */}
  if(live){
    catalog=live.feed;sourceCoverage=live.coverage;sourceMode='LIVE';
  }else if(!catalog||sourceMode!=='LIVE'||Date.now()-Date.parse(catalog.as_of)>30000){
    try{
      const response=await fetch('/public_catalog.json',{cache:'no-store',redirect:'error'});
      if(!response.ok)throw Error('SNAPSHOT_HTTP_'+response.status);
      catalog=M.validate(await response.json());sourceMode='PUBLISHED';sourceCoverage=null;
    }catch(e){/* Never reset or relabel a previously verified observation. */}
  }
  loading=false;render();
}
function showPage(focus=false){
  const requested=(location.hash||'#home').slice(1).split('/')[0];
  const current=PAGE_NAMES.includes(requested)?requested:'home';
  for(const section of document.querySelectorAll('section[data-page]'))section.hidden=section.dataset.page!==current;
  for(const link of document.querySelectorAll('a[data-nav]')){
    const active=link.hash==='#'+current;
    if(active)link.setAttribute('aria-current','page');
    else link.removeAttribute('aria-current');
  }
  if(focus){
    const title=document.querySelector('section[data-page="'+current+'"] h1');
    if(title)title.focus();
    window.scrollTo({top:0,behavior:'auto'});
  }
}
el('market-search').addEventListener('input',event=>{searchText=event.target.value;render()});
el('market-filter').addEventListener('change',event=>{filterMode=event.target.value;render()});
el('refresh-about').addEventListener('click',loadCatalog);
el('refresh-public').addEventListener('click',loadCatalog);
el('apply-update').addEventListener('click',async()=>{
  if(installRegistration?.waiting){
    navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});
    installRegistration.waiting.postMessage({type:'SKIP_WAITING'});
  }else location.reload();
});
window.addEventListener('hashchange',()=>showPage(true));
window.addEventListener('online',()=>loadCatalog());
window.addEventListener('offline',render);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){render();loadCatalog();checkBuild();}});
const installHelp=el('install-help');
el('install-close').addEventListener('click',()=>installHelp.hidden=true);
el('install-btn').addEventListener('click',async()=>{
  if(installPrompt){
    const event=installPrompt;installPrompt=null;
    try{await event.prompt()}catch(e){installHelp.hidden=false}
  }else installHelp.hidden=!installHelp.hidden;
});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e});
window.addEventListener('appinstalled',()=>{installPrompt=null;installHelp.hidden=true});
async function registerWorker(){
  if(!('serviceWorker' in navigator))return;
  try{installRegistration=await navigator.serviceWorker.register('/service-worker.js',{scope:'/',updateViaCache:'none'})}catch(e){}
}
async function checkBuild(){
  try{
    const r=await fetch('/version.json',{cache:'no-store',redirect:'error'});
    if(!r.ok)return;
    const data=await r.json();
    if(typeof data.build_id==='string'&&data.build_id!==ADDY_BUILD_ID){
      el('update-notice').hidden=false;
      if(installRegistration)await installRegistration.update();
      // User can apply the new version without losing edits unexpectedly.
    }
  }catch(e){}
}
showPage();render();loadCatalog();registerWorker().then(checkBuild);
setInterval(()=>{if(!document.hidden)render()},15000);
setInterval(()=>{if(!document.hidden)loadCatalog()},18000);
