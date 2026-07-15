/* ============================================================
   Life Management — tətbiq məntiqi
   Hissə 1: Ana Səhifə (termometr paneli)
   Hissə 2: Hər kanal üçün Trello tərzi kanban
   ============================================================ */

'use strict';

// ---------------- Kanallar ----------------

const CHANNELS = [
  { id: 'azerconnect', name: 'Azerconnect',  color: '#0071e3', desc: 'Tam zamanlı iş — AI Content Creator' },
  { id: 'azliderqrup', name: 'Azliderqrup',  color: '#34c759', desc: 'Frilans — Qrafik və Motion dizayn' },
  { id: 'brendinq',    name: 'Brendinq',     color: '#ff9500', desc: 'YouTube və sosial media' },
  { id: 'sexsi',       name: 'Şəxsi həyat',  color: '#af52de', desc: 'İşdən kənar şəxsi məsələlər' }
];

const PRIORITY_LABEL = { low: 'Aşağı', medium: 'Orta', high: 'Yüksək' };

// ---------------- Məlumat modeli və saxlanma ----------------

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultBoard() {
  return {
    columns: [
      { id: uid(), title: 'Ediləcək',  done: false, tasks: [] },
      { id: uid(), title: 'İcradadır', done: false, tasks: [] },
      { id: uid(), title: 'Bitdi',     done: true,  tasks: [] }
    ]
  };
}

function defaultData() {
  const boards = {};
  CHANNELS.forEach(ch => { boards[ch.id] = defaultBoard(); });
  return { version: 1, boards };
}

let state = null;

async function loadState() {
  let data = null;
  if (window.api && window.api.loadData) {
    data = await window.api.loadData();
  } else {
    try { data = JSON.parse(localStorage.getItem('lifemanagement-data')); } catch (e) { data = null; }
  }
  if (!data || !data.boards) data = defaultData();
  // Yeni kanal əlavə olunubsa, lövhəsini yarat
  CHANNELS.forEach(ch => { if (!data.boards[ch.id]) data.boards[ch.id] = defaultBoard(); });
  if (!data.integrations) data.integrations = {};
  state = data;
}

function persistLocal() {
  if (window.api && window.api.saveData) {
    window.api.saveData(JSON.parse(JSON.stringify(state)));
  } else {
    localStorage.setItem('lifemanagement-data', JSON.stringify(state));
  }
}

let saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    state.updatedAt = Date.now();
    persistLocal();
    schedulePush();
  }, 150);
}

// ---------------- Tarix köməkçiləri ----------------

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  return Math.round((d - today) / 86400000);
}

const AZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
const AZ_WEEKDAYS = ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə'];

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.getDate() + ' ' + AZ_MONTHS[d.getMonth()];
}

function formatFullDate(d) {
  return d.getDate() + ' ' + AZ_MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}

function deadlineChip(task) {
  const days = daysUntil(task.deadline);
  if (days === null) return null;
  if (days < 0)  return { cls: 'chip-deadline-over', text: formatDate(task.deadline) + ' · gecikib' };
  if (days === 0) return { cls: 'chip-deadline-over', text: 'Bu gün' };
  if (days === 1) return { cls: 'chip-deadline-soon', text: 'Sabah' };
  if (days <= 3) return { cls: 'chip-deadline-soon', text: formatDate(task.deadline) + ' · ' + days + ' gün' };
  return { cls: 'chip-deadline-ok', text: formatDate(task.deadline) };
}

// ---------------- Hərarət (risk) hesablanması ----------------

function taskWeight(task) {
  const days = daysUntil(task.deadline);
  let w;
  if (days === null) w = 1;        // deadline yoxdur
  else if (days < 0) w = 5;        // gecikib
  else if (days <= 1) w = 4;       // bu gün / sabah
  else if (days <= 3) w = 3;
  else if (days <= 7) w = 2;
  else w = 1;
  const mult = { low: 0.7, medium: 1, high: 1.5 }[task.priority || 'medium'];
  return w * mult;
}

function channelStats(channelId) {
  const board = state.boards[channelId];
  let score = 0, open = 0, overdue = 0, soon = 0;
  let nearest = null;
  board.columns.forEach(col => {
    if (col.done) return; // tamamlanmış sütunlar hesablanmır
    col.tasks.forEach(task => {
      open++;
      score += taskWeight(task);
      const days = daysUntil(task.deadline);
      if (days !== null) {
        if (days < 0) overdue++;
        else if (days <= 3) soon++;
        if (days >= 0 && (nearest === null || days < nearest)) nearest = days;
      }
    });
  });
  // Yumşaq doyma əyrisi: az ballar aydın fərqlənir, çox ballar 100-ə yaxınlaşır
  const heat = Math.round(100 * (1 - Math.exp(-score / 12)));
  return { heat, open, overdue, soon, nearest };
}

function heatColor(heat) {
  const t = heat / 100;
  // Qeyri-xətti keçid: göy → yaşıl → sarı → narıncı → qırmızı.
  // Üstlü əyri sarı-yaşıl zonanı sıxır ki, yüksək risk narıncı-qırmızı görünsün.
  const hue = 205 * Math.pow(1 - t, 1.7);
  const sat = 85 + 5 * t;
  const light = 64 - 12 * t;
  return `hsl(${hue.toFixed(0)}, ${sat.toFixed(0)}%, ${light.toFixed(0)}%)`;
}

function heatLabel(heat) {
  if (heat >= 75) return 'Kritik';
  if (heat >= 50) return 'Yüksək';
  if (heat >= 25) return 'Orta';
  return 'Sakit';
}

// ---------------- Naviqasiya ----------------

const navEl = document.getElementById('nav');
const mainEl = document.getElementById('main');
let activeView = 'home';

function buildNav() {
  CHANNELS.forEach(ch => {
    const btn = document.createElement('button');
    btn.className = 'nav-item';
    btn.dataset.view = ch.id;
    btn.innerHTML = `<span class="nav-dot" style="background:${ch.color}"></span> ${ch.name} <span class="nav-count"></span>`;
    navEl.appendChild(btn);
  });
  navEl.addEventListener('click', e => {
    const btn = e.target.closest('.nav-item');
    if (btn) showView(btn.dataset.view);
  });
}

function showView(viewId) {
  activeView = viewId;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === viewId));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + viewId);
  if (el) el.classList.add('active');
  if (viewId === 'home') renderHome();
  else renderBoard(viewId);
  updateNavCounts();
}

function renderCurrent() {
  if (activeView === 'home') renderHome();
  else renderBoard(activeView);
  updateNavCounts();
}

function updateNavCounts() {
  CHANNELS.forEach(ch => {
    const btn = navEl.querySelector(`.nav-item[data-view="${ch.id}"] .nav-count`);
    if (btn) {
      const s = channelStats(ch.id);
      btn.textContent = s.open > 0 ? s.open : '';
    }
  });
}

// ---------------- Hissə 1: Ana Səhifə ----------------

function renderHome() {
  const grid = document.getElementById('thermo-grid');
  grid.innerHTML = '';

  CHANNELS.forEach(ch => {
    const s = channelStats(ch.id);
    const color = heatColor(s.heat);
    const fillH = Math.max(4, s.heat);

    const card = document.createElement('div');
    card.className = 'thermo-card';
    card.innerHTML = `
      <div class="thermo-name">${ch.name}</div>
      <div class="thermo-status">${heatLabel(s.heat)}</div>
      <div class="thermo">
        <div class="thermo-tube">
          <div class="thermo-fill" style="height:${fillH}%; background:${color}"></div>
          <div class="thermo-ticks">${'<span></span>'.repeat(5)}</div>
        </div>
        <div class="thermo-bulb" style="background:${color}"></div>
      </div>
      <div class="thermo-value">${s.heat}°</div>
      <div class="thermo-detail">${s.open} açıq task${s.overdue ? ` · ${s.overdue} gecikmiş` : ''}</div>
    `;
    card.addEventListener('click', () => showView(ch.id));
    grid.appendChild(card);
  });

  renderHomeSummary();
  const now = new Date();
  const sub = document.getElementById('home-subtitle');
  sub.textContent = 'Bütün kanalların gündəlik xülasəsi — ' +
    AZ_WEEKDAYS[now.getDay()] + ', ' + formatFullDate(now);
}

function renderHomeSummary() {
  const wrap = document.getElementById('home-summary');
  wrap.innerHTML = '';
  const sorted = CHANNELS
    .map(ch => ({ ch, s: channelStats(ch.id) }))
    .sort((a, b) => b.s.heat - a.s.heat);

  sorted.forEach(({ ch, s }) => {
    let text;
    if (s.open === 0) {
      text = 'Açıq task yoxdur — hər şey nəzarətdədir.';
    } else {
      const parts = [`${s.open} açıq task`];
      if (s.overdue) parts.push(`${s.overdue} gecikmiş`);
      if (s.soon) parts.push(`${s.soon} taskın deadline-ı 3 gün içindədir`);
      if (s.nearest !== null && !s.soon && !s.overdue) {
        parts.push(s.nearest === 0 ? 'ən yaxın deadline bu gündür' : `ən yaxın deadline ${s.nearest} gün sonradır`);
      }
      text = parts.join(' · ');
    }
    const color = heatColor(s.heat);
    const card = document.createElement('div');
    card.className = 'summary-card';
    card.innerHTML = `
      <span class="nav-dot" style="background:${ch.color}"></span>
      <span class="s-channel">${ch.name}</span>
      <span class="s-text">${text}</span>
      <span class="s-badge" style="background:${color}22; color:${color}">${heatLabel(s.heat)} · ${s.heat}°</span>
    `;
    wrap.appendChild(card);
  });
}

// ---------------- Hissə 2: Kanban ----------------

function ensureBoardViews() {
  CHANNELS.forEach(ch => {
    if (document.getElementById('view-' + ch.id)) return;
    const section = document.createElement('section');
    section.className = 'view view-board';
    section.id = 'view-' + ch.id;
    section.innerHTML = `
      <header class="view-header">
        <h1>${ch.name}</h1>
        <p class="subtitle">${ch.desc}</p>
      </header>
      <div class="kanban-toolbar" id="toolbar-${ch.id}"></div>
      <div class="board" data-channel="${ch.id}"></div>
    `;
    mainEl.appendChild(section);
  });
}

function renderToolbar(channelId) {
  const bar = document.getElementById('toolbar-' + channelId);
  const cfg = channelIntegration(channelId);
  const board = state.boards[channelId];
  bar.innerHTML = '';

  const intBtn = document.createElement('button');
  intBtn.className = 'tool-btn';
  intBtn.textContent = '🔗 İnteqrasiya';
  intBtn.title = 'Bu kanalı Trello və ya Notion-a bağla';
  intBtn.addEventListener('click', () => openIntModal(channelId));
  bar.appendChild(intBtn);

  if (cfg) {
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'tool-btn';
    refreshBtn.textContent = '⟳ Yenilə';
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = '⟳ Yenilənir...';
      await externalPull(channelId, true);
      refreshBtn.disabled = false;
      refreshBtn.textContent = '⟳ Yenilə';
    });
    bar.appendChild(refreshBtn);

    const info = document.createElement('span');
    info.className = 'toolbar-info';
    const src = cfg.type === 'trello' ? 'Trello' : 'Notion';
    const time = board.fetchedAt
      ? new Date(board.fetchedAt).getHours() + ':' + String(new Date(board.fetchedAt).getMinutes()).padStart(2, '0')
      : '—';
    info.textContent = `${src}-dan oxunur · son yenilənmə ${time} · redaktə üçün taska klik edin (${src}-da açılır)`;
    bar.appendChild(info);
  }
}

function renderBoard(channelId) {
  const boardEl = document.querySelector(`.board[data-channel="${channelId}"]`);
  const board = state.boards[channelId];
  const external = !!board.external;
  renderToolbar(channelId);
  boardEl.innerHTML = '';

  board.columns.forEach(col => {
    boardEl.appendChild(buildColumn(channelId, col, external));
  });

  if (!external) {
    const addBtn = document.createElement('button');
    addBtn.className = 'add-column-btn';
    addBtn.textContent = '+ Yeni sütun';
    addBtn.addEventListener('click', () => {
      board.columns.push({ id: uid(), title: 'Yeni sütun', done: false, tasks: [] });
      saveState();
      renderBoard(channelId);
    });
    boardEl.appendChild(addBtn);
  }
}

function buildColumn(channelId, col, external) {
  const board = state.boards[channelId];
  const colEl = document.createElement('div');
  colEl.className = 'column';
  colEl.dataset.columnId = col.id;

  // Başlıq
  const header = document.createElement('div');
  header.className = 'column-header';

  const titleInput = document.createElement('input');
  titleInput.className = 'column-title';
  titleInput.value = col.title;
  if (external) {
    titleInput.readOnly = true;
    titleInput.title = 'Sütun xarici sistemdən oxunur';
  } else {
    titleInput.title = 'Adı dəyişmək üçün klikləyin';
    titleInput.addEventListener('change', () => {
      col.title = titleInput.value.trim() || 'Sütun';
      titleInput.value = col.title;
      saveState();
    });
    titleInput.addEventListener('keydown', e => { if (e.key === 'Enter') titleInput.blur(); });
  }

  const count = document.createElement('span');
  count.className = 'column-count';
  count.textContent = col.tasks.length;

  header.append(titleInput, count);

  if (!external) {
    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn danger';
    delBtn.title = 'Sütunu sil';
    delBtn.textContent = '✕';
    delBtn.addEventListener('click', () => {
      const msg = col.tasks.length
        ? `"${col.title}" sütununda ${col.tasks.length} task var. Sütun və taskları silinsin?`
        : `"${col.title}" sütunu silinsin?`;
      if (confirm(msg)) {
        board.columns = board.columns.filter(c => c.id !== col.id);
        saveState();
        renderBoard(channelId);
        updateNavCounts();
      }
    });
    header.appendChild(delBtn);
  }

  colEl.appendChild(header);

  // "Tamamlanmış" işarəsi — bu sütundakı tasklar hərarətə daxil edilmir
  const doneToggle = document.createElement('label');
  doneToggle.className = 'column-done-toggle';
  doneToggle.title = 'İşarələnərsə, bu sütundakı tasklar termometr hesablamasına daxil edilmir';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = !!col.done;
  cb.addEventListener('change', () => {
    col.done = cb.checked;
    if (external && col.externalId) {
      // Xarici sütunlar hər yenilənmədə yenidən qurulur — seçimi konfiqdə saxla
      const cfg = channelIntegration(channelId);
      if (cfg) { cfg.doneMap = cfg.doneMap || {}; cfg.doneMap[col.externalId] = cb.checked; }
    }
    saveState();
    updateNavCounts();
  });
  doneToggle.append(cb, document.createTextNode(' Tamamlanmış sütun'));
  colEl.appendChild(doneToggle);

  // Kartlar
  const cards = document.createElement('div');
  cards.className = 'cards';
  col.tasks.forEach(task => cards.appendChild(buildCard(channelId, col, task, external)));
  colEl.appendChild(cards);

  if (!external) {
    // Drag & drop hədəfi
    colEl.addEventListener('dragover', e => {
      e.preventDefault();
      colEl.classList.add('drag-over');
    });
    colEl.addEventListener('dragleave', e => {
      if (!colEl.contains(e.relatedTarget)) colEl.classList.remove('drag-over');
    });
    colEl.addEventListener('drop', e => {
      e.preventDefault();
      colEl.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/task-id');
      if (taskId) moveTask(channelId, taskId, col.id);
    });

    // Task əlavə et
    const addBtn = document.createElement('button');
    addBtn.className = 'add-card-btn';
    addBtn.textContent = '+ Task əlavə et';
    addBtn.addEventListener('click', () => {
      const title = prompt('Yeni taskın adı:');
      if (title && title.trim()) {
        col.tasks.push({
          id: uid(),
          title: title.trim(),
          desc: '',
          deadline: null,
          priority: 'medium',
          createdAt: todayStr()
        });
        saveState();
        renderBoard(channelId);
        updateNavCounts();
      }
    });
    colEl.appendChild(addBtn);
  }

  return colEl;
}

function buildCard(channelId, col, task, external) {
  const card = document.createElement('div');
  card.className = 'card' + (external ? ' card-external' : '');
  card.draggable = !external;
  card.dataset.taskId = task.id;

  const title = document.createElement('div');
  title.className = 'card-title';
  title.textContent = task.title;
  if (external) {
    const link = document.createElement('span');
    link.className = 'card-link-hint';
    link.textContent = ' ↗';
    title.appendChild(link);
  }
  card.appendChild(title);

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  const dl = deadlineChip(task);
  if (dl) {
    const chip = document.createElement('span');
    chip.className = 'chip ' + dl.cls;
    chip.textContent = dl.text;
    meta.appendChild(chip);
  }
  if (task.priority && task.priority !== 'medium') {
    const chip = document.createElement('span');
    chip.className = 'chip chip-pri-' + task.priority;
    chip.textContent = PRIORITY_LABEL[task.priority];
    meta.appendChild(chip);
  }
  if (meta.children.length) card.appendChild(meta);

  if (external) {
    card.title = 'Xarici sistemdə açmaq üçün klikləyin';
    card.addEventListener('click', () => { if (task.url) window.open(task.url, '_blank'); });
  } else {
    card.addEventListener('click', () => openTaskModal(channelId, col.id, task.id));
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/task-id', task.id);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  }

  return card;
}

function findTask(channelId, taskId) {
  const board = state.boards[channelId];
  for (const col of board.columns) {
    const task = col.tasks.find(t => t.id === taskId);
    if (task) return { col, task };
  }
  return null;
}

function moveTask(channelId, taskId, targetColumnId) {
  const found = findTask(channelId, taskId);
  if (!found || found.col.id === targetColumnId) return;
  const board = state.boards[channelId];
  const target = board.columns.find(c => c.id === targetColumnId);
  if (!target) return;
  found.col.tasks = found.col.tasks.filter(t => t.id !== taskId);
  target.tasks.push(found.task);
  saveState();
  renderBoard(channelId);
  updateNavCounts();
}

// ---------------- Task modal ----------------

const modalEl = document.getElementById('task-modal');
let modalCtx = null; // { channelId, columnId, taskId }

function openTaskModal(channelId, columnId, taskId) {
  const found = findTask(channelId, taskId);
  if (!found) return;
  modalCtx = { channelId, columnId: found.col.id, taskId };

  document.getElementById('modal-title').value = found.task.title;
  document.getElementById('modal-desc').value = found.task.desc || '';
  document.getElementById('modal-deadline').value = found.task.deadline || '';
  document.getElementById('modal-priority').value = found.task.priority || 'medium';

  const colSelect = document.getElementById('modal-column');
  colSelect.innerHTML = '';
  state.boards[channelId].columns.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.title;
    if (c.id === found.col.id) opt.selected = true;
    colSelect.appendChild(opt);
  });

  document.getElementById('modal-meta').textContent =
    found.task.createdAt ? 'Yaradılıb: ' + formatDate(found.task.createdAt) : '';

  modalEl.classList.remove('hidden');
  document.getElementById('modal-title').focus();
}

function closeTaskModal() {
  modalEl.classList.add('hidden');
  modalCtx = null;
}

function saveTaskModal() {
  if (!modalCtx) return;
  const found = findTask(modalCtx.channelId, modalCtx.taskId);
  if (!found) { closeTaskModal(); return; }

  found.task.title = document.getElementById('modal-title').value.trim() || found.task.title;
  found.task.desc = document.getElementById('modal-desc').value;
  found.task.deadline = document.getElementById('modal-deadline').value || null;
  found.task.priority = document.getElementById('modal-priority').value;

  const targetColId = document.getElementById('modal-column').value;
  const channelId = modalCtx.channelId;
  closeTaskModal();

  if (targetColId !== found.col.id) {
    moveTask(channelId, found.task.id, targetColId);
  } else {
    saveState();
    renderBoard(channelId);
    updateNavCounts();
  }
}

function deleteTaskModal() {
  if (!modalCtx) return;
  const found = findTask(modalCtx.channelId, modalCtx.taskId);
  if (found && confirm(`"${found.task.title}" taskı silinsin?`)) {
    found.col.tasks = found.col.tasks.filter(t => t.id !== modalCtx.taskId);
    const channelId = modalCtx.channelId;
    closeTaskModal();
    saveState();
    renderBoard(channelId);
    updateNavCounts();
  }
}

document.getElementById('modal-close').addEventListener('click', closeTaskModal);
document.getElementById('modal-save').addEventListener('click', saveTaskModal);
document.getElementById('modal-delete').addEventListener('click', deleteTaskModal);
modalEl.addEventListener('click', e => { if (e.target === modalEl) closeTaskModal(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !modalEl.classList.contains('hidden')) closeTaskModal();
});

// ---------------- Xarici inteqrasiyalar (Trello / Notion) ----------------

const DONE_NAME_RX = /bitdi|done|tamam|hazır|complete|finish/i;

function channelIntegration(channelId) {
  return (state.integrations || {})[channelId] || null;
}

async function jsonOk(res) {
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function pullTrello(cfg) {
  const auth = `key=${encodeURIComponent(cfg.key)}&token=${encodeURIComponent(cfg.token)}`;
  const [lists, cards] = await Promise.all([
    fetch(`https://api.trello.com/1/boards/${cfg.boardId}/lists?${auth}`).then(jsonOk),
    fetch(`https://api.trello.com/1/boards/${cfg.boardId}/cards?fields=name,due,desc,idList,url&${auth}`).then(jsonOk)
  ]);
  return lists.map(l => ({
    id: 'tr-' + l.id,
    externalId: l.id,
    title: l.name,
    done: (cfg.doneMap && l.id in cfg.doneMap) ? cfg.doneMap[l.id] : DONE_NAME_RX.test(l.name),
    tasks: cards.filter(c => c.idList === l.id).map(c => ({
      id: 'tr-' + c.id,
      title: c.name,
      desc: c.desc || '',
      deadline: c.due ? c.due.slice(0, 10) : null,
      priority: 'medium',
      url: c.url,
      external: true
    }))
  }));
}

async function pullNotion(cfg) {
  const base = (cfg.proxy || 'https://api.notion.com').replace(/\/+$/, '');
  const headers = {
    'Authorization': 'Bearer ' + cfg.token,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json'
  };

  // Bazanın strukturu: qruplaşdırma (status/select), tarix və başlıq sahələrini tap
  const db = await fetch(base + '/v1/databases/' + cfg.dbId, { headers }).then(jsonOk);
  let groupProp = null, datePropName = null, titlePropName = null;
  for (const [name, p] of Object.entries(db.properties || {})) {
    if (!groupProp && (p.type === 'status' || p.type === 'select')) groupProp = { name, type: p.type, options: (p[p.type] && p[p.type].options) || [] };
    if (!datePropName && p.type === 'date') datePropName = name;
    if (p.type === 'title') titlePropName = name;
  }

  // Bütün səhifələri çək (səhifələmə ilə)
  const pages = [];
  let cursor = null;
  do {
    const body = JSON.stringify(cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 });
    const resp = await fetch(base + '/v1/databases/' + cfg.dbId + '/query', { method: 'POST', headers, body }).then(jsonOk);
    pages.push(...resp.results);
    cursor = resp.has_more ? resp.next_cursor : null;
  } while (cursor);

  const columns = (groupProp ? groupProp.options : []).map(o => ({
    id: 'no-' + o.id,
    externalId: o.id,
    title: o.name,
    done: (cfg.doneMap && o.id in cfg.doneMap) ? cfg.doneMap[o.id] : DONE_NAME_RX.test(o.name),
    tasks: []
  }));
  const byTitle = {};
  columns.forEach(c => { byTitle[c.title] = c; });
  const noneCol = { id: 'no-none', externalId: 'none', title: 'Statussuz', done: false, tasks: [] };

  pages.forEach(pg => {
    const props = pg.properties || {};
    const titleParts = (titlePropName && props[titlePropName] && props[titlePropName].title) || [];
    const title = titleParts.map(t => t.plain_text).join('') || '(adsız)';
    const groupVal = groupProp && props[groupProp.name] ? props[groupProp.name][groupProp.type] : null;
    const dateVal = datePropName && props[datePropName] && props[datePropName].date ? props[datePropName].date.start : null;
    const task = {
      id: 'no-' + pg.id,
      title,
      desc: '',
      deadline: dateVal ? dateVal.slice(0, 10) : null,
      priority: 'medium',
      url: pg.url,
      external: true
    };
    const col = (groupVal && byTitle[groupVal.name]) ? byTitle[groupVal.name] : noneCol;
    col.tasks.push(task);
  });

  if (noneCol.tasks.length) columns.push(noneCol);
  return columns;
}

async function externalPull(channelId, manual) {
  const cfg = channelIntegration(channelId);
  if (!cfg) return;
  try {
    const columns = cfg.type === 'trello' ? await pullTrello(cfg) : await pullNotion(cfg);
    state.boards[channelId] = { columns, external: true, fetchedAt: Date.now() };
    saveState();
    if (activeView === channelId) renderBoard(channelId);
    if (activeView === 'home') renderHome();
    updateNavCounts();
  } catch (e) {
    if (manual) alert('İnteqrasiya xətası (' + channelId + '): ' + e.message +
      '\n\nToken/açar düzgündürmü? Notion üçün proxy işləyirmi?');
  }
}

function pullAllExternal() {
  CHANNELS.forEach(ch => { if (channelIntegration(ch.id)) externalPull(ch.id); });
}

// ---------------- İnteqrasiya pəncərəsi ----------------

const intModal = document.getElementById('int-modal');
let intCtx = null; // hazırda konfiqurasiya olunan kanal

function openIntModal(channelId) {
  intCtx = channelId;
  const ch = CHANNELS.find(c => c.id === channelId);
  document.getElementById('int-title').textContent = ch.name + ' — inteqrasiya';
  const cfg = channelIntegration(channelId);

  document.getElementById('int-type').value = cfg ? cfg.type : '';
  document.getElementById('tr-key').value = cfg && cfg.type === 'trello' ? cfg.key : '';
  document.getElementById('tr-token').value = cfg && cfg.type === 'trello' ? cfg.token : '';
  document.getElementById('tr-board').innerHTML = cfg && cfg.type === 'trello'
    ? `<option value="${cfg.boardId}" selected>${cfg.boardName || cfg.boardId}</option>` : '';
  document.getElementById('no-token').value = cfg && cfg.type === 'notion' ? cfg.token : '';
  document.getElementById('no-db').value = cfg && cfg.type === 'notion' ? cfg.dbId : '';
  document.getElementById('no-proxy').value = cfg && cfg.type === 'notion' ? (cfg.proxy || '') : '';

  document.getElementById('int-remove').classList.toggle('hidden', !cfg);
  setIntStatus(cfg ? 'Bu kanal hazırda ' + (cfg.type === 'trello' ? 'Trello' : 'Notion') + '-a bağlıdır.' : '');
  updateIntSections();
  intModal.classList.remove('hidden');
}

function closeIntModal() { intModal.classList.add('hidden'); intCtx = null; }

function setIntStatus(text, isError) {
  const el = document.getElementById('int-status');
  el.textContent = text;
  el.classList.toggle('error', !!isError);
}

function updateIntSections() {
  const type = document.getElementById('int-type').value;
  document.getElementById('int-trello').classList.toggle('hidden', type !== 'trello');
  document.getElementById('int-notion').classList.toggle('hidden', type !== 'notion');
}

async function loadTrelloBoards() {
  const key = document.getElementById('tr-key').value.trim();
  const token = document.getElementById('tr-token').value.trim();
  if (!key || !token) { setIntStatus('Əvvəlcə API Key və Token daxil edin.', true); return; }
  setIntStatus('Lövhələr yüklənir...');
  try {
    const boards = await fetch(`https://api.trello.com/1/members/me/boards?fields=name&key=${encodeURIComponent(key)}&token=${encodeURIComponent(token)}`).then(jsonOk);
    const sel = document.getElementById('tr-board');
    sel.innerHTML = '';
    boards.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.name;
      sel.appendChild(opt);
    });
    setIntStatus(boards.length + ' lövhə tapıldı — birini seçib "Yadda saxla" basın.');
  } catch (e) {
    setIntStatus('Trello-ya qoşulmaq alınmadı: ' + e.message, true);
  }
}

async function saveIntegration() {
  const channelId = intCtx;
  const type = document.getElementById('int-type').value;

  if (!type) {
    removeIntegration(true);
    return;
  }

  let cfg;
  if (type === 'trello') {
    const sel = document.getElementById('tr-board');
    cfg = {
      type: 'trello',
      key: document.getElementById('tr-key').value.trim(),
      token: document.getElementById('tr-token').value.trim(),
      boardId: sel.value,
      boardName: sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : '',
      doneMap: (channelIntegration(channelId) || {}).doneMap || {}
    };
    if (!cfg.key || !cfg.token || !cfg.boardId) { setIntStatus('API Key, Token daxil edin və lövhə seçin.', true); return; }
  } else {
    cfg = {
      type: 'notion',
      token: document.getElementById('no-token').value.trim(),
      dbId: document.getElementById('no-db').value.trim(),
      proxy: document.getElementById('no-proxy').value.trim(),
      doneMap: (channelIntegration(channelId) || {}).doneMap || {}
    };
    if (!cfg.token || !cfg.dbId) { setIntStatus('Token və Database ID daxil edin.', true); return; }
  }

  // Daxili taskları itirməmək üçün xəbərdarlıq
  const board = state.boards[channelId];
  if (!board.external && board.columns.some(c => c.tasks.length)) {
    if (!confirm('Bu kanalın daxili taskları xarici sistemdəki lövhə ilə əvəz olunacaq. Davam edilsin?')) return;
  }

  setIntStatus('Qoşulma yoxlanılır...');
  try {
    const columns = cfg.type === 'trello' ? await pullTrello(cfg) : await pullNotion(cfg);
    state.integrations[channelId] = cfg;
    state.boards[channelId] = { columns, external: true, fetchedAt: Date.now() };
    saveState();
    closeIntModal();
    renderCurrent();
  } catch (e) {
    setIntStatus('Qoşulmaq alınmadı: ' + e.message + (type === 'notion' ? ' — Proxy URL düzgündürmü? Database inteqrasiyaya "Connect" olunubmu?' : ' — Key/Token düzgündürmü?'), true);
  }
}

function removeIntegration(silent) {
  const channelId = intCtx;
  if (!channelIntegration(channelId)) { closeIntModal(); return; }
  if (!silent && !confirm('İnteqrasiya silinsin? Kanal boş daxili kanbana qayıdacaq (xarici sistemdəki məlumatlara toxunulmur).')) return;
  delete state.integrations[channelId];
  state.boards[channelId] = defaultBoard();
  saveState();
  closeIntModal();
  renderCurrent();
}

document.getElementById('int-type').addEventListener('change', updateIntSections);
document.getElementById('tr-load').addEventListener('click', loadTrelloBoards);
document.getElementById('int-save').addEventListener('click', saveIntegration);
document.getElementById('int-remove').addEventListener('click', () => removeIntegration(false));
document.getElementById('int-close').addEventListener('click', closeIntModal);
intModal.addEventListener('click', e => { if (e.target === intModal) closeIntModal(); });

// Xarici sistemlər müntəzəm yoxlanılır
setInterval(() => { if (!document.hidden) pullAllExternal(); }, 5 * 60 * 1000);
window.addEventListener('focus', () => pullAllExternal());

// ---------------- Cihazlar arası sinxronizasiya (GitHub Gist) ----------------

const GIST_FILENAME = 'lifemanagement-data.json';
const GIST_DESC = 'Life Management — task məlumatları (tətbiq tərəfindən avtomatik idarə olunur)';

function syncCfg() {
  try { return JSON.parse(localStorage.getItem('lifemanagement-sync')) || {}; } catch (e) { return {}; }
}
function setSyncCfg(cfg) { localStorage.setItem('lifemanagement-sync', JSON.stringify(cfg)); }
function syncConnected() { const c = syncCfg(); return !!(c.token && c.gistId); }

let syncBusy = false;
let pushTimer = null;
let lastSyncTime = null;

async function ghFetch(path, opts = {}) {
  const res = await fetch('https://api.github.com' + path, {
    method: opts.method || 'GET',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': 'Bearer ' + syncCfg().token
    },
    body: opts.body || undefined
  });
  if (!res.ok) throw new Error('GitHub cavabı: ' + res.status);
  return res.json();
}

function setSyncStatus(text, isError) {
  const el = document.getElementById('sync-status');
  el.textContent = text;
  el.classList.toggle('error', !!isError);
}

function touchSyncTime() {
  lastSyncTime = new Date();
  updateSyncIndicator();
}

function updateSyncIndicator(errorText) {
  const el = document.getElementById('sync-indicator');
  if (errorText) { el.textContent = '☁ ' + errorText; el.classList.add('error'); return; }
  el.classList.remove('error');
  if (!syncConnected()) { el.textContent = ''; return; }
  el.textContent = '☁ Sinxron aktiv' + (lastSyncTime
    ? ' · ' + lastSyncTime.getHours() + ':' + String(lastSyncTime.getMinutes()).padStart(2, '0')
    : '');
}

async function syncPushNow() {
  if (!syncConnected()) return;
  await ghFetch('/gists/' + syncCfg().gistId, {
    method: 'PATCH',
    body: JSON.stringify({ files: { [GIST_FILENAME]: { content: JSON.stringify(state) } } })
  });
  touchSyncTime();
}

function schedulePush() {
  if (!syncConnected()) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    syncPushNow().catch(() => updateSyncIndicator('göndərmə alınmadı'));
  }, 2500);
}

async function syncPull() {
  if (!syncConnected() || syncBusy) return;
  syncBusy = true;
  try {
    const gist = await ghFetch('/gists/' + syncCfg().gistId);
    const file = gist.files && gist.files[GIST_FILENAME];
    if (!file) return;
    let content = file.content;
    if (file.truncated) content = await (await fetch(file.raw_url)).text();
    const remote = JSON.parse(content);
    if (!remote || !remote.boards) return;

    if ((remote.updatedAt || 0) > (state.updatedAt || 0)) {
      // Buluddakı məlumat daha yenidir — onu götür
      CHANNELS.forEach(ch => { if (!remote.boards[ch.id]) remote.boards[ch.id] = defaultBoard(); });
      state = remote;
      persistLocal();
      renderCurrent();
    } else if ((state.updatedAt || 0) > (remote.updatedAt || 0)) {
      // Lokal məlumat daha yenidir — buluda göndər
      await syncPushNow();
    }
    touchSyncTime();
  } catch (e) {
    updateSyncIndicator('sinxron xətası');
  } finally {
    syncBusy = false;
  }
}

async function connectSync() {
  const token = document.getElementById('sync-token').value.trim();
  if (!token) { setSyncStatus('Token daxil edin.', true); return; }
  setSyncCfg({ token });
  setSyncStatus('Yoxlanılır...');
  try {
    // Əvvəlki cihazda yaradılmış gist varsa, tap
    const gists = await ghFetch('/gists?per_page=100');
    let gist = gists.find(g => g.files && g.files[GIST_FILENAME]);
    if (gist) {
      setSyncCfg({ token, gistId: gist.id });
      await syncPull();
      setSyncStatus('Qoşuldu — buluddakı mövcud məlumatlar tapıldı və sinxronlaşdırıldı.');
    } else {
      gist = await ghFetch('/gists', {
        method: 'POST',
        body: JSON.stringify({
          description: GIST_DESC,
          public: false,
          files: { [GIST_FILENAME]: { content: JSON.stringify(state) } }
        })
      });
      setSyncCfg({ token, gistId: gist.id });
      touchSyncTime();
      setSyncStatus('Qoşuldu — məlumatlarınız buluda yükləndi. İndi bu tokeni digər cihazlarda da daxil edin.');
    }
    document.getElementById('sync-disconnect').classList.remove('hidden');
    updateSyncIndicator();
  } catch (e) {
    setSyncCfg({});
    setSyncStatus('Xəta: token düzgün deyil, "gist" icazəsi yoxdur və ya şəbəkə problemi var. (' + e.message + ')', true);
    updateSyncIndicator();
  }
}

function disconnectSync() {
  setSyncCfg({});
  document.getElementById('sync-token').value = '';
  document.getElementById('sync-disconnect').classList.add('hidden');
  setSyncStatus('Bu cihaz sinxronizasiyadan ayrıldı. Buluddakı məlumatlar silinmir.');
  updateSyncIndicator();
}

const syncModal = document.getElementById('sync-modal');

function openSyncModal() {
  const connected = syncConnected();
  document.getElementById('sync-disconnect').classList.toggle('hidden', !connected);
  setSyncStatus(connected ? 'Bu cihaz qoşulub. Sinxronizasiya avtomatik işləyir.' : '');
  syncModal.classList.remove('hidden');
}

document.getElementById('sync-btn').addEventListener('click', openSyncModal);
document.getElementById('sync-close').addEventListener('click', () => syncModal.classList.add('hidden'));
document.getElementById('sync-connect').addEventListener('click', connectSync);
document.getElementById('sync-disconnect').addEventListener('click', disconnectSync);
syncModal.addEventListener('click', e => { if (e.target === syncModal) syncModal.classList.add('hidden'); });

// Başqa cihazdakı dəyişiklikləri görmək üçün müntəzəm yoxlama
setInterval(() => { if (!document.hidden) syncPull(); }, 90 * 1000);
window.addEventListener('focus', () => syncPull());

// ---------------- Yedəkləmə / Bərpa ----------------

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'lifemanagement-yedek-' + todayStr() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data !== 'object' || !data.boards) {
        alert('Bu fayl Life Management yedəyi deyil.');
        return;
      }
      if (!confirm('Mövcud bütün tasklar yedəkdəki məlumatlarla əvəz olunacaq. Davam edilsin?')) return;
      CHANNELS.forEach(ch => { if (!data.boards[ch.id]) data.boards[ch.id] = defaultBoard(); });
      state = data;
      saveState();
      showView('home');
      alert('Yedək uğurla bərpa olundu.');
    } catch (e) {
      alert('Fayl oxuna bilmədi: düzgün JSON deyil.');
    }
  };
  reader.readAsText(file);
}

document.getElementById('export-btn').addEventListener('click', exportData);
document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
document.getElementById('import-file').addEventListener('change', e => {
  if (e.target.files[0]) importData(e.target.files[0]);
  e.target.value = '';
});

// ---------------- Günlük təzələnmə ----------------

// Gecə yarısı keçəndə ana səhifə avtomatik yenidən hesablanır
let lastDay = todayStr();
setInterval(() => {
  if (todayStr() !== lastDay) {
    lastDay = todayStr();
    renderCurrent();
  }
}, 60 * 1000);

// ---------------- Başlanğıc ----------------

(async function init() {
  await loadState();
  buildNav();
  ensureBoardViews();
  document.getElementById('today-date').textContent = formatFullDate(new Date());
  showView('home');
  updateSyncIndicator();
  if (syncConnected()) syncPull();
  pullAllExternal();
})();
