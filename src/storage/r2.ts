import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { assertValidObjectKey, publicObjectUrl } from '#/storage/urls'

// This client holds the bucket-write credentials; it must never reach the
// browser bundle. Fail loudly if it is ever imported client-side.
if (typeof window !== 'undefined') {
  throw new Error('#/storage must not be imported in the browser')
}

export interface StorageConfig {
  endpoint: string
  accessKeyId: string
  secretAccessKey: string
  buckets: { proofs: string; pending: string; assets: string }
  publicBaseUrls: { proofs: string; assets: string }
}

export type BucketRole = keyof StorageConfig['buckets']
export type PublicBucketRole = keyof StorageConfig['publicBaseUrls']

export function createStorage(config: StorageConfig) {
  const client = new S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Fail fast instead of hanging SSR requests when the store is unreachable
    // (same posture as the db client's connect_timeout).
    requestHandler: { connectionTimeout: 5_000, requestTimeout: 15_000 },
    // The SDK's flexible-checksum defaults inject x-amz-checksum-* headers that
    // non-AWS S3 stores may reject; only checksum when the API requires it.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })

  return {
    async put(
      role: BucketRole,
      key: string,
      body: Uint8Array | string,
      contentType: string,
    ): Promise<void> {
      assertValidObjectKey(key)
      await client.send(
        new PutObjectCommand({
          Bucket: config.buckets[role],
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      )
    },

    async get(role: BucketRole, key: string): Promise<Uint8Array | null> {
      assertValidObjectKey(key)
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: config.buckets[role], Key: key }),
        )
        return (await result.Body?.transformToByteArray()) ?? null
      } catch (error) {
        // Not-found shape varies across S3 stores: NoSuchKey, NotFound, bare 404.
        const e = error as {
          name?: string
          $metadata?: { httpStatusCode?: number }
        }
        if (e.name === 'NoSuchKey' || e.$metadata?.httpStatusCode === 404) {
          return null
        }
        throw error
      }
    },

    async delete(role: BucketRole, key: string): Promise<void> {
      assertValidObjectKey(key)
      await client.send(
        new DeleteObjectCommand({ Bucket: config.buckets[role], Key: key }),
      )
    },

    async signedGetUrl(
      role: BucketRole,
      key: string,
      expiresInSeconds = 600,
    ): Promise<string> {
      assertValidObjectKey(key)
      const command = new GetObjectCommand({
        Bucket: config.buckets[role],
        Key: key,
      })
      return getSignedUrl(client, command, { expiresIn: expiresInSeconds })
    },

    publicUrl(role: PublicBucketRole, key: string): string {
      assertValidObjectKey(key)
      return publicObjectUrl(config.publicBaseUrls[role], key)
    },
  }
}

export type Storage = ReturnType<typeof createStorage>

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is not set`)
  return value
}

export function storageFromEnv(): Storage {
  return createStorage({
    endpoint: `https://${required('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    accessKeyId: required('R2_ACCESS_KEY_ID'),
    secretAccessKey: required('R2_SECRET_ACCESS_KEY'),
    buckets: {
      proofs: required('R2_BUCKET_PUBLIC'),
      pending: required('R2_BUCKET_PENDING'),
      assets: required('R2_BUCKET_ASSETS'),
    },
    publicBaseUrls: {
      proofs: required('R2_PUBLIC_BASE_URL'),
      assets: required('R2_ASSETS_BASE_URL'),
    },
  })
}
