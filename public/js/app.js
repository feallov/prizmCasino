import { $, el, fmt, haptic } from './ui.js';

const tg = window.Telegram?.WebApp;
try{
  tg?.ready(); tg?.expand();
  tg?.setHeaderColor?.('#0b0d10'); tg?.setBackgroundColor?.('#0b0d10');
}catch{}

const state = { user:null, balance:0, online:1, perGame:{}, stats:null, screen:'lobby' };

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
  { id:'top',   label:'Топ',     icon:I.trophy, renderLazy:() => import('./screens/top.js').then(m => m.renderTop) },
  { id:'tasks', label:'Задания', icon:I.tasks,  renderLazy:() => import('./screens/tasks.js').then(m => m.renderTasks), badge:'NEW' },
];
const SCREENS = Object.fromEntries(TABS.map(t => [t.id, t]));
SCREENS.profile = { render: renderProfile };
SCREENS.admin = { renderLazy: () => import('./screens/admin.js').then(m => m.renderAdmin) };
SCREENS.promo = { renderLazy: () => import('./screens/promo.js').then(m => m.renderPromo) };

const GAMES = [
  { t:'Coinflip',  e:'🪙', g:'linear-gradient(160deg,#8ecdf8,#4aa8ef 55%,#2f7fd6)', featured:true, isNew:true, screen:'coinflip' },
  { t:'Wheel',     e:'🎡', g:'linear-gradient(160deg,#86efac,#22c55e 50%,#0d9488)', screen:'wheel' },
  { t:'Mines',     e:'💣', g:'linear-gradient(160deg,#4c3a9e,#241b52 60%,#141034)', stars:true, screen:'mines' },
  { t:'Crash',     e:'🚀', g:'linear-gradient(160deg,#f87171,#ef4444 55%,#b91c1c)', isNew:true, screen:'crash' },
  { t:'Ladder',    e:'🪜', g:'linear-gradient(160deg,#c4b5fd,#8b5cf6 55%,#6d28d9)', screen:'ladder' },
  { t:'Dice',      e:'🎲', g:'linear-gradient(160deg,#cbd5e1,#64748b 60%,#334155)', screen:'dice' },
  { t:'Slots',     e:'🎰', g:'linear-gradient(160deg,#fcd34d,#f59e0b 55%,#d97706)', screen:'slots' },
  { t:'Roulette',  e:'🎯', g:'linear-gradient(160deg,#4b5563,#1f2937 60%,#111827)', screen:'roulette' },
  { t:'Blackjack', e:'🃏', g:'linear-gradient(160deg,#34d399,#059669 55%,#065f46)', screen:'blackjack' },
  { t:'Cases',     e:'📦', g:'linear-gradient(160deg,#fdba74,#f97316 55%,#c2410c)', screen:'cases' },
  { t:'RPS',       e:'✌️', g:'linear-gradient(160deg,#5eead4,#14b8a6 55%,#0f766e)', screen:'rps' },
  { t:'Plinko',    e:'⚪', g:'linear-gradient(160deg,#f9a8d4,#ec4899 55%,#be185d)', isNew:true, screen:'plinko' },
  { t:'Hi-Lo',     e:'📈', g:'linear-gradient(160deg,#67e8f9,#06b6d4 55%,#0e7490)', screen:'hilo' },
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
  const online = state.perGame?.[o.screen];
  c.innerHTML =
    (o.isNew ? '<span class="badge-new">🔥 NEW</span>' : '') +
    (online != null ? `<span class="online-pill"><i></i>${online}</span>` : '') +
    `<div class="art">${o.e}</div><div class="title">${o.t}</div>`;
  c.onclick = () => { haptic(tg); show(o.screen); };
  return c;
}

function wideCard(emoji, title, sub, onClick){
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
  c.onclick = onClick;
  return c;
}

function renderLobby(){
  const wrap = el('div');
  const icons = el('div','row-icons');
  const news = el('button','round','🔔');
  news.onclick = () => { haptic(tg); try{ tg?.openTelegramLink('https://t.me/prizmCasino'); }catch{ window.open('https://t.me/prizmCasino','_blank'); } };
  const promo = el('button','round','🎟️');
  promo.onclick = () => { haptic(tg); show('promo'); };
  icons.append(news, promo);
  if (state.user?.isAdmin){
    const adm = el('button','round','⚙️');
    adm.onclick = () => { haptic(tg); show('admin'); };
    icons.append(adm);
  }
  wrap.append(icons);

  const grid = el('div','grid2');
  GAMES.forEach((gm) => {
    const card = gameCard(gm);
    if (gm.featured) wrap.append(card); else grid.append(card);
  });
  wrap.append(grid);
  wrap.append(wideCard('🎁','Ежедневный бонус', state.user?.streak ? `${state.user.streak} 🔥` : 'забирай', () => show('tasks')));
  return wrap;
}

function renderProfile(){
  const u = state.user, wrap = el('div');
  const head = el('div','panel profile-head');
  const ava = u?.photo_url ? Object.assign(el('img','avatar'),{src:u.photo_url}) : el('div','avatar stub','👤');
  const info = el('div');
  info.innerHTML = `<b style="color:var(--text)">${u?.first_name ?? 'Гость'}</b><br><span>@${u?.username ?? 'unknown'}</span>`;
  if (u?.isAdmin) info.innerHTML += `<div class="admin-badge">ADMIN</div>`;
  head.append(ava, info);

  const balance = el('div','panel',`<span>Баланс</span><b class="big-num" data-balance>${fmt(state.balance)} ₽</b>`);
  balance.style.marginTop = '12px';

  const s = state.stats ?? {};
  const stats = el('div','stats-grid');
  stats.append(
    statBox('Игр сыграно', fmt(s.games ?? 0)),
    statBox('Поставлено', fmt(s.wagered ?? 0) + ' ₽'),
    statBox('Выиграно', fmt(s.won ?? 0) + ' ₽'),
    statBox('Профит', fmt(s.profit ?? 0) + ' ₽', (s.profit ?? 0) >= 0),
    statBox('Лучший выигрыш', fmt(s.biggest ?? 0) + ' ₽'),
    statBox('Серия дней', (u?.streak ?? 0) + ' 🔥'),
  );

  wrap.append(head, balance, stats);

  if (u?.isAdmin){
    const adm = el('button','cta','⚙️ Админ-панель');
    adm.style.marginTop = '14px';
    adm.onclick = () => show('admin');
    wrap.append(adm);
  }

  const promo = el('button','cta','🎟️ Активировать промокод');
  promo.style.marginTop = '10px';
  promo.style.background = 'linear-gradient(135deg,#3b82f6,#1d4ed8)';
  promo.onclick = () => show('promo');
  wrap.append(promo);

  return wrap;
}

function statBox(key, label, value, positive){
  const b = el('div','stat-box');
  const v = el('b','',String(value));
  v.dataset.stat = key;
  if (positive === true) v.classList.add('pos');
  if (positive === false) v.classList.add('neg');
  b.append(el('span','',label), v);
  return b;
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
  $('#balance').textContent = `${fmt(state.balance)} ₽`;
  $('#online').textContent = state.online;
}

const APP = { tg, state, syncTop, toast, show };

function show(id){
  state.screen = id;
  const root = $('#screens');
  root.replaceChildren(el('div','screen'));

  const s = SCREENS[id];
  if (s?.render) {
    root.firstChild.append(s.render(APP));
  } else if (s?.renderLazy) {
    root.firstChild.append(el('div','panel','<div style="font-size:24px">⏳</div>'));
    s.renderLazy().then(fn => {
      if (state.screen !== id) return;
      root.replaceChildren(el('div','screen'));
      root.firstChild.append(fn(APP));
    }).catch(() => {
      if (state.screen !== id) return;
      root.firstChild.replaceChildren(el('div','panel','<b>Ошибка загрузки</b>'));
    });
  } else {
    root.firstChild.append(el('div','panel','<div style="font-size:34px">⏳</div>'));
    import(`./games/${id}.js`).then(m => {
      if (state.screen !== id) return;
      const fn = Object.values(m).find(v => typeof v === 'function');
      root.replaceChildren(el('div','screen'));
      root.firstChild.append(fn(APP));
    }).catch(() => {
      if (state.screen !== id) return;
      root.firstChild.replaceChildren(el('div','panel',`<b style="color:var(--text)">Скоро</b><span>игра ещё не подключена</span>`));
    });
  }
  for(const b of $('#tabbar').querySelectorAll('.tab')) b.classList.toggle('active', b.dataset.id === id);
}

async function boot(){
  const u = tg?.initDataUnsafe?.user;
  if(u) state.user = { id:u.id, username:u.username, first_name:u.first_name, photo_url:u.photo_url };
  try{
    const r = await fetch('/api/me',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:tg?.initData ?? ''})});
    if(r.ok){
      const d = await r.json();
      state.user = { ...d.user };
      state.balance = d.user.balance ?? 0;
      state.online = d.online ?? state.online;
      state.perGame = d.perGame ?? {};
      state.stats = d.stats ?? null;
    }
  }catch{}
  buildChrome();
  show('lobby');
  setTimeout(()=>$('#splash').classList.add('off'), 900);
}
boot();

/* live-баланс: админ кинул/снял ₽ — цифра обновится сама */
setInterval(async () => {
  try{
    const r = await fetch('/api/balance',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData:tg?.initData ?? ''})});
    if(!r.ok) return;
    const d = await r.json();
    if(d.ok && d.balance != null && d.balance !== state.balance){
      state.balance = d.balance;
      syncTop();
      document.querySelectorAll('[data-balance]').forEach(n => n.textContent = `${fmt(d.balance)} ₽`);
    }
  }catch{}
}, 4000);
