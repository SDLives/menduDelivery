export interface UploadInput {
  path: string;
  contentType: string;
  data: Buffer;
}

export interface UploadResult {
  url: string;
}

export interface StorageService {
  upload(input: UploadInput): Promise<UploadResult>;
}
