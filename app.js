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

// -------------------------------------------------------------------
// 2. Rendering, Logging, and Summary 
// -------------------------------------------------------------------

function calculateGlobalTotals(){
    let income = 0, loan = 0, expense = 0;
    store.records.forEach(r=>{
        const amount = Number(r.amount || 0);
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
        const amount = Number(r.amount || 0);
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
      const amount = Number(r.amount || 0);
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
    if(rec.sign === 'expense') amountColor = `color:var(--danger);font-weight:700`;
    else if(rec.account === 'Loan') amountColor = `color:var(--warning);font-weight:700`;
    else amountColor = `color:var(--success);font-weight:700`;

    // Date ko seedha string use karen. Restore function mein ab Date Object ko string mein convert kar diya gaya hai.
    const displayDate = rec.date;


    row.innerHTML = `
      <div>${displayDate}</div> 
      <div>${rec.account}</div>
      <div>${rec.desc}</div>
      <div style="${amountColor}">${formatAmount(rec.amount,rec.sign)}</div>
      <div class="record-actions"><button title="Edit">✏️</button> <button title="Delete">🗑️</button></div>
    `;
    row.querySelector('[title="Edit"]').addEventListener('click', ()=> openEdit(rec.guid));
    row.querySelector('[title="Delete"]').addEventListener('click', ()=> openDeleteConfirm(rec.guid));
    recordsSection.appendChild(row);
  });
}

function renderLogs(){
  const logModalList = document.getElementById('activity-log-modal');
  logModalList.innerHTML = '';
  store.logs.forEach(entry=>{
    const div = document.createElement('div'); div.className='log-item'; div.textContent = entry;
    logModalList.appendChild(div);
  });
}

// -------------------------------------------------------------------
// 3. Theme Functions
// -------------------------------------------------------------------
function applyTheme(theme){
  if(theme === 'light') {
      document.body.setAttribute('data-theme','light');
      themeToggle.title = 'Switch to Dark Mode';
      themeToggle.textContent = ''; 
  }
  else {
      document.body.removeAttribute('data-theme');
      themeToggle.title = 'Switch to Light Mode';
      themeToggle.textContent = ''; 
  }
  try{ localStorage.setItem(THEME_KEY, theme); }catch(e){}
}

function toggleTheme(){
  const cur = localStorage.getItem(THEME_KEY) || 'dark';
  const next = (cur === 'dark') ? 'light' : 'dark';
  applyTheme(next);
  addLog(`[${nowTsForLog()}] Theme changed to ${next}`);
}

// -------------------------------------------------------------------
// 4. Record Management (UI / Modal Interaction) 
// -------------------------------------------------------------------
let editingId = null;

function openModal(action) {
    editingId = null;
    let account = action.charAt(0).toUpperCase() + action.slice(1);
    if (account === 'Expense') account = 'Expense';
    if (account === 'Loan') account = 'Loan';
    if (account === 'Income') account = 'Income'; 

    title.textContent = `Add New ${account}`;
    accountSelect.value = account;
    dateInput.value = isoToday();
    descInput.value = '';
    amtInput.value = '';
    
    accountSelect.disabled = true;
    saveBtn.className = 'btn-save ' + action;
    
    overlay.classList.add('show');
    descInput.focus();
}

function openEdit(guid) {
    const record = store.records.find(r => r.guid === guid);
    if (!record) return;

    editingId = guid;
    title.textContent = `Edit ${record.account}`;
    // EDIT: Date value set karne se pehle usay string format mein use karen
    dateInput.value = record.date;
    accountSelect.value = record.account;
    descInput.value = record.desc;
    amtInput.value = record.amount;
    
    accountSelect.disabled = false;
    saveBtn.className = 'btn-save ' + record.account.toLowerCase();

    overlay.classList.add('show');
    descInput.focus();
}

function openDeleteConfirm(guid) {
    const record = store.records.find(r => r.guid === guid);
    if (!record) return;
    
    deleteConfirmBtn.dataset.id = guid;
    deleteDetailsDiv.innerHTML = `
        <strong>Date:</strong> ${record.date}<br>
        <strong>Account:</strong> ${record.account}<br>
        <strong>Amount:</strong> <span style="font-weight:700; color: ${record.sign === 'expense' ? 'var(--danger)' : 'var(--success)'};">${formatAmount(record.amount, record.sign)}</span><br>
        <strong>Description:</strong> ${record.desc}
    `;
    deleteOverlay.classList.add('show');
}

function closeModal() {
    overlay.classList.remove('show');
    deleteOverlay.classList.remove('show');
    resetOverlay.classList.remove('show');
    editingId = null;
    document.querySelector('details.menu').open = false; 
}

function saveRecord() {
    if (!dateInput.value || !descInput.value || !amtInput.value) {
        alert('Please fill in all fields (Date, Description, Amount).');
        return;
    }
    const amount = Number(amtInput.value);
    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount.');
        return;
    }
    const account = accountSelect.value;
    const sign = (account === 'Expense') ? 'expense' : 'positive';
    let logAction;

    // Determine the status for the sheet: 'Edit' if editing, 'Active' if new
    const sheetStatus = editingId ? 'Edit' : 'Active'; 

    const newRecord = {
        guid: editingId || generateGuid(),
        date: dateInput.value, // Date is saved as YYYY-MM-DD string
        account: account,
        desc: descInput.value.trim(),
        amount: amount.toFixed(2), 
        sign: sign,
    };

    if (editingId) {
        const index = store.records.findIndex(r => r.guid === editingId);
        if (index !== -1) {
            const oldRecord = store.records[index];
            store.records[index] = newRecord;
            logAction = `[${nowTsForLog()}] EDITED: ${oldRecord.account} ${formatAmount(oldRecord.amount, oldRecord.sign)} changed to ${formatAmount(newRecord.amount, newRecord.sign)} (${newRecord.desc})`;
        }
    } else {
        store.records.push(newRecord);
        logAction = `[${nowTsForLog()}] ADDED: ${newRecord.account} ${formatAmount(newRecord.amount, newRecord.sign)} (${newRecord.desc})`;
    }
    
    sendRecordToSheets(newRecord, sheetStatus); // Pass the determined status
    
    addLog(logAction);
    calculateGlobalTotals();
    closeModal();
}

function deleteRecord(guid) {
    const index = store.records.findIndex(r => r.guid === guid);
    if (index === -1) return;

    const deletedRecord = store.records.splice(index, 1)[0];
    
    sendRecordToSheets(deletedRecord, 'Deleted'); 

    addLog(`[${nowTsForLog()}] DELETED: ${deletedRecord.account} ${formatAmount(deletedRecord.amount, deletedRecord.sign)} (${deletedRecord.desc})`);
    calculateGlobalTotals();
    closeModal();
}

function deleteAllData() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PENDING_SYNC_KEY); 
    store.records = [];
    pendingSyncQueue = [];
    store.logs = [`[${nowTsForLog()}] App reset. All data deleted.`];
    calculateGlobalTotals();
    closeModal();
    location.reload(); 
}

// -------------------------------------------------------------------
// 5. Filtering and Sorting 
// -------------------------------------------------------------------
function applyFilters() {
    const searchVal = filterSearch.value.toLowerCase();
    const accountFilter = filterAccount.value;
    
    // Dates ko string (YYYY-MM-DD) mein len.
    const fromDateStr = filterFrom.value;
    const toDateStr = filterTo.value;
    
    // Date objects banayein sirf comparison ke liye (UTC midnight set)
    const fromDateObj = fromDateStr ? new Date(fromDateStr + 'T00:00:00Z') : null;
    // To date ko end of day (23:59:59Z) set karein taake woh date bhi shamil ho
    const toDateObj = toDateStr ? new Date(toDateStr + 'T23:59:59Z') : null; 
    
    // --- 1. Filter List ONLY by DATE for Income/Loan/Expense Totals ---
    let dateFilteredList = store.records.filter(r => {
        // Har record ki date string ko Date Object mein convert karen (UTC midnight set)
        const recordDateObj = new Date(r.date + 'T00:00:00Z');
        
        if (fromDateObj) {
           if (recordDateObj < fromDateObj) return false;
        }
        if (toDateObj) {
           // Check if record date is AFTER the end date
           if (recordDateObj > toDateObj) return false;
        }
        return true;
    });
    
    // --- 2. Filter List by ALL criteria for Records List and Filtered Balance ---
    let fullFilteredList = dateFilteredList.filter(r => {
        // Account Filter
        if (accountFilter !== 'All Accounts' && r.account !== accountFilter) return false;

        // Search Filter (Description or Amount)
        if (searchVal) {
            const matchesDesc = r.desc.toLowerCase().includes(searchVal);
            const matchesAmount = String(r.amount).includes(searchVal);
            if (!matchesDesc && !matchesAmount) return false;
        }

        return true;
    });
    
    // 3. Sorting (Applies only to the final list for rendering)
    fullFilteredList.sort(sortRecords);
    
    // 4. Calculate summary and render the filtered list
    recalcSummaryAndRender(dateFilteredList, fullFilteredList);
}

function sortRecords(a, b) {
    const key = currentSort.key;
    const order = currentSort.order;
    let valA = a[key];
    let valB = b[key];

    if (key === 'amount') {
        valA = Number(valA);
        valB = Number(valB);
    }
    
    let comparison = 0;
    if (valA > valB) comparison = 1;
    else if (valA < valB) comparison = -1;

    return order === 'asc' ? comparison : comparison * -1;
}

function handleSortClick(key) {
    if (currentSort.key === key) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.key = key;
        currentSort.order = 'desc';
    }
    
    // Reset other header indicators
    recordsHead.querySelectorAll('div').forEach(div => {
        if (div.dataset.sortKey !== key) {
            div.removeAttribute('data-sort-order');
        }
    });
    
    // Set current header indicator
    const currentHeader = recordsHead.querySelector(`div[data-sort-key="${key}"]`);
    if (currentHeader) {
        currentHeader.setAttribute('data-sort-order', currentSort.order);
    }
    
    applyFilters();
    saveToStorage(); 
}

function applyQuickFilter(type) {
    filterFrom.value = '';
    filterTo.value = '';
    
    Object.values(quickFilterButtons).forEach(btn => btn.classList.remove('active'));

    const today = new Date();
    let from, to;

    if (type === 'today') {
        from = isoFormat(today);
        to = isoFormat(today);
        quickFilterButtons.today.classList.add('active');
    } else if (type === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        from = isoFormat(yesterday);
        to = isoFormat(yesterday);
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
  filterSearch.addEventListener('input', applyFilters);
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
}

init();
