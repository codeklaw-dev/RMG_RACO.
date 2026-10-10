import "server-only";
// Private S3-compatible storage. Objects are never public; clients get
// short-lived signed URLs scoped to one object and method.
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getEnv } from "./env";

export const UPLOAD_URL_TTL_S = 300;
export const READ_URL_TTL_S = 600;

let client: S3Client | null = null;
export function s3(): S3Client {
  if (client) return client;
  const env = getEnv();
  client = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY },
  });
  return client;
}

/** Keys are built only from server-generated ids — never from file names or user input. */
export const objectKey = (orgId: string, kind: "reference" | "output", assetId: string) => `org/${orgId}/${kind}s/${assetId}`;

export async function signedUploadUrl(key: string, contentType: string, contentLength: number) {
  const cmd = new PutObjectCommand({ Bucket: getEnv().S3_BUCKET, Key: key, ContentType: contentType, ContentLength: contentLength });
  return getSignedUrl(s3(), cmd, { expiresIn: UPLOAD_URL_TTL_S, signableHeaders: new Set(["content-type", "content-length"]) });
}

export async function signedReadUrl(key: string, fileName: string) {
  const cmd = new GetObjectCommand({
    Bucket: getEnv().S3_BUCKET,
    Key: key,
    ResponseContentDisposition: `inline; filename="${fileName.replace(/[^\w.\- ]/g, "_")}"`,
  });
  return getSignedUrl(s3(), cmd, { expiresIn: READ_URL_TTL_S });
}

export async function headObject(key: string): Promise<{ size: number } | null> {
  try {
    const r = await s3().send(new HeadObjectCommand({ Bucket: getEnv().S3_BUCKET, Key: key }));
    return { size: Number(r.ContentLength ?? 0) };
  } catch {
    return null;
  }
}

export async function readPrefix(key: string, bytes = 32): Promise<Uint8Array> {
  const r = await s3().send(new GetObjectCommand({ Bucket: getEnv().S3_BUCKET, Key: key, Range: `bytes=0-${bytes - 1}` }));
  return new Uint8Array(await r.Body!.transformToByteArray());
}

export async function deleteObject(key: string) {
  await s3().send(new DeleteObjectCommand({ Bucket: getEnv().S3_BUCKET, Key: key }));
}

/** Tests: reset the cached client after env changes. */
export const resetStorageClient = () => { client = null; };
