import fs from "node:fs";
import path from "node:path";

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;

  const contents = fs.readFileSync(envPath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadLocalEnv();

function boolFromEnv(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
}

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = Object.freeze({
  port: numberFromEnv(process.env.PORT, 8787),
  appName: process.env.APP_NAME || "Beacon",
  dryRun: boolFromEnv(process.env.DEMO_DRY_RUN, false),
  callDelayMs: numberFromEnv(process.env.TRUSTED_CALL_DELAY_MS, 1800),

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || "",
    authToken: process.env.TWILIO_AUTH_TOKEN || "",
    fromNumber: process.env.TWILIO_FROM_NUMBER || "",
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || "",
  },

  elevenLabs: {
    apiKey: process.env.ELEVENLABS_API_KEY || "",
    agentId: process.env.ELEVENLABS_AGENT_ID || "",
    phoneNumberId: process.env.ELEVENLABS_PHONE_NUMBER_ID || "",
    llmOverride: process.env.ELEVENLABS_LLM_OVERRIDE || "",
    enableOverrides: boolFromEnv(process.env.ELEVENLABS_ENABLE_OVERRIDES, false),
    recordCalls: boolFromEnv(process.env.ELEVENLABS_RECORD_CALLS, false),
  },

  glendaleMcp: {
    enabled: boolFromEnv(process.env.GLENDALE_MCP_ENABLED, false),
    url:
      process.env.GLENDALE_MCP_URL ||
      "https://glendale-gis-mcp-1053589358088.us-west2.run.app/mcp",
    apiKey: process.env.GLENDALE_MCP_API_KEY || "",
    protocolVersion: process.env.MCP_PROTOCOL_VERSION || "2025-06-18",
    timeoutMs: numberFromEnv(process.env.GLENDALE_MCP_TIMEOUT_MS, 4500),
  },
});

export function getConfigurationStatus() {
  const twilioReady = Boolean(
    config.twilio.accountSid &&
      config.twilio.authToken &&
      (config.twilio.fromNumber || config.twilio.messagingServiceSid),
  );

  const elevenLabsReady = Boolean(
    config.elevenLabs.apiKey &&
      config.elevenLabs.agentId &&
      config.elevenLabs.phoneNumberId,
  );

  const mcpReady = Boolean(
    config.glendaleMcp.enabled && config.glendaleMcp.url && config.glendaleMcp.apiKey,
  );

  return {
    dryRun: config.dryRun,
    twilioSms: {
      ready: twilioReady,
      missing: [
        !config.twilio.accountSid && "TWILIO_ACCOUNT_SID",
        !config.twilio.authToken && "TWILIO_AUTH_TOKEN",
        !(config.twilio.fromNumber || config.twilio.messagingServiceSid) &&
          "TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID",
      ].filter(Boolean),
    },
    elevenLabsCalls: {
      ready: elevenLabsReady,
      missing: [
        !config.elevenLabs.apiKey && "ELEVENLABS_API_KEY",
        !config.elevenLabs.agentId && "ELEVENLABS_AGENT_ID",
        !config.elevenLabs.phoneNumberId && "ELEVENLABS_PHONE_NUMBER_ID",
      ].filter(Boolean),
      modelOverride: config.elevenLabs.llmOverride || null,
      overridesEnabled: config.elevenLabs.enableOverrides,
    },
    glendaleMcp: {
      enabled: config.glendaleMcp.enabled,
      ready: mcpReady,
      fallbackAvailable: true,
    },
  };
}
