export default function LojasPendentesPage() {
  return (
    <div>
      <h1>Lojas pendentes de aprovação</h1>
      <p>
        Painel administrativo completo (listagem interativa, botão de aprovar/reprovar) é escopo de um
        plano futuro. Por ora, aprovação é feita chamando <code>approveStoreAction</code> diretamente
        (via console do Next.js ou um script), restrito a usuários com <code>role = platform_admin</code>.
      </p>
    </div>
  );
}
