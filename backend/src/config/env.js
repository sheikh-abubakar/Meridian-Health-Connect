import dotenv from "dotenv";

dotenv.config();

const frontendOrigins = String(process.env.CORS_ORIGINS || process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  host: process.env.HOST || "0.0.0.0",
  port: Number(process.env.PORT || 5000),
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  frontendUrl: frontendOrigins[0],
  frontendOrigins,
  trustProxy: process.env.TRUST_PROXY === "true" ? 1 : false,
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!",
  groqApiKey: process.env.GROQ_API_KEY,
  moceanApiToken: process.env.MOCEAN_API_TOKEN,
  moceanSmsFrom: process.env.MOCEAN_SMS_FROM || "Meridian Health",
  moceanSmsEnabled: process.env.MOCEAN_SMS_ENABLED === "true",
  moceanDefaultCountryCode: String(process.env.MOCEAN_DEFAULT_COUNTRY_CODE || "92").replace(/\D/g, ""),
  moceanDlrWebhookSecret: process.env.MOCEAN_DLR_WEBHOOK_SECRET,
  moceanDlrPublicUrl: String(process.env.MOCEAN_DLR_PUBLIC_URL || "").replace(/\/$/, ""),
  awsRegion: process.env.AWS_REGION,
  s3BucketName: process.env.S3_BUCKET_NAME,
  s3AttachmentPrefix: process.env.S3_ATTACHMENT_PREFIX || "meridian-health",
};

export function validateRuntimeEnv() {
  const missing = [];
  if (!env.mongodbUri) missing.push("MONGODB_URI");
  if (!env.jwtSecret) missing.push("JWT_SECRET");
  if (!env.groqApiKey) missing.push("GROQ_API_KEY");
  if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) missing.push("valid PORT");
  if (!env.frontendOrigins.length) missing.push("CORS_ORIGINS or FRONTEND_URL");
  if (env.moceanSmsEnabled) {
    if (!env.moceanApiToken) missing.push("MOCEAN_API_TOKEN");
    if (!env.moceanSmsFrom) missing.push("MOCEAN_SMS_FROM");
    if (!env.moceanDlrWebhookSecret) missing.push("MOCEAN_DLR_WEBHOOK_SECRET");
    if (!env.moceanDlrPublicUrl.startsWith("https://")) missing.push("valid HTTPS MOCEAN_DLR_PUBLIC_URL");
  }

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

export function isAllowedOrigin(origin) {
  if (!origin) return true;
  return env.frontendOrigins.includes(origin.replace(/\/$/, ""));
}
