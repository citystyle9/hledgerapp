// Optimization Summary: Converted init function to async and enclosed core logic in try...finally block to guarantee setupEventListeners is called, fixing the non-responsive button issue.
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
let editingId = null; // Moved to top level scope

// Helper function definition moved here from utility section (for scope clarity)
const debounce = (fn, delay) => {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
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
    toastContainer.appendChild(toast);
    
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
        // console.log('Internet connection restored — syncing queued records...');
        showToast('Connection restored. Syncing...', 'online', 3000);
        attemptPendingSync(); // Calls function from data-service.js
    });

    // Notify user when connection is lost
    window.addEventListener('offline', () => {
        // console.log('Internet connection lost — operating in offline mode.');
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
    Array.from(recordsSection.querySelectorAll('.record-row, .empty-state')).forEach(n => n.remove());
    const rows = (list && Array.isArray(list)) ? list : [];
    
    // Update the sort indicator in the header
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
        // Check if filters are active
        const isFiltered = filterSearch.value || filterAccount.value !== 'All Accounts' || filterFrom.value !== isoToday() || filterTo.value !== isoToday();
        emptyDiv.textContent = isFiltered
                                ? "No records found matching your current filters."
                                : "You have no records yet. Click '+ Add Income/Loan/Expense' to get started!";
        recordsSection.appendChild(emptyDiv);
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
    recordsSection.appendChild(fragment); // Single DOM insert
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
    if (logOverlay.classList.contains('show')) {
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

    title.textContent = `Add New ${account}`;
    accountSelect.value = account;
    dateInput.value = isoToday(); // Saves as YYYY-MM-DD
    descInput.value = '';
    amtInput.value = '';
    
    accountSelect.disabled = true;
    saveBtn.className = `btn-save ${action}`;
    saveBtn.textContent = 'Save';
    
    overlay.classList.add('show');
    descInput.focus();
};

const openEdit = (guid) => {
    // Use const for record lookup
    const record = store.records.find(r => r.guid === guid);
    if (!record) return;

    editingId = guid;
    title.textContent = `Edit ${record.account}`;
    // NOTE: record.date is DD-MM-YYYY in store, but input[type=date] requires YYYY-MM-DD (ISO)
    // CRITICAL FIX: Convert DD-MM-YYYY in store back to ISO (YYYY-MM-DD) for HTML input
    dateInput.value = ddMMYYYYToISO(record.date); 
    accountSelect.value = record.account;
    descInput.value = record.desc;
    // FIX: Show absolute (positive) amount in the edit input field
    amtInput.value = Math.abs(record.amount); 
    
    accountSelect.disabled = false;
    saveBtn.className = `btn-save ${record.account.toLowerCase()}`;
    saveBtn.textContent = 'Update'; 
    
    overlay.classList.add('show');
    descInput.focus();
};

const openDeleteConfirm = (guid) => {
    const record = store.records.find(r => r.guid === guid);
    if (!record) return;
    
    deleteConfirmBtn.dataset.id = guid;
    
    // FIX: Use centralized helper function for consistent color logic
    const amountColor = getAccountColor(record.account);
    
    // Security Improvement: Use a safer HTML construction/text escaping when using innerHTML
    const safeDesc = escapeHtml(record.desc); // Uses new utility function
    // FIX: Display absolute (positive) value only in delete modal
    const displayAmount = formatAmount(Math.abs(record.amount), record.sign);
    const amountHtml = `<span style="font-weight:700; color: ${amountColor};">${displayAmount}</span>`;
    
    deleteDetailsDiv.innerHTML = `
        <strong>Date:</strong> ${formatDateDDMMYYYY(record.date)}<br>
        <strong>Account:</strong> ${record.account}<br>
        <strong>Amount:</strong> ${amountHtml}<br>
        <strong>Description:</strong> ${safeDesc}
    `;
    deleteOverlay.classList.add('show');
};

const closeModal = () => {
    overlay.classList.remove('show');
    deleteOverlay.classList.remove('show');
    resetOverlay.classList.remove('show');
    editingId = null;
    // Close the details menu for cleanup
    const menuDetails = document.querySelector('details.menu');
    if (menuDetails) menuDetails.open = false; 
};

const saveRecord = () => {
    // Input Validation
    if (!dateInput.value || !descInput.value || !amtInput.value) {
        showToast('Please fill in all fields (Date, Description, Amount).', 'danger', 4000);
        return;
    }
    let amount = Number(amtInput.value);
    if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid amount greater than zero.', 'danger', 4000);
        return;
    }
    
    const account = accountSelect.value;
    const sign = (account === 'Expense') ? 'expense' : 'positive';
    const sheetStatus = editingId ? 'UPDATED' : 'CREATED'; 

    // FIX: Convert Expense to negative amount for internal storage
    if (sign === 'expense') {
        amount = -amount; // Store negative value
    }

    const newRecord = {
        guid: editingId || generateGuid(),
        date: dateInput.value, // This is ISO YYYY-MM-DD from the input
        account: account,
        desc: descInput.value.trim(),
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
    const fromDateStr = filterFrom.value;
    const toDateStr = filterTo.value; 
    
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
    const selectedAccount = filterAccount.value;
    if (selectedAccount !== 'All Accounts') {
        filtered = filtered.filter(r => r.account === selectedAccount);
    }

    // Search Filter
    const searchTerm = filterSearch.value.toLowerCase();
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
    Object.values(quickFilterButtons).forEach(btn => btn.classList.remove('active'));

    const today = new Date();
    let from, to; // Declare `from` and `to` with `let`

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
        const dates = getFiscalYearDates(); // Returns { from: YYYY-MM-DD, to: YYYY-MM-DD }
        from = dates.from;
        to = dates.to;
        quickFilterButtons.fiscal.classList.add('active');
    }

    filterFrom.value = from;
    filterTo.value = to;
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
        csv += `${formatDateDDMMYYYY(r.date)},${r.account},${safeDesc},${Math.abs(r.amount).toFixed(2)},${r.sign},${r.guid}\n`;
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
                    if (!r || typeof r.date !== 'string' || typeof r.amount === undefined) {
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
    saveBtn.addEventListener('click', saveRecord);
    cancelBtn.addEventListener('click', closeModal);
    deleteCancelBtn.addEventListener('click', closeModal);
    // Use target property to get the element that was actually clicked
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

    // Filtering Events (using debounce for search input)
    filterSearch.addEventListener('input', debounce(applyFilters, 300));
    filterAccount.addEventListener('change', applyFilters);
    filterFrom.addEventListener('change', applyFilters);
    filterTo.addEventListener('change', applyFilters);
    
    // Quick Filter Events
    quickFilterButtons.today.addEventListener('click', () => applyQuickFilter('today'));
    quickFilterButtons.yesterday.addEventListener('click', () => applyQuickFilter('yesterday'));
    quickFilterButtons.month.addEventListener('click', () => applyQuickFilter('month'));
    quickFilterButtons.fiscal.addEventListener('click', () => applyQuickFilter('fiscal'));

    // Sorting Events
    recordsHead.querySelectorAll('div[data-sort-key]').forEach(div => {
        div.addEventListener('click', (e) => handleSortClick(e.currentTarget.dataset.sortKey));
    });
    
    // Add event listener to close modals when pressing ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === "Escape") {
            if (overlay.classList.contains('show') || deleteOverlay.classList.contains('show') || resetOverlay.classList.contains('show') || logOverlay.classList.contains('show')) {
                closeModal();
            }
        }
    });
};

// -------------------------------------------------------------------
// 9. Initialization (Final Call)
// -------------------------------------------------------------------
const init = async () => {
    try {
        // FIX: Await loadFromStorage as it now performs async crypto operations
        await loadFromStorage(); // This is the potential source of failure/hang

        const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
        applyTheme(savedTheme);

        // Default Filter 'Today' set kiya gaya hai:
        const todayISO = isoToday();
        filterFrom.value = todayISO; 
        filterTo.value = todayISO;   
        quickFilterButtons.today.classList.add('active');
        
        // Set initial sort indicator in the header
        const initialHeader = recordsHead.querySelector(`div[data-sort-key="${currentSort.key}"]`);
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
        console.error("CRITICAL: Initialization failed during data load/crypto setup.", e);
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
