import crypto from "node:crypto";
import { config } from "../config.mjs";

function isConfigured() {
  return Boolean(
    config.twilio.accountSid &&
      config.twilio.authToken &&
      (config.twilio.fromNumber || config.twilio.messagingServiceSid),
  );
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function sendSms({ to, body }) {
  if (config.dryRun || !isConfigured()) {
    return {
      success: true,
      dryRun: true,
      provider: "twilio",
      sid: `SM_DRY_${crypto.randomUUID().slice(0, 8)}`,
      to,
      body,
      note: !isConfigured()
        ? "Twilio SMS credentials are incomplete, so this action was simulated."
        : "DEMO_DRY_RUN is enabled.",
    };
  }

  const form = new URLSearchParams({ To: to, Body: body });
  if (config.twilio.messagingServiceSid) {
    form.set("MessagingServiceSid", config.twilio.messagingServiceSid);
  } else {
    form.set("From", config.twilio.fromNumber);
  }

  const credentials = Buffer.from(
    `${config.twilio.accountSid}:${config.twilio.authToken}`,
  ).toString("base64");

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
    config.twilio.accountSid,
  )}/Messages.json`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
    signal: AbortSignal.timeout(15000),
  });

  const payload = await parseResponse(response);
  if (!response.ok) {
    const message = payload.message || payload.raw || `Twilio returned HTTP ${response.status}.`;
    throw new Error(`Twilio SMS failed: ${message}`);
  }

  return {
    success: true,
    dryRun: false,
    provider: "twilio",
    sid: payload.sid,
    status: payload.status,
    to: payload.to || to,
  };
}
