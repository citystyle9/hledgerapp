// -------------------------------------------------------------------
// 1. DOM References and Constants
// -------------------------------------------------------------------
const overlay = document.getElementById('modal-overlay');
const deleteOverlay = document.getElementById('delete-overlay');
const deleteCancelBtn = document.getElementById('delete-cancel');
const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
const deleteDetailsDiv = document.getElementById('delete-record-details');
const resetOverlay = document.getElementById('reset-overlay'); 
const resetCancelBtn = document.getElementById('reset-cancel'); 
const resetConfirmBtn = document.getElementById('reset-confirm-btn'); 
const title = document.getElementById('modal-title');
const accountSelect = document.getElementById('entry-account');
const saveBtn = document.getElementById('modal-save');
const cancelBtn = document.getElementById('modal-cancel');
const dateInput = document.getElementById('entry-date');
const descInput = document.getElementById('entry-desc');
const amtInput = document.getElementById('entry-amount');
const recordsSection = document.getElementById('records-section');
const recordsHead = recordsSection.querySelector('.records-head');
const logOverlay = document.getElementById('log-overlay');
const logClose = document.getElementById('log-close');
const btnLog = document.getElementById('btn-log');
const btnReset = document.getElementById('btn-reset');
const filterSearch = document.getElementById('filter-search');
const filterAccount = document.getElementById('filter-account');
const filterFrom = document.getElementById('filter-from');
const filterTo = document.getElementById('filter-to');
const btnBackup = document.getElementById('btn-backup');
const btnRestore = document.getElementById('btn-restore');
const btnRestoreSheet = document.getElementById('btn-restore-sheet'); 
const btnExport = document.getElementById('btn-export');
const themeToggle = document.getElementById('theme-toggle'); 
const restoreFileInput = document.getElementById('restore-file');

const quickFilterButtons = {
    today: document.getElementById('quick-today'),
    yesterday: document.getElementById('quick-yesterday'),
    month: document.getElementById('quick-month'),
    fiscal: document.getElementById('quick-fiscal')
};

const THEME_KEY = 'homeledger_theme_v1';
const SORT_KEY = 'homeledger_sort_v1';
const VERSION_TAG = 'HomeLedger v1.5.3'; 
let currentSort = { key: 'date', order: 'desc' }; // This is set via loadFromStorage in data-service

function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

// -------------------------------------------------------------------
// 2. Rendering, Logging, and Summary 
// -------------------------------------------------------------------

function calculateGlobalTotals(){
    let income = 0, loan = 0, expense = 0;
    store.records.forEach(r=>{
        const amount = isNaN(Number(r.amount)) ? 0 : Number(r.amount);
        if(r.account === 'Income') income += amount;
        else if(r.account === 'Loan') loan += amount;
        else if(r.account === 'Expense') expense += amount;
    });
    
    const globalBalance = (income + loan) - expense;

    // --- 1. Only Update Current Balance (Total) ---
    document.getElementById('current-balance').textContent = 'Rs ' + globalBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    applyFilters(); // Trigger filtering and rendering of all other summaries/list
    saveToStorage();
}

function recalcSummaryAndRender(dateFilteredList, fullFilteredList) {
    
    // 1. Calculate Income/Loan/Expense Summary Totals based on DATE FILTERED LIST
    let income = 0, loan = 0, expense = 0;
    dateFilteredList.forEach(r=>{
        const amount = isNaN(Number(r.amount)) ? 0 : Number(r.amount);
        if(r.account === 'Income') income += amount;
        else if(r.account === 'Loan') loan += amount;
        else if(r.account === 'Expense') expense += amount;
    });
    
    // --- Update Income/Loan/Expense with DATE FILTERED amounts ---
    document.getElementById('sum-income').textContent = 'Rs ' + income.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('sum-loan').textContent = 'Rs ' + loan.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('sum-expense').textContent = 'Rs ' + expense.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    
    // 2. Calculate Filtered Balance based on FULL FILTERED LIST
    let fullIncome = 0, fullLoan = 0, fullExpense = 0;
    fullFilteredList.forEach(r=>{
      const amount = isNaN(Number(r.amount)) ? 0 : Number(r.amount);
      if(r.account === 'Income') fullIncome += amount;
      else if(r.account === 'Loan') fullLoan += amount;
      else if(r.account === 'Expense') fullExpense += amount;
    });
    const filteredBalance = (fullIncome + fullLoan) - fullExpense;
    
    // --- Update the Filtered Net Balance ---
    document.getElementById('summary-filtered-balance').textContent = 'Rs ' + filteredBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    // 3. Render the list of records using the FULL FILTERED LIST
    renderRecordsList(fullFilteredList);
}

function renderRecordsList(list){
  Array.from(recordsSection.querySelectorAll('.record-row, .empty-state')).forEach(n=>n.remove());
  const rows = (list && Array.isArray(list)) ? list : [];
  
  // Find the correct header to display sorting arrow
  const sortKey = currentSort.key;
  const sortOrder = currentSort.order;
  recordsHead.querySelectorAll('div').forEach(div => {
      if (div.dataset.sortKey === sortKey) {
          div.setAttribute('data-sort-order', sortOrder);
      } else {
          div.removeAttribute('data-sort-order');
      }
  });

  if (rows.length === 0) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      // Display a relevant message based on filters
      const isFiltered = filterSearch.value || filterAccount.value !== 'All Accounts' || filterFrom.value !== isoToday() || filterTo.value !== isoToday();
      emptyDiv.textContent = isFiltered
                              ? "No records found matching your current filters."
                              : "You have no records yet. Click '+ Add Income/Loan/Expense' to get started!";
      recordsSection.appendChild(emptyDiv);
      return;
  }

  rows.forEach(rec=>{
    const row = document.createElement('div'); row.className='record-row'; row.dataset.id=rec.guid;
    
    let amountColor;
    if(rec.sign === 'positive') amountColor = 'var(--success)';
    else if(rec.sign === 'loan') amountColor = 'var(--warning)';
    else amountColor = 'var(--danger)';

    const dateDiv = document.createElement('div');
    dateDiv.textContent = rec.date;
    row.appendChild(dateDiv);

    const accountDiv = document.createElement('div');
    accountDiv.textContent = rec.account;
    row.appendChild(accountDiv);

    const descDiv = document.createElement('div');
    descDiv.textContent = rec.desc;
    row.appendChild(descDiv);

    const amountDiv = document.createElement('div');
    amountDiv.style.color = amountColor;
    amountDiv.textContent = formatAmount(rec.amount, rec.sign);
    row.appendChild(amountDiv);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'record-actions';

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑️';
    deleteBtn.onclick = () => openDeleteModal(rec.guid);
    actionsDiv.appendChild(deleteBtn);

    row.appendChild(actionsDiv);

    recordsSection.appendChild(row);
  });
}

function renderLogs(){
  const logDiv = document.getElementById('activity-log-modal');
  logDiv.innerHTML = '';
  store.logs.forEach(log=>{
    const item = document.createElement('div');
    item.className = 'log-item';
    item.textContent = log;
    logDiv.appendChild(item);
  });
}

// -------------------------------------------------------------------
// 3. Modal and Record Operations 
// -------------------------------------------------------------------

let currentAction = '';
let currentEditId = null;

function openModal(action){
  currentAction = action;
  currentEditId = null;
  title.textContent = `Add New ${capitalize(action)}`;
  accountSelect.value = capitalize(action);
  accountSelect.disabled = true;
  dateInput.value = isoToday();
  descInput.value = '';
  amtInput.value = '';
  saveBtn.className = 'btn-save ' + action;
  overlay.classList.add('show');
}

function closeModal(){
  overlay.classList.remove('show');
  deleteOverlay.classList.remove('show');
  resetOverlay.classList.remove('show');
}

function saveRecord(){
  const date = dateInput.value;
  const desc = descInput.value.trim();
  const amount = Number(amtInput.value);

  if(!date || !desc || isNaN(amount) || amount <= 0){
    alert('Please fill all fields with valid data.');
    return;
  }

  const record = {
    guid: currentEditId || generateGuid(),
    date,
    account: accountSelect.value,
    desc,
    amount: amount.toFixed(2),
    sign: currentAction === 'expense' ? 'negative' : (currentAction === 'loan' ? 'loan' : 'positive')
  };

  if(currentEditId){
    const index = store.records.findIndex(r => r.guid === currentEditId);
    if(index > -1){
      store.records[index] = record;
      addLog(`[${nowTsForLog()}] Record modified: ${desc} (${record.account}) Rs ${amount.toFixed(2)}`);
      sendRecordToSheets(record, 'Modified');
    }
  } else {
    store.records.push(record);
    addLog(`[${nowTsForLog()}] New record added: ${desc} (${record.account}) Rs ${amount.toFixed(2)}`);
    sendRecordToSheets(record);
  }

  calculateGlobalTotals();
  closeModal();
}

function openDeleteModal(id){
  const rec = store.records.find(r => r.guid === id);
  if(!rec) return;

  deleteDetailsDiv.innerHTML = `
    <strong>Date:</strong> ${rec.date}<br>
    <strong>Account:</strong> ${rec.account}<br>
    <strong>Description:</strong> ${rec.desc}<br>
    <strong>Amount:</strong> Rs ${Number(rec.amount).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
  `;

  deleteConfirmBtn.dataset.id = id;
  deleteOverlay.classList.add('show');
}

function deleteRecord(id){
  const index = store.records.findIndex(r => r.guid === id);
  if(index > -1){
    const rec = store.records[index];
    store.records.splice(index, 1);
    addLog(`[${nowTsForLog()}] Record deleted: ${rec.desc} (${rec.account}) Rs ${rec.amount}`);
    sendRecordToSheets(rec, 'Deleted');
  }

  const queueIndex = pendingSyncQueue.findIndex(item => item.id === id);
  if (queueIndex > -1) {
    pendingSyncQueue.splice(queueIndex, 1);
  }

  calculateGlobalTotals();
  closeModal();
}

function deleteAllData(){
  store.records = [];
  store.logs = [];
  pendingSyncQueue = [];
  localStorage.clear();
  addLog(`[${nowTsForLog()}] All data deleted and app reset.`);
  calculateGlobalTotals();
  closeModal();
}

// -------------------------------------------------------------------
// 4. Theme Toggle 
// -------------------------------------------------------------------

function applyTheme(theme){
  document.body.dataset.theme = theme;
  localStorage.setItem(THEME_KEY, theme);
}

function toggleTheme(){
  const current = document.body.dataset.theme || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// -------------------------------------------------------------------
// 5. Filtering and Sorting 
// -------------------------------------------------------------------

function handleSortClick(key){
  if (currentSort.key === key) {
      currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
  } else {
      currentSort.key = key;
      currentSort.order = 'desc';
  }
  applyFilters();
}

function applyFilters(){
  let filtered = [...store.records];

  // Date Filter
  const fromDate = filterFrom.value ? new Date(filterFrom.value) : null;
  const toDate = filterTo.value ? new Date(filterTo.value) : null;
  if (fromDate || toDate) {
      filtered = filtered.filter(r => {
          const rDate = new Date(r.date);
          return (!fromDate || rDate >= fromDate) && (!toDate || rDate <= toDate);
      });
  }

  const dateFilteredList = [...filtered];

  // Account Filter
  const selectedAccount = filterAccount.value;
  if (selectedAccount !== 'All Accounts') {
      filtered = filtered.filter(r => r.account === selectedAccount);
  }

  // Search Filter
  const searchTerm = filterSearch.value.toLowerCase();
  if (searchTerm) {
      filtered = filtered.filter(r => 
          r.desc.toLowerCase().includes(searchTerm) || 
          r.amount.toString().includes(searchTerm)
      );
  }

  // Sort
  filtered.sort((a, b) => {
      let valA = a[currentSort.key];
      let valB = b[currentSort.key];
      if (currentSort.key === 'amount') {
          valA = Number(valA);
          valB = Number(valB);
      } else if (currentSort.key === 'date') {
          valA = new Date(valA);
          valB = new Date(valB);
      }
      if (valA < valB) return currentSort.order === 'asc' ? -1 : 1;
      if (valA > valB) return currentSort.order === 'asc' ? 1 : -1;
      return 0;
  });

  recalcSummaryAndRender(dateFilteredList, filtered);
}

function applyQuickFilter(type){
  Object.values(quickFilterButtons).forEach(btn => btn.classList.remove('active'));

  const today = new Date();
  let from = isoToday();
  let to = isoToday();

  if (type === 'today') {
      quickFilterButtons.today.classList.add('active');
  } else if (type === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      from = to = isoFormat(yesterday);
      quickFilterButtons.yesterday.classList.add('active');
  } else if (type === 'month') {
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      from = isoFormat(startOfMonth);
      to = isoFormat(today); 
      quickFilterButtons.month.classList.add('active');
  } else if (type === 'fiscal') {
      const dates = getFiscalYearDates();
      from = dates.from;
      to = dates.to;
      quickFilterButtons.fiscal.classList.add('active');
  }

  filterFrom.value = from;
  filterTo.value = to;
  applyFilters();
}

// -------------------------------------------------------------------
// 6. Export/Import (Backup/Restore UI interaction) 
// -------------------------------------------------------------------

function download(data, filename, type) {
    const file = new Blob([data], {type: type});
    const a = document.createElement("a");
    const url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);  
    }, 0); 
}

function backupData() {
    const dataToSave = {
        version: VERSION_TAG,
        timestamp: nowTsForLog(),
        records: store.records,
        logs: store.logs,
        pendingSync: pendingSyncQueue 
    };
    const filename = `homeledger_backup_${new Date().toISOString().slice(0,10)}.json`;
    download(JSON.stringify(dataToSave, null, 2), filename, 'application/json');
    addLog(`[${nowTsForLog()}] Data backed up successfully.`);
}

function exportCSV() {
    if (store.records.length === 0) {
        alert('No records to export.');
        return;
    }
    let csv = "Date,Account,Description,Amount,Sign,GUID\n";
    store.records.forEach(r => {
        const safeDesc = r.desc.replace(/"/g, '""'); 
        csv += `${r.date},${r.account},"${safeDesc}",${r.amount},${r.sign},${r.guid}\n`;
    });

    const filename = `homeledger_export_${new Date().toISOString().slice(0,10)}.csv`;
    download(csv, filename, 'text/csv');
    addLog(`[${nowTsForLog()}] Data exported to CSV successfully.`);
}

function restoreData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.records && Array.isArray(data.records)) {
                store.records = data.records;
                store.logs = data.logs || [];
                pendingSyncQueue = data.pendingSync || []; 
                
                // Ensure restored records are in string format for consistency
                store.records = store.records.map(r => {
                    if (r.date instanceof Date) {
                        r.date = isoFormat(r.date);
                    }
                    return r;
                });

                store.logs.unshift(`[${nowTsForLog()}] Data restored from local file: ${file.name}`);
                calculateGlobalTotals();
                alert(`Successfully restored ${data.records.length} records from local file.`);
            } else {
                alert('Error: Invalid backup file format. "records" array not found.');
            }
        } catch (err) {
            alert('Error reading or parsing the file: ' + err.message);
        }
        event.target.value = null; 
    };
    reader.readAsText(file);
}

// -------------------------------------------------------------------
// 7. Event Listeners
// -------------------------------------------------------------------

function setupEventListeners() {
  document.querySelectorAll('.big-btn').forEach(btn => {
      btn.addEventListener('click', (e) => openModal(e.target.dataset.action));
  });
  
  saveBtn.addEventListener('click', saveRecord);
  cancelBtn.addEventListener('click', closeModal);
  deleteCancelBtn.addEventListener('click', closeModal);
  deleteConfirmBtn.addEventListener('click', (e) => deleteRecord(e.target.dataset.id));
  btnReset.addEventListener('click', () => resetOverlay.classList.add('show'));
  resetCancelBtn.addEventListener('click', closeModal);
  resetConfirmBtn.addEventListener('click', deleteAllData);

  btnLog.addEventListener('click', () => { 
      renderLogs();
      logOverlay.classList.add('show');
  });
  logClose.addEventListener('click', () => logOverlay.classList.remove('show'));
  
  themeToggle.addEventListener('click', toggleTheme);
  
  btnBackup.addEventListener('click', backupData);
  btnExport.addEventListener('click', exportCSV);
  btnRestore.addEventListener('click', () => restoreFileInput.click());
  btnRestoreSheet.addEventListener('click', () => restoreDataFromSheets(false)); 
  restoreFileInput.addEventListener('change', restoreData);

  // Filtering Events (Only call applyFilters)
  filterSearch.addEventListener('input', debounce(applyFilters, 300));
  filterAccount.addEventListener('change', applyFilters);
  filterFrom.addEventListener('change', applyFilters);
  filterTo.addEventListener('change', applyFilters);
  
  quickFilterButtons.today.addEventListener('click', () => applyQuickFilter('today'));
  quickFilterButtons.yesterday.addEventListener('click', () => applyQuickFilter('yesterday'));
  quickFilterButtons.month.addEventListener('click', () => applyQuickFilter('month'));
  quickFilterButtons.fiscal.addEventListener('click', () => applyQuickFilter('fiscal'));

  recordsHead.querySelectorAll('div[data-sort-key]').forEach(div => {
      div.addEventListener('click', (e) => handleSortClick(e.currentTarget.dataset.sortKey));
  });
}

// -------------------------------------------------------------------
// 8. Initialization (Final Call)
// -------------------------------------------------------------------
function init(){
    loadFromStorage();
    
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(savedTheme);

    // Default Filter 'Today' set kiya gaya hai:
    filterFrom.value = isoToday();
    filterTo.value = isoToday();
    quickFilterButtons.today.classList.add('active');
    
    // Set initial sort indicator in the header
    const initialHeader = recordsHead.querySelector(`div[data-sort-key="${currentSort.key}"]`);
    if (initialHeader) {
        initialHeader.setAttribute('data-sort-order', currentSort.order);
    }
    
    calculateGlobalTotals(); 
    
    // Auto Sync Check
    if (pendingSyncQueue.length > 0) {
        attemptPendingSync();
    }
    
    addLog(`[${nowTsForLog()}] App loaded (v${VERSION_TAG.split('v')[1]}).`);

    setupEventListeners();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/hledgerapp/service-worker.js');
    }
}

document.addEventListener('DOMContentLoaded', init);
