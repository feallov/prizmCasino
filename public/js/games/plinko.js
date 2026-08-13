import { el, haptic, fmt, makeBetRow } from '../ui.js';
import { play } from '../api.js';

const MULTS = [5, 2, 1.2, 0.8, 0.5, 0.8, 1.2, 2, 5];

export function renderPlinko(app){
  const { tg, state, syncTop, toast, show } = app;
  let bet = 10, busy = false;

  const wrap = el('div');
  wrap.innerHTML = `
    <div class="game-head"><button class="back">←</button><div class="gtitle">PLINKO</div><div style="width:40px"></div></div>
    <div class="stage" style="display:block">
      <div class="plinko"></div>
      <div class="pbuckets"></div>
      <div class="result-pill" hidden></div>
    </div>`;

  const field = wrap.querySelector('.plinko');
  const bucketsEl = wrap.querySelector('.pbuckets');
  const res = wrap.querySelector('.result-pill');
  const stage = wrap.querySelector('.stage');

  for (let r = 0; r < 8; r++){
    for (let j = 0; j <= r; j++){
      const p = el('div','peg');
      p.style.left = `calc(${50 + (2*j - r) * 4.5}% - 3px)`;
      p.style.top = (18 + r * 26) + 'px';
      field.append(p);
    }
  }
  const ball = el('div','pball');
  field.append(ball);
  const setBall = (r, sum) => {
    ball.style.left = `calc(${50 + (2*sum - r) * 4.5}% - 7px)`;
    ball.style.top = (12 + r * 26) + 'px';
  };
  setBall(0, 0);

  MULTS.forEach(m => bucketsEl.append(el('div','pbucket','x'+m)));

  const bets = makeBetRow(() => state.balance, v => bet = v);
  const go = el('button','cta','Бросить шарик');
  wrap.append(bets.el, go);
  wrap.querySelector('.back').onclick = () => show('lobby');

  go.onclick = async () => {
    if (busy) return; busy = true; go.disabled = true;
    res.hidden = true; stage.classList.remove('win','lose');
    bets.el.style.display = 'none';
    [...bucketsEl.children].forEach(b => b.classList.remove('hit'));
    setBall(0, 0);
    haptic(tg, 'medium');
    const d = await play(tg, 'plinko', { bet });
    if (!d.ok){
      busy = false; go.disabled = false;
      bets.el.style.display = '';
      toast(d.error === 'low_balance' ? 'Не хватает рублей' : 'Ошибка');
      return;
    }

    let sum = 0;
    d.path.forEach((step, i) => {
      setTimeout(() => {
        sum += step;
        setBall(i + 1, sum);
        haptic(tg, 'light');
      }, 240 * (i + 1));
    });

    setTimeout(() => {
      state.balance = d.balance; syncTop();
      [...bucketsEl.children][d.bucket].classList.add('hit');
      const profit = d.payout - bet;
      res.hidden = false;
      res.className = `result-pill ${profit > 0 ? 'win' : 'lose'}`;
      res.textContent = `x${d.mult} • ${profit >= 0 ? '+' : '−'}${fmt(Math.abs(profit))} ₽`;
      stage.classList.add(profit > 0 ? 'win' : 'lose');
      try { tg?.HapticFeedback?.notificationOccurred(profit > 0 ? 'success' : 'error'); } catch {}
      busy = false; go.disabled = false;
      bets.el.style.display = '';
    }, 240 * 9 + 200);
  };

  return wrap;
}
