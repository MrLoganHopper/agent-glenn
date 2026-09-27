import { config } from "../config.mjs";
import {
  chooseFallbackSafeLocation,
  haversineMiles,
} from "../domain.mjs";

function parsePossibleJson(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function parseMcpBody(text) {
  const trimmed = text.trim();
  if (!trimmed) return {};

  try {
    return JSON.parse(trimmed);
  } catch {
    const dataLines = trimmed
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);

    for (let index = dataLines.length - 1; index >= 0; index -= 1) {
      try {
        return JSON.parse(dataLines[index]);
      } catch {
        // Keep trying earlier SSE data frames.
      }
    }

    return { raw: trimmed };
  }
}

function getCoordinate(object, names) {
  for (const name of names) {
    const candidate = Number(object?.[name]);
    if (Number.isFinite(candidate)) return candidate;
  }
  return null;
}

function extractCoordinates(object) {
  if (!object || typeof object !== "object") return null;

  const lat = getCoordinate(object, ["lat", "latitude", "y"]);
  const lon = getCoordinate(object, ["lon", "lng", "longitude", "x"]);
  if (lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    return { lat, lon };
  }

  const coordinateArrays = [
    object.coordinates,
    object?.geometry?.coordinates,
    object?.location?.coordinates,
  ];

  for (const coordinates of coordinateArrays) {
    if (
      Array.isArray(coordinates) &&
      coordinates.length >= 2 &&
      Number.isFinite(Number(coordinates[0])) &&
      Number.isFinite(Number(coordinates[1]))
    ) {
      const first = Number(coordinates[0]);
      const second = Number(coordinates[1]);
      if (Math.abs(first) <= 180 && Math.abs(second) <= 90) {
        return { lat: second, lon: first };
      }
    }
  }

  if (object.location && typeof object.location === "object") {
    return extractCoordinates(object.location);
  }
  if (object.geometry && typeof object.geometry === "object") {
    return extractCoordinates(object.geometry);
  }

  return null;
}

function firstString(object, names) {
  for (const name of names) {
    const value = object?.[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function collectResourceCandidates(value, output = [], depth = 0) {
  if (depth > 8 || value == null) return output;

  if (typeof value === "string") {
    const parsed = parsePossibleJson(value);
    if (parsed !== value) collectResourceCandidates(parsed, output, depth + 1);
    return output;
  }

  if (Array.isArray(value)) {
    for (const item of value) collectResourceCandidates(item, output, depth + 1);
    return output;
  }

  if (typeof value !== "object") return output;

  const name = firstString(value, [
    "name",
    "title",
    "facility_name",
    "facilityName",
    "park_name",
    "library_name",
    "school_name",
    "label",
  ]);
  const address = firstString(value, [
    "address",
    "full_address",
    "fullAddress",
    "street_address",
    "site_address",
    "formatted_address",
  ]);
  const coordinates = extractCoordinates(value);
  const kind = firstString(value, ["kind", "type", "category", "resource_type"]);

  if (name && (address || coordinates)) {
    output.push({ name, address, coordinates, kind, raw: value });
  }

  for (const child of Object.values(value)) {
    if (child && typeof child === "object") {
      collectResourceCandidates(child, output, depth + 1);
    }
  }

  return output;
}

function unwrapToolPayload(response) {
  const result = response?.result ?? response;
  const content = result?.content;
  if (!Array.isArray(content)) return result;

  const unwrapped = [];
  for (const item of content) {
    if (item?.type === "text" && typeof item.text === "string") {
      unwrapped.push(parsePossibleJson(item.text));
    } else {
      unwrapped.push(item);
    }
  }
  return unwrapped;
}

class McpHttpClient {
  constructor({ url, apiKey, protocolVersion, timeoutMs }) {
    this.url = url;
    this.apiKey = apiKey;
    this.protocolVersion = protocolVersion;
    this.timeoutMs = timeoutMs;
    this.sessionId = "";
    this.nextId = 1;
  }

  headers() {
    const headers = {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      "MCP-Protocol-Version": this.protocolVersion,
    };
    if (this.apiKey) headers.Authorization = `Bearer ${this.apiKey}`;
    if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;
    return headers;
  }

  async post(payload, expectResponse = true) {
    const response = await fetch(this.url, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    const returnedSessionId = response.headers.get("mcp-session-id");
    if (returnedSessionId) this.sessionId = returnedSessionId;

    const text = await response.text();
    if (!response.ok) {
      throw new Error(`MCP HTTP ${response.status}: ${text.slice(0, 500)}`);
    }
    if (!expectResponse || !text.trim()) return {};

    const parsed = parseMcpBody(text);
    if (parsed?.error) {
      throw new Error(`MCP error: ${JSON.stringify(parsed.error)}`);
    }
    return parsed;
  }

  async initialize() {
    const response = await this.post({
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "initialize",
      params: {
        protocolVersion: this.protocolVersion,
        capabilities: {},
        clientInfo: { name: "beacon-hackathon", version: "1.0.0" },
      },
    });

    await this.post(
      {
        jsonrpc: "2.0",
        method: "notifications/initialized",
        params: {},
      },
      false,
    );

    return response;
  }

  async callTool(name, args) {
    return this.post({
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "tools/call",
      params: { name, arguments: args },
    });
  }
}

function makeSearchAnchor(incident) {
  const extraMiles = incident.radiusMiles + 1.5;
  return {
    lat: incident.center.lat - extraMiles / 69,
    lon: incident.center.lon,
  };
}

function deduplicateCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = `${candidate.name.toLowerCase()}|${candidate.address.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function chooseMcpCandidate(candidates, incident) {
  const normalized = deduplicateCandidates(candidates)
    .map((candidate) => {
      const coordinates = candidate.coordinates;
      const distanceFromIncidentMiles = coordinates
        ? haversineMiles(incident.center, coordinates)
        : null;
      return { ...candidate, distanceFromIncidentMiles };
    })
    .filter((candidate) => {
      if (candidate.distanceFromIncidentMiles == null) return Boolean(candidate.address);
      return candidate.distanceFromIncidentMiles > incident.radiusMiles + 0.25;
    })
    .sort((a, b) => {
      if (a.distanceFromIncidentMiles == null) return 1;
      if (b.distanceFromIncidentMiles == null) return -1;
      return a.distanceFromIncidentMiles - b.distanceFromIncidentMiles;
    });

  const selected = normalized[0];
  if (!selected) return null;

  return {
    id: `mcp-${selected.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`,
    name: selected.name,
    address: selected.address || "Glendale, CA",
    lat: selected.coordinates?.lat,
    lon: selected.coordinates?.lon,
    source: "glendale-gis-mcp",
    note: "Demo public resource selected from Glendale GIS data, not an official shelter",
    kind: selected.kind || "public resource",
    distanceFromIncidentMiles: selected.distanceFromIncidentMiles,
  };
}

export async function resolveSafeLocation(incident) {
  const fallback = chooseFallbackSafeLocation(incident);

  if (!config.glendaleMcp.enabled) {
    return {
      location: fallback,
      source: "fallback",
      status: "disabled",
      message: "Glendale GIS MCP is disabled. A reliable demo fallback was used.",
    };
  }

  if (!config.glendaleMcp.apiKey) {
    return {
      location: fallback,
      source: "fallback",
      status: "missing-key",
      message: "Glendale GIS MCP key is missing. A reliable demo fallback was used.",
    };
  }

  try {
    const client = new McpHttpClient(config.glendaleMcp);
    await client.initialize();
    const anchor = makeSearchAnchor(incident);
    const response = await client.callTool("nearest_resources", {
      location: { lat: anchor.lat, lon: anchor.lon },
      kinds: ["parks", "libraries", "schools"],
      limit: 5,
    });

    const payload = unwrapToolPayload(response);
    const candidates = collectResourceCandidates(payload);
    const selected = chooseMcpCandidate(candidates, incident);

    if (!selected) {
      return {
        location: fallback,
        source: "fallback",
        status: "no-usable-results",
        message: "MCP returned no usable public resource outside the demo zone.",
      };
    }

    return {
      location: selected,
      source: "glendale-gis-mcp",
      status: "success",
      message: `Selected ${selected.name} from Glendale GIS data.`,
    };
  } catch (error) {
    return {
      location: fallback,
      source: "fallback",
      status: "error",
      message: `GIS lookup failed safely: ${error.message}`,
    };
  }
}
