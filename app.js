/* =============================================
   RoboStore — 11th Committee Robotics Club
   Inventory Management App
   ============================================= */

const STORAGE_KEY = 'robostore_inventory_v1';

// ── Default seed data ──────────────────────────
const DEFAULT_DATA = [
  { id: uid(), name: 'Arduino Uno R3',      total: 8,  taken: 3, takenBy: ['Arjun', 'Priya', 'Rohan'] },
  { id: uid(), name: 'Servo Motor SG90',    total: 20, taken: 7, takenBy: ['Sita', 'Dev', 'Meera', 'Kabir', 'Tara', 'Anil', 'Nisha'] },
  { id: uid(), name: 'L298N Motor Driver',  total: 6,  taken: 6, takenBy: ['Arjun', 'Priya', 'Rohan', 'Dev', 'Sita', 'Meera'] },
  { id: uid(), name: 'HC-SR04 Ultrasonic',  total: 10, taken: 2, takenBy: ['Kabir', 'Tara'] },
  { id: uid(), name: 'Breadboard 830pt',    total: 15, taken: 0, takenBy: [] },
  { id: uid(), name: 'Jumper Wire Set',     total: 12, taken: 4, takenBy: ['Arjun', 'Nisha', 'Dev', 'Rohan'] },
  { id: uid(), name: 'Li-Po Battery 7.4V',  total: 5,  taken: 3, takenBy: ['Sita', 'Priya', 'Anil'] },
  { id: uid(), name: 'Raspberry Pi Pico',   total: 4,  taken: 1, takenBy: ['Meera'] },
];

// ── State ──────────────────────────────────────
let inventory   = load();
let editingId   = null;
let deletingId  = null;
let searchQuery = '';
let filterMode  = 'all';
let sortCol     = null;
let sortDir     = 'asc';

// ── DOM refs ───────────────────────────────────
const tableBody     = document.getElementById('tableBody');
const emptyState    = document.getElementById('emptyState');
const modalOverlay  = document.getElementById('modalOverlay');
const deleteOverlay = document.getElementById('deleteOverlay');
const modalTitle    = document.getElementById('modalTitle');
const fieldName     = document.getElementById('fieldName');
const fieldTotal    = document.getElementById('fieldTotal');
const fieldTaken    = document.getElementById('fieldTaken');
const fieldTakenBy  = document.getElementById('fieldTakenBy');
const formError     = document.getElementById('formError');
const statTotal     = document.getElementById('stat-total');
const statTaken     = document.getElementById('stat-taken');
const deleteItemName= document.getElementById('deleteItemName');
const searchInput   = document.getElementById('searchInput');

// ── Init ───────────────────────────────────────
render();
bindEvents();

// ── Event bindings ─────────────────────────────
function bindEvents() {
  // Open modal (header button)
  document.getElementById('openModal').addEventListener('click', () => openModal());
  document.getElementById('openModalEmpty')?.addEventListener('click', () => openModal());

  // Close modal
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelModal').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });

  // Save item
  document.getElementById('saveItem').addEventListener('click', saveItem);

  // Delete confirm
  document.getElementById('closeDelete').addEventListener('click', closeDelete);
  document.getElementById('cancelDelete').addEventListener('click', closeDelete);
  deleteOverlay.addEventListener('click', e => { if (e.target === deleteOverlay) closeDelete(); });
  document.getElementById('confirmDelete').addEventListener('click', () => {
    inventory = inventory.filter(i => i.id !== deletingId);
    save(); render(); closeDelete();
  });

  // Search
  searchInput.addEventListener('input', e => { searchQuery = e.target.value.toLowerCase(); render(); });

  // Filter tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      filterMode = tab.dataset.filter;
      render();
    });
  });

  // Sort headers
  document.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = col;
        sortDir = 'asc';
      }
      render();
    });
  });

  // Keyboard shortcut: Escape to close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); closeDelete(); }
  });
}

// ── Render ─────────────────────────────────────
function render() {
  updateStats();
  updateSortIndicators();

  let data = [...inventory];

  // Filter
  if (filterMode === 'available') data = data.filter(i => i.taken === 0);
  if (filterMode === 'partial')   data = data.filter(i => i.taken > 0 && i.taken < i.total);
  if (filterMode === 'taken')     data = data.filter(i => i.taken >= i.total);

  // Search
  if (searchQuery) data = data.filter(i => i.name.toLowerCase().includes(searchQuery));

  // Sort
  if (sortCol) {
    data.sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol];
      if (sortCol === 'available') { av = a.total - a.taken; bv = b.total - b.taken; }
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }

  tableBody.innerHTML = '';

  if (data.length === 0) {
    emptyState.style.display = 'block';
    document.querySelector('.table-wrap table').style.display = 'none';
  } else {
    emptyState.style.display = 'none';
    document.querySelector('.table-wrap table').style.display = '';
    data.forEach((item, idx) => {
      const row = buildRow(item, idx);
      tableBody.appendChild(row);
    });
  }
}

function buildRow(item, idx) {
  const available = item.total - item.taken;
  const pct = item.total > 0 ? Math.round((available / item.total) * 100) : 0;
  const fillClass = pct > 60 ? 'high' : pct > 25 ? 'medium' : 'low';
  const badge = available <= 0
    ? '<span class="status-badge badge-out">Out</span>'
    : pct <= 30
      ? '<span class="status-badge badge-low">Low</span>'
      : '<span class="status-badge badge-ok">OK</span>';

  const tagsHtml = item.takenBy.length
    ? item.takenBy.map(n => `<span class="tag">${esc(n.trim())}</span>`).join('')
    : `<span class="tag-empty">—</span>`;

  const tr = document.createElement('tr');
  tr.classList.add('fade-in');
  tr.style.animationDelay = `${idx * 30}ms`;
  tr.innerHTML = `
    <td>
      <div class="td-name">${esc(item.name)}</div>
      <div style="margin-top:4px">${badge}</div>
    </td>
    <td class="td-num total">${item.total}</td>
    <td>
      <div class="avail-cell">
        <span class="td-num avail${available === 0 ? ' zero' : ''}">${available}</span>
        <div class="progress-bar"><div class="progress-fill ${fillClass}" style="width:${pct}%"></div></div>
      </div>
    </td>
    <td class="td-num taken${item.taken === 0 ? ' zero' : ''}">${item.taken}</td>
    <td><div class="tags-wrap">${tagsHtml}</div></td>
    <td>
      <div class="action-btns">
        <button class="btn-icon edit" title="Edit" data-id="${item.id}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9.5 1.5L12.5 4.5L5 12H2V9L9.5 1.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
        </button>
        <button class="btn-icon delete" title="Delete" data-id="${item.id}">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><polyline points="2,3 12,3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M5 3V2h4v1" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="4" width="8" height="8" rx="1" stroke="currentColor" stroke-width="1.5"/><line x1="5.5" y1="7" x2="5.5" y2="10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><line x1="8.5" y1="7" x2="8.5" y2="10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
        </button>
      </div>
    </td>
  `;

  tr.querySelector('.btn-icon.edit').addEventListener('click', () => openModal(item.id));
  tr.querySelector('.btn-icon.delete').addEventListener('click', () => openDelete(item.id, item.name));

  return tr;
}

function updateStats() {
  statTotal.textContent = inventory.length;
  const totalTaken = inventory.reduce((s, i) => s + i.taken, 0);
  statTaken.textContent = totalTaken;
}

function updateSortIndicators() {
  document.querySelectorAll('th.sortable').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.col === sortCol) th.classList.add(`sort-${sortDir}`);
  });
}

// ── Modal ──────────────────────────────────────
function openModal(id = null) {
  editingId = id;
  formError.textContent = '';
  if (id) {
    const item = inventory.find(i => i.id === id);
    modalTitle.textContent = 'Edit Component';
    fieldName.value    = item.name;
    fieldTotal.value   = item.total;
    fieldTaken.value   = item.taken;
    fieldTakenBy.value = item.takenBy.join(', ');
  } else {
    modalTitle.textContent = 'Add Component';
    fieldName.value = fieldTotal.value = fieldTaken.value = fieldTakenBy.value = '';
  }
  modalOverlay.classList.add('open');
  setTimeout(() => fieldName.focus(), 80);
}

function closeModal() {
  modalOverlay.classList.remove('open');
  editingId = null;
}

function saveItem() {
  formError.textContent = '';
  const name   = fieldName.value.trim();
  const total  = parseInt(fieldTotal.value);
  const taken  = parseInt(fieldTaken.value) || 0;
  const takenBy = fieldTakenBy.value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // Validate
  if (!name) { formError.textContent = 'Component name is required.'; return; }
  if (isNaN(total) || total < 0) { formError.textContent = 'Total must be a valid number ≥ 0.'; return; }
  if (taken < 0) { formError.textContent = 'Taken count cannot be negative.'; return; }
  if (taken > total) { formError.textContent = `Taken (${taken}) cannot exceed total (${total}).`; return; }

  if (editingId) {
    const idx = inventory.findIndex(i => i.id === editingId);
    inventory[idx] = { ...inventory[idx], name, total, taken, takenBy };
  } else {
    inventory.push({ id: uid(), name, total, taken, takenBy });
  }

  save(); render(); closeModal();
}

// ── Delete ─────────────────────────────────────
function openDelete(id, name) {
  deletingId = id;
  deleteItemName.textContent = name;
  deleteOverlay.classList.add('open');
}
function closeDelete() {
  deleteOverlay.classList.remove('open');
  deletingId = null;
}

// ── Persistence ────────────────────────────────
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_DATA;
}

// ── Helpers ────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function esc(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}