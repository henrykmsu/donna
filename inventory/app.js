const SUPABASE_URL = 'https://cuioycoofmfdfmtgontc.supabase.co/rest/v1/';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1aW95Y29vZm1mZGZtdGdvbnRjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNDA0OTYsImV4cCI6MjA5NzYxNjQ5Nn0.FbFJYBGAkku5qJZ0xtcCBapZAnOaQGQV3x2ESDfkYL4';

async function api(method, path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': method === 'POST' ? 'return=representation' : ''
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(await res.text());
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// State
let items = [];
let editingId = null;
let currentView = 'list';

// DOM refs
const container = document.getElementById('items-container');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modal-title');
const inputName = document.getElementById('input-name');
const inputCategory = document.getElementById('input-category');
const inputDateType = document.getElementById('input-date-type');
const inputDateExact = document.getElementById('input-date-exact');
const inputDateMonth = document.getElementById('input-date-month');
const inputDateFuzzy = document.getElementById('input-date-fuzzy');
const inputNotes = document.getElementById('input-notes');
const filterCategory = document.getElementById('filter-category');
const sortBy = document.getElementById('sort-by');

// Urgency
function getUrgency(dateStr) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const exp = new Date(dateStr);
  const days = Math.floor((exp - today) / 86400000);
  if (days < 0) return 'red';
  if (days <= 30) return 'yellow';
  return 'green';
}

function urgencyOrder(u) {
  return u === 'red' ? 0 : u === 'yellow' ? 1 : 2;
}

function formatDate(dateStr, approximate) {
  const d = new Date(dateStr + 'T00:00:00');
  const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return approximate ? `~${label}` : label;
}

// Render
function render() {
  const catFilter = filterCategory.value;
  const sort = sortBy.value;

  let filtered = catFilter ? items.filter(i => i.category === catFilter) : [...items];

  filtered.sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'category') return a.category.localeCompare(b.category);
    if (sort === 'urgency') return urgencyOrder(getUrgency(a.expiration_date)) - urgencyOrder(getUrgency(b.expiration_date));
    return new Date(a.expiration_date) - new Date(b.expiration_date);
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-state">No items found.</p>';
    return;
  }

  if (currentView === 'list') {
    container.innerHTML = filtered.map(item => {
      const urgency = getUrgency(item.expiration_date);
      return `
        <div class="item-card" data-id="${item.id}">
          <div class="item-main">
            <div class="status-dot status-${urgency}"></div>
            <div>
              <div class="item-name">${item.name}</div>
              <div class="item-category">${item.category}</div>
            </div>
          </div>
          <div class="item-date">${formatDate(item.expiration_date, item.date_is_approximate)}</div>
          ${item.notes ? `<div class="item-notes">${item.notes}</div>` : ''}
          <div class="item-actions">
            <button onclick="openEdit('${item.id}')">Edit</button>
            <button class="delete-btn" onclick="deleteItem('${item.id}')">Delete</button>
          </div>
        </div>`;
    }).join('');
  } else {
    container.innerHTML = filtered.map(item => {
      const urgency = getUrgency(item.expiration_date);
      return `
        <div class="item-card" data-id="${item.id}">
          <div style="display:flex;align-items:center;gap:0.5rem">
            <div class="status-dot status-${urgency}"></div>
            <div class="item-name">${item.name}</div>
          </div>
          <div class="item-category">${item.category}</div>
          <div class="item-date">${formatDate(item.expiration_date, item.date_is_approximate)}</div>
          ${item.notes ? `<div class="item-notes">${item.notes}</div>` : ''}
          <div class="item-actions">
            <button onclick="openEdit('${item.id}')">Edit</button>
            <button class="delete-btn" onclick="deleteItem('${item.id}')">Delete</button>
          </div>
        </div>`;
    }).join('');
  }
}

// Load
async function loadItems() {
  try {
    items = await api('GET', 'items?order=expiration_date.asc');
    render();
  } catch(e) {
    container.innerHTML = '<p class="empty-state">Could not load items. Check your Supabase keys.</p>';
  }
}

// Modal
function openAdd() {
  editingId = null;
  modalTitle.textContent = 'Add Item';
  inputName.value = '';
  inputCategory.value = 'Food & Pantry';
  inputDateType.value = 'exact';
  inputDateExact.value = '';
  inputDateMonth.value = '';
  inputNotes.value = '';
  document.querySelectorAll('.checkbox-group input').forEach(c => c.checked = false);
  showDateInput('exact');
  modal.classList.remove('hidden');
}

function openEdit(id) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  editingId = id;
  modalTitle.textContent = 'Edit Item';
  inputName.value = item.name;
  inputCategory.value = item.category;
  inputNotes.value = item.notes || '';
  inputDateType.value = 'exact';
  inputDateExact.value = item.expiration_date;
  showDateInput('exact');
  const days = item.reminder_days || [];
  document.querySelectorAll('.checkbox-group input').forEach(c => {
    c.checked = days.includes(parseInt(c.value));
  });
  modal.classList.remove('hidden');
}

function closeModal() {
  modal.classList.add('hidden');
}

function showDateInput(type) {
  document.getElementById('date-exact').classList.toggle('hidden', type !== 'exact');
  document.getElementById('date-month').classList.toggle('hidden', type !== 'month');
  document.getElementById('date-fuzzy').classList.toggle('hidden', type !== 'fuzzy');
}

function getExpirationDate() {
  const type = inputDateType.value;
  if (type === 'exact') return { date: inputDateExact.value, approximate: false };
  if (type === 'month') {
    const val = inputDateMonth.value;
    if (!val) return null;
    return { date: `${val}-01`, approximate: true };
  }
  if (type === 'fuzzy') {
    const days = parseInt(inputDateFuzzy.value);
    const d = new Date();
    d.setDate(d.getDate() + days);
    return { date: d.toISOString().split('T')[0], approximate: true };
  }
  return null;
}

async function saveItem() {
  const name = inputName.value.trim();
  if (!name) { alert('Please enter an item name.'); return; }
  const exp = getExpirationDate();
  if (!exp || !exp.date) { alert('Please enter an expiration date.'); return; }
  const reminderDays = Array.from(document.querySelectorAll('.checkbox-group input:checked'))
    .map(c => parseInt(c.value));

  const payload = {
    name,
    category: inputCategory.value,
    expiration_date: exp.date,
    date_is_approximate: exp.approximate,
    notes: inputNotes.value.trim() || null,
    reminder_days: reminderDays
  };

  try {
    if (editingId) {
      await api('PATCH', `items?id=eq.${editingId}`, payload);
    } else {
      await api('POST', 'items', payload);
    }
    closeModal();
    await loadItems();
  } catch(e) {
    alert('Error saving item. Please try again.');
  }
}

async function deleteItem(id) {
  if (!confirm('Delete this item?')) return;
  try {
    await api('DELETE', `items?id=eq.${id}`);
    await loadItems();
  } catch(e) {
    alert('Error deleting item.');
  }
}

// Event listeners
document.getElementById('add-btn').addEventListener('click', openAdd);
document.getElementById('modal-cancel').addEventListener('click', closeModal);
document.getElementById('modal-save').addEventListener('click', saveItem);
document.querySelector('.modal-backdrop').addEventListener('click', closeModal);
inputDateType.addEventListener('change', e => showDateInput(e.target.value));
filterCategory.addEventListener('change', render);
sortBy.addEventListener('change', render);

document.getElementById('list-view-btn').addEventListener('click', () => {
  currentView = 'list';
  container.className = 'list-view';
  document.getElementById('list-view-btn').classList.add('active');
  document.getElementById('grid-view-btn').classList.remove('active');
  render();
});

document.getElementById('grid-view-btn').addEventListener('click', () => {
  currentView = 'grid';
  container.className = 'grid-view';
  document.getElementById('grid-view-btn').classList.add('active');
  document.getElementById('list-view-btn').classList.remove('active');
  render();
});

loadItems();
