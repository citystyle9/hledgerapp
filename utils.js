// -------------------------------------------------------------------
// 1. Helper Functions 
// -------------------------------------------------------------------
function pad(n){ return String(n).padStart(2,'0');
}
function nowTsForLog(){
  const d = new Date();
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function formatAmount(n,sign){
  return (sign==='positive'?'Rs ':'Rs ') + Number(n).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
}
function isoFormat(d){
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${dd}`;
}
function isoToday(){
  const d = new Date();
  return isoFormat(d);
}
// Improvement: New function for display date format DD-MM-YYYY
function formatDateDDMMYYYY(isoDateString) {
    if (!isoDateString) return '';
    try {
        const parts = isoDateString.split('-'); // YYYY-MM-DD
        return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY
    } catch(e) {
        return isoDateString;
    }
}
// CRITICAL FIX: Add function to convert ISO (YYYY-MM-DD) to DD-MM-YYYY string format
function isoToDDMMYYYY(isoDateString) {
    if (!isoDateString) return '';
    const parts = isoDateString.split('-'); // [YYYY, MM, DD]
    return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY
}
// CRITICAL FIX: Parser function to convert DD-MM-YYYY string back to a Date object for comparison
function parseDDMMYYYYtoJSDate(ddmmyyyy) {
    if (!ddmmyyyy) return new Date(0); // Return epoch start for safety
    try {
        const parts = ddmmyyyy.split('-'); // Parts: [DD, MM, YYYY]
        // Use YYYY, MM-1, DD to create a date object correctly in local timezone
        const date = new Date(parts[2], parts[1] - 1, parts[0]);
        // Validate if date is valid
        if (isNaN(date.getTime())) {
            console.log("coded: utils.js");
            console.warn(`Invalid date conversion detected: ${ddmmyyyy}`);
            return new Date(0);
        }
        return date;
    } catch(e) {
        return new Date(0); // Return epoch start if parsing fails
    }
}
function capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1);
}

function generateGuid() {
    if ('crypto' in window && 'randomUUID' in window.crypto) {
        return window.crypto.randomUUID();
}
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getFiscalYearDates(){
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth();
    const startYear = month >= 6 ? year : year - 1; 
    const endYear = month >= 6 ?
    year + 1 : year;
    const fromDate = new Date(startYear, 6, 1); 
    const toDate = new Date(endYear, 5, 30);
    return { from: isoFormat(fromDate), to: isoFormat(toDate) };
}
