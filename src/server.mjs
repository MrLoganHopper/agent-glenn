import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config, getConfigurationStatus } from "./config.mjs";
import {
  buildEmergencySms,
  createGoogleMapsDirectionsUrl,
  validateScenarioInput,
} from "./domain.mjs";
import { startOutboundCall } from "./services/elevenlabs.mjs";
import { resolveSafeLocation } from "./services/glendale-mcp.mjs";
import { sendSms } from "./services/twilio.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDirectory = path.resolve(__dirname, "../public");
const scenarios = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function log(event, data = {}) {
  const safeData = { ...data };
  delete safeData.body;
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...safeData }));
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function publicScenario(scenario) {
  return {
    id: scenario.id,
    createdAt: scenario.createdAt,
    resident: scenario.resident,
    trustedContact: scenario.trustedContact,
    incident: scenario.incident,
    safeLocation: scenario.safeLocation,
    mapsUrl: scenario.mapsUrl,
    gis: scenario.gis,
    status: scenario.status,
  };
}

function initialActionStatus() {
  return {
    scenario: { state: "success", message: "Scenario created" },
    gis: { state: "success", message: "Safe destination selected" },
    residentCall: { state: "idle", message: "Ready" },
    trustedCall: { state: "idle", message: "Ready" },
    residentSms: { state: "idle", message: "Ready" },
    trustedSms: { state: "idle", message: "Ready" },
  };
}

function setActionStatus(scenario, key, state, message, details = {}) {
  scenario.status[key] = {
    state,
    message,
    updatedAt: new Date().toISOString(),
    ...details,
  };
}

async function createScenario(request, response) {
  const input = await readJsonBody(request);
  if (input.consentConfirmed !== true) {
    return sendJson(response, 400, {
      error: "Confirm that both demo phone owners consent to receive the test calls and texts.",
    });
  }

  const validated = validateScenarioInput(input);
  const gis = await resolveSafeLocation(validated.incident);
  const id = crypto.randomUUID();
  const scenario = {
    id,
    createdAt: new Date().toISOString(),
    ...validated,
    safeLocation: gis.location,
    mapsUrl: createGoogleMapsDirectionsUrl(gis.location),
    gis: {
      status: gis.status,
      source: gis.source,
      message: gis.message,
    },
    status: initialActionStatus(),
  };

  scenario.status.gis = {
    state: gis.source === "glendale-gis-mcp" ? "success" : "warning",
    message: gis.message,
    updatedAt: new Date().toISOString(),
  };

  scenarios.set(id, scenario);
  log("scenario.created", {
    scenarioId: id,
    resident: scenario.resident.name,
    safeLocation: scenario.safeLocation.name,
    gisSource: gis.source,
  });

  return sendJson(response, 201, { scenario: publicScenario(scenario) });
}

const ACTIONS = {
  "call-resident": {
    key: "residentCall",
    label: "Resident call",
    run: (scenario) =>
      startOutboundCall({
        to: scenario.resident.phone,
        scenario,
        recipientRole: "resident",
      }),
  },
  "call-trusted": {
    key: "trustedCall",
    label: "Trusted-contact call",
    run: (scenario) =>
      startOutboundCall({
        to: scenario.trustedContact.phone,
        scenario,
        recipientRole: "trusted_contact",
      }),
  },
  "sms-resident": {
    key: "residentSms",
    label: "Resident SMS",
    run: (scenario) =>
      sendSms({
        to: scenario.resident.phone,
        body: buildEmergencySms(scenario, "resident"),
      }),
  },
  "sms-trusted": {
    key: "trustedSms",
    label: "Trusted-contact SMS",
    run: (scenario) =>
      sendSms({
        to: scenario.trustedContact.phone,
        body: buildEmergencySms(scenario, "trusted_contact"),
      }),
  },
};

async function runAction(response, scenarioId, actionName) {
  const scenario = scenarios.get(scenarioId);
  if (!scenario) return sendJson(response, 404, { error: "Scenario not found." });

  const action = ACTIONS[actionName];
  if (!action) return sendJson(response, 404, { error: "Unknown action." });

  setActionStatus(scenario, action.key, "running", `${action.label} is starting`);
  log("action.started", { scenarioId, action: actionName });

  try {
    const result = await action.run(scenario);
    const providerReference = result.conversationId || result.callSid || result.sid || null;
    const message = result.dryRun
      ? `${action.label} simulated successfully`
      : `${action.label} started successfully`;
    setActionStatus(scenario, action.key, "success", message, {
      provider: result.provider,
      providerReference,
      dryRun: Boolean(result.dryRun),
    });
    log("action.succeeded", {
      scenarioId,
      action: actionName,
      providerReference,
      dryRun: Boolean(result.dryRun),
    });
    return sendJson(response, 200, {
      action: actionName,
      result,
      scenario: publicScenario(scenario),
    });
  } catch (error) {
    setActionStatus(scenario, action.key, "error", error.message);
    log("action.failed", { scenarioId, action: actionName, error: error.message });
    return sendJson(response, 502, {
      error: error.message,
      action: actionName,
      scenario: publicScenario(scenario),
    });
  }
}

async function serveStatic(requestPath, response) {
  const normalizedRequestPath = requestPath === "/" ? "/index.html" : requestPath;
  const decodedPath = decodeURIComponent(normalizedRequestPath);
  const target = path.resolve(publicDirectory, `.${decodedPath}`);

  if (!target.startsWith(publicDirectory + path.sep)) {
    return sendJson(response, 403, { error: "Forbidden." });
  }

  try {
    const data = await fs.readFile(target);
    const extension = path.extname(target).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes[extension] || "application/octet-stream",
      "Cache-Control": extension === ".html" ? "no-store" : "public, max-age=300",
    });
    response.end(data);
  } catch (error) {
    if (error.code === "ENOENT") return sendJson(response, 404, { error: "Not found." });
    throw error;
  }
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const pathname = url.pathname;

    if (request.method === "GET" && pathname === "/api/health") {
      return sendJson(response, 200, {
        ok: true,
        app: config.appName,
        time: new Date().toISOString(),
        configuration: getConfigurationStatus(),
      });
    }

    if (request.method === "POST" && pathname === "/api/scenarios") {
      return await createScenario(request, response);
    }

    const scenarioMatch = pathname.match(/^\/api\/scenarios\/([^/]+)$/);
    if (request.method === "GET" && scenarioMatch) {
      const scenario = scenarios.get(scenarioMatch[1]);
      if (!scenario) return sendJson(response, 404, { error: "Scenario not found." });
      return sendJson(response, 200, { scenario: publicScenario(scenario) });
    }

    const actionMatch = pathname.match(
      /^\/api\/scenarios\/([^/]+)\/actions\/(call-resident|call-trusted|sms-resident|sms-trusted)$/,
    );
    if (request.method === "POST" && actionMatch) {
      return await runAction(response, actionMatch[1], actionMatch[2]);
    }

    if (request.method === "GET") return await serveStatic(pathname, response);

    return sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    log("request.failed", { error: error.message, url: request.url });
    return sendJson(response, 500, { error: error.message || "Unexpected server error." });
  }
});

server.listen(config.port, () => {
  const configuration = getConfigurationStatus();
  console.log(`\nBeacon is running at http://localhost:${config.port}`);
  console.log(`Mode: ${configuration.dryRun ? "DRY RUN" : "LIVE"}`);
  console.log(
    `ElevenLabs calls: ${configuration.elevenLabsCalls.ready ? "configured" : "not configured"}`,
  );
  console.log(`Twilio SMS: ${configuration.twilioSms.ready ? "configured" : "not configured"}`);
  console.log(`Glendale GIS MCP: ${configuration.glendaleMcp.ready ? "configured" : "fallback"}\n`);
});
