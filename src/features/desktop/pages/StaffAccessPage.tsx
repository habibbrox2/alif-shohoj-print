import React, { useEffect, useState, type FC } from 'react';
import { useI18n } from '../../../shared/i18n/I18nContext';
import { useStudio } from '../../../shared/context/StudioContext';

interface StaffUser {
  id: string;
  role: 'owner' | 'manager' | 'operator';
  enabled: boolean;
  createdAt: number;
}

interface StaffSession {
  id: string;
  userId: string;
  role: 'owner' | 'manager' | 'operator';
  expiresAt: number;
}

const ROLES: readonly ('owner' | 'manager' | 'operator')[] = ['owner', 'manager', 'operator'];

export const StaffAccessPage: FC = () => {
  const { t } = useI18n();
  const { isMaster } = useStudio();
  const desktop = window.alifShohojPrintDesktop;
  const [bootstrapped, setBootstrapped] = useState<boolean | null>(null);
  const [pin, setPin] = useState('');
  const [session, setSession] = useState<StaffSession | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [newPin, setNewPin] = useState('');
  const [newRole, setNewRole] = useState<'manager' | 'operator'>('operator');
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (!desktop || !session) return;
    try {
      const list = await desktop.listStaff(session.id);
      setUsers(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    if (!desktop) return;
    desktop.getStaffBootstrapStatus().then(s => setBootstrapped(s.bootstrapped)).catch(() => setBootstrapped(null));
  }, [desktop]);

  useEffect(() => { void refresh(); }, [session, desktop]);

  const doBootstrap = async () => {
    if (!desktop || !pin) return;
    try {
      await desktop.bootstrapOwner(pin);
      setBootstrapped(true);
      setPin('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const doLogin = async () => {
    if (!desktop || !pin) return;
    try {
      const s = await desktop.loginStaff(pin);
      setSession(s);
      setPin('');
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const doLogout = () => { if (session) { desktop?.logoutStaff(session.id); setSession(null); setUsers([]); } };

  const doCreate = async () => {
    if (!desktop || !session || !newPin) return;
    try {
      await desktop.createStaff(session.id, newPin, newRole);
      setNewPin('');
      void refresh();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const doSetRole = async (userId: string, role: 'owner' | 'manager' | 'operator') => {
    if (!desktop || !session) return;
    try { await desktop.setStaffRole(session.id, userId, role); void refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  const doSetEnabled = async (userId: string, enabled: boolean) => {
    if (!desktop || !session) return;
    try { await desktop.setStaffEnabled(session.id, userId, enabled); void refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  };

  if (!isMaster) return <p className="p-4 text-xs text-text-secondary">{t('settings.masterOnly')}</p>;
  if (!desktop) return <p className="p-4 text-xs text-text-secondary">{t('settings.desktopOnlyUnavailable')}</p>;

  if (bootstrapped === null) return <p className="p-4 text-xs text-text-secondary">Loading…</p>;

  if (!bootstrapped) {
    return (
      <div className="mx-auto max-w-md p-5">
        <h2 className="mb-3 text-sm font-bold text-text-primary">First-run Owner setup</h2>
        <p className="mb-3 text-xs text-text-secondary">Set a 4–12 digit PIN to bootstrap the first Owner account.</p>
        <input type="password" inputMode="numeric" maxLength={12} value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
          className="w-full rounded-md border border-border-primary bg-bg-primary px-2 py-1.5 text-xs text-text-primary" />
        <button onClick={doBootstrap} className="mt-2 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-on-brand">Bootstrap Owner</button>
        {error && <p className="mt-2 text-xs text-error">{error}</p>}
      </div>
    );
  }

  if (!session) {
    return (
      <div className="mx-auto max-w-md p-5">
        <h2 className="mb-3 text-sm font-bold text-text-primary">Staff login</h2>
        <input type="password" inputMode="numeric" maxLength={12} value={pin}
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
          className="w-full rounded-md border border-border-primary bg-bg-primary px-2 py-1.5 text-xs text-text-primary" />
        <button onClick={doLogin} className="mt-2 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-on-brand">Login</button>
        {error && <p className="mt-2 text-xs text-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-text-primary">Staff accounts</h2>
        <button onClick={doLogout} className="text-xs text-text-secondary hover:text-error">Logout</button>
      </div>
      {error && <p className="mb-3 text-xs text-error">{error}</p>}
      <div className="mb-4 flex items-center gap-2">
        <input type="password" inputMode="numeric" maxLength={12} placeholder="New PIN"
          value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 12))}
          className="w-28 rounded-md border border-border-primary bg-bg-primary px-2 py-1.5 text-xs text-text-primary" />
        <select value={newRole} onChange={e => setNewRole(e.target.value as 'manager' | 'operator')}
          className="rounded-md border border-border-primary bg-bg-primary px-2 py-1.5 text-xs text-text-primary">
          <option value="manager">Manager</option>
          <option value="operator">Operator</option>
        </select>
        <button onClick={doCreate} className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-on-brand">Add</button>
      </div>
      <ul className="space-y-2">
        {users.map(user => (
          <li key={user.id} className="flex items-center justify-between rounded-md border border-border-primary px-3 py-2">
            <span className="text-xs text-text-primary">{user.role} · {user.enabled ? 'active' : 'disabled'}</span>
            <span className="flex items-center gap-1">
              {ROLES.map(role => (
                <button key={role} onClick={() => doSetRole(user.id, role)}
                  className={`rounded px-2 py-0.5 text-[10px] ${user.role === role ? 'bg-brand text-on-brand' : 'bg-bg-secondary text-text-secondary'}`}>
                  {role}
                </button>
              ))}
              <button onClick={() => doSetEnabled(user.id, !user.enabled)}
                className="rounded border border-border-primary px-2 py-0.5 text-[10px] text-text-secondary">
                {user.enabled ? 'Disable' : 'Enable'}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};