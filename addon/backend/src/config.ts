import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import type { AIProvider } from "./types";

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
  googleRedirectUri: string;
  aiProvider: AIProvider;
  aiModel: string;
  aiFallbackProviders: AIProvider[];
  aiApiKeys: Partial<Record<AIProvider, string>>;
}

function loadConfig(): AppConfig {
  const dataDir =
    process.env.DATA_DIR ??
    (process.env.NODE_ENV === "production" ? "/data" : "./data");

  const port = parseInt(process.env.PORT ?? "3002", 10);

  // In HA addon context, options are written by Supervisor to /data/options.json
  let googleClientId = process.env.GOOGLE_CLIENT_ID ?? "";
  let googleClientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  // Default assumes access via the addon's direct (non-ingress) port — Google's
  // redirect_uri must be reachable directly from the browser, Ingress won't work.
  let googleRedirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    `http://localhost:${port}/api/google/oauth/callback`;
  let aiProvider = (process.env.AI_PROVIDER ?? "openai") as AIProvider;
  let aiModel = process.env.AI_MODEL ?? "";
  let aiFallbackProviders = (process.env.AI_FALLBACK_PROVIDERS ?? "")
    .split(",").map((item) => item.trim()).filter(Boolean) as AIProvider[];
  const aiApiKeys: Partial<Record<AIProvider, string>> = {
    openai: process.env.OPENAI_API_KEY ?? "",
    google: process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "",
    anthropic: process.env.ANTHROPIC_API_KEY ?? "",
    groq: process.env.GROQ_API_KEY ?? "",
    xai: process.env.XAI_API_KEY ?? "",
  };

  const optionsPath = path.join(dataDir, "options.json");
  if (fs.existsSync(optionsPath)) {
    try {
      const options = JSON.parse(
        fs.readFileSync(optionsPath, "utf-8"),
      ) as Record<string, string>;
      googleClientId = options["google_client_id"] ?? googleClientId;
      googleClientSecret =
        options["google_client_secret"] ?? googleClientSecret;
      googleRedirectUri = options["google_redirect_uri"] || googleRedirectUri;
      aiProvider = (options["ai_provider"] || aiProvider) as AIProvider;
      aiModel = options["ai_model"] || aiModel;
      aiFallbackProviders = (options["ai_fallback_providers"] || aiFallbackProviders.join(","))
        .split(",").map((item) => item.trim()).filter(Boolean) as AIProvider[];
      const genericKey = options["ai_api_key"] ?? "";
      aiApiKeys.openai = options["openai_api_key"] || (aiProvider === "openai" ? genericKey : aiApiKeys.openai);
      aiApiKeys.google = options["google_ai_api_key"] || (aiProvider === "google" ? genericKey : aiApiKeys.google);
      aiApiKeys.anthropic = options["anthropic_api_key"] || (aiProvider === "anthropic" ? genericKey : aiApiKeys.anthropic);
      aiApiKeys.groq = options["groq_api_key"] || (aiProvider === "groq" ? genericKey : aiApiKeys.groq);
      aiApiKeys.xai = options["xai_api_key"] || (aiProvider === "xai" ? genericKey : aiApiKeys.xai);
    } catch {
      console.warn(
        "[config] Could not parse options.json — falling back to environment variables",
      );
    }
  }

  return {
    port,
    dataDir,
    googleClientId,
    googleClientSecret,
    googleRedirectUri,
    aiProvider,
    aiModel,
    aiFallbackProviders,
    aiApiKeys,
  };
}

export const config = loadConfig();
