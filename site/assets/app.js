'use strict';
const ADDY_BUILD_ID='f370f22f04d12f89';
const M=AddyPublicModel, el=id=>document.getElementById(id);
let catalog=null,loading=false,filterMode='all',searchText='',installPrompt=null;
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
  return M.freshness(catalog,Date.now(),navigator.onLine);
}
function statusLabel(){
  const status=statusText();
  if(status==='RECENT SNAPSHOT')return 'RECENT PUBLIC SNAPSHOT';
  if(status==='STALE')return 'DATA STALE';
  if(status==='OFFLINE')return 'OFFLINE';
  return 'PUBLIC DATA UNAVAILABLE';
}
function renderStatus(){
  const status=statusText();
  el('connection-label').textContent=status==='RECENT SNAPSHOT'?'Public snapshot':status==='STALE'?'Snapshot outdated':status==='OFFLINE'?'Offline':'Public feed unavailable';
  document.querySelector('.live-dot').className='live-dot'+(status==='RECENT SNAPSHOT'?' recent':'');
  el('as-of').textContent=catalog?'Captured '+formatAt(catalog.as_of):'Source time unavailable';
  const age=catalog?Math.max(0,Math.floor((Date.now()-Date.parse(catalog.as_of))/1000)):null;
  el('catalog-health').textContent=statusLabel()+(age===null?'':' · '+Math.floor(age/60)+'m '+String(age%60).padStart(2,'0')+'s old');
  el('catalog-health').className='status-pill'+(status==='RECENT SNAPSHOT'?' fresh':'');
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
  const win=M.windowStatus(record,catalog,Date.now(),navigator.onLine);
  const windowState=dom('span',win,'window-tag'+(win==='OPEN AT SNAPSHOT'?' opened':''));
  const bands=dom('div',null,'status-bands');bands.append(signal,windowState);card.append(bands);
  if(record.window&&win==='OPEN AT SNAPSHOT'){
    const quote=dom('div',null,'quote');
    if(record.window.yes_bid_dollars)quote.append(dom('span','YES bid $'+record.window.yes_bid_dollars,'quote-value'));
    if(record.window.yes_ask_dollars)quote.append(dom('span','YES ask $'+record.window.yes_ask_dollars,'quote-value'));
    if(quote.childElementCount)card.append(quote);
    card.append(dom('p','Window closes '+formatAt(record.window.close_time),'card-note'));
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
  const rows=catalog?.series||[],recent=statusText()==='RECENT SNAPSHOT';
  const metrics=M.totals(catalog,Date.now(),navigator.onLine);
  el('metric-series').textContent=metrics.series===null?'—':String(metrics.series);
  el('metric-open').textContent=metrics.open===null?'—':String(metrics.open);
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
async function loadCatalog(){
  if(loading)return;
  loading=true;el('connection-label').textContent='Checking published snapshot…';
  try{
    const response=await fetch('/public_catalog.json',{cache:'no-store',redirect:'error'});
    if(!response.ok)throw Error('HTTP_'+response.status);
    const content=await response.json();
    catalog=M.validate(content);
  }catch(e){
    // Keep the last verified snapshot with its original timestamp. Never relabel it fresh.
    // Freshness/quote TTLs continue to expire naturally if the host or venue fails.
  }finally{
    loading=false;render();
  }
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
setInterval(()=>{if(!document.hidden)loadCatalog()},90000);
