/* Bingo Virtual
   Lógica compartida entre la sala de juego (index.html) y el generador (cartulinas.html). */
(function (global) {
  'use strict';

  /* Rondas: cada ronda tiene sus propias cartulinas, balotas y ganadores.
     La ronda 1 usa las llaves originales, así no se pierde nada de lo ya generado. */
  const ROUNDS_KEY = 'bingo_rounds_v1'; // gitleaks:allow (localStorage key name, not a secret)
  const BACKUPS_KEY = 'bingo_backups_v1';
  function roundsData() {
    const d = lsGet(ROUNDS_KEY, null);
    if (d && Array.isArray(d.rounds) && d.rounds.length) return d;
    return { active: 1, rounds: [{ id: 1, name: 'Ronda 1' }] };
  }
  const activeRound = () => roundsData().active;
  const roundName = (id) => (roundsData().rounds.find((r) => r.id === id) || {}).name || 'Ronda ' + id;
  const rk = (base) => { const id = activeRound(); return id === 1 ? base : `${base}_r${id}`; };

  const KEYS = {
    get cards() { return rk('bingo_cards_v1'); },
    get state() { return rk('bingo_state_v1'); },
    get next() { return rk('bingo_next_v1'); },
    logo: 'bingo_logo_v1',
    rounds: ROUNDS_KEY
  };

  function setActiveRound(id) {
    const d = roundsData();
    d.active = id;
    lsSet(ROUNDS_KEY, d);
  }
  function addRound(name) {
    const d = roundsData();
    const id = Math.max(...d.rounds.map((r) => r.id)) + 1;
    d.rounds.push({ id, name: name || 'Ronda ' + id });
    d.active = id;
    lsSet(ROUNDS_KEY, d);
    return id;
  }
  function renameRound(id, name) {
    const d = roundsData();
    const r = d.rounds.find((x) => x.id === id);
    if (r && name) { r.name = name; lsSet(ROUNDS_KEY, d); }
  }

  function mountRoundPicker(el) {
    const d = roundsData();
    el.className = 'roundpick';
    el.innerHTML = '<span class="rl">RONDA</span><select></select><button type="button" class="rbtn" title="Crear una ronda nueva">＋ Nueva</button><button type="button" class="rbtn" title="Cambiar el nombre de la ronda">✎</button>';
    const sel = el.querySelector('select');
    d.rounds.forEach((r) => {
      const o = document.createElement('option');
      o.value = r.id;
      o.textContent = r.name;
      if (r.id === d.active) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = () => { setActiveRound(+sel.value); location.reload(); };
    const [bNew, bRen] = el.querySelectorAll('button');
    bNew.onclick = () => {
      const next = Math.max(...roundsData().rounds.map((r) => r.id)) + 1;
      const name = prompt('Nombre de la nueva ronda (empieza totalmente vacía: sin cartulinas, balotas ni ganadores):', 'Ronda ' + next);
      if (name === null) return;
      addRound(name.trim() || 'Ronda ' + next);
      location.reload();
    };
    bRen.onclick = () => {
      const name = prompt('Nuevo nombre para esta ronda:', roundName(d.active));
      if (name && name.trim()) { renameRound(d.active, name.trim()); location.reload(); }
    };
  }

  /* ---------- Copias de seguridad automáticas ---------- */
  function listBackups() {
    return lsGet(BACKUPS_KEY, []).filter((b) => b.round === activeRound());
  }
  function snapshot(reason) {
    const all = lsGet(BACKUPS_KEY, []);
    all.push({ ts: Date.now(), round: activeRound(), reason, cards: lsGet(KEYS.cards, []) });
    while (all.length > 25) all.shift();
    lsSet(BACKUPS_KEY, all);
  }
  // Copia en archivo dentro de la carpeta "copias" (solo si se abrió con Iniciar Bingo.bat)
  function pushDisk() {
    try {
      fetch('/api/backup', {
        method: 'POST',
        body: JSON.stringify({ round: activeRound(), name: roundName(activeRound()), ts: Date.now(), cards: lsGet(KEYS.cards, []) })
      }).catch(() => {});
    } catch (e) { /* sin servidor */ }
  }
  async function fetchDiskBackup() {
    try {
      const r = await fetch(`copias/respaldo-ronda-${activeRound()}.json?t=${Date.now()}`);
      if (!r.ok) return null;
      const j = await r.json();
      return Array.isArray(j.cards) ? j : null;
    } catch (e) { return null; }
  }
  function restoreBackup(ts) {
    const b = lsGet(BACKUPS_KEY, []).find((x) => x.ts === ts && x.round === activeRound());
    if (!b) return false;
    replaceAll(b.cards, 'Antes de restaurar una copia');
    return true;
  }

  const LETTERS = ['B', 'I', 'N', 'G', 'O'];
  const LETTER_COLORS = ['#1e6fe0', '#d41367', '#7a3fd1', '#1fa65a', '#f59e0b'];
  const LETTER_INK = ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#2a1a00'];
  const RANGES = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];
  const FONT = '"Fredoka","Nunito","Segoe UI",Arial,sans-serif';

  /* ---------- Juegos (patrones) ---------- */
  // Dibuja la figura en una grilla 5x5: X = casilla que debe estar marcada
  const shape = (rows) => rows.flatMap((s, r) =>
    [...s].map((ch, c) => (ch === 'X' ? [r, c] : null)).filter(Boolean));
  const GAMES = [
    { id: 'B', label: 'Letra B', tag: 'B', color: LETTER_COLORS[0], cells: shape(['XXXX.', 'X...X', 'XXXX.', 'X...X', 'XXXX.']) },
    { id: 'I', label: 'Letra I', tag: 'I', color: LETTER_COLORS[1], cells: shape(['XXXXX', '..X..', '..X..', '..X..', 'XXXXX']) },
    { id: 'N', label: 'Letra N', tag: 'N', color: LETTER_COLORS[2], cells: shape(['X...X', 'XX..X', 'X.X.X', 'X..XX', 'X...X']) },
    { id: 'G', label: 'Letra G', tag: 'G', color: LETTER_COLORS[3], cells: shape(['.XXXX', 'X....', 'X.XXX', 'X...X', '.XXX.']) },
    { id: 'O', label: 'Letra O', tag: 'O', color: LETTER_COLORS[4], cells: shape(['.XXX.', 'X...X', 'X...X', 'X...X', '.XXX.']) },
    { id: '4E', label: '4 Esquinas', tag: '◰', cells: [[0, 0], [0, 4], [4, 0], [4, 4]], color: '#0ea5b7' },
    { id: 'X', label: 'Letra X', tag: 'X', cells: [0, 1, 2, 3, 4].flatMap((i) => [[i, i], [i, 4 - i]]), color: '#e11d48' },
    {
      id: 'MARCO', label: 'Marco', tag: '▢', color: '#8b5cf6',
      cells: [0, 1, 2, 3, 4].flatMap((i) => [[0, i], [4, i], [i, 0], [i, 4]])
        .filter((c, i, a) => a.findIndex((d) => d[0] === c[0] && d[1] === c[1]) === i)
    },
    {
      id: 'FULL', label: 'Cartón lleno', sub: 'Premio mayor', tag: '★', color: '#f7a81b',
      cells: [0, 1, 2, 3, 4].flatMap((r) => [0, 1, 2, 3, 4].map((c) => [r, c]))
    }
  ];

  /* ---------- Almacenamiento ---------- */
  const mem = {};
  function lsGet(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) {
      return key in mem ? mem[key] : fallback;
    }
  }
  function lsSet(key, value) {
    mem[key] = value;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* sin almacenamiento */ }
  }

  const loadCards = () => lsGet(KEYS.cards, []);
  const saveCards = (cards) => lsSet(KEYS.cards, cards);
  const nextNumber = () => lsGet(KEYS.next, 1);

  function loadState() {
    return Object.assign(
      { called: [], current: 'B', wins: {}, prizes: {}, interval: 8, sound: true },
      lsGet(KEYS.state, {})
    );
  }
  const saveState = (s) => lsSet(KEYS.state, s);

  function onExternalChange(cb) {
    window.addEventListener('storage', (e) => {
      const k = Object.keys(KEYS).find((n) => KEYS[n] === e.key);
      if (k) cb(k);
    });
  }

  /* ---------- Generación de cartulinas ---------- */
  function sample(min, max, k) {
    const a = [];
    for (let i = min; i <= max; i++) a.push(i);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, k);
  }

  // 25 posiciones por filas; el centro (índice 12) es el espacio LIBRE = 0
  function newNums() {
    const cols = RANGES.map(([a, b], i) => sample(a, b, i === 2 ? 4 : 5));
    const nums = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (c === 2) nums.push(r === 2 ? 0 : cols[2][r < 2 ? r : r - 1]);
        else nums.push(cols[c][r]);
      }
    }
    return nums;
  }

  function addCards({ buyer, seller, qty }) {
    const cards = loadCards();
    const seen = new Set(cards.map((c) => c.nums.join(',')));
    let n = Math.max(nextNumber(), cards.reduce((m, c) => Math.max(m, c.n + 1), 1));
    const created = [];
    while (created.length < qty) {
      const nums = newNums();
      const key = nums.join(',');
      if (seen.has(key)) continue; // nunca dos cartulinas iguales
      seen.add(key);
      created.push({ n: n++, buyer, seller, nums, ts: Date.now() });
    }
    saveCards(cards.concat(created));
    lsSet(KEYS.next, n);
    snapshot(`Al generar ${qty} cartulina(s) para ${buyer}`);
    pushDisk();
    return created;
  }

  function deleteCard(n) {
    snapshot(`Antes de eliminar la cartulina Nº ${pad(n)}`);
    saveCards(loadCards().filter((c) => c.n !== n));
    pushDisk();
  }

  function replaceAll(cards, reason) {
    snapshot(reason || 'Antes de reemplazar el registro');
    saveCards(cards);
    lsSet(KEYS.next, Math.max(nextNumber(), cards.reduce((m, c) => Math.max(m, c.n + 1), 1)));
    pushDisk();
  }

  /* ---------- Reglas de juego ---------- */
  const letterOf = (n) => LETTERS[Math.min(4, Math.floor((n - 1) / 15))];
  const letterIdx = (n) => Math.min(4, Math.floor((n - 1) / 15));
  const pad = (n) => String(n).padStart(3, '0');

  function isWin(card, game, calledSet) {
    return game.cells.every(([r, c]) => {
      const v = card.nums[r * 5 + c];
      return v === 0 || calledSet.has(v);
    });
  }

  function missing(card, game, calledSet) {
    return game.cells.filter(([r, c]) => {
      const v = card.nums[r * 5 + c];
      return v !== 0 && !calledSet.has(v);
    }).length;
  }

  /* ---------- Logo ---------- */
  let logoImg;
  function getLogoUrl() { return lsGet(KEYS.logo, ''); }

  function getLogoImage() {
    const url = getLogoUrl();
    if (!url) return Promise.resolve(null);
    if (logoImg && logoImg.src === url) return Promise.resolve(logoImg);
    return new Promise((res) => {
      const img = new Image();
      img.onload = () => { logoImg = img; res(img); };
      img.onerror = () => res(null);
      img.src = url;
    });
  }

  function pickLogo() {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = 'image/*';
      inp.onchange = () => {
        const f = inp.files && inp.files[0];
        if (!f) return resolve(false);
        const fr = new FileReader();
        fr.onload = () => {
          const img = new Image();
          img.onload = () => {
            const k = Math.min(1, 600 / Math.max(img.width, img.height));
            const cv = document.createElement('canvas');
            cv.width = Math.round(img.width * k);
            cv.height = Math.round(img.height * k);
            cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
            lsSet(KEYS.logo, cv.toDataURL('image/png'));
            logoImg = null;
            resolve(true);
          };
          img.onerror = () => resolve(false);
          img.src = fr.result;
        };
        fr.readAsDataURL(f);
      };
      inp.click();
    });
  }

  /* ---------- Dibujo de la cartulina ---------- */
  const W = 1000, H = 1560;

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fitText(ctx, text, maxW, size, min, weight) {
    let s = size;
    ctx.font = `${weight} ${s}px ${FONT}`;
    while (ctx.measureText(text).width > maxW && s > min) {
      s -= 2;
      ctx.font = `${weight} ${s}px ${FONT}`;
    }
    let t = text;
    while (ctx.measureText(t).width > maxW && t.length > 1) t = t.slice(0, -1);
    return t === text ? t : t.trimEnd() + '…';
  }

  async function drawCard(canvas, card, opts) {
    opts = opts || {};
    const scale = opts.scale || 1;
    const called = opts.called || null;
    try { await document.fonts.load(`700 40px ${FONT}`); } catch (e) { /* usa fuente de respaldo */ }
    const logo = await getLogoImage();

    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Marco exterior
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0a2260');
    bg.addColorStop(1, '#17458f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Panel interior
    ctx.save();
    rr(ctx, 22, 22, W - 44, H - 44, 40);
    ctx.clip();
    ctx.fillStyle = '#fff8e7';
    ctx.fillRect(0, 0, W, H);

    // Encabezado
    const hd = ctx.createLinearGradient(0, 22, W, 300);
    hd.addColorStop(0, '#0a2260');
    hd.addColorStop(1, '#1b55b5');
    ctx.fillStyle = hd;
    ctx.fillRect(0, 22, W, 262);
    ctx.fillStyle = '#f7a81b';
    ctx.fillRect(0, 284, W, 12);
    ctx.restore();

    // Logo
    ctx.beginPath();
    ctx.arc(150, 153, 100, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#f7a81b';
    ctx.stroke();
    if (logo) {
      const k = Math.min(160 / logo.width, 160 / logo.height);
      const lw = logo.width * k, lh = logo.height * k;
      ctx.drawImage(logo, 150 - lw / 2, 153 - lh / 2, lw, lh);
    } else {
      ctx.fillStyle = '#d41367';
      ctx.font = `700 120px ${FONT}`;
      ctx.fillText('B', 150, 160);
    }

    // Títulos
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(fitText(ctx, 'CARTULINA OFICIAL', 660, 36, 20, 700), 285, 112);
    ctx.fillStyle = '#ffc94d';
    ctx.fillText(fitText(ctx, 'BINGO VIRTUAL', 660, 104, 40, 700), 285, 198);

    // Letras B-I-N-G-O
    const gx = 60, gap = 10, cell = 168;
    ctx.textAlign = 'center';
    for (let c = 0; c < 5; c++) {
      const x = gx + c * (cell + gap);
      rr(ctx, x, 320, cell, 100, 24);
      ctx.fillStyle = LETTER_COLORS[c];
      ctx.fill();
      ctx.fillStyle = LETTER_INK[c];
      ctx.font = `700 78px ${FONT}`;
      ctx.fillText(LETTERS[c], x + cell / 2, 374);
    }

    // Casillas
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const x = gx + c * (cell + gap);
        const y = 440 + r * (cell + gap + 0);
        const v = card.nums[r * 5 + c];
        rr(ctx, x, y, cell, cell, 22);
        if (v === 0) {
          const fg = ctx.createLinearGradient(x, y, x + cell, y + cell);
          fg.addColorStop(0, '#e11d74');
          fg.addColorStop(1, '#a30b52');
          ctx.fillStyle = fg;
          ctx.fill();
          ctx.fillStyle = '#ffd36b';
          ctx.font = `700 70px ${FONT}`;
          ctx.fillText('★', x + cell / 2, y + cell / 2 - 14);
          ctx.fillStyle = '#ffffff';
          ctx.font = `700 30px ${FONT}`;
          ctx.fillText('LIBRE', x + cell / 2, y + cell / 2 + 46);
        } else {
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.lineWidth = 5;
          ctx.strokeStyle = LETTER_COLORS[c] + '66';
          ctx.stroke();
          ctx.fillStyle = '#0f2a66';
          ctx.font = `700 88px ${FONT}`;
          ctx.fillText(String(v), x + cell / 2, y + cell / 2 + 4);
          if (called && called.has(v)) {
            ctx.beginPath();
            ctx.arc(x + cell / 2, y + cell / 2, 72, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(212,19,103,0.38)';
            ctx.fill();
            ctx.lineWidth = 7;
            ctx.strokeStyle = '#d41367';
            ctx.stroke();
          }
        }
      }
    }

    // Pie: número, comprador y vendedor
    const nb = ctx.createLinearGradient(60, 1345, 360, 1510);
    nb.addColorStop(0, '#0a2260');
    nb.addColorStop(1, '#1b55b5');
    rr(ctx, 60, 1345, 300, 165, 26);
    ctx.fillStyle = nb;
    ctx.fill();
    ctx.fillStyle = '#ffc94d';
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText('CARTULINA', 210, 1382);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 92px ${FONT}`;
    ctx.fillText('Nº ' + pad(card.n), 210, 1452);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#6b7aa0';
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText('COMPRADOR', 392, 1368);
    ctx.fillStyle = '#0f2a66';
    ctx.fillText(fitText(ctx, card.buyer, 548, 46, 24, 700), 392, 1410);
    ctx.fillStyle = '#6b7aa0';
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText('VENDIDA POR', 392, 1458);
    ctx.fillStyle = '#d41367';
    ctx.fillText(fitText(ctx, card.seller, 548, 36, 20, 700), 392, 1493);
    ctx.textAlign = 'center';
  }

  /* ---------- Descargas ---------- */
  const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'sin-nombre';

  const fileName = (card, fmt) => `Cartulina-${pad(card.n)}-${slug(card.buyer)}.${fmt}`;

  function canvasBlob(canvas, fmt) {
    return new Promise((res) => {
      if (fmt === 'jpg') canvas.toBlob(res, 'image/jpeg', 0.95);
      else canvas.toBlob(res, 'image/png');
    });
  }

  async function renderBlob(card, fmt) {
    const cv = document.createElement('canvas');
    await drawCard(cv, card, { scale: 1 });
    return canvasBlob(cv, fmt);
  }

  function saveBlob(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  async function downloadCard(card, fmt) {
    saveBlob(await renderBlob(card, fmt), fileName(card, fmt));
  }

  /* ZIP sin compresión (los PNG/JPG ya vienen comprimidos), sin librerías externas */
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  async function makeZip(files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    const d = new Date();
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const data = new Uint8Array(await f.blob.arrayBuffer());
      const name = enc.encode(f.name);
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint16(8, 0, true); lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true);
      lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(lh.buffer, name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true);
      ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true); ch.setUint16(12, dosTime, true);
      ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true);
      ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(ch.buffer, name);
      offset += 30 + name.length + data.length;
    }
    const csize = central.reduce((a, b) => a + b.byteLength, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [end.buffer]), { type: 'application/zip' });
  }

  // Si se cambia de ronda desde otra pestaña, esta se recarga para quedar en la misma ronda
  window.addEventListener('storage', (e) => { if (e.key === ROUNDS_KEY) location.reload(); });

  global.Bingo = {
    activeRound, roundName, mountRoundPicker, listBackups, restoreBackup, fetchDiskBackup,
    LETTERS, LETTER_COLORS, LETTER_INK, GAMES, KEYS,
    loadCards, saveCards, addCards, deleteCard, replaceAll, nextNumber,
    loadState, saveState, onExternalChange,
    letterOf, letterIdx, pad, isWin, missing,
    getLogoUrl, pickLogo, drawCard, slug, fileName,
    renderBlob, saveBlob, downloadCard, makeZip
  };
})(window);
