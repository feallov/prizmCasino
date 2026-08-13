import { el, haptic, fmt, makeBetRow } from '../ui.js';
import { play } from '../api.js';

export function renderDice(app){
  const { tg, state, syncTop, toast, show } = app;
  let bet = 10, target = 50, over = false, busy = false;

  const wrap = el('div');
  wrap.innerHTML = `
    <div class="game-head"><button class="back">←</button><div class="gtitle">DICE</div><div style="width:40px"></div></div>
    <div class="stage"><div class="dice-num">—</div><div class="result-pill" hidden></div></div>
    <div class="choices">
      <button class="chip choice active">⬇️ Ниже</button>
      <button class="chip choice">⬆️ Выше</button>
    </div>
    <input type="range" class="slider" min="2" max="98" value="50" />
    <div class="dice-info">
      <div class="pill">Шанс: <span class="ch">50%</span></div>
      <div class="pill">Множ: <span class="mu">x1.94</span></div>
    </div>`;

  const num = wrap.querySelector('.dice-num');
  const res = wrap.querySelector('.result-pill');
  const slider = wrap.querySelector('.slider');
  const ch = wrap.querySelector('.ch');
  const mu = wrap.querySelector('.mu');
  const tog = [...wrap.querySelectorAll('.choice')];

  const calc = () => {
    const chance = over ? 99 - target : target;
    const mult = Math.floor((99 / chance) * 0.97 * 100) / 100;
    ch.textContent = chance + '%';
    mu.textContent = 'x' + mult;
    return mult;
  };

  slider.oninput = () => { target = +slider.value; calc(); haptic(tg); };
  tog[0].onclick = () => { over = false; tog[0].classList.add('active'); tog[1].classList.remove('active'); calc(); };
  tog[1].onclick = () => { over = true; tog[1].classList.add('active'); tog[0].classList.remove('active'); calc(); };
  calc();

  const bets = makeBetRow(() => state.balance, v => bet = v);
  const go = el('button','cta','Бросить');
  wrap.append(bets.el, go);
  wrap.querySelector('.back').onclick = () => show('lobby');

  go.onclick = async () => {
    if (busy) return; busy = true; go.disabled = true;
    res.hidden = true; num.className = 'dice-num';
    haptic(tg, 'medium');
    const d = await play(tg, 'dice', { bet, target, over });
    if (!d.ok){
      busy = false; go.disabled = false;
      return toast(d.error === 'low_balance' ? 'Не хватает осколков' : 'Ошибка');
    }
    state.balance = d.balance; syncTop();

    let ticks = 0;
    const scr = setInterval(() => {
      num.textContent = String(rand(ticks));
      ticks++;
      if (ticks > 10){
        clearInterval(scr);
        num.textContent = String(d.roll);
        num.classList.add(d.win ? 'win' : 'lose');
        res.hidden = false;
        res.className = `result-pill ${d.win ? 'win' : 'lose'}`;
        res.textContent = d.win ? `+${fmt(d.payout)} 💎` : `−${fmt(bet)} 💎`;
        try { tg?.HapticFeedback?.notificationOccurred(d.win ? 'success' : 'error'); } catch {}
        busy = false; go.disabled = false;
      }
    }, 60);
  };

  function rand(t){ return Math.floor(Math.abs(Math.sin(t * 999 + bet)) * 99); }

  return wrap;
}
