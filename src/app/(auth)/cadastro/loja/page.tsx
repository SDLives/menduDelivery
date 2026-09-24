'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signupStore } from './actions';

export default function CadastroLojaPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: '',
    password: '',
    storeName: '',
    storeSlug: '',
    cep: '',
    rua: '',
    numero: '',
    complemento: '',
    bairro: '',
    municipio: '',
    uf: '',
  });
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await signupStore({
        email: form.email,
        password: form.password,
        storeName: form.storeName,
        storeSlug: form.storeSlug,
        address: {
          cep: form.cep,
          rua: form.rua,
          numero: form.numero,
          complemento: form.complemento || undefined,
          bairro: form.bairro,
          municipio: form.municipio,
          uf: form.uf,
        },
      });
      router.push('/cadastro/loja/sucesso');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar loja');
    }
  }

  const inputClass =
    'rounded-xl border border-mendu-border px-3 py-2.5 text-sm outline-none focus:border-mendu-red';

  return (
    <div className="flex min-h-screen items-center justify-center bg-mendu-bg px-5 py-10">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-mendu-border bg-white p-6 shadow-sm"
      >
        <h1 className="font-brand text-2xl font-bold text-mendu-ink">Cadastrar minha loja</h1>
        <p className="-mt-2 text-sm text-mendu-muted">Sua loja fica pendente de aprovação até revisarmos o cadastro.</p>
        <input className={inputClass} placeholder="Nome da loja" value={form.storeName} onChange={(e) => update('storeName', e.target.value)} required />
        <input className={inputClass} placeholder="slug-da-loja" value={form.storeSlug} onChange={(e) => update('storeSlug', e.target.value)} required />
        <input className={inputClass} type="email" placeholder="E-mail" value={form.email} onChange={(e) => update('email', e.target.value)} required />
        <input className={inputClass} type="password" placeholder="Senha" value={form.password} onChange={(e) => update('password', e.target.value)} required minLength={8} />
        <div className="mt-2 grid grid-cols-2 gap-3">
          <input className={`${inputClass} col-span-2`} placeholder="CEP" value={form.cep} onChange={(e) => update('cep', e.target.value)} required />
          <input className={`${inputClass} col-span-2`} placeholder="Rua" value={form.rua} onChange={(e) => update('rua', e.target.value)} required />
          <input className={inputClass} placeholder="Número" value={form.numero} onChange={(e) => update('numero', e.target.value)} required />
          <input className={inputClass} placeholder="Complemento" value={form.complemento} onChange={(e) => update('complemento', e.target.value)} />
          <input className={`${inputClass} col-span-2`} placeholder="Bairro" value={form.bairro} onChange={(e) => update('bairro', e.target.value)} required />
          <input className={inputClass} placeholder="Município" value={form.municipio} onChange={(e) => update('municipio', e.target.value)} required />
          <input className={inputClass} maxLength={2} placeholder="UF" value={form.uf} onChange={(e) => update('uf', e.target.value.toUpperCase())} required />
        </div>
        {error && <p className="text-sm font-semibold text-mendu-red">{error}</p>}
        <button
          type="submit"
          className="mt-2 rounded-xl bg-mendu-red py-3 text-sm font-bold text-white transition hover:bg-mendu-reddark"
        >
          Cadastrar
        </button>
      </form>
    </div>
  );
}
