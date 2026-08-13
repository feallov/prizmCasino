import { $, el, fmt, haptic } from './ui.js';

const tg = window.Telegram?.WebApp;
try{
  tg?.ready(); tg?.expand();
  tg?.setHeaderColor?.('#0a0c12'); tg?.setBackgroundColor?.('#0a0c12');
}catch{}

const state = { user:null, balance:null };

const I = {
  home:'<svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  trophy:'<svg viewBox="0 0 24 24"><path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0Z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4"/></svg>',
  tasks:'<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="5"/><path d="m9 12.5 2.5 2.5L16 9.5"/></svg>',
  user:'<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.6-4 5-6 8-6s6.4 2 8 6"/></svg>',
};

const TABS = [
  { id:'lobby',   label:'Лобби',   icon:I.home,   render:renderLobby },
  { id:'top',     label:'Топ',     icon:I.trophy, render:soon('Топ игроков') },
  { id:'tasks',   label:'Задания', icon:I.tasks,  render:soon('Задания и ачивки') },
  { id:'profile', label:'Профиль', icon:I.user,   render:renderProfile },
];

function soon(title){
  return () => el('div','glass panel',
    `<div style="font-size:34px">🚧</div><b style="color:var(--text)">${title}</b><span>появится в следующих коммитах</span>`);
}

function renderLobby(){
  const wrap = el('div');
  wrap.append(el('h1','hello',`Привет, <span>${state.user?.first_name ?? 'игрок'}</span> 👋`));
  const grid = el('div','grid-games');
  for (const [e,n] of [['🪙','Coinflip'],['🎡','Wheel'],['💣','Mines']])
    grid.append(el('div','game-card glass shine',`<div class="emoji">${e}</div><div class="name">${n}</div><div class="soon">СКОРО</div>`));
  grid.append(el('div','game-card wide glass shine',`<div class="emoji">🎁</div><div class="name">Ежедневный бонус</div><div class="soon">СКОРО</div>`));
  wrap.append(grid);
  return wrap;
}

function renderProfile(){
  const u = state.user, wrap = el('div');
  const head = el('div','glass profile-head');
  const ava = u?.photo_url ? Object.assign(el('img','avatar'),{src:u.photo_url}) : el('div','avatar stub','👤');
  head.append(ava, el('div','',`<b>${u?.first_name ?? 'Гость'}</b><br><span style="color:var(--muted)">@${u?.username ?? 'unknown'}</span>`));
  const stats = el('div','glass panel',`<b style="color:var(--text)">Баланс</b><span style="font-size:26px;color:var(--violet-2)">${state.balance!=null?fmt(state.balance)+' 💎':'—'}</span><span>сервер подключим в следующем коммите</span>`);
  stats.style.marginTop = '12px';
  wrap.append(head, stats);
  return wrap;
}

function buildChrome(){
  const bar = $('#tabbar');
  for (const t of TABS){
    const b = el('button','',`${t.icon}<span>${t.label}</span>`);
    b.dataset.id = t.id;
    b.onclick = () => { haptic(tg); show(t.id); };
    bar.append(b);
  }
  bar.classList.remove('hidden');
  $('#topbar').classList.remove('hidden');
  $('#balance').textContent = state.balance != null ? `${fmt(state.balance)} 💎` : '— 💎';
}

function show(id){
  const t = TABS.find(x => x.id === id);
  const root = $('#screens');
  root.replaceChildren(el('div','screen'));
  root.firstChild.append(t.render());
  for (const b of $('#tabbar').children) b.classList.toggle('active', b.dataset.id === id);
}

async function boot(){
  const u = tg?.initDataUnsafe?.user;
  if (u) state.user = { id:u.id, username:u.username, first_name:u.first_name, photo_url:u.photo_url };
  try{
    const r = await fetch('/api/me',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:tg?.initData ?? ''})});
    if (r.ok){ const d = await r.json(); state.user = d.user; state.balance = d.user.balance; }
  }catch{}
  buildChrome();
  show('lobby');
  setTimeout(()=>$('#splash').classList.add('off'), 900);
}
boot();
