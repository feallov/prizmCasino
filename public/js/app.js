import { $, el, fmt, haptic } from './ui.js';

const tg = window.Telegram?.WebApp;
try{
  tg?.ready(); tg?.expand();
  tg?.setHeaderColor?.('#0b0d10'); tg?.setBackgroundColor?.('#0b0d10');
}catch{}

const state = { user:null, balance:null, online:1 };

const I = {
  home:'<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  trophy:'<svg viewBox="0 0 24 24"><path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/></svg>',
  tasks:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="5"/><path d="m9 12.5 2.5 2.5L16 9.5"/></svg>',
};

const TABS = [
  { id:'lobby', label:'Лобби',   icon:I.home,   render:renderLobby },
  { id:'top',   label:'Топ',     icon:I.trophy, render:soon('Топ игроков') },
  { id:'tasks', label:'Задания', icon:I.tasks,  render:soon('Задания и ачивки'), badge:'NEW' },
];
const SCREENS = Object.fromEntries(TABS.map(t => [t.id, t]));
SCREENS.profile = { render: renderProfile };

let toastT;
function toast(text){
  let t = $('#toast');
  if(!t){ t = el('div','toast'); t.id = 'toast'; document.body.append(t); }
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(()=>t.classList.remove('show'), 1800);
}

function soon(title){
  return () => el('div','panel',`<div style="font-size:34px">🚧</div><b style="color:var(--text)">${title}</b><span>появится скоро</span>`);
}

function gameCard(o){
  const c = el('div',`card shine ${o.cls ?? ''} ${o.grad}`);
  c.innerHTML =
    (o.isNew ? '<span class="badge-new">🔥 NEW</span>' : '') +
    (o.online != null ? `<span class="online-pill"><i></i>${o.online}</span>` : '') +
    `<div class="art">${o.emoji}</div><div class="title">${o.title}</div>` +
    (o.pill ? `<div class="max-pill">${o.pill}</div>` : '');
  c.onclick = () => { haptic(tg); toast(`${o.title} — скоро`); };
  return c;
}

function renderLobby(){
  const wrap = el('div');
  const icons = el('div','row-icons');
  for(const [e,t] of [['🎁','Ежедневка'],['ℹ️','Правила'],['🔔','Новости']]){
    const b = el('button','round',e);
    b.onclick = () => { haptic(tg); toast(`${t} — скоро`); };
    icons.append(b);
  }
  wrap.append(icons);

  wrap.append(gameCard({ cls:'featured', grad:'g-blue', emoji:'🪙', title:'Coinflip', pill:'макс 9 000 💎', online:state.online, isNew:true }));

  const grid = el('div','grid2');
  grid.append(gameCard({ grad:'g-green', emoji:'🎡', title:'Wheel', pill:'макс 10 000 💎', online:state.online }));
  grid.append(gameCard({ grad:'g-space stars', emoji:'💣', title:'Mines', pill:'макс 10 000 💎', online:state.online }));
  grid.append(gameCard({ grad:'g-gold', emoji:'🎁', title:'Дейлик', pill:'бонус 🎁' }));
  grid.append(gameCard({ grad:'g-gray', emoji:'🏆', title:'Ивент', pill:'скоро', isNew:true }));
  wrap.append(grid);
  return wrap;
}

function renderProfile(){
  const u = state.user, wrap = el('div');
  const head = el('div','panel profile-head');
  const ava = u?.photo_url ? Object.assign(el('img','avatar'),{src:u.photo_url}) : el('div','avatar stub','👤');
  head.append(ava, el('div','',`<b style="color:var(--text)">${u?.first_name ?? 'Гость'}</b><br><span>@${u?.username ?? 'unknown'}</span>`));
  const stats = el('div','panel',`<span>Баланс</span><b style="font-size:26px;color:var(--violet-2)">${state.balance!=null?fmt(state.balance)+' 💎':'—'}</b>`);
  stats.style.marginTop = '12px';
  wrap.append(head, stats);
  return wrap;
}

function buildChrome(){
  const bar = $('#tabbar');
  for(const t of TABS){
    const b = el('button','tab',`${t.icon}<span>${t.label}</span>`);
    if(t.badge) b.append(el('i','tab-badge',t.badge));
    b.dataset.id = t.id;
    b.onclick = () => { haptic(tg); show(t.id); };
    bar.append(b);
  }
  const ava = el('button','tab-avatar');
  if(state.user?.photo_url) ava.innerHTML = `<img src="${state.user.photo_url}" alt="">`;
  else ava.textContent = '👤';
  ava.onclick = () => { haptic(tg); show('profile'); };
  bar.append(ava);
  bar.classList.remove('hidden');
  $('#topbar').classList.remove('hidden');
  syncTop();
}

function syncTop(){
  $('#balance').textContent = state.balance != null ? `${fmt(state.balance)} 💎` : '— 💎';
  $('#online').textContent = state.online;
}

function show(id){
  const s = SCREENS[id];
  const root = $('#screens');
  root.replaceChildren(el('div','screen'));
  root.firstChild.append(s.render());
  for(const b of $('#tabbar').querySelectorAll('.tab')) b.classList.toggle('active', b.dataset.id === id);
}

async function boot(){
  const u = tg?.initDataUnsafe?.user;
  if(u) state.user = { id:u.id, username:u.username, first_name:u.first_name, photo_url:u.photo_url };
  try{
    const r = await fetch('/api/me',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:tg?.initData ?? ''})});
    if(r.ok){ const d = await r.json(); state.user = d.user; state.balance = d.user.balance; state.online = d.online ?? state.online; }
  }catch{}
  buildChrome();
  show('lobby');
  setTimeout(()=>$('#splash').classList.add('off'), 900);
}
boot();
