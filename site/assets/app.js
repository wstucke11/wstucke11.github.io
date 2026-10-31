'use strict';
/* ADDY public PWA — original approved purple visual shell, live public-only contract data.
   NO fabricated samples, signals, analysis, win rates, positions, private endpoints, or orders. */
const BUILD_ID='3d04f94c104f83ea';
const M=AddyPublicModel;
const LIVE='https://addy-public-kalshi-quotes.addy-intelligence-wstucke11.workers.dev';
const PAGES=['home','markets','performance','insights','about'];
const FEATURED=['BTC','ETH','SOL','XRP'];
const ICONS={BTC:['btc','₿'],ETH:['eth','◆'],SOL:['sol','≋'],XRP:['xrp','X'],DOGE:['doge','Ð'],BNB:['bnb','◆'],HYPE:['hype','H'],ZEC:['zec','Z'],ADA:['ada','₳'],BCH:['bch','₿'],NEAR:['near','N'],TON:['ton','T']};
const $=s=>document.querySelector(s),$$=s=>Array.from(document.querySelectorAll(s));
let feed=null,mode='UNAVAILABLE',coverage=null,fetchRunning=false,search='',filter='all';
let researchFeed=null,researchLoading=false,researchLastError=null;
let selectedTicker=null,registration=null,installEvent=null;
let liveFails=0,quoteFails=0,activePage='home',lastCatalogRead=0;
const sessionHistory=new Map(),priorityQuotes=new Map();
function node(tag,className,content){
  const n=document.createElement(tag);
  if(className)n.className=className;
  if(content!==undefined&&content!==null)n.textContent=String(content);
  return n;
}
function child(parent,tag,className,content){const n=node(tag,className,content);parent.append(n);return n;}
function isoLabel(utc){if(!utc)return 'time unavailable';try{return new Date(utc).toLocaleTimeString([],{hour:'numeric',minute:'2-digit',second:'2-digit'});}catch{return 'time unavailable'}}
function ageSeconds(){return feed?Math.max(0,Math.floor((Date.now()-Date.parse(feed.as_of))/1000)):null}
function timeAgo(sec){return sec===null?'unavailable':sec<60?sec+'s ago':Math.floor(sec/60)+'m '+sec%60+'s ago'}
function online(){return navigator.onLine!==false}
function freshness(){
  if(!online())return 'OFFLINE';
  if(!feed)return 'UNAVAILABLE';
  const age=ageSeconds();
  if(mode==='LIVE'||mode==='PARTIAL')return age<=30?mode:'STALE';
  if(M.freshness(feed,Date.now(),online())==='RECENT SNAPSHOT')return 'DELAYED';
  return 'STALE';
}
function quoteAge(row){
  const p=priorityQuotes.get(row?.ticker);
  if(p&&Date.now()-Date.parse(p.as_of)<=10000)return Math.max(0,Math.floor((Date.now()-Date.parse(p.as_of))/1000));
  return ageSeconds();
}
function quoted(row){
  if(!online()||!row)return null;
  const p=priorityQuotes.get(row.ticker);
  if(p&&Date.now()-Date.parse(p.as_of)<=10000){
    return p.window&&Date.parse(p.window.close_time)>Date.now()?p.window:null;
  }
  if(!row.window)return null;
  const age=ageSeconds(),limit=(mode==='LIVE'||mode==='PARTIAL')?30:120;
  if(age===null||age>limit)return null;
  if(Date.parse(row.window.close_time)<=Date.now())return null;
  return row.window;
}
function sourceLabel(state){
  return {LIVE:'LIVE VENUE QUOTES',PARTIAL:'PARTIAL COVERAGE',DELAYED:'DELAYED DIRECTORY',STALE:'SOURCE OUTDATED',OFFLINE:'OFFLINE',UNAVAILABLE:'SOURCE UNAVAILABLE'}[state]||'SOURCE UNAVAILABLE';
}
function renderSource(){
  const state=freshness(),age=ageSeconds();
  const pill=$('#sourcePill');
  pill.className='pill '+(state==='LIVE'?'source-live':state==='PARTIAL'?'source-partial':'source-off');
  pill.textContent=sourceLabel(state);
  const c=coverage?' · '+coverage.ok+'/'+coverage.total+' sources checked':'';
  $('#sourceAge').textContent=(age===null?'Awaiting public source':'Captured '+timeAgo(age)+' · '+isoLabel(feed.as_of))+c;
  if(mode==='LIVE'&&state==='STALE')pill.textContent='QUOTE STALE';
}
function signalTag(){
  return node('span','signal pending','NO SIGNAL');
}
function marketIcon(row){
  const [cls,symbol]=ICONS[row.symbol]||['','✦'];
  return node('span','coin '+cls,symbol);
}
function recordQuote(row,asOf=feed?.as_of){
  if(!row?.window||typeof row.window.yes_bid_dollars!=='string'||!asOf)return;
  const key=row.window.ticker,price=Number(row.window.yes_bid_dollars),at=Date.parse(asOf);
  if(!Number.isFinite(price)||!Number.isFinite(at))return;
  const hist=sessionHistory.get(key)||[];
  if(!hist.some(x=>x.at===at)){
    hist.push({at,price});hist.sort((a,b)=>a.at-b.at);
    if(hist.length>36)hist.splice(0,hist.length-36);
    sessionHistory.set(key,hist);
  }
  if(sessionHistory.size>90)sessionHistory.delete(sessionHistory.keys().next().value);
}
function quoteTrend(row){
  const hist=sessionHistory.get(row.window?.ticker)||[];
  if(hist.length<3)return null;
  const sampled=hist.slice(-24),prices=sampled.map(x=>x.price);
  const max=Math.max(...prices),min=Math.min(...prices),margin=Math.max((max-min)*.2,.015);
  const box=node('div','quote-gauge');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 120 42');svg.setAttribute('width','120');svg.setAttribute('height','42');svg.setAttribute('aria-label','Observed YES bid prices this browser session');
  const points=prices.map((v,i)=>{
    const x=5+(i/Math.max(1,prices.length-1))*110;
    const y=34-(v-(min-margin))/(max-min+margin*2)*28;
    return x.toFixed(1)+','+y.toFixed(1);
  }).join(' ');
  const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');
  line.setAttribute('points',points);line.setAttribute('fill','none');
  line.setAttribute('stroke',prices.at(-1)<prices[0]?'#ff9b56':'#4df29d');
  line.setAttribute('stroke-width','2.4');line.setAttribute('stroke-linecap','round');line.setAttribute('stroke-linejoin','round');
  svg.append(line);box.append(svg);child(box,'small','','Observed bids · '+prices.length+' samples');
  return box;
}
function miniGauge(window){
  const box=node('div','quote-gauge'),outer=child(box,'div'),bar=child(outer,'span');
  const value=Number(window?.yes_bid_dollars);
  bar.style.width=(Number.isFinite(value)?Math.max(0,Math.min(100,value*100)):0)+'%';
  child(box,'small','','YES bid · snapshot');
  return box;
}
function labelFor(row){
  return row.kind==='multi_asset'?'Multi-asset · 15-minute':'Crypto · 15-minute';
}
function makeCard(row,featured=false){
  const card=node('button','card '+(featured?'ticker-card':'market-card')+(row.ticker===selectedTicker?' selected':''));
  card.type='button';card.dataset.market=row.ticker;
  card.setAttribute('aria-label','Open '+row.name+' public market summary');
  card.setAttribute('aria-pressed',String(row.ticker===selectedTicker));
  const window=quoted(row);
  if(featured){
    const line=child(card,'div','ticker-row');line.append(marketIcon(row));
    const desc=child(line,'span');child(desc,'span','ticker-name',row.symbol+'15M');child(desc,'div','ticker-label',row.name);
    line.append(signalTag());
    const stats=child(card,'div','ticker-stats'),numbers=child(stats,'div');
    child(numbers,'div','price',window?.yes_bid_dollars?'$'+window.yes_bid_dollars:'—');
    child(numbers,'div','pct '+(window?'good':''),window?'YES bid · Kalshi contract':'No verified open quote');
    stats.append(window?(quoteTrend(row)||miniGauge(window)):node('div','pending-wave'));
  }else{
    const line=child(card,'div','main-line'),name=child(line,'div','ticker-row');
    name.append(marketIcon(row));
    const desc=child(name,'span');child(desc,'h3','',row.symbol+'15M');child(desc,'div','market-sub',labelFor(row));
    line.append(signalTag());
    const valueRow=child(card,'div','value-row'),numbers=child(valueRow,'div');
    child(numbers,'strong',window?'':'awaiting-value',window?.yes_bid_dollars?'$'+window.yes_bid_dollars:'—');
    child(numbers,'div','pct '+(window?'good':''),window?.yes_ask_dollars?'YES ask $'+window.yes_ask_dollars:window?'YES ask unavailable':'No current quote confirmed');
    valueRow.append(window?(quoteTrend(row)||miniGauge(window)):node('div','pending-wave'));
    const bottom=child(card,'div','bottom-row');
    const observation=researchFor(row.symbol);
    child(bottom,'span','',observation?'Research '+observation.decision+' · unverified':'Market listed · NO APPROVED SIGNAL');
    child(bottom,'span','',window?'Checked '+timeAgo(quoteAge(row)):'Quote unavailable');
  }
  return card;
}
function researchStatus(){
  return M.researchFreshness(researchFeed,Date.now(),online());
}
function researchFor(symbol){
  if(!researchFeed||!symbol)return null;
  return researchFeed.latest.find(item=>item.asset===symbol)||null;
}
function researchNote(item){
  return item.decision==='PASS'?'ADDY recorded an abstention, not a directional prediction.':
    item.decision==='YES'?'Observed research preference for the contract YES outcome.':
    'Observed research preference for the contract NO outcome.';
}
function researchTime(value){
  if(!value||!Number.isFinite(Date.parse(value)))return 'Time unknown';
  return new Date(value).toLocaleString([],{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
}
function researchStatusLabel(){
  const status=researchStatus();
  if(status==='PROVISIONAL')return 'Recent local source · origin not independently verified';
  if(status==='SOURCE_STALE')return 'PredictOS source is stale — latest evidence is historical';
  if(status==='PUBLISHER_STALE')return 'Public publisher is stale — latest evidence is historical';
  if(status==='OFFLINE')return 'Offline · last received research only';
  return 'No current verified PredictOS publication';
}
function renderResearchFeed(target,limit=9){
  target.replaceChildren();
  const summary=node('div','research-summary',researchStatusLabel());
  target.append(summary);
  const unique=new Map();
  for(const record of [...(researchFeed?.recent_directional||[]),...(researchFeed?.latest||[])]){
    if(!unique.has(record.public_id))unique.set(record.public_id,record);
  }
  const rows=[...unique.values()].sort((a,b)=>Date.parse(b.observed_at)-Date.parse(a.observed_at)).slice(0,limit);
  if(!rows.length){target.append(node('div','feed-empty','No canonical PredictOS research observations are available for public display.'));return}
  for(const record of rows){
    const row=node('div','feed-row');
    child(row,'span','asset',record.asset+'15M');
    const tag=child(row,'span','research-tag '+(record.decision==='PASS'?'pass':'directional'),'RESEARCH '+record.decision);
    tag.setAttribute('title','Provisional source, not a BUY or funded trading signal');
    child(row,'span','reason',researchNote(record)+' Source authenticity and results not certified.');
    child(row,'span','time',researchTime(record.observed_at)+' · '+(Date.parse(record.expires_at)>Date.now()?'window pending':'expired'));
    target.append(row);
  }
}
async function loadResearch(){
  if(researchLoading||!online())return;
  researchLoading=true;
  try{
    const response=await fetch(LIVE+'/v1/addy',{mode:'cors',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error('RESEARCH_HTTP_'+response.status);
    researchFeed=M.validateResearch(await response.json());
    researchLastError=null;
  }catch(e){researchLastError='PUBLIC_RESEARCH_UNAVAILABLE';}
  researchLoading=false;
  render();
}
function emptyFeed(target){
  target.replaceChildren();
  const content=node('div','feed-empty','No approved public ADDY signals have been published. Market listings and Kalshi quotes are not predictions.');
  target.append(content);
}
function renderHome(){
  const rows=feed?.series||[],preferred=FEATURED.map(symbol=>rows.find(r=>r.symbol===symbol)).filter(Boolean);
  const selected=[...preferred,...rows.filter(r=>r.kind==='asset'&&!preferred.includes(r))].slice(0,4);
  const target=$('#homeTickers');target.replaceChildren();
  if(!selected.length){target.append(node('div','card market-empty','No verified market directory available.'));renderResearchFeed($('#homeFeed'),6);return}
  for(const row of selected)target.append(makeCard(row,true));
  renderResearchFeed($('#homeFeed'),6);
}
function renderMarkets(){
  const rows=feed?.series||[];
  $('#marketCount').textContent=String(rows.length||'—');
  $('#allCount').textContent=String(rows.length||'—');
  const found=M.filterSeries(rows,search,filter==='published'?'signal':filter==='pending'?'none':'all',feed);
  const target=$('#marketGrid');target.replaceChildren();
  if(!found.length){
    const box=node('div','card market-empty');
    child(box,'strong','',filter==='published'?'No approved public signals':'No matching Crypto15 markets');
    child(box,'p','',filter==='published'?'No ADDY signal has been published. This does not mean the markets are unavailable.':'Try another ticker, symbol or filter.');
    target.append(box);
  }else for(const row of found)target.append(makeCard(row));
  $$('[data-market-filter]').forEach(button=>{
    const on=button.dataset.marketFilter===filter;
    button.classList.toggle('on',on);button.setAttribute('aria-pressed',String(on));
  });
  renderResearchFeed($('#marketFeed'),18);
  renderMarketDetails();
}
function renderMarketDetails(){
  const target=$('#marketDetail');
  const row=(feed?.series||[]).find(r=>r.ticker===selectedTicker);
  target.replaceChildren();
  if(!row){
    const box=child(target,'div');child(box,'div','eyebrow','PUBLIC MARKET SUMMARY');
    child(box,'h3','','Select a market above');child(box,'p','detail-text','Choose a Crypto15 series to inspect its current public Kalshi contract quote.');
    target.append(node('span','details-chip','READ ONLY'));return;
  }
  const block=child(target,'div');
  child(block,'div','eyebrow','PUBLIC MARKET SUMMARY');
  child(block,'h3','',row.symbol+'15M · '+row.name);
  child(block,'p','detail-text',row.kind==='multi_asset'?'This series contains multiple individual event contracts. This card displays one representative open contract, not a combined market price.':'Quotes are binary Kalshi contract prices (YES bids/asks). These are not the cryptocurrency spot price or a trading recommendation.');
  const market=quoted(row),values=child(block,'div','detail-metrics');
  const makePill=s=>child(values,'span','pill neutral',s);
  if(market){
    makePill('Contract: '+market.ticker);
    makePill('YES bid $'+(market.yes_bid_dollars??'unavailable'));
    makePill('YES ask $'+(market.yes_ask_dollars??'unavailable'));
    makePill('Closes '+isoLabel(market.close_time));
    makePill('Quote checked '+timeAgo(quoteAge(row)));
  }else makePill('No verified current contract quote');
  makePill('NO APPROVED PUBLIC ADDY SIGNAL');
  const observed=researchFor(row.symbol);
  if(observed){
    const details=child(block,'div','research-detail');
    child(details,'strong','','PredictOS research observation · '+observed.decision+' (provisional)');
    child(details,'p','',researchNote(observed)+' Recorded '+researchTime(observed.observed_at)+'. '+
      (Date.parse(observed.expires_at)>Date.now()?'Contract interval not yet expired.':'Contract interval expired.')+
      ' Source authenticity, results, and trading qualification have not been independently certified.');
    child(details,'small','',researchStatusLabel());
  }
  target.append(node('span','details-chip','PUBLIC DATA ONLY'));
}
function render(){
  renderSource();renderHome();renderMarkets();
}
function showPage(page,focus=true){
  if(!PAGES.includes(page))page='home';
  activePage=page;
  $$('.page').forEach(s=>s.classList.toggle('active',s.id===page));
  $$('[data-page]').forEach(b=>{
    if(b.classList.contains('navbtn')||b.closest('.bottomnav')){
      const on=b.dataset.page===page;b.classList.toggle('active',on);
      if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
    }
  });
  document.title='ADDY Intelligence · '+page[0].toUpperCase()+page.slice(1);
  if(focus){const h=$('#'+page+' h1');if(h){h.setAttribute('tabindex','-1');h.focus({preventScroll:true})}window.scrollTo(0,0)}
}
function selectMarket(ticker){
  const row=(feed?.series||[]).find(x=>x.ticker===ticker);
  if(!row)return;
  selectedTicker=ticker;location.hash='#markets';showPage('markets');
  renderMarkets();
  requestPriorityQuote();
}
function toast(text){
  const t=$('#toast');t.textContent=text;t.classList.add('visible');
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove('visible'),6500);
}
async function fetchBatches(){
  const batches=[],totalCoverage={ok:0,total:0};let groups=null;
  for(let i=0;i<(groups??1);i++){
    const response=await fetch(LIVE+'/v1/live/'+i,{mode:'cors',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw Error('HTTP_'+response.status);
    const expected=Number(response.headers.get('X-ADDY-Group-Count'));
    if(!Number.isInteger(expected)||expected<1||expected>36||groups!==null&&expected!==groups)throw Error('INVALID_GROUP_COUNT');
    groups=expected;
    const pair=(response.headers.get('X-ADDY-Market-Coverage')||'').match(/^(\d+)\/(\d+)$/);
    if(!pair)throw Error('INVALID_COVERAGE_HEADER');
    const body=M.validate(await response.json()),ok=Number(pair[1]),count=Number(pair[2]);
    if(ok<1||ok>count||count!==body.series.length)throw Error('INVALID_COVERAGE');
    batches.push(body);totalCoverage.ok+=ok;totalCoverage.total+=count;
    if(i+1<groups)await new Promise(resolve=>setTimeout(resolve,1900));
  }
  return {feed:M.combineLiveBatches(batches),coverage:totalCoverage};
}
async function fetchPublished(){
  const response=await fetch('/public_catalog.json',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw Error('STATIC_HTTP_'+response.status);
  return M.validate(await response.json());
}
async function load(){
  if(fetchRunning||!online())return;
  fetchRunning=true;
  let newLive=null;
  try{newLive=await fetchBatches()}catch{liveFails+=1}
  if(newLive){
    feed=newLive.feed;coverage=newLive.coverage;mode=coverage.ok===coverage.total?'LIVE':'PARTIAL';liveFails=0;
    for(const row of feed.series)recordQuote(row);
    if(!selectedTicker||!feed.series.some(x=>x.ticker===selectedTicker))selectedTicker=feed.series.find(x=>x.symbol==='BTC')?.ticker||feed.series[0]?.ticker;
  }else{
    const previousLiveAge=mode==='LIVE'||mode==='PARTIAL'?ageSeconds():Infinity;
    if(!feed||previousLiveAge>30){
      try{feed=await fetchPublished();coverage=null;mode='PUBLISHED';}catch{
        // Retain historical evidence with original timestamps; never advance freshness.
      }
    }
  }
  if(feed&&(!selectedTicker||!feed.series.some(row=>row.ticker===selectedTicker))){
    selectedTicker=feed.series.find(row=>row.symbol==='BTC')?.ticker||feed.series[0]?.ticker||null;
  }
  lastCatalogRead=Date.now();fetchRunning=false;render();
}
async function requestPriorityQuote(){
  if(activePage!=='markets'||!selectedTicker||!online())return;
  const ticker=selectedTicker;
  try{
    const response=await fetch(LIVE+'/v1/quote/'+encodeURIComponent(ticker),{mode:'cors',cache:'no-store',signal:AbortSignal.timeout(7500)});
    if(!response.ok)throw Error('QUOTE_HTTP_'+response.status);
    const quote=await response.json();
    if(quote.schema_version!==1||quote.source!=='KALSHI_PUBLIC_API'||quote.series_ticker!==ticker||
      typeof quote.as_of!=='string'||!Number.isFinite(Date.parse(quote.as_of))||Date.now()-Date.parse(quote.as_of)>15000)throw Error('QUOTE_CONTRACT');
    const row=feed?.series.find(x=>x.ticker===ticker);
    if(!row)return;
    const next={...row,window:quote.window};
    const valid=M.validate({...feed,series:feed.series.map(x=>x.ticker===ticker?next:x)});
    if(!valid)return;
    priorityQuotes.set(ticker,{window:quote.window,as_of:quote.as_of});
    if(quote.window)recordQuote(next,quote.as_of);
    quoteFails=0;renderMarkets();
  }catch{quoteFails+=1}
}
document.addEventListener('click',event=>{
  const page=event.target.closest('[data-page]');
  if(page){event.preventDefault();location.hash='#'+page.dataset.page;showPage(page.dataset.page);return}
  const market=event.target.closest('[data-market]');
  if(market){selectMarket(market.dataset.market);return}
  const button=event.target.closest('[data-market-filter]');
  if(button){filter=button.dataset.marketFilter;renderMarkets();return}
  if(event.target.closest('#installTop,#installAbout')){installApp();return}
  if(event.target.closest('#installHelpClose'))$('#installHelp').hidden=true;
  if(event.target.closest('#applyUpdate'))applyUpdate();
});
$('#marketSearch').addEventListener('input',e=>{search=e.target.value;renderMarkets()});
window.addEventListener('hashchange',()=>showPage(location.hash.slice(1),false));
window.addEventListener('online',()=>{load();loadResearch()});
window.addEventListener('offline',()=>render());
document.addEventListener('visibilitychange',()=>{if(!document.hidden){load();loadResearch();checkVersion()}});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvent=e});
window.addEventListener('appinstalled',()=>{$('#installHelp').hidden=true;installEvent=null});
async function installApp(){
  if(installEvent){try{await installEvent.prompt()}catch{$('#installHelp').hidden=false}installEvent=null}
  else $('#installHelp').hidden=false;
}
async function registerWorker(){
  if(!('serviceWorker' in navigator))return;
  try{registration=await navigator.serviceWorker.register('/service-worker.js',{scope:'/',updateViaCache:'none'})}catch{}
}
async function checkVersion(){
  try{
    const r=await fetch('/version.json',{cache:'no-store'});
    if(!r.ok)return;
    const next=await r.json();
    if(typeof next.build_id==='string'&&next.build_id!==BUILD_ID){
      $('#updateNotice').hidden=false;
      if(registration)await registration.update();
    }
  }catch{}
}
function applyUpdate(){
  if(registration?.waiting){
    navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});
    registration.waiting.postMessage({type:'SKIP_WAITING'});
  }else location.reload();
}
function scheduleLive(){
  setTimeout(async()=>{
    if(!document.hidden)await load();
    scheduleLive();
  },liveFails?Math.min(45000,12000+liveFails*7000):12000);
}
function schedulePriority(){
  setTimeout(async()=>{
    if(activePage==='markets'&&!document.hidden)await requestPriorityQuote();
    schedulePriority();
  },quoteFails?Math.min(20000,3000+quoteFails*3500):3000);
}
showPage(location.hash.slice(1),false);
render();
load().finally(()=>{scheduleLive();schedulePriority()});
loadResearch();
setInterval(()=>{if(!document.hidden)loadResearch()},30000);
registerWorker().then(checkVersion);
setInterval(()=>{if(!document.hidden)renderSource()},1000);
