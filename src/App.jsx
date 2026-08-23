import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Plus, Trash2, Pencil, ChevronLeft, ChevronRight, AlertTriangle,
  Home, List, Settings as SettingsIcon, X, Check, User, Wallet,
  Users, CreditCard, Download, Upload, ShieldAlert, Lock, FileSpreadsheet, GripVertical
} from 'lucide-react';
import { ensureSignedIn } from './firebase';
import { subscribeShared, setShared, getPersonal, setPersonal } from './storage';

/* ---------- Design tokens ---------- */
const C = {
  paper: '#F6F1E7',
  paperAlt: '#EFE8D8',
  card: '#FFFDF9',
  ink: '#1F2B25',
  inkSoft: '#5B6B62',
  line: '#DCD3BE',
  navy: '#0E7C5A',
  gold: '#E9DFC3',
  sage: '#2E8B63',
  amber: '#C6863A',
  brick: '#B34B3C',
};

const CATEGORY_PALETTE = [
  '#B5654A', '#3E5C8C', '#7A5C8C', '#4F6788', '#B08A3E', '#B5546F', '#8C7A6B', '#8C5E3E',
  '#A6491F', '#3E6E70', '#8C7EA8', '#A68B3E', '#7A3E4A', '#4A7A9E', '#9C6B4A', '#A66B8C',
  '#6B5E3E', '#C17A5E', '#4A4E8C', '#7A8C7A', '#B5723E', '#6E7EB5', '#6B3E4E', '#B59A6B',
  '#3E4A5C', '#C68870', '#6B4E8C', '#C6923E', '#C68C96', '#8C723E',
];
const PAYMENT_TYPES = ['Credit Card', 'Debit Card', 'Checking', 'Savings', 'Cash', 'Other'];

const DEFAULT_CATEGORIES = [
  { id: 'groceries', name: 'Groceries', limit: 600, color: CATEGORY_PALETTE[0] },
  { id: 'dining', name: 'Dining Out', limit: 200, color: CATEGORY_PALETTE[1] },
  { id: 'transport', name: 'Transportation', limit: 150, color: CATEGORY_PALETTE[2] },
  { id: 'utilities', name: 'Utilities', limit: 250, color: CATEGORY_PALETTE[3] },
  { id: 'entertainment', name: 'Entertainment', limit: 100, color: CATEGORY_PALETTE[4] },
  { id: 'shopping', name: 'Shopping', limit: 200, color: CATEGORY_PALETTE[5] },
  { id: 'health', name: 'Health & Fitness', limit: 100, color: CATEGORY_PALETTE[6] },
  { id: 'other', name: 'Other', limit: 100, color: CATEGORY_PALETTE[7] },
];

const DEFAULT_PAYMENT_METHODS = [
  { id: 'cash', name: 'Cash', type: 'Cash' },
  { id: 'checking', name: 'Checking Account', type: 'Checking' },
  { id: 'credit', name: 'Credit Card', type: 'Credit Card' },
];

/* ---------- Helpers ---------- */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function todayStr() {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function formatMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function formatDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function fmtMoney(n, symbol) {
  const sign = n < 0 ? '-' : '';
  return `${sign}${symbol}${Math.abs(n).toFixed(2)}`;
}

function statusColor(pct) {
  if (pct >= 100) return C.brick;
  if (pct >= 80) return C.amber;
  return C.sage;
}

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

/* ---------- Small building blocks ---------- */
function ProgressBar({ pct, color }) {
  return (
    <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: C.paperAlt }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function MonthNav({ month, onShift }) {
  return (
    <div className="flex items-center justify-between px-1">
      <button onClick={() => onShift(-1)} className="p-2 rounded-full" aria-label="Previous month">
        <ChevronLeft size={20} color={C.paper} />
      </button>
      <div className="font-semibold text-base tracking-wide" style={{ color: C.paper, fontFamily: "'Fraunces', serif" }}>
        {formatMonth(month)}
      </div>
      <button onClick={() => onShift(1)} className="p-2 rounded-full" aria-label="Next month">
        <ChevronRight size={20} color={C.paper} />
      </button>
    </div>
  );
}

function Avatar({ name }) {
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
      style={{ backgroundColor: C.navy, color: C.paper, fontFamily: "'IBM Plex Mono', monospace" }}
      title={name || 'Unknown'}
    >
      {initials(name)}
    </div>
  );
}

/* ---------- Logo ---------- */
function Logo({ size = 40 }) {
  const r = size * 0.26;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-label="Roxas Family Ledger logo">
      <rect x="2" y="2" width="96" height="96" rx={r} fill={C.navy} />
      <rect x="2" y="2" width="96" height="96" rx={r} fill="none" stroke={C.gold} strokeOpacity="0.35" strokeWidth="1.5" />
      <text
        x="50" y="58" textAnchor="middle" fontFamily="'Fraunces', serif" fontWeight="600"
        fontSize="52" fill={C.gold}
      >R</text>
      <rect x="30" y="70" width="40" height="3" rx="1.5" fill={C.gold} fillOpacity="0.6" />
    </svg>
  );
}

/* ---------- Color picker (used for new + existing categories) ---------- */
function ColorPicker({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORY_PALETTE.map(col => (
        <button
          key={col} type="button" onClick={() => onChange(col)}
          className="w-6 h-6 rounded-full shrink-0"
          style={{ backgroundColor: col, boxShadow: value === col ? `0 0 0 2px ${C.paper}, 0 0 0 4px ${C.navy}` : 'none' }}
          aria-label={`Choose color ${col}`}
        />
      ))}
    </div>
  );
}

/* ---------- PIN lock screen ---------- */
function LockScreen({ pin, securityQuestion, onUnlock, onReset }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [answer, setAnswer] = useState('');
  const [answerError, setAnswerError] = useState('');

  const submit = () => {
    if (value === pin) { onUnlock(); }
    else { setError("That PIN doesn't match. Try again."); setValue(''); }
  };

  const submitAnswer = () => {
    if (securityQuestion && answer.trim().toLowerCase() === securityQuestion.answer.trim().toLowerCase()) {
      onReset();
    } else {
      setAnswerError("That answer doesn't match. Try again.");
      setAnswer('');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: C.paper }}>
      <div className="w-full max-w-xs">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: C.navy }}>
            <Lock size={20} color={C.paper} />
          </div>
          <div className="font-semibold text-lg" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Roxas Family Ledger</div>
          <p className="text-xs mt-1" style={{ color: C.inkSoft }}>Enter the PIN to continue</p>
        </div>
        <div className="space-y-3">
          {error && <p className="text-sm text-center" style={{ color: C.brick }}>{error}</p>}
          <input
            type="password" inputMode="numeric" pattern="[0-9]*" autoFocus
            value={value} onChange={e => { setValue(e.target.value.replace(/\D/g, '')); setError(''); }}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            className="w-full rounded-lg px-3 py-3 border text-center text-2xl tracking-[0.5em]"
            style={{ borderColor: C.line, backgroundColor: C.card, color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}
            placeholder="••••"
          />
          <button type="button" onClick={submit} className="w-full rounded-lg py-2.5 font-medium" style={{ backgroundColor: C.navy, color: C.paper }}>
            Unlock
          </button>
        </div>
        <div className="text-center mt-4">
          {!showForgot ? (
            <button onClick={() => setShowForgot(true)} className="text-xs underline" style={{ color: C.inkSoft }}>Forgot the PIN?</button>
          ) : securityQuestion ? (
            <div className="rounded-lg p-3 text-xs text-left space-y-2" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
              <p style={{ color: C.inkSoft }}>Answer your security question to reset the PIN:</p>
              <p className="font-medium" style={{ color: C.ink }}>{securityQuestion.question}</p>
              {answerError && <p style={{ color: C.brick }}>{answerError}</p>}
              <input
                type="text" value={answer} onChange={e => { setAnswer(e.target.value); setAnswerError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') submitAnswer(); }}
                className="w-full rounded-lg px-2.5 py-1.5 border text-sm" placeholder="Your answer"
                style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink }}
              />
              <button type="button" onClick={submitAnswer} className="w-full text-xs font-medium px-3 py-1.5 rounded-md" style={{ backgroundColor: C.brick, color: '#fff' }}>Verify & reset PIN</button>
            </div>
          ) : (
            <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: C.card, border: `1px solid ${C.line}`, color: C.inkSoft }}>
              <p className="mb-2">No security question is set up, so there's no way to verify who's asking — this removes the lock for both of you. Set a security question next time in Settings.</p>
              <button onClick={onReset} className="text-xs font-medium px-3 py-1.5 rounded-md" style={{ backgroundColor: C.brick, color: '#fff' }}>Remove PIN & continue</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Expense form (used for both add + edit) ---------- */
function ExpenseForm({ categories, members, paymentMethods, currency, defaultMember, initial, onSubmit, onCancel }) {
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [vendor, setVendor] = useState(initial ? initial.vendor : '');
  const [categoryId, setCategoryId] = useState(initial ? initial.categoryId : (categories[0] ? categories[0].id : ''));
  const [date, setDate] = useState(initial ? initial.date : todayStr());
  const [note, setNote] = useState(initial ? (initial.note || '') : '');
  const [loggedBy, setLoggedBy] = useState(initial ? (initial.loggedBy || '') : (defaultMember || (members[0] ? members[0].name : '')));
  const [paymentMethodId, setPaymentMethodId] = useState(initial ? (initial.paymentMethodId || '') : '');
  const [error, setError] = useState('');
  const errorRef = useRef(null);

  useEffect(() => {
    if (error && errorRef.current) errorRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [error]);

  const submit = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError('Enter an amount greater than $0.'); return; }
    if (!vendor.trim()) { setError('Enter who you paid.'); return; }
    if (!categoryId) { setError('Choose a category.'); return; }
    if (!date) { setError('Choose a date.'); return; }
    if (!loggedBy.trim()) { setError("Choose who's logging this."); return; }
    setError('');
    onSubmit({ amount: amt, vendor: vendor.trim(), categoryId, date, note: note.trim(), loggedBy: loggedBy.trim(), paymentMethodId });
    if (!initial) { setAmount(''); setVendor(''); setNote(''); setDate(todayStr()); }
  };

  const inputCls = "w-full rounded-lg px-3 py-2.5 text-base border focus:outline-none focus:ring-2";

  return (
    <div className="space-y-4">
      {error && (
        <div ref={errorRef} className="text-sm rounded-lg px-3 py-2 flex items-center gap-2" style={{ backgroundColor: '#F4E3DF', color: C.brick }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: C.inkSoft }}>Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base" style={{ color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>{currency}</span>
          <input type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit(); }}
            placeholder="0.00" className={inputCls}
            style={{ borderColor: C.line, backgroundColor: C.card, color: C.ink, paddingLeft: '1.75rem', fontFamily: "'IBM Plex Mono', monospace" }} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: C.inkSoft }}>Vendor</label>
        <input type="text" value={vendor} onChange={e => setVendor(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder="Trader Joe's, Shell, Netflix..."
          className={inputCls} style={{ borderColor: C.line, backgroundColor: C.card, color: C.ink }} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: C.inkSoft }}>Category</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={inputCls}
            style={{ borderColor: C.line, backgroundColor: C.card, color: C.ink }}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: C.inkSoft }}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls}
            style={{ borderColor: C.line, backgroundColor: C.card, color: C.ink }} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: C.inkSoft }}>Logged by</label>
          {members.length > 0 ? (
            <select value={loggedBy} onChange={e => setLoggedBy(e.target.value)} className={inputCls}
              style={{ borderColor: C.line, backgroundColor: C.card, color: C.ink }}>
              {members.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
            </select>
          ) : (
            <input type="text" value={loggedBy} onChange={e => setLoggedBy(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              placeholder="Your name"
              className={inputCls} style={{ borderColor: C.line, backgroundColor: C.card, color: C.ink }} />
          )}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: C.inkSoft }}>Payment method</label>
          <select value={paymentMethodId} onChange={e => setPaymentMethodId(e.target.value)} className={inputCls}
            style={{ borderColor: C.line, backgroundColor: C.card, color: C.ink }}>
            <option value="">Not specified</option>
            {paymentMethods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1" style={{ color: C.inkSoft }}>Note (optional)</label>
        <input type="text" value={note} onChange={e => setNote(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder="Anything worth remembering"
          className={inputCls} style={{ borderColor: C.line, backgroundColor: C.card, color: C.ink }} />
      </div>
      <div className="flex gap-3 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex-1 rounded-lg py-2.5 font-medium border" style={{ borderColor: C.line, color: C.inkSoft }}>
            Cancel
          </button>
        )}
        <button type="button" onClick={submit} className="flex-1 rounded-lg py-2.5 font-medium flex items-center justify-center gap-2" style={{ backgroundColor: C.navy, color: C.paper }}>
          <Check size={18} /> {initial ? 'Save changes' : 'Add expense'}
        </button>
      </div>
    </div>
  );
}

/* ---------- Transaction row ---------- */
function TransactionRow({ tx, category, paymentMethod, currency, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const who = tx.loggedBy || tx.addedBy;
  const subtitle = [
    category ? category.name : 'Uncategorized',
    formatDay(tx.date),
    paymentMethod ? paymentMethod.name : null,
    tx.note || null,
  ].filter(Boolean).join(' · ');
  return (
    <div className="flex items-center gap-3 py-3 border-b last:border-b-0" style={{ borderColor: C.line }}>
      <Avatar name={who} />
      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: category ? category.color : '#999' }} />
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate" style={{ color: C.ink }}>{tx.vendor}</div>
        <div className="text-xs truncate" style={{ color: C.inkSoft }}>{subtitle}</div>
      </div>
      <div className="text-right font-semibold shrink-0" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>
        {fmtMoney(tx.amount, currency)}
      </div>
      {!confirming ? (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => onEdit(tx)} className="p-1.5 rounded-md" aria-label="Edit"><Pencil size={15} color={C.inkSoft} /></button>
          <button onClick={() => setConfirming(true)} className="p-1.5 rounded-md" aria-label="Delete"><Trash2 size={15} color={C.inkSoft} /></button>
        </div>
      ) : (
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => { onDelete(tx.id); setConfirming(false); }} className="text-xs px-2 py-1 rounded-md font-medium" style={{ backgroundColor: C.brick, color: '#fff' }}>Delete</button>
          <button onClick={() => setConfirming(false)} className="p-1.5" aria-label="Cancel delete"><X size={15} color={C.inkSoft} /></button>
        </div>
      )}
    </div>
  );
}

/* ---------- Main App ---------- */
export default function BudgetTracker() {
  const [ready, setReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [transactions, setTransactions] = useState([]);
  const [householdMembers, setHouseholdMembers] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState(DEFAULT_PAYMENT_METHODS);
  const [currency, setCurrency] = useState('$');
  const [userName, setUserName] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [tab, setTab] = useState('dashboard');
  const [selectedMonth, setSelectedMonth] = useState(todayStr().slice(0, 7));
  const [filterCategory, setFilterCategory] = useState(null);
  const [editingTx, setEditingTx] = useState(null);
  const [lastAdded, setLastAdded] = useState(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatLimit, setNewCatLimit] = useState('');
  const [newCatColor, setNewCatColor] = useState(CATEGORY_PALETTE[0]);
  const [openColorPickerId, setOpenColorPickerId] = useState(null);
  const [showAddCat, setShowAddCat] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newPmName, setNewPmName] = useState('');
  const [newPmType, setNewPmType] = useState(PAYMENT_TYPES[0]);
  const [draggingPmId, setDraggingPmId] = useState(null);
  const [draggingCatId, setDraggingCatId] = useState(null);
  const [importPending, setImportPending] = useState(null);
  const [importError, setImportError] = useState('');
  const [pinDraft, setPinDraft] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinFormError, setPinFormError] = useState('');
  const [showPinForm, setShowPinForm] = useState(false);
  const [confirmRemovePin, setConfirmRemovePin] = useState(false);
  const [sqDraft, setSqDraft] = useState('');
  const [saDraft, setSaDraft] = useState('');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [pin, setPin] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const fileInputRef = useRef(null);

  // Real-time sync: each shared key gets its own live subscription. Firestore
  // pushes updates the moment either device writes — no polling, no manual
  // refresh button needed. `ready` flips true once every key has reported at
  // least once (from cache or server), same as the old "initial load" moment.
  useEffect(() => {
    let unsub = () => {};
    ensureSignedIn(() => {
      const loadedKeys = new Set();
      const expectedKeys = ['categories', 'transactions', 'household-members', 'payment-methods', 'currency', 'app-pin', 'security-qa'];
      const markLoaded = (key) => {
        loadedKeys.add(key);
        if (expectedKeys.every(k => loadedKeys.has(k))) setReady(true);
      };

      const unsubs = [
        subscribeShared('categories', (v) => { if (v) setCategories(JSON.parse(v)); markLoaded('categories'); }),
        subscribeShared('transactions', (v) => { if (v) setTransactions(JSON.parse(v)); markLoaded('transactions'); }),
        subscribeShared('household-members', (v) => { if (v) setHouseholdMembers(JSON.parse(v)); markLoaded('household-members'); }),
        subscribeShared('payment-methods', (v) => { if (v) setPaymentMethods(JSON.parse(v)); markLoaded('payment-methods'); }),
        subscribeShared('currency', (v) => { if (v) setCurrency(v); markLoaded('currency'); }),
        subscribeShared('app-pin', (v) => { setPin(v || ''); markLoaded('app-pin'); }),
        subscribeShared('security-qa', (v) => { if (v) setSecurityQuestion(JSON.parse(v)); markLoaded('security-qa'); }),
      ];
      unsub = () => unsubs.forEach(u => u());
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const name = getPersonal('user-name');
    if (name) setUserName(name);
  }, []);

  // Keep the splash screen visible for a beat even if data loads instantly, so it reads as intentional.
  useEffect(() => {
    const t = setTimeout(() => setSplashDone(true), 700);
    return () => clearTimeout(t);
  }, []);

  const saveCategories = useCallback((next) => { setCategories(next); setShared('categories', JSON.stringify(next)); }, []);
  const saveTransactions = useCallback((next) => { setTransactions(next); setShared('transactions', JSON.stringify(next)); }, []);
  const saveCurrency = useCallback((next) => { setCurrency(next); setShared('currency', next); }, []);
  const savePin = useCallback((next) => { setPin(next); setShared('app-pin', next); }, []);
  const saveSecurityQuestion = useCallback((next) => { setSecurityQuestion(next); setShared('security-qa', JSON.stringify(next)); }, []);
  const savePaymentMethods = useCallback((next) => { setPaymentMethods(next); setShared('payment-methods', JSON.stringify(next)); }, []);
  const saveHouseholdMembers = useCallback((next) => { setHouseholdMembers(next); setShared('household-members', JSON.stringify(next)); }, []);

  const saveName = useCallback((next) => {
    setUserName(next);
    setPersonal('user-name', next);
    setHouseholdMembers(prev => {
      if (prev.some(m => m.name.toLowerCase() === next.toLowerCase())) return prev;
      const nextList = [...prev, { id: uid(), name: next }];
      setShared('household-members', JSON.stringify(nextList));
      return nextList;
    });
  }, []);

  const monthTx = transactions.filter(t => t.date.slice(0, 7) === selectedMonth);
  const spendByCat = {};
  categories.forEach(c => { spendByCat[c.id] = 0; });
  monthTx.forEach(t => { spendByCat[t.categoryId] = (spendByCat[t.categoryId] || 0) + t.amount; });
  const totalSpent = Object.values(spendByCat).reduce((a, b) => a + b, 0);
  const totalBudget = categories.reduce((a, c) => a + c.limit, 0);
  const overallPct = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const warnings = categories
    .map(c => ({ c, spent: spendByCat[c.id] || 0, pct: c.limit > 0 ? ((spendByCat[c.id] || 0) / c.limit) * 100 : 0 }))
    .filter(x => x.pct >= 80)
    .sort((a, b) => b.pct - a.pct);

  const addTransaction = (data) => {
    const tx = { id: uid(), ...data };
    saveTransactions([...transactions, tx]);
    setSelectedMonth(data.date.slice(0, 7));
    setPersonal('last-member', data.loggedBy);
    const cat = categories.find(c => c.id === data.categoryId);
    const spentNow = (spendByCat[data.categoryId] || 0) + data.amount;
    const pct = cat && cat.limit > 0 ? (spentNow / cat.limit) * 100 : 0;
    setLastAdded({ vendor: data.vendor, amount: data.amount, category: cat ? cat.name : '', pct, limit: cat ? cat.limit : 0 });
  };

  const updateTransaction = (id, data) => {
    saveTransactions(transactions.map(t => t.id === id ? { ...t, ...data } : t));
    setEditingTx(null);
  };
  const deleteTransaction = (id) => saveTransactions(transactions.filter(t => t.id !== id));

  const categoryInUse = (id) => transactions.some(t => t.categoryId === id);
  const memberInUse = (name) => transactions.some(t => (t.loggedBy || t.addedBy) === name);

  const updateCategoryLimit = (id, limit) => saveCategories(categories.map(c => c.id === id ? { ...c, limit } : c));
  const updateCategoryName = (id, name) => saveCategories(categories.map(c => c.id === id ? { ...c, name } : c));
  const updateCategoryColor = (id, color) => saveCategories(categories.map(c => c.id === id ? { ...c, color } : c));
  const deleteCategory = (id) => { if (!categoryInUse(id)) saveCategories(categories.filter(c => c.id !== id)); };
  const addCategory = () => {
    const name = newCatName.trim();
    const limit = parseFloat(newCatLimit);
    if (!name || !limit || limit <= 0) return;
    saveCategories([...categories, { id: uid(), name, limit, color: newCatColor }]);
    setNewCatName(''); setNewCatLimit(''); setNewCatColor(CATEGORY_PALETTE[0]); setShowAddCat(false);
  };

  const addMember = () => {
    const name = newMemberName.trim();
    if (!name || householdMembers.some(m => m.name.toLowerCase() === name.toLowerCase())) return;
    saveHouseholdMembers([...householdMembers, { id: uid(), name }]);
    setNewMemberName('');
  };
  const renameMember = (id, name) => saveHouseholdMembers(householdMembers.map(m => m.id === id ? { ...m, name } : m));
  const removeMember = (id, name) => { if (!memberInUse(name)) saveHouseholdMembers(householdMembers.filter(m => m.id !== id)); };

  const addPaymentMethod = () => {
    const name = newPmName.trim();
    if (!name) return;
    savePaymentMethods([...paymentMethods, { id: uid(), name, type: newPmType }]);
    setNewPmName(''); setNewPmType(PAYMENT_TYPES[0]);
  };
  const renamePaymentMethod = (id, name) => savePaymentMethods(paymentMethods.map(p => p.id === id ? { ...p, name } : p));
  const removePaymentMethod = (id) => savePaymentMethods(paymentMethods.filter(p => p.id !== id));

  const handlePmDragStart = (e, id) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingPmId(id);
  };
  const handlePmDragMove = (e) => {
    if (!draggingPmId) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const rowEl = el && el.closest('[data-pm-row]');
    if (!rowEl) return;
    const overId = rowEl.getAttribute('data-pm-row');
    if (overId === draggingPmId) return;
    const fromIdx = paymentMethods.findIndex(p => p.id === draggingPmId);
    const toIdx = paymentMethods.findIndex(p => p.id === overId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...paymentMethods];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setPaymentMethods(next);
  };
  const handlePmDragEnd = () => {
    if (draggingPmId) setShared('payment-methods', JSON.stringify(paymentMethods));
    setDraggingPmId(null);
  };

  const handleCatDragStart = (e, id) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggingCatId(id);
  };
  const handleCatDragMove = (e) => {
    if (!draggingCatId) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const rowEl = el && el.closest('[data-cat-row]');
    if (!rowEl) return;
    const overId = rowEl.getAttribute('data-cat-row');
    if (overId === draggingCatId) return;
    const fromIdx = categories.findIndex(c => c.id === draggingCatId);
    const toIdx = categories.findIndex(c => c.id === overId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...categories];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setCategories(next);
  };
  const handleCatDragEnd = () => {
    if (draggingCatId) setShared('categories', JSON.stringify(categories));
    setDraggingCatId(null);
  };

  const shiftMonthBy = (d) => setSelectedMonth(m => shiftMonth(m, d));

  const visibleTx = [...monthTx]
    .filter(t => !filterCategory || t.categoryId === filterCategory)
    .sort((a, b) => b.date.localeCompare(a.date) || 0);

  const handleExport = () => {
    const payload = { exportedAt: new Date().toISOString(), categories, transactions, paymentMethods, householdMembers, currency, pin, securityQuestion };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `roxas-ledger-backup-${todayStr()}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportSpreadsheet = () => {
    const monthLabel = formatMonth(selectedMonth);

    // Read me
    const readMeAoa = [
      ['Roxas Family Ledger'],
      [`Exported ${todayStr()}`],
      [],
      ['How to add a chart (takes about 3 clicks):'],
      ['1. Open the "Summary" tab.'],
      ['2. Select the Category, Spent, and Limit columns, including their headers.'],
      ['3. Excel: Insert > Chart, pick Pie or Column.  Google Sheets: Insert > Chart — it usually picks a good one automatically.'],
      [],
      ['What\u2019s on each tab:'],
      ['Summary', `This month's (${monthLabel}) spending vs. limits by category — laid out ready to chart.`],
      ['Transactions', 'Every expense logged, with category, payment method, and who logged it.'],
      ['Categories', 'Your categories and their monthly limits.'],
      ['Payment Methods', 'Cards and accounts you\u2019ve set up.'],
      ['Household', 'Everyone in the household list.'],
    ];
    const readMeWs = XLSX.utils.aoa_to_sheet(readMeAoa);
    readMeWs['!cols'] = [{ wch: 20 }, { wch: 70 }];

    // Summary (chart-ready)
    const summaryAoa = [
      [`Category spending \u2014 ${monthLabel}`],
      [],
      ['Category', `Spent (${currency})`, `Limit (${currency})`, '% Used', `Remaining (${currency})`],
      ...categories.map(c => {
        const spent = spendByCat[c.id] || 0;
        const pct = c.limit > 0 ? Math.round((spent / c.limit) * 100) : 0;
        return [c.name, Number(spent.toFixed(2)), c.limit, pct, Number((c.limit - spent).toFixed(2))];
      }),
      [],
      ['Total', Number(totalSpent.toFixed(2)), totalBudget, totalBudget > 0 ? Math.round(overallPct) : 0, Number((totalBudget - totalSpent).toFixed(2))],
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryAoa);
    summaryWs['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 16 }];

    // Transactions
    const txRows = [...transactions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(t => {
        const cat = categories.find(c => c.id === t.categoryId);
        const pm = paymentMethods.find(p => p.id === t.paymentMethodId);
        return {
          Date: t.date,
          Vendor: t.vendor,
          Category: cat ? cat.name : 'Uncategorized',
          Amount: t.amount,
          'Payment Method': pm ? pm.name : '',
          'Logged By': t.loggedBy || t.addedBy || '',
          Note: t.note || '',
        };
      });
    const txWs = XLSX.utils.json_to_sheet(txRows.length ? txRows : [{ Date: '', Vendor: '', Category: '', Amount: '', 'Payment Method': '', 'Logged By': '', Note: '' }]);
    txWs['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 14 }, { wch: 28 }];

    // Categories
    const catRows = categories.map(c => ({ Category: c.name, [`Monthly Limit (${currency})`]: c.limit }));
    const catWs = XLSX.utils.json_to_sheet(catRows);
    catWs['!cols'] = [{ wch: 20 }, { wch: 18 }];

    // Payment methods
    const pmRows = paymentMethods.map(p => ({ Name: p.name, Type: p.type }));
    const pmWs = XLSX.utils.json_to_sheet(pmRows);
    pmWs['!cols'] = [{ wch: 22 }, { wch: 16 }];

    // Household
    const memberRows = householdMembers.map(m => ({ Name: m.name }));
    const memberWs = XLSX.utils.json_to_sheet(memberRows);
    memberWs['!cols'] = [{ wch: 22 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, readMeWs, 'Read Me');
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');
    XLSX.utils.book_append_sheet(wb, txWs, 'Transactions');
    XLSX.utils.book_append_sheet(wb, catWs, 'Categories');
    XLSX.utils.book_append_sheet(wb, pmWs, 'Payment Methods');
    XLSX.utils.book_append_sheet(wb, memberWs, 'Household');
    XLSX.writeFile(wb, `roxas-ledger-${todayStr()}.xlsx`);
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportError('');
    const reader = new FileReader();
    reader.onload = (evt) => {
      try { setImportPending(JSON.parse(evt.target.result)); }
      catch { setImportError("That file doesn't look like a valid backup."); }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmImport = () => {
    if (!importPending) return;
    if (Array.isArray(importPending.categories)) saveCategories(importPending.categories);
    if (Array.isArray(importPending.transactions)) saveTransactions(importPending.transactions);
    if (Array.isArray(importPending.paymentMethods)) savePaymentMethods(importPending.paymentMethods);
    if (Array.isArray(importPending.householdMembers)) saveHouseholdMembers(importPending.householdMembers);
    if (importPending.currency) saveCurrency(importPending.currency);
    if (typeof importPending.pin === 'string') savePin(importPending.pin);
    if (importPending.securityQuestion) saveSecurityQuestion(importPending.securityQuestion);
    setImportPending(null);
  };

  const clearAllTransactions = () => {
    saveTransactions([]);
    setShowClearConfirm(false);
    setClearConfirmText('');
  };

  const submitPin = () => {
    if (pinDraft.length < 4 || pinDraft.length > 8) { setPinFormError('Use 4–8 digits.'); return; }
    if (pinDraft !== pinConfirm) { setPinFormError("Those don't match."); return; }
    if (!sqDraft.trim() || !saDraft.trim()) { setPinFormError('Add a security question and answer too — it\'s what protects "Forgot the PIN".'); return; }
    savePin(pinDraft);
    saveSecurityQuestion({ question: sqDraft.trim(), answer: saDraft.trim() });
    setUnlocked(true);
    setPinDraft(''); setPinConfirm(''); setPinFormError(''); setShowPinForm(false);
  };

  if (!ready || !splashDone) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: C.navy }}>
        <style>{`
          @keyframes ledger-pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 1; } }
          @keyframes ledger-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
        <div style={{ animation: 'ledger-fade-in 0.5s ease-out' }}>
          <Logo size={84} />
        </div>
        <div className="text-center" style={{ animation: 'ledger-fade-in 0.5s ease-out 0.1s both' }}>
          <div className="text-lg font-semibold tracking-wide" style={{ color: C.paper, fontFamily: "'Fraunces', serif" }}>Roxas Family Ledger</div>
        </div>
        <div className="flex gap-1.5 mt-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: C.gold, animation: `ledger-pulse 1.1s ease-in-out ${i * 0.15}s infinite` }} />
          ))}
        </div>
      </div>
    );
  }

  if (pin && !unlocked) {
    return <LockScreen pin={pin} securityQuestion={securityQuestion} onUnlock={() => setUnlocked(true)} onReset={() => { savePin(''); setUnlocked(true); }} />;
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.paper, fontFamily: "'Inter', sans-serif" }}>
      <div className="pt-5 pb-4 px-4" style={{ backgroundColor: C.navy }}>
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Logo size={22} />
            <span className="text-sm tracking-widest uppercase" style={{ color: C.gold, letterSpacing: '0.15em' }}>Roxas Family Ledger</span>
          </div>
          <MonthNav month={selectedMonth} onShift={shiftMonthBy} />
        </div>
      </div>


      <div className="max-w-md mx-auto px-4 pb-28 pt-4">

        {!userName && (
          <div className="mb-4 rounded-xl p-4 border" style={{ backgroundColor: C.card, borderColor: C.line }}>
            <div className="font-medium mb-2 flex items-center gap-2" style={{ color: C.ink }}>
              <User size={16} /> What should we call you?
            </div>
            <p className="text-xs mb-3" style={{ color: C.inkSoft }}>
              This adds you to the household list below so entries can be attributed to you. Saved on this device.
            </p>
            <div className="flex gap-2">
              <input value={nameDraft} onChange={e => setNameDraft(e.target.value)} placeholder="Your name"
                className="flex-1 rounded-lg px-3 py-2 border text-sm" style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink }} />
              <button onClick={() => nameDraft.trim() && saveName(nameDraft.trim())} className="px-4 rounded-lg text-sm font-medium" style={{ backgroundColor: C.navy, color: C.paper }}>
                Save
              </button>
            </div>
          </div>
        )}

        {tab === 'dashboard' && (
          <div>
            {warnings.length > 0 && (
              <div className="space-y-2 mb-4">
                {warnings.map(w => (
                  <div key={w.c.id} className="flex items-start gap-2 rounded-lg px-3 py-2 text-sm"
                    style={{ backgroundColor: w.pct >= 100 ? '#F4E3DF' : '#F6EBDA', color: w.pct >= 100 ? C.brick : '#8A5E22' }}>
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <span>
                      {w.pct >= 100
                        ? <><strong>{w.c.name}</strong> is {fmtMoney(w.spent - w.c.limit, currency)} over budget this month.</>
                        : <>You're at {Math.round(w.pct)}% of your <strong>{w.c.name}</strong> budget this month.</>}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl p-4 mb-4 border" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs" style={{ color: C.inkSoft }}>Spent this month</span>
                <span className="text-xs" style={{ color: C.inkSoft }}>Budget {fmtMoney(totalBudget, currency)}</span>
              </div>
              <div className="text-3xl font-semibold mb-3" style={{ color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }}>{fmtMoney(totalSpent, currency)}</div>
              <ProgressBar pct={overallPct} color={statusColor(overallPct)} />
              <div className="text-xs mt-1.5" style={{ color: C.inkSoft }}>
                {totalSpent <= totalBudget ? `${fmtMoney(totalBudget - totalSpent, currency)} left to spend` : `${fmtMoney(totalSpent - totalBudget, currency)} over overall budget`}
              </div>
            </div>

            <div className="space-y-2.5">
              {categories.map(c => {
                const spent = spendByCat[c.id] || 0;
                const pct = c.limit > 0 ? (spent / c.limit) * 100 : 0;
                return (
                  <button key={c.id} onClick={() => { setFilterCategory(c.id); setTab('transactions'); }}
                    className="w-full text-left rounded-xl p-3.5 border block" style={{ backgroundColor: C.card, borderColor: C.line }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="font-medium truncate" style={{ color: C.ink }}>{c.name}</span>
                      </div>
                      <span className="text-sm shrink-0" style={{ color: C.inkSoft, fontFamily: "'IBM Plex Mono', monospace" }}>
                        {fmtMoney(spent, currency)} / {fmtMoney(c.limit, currency)}
                      </span>
                    </div>
                    <ProgressBar pct={pct} color={statusColor(pct)} />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'add' && (
          <div>
            {lastAdded && (
              <div className="mb-4 rounded-lg px-3 py-2.5 text-sm flex items-start gap-2" style={{ backgroundColor: '#E7EFE9' }}>
                <Check size={16} className="mt-0.5 shrink-0" color={C.sage} />
                <span style={{ color: C.ink }}>
                  Added {fmtMoney(lastAdded.amount, currency)} at {lastAdded.vendor} to {lastAdded.category}.
                  {lastAdded.pct >= 100 && <> That puts you {fmtMoney((lastAdded.pct / 100 * lastAdded.limit) - lastAdded.limit, currency)} over budget for this category.</>}
                  {lastAdded.pct >= 80 && lastAdded.pct < 100 && <> You're now at {Math.round(lastAdded.pct)}% of that category's budget.</>}
                </span>
                <button onClick={() => setLastAdded(null)} className="ml-auto shrink-0"><X size={14} color={C.inkSoft} /></button>
              </div>
            )}
            <div className="rounded-xl p-4 border" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <ExpenseForm categories={categories} members={householdMembers} paymentMethods={paymentMethods} currency={currency} defaultMember={userName} onSubmit={addTransaction} />
            </div>
          </div>
        )}

        {tab === 'transactions' && (
          <div>
            {filterCategory && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5" style={{ backgroundColor: C.paperAlt, color: C.ink }}>
                  {categories.find(c => c.id === filterCategory)?.name || 'Category'}
                  <button onClick={() => setFilterCategory(null)}><X size={12} /></button>
                </span>
              </div>
            )}
            <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: C.card, borderColor: C.line }}>
              {visibleTx.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm mb-3" style={{ color: C.inkSoft }}>No expenses logged for {formatMonth(selectedMonth)} yet.</p>
                  <button onClick={() => setTab('add')} className="text-sm font-medium px-4 py-2 rounded-lg" style={{ backgroundColor: C.navy, color: C.paper }}>Log your first expense</button>
                </div>
              ) : (
                <div className="px-4">
                  {visibleTx.map(tx => (
                    <TransactionRow key={tx.id} tx={tx}
                      category={categories.find(c => c.id === tx.categoryId)}
                      paymentMethod={paymentMethods.find(p => p.id === tx.paymentMethodId)}
                      currency={currency} onEdit={setEditingTx} onDelete={deleteTransaction} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'settings' && (
          <div className="space-y-4">
            <div className="rounded-xl p-4 border" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <div className="font-medium mb-3 flex items-center gap-2" style={{ color: C.ink }}><Users size={16} /> Household members</div>
              <div className="space-y-2">
                {householdMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-2">
                    <input defaultValue={m.name} onBlur={e => e.target.value.trim() && renameMember(m.id, e.target.value.trim())}
                      className="flex-1 rounded-lg px-2.5 py-1.5 border text-sm" style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink }} />
                    <button onClick={() => removeMember(m.id, m.name)} disabled={memberInUse(m.name)}
                      title={memberInUse(m.name) ? "This person has logged expenses, so they can't be removed" : 'Remove'}
                      className="p-1.5 shrink-0" style={{ opacity: memberInUse(m.name) ? 0.3 : 1 }}>
                      <Trash2 size={15} color={C.inkSoft} />
                    </button>
                  </div>
                ))}
                {householdMembers.length === 0 && <p className="text-xs" style={{ color: C.inkSoft }}>No one added yet — save your name above to get started.</p>}
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t" style={{ borderColor: C.line }}>
                <input value={newMemberName} onChange={e => setNewMemberName(e.target.value)} placeholder="Add a household member (e.g. a kid's name)"
                  className="flex-1 rounded-lg px-3 py-2 border text-sm" style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink }} />
                <button onClick={addMember} className="px-3 rounded-lg text-sm font-medium" style={{ backgroundColor: C.navy, color: C.paper }}><Plus size={16} /></button>
              </div>
            </div>

            <div className="rounded-xl p-4 border" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <div className="font-medium mb-3 flex items-center gap-2" style={{ color: C.ink }}><CreditCard size={16} /> Payment methods</div>
              <div className="space-y-2">
                {paymentMethods.map((p) => (
                  <div key={p.id} data-pm-row={p.id}
                    className="flex items-center gap-1.5 rounded-lg"
                    style={{ backgroundColor: draggingPmId === p.id ? C.paperAlt : 'transparent', opacity: draggingPmId === p.id ? 0.6 : 1 }}>
                    <button
                      onPointerDown={(e) => handlePmDragStart(e, p.id)}
                      onPointerMove={handlePmDragMove}
                      onPointerUp={handlePmDragEnd}
                      onPointerCancel={handlePmDragEnd}
                      className="p-1 shrink-0 cursor-grab"
                      style={{ touchAction: 'none' }}
                      aria-label="Drag to reorder"
                    >
                      <GripVertical size={15} color={C.inkSoft} />
                    </button>
                    <input defaultValue={p.name} onBlur={e => e.target.value.trim() && renamePaymentMethod(p.id, e.target.value.trim())}
                      className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 border text-sm" style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink }} />
                    <span className="text-xs px-2 py-1 rounded-md shrink-0" style={{ backgroundColor: C.paperAlt, color: C.inkSoft }}>{p.type}</span>
                    <button onClick={() => removePaymentMethod(p.id)} className="p-1.5 shrink-0"><Trash2 size={15} color={C.inkSoft} /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t" style={{ borderColor: C.line }}>
                <input value={newPmName} onChange={e => setNewPmName(e.target.value)} placeholder="e.g. Chase Sapphire"
                  className="flex-1 min-w-0 rounded-lg px-3 py-2 border text-sm" style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink }} />
                <select value={newPmType} onChange={e => setNewPmType(e.target.value)}
                  className="rounded-lg px-2 py-2 border text-sm shrink-0" style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink }}>
                  {PAYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={addPaymentMethod} className="px-3 rounded-lg text-sm font-medium shrink-0" style={{ backgroundColor: C.navy, color: C.paper }}><Plus size={16} /></button>
              </div>
              <p className="text-xs mt-3" style={{ color: C.inkSoft }}>Store a label like "Chase Sapphire" or the last 4 digits if it helps you tell accounts apart — never a full card or account number.</p>
            </div>

            <div className="rounded-xl p-4 border" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <div className="font-medium mb-3" style={{ color: C.ink }}>Currency symbol</div>
              <input value={currency} maxLength={3} onChange={e => saveCurrency(e.target.value || '$')}
                className="w-20 rounded-lg px-3 py-2 border text-sm text-center" style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink }} />
            </div>

            <div className="rounded-xl p-4 border" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <div className="font-medium mb-3" style={{ color: C.ink }}>Categories & monthly limits</div>
              <div className="space-y-1">
                {categories.map(c => (
                  <div key={c.id} data-cat-row={c.id} className="rounded-lg"
                    style={{ backgroundColor: draggingCatId === c.id ? C.paperAlt : 'transparent', opacity: draggingCatId === c.id ? 0.6 : 1 }}>
                    <div className="flex items-center gap-1.5 py-1">
                      <button
                        onPointerDown={(e) => handleCatDragStart(e, c.id)}
                        onPointerMove={handleCatDragMove}
                        onPointerUp={handleCatDragEnd}
                        onPointerCancel={handleCatDragEnd}
                        className="p-1 shrink-0 cursor-grab"
                        style={{ touchAction: 'none' }}
                        aria-label="Drag to reorder"
                      >
                        <GripVertical size={15} color={C.inkSoft} />
                      </button>
                      <button type="button" onClick={() => setOpenColorPickerId(openColorPickerId === c.id ? null : c.id)}
                        className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: c.color }} aria-label="Change color" />
                      <input defaultValue={c.name} onBlur={e => e.target.value.trim() && updateCategoryName(c.id, e.target.value.trim())}
                        className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 border text-sm" style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink }} />
                      <div className="relative shrink-0">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: C.inkSoft }}>{currency}</span>
                        <input type="number" min="0" step="1" defaultValue={c.limit}
                          onBlur={e => { const v = parseFloat(e.target.value); if (v > 0) updateCategoryLimit(c.id, v); }}
                          className="w-24 rounded-lg pl-5 pr-2 py-1.5 border text-sm" style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink, fontFamily: "'IBM Plex Mono', monospace" }} />
                      </div>
                      <button onClick={() => deleteCategory(c.id)} disabled={categoryInUse(c.id)}
                        title={categoryInUse(c.id) ? "Remove this category's expenses first" : 'Delete category'}
                        className="p-1.5 shrink-0" style={{ opacity: categoryInUse(c.id) ? 0.3 : 1 }}>
                        <Trash2 size={15} color={C.inkSoft} />
                      </button>
                    </div>
                    {openColorPickerId === c.id && (
                      <div className="mt-1 mb-1 pl-12">
                        <ColorPicker value={c.color} onChange={(col) => { updateCategoryColor(c.id, col); setOpenColorPickerId(null); }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {!showAddCat ? (
                <button onClick={() => setShowAddCat(true)} className="mt-4 text-sm font-medium flex items-center gap-1.5" style={{ color: C.navy }}>
                  <Plus size={16} /> Add category
                </button>
              ) : (
                <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: C.line }}>
                  <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Category name"
                    className="w-full rounded-lg px-3 py-2 border text-sm" style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink }} />
                  <input type="number" min="0" value={newCatLimit} onChange={e => setNewCatLimit(e.target.value)} placeholder={`Monthly limit (${currency})`}
                    className="w-full rounded-lg px-3 py-2 border text-sm" style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink }} />
                  <ColorPicker value={newCatColor} onChange={setNewCatColor} />
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddCat(false)} className="flex-1 rounded-lg py-2 text-sm border" style={{ borderColor: C.line, color: C.inkSoft }}>Cancel</button>
                    <button onClick={addCategory} className="flex-1 rounded-lg py-2 text-sm font-medium" style={{ backgroundColor: C.navy, color: C.paper }}>Add</button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl p-4 border" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <div className="font-medium mb-2 flex items-center gap-2" style={{ color: C.ink }}><Lock size={16} /> App PIN</div>
              <p className="text-xs mb-3" style={{ color: C.inkSoft }}>
                A shared 4–8 digit PIN you both use to open the app — a privacy screen, not real account security. Your phone's own lock is what actually protects this. The security question guards "Forgot the PIN," so only someone who knows the answer can reset it.
              </p>

              {pin && !showPinForm && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm" style={{ color: C.ink }}>PIN is set</span>
                    <button onClick={() => { setShowPinForm(true); setPinDraft(''); setPinConfirm(''); setSqDraft(securityQuestion ? securityQuestion.question : ''); setSaDraft(securityQuestion ? securityQuestion.answer : ''); setPinFormError(''); }}
                      className="text-sm px-3 py-1.5 rounded-lg border" style={{ borderColor: C.line, color: C.ink }}>Change</button>
                    {!confirmRemovePin ? (
                      <button onClick={() => setConfirmRemovePin(true)} className="text-sm px-3 py-1.5 rounded-lg" style={{ color: C.brick }}>Remove</button>
                    ) : (
                      <>
                        <button onClick={() => { savePin(''); setConfirmRemovePin(false); }} className="text-sm px-3 py-1.5 rounded-lg font-medium" style={{ backgroundColor: C.brick, color: '#fff' }}>Confirm</button>
                        <button onClick={() => setConfirmRemovePin(false)} className="p-1.5"><X size={14} color={C.inkSoft} /></button>
                      </>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: C.inkSoft }}>
                    Security question: {securityQuestion ? <span style={{ color: C.ink }}>{securityQuestion.question}</span> : 'not set'}
                  </p>
                </div>
              )}

              {(!pin || showPinForm) && (
                <div className="space-y-2">
                  {pinFormError && <p className="text-xs" style={{ color: C.brick }}>{pinFormError}</p>}
                  <input type="password" inputMode="numeric" pattern="[0-9]*" value={pinDraft}
                    onChange={e => setPinDraft(e.target.value.replace(/\D/g, ''))} placeholder="New PIN"
                    className="w-full rounded-lg px-3 py-2 border text-sm" style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink }} />
                  <input type="password" inputMode="numeric" pattern="[0-9]*" value={pinConfirm}
                    onChange={e => setPinConfirm(e.target.value.replace(/\D/g, ''))} placeholder="Confirm PIN"
                    className="w-full rounded-lg px-3 py-2 border text-sm" style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink }} />
                  <div className="pt-1 mt-1 border-t" style={{ borderColor: C.line }}>
                    <p className="text-xs mt-2 mb-1.5" style={{ color: C.inkSoft }}>Security question (used to reset the PIN)</p>
                    <input type="text" value={sqDraft} onChange={e => setSqDraft(e.target.value)}
                      placeholder="e.g. What street did we meet on?"
                      className="w-full rounded-lg px-3 py-2 border text-sm mb-2" style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink }} />
                    <input type="text" value={saDraft} onChange={e => setSaDraft(e.target.value)}
                      placeholder="Answer"
                      className="w-full rounded-lg px-3 py-2 border text-sm" style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink }} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    {showPinForm && (
                      <button onClick={() => setShowPinForm(false)} className="flex-1 rounded-lg py-2 text-sm border" style={{ borderColor: C.line, color: C.inkSoft }}>Cancel</button>
                    )}
                    <button onClick={submitPin} className="flex-1 rounded-lg py-2 text-sm font-medium" style={{ backgroundColor: C.navy, color: C.paper }}>Save PIN</button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl p-4 border" style={{ backgroundColor: C.card, borderColor: C.line }}>
              <div className="font-medium mb-2 flex items-center gap-2" style={{ color: C.ink }}><ShieldAlert size={16} /> Backup & data</div>
              <p className="text-xs mb-3" style={{ color: C.inkSoft }}>
                Everything here is saved automatically and shared with anyone who has this app's link. Changes sync instantly between devices — no need to refresh or reopen the app to see what the other person added.
              </p>
              {importError && (
                <div className="text-sm rounded-lg px-3 py-2 mb-3 flex items-center gap-2" style={{ backgroundColor: '#F4E3DF', color: C.brick }}>
                  <AlertTriangle size={16} /> {importError}
                </div>
              )}
              {importPending ? (
                <div className="rounded-lg p-3 mb-3 text-sm" style={{ backgroundColor: '#F6EBDA', color: '#8A5E22' }}>
                  <p className="mb-2">
                    This file has {(importPending.transactions || []).length} expenses, {(importPending.categories || []).length} categories,
                    {' '}{(importPending.paymentMethods || []).length} payment methods, and {(importPending.householdMembers || []).length} household members
                    {importPending.exportedAt ? ` (exported ${new Date(importPending.exportedAt).toLocaleDateString()})` : ''}.
                    This will replace everything currently saved, for both of you.
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setImportPending(null)} className="flex-1 rounded-lg py-2 text-sm border" style={{ borderColor: C.line, color: C.inkSoft, backgroundColor: C.card }}>Cancel</button>
                    <button onClick={confirmImport} className="flex-1 rounded-lg py-2 text-sm font-medium" style={{ backgroundColor: C.brick, color: '#fff' }}>Replace data</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <button onClick={handleExportSpreadsheet} className="w-full rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2" style={{ backgroundColor: C.navy, color: C.paper }}>
                    <FileSpreadsheet size={16} /> Export as spreadsheet (.xlsx)
                  </button>
                  <p className="text-xs" style={{ color: C.inkSoft }}>Opens in Excel, Google Sheets, or Numbers — a Read Me, a chart-ready Summary tab for this month, plus Transactions, Categories, Payment Methods, and Household.</p>
                  <div className="flex gap-2 pt-2 mt-1 border-t" style={{ borderColor: C.line }}>
                    <button onClick={handleExport} className="flex-1 rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2 border" style={{ borderColor: C.line, color: C.ink }}>
                      <Download size={16} /> Export backup
                    </button>
                    <button onClick={() => fileInputRef.current && fileInputRef.current.click()} className="flex-1 rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2 border" style={{ borderColor: C.line, color: C.ink }}>
                      <Upload size={16} /> Import backup
                    </button>
                    <input ref={fileInputRef} type="file" accept="application/json" onChange={handleImportFile} className="hidden" />
                  </div>
                  <p className="text-xs" style={{ color: C.inkSoft }}>The backup (.json) is what this app reads back in to restore everything exactly — use it for your periodic safety copy.</p>
                </div>
              )}
            </div>

            <div className="rounded-xl p-4 border" style={{ backgroundColor: C.card, borderColor: C.brick }}>
              <div className="font-medium mb-2 flex items-center gap-2" style={{ color: C.brick }}><AlertTriangle size={16} /> Danger zone</div>
              {!showClearConfirm ? (
                <>
                  <p className="text-xs mb-3" style={{ color: C.inkSoft }}>
                    Clear every logged expense for both of you — handy for wiping test entries before you share this. Categories, limits, payment methods, household list, and your PIN are untouched.
                  </p>
                  <button onClick={() => setShowClearConfirm(true)} className="w-full rounded-lg py-2.5 text-sm font-medium" style={{ backgroundColor: C.brick, color: '#fff' }}>
                    Clear all transactions
                  </button>
                </>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm" style={{ color: C.brick }}>
                    This permanently deletes all {transactions.length} logged expense{transactions.length === 1 ? '' : 's'} for both of you. It can't be undone. Consider exporting a backup first.
                  </p>
                  <p className="text-xs" style={{ color: C.inkSoft }}>Type CLEAR to confirm.</p>
                  <input
                    type="text" value={clearConfirmText} onChange={e => setClearConfirmText(e.target.value)}
                    placeholder="CLEAR" autoFocus
                    className="w-full rounded-lg px-3 py-2 border text-sm"
                    style={{ borderColor: C.line, backgroundColor: C.paper, color: C.ink }}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => { setShowClearConfirm(false); setClearConfirmText(''); }} className="flex-1 rounded-lg py-2 text-sm border" style={{ borderColor: C.line, color: C.inkSoft }}>Cancel</button>
                    <button
                      onClick={clearAllTransactions}
                      disabled={clearConfirmText.trim().toUpperCase() !== 'CLEAR'}
                      className="flex-1 rounded-lg py-2 text-sm font-medium"
                      style={{ backgroundColor: C.brick, color: '#fff', opacity: clearConfirmText.trim().toUpperCase() === 'CLEAR' ? 1 : 0.4 }}
                    >
                      Confirm delete
                    </button>
                  </div>
                </div>
              )}
            </div>

            <p className="text-xs text-center px-4" style={{ color: C.inkSoft }}>
              Alerts show up right here in the app, not as phone notifications — a banner when you log an expense, plus warnings on Overview for anything at 80%+.
            </p>
          </div>
        )}
      </div>

      {editingTx && (
        <div className="fixed inset-0 z-20 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ backgroundColor: 'rgba(34,48,63,0.5)' }}>
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: C.paper }}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold" style={{ color: C.ink, fontFamily: "'Fraunces', serif" }}>Edit expense</span>
              <button onClick={() => setEditingTx(null)}><X size={18} color={C.inkSoft} /></button>
            </div>
            <ExpenseForm categories={categories} members={householdMembers} paymentMethods={paymentMethods} currency={currency}
              defaultMember={userName} initial={editingTx} onSubmit={(data) => updateTransaction(editingTx.id, data)} onCancel={() => setEditingTx(null)} />
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md border-t px-6 py-2 flex items-center justify-between" style={{ backgroundColor: C.card, borderColor: C.line }}>
        {[
          { id: 'dashboard', label: 'Overview', icon: Home },
          { id: 'add', label: 'Add', icon: Plus },
          { id: 'transactions', label: 'History', icon: List },
          { id: 'settings', label: 'Settings', icon: SettingsIcon },
        ].map(item => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button key={item.id} onClick={() => { setTab(item.id); if (item.id !== 'transactions') setFilterCategory(null); }}
              className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg">
              <Icon size={20} color={active ? C.navy : C.inkSoft} strokeWidth={active ? 2.4 : 2} />
              <span className="text-[10px] font-medium" style={{ color: active ? C.navy : C.inkSoft }}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
