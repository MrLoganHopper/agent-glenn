import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

const PORT = 18987;

async function waitForServer(url, attempts = 30) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch {
      // Server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Server did not start in time.");
}

test("dry-run API creates scenario and completes all communication actions", async (t) => {
  const child = spawn(process.execPath, ["src/server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      PORT: String(PORT),
      DEMO_DRY_RUN: "true",
      GLENDALE_MCP_ENABLED: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(() => child.kill("SIGTERM"));
  await waitForServer(`http://127.0.0.1:${PORT}/api/health`);

  const scenarioResponse = await fetch(`http://127.0.0.1:${PORT}/api/scenarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resident: { name: "Alex", phone: "+13105550123", hasPets: true },
      trustedContact: { name: "Jamie", phone: "+13105550456" },
      consentConfirmed: true,
    }),
  });
  assert.equal(scenarioResponse.status, 201);
  const created = await scenarioResponse.json();
  assert.ok(created.scenario.id);
  assert.match(created.scenario.mapsUrl, /google\.com\/maps\/dir/);

  for (const action of [
    "call-resident",
    "sms-resident",
    "call-trusted",
    "sms-trusted",
  ]) {
    const actionResponse = await fetch(
      `http://127.0.0.1:${PORT}/api/scenarios/${created.scenario.id}/actions/${action}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
    );
    assert.equal(actionResponse.status, 200, action);
    const payload = await actionResponse.json();
    assert.equal(payload.result.success, true);
    assert.equal(payload.result.dryRun, true);
  }
});
