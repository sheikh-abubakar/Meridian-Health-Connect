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
};

export function validateRuntimeEnv() {
  const missing = [];
  if (!env.mongodbUri) missing.push("MONGODB_URI");
  if (!env.jwtSecret) missing.push("JWT_SECRET");
  if (!env.groqApiKey) missing.push("GROQ_API_KEY");
  if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) missing.push("valid PORT");
  if (!env.frontendOrigins.length) missing.push("CORS_ORIGINS or FRONTEND_URL");

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

export function isAllowedOrigin(origin) {
  if (!origin) return true;
  return env.frontendOrigins.includes(origin.replace(/\/$/, ""));
}
