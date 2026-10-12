import { useEffect, useState } from 'react';
import { useData } from '../lib/data';
import type { Settings } from '../db/schema';
import { changeOwnPin, exportAll, importAll, saveSettings, wipeAll, getSessionUser } from '../db/service';
import { PRESET_COLORS } from '../lib/theme';
import { fmtDateTime, fmtMoney, toInputDate } from '../lib/format';
import { imageToDataUrl, isNative, listInternalBackups, pickFile, shareFile } from '../lib/platform';
import { Field, NumInput, Seg, confirmDialog, promptDialog, run, toast } from '../ui/kit';
import { Icon } from '../ui/Icon';

function ListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  const [v, setV] = useState('');
  return (
    <div className="field">
      <span>{label}</span>
      <div className="row">
        {items.map((x) => (
          <span key={x} className="badge info" style={{ fontSize: 13 }}>
            {x}
            <button className="icon-btn" style={{ width: 20, height: 20 }} onClick={() => onChange(items.filter((i) => i !== x))} aria-label={`حذف ${x}`}>
              <Icon name="close" size={14} />
            </button>
          </span>
        ))}
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); if (v.trim() && !items.includes(v.trim())) onChange([...items, v.trim()]); setV(''); }}>
        <input className="input" style={{ flex: 1 }} value={v} onChange={(e) => setV(e.target.value)} placeholder="إضافة…" />
        <button className="btn sm" type="submit"><Icon name="plus" /></button>
      </form>
    </div>
  );
}

function ColorPick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="row">
      <div className="swatches">
        {PRESET_COLORS.map((c) => (
          <button key={c} className={c === value ? 'on' : ''} style={{ background: c }} onClick={() => onChange(c)} aria-label={c} />
        ))}
      </div>
      <input type="color" className="input" style={{ width: 60 }} value={value} onChange={(e) => onChange(e.target.value)} aria-label="لون مخصص" />
    </div>
  );
}

export default function SettingsPage() {
  const d = useData();
  const [s, setS] = useState<Settings>(d.settings);
  const [dirty, setDirty] = useState(false);
  const [backups, setBackups] = useState<{ name: string; read: () => Promise<string> }[]>([]);
  const [pins, setPins] = useState({ old: '', next: '' });

  useEffect(() => {
    if (!dirty) setS(d.settings);
  }, [d.settings]);
  useEffect(() => {
    listInternalBackups().then(setBackups);
  }, [d.settings.lastAutoBackup]);

  const set = (p: Partial<Settings>) => {
    setS((x) => ({ ...x, ...p }));
    setDirty(true);
  };
  // تُطبَّق تغييرات المظهر فورًا
  const setLive = (p: Partial<Settings>) => {
    setS((x) => ({ ...x, ...p }));
    saveSettings(p, true);
  };
  const save = async () => {
    const ok = await run(() => saveSettings(s), 'تم حفظ الإعدادات');
    if (ok !== undefined) setDirty(false);
  };

  const doExport = () =>
    run(async () => {
      const data = await exportAll();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const r = await shareFile(blob, `نسخة-احتياطية-${s.shopName}-${toInputDate()}.json`, 'نسخة احتياطية');
      if (r === 'downloaded') toast.ok('تم حفظ النسخة الاحتياطية');
    });

  const restoreText = async (text: string, name: string) => {
    let data: any;
    try {
      data = JSON.parse(text);
    } catch {
      return toast.error('الملف تالف أو ليس نسخة احتياطية');
    }
    const counts = data?.tables ? `الفواتير: ${data.tables.invoices?.length ?? 0} — العملاء: ${data.tables.customers?.length ?? 0} — الأصناف: ${data.tables.products?.length ?? 0}` : '';
    const ok = await confirmDialog(
      'استعادة نسخة احتياطية',
      `سيتم استبدال كل البيانات الحالية ببيانات النسخة «${name}».\n${counts}\n\nننصح بتصدير نسخة من البيانات الحالية أولًا. هل تريد المتابعة؟`,
      { danger: true, ok: 'استعادة' },
    );
    if (!ok) return;
    const res = await run(() => importAll(data), 'تمت استعادة البيانات');
    if (res !== undefined) setTimeout(() => location.reload(), 800);
  };

  const doImport = async () => {
    const f = await pickFile('.json,application/json');
    if (!f) return;
    await restoreText(await f.text(), f.name);
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-title"><h3>بيانات المتجر</h3></div>
        <div className="row" style={{ marginBottom: 12 }}>
          {s.logo ? <img src={s.logo} style={{ width: 72, height: 72, objectFit: 'contain', borderRadius: 14, border: '1px solid var(--border)' }} /> : <div className="logo-ph" style={{ width: 72, height: 72, borderRadius: 14, fontSize: 28 }}>{s.shopName.trim()[0]}</div>}
          <button className="btn" onClick={async () => { const f = await pickFile('image/*'); if (f) set({ logo: await imageToDataUrl(f) }); }}><Icon name="upload" /> {s.logo ? 'تغيير الشعار' : 'رفع شعار'}</button>
          {s.logo && <button className="btn ghost" onClick={() => set({ logo: '' })}>إزالة</button>}
        </div>
        <div className="grid grid-2">
          <Field label="اسم المحل"><input className="input" value={s.shopName} onChange={(e) => set({ shopName: e.target.value })} /></Field>
          <Field label="النشاط"><input className="input" value={s.activity} onChange={(e) => set({ activity: e.target.value })} /></Field>
          <Field label="الهاتف"><input className="input" value={s.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
          <Field label="هاتف آخر"><input className="input" value={s.phone2} onChange={(e) => set({ phone2: e.target.value })} /></Field>
          <Field label="العنوان التجاري"><input className="input" value={s.address} onChange={(e) => set({ address: e.target.value })} /></Field>
          <Field label="الرقم الضريبي / السجل التجاري"><input className="input" value={s.taxNo} onChange={(e) => set({ taxNo: e.target.value })} /></Field>
        </div>
        <Field label="تذييل الفاتورة" className="section"><textarea className="input" value={s.invoiceFooter} onChange={(e) => set({ invoiceFooter: e.target.value })} /></Field>
      </div>

      <div className="card stack">
        <div className="card-title"><h3>المظهر والألوان</h3></div>
        <Field label="الوضع">
          <Seg value={s.themeMode} onChange={(v) => setLive({ themeMode: v })} options={[{ key: 'system', label: 'حسب النظام' }, { key: 'light', label: 'فاتح' }, { key: 'dark', label: 'داكن' }]} />
        </Field>
        <Field label="لون التطبيق"><ColorPick value={s.primaryColor} onChange={(c) => setLive({ primaryColor: c })} /></Field>
        <Field label="اللون الرئيسي للفواتير"><ColorPick value={s.invoiceColor} onChange={(c) => set({ invoiceColor: c })} /></Field>
        <Field label="لون التمييز في الفواتير (إجمالي المستحق)"><ColorPick value={s.invoiceAccent} onChange={(c) => set({ invoiceAccent: c })} /></Field>
        <div className="row small">
          <span style={{ background: s.invoiceColor, color: '#fff', padding: '4px 12px', borderRadius: 8 }}>عنوان الفاتورة</span>
          <span style={{ background: s.invoiceAccent, color: '#fff', padding: '4px 12px', borderRadius: 8 }}>إجمالي المستحق</span>
        </div>
      </div>

      <div className="card">
        <div className="card-title"><h3>العملة والتنسيق والترقيم</h3></div>
        <div className="grid grid-3">
          <Field label="رمز العملة"><input className="input" value={s.currency} onChange={(e) => set({ currency: e.target.value })} /></Field>
          <Field label="شكل الأرقام">
            <select className="input" value={s.numberFormat} onChange={(e) => set({ numberFormat: e.target.value as any })}>
              <option value="latin">1,234,567</option>
              <option value="arabic">١٬٢٣٤٬٥٦٧</option>
            </select>
          </Field>
          <Field label="تنسيق التاريخ">
            <select className="input" value={s.dateFormat} onChange={(e) => set({ dateFormat: e.target.value as any })}>
              <option value="dmy">يوم/شهر/سنة</option>
              <option value="ymd">سنة/شهر/يوم</option>
            </select>
          </Field>
          <Field label="بادئة رقم الفاتورة"><input className="input" value={s.invoicePrefix} onChange={(e) => set({ invoicePrefix: e.target.value })} /></Field>
          <Field label="بادئة سند القبض"><input className="input" value={s.receiptPrefix} onChange={(e) => set({ receiptPrefix: e.target.value })} /></Field>
          <Field label="بادئة فاتورة الشراء"><input className="input" value={s.purchasePrefix} onChange={(e) => set({ purchasePrefix: e.target.value })} /></Field>
          <Field label="بادئة المرتجع"><input className="input" value={s.returnPrefix} onChange={(e) => set({ returnPrefix: e.target.value })} /></Field>
          <Field label="مدة الآجل الافتراضية (يوم)"><NumInput value={s.defaultDueDays} min={0} onChange={(v) => set({ defaultDueDays: v })} /></Field>
          <Field label="مقاس الطباعة الافتراضي">
            <select className="input" value={s.printSize} onChange={(e) => set({ printSize: e.target.value as any })}>
              <option value="a4">A4</option>
              <option value="thermal">حراري 80مم</option>
            </select>
          </Field>
        </div>
        <label className="check" style={{ marginTop: 12 }}>
          <input type="checkbox" checked={s.showPrevBalanceOnInvoice} onChange={(e) => set({ showPrevBalanceOnInvoice: e.target.checked })} />
          إظهار الرصيد السابق وإجمالي المستحق في الفاتورة المطبوعة
        </label>
        <div className="small muted" style={{ marginTop: 6 }}>مثال: {fmtMoney(1250000)}</div>
      </div>

      <div className="card stack">
        <div className="card-title"><h3>القوائم</h3></div>
        <ListEditor label="أنواع القماش" items={s.fabricTypes} onChange={(v) => set({ fabricTypes: v })} />
        <ListEditor label="وحدات البيع للأصناف غير المسجلة" items={s.units} onChange={(v) => set({ units: v })} />
        <ListEditor label="طرق الدفع / الحسابات" items={s.paymentMethods} onChange={(v) => set({ paymentMethods: v.length ? v : ['نقدًا'] })} />
        <ListEditor label="تصنيفات المصروفات" items={s.expenseCategories} onChange={(v) => set({ expenseCategories: v.length ? v : ['أخرى'] })} />
      </div>

      {dirty && (
        <div className="sticky-actions">
          <button className="btn" onClick={() => { setS(d.settings); setDirty(false); }}>تراجع</button>
          <button className="btn primary" onClick={save}><Icon name="check" /> حفظ الإعدادات</button>
        </div>
      )}

      <div className="card stack">
        <div className="card-title"><h3>النسخ الاحتياطي والاستعادة</h3></div>
        <div className="alert info">
          <Icon name="shield" />
          <span>
            البيانات محفوظة على هذا الجهاز. صدّر نسخة احتياطية بانتظام واحفظها في Google Drive أو أرسلها لنفسك عبر واتساب، حتى تستعيدها عند تغيير الجوال أو تعطله.
          </span>
        </div>
        <div className="row">
          <button className="btn primary" onClick={doExport}><Icon name="download" /> تصدير نسخة احتياطية</button>
          <button className="btn" onClick={doImport}><Icon name="upload" /> استيراد نسخة احتياطية</button>
        </div>
        <label className="check">
          <input type="checkbox" checked={s.autoBackup} onChange={(e) => setLive({ autoBackup: e.target.checked })} />
          نسخة احتياطية تلقائية يومية داخل الجهاز (آخر 7 نسخ)
        </label>
        <div className="small muted">آخر نسخة تلقائية: {d.settings.lastAutoBackup ? fmtDateTime(d.settings.lastAutoBackup) : 'لا يوجد'}</div>
        {backups.length > 0 && (
          <div className="list">
            {backups.map((b) => (
              <div key={b.name} className="list-item" style={{ cursor: 'default' }}>
                <Icon name="archive" />
                <div className="main-col"><div className="title">{b.name}</div></div>
                <button className="btn sm" onClick={async () => shareFile(new Blob([await b.read()], { type: 'application/json' }), b.name)}>حفظ نسخة</button>
                <button className="btn sm" onClick={async () => restoreText(await b.read(), b.name)}>استعادة</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card stack">
        <div className="card-title"><h3>حسابي ({getSessionUser()?.name})</h3></div>
        <div className="grid grid-3">
          <Field label="الرمز الحالي"><input className="input" type="password" inputMode="numeric" value={pins.old} onChange={(e) => setPins({ ...pins, old: e.target.value })} /></Field>
          <Field label="الرمز الجديد"><input className="input" type="password" inputMode="numeric" value={pins.next} onChange={(e) => setPins({ ...pins, next: e.target.value })} /></Field>
          <button className="btn" style={{ alignSelf: 'flex-end' }} onClick={async () => { if ((await run(() => changeOwnPin(pins.old, pins.next), 'تم تغيير الرمز السري')) !== undefined) setPins({ old: '', next: '' }); }}>
            تغيير الرمز
          </button>
        </div>
      </div>

      <div className="card stack">
        <div className="card-title"><h3 className="bad">منطقة الخطر</h3></div>
        <p className="small muted" style={{ margin: 0 }}>مسح كل الفواتير والعملاء والأصناف والحركات (مع الإبقاء على المستخدمين والإعدادات). استخدمه بعد انتهاء التجربة وقبل التشغيل الفعلي.</p>
        <button
          className="btn danger"
          onClick={async () => {
            const t = await promptDialog('مسح كل البيانات', 'هذا الإجراء لا يمكن التراجع عنه. صدّر نسخة احتياطية أولًا.\nاكتب كلمة «مسح» للتأكيد:');
            if (t?.trim() === 'مسح') await run(() => wipeAll(), 'تم مسح البيانات');
          }}
        >
          <Icon name="trash" /> مسح البيانات التجريبية
        </button>
        <div className="small muted">الإصدار {__APP_VERSION__} · {isNative() ? 'تطبيق أندرويد' : 'نسخة الويب'}</div>
      </div>
    </div>
  );
}
