
const D = window.__D;if(window.__LITE_TAG){(function(){var U="data/full-"+window.__LITE_TAG+".json",LD=null,SI=searchIndex;window.__LITE=true;
function full(){if(!LD){LD=fetch(U).then(function(r){if(!r.ok)throw 0;return r.json()}).then(function(F){for(var k in F.packs)D.packs[k]=F.packs[k];["timeline","timelineUK","journey","profiles","checklistSeed"].forEach(function(k){if(F[k])D[k]=F[k]});window.__LITE=false;SI.v=null;var q=document.getElementById("q");if(q&&q.value)q.dispatchEvent(new Event("input",{bubbles:true}));}).catch(function(){LD=null;});}return LD||Promise.reject();}
window.__fullData=full;
searchIndex=function(){if(window.__LITE){full();return[];}return SI();};
var NV=navigate;navigate=function(r){if(window.__LITE&&r&&r.page!=="home"){var a=document.getElementById("app");if(a&&!a.firstChild)a.innerHTML='<p style="text-align:center;padding:30vh 0;color:#888">Loading…</p>';var p=full();if(p&&p.then)p.then(function(){NV(r)},function(){location.reload()});return;}NV(r);if(window.__LITE)setTimeout(function(){(window.requestIdleCallback||function(f){f()})(function(){full()})},1500);};
document.addEventListener("focusin",function(e){if(e.target&&e.target.id==="q"&&window.__LITE)full();});})();}
const PACKS = D.packs;
const ORDER = ["buffett", "munger", "lynch"];
const SOON = [];
const DAY = 86400000;
const QWORD = {buffett:"Buffett", munger:"Munger", lynch:"Lynch"};

/* ---------------- state ---------------- */
function todayISO(){ return new Date().toISOString().slice(0,10); }
const DEFAULT = () => ({
  progress:{start:todayISO(), weeks:{}, letters:{}, path:{}, packs:{}},
  notes:{}, bookmarks:{}, cards:{},
  rules:D.checklistSeed.map((t,i)=>({id:"r"+(i+1),text:t,src:"Starter rule",on:false})),
});
const DOCS = ["progress","notes","bookmarks","cards","rules"];
let S = DEFAULT();
let store = {db:null, uid:null, mode:"local"};
function lsGet(){ try{ const v=localStorage.getItem("bls-state"); return v?JSON.parse(v):null; }catch(e){ return null; } }
function lsSet(){ try{ localStorage.setItem("bls-state", JSON.stringify(S)); }catch(e){} }
function normalise(){ const p=S.progress; p.weeks=p.weeks||{}; p.letters=p.letters||{}; p.path=p.path||{}; p.packs=p.packs||{}; S.notes=S.notes||{}; S.bookmarks=S.bookmarks||{}; S.cards=S.cards||{}; S.rules=S.rules||[]; }
const local = lsGet(); if(local) S = Object.assign(DEFAULT(), local); normalise();

let UI = {scale:1, theme:"auto", welcomed:false};
try{ const u=localStorage.getItem("bls-ui"); if(u) UI=Object.assign(UI, JSON.parse(u)); }catch(e){}
function saveUI(){ try{ localStorage.setItem("bls-ui", JSON.stringify(UI)); }catch(e){} }
function applyUI(){
  document.documentElement.style.setProperty("--scale", UI.scale);
  if(UI.theme==="auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", UI.theme);
  
}
applyUI();

const pending = {}, writing = {};
function touch(doc){ lsSet(); setSave("Saving…"); clearTimeout(pending[doc]); pending[doc]=setTimeout(()=>flush(doc), 1200); }
async function flush(doc){
  if(!store.db || !store.uid){ setSave("Saved on this device"); return; }
  if(writing[doc]){ pending[doc]=setTimeout(()=>flush(doc), 600); return; }
  writing[doc]=true;
  try{ await store.db.doc("data/users/"+store.uid+"/"+doc).set({v:JSON.stringify(S[doc]), at:Date.now()}); setSave("Saved to your account"); }
  catch(e){
    if(e && e.code==="unavailable") setTimeout(()=>flush(doc), 1500);
    else if(e && e.code==="quota_exceeded") setSave("Account storage full — saved on this device only");
    else { store.db=null; setSave("Saved on this device"); }
  } finally { writing[doc]=false; }
}
function setSave(t){ const el=document.getElementById("saveState"); if(el) el.textContent=t; }
async function connect(){
  try{
    if(!window.claude || !window.claude.use) return;
    const db = await window.claude.use("db"); const user = await window.claude.use("user");
    if(!db || !user) return;
    const uid = await user.id(); if(!uid) return;
    store = {db, uid, mode:"account"};
    let found=false;
    for(const doc of DOCS){
      const snap = await db.doc("data/users/"+uid+"/"+doc).get();
      if(snap.exists){ found=true; try{ S[doc]=JSON.parse(snap.data().v); }catch(e){} }
    }
    normalise();
    if(!found){ for(const doc of DOCS) await flush(doc); }
    lsSet(); setSave(store.db?"Saved to your account":"Saved on this device"); render();
  }catch(e){ setSave("Saved on this device"); }
}

/* ---------------- pack context ---------------- */
let CUR = "buffett";
const P = () => PACKS[CUR];
function PR(){ if(CUR==="buffett") return S.progress; return S.progress.packs[CUR] || (S.progress.packs[CUR]={start:todayISO(), weeks:{}, letters:{}, path:{}}); }
function NK(k){ return CUR==="buffett" ? k : CUR+":"+k; }
function BK(id){ return CUR==="buffett" ? id : CUR+":"+id; }
function CK(id){ return CUR==="buffett" ? "c-"+id : CUR+":c-"+id; }
function inPack(cardId){ return CUR==="buffett" ? cardId.startsWith("c-") : cardId.startsWith(CUR+":"); }
function R(view){ return "#" + (CUR==="buffett" ? "" : CUR+"-") + view; }
function unitHref(key){ return R(P().unitRoute+"-"+key); }
function themeHref(num){ return R("theme-"+num); }
const IDX = {};
function idx(){ if(IDX[CUR]) return IDX[CUR]; const p=P();
  const o = {theme:Object.fromEntries(p.themes.map(t=>[t.id,t])), quote:Object.fromEntries(p.quotes.map(q=>[q.id,q])),
    mist:Object.fromEntries(p.mistakes.map(m=>[m.id,m])), unit:Object.fromEntries(p.units.map(u=>[u.key,u]))};
  return IDX[CUR]=o; }

/* ---------------- helpers ---------------- */
const $ = s => document.querySelector(s);
function esc(s){ return String(s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function strip(s){ return String(s).replace(/<[^>]*>/g,""); }
function toast(t){ const el=$("#toast"); el.textContent=t; el.classList.add("show"); clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove("show"),1800); }
function weekNow(){ const s=new Date(PR().start+"T00:00:00"); const d=Math.floor((Date.now()-s)/DAY); return Math.min(12, Math.max(1, Math.floor(d/7)+1)); }
function synTag(){ return '<span class="tag syn" title="Written in our own words">Summary</span>'; }
function wordTag(pid){ return `<span class="tag wb">${QWORD[pid||CUR]}</span>`; }
function unitChip(key){ const u=idx().unit[key]; return u?u.chip:key; }
function unitLinks(n){ return n.units.length ? n.units.map(k=>`<a class="chip" href="${unitHref(k)}">${esc(unitChip(k))}</a>`).join("") : `<span class="chip">${esc(n.tags)}</span>`; }
function hrefFor(pid, view){ return "#" + (pid==="buffett" ? "" : pid+"-") + view; }
function today(){ const d=new Date(); d.setHours(0,0,0,0); return d.getTime(); }
function sentences(t){ return String(t).replace(/([.!?])\s+(?=[A-Z“"])/g,"$1\u0001").split("\u0001").filter(Boolean); }
function bl(items, cls="bl"){ return `<ul class="${cls}">${items.map(i=>`<li>${i}</li>`).join("")}</ul>`; }

/* one idea, as a bullet with its source chips and two actions */
function ideaItem(id){ const n=P().nuggets[id]; if(!n) return ""; const bm=!!S.bookmarks[BK(id)];
  return `<li class="idea"><div class="itx"><b>${esc(n.lead)}</b> ${esc(n.text)}</div>
  <div class="imeta"><span class="src">${unitLinks(n)}</span><span class="iact"><button class="ab ${bm?"on":""}" data-bm="${id}" aria-pressed="${bm}">${bm?"★ Saved":"☆ Save"}</button><button class="ab" data-addrule="${id}">＋ Rule</button></span></div></li>`; }
function ideas(ids){ return ids.length ? `<ul class="ideas">${ids.map(ideaItem).join("")}</ul>` : ""; }

function quoteBlock(qid){ const q=idx().quote[qid]; if(!q) return ""; const bm=!!S.bookmarks[BK(qid)]; const th=idx().theme[q.theme];
  return `<blockquote class="q"><span class="qt">“${esc(q.text)}”</span><cite>${wordTag()} <span>${esc(q.label)}</span> <a href="${themeHref(th.num)}">Ch. ${th.num}</a> <button class="ab ${bm?"on":""}" data-bm="${qid}" aria-pressed="${bm}">${bm?"★ Saved":"☆ Save"}</button></cite></blockquote>`; }

/* tables: 3+ columns stack into labelled cards on phones */
function tbl(head, rows, opt={}){ const stack = opt.stack ?? head.length>=3;
  return `<div class="tw"><table class="t${stack?" stack":""}${opt.cls?" "+opt.cls:""}">${opt.nohead?"":`<thead><tr>${head.map(h=>`<th>${h}</th>`).join("")}</tr></thead>`}<tbody>${
    rows.map(r=>`<tr${r.cls?` class="${r.cls}"`:""}>${(r.cells||r).map((c,i)=>`<td data-label="${esc(strip(head[i]||""))}"${i===0&&opt.lead?' class="lead"':""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`; }
function kv(rows){ return `<div class="tw"><table class="t kv"><tbody>${rows.map(([a,b])=>`<tr><th scope="row">${a}</th><td>${b}</td></tr>`).join("")}</tbody></table></div>`; }

/* note boxes: collapsed until you tap "Write", open when they hold text */
const OPEN = new Set(); let FOCUSNEXT = null;
function noteBox(key,label,ph){ const k=NK(key), v=S.notes[k]||"", has=!!v.trim(), open=has||OPEN.has(k);
  return `<details class="nb" data-nk="${esc(k)}" ${open?"open":""}><summary><span class="nbq">${esc(label)}</span><span class="nbh">${has?"✎ Edit":"✎ Write"}</span></summary><textarea id="n-${esc(k)}" data-note="${esc(k)}" placeholder="${esc(ph||"Your answer")}">${esc(v)}</textarea></details>`; }
function askBox(title, items){ return `<div class="ask"><div class="box-h">${esc(title)}</div>${items.join("")}</div>`; }
function mineBox(title, items){ return `<div class="minebox"><div class="box-h"><span class="tag mine">Mine</span> ${esc(title)}</div>${items.join("")}</div>`; }
function legend(){ return `<div class="legend">${synTag()}<span>our words</span>${wordTag()}<span>his exact words</span><span class="tag mine">Mine</span><span>your notes</span></div>`; }
function pager(prev, next){ if(!prev && !next) return ""; return `<nav class="pager">${prev?`<a href="${prev[0]}"><small>Previous</small>${esc(prev[1])}</a>`:"<span></span>"}${next?`<a class="nx" href="${next[0]}"><small>Next</small>${esc(next[1])}</a>`:"<span></span>"}</nav>`; }
function sec(n, title, body){ return `<section class="sec"><div class="sec-h"><span class="sn">${n}</span>${esc(title)}</div>${body}</section>`; }

/* ---------------- diagrams ---------------- */
function svg(h, body){ return `<svg viewBox="0 0 400 ${h}" role="img" aria-hidden="true">${body}</svg>`; }
function T(x,y,t,cls="",anchor="start",extra=""){ return `<text x="${x}" y="${y}" class="${cls}" text-anchor="${anchor}" ${extra}>${esc(t)}</text>`; }
function delay(i,step=.12){ return `style="animation-delay:${(i*step).toFixed(2)}s"`; }
const DIAG = {
  savings(){ const cols=[["GREAT","See's Candies",18,70],["GOOD","FlightSafety",62,40],["GRUESOME","Airlines",70,8]]; let b="";
    cols.forEach(([lab,ex,cap,ret],i)=>{ const x0=i*133+67, base=138;
      b+=`<line x1="${x0-58}" y1="${base}" x2="${x0+58}" y2="${base}" class="lr"/>`;
      b+=`<rect x="${x0-34}" y="${base-cap*1.4}" width="30" height="${cap*1.4}" class="ol gy" ${delay(i)}/>`;
      b+=`<rect x="${x0+4}" y="${base-ret*1.4}" width="30" height="${Math.max(ret*1.4,2)}" class="acc gy" ${delay(i+.5)}/>`;
      b+=T(x0,16,lab,"b a","middle")+T(x0-19,155,"capital","s","middle")+T(x0+19,155,"return","s","middle")+T(x0,180,ex,"dsp","middle"); });
    return svg(188,b); },
  aesop(){ let b=""; const qs=["How sure are the birds in the bush?","When will they come, and how many?","What does a safe bond pay meanwhile?"];
    qs.forEach((q,i)=>{ const y=i*36; b+=`<rect x="0" y="${y}" width="400" height="28" rx="6" class="soft fd" ${delay(i)}/>`+T(200,y+19,q,"","middle"); });
    b+=`<line x1="6" y1="146" x2="394" y2="146" class="lr"/><rect x="170" y="138" width="170" height="16" rx="3" class="acc gx" style="animation-delay:.4s"/>`;
    b+=T(255,132,"value: an honest range","b a","middle")+`<circle cx="70" cy="146" r="6" class="ink pp" style="animation-delay:.8s"/>`+T(70,132,"price","b","middle");
    b+=`<line x1="78" y1="170" x2="166" y2="170" class="ln" stroke-dasharray="4 3"/>`+T(122,192,"margin of safety","dsp","middle");
    return svg(198,b); },
  drops(){ const d=[["1973–75",59.1],["Oct 1987",37.1],["1998–2000",48.9],["2008–09",50.7]]; let b=`<line x1="0" y1="32" x2="400" y2="32" class="ln"/>`;
    d.forEach(([l,v],i)=>{ const x=i*100+50, h=v*2.1; b+=`<rect x="${x-32}" y="32" width="64" height="${h}" class="acc gyt" ${delay(i)}/>`+T(x,32+h-10,"−"+v.toFixed(1)+"%","b w","middle")+T(x,20,l,"s b","middle"); });
    return svg(162,b); },
  friction(){ const d=[["S&P 500 index fund",8.5,1],["Fund-of-funds C",6.5],["Fund-of-funds B",3.6],["Fund-of-funds E",2.4],["Fund-of-funds A",2.0],["Fund-of-funds D",0.3]]; let b="";
    d.forEach(([l,v,hi],i)=>{ const y=i*38, w=v*36; b+=T(0,y+13,l,hi?"b":"");
      b+= `<rect x="0" y="${y+19}" width="${Math.max(w,2)}" height="13" class="${hi?"acc":"ol"} gx" ${delay(i)}/>`+T(Math.max(w,2)+8,y+31,v.toFixed(1)+"%",hi?"b a":"b"); });
    return svg(230,b); },
  zero(){ const parts=["1.20","×","1.35","×","1.15","×","1.40","×","0","=","0"]; const W=p=>p==="0"?36:p.length>1?42:18;
    let x=(400-parts.reduce((s,p)=>s+W(p)+4,0)+4)/2, b="";
    parts.forEach((p,i)=>{ const w=W(p); if(p==="0"){ b+=`<circle cx="${x+18}" cy="34" r="17" class="acc pp" ${delay(i,.09)}/>`+T(x+18,41,"0","dsp b w","middle"); }
      else b+=`<text x="${x+w/2}" y="41" class="dsp fd" text-anchor="middle" ${delay(i,.09)}>${p}</text>`; x+=w+4; });
    return svg(70,b); },
  circle(){ const cx=78, cy=88; let b=`<circle cx="${cx}" cy="${cy}" r="76" class="ol pp"/><circle cx="${cx}" cy="${cy}" r="52" class="soft pp" style="animation-delay:.12s"/><circle cx="${cx}" cy="${cy}" r="26" class="acc pp" style="animation-delay:.24s"/>`;
    const rows=[[cy-40,cx+34,"What I half-know","Most damage is done here."],[cy,cx+20,"What I can value","Act here, in size."],[cy+62,cx+50,"Everything else","Passing costs nothing."]];
    rows.forEach(([y,x0,a,c])=>{ b+=`<line x1="${x0}" y1="${y}" x2="168" y2="${y}" class="lr" stroke-dasharray="3 3"/>`+T(174,y-3,a,"b a")+T(174,y+15,c,"s"); });
    return svg(172,b); },
  ladder(){ const st=[["1","Reinvest in the business"],["2","Buy other businesses"],["3","Buy back shares below value"],["4","Pay a dividend"]]; let b="";
    st.forEach(([n,a],i)=>{ const y=i*44; b+=`<rect x="0" y="${y}" width="400" height="32" rx="6" class="${i?"soft":"acc"} fd" ${delay(i)}/>`+T(14,y+21,n,"b "+(i?"a":"w"))+T(38,y+21,a,i?"":"w b");
      if(i<3) b+=`<path d="M194 ${y+34} l6 7 l6 -7" class="ln"/>`; });
    return svg(164,b); },
  gold(){ const full=290; const g=full*4200/606811; let b="";
    b+=T(0,14,"Index fund, dividends reinvested","b")+`<rect x="0" y="22" width="${full}" height="22" class="acc gx"/>`+T(full+8,38,"$606,811","b a");
    b+=T(0,72,"Gold","b")+`<rect x="0" y="80" width="${Math.max(g,2)}" height="22" class="ink gx" style="animation-delay:.3s"/>`+T(Math.max(g,2)+8,96,"about $4,200","b");
    return svg(108,b); },
  lattice(){ const names=["Mathematics","Physics","Engineering","Biology","Psychology","Economics","Accounting","History"]; const cx=200, cy=100;
    const pos=names.map((n,i)=>{ const a=(-90+i*45)*Math.PI/180; return [cx+150*Math.cos(a), cy+82*Math.sin(a)]; }); let b="";
    pos.forEach((a,i)=>pos.slice(i+1).forEach(c=>{ b+=`<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${c[0].toFixed(1)}" y2="${c[1].toFixed(1)}" class="lr dr" pathLength="1000"/>`; }));
    names.forEach((n,i)=>{ const [x,y]=pos[i]; const w=n.length*7.4+18; b+=`<rect x="${(x-w/2).toFixed(1)}" y="${(y-12).toFixed(1)}" width="${w.toFixed(1)}" height="24" rx="12" class="${i===4?"acc":"card"} pp" ${delay(i,.07)} stroke="var(--accent)"/>`+T(x.toFixed(1),(y+4.5).toFixed(1),n,"s b "+(i===4?"w":"a"),"middle"); });
    return svg(200,b); },
  invert(){ let b=`<path d="M6 36 H392" class="ln dr" pathLength="1000"/><path d="M382 30 l12 6 l-12 6" class="ln"/>`+T(6,20,"FORWARD","s b")+T(200,62,"How do I succeed?","dsp","middle");
    b+=`<path d="M394 106 H8" class="la dr" pathLength="1000" style="animation-delay:.5s"/><path d="M18 100 l-12 6 l12 6" class="la"/>`+T(394,90,"BACKWARD","s b a","end")+T(200,132,"What would make this fail? Avoid that.","dsp a","middle");
    return svg(142,b); },
  lolla(){ const L=["Social proof","Authority","Incentives","Stress","Contrast"]; const cx=300, cy=84; let b="";
    L.forEach((l,i)=>{ const y=12+i*36; b+=T(104,y+5,l,"","end")+`<circle cx="114" cy="${y}" r="3" class="ink"/><path d="M114 ${y} L${cx-36} ${cy}" class="ln dr" pathLength="1000" ${delay(i,.1)}/>`; });
    b+=`<circle cx="${cx}" cy="${cy}" r="36" class="acc pp" style="animation-delay:.7s"/>`+T(cx,cy+5,"EXTREME","s b w","middle")+T(cx,cy+60,"Lollapalooza:","b a","middle")+T(cx,cy+78,"forces combine","s","middle");
    return svg(170,b); },
  web(){ const cx=90, cy=74, r=58; const pts=[...Array(6)].map((_,k)=>[cx+r*Math.cos((90+k*60)*Math.PI/180), cy+r*Math.sin((90+k*60)*Math.PI/180)]); let b="";
    pts.forEach((a,i)=>pts.slice(i+1).forEach(c=>{ b+=`<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${c[0].toFixed(1)}" y2="${c[1].toFixed(1)}" class="la dr" pathLength="1000" style="stroke-width:1.2"/>`; }));
    pts.forEach(([x,y],i)=>{ b+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" class="card pp" stroke="var(--accent)" stroke-width="2" ${delay(i,.08)}/>`; });
    b+=T(cx,160,"Deserved trust","b a","middle")+T(cx,178,"few rules, strong ties","s","middle");
    for(let k=0;k<6;k++) b+=`<rect x="240" y="${22+k*19}" width="120" height="13" class="ol fd" ${delay(k,.1)}/>`;
    b+=T(300,160,"Thick procedure","b","middle")+T(300,178,"the costly substitute","s","middle");
    return svg(184,b); },
  wiser(){ const n=60, g=1.06, top=Math.pow(g,n)-1; let d="M8 150";
    for(let i=1;i<=n;i++){ d+=` L${(8+i*6.4).toFixed(1)} ${(150-(Math.pow(g,i)-1)/top*118).toFixed(1)}`; }
    let b=`<line x1="8" y1="150" x2="394" y2="150" class="lr"/><path d="${d}" class="la dr" pathLength="1000"/>`;
    b+=T(8,22,"A little wiser each day","b a")+T(8,42,"Small steps, kept up for years, add up.","s")+T(394,168,"years →","s","end");
    return svg(174,b); },
  punch(){ let b=`<rect x="2" y="2" width="396" height="100" rx="8" class="ol"/>`+T(16,22,"LIFETIME INVESTMENT TICKET","s b a"); const used=[2,9,13];
    for(let i=0;i<20;i++){ const r=Math.floor(i/10), k=i%10; const x=38+k*36, y=46+r*34; b+=`<circle cx="${x}" cy="${y}" r="11" class="${used.includes(i)?"acc pp":"card"}" stroke="var(--ink)" stroke-width="1.2" ${used.includes(i)?delay(used.indexOf(i)+1,.25):""}/>`; }
    b+=T(200,128,"Twenty slots, for life.","dsp b","middle")+T(200,148,"Each used with care, each big enough to matter.","s","middle");
    return svg(156,b); },
  coke(){ const st=[["2.92 trillion","servings a year","by 2034"],["× about 4¢","profit per","serving"],["≈ $117 billion","profit","a year"]]; let b="";
    st.forEach(([a,c,e],i)=>{ const x=i*138, hi=i===2; b+=`<rect x="${x}" y="0" width="124" height="80" rx="6" class="${hi?"acc":"soft"} fd" ${delay(i,.25)}/>`+T(x+62,32,a,"b "+(hi?"w":""),"middle")+T(x+62,54,c,"s "+(hi?"w":""),"middle")+T(x+62,70,e,"s "+(hi?"w":""),"middle"); });
    return svg(82,b); },
  drag(){ const rows=[["Real return before costs",5],["All-in costs",-3],["Annual spending",-5],["Change in real value",-3]]; const z=200, sc=26; let b=`<line x1="${z}" y1="0" x2="${z}" y2="176" class="lr"/>`;
    rows.forEach(([l,v],i)=>{ const y=i*44; b+=T(v>=0?z+4:z-4,y+13,l,i===3?"b":"",v>=0?"start":"end");
      const cls=i===0?"acc":(i===3?"bad":"ink");
      if(v>=0) b+=`<rect x="${z}" y="${y+19}" width="${v*sc}" height="16" class="${cls} gx" ${delay(i)}/>`+T(z+v*sc+6,y+32,"+"+v+"%","b");
      else b+=`<rect x="${z+v*sc}" y="${y+19}" width="${-v*sc}" height="16" class="${cls} gxr" ${delay(i)}/>`+T(z+v*sc-6,y+32,"−"+(-v)+"%","b","end"); });
    return svg(178,b); },
  dollops(){ let b=""; const n=10; for(let i=0;i<n;i++){ const h=(i+1)*10; b+=`<rect x="${i*31}" y="${144-h}" width="25" height="${h}" class="${i===n-1?"acc":"soft"} gy" ${delay(i,.07)}/>`; }
    b+=T(0,18,"Each step looks too small to matter.","dsp")+T(322,96,"Together:","b a")+T(322,114,"a large","s")+T(322,130,"deception","s");
    return svg(150,b); },
  setback(){ const p=[0,10,6,22,30,-4,12,26,34,20,40,52,46,60,72]; const X=i=>8+i*27, Y=v=>146-(v+4)*1.6; let d=`M${X(0)} ${Y(p[0])}`; p.slice(1).forEach((v,i)=>d+=` L${X(i+1)} ${Y(v)}`);
    let b=`<line x1="4" y1="${Y(0)}" x2="396" y2="${Y(0)}" class="lr"/><path d="${d}" class="la dr" pathLength="1000"/>`;
    [[5,"an unfair blow",18],[9,"another",20]].forEach(([i,l,o])=>{ b+=`<circle cx="${X(i)}" cy="${Y(p[i])}" r="5" class="card pp" stroke="var(--ink)" style="animation-delay:1s"/>`+T(X(i),Y(p[i])+o,l,"s b","middle"); });
    return svg(172,b); },
  hub(){ const cx=200, cy=88, rx=168, ry=72; let b="";
    for(let i=0;i<12;i++){ const a=(i*30+15)*Math.PI/180, x=cx+rx*Math.cos(a), y=cy+ry*Math.sin(a); b+=`<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="lr dr" pathLength="1000"/><rect x="${(x-15).toFixed(1)}" y="${(y-9).toFixed(1)}" width="30" height="18" rx="3" class="ol pp" ${delay(i,.05)}/>`; }
    b+=`<rect x="${cx-26}" y="${cy-14}" width="52" height="28" rx="4" class="acc"/>`+T(cx,cy+5,"HQ","b w","middle");
    return svg(178,b); },
};
function diagram(t){ if(!t.diagram || !DIAG[t.diagram]) return ""; return `<figure class="dg">${DIAG[t.diagram]()}<figcaption>${esc(t.caption)}</figcaption></figure>`; }


/* ---------------- my journey: the builder's own record ---------------- */
const J = D.journey;
const KIND = {kept:["✓","Kept the rule"], broke:["✗","Broke the rule"], risk:["!","Risk I carry now"]};
const JF = {kind:"all", open:null, start:2015, end:"now"};
const sgn = v => (v>0?"+":v<0?"−":"")+Math.abs(v).toFixed(1)+"%";
const mns = v => (v<0?"−":"")+Math.abs(v);
const IC_J = {
  story:'<svg viewBox="0 0 24 24"><path d="M4 19V5a1 1 0 0 1 1-1h10l5 5v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M14 4v5h5M8 13h8M8 17h5"/></svg>',
  nums:'<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  lessons:'<svg viewBox="0 0 24 24"><path d="M5 12l4 4L19 6"/></svg>',
  rules:'<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>',
};
function jLink(view){ return "#journey"+(view?"-"+view:""); }
function lessonCard(L, focus){ const [ic,lab]=KIND[L.kind]; const r=L.rule;
  const q = r.quote ? (()=>{ const pk=PACKS[r.pack]; const qq=pk.quotes.find(x=>x.id===r.quote); return qq?`<p class="jq">“${esc(qq.text)}” <span class="small muted">${esc(pk.short)}, ${esc(qq.label)}</span></p>`:""; })() : "";
  const link = r.pack ? `<a class="chip" href="${hrefFor(r.pack,"theme-"+PACKS[r.pack].themes.find(t=>t.id===r.theme).num)}">${esc(PACKS[r.pack].short)} · Ch. ${PACKS[r.pack].themes.find(t=>t.id===r.theme).num}: ${esc(PACKS[r.pack].themes.find(t=>t.id===r.theme).title)}</a>` : "";
  return `<article class="jl ${L.kind}${focus?" focus":""}" id="jl-${L.id}">
    <div class="jl-top"><span class="jk">${ic}</span><span class="small"><b>${esc(lab)}</b> · ${L.y[0]===L.y[1]?L.y[0]:L.y[0]+" to "+L.y[1]}</span></div>
    <h3>${esc(L.title)}</h3>${bl(L.facts.map(esc))}
    <div class="jr"><div class="box-h">The rule · ${esc(r.who)}</div><p>${synTag()} ${esc(r.text)}</p>${q}${link}</div>
    <p class="jnow"><b>What I do now:</b> ${esc(L.now)}</p></article>`; }
function jHero(){ const h=J.hero; return `<div class="jhero"><span class="eyebrow">My journey · as of ${esc(J.asOf)}</span><h2>${esc(h.title)}</h2><p>${esc(h.sub)}</p>
  <div class="stats">${h.stats.map(([a,b])=>`<div class="stat"><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("")}</div></div>`; }
function fallsChart(){ const max=60; return `<div class="falls">${J.falls.map(([l,v,who])=>`<div class="fall ${who}"><div class="fl"><span>${esc(l)}</span><b>−${Math.abs(v).toFixed(1)}%</b></div><div class="fb"><i style="width:${Math.abs(v)/max*100}%"></i></div></div>`).join("")}</div><p class="note">${esc(J.fallsNote)}</p>`; }
function vJourney(){ const kept=J.lessons.filter(l=>l.kind==="kept").length, broke=J.lessons.filter(l=>l.kind==="broke").length, risk=J.lessons.filter(l=>l.kind==="risk").length;
  return `${jHero()}
  <h3>The short version</h3><div class="card">${bl(J.story.map(esc))}</div>
  <h3>Even the legends fell this far</h3>${fallsChart()}
  <div class="card jcta"><b>${J.lessons.length} lessons, in order.</b> <span class="small muted">${kept} times I kept their rules, ${broke} times I broke them, and ${risk} risks I am carrying now.</span>
  <div class="row"><a class="btn" href="${jLink("lessons")}">Read the lessons</a><a class="btn ghost" href="${jLink("numbers")}">See all the numbers</a></div></div>
  <h3>Why I'm showing this</h3>${bl(["Saying “I learned from Buffett and Munger” means little without the receipts.","These are the receipts: what their rules did for me when I kept them, and what it cost when I didn't.","I am not a legend. If my mistakes save you one of yours, this page has done its job."])}
  ${jDisc()}`; }
function jDisc(){ return `<h3>Please read</h3><div class="card grey">${J.disclaimer.map(d=>`<p class="note">${esc(d)}</p>`).join("")}</div>`; }

/* year bars: me against my yardstick, tap a year for what happened */
function yearBars(){ const Z=24, S=0.74; const bar=(v,cls)=>{ const w=Math.abs(v)*S; return v>=0?`<i class="${cls}" style="left:${Z}%;width:${w}%"></i>`:`<i class="${cls}" style="left:${Z-w}%;width:${w}%"></i>`; };
  return `<div class="ybars"><div class="ylegend"><span class="k me"></span>Me <span class="k fund"></span>Yardstick fund <span class="small muted">· tap a year</span></div>
  ${J.years.map(([y,m,f,soft])=>{ const open=JF.open===y; const ls=J.lessons.filter(L=>!L.whole&&y>=L.y[0]&&y<=L.y[1]);
    return `<button class="yrow ${open?"open":""}" data-jy="${y}" aria-expanded="${open}"><span class="yl">${y===2026?"2026*":y}</span><span class="yb"><span class="z" style="left:${Z}%"></span>${bar(m,"me")}${bar(f,"fund")}</span><span class="yv"><b>${sgn(m)}${soft?"*":""}</b><small>${sgn(f)}</small></span></button>
    ${open?`<div class="ydet">${ls.length?ls.map(L=>`<a class="ylink ${L.kind}" href="${jLink("l-"+L.id)}"><span class="jk">${KIND[L.kind][0]}</span>${esc(L.title)}</a>`).join(""):'<span class="small muted">No lesson tagged to this year.</span>'}</div>`:""}`; }).join("")}
  <p class="note">2026 is the year so far, to ${esc(J.asOf)}. * marks a rougher figure. ${esc(J.first)}</p></div>`; }
function growthChart(){ const g=J.growth, W=400, H=210, L=30, B=24, max=9.5; const X=i=>L+i*(W-L-8)/(g.length-1), Y=v=>H-B-(v/max)*(H-B-12);
  const path=k=>g.map((p,i)=>(i?"L":"M")+X(i).toFixed(1)+" "+Y(p[k]).toFixed(1)).join(" ");
  let b=""; [0,2,4,6,8].forEach(v=>{ b+=`<line x1="${L}" y1="${Y(v)}" x2="${W}" y2="${Y(v)}" class="lr"/>`+T(L-6,Y(v)+4,v?"×"+v:"0","s","end"); });
  g.forEach((p,i)=>{ if(i%2===0||i===g.length-1) b+=T(X(i),H-6,p[0]==="Nov 2026"?"Now":"’"+p[0].slice(2),"s","middle"); });
  b+=`<path d="${path(2)}" class="lf dr" pathLength="1000"/><path d="${path(1)}" class="lm dr" pathLength="1000" style="animation-delay:.3s"/>`;
  const e=g[g.length-1]; b+=`<circle cx="${X(g.length-1)}" cy="${Y(e[1])}" r="5" class="cm pp"/><circle cx="${X(g.length-1)}" cy="${Y(e[2])}" r="5" class="cf pp"/>`;
  b+=`<rect x="${L+6}" y="6" width="12" height="4" rx="2" class="cm"/>`+T(L+22,12,"Me ×"+e[1],"b tm")+`<rect x="${L+120}" y="6" width="12" height="4" rx="2" class="cf"/>`+T(L+136,12,"Fund ×"+e[2],"b");
  return `<figure class="dg jg"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Growth of 1 since December 2014: me ${e[1]} times, fund ${e[2]} times">${b}</svg><figcaption>Growth of 1 from the end of 2014, time-weighted. The fund led for most of the decade; my lead is all from 2025 and 2026.</figcaption></figure>`; }
function startTool(){ const ys=J.years; if(JF.end!=="now" && JF.start>2024) JF.start=2024;
  const i0=ys.findIndex(r=>r[0]===JF.start), i1=JF.end==="now"?ys.length-1:ys.findIndex(r=>r[0]===2024); let gm=1, gf=1; for(let i=i0;i<=i1;i++){ gm*=1+ys[i][1]/100; gf*=1+ys[i][2]/100; }
  const yrs=JF.end==="now"?(ys.length-1-i0)+317/365:(i1-i0+1), cm=(Math.pow(gm,1/yrs)-1)*100, cf=(Math.pow(gf,1/yrs)-1)*100, win=gm>gf;
  const starts=ys.filter(r=>JF.end==="now"?r[0]<2026:r[0]<=2024);
  return `<div class="card sky"><div class="box-h">Try it: pick a start and an end</div><p class="small" style="margin-top:0">If you had put money with me, or in the fund, at the start of…</p>
  <div class="chips">${starts.map(r=>`<button data-js="${r[0]}" class="${r[0]===JF.start?"on":""}">${r[0]}</button>`).join("")}</div>
  <p class="small" style="margin:6px 0 0">…and looked again at:</p>
  <div class="chips"><button data-je="2024" class="${JF.end!=="now"?"on":""}">End of 2024</button><button data-je="now" class="${JF.end==="now"?"on":""}">Now (${esc(J.asOf)})</button></div>
  ${tbl(["From "+JF.start+" to "+(JF.end==="now"?"now":"end 2024"),"Grew to","A year"],[[`<b>Me</b>`,"×"+gm.toFixed(2),cm.toFixed(1)+"%"],[`<b>Yardstick fund</b>`,"×"+gf.toFixed(2),cf.toFixed(1)+"%"]],{stack:false})}
  <p class="verdict">${win?(JF.end==="now"?"I'm ahead over this stretch, mostly because of 2025 and 2026.":"I'm ahead over this stretch."):"The fund is ahead over this stretch."}</p>
  <p class="note">Time-weighted, before tax, worked out from the yearly figures above.</p></div>`; }
function vJNumbers(){ return `<span class="eyebrow">My journey · the numbers</span><h2>The scoreboard, honestly</h2>
  <p class="lede">My record next to theirs, and next to the plain fund I measure myself against.</p>
  ${tbl(["Record","Period","A year"], J.score.map(([a,b,c,who])=>({cls:"sc-"+who, cells:[`<b>${esc(a)}</b>`,esc(b),`<b>${esc(c)}</b>`]})), {stack:false, cls:"score"})}
  <div class="card grey"><div class="box-h">Read this before comparing</div>${bl(J.caveats.map(esc))}</div>
  <h3>Year by year</h3>${yearBars()}
  <h3>Growth of 1</h3>${growthChart()}
  ${startTool()}
  <h3>My rule 12, window by window</h3><p class="note">My three-year return against the fund's. Seven windows in a row behind: by my own rule, I should have handed over.</p>
  ${tbl(["3 years to","Me","Fund",""], J.rule12.map(([w,m,f,s])=>({cls:"r12-"+s, cells:[`<b>${w}</b>`,mns(m)+"%",mns(f)+"%",s==="ahead"?"✓ ahead":s==="level"?"≈ level":"✗ behind"]})), {stack:false, cls:"r12"})}
  <h3>Career facts</h3>${kv(J.facts.map(([a,b])=>[esc(a),esc(b)]))}
  <h3>How these were worked out</h3>${bl(J.method.map(esc))}
  ${jDisc()}`; }
function vJLessons(focus){ const ks=[["all","All"],["kept","✓ Kept"],["broke","✗ Broke"],["risk","! Risks now"]];
  let list=J.lessons.filter(L=>JF.kind==="all"||L.kind===JF.kind);
  const f = focus ? J.lessons.find(L=>L.id===focus) : null;
  return `<span class="eyebrow">My journey · ${J.lessons.length} lessons</span><h2>Where I kept their rules, and where I broke them</h2>
  <p class="lede">In order, from 2016 to today. Each one links to the chapter it comes from.</p>
  ${f?`<div class="card jfocus"><div class="box-h">You came here for this one</div></div>${lessonCard(f,true)}<h3>All lessons</h3>`:""}
  <div class="chips">${ks.map(([k,l])=>`<button data-jk="${k}" class="${JF.kind===k?"on":""}">${l}</button>`).join("")}</div>
  <div class="jlist">${list.map(L=>lessonCard(L,false)).join("")}</div>
  ${jDisc()}`; }
function vJRules(){ return `<span class="eyebrow">My journey · what I do now</span><h2>My rules today</h2>
  <p class="lede">Every rule here was paid for by a lesson on the previous page.</p>
  <div class="card lemon"><ol class="jrules">${J.rulesNow.map((r,i)=>`<li><span>${esc(r)}</span><button class="ab" data-jrule="${i}">＋ Add to my rules</button></li>`).join("")}</ol></div>
  <p class="note">${esc(J.rulesNote)}</p>
  <div class="row"><a class="btn" href="#rules">Open my rules checklist</a><a class="btn ghost" href="${jLink("lessons")}">Read the lessons</a></div>
  ${jDisc()}`; }
/* on a Buffett or Munger chapter: how it played out in my record */
function jCallout(pack, tid){ const ls=J.lessons.filter(L=>L.links.some(([p,t])=>p===pack&&t===tid)); if(!ls.length) return "";
  return `<div class="jcall"><div class="box-h">From my own record</div>${ls.map(L=>`<a class="ylink ${L.kind}" href="${jLink("l-"+L.id)}"><span class="jk">${KIND[L.kind][0]}</span><span><b>${esc(L.title)}</b><span class="small d">${esc(L.facts[0])}</span></span></a>`).join("")}<a class="small" href="#journey">Thirteen years, two teachers: my full report card →</a></div>`; }

/* ---------------- Peter Lynch: the hands-on stock picker ---------------- */
const LY = () => PACKS.lynch;
const LT = {sorter:{i:0,pick:null,right:0,n:0,order:null}, perfect:{t:new Set(), a:new Set()}, peg:{pe:20,g:20,y:1}, tenbag:{ten:1,dbl:2,zero:3},
  cocktail:0, silly:{i:0,pick:null,right:0,n:0,order:null}, drillKind:"fast", drillT:null, drillLeft:120};
const TOOLS = [
  ["sorter","Six kinds game","Sort twelve invented companies into his six kinds","t4","▦"],
  ["perfect","Perfect-stock checklist","Tick his 13 traits and 5 warning signs","t5","✓"],
  ["peg","Quick price check","The P/E against growth, his rule of thumb","t7","⚖"],
  ["drill","Two-minute drill","Make your case for a company, against the clock","t9","⏱"],
  ["tenbag","Ten-bagger maths","See how a few winners carry many losers","t10","★"],
  ["cocktail","Cocktail-party gauge","His half-joking four stages of a market","t11","☕"],
  ["silly","Silly or sensible?","Spot the dangerous things people say about stocks","t12","?"],
];
function shuffle(n){ const a=[...Array(n).keys()]; for(let i=n-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function toolCard(id, inner){ const t=TOOLS.find(x=>x[0]===id); return `<div class="ltool" id="tool-${id}"><div class="ltool-h"><span class="lic">${t[4]}</span><span><b>${esc(t[1])}</b><span class="small muted d">${esc(t[2])}</span></span></div>${inner}</div>`; }
function toolHTML(id){ const f={sorter:tSorter,perfect:tPerfect,peg:tPeg,drill:tDrill,tenbag:tTenbag,cocktail:tCocktail,silly:tSilly}[id]; return f?toolCard(id, f()):""; }

/* six kinds game */
function tSorter(){ const p=LY(), S_=LT.sorter; if(!S_.order) S_.order=shuffle(p.scenarios.length);
  if(S_.i>=S_.order.length) return `<div class="lscore"><b>${S_.right} of ${S_.n}</b> sorted the way he would.</div><p class="small">Real companies are rarely this tidy, and they move between kinds over time. The point is to know what you own before you buy.</p><button class="btn" data-ls="restart">Play again</button>`;
  const sc=p.scenarios[S_.order[S_.i]], done=S_.pick!==null, K=id=>p.kinds.find(k=>k.id===id);
  return `<div class="lprog"><span>Company ${S_.i+1} of ${S_.order.length}</span><span>Score ${S_.right}/${S_.n}</span></div>
  <p class="lcase">${esc(sc.text)}</p>
  <div class="lopts">${p.kinds.map(k=>{ let c=""; if(done){ if(k.id===sc.ans) c="right"; else if(k.id===S_.pick) c="wrong"; } return `<button data-lk="${k.id}" class="${c}" ${done?"disabled":""}>${esc(k.name)}</button>`; }).join("")}</div>
  ${done?`<div class="lfb ${S_.pick===sc.ans?"ok":"no"}"><b>${S_.pick===sc.ans?"✓ Right:":"Not quite: it's"} ${esc(K(sc.ans).name)}.</b> ${esc(sc.why)}
    <div class="small"><b>Expect:</b> ${esc(K(sc.ans).expect)}. <b>He'd think of selling:</b> ${esc(K(sc.ans).sell.toLowerCase())}.</div></div>
    <button class="btn" data-ls="next">Next company</button>`:`<p class="note">Invented companies; tap the kind you think fits.</p>`}`; }
/* perfect-stock checklist */
function tPerfect(){ const p=LY(), P_=LT.perfect, n=P_.t.size, w=P_.a.size;
  const verdict = n===0&&w===0 ? "Think of one company and tick everything that is true of it."
    : w>=2 ? "Several of the warning signs he steered clear of. He would probably walk away."
    : w===1 ? "One warning sign. Find out whether it is a deal-breaker before going further."
    : n>=7 ? "Plenty of what he liked and no warning signs. Now check the earnings, the numbers and the balance sheet."
    : n>=4 ? "Some of his favourite traits. Keep digging."
    : "Few of his traits so far. That doesn't rule it out, but it isn't his kind of stock yet.";
  return `<div class="box-h">His 13 traits</div><div class="lchecks">${p.traits.map((t,i)=>`<button data-lt="${i}" class="${P_.t.has(i)?"on":""}" aria-pressed="${P_.t.has(i)}"><span class="lck">${P_.t.has(i)?"✓":i+1}</span>${esc(t)}</button>`).join("")}</div>
  <div class="box-h" style="margin-top:10px">Warning signs he avoided</div><div class="lchecks bad">${p.avoid.map((t,i)=>`<button data-la="${i}" class="${P_.a.has(i)?"on":""}" aria-pressed="${P_.a.has(i)}"><span class="lck">${P_.a.has(i)?"!":"·"}</span>${esc(t)}</button>`).join("")}</div>
  <div class="lmeter"><div><b>${n}</b>/13 traits<div class="bar"><i style="width:${n/13*100}%"></i></div></div><div><b class="${w?"warn":""}">${w}</b>/5 warnings<div class="bar warnbar"><i style="width:${w/5*100}%"></i></div></div></div>
  <p class="verdict">${esc(verdict)}</p>${n||w?`<button class="btn ghost" data-lclear="perfect">Clear</button>`:""}`; }
/* quick price check */
function pegOut(){ const {pe,g,y}=LT.peg; if(!(pe>0)||!(g>0)) return `<p class="note">Enter a P/E and a growth rate above zero.</p>`;
  const peg=pe/g, lr=(g+y)/pe; const pv = peg<=0.5?"very attractive by his rule":peg<=1?"fair or better":peg<2?"getting expensive":"very unattractive by his rule";
  const lv = lr<1?"poor":lr<1.5?"below okay":lr<2?"okay":"what he was looking for";
  const pos=Math.min(3,lr)/3*100;
  return `<div class="lpeg"><div class="stat"><b>${peg.toFixed(2)}</b><span>P/E ÷ growth: ${pv}</span></div><div class="stat"><b>${lr.toFixed(2)}</b><span>(growth + yield) ÷ P/E: ${lv}</span></div></div>
  <div class="lgauge"><div class="lgz"><i class="z1"></i><i class="z2"></i><i class="z3"></i></div><span class="lneedle" style="left:${pos}%"></span><div class="lgl"><span>0</span><span>1 poor</span><span>1.5 okay</span><span>2+ good</span><span>3</span></div></div>`; }
function tPeg(){ const {pe,g,y}=LT.peg; const f=(id,l,v,step)=>`<label class="lnum"><span>${l}</span><span class="lstep"><button data-lp="${id}" data-d="-${step}" aria-label="Less">−</button><input type="number" inputmode="decimal" id="peg-${id}" value="${v}" step="${step}" min="0"><button data-lp="${id}" data-d="${step}" aria-label="More">+</button></span></label>`;
  return `<div class="lnums">${f("pe","P/E ratio",pe,1)}${f("g","Earnings growth, % a year",g,1)}${f("y","Dividend yield, %",y,0.5)}</div><div id="pegOut">${pegOut()}</div>
  <p class="note">A first screen only. Growth rates are guesses about the future, and he used these numbers alongside the story and the balance sheet, never alone.</p>`; }
/* two-minute drill */
const DRILL_HINT = {slow:"Is the dividend safe and rising? How long has it been raised? Is the P/E low?", stalwart:"What is the P/E compared with its usual range? Has it already risen a lot? What could speed up growth?",
  fast:"Where can it still expand? Is growth speeding up or slowing? Can it repeat its success in new places?", cyclical:"Where are we in the cycle? Are stocks of goods and demand rising or falling?",
  turnaround:"How is it fixing itself: cutting costs, selling divisions, paying down debt? Can it survive while it does?", asset:"What are the hidden assets, what are they worth, and is debt eating into them?"};
function tDrill(){ const p=LY(), m=Math.floor(LT.drillLeft/60), s=String(LT.drillLeft%60).padStart(2,"0");
  const box=(k,l,ph)=>{ const key=NK("drill-"+k); return `<label class="lbl" for="d-${k}">${l}</label><textarea id="d-${k}" data-note="${esc(key)}" rows="3" placeholder="${esc(ph)}">${esc(S.notes[key]||"")}</textarea>`; };
  return `<label class="lbl" for="drillKind">Which kind of stock is it?</label><select id="drillKind">${p.kinds.map(k=>`<option value="${k.id}" ${k.id===LT.drillKind?"selected":""}>${esc(k.name)}</option>`).join("")}</select>
  <p class="lhint"><b>Ask yourself:</b> ${esc(DRILL_HINT[LT.drillKind])} <span class="muted small">(Prompts in our words, based on his examples.)</span></p>
  ${box("why","1. Why I'm interested","The reasons, in plain words")}${box("need","2. What has to happen for it to succeed","The one or two things that must go right")}${box("risk","3. What could go wrong","The pitfalls in its path")}
  <div class="lclock"><span id="drillClock" class="${LT.drillT?"run":""}">${m}:${s}</span><button class="btn" data-ld="${LT.drillT?"stop":"start"}">${LT.drillT?"Stop":"Start the 2-minute clock"}</button><button class="btn ghost" data-ld="reset">Reset</button></div>
  <p class="note">Say it out loud, to yourself or someone else, before the clock runs out. Your words are saved privately with your notes.</p>`; }
function drillTick(){ LT.drillLeft=Math.max(0,LT.drillLeft-1); const el=document.getElementById("drillClock"); if(el) el.textContent=Math.floor(LT.drillLeft/60)+":"+String(LT.drillLeft%60).padStart(2,"0");
  if(LT.drillLeft===0){ clearInterval(LT.drillT); LT.drillT=null; toast("Time! Could you explain it?"); render(); } }
/* ten-bagger maths */
function tTenbag(){ const T_=LT.tenbag, flat=10-T_.ten-T_.dbl-T_.zero, mult=(T_.ten*10+T_.dbl*2+flat)/10, ann=(Math.pow(mult,1/10)-1)*100;
  const slots=[...Array(T_.ten).fill("ten"),...Array(T_.dbl).fill("dbl"),...Array(Math.max(0,flat)).fill("flat"),...Array(T_.zero).fill("zero")];
  const lab={ten:"10×",dbl:"2×",flat:"1×",zero:"0"};
  const st=(id,l,v,max)=>`<div class="lnum"><span>${l}</span><span class="lstep"><button data-lb="${id}" data-d="-1" aria-label="Fewer" ${v<=0?"disabled":""}>−</button><b class="lval">${v}</b><button data-lb="${id}" data-d="1" aria-label="More" ${flat<=0||v>=max?"disabled":""}>+</button></span></div>`;
  return `<p class="small" style="margin-top:0">Ten stocks, held ten years. Choose what happens to them; the rest go nowhere.</p>
  <div class="lnums">${st("ten","Ten-baggers (10×)",T_.ten,5)}${st("dbl","Doubles (2×)",T_.dbl,8)}${st("zero","Total losses (go to zero)",T_.zero,9)}</div>
  <div class="lslots">${slots.map((s,i)=>`<span class="ls ${s}" style="animation-delay:${i*0.04}s">${lab[s]}</span>`).join("")}</div>
  <div class="lpeg"><div class="stat"><b>${mult.toFixed(2)}×</b><span>the whole portfolio after ten years</span></div><div class="stat"><b>${ann>=0?"+":""}${ann.toFixed(1)}%</b><span>a year</span></div></div>
  <p class="verdict">${T_.ten&&T_.zero>=T_.ten?`${T_.zero} total loss${T_.zero>1?"es":""}, and still ${mult>=1?"ahead":"behind"}: one ten-bagger can carry a lot of mistakes.`:T_.ten?"A few ten-baggers do most of the work, which is why he let them run.":"No ten-baggers: everything rests on avoiding losses."}</p>
  <p class="note">Simple illustration of his point. Real results also depend on what you paid, when you bought and how much you put in each stock.</p>`; }
/* cocktail-party gauge */
function tCocktail(){ const p=LY(), k=LT.cocktail, st=p.cocktail[k];
  const R=[150,118,62,58][k], guests=8; let g="";
  for(let i=0;i<guests;i++){ const a=(i/guests)*Math.PI*2+0.3, x=200+R*Math.cos(a), y=95+R*0.52*Math.sin(a);
    g+=`<g class="lguest" style="transform:translate(${x.toFixed(1)}px,${y.toFixed(1)}px)"><circle r="9" class="${k>=2?"acc":"soft"}"/>${k===3&&i%2===0?`<text y="-14" class="s b" text-anchor="middle">tip!</text>`:k===2&&i%3===0?`<text y="-14" class="s b" text-anchor="middle">?</text>`:""}</g>`; }
  const svg_=`<svg viewBox="0 0 400 190" role="img" aria-label="${esc(st[0])}">${g}<circle cx="200" cy="95" r="16" class="ink"/><text x="200" y="100" class="s b w" text-anchor="middle">PL</text></svg>`;
  return `<div class="chips">${p.cocktail.map((c,i)=>`<button data-lc="${i}" class="${i===k?"on":""}">${esc(c[0])}</button>`).join("")}</div>
  <figure class="dg lparty">${svg_}</figure>
  <div class="lstagebox"><div class="lprog"><span><b>${esc(st[0])}</b></span><span>Market since stage one: <b>${esc(st[1])}</b></span></div><p>${esc(st[2])}</p><p class="small muted">${esc(st[3])}</p></div>
  <p class="note">He told this as a joke and said he did not use it to predict the market. He kept buying good companies at sensible prices whatever the party talk.</p>`; }
/* silly or sensible */
function tSilly(){ const p=LY(), Q=LT.silly; if(!Q.order) Q.order=shuffle(p.silly.length);
  if(Q.i>=Q.order.length) return `<div class="lscore"><b>${Q.right} of ${Q.n}</b> spotted.</div><button class="btn" data-lq="restart">Play again</button>`;
  const it=p.silly[Q.order[Q.i]], done=Q.pick!==null, ok=done && (Q.pick==="sense")===it.ok;
  return `<div class="lprog"><span>Saying ${Q.i+1} of ${Q.order.length}</span><span>Score ${Q.right}/${Q.n}</span></div>
  <p class="lsay">“${esc(it.text)}”</p>
  <div class="lopts two"><button data-lq="silly" class="${done?(!it.ok?"right":Q.pick==="silly"?"wrong":""):""}" ${done?"disabled":""}>Silly</button><button data-lq="sense" class="${done?(it.ok?"right":Q.pick==="sense"?"wrong":""):""}" ${done?"disabled":""}>Sensible</button></div>
  ${done?`<div class="lfb ${ok?"ok":"no"}"><b>${ok?"✓ Right.":"Not quite."} ${it.ok?"Sensible.":"Silly."}</b> ${esc(it.why)}</div><button class="btn" data-lq="next">Next saying</button>`:`<p class="note">The silly ones are from his list of the silliest things people say about stock prices, reworded slightly.</p>`}`; }

/* views */
function lyStageOf(t){ return LY().stages.findIndex(s=>s.id===t.stage); }
function lyPathCrumb(t){ const st=LY().stages, i=lyStageOf(t); return `<div class="lcrumb">${st.map((s,k)=>`<a href="#lynch-themes" class="${k===i?"on":k<i?"past":""}" title="${esc(s.name)}"><i>${k+1}</i><span>${esc(s.name)}</span></a>`).join("")}</div>`; }
function vLynchThemes(){ const p=LY(); const th=n=>p.themes.find(t=>t.num===n);
  return `<span class="eyebrow">Peter Lynch · his method</span><h2>The stock-picker's path</h2><p class="lede">Five steps, in the order he worked: get ready, find it, check it, tell it, own it. Each step has its chapters and a tool to try.</p>
  <div class="lpath">${p.stages.map((s,i)=>`<section class="lstage" style="animation-delay:${i*0.08}s"><div class="lnode">${i+1}</div><div class="lbody"><span class="eyebrow">Step ${i+1} · ${esc(s.verb)}</span><h3>${esc(s.name)}</h3><p class="small muted">${esc(s.blurb)}</p>
    ${s.themes.map(n=>{ const t=th(n); return `<a class="tcard" href="${themeHref(n)}"><span class="num">${n}</span><span><b>${esc(t.title)}</b><span class="small muted d">${esc(t.idea)}</span></span></a>`; }).join("")}
    <div class="ltools">${TOOLS.filter(x=>s.themes.includes(+x[3].slice(1))).map(x=>`<a class="chip" href="#lynch-tool-${x[0]}">${x[4]} ${esc(x[1])}</a>`).join("")}</div></div></section>`).join("")}</div>
  <h3>His life in dates</h3>${tbl(["Year","What happened"], p.big.timeline.map(([y,l])=>[`<b>${y}</b>`,esc(l)]), {stack:false, cls:"tl"})}
  <h3>His books</h3><div class="card">${bl(p.big.reading.map(esc))}</div>`; }
function vToolkit(){ return `<span class="eyebrow">Peter Lynch · hands on</span><h2>His toolkit</h2><p class="lede">He learned by doing, so this section lets you do. Each tool is built from one of his rules of thumb.</p>
  <div class="tiles ltiles">${TOOLS.map((t,i)=>`<a class="tile t${i%6+1}" href="#lynch-tool-${t[0]}"><span class="ic">${t[4]}</span><span><b>${esc(t[1])}</b><span class="small d">${esc(t[2])}</span></span></a>`).join("")}<a class="tile t6" href="#lynch-cards"><span class="ic">▣</span><span><b>Flashcards</b><span class="small d">${allCards().length} cards, including his six kinds and 13 traits</span></span></a></div>
  <p class="note">Teaching aids, not valuation models. Nothing here is advice; see About for the full disclaimer.</p>`; }
function vTool(id){ const t=TOOLS.find(x=>x[0]===id); if(!t) return vToolkit(); const th=LY().themes.find(x=>x.id===t[3]);
  return `<a href="#lynch-toolkit" class="back">← All tools</a><span class="eyebrow">Peter Lynch · toolkit</span><h2>${esc(t[1])}</h2>${toolHTML(id)}
  <div class="card grey small">From <a href="${themeHref(th.num)}">Chapter ${th.num}: ${esc(th.title)}</a>. Read the chapter for the ideas behind this tool.</div>`; }
function lyStories(t){ return t.stories&&t.stories.length ? `<h3>From his notebook</h3><div class="lnotes">${t.stories.map((s,i)=>`<div class="lnote" style="--r:${i%2?1.2:-1}deg"><b>${esc(s.t)}</b><p>${esc(s.x)}</p><span class="small muted">${esc(s.src)}</span></div>`).join("")}</div>` : ""; }
function lyStartExtra(){ const p=LY(); return `<div class="lrecord">${p.record.map(([a,b],i)=>`<div class="stat"><b ${i===1?'data-count="29.2" data-suf="%"':i===3?'data-count="28000" data-pre="$1,000 → $" data-fmt="k"':""}>${esc(a)}</b><span>${esc(b)}</span></div>`).join("")}</div>
  <figure class="dg">${DIAG.magellan()}<figcaption>Magellan's size under Lynch, on a log scale. The growth came from returns and from new money pouring in.</figcaption></figure>`; }
function countUp(){ if(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.querySelectorAll("[data-count]").forEach(el=>{ const to=+el.dataset.count, pre=el.dataset.pre||"", suf=el.dataset.suf||"", k=el.dataset.fmt==="k", t0=performance.now(), d=900;
    const step=now=>{ const f=Math.min(1,(now-t0)/d), v=to*(1-Math.pow(1-f,3)); el.textContent=pre+(k?Math.round(v).toLocaleString("en-US"):v.toFixed(1))+suf; if(f<1) requestAnimationFrame(step); }; requestAnimationFrame(step); }); }

/* Lynch diagrams */
Object.assign(DIAG, {
  lag(){ const rows=[["You and other customers",0],["Staff and suppliers",40],["Local news, small funds",120],["Wall Street analysts",200],["Big institutions",265]]; let b="";
    rows.forEach(([l,x],i)=>{ const y=i*34; b+=T(x,y+12,l,"s b")+`<rect x="${x}" y="${y+16}" width="${392-x}" height="10" rx="5" class="${i===0?"acc":"soft"} gx" ${delay(i,.15)}/>`; });
    b+=`<path d="M0 178 H390" class="ln"/><path d="M382 173 l8 5 l-8 5" class="ln"/>`+T(0,194,"time →","s");
    return svg(198,b); },
  declines(){ let b=""; for(let i=0;i<53;i++){ const r=Math.floor(i/11), c=i%11, big=i<15; b+=`<circle cx="${18+c*33}" cy="${16+r*28}" r="${big?10:8}" class="${big?"acc":"soft"} pp" ${delay(i,.02)}/>`; }
    b+=T(0,166,"53 falls of 10% or more","b")+T(0,184,"15 of them 25% or more (darker)","s");
    return svg(190,b); },
  backyard(){ const pts=[["Home",70,34],["Work",330,34],["Shops",70,124],["Hobbies",330,124]]; let b="";
    pts.forEach(([l,x,y],i)=>{ b+=`<line x1="${x}" y1="${y}" x2="200" y2="79" class="ln dr" pathLength="1000" ${delay(i,.1)}/><rect x="${x-46}" y="${y-15}" width="92" height="30" rx="15" class="soft pp" ${delay(i,.1)}/>`+T(x,y+5,l,"b","middle"); });
    b+=`<circle cx="200" cy="79" r="30" class="acc pp" style="animation-delay:.5s"/>`+T(200,84,"Ideas","b w","middle");
    b+=`<path d="M200 110 V146" class="ln"/><path d="M194 140 l6 7 l6 -7" class="ln"/><rect x="60" y="150" width="280" height="30" rx="8" class="ol fd" style="animation-delay:.8s"/>`+T(200,170,"Then homework: earnings, debt, price","b","middle");
    return svg(186,b); },
  kinds(){ const sc=9; let b=`<line x1="110" y1="4" x2="110" y2="104" class="lr"/>`; const rows=[["Slow grower",2,4],["Stalwart",10,12],["Fast grower",20,25]];
    rows.forEach(([l,a,z],i)=>{ const y=10+i*32; b+=T(102,y+13,l,"b","end")+`<rect x="110" y="${y}" width="${a*sc}" height="18" class="soft gx" ${delay(i)}/><rect x="${110+a*sc}" y="${y}" width="${(z-a)*sc}" height="18" class="acc gx" ${delay(i+.4)}/>`+T(116+z*sc,y+14,a+"–"+z+"%","s b"); });
    b+=T(110,118,"earnings growth a year","s");
    const ic=[["Cyclical","M10 18 Q30 -6 50 18 T90 18"],["Turnaround","M10 2 L50 30 L90 4"],["Asset play","M20 4 H80 V32 H20 Z"]];
    ic.forEach(([l,d],i)=>{ const x=i*134; b+=`<g transform="translate(${x+18},136)"><path d="${d}" class="la dr" pathLength="1000" ${delay(i+2)}/>${l==="Asset play"?`<circle cx="50" cy="18" r="6" class="acc"/>`:""}</g>`+T(x+68,190,l,"b","middle"); });
    return svg(196,b); },
  earnings(){ let e="M10 150", p="M10 158", ey=150; for(let i=1;i<=38;i++){ const x=10+i*10; ey=150-i*3.1; e+=` L${x} ${ey.toFixed(1)}`; p+=` L${x} ${(ey+Math.sin(i*0.9)*16+Math.cos(i*0.37)*10).toFixed(1)}`; }
    const b=`<line x1="10" y1="160" x2="392" y2="160" class="lr"/><path d="${p}" class="ln dr" pathLength="1000" style="stroke-width:1.6"/><path d="${e}" class="la dr" pathLength="1000" style="animation-delay:.3s"/>`+T(14,20,"Earnings","b a")+T(14,38,"Share price","s")+`<line x1="80" y1="16" x2="104" y2="16" class="la"/><line x1="80" y1="34" x2="104" y2="34" class="ln"/>`;
    return svg(166,b); },
  peg(){ const X=v=>10+v/3*380; let b=`<rect x="${X(0)}" y="40" width="${X(.5)-X(0)}" height="22" class="acc gx"/><rect x="${X(.5)}" y="40" width="${X(1)-X(.5)}" height="22" class="soft gx" style="animation-delay:.15s"/><rect x="${X(1)}" y="40" width="${X(2)-X(1)}" height="22" class="ol gx" style="animation-delay:.3s"/><rect x="${X(2)}" y="40" width="${X(3)-X(2)}" height="22" class="bad gx" style="animation-delay:.45s"/>`;
    [[0.5,"half"],[1,"equal"],[2,"double"]].forEach(([v,l])=>{ b+=`<line x1="${X(v)}" y1="34" x2="${X(v)}" y2="68" class="ln"/>`+T(X(v),28,l,"s b","middle"); });
    b+=T(X(.25),86,"very attractive","s","middle")+T(X(.75),86,"fair","s","middle")+T(X(1.5),86,"getting dear","s","middle")+T(X(2.5),86,"very unattractive","s","middle")+T(10,108,"P/E compared with the growth rate","s b");
    return svg(114,b); },
  debtcash(){ let b=`<line x1="10" y1="80" x2="390" y2="80" class="lr"/>`;
    b+=`<rect x="70" y="80" width="80" height="60" class="bad gyt"/>`+T(110,160,"Company A","b","middle")+T(110,176,"$300M of debt","s","middle");
    b+=`<rect x="250" y="${80-40}" width="80" height="40" class="acc gy" style="animation-delay:.3s"/>`+T(290,30,"$200M cash, no debt","s b","middle")+T(290,100,"Company B","b","middle");
    b+=T(200,16,"Both are losing money","b","middle");
    return svg(182,b); },
  clock(){ const cx=200, cy=92, r=70; const arc=(a0,a1)=>{ const p=a=>[cx+r*Math.sin(a*Math.PI/180), cy-r*Math.cos(a*Math.PI/180)]; const [x0,y0]=p(a0), [x1,y1]=p(a1); return `M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z`; };
    let b=`<path d="${arc(0,120)}" class="acc pp"/><path d="${arc(120,240)}" class="soft pp" style="animation-delay:.15s"/><path d="${arc(240,360)}" class="ol pp" style="animation-delay:.3s"/><circle cx="${cx}" cy="${cy}" r="24" class="card"/>`+T(cx,cy+5,"2:00","b","middle");
    b+=T(cx+82,48,"1. Why I'm","s b")+T(cx+82,62,"interested","s b")+T(cx+30,182,"2. What has to happen","s b","middle")+T(cx-82,48,"3. What could","s b","end")+T(cx-82,62,"go wrong","s b","end");
    return svg(190,b); },
  asym(){ const z=60, sc=0.36; let b=`<line x1="${z}" y1="4" x2="${z}" y2="96" class="lr"/>`;
    b+=T(z+4,18,"Worst case, any stock","s b")+`<rect x="${z-100*sc*0.15}" y="24" width="${100*sc*0.15}" height="18" class="bad gxr"/>`+T(z+8,38,"−100%","b");
    b+=T(z+4,64,"A ten-bagger","s b")+`<rect x="${z}" y="70" width="${900*sc}" height="18" class="acc gx" style="animation-delay:.3s"/>`+T(z+900*sc-6,84,"+900%","b w","end");
    return svg(100,b); },
  highlow(){ const sc=28; let b=""; [["Every year at the high",10.6,"soft"],["Every year at the low",11.7,"acc"]].forEach(([l,v,c],i)=>{ const y=i*46; b+=T(0,y+13,l,"s b")+`<rect x="0" y="${y+18}" width="${v*sc}" height="18" class="${c} gx" ${delay(i,.3)}/>`+T(v*sc+6,y+32,v+"% a year","b"); }); return svg(92,b); },
  stages(){ const d="M10 160 C 120 158, 150 30, 250 30 S 380 28, 392 28"; let b=`<path d="${d}" class="la dr" pathLength="1000"/>`;
    [["Start-up",30,150],["Fast growth",165,90],["Maturity",270,22],["Saturation",345,22]].forEach(([l,x,y],i)=>{ b+=`<circle cx="${x}" cy="${i===0?156:i===1?96:30}" r="5" class="card pp" stroke="var(--accent)" stroke-width="2" ${delay(i+2,.15)}/>`+T(x,y-(i>1?0:8)+(i>1?-8:0),l,"s b","middle"); });
    b+=T(10,186,"Which stage is your company in now?","s");
    return svg(192,b); },
  magellan(){ const pts=LY().magellan, X=y=>64+(y-1977)/13*320, Y=v=>150-(Math.log10(v*1000)-1)/(Math.log10(14000)-1)*126;
    let b=""; [[0.1,"$100M"],[1,"$1B"],[10,"$10B"]].forEach(([v,l])=>{ b+=`<line x1="62" y1="${Y(v).toFixed(1)}" x2="392" y2="${Y(v).toFixed(1)}" class="lr"/>`+T(56,Y(v)+4,l,"s","end"); });
    const d=pts.map((p,i)=>(i?"L":"M")+X(p[0]).toFixed(1)+" "+Y(p[1]).toFixed(1)).join(" ");
    b+=`<path d="${d}" class="la dr" pathLength="1000" style="stroke-width:3"/>`;
    const lab=[[10,12,"start"],[10,20,"start"],[-12,-10,"end"]], val=["$18–20M","$1B","$14B"];
    pts.forEach((p,i)=>{ const x=X(p[0]), y=Y(p[1]); b+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" class="acc pp" ${delay(i+2,.25)}/>`+T((x+lab[i][0]).toFixed(1),(y+lab[i][1]).toFixed(1),p[2].split(":")[0]+" · "+val[i],"s b",lab[i][2]); });
    return svg(160,b); },
});

/* ================= TIMELINE: Intersection of Lives ================= */
let TL = D.timeline;
const TLO = ["M","B","L"];   /* three slots; each country's timeline puts its own three people in them */
let TLP = {}; TL.people.forEach(p=>{ TLP[p.id]=p; });
/* switch between the USA and UK timelines */
function tlUse(k){ const T = k==="uk" && D.timelineUK ? D.timelineUK : D.timeline; document.documentElement.dataset.tl=T.labels.country; if(TL===T) return;
  TL=T; TLP={}; TL.people.forEach(p=>{ TLP[p.id]=p; }); SKYC=null; tiv.c=null;
  TLS.t=TL.labels.skyT; TLS.lastY=null; TLS.q={order:null,i:0,pick:null,right:0,n:0}; TLS.pop=null;
  TIS.v=TL.invest[0].k; TIS.y0=TL.invest[0].s; TIS.mode="setup"; TIS.path=null; TIS.log=[]; TIS.played=false; }
const tlDeathAge = p => p.died[0]-p.by-((p.died[1]<p.bm||(p.died[1]===p.bm&&p.died[2]<p.bd))?1:0);
function tlLegend(extra){ return TLO.map(id=>`<span class="lg"><i class="d${id}"></i>${esc(TLP[id].short)}</span>`).join("")+(extra?`<span class="lg">${extra}</span>`:""); }
const TLS = {t:D.timeline.labels.skyT, lastY:null, playing:false, raf:0, last:0, acc:0, age:33, pop:null, q:{order:null,i:0,pick:null,right:0,n:0}};
const TKIND = {mkt:"Markets", pol:"Politics", cul:"Culture", tech:"Science & tech", world:"World"};
const TLRM = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const IC_T = {
  sky:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.8"/><ellipse cx="12" cy="12" rx="9.6" ry="4.3" transform="rotate(-24 12 12)"/><circle cx="19.4" cy="8.4" r="1.3"/></svg>',
  years:'<svg viewBox="0 0 24 24"><path d="M6 4v16M6 7h12M6 12h8M6 17h11"/></svg>',
  lives:'<svg viewBox="0 0 24 24"><path d="M6 3v18M12 5v16M18 9v12"/><path d="M6 8q3 2 6 0M12 15q3 2 6 0"/></svg>',
  age:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1.6"/><path d="M12 6.5a5.5 5.5 0 1 1-5.5 5.5M12 3a9 9 0 0 1 9 9"/></svg>',
  storms:'<svg viewBox="0 0 24 24"><path d="M13.5 3 5.5 13.5h5.5L10 21l8.5-11h-5.6z"/></svg>',
};
const tlH = v => "#timeline"+(TL.labels.country==="uk"?"-uk":"")+(v?"-"+v:"");
const tlAge = (id,y) => y - TLP[id].by;
const tlBorn = (id,y) => y >= TLP[id].by;
const tlGone = (id,y) => !!TLP[id].died && y > TLP[id].died[0];
const tlPct = v => (v>0?"+":v<0?"−":"")+Math.abs(v).toFixed(1)+"%";
function tlStage(id,y){ const a=TL.stages[id]; for(let i=a.length-1;i>=0;i--){ if(y>=a[i].a && y<=a[i].b) return a[i]; } return null; }
function tlTerm(list,y){ return list.filter(x=>x.a[0]<=y && (x.b[0]>y || (x.b[0]===y && x.b[1]>1))).map(x=>x.n); }
function tlEra(y){ return TL.eras.find(e=>y>=e.a && y<=e.b) || TL.eras[TL.eras.length-1]; }
function tlT0(id){ const p=TLP[id]; return p.by + (p.bm-1)/12 + (p.bd-1)/365; }
function tlT1(id){ const p=TLP[id]; return p.died ? p.died[0]+(p.died[1]-1)/12+(p.died[2]-1)/365 : TL.end + 10.6/12; }
function tlRange(a,b){ const o=[]; for(let y=a;y<=b;y++) o.push(y); return o; }

/* ---------- small building blocks ---------- */
function tlItem(e){ return `<li class="${e.b?"big":""}">${e.m?`<span class="tm">${esc(e.m)}</span>`:""}${e.k?`<span class="tk k-${e.k}">${TKIND[e.k]}</span>`:""}<span class="tx">${esc(e.t)}</span></li>`; }
function tlAges(y, cls){ return `<div class="tages ${cls||""}">${TLO.map(id=>{ const p=TLP[id]; let v;
    if(!tlBorn(id,y)) v='<i>not born</i>'; else if(tlGone(id,y)) v=`<i>${p.by}–${p.died[0]}</i>`; else { const a=tlAge(id,y); v = a===0 ? '<b>born</b>' : `<b>${a}</b>`; }
    return `<span class="ta a${id}"><span class="tn">${esc(p.short)}</span>${v}</span>`; }).join("")}</div>`; }
function tlLane(id,y,full){ const p=TLP[id];
  if(!tlBorn(id,y)) return "";
  const ev=TL.years[y][id]||[], gone=tlGone(id,y); if(gone && !ev.length) return "";
  const st=gone?null:tlStage(id,y), a=tlAge(id,y), who=gone?`died ${p.died[0]}, remembered`:`${a===0?"born":"age "+a}${st?" · "+esc(st.l):""}`;
  if(!full && !ev.length) return `<div class="lane l${id} quiet"><span class="dot"></span><b>${esc(p.short)}</b><span class="lw">${who}</span></div>`;
  return `<div class="lane l${id}"><div class="lh"><span class="dot"></span><b>${esc(p.short)}</b><span class="lw">${who}</span></div>${ev.length?`<ul class="tev">${ev.map(tlItem).join("")}</ul>`:(full&&st?`<p class="small muted">${esc(st.d)}</p>`:"")}</div>`; }
function tlLaneW(y){ const ev=TL.years[y].W||[]; return ev.length ? `<div class="lane lW"><div class="lh"><span class="dot"></span><b>${esc(TL.labels.world)}</b></div><ul class="tev">${ev.map(tlItem).join("")}</ul></div>` : ""; }
function tlMkt(y){ const o=[], s=TL.mkt[y], c=v=>v>=0?"up":"dn";
  if(s!==undefined) o.push(`<span class="mk">${esc(TL.labels.mkt)} <b class="${c(s)}">${tlPct(s)}</b></span>`); else if(y===TL.end && TL.labels.country==="usa") o.push(`<span class="mk">S&amp;P 500 <b class="up">≈ +10% so far</b></span>`);
  TL.funds.forEach(f=>{ const d=f.data[y]; if(d) o.push(`<span class="mk m${f.c}">${esc(f.chip)} <b class="${c(d[0])}">${tlPct(d[0])}</b></span>`); });
  return o.length ? `<div class="mkts">${o.join("")}</div>` : ""; }
function tlPulse(y){ const rows=[], s=TL.mkt[y], L=TL.labels;
  if(s!==undefined) rows.push([esc(L.mktLong), s, null, "W"]);
  TL.funds.forEach(f=>{ const d=f.data[y]; if(d) rows.push([esc(f.row), d[0], [esc(f.bench), d[1]], f.c]); });
  const head=`<div class="box-h">Market pulse, ${y}</div>`;
  if(!rows.length) return `<div class="pulse">${head}<p class="small">${y===TL.end?esc(TL.mktNow):esc(L.mktStart)}</p></div>`;
  const mx=Math.max(40, ...rows.map(r=>Math.abs(r[1])), ...rows.filter(r=>r[2]).map(r=>Math.abs(r[2][1])));
  const bar=(v,c)=>`<span class="pbar"><i class="${v>=0?"up":"dn"} c${c}" style="${v>=0?"left:50%":"right:50%"};width:${(Math.abs(v)/mx*50).toFixed(1)}%"></i></span>`;
  return `<div class="pulse">${head}${rows.map(([l,v,cmp,c])=>`<div class="pr"><div class="pl"><span>${l}</span><b class="${v>=0?"up":"dn"}">${tlPct(v)}</b></div>${bar(v,c)}${cmp?`<div class="small muted">${cmp[0]}: ${tlPct(cmp[1])}</div>`:""}</div>`).join("")}
    <p class="note">${esc(L.pulseNote)}</p></div>`; }
function tlSrc(years){ const keys=new Set(); years.forEach(y=>TLO.forEach(id=>(TL.years[y][id]||[]).forEach(e=>{ if(e.s) keys.add(e.s); })));
  if(!keys.size) return "";
  return `<div class="tsrc"><div class="box-h">Sources</div>${Array.from(keys).map(k=>{ const s=TL.sources[k]; return s.u?`<a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.l)}</a>`:`<span>${esc(s.l)}</span>`; }).join("")}<span class="note">${esc(TL.labels.worldShort||"World")} and world events: the standard historical record.</span></div>`; }
function tlCard(y){ const th=TL.threads[y];
  return `<article class="ycard" id="y${y}"><a class="yh" href="${tlH("y-"+y)}"><span class="yn">${y}</span><span class="yo">Open ›</span></a>${tlAges(y,"sm")}
  ${th?`<p class="thread">${esc(th)}</p>`:""}<div class="lanes">${TLO.map(id=>tlLane(id,y,false)).join("")}${tlLaneW(y)}</div>${tlMkt(y)}</article>`; }
function tlSpark(years, big){ const n=years.length, w=big?360:120, h=big?54:30, bw=w/n, mid=h/2, mx=55;
  const bars=years.map((y,i)=>{ const v=TL.mkt[y]; if(v===undefined) return ""; const bh=Math.max(1, Math.min(mx,Math.abs(v))/mx*(mid-2)); return `<rect x="${(i*bw+bw*.15).toFixed(1)}" y="${(v>=0?mid-bh:mid).toFixed(1)}" width="${(bw*.7).toFixed(1)}" height="${bh.toFixed(1)}" class="${v>=0?"up":"dn"}"/>`; }).join("");
  return `<svg class="spark${big?" big":""}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><line x1="0" x2="${w}" y1="${mid}" y2="${mid}" class="mid"/>${bars}</svg>${big?`<p class="note">Bars: ${esc(TL.labels.mktLong)}, in each year of the chapter.</p>`:""}`; }

/* ---------- the time machine (sky) ---------- */
const SKY = {c:200, r0:24, k:1.66};
function skyXY(t,age){ const th=((t-1920)*36-90)*Math.PI/180, r=SKY.r0+age*SKY.k; return [SKY.c+r*Math.cos(th), SKY.c+r*Math.sin(th), th]; }
let SKYC = null;
function skyCache(){ if(SKYC) return SKYC; SKYC={};
  TLO.forEach(id=>{ const b=tlT0(id), e=tlT1(id), pts=[], cum=[0]; let L=0;
    for(let t=b; t<=e+1e-9; t+=0.1){ const p=skyXY(t,t-b); if(pts.length){ const q=pts[pts.length-1]; L+=Math.hypot(p[0]-q[0],p[1]-q[1]); cum.push(L); } pts.push(p); }
    SKYC[id]={b,e,cum,L,d:"M"+pts.map(p=>p[0].toFixed(1)+" "+p[1].toFixed(1)).join("L")}; });
  return SKYC; }
const SKYOFF = {M:6, B:-6, L:6};
function skyPlanet(id,t){ const C=skyCache()[id], [x,y,th]=skyXY(t,t-C.b), o=SKYOFF[id]; return [x - Math.sin(th)*o, y + Math.cos(th)*o]; }
function tlSkySVG(){ const C=skyCache(), t=TLS.t;
  let s=`<svg viewBox="0 0 400 400" class="sky" role="img" aria-label="Time machine: three lives spiralling out from the sun as the years pass">
  <defs><radialGradient id="sunG"><stop offset="0" stop-color="#fff7dc"/><stop offset=".55" stop-color="#f6c45f"/><stop offset="1" stop-color="#de7f37"/></radialGradient>
  <radialGradient id="glowG"><stop offset="0" stop-color="#f6c45f" stop-opacity=".55"/><stop offset="1" stop-color="#f6c45f" stop-opacity="0"/></radialGradient>
  <radialGradient id="discG"><stop offset="0" stop-color="#1b2150" stop-opacity=".85"/><stop offset="1" stop-color="#070a1f" stop-opacity="0"/></radialGradient>
  <linearGradient id="handG" gradientUnits="userSpaceOnUse" x1="200" y1="200" x2="200" y2="4"><stop offset="0" stop-color="#ffe7a8" stop-opacity=".95"/><stop offset="1" stop-color="#ffe7a8" stop-opacity=".05"/></linearGradient>
  <linearGradient id="cometG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff8a7a" stop-opacity="0"/><stop offset="1" stop-color="#ffd2c8" stop-opacity=".95"/></linearGradient></defs>
  <circle cx="200" cy="200" r="199" fill="url(#discG)"/>`;
  [25,50,75,100].forEach(a=>{ const r=SKY.r0+a*SKY.k; s+=`<circle cx="200" cy="200" r="${r.toFixed(1)}" class="ring"/><text x="${(200+r*0.707+3).toFixed(1)}" y="${(200+r*0.707+3).toFixed(1)}" class="rl">${a}</text>`; });
  for(let i=0;i<10;i++){ const th=(i*36-90)*Math.PI/180; s+=`<line x1="${(200+186*Math.cos(th)).toFixed(1)}" y1="${(200+186*Math.sin(th)).toFixed(1)}" x2="${(200+194*Math.cos(th)).toFixed(1)}" y2="${(200+194*Math.sin(th)).toFixed(1)}" class="tick"/>`; }
  TLO.forEach(id=>{ s+=`<path d="${C[id].d}" class="trf t${id}"/>`; });
  TLO.forEach(id=>{ s+=`<path id="tr${id}" d="${C[id].d}" class="trl t${id}" stroke-dasharray="0 ${Math.ceil(C[id].L+10)}"/>`; });
  const [mx,my]=skyXY(C.M.e, C.M.e-C.M.b);
  s+=`<g id="memM" class="mem" style="opacity:0"><circle cx="${mx.toFixed(1)}" cy="${my.toFixed(1)}" r="9" class="mh"/><path d="M${mx.toFixed(1)} ${(my-6).toFixed(1)}l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6z" class="ms"/></g>`;
  s+=`<line id="tlHand" x1="200" y1="200" x2="200" y2="6" class="hand"/>`;
  s+=`<circle cx="200" cy="200" r="38" fill="url(#glowG)" class="sunglow"/><circle cx="200" cy="200" r="21" fill="url(#sunG)"/><text id="tlSunY" x="200" y="204" class="suny">${Math.floor(t)}</text>`;
  TLO.forEach(id=>{ s+=`<g id="pl${id}" class="pl p${id}" style="opacity:0"><circle class="flash" r="8"/><circle class="halo" r="12"/><circle class="core" r="7"/><text class="pi" y="2.8">${esc(TLP[id].ini||id)}</text></g>`; });
  s+=`<g id="tlComet" class="comet"><path d="M392 18 L262 148" class="ctail"/><circle cx="262" cy="148" r="3.2" class="chead"/></g><text id="tlCometL" x="8" y="392" class="cl"></text>`;
  return s+`</svg>`; }
function tlSkyUpdate(){ const svg=document.querySelector("svg.sky"); if(!svg) return; const C=skyCache(), t=TLS.t, y=Math.floor(t);
  const th=((t-1920)*36-90)*Math.PI/180, hand=document.getElementById("tlHand");
  hand.setAttribute("x2",(200+192*Math.cos(th)).toFixed(1)); hand.setAttribute("y2",(200+192*Math.sin(th)).toFixed(1));
  document.getElementById("tlSunY").textContent=y;
  TLO.forEach(id=>{ const c=C[id], g=document.getElementById("pl"+id), tr=document.getElementById("tr"+id);
    if(t<c.b){ g.style.opacity=0; tr.setAttribute("stroke-dasharray","0 "+Math.ceil(c.L+10)); return; }
    const i=Math.min(c.cum.length-1, Math.max(0, Math.round((Math.min(t,c.e)-c.b)/0.1)));
    tr.setAttribute("stroke-dasharray", c.cum[i].toFixed(1)+" "+Math.ceil(c.L+10));
    if(t>c.e){ g.style.opacity=0; return; }
    const [px,py]=skyPlanet(id,t); g.setAttribute("transform",`translate(${px.toFixed(1)} ${py.toFixed(1)})`); g.style.opacity=1;
    g.classList.toggle("born", y===TLP[id].by); });
  document.getElementById("memM").style.opacity = t>C.M.e ? 1 : 0;
  const st=TL.storms.find(s=>y>=s.years[0] && y<=s.years[1]), cm=document.getElementById("tlComet");
  cm.classList.toggle("on", !!st); document.getElementById("tlCometL").textContent = st ? "☄ "+st.name : "";
  if(y!==TLS.lastY){ TLS.lastY=y; const n=document.getElementById("tlNow"); if(n) n.innerHTML=tlNowCard(y); const r=document.getElementById("tlRange"); if(r && +r.value!==y) r.value=y; } }
function tlNowCard(y){ const era=tlEra(y);
  const row=id=>{ const p=TLP[id]; let body;
    if(!tlBorn(id,y)) body=`<span class="muted">Not born yet (born ${p.by}).</span>`;
    else if(tlGone(id,y)) body=`<span class="muted">Died in ${p.died[0]}, aged ${tlDeathAge(p)}.</span>`;
    else { const ev=TL.years[y][id]||[], e=ev.find(x=>x.b)||ev[0], st=tlStage(id,y), a=tlAge(id,y);
      body=`<span class="na">${a===0?"Born this year":"Age "+a}${st?" · "+esc(st.l):""}</span>${e?`<span>${esc(e.t)}</span>`:""}`; }
    return `<div class="nr a${id}"><span class="dot"></span><div><b>${esc(p.short)}</b>${body}</div></div>`; };
  const wv=TL.years[y].W||[], w=wv.find(x=>x.b)||wv[0];
  return `<div class="now"><div class="now-h"><span class="now-y">${y}</span><span class="small">${esc(era.title)}</span></div>
    ${TLO.map(row).join("")}${w?`<div class="nr aW"><span class="dot"></span><div><b>The world</b><span>${esc(w.t)}</span></div></div>`:""}
    <a class="btn" href="${tlH("y-"+y)}">Open ${y} in full</a></div>`; }
function tlSetT(t){ TLS.t=Math.max(TL.start+0.02, Math.min(TL.end+0.88, t)); tlSkyUpdate(); }
function tlPlay(){ if(TLS.playing){ tlStop(); return; }
  if(TLS.t>=TL.end+0.85) TLS.t=TL.start+0.02;
  TLS.playing=true; TLS.last=performance.now(); TLS.acc=0; const b=document.getElementById("tlPlay"); if(b) b.textContent="❚❚ Pause";
  const step=now=>{ if(!TLS.playing) return; const dt=Math.min(0.1,(now-TLS.last)/1000); TLS.last=now;
    if(TLRM){ TLS.acc+=dt; if(TLS.acc>=0.6){ TLS.acc=0; tlSetT(Math.floor(TLS.t)+1.5); } } else tlSetT(TLS.t+dt*1.8);
    if(TLS.t>=TL.end+0.85){ tlStop(); return; } TLS.raf=requestAnimationFrame(step); };
  TLS.raf=requestAnimationFrame(step); }
function tlStop(){ TLS.playing=false; cancelAnimationFrame(TLS.raf); const b=document.getElementById("tlPlay"); if(b) b.textContent="▶ Play"; }
function vTSky(){ const y=Math.floor(TLS.t); TLS.lastY=null;
  const xs=[1959,1972,1989].map(yy=>TL.crossings.find(c=>c.y===yy)).filter(Boolean);
  return `<div class="tl-hero"><span class="eyebrow">Timeline · ${TL.start} to today</span><h2>Intersection of Lives</h2>
    <p class="lede">Three investors, one century. Press play or drag the years: the bright hand is the year, and each life spirals out from the sun as it ages.</p></div>
  <figure class="tl-sky">${tlSkySVG()}
    <figcaption><span class="lg"><i class="dM"></i>Munger</span><span class="lg"><i class="dB"></i>Buffett</span><span class="lg"><i class="dL"></i>Lynch</span><span class="lg">Rings: age 25, 50, 75, 100</span></figcaption></figure>
  <div class="tl-ctrl"><button class="ab" data-tlstep="-1" aria-label="One year back">◀ 1 yr</button><button class="btn" id="tlPlay">${TLS.playing?"❚❚ Pause":"▶ Play"}</button><button class="ab" data-tlstep="1" aria-label="One year forward">1 yr ▶</button></div>
  <input type="range" id="tlRange" class="tlrange" min="${TL.start}" max="${TL.end}" step="1" value="${y}" aria-label="Choose a year">
  <div class="chips tjump">${[1924,1930,1944,1959,1965,1977,1987,2008,2023,2026].map(v=>`<button data-tljump="${v}">${v}</button>`).join("")}</div>
  <div id="tlNow">${tlNowCard(y)}</div>
  <h3>Four numbers that frame the century</h3><div class="tstats">${TL.longRun.map(([a,b])=>`<div class="stat"><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("")}</div>
  <h3>Where their lives crossed</h3>${xs.map(c=>`<a class="xcard" href="${tlH("y-"+c.y)}"><span class="xy">${esc(c.lab)}</span><span><b>${esc(c.t)}</b><span class="small muted">${esc(c.d)}</span></span></a>`).join("")}
  <a class="btn ghost" href="${tlH("lives")}">All ${TL.crossings.length} crossings, on the lifelines</a>
  <h3>Explore</h3><div class="tiles ttiles">
    <a class="tile" href="${tlH("eras")}"><span class="ic">${IC_T.years}</span><span>Read the century year by year</span></a>
    <a class="tile" href="${tlH("lives")}"><span class="ic">${IC_T.lives}</span><span>Follow three lifelines</span></a>
    <a class="tile" href="${tlH("age")}"><span class="ic">${IC_T.age}</span><span>Compare them at the same age</span></a>
    <a class="tile" href="${tlH("storms")}"><span class="ic">${IC_T.storms}</span><span>See what each did in every crash</span></a>
    <a class="tile" href="${tlH("invest")}"><span class="ic">$</span><span>Invest with them: could you have held?</span></a>
    <a class="tile" href="${tlH("quiz")}"><span class="ic">?</span><span>Quiz: who, when?</span></a>
    <a class="tile" href="${tlH("about")}"><span class="ic">ⓘ</span><span>How this was checked</span></a></div>
  <h3>How to read it</h3>${bl(["Each colour is one life: Munger (periwinkle), Buffett (green), Lynch (cyan). Gold is America and the world.","Ages are the age each man reaches that year.","Every fact was checked against its source; tap any year for the sources used."])}`; }

/* ---------- years: chapters ---------- */
function tlEraAges(e){ return TLO.map(id=>{ const p=TLP[id], last=p.died?p.died[0]:TL.end; let t;
    if(e.b<p.by) t="not born"; else if(e.a>last) t="–"; else { const a0=e.a-p.by, a1=Math.min(e.b,last)-p.by; t = a0<0 ? `born ${p.by}, to ${a1}` : `${a0} to ${a1}`; }
    return `<span class="ta a${id}"><span class="tn">${esc(p.short)}</span><b>${t}</b></span>`; }).join(""); }
function vTEras(){ return `<span class="eyebrow">Timeline · Years</span><h2>A century in eleven chapters</h2>
  <p class="lede">Open a chapter to read it year by year, or jump straight to any year from ${TL.start} to ${TL.end}.</p>
  <div class="jump"><label class="lbl" for="tlYearSel">Jump to a year</label><select id="tlYearSel"><option value="">Choose a year</option>${tlRange(TL.start,TL.end).reverse().map(y=>`<option value="${y}">${y}</option>`).join("")}</select></div>
  <div class="eras">${TL.eras.map(e=>`<a class="era" href="${tlH("era-"+e.n)}"><span class="en">${e.n}</span><span class="eb"><span class="ey">${e.a}–${e.b}</span><span class="et">${esc(e.title)}</span><span class="small muted">${esc(e.tag)}</span><span class="tages sm">${tlEraAges(e)}</span>${tlSpark(tlRange(e.a,e.b))}</span></a>`).join("")}</div>`; }
function vTEra(n){ const e=TL.eras.find(x=>x.n===n)||TL.eras[0], yrs=tlRange(e.a,e.b);
  const prev=e.n>1?[tlH("era-"+(e.n-1)), TL.eras[e.n-2].title]:null, next=e.n<TL.eras.length?[tlH("era-"+(e.n+1)), TL.eras[e.n].title]:null;
  return `<span class="eyebrow">Chapter ${e.n} of ${TL.eras.length} · ${e.a}–${e.b}</span><h2>${esc(e.title)}</h2><p class="lede">${esc(e.intro)}</p>
  <div class="where">${TLO.map(id=>`<div class="wr a${id}"><span class="dot"></span><b>${esc(TLP[id].short)}</b><span>${esc(e.where[id])}</span></div>`).join("")}</div>
  ${tlSpark(yrs,true)}${yrs.map(tlCard).join("")}${tlSrc(yrs)}${pager(prev,next)}`; }
function tlDecade(y){ const d=Math.floor(y/10)*10, ys=tlRange(Math.max(TL.start,d), Math.min(TL.end,d+9));
  return `<div class="ydec">${d-1>=TL.start?`<a href="${tlH("y-"+(d-1))}" class="yd nav">‹ ${d-10}s</a>`:""}${ys.map(v=>`<a href="${tlH("y-"+v)}" class="yd${v===y?" on":""}">${v}</a>`).join("")}${d+10<=TL.end?`<a href="${tlH("y-"+(d+10))}" class="yd nav">${d+10}s ›</a>`:""}</div>`; }
function vTYear(y){ if(!(y>=TL.start && y<=TL.end)) y=TL.end;
  const era=tlEra(y), pres=tlTerm(TL.presidents,y).join(" → "), fed=tlTerm(TL.fed,y).join(" → "), th=TL.threads[y], cr=TL.crossings.filter(c=>c.y===y);
  const prev=y>TL.start?[tlH("y-"+(y-1)), String(y-1)]:null, next=y<TL.end?[tlH("y-"+(y+1)), String(y+1)]:null;
  return `<div class="tl-yhero"><a class="eyebrow" href="${tlH("era-"+era.n)}">Chapter ${era.n} · ${esc(era.title)}</a><h2 class="ybig">${y}</h2>${tlAges(y)}
    <p class="small ymeta">President: ${esc(pres)}${fed?`<br>Fed chair: ${esc(fed)}`:""}</p></div>
  ${tlDecade(y)}
  ${th?`<p class="thread">${esc(th)}</p>`:""}
  <div class="lanes full">${TLO.map(id=>tlLane(id,y,true)).join("")}${tlLaneW(y)}</div>
  ${cr.map(c=>`<div class="cross"><div class="box-h">Where their lives crossed</div><b>${esc(c.t)}</b><p class="small">${esc(c.d)}</p></div>`).join("")}
  ${tlPulse(y)}${tlSrc([y])}
  <div class="row"><a class="btn" href="${tlH()}" data-tlgo="${y}">See ${y} in the time machine</a><a class="btn ghost" href="${tlH("era-"+era.n)}">The whole chapter</a></div>
  ${pager(prev,next)}`; }

/* ---------- lives: three lifelines ---------- */
const LV = {top:22, k:9, x:{M:96,B:200,L:304}};
const lvY = t => LV.top + (t-TL.start)*LV.k;
function tlSplit(l){ if(l.length<=12) return [l]; const w=l.split(" "); let a="", b=""; w.forEach(x=>{ if(!b && (a+" "+x).trim().length<=12) a=(a+" "+x).trim(); else b=(b+" "+x).trim(); }); return b?[a,b]:[a]; }
function tlLivesSVG(){ const H=Math.ceil(lvY(TL.end+1)+30); let s=`<svg viewBox="0 0 400 ${H}" class="lives" role="img" aria-label="Three lifelines from ${TL.start} to today">`;
  TL.presidents.forEach((p,i)=>{ const a=Math.max(TL.start, p.a[0]+(p.a[1]-1)/12), b=Math.min(TL.end+1, p.b[0]+(p.b[1]-1)/12); if(b<=a) return; const y0=lvY(a), y1=lvY(b);
    s+=`<rect x="30" y="${y0.toFixed(1)}" width="370" height="${(y1-y0).toFixed(1)}" class="pband ${i%2?"o":"e"}"/>`;
    if(y1-y0>20) s+=`<text class="pres" transform="translate(42 ${((y0+y1)/2).toFixed(1)}) rotate(-90)">${esc(p.s)}</text>`; });
  for(let y=Math.ceil((TL.start+1)/10)*10;y<=TL.end-5;y+=10){ s+=`<line x1="30" x2="400" y1="${lvY(y)}" y2="${lvY(y)}" class="grid"/><text x="2" y="${lvY(y)+3}" class="dec">${y}</text>`; }
  s+=`<text x="2" y="${lvY(TL.start)+3}" class="dec">${TL.start}</text>`;
  TLO.forEach(id=>{ const x=LV.x[id], t0=tlT0(id), t1=tlT1(id), st=TL.stages[id];
    s+=`<line x1="${x}" x2="${x}" y1="${lvY(t0).toFixed(1)}" y2="${lvY(t1).toFixed(1)}" class="wl w${id}"/>`;
    st.forEach((g,i)=>{ const a=i===0?t0:g.a, b=i<st.length-1?st[i+1].a:t1, y0=lvY(a), y1=lvY(b), h=y1-y0;
      const lab = h>=20 ? tlSplit(g.l).map((ln,j,arr)=>`<text x="${x+12}" y="${((y0+y1)/2 + (j-(arr.length-1)/2)*11 + 3).toFixed(1)}" class="sl">${esc(ln)}</text>`).join("") : "";
      s+=`<g class="stg" data-tlst="${id}-${i}"><rect x="${x-14}" y="${y0.toFixed(1)}" width="${h>=20?92:28}" height="${Math.max(h,3).toFixed(1)}" class="hit"/><rect x="${x-6}" y="${(y0+0.6).toFixed(1)}" width="12" height="${Math.max(h-1.2,2).toFixed(1)}" rx="6" class="tube t${id} ${i%2?"o":"e"}"/>${lab}</g>`; });
    s+=`<circle cx="${x}" cy="${lvY(t0).toFixed(1)}" r="6" class="born b${id}"/><text x="${x}" y="${(lvY(t0)-9).toFixed(1)}" class="bl">${esc(TLP[id].short)} · ${TLP[id].by}</text>`;
    if(TLP[id].died) s+=`<path d="M${x} ${(lvY(t1)-7).toFixed(1)}l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" class="dstar"/><text x="${x}" y="${(lvY(t1)+17).toFixed(1)}" class="bl">died ${TLP[id].died[0]}</text>`;
    tlRange(TLP[id].by, TLP[id].died?TLP[id].died[0]:TL.end).forEach(y=>{ const ev=(TL.years[y][id]||[]).filter(e=>e.b); if(ev.length) s+=`<a href="${tlH("y-"+y)}" aria-label="${y}"><circle cx="${x}" cy="${lvY(y+0.5).toFixed(1)}" r="3.4" class="node n${id}"/></a>`; }); });
  TL.crossings.forEach((c,i)=>{ const a=c.who[0], b=c.who[1], xa=LV.x[a]+7, xb=LV.x[b]-7, y=lvY(c.y+0.5), xm=(xa+xb)/2;
    s+=`<g class="xing" data-tlcr="${i}"><path d="M${xa} ${y.toFixed(1)} Q${xm} ${(y-12).toFixed(1)} ${xb} ${y.toFixed(1)}" class="xl"/><path d="M${xa} ${y.toFixed(1)} Q${xm} ${(y-12).toFixed(1)} ${xb} ${y.toFixed(1)}" class="xhit"/><circle cx="${xm}" cy="${(y-6).toFixed(1)}" r="3" class="xd"/></g>`; });
  const yt=lvY(TL.end+0.88); s+=`<line x1="30" x2="400" y1="${yt.toFixed(1)}" y2="${yt.toFixed(1)}" class="today"/><text x="398" y="${(yt+13).toFixed(1)}" class="tdl">Today · ${TL.asOf}</text>`;
  return s+`</svg>`; }
function tlPopHTML(){ const P=TLS.pop; if(!P) return "";
  if(P.k==="st"){ const p=TLP[P.id], st=TL.stages[P.id][P.i], a=Math.max(st.a,p.by), b=Math.min(st.b, p.died?p.died[0]:TL.end);
    const adj=p.bm>6?1:0, g0=Math.max(0,a-p.by-adj), g1=b-p.by;
    return `<div class="tlpop" id="tlPop" role="dialog" aria-label="Life chapter"><div class="tp-h"><span class="dot d${P.id}"></span><b>${esc(p.short)}: ${esc(st.l)}</b><button class="ab" data-tlpop="x" aria-label="Close">✕</button></div>
      <div class="small muted">${a===b?a:a+"–"+b} · age ${g0}${g0===g1?"":" to "+g1}</div><p class="small">${esc(st.d)}</p><a class="btn ghost" href="${tlH("y-"+a)}">Open ${a}</a></div>`; }
  const c=TL.crossings[P.i];
  return `<div class="tlpop" id="tlPop" role="dialog" aria-label="Where their lives crossed"><div class="tp-h"><span class="xy">${esc(c.lab)}</span><b>${esc(c.t)}</b><button class="ab" data-tlpop="x" aria-label="Close">✕</button></div><p class="small">${esc(c.d)}</p><a class="btn ghost" href="${tlH("y-"+c.y)}">Open ${c.y}</a></div>`; }
function vTLives(){ return `<span class="eyebrow">Timeline · Lives</span><h2>Three lifelines</h2>
  <p class="lede">Read from top (${TL.start}) to bottom (today). Each glowing line is a life; tap a segment for that chapter of it, or a dot to open the year. The gold arcs are the moments their lives crossed.</p>
  <figure class="tl-lives">${tlLivesSVG()}<figcaption><span class="lg"><i class="dM"></i>Munger</span><span class="lg"><i class="dB"></i>Buffett</span><span class="lg"><i class="dL"></i>Lynch</span><span class="lg">Shaded bands: presidents</span></figcaption></figure>
  <h3>Where their lives crossed</h3>${TL.crossings.map(c=>`<a class="xcard" href="${tlH("y-"+c.y)}"><span class="xy">${esc(c.lab)}</span><span><b>${esc(c.t)}</b> <span class="xw">${c.who.split("").map(w=>TLP[w].short).join(" + ")}</span><span class="small muted">${esc(c.d)}</span></span></a>`).join("")}
  <h3>Their lives in chapters</h3>${TLO.map(id=>`<div class="sec lifeset a${id}"><div class="sec-h"><span class="dot"></span>${esc(TLP[id].name)}</div><p class="small muted">${esc(TLP[id].line)}</p>
    <ol class="stl">${TL.stages[id].map(g=>{ const p=TLP[id], b=Math.min(g.b, p.died?p.died[0]:TL.end); return `<li><span class="sy">${g.a===b?g.a:g.a+"–"+b}</span><span><b>${esc(g.l)}</b> <span class="small muted">${esc(g.d)}</span></span></li>`; }).join("")}</ol></div>`).join("")}
`; }

/* ---------- same age: a three-armed galaxy ---------- */
const GAL = {c:200, r0:16, k:1.72, turn:9}; const GOFF = {M:0, B:120, L:240};
function galXY(id,a){ const th=(GOFF[id]+a*GAL.turn-90)*Math.PI/180, r=GAL.r0+a*GAL.k; return [GAL.c+r*Math.cos(th), GAL.c+r*Math.sin(th)]; }
const tlLife = id => tlT1(id)-tlT0(id);
function tlGalSVG(){ let s=`<svg viewBox="0 0 400 400" class="gal" role="img" aria-label="A three-armed galaxy: each arm is a life, distance from the centre is age">
  <defs><radialGradient id="coreG"><stop offset="0" stop-color="#fff3d0"/><stop offset=".5" stop-color="#f3c969" stop-opacity=".7"/><stop offset="1" stop-color="#f3c969" stop-opacity="0"/></radialGradient></defs>`;
  [25,50,75].forEach(a=>{ const r=GAL.r0+a*GAL.k; s+=`<circle cx="200" cy="200" r="${r.toFixed(1)}" class="ring"/><text x="200" y="${(200-r-3).toFixed(1)}" class="rl" text-anchor="middle">${a}</text>`; });
  s+=`<circle cx="200" cy="200" r="34" fill="url(#coreG)"/>`;
  TLO.forEach(id=>{ const pts=[]; for(let a=0;a<=tlLife(id)+1e-9;a+=0.25) pts.push(galXY(id,a)); const d="M"+pts.map(p=>p[0].toFixed(1)+" "+p[1].toFixed(1)).join("L");
    s+=`<path d="${d}" class="arm-g a${id}"/><path d="${d}" class="arm a${id}"/>`;
    tlRange(TLP[id].by, TLP[id].died?TLP[id].died[0]:TL.end).forEach(y=>{ if((TL.years[y][id]||[]).some(e=>e.b)){ const [x,yy]=galXY(id, y-TLP[id].by+0.5); s+=`<circle cx="${x.toFixed(1)}" cy="${yy.toFixed(1)}" r="2.2" class="gstar s${id}"/>`; } });
    const [ex,ey]=galXY(id,tlLife(id)), o={M:["end",-9,3],B:["start",-4,-10],L:["start",-4,18]}[id], lx=Math.max(4,Math.min(396,ex+o[1])), ly=Math.max(10,Math.min(396,ey+o[2]));
    s+=`<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${o[0]}" class="aname n${id}">${esc(TLP[id].short)}</text>`; });
  const r=GAL.r0+TLS.age*GAL.k;
  s+=`<circle id="galRing" cx="200" cy="200" r="${r.toFixed(1)}" class="agering"/>`;
  TLO.forEach(id=>{ s+=`<g id="gp${id}" class="pl p${id}"><circle class="halo" r="12"/><circle class="core" r="7"/><text class="pi" y="2.8">${esc(TLP[id].ini||id)}</text></g>`; });
  return s+`<text id="galAge" x="200" y="205" class="gage">${TLS.age}</text></svg>`; }
function tlAgeUpdate(){ const a=TLS.age, ring=document.getElementById("galRing"); if(!ring) return;
  ring.setAttribute("r",(GAL.r0+a*GAL.k).toFixed(1));
  TLO.forEach(id=>{ const g=document.getElementById("gp"+id); if(a>tlLife(id)){ g.style.opacity=0; return; } const [x,y]=galXY(id,Math.min(a+0.5,tlLife(id))); g.setAttribute("transform",`translate(${x.toFixed(1)} ${y.toFixed(1)})`); g.style.opacity=1; });
  document.getElementById("galAge").textContent=a; const v=document.getElementById("tlAgeVal"); if(v) v.textContent="Age "+a;
  const r=document.getElementById("tlAgeRange"); if(r && +r.value!==a) r.value=a;
  document.querySelectorAll("[data-tlage]").forEach(b=>b.classList.toggle("on", +b.dataset.tlage===a));
  const c=document.getElementById("tlAgeCard"); if(c) c.innerHTML=tlAgeCard(a); }
function tlAgeCard(a){ const pre=TL.agePresets.find(p=>p[0]===a);
  const row=id=>{ const p=TLP[id], y=p.by+a; let body;
    if(p.died && y>p.died[0]) body=`<span class="muted">Died in ${p.died[0]}, aged ${tlDeathAge(p)}.</span>`;
    else if(y>TL.end) body=`<span class="muted">Not ${a} yet: he turns ${a} in ${y}.</span>`;
    else { const ev=TL.years[y][id]||[], st=tlStage(id,y);
      body=`<span class="na"><a href="${tlH("y-"+y)}">${y}</a>${st?" · "+esc(st.l):""}</span>${ev.length?`<ul class="tev">${ev.map(tlItem).join("")}</ul>`:`<span class="small muted">${st?esc(st.d):""}</span>`}`; }
    return `<div class="nr a${id}"><span class="dot"></span><div><b>${esc(p.short)}</b>${body}</div></div>`; };
  return `${pre?`<p class="spot">${esc(pre[1])}</p>`:""}<div class="now agecard">${TLO.map(row).join("")}</div>
  <p class="note">${esc(TL.labels.ageNote)}</p>`; }
function vTAge(){ return `<span class="eyebrow">Timeline · Same age</span><h2>At the same age</h2>
  <p class="lede">Each arm of this galaxy is a life, spiralling out from birth at the centre. The gold ring is one age; where it crosses an arm is where that man was at that age.</p>
  <figure class="tl-gal">${tlGalSVG()}<figcaption>${tlLegend("Small stars: turning points")}</figcaption></figure>
  <div class="tl-ctrl"><button class="ab" data-tlastep="-1" aria-label="One year younger">◀ 1</button><b id="tlAgeVal" class="agev">Age ${TLS.age}</b><button class="ab" data-tlastep="1" aria-label="One year older">1 ▶</button></div>
  <input type="range" id="tlAgeRange" class="tlrange" min="0" max="99" step="1" value="${TLS.age}" aria-label="Choose an age">
  <div class="chips tjump">${TL.agePresets.map(([a])=>`<button data-tlage="${a}" class="${a===TLS.age?"on":""}">${a}</button>`).join("")}</div>
  <div id="tlAgeCard">${tlAgeCard(TLS.age)}</div>`; }

/* ---------- storms ---------- */
function vTStorms(){ return `<span class="eyebrow">Timeline · Storms</span><h2>Every storm, and what each of them did</h2>
  <p class="lede">${TL.storms.length} market storms, and the same question each time: where were ${TLO.map(id=>esc(TLP[id].short)).join(", ")}, and what did they do?</p>
  ${TL.storms.map(st=>{ const yrs=tlRange(st.years[0],st.years[1]);
    return `<article class="storm" id="st${st.id}"><div class="sh"><span class="sy">${st.years[0]===st.years[1]?st.years[0]:st.years[0]+"–"+String(st.years[1]).slice(2)}</span><div><b>${esc(st.name)}</b><div class="small muted">${esc(st.when)}</div></div></div>
    ${st.drop?`<div class="drop"><div class="dl"><span>Peak to bottom${st.index?" · "+esc(st.index):""}</span><b>−${st.drop}%</b></div><div class="db"><i style="width:${Math.min(100,st.drop)}%"></i></div></div>`:""}
    <p class="small">${esc(st.what)}</p>
    <div class="mkts">${yrs.filter(y=>TL.mkt[y]!==undefined).map(y=>`<a href="${tlH("y-"+y)}" class="mk">${y} ${esc(TL.labels.mktChip)} <b class="${TL.mkt[y]>=0?"up":"dn"}">${tlPct(TL.mkt[y])}</b></a>`).join("")}</div>
    <div class="where">${TLO.map(id=>`<div class="wr a${id}"><span class="dot"></span><b>${esc(TLP[id].short)}</b><span>${esc(st[id])}</span></div>`).join("")}</div></article>`; }).join("")}
  <a class="xcard" href="${tlH("invest")}"><span class="xy">$</span><span><b>Could you have held on?</b><span class="small muted">Invest with Buffett, Munger or the market in any year and live through these storms one year at a time.</span></span></a>
  <p class="note">${esc(TL.labels.stormNote)}</p>`; }

/* ---------- quiz ---------- */
function vTQuiz(){ const Q=TLS.q; if(!Q.order) Q.order=TL.quiz.map((_,i)=>i).sort(()=>Math.random()-.5);
  if(Q.i>=Q.order.length) return `<span class="eyebrow">Timeline · Quiz</span><h2>Who, when?</h2><div class="card tq"><p class="tqq">Done: ${Q.right} of ${Q.n} right.</p><p class="small muted">${Q.right>=Q.n-2?"You know this century well.":"Every answer is somewhere in the timeline. Try again after a browse."}</p><button class="btn" id="tlqReset">Play again</button></div>`;
  const q=TL.quiz[Q.order[Q.i]], done=Q.pick!==null;
  return `<span class="eyebrow">Timeline · Quiz</span><h2>Who, when?</h2><p class="small muted">Question ${Q.i+1} of ${Q.order.length} · Score ${Q.right} of ${Q.n}</p>
  <div class="card tq"><p class="tqq">${esc(q.q)}</p><div class="tqo">${q.o.map((o,i)=>{ let c=""; if(done){ if(i===q.a) c="right"; else if(i===Q.pick) c="wrong"; } return `<button data-tlq="${i}" class="${c}" ${done?"disabled":""}>${esc(o)}</button>`; }).join("")}</div>
  ${done?`<p class="small">${Q.pick===q.a?"✓ Right.":"Not quite."} ${esc(q.x)}</p><button class="btn" id="tlqNext">Next question</button>`:`<p class="small muted">Tap an answer.</p>`}</div>`; }

/* ---------- about ---------- */
function vTAbout(){ return `<span class="eyebrow">Timeline · About</span><h2>About this timeline</h2>${bl(TL.about.map(esc))}
  <h3>How it was checked</h3>${bl(TL.method.map(esc))}
  <h3>The long run</h3><div class="tstats">${TL.longRun.map(([a,b])=>`<div class="stat"><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("")}</div>
  <h3>Sources</h3><ul class="bl">${Object.values(TL.sources).map(s=>`<li>${s.u?`<a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.l)}</a>`:esc(s.l)}</li>`).join("")}</ul>
  <h3>Disclaimer</h3><div class="card grey">${TL.disclaimer.map(d=>`<p class="note">${esc(d)}</p>`).join("")}</div>
  <p class="note">Timeline as of ${esc(TL.asOf)}.</p>`; }

/* ---------- a small sky for the library's front door ---------- */
function tlMiniSVG(){ let s=`<svg viewBox="0 0 120 120" class="minisky" aria-hidden="true"><circle cx="60" cy="60" r="7" class="ms-sun"/>`;
  TLO.forEach(id=>{ const pts=[]; for(let a=0;a<=Math.min(tlLife(id),99);a+=1){ const th=(GOFF[id]+a*GAL.turn-90)*Math.PI/180, r=6+a*0.5; pts.push((60+r*Math.cos(th)).toFixed(1)+" "+(60+r*Math.sin(th)).toFixed(1)); } s+=`<path d="M${pts.join("L")}" class="ms-arm a${id}"/>`; });
  return s+`</svg>`; }

/* ---------- events ---------- */
document.addEventListener("click", e=>{
  const sv=e.target.closest("[data-tlst],[data-tlcr],[data-tlpop]");
  if(sv){ if(sv.dataset.tlpop) TLS.pop=null; else if(sv.dataset.tlst){ const [id,i]=sv.dataset.tlst.split("-"); TLS.pop={k:"st",id,i:+i}; } else TLS.pop={k:"cr",i:+sv.dataset.tlcr};
    tlPopShow(); return; }
  const t=e.target.closest("button,a"); if(!t) return;
  if(t.dataset.tlstep){ tlStop(); tlSetT(Math.floor(TLS.t)+(+t.dataset.tlstep)+0.5); return; }
  if(t.id==="tlPlay"){ tlPlay(); return; }
  if(t.dataset.tljump){ tlStop(); tlSetT(+t.dataset.tljump+0.5); return; }
  if(t.dataset.tlgo){ TLS.t=+t.dataset.tlgo+0.5; return; }
  if(t.dataset.tlastep){ TLS.age=Math.max(0,Math.min(99,TLS.age+(+t.dataset.tlastep))); tlAgeUpdate(); return; }
  if(t.dataset.tlage){ TLS.age=+t.dataset.tlage; tlAgeUpdate(); return; }
  if(t.dataset.tlq){ const Q=TLS.q; if(Q.pick===null){ Q.pick=+t.dataset.tlq; Q.n++; if(Q.pick===TL.quiz[Q.order[Q.i]].a) Q.right++; } render(); return; }
  if(t.id==="tlqNext"){ TLS.q.i++; TLS.q.pick=null; render(); return; }
  if(t.id==="tlqReset"){ TLS.q={order:null,i:0,pick:null,right:0,n:0}; render(); return; }
});
document.addEventListener("input", e=>{ const t=e.target;
  if(t.id==="tlRange"){ tlStop(); tlSetT(+t.value+0.5); return; }
  if(t.id==="tlAgeRange"){ TLS.age=+t.value; tlAgeUpdate(); return; } });
document.addEventListener("change", e=>{ const t=e.target; if(t.id==="tlYearSel" && t.value){ location.hash=tlH("y-"+t.value); } });
function tlPopShow(){ const h=document.getElementById("tlPopHost"); if(h) h.innerHTML=tlPopHTML(); }
document.addEventListener("keydown", e=>{ if(e.key==="Escape" && TLS.pop){ TLS.pop=null; tlPopShow(); } });

/* ---------- invest with them: the hold test ---------- */
/* the series you can invest in come from the timeline's own data */
function tiv(){ if(tiv.c) return tiv.c; const o={}; TL.invest.forEach(x=>{ const f=x.fund?TL.funds.find(q=>q.id===x.fund):null;
  o[x.k]={n:x.n, s:x.s, e:x.e, c:x.c, bn:x.bn, who:x.who, note:x.note, roll:x.roll||null,
    r: f ? (y=>f.data[y]&&f.data[y][0]) : (y=>TL.mkt[y]), b: f ? (y=>f.data[y]&&f.data[y][1]) : null}; });
  return tiv.c=o; }
const tiRollD = (V,y,k) => { const f=TL.funds.find(q=>q.id===V.roll.fund); return f.data[y][k]; };
const TIS = {v:"brk", y0:1965, amt:10000, roll:true, mode:"setup", i:0, inMkt:true, path:null, log:[]};
function tiYears(){ const V=tiv()[TIS.v]; let ys=tlRange(TIS.y0, V.e); if(V.roll && TIS.roll) ys=ys.concat(tlRange(V.roll.start,V.roll.end)); return ys; }
function tiRet(y){ const V=tiv()[TIS.v]; return (V.roll && TIS.roll && y>=V.roll.start) ? tiRollD(V,y,0) : V.r(y); }
function tiBench(y){ const V=tiv()[TIS.v]; if(V.roll && TIS.roll && y>=V.roll.start) return tiRollD(V,y,1); return V.b ? V.b(y) : null; }
function tiFmt(v){ const c=TL.labels.cur; if(v>=1e9) return c+(v/1e9).toFixed(v>=1e10?0:1)+" billion"; if(v>=1e6) return c+(v/1e6).toFixed(v>=1e7?0:1)+" million"; return c+Math.round(v).toLocaleString("en-US"); }
function tiCagr(a,b,n){ return n>0 ? (Math.pow(b/a,1/n)-1)*100 : 0; }
function tiBegin(){ TIS.i=0; TIS.inMkt=true; TIS.log=[]; TIS.path=[{y:TIS.y0, held:TIS.amt, you:TIS.amt, bench:TIS.amt, inMkt:true}]; }
function tiAdvance(){ const ys=tiYears(); if(TIS.i>=ys.length) return; const y=ys[TIS.i], r=tiRet(y), b=tiBench(y), p=TIS.path[TIS.path.length-1];
  TIS.path.push({y:y+1, yr:y, r, br:b, held:p.held*(1+r/100), you:p.you*(TIS.inMkt?1+r/100:1), bench:b==null?null:p.bench*(1+b/100), inMkt:TIS.inMkt});
  TIS.i++; if(TIS.i>=ys.length) TIS.mode="done"; }
function tiContext(y){ const st=TL.storms.find(s=>y>=s.years[0] && y<=s.years[1]); if(st) return {t:"☄ "+st.name+". "+st.what, st};
  const w=(TL.years[y]&&TL.years[y].W)||[], e=w.find(x=>x.k==="mkt")||w.find(x=>x.b)||w[0]; return {t:e?e.t:"", st:null}; }
function tiChart(){ const P=TIS.path, W=400, H=210, L=46, R=8, T=10, B=24, vals=[];
  P.forEach(p=>{ vals.push(p.held,p.you); if(p.bench!=null) vals.push(p.bench); });
  const lo=Math.min(...vals)*0.9, hi=Math.max(...vals)*1.1, l0=Math.log10(lo), l1=Math.log10(hi), n=Math.max(1,P.length-1), tot=TIS.mode==="done"?Math.max(1,tiYears().length):Math.min(tiYears().length,Math.max(10,P.length+3));
  const X=i=>L+(W-L-R)*i/tot, Y=v=>T+(H-T-B)*(1-(Math.log10(v)-l0)/((l1-l0)||1));
  const line=(k,cls)=>{ const pts=P.map((p,i)=>p[k]==null?null:X(i).toFixed(1)+" "+Y(p[k]).toFixed(1)).filter(Boolean); return pts.length>1?`<path d="M${pts.join("L")}" class="${cls}"/>`:""; };
  let s=`<svg viewBox="0 0 ${W} ${H}" class="tichart" role="img" aria-label="Growth of the investment, log scale">`;
  for(let k=Math.ceil(l0);k<=Math.floor(l1);k++){ const y=Y(Math.pow(10,k)); s+=`<line x1="${L}" x2="${W-R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" class="g"/><text x="${L-4}" y="${(y+3).toFixed(1)}" class="ax" text-anchor="end">${tiFmt(Math.pow(10,k)).replace(" million","M").replace(" billion","B")}</text>`; }
  s+=`<text x="${L}" y="${H-6}" class="ax">${TIS.y0}</text><text x="${W-R}" y="${H-6}" class="ax" text-anchor="end">${TIS.mode==="done"?tiYears().slice(-1)[0]+1:TIS.y0+tot}</text>`;
  s+=line("bench","lb")+line("held","lh")+(TIS.played?line("you","ly"):"");
  TIS.log.forEach(d=>{ const i=P.findIndex(p=>p.y===d.y+1); if(i>=0) s+=`<circle cx="${X(i).toFixed(1)}" cy="${Y(P[i].you).toFixed(1)}" r="4" class="${d.a==="sell"?"ds":"db"}"/>`; });
  return s+`</svg><div class="tilg">${TIS.played?`<span><i class="ly"></i>You</span><span><i class="lh"></i>If you had just held</span>`:`<span><i class="lh"></i>Held all the way</span>`}${P[0].bench!=null&&tiv()[TIS.v].bn?`<span><i class="lb"></i>${tiv()[TIS.v].roll&&TIS.roll?"Market":esc(tiv()[TIS.v].bn)}</span>`:""}<span class="muted">log scale</span></div>`; }
function tiStats(){ const P=TIS.path, last=P[P.length-1], n=P.length-1; return `<div class="tistats">
   ${TIS.played?`<div class="stat you"><span>Your money</span><b>${tiFmt(last.you)}</b><small>${tiCagr(TIS.amt,last.you,n).toFixed(1)}% a year</small></div>`:""}
   <div class="stat${TIS.played?"":" you"}"><span>${TIS.played?"If you had just held":"Held all the way"}</span><b>${tiFmt(last.held)}</b><small>${tiCagr(TIS.amt,last.held,n).toFixed(1)}% a year</small></div>
   ${last.bench!=null&&tiv()[TIS.v].bn?`<div class="stat"><span>${tiv()[TIS.v].roll&&TIS.roll?"Market":esc(tiv()[TIS.v].bn)}</span><b>${tiFmt(last.bench)}</b><small>${tiCagr(TIS.amt,last.bench,n).toFixed(1)}% a year</small></div>`:""}</div>`; }
function vTInvest(){ const V=tiv()[TIS.v], cur=TL.labels.cur;
  const head=`<span class="eyebrow">Timeline · Invest with them</span><h2>Could you have held on?</h2>`;
  if(TIS.mode==="setup") return head+`<p class="lede">${esc(TL.labels.investLede)}</p>
    <div class="box-h">1 · Invest with</div><div class="tiv">${Object.entries(tiv()).map(([k,x])=>`<button data-ti="v:${k}" class="${TIS.v===k?"on":""} c${x.c}"><b>${esc(x.n)}</b><span>${x.s}–${x.e}</span></button>`).join("")}</div>
    ${V.roll?`<label class="tiroll"><input type="checkbox" id="tiRoll" ${TIS.roll?"checked":""}> ${esc(V.roll.label)}</label>`:""}
    <div class="box-h">2 · Starting year</div><select id="tiStart">${tlRange(V.s,V.e).map(y=>`<option value="${y}" ${y===TIS.y0?"selected":""}>${y}</option>`).join("")}</select>
    <div class="box-h">3 · Amount</div><div class="chips tjump">${[1000,10000,100000].map(a=>`<button data-ti="amt:${a}" class="${TIS.amt===a?"on":""}">${cur}${a.toLocaleString("en-US")}</button>`).join("")}</div>
    <div class="row tirow"><button class="btn" data-ti="start">Take the hold test</button><button class="btn ghost" data-ti="show">Just show me</button></div>
    <p class="note">${esc(V.note)} Annual figures only, so falls within a year were deeper than shown. No taxes, fees or inflation. Past results do not predict future results.</p>`;
  const ys=tiYears(), P=TIS.path, last=P[P.length-1];
  if(TIS.mode==="play"){
    if(TIS.i===0) return head+`<div class="now"><div class="now-h"><span class="now-y">${TIS.y0}</span><span class="small">January</span></div><p>You put ${tiFmt(TIS.amt)} into <b>${esc(V.n)}</b>. ${ys.length} years lie ahead. After each one you decide: stay in, or sell and sit in cash (earning nothing) until you choose to buy back.</p><button class="btn" data-ti="go">Start the clock</button></div>`;
    const y=last.yr, ctx=tiContext(y), who=V.who||(ctx.st?TLO.find(id=>ctx.st[id] && !/^(Not yet born|Died|Retired)/.test(ctx.st[id])):null), act=ctx.st&&who?ctx.st[who]:null;
    return head+`<p class="small muted">Year ${TIS.i} of ${ys.length}</p>${tiStats()}
    <div class="ticard ${last.r<0?"neg":""}"><div class="now-h"><span class="now-y">${y}</span><b class="${last.r>=0?"up":"dn"}">${tlPct(last.r)}</b>${last.br!=null?`<span class="small muted">market ${tlPct(last.br)}</span>`:""}</div>
      ${ctx.t?`<p class="small">${esc(ctx.t)}</p>`:""}${act?`<p class="small"><b>What ${TLP[who].short} did:</b> ${esc(act)}</p>`:""}
      <p class="small muted">${last.inMkt?"You were invested this year.":"You sat in cash this year."}</p></div>
    <div class="tiq">${TIS.mode==="play"?`<p><b>${y+1} is about to start. What do you do?</b></p>`:""}<div class="row">${TIS.inMkt?`<button class="btn" data-ti="stay">Stay invested</button><button class="btn ghost" data-ti="sell">Sell everything</button>`:`<button class="btn ghost" data-ti="stay">Stay in cash</button><button class="btn" data-ti="buy">Buy back in</button>`}</div>
      <button class="ab tiff" data-ti="ff">Skip to the end${TIS.inMkt?" (holding)":" (in cash)"}</button></div>
    ${tiChart()}`; }
  const n=P.length-1, sells=TIS.log.filter(d=>d.a==="sell").length, diff=last.you-last.held;
  let worst=P[1]; P.slice(1).forEach(p=>{ if(p.r<worst.r) worst=p; });
  let peak=P[0].held, dd=0, ddy=null; P.forEach(p=>{ if(p.held>peak) peak=p.held; const d=1-p.held/peak; if(d>dd){ dd=d; ddy=p.yr; } });
  const msg = sells===0 ? (TIS.log.length===0&&TIS.played ? "You held through everything. That is the hard part, and you did it." : "This is what holding did.")
    : diff>=0 ? `You sold ${sells} time${sells>1?"s":""} and still came out ahead of holding, by ${tiFmt(diff)}. Well timed, this once. Doing it again and again is what almost nobody manages.`
    : `You sold ${sells} time${sells>1?"s":""}. Holding would have left you ${tiFmt(-diff)} richer.`;
  return head+`<p class="lede">${esc(V.n)}${V.roll&&TIS.roll?", "+esc(V.roll.after):""}, ${TIS.y0} to ${ys.slice(-1)[0]}: ${n} years.</p>${tiStats()}
    <p class="spot">${esc(msg)}</p>${tiChart()}
    <div class="where tidone">
      <div class="wr aW"><span class="dot"></span><b>Worst year</b><span>${worst.yr}: ${tlPct(worst.r)}</span></div>
      <div class="wr aW"><span class="dot"></span><b>Deepest fall</b><span>${dd>0?`${(dd*100).toFixed(0)}% below the previous peak, by the end of ${ddy}`:"None at year-ends"}</span></div>
      ${TIS.log.length?`<div class="wr aW"><span class="dot"></span><b>Your moves</b><span>${TIS.log.map(d=>`${d.a==="sell"?"sold":"bought back"} going into ${d.y+1}`).join(", ")}</span></div>`:""}</div>
    <div class="row tirow"><button class="btn" data-ti="again">Try another</button><a class="btn ghost" href="${tlH("storms")}">What they did in each crash</a></div>
    <p class="note">${esc(V.note)} Annual figures only, so falls within a year were deeper than shown. No taxes, fees or inflation. Past results do not predict future results. For education only, not advice.</p>`; }
document.addEventListener("click", e=>{ const t=e.target.closest("[data-ti]"); if(!t) return; const [a,v]=t.dataset.ti.split(":");
  if(a==="v"){ TIS.v=v; TIS.y0=tiv()[v].s; }
  else if(a==="amt") TIS.amt=+v;
  else if(a==="start"){ tiBegin(); TIS.mode="play"; TIS.played=true; }
  else if(a==="show"){ tiBegin(); TIS.played=false; TIS.mode="play"; while(TIS.mode!=="done") tiAdvance(); }
  else if(a==="go") tiAdvance();
  else if(a==="stay") tiAdvance();
  else if(a==="sell"){ TIS.inMkt=false; TIS.log.push({y:TIS.path[TIS.path.length-1].yr, a:"sell"}); tiAdvance(); }
  else if(a==="buy"){ TIS.inMkt=true; TIS.log.push({y:TIS.path[TIS.path.length-1].yr, a:"buy"}); tiAdvance(); }
  else if(a==="ff"){ while(TIS.mode!=="done") tiAdvance(); }
  else if(a==="again"){ TIS.mode="setup"; }
  render(); if(a==="start"||a==="show"||a==="again"){ const el=document.getElementById("s-invest"); if(el) el.scrollIntoView({block:"start"}); else window.scrollTo(0,0); } });
document.addEventListener("change", e=>{ const t=e.target; if(t.id==="tiStart"){ TIS.y0=+t.value; } if(t.id==="tiRoll"){ TIS.roll=t.checked; } });

/* generated from people.py by reg.py: do not edit by hand */
const INV = ["buffett", "munger", "lynch", "graham", "fisher", "templeton", "bogle", "marks", "klarman", "schloss", "bolton", "smith", "keynes", "lilu", "duan", "qiu", "zhanglei", "sampat", "parikh", "damani", "honda", "takeda", "sawakami", "watsa", "parames", "kostolany", "cundill", "barsi", "gray", "cheah", "ptj", "minervini", "druckenmiller"];
const UNITS_WORD = {"buffett": "letters", "munger": "talks and letters", "lynch": "books and talks", "graham": "sources", "fisher": "sources", "templeton": "sources", "bogle": "sources", "marks": "sources", "klarman": "sources", "schloss": "sources", "bolton": "sources", "smith": "sources", "keynes": "sources", "lilu": "sources", "duan": "sources", "qiu": "sources", "zhanglei": "sources", "sampat": "sources", "parikh": "sources", "damani": "sources", "honda": "sources", "takeda": "sources", "sawakami": "sources", "watsa": "sources", "parames": "sources", "kostolany": "sources", "cundill": "sources", "barsi": "sources", "gray": "sources", "cheah": "sources", "ptj": "sources", "minervini": "sources", "druckenmiller": "sources"};
const HOOK = {"buffett": "Ran Berkshire Hathaway for sixty years and explained every decision in a yearly letter to its owners.", "munger": "Buffett's partner for over forty years, and the clearest thinker on why smart people make bad decisions.", "lynch": "Ran the Magellan Fund from 1977 to 1990, beat the market by a mile, and showed ordinary people how to find good stocks.", "graham": "Taught Buffett, wrote the two founding books of value investing, and turned a near-ruinous 1929 into rules for never being ruined again.", "fisher": "Ran his own firm for 68 years, found great companies by talking to everyone around them, and held Motorola for nearly half a century.", "templeton": "Bought 104 cheap shares as war broke out in 1939, then searched the whole world for bargains at the point of maximum pessimism.", "bogle": "Launched the first index fund for ordinary investors, was mocked for it, and spent his life cutting the costs that eat savers' returns.", "marks": "Has written memos since 1990 that Buffett opens first: on risk, cycles, and thinking differently from the crowd.", "klarman": "Wrote a book that sold 5,000 copies and became a legend, and built a firm on one rule above all: avoid losing money.", "schloss": "Never went to college, never visited a company, owned a hundred cheap shares at a time, and beat the market for 47 years.", "bolton": "Ran Fidelity Special Situations for 28 years, about 19.5% a year, by buying good companies the crowd had given up on.", "smith": "Exposed creative accounting and lost his job for it, then built Fundsmith on three rules: buy good companies, don't overpay, do nothing.", "keynes": "The century's most famous economist failed at forecasting markets, changed his method, and beat the UK market for a quarter of a century.", "lilu": "Heard Buffett speak by chance, founded Himalaya Capital, and became the only outside manager Charlie Munger said he ever invested with.", "duan": "Built the companies behind OPPO and vivo, then turned investor: buy businesses you understand, never borrow, and keep a list of things you won't do.", "qiu": "Boiled investing down to three questions, why cheap, why good, why now, and built one of China's largest private fund firms on them.", "zhanglei": "Learned investing at Yale under David Swensen, founded Hillhouse with $20 million, and preaches long-term bets on great entrepreneurs.", "sampat": "India's original value investor: left the family business in the 1950s, bought the Indian arms of global companies cheaply, and taught a generation.", "parikh": "Started as a sub-broker in 1979, became India's voice of behavioural finance, and built a fund with one scheme and his own money in it.", "damani": "Dalal Street's famous bear turned patient investor, then built DMart from one Mumbai store on low costs, owned shops and fast payments.", "honda": "A poor farmer's son who saved a quarter of every pay cheque from 25, invested it, and gave almost all of it away when he retired.", "takeda": "Made Japan's favourite baby biscuit, then became a patient shareholder in over a hundred companies, treating each as a field to tend.", "sawakami": "Founded Japan's first independent fund company in 1999 and preached long-term investing for decades, when few in Japan would listen.", "watsa": "Reached Canada from Hyderabad with almost nothing, turned a failing insurer into Fairfax, and grew its book value 18.7% a year for forty years.", "parames": "Taught himself value investing from Peter Lynch and Buffett's letters, then beat Spain's market for 21 years, survived his worst years, and kept going.", "kostolany": "A speculator, not a value investor: rich twice, broke in between, and the man who taught Germany how crowds move markets.", "cundill": "Read Graham on a plane in 1973, then hunted the world for shares below their liquidation value: the Indiana Jones of Canadian money managers.", "barsi": "Shined shoes in a São Paulo tenement, then built his own pension one dividend share at a time, and became Brazil's biggest individual investor.", "gray": "Rose 10% at Fidelity while the 1962 market crashed, founded South Africa's biggest private fund firm and Orbis, then gave his control to charity.", "cheah": "Sold pineapples as a boy in Penang, spent 17 years as a journalist, then built Value Partners from under US$5 million: Asia's Warren Buffett.", "ptj": "Lost most of his clients' money on one cotton trade in 1979, built his rules around defence, and made a reported 125.9% after fees in 1987, the year of the crash.", "minervini": "Lost all his capital in the 1980s, then studied history's biggest winning stocks and won the U.S. Investing Championship twice, in 1997 and 2021.", "druckenmiller": "Ran George Soros's Quantum Fund, came up with the 1992 bet against the pound, and reported about 30% a year at his own fund without a losing year."};
const SPECIAL = {"buffett": ["His own mistakes", "Errors he admitted in the letters, and what each one taught him."], "munger": ["Twenty-five ways the mind misleads us", "His checklist of mental traps, with a guard against each."], "lynch": ["Try it yourself", "Seven small tools that turn his rules into practice."], "graham": ["Seven tests and a price check", "Try his seven tests for the defensive investor on a company you know, then check its price against them."], "fisher": ["The fifteen points", "Tick off his fifteen points for a company you know, then see his three reasons to sell and his ten don'ts."], "templeton": ["Where is the mood?", "Tap a stage of the market's mood to see what he did there, then read his 16 rules in brief."], "bogle": ["What fees really cost", "See how a small yearly fee grows into a large share of your savings over decades, then his rules in brief."], "marks": ["Take the temperature", "Pick the side of each pair that describes the market today and see where the pendulum swings."], "klarman": ["Three values, one margin", "Value a business three ways, lean on the most cautious, and see the margin of safety at today's price."], "schloss": ["His one-page note", "His typed 1994 note of 16 factors, in our words, and a quick check in his style."], "bolton": ["Before you buy, and when to sell", "His questions before buying, and his three reasons to sell. Tick them off for a company you know."], "smith": ["The quality test", "His numbers for a good company, his ten rules, and the accounting tricks he exposed."], "keynes": ["How he changed", "Forecaster first, stock picker after: the change, his three principles, and an honest note."], "lilu": ["Before you buy: his ideas as questions", "Eight questions to ask of any company, and his six principles. Tick them off for a company you know."], "duan": ["A stop-doing list", "Start your own list, see the rules BBK lived by, and his test before any decision."], "qiu": ["Three questions, one checklist", "Why cheap, why good, why now: tick them off for a company you know, then rank its industry by its moons."], "zhanglei": ["Long-term, and an honest note", "His four signs of a great entrepreneur, what he looks for in people, and a regulatory matter you should know about."], "sampat": ["The Sampat screen", "Run his rules on a company you know: simple, cash-rich, little debt, bought near a multi-year low. Then his four touchstone values."], "parikh": ["Spot the bias", "Six everyday moments from Indian investing. Tap the mistake you see, then read why. Then his four marks of a good business."], "damani": ["The DMart flywheel", "Tap each step to see how low costs become low prices, more shoppers and lower costs again. Then an honest note."], "honda": ["The quarter-rule snowball", "Put in your own pay and see where saving a quarter could take you, then his three steps and his selling rule."], "takeda": ["Would he be its danna?", "Tick his tests for a company you know, then his farmer's year in four steps."], "sawakami": ["Investing or money-rolling?", "Six everyday moments: tap which one each is, then read why. Then an honest note."], "watsa": ["Protection or a bet?", "Fairfax's guiding principles in brief, four examples to sort, then an honest note."], "parames": ["His checklist", "Tick his tests for a company you know, then two ways to see risk."], "kostolany": ["Shaky hands or hard-boiled?", "Five everyday moments: tap which one each is, then the four Gs and an honest note."], "cundill": ["The Cundill screen", "Run his six tests on a company you know, then three trades and their lessons."], "barsi": ["His pension portfolio", "Tick his tests for a company you know, his three nevers, then an honest note."], "gray": ["Crowd or contrarian?", "Four choices, the crowd's side and his, then five lessons he left."], "cheah": ["Buy or wait?", "Four situations: tap what he would do, then an honest note."], "ptj": ["His trademark: five to one", "Test the arithmetic of 5:1 yourself, his rules on one card, defence or offence, then an honest note."], "minervini": ["His trademark: the Trend Template", "Run his eight tests on any stock, the VCP in four steps, leader or laggard, then an honest note."], "druckenmiller": ["His trademark: the pound trade", "Replay Black Wednesday hour by hour, test how much you make when right, Fed or earnings, then an honest note."]};
const SP_LINK = {"graham": {"3": ["sp-gnum", "Check a price with the Graham number ↓"], "5": [null, "Try the seven tests on a company ↓"]}, "fisher": {"2": [null, "Tick the fifteen points for a company ↓"], "6": ["sp-sell", "See his three reasons to sell ↓"]}, "templeton": {"1": [null, "Tap through the four moods ↓"], "9": ["sp-r16", "See all 16 rules in brief ↓"]}, "bogle": {"2": [null, "Work out what a fee costs you ↓"], "6": ["sp-rules", "See his rules in brief ↓"]}, "marks": {"4": [null, "Take the market's temperature ↓"], "6": [null, "Take the market's temperature ↓"], "10": ["sp-memos", "Four memos to start with ↓"]}, "klarman": {"2": [null, "Try the margin of safety tool ↓"], "5": [null, "Value a business three ways ↓"], "6": ["sp-look", "Where he looks ↓"]}, "schloss": {"1": ["sp-note", "Read his 16 factors ↓"], "2": [null, "Check a share in his style ↓"]}, "bolton": {"2": [null, "Use his checklist on a company you know ↓"], "8": ["sp-sell", "See his three reasons to sell ↓"]}, "smith": {"2": [null, "See the full table, and check a company ↓"], "5": ["sp-tricks", "See all nine tricks ↓"]}, "keynes": {"2": [null, "Before and after, side by side ↓"], "3": [null, "His three principles on one card ↓"]}, "lilu": {"1": [null, "Check a company against his ideas ↓"]}, "duan": {"3": ["sp-bbk", "See BBK's list, and start your own ↓"]}, "qiu": {"1": [null, "Run the three questions on a company ↓"], "4": ["sp-moons", "Rank an industry by its moons ↓"]}, "zhanglei": {"5": [null, "His four signs on one card ↓"], "10": ["sp-honest", "Read the honest note ↓"]}, "sampat": {"4": [null, "Try his screen on a company ↓"], "8": ["sp-touch", "See his four touchstone values ↓"]}, "parikh": {"4": [null, "Spot the bias in six Indian examples ↓"], "6": ["sp-good", "His four marks on one card ↓"]}, "damani": {"6": [null, "Tap through the DMart flywheel ↓"], "10": ["sp-honest", "Read the honest note ↓"]}, "honda": {"2": [null, "Try the quarter rule on your pay ↓"], "8": ["sp-sell", "His selling rule on one card ↓"]}, "takeda": {"4": [null, "Would he be this company's danna? ↓"], "5": ["sp-farm", "The farmer's year in four steps ↓"]}, "sawakami": {"2": [null, "Investing or money-rolling? Try six examples ↓"], "10": ["sp-honest", "Read the honest note ↓"]}, "watsa": {"4": ["sp-principles", "Fairfax's principles on one card ↓"], "5": ["sp-protect", "Protection or a bet? Try four examples ↓"], "9": ["sp-honest", "Read the honest note ↓"]}, "parames": {"5": ["sp-risk", "Two ways to see risk ↓"], "6": [null, "Try his checklist on a company ↓"]}, "kostolany": {"2": ["sp-honest", "Read the honest note ↓"], "7": ["sp-gs", "The four Gs on one card ↓"], "8": [null, "Shaky or hard-boiled? Try five examples ↓"]}, "cundill": {"4": [null, "Run his six tests on a company ↓"], "9": ["sp-trades", "Three trades, three lessons ↓"]}, "barsi": {"5": [null, "Would it fit his pension portfolio? ↓"], "7": ["sp-never", "His three nevers ↓"], "9": ["sp-honest", "Read the honest note ↓"]}, "gray": {"4": ["sp-pairs", "Crowd or contrarian? ↓"], "7": ["sp-lessons", "Five lessons he left ↓"]}, "cheah": {"7": ["sp-crowd", "Buy or wait? Try four situations ↓"], "9": ["sp-honest", "Read the honest note ↓"]}, "ptj": {"5": ["sp-def", "Defence or offence? Try four cases ↓"], "6": ["sp-rr", "Try the five-to-one calculator ↓"], "10": ["sp-honest", "Read the honest note ↓"]}, "minervini": {"5": ["sp-tt", "Run the Trend Template yourself ↓"], "6": ["sp-vcp", "The VCP in four steps ↓"], "10": ["sp-honest", "Read the honest note ↓"]}, "druckenmiller": {"3": ["sp-fed", "Fed or earnings? Try four cases ↓"], "5": ["sp-rr", "Try the right-and-wrong calculator ↓"], "6": ["sp-bw", "Replay Black Wednesday ↓"], "10": ["sp-honest", "Read the honest note ↓"]}};
const COUNTRIES = [{"id": "usa", "name": "USA", "flag": "🇺🇸", "picks": [["#buffett", "WB", "a-buffett", "Warren Buffett", "His 30 letters to Berkshire owners, 1995 to 2024"], ["#munger", "CM", "a-munger", "Charlie Munger", "His talks and letters on thinking clearly, 1982 to 2014"], ["#lynch", "PL", "a-lynch", "Peter Lynch", "His books and talks on finding good stocks yourself"], ["#graham", "BG", "a-graham", "Benjamin Graham", "The father of value investing: Mr Market and the margin of safety"], ["#fisher", "PF", "a-fisher", "Philip Fisher", "Scuttlebutt, fifteen points, and holding great companies"], ["#templeton", "JT", "a-templeton", "John Templeton", "Buying at the point of maximum pessimism, worldwide"], ["#bogle", "JB", "a-bogle", "John Bogle", "Index funds, low costs and staying the course"], ["#marks", "HM", "a-marks", "Howard Marks", "Memos on risk, cycles and second-level thinking"], ["#klarman", "SK", "a-klarman", "Seth Klarman", "Margin of safety: avoid loss first, then wait"], ["#schloss", "WS", "a-schloss", "Walter Schloss", "Cheap shares, simple rules, 47 years of beating the market"], ["#timeline", "✦", "a-timeline", "The Timeline", "Buffett, Munger and Lynch: three lives, one century"]], "start": "New here? Start with <a href=\"#buffett\">Buffett</a>. Then take the <a href=\"#timeline-invest\">could-you-have-held-on test</a>."}, {"id": "uk", "name": "UK", "flag": "🇬🇧", "picks": [["#bolton", "AB", "a-bolton", "Anthony Bolton", "Contrarian stock picking at Fidelity, 1979 to 2007"], ["#smith", "TS", "a-smith", "Terry Smith", "Good companies, sensible prices, and doing nothing"], ["#keynes", "JK", "a-keynes", "John Maynard Keynes", "The economist who ran his college's money, 1921 to 1946"], ["#timeline-uk", "✦", "a-timeline", "The UK Timeline", "Three British lives and 144 years, 1883 to today"]], "start": "New here? Start with <a href=\"#keynes-idea-3\">Keynes's three principles</a>. Then try <a href=\"#bolton-special\">Bolton's checklist</a> on a company you know."}, {"id": "china", "name": "China", "flag": "🇨🇳", "picks": [["#lilu", "LL", "a-lilu", "Li Lu", "Himalaya Capital, Munger's chosen manager, since 1997"], ["#duan", "DY", "a-duan", "Duan Yongping", "Buy businesses you understand, and a stop-doing list"], ["#qiu", "QG", "a-qiu", "Qiu Guolu", "Three questions: why cheap, why good, why now"], ["#zhanglei", "ZL", "a-zhanglei", "Zhang Lei", "Hillhouse, long-termism and great entrepreneurs"]], "start": "New here? Start with <a href=\"#duan-special\">Duan's stop-doing list</a>. Then try <a href=\"#qiu-special\">Qiu's three questions</a> on a company you know."}, {"id": "india", "name": "India", "flag": "🇮🇳", "picks": [["#sampat", "CS", "a-sampat", "Chandrakant Sampat", "India's original value investor, from the 1950s"], ["#parikh", "PP", "a-parikh", "Parag Parikh", "Behavioural finance, one honest fund, and patience"], ["#damani", "RD", "a-damani", "Radhakishan Damani", "From Dalal Street's quiet bear to DMart's founder"]], "start": "New here? Start with <a href=\"#sampat\">Sampat</a>, who taught the other two. Then try <a href=\"#parikh-special\">Parikh's bias quiz</a>."}, {"id": "japan", "name": "Japan", "flag": "🇯🇵", "picks": [["#honda", "SH", "a-honda", "Seiroku Honda", "Save a quarter, let it snowball, give it back"], ["#takeda", "WT", "a-takeda", "Wahei Takeda", "The biscuit maker who became a patron of 100 companies"], ["#sawakami", "AS", "a-sawakami", "Atsuto Sawakami", "Japan's evangelist of long-term investing"]], "start": "New here? Start with <a href=\"#honda-special\">Honda's quarter rule</a> on your own pay. Then try <a href=\"#sawakami-special\">Sawakami's test</a>: investing or money-rolling?"}, {"id": "world", "name": "World", "flag": "🌍", "picks": [["#watsa", "PW", "a-watsa", "Prem Watsa", "Canada: Fairfax, protection and forty years of letters"], ["#parames", "FP", "a-parames", "Francisco García Paramés", "Spain: self-taught value, Austrian economics, patience"], ["#kostolany", "AK", "a-kostolany", "André Kostolany", "Hungary to Germany: crowds, cycles and the four Gs"], ["#cundill", "PC", "a-cundill", "Peter Cundill", "Canada: a dollar for forty cents, anywhere on earth"], ["#barsi", "LB", "a-barsi", "Luiz Barsi Filho", "Brazil: the king of dividends, one share a month"], ["#gray", "AG", "a-gray", "Allan Gray", "South Africa: contrarian, patient, and generous"], ["#cheah", "CC", "a-cheah", "Cheah Cheng Hye", "Malaysia and Hong Kong: from reporter to Asia's Buffett"]], "start": "Great investors the English-speaking world barely knows. Start with <a href=\"#watsa\">Watsa</a>, then try <a href=\"#kostolany-special\">Kostolany's shaky-hands test</a>."}, {"id": "traders", "name": "Traders", "flag": "📊", "picks": [["#ptj", "PTJ", "a-ptj", "Paul Tudor Jones", "USA: defence first, five to one, and the 1987 crash"], ["#minervini", "MM", "a-minervini", "Mark Minervini", "USA: the Trend Template, the VCP and two championships"], ["#druckenmiller", "SD", "a-druckenmiller", "Stanley Druckenmiller", "USA: liquidity, bet sizing and the 1992 pound trade"]], "start": "For adults (18+). Traders take risks most people should not, and most individuals who trade lose money. Start with <a href=\"#ptj-record\">Paul Tudor Jones's track record</a>, then try <a href=\"#minervini-special\">Mark Minervini's Trend Template</a> on a stock you know. More traders will follow."}];
const REG_COVER = "It covers the United States (Warren Buffett, Charlie Munger, Peter Lynch, Benjamin Graham, Philip Fisher, John Templeton, John Bogle, Howard Marks, Seth Klarman and Walter Schloss, plus a Timeline of the first three lives), the United Kingdom (Anthony Bolton, Terry Smith and John Maynard Keynes, plus a UK Timeline), China (Li Lu, Duan Yongping, Qiu Guolu and Zhang Lei), India (Chandrakant Sampat, Parag Parikh and Radhakishan Damani), Japan (Seiroku Honda, Wahei Takeda and Atsuto Sawakami) and the wider world (Prem Watsa, Francisco García Paramés, André Kostolany, Peter Cundill, Luiz Barsi Filho, Allan Gray and Cheah Cheng Hye), plus a Traders section (Paul Tudor Jones, Mark Minervini and Stanley Druckenmiller) with extra risk warnings. More countries will follow, chosen only where there is a public record of their own letters, books, talks or results, and a reputation for integrity.";
const REG_INDEP = "Independent. This site is not affiliated with, endorsed, sponsored or reviewed by any person featured, including Warren Buffett, Peter Lynch, Howard Marks, Seth Klarman, Anthony Bolton, Terry Smith, Li Lu, Duan Yongping, Qiu Guolu, Zhang Lei, Radhakishan Damani, Atsuto Sawakami, Prem Watsa, Francisco García Paramés, Luiz Barsi Filho, Cheah Cheng Hye, Paul Tudor Jones, Mark Minervini, Stanley Druckenmiller, Charlie Munger's estate, the Keynes estate, and the families or estates of Benjamin Graham, Philip Fisher, John Templeton, John Bogle, Walter Schloss, Chandrakant Sampat, Parag Parikh, Seiroku Honda, Wahei Takeda, André Kostolany, Peter Cundill and Allan Gray, or by Berkshire Hathaway, GEICO, Fisher & Co., Franklin Templeton, the John Templeton Foundation, Vanguard, Oaktree, Baupost, Fidelity, Fundsmith, King's College, Cambridge, Himalaya Capital, BBK, Gaoyi Asset Management, Hillhouse, PPFAS Asset Management, PPFAS Mutual Fund, Avenue Supermarts (DMart), Saitama Prefecture, Takeda Honsha, Sawakami Asset Management, Fairfax Financial Holdings, Cobas Asset Management, Bestinver, Fiduka, Mackenzie Investments, McGill University, Unipar, Allan Gray, Orbis, Value Partners, Tudor Investment Corporation, the Robin Hood Foundation, Minervini Private Access, the U.S. Investing Championship, Duquesne Capital Management, the Quantum Fund, the Harlem Children's Zone, any publisher, or any company named. All trademarks and copyrights belong to their owners. Exact quotations are kept short and remain their authors' copyright.";

/* ================= v4: one simple vertical page per investor ================= */
document.documentElement.removeAttribute("data-theme");
const V4 = {page:null, secs:[], open:new Set(), q:""};
/* (moved to people.py -> reg.js) */
/* (moved to people.py -> reg.js) */
const ctryOf = pid => (PACKS[pid] && PACKS[pid].country) || "usa";
const NUMW = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen"];
const numW = n => NUMW[n] || String(n), capW = n => { const w=numW(n); return w.charAt(0).toUpperCase()+w.slice(1); };
/* (moved to people.py -> reg.js) */
/* (moved to people.py -> reg.js) */
/* links from an idea down to the special section */
/* (moved to people.py -> reg.js) */

/* ---------- UK diagrams ---------- */
Object.assign(DIAG, {
  contrarian(){ let b=`<line x1="8" y1="96" x2="392" y2="96" class="ln" stroke-dasharray="4 4"/>`+T(392,114,"what it is worth","s","end");
    b+=`<path d="M8,100 C32,52 58,34 84,34 C132,34 176,158 220,158 C266,158 312,34 356,34 C372,34 384,42 392,52" fill="none" class="la fd" style="stroke-width:3"/>`;
    b+=T(8,150,"Crowd mood","s b")+`<circle cx="84" cy="34" r="7" class="ink pp" ${delay(1)}/>`+T(84,18,"Loved: risky","b","middle");
    b+=`<circle cx="356" cy="34" r="7" class="ink pp" ${delay(3)}/>`+T(396,18,"Sell into the joy","b","end");
    b+=`<circle cx="220" cy="158" r="8" class="acc pp" ${delay(2)}/>`+T(220,184,"Buy in the gloom,","b a","middle")+T(220,201,"if you know why the crowd is wrong","s","middle");
    return svg(208,b); },
  threesteps(){ const r=[["Buy good companies","Return on capital: 31% against 17%"],["Don't overpay","Cash yield: 3.7% against 2.8%"],["Do nothing","Only about 13% of the fund traded in 2025"]]; let b="";
    r.forEach(([t,x],i)=>{ const y=i*58; b+=`<rect x="0" y="${y}" width="400" height="48" rx="10" class="soft fd" ${delay(i)}/>`+`<circle cx="26" cy="${y+24}" r="15" class="acc pp" ${delay(i)}/>`+T(26,y+29,String(i+1),"b w","middle")+T(52,y+20,t,"b")+T(52,y+39,x,"");
      if(i<2) b+=`<line x1="26" y1="${y+40}" x2="26" y2="${y+58}" class="lr"/>`; });
    return svg(168,b); },
  beauty(){ let b=""; for(let i=0;i<6;i++){ const x=40+i*64; b+=`<circle cx="${x}" cy="22" r="16" class="${i===3?"acc":"ol"} pp" ${delay(i,.08)}/>`; }
    b+=T(200,56,"Pick the face the most people will pick","s","middle");
    const L=[["1st degree","Which face do I like best?"],["2nd degree","Which will most people pick?"],["3rd degree","What will people think most will pick?"]];
    L.forEach(([a,x],i)=>{ const y=70+i*40, ind=i*18; b+=`<rect x="${ind}" y="${y}" width="${400-ind}" height="32" rx="8" class="soft fd" ${delay(i+2)}/>`+T(ind+10,y+21,a,"b a")+T(ind+96,y+21,x,"s"); });
    b+=T(200,208,"Prices can follow the guessing, not the value","dsp","middle");
    return svg(216,b); }
});

/* ---------- China diagrams ---------- */
Object.assign(DIAG, {
  edge(){ const cx=96, cy=92; let b=`<circle cx="${cx}" cy="${cy}" r="80" class="soft pp"/><circle cx="${cx}" cy="${cy}" r="46" class="acc pp" style="animation-delay:.15s"/><circle cx="${cx}" cy="${cy}" r="46" fill="none" class="ln" style="stroke-width:3;stroke-dasharray:6 4"/>`;
    b+=T(cx,cy+5,"I know","b w","middle");
    const rows=[[cy-30,cx+40,"The edge","Know exactly where it is."],[cy+18,cx+46,"Just outside","It feels familiar. It isn't."],[cy+70,cx+58,"Far outside","Easy to pass."]];
    rows.forEach(([y,x0,a,c],i)=>{ b+=`<line x1="${x0}" y1="${y}" x2="214" y2="${y}" class="lr" stroke-dasharray="3 3"/>`+T(220,y-3,a,"b a")+T(220,y+15,c,"s"); });
    return svg(184,b); },
  stopdo(){ let b=`<rect x="120" y="0" width="160" height="40" rx="10" class="soft fd"/>`+T(200,25,"A new chance","b","middle");
    b+=`<line x1="200" y1="40" x2="200" y2="58" class="lr"/><rect x="80" y="58" width="240" height="40" rx="10" class="ol fd" ${delay(1)}/>`+T(200,83,"Is it the right thing to do?","b","middle");
    b+=`<line x1="140" y1="98" x2="80" y2="122" class="lr"/><line x1="260" y1="98" x2="320" y2="122" class="lr"/>`+T(98,114,"no","s","end")+T(302,114,"yes","s");
    b+=`<rect x="0" y="122" width="170" height="52" rx="10" class="acc pp" ${delay(2)}/>`+T(85,144,"Stop, even if","b w","middle")+T(85,163,"it would pay","b w","middle");
    b+=`<rect x="230" y="122" width="170" height="52" rx="10" class="soft fd" ${delay(3)}/>`+T(315,144,"Then ask:","b","middle")+T(315,163,"does it pay? Do it right.","s","middle");
    return svg(182,b); },
  threeq(){ const r=[["Why is it cheap?","Valuation: the easiest to measure"],["Why is it good?","Quality: the hardest to judge"],["Why buy now?","Timing: what the crowd is doing"]]; let b="";
    r.forEach(([t,x],i)=>{ const y=i*58; b+=`<rect x="0" y="${y}" width="400" height="48" rx="10" class="soft fd" ${delay(i)}/>`+`<circle cx="26" cy="${y+24}" r="15" class="acc pp" ${delay(i)}/>`+T(26,y+29,String(i+1),"b w","middle")+T(52,y+20,t,"b")+T(52,y+39,x,"");
      if(i<2) b+=`<line x1="26" y1="${y+40}" x2="26" y2="${y+58}" class="lr"/>`; });
    return svg(168,b); },
  moons(){ const skies=[[[40,26,14]],[[40,26,13],[18,48,4],[64,52,4],[70,18,3]],[[24,30,9],[56,34,9],[40,58,8]],[[14,18,3],[30,44,3],[46,20,3],[62,48,3],[22,60,3],[70,30,3],[50,62,3],[38,34,3],[66,64,3],[12,40,3]]];
    const lab=["One moon","Moon and stars","Two or three","All stars"], sub=["best","good","fair","worst"]; let b="";
    skies.forEach((s,i)=>{ const x0=i*100+10; b+=`<rect x="${x0}" y="0" width="80" height="80" rx="10" fill="#151a3a" class="fd" ${delay(i)}/>`;
      s.forEach(([x,y,r])=>{ b+=`<circle cx="${x0+x}" cy="${y}" r="${r}" fill="#f3c969" class="pp" ${delay(i+.3)}/>`; });
      b+=T(x0+40,100,lab[i],"b","middle")+T(x0+40,118,sub[i],"s","middle"); });
    return svg(126,b); },
  time(){ let b=`<path d="M8,150 C90,132 170,96 250,70 C310,50 360,34 392,24" fill="none" class="la fd" style="stroke-width:3"/>`;
    b+=`<path d="M8,140 L28,160 L46,128 L64,152 L84,120 L104,146 L124,104 L146,132 L166,92 L188,118 L210,76 L232,104 L254,62 L278,86 L300,48 L322,68 L346,32 L370,50 L392,18" fill="none" class="ln" style="stroke-width:1.5;opacity:.7"/>`;
    b+=T(8,186,"Short term: prices wander","s")+T(392,186,"Long term: value shows","s b","end")+T(300,22,"value created","b a","end");
    return svg(194,b); }
});

/* ---------- USA classics diagrams ---------- */
function moodCurve(sel){ const pts=[[30,166],[124,128],[232,80],[334,22]], lab=["Pessimism","Scepticism","Optimism","Euphoria"];
  let b=`<path d="M8,170 C40,174 70,156 124,128 C170,104 200,96 232,80 C270,60 300,34 334,22 C352,16 364,24 372,44 L392,118" fill="none" class="la fd" style="stroke-width:3"/>`;
  pts.forEach(([x,y],i)=>{ const on = sel==null ? (i===0||i===3) : i===sel; b+=`<circle cx="${x}" cy="${y}" r="${on?9:6}" class="${on?"acc":"ol"} pp" ${delay(i)}/>`; });
  const pos=[[8,198,"start"],[134,148,"start"],[246,100,"start"],[392,12,"end"]];
  pos.forEach(([x,y,a],i)=>{ const t = sel==null && i===0 ? "Pessimism: he bought" : sel==null && i===3 ? "Euphoria: he sold" : lab[i];
    const cls = sel==null ? (i===0||i===3?"b a":"b") : (i===sel?"b a":"s"); b+=T(x,y,t,cls,a); });
  return svg(206,b); }
Object.assign(DIAG, {
  balance(){ let b=T(200,14,"Share of your money in shares","s b","middle");
    b+=`<rect x="0" y="24" width="100" height="34" rx="8" class="ol fd"/><rect x="300" y="24" width="100" height="34" rx="8" class="ol fd"/>`;
    b+=`<rect x="100" y="24" width="200" height="34" class="soft fd" ${delay(1)}/>`+T(50,46,"never","s","middle")+T(350,46,"never","s","middle");
    b+=`<line x1="200" y1="18" x2="200" y2="64" class="la pp" style="stroke-width:3" ${delay(2)}/>`;
    [0,25,50,75,100].forEach((v,i)=>{ b+=T(v*4,80,v+"%","s",i===0?"start":i===4?"end":"middle"); });
    b+=T(200,102,"50–50 is a sensible default","b","middle");
    b+=`<line x1="186" y1="126" x2="120" y2="126" class="la"/><path d="M110,126 l12,-6 v12 z" class="acc"/>`+`<line x1="214" y1="126" x2="280" y2="126" class="la"/><path d="M290,126 l-12,-6 v12 z" class="acc"/>`;
    b+=T(100,150,"Prices high:","b","middle")+T(100,167,"lean to bonds","s","middle")+T(300,150,"Prices low:","b","middle")+T(300,167,"lean to shares","s","middle");
    return svg(174,b); },
  vote(){ let b=T(90,14,"In the short run","s","middle")+T(310,14,"In the long run","s","middle");
    b+=`<rect x="58" y="44" width="64" height="44" rx="6" class="ol fd"/><line x1="76" y1="52" x2="104" y2="52" class="ln" style="stroke-width:3"/>`;
    b+=`<rect x="80" y="22" width="20" height="26" rx="2" class="soft pp" transform="rotate(-8 90 35)" ${delay(1)}/>`+T(90,76,"✓","b","middle");
    b+=`<line x1="310" y1="34" x2="310" y2="84" class="ln"/><path d="M296,88 h28 l-14,-8 z" class="ink"/>`;
    b+=`<line x1="262" y1="38" x2="358" y2="30" class="ln pp" style="stroke-width:2.4" ${delay(2)}/>`;
    b+=`<path d="M246,58 a16,8 0 0 0 32,0 z" class="acc pp" ${delay(3)}/><path d="M342,50 a16,8 0 0 0 32,0 z" class="soft pp" ${delay(3)}/>`;
    b+=`<line x1="262" y1="38" x2="248" y2="58" class="lr"/><line x1="262" y1="38" x2="276" y2="58" class="lr"/><line x1="358" y1="30" x2="344" y2="50" class="lr"/><line x1="358" y1="30" x2="372" y2="50" class="lr"/>`;
    b+=`<line x1="168" y1="64" x2="226" y2="64" class="la"/><path d="M234,64 l-12,-6 v12 z" class="acc"/>`+T(200,54,"time","s","middle");
    b+=T(90,114,"a voting machine","b a","middle")+T(90,132,"prices follow popularity","s","middle")+T(310,114,"a weighing machine","b a","middle")+T(310,132,"prices follow value","s","middle");
    return svg(140,b); },
  scuttle(){ const cx=200, cy=88, N=[[62,22,"Customers"],[338,22,"Suppliers"],[54,92,"Competitors"],[346,92,"Former staff"],[90,160,"Scientists"]]; let b="";
    N.forEach(([x,y],i)=>{ b+=`<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="lr fd" ${delay(i)}/>`; });
    b+=`<line x1="${cx}" y1="${cy}" x2="310" y2="160" class="la fd" stroke-dasharray="5 4" ${delay(6)}/>`;
    N.forEach(([x,y,t],i)=>{ b+=`<rect x="${x-52}" y="${y-15}" width="104" height="30" rx="15" class="soft pp" ${delay(i)}/>`+T(x,y+5,t,"b","middle"); });
    b+=`<circle cx="${cx}" cy="${cy}" r="36" class="acc pp"/>`+T(cx,cy-2,"The","b w","middle")+T(cx,cy+15,"company","b w","middle");
    b+=`<rect x="248" y="145" width="124" height="30" rx="15" class="ol pp" ${delay(6)}/>`+T(310,165,"Managers, last","b a","middle");
    return svg(182,b); },
  basket(){ const grid=(y0,cls)=>{ let s=""; for(let i=0;i<104;i++){ const c=i%26, r=Math.floor(i/26); s+=`<rect x="${c*15+6}" y="${y0+r*15}" width="12" height="12" rx="3" class="${cls(i)} pp" style="animation-delay:${(i*.006).toFixed(3)}s"/>`; } return s; };
    let b=T(6,14,"1939: 100 shares in each of 104 companies","s b");
    b+=grid(22, i=>i<34?"ink":"soft")+T(6,100,"34 were in bankruptcy when he bought","s");
    b+=T(6,128,"When he sold, a few years later","s b")+grid(136, i=>i>=100?"bad":"acc")+T(6,214,"Only 4 ended worthless","s");
    return svg(222,b); },
  mood(){ return moodCurve(null); }
});

/* ---------- USA classics: Graham's tests, his number, Templeton's moods ---------- */
function gtS(pid){ V4.gt=V4.gt||{}; return V4.gt[pid]||(V4.gt[pid]={t:new Set(), v:{}}); }
const gtNum = r => (r===undefined||r===null||r===""||isNaN(+r)) ? null : +r;
const gtFmt = x => (Math.round(x*100)/100).toLocaleString("en-US");
function gtPE(B,S){ const j=B.tests.findIndex(t=>t.max!=null); return j<0?null:gtNum(S.v[j]); }
function gtPass(B,S,i){ const it=B.tests[i]; if(it.t==="tick") return S.t.has(i)?1:0; const x=gtNum(S.v[i]); if(x===null) return null;
  if(it.min!=null) return x>=it.min?1:0; if(it.max!=null) return x<=it.max?1:0;
  if(it.pb){ if(x<=1.5) return 1; const pe=gtPE(B,S); return pe!==null && pe*x<=22.5 ? 1 : 0; } return null; }
function gtBadge(B,S,i){ const it=B.tests[i], r=gtPass(B,S,i); if(it.t==="tick"||r===null) return "";
  if(it.pb && r===1 && gtNum(S.v[i])>1.5) return `<span class="qc ok">✓ Passes on the 22.5 rule: ${gtFmt(gtPE(B,S)*gtNum(S.v[i]))}</span>`;
  return r?`<span class="qc ok">✓ Passes</span>`:`<span class="qc no">Fails this test</span>`; }
function gtSum(pid,B){ const S=gtS(pid), ns=[...new Set(B.tests.map(t=>t.n))]; let pass=0, open=0;
  ns.forEach(n=>{ const rs=B.tests.map((t,i)=>t.n===n?gtPass(B,S,i):undefined).filter(x=>x!==undefined); if(rs.every(x=>x===1)) pass++; else if(rs.some(x=>x===null)&&!rs.some(x=>x===0)) open++; });
  const N=ns.length, touched=S.t.size>0 || Object.values(S.v).some(v=>v!==""&&v!=null);
  const V=B.verdicts||["Think of one company. Tick each test it passes and type in its numbers.","Passes all seven: rare on his strict rules. Next, ask whether the price leaves a margin of safety.","Passes most, not all. His defensive investor wanted all seven; his enterprising investor used looser tests.","Fails several tests. Not a share for his defensive investor."];
  const verdict=!touched?V[0]:pass===N?V[1]:pass>=N-2?V[2]:V[3];
  return `<div class="lmeter"><div><b>${pass}</b>/${N} tests passed<div class="bar"><i style="width:${pass/N*100}%"></i></div></div></div>
    <p class="verdict">${esc(verdict)}</p>${touched&&open?`<p class="small muted">Fill in the empty numbers to finish.</p>`:""}`; }
function gtestsHTML(p,B){ const S=gtS(p.id);
  const rows=B.tests.map((it,i)=>{ const help=`<small>${esc(it.help)}</small>`;
    if(it.t==="tick"){ const on=S.t.has(i); return `<div class="lchecks"><button data-gt="${p.id}:${i}" class="${on?"on":""}" aria-pressed="${on}"><span class="lck">${on?"✓":it.n}</span><span><b>${esc(it.label)}</b>${help}</span></button></div>`; }
    const r=gtPass(B,S,i); return `<div class="gnum${r===1?" on":""}" id="gtr-${p.id}-${i}"><span class="lck">${r===1?"✓":it.n}</span><label for="gt-${p.id}-${i}"><b>${esc(it.label)}</b>${help}</label><input id="gt-${p.id}-${i}" type="number" inputmode="decimal" step="any" value="${esc(S.v[i]??"")}" placeholder="${it.ph||(it.min!=null?"e.g. 2.4":it.max!=null?"e.g. 12":"e.g. 1.3")}"><span class="gnb" id="gto-${p.id}-${i}">${gtBadge(B,S,i)}</span></div>`; }).join("");
  const touched=S.t.size>0 || Object.values(S.v).some(v=>v!==""&&v!=null);
  return `<div class="box-h"${B.id?` id="${B.id}"`:""}>${esc(B.title)}</div><div class="gtests">${rows}</div><div id="gts-${p.id}">${gtSum(p.id,B)}</div>${touched?`<button class="btn ghost" data-gtclear="${p.id}">Clear</button>`:""}${B.note?`<p class="note">${esc(B.note)}</p>`:""}`; }
function gtRefresh(pid){ const B=(PACKS[pid].sp||[]).find(b=>b.k==="gtests"); if(!B) return; const S=gtS(pid);
  B.tests.forEach((it,i)=>{ if(it.t==="tick") return; const r=gtPass(B,S,i), row=document.getElementById(`gtr-${pid}-${i}`), o=document.getElementById(`gto-${pid}-${i}`);
    if(row){ row.classList.toggle("on", r===1); const k=row.querySelector(".lck"); if(k) k.textContent=r===1?"✓":it.n; } if(o) o.innerHTML=gtBadge(B,S,i); });
  const s=document.getElementById("gts-"+pid); if(s) s.innerHTML=gtSum(pid,B); }
function gnOut(){ const G=V4.gn||{}, e=gtNum(G.eps), b=gtNum(G.bv), pr=gtNum(G.price);
  if(e===null||b===null) return `<p class="small muted">Type earnings and book value per share to see it.</p>`;
  if(e<=0||b<=0) return `<p class="verdict">No Graham number: it needs positive earnings and book value.</p>`;
  const g=Math.sqrt(22.5*e*b); let line="";
  if(pr!==null && pr>0){ const d=pr/g-1; line = d<=0 ? `<span class="qc ok">Price is ${Math.round(-d*100)}% below it</span>` : `<span class="qc no">Price is ${Math.round(d*100)}% above it</span>`; }
  return `<div class="tstats gnstat"><div class="stat"><b>${gtFmt(g)}</b><span>Graham number: the most tests 6 and 7 allow</span></div></div>${line}`; }
function gnumHTML(p,B){ const G=V4.gn||(V4.gn={eps:"",bv:"",price:""});
  const row=(k,l,ph)=>`<div class="qcrow"><label for="gn-${k}">${l}</label><input id="gn-${k}" type="number" inputmode="decimal" step="any" value="${esc(G[k]??"")}" placeholder="${ph}"></div>`;
  return `<h3${B.id?` id="${B.id}"`:""}>${esc(B.title)}</h3><p>${esc(B.text)}</p><div class="qctool">${row("eps","Earnings per share (3-year average)","e.g. 4")}${row("bv","Book value per share","e.g. 30")}${row("price","Share price","e.g. 45")}</div>
    <div id="gnOut">${gnOut()}</div>${B.note?`<p class="note">${esc(B.note)}</p>`:""}`; }
function stagesHTML(p,B){ V4.stg=V4.stg||{}; const k=V4.stg[p.id]??0, it=B.items[k];
  return `<h3${B.id?` id="${B.id}"`:""}>${esc(B.title)}</h3><figure class="dg stgfig">${moodCurve(k)}</figure>
    <div class="chips stg" role="group" aria-label="Market mood">${B.items.map((s,i)=>`<button data-stg="${p.id}:${i}" class="${i===k?"on":""}" aria-pressed="${i===k}">${esc(s[0])}</button>`).join("")}</div>
    <div class="stgcard"><div class="box-h">What it feels like</div><p>${esc(it[1])}</p><div class="box-h">What he did</div><p><b>${esc(it[2])}</b></p></div>${B.note?`<p class="note">${esc(B.note)}</p>`:""}`; }

/* ---------- USA batch 2 diagrams ---------- */
function pendSVG(a, labels){ const L=118, px=200, py=14, r=a*Math.PI/180, bx=px+L*Math.sin(r), by=py+L*Math.cos(r);
  let b=`<path d="M${px+L*Math.sin(-0.85)},${py+L*Math.cos(-0.85)} A${L},${L} 0 0 0 ${px+L*Math.sin(0.85)},${py+L*Math.cos(0.85)}" fill="none" class="lr" stroke-dasharray="4 5"/>`;
  b+=`<line x1="${px}" y1="${py}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" class="ln" style="stroke-width:2.4"/><circle cx="${px}" cy="${py}" r="5" class="ink"/><circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="15" class="acc pp"/>`;
  const lab=labels||["Fear","Sensible","Greed"];
  b+=T(52,124,lab[0],"b a","middle")+T(200,152,lab[1],"s","middle")+T(348,124,lab[2],"b a","middle");
  return svg(162,b); }
Object.assign(DIAG, {
  haystack(){ const grid=(x0,hl)=>{ let s=""; for(let i=0;i<48;i++){ const c=i%8, r=Math.floor(i/8); s+=`<circle cx="${x0+c*20}" cy="${34+r*18}" r="6" class="${hl===i?"acc":hl===-1?"acc":"soft"} pp" style="animation-delay:${(i*.01).toFixed(2)}s"/>`; } return s; };
    let b=T(90,14,"Hunt for the winner","b","middle")+T(310,14,"Buy the haystack","b a","middle");
    b+=grid(20,27)+T(90+0,150,"one stock in 48, if you pick right","s","middle");
    b+=`<rect x="228" y="22" width="164" height="114" rx="12" fill="none" class="la" style="stroke-width:2.4"/>`+grid(240,-1)+T(310,150,"own them all, winners included","s","middle");
    b+=`<text x="${20+3*20}" y="${34+3*18+4}" class="s b w" text-anchor="middle">?</text>`;
    return svg(158,b); },
  feegap(){ const yrs=30, f=(fee,t)=>Math.pow(1.07*(1-fee),t), X=t=>20+t*12, Y=v=>150-(v-1)*17;
    const pa=[...Array(yrs+1)].map((_,t)=>`${X(t)},${Y(f(0.001,t)).toFixed(1)}`), pb=[...Array(yrs+1)].map((_,t)=>`${X(t)},${Y(f(0.015,t)).toFixed(1)}`);
    let b=`<polygon points="${pa.join(" ")} ${pb.slice().reverse().join(" ")}" class="soft fd"/>`;
    b+=`<polyline points="${pa.join(" ")}" fill="none" class="la" style="stroke-width:2.6"/><polyline points="${pb.join(" ")}" fill="none" class="ln" style="stroke-width:2.2"/>`;
    b+=`<line x1="20" y1="150" x2="380" y2="150" class="lr"/>`+T(20,166,"Year 0","s")+T(380,166,"Year 30","s","end");
    const ea=f(0.001,30)*10000, eb=f(0.015,30)*10000, k=v=>"$"+Math.round(v/100)*100/1000+"k";
    b+=T(372,Y(f(0.001,30))-8,"0.1% fee: "+k(ea),"b a","end")+T(372,144,"1.5% fee: "+k(eb),"b","end");
    b+=T(24,16,"$10,000 growing at 7% a year before fees","s");
    return svg(172,b); },
  levels(){ const box=(x,y,w,t,cls)=>`<rect x="${x}" y="${y}" width="${w}" height="30" rx="15" class="${cls} pp"/>`+T(x+w/2,y+20,t,cls==="acc"?"b w":"b","middle"), ar=(x1,x2,y)=>`<line x1="${x1}" y1="${y}" x2="${x2-6}" y2="${y}" class="la"/><path d="M${x2},${y} l-8,-5 v10 z" class="acc"/>`;
    let b=T(0,14,"First level","s b")+box(0,22,140,"Good company","soft")+ar(146,214,37)+box(220,22,90,"Buy","ol");
    b+=T(0,82,"Second level","s b a")+box(0,90,140,"Good company","soft")+ar(146,170,105)+box(176,90,128,"Everyone agrees?","soft");
    b+=box(176,138,128,"Already in price","acc")+`<line x1="240" y1="120" x2="240" y2="132" class="la"/><path d="M240,138 l-5,-8 h10 z" class="acc"/>`+T(240,186,"so look elsewhere","s a","middle");
    return svg(194,b); },
  pendulum(){ return pendSVG(34); },
  threevals(){ const rows=[["Future cash (present value)",320],["Break-up value",210],["What similar firms fetch",270]]; let b="";
    rows.forEach(([t,w],i)=>{ const y=8+i*38, lo=i===1; b+=T(0,y+10,t+(lo?": the lowest":""),lo?"s b a":"s")+`<rect x="0" y="${y+16}" width="${w}" height="14" rx="7" class="${lo?"acc":"soft"} pp" ${delay(i)}/>`; });
    b+=`<line x1="140" y1="22" x2="140" y2="126" class="ln" stroke-dasharray="4 4"/>`+T(140,140,"price","b","middle");
    b+=`<line x1="140" y1="126" x2="210" y2="126" class="la" style="stroke-width:3"/><line x1="210" y1="118" x2="210" y2="134" class="la" style="stroke-width:2"/>`+T(175,160,"the gap is the margin of safety","s b a","middle");
    return svg(168,b); },
  nooks(){ let b=`<circle cx="200" cy="84" r="58" class="soft fd"/>`;
    for(let i=0;i<26;i++){ const a=i*2.4, r=10+(i%5)*9; b+=`<circle cx="${(200+r*Math.cos(a)).toFixed(1)}" cy="${(84+r*Math.sin(a)).toFixed(1)}" r="3.4" class="ink pp" style="animation-delay:${(i*.02).toFixed(2)}s"/>`; }
    b+=T(200,160,"Most investors crowd the popular, easy ideas","s","middle");
    [[62,22,"Distressed debt"],[338,22,"Forced sales"],[62,126,"Complex deals"],[338,126,"Out of favour"]].forEach(([x,y,t],i)=>{ b+=`<rect x="${x-58}" y="${y-15}" width="116" height="30" rx="15" class="ol pp" ${delay(i+2)}/>`+T(x,y+5,t,"b a","middle"); });
    return svg(168,b); },
  assetsearn(){ const X=i=>24+i*36, bk=[60,64,67,71,74,78,81,85,88,92], er=[60,88,40,96,30,70,104,48,90,62], Y=v=>150-v*1.2;
    let b=`<polyline points="${bk.map((v,i)=>X(i)+","+Y(v)).join(" ")}" fill="none" class="la" style="stroke-width:3"/>`;
    b+=`<polyline points="${er.map((v,i)=>X(i)+","+Y(v)).join(" ")}" fill="none" class="ln" stroke-dasharray="5 4" style="stroke-width:2"/>`;
    b+=`<line x1="24" y1="150" x2="380" y2="150" class="lr"/>`+T(24,166,"ten years","s");
    b+=T(24,14,"solid: book value","b a")+T(230,14,"dashed: earnings","b");
    return svg(172,b); },
  scalebuy(){ const pts=[[10,30],[60,60],[100,50],[140,95],[180,85],[220,125],[260,100],[300,70],[340,40],[390,20]], P=pts.map(p=>p.join(",")).join(" ");
    let b=`<polyline points="${P}" fill="none" class="ln" style="stroke-width:2.4"/>`;
    [[60,60],[140,95],[220,125]].forEach(([x,y],i)=>{ b+=`<circle cx="${x}" cy="${y}" r="11" class="acc pp" ${delay(i)}/>`+T(x,y+4,"B","s b w","middle"); });
    [[260,100],[300,70],[340,40]].forEach(([x,y],i)=>{ b+=`<circle cx="${x}" cy="${y}" r="11" class="ol pp" ${delay(i+3)}/>`+T(x,y+4,"S","s b","middle"); });
    b+=T(90,152,"buy in steps as it falls","s a","middle")+T(310,152,"sell in steps as it rises","s","middle");
    return svg(160,b); }
});

/* ---------- USA batch 2: Bogle's fee calculator, Marks's temperature, Klarman's three values, Schloss's note ---------- */
const fmtUSD = x => "$"+Math.round(x).toLocaleString("en-US");
function feeOut(){ const F=V4.fee, n=k=>gtNum(F[k]); const a=n("amt"), y=n("yrs"), r=n("ret"), fa=n("fa"), fb=n("fb");
  if([a,y,r,fa,fb].some(v=>v===null) || a<=0 || y<=0 || y>80) return `<p class="small muted">Fill in all five boxes (up to 80 years).</p>`;
  const g=(f)=>a*Math.pow((1+r/100)*(1-f/100), y), A=g(fa), B=g(fb), hi=Math.max(A,B), lo=Math.min(A,B), gap=hi-lo, pct=hi>0?gap/hi*100:0;
  const bar=(v,cls,lab)=>`<div class="fbar"><span>${esc(lab)}</span><div class="fb"><i class="${cls}" style="width:${Math.max(2,v/hi*100).toFixed(1)}%"></i></div><b>${fmtUSD(v)}</b></div>`;
  return bar(A,"a","Fee "+fa+"%")+bar(B,"b","Fee "+fb+"%")+`<p class="verdict">The difference is ${fmtUSD(gap)}: ${Math.round(pct)}% of the larger pot, from a gap of ${Math.abs(fb-fa).toFixed(2).replace(/\.?0+$/,"")} percentage points a year.</p>`; }
function feecalcHTML(p,B){ const F=V4.fee||(V4.fee={amt:"10000",yrs:"30",ret:"7",fa:"0.1",fb:"1.5"});
  const row=(k,l)=>`<div class="qcrow"><label for="fee-${k}">${l}</label><input id="fee-${k}" type="number" inputmode="decimal" step="any" value="${esc(F[k]??"")}"></div>`;
  return `<h3${B.id?` id="${B.id}"`:""}>${esc(B.title)}</h3><div class="qctool">${row("amt","Amount invested ($)")}${row("yrs","Years")}${row("ret","Yearly return before fees (%)")}${row("fa","Low fee (% a year)")}${row("fb","High fee (% a year)")}</div><div id="feeOut">${feeOut()}</div>${B.note?`<p class="note">${esc(B.note)}</p>`:""}`; }
function prState(pid){ V4.pr=V4.pr||{}; return V4.pr[pid]||(V4.pr[pid]={}); }
function pairsHTML(p,B){ const S=prState(p.id), n=B.items.length, ans=Object.keys(S).length, hot=Object.values(S).filter(v=>v===1).length;
  const share=ans?hot/ans:0.5, ang=ans?(share-0.5)*80:0;
  const verdict=!ans?"Tap the side of each pair that sounds more like the market today.":share>=0.75?"Running hot: greed is in charge. On his thinking, this is a time for caution and higher standards.":share<=0.25?"Running cold: fear is in charge. On his thinking, this is when bargains are most likely.":"Somewhere in the middle: neither extreme, so stay balanced.";
  const rows=B.items.map((it,i)=>`<div class="prow">${[0,1].map(s=>`<button data-pr="${p.id}:${i}:${s}" class="${S[i]===s?"on":""}" aria-pressed="${S[i]===s}">${esc(it[s])}</button>`).join("")}</div>`).join("");
  return `<h3${B.id?` id="${B.id}"`:""}>${esc(B.title)}</h3><figure class="dg stgfig">${pendSVG(ang,["Cold: fear","Middle","Hot: greed"])}</figure><div class="lmeter"><div><b>${ans}</b>/${n} answered<div class="bar"><i style="width:${ans/n*100}%"></i></div></div></div><p class="verdict">${esc(verdict)}</p><div class="pairs">${rows}</div>${ans?`<button class="btn ghost" data-prclear="${p.id}">Clear</button>`:""}${B.note?`<p class="note">${esc(B.note)}</p>`:""}`; }
function valOut(){ const V=V4.val||{}, n=k=>gtNum(V[k]); const vals=[n("npv"),n("liq"),n("mkt")].filter(v=>v!==null&&v>0), pr=n("price");
  if(!vals.length) return `<p class="small muted">Enter at least one value estimate per share, and the price.</p>`;
  const lo=Math.min(...vals); let line="";
  if(pr!==null&&pr>0){ const m=1-pr/lo; line = m>=0.33?`<span class="qc ok">Margin of safety: ${Math.round(m*100)}% below your most cautious value</span>`:m>0?`<span class="qc">Margin of ${Math.round(m*100)}%: some room for error, perhaps not enough</span>`:`<span class="qc no">No margin: the price is ${Math.round(-m*100)}% above your most cautious value</span>`; }
  return `<div class="tstats gnstat"><div class="stat"><b>${gtFmt(lo)}</b><span>Most cautious value of the ${vals.length} you entered</span></div></div>${line}<p class="small muted">How big a margin is enough is your judgement; he sets no single number.</p>`; }
function valtoolHTML(p,B){ const V=V4.val||(V4.val={});
  const row=(k,l)=>`<div class="qcrow"><label for="val-${k}">${l}</label><input id="val-${k}" type="number" inputmode="decimal" step="any" value="${esc(V[k]??"")}" placeholder="per share"></div>`;
  return `<h3${B.id?` id="${B.id}"`:""}>${esc(B.title)}</h3><div class="qctool">${row("npv","Value from future cash")}${row("liq","Break-up value")}${row("mkt","What similar firms fetch")}${row("price","Today's share price")}</div><div id="valOut">${valOut()}</div>${B.note?`<p class="note">${esc(B.note)}</p>`:""}`; }
function memoHTML(p,B){ return `<h3${B.id?` id="${B.id}"`:""}>${esc(B.title)}</h3><div class="memo"><div class="memo-h"><span>Factors needed to make money in the stock market</span><span>${esc(B.date||"")}</span></div><ol>${B.items.map(t=>`<li>${esc(t)}</li>`).join("")}</ol></div>${B.note?`<p class="note">${esc(B.note)}</p>`:""}`; }


/* ---------- India: Parikh's bias quiz, the DMart flywheel, and diagrams ---------- */
function rvS(pid){ V4.rv=V4.rv||{}; return V4.rv[pid]||(V4.rv[pid]={}); }
function revealHTML(p,B){ const S=rvS(p.id), N=B.items.length, ans=Object.keys(S).length, right=B.items.filter((it,i)=>S[i]===it.a).length;
  const cards=B.items.map((it,i)=>{ const pick=S[i], done=pick!==undefined;
    const btns=it.opts.map((o,j)=>{ const st=!done?"":j===it.a?"ok":j===pick?"no":""; return `<button data-rv="${p.id}:${i}:${j}" class="${st}" aria-pressed="${pick===j}"${done?" disabled":""}>${done&&j===it.a?"✓ ":""}${esc(o)}</button>`; }).join("");
    return `<div class="rvq"><p class="rvt"><span class="lck">${i+1}</span><span>${esc(it.q)}</span></p><div class="chips rv" role="group" aria-label="Which bias is this?">${btns}</div>${done?`<p class="rvwhy"><b>${pick===it.a?"Right.":"Not quite. It's "+esc(it.opts[it.a].toLowerCase())+"."}</b> ${esc(it.why)}</p>`:""}</div>`; }).join("");
  const verdict = ans<N ? "" : right===N ? "All six. You can spot the traps; the harder part is spotting them in yourself." : right>=4 ? "Most of them. Reread the ones you missed: those are the traps most likely to catch you." : "These traps catch almost everyone. That was his point.";
  return `<div class="box-h"${B.id?` id="${B.id}"`:""}>${esc(B.title)}</div><div class="rvlist">${cards}</div>
    <div class="lmeter"><div><b>${right}</b>/${N} right<div class="bar"><i style="width:${right/N*100}%"></i></div></div></div>${verdict?`<p class="verdict">${esc(verdict)}</p>`:""}${ans?`<button class="btn ghost" data-rvclear="${p.id}">Start again</button>`:""}${B.note?`<p class="note">${esc(B.note)}</p>`:""}`; }
const FLY=["Buy direct, pay fast","Own the stores","Low costs","Low prices","More shoppers","Buying power"];
function flySVG(k){ const cx=200, cy=124, a=150, bb=100; let b=`<ellipse cx="${cx}" cy="${cy}" rx="${a}" ry="${bb}" fill="none" class="lr" stroke-dasharray="5 5"/>`;
  for(let i=0;i<6;i++){ const th=(-90+60*i+30)*Math.PI/180, x=cx+a*Math.cos(th), y=cy+bb*Math.sin(th), dx=-a*Math.sin(th), dy=bb*Math.cos(th), ang=Math.atan2(dy,dx)*180/Math.PI;
    b+=`<path d="M6,0 L-5,-5 L-5,5 Z" class="acc" transform="translate(${x.toFixed(1)},${y.toFixed(1)}) rotate(${ang.toFixed(1)})"/>`; }
  FLY.forEach((t,i)=>{ const th=(-90+60*i)*Math.PI/180, x=cx+a*Math.cos(th), y=cy+bb*Math.sin(th), on=k===i;
    b+=`<rect x="${(x-63).toFixed(1)}" y="${(y-15).toFixed(1)}" width="126" height="30" rx="15" class="${on?"acc":"soft"} pp" ${delay(i)}/>`+T(x,y+5,t,on?"b w":"b","middle"); });
  b+=T(cx,cy-4,"Each turn","s","middle")+T(cx,cy+13,"a little faster","s b a","middle");
  return svg(250,b); }
function cycleHTML(p,B){ V4.cy=V4.cy||{}; const n=B.items.length, k=V4.cy[p.id]??0, it=B.items[k];
  return `<h3${B.id?` id="${B.id}"`:""}>${esc(B.title)}</h3><figure class="dg stgfig">${flySVG(k)}</figure>
    <div class="chips stg" role="group" aria-label="Steps of the flywheel">${B.items.map((s,i)=>`<button data-cy="${p.id}:${i}" class="${i===k?"on":""}" aria-pressed="${i===k}">${i+1}. ${esc(s[0])}</button>`).join("")}</div>
    <div class="stgcard"><div class="box-h">Step ${k+1} of ${n}: what DMart does</div><p>${esc(it[1])}</p><div class="box-h">Why it matters</div><p><b>${esc(it[2])}</b></p><p class="small"><button class="golink" data-cy="${p.id}:${(k+1)%n}">${k+1<n?"Next step ›":"Back to step 1 ›"}</button></p></div>${B.note?`<p class="note">${esc(B.note)}</p>`:""}`; }
Object.assign(DIAG,{
  fera(){ const bar=(y,f,lab,sub)=>T(0,y,lab,"s b")+`<rect x="0" y="${y+8}" width="380" height="24" rx="12" class="soft"/>`+`<rect x="0" y="${y+8}" width="${380*f}" height="24" rx="12" class="ink pp"/>`+T(8,y+25,"Foreign parent","b w")+(f<1?T(372,y+25,"Indian shareholders","b a","end"):"")+(sub?T(0,y+50,sub,"s"):"");
    let b=bar(14,1,"Before: the foreign parent owns most of the Indian company","");
    b+=`<line x1="200" y1="52" x2="200" y2="72" class="la"/><path d="M200,78 l-6,-9 h12 z" class="acc"/>`+T(210,70,"1973: FERA","b a");
    b+=bar(96,0.46,"After: it must sell part of its stake to Indians","Often at prices below what the business was worth");
    return svg(158,b); },
  growth3(){ const W=120, G=20, H=96, top=26; let b="";
    const panel=(i,name,lines,tag)=>{ const x0=i*(W+G); let s=`<rect x="${x0}" y="${top}" width="${W}" height="${H}" rx="10" class="soft"/>`+T(x0+W/2,16,name,i===0?"b a":"b","middle");
      lines.forEach(([pts,cls,lab],j)=>{ s+=`<polyline points="${pts.map(([u,v])=>`${(x0+8+u*(W-16)).toFixed(1)},${(top+H-8-v*(H-16)).toFixed(1)}`).join(" ")}" fill="none" class="${cls}" style="stroke-width:2.4"/>`; });
      return s+T(x0+W/2,top+H+16,tag,"s","middle"); };
    b+=panel(0,"Muscle",[[[[0,.1],[1,.85]],"la"],[[[0,.05],[1,.7]],"ln"]],"sales and cash rise");
    b+=panel(1,"Fat",[[[[0,.1],[1,.85]],"la"],[[[0,.3],[1,.3]],"ln"]],"sales up, profit flat");
    b+=panel(2,"Cancer",[[[[0,.1],[1,.85]],"la"],[[[0,.5],[1,.02]],"ln"]],"growth eats the cash");
    b+=`<line x1="0" y1="150" x2="18" y2="150" class="la" style="stroke-width:2.4"/>`+T(24,154,"sales","s")+`<line x1="80" y1="150" x2="98" y2="150" class="ln" style="stroke-width:2.4"/>`+T(104,154,"profit and cash","s");
    return svg(160,b); },
  herd(){ let b="";
    for(let i=0;i<24;i++){ const x=40+(i%8)*26+((i/8|0)%2)*10, y=36+(i/8|0)*22; b+=`<circle cx="${x}" cy="${y}" r="7" class="soft pp" style="animation-delay:${(i*.02).toFixed(2)}s"/>`; }
    b+=`<line x1="250" y1="58" x2="330" y2="58" class="ln"/><path d="M338,58 l-9,-5 v10 z" class="ink"/>`+T(396,44,"The crowd buys what's rising","s","end");
    b+=`<circle cx="300" cy="118" r="9" class="acc pp"/><line x1="286" y1="118" x2="196" y2="118" class="la"/><path d="M188,118 l9,-5 v10 z" class="acc"/>`+T(396,144,"The patient investor walks the other way","s b a","end");
    return svg(154,b); },
  farm(){ const st=[["Plant","Year 1"],["Tend","Years 2–4"],["Wait","Bad years too"],["Harvest","Year 5 and on"]]; let b="";
    st.forEach(([a,c],i)=>{ const x=50+i*100, h=[8,22,38,60][i];
      b+=`<line x1="${x}" y1="96" x2="${x}" y2="${96-h}" class="la" style="stroke-width:3"/>`;
      if(i>0) b+=`<ellipse cx="${x-7}" cy="${96-h*.55}" rx="8" ry="4" class="acc"/><ellipse cx="${x+7}" cy="${96-h*.75}" rx="8" ry="4" class="acc"/>`;
      if(i===3) b+=`<circle cx="${x}" cy="${96-h-6}" r="8" class="ink pp"/>`;
      b+=T(x,118,a,"b","middle")+T(x,134,c,"s","middle"); });
    b+=`<line x1="0" y1="96" x2="400" y2="96" class="lr"/>`+T(200,16,"You cannot sow today and reap tomorrow","s b","middle");
    return svg(142,b); },
  pond(){ let b=`<circle cx="88" cy="80" r="52" class="soft"/><circle cx="88" cy="80" r="16" class="ink pp"/>`+T(88,150,"Biggest fish, small pond","s b","middle");
    b+=`<rect x="190" y="22" width="206" height="116" rx="16" class="soft fd"/>`;
    for(let i=0;i<5;i++) b+=`<circle cx="${220+i*38}" cy="${48+(i%2)*40}" r="${[10,22,8,30,14][i]}" class="ink pp" style="opacity:.35"/>`;
    b+=`<circle cx="262" cy="104" r="7" class="acc pp"/>`+T(293,150,"Small fish, big sea: room to grow","s b a","middle");
    return svg(158,b); },
  flywheel(){ return flySVG(null); },
  ownrent(){ const X=t=>20+t*24, rent=t=>t*(1+t*0.05)*5, own=t=>70+t*2.2, Y=v=>150-v;
    const pr=[...Array(16)].map((_,t)=>`${X(t)},${Y(rent(t)).toFixed(1)}`).join(" "), po=[...Array(16)].map((_,t)=>`${X(t)},${Y(own(t)).toFixed(1)}`).join(" ");
    let b=`<polyline points="${pr}" fill="none" class="ln" style="stroke-width:2.4"/><polyline points="${po}" fill="none" class="la" style="stroke-width:2.6"/>`;
    b+=`<line x1="20" y1="150" x2="380" y2="150" class="lr"/>`+T(20,166,"Year 0","s")+T(380,166,"Year 15","s","end");
    b+=`<line x1="0" y1="188" x2="18" y2="188" class="ln" style="stroke-width:2.4"/>`+T(24,192,"Renting: rises every year","s")+`<line x1="196" y1="188" x2="214" y2="188" class="la" style="stroke-width:2.6"/>`+T(220,192,"Owning: paid once, then upkeep","s b a");
    b+=T(20,12,"Total cost of a store over time (an illustration)","s");
    return svg(198,b); }
});

/* ---------- Japan: Honda's snowball, and diagrams ---------- */
const fmtJPY = x => "¥"+Math.round(x).toLocaleString("en-US");
function snowOut(){ const S=V4.snow, n=k=>gtNum(S[k]); const pay=n("pay"), bon=n("bon")||0, yrs=n("yrs"), ret=n("ret");
  if([pay,yrs,ret].some(v=>v===null) || pay<=0 || yrs<=0 || yrs>60 || ret<0 || ret>30) return `<p class="small muted">Fill in monthly pay, years (up to 60) and a yearly return.</p>`;
  const r=ret/100, add=pay*12/4+bon; let pot=0, cross=null;
  for(let y=1;y<=yrs;y++){ pot=pot*(1+r)+add; if(cross===null && pot*r>=pay*12) cross=y; }
  const inc=pot*r, share=inc/(pay*12)*100, saved=add*yrs;
  return `<div class="tstats gnstat"><div class="stat"><b>${fmtJPY(pot)}</b><span>Your pot after ${yrs} years (you put in ${fmtJPY(saved)})</span></div><div class="stat"><b>${fmtJPY(inc)}</b><span>What it could earn in a year at ${ret}%</span></div></div>
    <p class="verdict">${share>=100?`The pot's yearly earnings pass your yearly pay${cross?` in year ${cross}`:""}: his age-40 milestone.`:`The pot's yearly earnings would be ${Math.round(share)}% of your yearly pay.`}</p>`; }
function snowballHTML(p,B){ const S=V4.snow||(V4.snow={pay:"300000",bon:"0",yrs:"15",ret:"6"});
  const row=(k,l)=>`<div class="qcrow"><label for="snow-${k}">${l}</label><input id="snow-${k}" type="number" inputmode="decimal" step="any" value="${esc(S[k]??"")}"></div>`;
  return `<h3${B.id?` id="${B.id}"`:""}>${esc(B.title)}</h3><p>Save a quarter of your monthly pay and every bonus, and let it grow.</p><div class="qctool snow">${row("pay","Monthly take-home pay (¥)")}${row("bon","Bonuses saved per year (¥)")}${row("yrs","Years")}${row("ret","Yearly return (%)")}</div><div id="snowOut">${snowOut()}</div>${B.note?`<p class="note">${esc(B.note)}</p>`:""}`; }
Object.assign(DIAG,{
  quarter(){ const cx=96, cy=84, r=64; let b=`<circle cx="${cx}" cy="${cy}" r="${r}" class="soft"/>`;
    b+=`<path d="M${cx},${cy} L${cx},${cy-r} A${r},${r} 0 0 1 ${cx+r},${cy} Z" class="acc pp"/>`;
    b+=T(cx+30,cy-24,"¼","b w","middle")+T(cx-18,cy+22,"¾","b","middle");
    b+=T(190,52,"Pay day: a quarter goes","b a")+T(190,72,"to savings first","b a")+T(190,104,"Bonuses and windfalls:","s")+T(190,122,"all of it saved","s")+T(190,150,"Live on the other three quarters","s");
    return svg(164,b); },
  snowball(){ let b=`<line x1="10" y1="140" x2="390" y2="140" class="lr"/>`; const xs=[30,82,150,240,345], rs=[6,11,18,28,42];
    xs.forEach((x,i)=>{ b+=`<circle cx="${x}" cy="${140-rs[i]}" r="${rs[i]}" class="${i===4?"acc":"soft"} pp" ${delay(i)}/>`; });
    ["Year 1","5","10","15","Age 40"].forEach((t,i)=>{ b+=T(xs[i],158,t,i===4?"s b a":"s","middle"); });
    b+=T(10,16,"A small core of savings, rolled for years, grows on its own","s");
    return svg(166,b); },
  danna(){ const box=(x,y,w,t,cls)=>`<rect x="${x}" y="${y}" width="${w}" height="36" rx="18" class="${cls} pp"/>`+T(x+w/2,y+23,t,cls==="acc"?"b w":"b","middle");
    let b=box(10,40,130,"Shareholder","soft")+box(260,40,130,"Company","acc");
    b+=`<line x1="146" y1="50" x2="248" y2="50" class="la"/><path d="M254,50 l-9,-5 v10 z" class="acc"/>`+T(200,34,"patience, encouragement","s a","middle");
    b+=`<line x1="254" y1="68" x2="152" y2="68" class="ln"/><path d="M146,68 l9,-5 v10 z" class="ink"/>`+T(200,92,"dividends, and thanks in gold","s","middle");
    b+=T(200,124,"Danna (旦那): the patron who stands behind the business","s b","middle");
    return svg(134,b); },
  harvest(){ const X=i=>30+i*34, pr=[60,38,72,30,84,52,95,46,70,40], dv=[14,15,15,16,16,17,17,18,19,20];
    let b=`<line x1="14" y1="150" x2="386" y2="150" class="lr"/>`;
    dv.forEach((d,i)=>{ b+=`<rect x="${X(i)-9}" y="${150-d*2.4}" width="18" height="${d*2.4}" rx="3" class="acc pp" ${delay(i)}/>`; });
    b+=`<polyline points="${pr.map((v,i)=>`${X(i)},${108-v*0.85}`).join(" ")}" fill="none" class="ln" style="stroke-width:2.2"/>`;
    b+=`<line x1="14" y1="172" x2="32" y2="172" class="ln" style="stroke-width:2.2"/>`+T(38,176,"Price of the land (shares): up and down","s");
    b+=`<rect x="16" y="184" width="14" height="12" rx="3" class="acc"/>`+T(38,194,"The harvest (dividends): every year","s b a");
    return svg(202,b); },
  updown(){ const X=i=>24+i*36, pr=[60,72,86,100,112,92,70,52,46,58];
    let b=`<polyline points="${pr.map((v,i)=>`${X(i)},${150-v}`).join(" ")}" fill="none" class="ln" style="stroke-width:2.4"/>`;
    [2,3,4].forEach(i=>{ b+=`<circle cx="${X(i)}" cy="${150-pr[i]}" r="7" class="ink pp"/>`; });
    [6,7,8].forEach(i=>{ b+=`<circle cx="${X(i)}" cy="${150-pr[i]}" r="7" class="acc pp"/>`; });
    b+=`<line x1="14" y1="150" x2="386" y2="150" class="lr"/>`;
    b+=`<circle cx="20" cy="170" r="6" class="ink"/>`+T(32,174,"the crowd buys as prices rise","s")+`<circle cx="20" cy="190" r="6" class="acc"/>`+T(32,194,"the long-term investor buys as prices fall","s b a");
    return svg(202,b); }
});

/* ---------- World: diagrams ---------- */
Object.assign(DIAG,{
  hedge(){ const X=i=>30+i*36; let b=`<line x1="14" y1="120" x2="386" y2="120" class="lr"/>`;
    for(let i=0;i<9;i++){ const bad=i===7; const h=bad?96:10; b+=`<rect x="${X(i)-10}" y="${bad?120-h:120}" width="20" height="${h}" rx="3" class="${bad?"acc":"ink"} pp" style="${bad?"":"opacity:.35"}" ${delay(i)}/>`; }
    b+=T(X(7),14,"the crisis year","s b a","middle")+T(14,146,"Small cost every year (grey) … one big payout when disaster strikes","s");
    return svg(156,b); },
  egg(){ const cx=200, cy=100, rx=105, ry=72, k=Math.SQRT1_2; let b=`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" class="ln" style="stroke-width:2;opacity:.5"/>`;
    const P=[["A1","correction",cx-rx*k,cy+ry*k,"end","a"],["A2","accompanying",cx-rx,cy,"end",""],["A3","exaggeration",cx-rx*k,cy-ry*k,"end","i"],
             ["B1","correction",cx+rx*k,cy-ry*k,"start","i"],["B2","accompanying",cx+rx,cy,"start",""],["B3","exaggeration",cx+rx*k,cy+ry*k,"start","a"]];
    P.forEach(([c,t,x,y,an,tone],i)=>{ const dx=(an==="end"?-1:1)*(c.endsWith("2")?9:16); b+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" class="${tone==="a"?"acc":"ink"} pp" style="${tone===""?"opacity:.4":""}" ${delay(i)}/>`;
      b+=T(x+dx,y-2,c,tone==="a"?"s b a":tone==="i"?"s b":"s b",an)+T(x+dx,y+11,t,"s",an); });
    b+=T(cx,cy-6,"Buy: B3, A1","s b a","middle")+T(cx,cy+12,"Sell: A3, B1","s b","middle");
    b+=T(cx,cy-ry-8,"top: euphoria","s","middle")+T(cx,cy+ry+16,"bottom: panic","s","middle");
    b+=T(30,214,"Left: prices rising ↑","s")+T(370,214,"Right: prices falling ↓","s","end");
    return svg(222,b); },
  dogwalk(){ const X=i=>20+i*18, eco=i=>110-i*3.2, dog=[0,14,-10,26,-22,8,30,-4,-28,12,34,-16,4,24,-12,0,18,-20,10,0];
    let b=`<polyline points="${dog.map((d,i)=>`${X(i)},${(eco(i)-d).toFixed(1)}`).join(" ")}" fill="none" class="ln" style="stroke-width:2"/>`;
    b+=`<line x1="${X(0)}" y1="${eco(0)}" x2="${X(19)}" y2="${eco(19)}" class="la" style="stroke-width:3"/>`;
    b+=`<line x1="14" y1="150" x2="32" y2="150" class="la" style="stroke-width:3"/>`+T(38,154,"The owner: the economy, walking steadily","s b a");
    b+=`<line x1="14" y1="170" x2="32" y2="170" class="ln" style="stroke-width:2"/>`+T(38,174,"The dog: share prices, running ahead and behind","s");
    return svg(182,b); },
  divtree(){ const X=i=>40+i*80; let b=`<line x1="14" y1="140" x2="386" y2="140" class="lr"/>`;
    [0,1,2,3,4].forEach(i=>{ const h=24+i*22; b+=`<rect x="${X(i)-16}" y="${140-h}" width="32" height="${h}" rx="5" class="${i===4?"acc":"ink"} pp" style="${i===4?"":"opacity:."+(3+i)}" ${delay(i)}/>`;
      b+=`<circle cx="${X(i)}" cy="${140-h-12}" r="${5+i*2}" class="acc pp" style="opacity:.55" ${delay(i)}/>`; b+=T(X(i),158,["Year 1","Year 5","Year 10","Year 20","Year 30"][i],i===4?"s b a":"s","middle"); });
    b+=T(14,14,"Shares (bars) and yearly dividends (dots), all reinvested","s");
    return svg(166,b); },
  crowd(){ let b=""; for(let i=0;i<14;i++){ const x=40+(i%7)*26, y=46+Math.floor(i/7)*34; b+=`<circle cx="${x}" cy="${y}" r="9" class="ink pp" style="opacity:.35" ${delay(i%7)}/>`; }
    b+=`<line x1="230" y1="62" x2="196" y2="62" class="ln"/><path d="M190,62 l9,-5 v10 z" class="ink"/>`+T(120,112,"The crowd rushes to the popular","s","middle");
    b+=`<circle cx="330" cy="62" r="11" class="acc pp"/>`+`<line x1="262" y1="62" x2="312" y2="62" class="la"/><path d="M318,62 l-9,-5 v10 z" class="acc"/>`+T(330,112,"The contrarian goes where it left","s b a","middle");
    return svg(124,b); },
  asym(){ let b=`<line x1="14" y1="120" x2="160" y2="120" class="lr"/>`;
    b+=`<rect x="34" y="104" width="34" height="16" rx="4" class="ink pp" style="opacity:.55"/>`+T(51,98,"risk 1","s b","middle");
    b+=`<rect x="98" y="40" width="34" height="80" rx="4" class="acc pp"/>`+T(115,34,"aim for 5","s b a","middle")+T(84,140,"One trade","s","middle");
    const R=[-1,-1,5,-1,-1], X=i=>210+i*36; b+=`<line x1="196" y1="90" x2="386" y2="90" class="lr"/>`;
    R.forEach((r,i)=>{ const h=Math.abs(r)*14; b+=`<rect x="${X(i)-12}" y="${r>0?90-h:90}" width="24" height="${h}" rx="3" class="${r>0?"acc":"ink"} pp" style="${r>0?"":"opacity:.45"}" ${delay(i)}/>`+T(X(i),r>0?90-h-6:90+h+12,(r>0?"+":"")+r,"s b"+(r>0?" a":""),"middle"); });
    b+=T(282,140,"Five trades: one win, four losses","s","middle")+T(282,154,"5 − 4 = +1: still ahead","s b a","middle");
    return svg(160,b); },
  ma200(){ const N=40, X=i=>20+i*9.2, px=[60,64,62,68,72,70,76,80,78,84,88,86,90,92,88,84,86,80,76,72,74,68,62,58,60,54,50,52,48,46,50,54,58,62,66,70,74,78,82,86];
    const ma=px.map((_,i)=>{ const a=px.slice(Math.max(0,i-9),i+1); return a.reduce((x,y)=>x+y,0)/a.length; }), Y=v=>132-(v-40)*1.9;
    let b=""; let inD=false, s0=0; px.forEach((v,i)=>{ const d=v<ma[i]; if(d&&!inD){inD=true;s0=i;} if((!d||i===N-1)&&inD){ inD=false; b+=`<rect x="${X(s0)-4}" y="20" width="${X(i)-X(s0)}" height="116" class="ink" style="opacity:.08"/>`; } });
    b+=`<polyline points="${px.map((v,i)=>`${X(i)},${Y(v).toFixed(1)}`).join(" ")}" fill="none" class="ln" style="stroke-width:2"/>`;
    b+=`<polyline points="${ma.map((v,i)=>`${X(i)},${Y(v).toFixed(1)}`).join(" ")}" fill="none" class="la" style="stroke-width:2.6"/>`;
    b+=T(20,14,"Price (thin) and its long-term average (thick)","s")+T(X(25),34,"below the line: defence","s b","middle")+T(X(9),34,"above: offence","s b a","middle");
    return svg(140,b); },
  stages(){ const pts=[[14,118],[60,112],[110,116],[150,110],[190,84],[230,54],[262,40],[290,36],[316,42],[340,40],[362,70],[386,112]];
    const zones=[[14,150,"1 Resting"],[150,262,"2 Rising"],[262,340,"3 Topping"],[340,386,"4 Falling"]]; let b="";
    zones.forEach(([a,c,t],i)=>{ b+=`<rect x="${a}" y="18" width="${c-a}" height="112" class="${i===1?"acc":"ink"}" style="opacity:${i===1?.14:.05}"/>`+T((a+c)/2,146,t,i===1?"s b a":"s","middle"); });
    b+=`<polyline points="${pts.map(p=>p.join(",")).join(" ")}" fill="none" class="ln" style="stroke-width:2.4"/>`+T(206,14,"he buys only here","s b a","middle");
    return svg(156,b); },
  vcp(){ const pts=[[10,136],[60,82],[100,40],[130,96],[160,42],[182,76],[206,43],[222,62],[240,44],[256,53],[270,43],[300,18],[330,10]];
    let b=`<polyline points="${pts.map(p=>p.join(",")).join(" ")}" fill="none" class="ln" style="stroke-width:2.4"/>`;
    b+=`<line x1="96" y1="40" x2="276" y2="40" class="la" style="stroke-dasharray:4 4"/>`+T(250,32,"pivot","s b a","middle");
    [[130,"−25%",96],[182,"−15%",76],[222,"−8%",62],[256,"−3%",53]].forEach(([x,t,y],i)=>{ b+=T(x,y+14,t,"s b","middle")+T(x,y+26,"T"+(i+1),"s","middle"); });
    [26,22,18,15,12,10,8,6,5,4,14,20].forEach((h,i)=>{ const x=40+i*24; b+=`<rect x="${x}" y="${150-h}" width="14" height="${h}" rx="2" class="${i>=10?"acc":"ink"} pp" style="${i>=10?"":"opacity:.35"}" ${delay(i%6)}/>`; });
    b+=T(10,166,"Volume: drying up, then a surge on the breakout","s")+T(316,10,"breakout","s b a","middle");
    return svg(172,b); },
  lossmath(){ const rows=[[10,11.1],[20,25],[30,42.9],[50,100],[75,300]]; let b="";
    rows.forEach(([l,g],i)=>{ const y=10+i*28, w=Math.max(4,200*g/300); b+=T(0,y+14,"Lose "+l+"%","s b")+`<rect x="74" y="${y+2}" width="${w.toFixed(1)}" height="16" rx="5" class="${l<=10?"acc":"ink"} pp" style="${l<=10?"":"opacity:.5"}" ${delay(i)}/>`+T(80+w,y+15,"need +"+(g%1?g.toFixed(1):g)+"%","s b"+(l<=10?" a":"")); });
    return svg(152,b); },
  liq(){ const box=(x,y,w,t,cls)=>`<rect x="${x}" y="${y}" width="${w}" height="34" rx="9" class="soft pp" style="${cls==="acc"?"stroke:var(--accent);stroke-width:2":cls==="ink"?"opacity:.55":""}"/>`+T(x+w/2,y+21,t,"s b"+(cls==="acc"?" a":""),"middle");
    let b=box(10,20,110,"Central bank","acc")+box(150,20,120,"Money in the system","soft")+box(300,20,90,"Whole market","ink");
    b+=`<line x1="120" y1="37" x2="146" y2="37" class="la"/><path d="M148,37 l-8,-5 v10 z" class="acc"/><line x1="270" y1="37" x2="296" y2="37" class="la"/><path d="M298,37 l-8,-5 v10 z" class="acc"/>`;
    b+=box(150,92,120,"Company earnings","ink")+box(300,92,90,"One share","ink");
    b+=`<line x1="270" y1="109" x2="296" y2="109" class="ln" style="stroke-dasharray:4 3"/><line x1="210" y1="92" x2="300" y2="60" class="ln" style="stroke-dasharray:3 4;opacity:.5"/>`;
    b+=T(205,148,"Earnings matter for one share; money flows move the whole market","s","middle");
    return svg(156,b); },
  bw92(){ return trRateSVG([{s:"15 Sep",r:10},{s:"Morning",r:10},{s:"11am",r:12},{s:"Afternoon",r:15},{s:"7.40pm",r:12},{s:"17 Sep",r:10}], null); },
  nq(){ return trNqSVG([["Jan '99",2208.05],["Dec '99",4069.31],["10 Mar '00",5048.62],["Dec '00",2470.52],["Oct '02",1114.11]]); },
  netnet(){ const bar=(x,h,t,cls)=>`<rect x="${x}" y="${130-h}" width="70" height="${h}" rx="6" class="${cls} pp"/>`+T(x+35,146,t,"s","middle");
    let b=bar(80,40,"Share price","ink")+bar(190,92,"Liquidation","acc")+bar(300,106,"Going concern","soft");
    b+=`<line x1="115" y1="86" x2="115" y2="40" class="la" style="stroke-dasharray:4 3"/><line x1="115" y1="38" x2="188" y2="38" class="la" style="stroke-dasharray:4 3"/>`;
    b+=T(10,58,"margin","s b a")+T(10,72,"of safety","s b a");
    b+=T(200,12,"He paid 40 to 50 cents for a dollar of assets","s b","middle");
    return svg(156,b); }
});

/* ---------- Traders: track-record charts, risk banner, risk-reward calculator ---------- */
V4.tr = V4.tr || {bw:0, tab:"value", i:null, rr:{w:"30", r:"5", k:"1"}, tt:{p:"52",m50:"47",m150:"41",m200:"38",m200a:"36",hi:"55",lo:"30",rs:"85"}};
const MON3=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function trSeries(rec){ if(rec._s) return rec._s; const out=[]; let v=rec.start||1000, pk=v;
  Object.keys(rec.monthly).sort().forEach(y=>rec.monthly[y].forEach((r,m)=>{ if(r===null) return; v*=1+r/100; if(v>pk) pk=v; out.push({y:+y,m,r,v,dd:(v/pk-1)*100}); }));
  return rec._s=out; }
function trStats(rec){ const S=trSeries(rec), yrs=S.length/12, fin=S[S.length-1].v, st=rec.start||1000;
  const cagr=(Math.pow(fin/st,1/yrs)-1)*100, mdd=Math.min(...S.map(x=>x.dd)), up=S.filter(x=>x.r>0).length/S.length*100;
  const A=rec.annual, ys=Object.keys(A), best=ys.reduce((a,b)=>A[b]>A[a]?b:a), worst=ys.reduce((a,b)=>A[b]<A[a]?b:a);
  return {fin, cagr, mdd, up, best, worst, A, n:S.length}; }
const fmtM=x=>"$"+Math.round(x).toLocaleString("en-US"), pct=(x,d=1)=>(x>0?"+":"")+x.toFixed(d)+"%";
function trEquitySVG(rec){ const S=trSeries(rec), W=400, H=190, L=34, R=8, Tp=14, B=26, n=S.length, tab=V4.tr.tab;
  const X=i=>L+(W-L-R)*i/(n-1);
  let b="", ys, Y;
  if(tab==="value"){ const lo=Math.log(rec.start||1000), hi=Math.log(Math.max(...S.map(x=>x.v))*1.05); Y=v=>Tp+(H-Tp-B)*(1-(Math.log(v)-lo)/(hi-lo));
    ys=[1000,2000,4000,8000,16000].filter(v=>Math.log(v)<=hi);
    ys.forEach(v=>{ b+=`<line x1="${L}" y1="${Y(v).toFixed(1)}" x2="${W-R}" y2="${Y(v).toFixed(1)}" class="lr" style="opacity:.5"/>`+T(L-4,Y(v)+3,"$"+(v/1000)+"k","s","end"); });
    b+=`<path d="M${X(0)},${Y(S[0].v)} ${S.map((p,i)=>`L${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ")}" fill="none" class="la" style="stroke-width:2.2"/>`; }
  else { const lo=Math.min(...S.map(x=>x.dd))*1.15; Y=d=>Tp+(H-Tp-B)*(d/lo);
    [0,-5,-10,-15].filter(d=>d>=lo).forEach(d=>{ b+=`<line x1="${L}" y1="${Y(d).toFixed(1)}" x2="${W-R}" y2="${Y(d).toFixed(1)}" class="lr" style="opacity:.5"/>`+T(L-4,Y(d)+3,d+"%","s","end"); });
    b+=`<path d="M${X(0)},${Y(0)} ${S.map((p,i)=>`L${X(i).toFixed(1)},${Y(p.dd).toFixed(1)}`).join(" ")} L${X(n-1)},${Y(0)} Z" class="ink" style="opacity:.25"/>`; }
  let lastY=null; S.forEach((p,i)=>{ if(p.m===0 && p.y%2===1 && p.y!==lastY){ lastY=p.y; b+=T(X(i),H-8,String(p.y),"s","middle"); } });
  const i=V4.tr.i==null?n-1:Math.min(V4.tr.i,n-1), p=S[i];
  b+=`<line x1="${X(i).toFixed(1)}" y1="${Tp}" x2="${X(i).toFixed(1)}" y2="${H-B}" class="ln" style="opacity:.5"/><circle cx="${X(i).toFixed(1)}" cy="${(tab==="value"?Y(p.v):Y(p.dd)).toFixed(1)}" r="4.5" class="acc"/>`;
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${tab==="value"?"Growth of $1,000 in the fund, month by month":"How far the fund was below its previous high, month by month"}">${b}</svg>`; }
function trReadout(rec){ const S=trSeries(rec), n=S.length, i=V4.tr.i==null?n-1:Math.min(V4.tr.i,n-1), p=S[i];
  return `<div class="trread"><span><b>${MON3[p.m]} ${p.y}</b></span><span>Value <b>${fmtM(p.v)}</b></span><span>Month <b class="${p.r<0?"neg":"pos"}">${pct(p.r,2)}</b></span><span>Below peak <b>${p.dd.toFixed(1)}%</b></span></div>`; }
function trBarsSVG(rec){ const A=rec.annual, Bm=rec.bench, ys=Object.keys(Bm).sort(), W=400, H=200, L=30, R=6, Tp=12, B=28;
  const all=ys.flatMap(y=>[A[y],Bm[y]]), hi=Math.max(...all,0)*1.1, lo=Math.min(...all,0)*1.1, Y=v=>Tp+(H-Tp-B)*(hi-v)/(hi-lo), bw=(W-L-R)/ys.length;
  let b=`<line x1="${L}" y1="${Y(0).toFixed(1)}" x2="${W-R}" y2="${Y(0).toFixed(1)}" class="lr"/>`;
  [-20,0,20,40].filter(v=>v<=hi&&v>=lo).forEach(v=>{ b+=T(L-4,Y(v)+3,v+"%","s","end"); });
  ys.forEach((y,k)=>{ const x=L+k*bw; const f=A[y], s2=Bm[y];
    const rect=(xx,v,cls,st)=>`<rect x="${xx.toFixed(1)}" y="${Math.min(Y(v),Y(0)).toFixed(1)}" width="${(bw*0.36).toFixed(1)}" height="${Math.abs(Y(v)-Y(0)).toFixed(1)}" rx="2" class="${cls} pp" style="${st||""}" ${delay(k%8)}/>`;
    b+=rect(x+bw*0.1,f,"acc")+rect(x+bw*0.5,s2,"ink","opacity:.45");
    if(k%2===0) b+=T(x+bw/2,H-12,"'"+y.slice(2),"s","middle"); });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Fund and S&P 500 returns, year by year">${b}</svg>`; }
function trHeat(rec){ const Mo=rec.monthly, ys=Object.keys(Mo).sort();
  const cell=r=>{ if(r===null) return `<td class="hm0"></td>`; const a=Math.min(Math.abs(r)/12,1), c=r>=0?`rgba(46,107,79,${0.15+0.85*a})`:`rgba(178,58,46,${0.15+0.85*a})`, w=a>0.55;
    return `<td style="background:${c};color:${w?"#fff":"inherit"}" title="${r}%">${r.toFixed(1)}</td>`; };
  return `<div class="tw hmw"><table class="hm"><thead><tr><th></th>${MON3.map(m=>`<th>${m[0]}</th>`).join("")}<th>Yr</th></tr></thead><tbody>${ys.map(y=>`<tr><th>'${y.slice(2)}</th>${Mo[y].map(cell).join("")}<td class="hmy">${rec.annual[y]!=null?rec.annual[y].toFixed(1):"…"}</td></tr>`).join("")}</tbody></table></div>`; }
function trCrashSVG(pts){ const W=400, H=170, L=40, R=10, Tp=16, B=30, vs=pts.map(p=>p[1]), hi=Math.max(...vs)*1.04, lo=Math.min(...vs)*0.88, Y=v=>Tp+(H-Tp-B)*(hi-v)/(hi-lo), X=i=>L+(W-L-R)*i/(pts.length-1);
  let b=""; [1800,2200,2600].forEach(v=>{ if(v<hi&&v>lo) b+=`<line x1="${L}" y1="${Y(v)}" x2="${W-R}" y2="${Y(v)}" class="lr" style="opacity:.5"/>`+T(L-4,Y(v)+3,v.toLocaleString("en-US"),"s","end"); });
  const n=pts.length, an=i=>i===0?"start":i===n-1?"end":"middle";
  b+=`<polyline points="${pts.slice(0,n-1).map((p,i)=>`${X(i)},${Y(p[1]).toFixed(1)}`).join(" ")}" fill="none" class="ln" style="stroke-width:2.4"/>`;
  b+=`<line x1="${X(n-2)}" y1="${Y(pts[n-2][1]).toFixed(1)}" x2="${X(n-1)}" y2="${Y(pts[n-1][1]).toFixed(1)}" class="ln" style="stroke-width:2;stroke-dasharray:4 4"/>`;
  const mn=Math.min(...vs);
  pts.forEach((p,i)=>{ const y=Y(p[1]); if(p[1]===mn){ b+=`<circle cx="${X(i)}" cy="${y.toFixed(1)}" r="5" class="ink pp"/>`+T(X(i),H-14,p[0],"s","middle")+T(X(i),y+18,p[1].toLocaleString("en-US"),"s b","middle"); return; } const low=i>0&&i<n-1&&p[1]<pts[i-1][1]; b+=`<circle cx="${X(i)}" cy="${y.toFixed(1)}" r="5" class="${i===n-1?"acc":"ink"} pp"/>`+T(X(i)+(i===0?-4:i===n-1?4:0),H-14,p[0],"s",an(i))+T(X(i)+(i===0?-4:i===n-1?4:low?10:-10),low?y+4:y-10,p[1].toLocaleString("en-US"),"s b",low?"start":i===0?"start":i===n-1?"end":"end"); });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Dow Jones index closing levels at key dates, August 1987 to August 1989"><title>The dashed line covers almost two years</title>${b}</svg>`; }
function trErasSVG(eras){ const W=400, H=128, L=10, mx=Math.max(...eras.map(e=>e[1]))*1.2, bh=30;
  let b=""; eras.forEach((e,i)=>{ const y=18+i*56, w=(W-L-120)*e[1]/mx; b+=T(L,y-4,e[0],"s b")+`<rect x="${L}" y="${y}" width="${w.toFixed(1)}" height="${bh}" rx="6" class="${i===0?"acc":"ink"} pp" style="${i===0?"":"opacity:.45"}"/>`+T(L+w+8,y+20,"about "+e[1]+"% a year","s b"); });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Average yearly returns in two eras">${b}</svg>`; }
const fmK=v=>v>=1e6?"$"+(v/1e6).toFixed(2)+"m":"$"+Math.round(v/1000)+"k";
function trRaceSVG(rec){ const W=400,H=200,L=44,R=14,Tp=16,B=28, pts=rec.race, lab=pts.map(p=>p[0]), n=pts.length, X=i=>L+(W-L-R)*i/(n-1), mx=Math.ceil(Math.max(...pts.map(p=>p[1]))/100)*100, Y=v=>Tp+(H-Tp-B)*(1-v/mx);
  let b=""; for(let v=0; v<=mx; v+=100) b+=`<line x1="${L}" y1="${Y(v).toFixed(1)}" x2="${W-R}" y2="${Y(v).toFixed(1)}" class="lr" style="opacity:.5"/>`+T(L-4,Y(v)+3,(v?"+":"")+v+"%","s","end");
  const bm=rec.raceBench.map(([l,v])=>[lab.indexOf(l),v]).filter(x=>x[0]>=0);
  b+=`<polyline points="${bm.map(([i,v])=>`${X(i)},${Y(v).toFixed(1)}`).join(" ")}" fill="none" class="ln" style="stroke-width:2;stroke-dasharray:4 4;opacity:.6"/>`;
  bm.forEach(([i,v])=>{ b+=`<circle cx="${X(i)}" cy="${Y(v).toFixed(1)}" r="3.5" class="ink" style="opacity:.6"/>`; });
  const [li,lv]=bm[bm.length-1]; b+=T(X(li)-6,Y(lv)-7,"S&P 500 +"+lv+"%","s","end");
  b+=`<polyline points="${pts.map((p,i)=>`${X(i)},${Y(p[1]).toFixed(1)}`).join(" ")}" fill="none" class="la" style="stroke-width:2.6"/>`;
  pts.forEach((p,i)=>{ b+=`<circle cx="${X(i)}" cy="${Y(p[1]).toFixed(1)}" r="4.5" class="acc pp"/>`+T(X(i),H-10,p[0],"s","middle"); if(i) b+=T(X(i)+(i===n-1?4:-6),Y(p[1])-9,"+"+p[1]+"%","s b a",i===n-1?"end":"end"); });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="His running gain through the 2021 contest, against the S&P 500">${b}</svg>`; }
function trDuelSVG(rec){ const W=400,H=190,B=30,Tp=20, mx=Math.ceil(Math.max(...rec.duel.map(d=>d[1]))/100)*100, Y=v=>Tp+(H-Tp-B)*(1-v/mx); let b=`<line x1="20" y1="${Y(0)}" x2="380" y2="${Y(0)}" class="lr"/>`;
  rec.duel.forEach(([y,a,c],k)=>{ const x=70+k*180; b+=`<rect x="${x}" y="${Y(a).toFixed(1)}" width="50" height="${(Y(0)-Y(a)).toFixed(1)}" rx="5" class="acc pp"/>`+T(x+25,Y(a)-6,"+"+a+"%","s b a","middle");
    b+=`<rect x="${x+58}" y="${Y(c).toFixed(1)}" width="50" height="${(Y(0)-Y(c)).toFixed(1)}" rx="5" class="ink pp" style="opacity:.45"/>`+T(x+83,Y(c)-6,"+"+c+"%","s b","middle")+T(x+54,H-10,y,"s b","middle"); });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="His contest years against the S&P 500">${b}</svg>`; }
function trClaimSVG(rec){ const C=rec.claim, W=400,H=190,B=30,Tp=20, vals=[...Array(C.years+1)].map((_,y)=>C.start*Math.pow(1+C.rate/100,y)), lo=Math.log10(C.start/2), hi=Math.log10(vals[C.years]*1.6), Y=v=>Tp+(H-Tp-B)*(hi-Math.log10(v))/(hi-lo);
  let b=`<line x1="20" y1="${H-B}" x2="380" y2="${H-B}" class="lr"/>`; vals.forEach((v,y)=>{ const x=36+y*62; b+=`<rect x="${x}" y="${Y(v).toFixed(1)}" width="40" height="${(H-B-Y(v)).toFixed(1)}" rx="5" class="${y===C.years?"acc":"ink"} pp" style="${y===C.years?"":"opacity:.4"}" ${delay(y)}/>`+T(x+20,Y(v)-6,fmK(v),"s b"+(y===C.years?" a":""),"middle")+T(x+20,H-10,y?"Year "+y:"Start","s","middle"); });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="What 220% a year would do to $10,000 in five years, on a scale that multiplies at each step">${b}</svg>`; }
function trContestHTML(p){ const rec=p.rec, tile=(v,l)=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`;
  return `<p>${esc(rec.intro)}</p><div class="tstats trtiles">${rec.tiles.map(t=>tile(esc(t[0]),esc(t[1]))).join("")}</div>
  <h3>The 2021 contest, quarter by quarter</h3><figure class="dg trfig">${trRaceSVG(rec)}<figcaption><span class="lg"><i class="acc"></i>His account</span> <span class="lg"><i class="ink" style="opacity:.45"></i>S&amp;P 500, with dividends</span></figcaption></figure><p>${esc(rec.raceNote)}</p>
  <h3>His two contest years, against the S&amp;P 500</h3><figure class="dg trfig">${trDuelSVG(rec)}<figcaption><span class="lg"><i class="acc"></i>His contest result</span> <span class="lg"><i class="ink" style="opacity:.45"></i>S&amp;P 500, with dividends</span></figcaption></figure><p>${esc(rec.duelNote)}</p>
  <h3>What "220% a year" means</h3><figure class="dg trfig">${trClaimSVG(rec)}</figure><p class="note">${esc(rec.claimNote)}</p>
  <div class="srcbox"><b>Where these numbers come from</b><ul>${rec.sources.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`; }
/* ---------- Druckenmiller: reported record (kind "macro"), Black Wednesday replay ---------- */
function trCompSVG(rec){ const C=rec.comp, W=400,H=210,L=50,R=12,Tp=14,B=26, ys=C.years, n=ys.length;
  const hy=[C.start], sp=[C.start]; ys.forEach((y,i)=>{ hy.push(hy[i]*(1+C.rate/100)); sp.push(sp[i]*(1+C.sp[String(y)]/100)); });
  const lo=Math.log10(C.start*0.7), hi=Math.log10(hy[n]*1.4), X=i=>L+(W-L-R)*i/n, Y=v=>Tp+(H-Tp-B)*(hi-Math.log10(v))/(hi-lo);
  let b=""; [1e3,1e4,1e5].forEach(v=>{ b+=`<line x1="${L}" y1="${Y(v).toFixed(1)}" x2="${W-R}" y2="${Y(v).toFixed(1)}" class="lr" style="opacity:.5"/>`+T(L-4,Y(v)+3,fmK(v),"s","end"); });
  [0,8,16,24].forEach(i=>{ b+=T(X(i),H-8,i===24?"end 2009":String(ys[0]+i),"s",i===24?"end":"middle"); });
  b+=`<polyline points="${sp.map((v,i)=>`${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}" fill="none" class="ln" style="stroke-width:2.2;opacity:.65"/>`;
  b+=`<polyline points="${hy.map((v,i)=>`${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}" fill="none" class="la" style="stroke-width:2.6;stroke-dasharray:5 4"/>`;
  b+=T(X(9),Y(hy[n])+4,"$"+Math.round(hy[n]).toLocaleString("en-US")+" at 30% a year","s b a","middle")+T(W-R,Y(sp[n])-8,"$"+Math.round(sp[n]).toLocaleString("en-US")+" in the S&P 500","s b","end");
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="$1,000 from 1986 to 2009 at a steady 30% a year, against the S&P 500 with dividends, on a scale that multiplies by ten at each line">${b}</svg>`; }
function trGroupSVG(rec){ const W=400,H=210,Tp=18,B=30, mx=30, mn=-40, Y=v=>Tp+(H-Tp-B)*(mx-v)/(mx-mn), bw=28;
  let b=`<line x1="16" y1="${Y(0).toFixed(1)}" x2="388" y2="${Y(0).toFixed(1)}" class="lr"/>`;
  const cls=[["acc",""],["soft",""],["ink","opacity:.45"]];
  rec.bars.forEach((row,k)=>{ const x0=40+k*122; row.slice(1).forEach((v,j)=>{ const x=x0+j*(bw+4); if(v==null){ b+=T(x+bw/2,Y(0)-6,"n/a","s","middle"); return; }
      const y=Math.min(Y(v),Y(0)), h=Math.abs(Y(v)-Y(0)); b+=`<rect x="${x}" y="${y.toFixed(1)}" width="${bw}" height="${Math.max(h,1.5).toFixed(1)}" rx="4" class="${cls[j][0]} pp" style="${cls[j][1]}" ${delay(k*3+j)}/>`;
      b+=T(x+bw/2,v>=0?Y(v)-5:Y(v)+12,(v>0?"+":"")+v+"%","s b"+(j===0?" a":""),"middle"); });
    b+=T(x0+bw*1.5+4,H-8,row[0],"s b","middle"); });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="2008 to 2010: his fund against the average hedge fund and the S&P 500">${b}</svg>`; }
function trNqSVG(pts){ const W=400,H=180,L=44,R=14,Tp=18,B=30, vs=pts.map(p=>p[1]), hi=5600, lo=0, Y=v=>Tp+(H-Tp-B)*(hi-v)/(hi-lo), X=i=>L+(W-L-R)*i/(pts.length-1);
  let b=""; [1000,3000,5000].forEach(v=>{ b+=`<line x1="${L}" y1="${Y(v).toFixed(1)}" x2="${W-R}" y2="${Y(v).toFixed(1)}" class="lr" style="opacity:.5"/>`+T(L-4,Y(v)+3,v.toLocaleString("en-US"),"s","end"); });
  b+=`<polyline points="${pts.map((p,i)=>`${X(i).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ")}" fill="none" class="ln" style="stroke-width:2.4"/>`;
  const top=vs.indexOf(Math.max(...vs)), n=pts.length;
  pts.forEach((p,i)=>{ const y=Y(p[1]), up=i===top||(i>0&&i<n-1&&p[1]>pts[i-1][1]); b+=`<circle cx="${X(i).toFixed(1)}" cy="${y.toFixed(1)}" r="${i===top?6:4.5}" class="${i===top?"acc":"ink"} pp"/>`+T(X(i),H-10,p[0],"s"+(i===top?" b a":""),i===0?"start":i===n-1?"end":"middle")+T(X(i),up?y-10:y+17,Math.round(p[1]).toLocaleString("en-US"),"s b"+(i===top?" a":""),i===0?"start":i===n-1?"end":"middle"); });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Nasdaq Composite closing levels, January 1999 to October 2002">${b}</svg>`; }
function trRateSVG(steps, act){ const W=400,H=170,L=34,R=10,Tp=16,B=30, n=steps.length, X=i=>L+(W-L-R)*i/n, Y=v=>Tp+(H-Tp-B)*(16-v)/(16-8);
  let b=""; [10,12,15].forEach(v=>{ b+=`<line x1="${L}" y1="${Y(v).toFixed(1)}" x2="${W-R}" y2="${Y(v).toFixed(1)}" class="lr" style="opacity:.45"/>`+T(L-4,Y(v)+3,v+"%","s","end"); });
  let d=""; steps.forEach((s,i)=>{ d+=(i?` L${X(i).toFixed(1)},${Y(s.r).toFixed(1)}`:`M${X(0).toFixed(1)},${Y(s.r).toFixed(1)}`)+` L${X(i+1).toFixed(1)},${Y(s.r).toFixed(1)}`; });
  b+=`<path d="${d}" fill="none" class="la" style="stroke-width:2.8"/>`;
  steps.forEach((s,i)=>{ const on=act===i, cx=(X(i)+X(i+1))/2; if(act!=null&&on) b+=`<rect x="${X(i).toFixed(1)}" y="${Tp}" width="${(X(i+1)-X(i)).toFixed(1)}" height="${H-Tp-B}" class="acc" style="opacity:.12"/>`;
    b+=`<circle cx="${cx.toFixed(1)}" cy="${Y(s.r).toFixed(1)}" r="${on?6:4}" class="${on?"acc":"ink"} pp"/>`+T(cx,H-10,s.s||s.t,on?"s b a":"s","middle"); if(on||act==null) b+=T(cx,Y(s.r)-10,s.r+"%","s b"+(on?" a":""),"middle"); });
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Bank of England interest rate, 15 to 17 September 1992">${b}</svg>`; }
function trMacroHTML(p){ const rec=p.rec, tile=(v,l)=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`;
  return `<p>${esc(rec.intro)}</p><div class="tstats trtiles">${rec.tiles.map(t=>tile(esc(t[0]),esc(t[1]))).join("")}</div>
  <h3>What "about 30% a year" means</h3><figure class="dg trfig">${trCompSVG(rec)}<figcaption><span class="lg"><i class="acc"></i>A steady 30% a year (illustration)</span> <span class="lg"><i class="ink" style="opacity:.45"></i>S&amp;P 500, with dividends</span></figcaption></figure><p class="note">${esc(rec.compNote)}</p>
  <h3>His last three years, against the market</h3><figure class="dg trfig">${trGroupSVG(rec)}<figcaption><span class="lg"><i class="acc"></i>His fund (reported)</span> <span class="lg"><i class="soft"></i>Average hedge fund</span> <span class="lg"><i class="ink" style="opacity:.45"></i>S&amp;P 500, with dividends</span></figcaption></figure><p>${esc(rec.barsNote)}</p>
  <h3>The 2000 mistake, on the Nasdaq</h3><figure class="dg trfig">${trNqSVG(rec.nasdaq)}<figcaption>Green dot: the record close of 10 March 2000, when he says he bought back in.</figcaption></figure><p>${esc(rec.nasdaqNote)}</p>
  <div class="srcbox"><b>Where these numbers come from</b><ul>${rec.sources.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`; }
function bwInner(B){ const n=B.steps.length, i=Math.max(0,Math.min(n-1,V4.tr.bw||0)), s=B.steps[i];
  return `<figure class="dg trfig">${trRateSVG(B.steps,i)}</figure><div class="bwstep"><div class="bwh"><b>${esc(s.t)}</b><span>${s.a?"Announced: "+s.r+"%, never applied":"Bank rate "+s.r+"%"}</span></div><p>${esc(s.h)}</p></div>
  <div class="bwnav"><button type="button" data-bw="-1" ${i===0?"disabled":""}>‹ Back</button><span>Step ${i+1} of ${n}</span><button type="button" data-bw="1" ${i===n-1?"disabled":""}>Next ›</button></div>`; }
function bwHTML(p,B){ return `<h3${B.id?` id="${B.id}"`:""}>${esc(B.title)}</h3><p>${esc(B.text)}</p><div id="bwBox">${bwInner(B)}</div><p class="bwwhy">${esc(B.why)}</p>${B.note?`<p class="note">${esc(B.note)}</p>`:""}`; }
function trRecordHTML(p){ if(p.rec.kind==="contest") return trContestHTML(p); if(p.rec.kind==="macro") return trMacroHTML(p); const rec=p.rec, st=trStats(rec), S=trSeries(rec);
  const tile=(v,l)=>`<div class="stat"><b>${v}</b><span>${l}</span></div>`;
  return `<p>${esc(rec.intro)}</p>
  <div class="tstats trtiles">${tile(fmtM(st.fin),"$1,000 in July 1990, by April 2004")}${tile(pct(st.cagr),"a year, compounded")}${tile(st.mdd.toFixed(1)+"%","deepest fall from a high")}${tile(Math.round(st.up)+"%","of months were up")}</div>
  <h3>Growth of $1,000, month by month</h3>
  <div class="seg" role="tablist"><button data-trtab="value" class="${V4.tr.tab==="value"?"on":""}" aria-pressed="${V4.tr.tab==="value"}">Value</button><button data-trtab="dd" class="${V4.tr.tab==="dd"?"on":""}" aria-pressed="${V4.tr.tab==="dd"}">Drawdown</button></div>
  <figure class="dg trfig" id="trEq">${trEquitySVG(rec)}</figure>
  <input type="range" id="trScrub" class="tlrange" min="0" max="${S.length-1}" step="1" value="${V4.tr.i==null?S.length-1:V4.tr.i}" aria-label="Choose a month">
  <div id="trRead">${trReadout(rec)}</div>
  <p class="note">Drag to move through the months. The value scale doubles at each line. Our calculation from the fund's published monthly returns, after fees.</p>
  <h3>Year by year, against the S&amp;P 500</h3>
  <figure class="dg trfig">${trBarsSVG(rec)}<figcaption><span class="lg"><i class="acc"></i>His fund</span> <span class="lg"><i class="ink" style="opacity:.45"></i>S&amp;P 500, with dividends</span></figcaption></figure>
  <p>${esc(rec.barsNote)}</p>
  <h3>Every month, as a heat map</h3>${trHeat(rec)}<p class="note">Green months made money, red months lost it; the darker, the bigger. Figures are monthly returns in %; the last column is the year. 1990 covers July to December only; 2004 stops in April.</p>
  <h3>The 1987 crash, in ${rec.crash.length} points</h3><figure class="dg trfig">${trCrashSVG(rec.crash)}</figure><p>${esc(rec.crashNote)}</p>
  <h3>Two eras of the flagship fund</h3><figure class="dg trfig">${trErasSVG(rec.eras)}</figure><p class="note">${esc(rec.erasNote)}</p>
  <div class="srcbox"><b>Where these numbers come from</b><ul>${rec.sources.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`; }
function riskBanner(p){ return p.warn?`<aside class="riskban" role="note"><b>${esc(p.warn.title)}</b>${p.warn.lines.map(l=>`<p>${esc(l)}</p>`).join("")}</aside>`:""; }
function rrOut(){ const R=V4.tr.rr, w=gtNum(R.w), r=gtNum(R.r), k=gtNum(R.k);
  if([w,r,k].some(v=>v===null)||w<0||w>100||r<=0||r>50||k<=0||k>10) return `<p class="small muted">Fill in a win rate (0 to 100), a reward-to-risk ratio and the risk per trade.</p>`;
  const ev=(w/100)*r-(1-w/100), be=100/(1+r), per=ev*k;
  return `<div class="tstats gnstat"><div class="stat"><b>${(ev>=0?"+":"")+ev.toFixed(2)}R</b><span>average result per trade, in units of what you risk</span></div><div class="stat"><b>${be.toFixed(1)}%</b><span>win rate needed just to break even at ${r}:1</span></div></div>
  <p class="verdict">${ev>0?`On paper, each trade adds about ${per.toFixed(2)}% of your capital on average, before costs, slippage and mistakes.`:`On paper, this loses about ${Math.abs(per).toFixed(2)}% of your capital per trade on average. No amount of trading fixes negative arithmetic.`}</p>`; }
const TT_F=[["p","Share price today"],["m50","50-day average"],["m150","150-day average"],["m200","200-day average"],["m200a","200-day average a month ago"],["hi","52-week high"],["lo","52-week low"],["rs","Relative strength rank, 1 to 99 (optional)"]];
function ttOut(){ const Q=V4.tr.tt, v={}; for(const [k] of TT_F){ v[k]=gtNum(Q[k]); }
  if(TT_F.slice(0,7).some(([k])=>v[k]===null||v[k]<=0)) return `<p class="small muted">Fill in the first seven boxes with positive numbers.</p>`;
  const t=[["Price above the 150-day and 200-day averages",v.p>v.m150&&v.p>v.m200],["150-day average above the 200-day",v.m150>v.m200],["200-day average rising for at least a month",v.m200>v.m200a],["50-day average above the 150-day and 200-day",v.m50>v.m150&&v.m50>v.m200],["Price above the 50-day average",v.p>v.m50],["Price at least 25% above its 52-week low",v.p>=v.lo*1.25],["Price within 25% of its 52-week high",v.p>=v.hi*0.75],["Relative strength rank of 70 or more",v.rs===null?null:v.rs>=70]];
  const pass=t.filter(x=>x[1]===true).length, tot=t.filter(x=>x[1]!==null).length;
  return `<ul class="ttl">${t.map(([l,ok])=>`<li class="${ok===null?"na":ok?"ok":"no"}"><span aria-hidden="true">${ok===null?"–":ok?"✓":"✗"}</span>${l}${ok===null?" <i>(not checked)</i>":""}</li>`).join("")}</ul>
  <p class="verdict">${pass===tot?`Passes all ${tot} tests: by his template this would be a Stage 2 candidate worth studying further. That is not a reason to buy.`:`Passes ${pass} of ${tot}. By his rules, a stock that fails any test is not a candidate.`}</p>`; }
function ttHTML(p,B){ const Q=V4.tr.tt, row=(k,l)=>`<div class="qcrow"><label for="tt-${k}">${l}</label><input id="tt-${k}" type="number" inputmode="decimal" step="any" value="${esc(Q[k]??"")}"></div>`;
  return `<h3${B.id?` id="${B.id}"`:""}>${esc(B.title)}</h3><p>${esc(B.text)}</p><div class="qctool">${TT_F.map(([k,l])=>row(k,l)).join("")}</div><div id="ttOut">${ttOut()}</div>${B.note?`<p class="note">${esc(B.note)}</p>`:""}`; }
function rrHTML(p,B){ const R=V4.tr.rr, row=(k,l)=>`<div class="qcrow"><label for="rr-${k}">${l}</label><input id="rr-${k}" type="number" inputmode="decimal" step="any" value="${esc(R[k]??"")}"></div>`;
  return `<h3${B.id?` id="${B.id}"`:""}>${esc(B.title)}</h3><p>${esc(B.text)}</p><div class="qctool">${row("w","Share of trades that win (%)")}${row("r","Reward-to-risk ratio (5 means 5:1)")}${row("k","Risk per trade (% of capital)")}</div><div id="rrOut">${rrOut()}</div>${B.note?`<p class="note">${esc(B.note)}</p>`:""}`; }

/* ---------- small building blocks ---------- */
const isOpen = id => V4.open.has(id);
function acc(id, sum, body, cls){ return `<details class="acc${cls?" "+cls:""}" id="${id}"${isOpen(id)?" open":""}><summary>${sum}<span class="chev" aria-hidden="true"></span></summary><div class="accb">${body}</div></details>`; }
function sumRow(no, title, sub){ return `${no!=null?`<span class="no">${no}</span>`:""}<span class="st"><b>${title}</b>${sub?`<span>${sub}</span>`:""}</span>`; }
function sec(id, title, sub, html, live){ return {id, title, sub, html, live:!!live}; }
function qq(text, cite){ return `<blockquote class="qq"><p>“${esc(text)}”</p><cite>${esc(cite)}</cite></blockquote>`; }
function goBtn(sec, open, label, cls){ return `<button class="golink${cls?" "+cls:""}" data-go="${sec}"${open?` data-open="${open}"`:""}>${label}</button>`; }
const stripHead = h => h.replace(/^\s*<span class="eyebrow">[^<]*<\/span><h2>[^<]*<\/h2>/, "");

function renderSecs(secs){ return secs.map((s,i)=>`<section class="psec" id="s-${s.id}"><header class="psh"><span class="psn">${i+1}</span><div><h2>${esc(s.title)}</h2>${s.sub?`<p class="ssub">${esc(s.sub)}</p>`:""}</div></header><div class="sb" id="sb-${s.id}">${s.html()}</div></section>`).join(""); }
function topbar(title){ return `<div class="topbar"><div class="topbar-in"><a class="tback" href="#" aria-label="Back to the library">‹ Library</a><span class="bt">${esc(title)}</span><button class="cbtn" id="cBtn" aria-expanded="false" aria-controls="cMenu">Contents</button></div>
  <nav class="cmenu" id="cMenu" hidden><ol>${V4.secs.map(s=>`<li><button data-go="${s.id}">${esc(s.title)}</button></li>`).join("")}</ol></nav></div>`; }
function footNote(){ return `<footer class="foot"><p>The Alien's Guide to Earth is a free, independent study guide, for education only. It is not investment advice. Not affiliated with any person, company or publisher named.</p><p>An independent, non-commercial educational project. Not affiliated with, sponsored by or endorsed by any company or organisation.</p><p class="flinks"><a href="#about">About and disclaimer</a><a href="corrections.html">Corrections</a><a href="#privacy">Privacy</a><a href="#terms">Terms of use</a></p></footer>`; }

/* ---------- home ---------- */
function searchIndex(){ if(searchIndex.v) return searchIndex.v; const out=[];
  INV.forEach(pid=>{ const p=PACKS[pid], tn={}; p.themes.forEach(t=>{ tn[t.id]=t.num; out.push({pid, k:"Idea", t:t.title, x:t.idea, h:`#${pid}-idea-${t.num}`}); });
    Object.values(p.nuggets).forEach(n=>out.push({pid, k:"Lesson", t:n.lead, x:n.text, h:`#${pid}-idea-${tn[n.theme]}`}));
    p.quotes.forEach(q=>out.push({pid, k:"His words", t:"“"+q.text+"”", x:q.label, h:`#${pid}-idea-${tn[q.theme]}`}));
    p.glossary.forEach(([a,b])=>out.push({pid, k:"Word", t:a, x:b, h:`#${pid}-glossary`}));
    (p.tendencies||[]).forEach(t=>out.push({pid, k:"Mental trap", t:t.name, x:t.what+" "+t.guard, h:`#${pid}-special`}));
    (p.mistakes||[]).forEach(m=>out.push({pid, k:"Mistake", t:m.did, x:m.lesson, h:`#${pid}-special`})); });
  D.timeline.storms.forEach(s=>out.push({pid:"timeline", k:"Storm", t:s.name+" ("+s.when+")", x:s.what, h:`#timeline-storms`}));
  if(D.timelineUK) D.timelineUK.storms.forEach(s=>out.push({pid:"timelineUK", k:"Storm", t:s.name+" ("+s.when+")", x:s.what, h:`#timeline-uk-storms`}));
  return searchIndex.v=out; }
function searchHTML(q){ q=q.trim().toLowerCase(); if(q.length<2) return "";
  const words=q.split(/\s+/).filter(Boolean), hits=searchIndex().filter(r=>{ const s=(r.t+" "+r.x).toLowerCase(); return words.every(w=>s.includes(w)); });
  const name=pid=>pid==="timeline"?"Timeline":pid==="timelineUK"?"UK Timeline":PACKS[pid].short, mark=s=>{ let o=esc(s); words.forEach(w=>{ if(w.length>1) o=o.replace(new RegExp("("+w.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","ig"),"<mark>$1</mark>"); }); return o; };
  if(!hits.length) return `<p class="qnone">Nothing found for “${esc(q)}”. Try a simpler word, like <button class="golink" data-q="moat">moat</button>, <button class="golink" data-q="debt">debt</button> or <button class="golink" data-q="patience">patience</button>.</p>`;
  return `<p class="qcount">${hits.length} result${hits.length>1?"s":""}${hits.length>30?", showing the first 30":""}</p><ul class="qres">${hits.slice(0,30).map(r=>`<li><a href="${r.h}"><span class="qk">${esc(name(r.pid))} · ${esc(r.k)}</span><b>${mark(r.t)}</b><span class="qx">${mark(r.x.length>170?r.x.slice(0,167)+"…":r.x)}</span></a></li>`).join("")}</ul>`; }
/* countries: add an entry here when the first investor from a new country joins; the row grows on its own */
/* (COUNTRIES moved to people.py -> reg.js) */
V4.country = V4.country || COUNTRIES[0].id;
function homeHTML(){ const total=INV.reduce((s,pid)=>s+Object.keys(PACKS[pid].nuggets).length+PACKS[pid].themes.length,0);
  const C=COUNTRIES.find(c=>c.id===V4.country)||COUNTRIES[0], TRD=C.id==="traders"; if(!TRD) V4.lastInv=C.id;
  const pick=(h,ava,cls,t,sub)=>`<a class="pick" href="${h}"><span class="ava ${cls}">${ava}</span><span class="pt"><b>${t}</b><span>${sub}</span></span><span class="pgo" aria-hidden="true">›</span></a>`;
  return `<div class="home">
  <nav class="sect" aria-label="Library sections">${TRD?`<a class="s-inv" href="#" data-country="${esc(V4.lastInv||"usa")}">Investors</a><span class="s-trd on" aria-current="page">Traders</span>`:`<span class="s-inv on" aria-current="page">Investors</span><a class="s-trd" href="#traders" data-country="traders">Traders</a>`}<a class="s-eco" href="https://alienspacex.com/economics/" target="_top" data-bg="#ffffff" aria-label="Economics: the lemonade stand">Economics</a><a class="s-spa" href="https://alienspacex.com/space/" target="_top" data-bg="#05060c" aria-label="Space: from the Big Bang to you">Space</a><a class="s-evo" href="https://alienspacex.com/evolution/" target="_top" data-bg="#05060c" aria-label="Evolution: from the first cell to you">Evolution</a></nav>
  <div class="alien-w"><svg class="alien" viewBox="0 0 160 160" role="img" aria-label="A cute green alien with round glasses reading a guide to Earth"><defs>
<radialGradient id="alh" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="#d4f8e2"/><stop offset=".55" stop-color="#a6ecc2"/><stop offset="1" stop-color="#7fd3a2"/></radialGradient>
<radialGradient id="ale" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="#3b4f86"/><stop offset="1" stop-color="#1b2542"/></radialGradient>
<radialGradient id="alw" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#9fdcff"/><stop offset=".7" stop-color="#4aa3f0"/><stop offset="1" stop-color="#2f7fd0"/></radialGradient>
</defs><g class="al-b">
<ellipse cx="80" cy="153" rx="40" ry="5" fill="#000" opacity=".07"/>
<ellipse cx="62" cy="147" rx="11" ry="6.5" fill="#8fdcae" stroke="#45a873" stroke-width="2.2"/><ellipse cx="98" cy="147" rx="11" ry="6.5" fill="#8fdcae" stroke="#45a873" stroke-width="2.2"/>
<ellipse cx="80" cy="128" rx="26" ry="19" fill="url(#alh)" stroke="#45a873" stroke-width="2.4"/>
<g class="al-h"><path d="M62 24 Q56 12 48 8" fill="none" stroke="#45a873" stroke-width="3" stroke-linecap="round"/><path d="M98 24 Q104 12 112 8" fill="none" stroke="#45a873" stroke-width="3" stroke-linecap="round"/>
<circle cx="47" cy="7" r="5.5" fill="#ffd84d" stroke="#e0b100" stroke-width="1.4"/><circle cx="113" cy="7" r="5.5" fill="#ffd84d" stroke="#e0b100" stroke-width="1.4"/><circle cx="45.5" cy="5.5" r="1.6" fill="#fff"/><circle cx="111.5" cy="5.5" r="1.6" fill="#fff"/><path d="M80 18 C124 18 140 50 132 76 C126 96 100 112 80 114 C60 112 34 96 28 76 C20 50 36 18 80 18 Z" fill="url(#alh)" stroke="#45a873" stroke-width="2.6" /><g class="al-e"><ellipse cx="56" cy="64" rx="14" ry="16" fill="url(#ale)"/><path d="M45 69 Q56 82 67 69 Q56 75 45 69 Z" fill="#6f8fe8" opacity=".55"/><circle cx="51" cy="58" r="5.9" fill="#fff"/><circle cx="62" cy="70" r="2.4" fill="#fff"/></g><g class="al-e"><ellipse cx="104" cy="64" rx="14" ry="16" fill="url(#ale)"/><path d="M93 69 Q104 82 115 69 Q104 75 93 69 Z" fill="#6f8fe8" opacity=".55"/><circle cx="99" cy="58" r="5.9" fill="#fff"/><circle cx="110" cy="70" r="2.4" fill="#fff"/></g>
<circle cx="56" cy="64" r="19" fill="none" stroke="#c0712b" stroke-width="3"/><circle cx="104" cy="64" r="19" fill="none" stroke="#c0712b" stroke-width="3"/><path d="M75 62 Q80 58 85 62" fill="none" stroke="#c0712b" stroke-width="3"/>
<ellipse cx="40" cy="88" rx="8" ry="5" fill="#ff8fab" opacity=".55"/><ellipse cx="120" cy="88" rx="8" ry="5" fill="#ff8fab" opacity=".55"/><path d="M74 92 Q80 97 86 92" fill="none" stroke="#22304f" stroke-width="2.8" stroke-linecap="round"/></g>
<g transform="rotate(-4 80 124)"><path d="M48 106 L80 112 L112 106 L112 142 L80 148 L48 142 Z" fill="#ffd84d" stroke="#d99a00" stroke-width="2.4" stroke-linejoin="round"/><path d="M80 112 L80 148" stroke="#d99a00" stroke-width="2"/>
<circle cx="64" cy="127" r="9" fill="url(#alw)"/><path d="M60 122 C63 120 66 123 64 126 C62 129 65 131 62 133 C59 132 58 126 60 122 Z" fill="#6fd38a"/>
<path d="M86 121 L105 118 M86 128 L105 125 M86 135 L99 133" stroke="#b07a00" stroke-width="2.2" stroke-linecap="round"/></g>
<circle cx="48" cy="120" r="6" fill="#a6ecc2" stroke="#45a873" stroke-width="2"/><circle cx="112" cy="120" r="6" fill="#a6ecc2" stroke="#45a873" stroke-width="2"/>
<path transform="translate(20 36) scale(0.9)" d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z" fill="#ffcf4d"/><path transform="translate(140 30) scale(1)" d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z" fill="#ffcf4d"/>
</g></svg></div>
  <h1 class="logo">The Alien&#39;s Guide<br>to <span class="earth">Earth</span></h1>
  <p class="tagline"><b>The home of the greatest investors and traders of all time.</b><br>Their ideas in plain words, every claim sourced. Everything you need to begin. Free.</p>
<div class="explore">
   <button type="button" class="big${TRD?"":" on"}" data-country="${esc(TRD?(V4.lastInv||"usa"):C.id)}" aria-pressed="${!TRD}"><span class="ei">📈</span><span><b>Investors</b><small>Great investors worldwide</small></span></button>
   <button type="button" class="big${TRD?" on":""}" data-country="traders" aria-pressed="${TRD}"><span class="ei">📊</span><span><b>Traders</b><small>Great traders, for adults</small></span></button>
   <a class="sm" href="https://alienspacex.com/economics/" target="_top" data-bg="#ffffff"><span class="ei">🍋</span><span><b>Economics</b><small>Lemonade stand</small></span></a>
   <a class="sm" href="https://alienspacex.com/space/" target="_top" data-bg="#05060c"><span class="ei">🪐</span><span><b>Space</b><small>Big Bang to you</small></span></a>
   <a class="sm" href="https://alienspacex.com/evolution/" target="_top" data-bg="#05060c"><span class="ei">🧬</span><span><b>Evolution</b><small>First cell to you</small></span></a>
  </div>
  ${iodHTML(TRD)}
  <h2 class="sech">${TRD?"Great traders":"Great investors"}</h2>
  <div class="search"><input id="q" type="search" autocomplete="off" placeholder="Type your query…" aria-label="Search the investor ideas" value="${esc(V4.q)}"><span class="runner" aria-hidden="true"><svg viewBox="0 0 40 44"><g class="rb"><path d="M15 6 Q13 2 10 1" fill="none" stroke="#45a873" stroke-width="1.6" stroke-linecap="round"/><path d="M25 6 Q27 2 30 1" fill="none" stroke="#45a873" stroke-width="1.6" stroke-linecap="round"/><circle cx="10" cy="1.6" r="2" fill="#ffd84d"/><circle cx="30" cy="1.6" r="2" fill="#ffd84d"/><ellipse cx="20" cy="31" rx="7" ry="5.5" fill="#8fdcae" stroke="#45a873" stroke-width="1.4"/><path d="M20 5 C33 5 37 14 34 21 C31 27 25 31 20 31.5 C15 31 9 27 6 21 C3 14 7 5 20 5 Z" fill="#a6ecc2" stroke="#45a873" stroke-width="1.4"/><circle cx="14" cy="17" r="4.6" fill="#1b2542"/><circle cx="26" cy="17" r="4.6" fill="#1b2542"/><circle cx="12.6" cy="15.4" r="1.6" fill="#fff"/><circle cx="24.6" cy="15.4" r="1.6" fill="#fff"/><circle cx="14" cy="17" r="6" fill="none" stroke="#c0712b" stroke-width="1.2"/><circle cx="26" cy="17" r="6" fill="none" stroke="#c0712b" stroke-width="1.2"/><path d="M17.5 24.5 Q20 26.5 22.5 24.5" fill="none" stroke="#1b2542" stroke-width="1.3" stroke-linecap="round"/></g><path class="l1" d="M17 35 L15 42" stroke="#45a873" stroke-width="2.6" stroke-linecap="round"/><path class="l2" d="M23 35 L25 42" stroke="#45a873" stroke-width="2.6" stroke-linecap="round"/></svg></span></div>
  <div id="qres">${searchHTML(V4.q)}</div>
  ${TRD?`<aside class="riskban" role="note"><b>For adults (18+). Trading is risky.</b><p>Traders take risks most people should not. Most individuals who trade lose money: in India, SEBI found 93% of individual equity F&amp;O traders lost money between FY22 and FY24. These pages are for education, not trading advice.</p></aside>`:`<div class="ctry" role="group" aria-label="Choose a country">${COUNTRIES.filter(c=>c.id!=="traders").map(c=>`<button data-country="${c.id}" class="${c.id===C.id?"on":""}" aria-pressed="${c.id===C.id}"><span aria-hidden="true">${c.flag}</span> ${esc(c.name)}</button>`).join("")}</div>`}
  <nav class="picks" aria-label="${TRD?"Traders":"Investors from "+esc(C.name)}">
    ${C.picks.map(x=>pick(...x)).join("")}
  </nav>
  <p class="hlinks"><a href="#journey">About me</a><span>·</span><a href="#about">About this site</a></p>
  </div>`; }

/* ---------- idea of the day: picked on the reader's phone from today's date (no rebuild needed) ---------- */
function iodShort(x){ x=String(x||"").trim(); const m=x.match(/^.{40,180}?[.!?](\s|$)/); if(m) return m[0].trim(); return x.length>170 ? x.slice(0,x.lastIndexOf(" ",165))+"…" : x; }
function iodPick(TRD){ const tr=new Set(((COUNTRIES.find(c=>c.id==="traders")||{}).picks||[]).map(x=>String(x[0]).replace(/^#/,"")));
  const pool=[]; INV.forEach(pid=>{ if(tr.has(pid)!==!!TRD) return; const p=D.packs[pid]; if(p&&p.themes) p.themes.forEach(t=>pool.push([pid,t.num,t.title])); });
  if(!pool.length) return null; const d=new Date(), day=Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/864e5);
  return pool[(day*7919)%pool.length]; }
function iodFill(again){ const el=document.querySelector(".iod-x[data-iod]"); if(!el||el.textContent) return;
  const [pid,num]=el.dataset.iod.split("|"), t=((D.packs[pid]||{}).themes||[]).find(t=>String(t.num)===num);
  if(t&&t.idea){ el.textContent=iodShort(t.idea); return; }
  if(!again && window.__fullData){ try{ window.__fullData().then(()=>iodFill(true),()=>{}); }catch(e){} } }
function iodHTML(TRD){ const k=iodPick(TRD); if(!k) return ""; const [pid,num,title]=k, p=D.packs[pid], t=(p.themes||[]).find(t=>t.num===num)||{};
  setTimeout(()=>iodFill(false),0);
  return `<a class="iod" href="#${pid}-idea-${esc(num)}"><span class="iod-k">💡 ${TRD?"Trading idea":"Idea"} of the day · ${esc(p.name)}</span><b>${esc(title)}</b><span class="iod-x" data-iod="${pid}|${esc(num)}">${t.idea?esc(iodShort(t.idea)):""}</span><span class="iod-go">Read the idea →</span></a>`; }
/* ---------- investor page (same template for all three) ---------- */
const MON=["January","February","March","April","May","June","July","August","September","October","November","December"];
function ageNow(by,bm,bd){ const t=new Date(); let a=t.getFullYear()-by; if(t.getMonth()+1<bm || (t.getMonth()+1===bm && t.getDate()<bd)) a--; return a; }
function glance(p){ const G=(D.profiles||{})[p.id]; if(!G) return "";
  const d=G.died, ageRow = d ? ["Died", `${d[2]} ${MON[d[1]-1]} ${d[0]}${G.diedAt?", "+G.diedAt:""}, aged ${G.diedAge||(G.bm?d[0]-G.by-((d[1]<G.bm||(d[1]===G.bm&&d[2]<G.bd))?1:0):(()=>{ const c=(G.bc||[[1,1],[12,31]]).map(([m,dd])=>d[0]-G.by-((d[1]<m||(d[1]===m&&d[2]<dd))?1:0)), lo=Math.min(...c), hi=Math.max(...c); return lo===hi?lo:lo+" or "+hi; })())}`]
    : !G.by ? null : G.bm ? ["Age", String(ageNow(G.by,G.bm,G.bd))] : (()=>{ const c=(G.bc||[[1,1],[12,31]]).map(([m,dd])=>ageNow(G.by,m,dd)), lo=Math.min(...c), hi=Math.max(...c); return ["Age", lo===hi?String(lo):`${lo} or ${hi}`]; })();
  const rows=[G.rows[0], ...(ageRow?[ageRow]:[]), ...G.rows.slice(1)];
  return `<div class="glance"><div class="gl-ava a-${p.id}" aria-hidden="true">${esc(p.mono)}</div><div class="gl-body"><div class="gl-h">At a glance</div>
    <dl>${rows.map(([a,b])=>`<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join("")}${G.site?`<dt>Website</dt><dd><a href="${esc(G.site[1])}" target="_blank" rel="noopener">${esc(G.site[0])} ↗</a></dd>`:""}</dl></div></div>`; }
function invHero(p){ const n=Object.keys(p.nuggets).length;
  return `<div class="phero"><h1>${esc(p.name)}</h1><p class="hook">${esc(HOOK[p.id])}</p>${glance(p)}
  <ul class="facts"><li><b>${p.units.length}</b> ${UNITS_WORD[p.id]}</li><li><b>${p.themes.length}</b> big ideas</li><li><b>${n}</b> lessons</li></ul>
  <div class="how"><b>How to use this page</b><ol><li>Read the five-minute summary just below.</li><li>Open any idea that catches your eye. Each takes about ten minutes.</li><li>Then read one of his ${p.id==="buffett"?"letters":"originals"} in full, from the list near the end.</li></ol></div></div>`; }
function lifeList(rows){ return `<ul class="life">${rows.map(([y,t])=>`<li><span>${esc(String(y))}</span>${esc(t)}</li>`).join("")}</ul>`; }
function invFive(p){ const b=p.big||{}; let h="";
  if(p.id==="buffett"){ h+=`<h3>What never changed</h3>${bl(b.constant.map(esc),"plain")}<h3>What changed over thirty years</h3><ul class="pairs">${b.changed.map(([a,c])=>`<li><b>${esc(a)}</b> ${esc(c)}</li>`).join("")}</ul>`; }
  else if(p.id==="munger"){ h+=`<p>${esc(p.start.lede)}</p><ul class="pairs">${b.map.map(([a,c])=>`<li><b>${esc(a)}.</b> ${esc(c)}</li>`).join("")}</ul>`; }
  else if(p.id==="lynch"){ h+=`<p>${esc(p.start.lede)}</p><div class="rec">${p.record.map(([a,c])=>`<div><b>${esc(a)}</b><span>${esc(c)}</span></div>`).join("")}</div>
    <h3>His path, in five steps</h3><ol class="path">${p.stages.map(s=>`<li><b>${esc(s.name)}:</b> ${esc(s.blurb)} <span class="ideas-of">${s.themes.map(n=>goBtn("ideas","idea-"+n,"Idea "+n)).join(" ")}</span></li>`).join("")}</ol>`; }
  else { h+=`<p>${esc(p.start.lede)}</p>${p.record?`<div class="rec">${p.record.map(([a,c])=>`<div><b>${esc(a)}</b><span>${esc(c)}</span></div>`).join("")}</div>`:""}
    ${b.map?`<h3>His thinking, one line each</h3><ul class="pairs">${b.map.map(([a,c])=>`<li><b>${esc(a)}.</b> ${esc(c)}</li>`).join("")}</ul>`:""}`; }
  if(b.timeline) h+=acc("life", sumRow(null,"His life and career in brief", b.timeline.length+" moments"), lifeList(b.timeline), "mini");
  return h; }
function nuggetLi(n){ return `<li><b>${esc(n.lead)}</b> ${esc(n.text)} <span class="src">${esc(n.tags)}</span></li>`; }
function ideaBody(p,t){ const qs=p.quotes.filter(q=>q.theme===t.id); let h="";
  if(t.diagram) h+=diagram(t);
  if(t.nuggets.length) h+=`<ul class="lessons">${t.nuggets.map(id=>nuggetLi(p.nuggets[id])).join("")}</ul>`;
  if(t.table==="mistakes") h+=`<p>${esc(t.idea)}</p>${goBtn("special",null,"See his full list of mistakes ↓","btnlink")}`;
  if(p.id==="munger" && t.num===4) h+=goBtn("special",null,"See all twenty-five mental traps ↓","btnlink");
  const spl=(SP_LINK[p.id]||{})[t.num]; if(spl) h+=goBtn("special",spl[0],esc(spl[1]),"btnlink");
  if(t.tool) h+=goBtn("special","t-"+t.tool,"Try it: "+esc(TOOLS.find(x=>x[0]===t.tool)[1])+" ↓","btnlink");
  if(t.stories && t.stories.length) h+=`<h4>From his own story</h4>${t.stories.map(s=>`<p class="story"><b>${esc(s.t)}.</b> ${esc(s.x)} <span class="src">${esc(s.src)}</span></p>`).join("")}`;
  if(qs.length) h+=qs.map(q=>qq(q.text, q.label)).join("");
  if(t.ask && t.ask.length) h+=`<div class="pask"><b>Ask yourself</b><ul>${t.ask.map(a=>`<li>${esc(a)}</li>`).join("")}</ul></div>`;
  return h; }
function invIdeas(p){ return `<div class="accs">${p.themes.map(t=>{ const ss=sentences(t.idea); return acc("idea-"+t.num, sumRow(t.num, esc(t.title), esc(ss[0])), (ss.length>1&&t.table!=="mistakes"?`<p class="lead1">${esc(ss.slice(1).join(" "))}</p>`:"")+ideaBody(p,t)); }).join("")}</div>`; }
function invSpecial(p){
  if(p.id==="buffett"){ const mq=p.quotes.filter(q=>q.theme==="t13");
    return `<ol class="mist">${p.mistakes.map(m=>`<li><span class="yr">${esc(m.tags)}</span><div><b>${esc(m.did)}</b><p>${esc(m.lesson)}</p></div></li>`).join("")}</ol>${mq.map(q=>qq(q.text,q.label)).join("")}`; }
  if(p.id==="munger"){ const li=t=>`<li><b>${esc(t.name)}.</b> ${esc(t.what)} <span class="guard">Guard: ${esc(t.guard)}</span></li>`, T=p.tendencies;
    return `<ol class="tend">${T.slice(0,8).map(li).join("")}</ol>${acc("tend-all", sumRow(null,"Show the other "+(T.length-8), "Numbers 9 to "+T.length), `<ol class="tend" start="9">${T.slice(8).map(li).join("")}</ol>`, "mini")}
      <p class="note">He said the real damage comes when several of these act at once, which he called the lollapalooza effect.</p>`; }
  if(p.special==="checklist") return spBolton(p);
  if(p.special==="quality") return spSmith(p);
  if(p.special==="keynes") return spKeynes(p);
  if(p.special==="cn") return spCN(p);
  const TF={sorter:tSorter,perfect:tPerfect,peg:tPeg,drill:tDrill,tenbag:tTenbag,cocktail:tCocktail,silly:tSilly};
  return `<div class="accs">${TOOLS.map(t=>acc("t-"+t[0], sumRow(t[4], esc(t[1]), esc(t[2])), `<div class="ltool bare">${TF[t[0]]()}</div>`)).join("")}</div>`; }
/* ---------- UK special sections ---------- */
const BOLTON_Q = ["The business franchise is strong","It will still be here in ten years, and be worth more","It is in control of its own destiny","The managers know the detail, and are candid with owners",
  "I can write my reason for owning it in three lines","I have written the case against it, and why I disagree","It looks cheap on more than one measure, against its own history and its rivals",
  "The crowd is gloomy, and I can say why the gloom is overdone","The chart does not contradict my research"];
V4.bt = V4.bt || new Set();
function spBolton(p){ const n=V4.bt.size, N=BOLTON_Q.length;
  const verdict = n===0 ? "Think of one company and tick what is true of it today."
    : n===N ? "Every box ticked. Write the case against it once more, then decide."
    : n>=6 ? "Promising. Find out what the unticked boxes could cost you before buying."
    : "Too many gaps for now. He would keep researching, or walk away.";
  return `<div class="box-h">Before buying: ${N} questions</div><div class="lchecks">${BOLTON_Q.map((t,i)=>`<button data-bt="${i}" class="${V4.bt.has(i)?"on":""}" aria-pressed="${V4.bt.has(i)}"><span class="lck">${V4.bt.has(i)?"✓":i+1}</span>${esc(t)}</button>`).join("")}</div>
  <div class="lmeter"><div><b>${n}</b>/${N} ticked<div class="bar"><i style="width:${n/N*100}%"></i></div></div></div>
  <p class="verdict">${esc(verdict)}</p>${n?`<button class="btn ghost" data-btclear="1">Clear</button>`:""}
  <h3 id="sp-sell">His three reasons to sell</h3><ol class="test"><li>Something breaks the reason you bought it.</li><li>The share reaches the value you worked out.</li><li>You find a clearly better idea for the money.</li></ol>
  <p class="note">Never a reason: holding on to get back to what you paid. These questions are our summary of his book and interviews, a study aid, not a recommendation.</p>`; }
V4.qc = V4.qc || {};
function qcMark(r, v){ if(v===""||v==null||isNaN(+v)) return ""; const x=+v, [,,fund,sp]=r;
  return x>=fund ? `<span class="qc ok2">✓✓ At his fund's level</span>` : x>sp ? `<span class="qc ok">✓ Better than the S&amp;P 500</span>` : `<span class="qc no">Not above the S&amp;P 500</span>`; }
function spSmith(p){ const Q=p.quality;
  const rows=Q.rows.map(r=>`<tr><th scope="row">${esc(r[0])}</th><td><b>${r[2]}${r[5]}</b></td><td>${r[3]}${r[5]}</td><td>${r[4]}${r[5]}</td></tr>`).join("");
  const tool=Q.rows.map(r=>`<div class="qcrow"><label for="qc-${r[1]}">${esc(r[0].replace(" (median)",""))}${r[5]==="x"?" (times)":" (%)"}</label><input id="qc-${r[1]}" type="number" inputmode="decimal" step="any" value="${esc(V4.qc[r[1]]??"")}" placeholder="e.g. ${r[3]}"><span id="qco-${r[1]}">${qcMark(r, V4.qc[r[1]])}</span></div>`).join("");
  return `<p>Every January he publishes the same few numbers for the companies he owns, beside the market's. These are the ${Q.year} figures.</p>
  <div class="tw"><table class="t qtab"><thead><tr><th scope="col"></th><th scope="col">His fund</th><th scope="col">S&amp;P 500</th><th scope="col">FTSE 100</th></tr></thead><tbody>${rows}</tbody></table></div>
  <p class="small muted">Weighted averages, except interest cover (median). Source: Fundsmith annual letter, ${Q.year}.</p>
  <h3>Check a company you know</h3><p class="small">Type a number from its annual report. Each line compares it with his fund and with the S&amp;P 500.</p><div class="qctool">${tool}</div>
  ${acc("sp-rules", sumRow(null,"His ten rules, in our words","From the Financial Times, 2013"), `<ol class="test">${p.rules10.map(r=>`<li>${esc(r)}</li>`).join("")}</ol>`, "mini")}
  ${acc("sp-tricks", sumRow(null,"The accounting tricks he exposed","From Accounting for Growth, 1992"), `<ol class="test">${p.tricks.map(r=>`<li>${esc(r)}</li>`).join("")}</ol><p class="note">His point: profit is an opinion that accounting choices can shape; cash is much harder to fake.</p>`, "mini")}
  <p class="note">A study aid, not a stock screen. A high number on one line proves nothing on its own.</p>`; }
function spKeynes(p){ const ph=p.phases;
  const col=(h,k,cls)=>`<div class="${cls}"><b class="dh">${h}</b><dl>${ph.map(r=>`<dt>${esc(r[0])}</dt><dd>${esc(r[k])}</dd>`).join("")}</dl></div>`;
  return `<div class="duo">${col("1920s: forecaster",1,"")}${col("1930s on: stock picker",2,"on")}</div>
  <h3>His three principles, May 1938</h3><ol class="test"><li><b>Careful selection.</b> A few investments, cheap against what they are likely to be worth over the years ahead.</li><li><b>Steadfast holding.</b> Own them in size, through good and bad times, until they deliver or prove a mistake.</li><li><b>Balance.</b> Big holdings, but different risks, some that move the opposite way.</li></ol>
  <div class="honest"><b>An honest note</b><p>${esc(p.honest)}</p></div>`; }
/* ---------- China special sections: built from data blocks ---------- */
V4.ck = V4.ck || {};
function spCN(p){ return (p.sp||[]).map(B=>{
  if(B.k==="checks"){ const S=V4.ck[p.id]||(V4.ck[p.id]=new Set()), n=S.size, N=B.items.length, V=B.verdicts;
    const verdict = n===0?V[0]:n===N?V[1]:n>=Math.ceil(N*0.7)?V[2]:V[3];
    return `<div class="box-h">${esc(B.title)}</div><div class="lchecks">${B.items.map((t,i)=>`<button data-ck="${p.id}:${i}" class="${S.has(i)?"on":""}" aria-pressed="${S.has(i)}"><span class="lck">${S.has(i)?"✓":i+1}</span>${esc(t)}</button>`).join("")}</div>
    <div class="lmeter"><div><b>${n}</b>/${N} ticked<div class="bar"><i style="width:${n/N*100}%"></i></div></div></div>
    <p class="verdict">${esc(verdict)}</p>${n?`<button class="btn ghost" data-ckclear="${p.id}">Clear</button>`:""}${B.note?`<p class="note">${esc(B.note)}</p>`:""}`; }
  if(B.k==="ol") return `<h3${B.id?` id="${B.id}"`:""}>${esc(B.title)}</h3><ol class="test">${B.items.map(([a,c])=>`<li><b>${esc(a)}</b>${c?" "+esc(c):""}</li>`).join("")}</ol>${B.note?`<p class="note">${esc(B.note)}</p>`:""}`;
  if(B.k==="gtests") return gtestsHTML(p,B);
  if(B.k==="gnum") return gnumHTML(p,B);
  if(B.k==="stages") return stagesHTML(p,B);
  if(B.k==="feecalc") return feecalcHTML(p,B);
  if(B.k==="pairs") return pairsHTML(p,B);
  if(B.k==="valtool") return valtoolHTML(p,B);
  if(B.k==="memo") return memoHTML(p,B);
  if(B.k==="reveal") return revealHTML(p,B);
  if(B.k==="cycle") return cycleHTML(p,B);
  if(B.k==="snowball") return snowballHTML(p,B);
  if(B.k==="rrcalc") return rrHTML(p,B);
  if(B.k==="ttcheck") return ttHTML(p,B);
  if(B.k==="bwday") return bwHTML(p,B);
  if(B.k==="honest") return `<div class="honest"${B.id?` id="${B.id}"`:""}><b>An honest note</b><p>${esc(B.text)}</p></div>`;
  if(B.k==="note") return `<p class="note">${esc(B.text)}</p>`;
  return ""; }).join(""); }
function invWords(p){ const Q=p.quotes, li=q=>qq(q.text,q.label);
  return Q.slice(0,5).map(li).join("")+(Q.length>5?acc("q-all", sumRow(null,"Show all "+Q.length+" quotes",""), Q.slice(5).map(li).join(""), "mini"):"")+
    `<p class="note">Exact words are kept short, at most one line per ${esc(p.unitWord)}. The originals are their authors' copyright.</p>`; }
function invOriginals(p){ const word=p.id==="buffett"?"letter":"source";
  const body=u=>{ const ns=(u.nuggets||[]).map(id=>p.nuggets[id]).filter(Boolean);
    return `${u.date?`<p class="small muted">${esc(u.date)}</p>`:""}${p.id!=="buffett"?`<p>${esc(u.summary)}</p>`:""}
    ${ns.length?`<h4>Ideas from this ${word}</h4><ul class="plainl">${ns.map(n=>`<li>${esc(n.lead)}</li>`).join("")}</ul>`:""}
    <a class="btn ghost" href="${esc(u.link)}" target="_blank" rel="noopener">${esc(u.linkLabel)} ↗</a>`; };
  const reading = p.id==="munger" ? `<h3>Books he recommended</h3>${bl(p.big.reading.map(esc),"plain")}` : p.id==="lynch" ? `<h3>His books</h3>${bl(p.big.reading.map(esc),"plain")}` : "";
  return `<p>${esc(p.readHow)}</p><div class="accs">${p.units.map(u=>acc("src-"+u.key, sumRow(null, esc(p.id==="buffett"?u.title:u.title.split(",")[0].split(":")[0]+(u.year?" ("+u.year+")":"")), esc(p.id==="buffett"?u.summary:(u.chip||""))), body(u))).join("")}</div>${reading}`; }
function invTest(p){ return `<p>Answer out loud, or write two lines. If you get stuck, reopen the idea and try again tomorrow.</p><ol class="test">${p.selftest.map(q=>`<li>${esc(q)}</li>`).join("")}</ol>`; }
function invPlan(p){ const uw=k=>{ const u=p.units.find(x=>x.key===k); return u?(u.chip||k):k; };
  return `<p>${esc(p.start.para)}</p><ol class="plan">${p.plan.map(w=>`<li><b>Week ${w.n}: ${esc(w.label)}</b><span>${w.themes.map(t=>{ const th=p.themes.find(x=>x.id===t); return th?goBtn("ideas","idea-"+th.num,"Idea "+th.num):""; }).join(" ")}${w.units.length?` <span class="muted">Then read: ${w.units.map(k=>esc(uw(k))).join(", ")}</span>`:""}${w.extra?` <span class="muted">${esc(w.extra)}</span>`:""}</span></li>`).join("")}</ol>`; }
function invGlossary(p){ return `<dl class="gloss">${p.glossary.map(([a,b])=>`<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join("")}</dl>`; }
function invSources(p){ return `<p>${esc(p.sourcesNote)}</p><p>${esc(p.scope)}</p><h3>Disclaimer</h3><div class="disc">${p.disclaimer.map(d=>`<p>${esc(d)}</p>`).join("")}</div>`; }
function invPage(pid){ CUR=pid; V4.country=ctryOf(pid); const p=P(), same=INV.filter(x=>ctryOf(x)===V4.country), i=same.indexOf(pid), nx=same[i+1], [spT,spS]=SPECIAL[pid];
  V4.secs=[
    sec("five","His thinking in five minutes","Start here.",()=>invFive(p)),
    ...(p.rec?[sec("record","The track record",p.rec.kind==="contest"?"Charts built from verified contest results, with his own figures clearly marked.":p.rec.kind==="macro"?"Figures reported to the press, charted, with the gaps and disagreements marked.":"Charts built from the public record. Tap and drag to explore.",()=>trRecordHTML(p),true)]:[]),
    sec("ideas","The big ideas","Tap an idea to open it. Each one comes with his lessons, a picture where it helps, and questions to ask yourself.",()=>invIdeas(p)),
    sec("special",spT,spS,()=>invSpecial(p), pid==="lynch"||pid==="bolton"||(p.sp||[]).some(b=>b.k==="checks"||b.k==="gtests"||b.k==="stages"||b.k==="pairs"||b.k==="reveal"||b.k==="cycle")),
    sec("words",(p.wordsHead||[])[0]||"In his own words",(p.wordsHead||[])[1]||"Short lines, exactly as he wrote or said them.",()=>invWords(p)),
    sec("originals","Read the originals",`All ${p.units.length} ${UNITS_WORD[pid]}, with what each is best for.`,()=>invOriginals(p)),
    sec("test","Test yourself",`${capW(p.selftest.length)} questions. If you can answer them, you understand him.`,()=>invTest(p)),
    sec("plan",`A ${numW(p.plan.length)}-week plan`,"About an hour a week, if you want a routine.",()=>invPlan(p)),
    sec("glossary","Words to know","",()=>invGlossary(p)),
    sec("sources","Sources and disclaimer","",()=>invSources(p)),
  ];
  return topbar(p.name)+`<div class="wrap">${riskBanner(p)}${invHero(p)}${renderSecs(V4.secs)}
    <nav class="nextp">${nx?`<a href="#${nx}"><small>Next</small>${esc(PACKS[nx].name)} ›</a>`:V4.country==="usa"?`<a href="#timeline"><small>Next</small>The Timeline ›</a>`:V4.country==="uk"?`<a href="#timeline-uk"><small>Next</small>The UK Timeline ›</a>`:`<a href="#"><small>Next</small>Back to the library ›</a>`}<a class="ghost" href="#">‹ Back to the library</a></nav>${footNote()}</div>`; }

/* ---------- timeline page ---------- */
function tlSkyBlock(){ const y=Math.floor(TLS.t); TLS.lastY=null;
  return `<figure class="tl-sky">${tlSkySVG()}<figcaption>${tlLegend("Rings: age 25, 50, 75, 100")}</figcaption></figure>
  <div class="tl-ctrl"><button class="ab" data-tlstep="-1" aria-label="One year back">◀ 1 yr</button><button class="btn" id="tlPlay">${TLS.playing?"❚❚ Pause":"▶ Play"}</button><button class="ab" data-tlstep="1" aria-label="One year forward">1 yr ▶</button></div>
  <input type="range" id="tlRange" class="tlrange" min="${TL.start}" max="${TL.end}" step="1" value="${y}" aria-label="Choose a year">
  <div class="chips tjump">${TL.labels.jumps.map(v=>`<button data-tljump="${v}">${v}</button>`).join("")}</div>
  <div id="tlNow">${tlNowCard(y)}</div>
  <p class="note">The bright hand is the year. Each life spirals out from the sun as it ages. Comets mark market storms.</p>
  <h3>Four numbers that frame the century</h3><div class="tstats">${TL.longRun.map(([a,b])=>`<div class="stat"><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("")}</div>`; }
function tlYearBody(y){ const pres=tlTerm(TL.presidents,y).join(" → "), fed=tlTerm(TL.fed,y).join(" → "), cr=TL.crossings.filter(c=>c.y===y);
  return `${tlAges(y,"sm")}<p class="small muted">${esc(TL.labels.leader)}: ${esc(pres)}${fed?` · ${esc(TL.labels.bank)}: ${esc(fed)}`:""}</p>
  <div class="lanes full">${TLO.map(id=>tlLane(id,y,true)).join("")}${tlLaneW(y)}</div>
  ${cr.map(c=>`<div class="cross"><div class="box-h">Where their lives crossed</div><b>${esc(c.t)}</b><p class="small">${esc(c.d)}</p></div>`).join("")}${tlPulse(y)}${tlSrc([y])}`; }
function tlYears(){ return `<div class="jump"><label class="lbl" for="tlYearSel">Jump to a year</label><select id="tlYearSel"><option value="">Choose a year</option>${tlRange(TL.start,TL.end).reverse().map(y=>`<option value="${y}">${y}</option>`).join("")}</select></div>
  <div class="accs">${TL.eras.map(e=>{ const yrs=tlRange(e.a,e.b);
    return acc("era-"+e.n, sumRow(e.n, esc(e.title), `${e.a}–${e.b} · ${esc(e.tag)}`),
      `<p>${esc(e.intro)}</p><div class="where">${TLO.map(id=>`<div class="wr a${id}"><span class="dot"></span><b>${esc(TLP[id].short)}</b><span>${esc(e.where[id])}</span></div>`).join("")}</div>
      <div class="accs yrs">${yrs.map(y=>acc("yr-"+y, `<span class="yno">${y}</span><span class="st"><span>${esc(TL.threads[y]||((TL.years[y].W||[])[0]||{}).t||"")}</span></span>`, isOpen("yr-"+y)?tlYearBody(y):"", "yr")).join("")}</div>`); }).join("")}</div>`; }
function tlLivesBlock(){ return `<h3>Where their lives crossed</h3>${TL.crossings.map(c=>`<a class="xcard" href="${tlH("y-"+c.y)}"><span class="xy">${esc(c.lab)}</span><span><b>${esc(c.t)}</b> <span class="xw">${c.who.split("").map(w=>TLP[w].short).join(" + ")}</span><span class="small muted">${esc(c.d)}</span></span></a>`).join("")}
  <h3>Their lives in chapters</h3><div class="accs">${TLO.map(id=>acc("life-"+id, `<span class="dotl a${id}"><span class="dot"></span></span><span class="st"><b>${esc(TLP[id].name)}</b><span>${esc(TLP[id].line)}</span></span>`,
    `<ol class="stl">${TL.stages[id].map(g=>{ const p=TLP[id], b=Math.min(g.b, p.died?p.died[0]:TL.end); return `<li><span class="sy">${g.a===b?g.a:g.a+"–"+b}</span><span><b>${esc(g.l)}</b> <span class="small muted">${esc(g.d)}</span></span></li>`; }).join("")}</ol>`)).join("")}
  ${acc("lives-chart", sumRow(null,"Show all three lifelines as one chart","A tall chart: tap a segment for that chapter"), isOpen("lives-chart")?`<figure class="tl-lives">${tlLivesSVG()}<figcaption>${tlLegend("Shaded bands: "+esc(TL.labels.leaders))}</figcaption></figure>`:"", "mini")}</div>`; }
function tlPage(){
  V4.secs=[
    sec("sky","The century in one picture","Press play, or drag the years.",tlSkyBlock),
    sec("age","At the same age","Where each man was at 25, 40, 60 or any age you pick.",()=>stripHead(vTAge())),
    sec("storms",TL.labels.stormsTitle,`${TL.storms.length} market crashes, and what each of them did.`,()=>stripHead(vTStorms()).replace(/^\s*<p class="lede">.*?<\/p>/s,"").replace(/<article class="storm" id="st([^"]+)">/g,'<article class="storm" id="storm-$1">').replace(/<a class="xcard" href="#timeline(-uk)?-invest">.*?<\/a>/s,"")),
    sec("invest","Could you have held on?","Invest with them in any year and live through it, one year at a time.",()=>stripHead(vTInvest()), true),
    sec("years","Year by year",`${TL.end-TL.start+1} years in ${TL.eras.length} chapters. Open a chapter, then a year.`,tlYears),
    sec("lives","Three lifelines",`Their lives in chapters, and the ${numW(TL.crossings.length)} moments they crossed.`,tlLivesBlock),
    sec("quiz","Quiz: who, when?","Sixteen questions about the century.",()=>stripHead(vTQuiz()), true),
    sec("about","How this was checked","Sources, method and disclaimer.",()=>stripHead(vTAbout())),
  ];
  const uk=TL.labels.country==="uk";
  return topbar(uk?"The UK Timeline":"The Timeline")+`<div class="wrap"><div class="phero"><span class="ava big a-timeline">✦</span><h1>${esc(TL.labels.title)}</h1>
    <p class="hook">${esc(TL.labels.hook)}</p>
    <ul class="facts"><li><b>${TL.end-TL.start+1}</b> years</li><li><b>${Object.values(TL.years).reduce((s,y)=>s+["M","B","L","W"].reduce((a,k)=>a+(y[k]||[]).length,0),0)}</b> moments</li><li><b>${TL.storms.length}</b> storms</li></ul>
    <div class="how"><b>How to use this page</b><ol><li>Press play on the sky and watch a century go by.</li><li>Scroll down for the storms and the hold test.</li><li>Open any year to read what happened to each of them.</li></ol></div></div>
    ${renderSecs(V4.secs)}<nav class="nextp">${uk?`<a href="#bolton"><small>Next</small>Anthony Bolton ›</a>`:`<a href="#buffett"><small>Next</small>Warren Buffett ›</a>`}<a class="ghost" href="#">‹ Back to the library</a></nav>${footNote()}</div>`; }

/* ---------- the builder's own record ---------- */
function jLessons(){ const ks=[["all","All"],["kept","✓ Kept"],["broke","✗ Broke"],["risk","! Risks now"]], list=J.lessons.filter(L=>JF.kind==="all"||L.kind===JF.kind);
  return `<div class="chips">${ks.map(([k,l])=>`<button data-jk="${k}" class="${JF.kind===k?"on":""}">${l}</button>`).join("")}</div>
  <div class="accs">${list.map(L=>{ const [ic,lab]=KIND[L.kind]; return acc("jl-"+L.id, `<span class="no jk ${L.kind}">${ic}</span><span class="st"><b>${esc(L.title)}</b><span>${esc(lab)} · ${L.y[0]===L.y[1]?L.y[0]:L.y[0]+" to "+L.y[1]}</span></span>`, lessonCard(L,false).replace(/<h3>.*?<\/h3>/,"")); }).join("")}</div>`; }
function journeyPage(){ const h=J.hero;
  V4.secs=[
    sec("story","The short version","",()=>`${bl(J.story.map(esc),"plain")}<h3>Why this is here</h3>${bl(["Saying “I learned from Buffett and Munger” means little without the receipts.","These are the receipts: what their rules did when I kept them, and what it cost when I didn't.","I am not a legend. If my mistakes save you one of yours, this page has done its job."],"plain")}`),
    sec("falls","Even the legends fell this far","The deepest falls, theirs and mine.",fallsChart),
    sec("score","The scoreboard","My record next to theirs, and next to the plain fund I measure myself against.",()=>`${tbl(["Record","Period","A year"], J.score.map(([a,b,c,who])=>({cls:"sc-"+who, cells:[`<b>${esc(a)}</b>`,esc(b),`<b>${esc(c)}</b>`]})), {stack:false, cls:"score"})}<h3>Read this before comparing</h3>${bl(J.caveats.map(esc),"plain")}<h3>Career facts</h3>${kv(J.facts.map(([a,b])=>[esc(a),esc(b)]))}`),
    sec("years","Year by year","Me against my yardstick fund.",()=>`${yearBars()}<h3>Growth of 1</h3>${growthChart()}${startTool()}<h3>My rule 12, window by window</h3><p class="note">My three-year return against the fund's. Seven windows in a row behind: by my own rule, I should have handed over.</p>${tbl(["3 years to","Me","Fund",""], J.rule12.map(([w,m,f,s])=>({cls:"r12-"+s, cells:[`<b>${w}</b>`,mns(m)+"%",mns(f)+"%",s==="ahead"?"✓ ahead":s==="level"?"≈ level":"✗ behind"]})), {stack:false, cls:"r12"})}`, true),
    sec("lessons","Where I kept their rules, and where I broke them",`${J.lessons.length} lessons, in order. Each links to the idea it comes from.`,jLessons, true),
    sec("rules","My rules today","Every rule here was paid for by a lesson above.",()=>`<ol class="test">${J.rulesNow.map(r=>`<li>${esc(r)}</li>`).join("")}</ol><p class="note">${esc(J.rulesNote)}</p>`),
    sec("method","How these were worked out","",()=>`${bl(J.method.map(esc),"plain")}<h3>Please read</h3><div class="disc">${J.disclaimer.map(d=>`<p>${esc(d)}</p>`).join("")}</div>`),
  ];
  return topbar("About me")+`<div class="wrap"><div class="phero"><span class="ava big a-journey">✎</span><h1>${esc(h.title)}</h1><p class="hook">${esc(h.sub)}</p>
    <div class="rec">${h.stats.map(([a,b])=>`<div><b>${esc(a)}</b><span>${esc(b)}</span></div>`).join("")}</div><p class="small muted">As of ${esc(J.asOf)}. Percentages only.</p></div>
    ${renderSecs(V4.secs)}<nav class="nextp"><a href="#buffett"><small>Next</small>Warren Buffett ›</a><a class="ghost" href="#">‹ Back to the library</a></nav>${footNote()}</div>`; }

/* ---------- about ---------- */
function aboutPage(){
  V4.secs=[
    sec("who","Who writes this","",()=>`<p>The pages are written under the pen name <b>The Alien</b>. The Alien is not a financial adviser and is not registered with SEBI, the SEC or any regulator. Every figure is checked against at least two independent sources where possible, primary filings come first, and each page lists its sources. Mistakes are corrected openly when found and listed on the <a href="corrections.html">corrections page</a>.</p>`),
    sec("what","What this is","",()=>bl(["A free, independent study room for learning from the world's great investors, in their own words and in plain ones.","Every investor gets one page, built the same way: a five-minute summary, the big ideas, his or her special section, their own words, the originals, a test and a plan.",REG_COVER],"plain")),
    sec("words","Summaries and exact words","",()=>bl(["Every summary, idea and lesson is written in our own words.","Exact words appear only as short lines, with their source.","The originals are their authors' copyright, so longer passages are not reproduced. Each page links you to them."],"plain")),
    sec("disc","Disclaimer","",()=>`<div class="disc">${SITE_DISC.map(d=>`<p>${esc(d)}</p>`).join("")}</div>`),
  ];
  return topbar("About")+`<div class="wrap"><div class="phero"><h1>About the library</h1><p class="hook">What it is, how it was made, and what it is not.</p></div>${renderSecs(V4.secs)}<nav class="nextp"><a href="#"><small>Back</small>The library ›</a></nav>${footNote()}</div>`; }
const SITE_DISC=[
  "For educational and informational purposes only. This site is an independent study guide for general learning.",
  "Not advice. Nothing here is investment, financial, legal, tax or accounting advice, and nothing is a recommendation or solicitation to buy, sell or hold any security. It does not take account of any reader's objectives or circumstances. Investing involves risk, including loss of capital. Past results do not predict future results.",
  "Not registered. This site and its makers are not registered with the Securities and Exchange Board of India (SEBI), Japan's Financial Services Agency or any other regulator as an investment adviser, research analyst or financial adviser, and offer no such service. Companies and funds are named only for history and education, never as a view on their shares or units.",
  "No warranty. The content paraphrases and interprets public documents and may contain errors or omissions. It is provided as is, without warranty of any kind as to accuracy or completeness. Check everything against the originals.",
  "No liability. To the fullest extent permitted by law, no liability is accepted for any loss or damage arising from use of or reliance on this site.",
  REG_INDEP];


/* ---------- privacy and terms ---------- */
const PRIVACY=[
 ["The short version","This site does not ask for your name or email, has no accounts, sets no cookies and shows no ads. To count visits, the website uses Cloudflare Web Analytics, which sets no cookies and does not track individual visitors. The site does not sell or share any information about you."],
 ["What your browser keeps","Nothing. The site saves nothing in your browser and sets no cookies. If you used notes or bookmarks in an earlier version of the site, those were kept only on your own device; you can clear them at any time in your browser settings."],
 ["Visitor counts","On alienspacex.com, a small script from Cloudflare Web Analytics counts page views and visits in total, for example which pages are read and roughly which countries visitors come from. It sets no cookies, does not follow you across other websites and does not build a profile of you. This is covered by Cloudflare's own privacy policy."],
 ["What the host sees","The site is hosted on GitHub Pages (and a copy on claude.ai). Like any web host, they may record technical information such as your IP address and browser type to keep the service running and secure. This is covered by their own privacy statements: GitHub's Privacy Statement and Anthropic's Privacy Policy."],
 ["Fonts and outside requests","The site uses the fonts already on your device and loads nothing from other websites while you read. Links to original letters, talks and books take you to other sites, which have their own policies."],
 ["Search engines","If you arrive from a search engine, that search engine's own policy applies to your search."],
 ["Children","The site is general educational material and does not knowingly collect information from anyone."],
 ["Changes","If this ever changes, for example if a visitor counter is added, this page will be updated first and will say exactly what is collected."],
 ["Last updated","24 November 2026."]];
const TERMS=[
 ["Using this site","The Alien's Guide to Earth is free to read. By using it you agree to these terms. If you do not agree, please do not use the site."],
 ["Education only, not advice","Everything here is for general education and information. It is not investment, financial, legal, tax or accounting advice, and it is not a recommendation to buy, sell or hold any security. It does not consider your objectives or circumstances. Speak to a qualified, registered adviser before making financial decisions. Investing involves risk, including the loss of capital, and past results do not predict future results."],
 ["Accuracy","The summaries paraphrase and interpret public documents. They may contain errors or omissions and may be out of date. The site is provided as is, without warranties of any kind. Always check against the original sources, which are linked."],
 ["No liability","To the fullest extent permitted by law, no liability is accepted for any loss or damage, direct or indirect, arising from use of or reliance on this site or anything linked from it."],
 ["Independent","This site is not affiliated with, endorsed, sponsored or reviewed by any investor or estate featured, or by Berkshire Hathaway, GEICO, Fisher & Co., Franklin Templeton, the John Templeton Foundation, Vanguard, Oaktree, Baupost, Fidelity, Fundsmith, King's College, Cambridge, Himalaya Capital, BBK, Gaoyi Asset Management, Hillhouse, any publisher, or any company or person named. All trademarks belong to their owners."],
 ["Reusing the content","The text written for this site may be copied, translated and reused under the Creative Commons Attribution 4.0 licence (CC BY 4.0), with credit to “The Alien's Guide to Earth”. Short quotations remain the copyright of their authors and are not covered by this licence. The site's code is under the MIT licence."],
 ["Corrections","If you find an error, please report it on the site's public GitHub page so it can be fixed for everyone."],
 ["Changes","These terms may be updated. The version on this page is the one that applies. Last updated 25 November 2026."]];
function legalPage(kind){ const P=kind==="privacy"?PRIVACY:TERMS, t=kind==="privacy"?"Privacy":"Terms of use";
  V4.secs=P.map(([h,x],i)=>sec("l"+i,h,"",()=>`<p>${esc(x)}</p>`));
  return topbar(t)+`<div class="wrap"><div class="phero"><h1>${t}</h1><p class="hook">${kind==="privacy"?"What this site collects about you: almost nothing.":"The plain rules for using this free library."}</p></div>${renderSecs(V4.secs)}<nav class="nextp"><a href="#"><small>Back</small>The library ›</a></nav>${footNote()}</div>`; }
/* give every chart and diagram a text label for screen readers */
function labelSvgs(root){ (root||document).querySelectorAll("svg:not([role])").forEach(svg=>{ const fig=svg.closest("figure"), cap=fig&&fig.querySelector("figcaption"), sec_=svg.closest(".psec"), h=sec_&&sec_.querySelector("h2");
  svg.setAttribute("role","img"); if(!svg.getAttribute("aria-label")) svg.setAttribute("aria-label", ((cap&&cap.textContent.trim())||(h&&("Diagram: "+h.textContent))||"Diagram").slice(0,160)); }); }

/* ---------- routing ---------- */
function mapInv(r,v){
  let m;
  if(!v||v==="start"||v==="home"||v==="notes"||v==="rules") return;
  if(["themes","index","cards","compare","ideas"].includes(v)) r.sec="ideas";
  else if((m=v.match(/^(?:theme|idea)-(\d+)$/))){ r.sec="ideas"; r.focus="idea-"+m[1]; }
  else if(["years","sources-list","originals"].includes(v)||v===PACKS[r.pack].unitsRoute) r.sec="originals";
  else if((m=v.match(/^(?:year|source|src)-(.+)$/))){ r.sec="originals"; r.focus="src-"+m[1]; }
  else if(v==="plan"||/^week-\d+$/.test(v)) r.sec="plan";
  else if(["about","handbook","sources"].includes(v)) r.sec="sources";
  else if(["toolkit","tools","special","mistakes","tendencies"].includes(v)) r.sec="special";
  else if((m=v.match(/^(?:tool|t)-(.+)$/))){ r.sec="special"; r.focus="t-"+m[1]; }
  else if(["five","words","test","glossary","record"].includes(v)) r.sec=v;
}
function route(hash){ const h=decodeURIComponent((hash===undefined?location.hash:hash).replace(/^#/,"")); const r={page:"home", pack:null, sec:null, focus:null};
  if(!h||h==="library") return r;
  if(h==="about"){ r.page="about"; return r; }
  if(h==="privacy"||h==="terms"){ r.page=h; return r; }
  if(h==="uk"||h==="usa"||h==="china"||h==="india"||h==="japan"||h==="world"||h==="traders"){ r.country=h; return r; }
  if(h.startsWith("search-")){ V4.q=h.slice(7).replace(/-/g," "); return r; }
  let m; const [a,b]=h.split("/");
  if(a==="timeline"||a.startsWith("timeline-")){ r.page="timeline"; r.tl="usa"; let v=b!==undefined?b:a.slice(9);
    if(a==="timeline-uk"||a.startsWith("timeline-uk-")){ r.tl="uk"; v=b!==undefined?b:a.slice(12); }
    if(!v||v==="sky") return r;
    if(v==="eras") r.sec="years";
    else if((m=v.match(/^era-(\d+)$/))){ r.sec="years"; r.focus="era-"+m[1]; }
    else if((m=v.match(/^y-(\d{4})$/))){ const y=+m[1], e=TL.eras.find(e=>y>=e.a&&y<=e.b); r.sec="years"; if(e){ r.open=["era-"+e.n]; r.focus="yr-"+y; } }
    else if(["age","storms","invest","years","lives","quiz","about"].includes(v)) r.sec=v;
    return r; }
  if(a==="journey"||a.startsWith("journey-")){ r.page="journey"; let v=b!==undefined?b:a.slice(8);
    if(v==="numbers") r.sec="score"; else if(v==="lessons") r.sec="lessons"; else if(v==="rules") r.sec="rules";
    else if((m=v.match(/^l-(.+)$/))){ r.sec="lessons"; r.focus="jl-"+m[1]; } else if(v) r.sec=v;
    return r; }
  let pack="buffett", v=h;
  if(b!==undefined && INV.includes(a)){ pack=a; v=b; }
  else if(INV.includes(h)){ pack=h; v=""; }
  else { const pk=INV.find(x=>h.startsWith(x+"-")); if(pk){ pack=pk; v=h.slice(pk.length+1); } }
  r.page="inv"; r.pack=pack; mapInv(r,v);
  if(pack==="buffett" && v && !r.sec && !["start","home","notes","rules"].includes(v)) return {page:"home",pack:null,sec:null,focus:null};
  return r; }

function pageKey(r){ return r.page+(r.pack?":"+r.pack:"")+(r.country?":"+r.country:"")+(r.tl?":"+r.tl:""); }
function buildPage(r){ const app=document.getElementById("app");
  tlStop(); TLS.pop=null; tlPopShow(); if(LT.drillT){ clearInterval(LT.drillT); LT.drillT=null; }
  if(r.page==="timeline"){ tlUse(r.tl||"usa"); document.documentElement.dataset.pack="timeline"; } else document.documentElement.dataset.pack=r.pack||"home";
  V4.secs=[]; let html; if(r.country) V4.country=r.country;
  if(r.page==="inv") html=invPage(r.pack); else if(r.page==="timeline") html=tlPage(); else if(r.page==="journey") html=journeyPage(); else if(r.page==="about") html=aboutPage(); else if(r.page==="privacy"||r.page==="terms") html=legalPage(r.page); else html=homeHTML();
  app.innerHTML=html; V4.page=pageKey(r);
  document.title = r.page==="home" ? "The Alien's Guide to Earth" : (r.page==="inv" ? PACKS[r.pack].name : r.page==="timeline" ? (TL.labels.country==="uk"?"The UK Timeline":"The Timeline") : r.page==="journey" ? "The builder's record" : r.page==="privacy" ? "Privacy" : r.page==="terms" ? "Terms of use" : "About") + " · The Alien's Guide to Earth";
  if(r.page==="timeline"){ tlSkyUpdate(); tlAgeUpdate(); } labelSvgs(app); }
function openEl(id){ const d=document.getElementById(id); if(!d) return null; V4.open.add(id); if(d.tagName==="DETAILS" && !d.open){ fillLazy(d); d.open=true; }
  let p=d.parentElement; while(p){ if(p.tagName==="DETAILS" && !p.open){ V4.open.add(p.id); p.open=true; } p=p.parentElement; } return d; }
function scrollToEl(el, smooth){ if(!el) return; el.scrollIntoView({block:"start", behavior:(smooth&&!REDUCED&&!window.V4_NOANIM)?"smooth":"auto"}); }
const REDUCED = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
const isDark = () => document.documentElement.dataset.pack==="timeline" || (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches);
function setThemeColor(){ const m=document.querySelector('meta[name="theme-color"]'); if(m) m.setAttribute("content", getComputedStyle(document.body).backgroundColor); }
/* a page change fades out and the new page fades and rises in; dark-to-light goes through a soft dusk instead of a flash */
function transition(fn, toNight){
  if(REDUCED || window.V4_NOANIM || !V4.page){ fn(); return; }
  if(document.startViewTransition){ let done=false; const run=()=>{ if(done) return; done=true; fn(); };
    try{ const vt=document.startViewTransition(run); setTimeout(()=>{ if(!done){ try{ vt.skipTransition(); }catch(e){} run(); } }, 700); }catch(e){ run(); } return; }
  const c=document.getElementById("curtain"); if(!c){ fn(); return; }
  c.style.background = getComputedStyle(document.body).backgroundColor || "#fff";
  c.classList.add("on"); setTimeout(()=>{ fn(); requestAnimationFrame(()=>c.classList.remove("on")); }, 220); }
function navigate(r){ const changed = pageKey(r)!==V4.page;
  if(changed){ transition(()=>{ V4.open=new Set(); (r.open||[]).forEach(id=>V4.open.add(id)); if(r.focus) V4.open.add(r.focus);
      buildPage(r); setThemeColor();
      const el = r.focus ? openEl(r.focus) : r.sec ? document.getElementById("s-"+r.sec) : null;
      if(el) el.scrollIntoView({block:"start"}); else window.scrollTo(0,0); }, r.page==="timeline" || (V4.page||"").startsWith("timeline")); return; }
  (r.open||[]).forEach(id=>V4.open.add(id)); if(r.focus) V4.open.add(r.focus); (r.open||[]).forEach(openEl);
  const el = r.focus ? openEl(r.focus) : r.sec ? document.getElementById("s-"+r.sec) : null;
  if(el) scrollToEl(el, true); else if(!r.sec) window.scrollTo({top:0, behavior:REDUCED?"auto":"smooth"}); }
/* old views call render() after a click: refresh only the live sections, keeping the scroll */
function render(){ if(!V4.page){ navigate(route()); return; }
  V4.secs.filter(s=>s.live).forEach(s=>{ const el=document.getElementById("sb-"+s.id); if(el){ el.innerHTML=s.html(); labelSvgs(el); } }); }
/* heavy panels are filled the first time they open */
function fillLazy(d){ const b=d.querySelector(":scope > .accb"); if(!b || b.childElementCount) return;
  let m; if((m=d.id.match(/^yr-(\d{4})$/))) b.innerHTML=tlYearBody(+m[1]);
  else if(d.id==="lives-chart") b.innerHTML=`<figure class="tl-lives">${tlLivesSVG()}<figcaption>${tlLegend("Shaded bands: "+esc(TL.labels.leaders))}</figcaption></figure>`; labelSvgs(b); }

/* ---------- events ---------- */
document.addEventListener("toggle", e=>{ const d=e.target; if(!d || d.tagName!=="DETAILS" || !d.id) return; if(d.open){ V4.open.add(d.id); fillLazy(d); } else V4.open.delete(d.id); }, true);
function closeMenu(){ const m=document.getElementById("cMenu"), b=document.getElementById("cBtn"); if(m){ m.hidden=true; } if(b) b.setAttribute("aria-expanded","false"); }
document.addEventListener("click", e=>{
  const sm=e.target.closest("details.acc>summary"); if(sm && !REDUCED){ const d=sm.parentElement; if(!d.open){ d.classList.add("opening"); setTimeout(()=>d.classList.remove("opening"),400); } }
  const bwb=e.target.closest("[data-bw]"); if(bwb){ const p=P(), B=p&&(p.sp||[]).find(x=>x.k==="bwday"); if(B){ V4.tr.bw=Math.max(0,Math.min(B.steps.length-1,(V4.tr.bw||0)+Number(bwb.dataset.bw))); const box=document.getElementById("bwBox"); if(box){ box.innerHTML=bwInner(B); labelSvgs&&labelSvgs(box); const f=box.querySelector("[data-bw='"+bwb.dataset.bw+"']"); if(f&&!f.disabled) f.focus(); } } return; }
  const tt=e.target.closest("[data-trtab]"); if(tt){ V4.tr.tab=tt.dataset.trtab; const p=P(); if(p&&p.rec){ const f=document.getElementById("trEq"); if(f) f.innerHTML=trEquitySVG(p.rec); document.querySelectorAll("[data-trtab]").forEach(b=>{ const on=b.dataset.trtab===V4.tr.tab; b.classList.toggle("on",on); b.setAttribute("aria-pressed",String(on)); }); } return; }
  const cb=e.target.closest("#cBtn"); if(cb){ const m=document.getElementById("cMenu"); m.hidden=!m.hidden; cb.setAttribute("aria-expanded", String(!m.hidden)); return; }
  const g=e.target.closest("[data-go]"); if(g){ e.preventDefault(); closeMenu(); const el = g.dataset.open ? openEl(g.dataset.open) : document.getElementById("s-"+g.dataset.go); scrollToEl(el, true); return; }
  const cc=e.target.closest("[data-country]"); if(cc){ e.preventDefault(); V4.country=cc.dataset.country; const app=document.getElementById("app"); app.innerHTML=homeHTML(); return; }
  const qb=e.target.closest("[data-q]"); if(qb){ const i=document.getElementById("q"); if(i){ i.value=qb.dataset.q; V4.q=i.value; document.getElementById("qres").innerHTML=searchHTML(V4.q); } return; }
  if(!e.target.closest("#cMenu")) closeMenu();
  const a=e.target.closest('a[href^="#"]'); if(a && !e.defaultPrevented){ const h=a.getAttribute("href"); if(h===location.hash || (h==="#" && !location.hash)){ e.preventDefault(); navigate(route(h)); } }
  /* the builder's record */
  const t=e.target.closest("button"); if(!t) return;
  if(t.dataset.jk){ JF.kind=t.dataset.jk; render(); return; }
  if(t.dataset.js){ JF.start=+t.dataset.js; render(); return; }
  if(t.dataset.je){ JF.end=t.dataset.je==="now"?"now":2024; render(); return; }
  /* Bolton's checklist */
  if(t.dataset.bt){ const k=+t.dataset.bt; V4.bt.has(k)?V4.bt.delete(k):V4.bt.add(k); render(); return; }
  if(t.dataset.btclear){ V4.bt.clear(); render(); return; }
  /* China checklists */
  if(t.dataset.ck){ const [pid,i]=t.dataset.ck.split(":"), S=V4.ck[pid]||(V4.ck[pid]=new Set()), k=+i; S.has(k)?S.delete(k):S.add(k); render(); return; }
  if(t.dataset.ckclear){ (V4.ck[t.dataset.ckclear]||new Set()).clear(); render(); return; }
  /* Graham's tests, Templeton's moods */
  if(t.dataset.gt){ const [pid,i]=t.dataset.gt.split(":"), S=gtS(pid), k=+i; S.t.has(k)?S.t.delete(k):S.t.add(k); render(); return; }
  if(t.dataset.gtclear){ const S=gtS(t.dataset.gtclear); S.t.clear(); S.v={}; render(); return; }
  if(t.dataset.pr){ const [pid,i,sd]=t.dataset.pr.split(":"), S=prState(pid); if(S[+i]===+sd) delete S[+i]; else S[+i]=+sd; render(); return; }
  if(t.dataset.prclear){ V4.pr[t.dataset.prclear]={}; render(); return; }
  if(t.dataset.stg){ const [pid,i]=t.dataset.stg.split(":"); V4.stg=V4.stg||{}; V4.stg[pid]=+i; render(); return; }
  /* India: bias quiz and flywheel */
  if(t.dataset.rv){ const [pid,i,j]=t.dataset.rv.split(":"), S=rvS(pid); if(S[+i]===undefined) S[+i]=+j; render(); return; }
  if(t.dataset.rvclear){ V4.rv[t.dataset.rvclear]={}; render(); return; }
  if(t.dataset.cy){ const [pid,i]=t.dataset.cy.split(":"); V4.cy=V4.cy||{}; V4.cy[pid]=+i; render(); return; }
  /* Lynch's tools */
  if(t.dataset.lk){ const S_=LT.sorter; if(S_.pick===null){ S_.pick=t.dataset.lk; S_.n++; if(S_.pick===PACKS.lynch.scenarios[S_.order[S_.i]].ans) S_.right++; } render(); return; }
  if(t.dataset.ls){ const S_=LT.sorter; if(t.dataset.ls==="next"){ S_.i++; S_.pick=null; } else { S_.i=0; S_.pick=null; S_.right=0; S_.n=0; S_.order=null; } render(); return; }
  if(t.dataset.lt){ const k=+t.dataset.lt, Z=LT.perfect.t; Z.has(k)?Z.delete(k):Z.add(k); render(); return; }
  if(t.dataset.la){ const k=+t.dataset.la, Z=LT.perfect.a; Z.has(k)?Z.delete(k):Z.add(k); render(); return; }
  if(t.dataset.lclear){ LT.perfect.t.clear(); LT.perfect.a.clear(); render(); return; }
  if(t.dataset.lp){ const k=t.dataset.lp; LT.peg[k]=Math.max(0, Math.round((LT.peg[k]+(+t.dataset.d))*10)/10); const el=document.getElementById("peg-"+k); if(el) el.value=LT.peg[k]; const o=document.getElementById("pegOut"); if(o) o.innerHTML=pegOut(); return; }
  if(t.dataset.lb){ const k=t.dataset.lb, T_=LT.tenbag; T_[k]=Math.max(0, T_[k]+(+t.dataset.d)); const tot=T_.ten+T_.dbl+T_.zero; if(tot>10) T_[k]-=tot-10; render(); return; }
  if(t.dataset.lc){ LT.cocktail=+t.dataset.lc; render(); return; }
  if(t.dataset.lq){ const Q=LT.silly, a2=t.dataset.lq; if(a2==="silly"||a2==="sense"){ if(Q.pick===null){ Q.pick=a2; Q.n++; if((a2==="sense")===PACKS.lynch.silly[Q.order[Q.i]].ok) Q.right++; } } else if(a2==="next"){ Q.i++; Q.pick=null; } else { Q.i=0; Q.pick=null; Q.right=0; Q.n=0; Q.order=null; } render(); return; }
  if(t.dataset.ld){ const a2=t.dataset.ld; if(a2==="start"){ if(LT.drillLeft===0) LT.drillLeft=120; if(!LT.drillT) LT.drillT=setInterval(drillTick,1000); } else if(a2==="stop"){ clearInterval(LT.drillT); LT.drillT=null; } else { clearInterval(LT.drillT); LT.drillT=null; LT.drillLeft=120; } render(); return; }
});
document.addEventListener("input", e=>{ const t=e.target;
  if(t.id==="q"){ V4.q=t.value; document.getElementById("qres").innerHTML=searchHTML(V4.q); return; }
  if(t.id && t.id.startsWith("qc-")){ const k=t.id.slice(3), r=(PACKS.smith.quality.rows.find(x=>x[1]===k)); V4.qc[k]=t.value; const o=document.getElementById("qco-"+k); if(o&&r) o.innerHTML=qcMark(r,t.value); return; }
  if(t.id && t.id.startsWith("gt-")){ const m=t.id.match(/^gt-(\w+)-(\d+)$/); if(m){ gtS(m[1]).v[+m[2]]=t.value; gtRefresh(m[1]); } return; }
  if(t.id==="trScrub"){ V4.tr.i=+t.value; const p=P(); if(p&&p.rec){ const f=document.getElementById("trEq"); if(f) f.innerHTML=trEquitySVG(p.rec); const o=document.getElementById("trRead"); if(o) o.innerHTML=trReadout(p.rec); } return; }
  if(t.id && t.id.startsWith("tt-")){ V4.tr.tt[t.id.slice(3)]=t.value; const o=document.getElementById("ttOut"); if(o) o.innerHTML=ttOut(); return; }
  if(t.id && t.id.startsWith("rr-")){ V4.tr.rr[t.id.slice(3)]=t.value; const o=document.getElementById("rrOut"); if(o) o.innerHTML=rrOut(); return; }
  if(t.id && t.id.startsWith("snow-")){ V4.snow=V4.snow||{}; V4.snow[t.id.slice(5)]=t.value; const o=document.getElementById("snowOut"); if(o) o.innerHTML=snowOut(); return; }
  if(t.id && t.id.startsWith("fee-")){ V4.fee=V4.fee||{}; V4.fee[t.id.slice(4)]=t.value; const o=document.getElementById("feeOut"); if(o) o.innerHTML=feeOut(); return; }
  if(t.id && t.id.startsWith("val-")){ V4.val=V4.val||{}; V4.val[t.id.slice(4)]=t.value; const o=document.getElementById("valOut"); if(o) o.innerHTML=valOut(); return; }
  if(t.id && t.id.startsWith("gn-")){ V4.gn=V4.gn||{}; V4.gn[t.id.slice(3)]=t.value; const o=document.getElementById("gnOut"); if(o) o.innerHTML=gnOut(); return; }
  if(t.id && t.id.startsWith("peg-")){ const k=t.id.slice(4), v=parseFloat(t.value); LT.peg[k]=isNaN(v)?0:Math.max(0,v); const o=document.getElementById("pegOut"); if(o) o.innerHTML=pegOut(); return; } });
document.addEventListener("change", e=>{ const t=e.target; if(t.id==="drillKind"){ LT.drillKind=t.value; render(); } });
document.addEventListener("keydown", e=>{ if(e.key==="Escape") closeMenu(); });
window.addEventListener("hashchange", ()=>{ closeMenu(); navigate(route()); });
const topBtn=document.getElementById("toTop");
window.addEventListener("scroll", ()=>{ if(topBtn) topBtn.classList.toggle("show", window.scrollY>900); }, {passive:true});
if(topBtn) topBtn.addEventListener("click", ()=>window.scrollTo({top:0, behavior:"smooth"}));
/* multi-page website: each person lives at <id>.html (window.__PID); the home page sends person links there.
   The single-file claude.ai copy sets neither flag and keeps working as one page. */
(function(){ const PID=window.__PID||null, MULTI=!!(window.__MULTI||PID); if(!MULTI) return;
  const NV=navigate; let first=true;
  const homeTok=hh=>hh===""||hh==="library"||hh==="about"||hh==="privacy"||hh==="terms"||COUNTRIES.some(c=>c.id===hh)||hh.startsWith("search-")||hh.startsWith("timeline")||hh.startsWith("journey");
  const ownTok=hh=>INV.some(x=>hh===x||hh.startsWith(x+"-")||hh.startsWith(x+"/"));
  navigate=function(r){ const hh=decodeURIComponent(location.hash.replace(/^#/,""));
    if(PID){
      if(first && hh===""){ first=false; return NV(route("#"+PID)); }
      if(hh && !homeTok(hh) && !ownTok(hh)){ first=false; return NV(route("#"+PID+"-"+hh)); }
      if(r.page==="inv" && r.pack===PID){ first=false; return NV(r); }
      if(r.page==="inv"){ location.href=r.pack+".html"+location.hash; return; }
      location.href="./"+(hh?"#"+hh:""); return; }
    if(r.page==="inv"){ location.replace(r.pack+".html"+location.hash); return; }
    first=false; return NV(r); };
})();
navigate(route());

/*SECTJS*/(function(){var d=document.documentElement,R=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches,T=false;try{T=window.top===window}catch(e){}
addEventListener('pageshow',function(){d.classList.remove('pg-out');d.style.background=''});
document.addEventListener('click',function(e){if(R||!T||e.defaultPrevented||e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;var a=e.target.closest&&e.target.closest('a[data-bg]');if(!a)return;e.preventDefault();d.style.background=a.getAttribute('data-bg');d.classList.add('pg-out');setTimeout(function(){location.href=a.href},300)})})();/*/SECTJS*/

/* typing alien in the search box: types once, performs once, then rests */
(function(){var TXT="Type your query…",R=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches,cv=document.createElement("canvas").getContext("2d"),st={n:0,ph:0,w:0},q0=null,played=false,tm=null;
function place(q,r,n){var cs=getComputedStyle(q);cv.font=cs.fontSize+" "+cs.fontFamily;var pad=parseFloat(cs.paddingLeft)||22;r.style.left=(pad+9+cv.measureText(TXT.slice(0,n)).width)+"px";}
function rest(q,r){q.placeholder=TXT;place(q,r,TXT.length);r.classList.remove("show");r.classList.add("go","done");}
function step(){var q=document.getElementById("q"),r=q&&q.parentNode.querySelector(".runner");if(!q||!r)return;
 if(q!==q0){q0=q;st={n:0,ph:played?3:0,w:0};if(played){r.style.transition="none";rest(q,r);void r.offsetWidth;r.style.transition="";}}
 if(R){q.placeholder=TXT;return;}
 if(st.ph===3){if(tm){clearInterval(tm);tm=null;}return;}
 if(document.activeElement===q||q.value){q.placeholder=TXT;played=true;st.ph=3;rest(q,r);return;}
 if(st.ph===0){q.placeholder=TXT.slice(0,st.n);place(q,r,st.n);r.classList.add("go");st.n++;if(st.n>TXT.length){st.ph=1;st.w=0;r.classList.add("show");}}
 else if(st.ph===1){st.w++;if(st.w>=34){st.ph=3;played=true;rest(q,r);}}}
tm=setInterval(step,90);
document.addEventListener("click",function(){if(played&&!tm){tm=setInterval(step,90);setTimeout(function(){if(tm&&st.ph===3){clearInterval(tm);tm=null;}},400);}},true);})();

