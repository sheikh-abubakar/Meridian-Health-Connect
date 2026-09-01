import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 5000),
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!",
  groqApiKey: process.env.GROQ_API_KEY,
};

export function validateRuntimeEnv() {
  const missing = [];
  if (!env.mongodbUri) missing.push("MONGODB_URI");
  if (!env.jwtSecret) missing.push("JWT_SECRET");
  if (!env.groqApiKey) missing.push("GROQ_API_KEY");

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}
