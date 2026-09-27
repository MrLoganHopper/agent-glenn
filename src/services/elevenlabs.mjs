import crypto from "node:crypto";
import { config } from "../config.mjs";
import { buildCallDynamicVariables } from "../domain.mjs";

function isConfigured() {
  return Boolean(
    config.elevenLabs.apiKey &&
      config.elevenLabs.agentId &&
      config.elevenLabs.phoneNumberId,
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

export async function startOutboundCall({ to, scenario, recipientRole }) {
  const dynamicVariables = buildCallDynamicVariables(scenario, recipientRole);

  if (config.dryRun || !isConfigured()) {
    return {
      success: true,
      dryRun: true,
      provider: "elevenlabs",
      conversationId: `conv_dry_${crypto.randomUUID().slice(0, 8)}`,
      callSid: `CA_DRY_${crypto.randomUUID().slice(0, 8)}`,
      to,
      recipientRole,
      dynamicVariables,
      note: !isConfigured()
        ? "ElevenLabs outbound-call credentials are incomplete, so this action was simulated."
        : "DEMO_DRY_RUN is enabled.",
    };
  }

  const initiationData = {
    type: "conversation_initiation_client_data",
    dynamic_variables: dynamicVariables,
  };

  if (config.elevenLabs.enableOverrides && config.elevenLabs.llmOverride) {
    initiationData.conversation_config_override = {
      agent: {
        prompt: {
          llm: config.elevenLabs.llmOverride,
        },
      },
    };
  }

  const response = await fetch(
    "https://api.elevenlabs.io/v1/convai/twilio/outbound-call",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": config.elevenLabs.apiKey,
      },
      body: JSON.stringify({
        agent_id: config.elevenLabs.agentId,
        agent_phone_number_id: config.elevenLabs.phoneNumberId,
        to_number: to,
        conversation_initiation_client_data: initiationData,
        call_recording_enabled: config.elevenLabs.recordCalls,
      }),
      signal: AbortSignal.timeout(20000),
    },
  );

  const payload = await parseResponse(response);
  if (!response.ok || payload.success === false) {
    const message = payload.detail || payload.message || payload.raw || `HTTP ${response.status}`;
    throw new Error(`ElevenLabs outbound call failed: ${JSON.stringify(message)}`);
  }

  return {
    success: true,
    dryRun: false,
    provider: "elevenlabs",
    conversationId: payload.conversation_id,
    callSid: payload.callSid,
    message: payload.message,
    to,
    recipientRole,
  };
}

export async function discoverElevenLabsResources(apiKey = config.elevenLabs.apiKey) {
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is required.");
  }

  const headers = { "xi-api-key": apiKey };
  const [agentsResponse, phonesResponse] = await Promise.all([
    fetch("https://api.elevenlabs.io/v1/convai/agents?page_size=100", {
      headers,
      signal: AbortSignal.timeout(15000),
    }),
    fetch("https://api.elevenlabs.io/v1/convai/phone-numbers", {
      headers,
      signal: AbortSignal.timeout(15000),
    }),
  ]);

  const agents = await parseResponse(agentsResponse);
  const phones = await parseResponse(phonesResponse);

  if (!agentsResponse.ok) {
    throw new Error(`Could not list ElevenLabs agents: ${JSON.stringify(agents)}`);
  }
  if (!phonesResponse.ok) {
    throw new Error(`Could not list ElevenLabs phone numbers: ${JSON.stringify(phones)}`);
  }

  return {
    agents: agents.agents ?? [],
    phoneNumbers: Array.isArray(phones) ? phones : phones.phone_numbers ?? [],
  };
}
