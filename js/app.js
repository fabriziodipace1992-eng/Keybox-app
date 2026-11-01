(function(){
'use strict';

const KCFG=window.KEYBOX_CONFIG||{};
const SUPABASE_URL=String(KCFG.supabaseUrl||'').trim().replace(/\/+$/,'');
const SUPABASE_KEY=String(KCFG.supabaseKey||'').trim();
const REMOTE_ON=!!(SUPABASE_URL&&SUPABASE_KEY&&!/INCOLLA/i.test(SUPABASE_URL+SUPABASE_KEY));
const CFG_PRESENT=!!window.KEYBOX_CONFIG;

const LS_KEY='keybox-stupefacenti-v1';
const SS_KEY='keybox-sessione-v1';
const LS_SNOOZE_KEY='keybox-snoozed-lotti-v1';
const LS_NEGATI_KEY='keybox-dismissed-negati-ts';

const CODE_SECONDS=30;
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
function dayKey(ts){const d=new Date(ts);return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function hhmm(ts){const d=new Date(ts);return pad(d.getHours())+':'+pad(d.getMinutes());}
function ddmm(ts){const d=new Date(ts);return pad(d.getDate())+'/'+pad(d.getMonth()+1);}
function ddmmyyyy(ts){const d=new Date(ts);return pad(d.getDate())+'/'+pad(d.getMonth()+1)+'/'+d.getFullYear();}
function mins(ts){return Math.max(0,Math.floor((Date.now()-ts)/60000));}
function fiale(n){return n===1?'1 fiala':n+' fiale';}
function first(name){return String(name||'').split(' ')[0];}
function dayLabel(key){
  const today=dayKey(Date.now()); const y=new Date(); y.setDate(y.getDate()-1);
  if(key===today) return 'Oggi'; if(key===dayKey(y.getTime())) return 'Ieri';
  const [Y,M,D]=key.split('-').map(Number); const d=new Date(Y,M-1,D);
  return d.toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'});
}
function uid(){return 'e'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function val(id){const el=document.getElementById(id);return el?String(el.value).trim():'';}

function loadPersistedState(){
  let snoozed = {};
  let negatiTs = 0;
  try {
    const rawS = localStorage.getItem(LS_SNOOZE_KEY);
    if(rawS) snoozed = JSON.parse(rawS) || {};
  } catch(e){}
  try {
    const rawN = localStorage.getItem(LS_NEGATI_KEY);
    if(rawN) negatiTs = Number(rawN) || 0;
  } catch(e){}
  return { snoozed, negatiTs };
}

function persistSnooze(id, until){
  S.snoozedLotti[id] = until;
  try {
    localStorage.setItem(LS_SNOOZE_KEY, JSON.stringify(S.snoozedLotti));
  } catch(e){}
}

function persistDismissNegati(ts){
  S.dismissedNegatiTs = ts;
  try {
    localStorage.setItem(LS_NEGATI_KEY, String(ts));
  } catch(e){}
}

const IC={
  key:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="4"/><path d="M10.4 12.6 19 4M15.5 7.5l2.5 2.5M13.5 9.5l2 2"/></svg>',
  check:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  alert:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8.5v4.5"/><path d="M12 16.6v.4"/><path d="M10.3 3.9 2.7 17.4a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  info:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 11v6"/><path d="M12 7.5v.5"/></svg>',
  box:'<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><rect x="3.5" y="2.5" width="17" height="19" rx="3.2" fill="currentColor" opacity=".16"/><rect x="3.5" y="2.5" width="17" height="19" rx="3.2" fill="none" stroke="currentColor" stroke-width="1.7"/><g fill="currentColor"><circle cx="8.6" cy="7.6" r="1.25"/><circle cx="12" cy="7.6" r="1.25"/><circle cx="15.4" cy="7.6" r="1.25"/><circle cx="8.6" cy="11" r="1.25"/><circle cx="12" cy="11" r="1.25"/><circle cx="15.4" cy="11" r="1.25"/></g><rect x="7.5" y="14.6" width="9" height="3" rx="1.5" fill="currentColor"/></svg>'
};

function sha256js(ascii){
  function rr(v,a){return (v>>>a)|(v<<(32-a));}
  const maxWord=Math.pow(2,32); let result=''; const words=[]; const bitLen=ascii.length*8;
  let hash=[]; const k=[]; let pc=0; const comp={};
  for(let c=2;pc<64;c++){ if(!comp[c]){ for(let i=0;i<313;i+=c) comp[i]=c; hash[pc]=(Math.pow(c,.5)*maxWord)|0; k[pc++]=(Math.pow(c,1/3)*maxWord)|0; } }
  ascii+='\x80'; while(ascii.length%64-56) ascii+='\x00';
  for(let i=0;i<ascii.length;i++){ const j=ascii.charCodeAt(i); if(j>>8) return ''; words[i>>2]|=j<<((3-i)%4)*8; }
  words[words.length]=((bitLen/maxWord)|0); words[words.length]=bitLen;
  for(let j=0;j<words.length;){
    const w=words.slice(j,j+=16); const old=hash; hash=hash.slice(0,8);
    for(let i=0;i<64;i++){
      const w15=w[i-15],w2=w[i-2]; const a=hash[0],e=hash[4];
      const t1=hash[7]+(rr(e,6)^rr(e,11)^rr(e,25))+((e&hash[5])^((~e)&hash[6]))+k[i]+(w[i]=(i<16)?w[i]:(w[i-16]+(rr(w15,7)^rr(w15,18)^(w15>>>3))+w[i-7]+(rr(w2,17)^rr(w2,19)^(w2>>>10)))|0);
      const t2=(rr(a,2)^rr(a,13)^rr(a,22))+((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));
      hash=[(t1+t2)|0].concat(hash); hash[4]=(hash[4]+t1)|0;
    }
    for(let i=0;i<8;i++) hash[i]=(hash[i]+old[i])|0;
  }
  for(let i=0;i<8;i++){ for(let j=3;j+1;j--){ const b=(hash[i]>>(j*8))&255; result+=((b<16)?0:'')+b.toString(16); } }
  return result;
}
async function sha256(str){
  try{ if(window.crypto&&crypto.subtle){ const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str)); return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join(''); } }catch(e){}
  return sha256js(unescape(encodeURIComponent(str)));
}
const pinHash=(mat,pin)=>sha256('kb1|'+mat+'|'+pin);

const Store=(function(){
  let mode='memory';
  const mem={}; const docSubs=new Map(); const colSubs=[];
  let queue=Promise.resolve();
  const clone=o=>JSON.parse(JSON.stringify(o));
  const parent=p=>p.split('/').slice(0,-1).join('/');
  function enqueue(fn){ const p=queue.then(fn,fn); queue=p.catch(()=>{}); return p; }
  function persist(){ if(mode!=='local') return; try{ localStorage.setItem(LS_KEY,JSON.stringify(mem)); }catch(e){} }
  function loadLocal(){
    try{ const raw=localStorage.getItem(LS_KEY); const obj=raw?JSON.parse(raw):{}; Object.keys(mem).forEach(k=>delete mem[k]); Object.assign(mem,obj); mode='local'; }
    catch(e){ mode='memory'; }
  }
  function query(col,opts){
    let arr=Object.keys(mem).filter(p=>parent(p)===col).map(p=>Object.assign({id:p.split('/').pop()},clone(mem[p])));
    if(opts&&opts.orderBy){ const f=opts.orderBy,d=opts.dir==='desc'?-1:1; arr.sort((a,b)=>(a[f]>b[f]?1:a[f]<b[f]?-1:0)*d); }
    if(opts&&opts.limit) arr=arr.slice(0,opts.limit);
    return arr;
  }
  function notify(path){
    const subs=docSubs.get(path); if(subs) subs.forEach(cb=>cb(mem[path]?clone(mem[path]):null,{}));
    colSubs.forEach(s=>{ if(parent(path)===s.col) s.cb(query(s.col,s.opts)); });
  }
  function notifyAll(){
    docSubs.forEach((subs,p)=>subs.forEach(cb=>cb(mem[p]?clone(mem[p]):null,{})));
    colSubs.forEach(s=>s.cb(query(s.col,s.opts)));
  }
  function deepMerge(t,s){
    Object.keys(s).forEach(k=>{ const v=s[k];
      if(v&&typeof v==='object'&&!Array.isArray(v)){ if(!t[k]||typeof t[k]!=='object'||Array.isArray(t[k])) t[k]={}; deepMerge(t[k],v); }
      else t[k]=v; });
    return t;
  }
  return {
    get mode(){ return mode; },
    async init(){
      loadLocal();
      try{ window.addEventListener('storage',e=>{ if(e.key===LS_KEY){ loadLocal(); notifyAll(); } }); }catch(e){}
    },
    async get(path){ return mem[path]?clone(mem[path]):null; },
    async list(col){ return query(col); },
    watchDoc(path,cb){
      if(!docSubs.has(path)) docSubs.set(path,new Set());
      docSubs.get(path).add(cb); cb(mem[path]?clone(mem[path]):null,{});
      return ()=>docSubs.get(path).delete(cb);
    },
    watchCol(col,opts,cb){
      const sub={col,opts,cb}; colSubs.push(sub); cb(query(col,opts));
      return ()=>{ const i=colSubs.indexOf(sub); if(i>=0) colSubs.splice(i,1); };
    },
    set(path,data){ return enqueue(async()=>{ mem[path]=clone(data); persist(); notify(path); }); },
    merge(path,data){ return enqueue(async()=>{ mem[path]=deepMerge(mem[path]||{},clone(data)); persist(); notify(path); }); },
    del(path){ return enqueue(async()=>{ delete mem[path]; persist(); notify(path); }); }
  };
})();

const DEFAULT_FARMACI=[
  {id:'morfina',nome:'Morfina',sale:'cloridrato',dosaggio:'10 mg / 1 ml',forma:'fiala',sigla:'M',tema:'m',soglia:5,unitaPerScatola:5,attivo:true},
  {id:'fentanyl',nome:'Fentanyl',sale:'citrato',dosaggio:'100 microgrammi / 2 ml',forma:'fiala',sigla:'F',tema:'f',soglia:5,unitaPerScatola:5,attivo:true}
];

const initialPersisted = loadPersistedState();

const S={
  loaded:false, loadError:false, staffLoaded:false, readOnly:false,
  config:null, base:null, key:null, staff:{}, events:[], lotti:[],
  meId:null, meUser:null, view:'home', tab:'stato', flow:null,
  codeShownUntil:0, confirmTake:false,
  loginErr:'', fails:0, lockUntil:0, lastActivity:Date.now(),
  period:14, filter:'tutti', regLimit:120, showTable:false,
  codeFlow:null, coordForm:null, rettPrefill:null, ackId:null, swipeOpen:null, delAsk:null, token:null, codeValue:'', publicInfo:null, pinFor:null,
  qrUrl:null, revealCode:false, resetStep:0, scrollTo:null,
  showMyPinModal:false,
  recoveryFlow:null,
  assocLottoFarmacoId:null,
  snoozedLotti: initialPersisted.snoozed,
  dismissedNegatiTs: initialPersisted.negatiTs
};

const cfg=()=>S.config||{};
const farmaciTutti=()=>(S.config&&S.config.farmaci)||DEFAULT_FARMACI;
const farmaci=()=>farmaciTutti().filter(f=>f.attivo!==false);
const fById=id=>farmaciTutti().find(f=>f.id===id)||{id,nome:id,sale:'',dosaggio:'',tema:'m',sigla:'?',unitaPerScatola:5};
const me=()=>S.meUser||(S.meId?S.staff[S.meId]:null);
const isCoord=()=>{const m=me();return !!m&&m.ruolo==='coordinatore';};

function stock(){
  const b=S.base||{giacenza:{},ts:0}; const g={};
  farmaciTutti().forEach(f=>g[f.id]=(b.giacenza&&b.giacenza[f.id])||0);
  S.events.forEach(e=>{ if(e.ts>b.ts&&e.delta){ Object.keys(e.delta).forEach(k=>{ g[k]=(g[k]||0)+e.delta[k]; }); } });
  return g;
}
function codeAgeDays(){ const c=cfg(); if(!c.codiceDal) return 0; const a=new Date(c.codiceDal), b=new Date(); a.setHours(0,0,0,0); b.setHours(0,0,0,0); return Math.round((b-a)/86400000); }
function codePill(){
  const d=codeAgeDays(), r=cfg().rotazioneGiorni||7;
  if(d>=r) return `<span class="pill warn">Da cambiare · ${d} giorni</span>`;
  if(d>=r-1) return `<span class="pill info">Scade domani</span>`;
  return `<span class="pill ok">In regola · ${d===0?'oggi':d===1?'1 giorno':d+' giorni'}</span>`;
}

function parseScadenza(str){
  if(!str) return null;
  const parts = str.split('-').map(Number);
  if(parts.length < 2) return null;
  return new Date(parts[0], parts[1], 0, 23, 59, 59).getTime();
}

function getFefoPlan(farmacoId, qty){
  const lottiDisponibili = (S.lotti || [])
    .filter(l => {
      const fId = l.farmacoId || l.farmaco_id;
      const rim = l.fialeRimaste != null ? l.fialeRimaste : l.fiale_rimaste;
      return String(fId).trim().toLowerCase() === String(farmacoId).trim().toLowerCase() && Number(rim) > 0;
    })
    .sort((a,b) => {
      const scA = String(a.scadenza || '');
      const scB = String(b.scadenza || '');
      if (scA !== scB) return scA.localeCompare(scB);
      return Number(a.caricatoTs || a.caricato_ts || 0) - Number(b.caricatoTs || b.caricato_ts || 0);
    });

  let need = qty;
  const plan = [];
  for(const l of lottiDisponibili){
    if(need <= 0) break;
    const rimaste = Number(l.fialeRimaste != null ? l.fialeRimaste : l.fiale_rimaste) || 0;
    const unitaScatola = Number(l.unitaPerScatola || l.unita_per_scatola || fById(farmacoId).unitaPerScatola || 5);
    const take = Math.min(need, rimaste);
    plan.push({
      lottoId: l.id,
      farmacoId: farmacoId,
      lotto: l.lotto,
      scadenza: l.scadenza,
      take: take,
      unitaPerScatola: unitaScatola,
      fialeRimasteNelLotto: rimaste - take
    });
    need -= take;
  }
  
  if(need > 0){
    plan.push({
      lottoId: null,
      farmacoId: farmacoId,
      lotto: 'Giacenza libera (senza lotto)',
      scadenza: '—',
      take: need,
      unitaPerScatola: fById(farmacoId).unitaPerScatola || 5,
      fialeRimasteNelLotto: 0
    });
  }
  return plan;
}

async function addEvent(type,payload){
  const ts=Date.now(); const m=me()||{};
  const evt=Object.assign({id:uid(),ts,day:dayKey(ts),type,by:S.meId||'',byName:m.nome||''},payload||{});
  const items={}; items[evt.id]=evt;
  await Store.merge('log/'+evt.day,{day:evt.day,items});
  return evt;
}
async function patchEvent(evt,patch){
  const items={}; items[evt.id]=patch;
  await Store.merge('log/'+(evt.day||dayKey(evt.ts)),{items});
}
const TYPE={chiave_presa:'Chiave presa',chiave_riposta:'Chiave riposta',chiave_passata:'Passaggio della chiave',prelievo:'Prelievo',carico:'Carico dalla farmacia',rettifica:'Rettifica giacenza',codice_cambiato:'Codice keybox cambiato',accesso_negato:'Accesso negato',personale_rimosso:'Personale eliminato',sicurezza_richiesta_otp:'Richiesta recupero PIN',sicurezza_pin_ripristinato:'PIN ripristinato con OTP',censimento_lotto:'Censimento lotto iniziale',gestione_scadenza:'Presa visione/posticipo scadenza',gestione_accessi_negati:'Presa visione accessi negati'};
const MOTIVO={somministrazione:'Somministrazione',rottura:'Fiala rotta o caduta',altro:'Altro'};
function deltaText(delta,sign){
  return Object.keys(delta||{}).map(k=>{ const n=delta[k]; return fById(k).nome+' '+(sign?(n>0?'+':'')+n:fiale(Math.abs(n))); }).join(', ');
}

function formatLottiScalati(lottiList){
  if(!lottiList || !lottiList.length) return '';
  return ' (Lotti: ' + lottiList.map(x=>{
    const q = x.take != null ? x.take : (x.fiale != null ? x.fiale : (x.qty != null ? x.qty : 1));
    return x.lotto + ' (' + fiale(q) + ')';
  }).join(', ') + ')';
}

function detailText(e,short){
  switch(e.type){
    case 'prelievo': 
      const lottiInfo = formatLottiScalati(e.lottiScalati);
      return [short?'':deltaText(e.delta), e.paziente, MOTIVO[e.motivo]||'', e.note].filter(Boolean).join(' · ') + lottiInfo;
    case 'carico': return [deltaText(e.delta,true),e.riferimento].filter(Boolean).join(' · ');
    case 'rettifica': return farmaciTutti().filter(f=>e.da&&e.a&&e.da[f.id]!==e.a[f.id]).map(f=>f.nome+' '+e.da[f.id]+' → '+e.a[f.id]).join(', ')+(e.motivo?' · '+e.motivo:'');
    case 'censimento_lotto': return (e.nota||'');
    case 'gestione_scadenza': return (e.nota||'');
    case 'gestione_accessi_negati': return (e.nota||'');
    case 'chiave_riposta': return (typeof e.durataMin==='number'?'Fuori per '+e.durataMin+' min':'')+(e.registrataDaAltri?' · presa da '+(e.presaDaNome||'?'):'');
    case 'chiave_passata': return 'Da '+(e.daNome||'?')+' a '+(e.byName||'?');
    case 'accesso_negato': return 'Matricola inserita: '+(e.matricola||'?');
    case 'personale_rimosso': return (e.nome||'?')+' · matricola '+(e.matricola||'?');
    case 'chiave_presa': return e.nota||'';
    default: return (e.nota||'');
  }
}

function resolveOperator(e){
  const staffMember = e.by ? S.staff[e.by] : null;
  const nome = (staffMember && staffMember.nome) || e.byName;
  if(nome && e.by) return `${nome} (matr. ${e.by})`;
  if(nome) return nome;
  if(e.by) return `Matr. ${e.by}`;
  return 'Sistema';
}

function rowHTML(e){
  let title=TYPE[e.type]||e.type; const meta=[];
  let rowAction='';
  if(e.type==='prelievo'){
    title='Prelievo · '+deltaText(e.delta);
    if(e.motivo==='rottura') meta.push('<span class="pill crit">Fiala rotta o caduta</span>');
    if(e.trascritto){
      meta.push('<span class="pill ok">Trascritto sul registro</span>');
    } else {
      meta.push('<span class="pill warn">Da trascrivere</span>');
      rowAction=`<div style="margin-top:6px;"><button class="btn btn-secondary btn-sm" data-act="markTranscribedById" data-id="${esc(e.id)}">Segna come trascritto</button></div>`;
    }
  }
  if(e.type==='chiave_riposta'&&typeof e.durataMin==='number'&&e.durataMin>(cfg().timeoutChiaveMin||15)) meta.push('<span class="pill warn">Oltre il limite</span>');
  if(e.type==='accesso_negato'||/^sicurezza/.test(e.type)||e.type==='gestione_accessi_negati') meta.push('<span class="pill warn">Sicurezza</span>');
  if(e.gestito) meta.push(`<span class="pill">Presa visione: ${esc(first(e.gestito.byName))} ${hhmm(e.gestito.ts)}</span>`);

  const operatore = resolveOperator(e);
  const dettaglio = detailText(e, true);

  return `<div class="row">
    <time>${hhmm(e.ts)}</time>
    <div style="flex:1;">
      <div class="row-t" style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;">
        <span>${esc(title)}</span>
        <span style="font-size:12px;font-weight:600;color:var(--accent,#0D6A62);background:var(--accent-soft,rgba(13,106,98,0.14));padding:2px 8px;border-radius:4px;white-space:nowrap;">👤 ${esc(operatore)}</span>
      </div>
      ${dettaglio ? `<div class="row-s" style="margin-top:2px;">${esc(dettaglio)}</div>` : ''}
      ${meta.length ? `<div class="row-meta" style="margin-top:4px;">${meta.join('')}</div>` : ''}
      ${e.gestito && e.gestito.note ? `<div class="row-s" style="margin-top:2px;font-style:italic;">Nota: ${esc(e.gestito.note)}</div>` : ''}
      ${rowAction}
    </div>
  </div>`;
}

function periodStart(days){ const s=new Date(); s.setHours(0,0,0,0); s.setDate(s.getDate()-(days-1)); return s.getTime(); }
function indicators(days){
  const from=periodStart(days), tout=cfg().timeoutChiaveMin||15;
  const ev=S.events.filter(e=>e.ts>=from);
  const prel=ev.filter(e=>e.type==='prelievo');
  const rit=ev.filter(e=>e.type==='chiave_riposta'&&typeof e.durataMin==='number');
  const totals={}; farmaci().forEach(f=>totals[f.id]=0);
  prel.forEach(e=>Object.keys(e.delta||{}).forEach(k=>totals[k]=(totals[k]||0)-e.delta[k]));
  const rotte=prel.filter(e=>e.motivo==='rottura').reduce((a,e)=>a+Object.values(e.delta||{}).reduce((x,y)=>x-y,0),0);
  const perDay=[];
  for(let i=0;i<days;i++){ const d=new Date(from); d.setDate(d.getDate()+i); const key=dayKey(d.getTime()); const v={}; farmaci().forEach(f=>v[f.id]=0);
    prel.filter(e=>dayKey(e.ts)===key).forEach(e=>Object.keys(e.delta||{}).forEach(k=>v[k]=(v[k]||0)-e.delta[k])); perDay.push({key,ts:d.getTime(),v}); }
  return {prel:prel.length,tras:prel.filter(e=>e.trascritto).length,
    avg:rit.length?rit.reduce((a,e)=>a+e.durataMin,0)/rit.length:0,over:rit.filter(e=>e.durataMin>tout).length,rit:rit.length,
    totals,rotte,perDay,aperture:ev.filter(e=>e.type==='chiave_presa').length,negati:ev.filter(e=>e.type==='accesso_negato').length};
}

function alerts(){
  const out=[]; const c=cfg(); const now=Date.now(); const tout=c.timeoutChiaveMin||15; const st=stock();
  const k=S.key;
  if(k&&k.status==='out'&&mins(k.since)>tout) out.push({sev:'crit',t:'Chiave fuori dalla keybox da '+mins(k.since)+' minuti',s:'Presa da '+(k.byName||'?')+' alle '+hhmm(k.since)+'. Limite impostato: '+tout+' min.',acts:[['Registra come riposta','markKeyIn']]});
  
  const ackedLottiFromEvents = new Set();
  S.events.filter(e => e.type === 'gestione_scadenza' && e.lottoId).forEach(e => {
    if(e.untilTs && now < e.untilTs) S.snoozedLotti[e.lottoId] = e.untilTs;
    else if(!e.untilTs && now - e.ts < 30 * 86400000) ackedLottiFromEvents.add(e.lottoId);
  });

  (S.lotti || []).filter(l => ((l.fialeRimaste != null ? l.fialeRimaste : l.fiale_rimaste) || 0) > 0).forEach(l => {
    const expTs = parseScadenza(l.scadenza);
    const rimaste = l.fialeRimaste != null ? l.fialeRimaste : l.fiale_rimaste;
    const snoozeUntil = S.snoozedLotti[l.id] || 0;
    
    if(snoozeUntil && now < snoozeUntil) return;
    if(ackedLottiFromEvents.has(l.id)) return;

    if(expTs){
      const diffDays = Math.ceil((expTs - now) / 86400000);
      const f = fById(l.farmacoId || l.farmaco_id);
      if(diffDays <= 0){
        out.push({
          id: 'exp_'+l.id,
          lottoId: l.id,
          sev:'crit', 
          t:`SCADUTO: ${f.nome} · Lotto ${l.lotto}`, 
          s:`Scaduto da ${Math.abs(diffDays)} giorni (${l.scadenza}). Rimanenza: ${fiale(rimaste)}. Bloccare l'uso e avviare reso farmacia.`, 
          acts:[['Presa visione / Avvia reso', 'ackLottoExp']]
        });
      } else if(diffDays <= 30){
        out.push({
          id: 'exp_'+l.id,
          lottoId: l.id,
          sev:'warn', 
          t:`In scadenza: ${f.nome} · Lotto ${l.lotto}`, 
          s:`Scade tra ${diffDays} giorni (${l.scadenza}). In cassaforte: ${fiale(rimaste)}. Priorità di prelievo attiva.`, 
          acts:[
            ['Presa visione', 'ackLottoExp'],
            ['Postponi di 7 gg', 'snoozeLotto7'],
            ['Postponi di 15 gg', 'snoozeLotto15']
          ]
        });
      }
    }
  });

  S.events.filter(e=>e.type==='prelievo'&&e.motivo==='rottura'&&!e.gestito&&now-e.ts<30*86400000).forEach(e=>{
    out.push({id:'ack_'+e.id,sev:'warn',t:'Fiala rotta o caduta · '+deltaText(e.delta),s:hhmm(e.ts)+' del '+ddmm(e.ts)+' · '+e.byName+(e.note?' · '+e.note:''),evt:e,acts:[['Presa visione','ackOpen']]});
  });
  
  farmaci().forEach(f=>{ if((st[f.id]||0)<=(f.soglia||0)) out.push({sev:'warn',t:'Scorta di '+f.nome+' sotto soglia',s:'In cassetta '+fiale(st[f.id]||0)+', soglia di riordino '+f.soglia+'.',acts:[['Registra carico','gotoCarico']]}); });
  
  const age=codeAgeDays(); if(c.codiceDal&&age>=(c.rotazioneGiorni||7)) out.push({sev:'warn',t:'Codice keybox in uso da '+age+' giorni',s:'La rotazione prevista è ogni '+(c.rotazioneGiorni||7)+' giorni.',acts:[['Cambia codice','gotoCode']]});
  
  S.events.filter(e=>e.type==='prelievo'&&!e.trascritto&&now-e.ts>60*60000&&now-e.ts<30*86400000).forEach(e=>{
    out.push({
      id:'tras_'+e.id,
      sev:'warn',
      t:'Da trascrivere · '+deltaText(e.delta),
      s:hhmm(e.ts)+' del '+ddmm(e.ts)+' · '+e.byName+(e.paziente?' · Paziente: '+e.paziente:''),
      evt:e,
      acts:[['Segna come trascritto','markTranscribedById'],['Vedi nel registro','gotoDaTrascrivere']]
    });
  });

  const lastNegatiAckEvt = S.events.find(e => e.type === 'gestione_accessi_negati');
  const effectiveDismissedTs = Math.max(S.dismissedNegatiTs || 0, lastNegatiAckEvt ? lastNegatiAckEvt.ts : 0);

  const neg=S.events.filter(e=>e.type==='accesso_negato'&&now-e.ts<86400000);
  const maxNegTs = neg.reduce((m, e)=>Math.max(m, e.ts||0), 0);
  if(neg.length>=3 && maxNegTs > effectiveDismissedTs){
    out.push({
      id: 'sec_negati',
      sev: 'warn',
      t: neg.length+' accessi negati nelle ultime 24 ore',
      s: 'Matricole inserite: '+[...new Set(neg.map(e=>e.matricola))].join(', '),
      acts: [['Presa visione', 'ackAccessiNegati']]
    });
  }
  return out;
}

let renderPending=false;
function isEditing(){ const a=document.activeElement; return !!(a&&a.closest&&a.closest('#app')&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&a.type!=='checkbox'); }
function changed(){ if(isEditing()){ renderPending=true; return; } render(true); }
document.addEventListener('focusout',()=>setTimeout(()=>{ if(renderPending&&!isEditing()){ renderPending=false; render(true); } },0));
let resizeT=0; window.addEventListener('resize',()=>{ clearTimeout(resizeT); resizeT=setTimeout(()=>{ if(S.view==='coord'&&S.tab==='indicatori') changed(); },200); });

function render(passive){
  const app=$('#app'); let html; let keep=null;
  if(passive){ keep={}; app.querySelectorAll('input[id],textarea[id],select[id]').forEach(el=>{ if(el.type!=='checkbox'&&!(el.dataset&&el.dataset.bind)) keep[el.id]=el.value; }); }
  if(S.loadError) html=viewError();
  else if(!S.loaded) html=viewLoading();
  else if(!S.config) html=viewSetup();
  else if(S.recoveryFlow) html=viewRecovery();
  else if(S.meId&&!S.staffLoaded&&!REMOTE_ON) html=viewLoading();
  else if(!me()) html=viewLogin();
  else if(me()&&me().deveCambiarePin) html=viewMustChangePin();
  else {
    let body;
    if(S.view==='prelievo'&&S.flow) body=viewPrelievo();
    else if(S.view==='coord'&&isCoord()) body=viewCoord();
    else body=viewHome();
    html=viewTop()+`<main class="wrap${S.view==='coord'?' wide':''}">${body}</main>${S.showMyPinModal?viewMyPinModal():''}${S.assocLottoFarmacoId?viewAssocLottoModal():''}`;
  }
  app.innerHTML=html;
  if(keep) Object.keys(keep).forEach(id=>{ const el=document.getElementById(id); if(el) el.value=keep[id]; });
  afterRender();
}
function afterRender(){
  if(S.scrollTo){ const el=document.getElementById(S.scrollTo); S.scrollTo=null; if(el) el.scrollIntoView({block:'start'}); }
  const q=$('#qr'); if(q&&S.qrUrl){ q.innerHTML=''; try{ new window.QRCode(q,{text:S.qrUrl,width:240,height:240,correctLevel:window.QRCode.CorrectLevel.M}); }catch(e){ q.innerHTML='<p class="muted">Generatore QR non disponibile.</p>'; } }
}
function viewLoading(){ return `<main class="wrap"><div class="loading"><span class="spinner" aria-hidden="true"></span>Apertura del registro…</div></main>`; }
function viewError(){ return `<main class="wrap"><div class="empty"><h2>${/config\.js/.test(S.loadErrorMsg||'')?'Collegamento da completare':'Non riesco a leggere i dati'}</h2><p>${esc(S.loadErrorMsg||'Controlla la connessione e ricarica la pagina.')}</p></div></main>`; }
function mode(){ return REMOTE_ON?'remote':Store.mode; }
function modeText(){
  if(REMOTE_ON) return 'I dati sono salvati nel database Supabase del reparto e condivisi tra tutti i dispositivi che aprono l\u2019app.';
  if(Store.mode==='local') return 'Modalità locale: i dati sono salvati in questo browser.';
  return 'Il browser non consente il salvataggio: i dati si perdono chiudendo la pagina.';
}

function viewTop(){
  const m=me(); const c=cfg(); const n=isCoord()?alerts().length:0;
  return `<header class="top"><div class="top-in">
    <div class="brand"><span class="brand-mark">${IC.box}</span><div><div class="brand-name">Keybox stupefacenti</div><div class="brand-sub">${esc(c.reparto||'')}</div></div></div>
    <div class="who">
      <div class="who-name">${esc(m.nome)}</div>
      <div class="who-role">${m.ruolo==='coordinatore'?'Coordinatore':'Infermiere'} · <button class="btn-link" data-act="openMyPin" title="Cambia il tuo PIN">Modifica PIN</button></div>
    </div>
    <button class="btn btn-quiet btn-sm" data-act="logout">Esci</button>
  </div>
  ${isCoord()?`<nav class="switch" aria-label="Sezione"><button data-act="goView" data-v="home" aria-pressed="${S.view!=='coord'}">Reparto</button><button data-act="goView" data-v="coord" aria-pressed="${S.view==='coord'}"><span class="hide-sm">Pannello coordinatore</span><span class="show-sm">Coordinatore</span>${n?` <span class="count">${n}</span>`:''}</button></nav>`:''}
  </header>`;
}

function viewRecovery(){
  const rf = S.recoveryFlow;
  if(rf.step === 1){
    return `<main class="wrap">
      <div class="block">
        <div class="eyebrow">Sicurezza & Autenticazione</div>
        <h1>Recupero PIN Coordinatore</h1>
        <p class="lead">Inserisci la tua matricola da coordinatore per ricevere il codice OTP monouso di verifica sulla tua email.</p>
      </div>
      <form class="panel" data-submit="reqOtp" novalidate>
        <label class="field"><span>Matricola Coordinatore</span><input id="rec-mat" type="text" inputmode="numeric" maxlength="12" value="${esc(rf.mat||'')}"></label>
        <p class="err" id="rec-err">${esc(rf.err||'')}</p>
        <button class="btn btn-primary btn-block btn-lg">Invia codice OTP</button>
      </form>
      <div class="btns" style="margin-top:12px;">
        <button class="btn btn-quiet btn-block" data-act="cancelRecovery">← Torna al login</button>
      </div>
    </main>`;
  }
  return `<main class="wrap">
    <div class="block">
      <div class="eyebrow">Verifica OTP</div>
      <h1>Inserisci il codice e imposta il nuovo PIN</h1>
      <p class="lead">Abbiamo inviato un codice OTP a 6 cifre a <b>${esc(rf.emailMasked)}</b> (valido 10 minuti). Controlla la tua casella di posta.</p>
    </div>
    <form class="panel" data-submit="verifyOtp" novalidate>
      <label class="field"><span>Codice OTP (6 cifre)</span><input id="rec-otp" type="text" inputmode="numeric" maxlength="6" placeholder="Es. 492103"></label>
      <div class="two">
        <label class="field"><span>Nuovo PIN personale</span><input id="rec-pin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"><small>Da 4 a 6 cifre</small></label>
        <label class="field"><span>Conferma nuovo PIN</span><input id="rec-conf" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></label>
      </div>
      <p class="err" id="rec-err2">${esc(rf.err||'')}</p>
      <button class="btn btn-primary btn-block btn-lg">Verifica OTP e salva PIN</button>
    </form>
    <div class="btns" style="margin-top:12px;">
      <button class="btn btn-quiet btn-block" data-act="cancelRecovery">Annulla</button>
    </div>
  </main>`;
}

function viewMustChangePin(){
  const m=me();
  return `<main class="wrap">
    <div class="block">
      <div class="eyebrow">Sicurezza e Tracciabilità</div>
      <h1>Imposta il tuo PIN personale</h1>
      <p class="lead">Ciao <b>${esc(m.nome)}</b>. Per garantire la responsabilità individuale e l’imputabilità degli accessi, sostituisci il PIN temporaneo con un codice segreto personale da 4 a 6 cifre.</p>
    </div>
    <form class="panel" data-submit="saveMustChangePin" novalidate>
      <label class="field"><span>Nuovo PIN personale</span><input id="ch-new" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"><small>Da 4 a 6 cifre</small></label>
      <label class="field"><span>Conferma nuovo PIN</span><input id="ch-conf" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></label>
      <p class="err" id="ch-err"></p>
      <button class="btn btn-primary btn-block btn-lg">Conferma e accedi</button>
    </form>
    <div class="btns" style="margin-top:12px;">
      <button class="btn btn-quiet btn-block" data-act="logout">Annulla ed esci</button>
    </div>
  </main>`;
}

function viewMyPinModal(){
  return `<div class="modal-backdrop"><div class="panel modal-card">
    <div class="sec-h"><h2>Modifica il tuo PIN personale</h2><button class="btn btn-quiet btn-sm" data-act="closeMyPin">✕</button></div>
    <form data-submit="saveMyPin" novalidate>
      <label class="field"><span>Nuovo PIN personale</span><input id="mp-new" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"><small>Da 4 a 6 cifre</small></label>
      <label class="field"><span>Conferma nuovo PIN</span><input id="mp-conf" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></label>
      <p class="err" id="mp-err"></p>
      <div class="btns" style="margin-top:16px;">
        <button class="btn btn-primary btn-block">Aggiorna PIN</button>
        <button type="button" class="btn btn-quiet btn-block" data-act="closeMyPin">Annulla</button>
      </div>
    </form>
  </div></div>`;
}

function viewAssocLottoModal(){
  const f = fById(S.assocLottoFarmacoId);
  const st = stock();
  const giacenzaAttuale = st[f.id] || 0;
  
  const fialeGiaLottizzate = (S.lotti || [])
    .filter(l => (String(l.farmacoId||l.farmaco_id) === String(f.id)) && ((l.fialeRimaste != null ? l.fialeRimaste : l.fiale_rimaste) || 0) > 0)
    .reduce((acc, l) => acc + ((l.fialeRimaste != null ? l.fialeRimaste : l.fiale_rimaste) || 0), 0);
  
  const fialeDaLottizzare = Math.max(0, giacenzaAttuale - fialeGiaLottizzate);

  return `<div class="modal-backdrop"><div class="panel modal-card" style="max-width:520px;">
    <div class="sec-h">
      <div>
        <h2>Associa Lotto e Scadenza</h2>
        <div class="sub">${esc(f.nome)} ${esc(f.dosaggio)}</div>
      </div>
      <button class="btn btn-quiet btn-sm" data-act="closeAssocLotto">✕</button>
    </div>
    
    <p class="fine">
      Inserisci il lotto e la scadenza per le fiale già presenti fisicamente in cassaforte senza alterare la giacenza totale.
    </p>

    <div class="status info" style="margin-bottom:12px;">
      <span class="ico">${IC.info}</span>
      <div>Giacenza: <b>${fiale(giacenzaAttuale)}</b> (di cui <b>${fiale(fialeGiaLottizzate)}</b> con lotto). Da censire: <b>${fiale(fialeDaLottizzare)}</b>.</div>
    </div>

    <form data-submit="salvaAssocLotto" novalidate>
      <div class="two">
        <label class="field"><span>Numero di Lotto</span><input id="as-lot" type="text" maxlength="25" placeholder="Es. L12345" style="text-transform:uppercase;" required></label>
        <label class="field"><span>Data di Scadenza</span><input id="as-exp" type="month" required></label>
      </div>

      <div class="two">
        <label class="field"><span>Fiale di questo lotto</span><input id="as-fiale" type="number" inputmode="numeric" min="1" max="${giacenzaAttuale || 999}" value="${fialeDaLottizzare || 1}"></label>
        <label class="field"><span>Formato scatola (fiale)</span><input id="as-unita" type="number" inputmode="numeric" min="1" max="100" value="${f.unitaPerScatola || 5}"></label>
      </div>

      <p class="err" id="as-err"></p>
      
      <div class="btns" style="margin-top:16px;">
        <button class="btn btn-primary btn-block">Salva e Associa</button>
        <button type="button" class="btn btn-quiet btn-block" data-act="closeAssocLotto">Annulla</button>
      </div>
    </form>
  </div></div>`;
}

function viewSetup(){
  return `<main class="wrap"><div class="block">
    <div class="eyebrow">Prima configurazione</div>
    <h1>Configura la keybox del reparto</h1>
    <p class="lead">Crea il profilo del coordinatore, inserisci il codice attuale della keybox e quante fiale ci sono in cassetta.</p></div>
    <form class="panel" data-submit="setup" novalidate>
      <label class="field"><span>Nome del reparto</span><input id="su-rep" type="text" maxlength="60" placeholder="Es. Ematologia · medicheria 2"></label>
      <div class="eyebrow">Coordinatore</div>
      <label class="field"><span>Nome e cognome</span><input id="su-nome" type="text" maxlength="60" autocomplete="name"></label>
      <label class="field"><span>Email istituzionale (per recupero PIN)</span><input id="su-email" type="email" maxlength="80" placeholder="nome.cognome@ospedale.it" autocomplete="email"><small>Utilizzata per l’invio dell’OTP se dimentichi il PIN.</small></label>
      <div class="two">
        <label class="field"><span>Matricola</span><input id="su-mat" type="text" inputmode="numeric" maxlength="12" autocomplete="username"></label>
        <label class="field"><span>PIN personale</span><input id="su-pin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"><small>Da 4 a 6 cifre</small></label>
      </div>
      <div class="eyebrow">Keybox</div>
      <label class="field"><span>Codice attuale della keybox</span><input id="su-code" type="text" inputmode="numeric" maxlength="5" placeholder="5 cifre"></label>
      <div class="eyebrow">Fiale presenti in cassetta</div>
      <div class="two">${DEFAULT_FARMACI.map(f=>`<label class="field"><span>${esc(f.nome)} ${esc(f.dosaggio)}</span><input id="su-g-${f.id}" type="number" inputmode="numeric" min="0" max="999" value="0"></label>`).join('')}</div>
      <p class="err" id="su-err"></p>
      <button class="btn btn-primary btn-block btn-lg">Crea il reparto</button>
    </form>
    <p class="fine">${modeText()}</p></main>`;
}

function viewLogin(){
  const c=cfg(); const locked=S.lockUntil>Date.now();
  const staffList=Object.values(S.staff||{}).filter(s=>s.attivo!==false);
  
  return `<main class="wrap">
    <div class="login-hero">
      <span class="brand-mark">${IC.box}</span>
      <div><h1>Keybox stupefacenti</h1><p class="lead">${esc(c.reparto||'')}</p></div>
    </div>
    <form class="panel" data-submit="login" novalidate>
      <label class="field"><span>Matricola</span><input id="l-mat" type="text" inputmode="numeric" autocomplete="username" maxlength="12" value="${esc(S.loginMat||'')}"></label>
      <label class="field"><span>PIN personale</span><input id="l-pin" type="password" inputmode="numeric" autocomplete="current-password" maxlength="6"></label>
      <p class="err" id="l-err">${esc(locked?'Troppi tentativi errati. Riprova tra '+Math.ceil((S.lockUntil-Date.now())/1000)+' secondi.':S.loginErr)}</p>
      <button class="btn btn-primary btn-block btn-lg" ${locked?'disabled':''}>Accedi</button>
      <div style="text-align:center;margin-top:10px;">
        <button type="button" class="btn-link" data-act="startRecovery">Hai dimenticato il PIN? (Solo Coordinatore)</button>
      </div>
    </form>
    ${staffList.length?`<section class="panel"><div class="sec-h"><h2>Personale registrato (Accesso Rapido)</h2><span class="pill info">Demo</span></div><p class="fine">Tocca il tuo nome per precompilare la matricola.</p><div class="creds">${staffList.map(s=>`<button type="button" class="cred" data-act="fillUser" data-m="${esc(s.id)}"><div><b>${esc(s.nome)}</b><br><span>${s.ruolo==='coordinatore'?'Coordinatore':'Infermiere'}</span></div><span class="mono">Matricola: ${esc(s.id)}</span></button>`).join('')}</div></section>`:''}
    <p class="fine">Ogni apertura della keybox viene registrata con nome, data e ora. La sessione si chiude da sola dopo ${c.sessioneMin||5} minuti di inattività.</p>
  </main>`;
}

function keyStatusHTML(compact){
  const k=S.key; const tout=cfg().timeoutChiaveMin||15;
  if(!k||k.status!=='out') return `<div class="status ok"><span class="ico">${IC.check}</span><div class="grow"><strong>Chiave nella keybox</strong><span class="sub">${k&&k.since?'Riposta alle '+hhmm(k.since)+(k.byName?' da '+esc(k.byName):''):'Nessun movimento registrato'}</span></div></div>`;
  const m=mins(k.since), late=m>tout, mine=k.by===S.meId;
  const title=mine?'Hai la chiave dalle '+hhmm(k.since):'Chiave presa da '+esc(k.byName)+' alle '+hhmm(k.since);
  const sub=(m===0?'Adesso':m+' min')+(late?' · oltre il limite di '+tout+' min':'')+(mine?' · rimettila nella keybox appena finisci':'');
  const acts=(!mine&&!compact)?`<div class="status-acts"><button class="btn btn-secondary btn-sm" data-act="receiveKey">Me l’ha passata ${esc(first(k.byName))}</button><button class="btn btn-quiet btn-sm" data-act="markKeyIn">È già nella keybox</button></div>`:'';
  return `<div class="status ${late?'crit':mine?'info':'warn'}"><span class="ico">${late?IC.alert:IC.key}</span><div class="grow"><strong>${title}</strong><span class="sub">${sub}</span>${acts}</div></div>`;
}

function codePanel(){
  const c=cfg(); const k=S.key; const mine=!!(k&&k.status==='out'&&k.by===S.meId); const other=!!(k&&k.status==='out'&&!mine);
  if(S.codeShownUntil>Date.now()&&S.codeValue){
    const left=Math.ceil((S.codeShownUntil-Date.now())/1000);
    return `<section class="keybox" aria-label="Codice della keybox">
      <div class="kb-top"><span class="kb-label">Codice keybox</span><span class="kb-label">in vigore dal ${ddmm(c.codiceDal)}</span></div>
      <div class="digits" role="text" aria-label="Codice ${esc(String(S.codeValue).split('').join(' '))}">${String(S.codeValue).split('').map(d=>`<span class="digit">${esc(d)}</span>`).join('')}</div>
      <div class="cd" aria-hidden="true"><span id="cd-bar" style="width:${Math.max(0,(left-1)/CODE_SECONDS*100)}%"></span></div>
      <div class="kb-foot"><span id="cd-txt">Si nasconde tra ${left} s</span><button class="btn btn-kb-quiet btn-sm" data-act="hideCode">Nascondi</button></div>
    </section>`;
  }
  if(S.confirmTake&&other){
    return `<section class="keybox"><div class="kb-top"><span class="kb-label">Codice keybox</span></div>
      <div class="kb-warn">La chiave risulta presa da <b>${esc(k.byName)}</b> alle ${hhmm(k.since)}. Se apri la keybox, la chiave passa a tuo nome e la segnalazione resta nel registro.</div>
      <button class="btn btn-kb btn-block btn-lg" data-act="takeKey" data-force="1">Apro comunque la keybox</button>
      <button class="btn btn-kb-quiet btn-block" data-act="cancelTake">Annulla</button></section>`;
  }
  return `<section class="keybox" aria-label="Codice della keybox">
    <div class="kb-top"><span class="kb-label">Codice keybox</span>${c.codiceDal?`<span class="kb-label">dal ${ddmm(c.codiceDal)}</span>`:''}</div>
    <div class="digits masked" aria-hidden="true">${'<span class="digit">●</span>'.repeat(5)}</div>
    <button class="btn btn-kb btn-block btn-lg" data-act="takeKey">${mine?'Mostra di nuovo il codice':'Mostra il codice e prendi la chiave'}</button>
    <p class="kb-note">${mine?'La chiave risulta già a te.':'L’apertura viene registrata a tuo nome, con data e ora.'}</p>
  </section>`;
}

function drugRow(f,n){
  const low=n<=(f.soglia||0);
  const lottiFarmaco = (S.lotti || [])
    .filter(l => (String(l.farmacoId||l.farmaco_id) === String(f.id)) && ((l.fialeRimaste != null ? l.fialeRimaste : l.fiale_rimaste) || 0) > 0)
    .sort((a,b)=>String(a.scadenza).localeCompare(String(b.scadenza)));
  const nextLotto = lottiFarmaco[0];
  const unitaScatola = (nextLotto && (nextLotto.unitaPerScatola || nextLotto.unita_per_scatola)) || f.unitaPerScatola || 5;
  const rimasteNext = nextLotto ? (nextLotto.fialeRimaste != null ? nextLotto.fialeRimaste : nextLotto.fiale_rimaste) : 0;
  
  return `<div class="drug d-${f.tema}">
    <span class="badge"><b>${esc(f.sigla)}</b></span>
    <div class="drug-main">
      <div class="drug-name">${esc(f.nome.toUpperCase())} <span class="salt">${esc(f.sale||'')}</span></div>
      <div class="drug-dose">${esc(f.dosaggio)} · ${esc(f.forma||'fiala')} · scatole da ${f.unitaPerScatola||5}</div>
      ${nextLotto ? `
        <div class="row-meta" style="margin-top:4px;">
          <span class="pill info" style="white-space:normal;display:inline-block;line-height:1.35;">
            In uso: <b>${esc(nextLotto.lotto)}</b> (Scad. ${esc(nextLotto.scadenza)}) · <b>${rimasteNext} fiale rimaste</b> (Scatole da ${unitaScatola})
          </span>
        </div>` : (n>0 ? `<div class="row-meta" style="margin-top:4px;"><span class="pill warn">Nessun lotto associato</span></div>` : '')}
      ${low ? '<div class="row-meta"><span class="pill warn">Sotto soglia ('+f.soglia+')</span></div>' : ''}
    </div>
    <div class="qty">${n}<small>${n===1?'fiala':'fiale'}</small></div>
  </div>`;
}

function viewHome(){
  const k=S.key; const mine=!!(k&&k.status==='out'&&k.by===S.meId); const st=stock();
  const recent=S.events.filter(e=>['prelievo','carico','rettifica','censimento_lotto'].includes(e.type)).slice(0,5);
  return `${keyStatusHTML(false)}
    ${codePanel()}
    ${mine?`<div class="block"><button class="btn btn-primary btn-lg btn-block" data-act="startPrelievo">Registra un prelievo</button><button class="btn btn-secondary btn-block" data-act="returnKey">Ho rimesso la chiave nella keybox</button></div>`:`<p class="hint">Per registrare un prelievo, prima mostra il codice e prendi la chiave.</p>`}
    <section class="block"><div class="sec-h"><h2>In cassetta</h2><span class="muted" style="font-size:14px">secondo il registro digitale</span></div><div class="drugs">${farmaci().map(f=>drugRow(f,st[f.id]||0)).join('')}</div></section>
    ${recent.length?`<section class="block"><h2>Ultimi movimenti</h2><div class="panel" style="gap:0;padding-block:4px"><div class="rows">${recent.map(rowHTML).join('')}</div></div></section>`:''}`;
}

function flowHead(step,total,label){
  return `<div class="flow-head"><button class="btn btn-quiet btn-sm" data-act="cancelFlow">← Annulla</button><span class="stepno">${label} <span class="dots">${Array.from({length:total},(_,i)=>`<i class="${i<step?'on':''}"></i>`).join('')}</span></span></div>`;
}

function viewPrelievo(){
  const F=S.flow; const st=stock();
  if(F.step===1){
    return `${flowHead(1,3,'Passo 1 di 3')}
      <h1>Cosa prelevi?</h1>
      ${farmaci().map(f=>{ 
        const q=F.qty[f.id]||0, have=st[f.id]||0; 
        return `<div class="pick d-${f.tema}${q>0?' on':''}">
          <div class="pick-h">
            <span class="badge"><b>${esc(f.sigla)}</b></span>
            <div class="grow">
              <div class="drug-name">${esc(f.nome.toUpperCase())} <span class="salt">${esc(f.sale||'')}</span></div>
              <div class="drug-dose">${esc(f.dosaggio)} · in cassetta ${fiale(have)} (formato da ${f.unitaPerScatola||5})</div>
            </div>
          </div>
          <div class="stepper">
            <button class="sbtn" data-act="qty" data-id="${f.id}" data-d="-1" aria-label="Una fiala in meno di ${esc(f.nome)}" ${q<=0?'disabled':''}>−</button>
            <div class="val" aria-live="polite">${q}<small>${q===1?'fiala':'fiale'}</small></div>
            <button class="sbtn" data-act="qty" data-id="${f.id}" data-d="1" aria-label="Una fiala in più di ${esc(f.nome)}" ${q>=have?'disabled':''}>+</button>
          </div>
        </div>`; 
      }).join('')}
      <label class="field"><span>Paziente</span><input id="p-paz" type="text" maxlength="40" data-bind="flow.paziente" value="${esc(F.paziente)}" placeholder="Es. letto 12 o codice ricovero"><small>Non scrivere nome e cognome: il nome va solo sul registro ufficiale.</small></label>
      <div class="field"><span>Motivo</span><div class="seg">${Object.keys(MOTIVO).map(m=>`<button type="button" data-act="setMotivo" data-v="${m}" aria-pressed="${F.motivo===m}">${MOTIVO[m]}</button>`).join('')}</div></div>
      ${F.motivo!=='somministrazione'?`<label class="field"><span>Cosa è successo</span><textarea id="p-note" maxlength="300" data-bind="flow.note" placeholder="${F.motivo==='rottura'?'Es. fiala caduta durante la preparazione, vetri nel contenitore taglienti':'Descrivi il motivo del prelievo'}">${esc(F.note)}</textarea><small>Il coordinatore riceve una segnalazione.</small></label>`:''}
      <p class="err" id="p-err">${esc(F.err||'')}</p>
      <button class="btn btn-primary btn-lg btn-block" data-act="prelievoNext">Continua</button>
      <p class="fine">Se in cassetta trovi un numero di fiale diverso da quello indicato, avvisa il coordinatore.</p>`;
  }
  if(F.step===2){
    const sel=farmaci().filter(f=>(F.qty[f.id]||0)>0);
    return `${flowHead(2,3,'Passo 2 di 3')}
      <h1>Controlla l’etichetta della fiala</h1>
      <p class="lead">Confronta nome, dosaggio e il lotto da prelevare prima di confermare.</p>
      ${sel.map(f=>{ 
        const q=F.qty[f.id];
        const plan = getFefoPlan(f.id, q);
        return `<div class="verify d-${f.tema}">
          <div class="verify-top"><span class="badge"><b>${esc(f.sigla)}</b></span><div><div class="verify-name">${esc(f.nome.toUpperCase())}</div><div class="verify-salt">${esc(f.sale||'')}</div></div></div>
          <div class="verify-dose">${esc(f.dosaggio)}</div>
          
          <div class="subform" style="margin-block:10px;padding:10px;border-left:4px solid var(--accent,#0D6A62);">
            <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:var(--accent,#0D6A62);">📦 Da quale scatola/lotto prelevare:</div>
            ${plan.length ? plan.map(p => `
              <div style="font-size:14px;display:flex;justify-content:space-between;align-items:center;margin-block:6px;gap:8px;flex-wrap:wrap;">
                <span>Preleva <b>${fiale(p.take)}</b> da Lotto <b class="mono">${esc(p.lotto)}</b> (Scad. ${esc(p.scadenza)}) · Scatola da ${p.unitaPerScatola}</span>
                <span class="pill ${p.fialeRimasteNelLotto===0 ? 'warn' : 'ok'}">
                  ${p.fialeRimasteNelLotto === 0 ? '⚠ Scatola/Lotto esaurito' : `✓ Restano ${p.fialeRimasteNelLotto} fiale di questo lotto`}
                </span>
              </div>
            `).join('') : '<div class="muted">Nessun lotto specifico registrato per questo farmaco.</div>'}
          </div>

          <div class="verify-qty"><div><span>Prelevi</span><b>${fiale(q)}</b></div><div><span>Restano in cassetta</span><b>${fiale((st[f.id]||0)-q)}</b></div></div>
          <label class="check"><input type="checkbox" data-verify="${f.id}" ${F.verified[f.id]?'checked':''}> Ho controllato nome, dosaggio e lotto della fiala</label>
        </div>`; 
      }).join('')}
      <dl class="summary"><dt>Paziente</dt><dd>${esc(F.paziente||'—')}</dd><dt>Motivo</dt><dd>${esc(MOTIVO[F.motivo])}</dd>${F.note?`<dt>Nota</dt><dd>${esc(F.note)}</dd>`:''}</dl>
      <button id="confirmBtn" class="btn btn-primary btn-lg btn-block" data-act="prelievoConfirm" ${sel.every(f=>F.verified[f.id])&&!F.busy?'':'disabled'}>Conferma il prelievo</button>
      <button class="btn btn-quiet btn-block" data-act="flowBack">Modifica</button>`;
  }
  const e=F.evt; const sel=Object.keys(e.delta||{});
  const isTrascritto = !!e.trascritto;
  return `${flowHead(3,3,'Fatto')}
    <div class="done"><span>${IC.check}</span>Prelievo registrato alle ${hhmm(e.ts)}</div>
    <section class="block">
      <h2>Riga per il registro di carico e scarico</h2>
      <p class="lead">Trascrivi subito questi dati sul registro vidimato cartaceo del reparto.</p>
      ${sel.map(id=>{ 
        const f=fById(id);
        const lotti = (e.lottiScalati||[]).filter(x=>String(x.farmacoId||x.farmaco_id)===String(id));
        const lottiStr = lotti.length ? lotti.map(x=>{
          const q = x.take != null ? x.take : (x.fiale != null ? x.fiale : (x.qty != null ? x.qty : 1));
          return `${x.lotto} (${fiale(q)})`;
        }).join(', ') : '—';
        return `<div class="twin-rec d-${f.tema}">
          <div class="twin-h"><span class="badge"><b>${esc(f.sigla)}</b></span><b>${esc(f.nome)} ${esc(f.sale||'')}</b><span class="muted">${esc(f.dosaggio)}</span></div>
          <dl class="twin-grid">
            <div><dt>Data</dt><dd>${ddmmyyyy(e.ts)}</dd></div>
            <div><dt>Ora</dt><dd>${hhmm(e.ts)}</dd></div>
            <div><dt>Paziente</dt><dd>${esc(e.paziente||'—')}</dd></div>
            <div><dt>Lotti e Fiale</dt><dd class="mono" style="font-size:15px;line-height:1.3;">${esc(lottiStr)}</dd></div>
            <div><dt>Scarico totale</dt><dd>${-e.delta[id]}</dd></div>
            <div><dt>Giacenza</dt><dd>${e.giacenzaDopo?e.giacenzaDopo[id]:'—'}</dd></div>
          </dl>
        </div>`; 
      }).join('')}
      
      ${!isTrascritto ? `
        <div class="status warn" style="margin-top:6px;">
          <span class="ico">${IC.alert}</span>
          <div><strong>Trascrizione obbligatoria</strong><span class="sub">Compila la riga sul registro cartaceo e tocca il tasto qui sotto per sbloccare le azioni successive.</span></div>
        </div>
        <button class="btn btn-primary btn-lg btn-block" data-act="markTranscribed">Ho trascritto sul registro ufficiale</button>
      ` : `
        <div class="row-meta" style="margin-block:10px;"><span class="pill ok">Trascritto sul registro cartaceo alle ${hhmm(e.trascrittoTs||Date.now())}</span></div>
        <div class="block" style="gap:10px;">
          <button class="btn btn-secondary btn-lg btn-block" data-act="anotherPrelievo">+ Registra un altro prelievo per un altro paziente</button>
          <button class="btn btn-primary btn-lg btn-block" data-act="returnKey">Ho rimesso la chiave nella keybox (Fine)</button>
        </div>
      `}
    </section>`;
}

function viewCoord(){
  const n=alerts().length;
  const tabs=[['stato','Stato'],['segnalazioni','Segnalazioni'],['registro','Registro'],['indicatori','Indicatori'],['impostazioni','Impostazioni']];
  let body='';
  if(S.tab==='segnalazioni') body=tabSegnalazioni();
  else if(S.tab==='registro') body=tabRegistro();
  else if(S.tab==='indicatori') body=tabIndicatori();
  else if(S.tab==='impostazioni') body=tabImpostazioni();
  else body=tabStato();
  return `<div class="tabs" role="tablist">${tabs.map(([id,l])=>`<button class="tab" role="tab" aria-selected="${S.tab===id}" data-act="setTab" data-t="${id}">${l}${id==='segnalazioni'&&n?` <span class="count">${n}</span>`:''}</button>`).join('')}</div>${body}`;
}

function formCarico(){
  return `<form class="subform" data-submit="carico" novalidate>
    <h3>Carico dalla farmacia per scatole/lotti</h3>
    <p class="fine">Specifica numero di scatole, quante fiale contiene ogni scatola, lotto e scadenza. Il prelievo scalerà automaticamente per scadenza.</p>
    
    ${farmaci().map(f=>`
      <div class="subform" style="border-left:4px solid var(--accent,#0D6A62);margin-bottom:12px;padding:10px;">
        <div style="font-weight:700;margin-bottom:6px;">${esc(f.nome)} ${esc(f.dosaggio)}</div>
        <div class="two">
          <label class="field"><span>Numero di scatole</span><input id="ca-scat-${f.id}" type="number" inputmode="numeric" min="0" max="99" value="0" data-calc-carico="${f.id}"></label>
          <label class="field"><span>Fiale per scatola</span><input id="ca-unita-${f.id}" type="number" inputmode="numeric" min="1" max="100" value="${f.unitaPerScatola||5}" data-calc-carico="${f.id}"></label>
        </div>
        <div class="two">
          <label class="field"><span>Numero di Lotto</span><input id="ca-lot-${f.id}" type="text" maxlength="25" placeholder="Es. B10492" style="text-transform:uppercase;"></label>
          <label class="field"><span>Data di scadenza (Mese / Anno)</span><input id="ca-exp-${f.id}" type="month"></label>
        </div>
        <div id="ca-tot-preview-${f.id}" class="row-s" style="font-weight:600;color:var(--accent,#0D6A62);">0 fiale totali da caricare</div>
      </div>
    `).join('')}
    
    <label class="field"><span>Riferimento bolla / richiesta</span><input id="ca-rif" type="text" maxlength="80" placeholder="Es. Richiesta n. 452 del ${ddmm(Date.now())}"></label>
    <p class="err" id="ca-err"></p>
    <div class="btns">
      <button class="btn btn-primary">Registra il carico</button>
      <button type="button" class="btn btn-quiet" data-act="closeForm">Annulla</button>
    </div>
  </form>`;
}

function formRettifica(){
  const st=stock(); const pre=S.rettPrefill||st;
  return `<form class="subform" data-submit="rettifica" novalidate><h3>Rettifica della giacenza</h3>
    <p class="fine">Inserisci le fiale realmente presenti. La rettifica resta nel registro con il motivo.</p>
    <div class="two">${farmaci().map(f=>`<label class="field"><span>${esc(f.nome)} · ora ${st[f.id]||0}</span><input id="re-${f.id}" type="number" inputmode="numeric" min="0" max="999" value="${pre[f.id]!=null?pre[f.id]:st[f.id]||0}"></label>`).join('')}</div>
    <label class="field"><span>Motivo</span><textarea id="re-mot" maxlength="300" placeholder="Es. verifica con la farmacia del ${ddmm(Date.now())}"></textarea></label>
    <p class="err" id="re-err"></p>
    <div class="btns"><button class="btn btn-primary">Salva la rettifica</button><button type="button" class="btn btn-quiet" data-act="closeForm">Annulla</button></div></form>`;
}

function tabStato(){
  const c=cfg(); const st=stock();
  const today=dayKey(Date.now()); const tEv=S.events.filter(e=>dayKey(e.ts)===today);
  const tPrel={}; farmaci().forEach(f=>tPrel[f.id]=0); tEv.filter(e=>e.type==='prelievo').forEach(e=>Object.keys(e.delta||{}).forEach(k=>tPrel[k]-=e.delta[k]));
  
  const lottiAttivi = (S.lotti || [])
    .filter(l => ((l.fialeRimaste != null ? l.fialeRimaste : l.fiale_rimaste) || 0) > 0)
    .sort((a,b)=>String(a.scadenza).localeCompare(String(b.scadenza)));

  return `<div class="grid2">
    <div class="block">
      <section class="panel" id="sez-giacenze">
        <div class="sec-h"><h2>Giacenze complessive</h2><div class="btns"><button class="btn btn-secondary btn-sm" data-act="openForm" data-f="carico">Registra carico</button><button class="btn btn-quiet btn-sm" data-act="openForm" data-f="rettifica">Rettifica</button></div></div>
        <div class="drugs">${farmaci().map(f=>drugRow(f,st[f.id]||0)).join('')}</div>
        ${S.coordForm==='carico'?formCarico():''}${S.coordForm==='rettifica'?formRettifica():''}
      </section>

      <section class="panel">
        <div class="sec-h">
          <h2>Scatole e Lotti in cassaforte (per scadenza)</h2>
          <span class="pill info">${lottiAttivi.length} attivi</span>
        </div>
        <p class="fine">Elenco ordinato per priorità di scadenza. Il prelievo scala automaticamente la confezione con scadenza più vicina.</p>
        
        <div style="margin-bottom:12px;">
          <div style="font-weight:600;font-size:13px;margin-bottom:6px;">Associa lotto/scadenza a giacenza già esistente:</div>
          <div class="btns" style="flex-wrap:wrap;gap:6px;">
            ${farmaci().map(f=>`<button class="btn btn-secondary btn-sm" data-act="openAssocLotto" data-id="${esc(f.id)}">+ Lotto per ${esc(f.nome)}</button>`).join('')}
          </div>
        </div>

        ${lottiAttivi.length ? `<div class="tbl"><table>
          <thead><tr><th>Farmaco</th><th>Lotto</th><th>Scadenza</th><th>Formato</th><th class="num">Fiale rimaste</th></tr></thead>
          <tbody>
            ${lottiAttivi.map(l=>{
              const f = fById(l.farmacoId || l.farmaco_id);
              const expTs = parseScadenza(l.scadenza);
              const days = expTs ? Math.ceil((expTs - Date.now())/86400000) : null;
              const pill = days && days <= 30 ? '<span class="pill warn" style="margin-left:4px;">In scadenza</span>' : '';
              const rimaste = l.fialeRimaste != null ? l.fialeRimaste : l.fiale_rimaste;
              const totali = l.fialeTotali != null ? l.fialeTotali : l.fiale_totali;
              const unitaScatola = l.unitaPerScatola || l.unita_per_scatola || f.unitaPerScatola || 5;
              return `<tr>
                <td><b>${esc(f.nome)}</b></td>
                <td><span class="mono">${esc(l.lotto)}</span></td>
                <td>${esc(l.scadenza)}${pill}</td>
                <td><small>Scatola da ${unitaScatola}</small></td>
                <td class="num"><b>${rimaste}</b> <small>/ ${totali}</small></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table></div>` : '<p class="sub">Nessun lotto con fiale registrato.</p>'}
      </section>
    </div>

    <div class="block">
      <section class="panel"><h2>Chiave</h2>${keyStatusHTML(true)}${S.key&&S.key.status==='out'?'<div class="btns"><button class="btn btn-secondary btn-sm" data-act="markKeyIn">Registra come riposta</button></div>':''}</section>
      <section class="panel"><div class="sec-h"><h2>Codice keybox</h2>${codePill()}</div><p class="sub">In vigore dal <b>${c.codiceDal?ddmmyyyy(c.codiceDal):'—'}</b>${c.codiceDaNome?', impostato da '+esc(c.codiceDaNome):''}. Rotazione prevista ogni ${c.rotazioneGiorni||7} giorni.</p><div class="btns"><button class="btn btn-secondary" data-act="gotoCode">Cambia codice</button></div></section>
      <section class="panel"><h2>Oggi</h2><dl class="summary"><dt>Aperture keybox</dt><dd>${tEv.filter(e=>e.type==='chiave_presa').length}</dd>${farmaci().map(f=>`<dt>${esc(f.nome)} prelevata</dt><dd>${fiale(tPrel[f.id])}</dd>`).join('')}</dl></section>
    </div>
  </div>`;
}

function tabSegnalazioni(){
  const al=alerts();
  if(!al.length) return `<div class="empty"><h2>Nessuna segnalazione aperta</h2><p>Chiave non restituita, lotti in scadenza, fiale rotte, scorte basse e codice da cambiare compaiono qui.</p></div>`;
  
  return `<p class="fine">Le segnalazioni cliniche e di sicurezza consentono il controllo tempestivo del reparto.</p>
  <div class="alerts">${al.map((a)=>{
    const ico=a.sev==='crit'?IC.alert:a.sev==='warn'?IC.alert:IC.info;
    const isAckThis = (S.ackId === a.id) || (a.evt && S.ackId === a.evt.id);
    
    const ackForm = isAckThis ? `
      <form class="subform" data-submit="ackSaveGeneric" data-alert-id="${esc(a.id)}" data-lotto-id="${esc(a.lottoId||'')}" data-evt-id="${esc(a.evt?a.evt.id:'')}" novalidate>
        <label class="field"><span>Nota di presa visione</span>
          <textarea id="ack-note" maxlength="300" placeholder="Es. Verificato tentativo errato / risolto con l'operatore"></textarea>
        </label>
        <div class="btns">
          <button class="btn btn-primary btn-sm">Conferma presa visione</button>
          <button type="button" class="btn btn-quiet btn-sm" data-act="ackCancel">Annulla</button>
        </div>
      </form>` : '';

    return `<div class="alert ${a.sev}">
      <span class="ico">${ico}</span>
      <div class="alert-t">${esc(a.t)}</div>
      <div class="alert-s">${esc(a.s)}</div>
      ${a.acts && a.acts.length && !ackForm ? `
        <div class="alert-acts">
          ${a.acts.map(([l, act]) => `<button class="btn btn-secondary btn-sm" data-act="${act}" data-id="${esc(a.id)}" data-lotto-id="${esc(a.lottoId||'')}">${l}</button>`).join('')}
        </div>` : ''}
      ${ackForm}
    </div>`;
  }).join('')}</div>`;
}

const FILTERS=[['tutti','Tutti',()=>true],['chiave','Chiave',e=>/^chiave/.test(e.type)],['prelievo','Prelievi',e=>e.type==='prelievo'],['datrascrivere','Da trascrivere',e=>e.type==='prelievo'&&!e.trascritto],['giacenze','Carichi e rettifiche',e=>e.type==='carico'||e.type==='rettifica'||e.type==='censimento_lotto'],['sicurezza','Codice, accessi e personale',e=>e.type==='codice_cambiato'||e.type==='accesso_negato'||e.type==='personale_rimosso'||/^sicurezza/.test(e.type)||e.type==='gestione_scadenza'||e.type==='gestione_accessi_negati']];

function tabRegistro(){
  const flt=(FILTERS.find(f=>f[0]===S.filter)||FILTERS[0])[2];
  const list=S.events.filter(flt); const shown=list.slice(0,S.regLimit);
  let html='', lastDay='';
  shown.forEach(e=>{ const d=dayKey(e.ts); if(d!==lastDay){ html+=`<div class="dayh">${esc(dayLabel(d))}</div>`; lastDay=d; } html+=rowHTML(e); });
  return `<div class="sec-h"><div class="seg" role="group" aria-label="Filtro">${FILTERS.map(f=>`<button data-act="setFilter" data-f="${f[0]}" aria-pressed="${S.filter===f[0]}">${f[1]}</button>`).join('')}</div></div>
    <section class="panel"><div class="sec-h"><h2>${list.length} ${list.length===1?'movimento':'movimenti'}</h2><button class="btn btn-secondary btn-sm" data-act="exportCSV">Esporta CSV</button></div>
    ${shown.length?`<div class="rows">${html}</div>`:'<p class="sub">Nessun movimento per questo filtro.</p>'}
    ${list.length>shown.length?'<button class="btn btn-quiet" data-act="moreRows">Mostra altri</button>':''}</section>`;
}

function niceMax(v){ if(v<=4) return 4; if(v<=6) return 6; if(v<=8) return 8; if(v<=10) return 10; return Math.ceil(v/5)*5; }
function barPath(x,y,w,h,r){ if(h<=0) return ''; r=Math.min(r,w/2,h); return `M${x},${y+h}V${y+r}Q${x},${y} ${x+r},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h}Z`; }

function chartSVG(perDay){
  const app=document.getElementById('app'); const avail=(app&&app.clientWidth)||680;
  const fs=farmaci(); const W=Math.round(Math.max(300,Math.min(1060,Math.min(avail,1120)-2*Math.max(16,0)-34))),H=230,m={l:30,r:6,t:10,b:28}; const iw=W-m.l-m.r, ih=H-m.t-m.b;
  const max=Math.max(1,...perDay.map(d=>Math.max(...fs.map(f=>d.v[f.id]||0))));
  const yMax=niceMax(max); const step=yMax<=4?1:yMax<=10?2:5;
  const band=iw/perDay.length; const gap=perDay.length>60?0:2; 
  const bw=Math.max(1.5,Math.min(16,(band-(gap*(fs.length-1)))/fs.length));
  let s=`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Fiale prelevate al giorno">`;
  for(let v=0;v<=yMax;v+=step){ const y=m.t+ih-v/yMax*ih; s+=`<line class="${v===0?'bl':'gl'}" x1="${m.l}" x2="${W-m.r}" y1="${y}" y2="${y}"/><text x="${m.l-8}" y="${y+4}" text-anchor="end">${v}</text>`; }
  const every=perDay.length<=7?1:perDay.length<=14?2:perDay.length<=30?5:perDay.length<=90?15:60;
  perDay.forEach((d,i)=>{
    const gx=m.l+i*band+(band-(bw*fs.length+gap*(fs.length-1)))/2;
    fs.forEach((f,j)=>{ const v=d.v[f.id]||0; const h=v/yMax*ih; s+=`<path class="b-${f.tema}" d="${barPath(gx+j*(bw+gap),m.t+ih-h,bw,h,4)}"/>`; });
    if((perDay.length-1-i)%every===0) s+=`<text x="${m.l+i*band+band/2}" y="${H-8}" text-anchor="middle">${ddmm(d.ts)}</text>`;
    const tip=new Date(d.ts).toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'})+'|'+fs.map(f=>f.nome+': '+fiale(d.v[f.id]||0)).join('|');
    s+=`<rect class="hit" x="${m.l+i*band}" y="${m.t}" width="${band}" height="${ih}" data-tip="${esc(tip)}"/>`;
  });
  return s+'</svg>';
}

function kpi(label,value,sub,pill){ return `<div class="kpi"><div class="kpi-l">${label}</div><div class="kpi-v">${value}</div><div class="kpi-s">${sub}</div>${pill?'<div class="row-meta">'+pill+'</div>':''}</div>`; }

function tabIndicatori(){
  const I=indicators(S.period); const tout=cfg().timeoutChiaveMin||15;
  const tras=I.prel?Math.round(I.tras/I.prel*100):null;
  const tPill=tras==null?'':tras>=98?'<span class="pill ok">In linea</span>':'<span class="pill warn">'+(I.prel-I.tras)+' da trascrivere</span>';
  return `<div class="sec-h"><div><h2>Indicatori di processo ed esito</h2><p class="fine">Per l’audit clinico con l’équipe: misurano il sistema, non le persone.</p></div><div class="seg" role="group" aria-label="Periodo">${[7,14,30,90,365].map(p=>`<button data-act="setPeriod" data-p="${p}" aria-pressed="${S.period===p}">${p===365?'1 anno':p+' giorni'}</button>`).join('')}</div></div>
    <div class="kpis">
      ${kpi('Trascrizione sul registro',tras==null?'—':tras+'<small>%</small>',I.tras+' prelievi su '+I.prel+' confermati',tPill)}
      ${kpi('Chiave fuori, tempo medio',I.rit?Math.round(I.avg)+'<small> min</small>':'—',I.over?(I.over===1?'1 volta':I.over+' volte')+' oltre '+tout+' min':'mai oltre '+tout+' min',I.over?'<span class="pill warn">Da approfondire</span>':'')}
      ${kpi('Aperture della keybox',I.aperture,I.prel+' prelievi registrati · '+(I.negati?(I.negati===1?'1 accesso negato':I.negati+' accessi negati'):'nessun accesso negato'),'')}
      ${kpi('Fiale rotte o cadute',I.rotte,'nel periodo','')}
    </div>
    <section class="panel"><div class="sec-h"><div><h2>Fiale prelevate al giorno</h2><p class="fine">${farmaci().map(f=>f.nome+' '+(I.totals[f.id]||0)).join(' · ')} nel periodo</p></div><button class="btn btn-quiet btn-sm" data-act="toggleTable">${S.showTable?'Mostra il grafico':'Mostra la tabella'}</button></div>
      <div class="legend">${farmaci().map(f=>`<span class="d-${f.tema}"><i class="sw"></i>${esc(f.nome)}</span>`).join('')}</div>
      ${S.showTable?`<div class="tbl"><table><thead><tr><th>Giorno</th>${farmaci().map(f=>`<th class="num">${esc(f.nome)}</th>`).join('')}</tr></thead><tbody>${I.perDay.slice().reverse().map(d=>`<tr><td>${esc(dayLabel(d.key))}</td>${farmaci().map(f=>`<td class="num">${d.v[f.id]||0}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:`<div>${chartSVG(I.perDay)}</div>`}
    </section>`;
}

function tabImpostazioni(){
  const c=cfg(); const CF=S.codeFlow||{step:0};
  let code;
  if(CF.step===1){
    code=`<div class="keybox"><div class="kb-top"><span class="kb-label">Nuovo codice</span></div><div class="digits">${CF.code.split('').map(d=>`<span class="digit">${d}</span>`).join('')}</div></div>
      <ol class="sub" style="margin:0;padding-left:20px;display:grid;gap:6px"><li>Imposta questo codice sulla keybox seguendo le istruzioni del produttore.</li><li>Chiudi la keybox e riaprila con il nuovo codice per verificarlo.</li><li>Conferma qui sotto: da quel momento l’app mostra il nuovo codice al personale.</li></ol>
      <div class="btns"><button class="btn btn-primary" data-act="codeConfirm">Ho impostato e verificato il codice</button><button class="btn btn-quiet" data-act="codeCancel">Annulla</button></div>`;
  } else {
    code=`<p class="sub">Codice attuale: <b class="mono" style="font-size:20px;letter-spacing:.15em">${S.revealCode?esc(c.codice):'●●●●●'}</b> <button class="btn btn-quiet btn-sm" data-act="toggleReveal">${S.revealCode?'Nascondi':'Mostra'}</button></p>
      <p class="sub">In vigore dal ${c.codiceDal?ddmmyyyy(c.codiceDal):'—'}${c.codiceDaNome?', impostato da '+esc(c.codiceDaNome):''}.</p>
      <div class="btns"><button class="btn btn-primary" data-act="codeGen">Genera un nuovo codice</button></div>
      <form class="subform" data-submit="codeManual" novalidate><label class="field"><span>Oppure scegli tu il codice</span><input id="cm-code" type="text" inputmode="numeric" maxlength="5" placeholder="5 cifre"><small>Vengono scartati codici deboli: cifre ripetute, sequenze come 12345, il codice precedente.</small></label><p class="err" id="cm-err"></p><div class="btns"><button class="btn btn-secondary btn-sm">Usa questo codice</button></div></form>`;
  }
  const staff=Object.values(S.staff).sort((a,b)=>(a.ruolo===b.ruolo?0:a.ruolo==='coordinatore'?-1:1)||String(a.nome).localeCompare(b.nome));
  const qrDefault=S.qrUrl!=null?S.qrUrl:(c.appUrl||location.href.split('#')[0]);
  return `<div class="grid2">
    <section class="panel" id="sez-codice"><div class="sec-h"><h2>Codice keybox</h2>${codePill()}</div>${code}</section>
    <section class="panel"><h2>Regole</h2>
      <form class="block" data-submit="regoleSave" novalidate>
        <div class="two">
          <label class="field"><span>Rotazione codice (giorni)</span><input id="rg-rot" type="number" min="1" max="60" value="${c.rotazioneGiorni||7}"></label>
          <label class="field"><span>Chiave fuori al massimo (min)</span><input id="rg-key" type="number" min="1" max="240" value="${c.timeoutChiaveMin||15}"></label>
          <label class="field"><span>Chiusura sessione (min)</span><input id="rg-ses" type="number" min="1" max="30" value="${c.sessioneMin||5}"></label>
        </div>
        <div class="btns"><button class="btn btn-secondary btn-sm">Salva le regole</button></div>
      </form></section>
    
    <section class="panel">
      <div class="sec-h"><h2>Farmaci in cassaforte</h2><span class="muted" style="font-size:14px">${farmaci().length} attivi</span></div>
      <p class="fine">Modifica nome, dosaggio, formato confezione standard e soglia di riordino. Se un farmaco non è più in uso, toccando "Archivia" non comparirà più nei prelievi ma resterà nello storico.</p>
      <form class="block" data-submit="farmaciSave" novalidate>
        ${farmaciTutti().map(f=>`
          <div class="subform" style="border-left:4px solid var(--accent,#0D6A62);margin-bottom:12px;padding:12px;">
            <div style="display:flex;align-items:center;justify-content:space-between;width:100%;margin-bottom:8px;">
              <div style="display:flex;align-items:center;gap:8px;">
                <span class="badge d-${f.tema}"><b>${esc(f.sigla)}</b></span>
                <span style="font-weight:700;font-size:16px;">${esc(f.nome)}</span> ${f.attivo===false?'<span class="pill">Archiviato</span>':''}
              </div>
              <button type="button" class="btn btn-quiet btn-sm" data-act="farmacoToggle" data-id="${esc(f.id)}">${f.attivo===false?'Ripristina':'Archivia'}</button>
            </div>
            <div class="two" style="width:100%;">
              <label class="field"><span>Nome commerciale</span><input id="fa-nome-${f.id}" type="text" maxlength="40" value="${esc(f.nome)}"></label>
              <label class="field"><span>Principio attivo / Sale</span><input id="fa-sale-${f.id}" type="text" maxlength="40" value="${esc(f.sale||'')}"></label>
            </div>
            <div class="two" style="width:100%;">
              <label class="field"><span>Dosaggio / Volume</span><input id="fa-dos-${f.id}" type="text" maxlength="40" value="${esc(f.dosaggio)}"></label>
              <label class="field"><span>Formato scatola standard (fiale)</span><input id="fa-unita-${f.id}" type="number" min="1" max="100" value="${f.unitaPerScatola||5}"></label>
            </div>
            <div class="two" style="width:100%;">
              <label class="field"><span>Soglia riordino (fiale)</span><input id="fa-sog-${f.id}" type="number" min="0" max="999" value="${f.soglia||0}"></label>
            </div>
          </div>
        `).join('')}
        <div class="btns"><button class="btn btn-secondary btn-sm">Salva modifiche farmaci</button></div>
      </form>
      
      <form class="subform" data-submit="farmacoAdd" novalidate style="margin-top:16px;">
        <h3>Aggiungi farmaco alla cassaforte</h3>
        <div class="two">
          <label class="field"><span>Nome commerciale</span><input id="nf-nome" type="text" maxlength="40" placeholder="Es. Ossicodone"></label>
          <label class="field"><span>Principio attivo / Sale</span><input id="nf-sale" type="text" maxlength="40" placeholder="Es. cloridrato"></label>
        </div>
        <div class="two">
          <label class="field"><span>Dosaggio / Volume</span><input id="nf-dos" type="text" maxlength="40" placeholder="Es. 10 mg / 1 ml"></label>
          <label class="field"><span>Sigla badge (1 o 2 lettere)</span><input id="nf-sigla" type="text" maxlength="2" placeholder="Es. O" style="text-transform:uppercase;"></label>
        </div>
        <div class="two">
          <label class="field"><span>Formato scatola standard (fiale)</span><input id="nf-unita" type="number" min="1" max="100" value="5"></label>
          <label class="field"><span>Soglia riordino (fiale)</span><input id="nf-sog" type="number" min="0" max="999" value="5"></label>
        </div>
        <div class="two">
          <label class="field"><span>Giacenza iniziale (fiale)</span><input id="nf-init" type="number" min="0" max="999" value="0"></label>
          <label class="field"><span>Numero di Lotto iniziale</span><input id="nf-lotto" type="text" maxlength="25" placeholder="Es. L10492" style="text-transform:uppercase;"></label>
        </div>
        <label class="field"><span>Scadenza Lotto iniziale</span><input id="nf-exp" type="month"></label>
        <p class="err" id="nf-err"></p>
        <div class="btns"><button class="btn btn-primary btn-sm">Aggiungi alla cassaforte</button></div>
      </form>
    </section>

    <section class="panel"><div class="sec-h"><h2>Personale</h2><span class="muted" style="font-size:14px">${staff.filter(s=>s.attivo!==false).length} attivi</span></div>
      <p class="fine">Scorri una persona verso sinistra per eliminarla.</p>
      <div>${staff.map(s=>{ const canDel=s.id!==S.meId; return `<div class="staff-item"><div class="swipe${S.swipeOpen===s.id?' open':''}"${canDel?` data-swipe="${esc(s.id)}"`:''}>${canDel?`<button class="swipe-del" data-act="staffDelAsk" data-id="${esc(s.id)}">Elimina</button>`:''}<div class="staff"><div><b>${esc(s.nome)}</b> ${s.attivo===false?'<span class="pill">Disattivato</span>':''}<div class="row-s">${s.ruolo==='coordinatore'?'Coordinatore':'Infermiere'} · matricola <span class="mono">${esc(s.id)}</span></div></div>
        <div class="btns"><button class="btn btn-quiet btn-sm" data-act="pinOpen" data-id="${esc(s.id)}">Resetta PIN</button>${s.id!==S.meId?`<button class="btn btn-quiet btn-sm" data-act="staffToggle" data-id="${esc(s.id)}">${s.attivo===false?'Riattiva':'Disattiva'}</button>`:''}</div></div></div>
        ${S.delAsk===s.id?`<div class="subform del-ask"><p><b>Eliminare ${esc(s.nome)}?</b></p><p class="sub">Non potrà più accedere all\u2019app. I movimenti già registrati restano nel registro con il suo nome.</p><div class="btns"><button class="btn btn-danger btn-sm" data-act="staffDel" data-id="${esc(s.id)}">Elimina definitivamente</button><button class="btn btn-quiet btn-sm" data-act="staffDelCancel">Annulla</button></div></div>`:''}
        ${S.pinFor===s.id?`<form class="subform" data-submit="pinSave" data-id="${esc(s.id)}" novalidate><label class="field"><span>Nuovo PIN provvisorio per ${esc(s.nome)}</span><input id="pn-pin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"><small>Dovrà reimpostarlo al login successivo.</small></label><p class="err" id="pn-err"></p><div class="btns"><button class="btn btn-primary btn-sm">Salva il PIN provvisorio</button><button type="button" class="btn btn-quiet btn-sm" data-act="pinCancel">Annulla</button></div></form>`:''}</div>`; }).join('')}</div>
      <form class="subform" data-submit="staffAdd" novalidate><h3>Aggiungi una persona</h3>
        <label class="field"><span>Nome e cognome</span><input id="sa-nome" type="text" maxlength="60"></label>
        <div class="two"><label class="field"><span>Matricola</span><input id="sa-mat" type="text" inputmode="numeric" maxlength="12"></label><label class="field"><span>PIN provvisorio</span><input id="sa-pin" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></label></div>
        <label class="field"><span>Ruolo</span><select id="sa-ruolo"><option value="infermiere">Infermiere</option><option value="coordinatore">Coordinatore</option></select></label>
        <p class="err" id="sa-err"></p><div class="btns"><button class="btn btn-secondary btn-sm">Aggiungi</button></div></form></section>
    <section class="panel"><h2>QR code di accesso</h2>
      <p class="sub">Da stampare e applicare accanto alla keybox: inquadrandolo si apre la pagina di accesso.</p>
      <form class="block" data-submit="qrMake" novalidate><label class="field"><span>Indirizzo dell’app</span><input id="qr-url" type="url" value="${esc(qrDefault)}" placeholder="https://keybox.esempio.it"><small>L’indirizzo dove l’app sarà pubblicata per il reparto.</small></label><div class="btns"><button class="btn btn-secondary btn-sm">Genera il QR</button></div></form>
      ${S.qrUrl?`<div class="qr-card"><div class="qr-t">KEYBOX STUPEFACENTI</div><div id="qr"></div><div class="qr-s">${esc(c.reparto||'')}<br>Inquadra per accedere</div></div><div class="btns"><button class="btn btn-secondary btn-sm" data-act="qrDownload">Scarica il QR (PNG)</button></div>`:''}</section>
    <section class="panel"><h2>Dati</h2><p class="sub">${modeText()}</p>
      ${S.resetStep?`<form class="subform" data-submit="resetConfirm" novalidate><label class="field"><span>Scrivi AZZERA per cancellare personale, movimenti e impostazioni</span><input id="rs-word" type="text" autocomplete="off"></label><p class="err" id="rs-err"></p><div class="btns"><button class="btn btn-danger btn-sm">Cancella tutti i dati</button><button type="button" class="btn btn-quiet btn-sm" data-act="resetCancel">Annulla</button></div></form>`:'<div class="btns"><button class="btn btn-secondary btn-sm" data-act="resetStart">Azzera tutti i dati</button></div>'}</section>
  </div>`;
}

function toast(msg){ const t=$('#toast'); t.textContent=msg; t.hidden=false; clearTimeout(toast._t); toast._t=setTimeout(()=>{t.hidden=true;},3800); }
class UserError extends Error{ constructor(m){ super(m); this.user=m; } }
function errMsg(e){
  if(e&&e.user) return e.user;
  return 'Operazione non riuscita. Controlla la connessione e riprova.';
}
async function run(fn){ try{ await fn(); }catch(e){ if(e&&e.session){ logout('Sessione scaduta: accedi di nuovo.'); return; } if(!(e&&e.user)) console.error(e); toast(errMsg(e)); render(); } }
function saveSession(){ try{ if(REMOTE_ON?S.token:S.meId) sessionStorage.setItem(SS_KEY,JSON.stringify(REMOTE_ON?{token:S.token,last:S.lastActivity}:{id:S.meId,last:S.lastActivity})); else sessionStorage.removeItem(SS_KEY); }catch(e){} }
function logout(msg){
  Api.logout().catch(()=>{}); S.codeValue='';
  S.meId=null; S.meUser=null; S.view='home'; S.tab='stato'; S.filter='tutti'; S.flow=null; S.codeShownUntil=0; S.confirmTake=false; S.codeFlow=null; S.coordForm=null; S.ackId=null; S.revealCode=false; S.resetStep=0; S.pinFor=null; S.showMyPinModal=false; S.recoveryFlow=null; S.assocLottoFarmacoId=null;
  saveSession(); render(); if(msg) toast(msg);
}
function isWeak(code){
  if(!/^\d{5}$/.test(code)) return 'Il codice deve avere 5 cifre.';
  const d=code.split('').map(Number); let asc=true,desc=true;
  for(let i=1;i<5;i++){ if(d[i]!==(d[i-1]+1)%10) asc=false; if(d[i]!==(d[i-1]+9)%10) desc=false; }
  if(asc||desc) return 'Evita le sequenze come 12345 o 54321.';
  const cnt={}; d.forEach(x=>cnt[x]=(cnt[x]||0)+1); if(Math.max(...Object.values(cnt))>=3) return 'Evita di ripetere la stessa cifra più di due volte.';
  if(code===String(cfg().codice)) return 'È uguale al codice attuale.';
  return '';
}
function genCode(){
  for(let i=0;i<500;i++){ let c=''; try{ const a=new Uint32Array(5); crypto.getRandomValues(a); c=Array.from(a).map(x=>x%10).join(''); }catch(e){ c=Array.from({length:5},()=>Math.floor(Math.random()*10)).join(''); } if(!isWeak(c)) return c; }
  return '58316';
}
async function saveFile(filename,data){
  try{ const blob=data instanceof Blob?data:new Blob([data],{type:'text/csv;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1500); }
  catch(e){ toast('Download non disponibile qui.'); }
}

const LocalApi={
  async login(mat,pin){
    const s=S.staff[mat];
    if(!(s&&s.attivo!==false&&pin&&s.pinHash===await pinHash(mat,pin))){
      if(mat) addEvent('accesso_negato',{matricola:mat.slice(0,12)}).catch(()=>{});
      throw new UserError('Matricola o PIN non corretti.');
    }
    S.meId=mat;
    S.meUser=s;
  },
  async logout(){},
  async refresh(){},
  async setup(p){
    const now=Date.now();
    await Store.set('staff/'+p.matricola,{nome:p.nome,ruolo:'coordinatore',email:p.email,pinHash:await pinHash(p.matricola,p.pin),attivo:true,deveCambiarePin:false});
    await Store.set('app/state',{giacenza:p.giacenza,ts:now,fonte:'avvio'});
    await Store.set('app/key',{status:'in',since:now});
    await Store.set('app/config',{reparto:p.reparto,demo:false,codice:p.codice,codiceDal:now,codiceDa:p.matricola,codiceDaNome:p.nome,rotazioneGiorni:7,timeoutChiaveMin:15,sessioneMin:5,farmaci:DEFAULTFARMACI_SAFE(),appUrl:''});
    S.meId=p.matricola;
    S.meUser={nome:p.nome,ruolo:'coordinatore',id:p.matricola,email:p.email,deveCambiarePin:false};
  },
  async changeMyPin(pin){
    const h=await pinHash(S.meId,pin);
    await Store.merge('staff/'+S.meId,{pinHash:h,deveCambiarePin:false});
    if(S.meUser) S.meUser.deveCambiarePin=false;
  },
  async reqOtp(mat){
    const s=S.staff[mat];
    if(!s||s.ruolo!=='coordinatore') throw new UserError('Matricola non valida o non abilitata.');
    return {ok:true,matricola:mat,email_masked:s.email||'email registrata'};
  },
  async verifyOtpAndReset(mat,otp,pin){
    const h=await pinHash(mat,pin);
    await Store.merge('staff/'+mat,{pinHash:h,deveCambiarePin:false});
    return {ok:true};
  },
  async takeKey(){
    const k=S.key; const mine=!!(k&&k.status==='out'&&k.by===S.meId); const other=!!(k&&k.status==='out'&&!mine);
    if(!mine){
      await addEvent('chiave_presa',other?{nota:'Risultava presa da '+k.byName+' alle '+hhmm(k.since)}:{});
      await Store.set('app/key',{status:'out',by:S.meId,byName:me().nome,since:Date.now()});
    }
    return String(cfg().codice);
  },
  async returnKey(){
    const k=S.key; if(!k||k.status!=='out') return;
    await addEvent('chiave_riposta',{durataMin:mins(k.since),presaDa:k.by,presaDaNome:k.byName,registrataDaAltri:k.by!==S.meId});
    await Store.set('app/key',{status:'in',by:S.meId,byName:me().nome,since:Date.now()});
  },
  markKeyIn(){ return LocalApi.returnKey(); },
  async receiveKey(){
    const k=S.key; if(!k||k.status!=='out') return;
    await addEvent('chiave_passata',{da:k.by,daNome:k.byName,durataMin:mins(k.since)});
    await Store.set('app/key',{status:'out',by:S.meId,byName:me().nome,since:Date.now()});
  },
  async prelievo(o){
    const st=stock(); const delta={}; const after=Object.assign({},st);
    const lottiScalati = [];
    
    for(const f of farmaci()){
      const q = o.qty[f.id] || 0;
      if(q > (st[f.id] || 0)) throw new UserError('La giacenza è cambiata nel frattempo: ricontrolla le quantità.');
      if(q > 0){
        delta[f.id] = -q;
        after[f.id] = (st[f.id] || 0) - q;
        
        const plan = getFefoPlan(f.id, q);
        plan.forEach(p => {
          if(p.lottoId){
            const target = S.lotti.find(l => l.id === p.lottoId);
            if(target){
              if(target.fialeRimaste != null) target.fialeRimaste -= p.take;
              if(target.fiale_rimaste != null) target.fiale_rimaste -= p.take;
            }
          }
          lottiScalati.push(p);
        });
      }
    }
    
    const evt=await addEvent('prelievo',{
      delta,
      paziente:o.paziente,
      motivo:o.motivo,
      note:o.motivo==='somministrazione'?'':o.note,
      trascritto:false,
      giacenzaDopo:after,
      lottiScalati
    });
    
    await Store.set('app/state',{giacenza:after,ts:evt.ts,fonte:'prelievo'});
    return evt;
  },
  async transcribed(e){ const ts=Date.now(); await patchEvent(e,{trascritto:true,trascrittoTs:ts}); return Object.assign({},e,{trascritto:true,trascrittoTs:ts}); },
  async carico(delta,rif,lotti){
    const after=stock(); Object.keys(delta).forEach(k=>after[k]=(after[k]||0)+delta[k]);
    const evt=await addEvent('carico',{delta,riferimento:rif});
    await Store.set('app/state',{giacenza:after,ts:evt.ts,fonte:'carico'});
    if(lotti && lotti.length){
      lotti.forEach(l=>{
        S.lotti.push({
          id: uid(),
          farmacoId: l.farmacoId,
          lotto: l.lotto,
          scadenza: l.scadenza,
          fialeTotali: l.fiale,
          fialeRimaste: l.fiale,
          unitaPerScatola: l.unitaPerScatola || 5,
          caricatoTs: Date.now()
        });
      });
    }
  },
  async rettifica(a,motivo){ const evt=await addEvent('rettifica',{da:stock(),a,motivo}); await Store.set('app/state',{giacenza:a,ts:evt.ts,fonte:'rettifica'}); },
  async associaLottoEsistente(farmacoId, lotto, scadenza, fiale, unitaPerScatola){
    S.lotti.push({
      id: uid(),
      farmacoId: farmacoId,
      lotto: lotto,
      scadenza: scadenza,
      fialeTotali: fiale,
      fialeRimaste: fiale,
      unitaPerScatola: unitaPerScatola || 5,
      caricatoTs: Date.now()
    });
    await addEvent('censimento_lotto',{
      nota: `Associazione lotto ${lotto} (${scadenza}, ${fiale} fiale, scatole da ${unitaPerScatola}) a ${fById(farmacoId).nome}`
    });
  },
  ack(e,note){ return patchEvent(e,{gestito:{by:S.meId,byName:me().nome,ts:Date.now(),note}}); },
  async codeSet(code){ await Store.merge('app/config',{codice:code,codiceDal:Date.now(),codiceDa:S.meId,codiceDaNome:me().nome}); await addEvent('codice_cambiato',{}); },
  rules(o){ return Store.merge('app/config',o); },
  farmaci(list){ return Store.merge('app/config',{farmaci:list}); },
  async staffAdd(o){ await Store.set('staff/'+o.matricola,{nome:o.nome,ruolo:o.ruolo,pinHash:await pinHash(o.matricola,o.pin),attivo:true,deveCambiarePin:true}); },
  staffToggle(id){ const s=S.staff[id]; return Store.merge('staff/'+id,{attivo:!!(s&&s.attivo===false)}); },
  async staffPin(id,pin){ await Store.merge('staff/'+id,{pinHash:await pinHash(id,pin),deveCambiarePin:true}); },
  async staffDel(id){ const s=S.staff[id]; if(!s) return; await Store.del('staff/'+id); await addEvent('personale_rimosso',{matricola:id,nome:s.nome,ruolo:s.ruolo}); },
  appUrl(u){ return Store.merge('app/config',{appUrl:u}); },
  async reset(){ 
    const staff=await Store.list('staff'); const logs=await Store.list('log');
    for(const s of staff) await Store.del('staff/'+s.id);
    for(const l of logs) await Store.del('log/'+l.id);
    await Store.del('app/key'); await Store.del('app/state'); await Store.del('app/config');
    localStorage.removeItem(LS_SNOOZE_KEY);
    localStorage.removeItem(LS_NEGATI_KEY);
  }
};

function DEFAULTFARMACI_SAFE(){
  return DEFAULT_FARMACI;
}

async function rpc(fn,args){
  const h={'Content-Type':'application/json','apikey':SUPABASE_KEY};
  if(/^eyJ/.test(SUPABASE_KEY)) h.Authorization='Bearer '+SUPABASE_KEY;
  let r;
  try{ r=await fetch(SUPABASE_URL+'/rest/v1/rpc/'+fn,{method:'POST',headers:h,body:JSON.stringify(args||{})}); }
  catch(e){ throw new UserError('Nessuna connessione con il database. Controlla la rete e riprova.'); }
  const txt=await r.text(); let j=null; try{ j=txt?JSON.parse(txt):null; }catch(e){}
  if(!r.ok){
    const msg=String((j&&(j.message||j.hint||j.details))||('Errore '+r.status));
    if(/SESSIONE_SCADUTA/.test(msg)){ const e=new Error('sessione'); e.session=true; throw e; }
    if(r.status===404) throw new UserError('Il database non risponde: controlla di aver eseguito lo script in Supabase.');
    if(r.status===401||r.status===403) throw new UserError('Chiave di Supabase non valida: controlla il file config.js.');
    throw new UserError('Errore del database: '+msg);
  }
  return j;
}
function clearRemoteData(){
  S.events=[]; S.staff={}; S.staffLoaded=false; S.key=null; S.base=null; S.codeValue=''; S.meId=null; S.meUser=null; S.lotti=[];
  S.config=S.publicInfo||null;
}
function applyRemote(st){
  if(!st||!st.me) return;
  S.config=st.config; S.base=st.base; S.key=st.key; S.events=st.events||[]; S.lotti=st.lotti||[];
  const m={}; (st.staff||[]).forEach(x=>{ m[x.id]=x; }); S.staff=m; S.staffLoaded=true; S.meId=st.me.id; S.meUser=st.me;
}
async function loadPublic(){
  const pub=await rpc('kb_public',{});
  S.publicInfo=pub&&pub.configured?pub:null;
  if(!S.token) S.config=S.publicInfo;
}
const RemoteApi={
  async refresh(touch){ if(!S.token) return; applyRemote(await rpc('kb_state',{p_token:S.token,p_touch:!!touch})); changed(); },
  async act(action,args){
    const r=await rpc('kb_do',{p_token:S.token,p_action:action,p_args:args||{}});
    if(r&&r.error) throw new UserError(r.error);
    if(r&&r.state) applyRemote(r.state);
    return r?r.result:null;
  },
  async login(mat,pin){ const r=await rpc('kb_login',{p_mat:mat,p_pin:pin}); if(r&&r.error) throw new UserError(r.error); S.token=r.token; await RemoteApi.refresh(true); },
  async logout(){ const t=S.token; S.token=null; clearRemoteData(); if(t) await rpc('kb_logout',{p_token:t}); },
  async setup(p){ const r=await rpc('kb_setup',{p}); if(r&&r.error) throw new UserError(r.error); S.token=r.token; await loadPublic(); await RemoteApi.refresh(true); },
  async reqOtp(mat){
    const r=await rpc('kb_request_pin_reset',{p_matricola:mat});
    if(r&&r.error) throw new UserError(r.error);
    return r;
  },
  async verifyOtpAndReset(mat,otp,pin){
    const r=await rpc('kb_verify_otp_and_reset_pin',{p_matricola:mat,p_otp:otp,p_new_pin:pin});
    if(r&&r.error) throw new UserError(r.error);
    return r;
  },
  changeMyPin(pin){ return RemoteApi.act('change_my_pin',{pin}); },
  async takeKey(){ const r=await RemoteApi.act('take_key',{}); return r&&r.codice?String(r.codice):''; },
  returnKey(){ return RemoteApi.act('return_key'); },
  markKeyIn(){ return RemoteApi.act('return_key'); },
  receiveKey(){ return RemoteApi.act('receive_key'); },
  prelievo(o){ 
    const planMap = {};
    for(const f of farmaci()){
      const q = o.qty[f.id] || 0;
      if(q > 0) planMap[f.id] = getFefoPlan(f.id, q);
    }
    return RemoteApi.act('prelievo',{qty:o.qty, paziente:o.paziente, motivo:o.motivo, note:o.note, fefo_plan:planMap}); 
  },
  async transcribed(e){ await RemoteApi.act('transcribed',{id:e.id}); return S.events.find(x=>x.id===e.id)||Object.assign({},e,{trascritto:true,trascrittoTs:Date.now()}); },
  carico(delta,rif,lotti){ return RemoteApi.act('carico',{delta,riferimento:rif,lotti}); },
  rettifica(a,motivo){ return RemoteApi.act('rettifica',{a,motivo}); },
  async associaLottoEsistente(farmacoId, lotto, scadenza, fiale, unitaPerScatola){
    try {
      const res = await rpc('kb_associa_lotto_esistente', {
        p_farmaco_id: farmacoId,
        p_lotto: lotto,
        p_scadenza: scadenza,
        p_fiale_rimaste: fiale,
        p_unita_per_scatola: unitaPerScatola || 5,
        p_operatore_matr: S.meId,
        p_operatore_nome: me()?.nome || ''
      });
      if(res && res.error) throw new UserError(res.error);
    } catch(err) {
      await RemoteApi.act('associa_lotto_esistente', {
        farmaco_id: farmacoId,
        lotto: lotto,
        scadenza: scadenza,
        fiale_rimaste: fiale,
        unita_per_scatola: unitaPerScatola || 5
      });
    }
    await RemoteApi.refresh(true);
  },
  ack(e,note){ return RemoteApi.act('ack',{id:e.id,note}); },
  codeSet(code){ return RemoteApi.act('code_set',{codice:code}); },
  rules(o){ return RemoteApi.act('rules',o); },
  farmaci(list){ return RemoteApi.act('farmaci',{farmaci:list}); },
  staffAdd(o){ return RemoteApi.act('staff_add',o); },
  staffToggle(id){ return RemoteApi.act('staff_toggle',{matricola:id}); },
  staffPin(id,pin){ return RemoteApi.act('staff_pin',{matricola:id,pin}); },
  staffDel(id){ return RemoteApi.act('staff_delete',{matricola:id}); },
  appUrl(u){ return RemoteApi.act('app_url',{url:u}); },
  async reset(){ 
    await RemoteApi.act('reset'); 
    S.token=null; S.publicInfo=null; clearRemoteData(); 
    localStorage.removeItem(LS_SNOOZE_KEY);
    localStorage.removeItem(LS_NEGATI_KEY);
    await loadPublic(); 
  }
};
const Api=REMOTE_ON?RemoteApi:LocalApi;

const A={
  goView(d){ S.view=d.v; S.flow=null; S.confirmTake=false; render(); window.scrollTo(0,0); },
  goHome(){ S.view='home'; S.flow=null; render(); window.scrollTo(0,0); },
  cancelFlow(){ S.view='home'; S.flow=null; render(); window.scrollTo(0,0); },
  setTab(d){ S.tab=d.t; S.codeFlow=null; S.coordForm=null; S.ackId=null; S.resetStep=0; S.delAsk=null; S.swipeOpen=null; render(); },
  logout(){ logout(); },
  openMyPin(){ S.showMyPinModal=true; render(); },
  closeMyPin(){ S.showMyPinModal=false; render(); },
  openAssocLotto(d){ S.assocLottoFarmacoId = d.id; render(); },
  closeAssocLotto(){ S.assocLottoFarmacoId = null; render(); },
  startRecovery(){ S.recoveryFlow={step:1,mat:val('l-mat'),emailMasked:'',err:''}; render(); },
  cancelRecovery(){ S.recoveryFlow=null; render(); },
  fillUser(d){
    const matInput = $('#l-mat');
    const pinInput = $('#l-pin');
    if(matInput) matInput.value = d.m;
    if(pinInput) {
      pinInput.value = '';
      pinInput.focus();
    }
  },
  async takeKey(d){
    const k=S.key; const mine=!!(k&&k.status==='out'&&k.by===S.meId); const other=!!(k&&k.status==='out'&&!mine);
    if(other&&!d.force){ S.confirmTake=true; render(); return; }
    S.confirmTake=false;
    const code=await Api.takeKey();
    if(!code){ toast('Codice non disponibile: chiedi al coordinatore.'); render(); return; }
    S.codeValue=code; S.codeShownUntil=Date.now()+CODE_SECONDS*1000; render();
  },
  cancelTake(){ S.confirmTake=false; render(); },
  hideCode(){ S.codeShownUntil=0; S.codeValue=''; render(); },
  async returnKey(){
    await Api.returnKey();
    logout('Chiave riposta alle '+hhmm(Date.now())+'. Sessione chiusa.');
  },
  async receiveKey(){
    const k=S.key; if(!k||k.status!=='out') return;
    await Api.receiveKey(); render();
    toast('Ora la chiave risulta a te.');
  },
  async markKeyIn(){
    const k=S.key; if(!k||k.status!=='out') return;
    await Api.markKeyIn(); render();
    toast('Chiave registrata come riposta.');
  },
  startPrelievo(){ const q={}; farmaci().forEach(f=>q[f.id]=0); S.flow={step:1,qty:q,paziente:'',motivo:'somministrazione',note:'',verified:{},err:''}; S.view='prelievo'; S.codeShownUntil=0; render(); window.scrollTo(0,0); },
  qty(d){ const st=stock(); const F=S.flow; const n=Math.max(0,Math.min((st[d.id]||0),(F.qty[d.id]||0)+Number(d.d))); F.qty[d.id]=n; F.err=''; render(); },
  setMotivo(d){ S.flow.motivo=d.v; S.flow.err=''; render(); },
  prelievoNext(){
    const F=S.flow; const tot=Object.values(F.qty).reduce((a,b)=>a+b,0);
    F.paziente=val('p-paz'); if($('#p-note')) F.note=val('p-note');
    if(!tot) F.err='Indica almeno una fiala.';
    else if(F.motivo==='somministrazione'&&!F.paziente) F.err='Indica il letto o il codice del paziente.';
    else if(F.motivo!=='somministrazione'&&!F.note) F.err='Descrivi cosa è successo.';
    else { F.err=''; F.step=2; F.verified={}; }
    render(); window.scrollTo(0,0);
  },
  flowBack(){ S.flow.step=1; S.flow.err=''; render(); window.scrollTo(0,0); },
  async prelievoConfirm(){
    const F=S.flow; if(F.busy) return; F.busy=true; const btn=$('#confirmBtn'); if(btn) btn.disabled=true;
    try{ F.evt=await Api.prelievo({qty:F.qty,paziente:F.paziente,motivo:F.motivo,note:F.note}); }
    catch(e){ F.busy=false; if(e&&e.user){ F.step=1; F.err=e.user; render(); window.scrollTo(0,0); return; } throw e; }
    F.busy=false; F.step=3; render(); window.scrollTo(0,0);
  },
  async markTranscribed(){ const F=S.flow; F.evt=await Api.transcribed(F.evt); render(); },
  async markTranscribedById(d){
    const e = S.events.find(x => x.id === d.id);
    if(e){
      e.trascritto = true;
      e.trascrittoTs = Date.now();
    }
    await Api.transcribed({ id: d.id });
    render();
    toast('Prelievo confermato come trascritto sul registro.');
  },
  anotherPrelievo(){
    const q={}; farmaci().forEach(f=>q[f.id]=0);
    S.flow={step:1,qty:q,paziente:'',motivo:'somministrazione',note:'',verified:{},err:''};
    S.view='prelievo';
    render();
    window.scrollTo(0,0);
  },
  async farmacoToggle(d){
    const list=farmaciTutti().map(f=>{
      if(f.id===d.id) return Object.assign({},f,{attivo:f.attivo===false?true:false});
      return f;
    });
    await Api.farmaci(list);
    render();
    toast('Stato farmaco aggiornato.');
  },
  ackOpen(d){ S.ackId=d.id; render(); const t=$('#ack-note'); if(t) t.focus(); },
  ackLottoExp(d){
    S.ackId = d.id;
    render();
    const t = $('#ack-note');
    if(t) {
      t.value = 'Presa visione della scadenza. Monitoraggio attivo in cassaforte.';
      t.focus();
    }
  },
  ackAccessiNegati(d){
    S.ackId = d.id;
    render();
    const t = $('#ack-note');
    if(t) {
      t.value = 'Verificati accessi falliti con il personale in turno. Nessuna anomalia.';
      t.focus();
    }
  },
  async snoozeLotto7(d){
    const lottoId = d.lottoId || d.id.replace('exp_','');
    const until = Date.now() + (7 * 86400000);
    persistSnooze(lottoId, until);
    await addEvent('gestione_scadenza', { lottoId, untilTs: until, nota: 'Avviso scadenza lotto posticipato di 7 giorni' }).catch(()=>{});
    render();
    toast('Segnalazione posticipata di 7 giorni.');
  },
  async snoozeLotto15(d){
    const lottoId = d.lottoId || d.id.replace('exp_','');
    const until = Date.now() + (15 * 86400000);
    persistSnooze(lottoId, until);
    await addEvent('gestione_scadenza', { lottoId, untilTs: until, nota: 'Avviso scadenza lotto posticipato di 15 giorni' }).catch(()=>{});
    render();
    toast('Segnalazione posticipata di 15 giorni.');
  },
  ackCancel(){ S.ackId=null; render(); },
  gotoCarico(){ S.tab='stato'; S.coordForm='carico'; S.scrollTo='sez-giacenze'; render(); },
  gotoCode(){ S.view='coord'; S.tab='impostazioni'; S.codeFlow={step:0}; S.scrollTo='sez-codice'; render(); },
  gotoDaTrascrivere(){ S.tab='registro'; S.filter='datrascrivere'; render(); },
  openForm(d){ S.coordForm=d.f; if(d.f==='rettifica') S.rettPrefill=null; render(); },
  closeForm(){ S.coordForm=null; S.rettPrefill=null; render(); },
  setFilter(d){ S.filter=d.f; S.regLimit=120; render(); },
  moreRows(){ S.regLimit+=200; render(); },
  setPeriod(d){ S.period=Number(d.p); render(); },
  toggleTable(){ S.showTable=!S.showTable; render(); },
  toggleReveal(){ S.revealCode=!S.revealCode; render(); },
  codeGen(){ S.codeFlow={step:1,code:genCode()}; render(); },
  codeCancel(){ S.codeFlow={step:0}; render(); },
  async codeConfirm(){
    const CF=S.codeFlow; if(!CF||!CF.code) return; const now=Date.now();
    await Api.codeSet(CF.code);
    S.codeFlow={step:0}; S.revealCode=false; render(); toast('Nuovo codice attivo dalle '+hhmm(now)+'.');
  },
  async exportCSV(){
    const flt=(FILTERS.find(f=>f[0]===S.filter)||FILTERS[0])[2];
    const rows=[['Data','Ora','Tipo','Operatore','Matricola','Dettaglio','Trascritto sul registro','Presa visione']];
    S.events.filter(flt).forEach(e=>{
      const op = resolveOperator(e);
      rows.push([
        ddmmyyyy(e.ts),
        hhmm(e.ts),
        TYPE[e.type]||e.type,
        op,
        e.by||'',
        detailText(e),
        e.type==='prelievo'?(e.trascritto?'sì':'no'):'',
        e.gestito?(resolveOperator(e.gestito)+' '+ddmmyyyy(e.gestito.ts)+' '+(e.gestito.note||'')):''
      ]);
    });
    const csv='﻿'+rows.map(r=>r.map(c=>'"'+String(c==null?'':c).replace(/"/g,'""')+'"').join(';')).join('\r\n');
    await saveFile('registro-keybox-'+dayKey(Date.now())+'.csv',csv);
  },
  pinOpen(d){ S.pinFor=d.id; render(); const p=$('#pn-pin'); if(p) p.focus(); },
  pinCancel(){ S.pinFor=null; render(); },
  staffDelAsk(d){ S.delAsk=d.id; S.swipeOpen=null; S.pinFor=null; render(); },
  staffDelCancel(){ S.delAsk=null; render(); },
  async staffDel(d){
    const s=S.staff[d.id]; if(!s) return;
    if(d.id===S.meId){ toast('Non puoi eliminare il tuo profilo.'); return; }
    await Api.staffDel(d.id);
    S.delAsk=null; S.swipeOpen=null; render(); toast(s.nome+' eliminato dal personale.');
  },
  async staffToggle(d){ const s=S.staff[d.id]; if(!s) return; await Api.staffToggle(d.id); render(); },
  async qrDownload(){
    const q=$('#qr'); const src=q&&(q.querySelector('canvas')||q.querySelector('img')); if(!src){ toast('Genera prima il QR.'); return; }
    const W=640,H=820; const cv=document.createElement('canvas'); cv.width=W; cv.height=H; const x=cv.getContext('2d');
    x.fillStyle='#FFFFFF'; x.fillRect(0,0,W,H); x.fillStyle='#13232A'; x.textAlign='center';
    x.font='800 40px "Atkinson Hyperlegible Next", Arial, sans-serif'; x.fillText('KEYBOX STUPEFACENTI',W/2,80);
    x.font='500 26px "Atkinson Hyperlegible Next", Arial, sans-serif'; x.fillStyle='#435760'; x.fillText(cfg().reparto||'',W/2,124);
    x.imageSmoothingEnabled=false; x.drawImage(src,90,160,460,460);
    x.fillStyle='#13232A'; x.font='700 30px "Atkinson Hyperlegible Next", Arial, sans-serif'; x.fillText('Inquadra per accedere',W/2,690);
    x.font='400 22px "Atkinson Hyperlegible Next", Arial, sans-serif'; x.fillStyle='#435760'; x.fillText('Ogni apertura viene registrata con nome, data e ora',W/2,736);
    const blob=await new Promise(r=>cv.toBlob(r,'image/png')); if(blob) await saveFile('qr-keybox.png',blob);
  },
  resetStart(){ S.resetStep=1; render(); },
  resetCancel(){ S.resetStep=0; render(); }
};

const SUBMIT={
  async login(){
    if(S.lockUntil>Date.now()) return;
    const mat=val('l-mat'), pin=val('l-pin');
    try{ await Api.login(mat,pin); }
    catch(e){
      if(!(e&&e.user)) throw e;
      S.fails++; S.loginErr=e.user; S.loginMat=mat;
      if(!REMOTE_ON&&S.fails>=5){ S.lockUntil=Date.now()+60000; S.fails=0; }
      render(); const p=$('#l-pin'); if(p&&S.lockUntil<Date.now()) p.focus(); return;
    }
    S.fails=0; S.loginErr=''; S.loginMat=''; S.lastActivity=Date.now(); S.view='home'; saveSession(); render(); window.scrollTo(0,0);
  },
  async reqOtp(){
    const mat=val('rec-mat'); const err=$('#rec-err');
    if(!mat){ err.textContent='Inserisci la matricola.'; return; }
    try{
      const res = await Api.reqOtp(mat);
      S.recoveryFlow = {
        step: 2,
        mat: mat,
        emailMasked: res.email_masked || 'email registrata',
        err: ''
      };
      render();
    }catch(e){
      err.textContent = errMsg(e);
    }
  },
  async verifyOtp(){
    const rf = S.recoveryFlow;
    const otp = val('rec-otp');
    const p1 = val('rec-pin');
    const p2 = val('rec-conf');
    const err = $('#rec-err2');
    
    if(!/^\d{6}$/.test(otp)){ err.textContent='Inserisci il codice OTP numerico a 6 cifre.'; return; }
    if(!/^\d{4,6}$/.test(p1)){ err.textContent='Il nuovo PIN deve avere da 4 a 6 cifre numeriche.'; return; }
    if(p1 !== p2){ err.textContent='I due PIN inseriti non coincidono.'; return; }

    try{
      await Api.verifyOtpAndReset(rf.mat, otp, p1);
      S.recoveryFlow = null;
      S.loginMat = rf.mat;
      render();
      toast('PIN coordinatore reimpostato con successo! Accedi ora.');
    }catch(e){
      err.textContent = errMsg(e);
    }
  },
  async saveMustChangePin(){
    const p1=val('ch-new'), p2=val('ch-conf'); const err=$('#ch-err');
    if(!/^\d{4,6}$/.test(p1)){ err.textContent='Il PIN deve avere da 4 a 6 cifre numeriche.'; return; }
    if(p1!==p2){ err.textContent='I due PIN inseriti non coincidono.'; return; }
    await Api.changeMyPin(p1);
    if(me()) me().deveCambiarePin=false;
    render();
    toast('PIN personale impostato con successo.');
  },
  async saveMyPin(){
    const p1=val('mp-new'), p2=val('mp-conf'); const err=$('#mp-err');
    if(!/^\d{4,6}$/.test(p1)){ err.textContent='Il PIN deve avere da 4 a 6 cifre numeriche.'; return; }
    if(p1!==p2){ err.textContent='I due PIN inseriti non coincidono.'; return; }
    await Api.changeMyPin(p1);
    S.showMyPinModal=false;
    render();
    toast('PIN aggiornato.');
  },
  async salvaAssocLotto(){
    const fId = S.assocLottoFarmacoId;
    const lotto = val('as-lot').toUpperCase();
    const exp = val('as-exp');
    const fialeNum = Number(val('as-fiale')) || 0;
    const unita = Number(val('as-unita')) || 5;
    const err = $('#as-err');

    if(!lotto){ err.textContent = 'Inserisci il codice del lotto.'; return; }
    if(!exp){ err.textContent = 'Seleziona il mese e anno di scadenza.'; return; }
    if(fialeNum <= 0){ err.textContent = 'Indica un numero di fiale valido maggiore di 0.'; return; }

    try {
      await Api.associaLottoEsistente(fId, lotto, exp, fialeNum, unita);
      S.assocLottoFarmacoId = null;
      render();
      toast(`Lotto ${lotto} associato con successo (${fiale(fialeNum)}).`);
    } catch(e) {
      err.textContent = errMsg(e);
    }
  },
  async setup(){
    const rep=val('su-rep'), nome=val('su-nome'), email=val('su-email'), mat=val('su-mat'), pin=val('su-pin'), code=val('su-code'); const err=$('#su-err');
    const g={}; let gBad=false; DEFAULT_FARMACI.forEach(f=>{ const v=val('su-g-'+f.id); if(!/^\d{1,3}$/.test(v)) gBad=true; g[f.id]=Number(v); });
    let msg='';
    if(!rep) msg='Scrivi il nome del reparto.';
    else if(!nome) msg='Scrivi nome e cognome del coordinatore.';
    else if(!email||!/^\S+@\S+\.\S+$/.test(email)) msg='Inserisci un indirizzo email valido per il recupero PIN.';
    else if(!/^[A-Za-z0-9]{3,12}$/.test(mat)) msg='La matricola deve avere da 3 a 12 lettere o cifre.';
    else if(!/^\d{4,6}$/.test(pin)) msg='Il PIN deve avere da 4 a 6 cifre.';
    else if(!/^\d{5}$/.test(code)) msg='Il codice della keybox deve avere 5 cifre.';
    else if(gBad) msg='Indica quante fiale ci sono in cassetta.';
    if(msg){ err.textContent=msg; return; }
    try{ await Api.setup({reparto:rep,nome,email,matricola:mat,pin,codice:code,giacenza:g}); }
    catch(e){ if(e&&e.user){ err.textContent=e.user; return; } throw e; }
    S.lastActivity=Date.now(); saveSession(); S.view='coord'; S.tab='impostazioni'; render(); toast('Reparto creato. Ora aggiungi il personale.');
  },
  async carico(){
    const delta={}; const lotti=[]; let any=false, bad=false;
    
    farmaci().forEach(f=>{
      const scatVal = val('ca-scat-'+f.id);
      const scat = Number(scatVal) || 0;
      const unita = Number(val('ca-unita-'+f.id)) || (f.unitaPerScatola || 5);
      const lot = val('ca-lot-'+f.id);
      const exp = val('ca-exp-'+f.id);

      if(scat > 0){
        if(!lot || !exp){
          bad = true;
          $('#ca-err').textContent = `Inserisci sia il Lotto che la Scadenza per le scatole di ${f.nome}.`;
          return;
        }
        const totFiale = scat * unita;
        delta[f.id] = (delta[f.id] || 0) + totFiale;
        lotti.push({
          farmacoId: f.id,
          scatole: scat,
          unitaPerScatola: unita,
          fiale: totFiale,
          lotto: lot.toUpperCase(),
          scadenza: exp
        });
        any = true;
      }
    });

    if(bad) return;
    if(!any){ $('#ca-err').textContent='Indica almeno una scatola da caricare.'; return; }
    
    await Api.carico(delta, val('ca-rif'), lotti);
    S.coordForm=null; render(); toast('Carico registrato: '+deltaText(delta,true)+' con tracciabilità lotti.');
  },
  async rettifica(){
    const a={}; let bad=false; farmaci().forEach(f=>{ const v=val('re-'+f.id); if(!/^\d{1,3}$/.test(v)) bad=true; a[f.id]=Number(v); });
    const mot=val('re-mot'); if(bad){ $('#re-err').textContent='Inserisci le fiale presenti per ogni farmaco.'; return; }
    if(!mot){ $('#re-err').textContent='Il motivo della rettifica è obbligatorio.'; return; }
    await Api.rettifica(a,mot);
    S.coordForm=null; S.rettPrefill=null; render(); toast('Giacenza rettificata.');
  },
  async ackSaveGeneric(f){
    const alertId = f.dataset.alertId;
    const lottoId = f.dataset.lottoId;
    const evtId = f.dataset.evtId;
    const note = val('ack-note');

    if(alertId === 'sec_negati'){
      const now = Date.now();
      persistDismissNegati(now);
      await addEvent('gestione_accessi_negati', {
        nota: `Presa visione accessi negati: ${note || 'Verificato con il personale in turno'}`
      });
    } else if(lottoId){
      const forever = Date.now() + (365 * 86400000);
      persistSnooze(lottoId, forever);
      await addEvent('gestione_scadenza', {
        lottoId,
        untilTs: forever,
        nota: `Presa visione scadenza lotto: ${note || 'Nessuna nota aggiuntiva'}`
      });
    } else if(evtId){
      const e = S.events.find(x => x.id === evtId);
      if(e) await Api.ack(e, note);
    }

    S.ackId = null;
    render();
    toast('Presa visione registrata.');
  },
  async codeManual(){ const c=val('cm-code'); const w=isWeak(c); if(w){ $('#cm-err').textContent=w; return; } S.codeFlow={step:1,code:c}; render(); },
  async regoleSave(){
    const rot=Number(val('rg-rot')), key=Number(val('rg-key')), ses=Number(val('rg-ses'));
    if(!(rot>=1&&key>=1&&ses>=1)){ toast('Controlla i valori: devono essere numeri maggiori di zero.'); return; }
    await Api.rules({rotazioneGiorni:rot,timeoutChiaveMin:key,sessioneMin:ses}); render(); toast('Regole salvate.');
  },
  async farmaciSave(){
    const list=farmaciTutti().map(f=>{
      const nomeInput = val('fa-nome-'+f.id);
      const saleInput = val('fa-sale-'+f.id);
      const dosInput  = val('fa-dos-'+f.id);
      const unitaInput= val('fa-unita-'+f.id);
      const sogInput  = val('fa-sog-'+f.id);
      return Object.assign({}, f, {
        nome: nomeInput || f.nome,
        sale: saleInput != null ? saleInput : f.sale,
        dosaggio: dosInput || f.dosaggio,
        unitaPerScatola: Math.max(1, Number(unitaInput) || 5),
        soglia: Math.max(0, Number(sogInput) || 0)
      });
    });
    await Api.farmaci(list);
    render();
    toast('Farmaci salvati con successo.');
  },
  async farmacoAdd(){
    const nome=val('nf-nome'), sale=val('nf-sale'), dos=val('nf-dos'), sigla=val('nf-sigla');
    const unita=Number(val('nf-unita'))||5, sog=Number(val('nf-sog'))||0, init=Number(val('nf-init'))||0;
    const lottoInit=val('nf-lotto').toUpperCase(), expInit=val('nf-exp');
    const err=$('#nf-err');
    
    if(!nome){ err.textContent='Inserisci il nome del farmaco.'; return; }
    if(!dos){ err.textContent='Inserisci il dosaggio.'; return; }
    if(!sigla){ err.textContent='Inserisci la sigla per il badge (1 o 2 lettere).'; return; }
    if(init > 0 && (!lottoInit || !expInit)){
      err.textContent='Se inserisci una giacenza iniziale, indica anche il Lotto e la Scadenza.';
      return;
    }
    
    const id=nome.toLowerCase().replace(/[^a-z0-9]/g,'')+'_'+Date.now().toString(36).slice(-3);
    const nuovo={
      id,
      nome,
      sale,
      dosaggio: dos,
      forma: 'fiala',
      sigla: sigla.toUpperCase(),
      tema: 'm',
      unitaPerScatola: unita,
      soglia: sog,
      attivo: true,
      giacenzaIniziale: init
    };
    
    const list=farmaciTutti().concat([nuovo]);
    await Api.farmaci(list);
    
    if(init > 0){
      await Api.associaLottoEsistente(id, lottoInit, expInit, init, unita);
    }
    
    if(!REMOTE_ON){
      const st=stock();
      st[id]=init;
      await Store.merge('app/state',{giacenza:st});
    }
    
    render();
    toast(nome+' aggiunto alla cassaforte con '+fiale(init)+'.');
  },
  async staffAdd(){
    const nome=val('sa-nome'), mat=val('sa-mat'), pin=val('sa-pin'), ruolo=val('sa-ruolo'); const err=$('#sa-err');
    if(!nome){ err.textContent='Scrivi nome e cognome.'; return; }
    if(!/^[A-Za-z0-9]{3,12}$/.test(mat)){ err.textContent='La matricola deve avere da 3 a 12 lettere o cifre.'; return; }
    if(S.staff[mat]){ err.textContent='Questa matricola è già presente.'; return; }
    if(!/^\d{4,6}$/.test(pin)){ err.textContent='Il PIN provvisorio deve avere da 4 a 6 cifre.'; return; }
    await Api.staffAdd({nome,matricola:mat,pin,ruolo});
    render(); toast(nome+' aggiunto con obbligo di cambio PIN al primo accesso.');
  },
  async pinSave(f){
    const id=f.dataset.id, pin=val('pn-pin'); if(!/^\d{4,6}$/.test(pin)){ $('#pn-err').textContent='Il PIN deve avere da 4 a 6 cifre.'; return; }
    await Api.staffPin(id,pin); S.pinFor=null; render(); toast('PIN provvisorio reimpostato.');
  },
  async qrMake(){ const u=val('qr-url'); if(!/^https?:\/\/\S+$/i.test(u)){ toast('Inserisci un indirizzo che inizi con https://'); return; } S.qrUrl=u; if(u!==cfg().appUrl) await Api.appUrl(u); render(); },
  async resetConfirm(){
    if(val('rs-word').toUpperCase()!=='AZZERA'){ $('#rs-err').textContent='Scrivi AZZERA per confermare.'; return; }
    await Api.reset();
    S.resetStep=0; logout('Dati cancellati.');
  }
};

document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]'); if(!b||b.disabled) return;
  const fn=A[b.dataset.act]; if(fn){ e.preventDefault(); run(()=>fn(b.dataset,b)); }
});
document.addEventListener('submit',e=>{
  const f=e.target; e.preventDefault(); const fn=SUBMIT[f.dataset.submit]; if(fn) run(()=>fn(f));
});
document.addEventListener('input',e=>{
  const el=e.target; 
  const b=el.dataset&&el.dataset.bind;
  if(b){ const k=b.split('.'); let t=S; for(let i=0;i<k.length-1;i++){ if(t[k[i]]==null) t[k[i]]={}; t=t[k[i]]; } t[k[k.length-1]]=el.value; }
  
  if(el.dataset && el.dataset.calcCarico){
    const fid = el.dataset.calcCarico;
    const scat = parseInt(val('ca-scat-'+fid), 10) || 0;
    const unita = parseInt(val('ca-unita-'+fid), 10) || 1;
    const tot = scat * unita;
    const prev = document.getElementById('ca-tot-preview-'+fid);
    if(prev) prev.textContent = `${tot} fiale totali da caricare (${scat} scatole × ${unita})`;
  }
});
document.addEventListener('change',e=>{
  const el=e.target; if(el.dataset&&el.dataset.verify&&S.flow){
    S.flow.verified[el.dataset.verify]=el.checked;
    const sel=farmaci().filter(f=>(S.flow.qty[f.id]||0)>0); const btn=$('#confirmBtn'); if(btn) btn.disabled=!sel.every(f=>S.flow.verified[f.id]);
  }
});
['pointerdown','keydown'].forEach(t=>document.addEventListener(t,()=>{ S.lastActivity=Date.now(); },{passive:true}));
const tipEl=$('#tip');
document.addEventListener('pointermove',e=>{
  const t=e.target.closest&&e.target.closest('[data-tip]');
  if(!t){ if(!tipEl.hidden) tipEl.hidden=true; return; }
  const parts=t.getAttribute('data-tip').split('|');
  tipEl.innerHTML='<b>'+esc(parts[0])+'</b><br>'+parts.slice(1).map(esc).join('<br>'); tipEl.hidden=false;
  const w=tipEl.offsetWidth, h=tipEl.offsetHeight; let x=e.clientX+14, y=e.clientY-h-12;
  if(x+w>window.innerWidth-8) x=e.clientX-w-14; if(y<8) y=e.clientY+16; tipEl.style.left=x+'px'; tipEl.style.top=y+'px';
});
document.addEventListener('pointerleave',()=>{ tipEl.hidden=true; });

const DEL_W=104; const SW={el:null}; let suppressClick=false;
function closeSwipes(except){ document.querySelectorAll('.swipe.open').forEach(x=>{ if(x!==except) x.classList.remove('open'); }); if(!except) S.swipeOpen=null; }
document.addEventListener('pointerdown',e=>{
  const t=e.target; if(!t.closest) return;
  if(S.swipeOpen&&!t.closest('.swipe.open')) closeSwipes(null);
  const row=t.closest('.swipe[data-swipe] > .staff'); if(!row||t.closest('input,textarea,select')) return;
  SW.el=row; SW.w=row.parentElement; SW.x=e.clientX; SW.y=e.clientY; SW.pid=e.pointerId; SW.drag=false; SW.base=SW.w.classList.contains('open')?-DEL_W:0;
});
document.addEventListener('pointermove',e=>{
  if(!SW.el||e.pointerId!==SW.pid) return;
  const dx=e.clientX-SW.x, dy=e.clientY-SW.y;
  if(!SW.drag){
    if(Math.abs(dx)>8&&Math.abs(dx)>Math.abs(dy)*1.2){ SW.drag=true; SW.w.classList.add('drag'); SW.el.style.transition='none'; try{ SW.el.setPointerCapture(e.pointerId); }catch(_){} }
    else { if(Math.abs(dy)>10) SW.el=null; return; }
  }
  SW.el=row;
  SW.el.style.transform='translateX('+Math.max(-DEL_W-28,Math.min(0,SW.base+dx))+'px)';
});
function endSwipe(e){
  if(!SW.el||e.pointerId!==SW.pid) return;
  if(SW.drag){
    const open=(SW.base+e.clientX-SW.x)< -DEL_W/2;
    SW.el.style.transition=''; SW.el.style.transform=''; SW.w.classList.remove('drag');
    closeSwipes(open?SW.w:null); SW.w.classList.toggle('open',open); S.swipeOpen=open?SW.w.dataset.swipe:null;
    suppressClick=true; setTimeout(()=>{ suppressClick=false; },60);
  }
  SW.el=null;
}
document.addEventListener('pointerup',endSwipe);
document.addEventListener('pointercancel',e=>{ if(SW.el&&e.pointerId===SW.pid){ SW.el.style.transition=''; SW.el.style.transform=''; SW.w.classList.remove('drag'); SW.el=null; } });
document.addEventListener('click',e=>{ if(suppressClick){ e.stopPropagation(); e.preventDefault(); suppressClick=false; } },true);
document.addEventListener('focusin',e=>{ const t=e.target; if(t.classList&&t.classList.contains('swipe-del')){ closeSwipes(t.parentElement); t.parentElement.classList.add('open'); S.swipeOpen=t.parentElement.dataset.swipe; } });

let tickN=0;
function tick(){
  tickN++; const now=Date.now();
  if(S.meId&&now-S.lastActivity>(cfg().sessioneMin||5)*60000){ logout('Sessione chiusa per inattività.'); return; }
  if(S.codeShownUntil){
    if(now>=S.codeShownUntil){ S.codeShownUntil=0; S.codeValue=''; changed(); }
    else { const left=Math.ceil((S.codeShownUntil-now)/1000); const t=$('#cd-txt'), b=$('#cd-bar'); if(t) t.textContent='Si nasconde tra '+left+' s'; if(b) b.style.width=Math.max(0,(left-1)/CODE_SECONDS*100)+'%'; }
  }
  if(S.lockUntil&&now>=S.lockUntil){ S.lockUntil=0; S.loginErr=''; changed(); }
  if(tickN%5===0) saveSession();
  if(tickN%30===0&&!S.codeShownUntil) changed();
  if(REMOTE_ON&&S.token&&tickN%15===0&&!S.polling&&document.visibilityState!=='hidden'){
    S.polling=true;
    Api.refresh(now-S.lastActivity<30000).catch(e=>{ if(e&&e.session) logout('Sessione scaduta: accedi di nuovo.'); }).finally(()=>{ S.polling=false; });
  }
}
document.addEventListener('visibilitychange',()=>{ if(REMOTE_ON&&S.token&&document.visibilityState==='visible') Api.refresh(false).catch(e=>{ if(e&&e.session) logout('Sessione scaduta: accedi di nuovo.'); }); });

async function boot(){
  render();
  if(CFG_PRESENT&&!REMOTE_ON){ S.loadError=true; S.loadErrorMsg='Manca il collegamento al database: inserisci indirizzo e chiave di Supabase nel file config.js.'; render(); return; }
  if(REMOTE_ON){
    try{ await loadPublic(); }catch(e){ S.loadError=true; S.loadErrorMsg=errMsg(e); render(); return; }
    S.loaded=true;
    try{ const raw=sessionStorage.getItem(SS_KEY); if(raw){ const s=JSON.parse(raw); if(s&&s.token&&Date.now()-s.last<((S.config&&S.config.sessioneMin)||5)*60000){ S.token=s.token; S.lastActivity=Date.now(); try{ await Api.refresh(true); }catch(e){ S.token=null; clearRemoteData(); saveSession(); } } } }catch(e){}
    render(); setInterval(tick,1000); return;
  }
  await Store.init();
  try{ S.config=await Store.get('app/config'); }catch(e){ S.loadError=true; render(); return; }
  try{ const raw=sessionStorage.getItem(SS_KEY); if(raw){ const s=JSON.parse(raw); if(s&&s.id&&Date.now()-s.last<((S.config&&S.config.sessioneMin)||5)*60000){ S.meId=s.id; S.lastActivity=Date.now(); } } }catch(e){}
  S.loaded=true;
  Store.watchDoc('app/config',(d,meta)=>{ if(!d&&meta&&meta.fromCache) return; S.config=d; changed(); });
  Store.watchDoc('app/state',d=>{ S.base=d; changed(); });
  Store.watchDoc('app/key',d=>{ S.key=d; changed(); });
  Store.watchCol('staff',{},rows=>{ const m={}; rows.forEach(r=>m[r.id]=r); S.staff=m; S.staffLoaded=true; if(S.meId&&!m[S.meId]) S.meId=null; changed(); });
  Store.watchCol('log',{orderBy:'day',dir:'desc',limit:365},docs=>{ const ev=[]; docs.forEach(d=>{ const it=d.items||{}; Object.keys(it).forEach(k=>ev.push(it[k])); }); ev.sort((a,b)=>b.ts-a.ts); S.events=ev; changed(); });
  render();
  setInterval(tick,1000);
}
boot();
})();
