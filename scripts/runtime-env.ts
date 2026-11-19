import dotenv from "dotenv";

export function loadEnvConfig() {
  dotenv.config({ path: [".env.local", ".env"], quiet: true });
}
