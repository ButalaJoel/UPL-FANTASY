import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LogoMark } from '../../components/brand';
import { ErrorBox, Field } from '../../components/ui';
import { useAuth, type Me } from '../../hooks/auth';
import { api } from '../../lib/api';

function AuthCard({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md pt-4 md:pt-10">
      <div className="card overflow-hidden">
        <div className="pitch-bg flex items-center gap-3 px-6 py-6 text-white">
          <LogoMark className="h-10 w-10" />
          <div>
            <h1 className="font-display text-xl font-bold">{title}</h1>
            <p className="text-sm text-white/70">{subtitle}</p>
          </div>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ token: string; user: Me }>('/auth/login', { body: { email, password } });
      signIn(r.token, r.user);
      nav(params.get('next') ?? (r.user.canAccessOps ? '/ops' : '/my-team'), { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthCard title="Welcome back" subtitle="Sign in to manage your squad">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password">
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <ErrorBox error={error} />
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="flex justify-between text-sm">
          <Link to="/forgot-password" className="text-pitch hover:underline">
            Forgot password?
          </Link>
          <Link to="/register" className="font-semibold text-pitch hover:underline">
            Create account
          </Link>
        </div>
      </form>
      <details className="mt-6 rounded-xl bg-paper p-3 text-xs text-ink/60">
        <summary className="cursor-pointer font-semibold">Demo accounts (password kiwanja123)</summary>
        <ul className="mt-2 space-y-1 font-mono">
          {['fan@kiwanja.test', 'admin@kiwanja.test', 'competition@kiwanja.test', 'supervisor@kiwanja.test', 'analyst.a@kiwanja.test', 'analyst.b@kiwanja.test'].map((e) => (
            <li key={e}>
              <button type="button" className="hover:text-pitch" onClick={() => { setEmail(e); setPassword('kiwanja123'); }}>
                {e}
              </button>
            </li>
          ))}
        </ul>
      </details>
    </AuthCard>
  );
}

export function RegisterPage() {
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ token: string; user: Me }>('/auth/register', { body: form });
      signIn(r.token, r.user);
      nav('/create-team', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthCard title="Join Kiwanja" subtitle="Pick 15 players. Beat your friends.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Your name">
          <input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required minLength={2} />
        </Field>
        <Field label="Email">
          <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <input className="input" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
        </Field>
        <ErrorBox error={error} />
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <p className="text-center text-sm">
          Already registered?{' '}
          <Link to="/login" className="font-semibold text-pitch">
            Sign in
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}

export function ForgotPage() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState<{ message: string; devResetUrl?: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  return (
    <AuthCard title="Reset password" subtitle="We'll send you a reset link">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          try {
            setResult(await api('/auth/forgot-password', { body: { email } }));
          } catch (err) {
            setError(err);
          }
        }}
      >
        <Field label="Email">
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <ErrorBox error={error} />
        <button className="btn-primary w-full">Send reset link</button>
        {result && (
          <div className="rounded-xl bg-pitch-50 p-3 text-sm text-pitch-700">
            {result.message}
            {result.devResetUrl && (
              <div className="mt-2 text-xs">
                Development mode (no email service configured):{' '}
                <a className="font-semibold underline" href={result.devResetUrl}>
                  open reset link
                </a>
              </div>
            )}
          </div>
        )}
      </form>
    </AuthCard>
  );
}

export function ResetPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState(false);
  return (
    <AuthCard title="Choose a new password" subtitle="Then sign in again">
      {done ? (
        <div className="space-y-4">
          <p className="text-sm">Password updated.</p>
          <button className="btn-primary w-full" onClick={() => nav('/login')}>
            Sign in
          </button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            try {
              await api('/auth/reset-password', { body: { token: params.get('token') ?? '', password } });
              setDone(true);
            } catch (err) {
              setError(err);
            }
          }}
        >
          <Field label="New password">
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          </Field>
          <ErrorBox error={error} />
          <button className="btn-primary w-full">Update password</button>
        </form>
      )}
    </AuthCard>
  );
}
