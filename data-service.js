// -------------------------------------------------------------------
// 1. Data Store and Constants
// -------------------------------------------------------------------
const STORAGE_KEY = 'homeledger_v1_data_v1';
const PENDING_SYNC_KEY = 'homeledger_pending_sync_v1'; 
// NOTE: GOOGLE_SHEETS_WEBHOOK is placed here as it is only used for data service operations
const GOOGLE_SHEETS_WEBHOOK = 'https://script.google.com/macros/s/AKfycbzFsmbBc9RPcDUDL97TAhGXl5bSpkZO47_EMIUIznZ1PSRf4vvb0En9sRGP3pSz381X/exec'; 

let store = { records: [], logs: [] };
let pendingSyncQueue = []; 

// -------------------------------------------------------------------
// 2. Persistence & Logging
// -------------------------------------------------------------------
function saveToStorage(){
  try{ 
      if (store.records.length > 0 || store.logs.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      } else {
            localStorage.removeItem(STORAGE_KEY);
      }
      
      if (pendingSyncQueue.length > 0) {
          localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(pendingSyncQueue));
      } else {
          localStorage.removeItem(PENDING_SYNC_KEY);
      }
      
      // NOTE: currentSort is part of the application state, but save logic is here
      localStorage.setItem(SORT_KEY, JSON.stringify(currentSort)); 
  }catch(e){}
}
function loadFromStorage(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){ 
        const parsed = JSON.parse(raw); 
        if(parsed.records) store.records = parsed.records; 
        if(parsed.logs) store.logs = parsed.logs; 
    }
    
    const rawPending = localStorage.getItem(PENDING_SYNC_KEY);
    if(rawPending) {
        pendingSyncQueue = JSON.parse(rawPending);
    }
    
    const rawSort = localStorage.getItem(SORT_KEY);
    if(rawSort) currentSort = JSON.parse(rawSort);

  }catch(e){}
}

function addLog(entry){
  store.logs.unshift(entry);
  if(store.logs.length>500) store.logs.length = 500;
  // NOTE: Calling renderLogs and saveToStorage is application logic
  renderLogs();
  saveToStorage(); 
}

// -------------------------------------------------------------------
// 3. Google Sheets Sync Logic
// -------------------------------------------------------------------

function addToPendingQueue(record, recordStatus) {
    const existingIndex = pendingSyncQueue.findIndex(item => item.id === record.guid);
    
    const sheetData = {
        id: record.guid,
        date: record.date,
        description: record.desc,
        amount: record.sign === 'expense' ? -Number(record.amount) : Number(record.amount), 
        account: record.account || 'N/A',
        status: recordStatus
    };

    if (existingIndex > -1) {
        pendingSyncQueue[existingIndex] = sheetData;
    } else {
        pendingSyncQueue.push(sheetData);
    }
    saveToStorage();
    addLog(`[${nowTsForLog()}] 💾 Pending Sync: ${recordStatus} request for ${record.desc}. Added to queue.`);
}

// Updated: Default status is 'Created'
async function sendRecordToSheets(record, recordStatus = 'Created') { 
    if (!record || record.amount === 0) return;
    
    const sheetData = {
        id: record.guid,
        date: record.date,
        description: record.desc,
        amount: record.sign === 'expense' ? -Number(record.amount) : Number(record.amount), 
        account: record.account || 'N/A',
        status: recordStatus
    };
    
    async function attemptFetch(data) {
        try {
            await fetch(GOOGLE_SHEETS_WEBHOOK, {
                method: 'POST',
                mode: 'no-cors', 
                headers: {
                    'Content-Type': 'text/plain', 
                },
                body: JSON.stringify(data)
            });
            return true; 
        } catch (error) {
            console.error('Sheet Sync Failed (Network Error - Check Internet/URL):', error);
            return false;
        }
    }

    const success = await attemptFetch(sheetData);

    if (success) {
        console.log('Sheets Sync: Request sent successfully.');
        const index = pendingSyncQueue.findIndex(item => item.id === record.guid);
        if(index > -1) {
             pendingSyncQueue.splice(index, 1);
             saveToStorage();
             addLog(`[${nowTsForLog()}] ✅ Sync Success: ${recordStatus} request for ${record.desc} completed and removed from queue.`);
        }
    } else {
        // Add to Queue if sync fails
        addToPendingQueue(record, recordStatus);
    }
}

async function attemptPendingSync() {
    if (pendingSyncQueue.length === 0) {
        console.log('No pending records to sync.');
        return;
    }
    
    addLog(`[${nowTsForLog()}] 🔄 Starting automatic sync for ${pendingSyncQueue.length} pending records...`);
    
    // We create a copy to iterate, in case the original array changes during sync
    const recordsToSync = [...pendingSyncQueue];
    let syncCount = 0;

    for (const data of recordsToSync) {
        try {
            // Send request to the sheet using the data from the queue
            const response = await fetch(GOOGLE_SHEETS_WEBHOOK, {
                method: 'POST',
                mode: 'no-cors', 
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify(data)
            });
            
            // If fetch succeeds (response is received in no-cors mode), remove it from the actual queue
            const index = pendingSyncQueue.findIndex(item => item.id === data.id);
            if (index > -1) {
                 pendingSyncQueue.splice(index, 1);
                 syncCount++;
            }
            
        } catch (error) {
            // If fetch fails (network error), stop the sync process (probably still offline)
            console.error('Auto Sync Interrupted (Network Error):', error);
            addLog(`[${nowTsForLog()}] ⚠️ Auto Sync Interrupted. Network connection lost or server error.`);
            break; 
        }
    }
    
    saveToStorage(); // Save the updated queue
    
    if (syncCount > 0) {
        addLog(`[${nowTsForLog()}] ✅ Automatic sync completed: ${syncCount} records successfully synced.`);
    } else if (pendingSyncQueue.length > 0) {
         addLog(`[${nowTsForLog()}] ⚠️ Sync failed. ${pendingSyncQueue.length} records still in queue.`);
    }
}

// JSONP restoreDataFromSheets() FUNCTION
function restoreDataFromSheets(isAutoLoad) {
    if (!isAutoLoad && !confirm("Are you sure you want to pull ALL active records from Google Sheet and replace your current Local Data? (This action cannot be undone locally)")) {
      return;
    }

    addLog(`[${nowTsForLog()}] Attempting to restore data from Google Sheet (JSONP)...`);

    const baseUrl = GOOGLE_SHEETS_WEBHOOK + '?action=getall';
    const callbackName = 'homeledger_restore_cb_' + Date.now();
    const url = baseUrl + '&callback=' + callbackName;

    // Create a timeout in case script fails to load
    const timeoutMs = 15000; // 15 seconds
    let timedOut = false;
    const to = setTimeout(() => {
      timedOut = true;
      window[callbackName] = function(){};
      addLog(`[${nowTsForLog()}] ERROR: Sheet Restore JSONP timed out.`);
      alert('Failed to restore: request timed out.');
      cleanup();
    }, timeoutMs);

    // Cleanup function
    function cleanup() {
      clearTimeout(to);
      // remove script tag
      const s = document.getElementById(callbackName + '_script');
      if (s && s.parentNode) s.parentNode.removeChild(s);
      // remove global callback
      try { delete window[callbackName]; } catch(e) { window[callbackName] = undefined; }
    }

    // Define the global callback (yehi function data receive karega)
    window[callbackName] = function(response) {
      if (timedOut) return;
      cleanup();

      try {
        if (response && Array.isArray(response.records)) {
          
          // IMPORTANT FIX: Convert Date Object back to YYYY-MM-DD string for display/filtering
          store.records = response.records.map(r => {
              // Agar date ek Date Object ban chuki hai, toh usko wapas YYYY-MM-DD string mein convert karen
              if (r.date instanceof Date) {
                   r.date = isoFormat(r.date); 
              } 
              // Updated: Check for 'CREATED' or 'MODIFIED' status
              const statusNorm = (r.status_normalized || String(r.status || '').toUpperCase()).toUpperCase();
              return (statusNorm === 'CREATED' || statusNorm === 'MODIFIED') ? r : null; 
          }).filter(r => r !== null); // Remove null entries (deleted/edited)
          
          pendingSyncQueue = []; // Clear queue on full restore
          store.logs.unshift(`[${nowTsForLog()}] Data successfully restored from Google Sheet: ${store.records.length} records loaded.`);
          calculateGlobalTotals(); // Recalculate everything after restore
          if (!isAutoLoad) { // Only show alert on manual restore
              alert(`Successfully restored ${store.records.length} active records from Google Sheet.`);
          }
          addLog(`[${nowTsForLog()}] Sheet Restore completed successfully.`);
        } else if (response && response.error) {
          addLog(`[${nowTsForLog()}] ERROR: Sheet Restore returned error: ${response.error}`);
          alert('Restore failed: ' + response.error);
        } else {
          addLog(`[${nowTsForLog()}] ERROR: Sheet Restore returned invalid format.`);
          alert('Failed to restore data: invalid response format.');
        }
      } catch (err) {
        addLog(`[${nowTsForLog()}] ERROR: Processing restore response failed: ${err.message}`);
        alert('Error processing restore data: ' + err.message);
      }
    };

    // Create script tag to fetch JSONP 
    const script = document.createElement('script');
    script.id = callbackName + '_script';
    script.src = url;
    script.async = true;
    script.onerror = function() {
      if (timedOut) return;
      cleanup();
      addLog(`[${nowTsForLog()}] ERROR: Sheet Restore JSONP script load failed.`);
      alert('Failed to restore data from Google Sheet (script load error).');
    };

    document.head.appendChild(script);
}
