const API = "https://api.crypto.com/exchange/v1/public/";
const STARTING_EUR = 150;
const FEE_RATE = 0.003; // 0.3% per side, conservative demo estimate
const MAX_MARKETS = 25;
const CANDLES = 30;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "Content-Type",
      "cache-control": "no-store"
    }
  });
}
function sym(x) { return x?.instrument_name || x?.i || x?.symbol || ""; }
function num(x, ...keys) {
  for (const k of keys) if (x?.[k] !== undefined && x[k] !== null && x[k] !== "") {
    const n = Number(x[k]); if (Number.isFinite(n)) return n;
  }
  return 0;
}
function arr(r) { return r?.data || r?.instruments || r?.tickers || []; }
async function publicApi(path, params = {}) {
  const u = new URL(API + path);
  for (const [k,v] of Object.entries(params)) u.searchParams.set(k, String(v));
  const res = await fetch(u, { headers: { "user-agent": "crypto-momentum-paper-bot/1.0" } });
  if (!res.ok) throw new Error("Crypto.com API HTTP " + res.status);
  const body = await res.json();
  if (body.code !== 0) throw new Error(body.message || "Crypto.com API error");
  return body.result;
}
async function candles(symbol) {
  const end = Date.now(), start = end - CANDLES * 5 * 60 * 1000;
  const r = await publicApi("get-candlestick", {
    instrument_name: symbol, timeframe: "5m", start_ts: start, end_ts: end
  });
  return arr(r).map(c => ({
    t: num(c,"t"), o: num(c,"o"), h: num(c,"h"), l: num(c,"l"), c: num(c,"c"), v: num(c,"v")
  })).filter(c => c.c > 0).sort((a,b) => a.t-b.t);
}
function analyze(cs, ticker) {
  if (cs.length < 22) return null;
  const last = cs.at(-1), prev15 = cs.at(-4), prev60 = cs.at(-13);
  const past = cs.slice(-21,-1);
  const vavg = past.reduce((s,c)=>s+c.v,0)/Math.max(1,past.length);
  const volRel = vavg ? last.v/vavg : 0;
  const ema = cs.slice(-20).reduce((s,c)=>s+c.c,0)/20;
  const ch15 = (last.c/prev15.c-1)*100, ch60 = (last.c/prev60.c-1)*100;
  const resistance = Math.max(...cs.slice(-13,-1).map(c=>c.h));
  const breakout = last.c > resistance;
  const change24 = num(ticker,"c");
  const bid = num(ticker,"b"), ask = num(ticker,"k");
  const spread = bid > 0 && ask > 0 ? (ask/bid-1)*100 : 99;
  let score = Math.min(25,Math.max(0,volRel/2*25));
  score += Math.min(25,Math.max(0,Math.min(3,ch15)/3*15 + Math.min(6,ch60)/6*10));
  score += breakout ? 20 : 0;
  score += ch60 > 0 && change24 > -5 ? 15 : 0;
  score += spread <= .1 ? 15 : spread <= .3 ? 10 : 0;
  const candidate = last.c >= ema && spread <= .3 && score >= 80 && breakout &&
    volRel >= 2 && ch15 >= .5 && ch15 <= 3 && ch60 >= 1 && ch60 <= 6;
  return {
    symbol: sym(ticker), price: last.c, change24: change24*100, ch15, ch60,
    volRel, score: Math.round(score), breakout, spread, resistance,
    candidate, extended: ch60 > 8, scannedAt: new Date().toISOString()
  };
}
async function init(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS signals (id INTEGER PRIMARY KEY AUTOINCREMENT, symbol TEXT NOT NULL, price REAL NOT NULL, score INTEGER NOT NULL, ch15 REAL, ch60 REAL, vol_rel REAL, spread REAL, resistance REAL, candidate INTEGER NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new')").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS trades (id INTEGER PRIMARY KEY AUTOINCREMENT, signal_id INTEGER, symbol TEXT NOT NULL, entry REAL NOT NULL, stop REAL NOT NULL, target REAL NOT NULL, size_eur REAL NOT NULL, fee_rate REAL NOT NULL, status TEXT NOT NULL DEFAULT 'open', exit REAL, pnl_eur REAL, opened_at TEXT NOT NULL, closed_at TEXT, close_reason TEXT, FOREIGN KEY(signal_id) REFERENCES signals(id))").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS bot_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)").run();
  await db.prepare("INSERT OR IGNORE INTO bot_state(key,value) VALUES ('starting_eur','150'),('last_scan',''),('last_error',''),('scan_count','0')").run();
}
async function setState(db,key,value) {
  await db.prepare("INSERT INTO bot_state(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(key,String(value)).run();
}
async function getState(db,key) {
  const r = await db.prepare("SELECT value FROM bot_state WHERE key=?").bind(key).first();
  return r?.value ?? "";
}
async function scanMarkets(db) {
  await init(db);
  try {
    const [insR,tickR] = await Promise.all([publicApi("get-instruments"),publicApi("get-tickers")]);
    const instruments = arr(insR), tickers = arr(tickR);
    const spot = new Set(instruments.filter(x => String(x.inst_type || x.type || "").toLowerCase().includes("spot") || !x.inst_type).map(sym));
    const eligible = tickers.filter(t => {
      const s=sym(t);
      return (spot.size===0 || spot.has(s)) && (s.endsWith("_EUR") || s.endsWith("_USDT")) && num(t,"a","k")>0;
    }).sort((a,b)=>num(b,"v")-num(a,"v")).slice(0,MAX_MARKETS);
    const results=[];
    for (let i=0;i<eligible.length;i+=5) {
      const batch=await Promise.all(eligible.slice(i,i+5).map(async t=>{
        try { return analyze(await candles(sym(t)),t); } catch { return null; }
      }));
      results.push(...batch.filter(Boolean));
    }
    results.sort((a,b)=>b.score-a.score);
    const now=new Date().toISOString();
    for (const x of results) {
      await db.prepare("INSERT INTO signals(symbol,price,score,ch15,ch60,vol_rel,spread,resistance,candidate,created_at,status) VALUES(?,?,?,?,?,?,?,?,?,?, 'new')")
        .bind(x.symbol,x.price,x.score,x.ch15,x.ch60,x.volRel,x.spread,x.resistance,x.candidate?1:0,now).run();
    }
    // Keep only the most recent 500 signals.
    await db.prepare("DELETE FROM signals WHERE id NOT IN (SELECT id FROM signals ORDER BY id DESC LIMIT 500)").run();
    await manageOpenTrades(db, tickers);
    await setState(db,"last_scan",now);
    await setState(db,"last_error","");
    await setState(db,"scan_count",Number(await getState(db,"scan_count"))+1);
    return {ok:true,markets:eligible.length,analyzed:results.length,candidates:results.filter(x=>x.candidate).length,at:now};
  } catch(e) {
    await setState(db,"last_error",String(e?.message||e));
    throw e;
  }
}
async function manageOpenTrades(db,tickers) {
  const open=await db.prepare("SELECT * FROM trades WHERE status='open'").all();
  const prices=new Map(tickers.map(t=>[sym(t),num(t,"a","k","c")]));
  for (const t of open.results || []) {
    const price=prices.get(t.symbol); if (!(price>0)) continue;
    let exit=null,reason="";
    if(price<=t.stop){exit=t.stop;reason="stop"}
    else if(price>=t.target){exit=t.target;reason="target"}
    if(exit!==null){
      const pnl=t.size_eur*(exit/t.entry-1)-t.size_eur*t.fee_rate*2;
      await db.prepare("UPDATE trades SET status='closed',exit=?,pnl_eur=?,closed_at=?,close_reason=? WHERE id=? AND status='open'")
        .bind(exit,pnl,new Date().toISOString(),reason,t.id).run();
    }
  }
}
async function portfolio(db) {
  await init(db);
  const closed=await db.prepare("SELECT COALESCE(SUM(pnl_eur),0) pnl, COUNT(*) n, COALESCE(SUM(CASE WHEN pnl_eur<0 THEN -pnl_eur ELSE 0 END),0) losses FROM trades WHERE status='closed'").first();
  const open=await db.prepare("SELECT * FROM trades WHERE status='open' ORDER BY id DESC").all();
  const history=await db.prepare("SELECT * FROM trades WHERE status='closed' ORDER BY id DESC LIMIT 100").all();
  const starting=Number(await getState(db,"starting_eur"))||STARTING_EUR;
  const realized=Number(closed?.pnl)||0;
  const positions=open.results||[];
  return {startingEur:starting,realizedPnl:realized,equityEur:starting+realized,closedCount:Number(closed?.n)||0,open:positions,closed:history.results||[],updatedAt:await getState(db,"last_scan")};
}
async function route(req, env) {
  const url=new URL(req.url), path=url.pathname;
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:{"access-control-allow-origin":"*","access-control-allow-methods":"GET,POST,OPTIONS","access-control-allow-headers":"Content-Type"}});
  await init(env.DB);
  if(path==="/api/status" && req.method==="GET") return json({ok:true,service:"crypto-momentum-paper-bot",mode:"paper-only",lastScan:await getState(env.DB,"last_scan"),lastError:await getState(env.DB,"last_error"),scanCount:Number(await getState(env.DB,"scan_count"))});
  if(path==="/api/signals" && req.method==="GET") {
    const r=await env.DB.prepare("SELECT * FROM signals ORDER BY id DESC LIMIT 100").all();
    return json({signals:(r.results||[]).map(s=>({...s,candidate:!!s.candidate}))});
  }
  if(path==="/api/portfolio" && req.method==="GET") return json(await portfolio(env.DB));
  if(path==="/api/trades" && req.method==="GET") {
    const r=await env.DB.prepare("SELECT * FROM trades ORDER BY id DESC LIMIT 100").all(); return json({trades:r.results||[]});
  }
  if(path==="/api/trades/open" && req.method==="POST") {
    const body=await req.json().catch(()=>null);
    const id=Number(body?.signalId);
    if(!Number.isInteger(id)||id<1) return json({error:"signalId non valido"},400);
    const sig=await env.DB.prepare("SELECT * FROM signals WHERE id=?").bind(id).first();
    if(!sig||!sig.candidate||sig.status!=="new") return json({error:"Segnale non disponibile o non più valido"},409);
    const already=await env.DB.prepare("SELECT COUNT(*) n FROM trades WHERE status='open'").first();
    if(Number(already?.n)>=2) return json({error:"Massimo 2 posizioni aperte"},409);
    const openAt=Number(sig.price), stop=Math.min(Number(sig.resistance)*.99,openAt*.97);
    if(!(openAt>stop&&stop>0)) return json({error:"Prezzi non validi per lo stop"},400);
    const riskBudget=1.5, size=Math.min(150,riskBudget/((openAt-stop)/openAt+FEE_RATE*2));
    if(!(size>0)) return json({error:"Dimensione posizione non valida"},400);
    const target=openAt+(openAt-stop)*2, now=new Date().toISOString();
    const result=await env.DB.prepare("INSERT INTO trades(signal_id,symbol,entry,stop,target,size_eur,fee_rate,status,opened_at) VALUES(?,?,?,?,?,?,?,'open',?)")
      .bind(id,sig.symbol,openAt,stop,target,size,FEE_RATE,now).run();
    await env.DB.prepare("UPDATE signals SET status='used' WHERE id=?").bind(id).run();
    return json({ok:true,tradeId:result.meta?.last_row_id,symbol:sig.symbol,entry:openAt,stop,target,sizeEur:size,mode:"paper"},201);
  }
  return json({error:"Endpoint non trovato"},404);
}
export default {
  async fetch(request, env) {
    try { return await route(request,env); }
    catch(e) { return json({error:"Errore backend",detail:String(e?.message||e)},500); }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(scanMarkets(env.DB).catch(e=>console.error("Scheduled scan failed",e)));
  }
};
