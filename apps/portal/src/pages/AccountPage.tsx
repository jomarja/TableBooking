import { useState } from 'react';
import { FiSave } from 'react-icons/fi';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function AccountPage() {
  const { staff, refresh } = useAuth();
  const [name, setName] = useState(staff?.name || '');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSaved, setPwSaved] = useState(false);

  const saveName = async () => {
    if (!name.trim()) return;
    setSavingName(true);
    setNameSaved(false);
    try {
      await api.updateProfile(name.trim());
      await refresh();
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
    } finally {
      setSavingName(false);
    }
  };

  const savePassword = async () => {
    setPwError('');
    setPwSaved(false);
    if (next.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (next !== repeat) {
      setPwError('New password and repeat do not match.');
      return;
    }
    setSavingPw(true);
    try {
      await api.changePassword(current, next);
      setCurrent('');
      setNext('');
      setRepeat('');
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 3000);
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Could not change password.');
    } finally {
      setSavingPw(false);
    }
  };

  const labelCls = 'text-xs font-medium text-slate-600 mb-1 block';
  const btnCls =
    'flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60';

  return (
    <div className="space-y-6 max-w-xl">
      <h2 className="text-2xl font-bold text-slate-800">Your account</h2>

      {/* Profile */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-semibold text-slate-700">Profile</h3>
        <label className="block">
          <span className={labelCls}>Display name</span>
          <input className="tb-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelCls}>Email</span>
          <input className="tb-input bg-slate-50 text-slate-400" value={staff?.email || ''} disabled />
        </label>
        <div className="flex items-center gap-3">
          <button onClick={saveName} disabled={savingName || !name.trim()} className={btnCls}>
            <FiSave /> {savingName ? 'Saving…' : 'Save'}
          </button>
          {nameSaved && <span className="text-sm text-emerald-600 font-medium">Saved!</span>}
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <h3 className="font-semibold text-slate-700">Change password</h3>
        <label className="block">
          <span className={labelCls}>Current password</span>
          <input type="password" className="tb-input" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </label>
        <label className="block">
          <span className={labelCls}>New password</span>
          <input type="password" className="tb-input" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </label>
        <label className="block">
          <span className={labelCls}>Repeat new password</span>
          <input type="password" className="tb-input" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" />
        </label>
        {pwError && <p className="text-sm text-red-500">{pwError}</p>}
        <div className="flex items-center gap-3">
          <button onClick={savePassword} disabled={savingPw || !current || !next} className={btnCls}>
            <FiSave /> {savingPw ? 'Saving…' : 'Update password'}
          </button>
          {pwSaved && <span className="text-sm text-emerald-600 font-medium">Password updated!</span>}
        </div>
      </div>
    </div>
  );
}
