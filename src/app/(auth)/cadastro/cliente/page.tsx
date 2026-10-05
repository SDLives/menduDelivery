'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseBrowserClient } from '@/lib/supabaseBrowserClient';
import { maskCelular } from '@/lib/masks';
import { signupCustomer, uploadProfilePhoto } from './actions';

export default function CadastroClientePage() {
  const router = useRouter();
  const [primeiroNome, setPrimeiroNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      let urlFotoDePerfil: string | undefined;
      if (foto) {
        const uploaded = await uploadProfilePhoto(foto);
        urlFotoDePerfil = uploaded.url;
      }

      await signupCustomer({
        email,
        password,
        phone: phone || undefined,
        primeiroNome,
        sobrenome,
        urlFotoDePerfil,
      });

      // signupCustomer cria o usuário no Supabase Auth pelo admin API (server-side),
      // o que não estabelece sessão nenhuma no browser — sem este signInWithPassword
      // o cliente ficaria "cadastrado" mas não logado, e o checkout não saberia quem ele é.
      const { error: signInError } = await supabaseBrowserClient().auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        throw new Error('Conta criada, mas não foi possível entrar automaticamente. Tente novamente.');
      }

      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao cadastrar');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    'rounded-xl border border-mendu-border px-3 py-2.5 text-sm font-normal outline-none focus:border-mendu-red';

  return (
    <div className="flex min-h-screen items-center justify-center bg-mendu-bg px-5">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-mendu-border bg-white p-6 shadow-sm"
      >
        <Link href="/" className="-mt-1 w-fit text-sm font-semibold text-mendu-muted hover:text-mendu-red">
          ← Voltar
        </Link>

        <h1 className="font-brand text-2xl font-bold text-mendu-ink">Criar conta</h1>

        <div className="flex flex-col items-center gap-2">
          <label
            htmlFor="foto"
            className="flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-mendu-border bg-mendu-bg text-xs font-semibold text-mendu-muted hover:border-mendu-red"
          >
            {foto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={URL.createObjectURL(foto)} alt="Foto de perfil" className="h-full w-full object-cover" />
            ) : (
              'Foto'
            )}
          </label>
          <input
            id="foto"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold text-mendu-ink">
            Primeiro nome
            <input
              className={inputClass}
              value={primeiroNome}
              onChange={(e) => setPrimeiroNome(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-mendu-ink">
            Sobrenome
            <input
              className={inputClass}
              value={sobrenome}
              onChange={(e) => setSobrenome(e.target.value)}
              required
            />
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm font-semibold text-mendu-ink">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-mendu-ink">
          Senha
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className={`${inputClass} w-full pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Esconder senha' : 'Mostrar senha'}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-mendu-muted hover:text-mendu-ink"
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-mendu-ink">
          Telefone (opcional)
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(maskCelular(e.target.value))}
            className={inputClass}
          />
        </label>
        {error && <p className="text-sm font-semibold text-mendu-red">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-xl bg-mendu-red py-3 text-sm font-bold text-white transition hover:bg-mendu-reddark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Criando...' : 'Criar conta'}
        </button>
      </form>
    </div>
  );
}
