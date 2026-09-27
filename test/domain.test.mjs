import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_INCIDENT,
  buildCallDynamicVariables,
  buildEmergencySms,
  chooseFallbackSafeLocation,
  createGoogleMapsDirectionsUrl,
  haversineMiles,
  normalizePhone,
  validateScenarioInput,
} from "../src/domain.mjs";

function scenarioFixture() {
  const validated = validateScenarioInput({
    resident: {
      name: "Alex",
      phone: "3105550123",
      hasPets: true,
      needsTransportation: false,
    },
    trustedContact: { name: "Jamie", phone: "3105550456" },
  });
  return {
    id: "fixture",
    ...validated,
    safeLocation: chooseFallbackSafeLocation(validated.incident),
  };
}

test("normalizes common US phone formats", () => {
  assert.equal(normalizePhone("(310) 555-0123"), "+13105550123");
  assert.equal(normalizePhone("1-310-555-0123"), "+13105550123");
  assert.equal(normalizePhone("+44 20 7946 0958"), "+442079460958");
});

test("rejects matching resident and trusted-contact numbers", () => {
  assert.throws(
    () =>
      validateScenarioInput({
        resident: { phone: "+13105550123" },
        trustedContact: { phone: "+13105550123" },
      }),
    /different phone numbers/,
  );
});

test("fallback destination is outside the demonstration zone", () => {
  const location = chooseFallbackSafeLocation(DEFAULT_INCIDENT);
  const distance = haversineMiles(DEFAULT_INCIDENT.center, location);
  assert.ok(distance > DEFAULT_INCIDENT.radiusMiles);
});

test("Google Maps URL is directly clickable", () => {
  const url = createGoogleMapsDirectionsUrl({
    address: "820 E Maple St, Glendale, CA 91205",
  });
  assert.ok(url.startsWith("https://www.google.com/maps/dir/?"));
  assert.match(url, /destination=820\+E\+Maple/);
  assert.match(url, /travelmode=driving/);
});

test("resident SMS contains meeting point, maps URL, and simulation label", () => {
  const body = buildEmergencySms(scenarioFixture(), "resident");
  assert.match(body, /BEACON HACKATHON SIMULATION/);
  assert.match(body, /Demo meeting point:/);
  assert.match(body, /google\.com\/maps\/dir/);
  assert.match(body, /Jamie has also been notified/);
});

test("call variables personalize resident and trusted-contact context", () => {
  const scenario = scenarioFixture();
  const resident = buildCallDynamicVariables(scenario, "resident");
  const trusted = buildCallDynamicVariables(scenario, "trusted_contact");
  assert.equal(resident.recipient_name, "Alex");
  assert.equal(trusted.recipient_name, "Jamie");
  assert.match(resident.opening_message, /inside the 4-mile demonstration zone/);
  assert.match(trusted.role_instructions, /trusted emergency contact/);
});
