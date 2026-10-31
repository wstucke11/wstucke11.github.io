/* ADDY public presentation contract. No private endpoints and no trading authority. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.AddyPublicModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const SERIES=/^KX([A-Z0-9]{2,24})15M$/;
  const WINDOW=/^KX[A-Z0-9]{2,24}15M-[A-Za-z0-9-]+$/;
  const TOP=['schema_version','source','as_of','publication_enabled','catalog_status','series','signals','performance','insights'];
  const FIELDS=['ticker','symbol','name','aliases','kind','window'];
  const OBJ=o=>o&&typeof o==='object'&&!Array.isArray(o);
  const exact=(o,keys)=>OBJ(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
  const validTime=s=>typeof s==='string'&&s.endsWith('Z')&&Number.isFinite(Date.parse(s));
  function validate(input,now=Date.now()){
    if(!exact(input,TOP)||input.schema_version!==1||input.source!=='KALSHI_PUBLIC_API'||
      input.publication_enabled!==false||!['AVAILABLE','UNAVAILABLE'].includes(input.catalog_status)||
      !validTime(input.as_of)||Date.parse(input.as_of)>now+60000||
      !Array.isArray(input.series)||input.series.length>250||
      !Array.isArray(input.signals)||input.signals.length!==0||input.performance!==null||
      !Array.isArray(input.insights)||input.insights.length!==0||
      (input.catalog_status==='UNAVAILABLE'&&input.series.length))throw Error('Invalid sanitized public catalog');
    const seen=new Set();
    for(const row of input.series){
      if(!exact(row,FIELDS)||typeof row.ticker!=='string'||!SERIES.test(row.ticker)||
        row.symbol!==row.ticker.match(SERIES)[1]||
        typeof row.name!=='string'||row.name.length===0||row.name.length>90||
        !['asset','multi_asset'].includes(row.kind)||seen.has(row.ticker))throw Error('Invalid series');
      if(!Array.isArray(row.aliases)||row.aliases.length>8||row.aliases.some(a=>typeof a!=='string'||!/^[A-Za-z0-9 &.\-]{2,40}$/.test(a)))throw Error('Invalid aliases');
      seen.add(row.ticker);
      if(row.window!==null){
        const w=row.window;
        if(!OBJ(w)||Object.keys(w).some(k=>!['ticker','open_time','close_time','status','yes_bid_dollars','yes_ask_dollars'].includes(k))||
          !['ticker','open_time','close_time','status'].every(k=>Object.hasOwn(w,k))||
          typeof w.ticker!=='string'||!WINDOW.test(w.ticker)||!w.ticker.startsWith(row.ticker+'-')||
          w.status!=='OPEN'||!validTime(w.open_time)||!validTime(w.close_time)||Date.parse(w.open_time)>=Date.parse(w.close_time))throw Error('Invalid market window');
        for(const k of ['yes_bid_dollars','yes_ask_dollars']){
          if(Object.hasOwn(w,k)&&!(typeof w[k]==='string'&&/^(?:0|1)(?:\.\d{1,6})?$/.test(w[k])))throw Error('Invalid public price');
        }
      }
    }
    return input;
  }
  function freshness(feed,now=Date.now(),online=true){
    if(!online)return 'OFFLINE';
    if(!feed||feed.catalog_status!=='AVAILABLE')return 'UNAVAILABLE';
    const age=now-Date.parse(feed.as_of);
    // GitHub Pages refreshes the public directory on a scheduled build; quotes have a stricter TTL.
    if(!Number.isFinite(age)||age< -60000||age>600000)return 'STALE';
    return 'RECENT SNAPSHOT';
  }
  function windowStatus(row,feed,now=Date.now(),online=true){
    const state=freshness(feed,now,online);
    if(state!=='RECENT SNAPSHOT')return state;
    if(now-Date.parse(feed.as_of)>120000)return 'QUOTE STALE';
    if(!row?.window)return 'WINDOW UNVERIFIED';
    if(Date.parse(row.window.close_time)<=now)return 'WINDOW CLOSED';
    return 'OPEN AT SNAPSHOT';
  }
  function signalState(row,feed){
    // Without a separately certified public signal source, absence means NO_SIGNAL.
    // Never infer an ADDY signal from venue markets, quotes, or strategy eligibility.
    return 'NO_SIGNAL';
  }
  function filterSeries(rows,term='',mode='all',feed=null){
    const q=String(term||'').trim().toLowerCase();
    return rows.filter(r=>{
      const matches=!q||[r.symbol,r.ticker,r.name,...r.aliases].some(s=>s.toLowerCase().includes(q));
      const state=signalState(r,feed);
      return matches&&(mode==='all'||mode==='none'&&state==='NO_SIGNAL'||mode==='signal'&&state!=='NO_SIGNAL');
    });
  }
  function totals(feed,now=Date.now(),online=true){
    if(freshness(feed,now,online)!=='RECENT SNAPSHOT')return {series:null,open:null,signals:null};
    return {series:feed.series.length,
      open:now-Date.parse(feed.as_of)>120000?null:feed.series.filter(r=>windowStatus(r,feed,now,online)==='OPEN AT SNAPSHOT').length,
      signals:feed.series.filter(r=>signalState(r,feed)!=='NO_SIGNAL').length};
  }
  function combineLiveBatches(batches,now=Date.now()){
    if(!Array.isArray(batches)||batches.length<1||batches.length>36)throw Error('Invalid batch count');
    const series=[];let oldest=Infinity;
    for(const input of batches){
      const batch=validate(input,now),time=Date.parse(batch.as_of);
      if(now-time>35000||time-now>60000)throw Error('Live batch timestamp stale');
      oldest=Math.min(oldest,time);
      series.push(...batch.series);
    }
    return validate({...batches[0],series,as_of:new Date(oldest).toISOString()},now);
  }
  const RESEARCH_TOP=['schema_version','schema','source','generated_at','source_observed_at','source_state','source_verification','authority','approved_signals','performance','latest','recent_directional'];
  const RESEARCH_KEYS=['public_id','asset','series_ticker','market_ticker','observed_at','expires_at','decision','market_state','evidence_status'];
  const RESEARCH_ASSETS=new Set(['BTC','ETH','SOL','XRP','DOGE','BNB','HYPE','NEAR','ZEC']);
  function validateResearch(payload,now=Date.now()){
    if(!exact(payload,RESEARCH_TOP)||payload.schema_version!==1||payload.schema!=='addy.public.research.v1'||
      payload.source!=='PREDICTOS_LOCAL_FINALS_READ_ONLY'||payload.authority!=='RESEARCH_OBSERVATIONS_ONLY'||
      payload.source_verification!=='NOT_INDEPENDENTLY_ATTESTED'||payload.approved_signals!==false||
      payload.performance!==null||!['UNAVAILABLE','RECENT','STALE'].includes(payload.source_state)||
      !validTime(payload.generated_at)||Date.parse(payload.generated_at)>now+60000||
      (payload.source_observed_at!==null&&!validTime(payload.source_observed_at))||
      !Array.isArray(payload.latest)||payload.latest.length>9||
      !Array.isArray(payload.recent_directional)||payload.recent_directional.length>25)
      throw Error('Invalid provisional public research');
    const known=new Set(),latest=new Set(),hist=new Set();
    for(const [type,rows] of [['latest',payload.latest],['recent',payload.recent_directional]]){
      for(const r of rows){
        if(!exact(r,RESEARCH_KEYS)||typeof r.public_id!=='string'||!/^[0-9a-f]{20}$/.test(r.public_id)||
          !RESEARCH_ASSETS.has(r.asset)||r.series_ticker!=='KX'+r.asset+'15M'||
          typeof r.market_ticker!=='string'||!WINDOW.test(r.market_ticker)||
          !r.market_ticker.startsWith(r.series_ticker+'-')||
          !validTime(r.observed_at)||!validTime(r.expires_at)||
          Date.parse(r.observed_at)>=Date.parse(r.expires_at)||
          !['YES','NO','PASS'].includes(r.decision)||
          !['CURRENT','EXPIRED'].includes(r.market_state)||
          r.evidence_status!=='SOURCE_NOT_INDEPENDENTLY_ATTESTED')
          throw Error('Invalid research observation');
        if(type==='latest'){
          if(latest.has(r.asset))throw Error('Duplicate public asset');
          latest.add(r.asset);
        }else{
          if(r.decision==='PASS'||hist.has(r.public_id))throw Error('Invalid directional history');
          hist.add(r.public_id);
        }
        known.add(r.public_id);
      }
    }
    if(payload.source_observed_at===null&&known.size)throw Error('Missing source date');
    return payload;
  }
  function researchFreshness(data,now=Date.now(),online=true){
    if(!online)return 'OFFLINE';
    if(!data)return 'UNAVAILABLE';
    if(!data.source_observed_at)return 'NO_OBSERVATIONS';
    const publishAge=now-Date.parse(data.generated_at);
    const sourceAge=now-Date.parse(data.source_observed_at);
    if(!Number.isFinite(publishAge)||publishAge>600000||publishAge< -60000)return 'PUBLISHER_STALE';
    if(!Number.isFinite(sourceAge)||sourceAge>300000||sourceAge< -60000)return 'SOURCE_STALE';
    return 'PROVISIONAL';
  }
  return {validate,freshness,windowStatus,signalState,filterSeries,totals,combineLiveBatches,validateResearch,researchFreshness};
});
