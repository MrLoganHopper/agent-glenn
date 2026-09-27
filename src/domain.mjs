const US_COUNTRY_CODE = "+1";

export const DEFAULT_INCIDENT = Object.freeze({
  type: "wildfire",
  status: "evacuation_order",
  locationName: "North Glendale foothills",
  center: { lat: 34.2306, lon: -118.2504 },
  radiusMiles: 4,
});

export const FALLBACK_SAFE_LOCATIONS = Object.freeze([
  {
    id: "maple-park",
    name: "Maple Park Community Center",
    address: "820 E Maple St, Glendale, CA 91205",
    lat: 34.1378,
    lon: -118.2445,
    source: "fallback",
    note: "Demo public meeting point, not an official emergency shelter",
  },
  {
    id: "pacific-park",
    name: "Pacific Park Community Center",
    address: "501 S Pacific Ave, Glendale, CA 91204",
    lat: 34.1372,
    lon: -118.2647,
    source: "fallback",
    note: "Demo public meeting point, not an official emergency shelter",
  },
  {
    id: "glendale-civic-center",
    name: "Glendale Civic Center",
    address: "613 E Broadway, Glendale, CA 91206",
    lat: 34.1466,
    lon: -118.2483,
    source: "fallback",
    note: "Demo rendezvous point, not an official emergency shelter",
  },
]);

export function sanitizeText(value, maxLength = 120) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeName(value, fallback = "Resident") {
  const cleaned = sanitizeText(value, 60).replace(/[^\p{L}\p{N} .,'-]/gu, "");
  return cleaned || fallback;
}

export function normalizePhone(value, defaultCountryCode = US_COUNTRY_CODE) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    throw new Error("Phone number is required.");
  }

  const leadingPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");

  let normalized;
  if (leadingPlus) {
    normalized = `+${digits}`;
  } else if (digits.length === 10 && defaultCountryCode === "+1") {
    normalized = `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    normalized = `+${digits}`;
  } else {
    normalized = `${defaultCountryCode}${digits}`;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("Use a valid phone number, preferably in +1XXXXXXXXXX format.");
  }

  return normalized;
}

export function haversineMiles(a, b) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusMiles = 3958.8;

  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinLat = Math.sin(deltaLat / 2);
  const sinLon = Math.sin(deltaLon / 2);
  const h = sinLat ** 2 + Math.cos(lat1) * Math.cos(lat2) * sinLon ** 2;
  return 2 * earthRadiusMiles * Math.asin(Math.sqrt(h));
}

export function createGoogleMapsDirectionsUrl(destination) {
  const destinationValue = destination.address
    ? destination.address
    : `${destination.lat},${destination.lon}`;

  const params = new URLSearchParams({
    api: "1",
    destination: destinationValue,
    travelmode: "driving",
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function chooseFallbackSafeLocation(incident = DEFAULT_INCIDENT) {
  const scored = FALLBACK_SAFE_LOCATIONS.map((location) => ({
    ...location,
    distanceFromIncidentMiles: haversineMiles(incident.center, location),
  }));

  const outsideZone = scored
    .filter((location) => location.distanceFromIncidentMiles > incident.radiusMiles + 0.25)
    .sort((a, b) => a.distanceFromIncidentMiles - b.distanceFromIncidentMiles);

  return outsideZone[0] ?? scored.sort(
    (a, b) => b.distanceFromIncidentMiles - a.distanceFromIncidentMiles,
  )[0];
}

export function validateScenarioInput(input) {
  if (!input || typeof input !== "object") {
    throw new Error("Scenario data is required.");
  }

  const residentInput = input.resident ?? {};
  const trustedInput = input.trustedContact ?? {};
  const incidentInput = input.incident ?? {};

  const resident = {
    name: sanitizeName(residentInput.name, "Alex"),
    phone: normalizePhone(residentInput.phone),
    hasPets: Boolean(residentInput.hasPets),
    needsTransportation: Boolean(residentInput.needsTransportation),
    preferredLanguage: sanitizeText(residentInput.preferredLanguage || "English", 30),
    location: {
      lat: Number.isFinite(Number(residentInput?.location?.lat))
        ? Number(residentInput.location.lat)
        : DEFAULT_INCIDENT.center.lat,
      lon: Number.isFinite(Number(residentInput?.location?.lon))
        ? Number(residentInput.location.lon)
        : DEFAULT_INCIDENT.center.lon,
    },
  };

  const trustedContact = {
    name: sanitizeName(trustedInput.name, "Jamie"),
    phone: normalizePhone(trustedInput.phone),
  };

  if (resident.phone === trustedContact.phone) {
    throw new Error("Use two different phone numbers for the resident and trusted contact.");
  }

  const radiusMiles = Number(incidentInput.radiusMiles ?? DEFAULT_INCIDENT.radiusMiles);
  const incident = {
    type: "wildfire",
    status: "evacuation_order",
    locationName: sanitizeText(
      incidentInput.locationName || DEFAULT_INCIDENT.locationName,
      90,
    ),
    center: {
      lat: Number.isFinite(Number(incidentInput?.center?.lat))
        ? Number(incidentInput.center.lat)
        : resident.location.lat,
      lon: Number.isFinite(Number(incidentInput?.center?.lon))
        ? Number(incidentInput.center.lon)
        : resident.location.lon,
    },
    radiusMiles: Number.isFinite(radiusMiles)
      ? Math.min(Math.max(radiusMiles, 0.5), 20)
      : DEFAULT_INCIDENT.radiusMiles,
  };

  return { resident, trustedContact, incident };
}

export function buildOpeningMessage(scenario, recipientRole) {
  const { resident, trustedContact, incident, safeLocation } = scenario;
  const simulationLead = "This is Beacon with a hackathon emergency simulation.";

  if (recipientRole === "resident") {
    return [
      `Hi ${resident.name}.`,
      simulationLead,
      `A simulated wildfire evacuation order has been declared for your registered area near ${incident.locationName}.`,
      `Your registered location is inside the ${incident.radiusMiles}-mile demonstration zone.`,
      `${trustedContact.name}, your trusted contact, is also being notified.`,
      `I can explain the next steps and the demo meeting point at ${safeLocation.name}.`,
    ].join(" ");
  }

  return [
    `Hi ${trustedContact.name}.`,
    simulationLead,
    `${resident.name}, a person in your emergency circle, is inside a simulated wildfire evacuation zone near ${incident.locationName}.`,
    `${resident.name} is also being contacted.`,
    `I can share the demo meeting point at ${safeLocation.name} and explain how to support them.`,
  ].join(" ");
}

export function buildRoleInstructions(scenario, recipientRole) {
  const { resident, trustedContact, safeLocation } = scenario;
  const profileNotes = [
    resident.hasPets ? `${resident.name} has pets.` : `${resident.name} has no pets listed.`,
    resident.needsTransportation
      ? `${resident.name} may need transportation help.`
      : `${resident.name} has not indicated a transportation need.`,
  ].join(" ");

  if (recipientRole === "resident") {
    return [
      `You are speaking directly with ${resident.name}, the affected resident.`,
      `Keep instructions calm and short. Confirm that ${trustedContact.name} has been notified.`,
      profileNotes,
      `The demo meeting point is ${safeLocation.name}, ${safeLocation.address}.`,
      "Tell the caller that a clickable directions link has been sent by text.",
    ].join(" ");
  }

  return [
    `You are speaking with ${trustedContact.name}, ${resident.name}'s trusted emergency contact.`,
    `Explain that ${resident.name} has also been contacted.`,
    profileNotes,
    `The demo meeting point is ${safeLocation.name}, ${safeLocation.address}.`,
    `Encourage ${trustedContact.name} to call ${resident.name} directly and help coordinate transportation if needed.`,
    "Tell the caller that a clickable directions link has been sent by text.",
  ].join(" ");
}

export function buildCallDynamicVariables(scenario, recipientRole) {
  const { resident, trustedContact, incident, safeLocation } = scenario;
  const mapsUrl = createGoogleMapsDirectionsUrl(safeLocation);
  const recipientName = recipientRole === "resident" ? resident.name : trustedContact.name;

  return {
    recipient_role: recipientRole,
    recipient_name: recipientName,
    resident_name: resident.name,
    trusted_contact_name: trustedContact.name,
    incident_type: incident.type,
    incident_status: incident.status,
    incident_location: incident.locationName,
    incident_radius_miles: String(incident.radiusMiles),
    resident_has_pets: resident.hasPets ? "yes" : "no",
    resident_needs_transportation: resident.needsTransportation ? "yes" : "no",
    preferred_language: resident.preferredLanguage,
    safe_location_name: safeLocation.name,
    safe_location_address: safeLocation.address,
    safe_location_maps_url: mapsUrl,
    safe_location_source: safeLocation.source,
    opening_message: buildOpeningMessage(scenario, recipientRole),
    role_instructions: buildRoleInstructions(scenario, recipientRole),
    simulation_disclaimer:
      "This is a hackathon simulation, not an official emergency alert. In immediate danger, call 911 and follow local authorities.",
  };
}

export function buildEmergencySms(scenario, recipientRole) {
  const { resident, trustedContact, incident, safeLocation } = scenario;
  const mapsUrl = createGoogleMapsDirectionsUrl(safeLocation);

  if (recipientRole === "resident") {
    return [
      "BEACON HACKATHON SIMULATION",
      `Simulated wildfire evacuation near ${incident.locationName}.`,
      `Demo meeting point: ${safeLocation.name}, ${safeLocation.address}.`,
      `Directions: ${mapsUrl}`,
      `${trustedContact.name} has also been notified.`,
      "Not an official alert. Follow local authorities in a real emergency.",
    ].join("\n");
  }

  return [
    "BEACON HACKATHON SIMULATION",
    `${resident.name} is inside a simulated wildfire evacuation zone near ${incident.locationName}.`,
    `Demo meeting point: ${safeLocation.name}, ${safeLocation.address}.`,
    `Directions: ${mapsUrl}`,
    `${resident.name} has also been contacted.`,
    "Not an official alert. Follow local authorities in a real emergency.",
  ].join("\n");
}
