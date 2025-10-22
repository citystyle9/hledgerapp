// -------------------------------------------------------------------
// 1. Helper Functions 
// -------------------------------------------------------------------
function pad(n){ return String(n).padStart(2,'0'); }
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
function capitalize(s){ return s.charAt(0).toUpperCase() + s.slice(1); }

function generateGuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function getFiscalYearDates(){
    const d = new Date();
    const year = d.getFullYear();
    const month = d.getMonth(); 
    if (month >= 6) { startYear = year; endYear = year + 1; } 
    else { startYear = year - 1; endYear = year; }
    const fromDate = new Date(startYear, 6, 1); 
    const toDate = new Date(endYear, 5, 30);   
    return { from: isoFormat(fromDate), to: isoFormat(toDate) };
}

function seedSampleData() {
    return []; 
}
