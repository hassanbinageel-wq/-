import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { db, type Permission, type User } from './db/schema';
import { can, ensureSeed, exportAll, getSessionUser, hashPin, login, saveSettings, setSessionUser } from './db/service';
import { DataProvider, useData } from './lib/data';
import { applyTheme } from './lib/theme';
import { configureFormat } from './lib/format';
import { isNative, writeInternalBackup } from './lib/platform';
import { Icon } from './ui/Icon';
import { Dialogs, NavContext, Toaster, hashToRoute, routeToHash, toast, type Route } from './ui/kit';
import Dashboard from './pages/Dashboard';
import Invoices from './pages/Invoices';
import InvoiceEditor from './pages/InvoiceEditor';
import InvoiceView from './pages/InvoiceView';
import Customers from './pages/Customers';
import CustomerView from './pages/CustomerView';
import Payments from './pages/Payments';
import Debts from './pages/Debts';
import Products from './pages/Products';
import ProductView from './pages/ProductView';
import Purchases from './pages/Purchases';
import SupplierView from './pages/SupplierView';
import Returns from './pages/Returns';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import SettingsPage from './pages/Settings';
import Users from './pages/Users';
import Audit from './pages/Audit';
import Search from './pages/Search';

interface NavDef {
  name: string;
  label: string;
  icon: string;
  perm?: Permission;
}
const NAV: NavDef[] = [
  { name: 'dashboard', label: 'لوحة التحكم', icon: 'home' },
  { name: 'invoices', label: 'الفواتير', icon: 'invoice' },
  { name: 'customers', label: 'العملاء', icon: 'users' },
  { name: 'payments', label: 'الدفعات والتحصيل', icon: 'wallet' },
  { name: 'debts', label: 'المديونيات', icon: 'debt' },
  { name: 'products', label: 'الأقمشة والمخزون', icon: 'box' },
  { name: 'purchases', label: 'المشتريات والموردون', icon: 'truck', perm: 'purchases' },
  { name: 'returns', label: 'المرتجعات', icon: 'return' },
  { name: 'expenses', label: 'المصروفات والصندوق', icon: 'cash', perm: 'expenses' },
  { name: 'reports', label: 'التقارير', icon: 'bars', perm: 'reports' },
  { name: 'settings', label: 'الإعدادات والنسخ', icon: 'settings', perm: 'settings' },
  { name: 'users', label: 'المستخدمون والصلاحيات', icon: 'shield', perm: 'users' },
  { name: 'audit', label: 'سجل العمليات', icon: 'history', perm: 'users' },
];

const TITLES: Record<string, string> = {
  ...Object.fromEntries(NAV.map((n) => [n.name, n.label])),
  'invoice-new': 'فاتورة جديدة',
  'invoice-edit': 'تعديل فاتورة',
  invoice: 'تفاصيل الفاتورة',
  customer: 'ملف العميل',
  product: 'بطاقة الصنف',
  supplier: 'حساب المورد',
  search: 'بحث شامل',
};

export default function App() {
  const [booted, setBooted] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      await ensureSeed();
      const s = await db.settings.get(1);
      if (s) {
        configureFormat(s);
        applyTheme(s);
      }
      setBooted(true);
    })().catch((e) => {
      console.error(e);
      toast.error('تعذر فتح قاعدة البيانات: ' + e.message);
    });
  }, []);

  if (!booted) return <div className="login-wrap"><div className="muted">جارٍ التحميل…</div></div>;
  return (
    <DataProvider>
      <ThemeSync />
      {user ? <Shell user={user} onLogout={() => { setSessionUser(null); setUser(null); }} /> : <Login onLogin={setUser} />}
      <Toaster />
      <Dialogs />
    </DataProvider>
  );
}

function ThemeSync() {
  const { settings, ready } = useData();
  const [, force] = useState(0);
  useEffect(() => {
    if (!ready) return;
    configureFormat(settings);
    const dark = applyTheme(settings, () => force((x) => x + 1));
    if (isNative()) {
      StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {});
      StatusBar.setBackgroundColor({ color: dark ? '#151c22' : '#ffffff' }).catch(() => {});
    }
  }, [settings, ready]);
  return null;
}

function Login({ onLogin }: { onLogin: (u: User) => void }) {
  const { users, settings } = useData();
  const active = users.filter((u) => u.active);
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [defaultHint, setDefaultHint] = useState(false);

  useEffect(() => {
    if (!username && active.length) setUsername(active[0].username);
  }, [active.length]);
  useEffect(() => {
    hashPin('1234').then((h) => setDefaultHint(users.some((u) => u.username === 'admin' && u.pinHash === h)));
  }, [users]);

  const submit = async (p = pin) => {
    try {
      const u = await login(username, p);
      onLogin(u);
    } catch (e: any) {
      toast.error(e);
      setPin('');
    }
  };
  const press = (k: string) => {
    if (k === 'del') return setPin((p) => p.slice(0, -1));
    if (k === 'ok') return submit();
    const next = (pin + k).slice(0, 8);
    setPin(next);
  };

  return (
    <div className="login-wrap">
      <div className="card login-card stack">
        <div style={{ textAlign: 'center' }}>
          {settings.logo ? (
            <img src={settings.logo} style={{ width: 76, height: 76, borderRadius: 18, objectFit: 'contain' }} />
          ) : (
            <div className="logo-ph" style={{ width: 70, height: 70, borderRadius: 20, margin: '0 auto', fontSize: 30 }}>
              {settings.shopName.trim()[0]}
            </div>
          )}
          <h2 style={{ marginTop: 8 }}>{settings.shopName}</h2>
          <div className="muted small">نظام إدارة تجارة الأقمشة بالجملة</div>
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          {active.map((u) => (
            <button key={u.id} className={`btn sm ${u.username === username ? 'primary' : ''}`} onClick={() => { setUsername(u.username); setPin(''); }}>
              <Icon name="user" /> {u.name}
            </button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <input
            className="input num"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            aria-label="الرمز السري"
            placeholder="الرمز السري"
            style={{ textAlign: 'center', letterSpacing: 6, fontSize: 20 }}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
          />
        </form>
        <div className="keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map((k) => (
            <button key={k} type="button" onClick={() => press(k)} style={k === 'ok' ? { background: 'var(--primary)', color: 'var(--on-primary)' } : undefined}>
              {k === 'del' ? '⌫' : k === 'ok' ? '✓' : k}
            </button>
          ))}
        </div>
        {defaultHint && (
          <div className="alert info">
            <Icon name="info" />
            <span>أول دخول: المستخدم «المدير» والرمز <b className="num">1234</b> — غيّره من الإعدادات بعد الدخول.</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Shell({ user, onLogout }: { user: User; onLogout: () => void }) {
  const data = useData();
  const { settings } = data;
  const [route, setRoute] = useState<Route>(() => hashToRoute(location.hash));
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    const h = () => {
      setRoute(hashToRoute(location.hash));
      setDrawer(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);

  // زر الرجوع في أندرويد
  useEffect(() => {
    if (!isNative()) return;
    const sub = CapApp.addListener('backButton', () => {
      if (Number(document.body.dataset.modal || 0) > 0) {
        window.dispatchEvent(new Event('app:back'));
        return;
      }
      if (hashToRoute(location.hash).name !== 'dashboard') history.back();
      else CapApp.minimizeApp();
    });
    return () => {
      sub.then((s) => s.remove());
    };
  }, []);

  // نسخة احتياطية تلقائية يومية داخل ذاكرة الجهاز
  useEffect(() => {
    if (!data.ready || !settings.autoBackup) return;
    if (Date.now() - (settings.lastAutoBackup || 0) < 20 * 3600 * 1000) return;
    (async () => {
      const dump = await exportAll();
      await writeInternalBackup(JSON.stringify(dump));
      await saveSettings({ lastAutoBackup: Date.now() }, true);
    })().catch((e) => console.warn('auto backup failed', e));
  }, [data.ready]);

  const go = useCallback((r: Route | string) => {
    const target = typeof r === 'string' ? { name: r } : r;
    const h = routeToHash(target);
    if (location.hash === h) setRoute(target);
    else location.hash = h;
  }, []);
  const back = useCallback(() => history.back(), []);
  const nav = useMemo(() => ({ go, back, route }), [go, back, route]);

  const allowed = NAV.filter((n) => !n.perm || can(n.perm, getSessionUser() ?? user));
  const isTop = NAV.some((n) => n.name === route.name);

  const navList = (
    <>
      <div className="brand">
        {settings.logo ? <img src={settings.logo} alt="" /> : <div className="logo-ph">{settings.shopName.trim()[0]}</div>}
        <div style={{ minWidth: 0 }}>
          <b>{settings.shopName}</b>
          <small>{user.name}</small>
        </div>
      </div>
      {allowed.map((n) => (
        <button key={n.name} className={`nav-item ${route.name === n.name ? 'active' : ''}`} onClick={() => go(n.name)}>
          <Icon name={n.icon} /> {n.label}
        </button>
      ))}
      <div className="nav-sep" />
      <button className="nav-item" onClick={() => saveSettings({ themeMode: isDarkNow() ? 'light' : 'dark' }, true)}>
        <Icon name={isDarkNow() ? 'sun' : 'moon'} /> {isDarkNow() ? 'الوضع الفاتح' : 'الوضع الداكن'}
      </button>
      <button className="nav-item" onClick={onLogout}>
        <Icon name="logout" /> تسجيل الخروج
      </button>
    </>
  );

  return (
    <NavContext.Provider value={nav}>
      <div className="app">
        <aside className="sidebar">{navList}</aside>
        <div className="main">
          <header className="topbar">
            {isTop ? (
              <button className="icon-btn menu-btn" onClick={() => setDrawer(true)} aria-label="القائمة">
                <Icon name="menu" />
              </button>
            ) : (
              <button className="icon-btn" onClick={back} aria-label="رجوع">
                <Icon name="back" />
              </button>
            )}
            <h1>{TITLES[route.name] ?? settings.shopName}</h1>
            <button className="icon-btn" onClick={() => go('search')} aria-label="بحث">
              <Icon name="search" />
            </button>
            <button className="icon-btn" onClick={() => saveSettings({ themeMode: isDarkNow() ? 'light' : 'dark' }, true)} aria-label="تبديل الوضع">
              <Icon name={isDarkNow() ? 'sun' : 'moon'} />
            </button>
          </header>
          <main className="content">
            <Page route={route} />
          </main>
        </div>
        <nav className="bottom-nav">
          <BottomBtn icon="home" label="الرئيسية" on={route.name === 'dashboard'} onClick={() => go('dashboard')} />
          <BottomBtn icon="invoice" label="الفواتير" on={route.name === 'invoices'} onClick={() => go('invoices')} />
          {can('invoice_create', user) ? (
            <button className="fab-slot" onClick={() => go('invoice-new')} aria-label="فاتورة جديدة">
              <span className="fab"><Icon name="plus" /></span>
            </button>
          ) : (
            <BottomBtn icon="wallet" label="الدفعات" on={route.name === 'payments'} onClick={() => go('payments')} />
          )}
          <BottomBtn icon="users" label="العملاء" on={route.name === 'customers'} onClick={() => go('customers')} />
          <BottomBtn icon="menu" label="المزيد" on={drawer} onClick={() => setDrawer(true)} />
        </nav>
        {drawer && (
          <>
            <div className="drawer-backdrop" onClick={() => setDrawer(false)} />
            <aside className="drawer">{navList}</aside>
          </>
        )}
      </div>
    </NavContext.Provider>
  );
}

const isDarkNow = () => document.documentElement.dataset.theme === 'dark';

function BottomBtn({ icon, label, on, onClick }: { icon: string; label: string; on: boolean; onClick: () => void }) {
  return (
    <button className={on ? 'active' : ''} onClick={onClick}>
      <Icon name={icon} />
      {label}
    </button>
  );
}

function Page({ route }: { route: Route }): ReactNode {
  switch (route.name) {
    case 'invoices':
      return <Invoices />;
    case 'invoice-new':
      return <InvoiceEditor key={'new' + (route.params?.customer ?? '') + (route.params?.from ?? '')} />;
    case 'invoice-edit':
      return <InvoiceEditor key={'edit' + route.id} id={route.id} />;
    case 'invoice':
      return <InvoiceView key={route.id} id={route.id!} />;
    case 'customers':
      return <Customers />;
    case 'customer':
      return <CustomerView key={route.id} id={route.id!} />;
    case 'payments':
      return <Payments />;
    case 'debts':
      return <Debts />;
    case 'products':
      return <Products />;
    case 'product':
      return <ProductView key={route.id} id={route.id!} />;
    case 'purchases':
      return <Purchases />;
    case 'supplier':
      return <SupplierView key={route.id} id={route.id!} />;
    case 'returns':
      return <Returns />;
    case 'expenses':
      return <Expenses />;
    case 'reports':
      return <Reports />;
    case 'settings':
      return <SettingsPage />;
    case 'users':
      return <Users />;
    case 'audit':
      return <Audit />;
    case 'search':
      return <Search />;
    default:
      return <Dashboard />;
  }
}
