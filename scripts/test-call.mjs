import { chooseFallbackSafeLocation, validateScenarioInput } from "../src/domain.mjs";
import { startOutboundCall } from "../src/services/elevenlabs.mjs";

const to = process.argv[2];
if (!to) {
  console.error("Usage: npm run test:call -- +13105551234");
  process.exit(1);
}

try {
  const validated = validateScenarioInput({
    resident: { name: "Alex", phone: to, hasPets: true },
    trustedContact: { name: "Jamie", phone: "+13105550000" },
  });
  const scenario = {
    id: "standalone-test",
    ...validated,
    safeLocation: chooseFallbackSafeLocation(validated.incident),
  };
  const result = await startOutboundCall({
    to: scenario.resident.phone,
    scenario,
    recipientRole: "resident",
  });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
