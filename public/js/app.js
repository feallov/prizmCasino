import { $, el, fmt, haptic } from './ui.js';
import { renderCoinflip } from './games/coinflip.js';
import { renderWheel } from './games/wheel.js';
import { renderMines } from './games/mines.js';
import { renderCrash } from './games/crash.js';
import { renderLadder } from './games/ladder.js';
import { renderDice } from './games/dice.js';

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

function soon(title){
  return () => el('div','panel',`<div style="font-size:34px"></div><b style="color:var(--text)">${title}</b><span>появится скоро</span>`);
}

const TABS = [
  { id:'lobby', label:'Лобби',   icon:I.home,   render:renderLobby },
  { id:'top',   label:'Топ',     icon:I.trophy, render:soon('Топ игроков') },
  { id:'tasks', label:'Задания', icon:I.tasks,  render:soon('Задания и ачивки'), badge:'NEW' },
];
const SCREENS = Object.fromEntries(TABS.map(t => [t.id, t]));
SCREENS.profile = { render: renderProfile };
SCREENS.coinflip = { render: renderCoinflip };
SCREENS.wheel = { render: renderWheel };
SCREENS.mines = { render: renderMines };
SCREENS.crash = { render: renderCrash };
SCREENS.ladder = { render: renderLadder };
SCREENS.dice = { render: renderDice };

const GAMES = [
  { t:'Coinflip',  e:'🪙', max:'макс 9 000 💎',  g:'linear-gradient(160deg,#8ecdf8,#4aa8ef 55%,#2f7fd6)', featured:true, isNew:true, screen:'coinflip' },
  { t:'Wheel',     e:'🎡', max:'макс 10 000 💎', g:'linear-gradient(160deg,#86efac,#22c55e 50%,#0d9488)', screen:'wheel' },
  { t:'Mines',     e:'💣', max:'макс 10 000 💎', g:'linear-gradient(160deg,#4c3a9e,#241b52 60%,#141034)', stars:true, screen:'mines' },
  { t:'Crash',     e:'🚀', max:'макс 50 000 💎', g:'linear-gradient(160deg,#f87171,#ef4444 55%,#b91c1c)', isNew:true, screen:'crash' },
  { t:'Ladder',    e:'🪜', max:'макс 9 000 💎',  g:'linear-gradient(160deg,#c4b5fd,#8b5cf6 55%,#6d28d9)', screen:'ladder' },
  { t:'Dice',      e:'🎲', max:'макс 5 000 💎',  g:'linear-gradient(160deg,#cbd5e1,#64748b 60%,#334155)', screen:'dice' },
  { t:'Slots',     e:'🎰', max:'макс 25 000 💎', g:'linear-gradient(160deg,#fcd34d,#f59e0b 55%,#d97706)' },
  { t:'Roulette',  e:'🎯', max:'макс 10 000 💎', g:'linear-gradient(160deg,#4b5563,#1f2937 60%,#111827)' },
  { t:'Blackjack', e:'🃏', max:'макс 15 000 💎', g:'linear-gradient(160deg,#34d399,#059669 55%,#065f46)' },
  { t:'Cases',     e:'📦', max:'макс 20 000 💎', g:'linear-gradient(160deg,#fdba74,#f97316 55%,#c2410c)' },
  { t:'RPS',       e:'✌️', max:'макс 3 000 💎',  g:'linear-gradient(160deg,#5eead4,#14b8a6 55%,#0f766e)' },
  { t:'Plinko',    e:'⚪', max:'макс 12 000 💎', g:'linear-gradient(160deg,#f9a8d4,#ec4899 55%,#be185d)', isNew:true },
  { t:'Hi-Lo',     e:'📈', max:'макс 8 000 💎',  g:'linear-gradient(160deg,#67e8f9,#06b6d4 55%,#0e7490)' },
];

let toastT;
function toast(text){
  let t = $('#toast');
  if(!t){ t = el('div','toast'); t.id = 'toast'; document.body.append(t); }
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(()=>t.classList.remove('show'), 1800);
}

function gameCard(o){
  const c = el('div',`card shine ${o.featured ? 'featured' : ''} ${o.stars ? 'stars' : ''}`);
  c.style.background = o.g;
  c.innerHTML =
    (o.isNew ? '<span class="badge-new">🔥 NEW</span>' : '') +
    (o.online != null ? `<span class="online-pill"><i></i>${o.online}</span>` : '') +
    `<div class="art">${o.e}</div><div class="title">${o.t}</div>` +
    (o.max ? `<div class="max-pill">${o.max}</div>` : '');
  c.onclick = () => { haptic(tg); o.screen ? show(o.screen) : toast(`${o.t} — скоро`); };
  return c;
}

function wideCard(emoji, title, sub){
  const c = el('div','card shine');
  c.style.background = 'linear-gradient(160deg,#26282e,#17181c 70%)';
  c.style.minHeight = '64px';
  c.style.flexDirection = 'row';
  c.style.alignItems = 'center';
  c.style.justifyContent = 'flex-start';
  c.style.gap = '12px';
  c.style.padding = '14px 16px';
  c.innerHTML =
    `<div class="art" style="position:static;transform:none;font-size:26px;filter:none">${emoji}</div>` +
    `<div class="title" style="font-size:15px;text-shadow:none">${title}</div>` +
    `<div class="max-pill" style="margin-left:auto">${sub}</div>`;
  c.onclick = () => { haptic(tg); toast(`${title} — скоро`); };
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

  const grid = el('div','grid2');
  GAMES.forEach((gm,i)=>{
    const card = gameCard({ ...gm, online: 2 + (i*7 + state.online) % 18 });
    if (gm.featured) wrap.append(card); else grid.append(card);
  });
  wrap.append(grid);
  wrap.append(wideCard('🎁','Ежедневный бонус','скоро'));
  wrap.append(wideCard('✈️','Подписаться на канал','+50 💎'));
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

const APP = { tg, state, syncTop, toast, show };

function show(id){
  const s = SCREENS[id];
  const root = $('#screens');
  root.replaceChildren(el('div','screen'));
  root.firstChild.append(s.render(APP));
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
