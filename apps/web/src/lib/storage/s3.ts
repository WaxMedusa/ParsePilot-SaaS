import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { appConfig } from '../env';
import type { StorageProvider, StoragePutOptions } from './types';
import { StorageError } from './types';

/**
 * Private S3-compatible object storage (AWS S3, MinIO, or another provider).
 * The bucket must be private: no public ACLs, no static website hosting, no
 * permanent object URLs. Access is exclusively through short-lived presigned
 * URLs created after an authorization check in the API layer.
 */
export class S3Storage implements StorageProvider {
  readonly driver = 's3' as const;
  private client: S3Client | null = null;
  private readonly bucket: string;

  constructor() {
    this.bucket = appConfig.s3.bucket;
    if (!appConfig.s3.bucket || !appConfig.s3.accessKeyId || !appConfig.s3.secretAccessKey) {
      throw new StorageError('S3 storage is selected but credentials are incomplete');
    }
  }

  private s3(): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        region: appConfig.s3.region,
        endpoint: appConfig.s3.endpoint || undefined,
        forcePathStyle: appConfig.s3.forcePathStyle,
        credentials: {
          accessKeyId: appConfig.s3.accessKeyId,
          secretAccessKey: appConfig.s3.secretAccessKey,
        },
      });
    }
    return this.client;
  }

  async putObject(key: string, body: Uint8Array, options: StoragePutOptions): Promise<void> {
    try {
      await this.s3().send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: options.contentType,
          ChecksumSHA256: options.checksumSha256
            ? Buffer.from(options.checksumSha256, 'hex').toString('base64')
            : undefined,
          ServerSideEncryption: 'AES256',
        }),
      );
    } catch (error) {
      throw new StorageError('Failed to store object', error);
    }
  }

  async getObject(key: string): Promise<Uint8Array> {
    try {
      const result = await this.s3().send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!result.Body) throw new StorageError('Empty object body');
      return new Uint8Array(await result.Body.transformToByteArray());
    } catch (error) {
      throw new StorageError('Failed to read object', error);
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      await this.s3().send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (error) {
      throw new StorageError('Failed to delete object', error);
    }
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      await this.s3().send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async createDownloadUrl(key: string, expiresInSeconds: number, filename?: string, contentType?: string): Promise<string> {
    return getSignedUrl(
      this.s3(),
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentDisposition: filename ? `attachment; filename="${filename.replace(/["\\]/g, '')}"` : undefined,
        ResponseContentType: contentType,
      }),
      { expiresIn: Math.max(30, Math.min(expiresInSeconds, 3600)) },
    );
  }

  async createUploadUrl(key: string, contentType: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.s3(),
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType, ServerSideEncryption: 'AES256' }),
      { expiresIn: Math.max(30, Math.min(expiresInSeconds, 3600)) },
    );
  }

  async healthCheck(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.s3().send(new HeadObjectCommand({ Bucket: this.bucket, Key: 'health/probe' }));
      return { ok: true };
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      // A missing probe object still proves the bucket is reachable and authorized.
      if (name === 'NotFound' || name === 'NoSuchKey') return { ok: true };
      return { ok: false, error: name || 'unknown' };
    }
  }
}
