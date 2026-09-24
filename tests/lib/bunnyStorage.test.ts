import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bunnyStorage } from '@/lib/storage/bunnyStorage';

describe('bunnyStorage', () => {
  beforeEach(() => {
    process.env.BUNNY_STORAGE_ZONE = 'mendu-zone';
    process.env.BUNNY_STORAGE_API_KEY = 'test-key';
    process.env.BUNNY_CDN_BASE_URL = 'https://mendu-zone.b-cdn.net';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 201 })
    );
  });

  it('uploads to Bunny Storage and returns the CDN url', async () => {
    const result = await bunnyStorage.upload({
      path: 'products/x-burger.jpg',
      contentType: 'image/jpeg',
      data: Buffer.from('fake-image-bytes'),
    });

    expect(result.url).toBe('https://mendu-zone.b-cdn.net/products/x-burger.jpg');
    expect(fetch).toHaveBeenCalledWith(
      'https://storage.bunnycdn.com/mendu-zone/products/x-burger.jpg',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ AccessKey: 'test-key', 'Content-Type': 'image/jpeg' }),
      })
    );
  });

  it('throws when Bunny returns a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    await expect(
      bunnyStorage.upload({ path: 'x.jpg', contentType: 'image/jpeg', data: Buffer.from('a') })
    ).rejects.toThrow('Falha no upload para Bunny Storage: 401');
  });
});
