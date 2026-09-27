import { discoverElevenLabsResources } from "../src/services/elevenlabs.mjs";

try {
  const resources = await discoverElevenLabsResources();
  console.log("\nElevenLabs agents:\n");
  for (const agent of resources.agents) {
    console.log(`- ${agent.name || "Unnamed agent"}`);
    console.log(`  ELEVENLABS_AGENT_ID=${agent.agent_id || agent.id}`);
  }

  console.log("\nElevenLabs phone numbers:\n");
  for (const phone of resources.phoneNumbers) {
    console.log(`- ${phone.phone_number || phone.label || "Connected phone"}`);
    console.log(
      `  ELEVENLABS_PHONE_NUMBER_ID=${phone.phone_number_id || phone.id}`,
    );
  }
  console.log("");
} catch (error) {
  console.error(`Discovery failed: ${error.message}`);
  process.exitCode = 1;
}
