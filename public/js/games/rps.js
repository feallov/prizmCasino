import { el, haptic, fmt, makeBetRow } from '../ui.js';
import { play } from '../api.js';

const EMO = { rock:'🪨', paper:'📄', scissors:'✂️' };
const OPTS = ['rock','paper','scissors'];

export function renderRps(app){
  const { tg, state, syncTop, toast, show } = app;
  let bet = 10, choice = 'rock', busy = false;

  const wrap = el('div');
  wrap.innerHTML = `
    <div class="game-head"><button class="back">←</button><div class="gtitle">RPS</div><div style="width:40px"></div></div>
    <div class="stage">
      <div class="rps-stage"><span id="p">❔</span><span style="font-size:26px;color:var(--muted)">vs</span><span id="c">❔</span></div>
      <div class="result-pill" hidden></div>
    </div>
    <div class="choices">
      <button class="chip choice active">🪨 Камень</button>
      <button class="chip choice">📄 Бумага</button>
      <button class="chip choice">✂️ Ножницы</button>
    </div>`;

  const P = wrap.querySelector('#p');
  const C = wrap.querySelector('#c');
  const res = wrap.querySelector('.result-pill');
  const stage = wrap.querySelector('.stage');

  const btns = [...wrap.querySelectorAll('.choice')];
  btns.forEach((b,i) => b.onclick = () => {
    if(!busy){
      choice = OPTS[i];
      btns.forEach(x => x.classList.toggle('active', x === b));
      haptic(tg);
    }
  });

  const bets = makeBetRow(() => state.balance, v => bet = v);
  const go = el('button','cta','Бросить');
  wrap.append(bets.el, go);
  wrap.querySelector('.back').onclick = () => show('lobby');

  go.onclick = async () => {
    if (busy) return; busy = true; go.disabled = true;
    res.hidden = true; stage.classList.remove('win','lose');
    bets.el.style.display = 'none';
    btns.forEach(b => b.disabled = true);
    haptic(tg, 'medium');
    const d = await play(tg, 'rps', { bet, choice });
    if (!d.ok){
      busy = false; go.disabled = false;
      bets.el.style.display = '';
      btns.forEach(b => b.disabled = false);
      toast(d.error === 'low_balance' ? 'Не хватает рублей' : 'Ошибка');
      return;
    }

    let t = 0;
    const iv = setInterval(() => {
      P.textContent = EMO[OPTS[t % 3]];
      C.textContent = EMO[OPTS[(t + 1) % 3]];
      t++;
      if (t > 9){
        clearInterval(iv);
        state.balance = d.balance; syncTop();
        P.textContent = EMO[d.player];
        C.textContent = EMO[d.cpu];
        const win = d.result === 'win', draw = d.result === 'draw';
        res.hidden = false;
        res.className = `result-pill ${win ? 'win' : draw ? '' : 'lose'}`;
        const profit = d.payout - bet;
        res.textContent = win ? `+${fmt(profit)} ₽` : draw ? 'Ничья • возврат' : `−${fmt(bet)} ₽`;
        stage.classList.add(win ? 'win' : 'lose');
        try { tg?.HapticFeedback?.notificationOccurred(win ? 'success' : draw ? 'warning' : 'error'); } catch {}
        busy = false; go.disabled = false;
        bets.el.style.display = '';
        btns.forEach(b => b.disabled = false);
      }
    }, 80);
  };

  return wrap;
}
