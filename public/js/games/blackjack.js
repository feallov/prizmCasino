import { el, haptic, fmt, makeBetRow } from '../ui.js';
import { play } from '../api.js';

const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS = ['♠','♥','♦','♣'];

function cardEl(card, hidden){
  const d = el('div', 'pcard' + (hidden ? ' back' : ''));
  if (!hidden){
    if (card.s === 1 || card.s === 2) d.classList.add('red');
    d.textContent = RANKS[card.r - 1] + SUITS[card.s];
  }
  return d;
}

export function renderBlackjack(app){
  const { tg, state, syncTop, toast, show } = app;
  let bet = 10, sid = null, active = false, busy = false;

  const wrap = el('div');
  wrap.innerHTML = `
    <div class="game-head"><button class="back">←</button><div class="gtitle">BLACKJACK</div><div style="width:40px"></div></div>
    <div class="stage">
      <div class="bj-zone">
        <div class="bj-label">ДИЛЕР</div>
        <div class="bj-hand" id="dh"></div>
        <div class="bj-label">ТЫ</div>
        <div class="bj-hand" id="ph"></div>
        <div class="result-pill" hidden></div>
      </div>
    </div>
    <div class="bj-btns" hidden>
      <button class="chip" id="hit">Ещё</button>
      <button class="chip" id="stand">Хватит</button>
    </div>`;

  const dh = wrap.querySelector('#dh');
  const ph = wrap.querySelector('#ph');
  const res = wrap.querySelector('.result-pill');
  const bj = wrap.querySelector('.bj-btns');
  const hitB = wrap.querySelector('#hit');
  const standB = wrap.querySelector('#stand');
  const stage = wrap.querySelector('.stage');

  const bets = makeBetRow(() => state.balance, v => bet = v);
  const go = el('button','cta','Раздать');
  wrap.append(bets.el, go);
  wrap.querySelector('.back').onclick = () => show('lobby');

  function reset(){
    active = false; sid = null;
    dh.replaceChildren(); ph.replaceChildren();
    bj.hidden = true; bets.el.style.display = ''; go.style.display = '';
    stage.classList.remove('win','lose');
  }

  function finish(win, text, finalBal){
    if (finalBal != null){ state.balance = finalBal; syncTop(); }
    res.hidden = false;
    res.className = `result-pill ${win ? 'win' : 'lose'}`;
    res.textContent = text;
    stage.classList.add(win ? 'win' : 'lose');
    try { tg?.HapticFeedback?.notificationOccurred(win ? 'success' : 'error'); } catch {}
    setTimeout(reset, 1800);
  }

  go.onclick = async () => {
    if (busy) return; busy = true; haptic(tg, 'medium');
    const d = await play(tg, 'blackjack_start', { bet });
    busy = false;
    if (!d.ok){ toast(d.error === 'low_balance' ? 'Не хватает рублей' : 'Ошибка'); return; }
    sid = d.sid;
    state.balance -= bet; syncTop();
    ph.replaceChildren(...d.player.map(c => cardEl(c)));
    dh.replaceChildren(cardEl(d.dealerTop), cardEl(null, true));
    res.hidden = true;
    stage.classList.remove('win','lose');
    bets.el.style.display = 'none'; go.style.display = 'none';
    if (d.done){
      const profit = d.payout - bet;
      finish(d.payout >= bet, d.payout > bet ? `БЛЭКДЖЕК! +${fmt(profit)} ₽` : (d.payout > 0 ? `Ничья • возврат` : `−${fmt(bet)} ₽`), d.balance);
      return;
    }
    active = true;
    bj.hidden = false;
  };

  hitB.onclick = async () => {
    if (!active || busy) return; busy = true; haptic(tg);
    const d = await play(tg, 'blackjack_hit', { sid });
    busy = false;
    if (!d.ok){ toast('Ошибка'); return; }
    ph.append(cardEl(d.card));
    if (d.bust){
      active = false;
      dh.replaceChildren(...d.dealer.map(c => cardEl(c)));
      bj.hidden = true; go.style.display = ''; bets.el.style.display = '';
      finish(false, `Перебор ${d.v} • −${fmt(bet)} ₽`);
    }
  };

  standB.onclick = async () => {
    if (!active || busy) return; busy = true; haptic(tg, 'medium');
    const d = await play(tg, 'blackjack_stand', { sid });
    busy = false;
    if (!d.ok){ toast('Ошибка'); return; }
    active = false;
    dh.replaceChildren(...d.dealer.map(c => cardEl(c)));
    bj.hidden = true; go.style.display = ''; bets.el.style.display = '';
    if (d.result === 'win'){
      const profit = d.payout - bet;
      finish(true, `+${fmt(profit)} ₽`, d.balance);
    } else if (d.result === 'push'){
      finish(true, `Ничья • возврат ${fmt(d.payout)} ₽`, d.balance);
    } else {
      finish(false, `−${fmt(bet)} ₽`, d.balance);
    }
  };

  return wrap;
}
