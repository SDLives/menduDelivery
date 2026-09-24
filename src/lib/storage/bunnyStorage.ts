import type { StorageService, UploadInput, UploadResult } from './StorageService';

export const bunnyStorage: StorageService = {
  async upload(input: UploadInput): Promise<UploadResult> {
    const zone = process.env.BUNNY_STORAGE_ZONE!;
    const apiKey = process.env.BUNNY_STORAGE_API_KEY!;
    const cdnBaseUrl = process.env.BUNNY_CDN_BASE_URL!;

    const response = await fetch(`https://storage.bunnycdn.com/${zone}/${input.path}`, {
      method: 'PUT',
      headers: {
        AccessKey: apiKey,
        'Content-Type': input.contentType,
      },
      body: input.data as unknown as BodyInit,
    });

    if (!response.ok) {
      throw new Error(`Falha no upload para Bunny Storage: ${response.status}`);
    }

    return { url: `${cdnBaseUrl}/${input.path}` };
  },
};
