import { useState } from 'react';
import { useData } from '../lib/data';
import { ALL_PERMISSIONS, type Permission, type User } from '../db/schema';
import { saveUser } from '../db/service';
import { fmtDate } from '../lib/format';
import { Field, Modal, Seg, run } from '../ui/kit';
import { Icon } from '../ui/Icon';

const PRESETS: Record<string, Permission[]> = {
  'بائع': ['view', 'invoice_create', 'invoice_approve', 'payment_create', 'customers'],
  'محاسب': ['view', 'invoice_create', 'invoice_approve', 'payment_create', 'payment_reverse', 'customers', 'reports', 'expenses', 'purchases'],
  'أمين مخزن': ['view', 'inventory', 'purchases'],
};

function UserForm({ user, onClose }: { user?: User; onClose: () => void }) {
  const [u, setU] = useState({
    id: user?.id,
    name: user?.name ?? '',
    username: user?.username ?? '',
    role: user?.role ?? ('staff' as User['role']),
    permissions: user?.permissions ?? (['view', 'invoice_create'] as Permission[]),
    active: user?.active ?? true,
    pin: '',
  });
  const toggle = (p: Permission) => setU({ ...u, permissions: u.permissions.includes(p) ? u.permissions.filter((x) => x !== p) : [...u.permissions, p] });
  const save = async () => {
    const ok = await run(() => saveUser(u), 'تم حفظ المستخدم');
    if (ok) onClose();
  };
  return (
    <Modal title={user ? 'تعديل مستخدم' : 'مستخدم جديد'} onClose={onClose} footer={<><button className="btn" onClick={onClose}>إلغاء</button><button className="btn primary" onClick={save}>حفظ</button></>}>
      <div className="stack">
        <div className="grid grid-2">
          <Field label="الاسم *"><input className="input" value={u.name} onChange={(e) => setU({ ...u, name: e.target.value })} /></Field>
          <Field label="اسم الدخول (بالإنجليزي) *"><input className="input" dir="ltr" value={u.username} onChange={(e) => setU({ ...u, username: e.target.value })} /></Field>
          <Field label={user ? 'رمز سري جديد (اتركه فارغًا لعدم التغيير)' : 'الرمز السري (4 أرقام أو أكثر) *'}>
            <input className="input" type="password" inputMode="numeric" value={u.pin} onChange={(e) => setU({ ...u, pin: e.target.value.replace(/\D/g, '') })} />
          </Field>
          <Field label="الدور">
            <Seg value={u.role} onChange={(role) => setU({ ...u, role })} options={[{ key: 'staff', label: 'موظف' }, { key: 'admin', label: 'مدير (كل الصلاحيات)' }]} />
          </Field>
        </div>
        <label className="check"><input type="checkbox" checked={u.active} onChange={(e) => setU({ ...u, active: e.target.checked })} /> الحساب نشط</label>
        {u.role === 'staff' && (
          <>
            <div className="row">
              <span className="small bold">قوالب جاهزة:</span>
              {Object.entries(PRESETS).map(([k, v]) => <button key={k} className="btn sm" onClick={() => setU({ ...u, permissions: v })}>{k}</button>)}
            </div>
            <div className="grid grid-2">
              {ALL_PERMISSIONS.map((p) => (
                <label key={p.key} className="check"><input type="checkbox" checked={u.permissions.includes(p.key)} onChange={() => toggle(p.key)} /> {p.label}</label>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export default function Users() {
  const d = useData();
  const [edit, setEdit] = useState<User | null | 'new'>(null);
  return (
    <div className="stack">
      <div className="toolbar">
        <span className="spacer" />
        <button className="btn primary" onClick={() => setEdit('new')}><Icon name="plus" /> مستخدم جديد</button>
      </div>
      <div className="list">
        {d.users.map((u) => (
          <div key={u.id} className="list-item" onClick={() => setEdit(u)}>
            <div className="avatar"><Icon name={u.role === 'admin' ? 'shield' : 'user'} /></div>
            <div className="main-col">
              <div className="title">{u.name} {!u.active && <span className="badge muted">موقوف</span>}</div>
              <div className="meta" dir="auto">{u.username} · {u.role === 'admin' ? 'مدير' : `${u.permissions.length} صلاحية`} · منذ {fmtDate(u.createdAt)}</div>
            </div>
            <Icon name="edit" />
          </div>
        ))}
      </div>
      <p className="small muted">كل عملية في النظام تُسجَّل باسم المستخدم الذي نفذها مع التاريخ والوقت (انظر سجل العمليات).</p>
      {edit && <UserForm user={edit === 'new' ? undefined : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
