'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signupCustomer } from './actions';

export default function CadastroClientePage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signupCustomer({ email, password, phone: phone || undefined });
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar');
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-mendu-bg px-5">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-mendu-border bg-white p-6 shadow-sm"
      >
        <h1 className="font-brand text-2xl font-bold text-mendu-ink">Criar conta</h1>
        <label className="flex flex-col gap-1 text-sm font-semibold text-mendu-ink">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-xl border border-mendu-border px-3 py-2.5 text-sm font-normal outline-none focus:border-mendu-red"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-mendu-ink">
          Senha
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="rounded-xl border border-mendu-border px-3 py-2.5 text-sm font-normal outline-none focus:border-mendu-red"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-mendu-ink">
          Telefone (opcional)
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-xl border border-mendu-border px-3 py-2.5 text-sm font-normal outline-none focus:border-mendu-red"
          />
        </label>
        {error && <p className="text-sm font-semibold text-mendu-red">{error}</p>}
        <button
          type="submit"
          className="mt-2 rounded-xl bg-mendu-red py-3 text-sm font-bold text-white transition hover:bg-mendu-reddark"
        >
          Criar conta
        </button>
      </form>
    </div>
  );
}
