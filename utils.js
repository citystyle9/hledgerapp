// Optimization Summary: Updated display format in formatDateDDMMYYYY to strictly use DD/MM/YYYY (changing '-' to '/').
// -------------------------------------------------------------------
// 1. Helper Functions 
// -------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, '0');

const nowTsForLog = () => {
  const d = new Date();
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const formatAmount = (n, sign) => {
  return 'Rs ' + Number(n).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
};

// Returns YYYY-MM-DD string (ISO format, standard for HTML date inputs)
const isoFormat = (d) => {
    // Ensure input is a valid Date object
    if (!(d instanceof Date) || isNaN(d)) d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
};

// Returns today's date as YYYY-MM-DD string
const isoToday = () => isoFormat(new Date());

// Converts internal DD-MM-YYYY string to YYYY-MM-DD (for HTML date input[type=date])
const ddMMYYYYToISO = (ddmmyyyy) => {
    if (!ddmmyyyy || typeof ddmmyyyy !== 'string') return '';
    try {
        const parts = ddmmyyyy.split('-'); // DD-MM-YYYY
        if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
            return `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
        }
        return '';
    } catch(e) {
        return '';
    }
};

// Returns DD/MM/YYYY string (for display/export)
const formatDateDDMMYYYY = (dateString) => {
    if (!dateString || typeof dateString !== 'string') return '';
    // If input is YYYY-MM-DD (from HTML input value), convert it to DD/MM/YYYY
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const parts = dateString.split('-'); // YYYY-MM-DD
        return `${parts[2]}/${parts[1]}/${parts[0]}`; // FIX: Use / separator
    }
    // If input is already DD-MM-YYYY, convert separator to DD/MM/YYYY
    if (dateString.match(/^\d{2}-\d{2}-\d{4}$/)) {
        const parts = dateString.split('-'); // DD-MM-YYYY
        return `${parts[0]}/${parts[1]}/${parts[2]}`; // FIX: Use / separator
    }
    return '';
};

// CRITICAL FIX: Converts ISO (YYYY-MM-DD) string to DD-MM-YYYY string format (for storage/sheet consistency)
const isoToDDMMYYYY = (isoDateString) => {
    if (!isoDateString || typeof isoDateString !== 'string') return '';
    const parts = isoDateString.split('-'); // [YYYY, MM, DD]
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY (NOTE: Uses - for internal consistency)
};

// CRITICAL FIX: Parser function to convert DD-MM-YYYY string back to a Date object for comparison/sorting
const parseDDMMYYYYtoJSDate = (ddmmyyyy) => {
    if (!ddmmyyyy || typeof ddmmyyyy !== 'string') return new Date(NaN); 
    try {
        const parts = ddmmyyyy.split('-'); // Parts: [DD, MM, YYYY]
        // Use YYYY, MM-1, DD to create a date object correctly in local timezone
        const year = parseInt(parts[2], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
        const day = parseInt(parts[0], 10);
        
        const date = new Date(year, month, day);

        // Validate if date is valid (i.e., not new Date(0) or invalid)
        if (isNaN(date.getTime()) || date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
            console.warn(`Invalid date conversion detected: ${ddmmyyyy}`);
            return new Date(NaN);
        }
        return date;
    } catch(e) {
        return new Date(NaN); // Return invalid date if parsing fails
    }
};

const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const generateGuid = () => {
    // Modern approach using crypto API
    if (window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
    }
    // Fallback for older browsers (used existing logic)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};

const getFiscalYearDates = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth();
    // Assuming fiscal year starts in July (index 6)
    const startYear = month >= 6 ? year : year - 1; 
    const endYear = month >= 6 ? year + 1 : year;
    // Fiscal Year: July 1st (month 6) to June 30th (month 5)
    const fromDate = new Date(startYear, 6, 1); 
    const toDate = new Date(endYear, 5, 30);
    // Return ISO format for use in HTML input/filters
    return { from: isoFormat(fromDate), to: isoFormat(toDate) };
};

// Security Helper: Basic HTML escaping for dynamic content injection
const escapeHtml = (unsafe) => {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
};
