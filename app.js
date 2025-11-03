// -------------------------------------------------------------------
// 1. DOM References and Constants (Keep Global in Scope)
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
const toastContainer = document.getElementById('toast-container'); 

const quickFilterButtons = {
    today: document.getElementById('quick-today'),
    yesterday: document.getElementById('quick-yesterday'),
    month: document.getElementById('quick-month'),
    fiscal: document.getElementById('quick-fiscal')
};

const THEME_KEY = 'homeledger_theme_v1';
const SORT_KEY = 'homeledger_sort_v1';
const VERSION_TAG = 'HomeLedger v1.5.3'; 
let currentSort = { key: 'date', order: 'desc' }; // Initialized globally, loaded from storage

// Helper function placeholder (needs to be available globally in the script scope)
function debounce(fn, delay) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}


// -------------------------------------------------------------------
// 2. Toast and Networking Logic
// -------------------------------------------------------------------

function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function setupNetworkListeners() {
    // Auto-sync on connection restore
    window.addEventListener('online', () => {
        console.log('Internet connection restored — syncing queued records...');
        attemptPendingSync(); // Calls function from data-service.js
    });

    // Notify user when connection is lost
    window.addEventListener('offline', () => {
        console.log('Internet connection lost — operating in offline mode.');
        showToast('Offline mode — entries will be queued.', 'offline', 6000);
    });
}


// -------------------------------------------------------------------
// 3. Rendering, Logging, and Summary 
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
    
    // CRITICAL FIX: Ensure filtering and rendering runs immediately after data change
    applyFilters(); 
    
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
        const row = document.createElement('div'); 
        row.className='record-row'; 
        row.dataset.id=rec.guid;
        
        let amountColor;
        // Improvement: Use CSS variables directly for color consistency
        if(rec.sign === 'expense') amountColor = `color:var(--danger);font-weight:700`;
        else if(rec.account === 'Loan') amountColor = `color:var(--warning);font-weight:700`;
        else amountColor = `color:var(--success);font-weight:700`;

        // Improvement: Format date for display (DD-MM-YYYY)
        const displayDate = formatDateDDMMYYYY(rec.date); 
        
        // Fix XSS: Build elements safely using textContent (1)
        
        const dateDiv = document.createElement('div');
        dateDiv.textContent = displayDate;
        row.appendChild(dateDiv);
        
        const accountDiv = document.createElement('div');
        accountDiv.textContent = rec.account;
        row.appendChild(accountDiv);

        const descDiv = document.createElement('div');
        descDiv.textContent = rec.desc;
        row.appendChild(descDiv);

        const amountDiv = document.createElement('div');
        amountDiv.style.cssText = amountColor;
        amountDiv.textContent = formatAmount(rec.amount,rec.sign);
        row.appendChild(amountDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'record-actions';

        const editBtn = document.createElement('button');
        editBtn.title = 'Edit';
        editBtn.textContent = '✏️';
        editBtn.addEventListener('click', ()=> openEdit(rec.guid));
        actionsDiv.appendChild(editBtn);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.title = 'Delete';
        deleteBtn.textContent = '🗑️';
        deleteBtn.addEventListener('click', ()=> openDeleteConfirm(rec.guid));
        actionsDiv.appendChild(deleteBtn);
        
        row.appendChild(actionsDiv);
        recordsSection.appendChild(row);
    });
}

function renderLogs(){
    const logModalList = document.getElementById('activity-log-modal');
    logModalList.innerHTML = '';
    store.logs.forEach(entry=>{
        const div = document.createElement('div'); 
        div.className='log-item'; 
        div.textContent = entry;
        logModalList.appendChild(div);
    });
}

function addLog(entry){
    store.logs.unshift(entry);
    if(store.logs.length>500) store.logs.length = 500;
    renderLogs();
    saveToStorage();
}

// -------------------------------------------------------------------
// 4. Modal and Record Operations 
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
    dateInput.value = isoToday(); // Saves as YYYY-MM-DD
    descInput.value = '';
    amtInput.value = '';
    
    accountSelect.disabled = true;
    saveBtn.className = 'btn-save ' + action;
    saveBtn.textContent = 'Save'; // Default text
    
    overlay.classList.add('show');
    descInput.focus();
}

function openEdit(guid) {
    const record = store.records.find(r => r.guid === guid);
    if (!record) return;

    editingId = guid;
    title.textContent = `Edit ${record.account}`;
    dateInput.value = record.date; // Date is YYYY-MM-DD
    accountSelect.value = record.account;
    descInput.value = record.desc;
    amtInput.value = record.amount;
    
    accountSelect.disabled = false;
    saveBtn.className = 'btn-save ' + record.account.toLowerCase();
    saveBtn.textContent = 'Update'; // Improvement: Change button text
    
    overlay.classList.add('show');
    descInput.focus();
}

function openDeleteConfirm(guid) {
    const record = store.records.find(r => r.guid === guid);
    if (!record) return;
    
    deleteConfirmBtn.dataset.id = guid;
    // Fix XSS: Escape HTML in description when using innerHTML (1)
    const escapedDesc = record.desc.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    
    deleteDetailsDiv.innerHTML = `
        <strong>Date:</strong> ${formatDateDDMMYYYY(record.date)}<br>
        <strong>Account:</strong> ${record.account}<br>
        <strong>Amount:</strong> <span style="font-weight:700; color: ${record.sign === 'expense' ? 'var(--danger)' : 'var(--success)'};">${formatAmount(record.amount, record.sign)}</span><br>
        <strong>Description:</strong> ${escapedDesc}
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

    // Improvement: Change status keywords
    const sheetStatus = editingId ? 'UPDATED' : 'CREATED'; 

    const newRecord = {
        guid: editingId || generateGuid(),
        date: dateInput.value, // Date is YYYY-MM-DD (standard HTML input format)
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
            logAction = `[${nowTsForLog()}] UPDATED: ${oldRecord.account} ${formatAmount(oldRecord.amount, oldRecord.sign)} changed to ${formatAmount(newRecord.amount, newRecord.sign)} (${newRecord.desc})`;
        }
    } else {
        store.records.push(newRecord);
        logAction = `[${nowTsForLog()}] ADDED: ${newRecord.account} ${formatAmount(newRecord.amount, newRecord.sign)} (${newRecord.desc})`;
    }
    
    sendRecordToSheets(newRecord, sheetStatus); 
    
    addLog(logAction);
    calculateGlobalTotals();
    closeModal();
}

function deleteRecord(guid) {
    const index = store.records.findIndex(r => r.guid === guid);
    if (index === -1) return;

    const deletedRecord = store.records.splice(index, 1)[0];
    
    // Status Consistency: DELETED remains
    sendRecordToSheets(deletedRecord, 'DELETED'); 

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
// 5. Theme Toggle 
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
// 6. Filtering and Sorting 
// -------------------------------------------------------------------

function handleSortClick(key){
    if (currentSort.key === key) {
        currentSort.order = currentSort.order === 'asc' ?
        'desc' : 'asc';
    } else {
        currentSort.key = key;
        currentSort.order = 'desc';
    }
    applyFilters();
}

function applyFilters(){
    let filtered = [...store.records];

    // Date Filter
    // Fix Date Handling: Remove 'Z' to respect local timezone (3)
    const fromDate = filterFrom.value ? new Date(filterFrom.value + 'T00:00:00') : null;
    const toDate = filterTo.value ? new Date(filterTo.value + 'T23:59:59') : null; 
    if (fromDate || toDate) {
        filtered = filtered.filter(r => {
            // CRITICAL FIX: Parse DD-MM-YYYY string from restored record into a Date object
            const rDate = parseDDMMYYYYtoJSDate(r.date); 
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
    });
    recalcSummaryAndRender(dateFilteredList, filtered);
}

function applyQuickFilter(type){
    Object.values(quickFilterButtons).forEach(btn => btn.classList.remove('active'));

    const today = new Date();
    let from = isoToday();
    let to = isoToday();

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
// 7. Export/Import (Backup/Restore UI interaction) 
// -------------------------------------------------------------------

// Download function (requires a helper)
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
    // Improvement: Use DD-MM-YYYY format in CSV
    let csv = "Date,Account,Description,Amount,Sign,GUID\n";
    store.records.forEach(r => {
        const safeDesc = r.desc.replace(/"/g, '""'); 
        csv += `${formatDateDDMMYYYY(r.date)},${r.account},"${safeDesc}",${r.amount},${r.sign},${r.guid}\n`;
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
        try 
        {
            const data = JSON.parse(e.target.result);
            if (data.records && Array.isArray(data.records)) {
                store.records = data.records;
                store.logs = data.logs || [];
                pendingSyncQueue = data.pendingSync || []; 
          
          
                // Ensure restored records are in string format for consistency
                store.records = store.records.map(r => {
                    if (r.date instanceof Date) {
                        r.date 
                        = isoFormat(r.date);
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

// JSONP restoreDataFromSheets() function relies on data-service.js


// -------------------------------------------------------------------
// 8. Event Listeners (UI/App Setup)
// -------------------------------------------------------------------

function setupEventListeners() {
    setupNetworkListeners(); // NEW: Network listeners for auto-sync

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

    // Filtering Events 
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
// 9. Initialization (Final Call)
// -------------------------------------------------------------------
function init(){
    loadFromStorage(); // From data-service.js
    
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(savedTheme);

    // Default Filter 'Today' set kiya gaya hai:
    filterFrom.value = isoToday(); // Saves as YYYY-MM-DD
    filterTo.value = isoToday();   // Saves as YYYY-MM-DD
    quickFilterButtons.today.classList.add('active');
    
    // Set initial sort indicator in the header
    const initialHeader = recordsHead.querySelector(`div[data-sort-key="${currentSort.key}"]`);
    if (initialHeader) {
        initialHeader.setAttribute('data-sort-order', currentSort.order);
    }
    
    calculateGlobalTotals(); 
    
    // Auto Sync Check
    if (pendingSyncQueue.length > 0) {
        attemptPendingSync(); // From data-service.js
    }
    
    addLog(`[${nowTsForLog()}] App loaded (v${VERSION_TAG.split('v')[1]}).`);
    
    // NEW: Initial offline check on load
    if (!navigator.onLine) {
        showToast('App loaded in Offline mode.', 'offline', 6000);
    }

    setupEventListeners(); // CRITICAL FIX: Ensure this is called!
    
    // PWA Service Worker Registration
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/hledgerapp/service-worker.js');
    }
}

document.addEventListener('DOMContentLoaded', init);
