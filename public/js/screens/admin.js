import { el, fmt, haptic } from '../ui.js';

export function renderAdmin(app){
  const { tg, toast, show } = app;
  const wrap = el('div');
  wrap.innerHTML = `
    <div class="game-head"><button class="back">←</button><div class="gtitle">АДМИНКА</div><div style="width:40px"></div></div>
    <div class="admin-section glass">
      <b style="color:var(--text)">Создать промокод</b>
      <input class="admin-input" id="p-code" placeholder="КОД (латиница/цифры)" />
      <input class="admin-input" id="p-amount" placeholder="Сумма, ₽" type="number" />
      <input class="admin-input" id="p-uses" placeholder="Макс активаций" type="number" value="1" />
      <button class="cta" id="p-create">Создать</button>
    </div>
    <div class="admin-section glass">
      <b style="color:var(--text)">Промокоды</b>
      <div id="p-list" style="color:var(--muted);font-size:13px">загружаем...</div>
    </div>
        <div class="admin-section glass">
      <b style="color:var(--text)">Вебхук бота</b>
      <button class="cta" id="wh-set">🔗 Привязать вебхук (рефералка)</button>
      <div id="wh-status" style="color:var(--muted);font-size:12px">нажми один раз после деплоя</div>
    </div>
    <div class="admin-section glass">
      <b style="color:var(--text)">Выдать / снять ₽</b>
      <input class="admin-input" id="u-id" placeholder="Telegram ID" type="number" />
      <input class="admin-input" id="u-amount" placeholder="Сумма (отриц. = снять)" type="number" />
      <button class="cta" id="u-add">Выполнить</button>
    </div>
    <div class="admin-section glass">
      <b style="color:var(--text)">Юзеры</b>
      <div id="u-list" style="color:var(--muted);font-size:13px">загружаем...</div>
    </div>`;

  wrap.querySelector('.back').onclick = () => show('lobby');

  const api = async (path, body) => {
    const r = await fetch('/api/admin/'+path, {
      method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({ initData: tg?.initData ?? '', ...body })
    });
    return r.json();
  };

  wrap.querySelector('#p-create').onclick = async () => {
    const code = wrap.querySelector('#p-code').value.trim().toUpperCase();
    const amount = +wrap.querySelector('#p-amount').value;
    const uses = +wrap.querySelector('#p-uses').value || 1;
    if (!code || !amount) return toast('Заполни код и сумму');
    const d = await api('promo_create', { code, amount, max_uses: uses });
    if (!d.ok) return toast('Ошибка');
    toast('Промокод создан');
    wrap.querySelector('#p-code').value = '';
    wrap.querySelector('#p-amount').value = '';
    loadPromos();
  };

  wrap.querySelector('#u-add').onclick = async () => {
    const uid = +wrap.querySelector('#u-id').value;
    const amount = +wrap.querySelector('#u-amount').value;
    if (!uid || !amount) return toast('Заполни ID и сумму');
    const d = await api('add', { uid, amount });
    if (!d.ok) return toast('Ошибка');
    toast(`Готово. Баланс юзера: ${fmt(d.balance)} ₽`);
    loadUsers();
  };

  async function loadPromos(){
    const d = await api('promos');
    const list = wrap.querySelector('#p-list');
    if (!d.ok || !d.promos.length){ list.textContent = 'пусто'; return; }
    list.replaceChildren();
    for (const p of d.promos){
      const row = el('div','admin-row');
      row.innerHTML = `<b style="color:var(--violet-2)">${p.code}</b><span style="color:var(--muted)">${p.amount} ₽ • ${p.uses}/${p.max_uses}</span>`;
      list.append(row);
    }
  }
  async function loadUsers(){
    const d = await api('users');
    const list = wrap.querySelector('#u-list');
    if (!d.ok || !d.users.length){ list.textContent = 'пусто'; return; }
    list.replaceChildren();
    for (const u of d.users){
      const row = el('div','admin-row');
      row.innerHTML = `<span>${u.first_name ?? u.username ?? u.telegram_id}</span>
        <span style="color:var(--muted);font-size:11px">id: ${u.telegram_id}</span>
        <b>${fmt(u.balance)} ₽</b>`;
      row.onclick = () => {
        wrap.querySelector('#u-id').value = u.telegram_id;
        toast('ID подставлен');
      };
      list.append(row);
    }
  }

    wrap.querySelector('#wh-set').onclick = async () => {
    const d = await api('webhook', {});
    wrap.querySelector('#wh-status').textContent = d.ok ? 'вебхук установлен ✅' : ('ошибка: ' + (d.desc ?? 'неизвестно'));
    toast(d.ok ? 'Вебхук установлен' : 'Ошибка вебхука');
  };

  loadPromos(); loadUsers();
  return wrap;
}
