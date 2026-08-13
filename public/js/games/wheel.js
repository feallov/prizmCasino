import { el, haptic, makeBetRow } from '../ui.js';
import { play } from '../api.js';

const SEG = [
  { m: 0,   c: '#26282e' }, { m: 1.2, c: '#22c55e' }, { m: 0.3, c: '#0d9488' }, { m: 2, c: '#4ade80' }, { m: 0.5, c: '#14b8a6' },
  { m: 3,   c: '#f59e0b' }, { m: 0.8, c: '#0f766e' }, { m: 1.5, c: '#16a34a' }, { m: 5, c: '#fbbf24' }, { m: 0.2, c: '#334155' },
];

export function renderWheel(app){
  const { tg, state, syncTop, toast, show } = app;
  let bet = 10, busy = false, rot = 0;

  const wrap = el('div');
  wrap.innerHTML = `
    <div class="game-head">
      <button class="back">←</button>
      <div class="gtitle">WHEEL</div>
      <div style="width:40px"></div>
    </div>
    <div class="stage">
      <div class="wheel-wrap">
        <div class="pointer"></div>
        <div class="wheel"></div>
        <div class="hub">💎</div>
      </div>
      <div class="result-pill" hidden></div>
    </div>`;

  const stage = wrap.querySelector('.stage');
  const wheel = wrap.querySelector('.wheel');
  const res = wrap.querySelector('.result-pill');
  wheel.style.background = `conic-gradient(${SEG.map((s,i) => `${s.c} ${i*36}deg ${(i+1)*36}deg`).join(',')})`;

  const bets = makeBetRow(() => state.balance, v => bet = v);
  const go = el('button','cta','Крутить');
  wrap.append(bets.el, go);
  wrap.querySelector('.back').onclick = () => show('lobby');

  go.onclick = async () => {
    if (busy) return; busy = true; go.disabled = true; res.hidden = true;
    stage.classList.remove('win','lose');
    haptic(tg, 'medium');

    const d = await play(tg, 'wheel', { bet });
    if (!d.ok){
      busy = false; go.disabled = false;
      toast(d.error === 'low_balance' ? 'Не хватает осколков' : 'Ошибка');
      return;
    }
    state.balance = d.balance; syncTop();

    const desired = (360 - (d.index*36 + 18)) % 360;
    const delta = (desired - (rot % 360) + 360) % 360;
    rot += 360*4 + delta;
    wheel.style.transform = `rotate(${rot}deg)`;

    setTimeout(() => {
      const profit = d.payout - bet;
      res.hidden = false;
      res.className = `result-pill ${profit > 0 ? 'win' : 'lose'}`;
      res.textContent = `x${d.mult} • ${profit >= 0 ? '+' : '−'}${Math.abs(profit)} 💎`;
      stage.classList.add(profit > 0 ? 'win' : 'lose');
      try { tg?.HapticFeedback?.notificationOccurred(profit > 0 ? 'success' : 'error'); } catch {}
      busy = false; go.disabled = false;
    }, 3300);
  };

  return wrap;
}
