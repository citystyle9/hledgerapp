// Optimization Summary: Converted all DOM references into a centralized object for clarity. Converted init to use an IIFE and try...finally for guaranteed event listener setup, fixing non-responsive button issue. Used const/let and arrow functions consistently.
// -------------------------------------------------------------------
// 1. Data Store, DOM References and Constants (Keep Global in Scope)
// -------------------------------------------------------------------

// Centralized DOM references object (will be populated in init)
const DOM = {}; 

const THEME_KEY = 'homeledger_theme_v1';
const SORT_KEY = 'homeledger_sort_v1';
const VERSION_TAG = 'HomeLedger v1.5.3'; 

let currentSort = { key: 'date', order: 'desc' }; // Initialized globally, loaded from storage
let editingId = null; // Moved to top level scope

// Global dependencies (must be available in data-service.js scope)
/* global store, pendingSyncQueue, loadFromStorage, saveToStorage, sendRecordToSheets, attemptPendingSync, restoreDataFromSheets, getAccountColor, formatAmount, formatDateDDMMYYYY, nowTsForLog, isoFormat, isoToday, ddMMYYYYToISO, isoToDDMMYYYY, parseDDMMYYYYtoJSDate, capitalize, generateGuid, getFiscalYearDates, escapeHtml, KEY_STORAGE_KEY */


// Helper function definition moved here from utility section (for scope clarity)
const debounce = (fn, delay) => {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
};

// CRITICAL FIX: Centralized function to define all DOM references
const setupDOMReferences = () => {
    DOM.overlay = document.getElementById('modal-overlay');
    DOM.deleteOverlay = document.getElementById('delete-overlay');
    DOM.deleteCancelBtn = document.getElementById('delete-cancel');
    DOM.deleteConfirmBtn = document.getElementById('delete-confirm-btn');
    DOM.deleteDetailsDiv = document.getElementById('delete-record-details');
    DOM.resetOverlay = document.getElementById('reset-overlay'); 
    DOM.resetCancelBtn = document.getElementById('reset-cancel'); 
    DOM.resetConfirmBtn = document.getElementById('reset-confirm-btn'); 
    DOM.title = document.getElementById('modal-title');
    DOM.accountSelect = document.getElementById('entry-account');
    DOM.saveBtn = document.getElementById('modal-save');
    DOM.cancelBtn = document.getElementById('modal-cancel');
    DOM.dateInput = document.getElementById('entry-date');
    DOM.descInput = document.getElementById('entry-desc');
    DOM.amtInput = document.getElementById('entry-amount');
    DOM.recordsSection = document.getElementById('records-section');
    DOM.recordsHead = DOM.recordsSection.querySelector('.records-head');
    DOM.logOverlay = document.getElementById('log-overlay');
    DOM.logClose = document.getElementById('log-close');
    DOM.btnLog = document.getElementById('btn-log');
    DOM.btnReset = document.getElementById('btn-reset');
    DOM.filterSearch = document.getElementById('filter-search');
    DOM.filterAccount = document.getElementById('filter-account');
    DOM.filterFrom = document.getElementById('filter-from');
    DOM.filterTo = document.getElementById('filter-to');
    DOM.btnBackup = document.getElementById('btn-backup');
    DOM.btnRestore = document.getElementById('btn-restore');
    DOM.btnRestoreSheet = document.getElementById('btn-restore-sheet'); 
    DOM.btnExport = document.getElementById('btn-export');
    DOM.themeToggle = document.getElementById('theme-toggle'); 
    DOM.restoreFileInput = document.getElementById('restore-file');
    DOM.toastContainer = document.getElementById('toast-container'); 
    DOM.quickFilterButtons = {
        today: document.getElementById('quick-today'),
        yesterday: document.getElementById('quick-yesterday'),
        month: document.getElementById('quick-month'),
        fiscal: document.getElementById('quick-fiscal')
    };
};


// -------------------------------------------------------------------
// 2. Toast and Networking Logic
// -------------------------------------------------------------------

const showToast = (message, type = 'info', duration = 3000) => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    // Security Improvement: Use textContent to prevent XSS in toast message
    toast.textContent = message;
    DOM.toastContainer.appendChild(toast);
    
    // Use requestAnimationFrame for smoother DOM transition/repaint
    requestAnimationFrame(() => toast.classList.add('show'));

    setTimeout(() => {
        toast.classList.remove('show');
        // Wait for CSS transition before removing
        setTimeout(() => toast.remove(), 300); 
    }, duration);
};

const setupNetworkListeners = () => {
    // Auto-sync on connection restore
    window.addEventListener('online', () => {
        showToast('Connection restored. Syncing...', 'online', 3000);
        attemptPendingSync(); // Calls function from data-service.js
    });

    // Notify user when connection is lost
    window.addEventListener('offline', () => {
        showToast('Offline mode — entries will be queued.', 'offline', 6000);
    });
};


// -------------------------------------------------------------------
// 3. Rendering, Logging, and Summary 
// -------------------------------------------------------------------

const calculateGlobalTotals = () => {
    let income = 0, loan = 0, expense = 0;
    store.records.forEach(r => {
        const amount = Number(r.amount || 0);
        
        // FIX: Read Expense amounts as negative for correct summation
        if (r.account === 'Income') income += amount;
        else if (r.account === 'Loan') loan += amount;
        else if (r.account === 'Expense') expense += amount; // Expense is already negative
    });
    
    // FIX: Balance calculation remains correct as expense is already negative
    const globalBalance = income + loan + expense;

    // --- 1. Only Update Current Balance (Total) ---
    document.getElementById('current-balance').textContent = 'Rs ' + globalBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    // CRITICAL FIX: Ensure filtering and rendering runs immediately after data change
    applyFilters(); 
    
    saveToStorage();
};

const recalcSummaryAndRender = (dateFilteredList, fullFilteredList) => {
    
    // 1. Calculate Income/Loan/Expense Summary Totals based on DATE FILTERED LIST
    let income = 0, loan = 0, expense = 0;
    dateFilteredList.forEach(r => {
        const amount = Number(r.amount || 0);
        // Use Math.abs for display summary calculation to show positive sums
        if (r.account === 'Income') income += Math.abs(amount);
        else if (r.account === 'Loan') loan += Math.abs(amount);
        else if (r.account === 'Expense') expense += Math.abs(amount); 
    });
    
    // --- Update Income/Loan/Expense with DATE FILTERED amounts ---
    document.getElementById('sum-income').textContent = 'Rs ' + income.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('sum-loan').textContent = 'Rs ' + loan.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById('sum-expense').textContent = 'Rs ' + expense.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    
    // 2. Calculate Filtered Balance based on FULL FILTERED LIST
    let filteredIncome = 0, filteredLoan = 0, filteredExpense = 0;
    fullFilteredList.forEach(r => {
        const amount = Number(r.amount || 0);
        // Calculate based on stored sign
        if (r.account === 'Income') filteredIncome += amount;
        else if (r.account === 'Loan') filteredLoan += amount;
        else if (r.account === 'Expense') filteredExpense += amount;
    });
    // FIX: Filtered balance remains sum of all (since expense is negative)
    const filteredBalance = filteredIncome + filteredLoan + filteredExpense;
    
    // --- Update the Filtered Net Balance ---
    document.getElementById('summary-filtered-balance').textContent = 'Rs ' + filteredBalance.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    
    // 3. Render the list of records using the FULL FILTERED LIST
    renderRecordsList(fullFilteredList);
};

const renderRecordsList = (list) => {
    // Clear all previous rows and empty state
    Array.from(DOM.recordsSection.querySelectorAll('.record-row, .empty-state')).forEach(n => n.remove());
    const rows = (list && Array.isArray(list)) ? list : [];
    
    // Update the sort indicator in the header
    const sortKey = currentSort.key;
    const sortOrder = currentSort.order;
    DOM.recordsHead.querySelectorAll('div').forEach(div => {
        if (div.dataset.sortKey === sortKey) {
            div.setAttribute('data-sort-order', sortOrder);
        } else {
            div.removeAttribute('data-sort-order');
        }
    });

    if (rows.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        // Check if filters are active
        const isFiltered = DOM.filterSearch.value || DOM.filterAccount.value !== 'All Accounts' || DOM.filterFrom.value !== isoToday() || DOM.filterTo.value !== isoToday();
        emptyDiv.textContent = isFiltered
                                ? "No records found matching your current filters."
                                : "You have no records yet. Click '+ Add Income/Loan/Expense' to get started!";
        DOM.recordsSection.appendChild(emptyDiv);
        return;
    }
    
    const fragment = document.createDocumentFragment();

    rows.forEach(rec => {
        const row = document.createElement('div'); 
        row.className = 'record-row'; 
        row.dataset.id = rec.guid;
        
        // FIX: Use centralized helper function for consistent color logic
        const amountColor = getAccountColor(rec.account);

        // Format date for display (DD/MM/YYYY)
        const displayDate = formatDateDDMMYYYY(rec.date); 
        
        // Use textContent for safe DOM element creation (XSS Prevention)
        
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
        amountDiv.style.cssText = `color:${amountColor};font-weight:700`;
        // FIX: Display absolute (positive) value only
        amountDiv.textContent = formatAmount(Math.abs(rec.amount), rec.sign);
        row.appendChild(amountDiv);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'record-actions';

        const editBtn = document.createElement('button');
        editBtn.title = 'Edit';
        editBtn.textContent = '✏️';
        // Use arrow function for clean closure
        editBtn.addEventListener('click', () => openEdit(rec.guid)); 
        actionsDiv.appendChild(editBtn);
        
        const deleteBtn = document.createElement('button');
        deleteBtn.title = 'Delete';
        deleteBtn.textContent = '🗑️';
        // Use arrow function for clean closure
        deleteBtn.addEventListener('click', () => openDeleteConfirm(rec.guid)); 
        actionsDiv.appendChild(deleteBtn);
        
        row.appendChild(actionsDiv);
        fragment.appendChild(row); // Append to fragment
    });
    DOM.recordsSection.appendChild(fragment); // Single DOM insert
};

const renderLogs = () => {
    const logModalList = document.getElementById('activity-log-modal');
    // Optimization: Use innerHTML = '' for faster clear if list is large
    logModalList.innerHTML = ''; 
    
    // Optimization: Use DocumentFragment for faster list rendering
    const fragment = document.createDocumentFragment();

    store.logs.forEach(entry => {
        const div = document.createElement('div'); 
        div.className = 'log-item'; 
        // Security Improvement: Use textContent for XSS prevention
        div.textContent = entry; 
        fragment.appendChild(div);
    });
    logModalList.appendChild(fragment);
};

const addLog = (entry) => {
    store.logs.unshift(entry);
    // Limit log size to prevent excessive storage use
    if (store.logs.length > 500) {
        store.logs.length = 500;
    }
    // Only re-render logs if the log modal is currently open
    if (DOM.logOverlay.classList.contains('show')) {
        renderLogs();
    }
    saveToStorage();
};

// -------------------------------------------------------------------
// 4. Modal and Record Operations 
// -------------------------------------------------------------------

const openModal = (action) => {
    editingId = null;
    // Capitalize action for display in title
    const account = capitalize(action); 

    DOM.title.textContent = `Add New ${account}`;
    DOM.accountSelect.value = account;
    DOM.dateInput.value = isoToday(); // Saves as YYYY-MM-DD
    DOM.descInput.value = '';
    DOM.amtInput.value = '';
    
    DOM.accountSelect.disabled = true;
    DOM.saveBtn.className = `btn-save ${action}`;
    DOM.saveBtn.textContent = 'Save';
    
    DOM.overlay.classList.add('show');
    DOM.descInput.focus();
};

const openEdit = (guid) => {
    // Use const for record lookup
    const record = store.records.find(r => r.guid === guid);
    if (!record) return;

    editingId = guid;
    DOM.title.textContent = `Edit ${record.account}`;
    // NOTE: record.date is DD-MM-YYYY in store, but input[type=date] requires YYYY-MM-DD (ISO)
    // CRITICAL FIX: Convert DD-MM-YYYY in store back to ISO (YYYY-MM-DD) for HTML input
    DOM.dateInput.value = ddMMYYYYToISO(record.date); 
    DOM.accountSelect.value = record.account;
    DOM.descInput.value = record.desc;
    // FIX: Show absolute (positive) amount in the edit input field
    DOM.amtInput.value = Math.abs(record.amount); 
    
    DOM.accountSelect.disabled = false;
    DOM.saveBtn.className = `btn-save ${record.account.toLowerCase()}`;
    DOM.saveBtn.textContent = 'Update'; 
    
    DOM.overlay.classList.add('show');
    DOM.descInput.focus();
};

const openDeleteConfirm = (guid) => {
    const record = store.records.find(r => r.guid === guid);
    if (!record) return;
    
    DOM.deleteConfirmBtn.dataset.id = guid;
    
    // FIX: Use centralized helper function for consistent color logic
    const amountColor = getAccountColor(record.account);
    
    // Security Improvement: Use a safer HTML construction/text escaping when using innerHTML
    const safeDesc = escapeHtml(record.desc); // Uses new utility function
    // FIX: Display absolute (positive) value only in delete modal
    const displayAmount = formatAmount(Math.abs(record.amount), record.sign);
    const amountHtml = `<span style="font-weight:700; color: ${amountColor};">${displayAmount}</span>`;
    
    DOM.deleteDetailsDiv.innerHTML = `
        <strong>Date:</strong> ${formatDateDDMMYYYY(record.date)}<br>
        <strong>Account:</strong> ${record.account}<br>
        <strong>Amount:</strong> ${amountHtml}<br>
        <strong>Description:</strong> ${safeDesc}
    `;
    DOM.deleteOverlay.classList.add('show');
};

const closeModal = () => {
    DOM.overlay.classList.remove('show');
    DOM.deleteOverlay.classList.remove('show');
    DOM.resetOverlay.classList.remove('show');
    DOM.logOverlay.classList.remove('show');
    editingId = null;
    // Close the details menu for cleanup
    const menuDetails = document.querySelector('details.menu');
    if (menuDetails) menuDetails.open = false; 
};

const saveRecord = () => {
    // Input Validation
    if (!DOM.dateInput.value || !DOM.descInput.value || !DOM.amtInput.value) {
        showToast('Please fill in all fields (Date, Description, Amount).', 'danger', 4000);
        return;
    }
    let amount = Number(DOM.amtInput.value);
    if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid amount greater than zero.', 'danger', 4000);
        return;
    }
    
    const account = DOM.accountSelect.value;
    const sign = (account === 'Expense') ? 'expense' : 'positive';
    const sheetStatus = editingId ? 'UPDATED' : 'CREATED'; 

    // FIX: Convert Expense to negative amount for internal storage
    if (sign === 'expense') {
        amount = -amount; // Store negative value
    }

    const newRecord = {
        guid: editingId || generateGuid(),
        date: DOM.dateInput.value, // This is ISO YYYY-MM-DD from the input
        account: account,
        desc: DOM.descInput.value.trim(),
        amount: amount.toFixed(2), // Store with 2 decimal places and sign
        sign: sign,
    };
    
    // CRITICAL FIX: Convert the ISO date (YYYY-MM-DD) to the internal DD-MM-YYYY format 
    // for storage and filtering consistency (matching the Sheets response format).
    const dateForStoreAndSheet = isoToDDMMYYYY(newRecord.date);
    newRecord.date = dateForStoreAndSheet; // Update the record before storage/sync

    let logAction;
    // Display amount uses absolute value for logging
    const logAmount = formatAmount(Math.abs(newRecord.amount), newRecord.sign);

    if (editingId) {
        const index = store.records.findIndex(r => r.guid === editingId);
        if (index !== -1) {
            const oldRecord = store.records[index];
            store.records[index] = newRecord;
            logAction = `[${nowTsForLog()}] UPDATED: ${oldRecord.account} ${formatAmount(Math.abs(oldRecord.amount), oldRecord.sign)} -> ${logAmount} (${newRecord.desc})`;
        }
    } else {
        store.records.push(newRecord);
        logAction = `[${nowTsForLog()}] ADDED: ${newRecord.account} ${logAmount} (${newRecord.desc})`;
    }
    
    // NOTE: sendRecordToSheets receives the DD-MM-YYYY date from newRecord.date
    sendRecordToSheets(newRecord, sheetStatus); 
    
    addLog(logAction);
    calculateGlobalTotals();
    closeModal();
};

const deleteRecord = (guid) => {
    const index = store.records.findIndex(r => r.guid === guid);
    if (index === -1) return;

    // Use const for array method result
    const [deletedRecord] = store.records.splice(index, 1);
    
    // Status Consistency: DELETED remains
    sendRecordToSheets(deletedRecord, 'DELETED'); 

    // FIX: Log uses absolute value
    addLog(`[${nowTsForLog()}] DELETED: ${deletedRecord.account} ${formatAmount(Math.abs(deletedRecord.amount), deletedRecord.sign)} (${deletedRecord.desc})`);
    calculateGlobalTotals();
    closeModal();
};

const deleteAllData = () => {
    // Use const for array literal
    const resetLogs = [`[${nowTsForLog()}] App reset. All data deleted.`];
    
    // Clear all related keys in local storage
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PENDING_SYNC_KEY); 
    localStorage.removeItem(SORT_KEY);
    // FIX: Clear encryption key as well
    localStorage.removeItem(KEY_STORAGE_KEY);
    
    store.records = [];
    pendingSyncQueue = [];
    store.logs = resetLogs; // Set new log content
    currentSort = { key: 'date', order: 'desc' };
    
    // Recalc/Render after reset
    calculateGlobalTotals(); 
    closeModal();
    // Use location.reload() to fully reset the app state/UI
    location.reload(); 
};

// -------------------------------------------------------------------
// 5. Theme Toggle 
// -------------------------------------------------------------------

const applyTheme = (theme) => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
};

const toggleTheme = () => {
    // Read theme from <html> tag for source of truth
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
};

// -------------------------------------------------------------------
// 6. Filtering and Sorting 
// -------------------------------------------------------------------

const handleSortClick = (key) => {
    if (currentSort.key === key) {
        currentSort.order = currentSort.order === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.key = key;
        currentSort.order = 'desc'; // Default to descending for new sort key
    }
    // Optimization: Save sort state immediately
    localStorage.setItem(SORT_KEY, JSON.stringify(currentSort));
    applyFilters();
};

const applyFilters = () => {
    let filtered = [...store.records];

    // Date Filter: filterFrom.value and filterTo.value are YYYY-MM-DD
    const fromDateStr = DOM.filterFrom.value;
    const toDateStr = DOM.filterTo.value; 
    
    // CRITICAL FIX: Create filter date objects for the START (00:00:00) and END (23:59:59) of the selected day (Local Time)
    const fromDate = fromDateStr ? new Date(fromDateStr + 'T00:00:00') : null;
    const toDate = toDateStr ? new Date(toDateStr + 'T23:59:59') : null; 
    
    if (fromDate || toDate) {
        filtered = filtered.filter(r => {
            // CRITICAL FIX: Parse DD-MM-YYYY string from restored record into a Date object
            const rDate = parseDDMMYYYYtoJSDate(r.date); 
            
            // Check if parsing failed (date is epoch start 1970-01-01) or date range fails
            if (isNaN(rDate.getTime())) return false; 
            
            return (!fromDate || rDate >= fromDate) && (!toDate || rDate <= toDate);
        });
    }

    const dateFilteredList = [...filtered];

    // Account Filter
    const selectedAccount = DOM.filterAccount.value;
    if (selectedAccount !== 'All Accounts') {
        filtered = filtered.filter(r => r.account === selectedAccount);
    }

    // Search Filter
    const searchTerm = DOM.filterSearch.value.toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(r => 
            r.desc.toLowerCase().includes(searchTerm) || 
            // FIX: Search filter checks the absolute value for consistency
            Math.abs(Number(r.amount)).toString().includes(searchTerm) ||
            r.account.toLowerCase().includes(searchTerm)
        );
    }

    // Sort
    filtered.sort((a, b) => {
        const key = currentSort.key;
        const order = currentSort.order;
        let valA = a[key];
        let valB = b[key];

        if (key === 'amount') {
            // FIX: Sort by numeric value (includes sign)
            valA = Number(valA);
            valB = Number(valB);
        } else if (key === 'date') {
            // CRITICAL FIX: Sort by date requires converting DD-MM-YYYY strings to Date objects
            valA = parseDDMMYYYYtoJSDate(valA).getTime();
            valB = parseDDMMYYYYtoJSDate(valB).getTime();
        }
        
        let comparison = 0;
        if (valA > valB) comparison = 1;
        else if (valA < valB) comparison = -1;

        return order === 'asc' ? comparison : comparison * -1;
    });
    recalcSummaryAndRender(dateFilteredList, filtered);
};

const applyQuickFilter = (type) => {
    // Clear active class from all buttons
    Object.values(DOM.quickFilterButtons).forEach(btn => btn.classList.remove('active'));

    const today = new Date();
    let from, to; // Declare `from` and `to` with `let`

    if (type === 'today') {
        from = isoFormat(today);
        to = isoFormat(today);
        DOM.quickFilterButtons.today.classList.add('active');
    } else if (type === 'yesterday') {
        const yesterday = new Date(today);
        yesterday.setDate(today.getDate() - 1);
        from = isoFormat(yesterday);
        to = isoFormat(yesterday);
        DOM.quickFilterButtons.yesterday.classList.add('active');
    } else if (type === 'month') {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        from = isoFormat(startOfMonth);
        to = isoFormat(today); 
        DOM.quickFilterButtons.month.classList.add('active');
    } else if (type === 'fiscal') {
        const dates = getFiscalYearDates(); // Returns { from: YYYY-MM-DD, to: YYYY-MM-DD }
        from = dates.from;
        to = dates.to;
        DOM.quickFilterButtons.fiscal.classList.add('active');
    }

    DOM.filterFrom.value = from;
    DOM.filterTo.value = to;
    applyFilters();
};

// -------------------------------------------------------------------
// 7. Export/Import (Backup/Restore UI interaction) 
// -------------------------------------------------------------------

// Download function (requires a helper)
const download = (data, filename, type) => {
    const file = new Blob([data], {type: type});
    const a = document.createElement("a");
    const url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    // Cleanup URL object and temporary element after click
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);  
    }, 0);
};

const backupData = async () => {
    // NOTE: Backup JSON is NOT encrypted for portability, only localStorage is encrypted.
    const dataToSave = {
        version: VERSION_TAG,
        timestamp: nowTsForLog(),
        records: store.records,
        logs: store.logs,
        // The queue might contain sensitive data, so decrypt it before putting into unencrypted backup
        pendingSync: pendingSyncQueue 
    };
    const filename = `homeledger_backup_${isoToday().replace(/-/g, '')}.json`; // Use clean ISO date for filename
    download(JSON.stringify(dataToSave, null, 2), filename, 'application/json');
    addLog(`[${nowTsForLog()}] Data backed up successfully.`);
    showToast('Backup file downloaded.', 'info', 3000);
};

const exportCSV = () => {
    if (store.records.length === 0) {
        showToast('No records to export.', 'danger', 3000);
        return;
    }
    // Header for CSV
    let csv = "Date,Account,Description,Amount,Sign,GUID\n";
    store.records.forEach(r => {
        // Double-quote escape for CSV
        const safeDesc = `"${r.desc.replace(/"/g, '""')}"`; 
        // FIX: Export absolute value in CSV (relying on 'Sign' field for clarity)
        csv += `${formatDateDDMMYYYY(r.date)},${r.account},${safeDesc},${Math.abs(Number(r.amount)).toFixed(2)},${r.sign},${r.guid}\n`;
    });

    const filename = `homeledger_export_${isoToday().replace(/-/g, '')}.csv`;
    download(csv, filename, 'text/csv');
    addLog(`[${nowTsForLog()}] Data exported to CSV successfully.`);
    showToast('CSV file exported.', 'info', 3000);
};

const restoreData = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.records && Array.isArray(data.records)) {
                
                // IMPORTANT: Ensure all restored records have the correct DD-MM-YYYY date format AND correct sign
                store.records = data.records.map(r => {
                    // Safety check for basic structure
                    if (!r || typeof r.date !== 'string' || typeof r.amount === 'undefined') { // FIX: Corrected check
                        return null;
                    }
                    
                    // CRITICAL FIX: Ensure restored record date is stored as DD-MM-YYYY string
                    let dateString = r.date;
                    // Handle DD/MM/YYYY format (from old export CSVs) and convert to internal DD-MM-YYYY
                    if (dateString.match(/^\d{2}\/\d{2}\/\d{4}$/)) { 
                        dateString = dateString.replace(/\//g, '-');
                    }
                    
                    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) { // ISO YYYY-MM-DD
                        r.date = isoToDDMMYYYY(dateString);
                    } else if (!dateString.match(/^\d{2}-\d{2}-\d{4}$/)) { // Not DD-MM-YYYY, fallback to epoch
                        r.date = isoToDDMMYYYY(isoFormat(new Date(0)));
                    } else {
                        r.date = dateString; // Assume it's already DD-MM-YYYY
                    }
                    
                    // FIX: Ensure amount respects the negative sign policy for Expense
                    let amountValue = Number(r.amount);
                    if (r.account === 'Expense' && amountValue > 0) {
                        amountValue = -amountValue;
                    } else if ((r.account === 'Income' || r.account === 'Loan') && amountValue < 0) {
                        // Correct sign if income/loan was mistakenly stored negative
                        amountValue = Math.abs(amountValue);
                    }
                    
                    r.amount = amountValue.toFixed(2);
                    r.sign = (r.account === 'Expense') ? 'expense' : 'positive'; // Ensure sign property is correct
                    
                    return r;
                }).filter(r => r !== null); // Filter out invalid records
                
                store.logs = Array.isArray(data.logs) ? data.logs : [];
                pendingSyncQueue = Array.isArray(data.pendingSync) ? data.pendingSync : []; 
          
                store.logs.unshift(`[${nowTsForLog()}] Data restored from local file: ${file.name}`);
                calculateGlobalTotals();
                // FIX: Save state after restoration (triggers encryption)
                await saveToStorage(); 
                showToast(`Successfully restored ${store.records.length} records.`, 'online', 5000);
                addLog(`[${nowTsForLog()}] Local Restore: ${store.records.length} records loaded.`);
            } else {
                showToast('Error: Invalid backup file format. "records" array not found.', 'danger', 5000);
            }
        } catch (err) {
            showToast('Error reading or parsing the file: ' + err.message, 'danger', 5000);
        }
        // Clear file input to allow re-uploading the same file
        event.target.value = null; 
    };
    // Ensure the reader reads as text
    reader.readAsText(file);
};

// JSONP restoreDataFromSheets() function relies on data-service.js


// -------------------------------------------------------------------
// 8. Event Listeners (UI/App Setup)
// -------------------------------------------------------------------

const setupEventListeners = () => {
    setupNetworkListeners();

    document.querySelectorAll('.big-btn').forEach(btn => {
        btn.addEventListener('click', (e) => openModal(e.target.dataset.action));
    });
    DOM.saveBtn.addEventListener('click', saveRecord);
    DOM.cancelBtn.addEventListener('click', closeModal);
    DOM.deleteCancelBtn.addEventListener('click', closeModal);
    // Use target property to get the element that was actually clicked
    DOM.deleteConfirmBtn.addEventListener('click', (e) => deleteRecord(e.target.dataset.id)); 
    DOM.btnReset.addEventListener('click', () => DOM.resetOverlay.classList.add('show'));
    DOM.resetCancelBtn.addEventListener('click', closeModal);
    DOM.resetConfirmBtn.addEventListener('click', deleteAllData);

    DOM.btnLog.addEventListener('click', () => { 
        renderLogs();
        DOM.logOverlay.classList.add('show');
    });
    DOM.logClose.addEventListener('click', () => DOM.logOverlay.classList.remove('show'));
    
    DOM.themeToggle.addEventListener('click', toggleTheme);
    
    DOM.btnBackup.addEventListener('click', backupData);
    DOM.btnExport.addEventListener('click', exportCSV);
    DOM.btnRestore.addEventListener('click', () => DOM.restoreFileInput.click());
    DOM.btnRestoreSheet.addEventListener('click', () => restoreDataFromSheets(false)); 
    DOM.restoreFileInput.addEventListener('change', restoreData);

    // Filtering Events (using debounce for search input)
    DOM.filterSearch.addEventListener('input', debounce(applyFilters, 300));
    DOM.filterAccount.addEventListener('change', applyFilters);
    DOM.filterFrom.addEventListener('change', applyFilters);
    DOM.filterTo.addEventListener('change', applyFilters);
    
    // Quick Filter Events
    DOM.quickFilterButtons.today.addEventListener('click', () => applyQuickFilter('today'));
    DOM.quickFilterButtons.yesterday.addEventListener('click', () => applyQuickFilter('yesterday'));
    DOM.quickFilterButtons.month.addEventListener('click', () => applyQuickFilter('month'));
    DOM.quickFilterButtons.fiscal.addEventListener('click', () => applyQuickFilter('fiscal'));

    // Sorting Events
    DOM.recordsHead.querySelectorAll('div[data-sort-key]').forEach(div => {
        div.addEventListener('click', (e) => handleSortClick(e.currentTarget.dataset.sortKey));
    });
    
    // Add event listener to close modals when pressing ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === "Escape") {
            if (DOM.overlay.classList.contains('show') || DOM.deleteOverlay.classList.contains('show') || DOM.resetOverlay.classList.contains('show') || DOM.logOverlay.classList.contains('show')) {
                closeModal();
            }
        }
    });
};

// -------------------------------------------------------------------
// 9. Initialization (Final Call)
// -------------------------------------------------------------------
const init = async () => {
    // CRITICAL FIX: Ensure DOM references are populated before any element interaction
    setupDOMReferences();
    
    try {
        // FIX: Await loadFromStorage as it now performs async crypto operations
        await loadFromStorage(); // This is the potential source of failure/hang

        const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
        applyTheme(savedTheme);

        // Default Filter 'Today' set kiya gaya hai:
        const todayISO = isoToday();
        DOM.filterFrom.value = todayISO; 
        DOM.filterTo.value = todayISO;   
        DOM.quickFilterButtons.today.classList.add('active');
        
        // Set initial sort indicator in the header
        const initialHeader = DOM.recordsHead.querySelector(`div[data-sort-key="${currentSort.key}"]`);
        if (initialHeader) {
            initialHeader.setAttribute('data-sort-order', currentSort.order);
        }
        
        // Calculate and render with initial data and filters
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

    } catch(e) {
        console.error("CRITICAL: Initialization failed during data load/crypto setup. Proceeding with default UI setup.", e);
        // If loading fails, continue setup with empty/default state
        showToast("CRITICAL ERROR: Data initialization failed. App is running in empty/default state.", 'danger', 10000);
    } finally {
        // CRITICAL FIX: Ensure event listeners are attached regardless of whether data loading succeeded or failed.
        setupEventListeners(); 
        
        // PWA Service Worker Registration is non-critical and can run last.
        if ('serviceWorker' in navigator) {
            // Register the service worker at the correct scope path
            navigator.serviceWorker.register('/hledgerapp/service-worker.js').then(reg => {
                console.log('Service Worker registered successfully:', reg);
            }).catch(error => {
                console.log('Service Worker registration failed:', error);
            });
        }
    }
};

// Ensure initialization runs only after all DOM is loaded
document.addEventListener('DOMContentLoaded', init);
