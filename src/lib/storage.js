const prefix='kelasi-data-';
const expenseKeys=['comptes','categories','transactions','recurrences','budgets','deletedDepenseIds'];
export const newId=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`;
export async function readLocal(id){try{const base=JSON.parse(localStorage.getItem(prefix+id)||'null');if(!base)return null;const extras={};for(const key of expenseKeys){const raw=localStorage.getItem(`kelasi-depenses-${id}-${key}`);if(raw!==null)extras[key]=JSON.parse(raw);}return {...base,...extras};}catch{return null}}
export async function writeLocal(id,data){localStorage.setItem(prefix+id,JSON.stringify(data));for(const key of expenseKeys){if(data[key]!==undefined)localStorage.setItem(`kelasi-depenses-${id}-${key}`,JSON.stringify(data[key]));}}
