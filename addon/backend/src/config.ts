import dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load .env from project root in development (no-op in production / HA addon)
if (process.env.NODE_ENV !== "production") {
  dotenv.config({
    path: path.resolve(__dirname, "../../../.env"),
    quiet: true,
  });
}

interface AppConfig {
  port: number;
  dataDir: string;
  googleClientId: string;
  googleClientSecret: string;
}

function loadConfig(): AppConfig {
  const dataDir =
    process.env.DATA_DIR ??
    (process.env.NODE_ENV === "production" ? "/data" : "./data");

  // In HA addon context, options are written by Supervisor to /data/options.json
  let googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
  let googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";

  const optionsPath = path.join(dataDir, "options.json");
  if (fs.existsSync(optionsPath)) {
    try {
      const options = JSON.parse(
        fs.readFileSync(optionsPath, "utf-8"),
      ) as Record<string, string>;
      googleClientId = options["google_client_id"] ?? googleClientId;
      googleClientSecret =
        options["google_client_secret"] ?? googleClientSecret;
    } catch {
      console.warn(
        "[config] Could not parse options.json — falling back to environment variables",
      );
    }
  }

  return {
    port: parseInt(process.env.PORT ?? "3002", 10),
    dataDir,
    googleClientId,
    googleClientSecret,
  };
}

export const config = loadConfig();
