/* Sala de juego - Bingo Virtual */
(function () {
  'use strict';
  const B = window.Bingo;
  const $ = (s) => document.querySelector(s);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const game = (id) => B.GAMES.find((g) => g.id === id);

  let cards = B.loadCards();
  let S = B.loadState();
  let busy = false, autoTimer = null;
  const save = () => B.saveState(S);

  /* ---------- Utilidades ---------- */
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }
  function rand(n) {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0] % n;
  }
  const ballVars = (n) => {
    const i = B.letterIdx(n);
    return { bc: B.LETTER_COLORS[i], bi: B.LETTER_INK[i], l: B.LETTERS[i] };
  };

  /* ---------- Logo ---------- */
  function renderLogo() {
    const slot = $('#logoSlot');
    const url = B.getLogoUrl();
    slot.innerHTML = url ? '<img alt="Logo">' : 'B';
    if (url) slot.firstChild.src = url;
  }
  $('#logoSlot').onclick = async () => { if (await B.pickLogo()) renderLogo(); };

  /* ---------- Juegos ---------- */
  function renderGames() {
    const box = $('#games');
    box.innerHTML = '';
    B.GAMES.forEach((g) => {
      const b = document.createElement('button');
      b.className = 'chip' + (g.id === S.current ? ' active' : '') + (S.wins[g.id] ? ' done' : '');
      b.style.setProperty('--c', g.color);
      b.innerHTML = `<span class="tag">${g.tag}</span><span class="lbl">${g.label}</span>${g.sub ? `<span class="sub">${g.sub}</span>` : ''}`;
      b.onclick = () => selectGame(g.id);
      box.appendChild(b);
    });
  }

  function renderGameCard() {
    const g = game(S.current);
    $('#gTitle').textContent = g.label;
    $('#gSub').textContent = g.sub || '';
    $('#gSub').style.display = g.sub ? '' : 'none';
    const p = $('#pattern');
    p.style.setProperty('--c', g.color);
    p.innerHTML = '';
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const i = document.createElement('i');
        if (g.cells.some(([rr, cc]) => rr === r && cc === c)) i.className = 'on';
        if (r === 2 && c === 2) i.className += ' free';
        p.appendChild(i);
      }
    }
    $('#prize').value = S.prizes[g.id] || '';
  }
  $('#prize').oninput = (e) => { S.prizes[S.current] = e.target.value; save(); };

  function selectGame(id) {
    S.current = id;
    save();
    renderGames();
    renderGameCard();
    showGamePopup();
  }

  // Figura grande en el centro para que todos vean cómo se juega
  function showGamePopup() {
    const g = game(S.current);
    $('#gpTitle').textContent = g.label + (g.sub ? ' · ' + g.sub : '');
    $('#gpPrize').textContent = S.prizes[g.id] ? '🎁 ' + S.prizes[g.id] : '';
    const grid = $('#gpGrid');
    grid.style.setProperty('--c', g.color);
    grid.innerHTML = '';
    B.LETTERS.forEach((l, i) => {
      const h = document.createElement('div');
      h.className = 'bph';
      h.style.background = B.LETTER_COLORS[i];
      h.style.color = B.LETTER_INK[i];
      h.textContent = l;
      grid.appendChild(h);
    });
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const d = document.createElement('div');
        const on = g.cells.some(([rr, cc]) => rr === r && cc === c);
        d.className = 'bpc' + (on ? ' on' : '') + (r === 2 && c === 2 ? ' free' : '');
        if (r === 2 && c === 2) d.textContent = '★';
        grid.appendChild(d);
      }
    }
    $('#gameOverlay').classList.add('show');
  }
  $('#gpClose').onclick = () => $('#gameOverlay').classList.remove('show');
  $('#btnShowShape').onclick = showGamePopup;
  $('#gameOverlay').addEventListener('click', (e) => { if (e.target.id === 'gameOverlay') e.currentTarget.classList.remove('show'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('#gameOverlay').classList.remove('show'); });

  /* ---------- Tablero y balotas ---------- */
  function buildBoard() {
    const b = $('#board');
    b.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const row = document.createElement('div');
      row.className = 'brow';
      row.style.setProperty('--bc', B.LETTER_COLORS[i]);
      row.style.setProperty('--bi', B.LETTER_INK[i]);
      row.innerHTML = `<div class="bl">${B.LETTERS[i]}</div>`;
      for (let k = 1; k <= 15; k++) {
        const n = i * 15 + k;
        row.insertAdjacentHTML('beforeend', `<div class="bn" data-n="${n}">${n}</div>`);
      }
      b.appendChild(row);
    }
  }

  function renderBoard() {
    const latest = S.called[S.called.length - 1];
    document.querySelectorAll('.bn').forEach((el) => {
      const n = +el.dataset.n;
      el.classList.toggle('called', S.called.includes(n));
      el.classList.toggle('latest', n === latest);
    });
    $('#counter').textContent = `Balotas: ${S.called.length} / 75`;
    const cc = $('#cardCount');
    cc.textContent = cards.length
      ? `🎟️ ${cards.length} cartulinas en juego`
      : '⚠️ 0 cartulinas: genéralas en "Generar cartulinas" (abre desde este mismo navegador y dirección)';
    cc.classList.toggle('warn', !cards.length);
    const last = $('#last');
    last.innerHTML = '';
    S.called.slice(-7, -1).reverse().forEach((n) => {
      const v = ballVars(n);
      const m = document.createElement('div');
      m.className = 'mini' + (B.letterIdx(n) === 4 ? ' o' : '');
      m.style.setProperty('--bc', v.bc);
      m.textContent = v.l + n;
      last.appendChild(m);
    });
  }

  function showBall(n) {
    const el = $('#ball');
    if (!n) {
      el.classList.add('empty');
      $('#bl').textContent = '?';
      $('#bn').textContent = '--';
      return;
    }
    const v = ballVars(n);
    el.classList.remove('empty');
    el.style.setProperty('--bc', v.bc);
    $('#bl').textContent = v.l;
    $('#bn').textContent = n;
  }

  function speak(n) {
    if (!S.sound || !('speechSynthesis' in window)) return;
    const names = ['Be', 'I', 'Ene', 'Ge', 'O'];
    let text = `${names[B.letterIdx(n)]}, ${n}.`;
    if (n > 9) text += ` ${String(n).split('').join(', ')}.`;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-CO';
    u.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  async function drawBall() {
    if (busy) return;
    const left = [];
    for (let i = 1; i <= 75; i++) if (!S.called.includes(i)) left.push(i);
    if (!left.length) { toast('Ya salieron las 75 balotas'); stopAuto(); return; }
    busy = true;
    $('#btnDraw').disabled = true;
    const el = $('#ball');
    el.classList.remove('pop');
    el.classList.add('spin');
    const iv = setInterval(() => showBall(1 + rand(75)), 80);
    await sleep(S.interval <= 1 ? 120 : 1300);
    clearInterval(iv);
    el.classList.remove('spin');
    const n = left[rand(left.length)];
    S.called.push(n);
    save();
    showBall(n);
    void el.offsetWidth;
    el.classList.add('pop');
    renderBoard();
    speak(n);
    busy = false;
    $('#btnDraw').disabled = false;
    checkWin();
  }

  function undo() {
    if (busy || !S.called.length) return;
    S.called.pop();
    Object.keys(S.wins).forEach((id) => { if (S.wins[id].count > S.called.length) delete S.wins[id]; });
    save();
    showBall(S.called[S.called.length - 1]);
    renderBoard();
    renderGames();
    renderHistory();
  }

  /* ---------- Automático ---------- */
  function stopAuto() {
    clearInterval(autoTimer);
    autoTimer = null;
    $('#btnAuto').textContent = '▶ Automático';
  }
  function toggleAuto() {
    if (autoTimer) return stopAuto();
    $('#btnAuto').textContent = '⏸ Detener';
    drawBall();
    autoTimer = setInterval(() => {
      if (!busy && !document.querySelector('.overlay.show')) drawBall();
    }, S.interval <= 1 ? 400 : S.interval * 1000 + 1400);
  }
  $('#interval').value = String(S.interval);
  $('#interval').onchange = (e) => {
    S.interval = +e.target.value;
    save();
    if (autoTimer) { stopAuto(); toggleAuto(); }
  };

  /* ---------- Ganadores ---------- */
  function checkWin() {
    const g = game(S.current);
    if (S.wins[g.id]) return;
    const set = new Set(S.called);
    const w = cards.filter((c) => B.isWin(c, g, set)).map((c) => c.n);
    if (!w.length) return;
    S.wins[g.id] = { cards: w, ball: S.called[S.called.length - 1] || 0, count: S.called.length };
    save();
    stopAuto();
    renderGames();
    renderHistory();
    showWinners(g, w);
  }

  function winnerHtml(n) {
    const c = cards.find((x) => x.n === n);
    if (!c) return `<div class="winner"><div class="num">Nº ${B.pad(n)}</div><div class="who">Cartulina no registrada</div></div>`;
    return `<div class="winner"><div class="num">Nº ${B.pad(c.n)}</div><div><div class="who"></div><div class="sell"></div></div></div>`;
  }

  function fillWinners(box, nums) {
    box.innerHTML = nums.map(winnerHtml).join('');
    const items = box.querySelectorAll('.winner');
    nums.forEach((n, i) => {
      const c = cards.find((x) => x.n === n);
      if (!c) return;
      items[i].querySelector('.who').textContent = c.buyer;
      items[i].querySelector('.sell').textContent = 'Vendida por: ' + c.seller;
    });
  }

  function showWinners(g, nums) {
    $('#winGame').textContent = g.label + (g.sub ? ' · ' + g.sub : '') + (nums.length > 1 ? ` · ${nums.length} ganadores` : '');
    fillWinners($('#winList'), nums);
    $('#winOverlay').classList.add('show');
    fanfare();
    startConfetti();
  }

  function closeWin() {
    $('#winOverlay').classList.remove('show');
    stopConfetti();
  }
  $('#btnStay').onclick = closeWin;
  // Vacía el bombo: todas las balotas vuelven a estar disponibles. Los ganadores ya registrados se conservan.
  function resetBalls() {
    stopAuto();
    S.called = [];
    save();
    showBall(0);
    renderBoard();
  }
  $('#btnResetBalls').onclick = () => {
    if (busy) return;
    if (confirm('¿Reiniciar todas las balotas? El tablero queda en cero. Los ganadores ya registrados y las cartulinas se conservan.')) {
      resetBalls();
      toast('Balotas reiniciadas');
    }
  };
  $('#btnResetWins').onclick = () => {
    const g = game(S.current);
    if (!confirm(`¿Reiniciar los ganadores de "${g.label}"? Los ganadores de los demás juegos, las balotas y las cartulinas se conservan.`)) return;
    stopAuto();
    delete S.wins[g.id];
    save();
    closeWin();
    renderGames();
    renderHistory();
    toast(`Ganadores de ${g.label} reiniciados`);
  };
  $('#btnNextReset').onclick = () => { resetBalls(); goNext(); };
  $('#btnNext').onclick = goNext;
  function goNext() {
    closeWin();
    const idx = B.GAMES.findIndex((g) => g.id === S.current);
    const nxt = B.GAMES.slice(idx + 1).concat(B.GAMES.slice(0, idx)).find((g) => !S.wins[g.id]);
    if (nxt) selectGame(nxt.id); else toast('¡Todos los juegos ya tienen ganador!');
  };

  function renderHistory() {
    const box = $('#hlist');
    const done = B.GAMES.filter((g) => S.wins[g.id]);
    if (!done.length) { box.innerHTML = '<span class="muted">Aún no hay ganadores.</span>'; return; }
    box.innerHTML = '';
    done.forEach((g) => {
      const d = document.createElement('div');
      d.className = 'hitem';
      d.style.setProperty('--c', g.color);
      const lines = S.wins[g.id].cards.map((n) => {
        const c = cards.find((x) => x.n === n);
        return c ? `Nº ${B.pad(c.n)} · ${c.buyer}` : `Nº ${B.pad(n)}`;
      });
      d.innerHTML = `<b></b><div></div>`;
      d.querySelector('b').textContent = g.label;
      d.querySelector('div').textContent = lines.join(' | ');
      d.style.cursor = 'pointer';
      d.onclick = () => showWinners(g, S.wins[g.id].cards);
      box.appendChild(d);
    });
  }

  /* ---------- Verificar cartulina ---------- */
  async function verify() {
    const n = +$('#verNum').value;
    const res = $('#verRes');
    const c = cards.find((x) => x.n === n);
    if (!c) { res.innerHTML = '<p>No existe una cartulina con ese número.</p>'; return; }
    const set = new Set(S.called);
    res.innerHTML = '<div class="verify-body"><canvas></canvas><div class="vinfo"></div></div>';
    await B.drawCard(res.querySelector('canvas'), c, { scale: 0.5, called: set });
    const info = res.querySelector('.vinfo');
    info.innerHTML = '<h3 style="font-size:28px"></h3><div class="sell"></div><div class="tagrow"></div><div class="muted"></div>';
    info.querySelector('h3').textContent = `Nº ${B.pad(c.n)} · ${c.buyer}`;
    info.querySelector('.sell').textContent = 'Vendida por: ' + c.seller;
    const tags = info.querySelector('.tagrow');
    B.GAMES.forEach((g) => {
      const ok = B.isWin(c, g, set);
      const t = document.createElement('span');
      t.className = 'vtag' + (ok ? ' ok' : '');
      t.textContent = (ok ? '✔ ' : `faltan ${B.missing(c, g, set)} · `) + g.label;
      tags.appendChild(t);
    });
    info.querySelector('.muted').textContent = 'Se marcan las balotas que ya salieron en esta partida.';
  }
  $('#btnVerify').onclick = () => { $('#verOverlay').classList.add('show'); $('#verNum').focus(); };
  $('#verClose').onclick = () => $('#verOverlay').classList.remove('show');
  $('#verGo').onclick = verify;
  $('#verNum').onkeydown = (e) => { if (e.key === 'Enter') verify(); };

  /* ---------- Sonido y confeti ---------- */
  function fanfare() {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, ac.currentTime + i * 0.14);
        g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + i * 0.14 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + i * 0.14 + 0.3);
        o.connect(g); g.connect(ac.destination);
        o.start(ac.currentTime + i * 0.14); o.stop(ac.currentTime + i * 0.14 + 0.32);
      });
    } catch (e) { /* sin audio */ }
  }

  let confettiRaf = 0;
  function startConfetti() {
    const cv = $('#confetti'), ctx = cv.getContext('2d');
    cv.width = innerWidth; cv.height = innerHeight;
    const cols = ['#f7a81b', '#d41367', '#1e6fe0', '#1fa65a', '#7a3fd1', '#ffffff'];
    const ps = Array.from({ length: 220 }, () => ({
      x: Math.random() * cv.width, y: -Math.random() * cv.height,
      w: 8 + Math.random() * 8, h: 12 + Math.random() * 10, vy: 2 + Math.random() * 4,
      vx: -1.5 + Math.random() * 3, r: Math.random() * 6, vr: -.2 + Math.random() * .4,
      c: cols[rand(cols.length)]
    }));
    cancelAnimationFrame(confettiRaf);
    (function loop() {
      ctx.clearRect(0, 0, cv.width, cv.height);
      ps.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        if (p.y > cv.height + 20) { p.y = -20; p.x = Math.random() * cv.width; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      });
      confettiRaf = requestAnimationFrame(loop);
    })();
  }
  function stopConfetti() {
    cancelAnimationFrame(confettiRaf);
    const cv = $('#confetti');
    cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
  }

  /* ---------- Controles ---------- */
  $('#btnDraw').onclick = drawBall;
  $('#btnAuto').onclick = toggleAuto;
  $('#btnUndo').onclick = undo;
  function renderSound() { $('#btnSound').textContent = S.sound ? '🔊 Voz: sí' : '🔇 Voz: no'; }
  $('#btnSound').onclick = () => { S.sound = !S.sound; save(); renderSound(); };
  $('#btnNew').onclick = () => {
    if (!confirm('¿Reiniciar todo? Se borran las balotas y los ganadores (las cartulinas se conservan).')) return;
    stopAuto();
    S.called = []; S.wins = {}; S.current = 'B';
    save();
    showBall(0);
    renderAll();
  };
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !document.querySelector('.overlay.show') && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(document.activeElement.tagName)) {
      e.preventDefault();
      drawBall();
    }
  });

  B.onExternalChange((k) => {
    if (k === 'cards') { cards = B.loadCards(); renderHistory(); renderBoard(); }
    if (k === 'logo') renderLogo();
  });

  function renderAll() {
    renderLogo(); renderGames(); renderGameCard(); renderBoard(); renderHistory(); renderSound();
  }
  B.mountRoundPicker($('#roundPick'));
  buildBoard();
  showBall(S.called[S.called.length - 1]);
  renderAll();
})();
