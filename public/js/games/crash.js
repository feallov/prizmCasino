import { el, haptic, fmt, makeBetRow } from '../ui.js';
import { play } from '../api.js';

export function renderCrash(app){
  const { tg, state, syncTop, toast, show } = app;
  let bet = 10, sid = null, t0 = 0, raf = 0, poll = 0, active = false, busy = false;

  const wrap = el('div');
  wrap.innerHTML = `
    <div class="game-head"><button class="back">←</button><div class="gtitle">CRASH</div><div style="width:40px"></div></div>
    <div class="stage"><div class="crash-num">1.00x</div><div class="result-pill" hidden></div></div>`;

  const stage = wrap.querySelector('.stage');
  const num = wrap.querySelector('.crash-num');
  const res = wrap.querySelector('.result-pill');

  const bets = makeBetRow(() => state.balance, v => bet = v);
  const go = el('button','cta','Старт 🚀');
  wrap.append(bets.el, go);
  wrap.querySelector('.back').onclick = () => { stop(); show('lobby'); };

  const mNow = () => Math.min(100, Math.exp((Date.now() - t0) / 1000 * 0.35));

  function stop(){ active = false; cancelAnimationFrame(raf); clearInterval(poll); }

  function end(win, text){
    stop();
    num.classList.add(win ? 'win' : 'lose');
    stage.classList.add(win ? 'win' : 'lose');
    res.hidden = false;
    res.className = `result-pill ${win ? 'win' : 'lose'}`;
    res.textContent = text;
    try { tg?.HapticFeedback?.notificationOccurred(win ? 'success' : 'error'); } catch {}
    bets.el.style.display = '';
    go.textContent = 'Старт 🚀';
    setTimeout(() => { num.className = 'crash-num'; num.textContent = '1.00x'; }, 1500);
  }

  go.onclick = async () => {
    if (busy) return;
    if (!active){
      busy = true; haptic(tg, 'medium');
      const d = await play(tg, 'crash_start', { bet });
      busy = false;
      if (!d.ok) return toast(d.error === 'low_balance' ? 'Не хватает осколков' : 'Ошибка');
      sid = d.sid; t0 = Date.now(); active = true;
      state.balance = state.balance - bet; syncTop();
      num.className = 'crash-num';
      stage.classList.remove('win','lose');
      res.hidden = true;
      bets.el.style.display = 'none';
      go.textContent = 'Забрать';
      const loop = () => { if (!active) return; num.textContent = mNow().toFixed(2) + 'x'; raf = requestAnimationFrame(loop); };
      loop();
      poll = setInterval(async () => {
        if (!active) return;
        const c = await play(tg, 'crash_check', { sid });
        if (c.ok && c.crashed){
          num.textContent = c.x.toFixed(2) + 'x';
          end(false, `💥 краш на x${c.x} • −${fmt(bet)} 💎`);
        }
      }, 500);
      return;
    }
    busy = true; haptic(tg, 'medium');
    const d = await play(tg, 'crash_cash', { sid });
    busy = false;
    if (!d.ok) return toast('Ошибка');
    if (d.crashed){
      num.textContent = d.x.toFixed(2) + 'x';
      end(false, `💥 краш на x${d.x} • −${fmt(bet)} 💎`);
    } else {
      state.balance = d.balance; syncTop();
      num.textContent = d.cash.toFixed(2) + 'x';
      end(true, `+${fmt(d.payout)} 💎`);
    }
  };

  return wrap;
}
