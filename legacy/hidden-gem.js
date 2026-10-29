/* Hidden Gem — app logic. Runs in a page containing the markup/CSS from hidden-gem.html;
   uses the claude.ai artifact runtime (db + user capabilities) for shared data. */
const $=s=>document.querySelector(s), esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const LS=(k,v)=>{try{if(v===undefined)return JSON.parse(localStorage.getItem(k));localStorage.setItem(k,JSON.stringify(v))}catch(e){return null}};
let db,uid,me=null,users={},friends={},places=[],msgs={},openChat=null,tab='map',sel=null,pick=null,mode=null,meLoc=LS('loc')||{lat:-1.286,lng:36.817};
let view=LS('view')||{lat:meLoc.lat,lng:meLoc.lng,z:4000};
let queue=LS('q')||[];
let connectionState = navigator.onLine ? 'online' : 'offline';
let lastSyncAt = Date.now();
const now=()=>Date.now(), pid=(a,b)=>[a,b].sort().join('_'), rid=()=>Math.random().toString(36).slice(2,10);
const ago=t=>{if(!t)return'never';const s=(now()-t)/1e3;return s<60?'just now':s<3600?Math.floor(s/60)+'m ago':s<86400?Math.floor(s/3600)+'h ago':Math.floor(s/86400)+'d ago'};
const online=u=>u&&u.pref!=='offline'&&now()-(u.seen||0)<90e3;
const name=id=>users[id]?.username||'someone';

function applyConnectionState(nextState){
  connectionState = nextState || (navigator.onLine ? 'online' : 'offline');
  const on = connectionState === 'online';
  const banner = $('#banner');
  if (banner) banner.style.display = on ? 'none' : 'block';
  const statusBtn = document.querySelector('nav button[data-t="offline"]');
  if (statusBtn) statusBtn.textContent = on ? '📶 Status' : '🔴 Offline';
  if (!on && tab !== 'offline' && tab !== 'me') {
    go('offline');
  }
  if (on && tab === 'offline') {
    go('map');
  }
  renderStatusCard();
}

function renderStatusCard(){
  const queueCount = $('#offline-queue-count');
  const lastSync = $('#offline-last-sync');
  if (queueCount) queueCount.textContent = String(queue.length);
  if (lastSync) lastSync.textContent = ago(lastSyncAt);
  const statusBtn = document.querySelector('nav button[data-t="offline"]');
  if (statusBtn) statusBtn.textContent = connectionState === 'online' ? '📶 Status' : '🔴 Offline';
}

/* ---------- offline queue ---------- */
async function put(path,data){ // write, or queue when offline
  const item={path,data};
  if(!navigator.onLine||!db){queue.push(item);LS('q',queue);return false}
  try{await db.doc(path).set(data);return true}catch(e){queue.push(item);LS('q',queue);return false}
}
async function flush(){
  if(!db||!navigator.onLine||!queue.length)return;
  const q=queue;queue=[];
  for(const it of q){
    try{await db.doc(it.path).set(it.data);lastSyncAt=Date.now();}
    catch(e){queue.push(it)}
  }
  LS('q',queue);render();
  if (queue.length === 0) {
    lastSyncAt = Date.now();
    renderStatusCard();
  }
}
function net(){
  const next = navigator.onLine ? 'online' : 'offline';
  applyConnectionState(next);
  flush();
}
addEventListener('online',net);addEventListener('offline',net);setInterval(flush,15000);

/* ---------- boot ---------- */
(async()=>{
  net();
  try{const c=window.claude;const user=await c.use('user');db=await c.use('db');uid=await user.id()}catch(e){}
  if(!db||!uid){document.body.innerHTML='<p style="padding:24px">Hidden Gem needs a signed-in claude.ai viewer with shared storage enabled.</p>';return}
  db.collection('users').onSnapshot(s=>{users={};s.docs.forEach(d=>users[d.id]=d.data());me=users[uid]||null;if(!me)gate();else $('#gate').style.display='none';render()});
  db.collection('friends').onSnapshot(s=>{friends={};s.docs.forEach(d=>friends[d.id]=d.data());render()});
  db.collection('places').onSnapshot(s=>{places=s.docs.map(d=>({id:d.id,...d.data()}));render()});
  const recv=db.collection('messages').where('to','==',uid), sent=db.collection('messages').where('from','==',uid);
  const m1={},m2={};const merge=()=>{msgs={...m1,...m2};render()};
  recv.onSnapshot(s=>{s.docs.forEach(d=>m1[d.id]=d.data());merge()});
  sent.onSnapshot(s=>{s.docs.forEach(d=>m2[d.id]=d.data());merge()});
  startLoc();setInterval(heartbeat,30000);
})();

function gate(){
  const g=$('#gate');g.style.display='flex';
  g.innerHTML=`<h2>Welcome to Hidden Gem 💎</h2><p class="mu">Pick a unique username. Location sharing starts OFF.</p><input id="un" placeholder="username" maxlength="20"><div id="ue" class="mu"></div><button class="p" id="go">Create profile</button><p class="mu">By continuing you accept the terms and privacy notice: your profile is visible to other users of this app.</p>`;
  $('#go').onclick=async()=>{
    const u=$('#un').value.trim().toLowerCase().replace(/[^a-z0-9_]/g,'');
    if(u.length<3)return $('#ue').textContent='At least 3 letters/numbers.';
    if(Object.entries(users).some(([i,x])=>x.username===u&&i!==uid))return $('#ue').textContent='Username taken.';
    await db.doc('users/'+uid).set({username:u,bio:'',share:'off',approx:false,pref:'online',seen:now(),created:now()});
  };
}

/* ---------- location / presence ---------- */
function startLoc(){
  if(!navigator.geolocation)return;
  navigator.geolocation.watchPosition(p=>{meLoc={lat:p.coords.latitude,lng:p.coords.longitude};LS('loc',meLoc);if(!LS('centered')){view.lat=meLoc.lat;view.lng=meLoc.lng;LS('centered',1)}},()=>{},{enableHighAccuracy:true,maximumAge:15000});
}
async function heartbeat(){
  if(!me)return;const d={...me,seen:now()};
  if(me.share!=='off'){d.lat=meLoc.lat;d.lng=meLoc.lng;d.locTs=now()}
  await put('users/'+uid,d);
}
function save(patch){return put('users/'+uid,{...me,...patch})}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)heartbeat()});

/* ---------- relations ---------- */
function rel(o){return friends[pid(uid,o)];}
function isFriend(o){return rel(o)?.status==='accepted';}
function canSeePlace(p){return p.type==='gem'||p.owner===uid||(isFriend(p.owner)&&(p.with==='all'||(p.with||[]).includes?.(uid)));}
const approx=(v)=>Math.round(v*100)/100;
function friendPos(id){const u=users[id];if(!u||u.lat==null||u.share==='off')return null;if(u.share==='friends'&&!isFriend(id))return null;if(rel(id)?.blocked)return null;return{lat:u.approx?approx(u.lat):u.lat,lng:u.approx?approx(u.lng):u.lng,area:u.approx}}

/* ---------- map ---------- */
var svg=$('#map');
var NS='http://www.w3.org/2000/svg';
const proj=(lat,lng)=>{const r=svg.getBoundingClientRect();return[r.width/2+(lng-view.lng)*view.z*Math.cos(view.lat*Math.PI/180),r.height/2-(lat-view.lat)*view.z]};
const unproj=(x,y)=>{const r=svg.getBoundingClientRect();return{lat:view.lat-(y-r.height/2)/view.z,lng:view.lng+(x-r.width/2)/(view.z*Math.cos(view.lat*Math.PI/180))}};
const dist=(a,b)=>{const R=6371,t=Math.PI/180,x=(b.lng-a.lng)*t*Math.cos((a.lat+b.lat)*t/2),y=(b.lat-a.lat)*t;return R*Math.hypot(x,y)};
const km=d=>d<1?Math.round(d*1000)+' m':d.toFixed(1)+' km';
const GEM_EMOJIS=['💎','✨','🌟','🔮','💠','🪩','🌙','🔥','⚡','💍','🦄','🎁','💖','🌈','🧿'];
const SPOT_EMOJIS=['📍','📌','🧭','🎯','🏕️','🌊','🍽️','🌄','🎧','🧿','🌿','🛶','🥾','☕','🌅','🍸','🎶','🧺'];
const GEM_VIBE_ICONS=['💎','✨','🔮','🌙','🔥','⚡','💍','🌈'];
const SPOT_VIBE_ICONS=['📍','📌','🏕️','🌊','🍽️','🌄','🎧','🌿'];
const defaultIcon=(type, icon)=> icon || (type==='gem' ? '💎' : '📍');
const placeIcon=p=>defaultIcon(p?.type, p?.icon);
var ICON={gem:'💎',spot:'📍'};
function drawMap(){
  const r=svg.getBoundingClientRect();if(!r.width)return;
  let h='';const step=Math.pow(10,Math.ceil(Math.log10(90/view.z)));
  const tl=unproj(0,0),br=unproj(r.width,r.height);
  for(let lng=Math.floor(tl.lng/step)*step;lng<br.lng;lng+=step){const x=proj(0,lng)[0];h+=`<line x1="${x}" x2="${x}" y1="0" y2="${r.height}" stroke="var(--grid)"/>`}
  for(let lat=Math.floor(br.lat/step)*step;lat<tl.lat;lat+=step){const y=proj(lat,0)[1];h+=`<line y1="${y}" y2="${y}" x1="0" x2="${r.width}" stroke="var(--grid)"/>`}
  h+=`<text x="8" y="${r.height-8}" fill="var(--mu)" font-size="11">grid ${km(step*111)}</text>`;
  const pts=[];
  places.filter(canSeePlace).forEach(p=>pts.push({k:'p',id:p.id,lat:p.lat,lng:p.lng,ic:placeIcon(p)}));
  Object.keys(users).filter(i=>i!==uid).forEach(i=>{const p=friendPos(i);if(p)pts.push({k:'u',id:i,...p,ic:'🧑',on:online(users[i])})});
  // clustering on a 44px grid
  const cl={};pts.forEach(p=>{const[x,y]=proj(p.lat,p.lng);p.x=x;p.y=y;const key=Math.round(x/44)+','+Math.round(y/44);(cl[key]=cl[key]||[]).push(p)});
  Object.values(cl).forEach(g=>{
    if(g.length>1){const x=g.reduce((a,p)=>a+p.x,0)/g.length,y=g.reduce((a,p)=>a+p.y,0)/g.length;h+=`<g data-c="${x},${y}"><circle cx="${x}" cy="${y}" r="18" fill="var(--ac)"/><text x="${x}" y="${y+5}" text-anchor="middle" fill="#fff" font-weight="700">${g.length}</text></g>`}
    else{const p=g[0];h+=`<g data-k="${p.k}" data-id="${p.id}" style="cursor:pointer">${p.area?`<circle cx="${p.x}" cy="${p.y}" r="26" fill="var(--ac)" opacity=".18"/>`:''}<text x="${p.x}" y="${p.y+8}" text-anchor="middle" font-size="24" opacity="${p.k==='u'&&!p.on?.55:1}">${p.ic}</text>${p.k==='u'?`<text x="${p.x}" y="${p.y+24}" text-anchor="middle" font-size="11" fill="var(--tx)">${esc(name(p.id))}</text>`:''}</g>`}
  });
  const[mx,my]=proj(meLoc.lat,meLoc.lng);h+=`<circle cx="${mx}" cy="${my}" r="9" fill="#2a7de1" stroke="#fff" stroke-width="3"/>`;
  if(pick){const[px,py]=proj(pick.lat,pick.lng);h+=`<text x="${px}" y="${py}" text-anchor="middle" font-size="28">${defaultIcon(mode,pickIcon)}</text>`}
  svg.innerHTML=h;
}
let drag=null,moved=0;
let pickIcon='💎';
svg.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY};moved=0;svg.setPointerCapture(e.pointerId)};
svg.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;moved+=Math.abs(dx)+Math.abs(dy);const k=view.z*Math.cos(view.lat*Math.PI/180);view.lng-=dx/k;view.lat+=dy/view.z;drag={x:e.clientX,y:e.clientY};drawMap()};
svg.onpointerup=e=>{drag=null;LS('view',view);if(moved>6)return;
  const g=e.target.closest('g[data-id]');
  if(mode&&!g){const r=svg.getBoundingClientRect();pick=unproj(e.clientX-r.left,e.clientY-r.top);composer();drawMap();return}
  if(g){sel={k:g.dataset.k,id:g.dataset.id};sheet()}
  else{const c=e.target.closest('g[data-c]');if(c){view.z*=2;const[x,y]=c.dataset.c.split(',').map(Number);const p=unproj(x,y);view.lat=p.lat;view.lng=p.lng;drawMap()}else{sel=null;sheet()}}};
svg.onwheel=e=>{e.preventDefault();zoom(e.deltaY<0?1.2:1/1.2)};
const zoom=f=>{view.z=Math.min(4e6,Math.max(30,view.z*f));LS('view',view);drawMap()};
$('#zi').onclick=()=>zoom(1.6);$('#zo').onclick=()=>zoom(1/1.6);
$('#loc').onclick=()=>{view.lat=meLoc.lat;view.lng=meLoc.lng;drawMap()};
$('#th').onclick=()=>{const r=document.documentElement;r.dataset.theme=(r.dataset.theme||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'))==='dark'?'light':'dark'};
$('#addG').onclick=()=>startPick('gem');$('#addS').onclick=()=>startPick('spot');
function startPick(m){mode=m;pick=null;pickIcon=(m==='gem'?GEM_EMOJIS[0]:SPOT_EMOJIS[0]);$('#sheet').style.display='block';$('#sheet').innerHTML=`<b>Tap the map to place your ${m==='gem'?'public Gem':'private Spot'}</b> <button class="s" onclick="cancelPick()">Cancel</button>`}
window.cancelPick=()=>{mode=null;pick=null;pickIcon='💎';$('#sheet').style.display='none';drawMap();};
function composer(){
  const iconChoices=(mode==='gem'?GEM_EMOJIS:SPOT_EMOJIS);
  const vibeButtons=(mode==='gem'?GEM_VIBE_ICONS:SPOT_VIBE_ICONS).map(e=>`<button type="button" class="mini-icon" data-icon="${e}" style="font-size:22px;border:1px solid var(--bd);background:${pickIcon===e?'var(--ac2)':'var(--card)'};border-radius:10px;padding:8px 10px;cursor:pointer;${pickIcon===e?'box-shadow:0 0 0 2px rgba(15,143,107,.2);':''}">${e}</button>`).join('');
  $('#sheet').innerHTML=`<b>New ${mode==='gem'?'💎 public Gem':'📍 private Spot'}</b><input id="pt" placeholder="Title"><textarea id="pd" rows="2" placeholder="Description"></textarea>
  <select id="pc">${['Food','Nature','Views','Culture','Nightlife','Shopping','Other'].map(c=>`<option>${c}</option>`)}</select>
  <label class="mu">Quick vibe</label><div class="row" style="display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 8px">${vibeButtons}</div>
  <label class="mu">Marker</label><select id="pe">${iconChoices.map(e=>`<option value="${e}" ${pickIcon===e?'selected':''}>${e} ${e}</option>`).join('')}</select>
  ${mode==='gem'?`<label class="mu">Expires (optional)</label><input id="px" type="date">`:`<label class="mu">Share with</label><select id="pw"><option value="all">All friends</option>${Object.keys(users).filter(isFriend).map(i=>`<option value="${i}">${esc(name(i))} only</option>`).join('')}</select>`}
  <div class="row"><button class="p" id="ps">Save</button><button class="s" onclick="cancelPick()">Cancel</button></div>`;
  $('#pe').onchange=e=>{pickIcon=e.target.value;};
  $('#sheet').querySelectorAll('[data-icon]').forEach(btn=>btn.onclick=()=>{pickIcon=btn.dataset.icon;$('#pe').value=pickIcon;document.querySelectorAll('.mini-icon').forEach(b=>b.style.background=b===btn?'var(--ac2)':'var(--card)');});
  $('#ps').onclick=async()=>{const t=$('#pt').value.trim();if(!t)return;
    const w=mode==='spot'?$('#pw').value:null;
    const d={type:mode,title:t,desc:$('#pd').value,cat:$('#pc').value,icon:pickIcon || defaultIcon(mode),lat:pick.lat,lng:pick.lng,owner:uid,ts:now(),with:w==='all'?'all':w?[w]:null,exp:mode==='gem'&&$('#px').value?new Date($('#px').value).getTime():null,saves:[]};
    const id='p'+rid();places.push({id,...d});cancelPick();put('places/'+id,d)};
}
function sheet(){
  const s=$('#sheet');if(!sel){s.style.display='none';return}s.style.display='block';
  if(sel.k==='u'){const u=users[sel.id],p=friendPos(sel.id);if(!u||!p){s.style.display='none';return}
    s.innerHTML=`<div class="row"><div class="g"><b>${esc(u.username)}</b><br><span class="mu"><span class="dot ${online(u)?'on':''}"></span>${online(u)?'online':'last seen '+ago(u.seen)} · ${km(dist(meLoc,p))} away${p.area?' · approx area':''}<br>location updated ${ago(u.locTs)}</span></div><button class="p" onclick="chatWith('${sel.id}')">Message</button></div>`}
  else{const p=places.find(x=>x.id===sel.id);if(!p){s.style.display='none';return}const saved=(p.saves||[]).includes(uid);
    s.innerHTML=`<b>${placeIcon(p)} ${esc(p.title)}</b> <span class="mu">· ${esc(p.cat)}</span><p>${esc(p.desc)}</p><div class="mu">by ${esc(name(p.owner))} · ${ago(p.ts)} · ${km(dist(meLoc,p))}${p.exp?' · expires '+new Date(p.exp).toLocaleDateString():''}</div>
    <div class="row" style="margin-top:8px">${p.type==='gem'?`<button class="s" onclick="saveGem('${p.id}')">${saved?'★ Saved':'☆ Save'}</button>`:''}${p.owner===uid?`<button class="s" onclick="delPlace('${p.id}')">Delete</button>`:`<button class="s" onclick="report('place','${p.id}')">Report</button>`}</div>`}
}
window.saveGem=async id=>{const p=places.find(x=>x.id===id),s=new Set(p.saves||[]);s.has(uid)?s.delete(uid):s.add(uid);p.saves=[...s];const{id:_,...d}=p;await put('places/'+id,d);sheet()};
window.delPlace=async id=>{places=places.filter(p=>p.id!==id);sel=null;try{await db.doc('places/'+id).delete()}catch(e){}render()};
window.report=async(k,id)=>{await put('reports/'+rid(),{kind:k,target:id,by:uid,ts:now()});alert('Reported. Thank you.')};

/* ---------- friends ---------- */
function drawFriends(){
  const el=$('#t-fr'),all=Object.keys(users).filter(i=>i!==uid);
  const inc=all.filter(i=>{const r=rel(i);return r?.status==='pending'&&r.from===i}),out=all.filter(i=>{const r=rel(i);return r?.status==='pending'&&r.from===uid}),fr=all.filter(isFriend);
  el.innerHTML=`<h2>Find people</h2><div class="row"><input class="g" id="sq" placeholder="Search username" value="${esc(el.dataset.q||'')}"></div><div id="sr"></div>
  ${inc.length?`<h2>Requests</h2>`+inc.map(i=>`<div class="card row"><span class="g">${esc(name(i))}</span><button class="p" onclick="fr('acc','${i}')">Accept</button><button class="s" onclick="fr('del','${i}')">Decline</button></div>`).join(''):''}
  ${out.length?`<h2>Sent</h2>`+out.map(i=>`<div class="card row"><span class="g">${esc(name(i))}</span><button class="s" onclick="fr('del','${i}')">Cancel</button></div>`).join(''):''}
  <h2>Friends (${fr.length})</h2>${fr.length?fr.map(i=>`<div class="card row"><span class="g"><span class="dot ${online(users[i])?'on':''}"></span><b>${esc(name(i))}</b><br><span class="mu">${online(users[i])?'online':'last active '+ago(users[i].seen)}</span></span><button class="s" onclick="chatWith('${i}')">💬</button><button class="s" onclick="fr('del','${i}')">Remove</button><button class="s" onclick="fr('blk','${i}')">Block</button></div>`).join(''):'<p class="mu">No friends yet — search a username above.</p>'}`;
  const q=$('#sq');q.oninput=()=>{el.dataset.q=q.value;search(q.value)};if(q.value)search(q.value);
}
function search(q){q=q.trim().toLowerCase();const r=$('#sr');if(!q){r.innerHTML='';return}
  r.innerHTML=Object.keys(users).filter(i=>i!==uid&&users[i].username.includes(q)&&!rel(i)?.blocked).slice(0,8).map(i=>{const st=rel(i)?.status;return`<div class="card row"><span class="g">${esc(name(i))}<br><span class="mu">${esc(users[i].bio||'')}</span></span>${st==='accepted'?'<span class="mu">Friends</span>':st==='pending'?'<span class="mu">Pending</span>':`<button class="p" onclick="fr('add','${i}')">Add</button>`}</div>`}).join('')||'<p class="mu">No match.</p>'}
window.fr=async(a,o)=>{const id=pid(uid,o),r=friends[id];
  if(a==='add')await put('friends/'+id,{a:uid,b:o,from:uid,status:'pending',ts:now()});
  if(a==='acc')await put('friends/'+id,{...r,status:'accepted'});
  if(a==='del'){delete friends[id];try{await db.doc('friends/'+id).delete()}catch(e){}render()}
  if(a==='blk'){await put('friends/'+id,{a:uid,b:o,from:uid,status:'blocked',blocked:true,ts:now()})}};

/* ---------- chat ---------- */
function chatMsgs(o){return Object.entries(msgs).filter(([,m])=>m.chat===pid(uid,o)).sort((a,b)=>a[1].ts-b[1].ts);}
function unread(o){return chatMsgs(o).filter(([,m])=>m.to===uid&&!m.read).length;}
window.chatWith=o=>{openChat=o;go('ch')};
function drawChat(){
  const el=$('#t-ch');
  if(!openChat){const fr=Object.keys(users).filter(isFriend);
    el.innerHTML=`<h2>Chats</h2>`+(fr.length?fr.map(i=>{const l=chatMsgs(i).slice(-1)[0];return`<div class="card row" style="cursor:pointer" onclick="chatWith('${i}')"><span class="g"><b>${esc(name(i))}</b><br><span class="mu">${l?esc(l[1].text.slice(0,50)):'Say hi 👋'}</span></span>${unread(i)?`<span class="b" style="position:static">${unread(i)}</span>`:''}</div>`}).join(''):'<p class="mu">Add friends to start chatting.</p>');return}
  const o=openChat;if(!isFriend(o)){openChat=null;return drawChat()}
  const keep=$('#ci')?.value||'';
  el.innerHTML=`<div class="row"><button class="s" onclick="openChat=null;render()">←</button><b class="g">${esc(name(o))}</b><span class="mu">${online(users[o])?'online':'last seen '+ago(users[o]?.seen)}</span></div>
  <div class="msgs" id="ml">${chatMsgs(o).map(([id,m])=>`<div class="m ${m.from===uid?'me':''}">${esc(m.text)}<small>${new Date(m.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}${m.from===uid?(m.pending?' ⏳ unsynced':m.read?' ✓✓':' ✓'):''}</small></div>`).join('')}</div>
  <div class="row"><input class="g" id="ci" placeholder="Message" value="${esc(keep)}"><button class="p" id="cs">Send</button></div>`;
  $('#ml').scrollTop=1e9;const send=async()=>{const t=$('#ci').value.trim();if(!t)return;$('#ci').value='';const id='m'+now()+rid(),d={chat:pid(uid,o),from:uid,to:o,text:t,ts:now(),read:false};msgs[id]={...d,pending:!navigator.onLine};drawChat();const ok=await put('messages/'+id,d);if(ok)delete msgs[id].pending;drawChat()};
  $('#cs').onclick=send;$('#ci').onkeydown=e=>{if(e.key==='Enter')send()};
  chatMsgs(o).forEach(async([id,m])=>{if(m.to===uid&&!m.read){m.read=true;put('messages/'+id,{...m,read:true})}});
}

/* ---------- profile ---------- */
function drawMe(){
  if(!me)return;const el=$('#t-me');if(el.contains(document.activeElement)&&document.activeElement.tagName!=='BODY')return;
  el.innerHTML=`<h2>@${esc(me.username)}</h2><p class="mu">${Object.keys(users).filter(isFriend).length} friends · seen ${ago(me.seen)}</p>
  <label class="mu">Bio</label><textarea id="bio" rows="2" maxlength="140">${esc(me.bio)}</textarea><button class="s" onclick="save({bio:$('#bio').value})">Save bio</button>
  <div class="card"><b>Live location</b><select id="sh"><option value="off">Off (default)</option><option value="friends">Friends only</option><option value="public">Public</option></select>
  <label class="row mu"><input type="checkbox" id="ap" style="width:auto" ${me.approx?'checked':''}> Show approximate area only</label>
  <label class="row mu"><input type="checkbox" id="of" style="width:auto" ${me.pref==='offline'?'checked':''}> Appear offline</label>
  <button class="s" onclick="save({share:'off'})">⏸ Pause sharing</button> <button class="s" onclick="clearLoc()">Clear location history</button>
  <p class="mu">Last update: ${ago(me.locTs)}</p></div>
  <div class="card mu">Sync queue: ${queue.length} pending · ${navigator.onLine?'online':'offline'}</div>
  <button class="s" onclick="delAcct()">Delete my account</button>`;
  $('#sh').value=me.share;
  $('#sh').onchange=e=>{const v=e.target.value;if(v!=='off'&&!confirm(`Share your live location with ${v==='public'?'EVERYONE':'your friends'}? You can pause any time.`)){e.target.value=me.share;return}save(v==='off'?{share:'off'}:{share:v,lat:meLoc.lat,lng:meLoc.lng,locTs:now()})};
  $('#ap').onchange=e=>save({approx:e.target.checked});$('#of').onchange=e=>save({pref:e.target.checked?'offline':'online'});
}
window.clearLoc=async()=>{const{lat,lng,locTs,...d}=me;await db.doc('users/'+uid).set({...d,share:'off'});LS('loc',null)};
window.delAcct=async()=>{if(!confirm('Delete your account and your places?'))return;for(const p of places.filter(p=>p.owner===uid))await db.doc('places/'+p.id).delete();await db.doc('users/'+uid).delete()};

/* ---------- shell ---------- */
function go(t){tab=t;document.querySelectorAll('.tab').forEach(e=>e.classList.toggle('on',e.id==='t-'+t));document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));render()}
document.querySelectorAll('nav button').forEach(b=>b.onclick=()=>{if(b.dataset.t==='ch')openChat=null;go(b.dataset.t)});
function render(){
  if(!me)return;
  const nf=Object.keys(users).filter(i=>{const r=rel(i);return r?.status==='pending'&&r.from===i}).length;
  const nu=Object.values(msgs).filter(m=>m.to===uid&&!m.read).length;
  $('#bf').hidden=!nf;$('#bf').textContent=nf;$('#bc').hidden=!nu;$('#bc').textContent=nu;
  renderStatusCard();
  if(tab==='map'){drawMap();if(sel)sheet()}
  if(tab==='offline'){
    const qcount = $('#offline-queue-count');
    const last = $('#offline-last-sync');
    if(qcount) qcount.textContent = String(queue.length);
    if(last) last.textContent = ago(lastSyncAt);
  }
  if(tab==='fr'&&document.activeElement.id!=='sq')drawFriends();
  if(tab==='ch'&&document.activeElement.id!=='ci')drawChat();
  if(tab==='me')drawMe();
}
addEventListener('resize',drawMap);
