import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowRight, ArrowUpRight, Bell, Briefcase,
  CalendarCheck, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  HelpCircle, Cloud, CloudOff, Download, Eye, EyeOff, FileText, Home, Landmark,
  Laptop, LogOut, Menu, Moon, MoreHorizontal, Plus, Receipt, RefreshCw, Settings,
  ShieldCheck, Smartphone, Sparkles, Sun, Target, TrendingUp, Wallet, X, Zap, Lock,
  Mail, KeyRound, Pencil, Trash2, Upload, PiggyBank, BarChart3
} from 'lucide-react';
import { cloudConfigured, supabase } from './lib/supabase';
import { newId, readLocal, writeLocal } from './lib/storage';
import { DEFAULT_WEEKLY_TARGET, normalizeWeeklyTarget, sumAmounts, sumByCategory, totalAllocated, isWeekValidated, isWeekMissed, forecastTotal, bankGap, projectProgress, calculateForecast } from './lib/calc.js';
import { migrateData } from './lib/migrate.js';
import { mergeData, mergeRows } from './lib/sync.js';
import { computeDebtSchedule } from './utils/debt.js';
import { blankDepenses, normalizeDepenses, generateDueOccurrences, mergeExpenseData } from './lib/depenses.js';
import ExpensesPage from './components/ExpensesPage.jsx';
import ExpensesBoundary from './lib/ExpensesBoundary.jsx';
import { computePeriodTotals, getCurrentPeriod, isPeriodValidated } from './utils/periods.js';
import { mergeBackup } from './lib/backup.js';
import { resolvePage, selectNavigationItems } from './lib/navigation.js';

const START_ISO = '2026-11-02';
const WEEKS_TOTAL = 104;
const START_MS = Date.parse(`${START_ISO}T00:00:00Z`);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const NAV_ITEMS = [
  { id: 'home', label: 'Accueil', icon: Home },
  { id: 'entries', label: 'Versements', icon: Receipt },
  { id: 'forecast', label: 'Prévisions', icon: BarChart3 },
  { id: 'projects', label: 'Mes projets', icon: Target },
  { id: 'debts', label: 'Dettes', icon: Wallet },
  { id: 'bank', label: 'Compte bancaire', icon: Landmark },
  { id: 'expenses', label: 'Dépenses', icon: Wallet },
  { id: 'settings', label: 'Réglages', icon: Settings }
];
const CATEGORIES = [
  { id: 'perso', label: 'Épargne personnelle', color: 'mint', icon: Wallet },
  { id: 'business', label: 'Business', color: 'violet', icon: Briefcase },
  { id: 'congo', label: 'Projets au Congo', color: 'orange', icon: Target }
];
const DEFAULT_GOALS = [
  { id: '9f4d0000-0000-4000-8000-000000000001', title: 'Acheter une parcelle', target: 12000, category: 'Immobilier', color: 'orange' },
  { id: '9f4d0000-0000-4000-8000-000000000002', title: 'Construire une maison', target: 25000, category: 'Immobilier', color: 'mint' },
  { id: '9f4d0000-0000-4000-8000-000000000003', title: 'Mariage & dot', target: 8000, category: 'Personnel', color: 'pink' },
  { id: '9f4d0000-0000-4000-8000-000000000004', title: 'Lancer un business', target: 5000, category: 'Business', color: 'violet' },
  { id: '9f4d0000-0000-4000-8000-000000000005', title: 'Réserve de sécurité', target: 3000, category: 'Sécurité', color: 'blue' },
  { id: '9f4d0000-0000-4000-8000-000000000006', title: 'Parcelle à Brazzaville', target: 12000, category: 'Congo · Immobilier', color: 'orange', indicativeDate: '2028-11' },
  { id: '9f4d0000-0000-4000-8000-000000000007', title: 'Parcelle à Pointe-Noire', target: 9000, category: 'Congo · Immobilier', color: 'orange', indicativeDate: '2028-02' },
  { id: '9f4d0000-0000-4000-8000-000000000008', title: 'Construction maison familiale', target: 25000, category: 'Congo · Habitat', color: 'mint', indicativeDate: '2031-03' },
  { id: '9f4d0000-0000-4000-8000-000000000009', title: 'Raccordement eau & électricité', target: 2500, category: 'Congo · Habitat', color: 'blue', indicativeDate: '2027-04' },
  { id: '9f4d0000-0000-4000-8000-000000000010', title: 'Boutique / activité commerciale', target: 5000, category: 'Congo · Business', color: 'violet', indicativeDate: '2028-01' },
  { id: '9f4d0000-0000-4000-8000-000000000011', title: 'Moto pour activité', target: 1800, category: 'Congo · Mobilité', color: 'pink', indicativeDate: '2027-04' },
  { id: '9f4d0000-0000-4000-8000-000000000012', title: 'Forage communautaire', target: 7000, category: 'Congo · Solidarité', color: 'blue', indicativeDate: '2028-09' },
  { id: '9f4d0000-0000-4000-8000-000000000013', title: 'Études & formation', target: 3000, category: 'Congo · Formation', color: 'violet', indicativeDate: '2027-08' },
  { id: '9f4d0000-0000-4000-8000-000000000014', title: 'Mariage & dot', target: 8000, category: 'Congo · Famille', color: 'pink', indicativeDate: '2028-05' },
  { id: '9f4d0000-0000-4000-8000-000000000015', title: 'Transport de matériaux', target: 4500, category: 'Congo · Logistique', color: 'orange', indicativeDate: '2027-12' }
 ];
const DEFAULT_GOAL_BY_SIGNATURE = new Map(DEFAULT_GOALS.map(goal => [`${goal.title}|${goal.target}|${goal.category}`, goal.id]));
function migrateDefaultGoalIds(goals = [], deletedIds = []) {
  const migrated = new Map();
  for (const goal of goals) {
    const canonicalId = DEFAULT_GOAL_BY_SIGNATURE.get(`${goal.title}|${goal.target}|${goal.category}`);
    if (canonicalId && (deletedIds || []).includes(canonicalId)) continue;
    const row = canonicalId ? { ...goal, id: canonicalId } : goal;
    const previous = migrated.get(row.id);
    if (!previous || (Date.parse(row.updated_at || '') || 0) >= (Date.parse(previous.updated_at || '') || 0)) migrated.set(row.id, row);
  }
  return [...migrated.values()];
}

function isoDate(d) {
  const dt = new Date(d);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}
function dateForWeek(index) { return isoDate(new Date(START_MS + index * WEEK_MS)); }
function weekIndexForEntry(e) { const raw=e.date||e.week_start; return raw ? Math.floor((Date.parse(`${raw.slice(0,10)}T00:00:00Z`)-START_MS)/WEEK_MS) : -1; }
function weekIndexForNow() { const now = new Date(); const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()); return Math.floor((today - START_MS) / WEEK_MS); }
function deadlineRemaining(date) { const now=new Date(); const end=new Date(`${date}T12:00:00`); const days=Math.ceil((end-now)/86400000); if(days<0)return 'date passée'; if(days<30)return `${days} jour${days===1?'':'s'} restant${days===1?'':'s'}`; const months=Math.ceil(days/30.4375); return `${months} mois restants`; }
function niceDate(date, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!date) return '—';
  const d = new Date(`${String(date).slice(0, 10)}T12:00:00`);
  return d.toLocaleDateString('fr-FR', options);
}
function money(n, compact = false) {
  const value = Number(n || 0);
  return new Intl.NumberFormat('fr-FR', compact ? { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: 1 } : { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 }).format(value);
}
function sumBy(arr, fn) { return arr.reduce((sum, item) => sum + Number(fn(item) || 0), 0); }
function weeklyTargetFrom(data) { return normalizeWeeklyTarget(data.weeklyTarget ?? DEFAULT_WEEKLY_TARGET); }
function blankData() { return migrateData({ ...blankDepenses(), entries: [], snapshots: [], goals: DEFAULT_GOALS.map(g => ({ ...g, allocated: 0 })), dettes: [], deletedDebtIds: [], deletedEntryIds: [], deletedSnapshotIds: [], deletedGoalIds: [], weeklyTarget: DEFAULT_WEEKLY_TARGET, monthlyTarget: 400, frequency: 'weekly', reminderDay: 6, reminderMoment: 'morning', showDebtsInBalance: false }); }
async function pullCloud(userId) {
  if (!supabase || !navigator.onLine) return null;
  const [e, b, g, d] = await Promise.all([
    supabase.from('versements').select('*').eq('user_id', userId),
    supabase.from('soldes_bancaires').select('*').eq('user_id', userId),
    supabase.from('projets').select('*').eq('user_id', userId),
    supabase.from('dettes').select('*').eq('user_id', userId)
  ]);
  let t=await supabase.from('sync_tombstones').select('table_name,record_id').eq('user_id', userId);
  if(t.error && /check constraint|violates/i.test(t.error.message||'')){try{await supabase.from('sync_tombstones').delete().eq('user_id',userId).eq('table_name','__v16_probe__');t=await supabase.from('sync_tombstones').select('table_name,record_id').eq('user_id',userId);}catch{}}
  const error = [e.error,b.error,g.error, d.error && !/does not exist|schema cache/i.test(d.error.message || '') ? d.error : null].find(err => err);
  if (error) throw error;
  const debtsAvailable = !d.error || /does not exist|schema cache/i.test(d.error.message || '');
  if (t.error && !/check constraint|violates/i.test(t.error.message||'')) throw t.error;
  const tombstones = t.data || [];
  const expenseTables = ['depenses_comptes','depenses_categories','depenses_transactions','depenses_recurrences','depenses_budgets'];
  const expenseResults = await Promise.all(expenseTables.map(table => supabase.from(table).select('id,data,updated_at').eq('user_id', userId).then(x => ({table,...x}))));
  const expenseRows = {}; for (const result of expenseResults) { if (result.error) { console.warn('KELASI: tables Dépenses indisponibles; conservation locale', result.error.message); continue; } expenseRows[result.table] = (result.data || []).map(row => ({...row.data,id:row.id,updated_at:row.updated_at})); }
  const ids = name => tombstones.filter(row => row.table_name === name).map(row => row.record_id);
  return { entries: e.data || [], snapshots: b.data || [], goals: g.data || [], dettes: debtsAvailable ? (d.data || []).map(fromDebtRow) : [], deletedEntryIds: ids('versements'), deletedSnapshotIds: ids('soldes_bancaires'), deletedGoalIds: ids('projets'), deletedDebtIds: ids('dettes'), ...Object.fromEntries(['accounts','categories','transactions','recurrences','budgets'].map((key,i)=>[key,expenseRows[expenseTables[i]]||[]])), deletedDepenseIds: tombstones.filter(row=>row.table_name.startsWith('depenses_')).map(row=>`${({depenses_comptes:'accounts',depenses_categories:'categories',depenses_transactions:'transactions',depenses_recurrences:'recurrences',depenses_budgets:'budgets'})[row.table_name]}:${row.record_id}`), defaultGoalsSeeded: tombstones.some(row => row.table_name === '_meta' && row.record_id === 'default-goals-seeded') };
}
function fromDebtRow(row) { return { id: row.id, label: row.label, totalAmount: Number(row.total_amount), monthlyPayment: Number(row.monthly_payment), firstPaymentDate: row.first_payment_date, alreadyPaid: Number(row.already_paid || 0), created_at: row.created_at, updated_at: row.updated_at }; }
function toDebtRow(row, userId) { return { id: row.id, user_id: userId, label: row.label, total_amount: row.totalAmount, monthly_payment: row.monthlyPayment, first_payment_date: row.firstPaymentDate, already_paid: row.alreadyPaid || 0, created_at: row.created_at, updated_at: row.updated_at }; }
async function pushCloud(userId, data) {
  if (!supabase || !navigator.onLine) return;
  const tombstones = [
    ...(data.defaultGoalsSeeded ? [{ user_id: userId, table_name: '_meta', record_id: 'default-goals-seeded' }] : []),
    ...(data.deletedEntryIds || []).map(record_id => ({ user_id: userId, table_name: 'versements', record_id })),
    ...(data.deletedSnapshotIds || []).map(record_id => ({ user_id: userId, table_name: 'soldes_bancaires', record_id })),
    ...(data.deletedGoalIds || []).map(record_id => ({ user_id: userId, table_name: 'projets', record_id })),
    ...(data.deletedDebtIds || []).map(record_id => ({ user_id: userId, table_name: 'dettes', record_id })),
    ...(data.deletedDepenseIds || []).map(key => { const [kind,...rest]=key.split(':'); const table={accounts:'depenses_comptes',categories:'depenses_categories',transactions:'depenses_transactions',recurrences:'depenses_recurrences',budgets:'depenses_budgets'}[kind]; return table ? {user_id:userId,table_name:table,record_id:rest.join(':')} : null; }).filter(Boolean)
  ];
  if (tombstones.length) {
    const { error } = await supabase.from('sync_tombstones').upsert(tombstones, { onConflict: 'user_id,table_name,record_id' });
    if (error && !(error.message||'').match(/check constraint|violates/i)) throw error;
  }
  const expenseTableByKind={accounts:'depenses_comptes',categories:'depenses_categories',transactions:'depenses_transactions',recurrences:'depenses_recurrences',budgets:'depenses_budgets'};
  const expenseDeletes=Object.entries(expenseTableByKind).flatMap(([kind,table])=>[(data.deletedDepenseIds||[]).filter(x=>x.startsWith(`${kind}:`)).map(x=>[table,x.slice(kind.length+1)])]).flat();
  const deletes = [
    ['versements', data.deletedEntryIds], ['soldes_bancaires', data.deletedSnapshotIds],
    ['projets', data.deletedGoalIds], ['dettes', data.deletedDebtIds], ...expenseDeletes
  ];
  for (const [table, ids] of deletes) {
    if (!ids?.length) continue;
    const { error } = await supabase.from(table).delete().eq('user_id', userId).in('id', ids);
    if (error && !(table === 'dettes' && /does not exist|schema cache/i.test(error.message || ''))) throw error;
  }
  const records = [
    ['versements', data.entries || []], ['soldes_bancaires', data.snapshots || []], ['projets', data.goals || []]
  ];
  for (const [table, rows] of records) {
    if (!rows.length) continue;
    const payload = rows.map(row => ({ ...row, user_id: userId }));
    const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  }
  const expenseMaps={accounts:'depenses_comptes',categories:'depenses_categories',transactions:'depenses_transactions',recurrences:'depenses_recurrences',budgets:'depenses_budgets'};
  for (const [key,table] of Object.entries(expenseMaps)) { const rows=data[key]||[]; if (!rows.length) continue; const {error}=await supabase.from(table).upsert(rows.map(row=>({id:row.id,user_id:userId,data:row,updated_at:row.updated_at||row.created_at||new Date().toISOString()})),{onConflict:'user_id,id'}); if(error) console.warn('KELASI: sauvegarde Dépenses en attente',table,error.message); }
  if (data.dettes?.length) { const { error } = await supabase.from('dettes').upsert(data.dettes.map(row => toDebtRow(row, userId)), { onConflict: 'id' }); if (error && /does not exist|schema cache/i.test(error.message || '')) return; if (error) throw error; }

}

function App() {
  const [session, setSession] = useState(null);
  const [localMode, setLocalMode] = useState(() => localStorage.getItem('kelasi-local-mode') === 'true');
  const userId = session?.user?.id || (localMode ? 'local-device' : null);
  const userEmail = session?.user?.email || (localMode ? 'Mode local · cet appareil' : '');
  const [authView, setAuthView] = useState('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authNotice, setAuthNotice] = useState('');
  const [authError, setAuthError] = useState('');
  const [page, setPage] = useState('home');
  const activePage = resolvePage(page, NAV_ITEMS);
  useEffect(() => { if (page !== activePage) setPage(activePage); }, [page, activePage]);
  const [data, setData] = useState(blankData);
  const [loadingData, setLoadingData] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('kelasi-theme') || 'light');
  const [online, setOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState('local');
  const [toast, setToast] = useState(() => { const applied = sessionStorage.getItem('kelasi-sw-update-toast') === '1'; if (applied) sessionStorage.removeItem('kelasi-sw-update-toast'); return applied ? 'Mise à jour appliquée' : ''; });
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [depositModal, setDepositModal] = useState(null);
  const [goalModal, setGoalModal] = useState(null);
  const [debtModal, setDebtModal] = useState(null);
  const [debtDetail, setDebtDetail] = useState(null);
  const [bankModal, setBankModal] = useState(null);
  const [forecastWeekly, setForecastWeekly] = useState(DEFAULT_WEEKLY_TARGET);
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  const [reminderNotice, setReminderNotice] = useState('');
  const [importError, setImportError] = useState('');
  const cloudLoadRef = useRef('');
  const dataRef = useRef(data);
  const syncInFlightRef = useRef(false);
  dataRef.current = data;

  useEffect(() => {
    if (sessionStorage.getItem('kelasi-sw-update-toast') === '1') sessionStorage.removeItem('kelasi-sw-update-toast');
    const clearReloadGuard = window.setTimeout(() => sessionStorage.removeItem('kelasi-sw-reload-guard'), 5000);
    return () => window.clearTimeout(clearReloadGuard);
  }, []);
  const notify = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3200);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('kelasi-theme', theme);
  }, [theme]);
  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => { setOnline(false); setSyncStatus('pending'); };
    const onInstall = (event) => { event.preventDefault(); setInstallPrompt(event); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    window.addEventListener('beforeinstallprompt', onInstall);
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); window.removeEventListener('beforeinstallprompt', onInstall); };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) { setLocalMode(false); localStorage.removeItem('kelasi-local-mode'); }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    async function init() {
      setLoadingData(true);
      setSyncStatus(cloudConfigured && session ? (online ? 'syncing' : 'pending') : 'local');
      try {
        const local = await readLocal(userId);
        let remote = null;
        if (cloudConfigured && session && navigator.onLine) {
          try { remote = await pullCloud(userId); } catch (err) { setSyncStatus('pending'); console.warn('KELASI: lecture cloud impossible', err); }
        }
        if (cancelled) return;
        let merged;
        if (remote) {
          merged = mergeData(remote, local);
          merged.goals = migrateDefaultGoalIds(merged.goals, merged.deletedGoalIds);
          // Seed once remotely; marker prevents a later all-projects deletion from restoring defaults.
          if (!remote.defaultGoalsSeeded && !local?.goals?.length && !remote.goals.length) {
            merged.goals = DEFAULT_GOALS.filter(goal => !(remote.deletedGoalIds || []).includes(goal.id)).map(g => ({ ...g, allocated: 0 }));
          }
          merged.defaultGoalsSeeded = true;
          await writeLocal(userId, merged);
        } else { merged = mergeData(null, local, blankData()); merged.goals = migrateDefaultGoalIds(merged.goals, merged.deletedGoalIds); if (!local) merged.defaultGoalsSeeded = false; }
        setData(merged);
        if (cloudConfigured && session && navigator.onLine && remote) {
          await pushCloud(userId, merged);
          setSyncStatus('synced');
        } else if (cloudConfigured && session && !navigator.onLine) setSyncStatus('pending');
        else setSyncStatus('local');
        cloudLoadRef.current = userId;
      } catch (err) {
        console.error(err);
        if (!cancelled) { setData(mergeData(null, await readLocal(userId), blankData())); setSyncStatus('pending'); }
      } finally { if (!cancelled) setLoadingData(false); }
    }
    init();
    return () => { cancelled = true; };
  }, [userId, session?.user?.id]);

  useEffect(() => {
    if (!userId || loadingData) return;
    const t = window.setTimeout(async () => {
      await writeLocal(userId, data);
      if (cloudConfigured && session) {
        if (!navigator.onLine) { setSyncStatus('pending'); return; }
        setSyncStatus('syncing');
        try {
          await pushCloud(userId, data);
          setSyncStatus('synced');
        } catch (err) {
          console.warn('KELASI: synchronisation en attente', err);
          setSyncStatus('pending');
        }
      } else setSyncStatus('local');
    }, 450);
    return () => window.clearTimeout(t);
  }, [data, userId, session, loadingData, online]);

  useEffect(() => {
    if (!userId || !online || !cloudConfigured || !session) return;
    let disposed = false;
    const refresh = async () => {
      if (syncInFlightRef.current || !navigator.onLine || cloudLoadRef.current !== userId) return;
      syncInFlightRef.current = true;
      setSyncStatus('syncing');
      try {
        const remote = await pullCloud(userId);
        if (!remote || disposed) return;
        const merged = mergeData(remote, dataRef.current, blankData());
        merged.goals = migrateDefaultGoalIds(merged.goals, merged.deletedGoalIds);
        merged.defaultGoalsSeeded = Boolean(remote.defaultGoalsSeeded || dataRef.current.defaultGoalsSeeded);
        await writeLocal(userId, merged);
        if (disposed) return;
        dataRef.current = merged;
        setData(merged);
        await pushCloud(userId, merged);
        if (!disposed) setSyncStatus('synced');
      } catch (err) {
        console.warn('KELASI: actualisation cloud en attente', err);
        if (!disposed) setSyncStatus('pending');
      } finally { syncInFlightRef.current = false; }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', onVisible);
    const timer = window.setInterval(refresh, 60000);
    refresh();
    return () => {
      disposed = true;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  }, [userId, online, cloudConfigured, session]);

  const updateData = useCallback((fn) => setData(current => fn(current)), []);
  useEffect(() => { if (!userId || loadingData) return; const generated=generateDueOccurrences(data.recurrences||[],data.transactions||[]); if(generated.transactions.length!==(data.transactions||[]).length || JSON.stringify(generated.recurrences)!==JSON.stringify(data.recurrences||[])) setData(d=>({...d,...generated})); }, [userId,loadingData,data.recurrences,data.transactions]);
  const entries = data.entries || [];
  const snapshots = data.snapshots || [];
  const goals = data.goals || [];
  const debts = data.dettes || [];
  const frequency = data.frequency || 'weekly';
  const activeTarget = frequency === 'monthly' ? Number(data.monthlyTarget || 400) : weeklyTargetFrom(data);
  const debtMonthlyTotal = debts.reduce((sum, debt) => sum + Number(debt.monthlyPayment || 0), 0);
  const currentPeriodKey = getCurrentPeriod(frequency);
  const periodCount = frequency === 'monthly' ? 24 : WEEKS_TOTAL;
  const periodTotals = computePeriodTotals(entries, frequency, periodCount);
  const currentPeriodIndex = frequency === 'monthly' ? periodTotals.findIndex(p => p.key === currentPeriodKey) : weekIndexForNow();
  const validatedPeriods = periodTotals.filter(p => isPeriodValidated(p.amount, activeTarget)).length;
  const missedPeriods = periodTotals.filter(p => p.index < currentPeriodIndex && !isPeriodValidated(p.amount, activeTarget)).length;
  const periodLabel = frequency === 'monthly' ? 'mois' : 'semaine';
  const totalSaved = sumAmounts(entries);
  const persoTotal = sumByCategory(entries, 'perso');
  const businessTotal = sumByCategory(entries, 'business');
  const congoTotal = sumByCategory(entries, 'congo');
  const lastSnapshot = [...snapshots].sort((a, b) => (b.captured_at || '').localeCompare(a.captured_at || ''))[0];
  const weeklyTarget = normalizeWeeklyTarget(data.weeklyTarget ?? DEFAULT_WEEKLY_TARGET);
  const planTarget = activeTarget * periodCount;
  const progressPct = Math.min(100, (totalSaved / (planTarget || 1)) * 100);
  const currentWeekIndex = weekIndexForNow();
  const weeks = useMemo(() => periodTotals.map((p, i) => ({ index: i, date: frequency==='monthly' ? new Date(`${p.key}-01T12:00:00`).toLocaleDateString('fr-FR',{month:'long',year:'numeric'}) : dateForWeek(i), amount: p.amount, key: p.key })), [entries, frequency]);
  const completedWeeks = validatedPeriods;
  const pastMissed = missedPeriods;
  const upcomingWeek = weeks.find(w => w.index === Math.max(0, Math.min(periodCount - 1, currentPeriodIndex)));
  const weeklyTargetActive = weeklyTarget;
  const goalSum = sumBy(goals, g => g.target);
  const projectedTotal = forecastTotal(totalSaved, WEEKS_TOTAL - Math.max(0, Math.min(WEEKS_TOTAL, currentWeekIndex + 1)), forecastWeekly);
  const projected = useMemo(() => Array.from({ length: 13 }, (_, i) => {
    const paidSoFar = totalSaved;
    const weeksAhead = i * 8;
    return { label: i === 0 ? 'Maintenant' : `S+${weeksAhead}`, amount: paidSoFar + weeksAhead * forecastWeekly };
  }), [totalSaved, forecastWeekly]);
  const maxChart = Math.max(...projected.map(p => p.amount), 1);
  const currencyInput = v => Number(String(v).replace(',', '.'));

  const submitAuth = async (e) => {
    e.preventDefault(); setAuthError(''); setAuthNotice('');
    if (!cloudConfigured || !supabase) { setAuthError('Configure Supabase dans le fichier .env avant de créer un compte. Le mode local est disponible pour tester cette version.'); return; }
    if (!authEmail.trim() || authPassword.length < 8) { setAuthError('Saisis ton e-mail et un mot de passe de 8 caractères minimum.'); return; }
    setAuthBusy(true);
    try {
      if (authView === 'signup') {
        const { data: result, error } = await supabase.auth.signUp({ email: authEmail.trim(), password: authPassword });
        if (error) throw error;
        if (result.session) setSession(result.session);
        else setAuthNotice('Compte créé. Vérifie ton e-mail pour confirmer ton inscription, puis connecte-toi.');
      } else {
        const { data: result, error } = await supabase.auth.signInWithPassword({ email: authEmail.trim(), password: authPassword });
        if (error) throw error;
        setSession(result.session);
      }
    } catch (err) {
      const message = err?.message || '';
      setAuthError(message.toLowerCase().includes('email not confirmed') || message.toLowerCase().includes('not confirmed')
        ? "Ton e-mail n'est pas encore confirmé. Pour un usage personnel, désactive « Confirm email » dans Supabase → Auth → Providers → Email, ou confirme le lien reçu avant de te connecter."
        : (message || 'Connexion impossible. Vérifie tes identifiants et ta connexion.'));
    }
    finally { setAuthBusy(false); }
  };
  const continueLocal = () => {
    setLocalMode(true); localStorage.setItem('kelasi-local-mode', 'true'); setAuthError(''); setAuthNotice('Mode local activé : les données resteront sur cet appareil. Configure Supabase pour les synchroniser.');
  };
  const exitLocalMode = () => {
    // Les données sont déjà persistées sous local-device : on ne les efface pas.
    localStorage.removeItem('kelasi-local-mode');
    setLocalMode(false);
    setPage('home');
    setAuthView('signin');
    setAuthNotice('Tes données locales sont conservées sur cet appareil. Connecte-toi pour utiliser Supabase.');
  };
  const logout = async () => {
    if (supabase && session) await supabase.auth.signOut();
    setSession(null); setLocalMode(false); localStorage.removeItem('kelasi-local-mode'); setPage('home'); setData(blankData());
  };
  const saveEntry = (entry) => {
    if (Number(entry.amount) <= 0 || !Number.isFinite(Number(entry.amount))) { notify('Le montant doit être supérieur à zéro.'); return; }
    updateData(d => ({ ...d, entries: entry.id ? d.entries.map(e => e.id === entry.id ? { ...e, ...entry, updated_at: new Date().toISOString() } : e) : [...d.entries, { ...entry, id: newId(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] }));
    setDepositModal(null); notify(entry.id ? 'Versement modifié.' : 'Versement enregistré sur cet appareil.');
  };
  const deleteEntry = (entry) => {
    if (!window.confirm(`Supprimer le versement de ${money(entry.amount)} du ${niceDate(entry.date || entry.week_start)} ?`)) return;
    updateData(d => ({ ...d, entries: d.entries.filter(e => e.id !== entry.id), deletedEntryIds: [...new Set([...(d.deletedEntryIds || []), entry.id])] }));
    notify('Versement supprimé.');
  };
  const saveBankSnapshot = (snap) => {
    updateData(d => ({ ...d, snapshots: snap.id ? d.snapshots.map(row => row.id === snap.id ? { ...row, ...snap, updated_at: new Date().toISOString() } : row) : [...d.snapshots, { ...snap, id: newId(), created_at: new Date().toISOString() }] }));
    setBankModal(false); notify('Solde bancaire enregistré.');
  };
  const deleteSnapshot = (snap) => {
    updateData(d => ({ ...d, snapshots: d.snapshots.filter(x => x.id !== snap.id), deletedSnapshotIds: [...new Set([...(d.deletedSnapshotIds || []), snap.id])] }));
    notify('Relevé de solde supprimé.');
  };
  const saveDebt = debt => { const timestamp = new Date().toISOString(); updateData(d => ({ ...d, dettes: debt.id ? d.dettes.map(x => x.id === debt.id ? { ...x, ...debt, updated_at: timestamp } : x) : [...d.dettes, { ...debt, id: newId(), created_at: timestamp, updated_at: timestamp }] })); setDebtModal(null); notify('Dette enregistrée.'); };
  const deleteDebt = debt => { if (!window.confirm(`Supprimer la dette « ${debt.label} » ?`)) return; updateData(d => ({ ...d, dettes: d.dettes.filter(x => x.id !== debt.id), deletedDebtIds: [...new Set([...(d.deletedDebtIds || []), debt.id])] })); setDebtDetail(null); notify('Dette supprimée.'); };
  const saveGoal = (goal) => {
    updateData(d => ({ ...d, goals: goal.id ? d.goals.map(g => g.id === goal.id ? { ...g, ...goal, updated_at: new Date().toISOString() } : g) : [...d.goals, { ...goal, id: newId(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }] }));
    setGoalModal(null); notify(goal.id ? 'Objectif modifié.' : 'Objectif ajouté.');
  };
  const deleteGoal = (goal) => {
    if (!window.confirm(`Supprimer l'objectif « ${goal.title} » ?`)) return;
    updateData(d => ({ ...d, goals: d.goals.filter(g => g.id !== goal.id), deletedGoalIds: [...new Set([...(d.deletedGoalIds || []), goal.id])] }));
  };
  const exportData = () => {
    const content = JSON.stringify({ exportedAt: new Date().toISOString(), app: 'KELASI', ...data, depenses: normalizeDepenses(data) }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `kelasi-sauvegarde-${isoDate(new Date())}.json`; a.click(); URL.revokeObjectURL(url);
    notify('Sauvegarde JSON exportée.');
  };
  const exportCsv = () => {
    const rows = [['semaine','montant_eur','categorie','note'], ...entries.map(e => [e.week_start, e.amount, e.category, (e.note || '').replaceAll('"','""')])];
    const csv = '\ufeff' + rows.map(r => r.map(x => `"${String(x ?? '').replaceAll('"','""')}"`).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `kelasi-versements-${isoDate(new Date())}.csv`; a.click(); URL.revokeObjectURL(url);
    notify('Export CSV prêt.');
  };
  const importJson = async (file) => {
    setImportError('');
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.entries)) throw new Error('Le fichier ne contient pas de liste de versements KELASI valide.');
      updateData(d => mergeBackup(d, parsed));
      notify(`${Array.isArray(parsed.entries) ? parsed.entries.length : 0} versement(s) importé(s).`);
    } catch (err) { setImportError(err.message || 'Import impossible.'); }
  };
  const triggerInstall = async () => {
    if (!installPrompt) { setShowInstallHelp(v => !v); return; }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };
  const requestNotification = async () => {
    if (!('Notification' in window)) { notify('Les notifications ne sont pas prises en charge par ce navigateur.'); return; }
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      notify('Rappel activé pour les ouvertures de KELASI le jour choisi.');
      if (currentWeekIndex >= 0 && currentWeekIndex < WEEKS_TOTAL && !entries.some(e => e.week_start === dateForWeek(currentWeekIndex))) {
        new Notification('KELASI — Ton épargne', { body: 'Pense à enregistrer ton versement hebdomadaire.' });
      }
    } else { setReminderNotice('Notifications désactivées : les rappels restent visibles ici à l’ouverture de KELASI.'); notify('Autorisation de notification refusée dans le navigateur.'); }
  };

  useEffect(() => {
    if (!userId) return;
    const now=new Date(), month=now.toISOString().slice(0,7), reminderDay=Math.min(Number(data.reminderDay||1),new Date(now.getFullYear(),now.getMonth()+1,0).getDate());
    const key=`kelasi-reminders-${userId}-${month}`; const sent=JSON.parse(localStorage.getItem(key)||'{}'); const pending=[];
    const period=computePeriodTotals(entries,frequency,frequency==='monthly'?24:WEEKS_TOTAL).find(p=>p.key===(frequency==='monthly'?month:String(weekIndexForNow())));
    if(now.getDate()>=reminderDay && period && !isPeriodValidated(period.amount,activeTarget) && !sent.target) pending.push({key:'target',title:'Objectif mensuel non atteint',body:`Les versements de ce mois sont sous ${money(activeTarget)}.`});
    for(const debt of debts){const due=computeDebtSchedule(debt).schedule.find(row=>row.dueDate>=now.toISOString().slice(0,10)&&row.dueDate<=new Date(now.getTime()+7*86400000).toISOString().slice(0,10));if(due&&!sent[`debt-${debt.id}`])pending.push({key:`debt-${debt.id}`,title:'Mensualité de dette à venir',body:`${debt.label} · ${money(due.amount)} le ${niceDate(due.dueDate)}.`});}
    if(!pending.length)return;
    if('Notification' in window && Notification.permission==='granted'){const updated={...sent};for(const item of pending){new Notification(`KELASI — ${item.title}`,{body:item.body});updated[item.key]=true;}localStorage.setItem(key,JSON.stringify(updated));}
    else setReminderNotice('Rappel KELASI : objectif mensuel à vérifier et/ou mensualité de dette dans les 7 jours. Autorise les notifications dans Réglages.');
  }, [userId,data.reminderDay,entries.length,frequency,activeTarget,debts.length]);

  if (!userId) {
    return <AuthScreen
      authView={authView} setAuthView={setAuthView} authEmail={authEmail} setAuthEmail={setAuthEmail}
      authPassword={authPassword} setAuthPassword={setAuthPassword} showPassword={showPassword}
      setShowPassword={setShowPassword} submitAuth={submitAuth} authBusy={authBusy} authNotice={authNotice}
      authError={authError} continueLocal={continueLocal} cloudConfigured={cloudConfigured}
    />;
  }

  return (
    <div className={`app-shell ${menuOpen ? 'menu-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand"><button type="button" className="brand brand-home" aria-label="KELASI, revenir à l’Accueil" onClick={()=>{setPage('home');setMenuOpen(false);}}><span className="brand-icon"><img src="/icons/kelasi-512.png" alt="Logo KELASI" onError={e=>{e.currentTarget.style.display='none';e.currentTarget.parentElement.dataset.fallback='K';}} /></span><span><span className="brand-name">KELASI</span><span className="brand-sub">MON ÉPARGNE, MES PROJETS</span></span></button><button className="mobile-close icon-button" aria-label="Fermer le menu" onClick={() => setMenuOpen(false)}><X size={18}/></button></div>
        <div className="workspace-label">ESPACE PERSONNEL</div>
        <nav className="nav-list" aria-label="Navigation principale">
          {selectNavigationItems(NAV_ITEMS).map(item => {
            const Icon = item.icon;
            return <button key={item.id} className={`nav-item ${activePage === item.id ? 'active' : ''}`} onClick={() => { setPage(item.id); setMenuOpen(false); }}><Icon size={19}/><span>{item.label}</span>{item.id === 'entries' && entries.length > 0 && <span className="nav-count">{entries.length}</span>}</button>;
          })}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-goal-card">
          <div className="goal-card-top"><span className="mini-spark"><Sparkles size={15}/></span><span>CAP SUR 2 ANS</span></div>
          <div className="goal-card-value">{money(planTarget)}</div>
          <p>Ton prochain chapitre commence avec une semaine à la fois.</p>
          <div className="progress-track"><span style={{ width: `${progressPct}%` }} /></div>
          <div className="goal-card-foot"><span>{progressPct.toFixed(0)} % atteint</span><span>Nov. 2028</span></div>
        </div>
        <button className="profile-row" onClick={() => setPage('settings')}><div className="avatar">{userEmail.charAt(0).toUpperCase() || 'K'}</div><div className="profile-info"><strong>{session?.user?.email?.split('@')[0] || 'Mon espace'}</strong><span>{localMode ? 'Stockage local' : 'Compte synchronisé'}</span></div><MoreHorizontal size={18}/></button>
      </aside>
      {menuOpen && <button className="menu-scrim" aria-label="Fermer le menu" onClick={() => setMenuOpen(false)} />}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button mobile-menu" aria-label="Ouvrir le menu" onClick={() => setMenuOpen(true)}><Menu size={21}/></button><div className="breadcrumb"><span>Mon espace</span><ChevronRight size={14}/><strong>{NAV_ITEMS.find(n => n.id === activePage)?.label || 'Accueil'}</strong></div></div>
          <div className="topbar-actions">{localMode && <button className="btn-local-exit" onClick={exitLocalMode}><LogOut size={15}/> Quitter le mode local / Se connecter</button>}<div className={`connection-pill ${online ? 'is-online' : 'is-offline'}`}><span className="status-dot"/>{online ? 'En ligne' : 'Hors ligne'}</div><button className="theme-toggle icon-button" title={theme === 'light' ? 'Activer le mode sombre' : 'Activer le mode clair'} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}</button><button className="top-avatar" title="Réglages" onClick={() => setPage('settings')}>{userEmail.charAt(0).toUpperCase() || 'K'}</button></div>
        </header>
        {reminderNotice && <div className="local-warning"><Bell size={16}/><span>{reminderNotice}</span><button onClick={()=>setReminderNotice('')}>Fermer</button></div>}{localMode && <div className="local-warning"><Laptop size={16}/><span><strong>Mode local actif.</strong> Les données restent sur cet appareil. Configure Supabase pour les synchroniser entre ton téléphone et ta tablette.</span><button onClick={exitLocalMode}>Quitter le mode local / Se connecter</button></div>}
        {cloudConfigured && session && <div className={`sync-banner sync-${syncStatus}`}><span className="sync-symbol">{syncStatus === 'synced' ? <CheckCircle2 size={15}/> : syncStatus === 'syncing' ? <RefreshCw size={15} className="spin"/> : <CloudOff size={15}/>}</span><span>{syncStatus === 'synced' ? 'Données synchronisées' : syncStatus === 'syncing' ? 'Synchronisation…' : 'Modifications conservées localement, synchronisation en attente'}</span></div>}
        <div className="page-content">
          {loadingData ? <div className="loading-state"><div className="loader"/><span>Ouverture de ton espace…</span></div> : <>
            {activePage === 'home' && <Dashboard data={data} frequency={frequency} entries={entries} weeks={weeks} completedWeeks={completedWeeks} missedWeeks={pastMissed} currentWeekIndex={currentWeekIndex} totalSaved={totalSaved} persoTotal={persoTotal} businessTotal={businessTotal} congoTotal={congoTotal} planTarget={planTarget} progressPct={progressPct} projectedTotal={projectedTotal} weeklyTarget={weeklyTarget} lastSnapshot={lastSnapshot} onAdd={() => setDepositModal({ week_start: upcomingWeek?.date || START_ISO })} onEditWeek={w=>{const existing=entries.find(e=>e.week_start===w.date);setDepositModal(existing||{week_start:w.date});}} onPage={setPage} onInstall={triggerInstall} showInstallHelp={showInstallHelp} />}
            {activePage === 'entries' && <EntriesPage entries={entries} weeks={weeks} onAdd={() => setDepositModal({ date: isoDate(new Date()) })} onEdit={e => setDepositModal(e)} onDelete={deleteEntry} exportCsv={exportCsv} />}
            {activePage === 'forecast' && <ForecastErrorBoundary><ForecastPage totalSaved={totalSaved} weeklyTarget={weeklyTarget} activePeriodTarget={activeTarget} frequency={frequency} currentPeriodIndex={currentPeriodIndex} forecastWeekly={forecastWeekly} setForecastWeekly={setForecastWeekly} planTarget={planTarget} progressPct={progressPct} weeks={weeks} entries={entries} projected={projected} maxChart={maxChart} debts={debts} /></ForecastErrorBoundary>}
            {activePage === 'projects' && <ProjectsPage goals={goals} totalSaved={totalSaved} congoTotal={congoTotal} businessTotal={businessTotal} onAdd={() => setGoalModal({})} onEdit={g => setGoalModal(g)} onDelete={deleteGoal} />}
            {activePage === 'expenses' && <ExpensesBoundary><ExpensesPage value={normalizeDepenses(data)} onChange={updateData} /></ExpensesBoundary>}
            {activePage === 'bank' && <BankPage lastSnapshot={lastSnapshot} snapshots={snapshots} totalSaved={totalSaved} persoTotal={persoTotal} businessTotal={businessTotal} congoTotal={congoTotal} debtMonthlyTotal={debtMonthlyTotal} onAdd={() => setBankModal(lastSnapshot || {})} onDelete={deleteSnapshot} onImport={importJson} importError={importError} />}
            {activePage === 'debts' && <DebtsPage debts={debts} onAdd={() => setDebtModal({})} onEdit={setDebtModal} onDetail={setDebtDetail} onDelete={deleteDebt} onPaid={debt => saveDebt({ ...debt, alreadyPaid: Math.min(debt.totalAmount, Number(debt.alreadyPaid || 0) + Math.min(debt.monthlyPayment, Math.max(0, debt.totalAmount - Number(debt.alreadyPaid || 0)))) })} />}{activePage === 'settings' && <SettingsPage onHome={()=>setPage('home')} theme={theme} setTheme={setTheme} data={data} updateData={updateData} userEmail={userEmail} localMode={localMode} online={online} syncStatus={syncStatus} exportData={exportData} exportCsv={exportCsv} onImport={importJson} importError={importError} onNotify={requestNotification} onLogout={logout} onExitLocal={exitLocalMode} onInstall={triggerInstall} showInstallHelp={showInstallHelp} installPrompt={installPrompt} onReset={() => { if (window.confirm('Effacer toutes les données locales KELASI ?')) { setData(blankData()); notify('Données locales réinitialisées.'); } }} />}
          </>}
        </div>
        <footer className="app-footer"><span>© 2026 KELASI</span><span><ShieldCheck size={13}/> Tes projets, à ton rythme.</span><button onClick={() => setPage('settings')}>Confidentialité & données</button></footer>
      </main>
      <nav className="mobile-bottom-nav" aria-label="Navigation mobile">
        {selectNavigationItems(NAV_ITEMS, ['home', 'entries', 'expenses', 'projects', 'bank', 'settings']).map(item => { const Icon = item.icon; return <button key={item.id} className={activePage === item.id ? 'selected' : ''} onClick={() => setPage(item.id)}><Icon size={19}/><span>{item.id === 'projects' ? 'Projets' : item.id === 'bank' ? 'Banque' : item.id === 'settings' ? 'Réglages' : item.label}</span></button>; })}
      </nav>
      {depositModal && <DepositModal entry={depositModal} onClose={() => setDepositModal(null)} onSave={saveEntry} />}
      {goalModal && <GoalModal goal={goalModal} onClose={() => setGoalModal(null)} onSave={saveGoal} />}
      {debtModal && <DebtModal debt={debtModal} onClose={() => setDebtModal(null)} onSave={saveDebt} />}
      {debtDetail && <DebtDetailModal debt={debtDetail} onClose={() => setDebtDetail(null)} onPaid={saveDebt} onDelete={deleteDebt} />}
      {bankModal && <BankModal snapshot={bankModal || {}} onClose={() => setBankModal(null)} onSave={saveBankSnapshot} />}
      {toast && <div className="toast"><CheckCircle2 size={17}/>{toast}</div>}
    </div>
  );
}

function AuthScreen(props) {
  const { authView, setAuthView, authEmail, setAuthEmail, authPassword, setAuthPassword, showPassword, setShowPassword, submitAuth, authBusy, authNotice, authError, continueLocal, cloudConfigured } = props;
  return <div className="auth-screen">
    <div className="auth-art"><div className="auth-art-orb orb-one"/><div className="auth-art-orb orb-two"/><div className="auth-art-content"><button type="button" className="brand auth-brand brand-home" aria-label="KELASI, revenir à l’Accueil" onClick={()=>setAuthView('signin')}><span className="brand-icon"><img src="/icons/kelasi-512.png" alt="Logo KELASI" onError={e=>{e.currentTarget.style.display='none';e.currentTarget.parentElement.dataset.fallback='K';}} /></span><span><span className="brand-name">KELASI</span><span className="brand-sub">MON ÉPARGNE, MES PROJETS</span></span></button><div className="auth-hero-copy"><div className="eyebrow light-eyebrow"><Sparkles size={14}/> TON FUTUR SE CONSTRUIT MAINTENANT</div><h1>Les grands projets commencent par de <em>petits pas.</em></h1><p>Un versement après l'autre, transforme ta discipline en liberté et tes idées en projets concrets.</p><div className="auth-illustration"><div className="illus-circle"><TrendingUp size={58}/></div><div className="illus-card illus-one"><span className="illus-label">CAPITAL CIBLE</span><strong>10 400 €</strong><small>sur 2 ans minimum</small></div><div className="illus-card illus-two"><span className="illus-check"><Check size={14}/></span><div><strong>Cette semaine</strong><small>100 € · objectif hebdomadaire</small></div></div><div className="illus-dots">✦ &nbsp; · &nbsp; ✦</div></div></div><div className="auth-quote">« La constance fait grandir ce que l'ambition commence. »</div></div></div>
    <div className="auth-panel"><div className="auth-panel-inner"><div className="auth-mobile-brand"><img src="/icons/kelasi-512.png" alt=""/> KELASI</div><div className="auth-heading"><span className="auth-overline">BIENVENUE DANS TON ESPACE</span><h2>{authView === 'signup' ? 'Crée ton espace' : 'Content de te revoir'}</h2><p>{authView === 'signup' ? 'Commence à organiser ton avenir financier.' : 'Connecte-toi pour retrouver tes objectifs.'}</p></div><div className="auth-tabs"><button className={authView === 'signin' ? 'active' : ''} onClick={() => setAuthView('signin')}>Connexion</button><button className={authView === 'signup' ? 'active' : ''} onClick={() => setAuthView('signup')}>Créer un compte</button></div><form className="auth-form" onSubmit={submitAuth}><label>Adresse e-mail<div className="field-with-icon"><Mail size={17}/><input type="email" autoComplete="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="toi@exemple.com" required/></div></label><label>Mot de passe<div className="field-with-icon"><KeyRound size={17}/><input type={showPassword ? 'text' : 'password'} autoComplete={authView === 'signup' ? 'new-password' : 'current-password'} value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="8 caractères minimum" minLength={8} required/><button type="button" className="field-end-button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Masquer' : 'Afficher'}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button></div></label>{authError && <div className="auth-error">{authError}</div>}{authNotice && <div className="auth-notice">{authNotice}</div>}<button className="btn-primary auth-submit" disabled={authBusy}>{authBusy ? <RefreshCw size={17} className="spin"/> : <Lock size={17}/>} {authView === 'signup' ? 'Créer mon compte' : 'Me connecter'}<ArrowRight size={17}/></button></form><div className="auth-security"><ShieldCheck size={17}/><span>Tes versements sont privés. Le mot de passe bancaire n'est jamais demandé.</span></div><div className="local-access"><div className="local-access-line"><span></span>OU POUR DÉCOUVRIR L'APPLICATION<span></span></div><button onClick={continueLocal} className="btn-secondary"><Smartphone size={17}/> Continuer en mode local</button><p>Pour tester sans configurer de compte. Les données ne seront pas partagées entre appareils.</p></div><div className="auth-foot">KELASI · Planifie aujourd'hui, construis demain.</div></div></div>
  </div>;
}

function PageHeader({ eyebrow, title, description, action, actionLabel, actionIcon: ActionIcon = Plus }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <button className="btn-primary" onClick={action}><ActionIcon size={17}/>{actionLabel}</button>}</div>;
}
function StatCard({ label, value, note, icon: Icon, tone = 'mint', change }) {
  return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={20}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{change && <span className="stat-change"><ArrowUpRight size={13}/>{change}</span>}{note}</div></div>;
}
function Dashboard({ data, frequency='weekly', entries, weeks, completedWeeks, missedWeeks, currentWeekIndex, totalSaved, persoTotal, businessTotal, congoTotal, planTarget, progressPct, projectedTotal, weeklyTarget, lastSnapshot, onAdd, onEditWeek, onPage, onInstall, showInstallHelp }) {
  const thisIdx = currentWeekIndex < 0 ? 0 : Math.min(weeks.length - 1, currentWeekIndex);
  const thisWeek = weeks[thisIdx];
  const activePeriodTarget = frequency==='monthly'?Number(data.monthlyTarget||400):weeklyTarget; const alreadyThisWeek = isPeriodValidated(thisWeek?.amount || 0, activePeriodTarget);
  const nextUp = weeks.slice(Math.max(0, thisIdx - 2), Math.min(weeks.length, thisIdx + 6));
  const firstName = 'à toi';
  const categorySummary = [{ label: 'Personnel', value: persoTotal, color: 'mint', icon: Wallet }, { label: 'Business', value: businessTotal, color: 'violet', icon: Briefcase }, { label: 'Projets Congo', value: congoTotal, color: 'orange', icon: Target }];
  return <>
    <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot"/> TON TABLEAU DE BORD</div><h1>Chaque semaine te rapproche <span>de tes rêves.</span></h1><p>Bonjour {firstName} 👋 Voici comment avance ton avenir financier.</p></div><div className="welcome-date"><CalendarDays size={16}/><span>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></div></div>
    <section className="hero-grid">
      <div className="balance-hero"><div className="hero-topline"><div><span className="hero-overline">CAPITAL ÉPARGNÉ AU TOTAL</span><div className="hero-amount">{money(totalSaved)}</div></div><div className="hero-symbol"><PiggyBank size={25}/></div></div><div className="hero-subline"><span><span className="hero-status-dot"/> {entries.length} versement{entries.length > 1 ? 's' : ''} enregistré{entries.length > 1 ? 's' : ''}</span><span>{money(activePeriodTarget)} / {frequency==='monthly'?'mois':'semaine'} visés</span></div><div className="hero-progress-title"><span>Progression vers ton objectif</span><strong>{progressPct.toFixed(1)} %</strong></div><div className="hero-progress"><span style={{ width: `${progressPct}%` }}/></div><div className="hero-progress-bottom"><span>{money(totalSaved)} épargnés</span><span>Objectif : {money(planTarget)}</span></div><button className="hero-add-btn" onClick={onAdd}><Plus size={18}/> Enregistrer mon versement <ArrowRight size={17}/></button><div className="hero-decoration decor-a"/><div className="hero-decoration decor-b"/></div>
      <div className="weekly-card"><div className="weekly-card-header"><div><div className="eyebrow">MON RYTHME</div><h3>{frequency==='monthly'?'Le mois en cours':'La semaine en cours'}</h3></div><div className={`weekly-badge ${alreadyThisWeek ? 'done' : 'todo'}`}>{alreadyThisWeek ? <Check size={13}/> : <Zap size={13}/>} {alreadyThisWeek ? 'Validée' : currentWeekIndex < 0 ? 'Bientôt' : 'À faire'}</div></div><button type="button" className="weekly-amount amount-edit-trigger" aria-label="Modifier les versements de la semaine" onClick={()=>onEditWeek(thisWeek)}>{money(thisWeek?.amount || 0)}<small> / {money(frequency==='monthly'?Number(data.monthlyTarget||400):weeklyTarget)}</small></button><div className="weekly-meter"><span style={{ width: `${Math.min(100, ((thisWeek?.amount || 0) / activePeriodTarget) * 100)}%` }}/></div><div className="weekly-dates"><CalendarCheck size={15}/><span>{frequency==='monthly'?(thisWeek?.date||'Période'):`${niceDate(thisWeek?.date)} · ${currentWeekIndex < 0 ? 'Début du plan' : 'Semaine de suivi'}`}</span></div><button className="btn-secondary full-width" onClick={onAdd}>{alreadyThisWeek ? 'Ajouter un versement' : 'Pointer ma semaine'}<ArrowRight size={16}/></button><div className="weekly-divider"/><div className="weekly-mini-stats"><div><strong>{completedWeeks}<span>/{weeks.length}</span></strong><small>{frequency==='monthly'?'Mois':'Semaines'} validés</small></div><div><strong>{missedWeeks}</strong><small>{frequency==='monthly'?'Mois manqués':'Semaines manquées'}</small></div><div><strong>{completedWeeks ? Math.round(completedWeeks / weeks.length * 100) : 0}%</strong><small>Régularité</small></div></div></div>
    </section>
    <section className="stats-grid"><StatCard label="Épargne personnelle" value={money(persoTotal)} note="Pour toi & ta famille" icon={Wallet} tone="mint"/><StatCard label="Capital business" value={money(businessTotal)} note="Investissements & activités" icon={Briefcase} tone="violet"/><StatCard label="Projets au Congo" value={money(congoTotal)} note="Parcelle, maison, mariage…" icon={Target} tone="orange"/><StatCard label="Solde bancaire déclaré" value={lastSnapshot ? money(lastSnapshot.balance) : '—'} note={lastSnapshot ? `Mis à jour le ${niceDate(lastSnapshot.captured_at)}` : 'À renseigner manuellement'} icon={Landmark} tone="blue"/></section>
    <section className="dashboard-lower"><div className="panel checkin-panel"><div className="panel-heading"><div><div className="eyebrow">TA RÉGULARITÉ</div><h2>Carte de pointage</h2><p>{frequency==='monthly'?'24 mois pour construire ton capital.':'104 semaines pour construire ton capital.'}</p></div><button className="text-link" onClick={() => onPage('entries')}>Voir le détail <ArrowRight size={14}/></button></div><div className="checkin-legend"><span><i className="legend-dot completed"/> Validée</span><span><i className="legend-dot missed"/> À rattraper</span><span><i className="legend-dot future"/> À venir</span></div><div className="checkin-grid">{weeks.map(w => <button key={w.index} className={`checkin-cell ${isPeriodValidated(w.amount, activePeriodTarget) ? 'complete' : w.index < currentWeekIndex ? 'missed' : w.index === currentWeekIndex ? 'current' : 'future'}`} title={`${frequency==='monthly'?w.date:`Semaine ${w.index+1} · ${niceDate(w.date)}`} · ${money(w.amount)}`} onClick={() => onEditWeek(w)}>{isPeriodValidated(w.amount, activePeriodTarget) ? <Check size={12}/> : frequency==='monthly' ? w.date.slice(5) : String(w.index + 1).padStart(2, '0')}</button>)}</div><div className="checkin-footer"><span><strong>{completedWeeks}</strong> / {weeks.length} {frequency==='monthly'?'mois':'semaines'} validés</span><span>{frequency==='monthly'?'Novembre 2026 – octobre 2028':'Du 2 nov. 2026 au 30 oct. 2028'}</span></div></div>
      <div className="panel breakdown-panel"><div className="panel-heading"><div><div className="eyebrow">OÙ VA TON ÉPARGNE ?</div><h2>Répartition du capital</h2><p>Par catégorie de versement.</p></div><div className="breakdown-ring" style={{ '--p': `${totalSaved ? (persoTotal / totalSaved) * 100 : 0}%` }}><div><strong>{money(totalSaved, true)}</strong><small>total</small></div></div></div><div className="breakdown-list">{categorySummary.map(item => { const Icon = item.icon; const pct = totalSaved ? item.value / totalSaved * 100 : 0; return <div className="breakdown-item" key={item.label}><div className={`breakdown-item-icon ${item.color}`}><Icon size={16}/></div><div className="breakdown-item-main"><div><strong>{item.label}</strong><span>{pct.toFixed(0)}%</span></div><div className="thin-progress"><span className={item.color} style={{ width: `${pct}%` }}/></div></div><strong className="breakdown-amount">{money(item.value)}</strong></div>; })}</div><button className="panel-foot-link" onClick={() => onPage('forecast')}>Explorer mes prévisions <ArrowRight size={15}/></button></div></section>
    <section className="bottom-promo-row"><div className="next-milestone"><div className="milestone-icon"><Target size={22}/></div><div className="milestone-text"><strong>Ton prochain grand cap</strong><span>{totalSaved >= 5000 ? 'Tu as franchi les 5 000 € : bravo !' : `Encore ${money(Math.max(0, 5000 - totalSaved))} pour atteindre les 5 000 €.`}</span></div></div><div className="install-promo"><div className="install-promo-icon"><Smartphone size={21}/></div><div><strong>Emporte KELASI partout</strong><span>Installe l'application sur ton téléphone ou ta tablette.</span></div><button className="btn-outline" onClick={onInstall}>Installer <Download size={15}/></button></div></section>
    {showInstallHelp && <div className="install-help"><strong>Installer KELASI</strong><span>Android : menu ⋮ du navigateur → Installer l'application. iPhone/iPad : bouton Partager → Sur l'écran d'accueil.</span></div>}
  </>;
}

function EntriesPage({ entries, weeks, onAdd, onEdit, onDelete, exportCsv }) {
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('new');
  const filtered = [...entries].filter(e => filter === 'all' || e.category === filter).sort((a,b) => sort === 'new' ? (b.week_start || '').localeCompare(a.week_start || '') : (a.week_start || '').localeCompare(b.week_start || ''));
  return <><PageHeader eyebrow="SUIVI HEBDOMADAIRE" title="Mes versements" description="Chaque versement compte. Garde une trace claire de chaque étape." action={onAdd} actionLabel="Ajouter un versement"/><div className="entries-summary"><div><span className="summary-overline">VERSEMENTS ENREGISTRÉS</span><strong>{entries.length}</strong><span className="summary-caption">opérations au total</span></div><div><span className="summary-overline">CAPITAL CUMULÉ</span><strong>{money(sumBy(entries,e=>e.amount))}</strong><span className="summary-caption">tous projets confondus</span></div><div><span className="summary-overline">MEILLEUR VERSEMENT</span><strong>{money(Math.max(0,...entries.map(e=>Number(e.amount))))}</strong><span className="summary-caption">montant le plus élevé</span></div><button className="btn-secondary export-btn" onClick={exportCsv}><FileText size={17}/> Exporter CSV</button></div><div className="panel entries-panel"><div className="list-toolbar"><div className="segmented-tabs"><button className={filter==='all'?'selected':''} onClick={()=>setFilter('all')}>Tout ({entries.length})</button>{CATEGORIES.map(c=><button key={c.id} className={filter===c.id?'selected':''} onClick={()=>setFilter(c.id)}>{c.label.replace('Épargne ','').replace('Projets au ','')} ({entries.filter(e=>e.category===c.id).length})</button>)}</div><label className="sort-select">Trier <select value={sort} onChange={e=>setSort(e.target.value)}><option value="new">Plus récent</option><option value="old">Plus ancien</option></select><ChevronDown size={14}/></label></div>{filtered.length ? <div className="entry-list">{filtered.map(entry=>{const category=CATEGORIES.find(c=>c.id===entry.category)||CATEGORIES[0];const Icon=category.icon;return <div className="entry-row" key={entry.id} onDoubleClick={()=>onEdit(entry)}><div className={`entry-icon ${category.color}`}><Icon size={18}/></div><div className="entry-main"><strong>{category.label}</strong><span>Semaine du {niceDate(entry.date || entry.week_start)}{entry.note ? ` · ${entry.note}` : ''}</span></div><div className="entry-right"><strong>{money(entry.amount)}</strong><span className="entry-confirmed"><CheckCircle2 size={13}/> Enregistré</span></div><div className="entry-actions"><button className="icon-button" aria-label="Modifier" onClick={()=>onEdit(entry)}><Pencil size={15}/></button><button className="icon-button danger" aria-label="Supprimer" onClick={()=>onDelete(entry)}><Trash2 size={15}/></button></div></div>})}</div> : <EmptyState icon={Receipt} title="Pas encore de versement" text="Ajoute ton premier versement de un montant positif pour lancer la série." action={onAdd} actionLabel="Ajouter un versement"/>}</div><div className="tip-banner"><div className="tip-icon"><HelpCircle size={18}/></div><div><strong>Petit rappel</strong><p>La carte de pointage considère une semaine validée lorsqu'au moins le seuil hebdomadaire configuré y est enregistré. Les données saisies hors ligne seront synchronisées au retour d'Internet si Supabase est configuré.</p></div></div></>;
}

class ForecastErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error) { console.error('Erreur locale dans Prévisions :', error); }
  render() {
    if (this.state.hasError) return <section className="panel forecast-error-state" role="alert"><div className="eyebrow">PRÉVISIONS INDISPONIBLES</div><h2>Cette simulation n’a pas pu être affichée.</h2><p>Tes données restent intactes. Recharge l’application pour réessayer ou poursuis dans un autre onglet.</p><button className="btn-secondary" onClick={() => window.location.reload()}>Recharger l’application</button></section>;
    return this.props.children;
  }
}

function ForecastPage({ totalSaved, weeklyTarget, activePeriodTarget, frequency='weekly', currentPeriodIndex=0, forecastWeekly, setForecastWeekly, planTarget, progressPct, weeks, entries, projected, maxChart, debts=[] }) {
  const monthly = frequency === 'monthly';
  const unit = monthly ? 'mois' : 'semaine';
  const options = [...new Set(monthly ? [activePeriodTarget,600,800,1000,1200] : [weeklyTarget,150,200,250,300])];
  const forecast = calculateForecast({ totalSaved, periods: weeks, target: activePeriodTarget, deposit: forecastWeekly, currentIndex: currentPeriodIndex, frequency });
  const { projectedTotal: projectedAtEnd, points, chartMax } = forecast;
  const breakpoints = points.map(({ index, amount }) => ({ i: index, date: monthly ? new Date(Date.UTC(2026,10+index,1)).toISOString().slice(0,10) : dateForWeek(index), amount }));
  const horizon = monthly ? '24 versements mensuels' : '104 versements hebdomadaires';
  return <><PageHeader eyebrow="VISION À LONG TERME" title="Prévisions sur 2 ans" description="Simule plusieurs rythmes d'épargne et mesure l'effet de la régularité."/><div className="forecast-hero-grid"><div className="forecast-main-card"><div className="forecast-card-top"><div><span className="hero-overline">CAPITAL PROJETÉ AU 1ER NOVEMBRE 2028</span><strong>{money(projectedAtEnd)}</strong><span className="forecast-muted">Avec un versement de {money(forecastWeekly)} chaque {unit} à venir.</span></div><div className="forecast-top-icon"><TrendingUp size={25}/></div></div><div className="forecast-comparison"><div><span>Déjà épargné</span><strong>{money(totalSaved)}</strong></div><div><span>À venir estimé</span><strong>{money(Math.max(0, projectedAtEnd-totalSaved))}</strong></div><div><span>Objectif initial</span><strong>{money(planTarget)}</strong></div></div></div><div className="panel forecast-control"><div className="eyebrow">SIMULATEUR {monthly ? 'MENSUEL' : 'HEBDOMADAIRE'}</div><h3>Combien veux-tu mettre de côté ?</h3><p>Choisis un scénario, le montant minimum est de 1 € par {unit}.</p><div className="scenario-options">{options.map(v=><button key={v} className={forecastWeekly===v?'chosen':''} onClick={()=>setForecastWeekly(v)}>{money(v)}<small>/ {monthly ? 'mois' : 'sem.'}</small></button>)}</div><label className="range-label"><span>Montant personnalisé</span><strong>{money(forecastWeekly)} / {unit}</strong></label><input className="range-input" type="range" min="1" max={monthly ? 5000 : 500} step="1" value={forecastWeekly} onChange={e=>setForecastWeekly(Number(e.target.value))}/><div className="range-limits"><span>1 €</span><span>{monthly ? '5 000 €' : '500 €'}</span></div><div className="scenario-result"><Sparkles size={16}/><span>À ce rythme, tu pourrais atteindre <strong>{money(forecastWeekly*(monthly?24:104))}</strong> sur {horizon}.</span></div></div></div>
    {Number(totalSaved) <= 0 && <div className="panel forecast-empty-state"><strong>Ton parcours commence ici.</strong><span>Aucun versement n’est enregistré pour le moment : cette simulation reste disponible et se mettra à jour dès ton premier versement.</span></div>}<div className="panel chart-panel"><div className="panel-heading"><div><div className="eyebrow">COURBE DE PROGRESSION</div><h2>Capital estimé dans le temps</h2><p>Simulation indicative sur {horizon}, hors intérêts et frais.</p></div><div className="chart-legend"><i/> Capital projeté</div></div><div className="chart-area"><div className="chart-y-labels"><span>{money(chartMax)}</span><span>{money(chartMax*.75)}</span><span>{money(chartMax*.5)}</span><span>{money(chartMax*.25)}</span><span>0 €</span></div><div className="chart-content"><div className="chart-grid-lines"><i/><i/><i/><i/><i/></div><svg viewBox="0 0 760 250" preserveAspectRatio="none" role="img" aria-label="Courbe de capital projeté"><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity=".28"/><stop offset="100%" stopColor="#10b981" stopOpacity=".015"/></linearGradient></defs><path d={`M ${breakpoints.map((p,i)=>`${(i/(breakpoints.length-1))*760},${245-(p.amount/chartMax)*225}`).join(' L ')} L 760,250 L 0,250 Z`} fill="url(#chartFill)"/><polyline points={breakpoints.map((p,i)=>`${(i/(breakpoints.length-1))*760},${245-(p.amount/chartMax)*225}`).join(' ')} fill="none" stroke="#0e9f74" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>{breakpoints.map((p,i)=><circle key={i} cx={(i/(breakpoints.length-1))*760} cy={245-(p.amount/chartMax)*225} r="4" fill="#fff" stroke="#0e9f74" strokeWidth="3"/>)}</svg><div className="chart-x-labels"><span>Nov. 2026</span><span>{monthly ? 'Fév. 2027' : 'Mai 2027'}</span><span>{monthly ? 'Août 2027' : 'Nov. 2027'}</span><span>{monthly ? 'Mai 2028' : 'Mai 2028'}</span><span>Nov. 2028</span></div></div></div></div>
    <div className="panel debt-forecast-readonly"><div className="panel-heading"><div><div className="eyebrow">ENGAGEMENTS</div><h2>Dettes déclarées</h2><p>Lecture seule — ces montants ne sont pas inclus dans l’épargne.</p></div></div>{debts.length ? debts.map(d=>{const schedule=computeDebtSchedule(d);return <div className="scenario-line" key={d.id}><span>{d.label} · {money(d.monthlyPayment)} / mois</span><strong>{schedule.lastPaymentDate ? niceDate(schedule.lastPaymentDate) : 'Soldée'}</strong></div>}) : <p>Aucune dette enregistrée.</p>}</div><div className="forecast-bottom-grid"><div className="panel milestone-list-panel"><div className="panel-heading"><div><div className="eyebrow">ÉTAPES CLÉS</div><h2>Les caps à franchir</h2></div></div>{[1000,2500,5000,10000,20000].map(target=>{const done=totalSaved>=target;const left=Math.max(0,target-totalSaved);const slotsLeft=Math.ceil(left/Math.max(1,forecastWeekly));const eta=new Date();if(monthly) eta.setMonth(eta.getMonth()+slotsLeft);else eta.setDate(eta.getDate()+slotsLeft*7);return <div className="milestone-row" key={target}><div className={`milestone-status ${done?'done':''}`}>{done?<Check size={14}/>:<Target size={14}/>}</div><div className="milestone-info"><strong>{money(target)}</strong><span>{done?'Objectif atteint':`Environ ${slotsLeft} ${unit}${slotsLeft>1?'s':''} au rythme choisi`}</span></div><div className="milestone-date">{done?'✓':niceDate(isoDate(eta),{month:'short',year:'numeric'})}</div></div>})}</div><div className="panel scenario-table-panel"><div className="panel-heading"><div><div className="eyebrow">COMPARAISON</div><h2>Que peux-tu construire ?</h2></div></div><div className="scenario-table">{(monthly ? [activePeriodTarget,600,800,1000] : [weeklyTarget,150,200,250]).filter((value,index,array)=>array.indexOf(value)===index).map(amount=><div className={`scenario-line ${amount===forecastWeekly?'current':''}`} key={amount}><span>{money(amount)} / {unit}</span><strong>{money(amount*(monthly?24:104))}</strong><small>{amount===forecastWeekly?'Scénario sélectionné':`${amount*(monthly?24:104)<10000?'Moins de 10 000 €':'Capital potentiel'}`}</small></div>)}</div><p className="fine-print">Les résultats sont des projections mathématiques, non une garantie. Ils supposent {horizon} réguliers, sans intérêts, retraits, frais ou variation de change.</p></div></div>
  </>;
}

function ProjectsPage({ goals, totalSaved, congoTotal, businessTotal, onAdd, onEdit, onDelete }) {
  const [filter, setFilter] = useState('Tous');
  const [sortDeadline, setSortDeadline] = useState(false);
  const categories = ['Tous', ...new Set(goals.map(g=>g.category))];
  const visible = goals.filter(g=>filter==='Tous'||g.category===filter).sort((a,b)=>sortDeadline ? String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')) : 0);
  const colorClasses = ['mint','orange','violet','blue','pink'];
  const goalIcons = { 'Immobilier': Home, 'Personnel': Sparkles, 'Business': Briefcase, 'Sécurité': ShieldCheck, 'Formation': Laptop, 'Voyage': ArrowUpRight };
  return <><PageHeader eyebrow="DONNER UN SENS À TON CAPITAL" title="Mes projets" description="Définis tes grandes étapes, fixe un budget et suis leur progression." action={onAdd} actionLabel="Nouveau projet"/><div className="project-intro"><div className="project-intro-icon"><Target size={23}/></div><div><strong>Tu épargnes pour vivre tes projets, pas seulement pour voir un chiffre grandir.</strong><span>Les budgets affichés sont des exemples de départ : ajuste-les à tes devis, ta ville et tes priorités.</span></div><div className="project-intro-total"><span>Budget cible</span><strong>{money(sumBy(goals,g=>g.target))}</strong><small>{goals.length} projets · {money(totalAllocated(goals))} affectés</small></div></div><div className="project-top-stats"><div className="project-stat"><span>Capital total KELASI</span><strong>{money(totalSaved)}</strong></div><div className="project-stat"><span>Affecté aux projets Congo (non ajouté au total épargné)</span><strong>{money(congoTotal)}</strong></div><div className="project-stat"><span>Nombre d'objectifs</span><strong>{goals.length}</strong></div></div><div className="project-filter-row"><div className="eyebrow">MES OBJECTIFS <label className="deadline-sort"><input type="checkbox" checked={sortDeadline} onChange={e=>setSortDeadline(e.target.checked)}/> Trier par échéance</label></div><div className="filter-pills">{categories.map(c=><button key={c} className={filter===c?'active':''} onClick={()=>setFilter(c)}>{c}</button>)}</div></div>{visible.length ? <div className="projects-grid">{visible.map((goal,i)=>{const Icon=goalIcons[goal.category]||Target;const allocated=Number(goal.allocated||0);const {percent,remaining}=projectProgress(allocated,goal.target);const color=goal.color||colorClasses[i%colorClasses.length];return <article className="project-card" key={goal.id}><div className="project-card-top"><div className={`project-icon ${color}`}><Icon size={21}/></div><div className="project-card-menu"><button className="icon-button" aria-label="Modifier projet" onClick={()=>onEdit(goal)}><Pencil size={15}/></button><button className="icon-button danger" aria-label="Supprimer projet" onClick={()=>onDelete(goal)}><Trash2 size={15}/></button></div></div><span className="project-category">{goal.category}</span><h3>{goal.title}</h3><button type="button" className="project-target-row amount-edit-trigger" aria-label={`Modifier le projet ${goal.title}`} onClick={()=>onEdit(goal)}><span>Budget cible</span><strong>{money(goal.target)}</strong></button><div className="project-progress"><span className={color} style={{width:`${percent}%`}}/></div><div className="project-progress-info"><span>{percent.toFixed(0)} %</span><span>{goal.indicativeDate ? `Atteinte indicative : ${goal.indicativeDate}` : `${money(remaining)} restants`}</span></div><div className="project-card-foot"><span className="project-foot-icon"><Activity size={14}/></span><span>Montant réservé spécifiquement à ce projet</span></div><div className="project-deadline">Échéance : {goal.deadline ? `${niceDate(goal.deadline,{day:'numeric',month:'short',year:'numeric'})} · ${deadlineRemaining(goal.deadline)}` : 'Échéance libre'}</div></article>})}<button className="project-add-card" onClick={onAdd}><span><Plus size={22}/></span><strong>Ajouter un projet</strong><small>Un nouvel objectif à construire.</small></button></div> : <EmptyState icon={Target} title="Aucun objectif dans cette catégorie" text="Ajoute un projet pour organiser tes prochaines étapes." action={onAdd} actionLabel="Créer un projet"/>}<div className="project-ideas"><div className="panel-heading"><div><div className="eyebrow">IDÉES À 32 ANS</div><h2>Des priorités qui bâtissent l'avenir</h2><p>Des pistes à ajuster à ta situation personnelle.</p></div></div><div className="ideas-grid"><div><span className="idea-number">01</span><strong>Actifs immobiliers</strong><p>Vérifier les titres fonciers avec un professionnel avant de payer une parcelle ou de commencer la construction.</p></div><div><span className="idea-number">02</span><strong>Revenus durables</strong><p>Réserver un capital pour tester un petit business, mesurer les coûts et éviter de tout investir dès le départ.</p></div><div><span className="idea-number">03</span><strong>Sécurité & famille</strong><p>Prévoir une réserve d'urgence séparée des budgets mariage, construction et projets professionnels.</p></div></div></div></>;
}

function DebtsPage({ debts, onAdd, onEdit, onDetail, onDelete, onPaid }) {
  const total = debts.reduce((s,d)=>s+Number(d.totalAmount||0),0), monthly=debts.reduce((s,d)=>s+Number(d.monthlyPayment||0),0);
  return <><PageHeader eyebrow="ENGAGEMENTS FINANCIERS" title="Mes dettes" description="Suis les remboursements sans les mélanger à ton épargne." action={onAdd} actionLabel="Ajouter une dette"/><div className="project-top-stats"><div className="project-stat"><span>Total des dettes restantes</span><strong>{money(debts.reduce((s,d)=>s+computeDebtSchedule(d).remaining,0))}</strong></div><div className="project-stat"><span>Total mensuel engagé</span><strong>{money(monthly)}</strong></div><div className="project-stat"><span>Dettes suivies</span><strong>{debts.length}</strong></div></div><div className="debt-grid">{debts.map(d=><DebtCard key={d.id} debt={d} onClick={()=>onDetail(d)} onEdit={()=>onEdit(d)} onDelete={()=>onDelete(d)}/>)}<button className="project-add-card" onClick={onAdd}><span><Plus size={22}/></span><strong>Ajouter une dette</strong></button></div>{debts.map(d=><div className="debt-quick-actions" key={`${d.id}-actions`}><button className="btn-secondary" onClick={()=>onPaid(d)}>Marquer prochaine mensualité payée</button></div>)}</>;
}
function DebtCard({ debt, onClick, onEdit, onDelete }) { const schedule=computeDebtSchedule(debt), total=Number(debt.totalAmount)||0, paid=Number(debt.alreadyPaid)||0; return <article className="panel debt-card" onClick={onClick}><div className="project-card-top"><div className="project-icon mint"><Wallet size={20}/></div><div className="project-card-menu"><button className="icon-button" aria-label="Modifier dette" onClick={e=>{e.stopPropagation();onEdit();}}><Pencil size={15}/></button><button className="icon-button danger" aria-label="Supprimer dette" onClick={e=>{e.stopPropagation();onDelete();}}><Trash2 size={15}/></button></div></div><h3>{debt.label}</h3><p>Total : {money(total)} · Mensualité : {money(debt.monthlyPayment)}</p><p>Durée restante : {schedule.months} mois · Dernier paiement : {schedule.lastPaymentDate ? niceDate(schedule.lastPaymentDate) : '—'}</p><div className="project-progress"><span style={{width:`${total?Math.min(100,paid/total*100):100}%`}}/></div><small>{money(paid)} remboursés sur {money(total)}</small></article>; }
function DebtModal({ debt, onClose, onSave }) { const [label,setLabel]=useState(debt.label||''),[total,setTotal]=useState(String(debt.totalAmount||'')),[monthly,setMonthly]=useState(String(debt.monthlyPayment||'')),[date,setDate]=useState(debt.firstPaymentDate||isoDate(new Date())),[paid,setPaid]=useState(String(debt.alreadyPaid||0)),[error,setError]=useState(''); const submit=e=>{e.preventDefault(); if(!label.trim()||Number(total)<=0||Number(monthly)<=0)return setError('Renseigne un libellé et des montants positifs.');onSave({...debt,label:label.trim(),totalAmount:Number(total),monthlyPayment:Number(monthly),firstPaymentDate:date,alreadyPaid:Math.min(Number(total),Math.max(0,Number(paid)||0))});};return <ModalFrame title={debt.id?'Modifier une dette':'Ajouter une dette'} subtitle="Un suivi indépendant de ton capital épargné." onClose={onClose}><form className="modal-form" onSubmit={submit}><label className="form-label">Libellé<input autoFocus value={label} onChange={e=>setLabel(e.target.value)} required/></label><label className="form-label">Montant total (€)<input type="number" inputMode="decimal" min="1" step="0.01" value={total} onChange={e=>setTotal(e.target.value)} required/></label><label className="form-label">Mensualité (€)<input type="number" inputMode="decimal" min="1" step="0.01" value={monthly} onChange={e=>setMonthly(e.target.value)} required/></label><label className="form-label">Date du premier paiement<input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label><label className="form-label">Déjà payé (€)<input type="number" inputMode="decimal" min="0" step="0.01" value={paid} onChange={e=>setPaid(e.target.value)}/></label>{error&&<div className="inline-error">{error}</div>}<div className="modal-foot"><button type="button" className="btn-ghost" onClick={onClose}>Annuler</button><button className="btn-primary"><Check size={16}/>Enregistrer</button></div></form></ModalFrame>; }
function DebtDetailModal({ debt, onClose, onPaid, onDelete }) { const schedule=computeDebtSchedule(debt);return <ModalFrame title={debt.label} subtitle={`Échéancier · ${schedule.months} mois restants`} onClose={onClose}><div className="debt-schedule">{schedule.schedule.map(row=><label key={row.index} className="debt-schedule-row"><input type="checkbox" checked={row.index <= Math.ceil((Number(debt.alreadyPaid)||0)/Math.max(1,Number(debt.monthlyPayment)||1))} onChange={()=>onPaid({...debt,alreadyPaid:Math.min(debt.totalAmount,(Number(debt.alreadyPaid)||0)+row.amount),updated_at:new Date().toISOString()})}/><span>Échéance {row.index} · {niceDate(row.dueDate)}</span><strong>{money(row.amount)}</strong></label>)}</div><div className="modal-foot"><button type="button" className="btn-danger-outline" onClick={()=>onDelete(debt)}>Supprimer</button><button type="button" className="btn-secondary" onClick={onClose}>Fermer</button></div></ModalFrame>; }

function BankPage({ lastSnapshot, snapshots, totalSaved, persoTotal, businessTotal, congoTotal, debtMonthlyTotal=0, onAdd, onDelete, onImport, importError }) {
  const gap = lastSnapshot ? bankGap(Number(lastSnapshot.balance), totalSaved) : null;
  return <><PageHeader eyebrow="VUE FINANCIÈRE GLOBALE" title="Compte bancaire" description="Compare le solde déclaré de La Banque Postale avec ton suivi d'épargne personnel et business." action={onAdd} actionLabel="Actualiser le solde" actionIcon={RefreshCw}/><div className="bank-notice"><div className="bank-notice-icon"><ShieldCheck size={20}/></div><div><strong>Connexion bancaire non automatique</strong><p>KELASI ne se connecte pas directement à La Banque Postale. Saisis le solde que tu lis dans l'application officielle ; n'entre jamais tes identifiants bancaires ici.</p></div><a href="https://www.labanquepostale.fr/" target="_blank" rel="noreferrer" className="btn-secondary">Ouvrir La Banque Postale <ArrowUpRight size={15}/></a></div><div className="bank-top-grid"><button type="button" className="bank-balance-card bank-balance-trigger" aria-label="Modifier le dernier solde bancaire" onClick={onAdd}><span className="bank-card-top"><span className="bank-brand-line"><span className="bank-card-logo"><Landmark size={18}/></span><span>LA BANQUE POSTALE</span></span><span className="manual-badge"><span/> Saisie manuelle</span></span><div className="bank-balance-label">Dernier solde renseigné</div><div className="bank-balance-value">{lastSnapshot?money(lastSnapshot.balance):'À renseigner'}</div><div className="bank-card-bottom"><span>{lastSnapshot?`Mis à jour le ${niceDate(lastSnapshot.captured_at)}`:'Ajoute ton premier solde'}</span><button onClick={onAdd}><Plus size={15}/> Actualiser</button></div><span className="bank-card-watermark"><Landmark size={94}/></span></button><div className="bank-gap-card"><div className="bank-gap-icon"><Activity size={20}/></div><span className="summary-overline">ÉCART AVEC LE SUIVI KELASI</span><strong>{gap===null?'—':`${gap>0?'+':''}${money(gap)}`}</strong><p>{gap===null?'Renseigne un solde bancaire pour comparer.':gap>=0?'Le solde bancaire déclaré est supérieur au total suivi dans KELASI.':'Le total des versements KELASI dépasse le solde déclaré : vérifie les retraits et dépenses.'}</p><span className="gap-caveat">Cet écart n'est pas une anomalie automatique : KELASI n'enregistre pas tes autres revenus, retraits ni dépenses.</span></div></div><div className="bank-category-grid"><div className="bank-category-card debt-bank-info"><div className="bank-category-top"><Wallet size={18}/><span>Mensualités de dettes à venir ce mois</span></div><strong>{money(debtMonthlyTotal)}</strong><small>Engagement mensuel déclaré</small></div><div className="bank-category-card"><div className="bank-category-top"><Wallet size={18}/><span>Personnel</span></div><strong>{money(persoTotal)}</strong><small>Versements classés personnels</small></div><div className="bank-category-card"><div className="bank-category-top violet-text"><Briefcase size={18}/><span>Business</span></div><strong>{money(businessTotal)}</strong><small>Capital classé business</small></div><div className="bank-category-card"><div className="bank-category-top orange-text"><Target size={18}/><span>Projets Congo</span></div><strong>{money(congoTotal)}</strong><small>Capital affecté aux projets</small></div><div className="bank-category-card"><div className="bank-category-top blue-text"><PiggyBank size={18}/><span>Suivi total</span></div><strong>{money(totalSaved)}</strong><small>Tous les versements enregistrés</small></div></div><div className="panel bank-history"><div className="panel-heading"><div><div className="eyebrow">HISTORIQUE DES SOLDES</div><h2>Mes relevés de référence</h2><p>Garde une trace datée des soldes consultés dans l'application bancaire.</p></div></div>{snapshots.length?<div className="snapshot-list">{[...snapshots].sort((a,b)=>(b.captured_at||'').localeCompare(a.captured_at||'')).map(s=><div className="snapshot-row" key={s.id}><div className="snapshot-icon"><Landmark size={18}/></div><div className="snapshot-main"><strong>{niceDate(s.captured_at)}</strong><span>{s.note||'Solde déclaré'}</span></div><strong>{money(s.balance)}</strong><button className="icon-button danger" onClick={()=>onDelete(s)} aria-label="Supprimer ce solde"><Trash2 size={15}/></button></div>)}</div>:<EmptyState icon={Landmark} title="Aucun solde enregistré" text="Renseigne le montant affiché dans La Banque Postale pour commencer l'historique." action={onAdd} actionLabel="Saisir un solde"/>}</div><div className="bank-import-panel"><div className="bank-import-icon"><Upload size={18}/></div><div><strong>Sauvegarder ou restaurer tes données</strong><p>Pour une sauvegarde KELASI, utilise Réglages. L'import ici accepte un fichier de sauvegarde JSON KELASI, pas directement les relevés bancaires bruts.</p>{importError&&<span className="inline-error">{importError}</span>}</div><label className="btn-outline file-button">Importer JSON<input type="file" accept="application/json,.json" hidden onChange={e=>e.target.files?.[0]&&onImport(e.target.files[0])}/></label></div></>;
}

function SettingsPage({ onHome, theme, setTheme, data, updateData, userEmail, localMode, online, syncStatus, exportData, exportCsv, onImport, importError, onNotify, onLogout, onExitLocal, onInstall, showInstallHelp, installPrompt, onReset }) {
  const [showLogoutConfirm,setShowLogoutConfirm] = useState(false);
  const [weeklyDraft,setWeeklyDraft] = useState(String(data.weeklyTarget || DEFAULT_WEEKLY_TARGET));
  const [monthlyDraft,setMonthlyDraft] = useState(String(data.monthlyTarget || Number(data.weeklyTarget || 100)*4));
  useEffect(() => setWeeklyDraft(String(data.weeklyTarget || DEFAULT_WEEKLY_TARGET)), [data.weeklyTarget]);
  useEffect(() => setMonthlyDraft(String(data.monthlyTarget || Number(data.weeklyTarget || 100)*4)), [data.monthlyTarget]);
  const reminderDays = [{value:1,label:'Lundi'},{value:2,label:'Mardi'},{value:3,label:'Mercredi'},{value:4,label:'Jeudi'},{value:5,label:'Vendredi'},{value:6,label:'Samedi'},{value:0,label:'Dimanche'}];
  return <><PageHeader eyebrow="TON ESPACE, TES RÈGLES" title="Réglages" description="Personnalise ton expérience et contrôle tes données."/><div className="settings-layout"><div className="settings-main"><section className="panel settings-section"><div className="settings-section-header"><div className="settings-section-icon"><Wallet size={19}/></div><div><h2>Mon plan d'épargne</h2><p>Définis ton rythme de suivi; montants acceptés dès 1 €.</p></div></div><label className="settings-field"><span>Objectif de versement hebdomadaire</span><div className="settings-input-wrap"><input type="number" min="1" step="0.01" inputMode="decimal" value={weeklyDraft} onChange={e=>setWeeklyDraft(e.target.value)} onBlur={()=>{const value=normalizeWeeklyTarget(weeklyDraft);setWeeklyDraft(String(value));updateData(d=>({...d,weeklyTarget:value}));}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();e.currentTarget.blur();}}}/><span>€ / semaine</span></div></label><label className="settings-field"><span>Fréquence de suivi</span><select value={data.frequency || 'weekly'} onChange={e=>updateData(d=>({...d,frequency:e.target.value}))}><option value="weekly">Hebdomadaire</option><option value="monthly">Mensuelle</option></select></label><label className="settings-field"><span>Objectif mensuel</span><div className="settings-input-wrap"><input type="number" min="1" step="0.01" inputMode="decimal" value={monthlyDraft} onChange={e=>setMonthlyDraft(e.target.value)} onBlur={()=>{const v=Math.max(1,Number(monthlyDraft)||400);setMonthlyDraft(String(v));updateData(d=>({...d,monthlyTarget:v}));}}/><span>€ / mois</span></div></label><div className="settings-info"><CalendarDays size={16}/><span>Plan de suivi : <strong>2 novembre 2026 – 30 octobre 2028</strong>, sur 104 semaines de versement.</span></div></section><section className="panel settings-section"><div className="settings-section-header"><div className="settings-section-icon purple"><Sun size={19}/></div><div><h2>Apparence</h2><p>Choisis l'affichage le plus confortable pour toi.</p></div></div><div className="theme-options"><button className={theme==='light'?'chosen':''} onClick={()=>setTheme('light')}><span className="theme-preview light-preview"><Sun size={22}/></span><span><strong>Mode clair</strong><small>Net et lumineux</small></span>{theme==='light'&&<CheckCircle2 size={18}/>}</button><button className={theme==='dark'?'chosen':''} onClick={()=>setTheme('dark')}><span className="theme-preview dark-preview"><Moon size={22}/></span><span><strong>Mode sombre</strong><small>Confort visuel le soir</small></span>{theme==='dark'&&<CheckCircle2 size={18}/>}</button></div></section><section className="panel settings-section"><div className="settings-section-header"><div className="settings-section-icon orange"><Bell size={19}/></div><div><h2>Rappels de versement</h2><p>Reçois un rappel au prochain lancement de KELASI le jour choisi.</p></div></div><label className="settings-field"><span>Jour du mois (1–31)</span><input type="number" min="1" max="31" value={data.reminderDay??6} onChange={e=>updateData(d=>({...d,reminderDay:Math.max(1,Math.min(31,Number(e.target.value)||1))}))}/></label><label className="settings-field"><span>Moment préféré</span><select value={data.reminderMoment||'morning'} onChange={e=>updateData(d=>({...d,reminderMoment:e.target.value}))}><option value="morning">Matin</option><option value="afternoon">Après-midi</option></select></label><div className="settings-inline-actions"><span>Les rappels se déclenchent uniquement quand l’app est ouverte ou rouverte. Si les notifications sont refusées, KELASI affiche un message dans l’application.</span><button className="btn-secondary" onClick={onNotify}><Bell size={16}/> Activer les rappels</button></div><label className="settings-field"><span>Afficher les dettes dans le solde global</span><input type="checkbox" checked={Boolean(data.showDebtsInBalance)} onChange={e=>updateData(d=>({...d,showDebtsInBalance:e.target.checked}))}/></label></section><section className="panel settings-section"><div className="settings-section-header"><div className="settings-section-icon blue"><Cloud size={19}/></div><div><h2>Compte & synchronisation</h2><p>État du compte qui stocke tes données.</p></div></div><div className="account-info-row"><div className="account-avatar">{userEmail.charAt(0).toUpperCase()||'K'}</div><div><strong>{userEmail}</strong><span>{localMode?'Local : cet appareil uniquement':online?(syncStatus==='synced'?'Connexion cloud active':'Compte Supabase'):'Hors ligne : synchronisation en attente'}</span></div><span className={`account-status ${localMode?'local':syncStatus==='synced'?'good':'waiting'}`}>{localMode?'LOCAL':syncStatus==='synced'?'ACTIF':'EN ATTENTE'}</span></div>{localMode&&<><div className="settings-info warning-info"><HelpCircle size={16}/><span>Pour utiliser la même épargne sur le téléphone et la tablette, configure Supabase et crée un compte sécurisé. Le mode local ne synchronise pas les appareils.</span></div><button className="btn-primary local-exit-settings" onClick={onExitLocal}><LogOut size={16}/> Quitter le mode local / Se connecter</button></>}{!localMode&&<button className="btn-danger-outline" onClick={()=>setShowLogoutConfirm(true)}><LogOut size={16}/> Se déconnecter</button>}{showLogoutConfirm&&<div className="confirm-inline"><span>Te déconnecter de cet appareil ? Les données synchronisées resteront dans ton compte.</span><button className="btn-secondary" onClick={()=>setShowLogoutConfirm(false)}>Annuler</button><button className="btn-danger" onClick={onLogout}>Déconnexion</button></div>}</section><section className="panel settings-section"><div className="settings-section-header"><div className="settings-section-icon mint"><FileText size={19}/></div><div><h2>Sauvegarde & export</h2><p>Garde une copie de tes données ou analyse tes versements.</p></div></div><div className="export-actions"><button className="export-option" onClick={exportData}><span className="export-icon"><Download size={18}/></span><span><strong>Sauvegarde complète JSON</strong><small>Versements, soldes, projets et dettes</small></span><ArrowRight size={16}/></button><button className="export-option" onClick={exportCsv}><span className="export-icon csv"><FileText size={18}/></span><span><strong>Exporter les versements CSV</strong><small>Ouvrable dans Excel ou LibreOffice</small></span><ArrowRight size={16}/></button><label className="export-option import-option"><span className="export-icon import"><Upload size={18}/></span><span><strong>Restaurer une sauvegarde JSON</strong><small>Fusionne les données du fichier avec celles présentes</small></span><ArrowRight size={16}/><input type="file" accept="application/json,.json" hidden onChange={e=>e.target.files?.[0]&&onImport(e.target.files[0])}/></label>{importError&&<span className="inline-error">{importError}</span>}</div></section><section className="panel settings-section danger-settings"><div className="settings-section-header"><div className="settings-section-icon orange"><RefreshCw size={19}/></div><div><h2>Zone sensible</h2><p>Supprime les données conservées sur cet appareil.</p></div></div><button className="btn-danger-outline" onClick={onReset}><RefreshCw size={16}/> Réinitialiser les données locales</button></section></div><aside className="settings-aside"><div className="settings-brand-card"><button type="button" className="settings-logo" aria-label="KELASI, revenir à l’Accueil" onClick={onHome}><img src="/icons/kelasi-512.png" alt="Logo KELASI" onError={e=>{e.currentTarget.style.display='none';e.currentTarget.parentElement.dataset.fallback='K';}} /></button><h3>KELASI</h3><p>Ton épargne, ton avenir, semaine après semaine.</p><span className="version-pill">VERSION 1.7.1 · PWA</span><button className="btn-primary full-width" onClick={onInstall}><Download size={16}/>{installPrompt?'Installer maintenant':'Installer sur mon appareil'}</button>{showInstallHelp&&<p className="install-mini-help">Android : menu ⋮ → Installer. iPhone/iPad : Partager → Sur l'écran d'accueil.</p>}</div><div className="privacy-card"><ShieldCheck size={19}/><strong>Ta sécurité avant tout</strong><p>Ne saisis jamais ton mot de passe La Banque Postale dans KELASI. Ne partage pas tes codes d'accès. L'authentification de l'application est distincte de ta banque.</p></div><div className="support-card"><HelpCircle size={18}/><div><strong>À propos du hors ligne</strong><p>Les données sont conservées localement. Avec Supabase configuré, elles se synchronisent au retour d'Internet. Pour une première connexion, un accès Internet est nécessaire.</p></div></div></aside></div></>;
}

function EmptyState({ icon: Icon, title, text, action, actionLabel }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={24}/></div><h3>{title}</h3><p>{text}</p>{action&&<button className="btn-secondary" onClick={action}><Plus size={16}/>{actionLabel||'Ajouter'}</button>}</div>;
}

function DepositModal({ entry, onClose, onSave }) {
  const [weekStart,setWeekStart] = useState(entry.date || entry.week_start || isoDate(new Date()));
  const [amount,setAmount] = useState(String(entry.amount ?? DEFAULT_WEEKLY_TARGET));
  const [category,setCategory] = useState(entry.category || 'perso');
  const [note,setNote] = useState(entry.note || '');
  const [error,setError] = useState('');
  const amountNum = Number(String(amount).replace(',','.'));
  const submit = e => { e.preventDefault(); if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return setError('Choisis une semaine valide.'); if (amountNum <= 0 || !Number.isFinite(amountNum)) return setError('Le montant doit être supérieur à zéro.');  onSave({ ...(entry.id?{id:entry.id}:{}), date:weekStart, week_start:weekStart, amount:amountNum, category, note:note.trim() }); };
  return <ModalFrame title={entry.id?'Modifier le versement':'Nouveau versement'} subtitle="Chaque versement construit ton capital." onClose={onClose}><form className="modal-form" onSubmit={submit}><div className="amount-entry-label">MONTANT DU VERSEMENT</div><div className="amount-input-wrap"><span>€</span><input type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} autoFocus required/><small>EUR</small></div><div className="min-rule"><CheckCircle2 size={14}/> Tout montant positif est accepté</div><label className="form-label">Date réelle du versement<input type="date" value={weekStart} onChange={e=>setWeekStart(e.target.value)} required/></label><div className="form-label">Catégorie de versement</div><div className="category-choice-grid">{CATEGORIES.map(c=>{const Icon=c.icon;return <button type="button" key={c.id} className={`category-choice ${category===c.id?'selected':''}`} onClick={()=>setCategory(c.id)}><span className={`category-choice-icon ${c.color}`}><Icon size={18}/></span><span>{c.label}</span>{category===c.id&&<CheckCircle2 size={15}/>}</button>})}</div><label className="form-label">Note (facultative)<input value={note} onChange={e=>setNote(e.target.value)} placeholder="Ex. : virement épargne de novembre" maxLength={140}/></label>{error&&<div className="inline-error">{error}</div>}<div className="modal-foot"><button type="button" className="btn-ghost" onClick={onClose}>Annuler</button><button className="btn-primary"><Check size={17}/>{entry.id?'Enregistrer les modifications':'Valider le versement'}</button></div></form></ModalFrame>;
}
function GoalModal({ goal, onClose, onSave }) {
  const [title,setTitle] = useState(goal.title||'');const [target,setTarget]=useState(String(goal.target||'1000'));const [allocated,setAllocated]=useState(String(goal.allocated||'0'));const [category,setCategory]=useState(goal.category||'Personnel');const [color,setColor]=useState(goal.color||'mint');const [deadline,setDeadline]=useState(goal.deadline||'');const [error,setError]=useState('');
  const submit=e=>{e.preventDefault();if(!title.trim())return setError('Donne un nom à ton projet.');if(Number(target)<=0)return setError('Le budget doit être supérieur à zéro.');onSave({...(goal.id?{id:goal.id}:{}),title:title.trim(),target:Number(String(target).replace(',','.')),allocated:Math.max(0,Number(String(allocated).replace(',','.'))||0),category,color,deadline:deadline||null});};
  return <ModalFrame title={goal.id?'Modifier le projet':'Nouvel objectif'} subtitle="Définis une prochaine étape réaliste." onClose={onClose}><form className="modal-form" onSubmit={submit}><label className="form-label">Nom du projet<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Ex. : Acheter une parcelle" maxLength={70} required/></label><label className="form-label">Budget cible (€)<input type="number" inputMode="decimal" min="0.01" step="0.01" value={target} onChange={e=>setTarget(e.target.value)} required/></label><label className="form-label">Montant déjà affecté à ce projet (€)<input type="number" min="0" step="0.01" inputMode="decimal" value={allocated} onChange={e=>setAllocated(e.target.value)}/><span className="field-hint">Renseigne ici la somme réservée spécifiquement à ce projet.</span></label><label className="form-label">Date d’échéance (facultative)<input type="date" value={deadline} onChange={e=>setDeadline(e.target.value)}/></label><label className="form-label">Catégorie<select value={category} onChange={e=>setCategory(e.target.value)}>{['Immobilier','Personnel','Business','Sécurité','Formation','Voyage','Famille','Autre'].map(c=><option key={c}>{c}</option>)}</select></label><div className="form-label">Couleur</div><div className="color-choices">{['mint','orange','violet','blue','pink'].map(c=><button type="button" key={c} aria-label={c} className={`color-choice ${c} ${color===c?'selected':''}`} onClick={()=>setColor(c)}>{color===c&&<Check size={15}/>}</button>)}</div>{error&&<div className="inline-error">{error}</div>}<div className="modal-foot"><button type="button" className="btn-ghost" onClick={onClose}>Annuler</button><button className="btn-primary"><Check size={16}/>{goal.id?'Modifier le projet':'Créer le projet'}</button></div></form></ModalFrame>;
}
function BankModal({ snapshot = {}, onClose, onSave }) {
  const [balance,setBalance]=useState(String(snapshot.balance ?? ''));const [date,setDate]=useState(snapshot.captured_at || isoDate(new Date()));const [note,setNote]=useState(snapshot.note || '');const [error,setError]=useState('');
  const submit=e=>{e.preventDefault();const n=Number(String(balance).replace(',','.'));if(!Number.isFinite(n)||n<0)return setError('Saisis un solde de 0 € ou plus.');onSave({...(snapshot.id?{id:snapshot.id}:{}),balance:n,captured_at:date,note:note.trim()});};
  return <ModalFrame title={snapshot.id ? 'Modifier le solde bancaire' : 'Actualiser le solde bancaire'} subtitle="Reporte le montant affiché dans l'application officielle de ta banque." onClose={onClose}><form className="modal-form" onSubmit={submit}><div className="bank-modal-caution"><ShieldCheck size={17}/><span>Ne saisis ni identifiant, ni mot de passe bancaire. Seul le montant du solde est demandé.</span></div><label className="form-label">Solde du compte (€)<input type="number" min="0" step="0.01" inputMode="decimal" value={balance} onChange={e=>setBalance(e.target.value)} placeholder="Ex. : 4 250,00" required/></label><label className="form-label">Date de consultation<input type="date" value={date} onChange={e=>setDate(e.target.value)} required/></label><label className="form-label">Note (facultative)<input value={note} onChange={e=>setNote(e.target.value)} placeholder="Ex. : après le virement hebdomadaire" maxLength={120}/></label>{error&&<div className="inline-error">{error}</div>}<div className="modal-foot"><button type="button" className="btn-ghost" onClick={onClose}>Annuler</button><button className="btn-primary"><Check size={17}/>{snapshot.id ? 'Enregistrer les modifications' : 'Enregistrer le solde'}</button></div></form></ModalFrame>;
}
function ModalFrame({ title, subtitle, onClose, children }) {
  useEffect(()=>{document.querySelector('.modal-card input:not([type=hidden]), .modal-card button')?.focus?.();const key=e=>e.key==='Escape'&&onClose();window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[onClose]);
  return <div className="modal-overlay" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal-card"><div className="modal-header"><div><div className="eyebrow">KELASI · TON ESPACE</div><h2>{title}</h2><p>{subtitle}</p></div><button className="icon-button" onClick={onClose} aria-label="Fermer"><X size={19}/></button></div>{children}</div></div>;
}

export default App;
