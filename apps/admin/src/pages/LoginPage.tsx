import { useState, type FormEvent } from 'react';
import { FiShield, FiLoader } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 text-white mb-3">
            <FiShield size={28} />
          </div>
          <h1 className="text-2xl font-bold text-white">TableBooker Admin</h1>
          <p className="text-slate-400 text-sm mt-1">Platform administration console</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl p-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input className="tb-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="admin@tablebooker.ge" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input className="tb-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center justify-center disabled:opacity-60"
          >
            {loading ? <><FiLoader className="animate-spin mr-2" /> Signing in…</> : 'Sign In'}
          </button>
          <p className="text-xs text-slate-400 text-center pt-2">Demo: admin@tablebooker.ge / admin</p>
        </form>
      </div>
    </div>
  );
}
