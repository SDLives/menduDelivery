import Link from 'next/link';

export default function CadastroLojaSucessoPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-mendu-bg px-5">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-mendu-border bg-white p-6 text-center shadow-sm">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-mendu-green/10 text-3xl">
          ✅
        </span>
        <h1 className="font-brand text-2xl font-bold text-mendu-ink">Loja cadastrada!</h1>
        <p className="text-sm text-mendu-muted">
          Recebemos o cadastro da sua loja e ela está pendente de aprovação. Assim que for revisada, você
          será avisado e poderá começar a vender.
        </p>
        <Link
          href="/"
          className="mt-2 w-full rounded-xl bg-mendu-red py-3 text-sm font-bold text-white transition hover:bg-mendu-reddark"
        >
          Voltar pro início
        </Link>
      </div>
    </div>
  );
}
