export interface EnderecoPorCep {
  rua: string;
  bairro: string;
  municipio: string;
  uf: string;
}

export async function buscarCep(cepRaw: string): Promise<EnderecoPorCep | null> {
  const cep = cepRaw.replace(/\D/g, '');
  if (cep.length !== 8) return null;

  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!response.ok) return null;

  const data = await response.json();
  if (data.erro) return null;

  return {
    rua: data.logradouro,
    bairro: data.bairro,
    municipio: data.localidade,
    uf: data.uf,
  };
}
