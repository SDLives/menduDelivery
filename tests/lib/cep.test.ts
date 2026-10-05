import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buscarCep } from '@/lib/cep';

describe('buscarCep', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns the address fields on a successful lookup', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({
        cep: '01310-100',
        logradouro: 'Avenida Paulista',
        bairro: 'Bela Vista',
        localidade: 'São Paulo',
        uf: 'SP',
      }),
    });

    const result = await buscarCep('01310-100');

    expect(result).toEqual({
      rua: 'Avenida Paulista',
      bairro: 'Bela Vista',
      municipio: 'São Paulo',
      uf: 'SP',
    });
    expect(fetch).toHaveBeenCalledWith('https://viacep.com.br/ws/01310100/json/');
  });

  it('returns null when the CEP is not found', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ erro: 'true' }),
    });

    const result = await buscarCep('00000000');

    expect(result).toBeNull();
  });

  it('returns null when the request fails', async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 });

    const result = await buscarCep('01310100');

    expect(result).toBeNull();
  });

  it('returns null without calling fetch when fewer than 8 digits are given', async () => {
    const result = await buscarCep('0131');

    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
