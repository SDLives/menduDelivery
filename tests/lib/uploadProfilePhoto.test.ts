import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadProfilePhoto } from '@/app/(auth)/cadastro/cliente/actions';

describe('uploadProfilePhoto', () => {
  beforeEach(() => {
    process.env.BUNNY_STORAGE_ZONE = 'mendu-zone';
    process.env.BUNNY_STORAGE_API_KEY = 'test-key';
    process.env.BUNNY_CDN_BASE_URL = 'https://mendu-zone.b-cdn.net';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 201 }));
  });

  it('uploads the file to the clientes/ folder and returns the CDN url', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'foto.png', { type: 'image/png' });

    const result = await uploadProfilePhoto(file);

    expect(result.url).toMatch(/^https:\/\/mendu-zone\.b-cdn\.net\/clientes\/[a-f0-9-]+\.png$/);
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/^https:\/\/storage\.bunnycdn\.com\/mendu-zone\/clientes\/[a-f0-9-]+\.png$/),
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ AccessKey: 'test-key', 'Content-Type': 'image/png' }),
      })
    );
  });
});
