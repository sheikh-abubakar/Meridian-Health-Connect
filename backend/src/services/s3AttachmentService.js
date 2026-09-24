import crypto from "node:crypto";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const allowedTypes = new Set(["application/pdf", "image/jpeg", "image/png"]);
const client = new S3Client({ region: env.awsRegion });

export const attachmentUploadEnabled = () => Boolean(env.s3BucketName && env.awsRegion);
export function assertAllowedAttachment(file) {
  if (!attachmentUploadEnabled()) throw new ApiError(503, "Clinical attachments are not configured. Configure S3_BUCKET_NAME and AWS_REGION first.");
  if (!file || !allowedTypes.has(file.mimetype)) throw new ApiError(400, "Only PDF, JPG, JPEG and PNG files are allowed");
}
function safeFileName(value) { return path.basename(String(value || "attachment")).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "attachment"; }
async function putPrivateAttachment({ key, file }) {
  try {
    await client.send(new PutObjectCommand({ Bucket: env.s3BucketName, Key: key, Body: file.buffer, ContentType: file.mimetype, ServerSideEncryption: "AES256" }));
  } catch (error) {
    if (error?.name === "CredentialsProviderError" || /credential/i.test(String(error?.message || ""))) {
      throw new ApiError(503, "Report storage is not authenticated. Configure local AWS credentials or use the production IAM role.");
    }
    if (error?.name === "AccessDenied" || error?.$metadata?.httpStatusCode === 403) {
      throw new ApiError(503, "Report storage denied this upload. Verify the S3 bucket policy and the IAM role/user PutObject permission.");
    }
    if (error?.name === "NoSuchBucket") throw new ApiError(503, "The configured S3 bucket does not exist or is unavailable.");
    throw error;
  }
}
export async function uploadClinicalAttachment({ file, encounter, tenantId, locationId, patientId }) {
  const name = safeFileName(file.originalname); const prefix = env.s3AttachmentPrefix.replace(/^\/+|\/+$/g, "");
  const key = `${prefix}/${tenantId}/${locationId}/${patientId}/${encounter._id}/${crypto.randomUUID()}-${name}`;
  await putPrivateAttachment({ key, file });
  return { key, fileName: name, mimeType: file.mimetype, size: file.size };
}
export async function uploadLabReport({ file, labOrder, tenantId, locationId, patientId }) {
  const name = safeFileName(file.originalname); const prefix = env.s3AttachmentPrefix.replace(/^\/+|\/+$/g, "");
  const key = `${prefix}/${tenantId}/${locationId}/${patientId}/lab-reports/${labOrder._id}/${crypto.randomUUID()}-${name}`;
  await putPrivateAttachment({ key, file });
  return { key, fileName: name, mimeType: file.mimetype, size: file.size };
}
export async function deleteClinicalAttachment(key) { await client.send(new DeleteObjectCommand({ Bucket: env.s3BucketName, Key: key })); }
export async function signedClinicalAttachmentUrl(key) { return getSignedUrl(client, new GetObjectCommand({ Bucket: env.s3BucketName, Key: key, ResponseContentDisposition: "inline" }), { expiresIn: 300 }); }
