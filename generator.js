/* Generador de cartulinas - Bingo Virtual */
(function () {
  'use strict';
  const B = window.Bingo;
  const $ = (s) => document.querySelector(s);
  let batch = [];
  let viewing = null;

  const fmt = () => $('#fmt').value;
  const fmtDate = (ts) => new Date(ts).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });

  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }

  function renderLogo() {
    const slot = $('#logoSlot');
    const url = B.getLogoUrl();
    slot.innerHTML = url ? '<img alt="Logo">' : 'B';
    if (url) slot.firstChild.src = url;
  }
  $('#logoSlot').onclick = async () => { if (await B.pickLogo()) { renderLogo(); toast('Logo actualizado'); } };

  /* ---------- Generación ---------- */
  $('#form').onsubmit = async (e) => {
    e.preventDefault();
    const seller = $('#seller').value.trim();
    const buyer = $('#buyer').value.trim();
    const qty = Math.max(1, Math.min(100, parseInt($('#qty').value, 10) || 1));
    if (!seller || !buyer) return;
    batch = B.addCards({ buyer, seller, qty });
    $('#resultSec').hidden = false;
    $('#resultMsg').textContent = `${qty} cartulina(s) para ${buyer} (vendidas por ${seller}): Nº ${B.pad(batch[0].n)}${qty > 1 ? ' a Nº ' + B.pad(batch[qty - 1].n) : ''}`;
    $('#resultSec').scrollIntoView({ behavior: 'smooth', block: 'start' });
    await renderBatch();
    renderRegistry();
    $('#buyer').value = '';
    $('#qty').value = 1;
    renderPreview();
  };

  /* ---------- Controles del formulario ---------- */
  $('#qMinus').onclick = () => { $('#qty').value = Math.max(1, (+$('#qty').value || 1) - 1); };
  $('#qPlus').onclick = () => { $('#qty').value = Math.min(100, (+$('#qty').value || 1) + 1); };
  document.querySelectorAll('#fmtSeg button').forEach((b) => {
    b.onclick = () => {
      document.querySelectorAll('#fmtSeg button').forEach((x) => x.classList.toggle('on', x === b));
      $('#fmt').value = b.dataset.f;
    };
  });

  /* ---------- Vista previa en vivo ---------- */
  const SAMPLE = [5, 21, 33, 52, 64, 11, 17, 41, 58, 70, 3, 29, 0, 49, 66, 8, 24, 38, 55, 72, 14, 30, 44, 47, 61];
  let pvTimer;
  function renderPreview() {
    clearTimeout(pvTimer);
    pvTimer = setTimeout(() => {
      const next = Math.max(...B.loadCards().map((c) => c.n), B.nextNumber() - 1, 0) + 1;
      B.drawCard($('#pvCanvas'), {
        n: next,
        buyer: $('#buyer').value.trim() || 'Nombre del comprador',
        seller: $('#seller').value.trim() || 'Nombre del socio',
        nums: SAMPLE
      }, { scale: 0.4 });
    }, 120);
  }
  $('#buyer').addEventListener('input', renderPreview);
  $('#seller').addEventListener('input', renderPreview);

  async function renderBatch() {
    const box = $('#batch');
    box.innerHTML = '';
    for (const c of batch) {
      const t = document.createElement('div');
      t.className = 'tile';
      t.innerHTML = '<canvas></canvas><div class="cap"></div><button class="btn gold small">⬇ Descargar</button>';
      t.querySelector('.cap').textContent = `Nº ${B.pad(c.n)} · ${c.buyer}`;
      t.querySelector('button').onclick = () => B.downloadCard(c, fmt());
      box.appendChild(t);
      await B.drawCard(t.querySelector('canvas'), c, { scale: 0.3 });
    }
  }

  async function zipCards(list, name) {
    if (!list.length) return toast('No hay cartulinas para descargar');
    toast('Preparando ZIP, un momento...');
    const files = [];
    for (const c of list) files.push({ name: B.fileName(c, fmt()), blob: await B.renderBlob(c, fmt()) });
    B.saveBlob(await B.makeZip(files), name);
  }
  $('#zipBatch').onclick = () => zipCards(batch, `Cartulinas-${B.slug(batch[0].buyer)}.zip`);

  /* ---------- Registro ---------- */
  function filtered() {
    const q = $('#search').value.trim().toLowerCase();
    const all = B.loadCards();
    if (!q) return all;
    return all.filter((c) => String(c.n) === q || B.pad(c.n) === q ||
      c.buyer.toLowerCase().includes(q) || c.seller.toLowerCase().includes(q));
  }

  function renderRegistry() {
    const all = B.loadCards();
    const bySeller = {};
    all.forEach((c) => { bySeller[c.seller] = (bySeller[c.seller] || 0) + 1; });
    $('#stTotal').textContent = all.length;
    $('#stSellers').textContent = Object.keys(bySeller).length;
    $('#stBuyers').textContent = new Set(all.map((c) => c.buyer.toLowerCase())).size;
    const rank = $('#rank');
    rank.innerHTML = '';
    const max = Math.max(1, ...Object.values(bySeller));
    Object.keys(bySeller).sort((a, b) => bySeller[b] - bySeller[a]).forEach((s) => {
      const r = document.createElement('div');
      r.className = 'rk';
      r.innerHTML = '<i></i><span></span><span></span>';
      r.querySelector('i').style.width = (bySeller[s] / max * 100) + '%';
      r.children[1].textContent = s;
      r.children[2].textContent = bySeller[s];
      rank.appendChild(r);
    });
    $('#emptyMsg').hidden = all.length > 0;
    renderPreview();

    const dl = (id, vals) => { $(id).innerHTML = ''; [...new Set(vals)].forEach((v) => { const o = document.createElement('option'); o.value = v; $(id).appendChild(o); }); };
    dl('#sellers', all.map((c) => c.seller));
    dl('#buyers', all.map((c) => c.buyer));

    const body = $('#rows');
    body.innerHTML = '';
    filtered().slice().reverse().forEach((c) => {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td></td><td></td><td></td><td></td><td class="actions"></td>';
      const tds = tr.children;
      tds[0].innerHTML = '<span class="pill"></span>';
      tds[0].firstChild.textContent = B.pad(c.n);
      tds[1].textContent = c.buyer;
      tds[2].textContent = c.seller;
      tds[3].textContent = fmtDate(c.ts);
      const view = document.createElement('button');
      view.className = 'btn ghost small'; view.textContent = 'Ver';
      view.onclick = () => openView(c);
      const dlb = document.createElement('button');
      dlb.className = 'btn gold small'; dlb.textContent = '⬇';
      dlb.onclick = () => B.downloadCard(c, fmt());
      const del = document.createElement('button');
      del.className = 'btn danger small'; del.textContent = '🗑';
      del.onclick = () => {
        if (!confirm(`¿Eliminar la cartulina Nº ${B.pad(c.n)} de ${c.buyer}? Dejará de poder ganar.`)) return;
        const typed = prompt(`Confirmación final: escribe el número ${c.n} para eliminar la cartulina de ${c.buyer}.\n(Se guarda una copia automática antes de borrar.)`);
        if (typed === null) return;
        if (String(typed).trim().replace(/^0+/, '') !== String(c.n)) { toast('El número no coincide. No se eliminó nada.'); return; }
        B.deleteCard(c.n);
        renderRegistry();
        toast(`Cartulina Nº ${B.pad(c.n)} eliminada. Puedes recuperarla en Copias de seguridad.`);
      };
      tds[4].append(view, dlb, del);
      body.appendChild(tr);
    });
  }
  $('#search').oninput = renderRegistry;
  $('#zipAll').onclick = () => zipCards(filtered(), 'Cartulinas-registro.zip');

  /* ---------- Vista individual ---------- */
  async function openView(c) {
    viewing = c;
    $('#viewTitle').textContent = `Nº ${B.pad(c.n)} · ${c.buyer}`;
    $('#viewOverlay').classList.add('show');
    await B.drawCard($('#viewCanvas'), c, { scale: 0.5 });
  }
  $('#viewClose').onclick = () => $('#viewOverlay').classList.remove('show');
  $('#viewDl').onclick = () => viewing && B.downloadCard(viewing, fmt());

  /* ---------- CSV y respaldo ---------- */
  $('#csv').onclick = () => {
    const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    const lines = ['Numero,Comprador,Vendedor,Fecha'].concat(
      B.loadCards().map((c) => [c.n, q(c.buyer), q(c.seller), q(fmtDate(c.ts))].join(','))
    );
    B.saveBlob(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' }), 'registro-cartulinas.csv');
  };
  $('#backup').onclick = () => {
    B.saveBlob(new Blob([JSON.stringify(B.loadCards())], { type: 'application/json' }), 'respaldo-cartulinas.json');
  };
  $('#restore').onclick = () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json';
    inp.onchange = async () => {
      try {
        const data = JSON.parse(await inp.files[0].text());
        if (!Array.isArray(data) || !data.every((c) => c.n && Array.isArray(c.nums) && c.nums.length === 25)) throw new Error('formato');
        if (!confirm(`Esto reemplaza el registro actual por ${data.length} cartulinas del respaldo. ¿Continuar?`)) return;
        B.replaceAll(data);
        renderRegistry();
        toast('Respaldo restaurado');
      } catch (err) { toast('El archivo no es un respaldo válido'); }
    };
    inp.click();
  };

  /* ---------- Copias de seguridad ---------- */
  function renderBackups() {
    const box = $('#blist');
    const list = B.listBackups().slice().reverse();
    box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<div class="empty">Aún no hay copias en esta ronda. Se crean solas al generar cartulinas.</div>'; return; }
    list.forEach((b) => {
      const row = document.createElement('div');
      row.className = 'brow2';
      row.innerHTML = '<div><b></b><div class="muted"></div></div><button class="btn ghost small">Restaurar</button>';
      row.querySelector('b').textContent = fmtDate(b.ts) + ' · ' + b.cards.length + ' cartulinas';
      row.querySelector('.muted').textContent = b.reason;
      row.querySelector('button').onclick = () => {
        if (!confirm(`¿Restaurar la copia del ${fmtDate(b.ts)} con ${b.cards.length} cartulinas? El estado actual se guarda antes como otra copia.`)) return;
        B.restoreBackup(b.ts);
        renderRegistry();
        renderBackups();
        toast('Copia restaurada');
      };
      box.appendChild(row);
    });
  }
  const _renderRegistry = renderRegistry;
  renderRegistry = function () { _renderRegistry(); renderBackups(); };

  async function restoreFromDisk(ask) {
    const j = await B.fetchDiskBackup();
    if (!j || !j.cards.length) { if (!ask) toast('No hay copia en la carpeta "copias" para esta ronda'); return; }
    if (!confirm(`Encontré una copia en la carpeta "copias" con ${j.cards.length} cartulinas (${fmtDate(j.ts)}). ¿Restaurarla en ${B.roundName(B.activeRound())}?`)) return;
    B.replaceAll(j.cards, 'Antes de restaurar desde la carpeta copias');
    renderRegistry();
    toast('Restaurado desde la carpeta copias');
  }
  $('#diskRestore').onclick = () => restoreFromDisk(false);

  B.mountRoundPicker($('#roundPick'));
  $('#roundLabel').textContent = B.roundName(B.activeRound());
  B.onExternalChange((k) => { if (k === 'logo') renderLogo(); if (k === 'cards') renderRegistry(); });
  renderLogo();
  renderRegistry();
  // Si esta ronda está vacía pero hay copia en disco (por ejemplo se borraron los datos del navegador), ofrecerla
  if (!B.loadCards().length) restoreFromDisk(true);
})();
