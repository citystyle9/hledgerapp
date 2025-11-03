// Optimization Summary: Converted to ES6 (const/let, async/await, arrow functions), improved error handling for localStorage parsing, added safety checks to prevent silent failures, and enhanced sync logging. Integrated AES-GCM encryption for localStorage.
// -------------------------------------------------------------------
// 1. Data Store and Constants
// -------------------------------------------------------------------
const STORAGE_KEY = 'homeledger_v1_data_v1_encrypted'; // Updated key for encrypted storage
const PENDING_SYNC_KEY = 'homeledger_pending_sync_v1_encrypted'; // Updated key for encrypted storage
// NOTE: GOOGLE_SHEETS_WEBHOOK is placed here as it is only used for data service operations
const GOOGLE_SHEETS_WEBHOOK = 'https://script.google.com/macros/s/AKfycbzFsmbBc9RPcDUDL97TAhGXl5bSpkZO47_EMIUIznZ1PSRf4vvb0En9sRGP3pSz381X/exec';
let store = { records: [], logs: [] };
let pendingSyncQueue = [];

// Global dependencies (must be available in app.js scope)
/* global currentSort, SORT_KEY, showToast, addLog, nowTsForLog, calculateGlobalTotals, parseDDMMYYYYtoJSDate, isoFormat, ddMMYYYYToISO, encryptData, decryptData, KEY_STORAGE_KEY */

// -------------------------------------------------------------------
// 2. Persistence & Logging
// -------------------------------------------------------------------
const saveToStorage = async () => {
  try { 
      // Encrypt main store and pending sync queue data
      const encryptedStore = await encryptData(JSON.stringify(store));
      const encryptedPending = await encryptData(JSON.stringify(pendingSyncQueue));

      // 1. Store main data
      if (encryptedStore) {
            localStorage.setItem(STORAGE_KEY, encryptedStore);
      } else {
            localStorage.removeItem(STORAGE_KEY);
      }
      
      // 2. Store pending queue
      if (encryptedPending) {
          localStorage.setItem(PENDING_SYNC_KEY, encryptedPending);
      } else {
          localStorage.removeItem(PENDING_SYNC_KEY);
      }
      
      // 3. Store non-sensitive data (sort state)
      localStorage.setItem(SORT_KEY, JSON.stringify(currentSort));

  } catch (e) {
      // Fail gracefully if quota is exceeded or other storage/crypto error
      console.error('Error saving or encrypting to localStorage:', e);
      showToast('Error saving data. Local storage quota exceeded or encryption failed.', 'danger', 5000);
  }
};

const loadFromStorage = async () => {
    try {
        // Load main store
        const rawStore = localStorage.getItem(STORAGE_KEY);
        if (rawStore) { 
            const decryptedStoreJson = await decryptData(rawStore);
            if (decryptedStoreJson) {
                const parsed = JSON.parse(decryptedStoreJson); 
                // Defensive check for array type
                store.records = Array.isArray(parsed.records) ? parsed.records : [];
                store.logs = Array.isArray(parsed.logs) ? parsed.logs : [];
            } else {
                throw new Error("Decryption failed for main store.");
            }
        } else {
             // Initialize to empty arrays if no store found
             store.records = [];
             store.logs = [];
        }
        
        // Load pending sync queue
        const rawPending = localStorage.getItem(PENDING_SYNC_KEY);
        if (rawPending) {
            const decryptedPendingJson = await decryptData(rawPending);
            if (decryptedPendingJson) {
                pendingSyncQueue = Array.isArray(JSON.parse(decryptedPendingJson)) ? JSON.parse(decryptedPendingJson) : [];
            } else {
                throw new Error("Decryption failed for sync queue.");
            }
        } else {
            pendingSyncQueue = [];
        }
        
        // Load sort state (not encrypted)
        const rawSort = localStorage.getItem(SORT_KEY);
        if (rawSort) {
            currentSort = JSON.parse(rawSort) || { key: 'date', order: 'desc' };
        } else {
             currentSort = { key: 'date', order: 'desc' };
        }

    } catch (e) {
        // CRITICAL FIX: If local storage is corrupted or decryption fails, reset to initial state
        console.error('Error loading, parsing, or decrypting localStorage. Resetting data.', e);
        store.records = [];
        store.logs = [`[${nowTsForLog()}] WARNING: Data corrupted/decryption failed. Local storage reset.`];
        pendingSyncQueue = [];
        currentSort = { key: 'date', order: 'desc' };
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(PENDING_SYNC_KEY);
        localStorage.removeItem(SORT_KEY);
        // Clear encryption key to force regeneration if it was the source of corruption
        localStorage.removeItem(KEY_STORAGE_KEY); 
        showToast('Local data corrupted or decryption failed. Data has been reset.', 'danger', 7000);
    }
};

// -------------------------------------------------------------------
// 3. Google Sheets Sync Logic
// -------------------------------------------------------------------

const addToPendingQueue = (record, recordStatus) => {
    // NOTE: This logic should ensure we use DD-MM-YYYY format for `record.date`
    const existingIndex = pendingSyncQueue.findIndex(item => item.id === record.guid);
    
    // Convert negative 'expense' amount back to negative number for sheet backend
    const amountValue = (record.sign === 'expense') ? -Number(record.amount) : Number(record.amount);

    const sheetData = {
        id: record.guid,
        date: record.date, // DD-MM-YYYY string from app.js
        description: record.desc,
        amount: amountValue, 
        account: record.account || 'N/A',
        status: recordStatus
    };
    
    if (existingIndex > -1) {
        // Update existing item
        pendingSyncQueue[existingIndex] = sheetData;
    } else {
        // Add new item
        pendingSyncQueue.push(sheetData);
    }
    saveToStorage(); // NOTE: saveToStorage is now async
    addLog(`[${nowTsForLog()}] 💾 Pending Sync: ${recordStatus} request for ${record.desc}. Added to queue.`);
};

// Improvement: Default status changed to 'CREATED'
const sendRecordToSheets = async (record, recordStatus = 'CREATED') => { 
    if (!record || Number(record.amount) === 0) return;
    
    // Check if offline and queue immediately 
    if (!navigator.onLine) {
        addToPendingQueue(record, recordStatus);
        return;
    }
    
    const amountValue = (record.sign === 'expense') ? -Number(record.amount) : Number(record.amount);

    const sheetData = {
        id: record.guid,
        date: record.date, // DD-MM-YYYY string from app.js
        description: record.desc,
        amount: amountValue, 
        account: record.account || 'N/A',
        status: recordStatus
    };
    
    const attemptFetch = async (data) => {
        try {
            // FIX: Use 'no-cors' mode for reliability with Apps Script webhook POST
            const response = await fetch(GOOGLE_SHEETS_WEBHOOK, {
                method: 'POST',
                mode: 'no-cors', 
                // Content-Type is irrelevant in no-cors mode, but kept for clarity
                headers: { 'Content-Type': 'text/plain' }, 
                body: JSON.stringify(data)
            });
            // In no-cors mode, response.ok is always true, so we assume success.
            return true; 
        } catch (error) {
            // This catch block only hits on network failure (offline/DNS/etc.)
            console.error('Sheet Sync Failed (Network/Server Error):', error);
            return false;
        }
    };

    const success = await attemptFetch(sheetData);
    if (success) {
        // console.log('Sheets Sync: Request sent successfully.');
        const index = pendingSyncQueue.findIndex(item => item.id === record.guid);
        if (index > -1) {
             pendingSyncQueue.splice(index, 1);
             await saveToStorage(); // NOTE: saveToStorage is now async
             addLog(`[${nowTsForLog()}] ✅ Sync Success: ${recordStatus} request for ${record.desc} completed and removed from queue.`);
        }
    } else {
        // Add to Queue only if fetch failed (network/server error)
        addToPendingQueue(record, recordStatus);
    }
};

const attemptPendingSync = async () => {
    if (pendingSyncQueue.length === 0) {
        // console.log('No pending records to sync.');
        return;
    }
    
    // Check if offline before starting sync 
    if (!navigator.onLine) {
         showToast('Offline mode. Sync attempt skipped.', 'offline', 3000);
         return;
    }
    
    showToast('Connected! Syncing pending entries...', 'online', 5000);

    addLog(`[${nowTsForLog()}] 🔄 Starting automatic sync for ${pendingSyncQueue.length} pending records...`);
    // Create a copy to iterate, in case the original array changes during sync
    const recordsToSync = [...pendingSyncQueue];
    let syncCount = 0;

    for (const data of recordsToSync) {
        try {
            // FIX: Use 'no-cors' mode for reliability with Apps Script webhook
            await fetch(GOOGLE_SHEETS_WEBHOOK, {
                method: 'POST',
                mode: 'no-cors', 
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(data)
            });
            
            // If fetch succeeds (no-cors mode), remove it from the actual queue
            const index = pendingSyncQueue.findIndex(item => item.id === data.id);
            if (index > -1) {
                 pendingSyncQueue.splice(index, 1);
                 syncCount++;
            }
            
        } catch (error) {
            // This catch block only hits on network failure, stopping the loop
            console.error('Auto Sync Interrupted (Network/Server Error):', error);
            addLog(`[${nowTsForLog()}] ⚠️ Auto Sync Interrupted. Network connection lost or server error. Remaining: ${pendingSyncQueue.length} in queue.`);
            // Break the loop as the network is likely down
            break;
        }
    }
    
    await saveToStorage(); // NOTE: saveToStorage is now async
    
    if (syncCount > 0) {
        showToast(`Sync completed: ${syncCount} records sent.`, 'online', 4000);
        addLog(`[${nowTsForLog()}] ✅ Automatic sync completed: ${syncCount} records successfully synced.`);
    } else if (pendingSyncQueue.length > 0) {
         showToast(`Sync failed. ${pendingSyncQueue.length} records remain queued.`, 'danger', 5000);
         addLog(`[${nowTsForLog()}] ⚠️ Sync failed. ${pendingSyncQueue.length} records still in queue.`);
    }
};

const restoreDataFromSheets = (isAutoLoad) => {
    // Confirm only on manual trigger
    if (!isAutoLoad && !confirm("Are you sure you want to pull ALL active records from Google Sheet and replace your current Local Data? (This action cannot be undone locally)")) {
      return;
    }

    addLog(`[${nowTsForLog()}] Attempting to restore data from Google Sheet (JSONP)...`);

    const baseUrl = GOOGLE_SHEETS_WEBHOOK + '?action=getall';
    const callbackName = 'homeledger_restore_cb_' + Date.now();
    const url = baseUrl + '&callback=' + callbackName;
    
    // Create a timeout in case script fails to load
    const timeoutMs = 15000;
    let timedOut = false;
    
    const cleanup = () => {
      clearTimeout(to);
      // remove script tag
      const s = document.getElementById(callbackName + '_script');
      if (s && s.parentNode) s.parentNode.removeChild(s);
      // remove global callback
      try { delete window[callbackName]; } catch(e) { window[callbackName] = undefined; }
    };

    const to = setTimeout(() => {
      timedOut = true;
      // Prevent callback from running if it suddenly loads
      window[callbackName] = () => {}; 
      addLog(`[${nowTsForLog()}] ERROR: Sheet Restore JSONP timed out.`);
      if (!isAutoLoad) {
          showToast('Failed to restore: request timed out.', 'danger', 5000);
      }
      cleanup();
    }, timeoutMs);
    
    // Define the global callback (yehi function data receive karega)
    window[callbackName] = async (response) => { // Made async to allow saveToStorage
      if (timedOut) return;
      cleanup();

      try {
        if (response && Array.isArray(response.records)) {
          
          store.records = response.records.map(r => {
              // Safety check for required properties
              if (!r || typeof r.date !== 'string' || typeof r.account !== 'string' || typeof r.desc !== 'string' || isNaN(Number(r.amount))) {
                  // Skip invalid/corrupted record
                  return null;
              }
              
              // CRITICAL FIX: The Apps Script returns DD-MM-YYYY strings for 'date'.
              r.amount = Number(r.amount).toFixed(2); // Ensure amount is string with 2 decimals
              
              // Filter based on normalized status
              return (r.status_normalized === 'CREATED' || r.status_normalized === 'UPDATED') ? r : null; 
          }).filter(r => r !== null); // Remove null entries (DELETED/invalid records)
          
          pendingSyncQueue = []; // Clear queue on full restore
          
          store.logs.unshift(`[${nowTsForLog()}] Data successfully restored from Google Sheet: ${store.records.length} records loaded.`);
          
          // Call app.js function to recalculate and render
          calculateGlobalTotals(); 
          
          // After loading new data, save to storage (which will trigger encryption)
          await saveToStorage();
          
          if (!isAutoLoad) { // Only show toast on manual restore
              showToast(`Successfully restored ${store.records.length} active records from Sheet.`, 'online', 5000);
          }
          addLog(`[${nowTsForLog()}] Sheet Restore completed successfully.`);
          
        } else if (response && response.error) {
          addLog(`[${nowTsForLog()}] ERROR: Sheet Restore returned error: ${response.error}`);
          if (!isAutoLoad) {
             showToast('Restore failed: ' + response.error, 'danger', 7000);
          }
        } else {
          addLog(`[${nowTsForLog()}] ERROR: Sheet Restore returned invalid format or no records.`);
          if (!isAutoLoad) {
             showToast('Failed to restore data: invalid response format.', 'danger', 7000);
          }
        }
      } catch (err) {
        addLog(`[${nowTsForLog()}] ERROR: Processing restore response failed: ${err.message}`);
        if (!isAutoLoad) {
            showToast('Error processing restore data: ' + err.message, 'danger', 7000);
        }
      }
    };

    // Create script tag to fetch JSONP 
    const script = document.createElement('script');
    script.id = callbackName + '_script';
    script.src = url;
    script.async = true;
    script.onerror = () => {
      if (timedOut) return;
      cleanup();
      addLog(`[${nowTsForLog()}] ERROR: Sheet Restore JSONP script load failed.`);
      if (!isAutoLoad) {
        showToast('Failed to restore data from Google Sheet (script load error).', 'danger', 7000);
      }
    };

    document.head.appendChild(script);
};
