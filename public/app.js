const state = {
  scenario: null,
  running: false,
  configuration: null,
};

const elements = {
  form: document.querySelector("#scenarioForm"),
  runButton: document.querySelector("#runDemoButton"),
  resetButton: document.querySelector("#resetButton"),
  notice: document.querySelector("#notice"),
  systemMode: document.querySelector("#systemMode"),
  liveDot: document.querySelector(".live-dot"),
  scenarioBadge: document.querySelector("#scenarioBadge"),
  scenarioIdLabel: document.querySelector("#scenarioIdLabel"),
  destinationCard: document.querySelector("#destinationCard"),
  destinationName: document.querySelector("#destinationName"),
  destinationAddress: document.querySelector("#destinationAddress"),
  destinationLink: document.querySelector("#destinationLink"),
  destinationSource: document.querySelector("#destinationSource"),
  manualButtons: [...document.querySelectorAll("[data-action]")],
};

const actionToStatus = {
  "call-resident": "residentCall",
  "sms-resident": "residentSms",
  "call-trusted": "trustedCall",
  "sms-trusted": "trustedSms",
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function showNotice(message, type = "warning") {
  elements.notice.textContent = message;
  elements.notice.className = `notice ${type}`;
}

function hideNotice() {
  elements.notice.className = "notice hidden";
  elements.notice.textContent = "";
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || `Request failed with HTTP ${response.status}`);
    error.payload = data;
    throw error;
  }
  return data;
}

function formPayload() {
  return {
    resident: {
      name: document.querySelector("#residentName").value,
      phone: document.querySelector("#residentPhone").value,
      hasPets: document.querySelector("#hasPets").checked,
      needsTransportation: document.querySelector("#needsTransportation").checked,
      preferredLanguage: document.querySelector("#preferredLanguage").value,
      location: { lat: 34.2306, lon: -118.2504 },
    },
    trustedContact: {
      name: document.querySelector("#trustedName").value,
      phone: document.querySelector("#trustedPhone").value,
    },
    incident: {
      type: "wildfire",
      status: "evacuation_order",
      locationName: "North Glendale foothills",
      center: { lat: 34.2306, lon: -118.2504 },
      radiusMiles: 4,
    },
    consentConfirmed: document.querySelector("#consentConfirmed").checked,
  };
}

function persistInputs() {
  const values = {
    residentName: document.querySelector("#residentName").value,
    residentPhone: document.querySelector("#residentPhone").value,
    trustedName: document.querySelector("#trustedName").value,
    trustedPhone: document.querySelector("#trustedPhone").value,
  };
  localStorage.setItem("beacon-demo-inputs", JSON.stringify(values));
}

function restoreInputs() {
  try {
    const values = JSON.parse(localStorage.getItem("beacon-demo-inputs") || "null");
    if (!values) return;
    for (const [key, value] of Object.entries(values)) {
      const input = document.querySelector(`#${key}`);
      if (input && value) input.value = value;
    }
  } catch {
    // Ignore invalid browser storage.
  }
}

function statusLabel(status) {
  if (!status) return "Waiting";
  if (status.state === "success") return status.dryRun ? "Simulated" : "Complete";
  if (status.state === "running") return "Starting";
  if (status.state === "warning") return "Fallback";
  if (status.state === "error") return "Retry";
  return "Waiting";
}

function renderScenario(scenario) {
  state.scenario = scenario;
  elements.scenarioBadge.textContent = "INCIDENT ACTIVE";
  elements.scenarioBadge.classList.add("active");
  elements.scenarioIdLabel.textContent = `Scenario ${scenario.id.slice(0, 8)}`;

  elements.destinationCard.classList.remove("muted-card");
  elements.destinationName.textContent = scenario.safeLocation.name;
  elements.destinationAddress.textContent = scenario.safeLocation.address;
  elements.destinationLink.href = scenario.mapsUrl;
  elements.destinationLink.classList.remove("hidden");
  elements.destinationSource.textContent =
    scenario.safeLocation.source === "glendale-gis-mcp" ? "LIVE GIS" : "SAFE FALLBACK";

  for (const item of document.querySelectorAll(".timeline-item")) {
    const key = item.dataset.status;
    const status = scenario.status[key];
    item.className = `timeline-item ${status?.state || "idle"}`;
    item.querySelector(".timeline-state").textContent = statusLabel(status);
    item.title = status?.message || "";
  }

  for (const button of elements.manualButtons) button.disabled = false;
}

function setLocalStatus(key, stateValue, message) {
  if (!state.scenario) return;
  state.scenario.status[key] = {
    state: stateValue,
    message,
    updatedAt: new Date().toISOString(),
  };
  renderScenario(state.scenario);
}

async function createScenario() {
  persistInputs();
  setLocalStatus("scenario", "running", "Creating scenario");
  const data = await api("/api/scenarios", {
    method: "POST",
    body: JSON.stringify(formPayload()),
  });
  renderScenario(data.scenario);
  return data.scenario;
}

async function runAction(actionName, { quiet = false } = {}) {
  if (!state.scenario) throw new Error("Create a scenario first.");
  const statusKey = actionToStatus[actionName];
  setLocalStatus(statusKey, "running", `${actionName} is starting`);

  try {
    const data = await api(`/api/scenarios/${state.scenario.id}/actions/${actionName}`, {
      method: "POST",
      body: "{}",
    });
    renderScenario(data.scenario);
    return data.result;
  } catch (error) {
    if (error.payload?.scenario) renderScenario(error.payload.scenario);
    if (!quiet) showNotice(error.message, "error");
    throw error;
  }
}

async function runFullDemo(event) {
  event.preventDefault();
  if (state.running) return;
  hideNotice();
  state.running = true;
  elements.runButton.disabled = true;
  elements.runButton.querySelector("b").textContent = "LAUNCHING BEACON";

  const failures = [];
  try {
    await createScenario();
    showNotice("Scenario created. Beacon is launching the live communication flow.", "success");

    const actionPlan = [
      ["call-resident", 900],
      ["sms-resident", 900],
      ["call-trusted", 900],
      ["sms-trusted", 0],
    ];

    for (const [action, delayAfter] of actionPlan) {
      try {
        await runAction(action, { quiet: true });
      } catch (error) {
        failures.push(`${action}: ${error.message}`);
      }
      if (delayAfter) await sleep(delayAfter);
    }

    if (failures.length) {
      showNotice(
        `The scenario stayed active, but ${failures.length} step(s) need a manual retry. Use the safety controls below.`,
        "warning",
      );
    } else {
      showNotice(
        "Beacon launched successfully. Both phones should receive their personalized call and directions.",
        "success",
      );
    }
  } catch (error) {
    showNotice(error.message, "error");
  } finally {
    state.running = false;
    elements.runButton.disabled = false;
    elements.runButton.querySelector("b").textContent = "DECLARE WILDFIRE";
  }
}

function resetDemo() {
  state.scenario = null;
  hideNotice();
  elements.scenarioBadge.textContent = "STANDBY";
  elements.scenarioBadge.classList.remove("active");
  elements.scenarioIdLabel.textContent = "No scenario created";
  elements.destinationCard.classList.add("muted-card");
  elements.destinationName.textContent = "Waiting for incident";
  elements.destinationAddress.textContent =
    "Beacon will select a destination outside the demo zone.";
  elements.destinationLink.classList.add("hidden");
  elements.destinationSource.textContent = "PENDING";
  document.querySelector("#consentConfirmed").checked = false;
  for (const item of document.querySelectorAll(".timeline-item")) {
    item.className = "timeline-item idle";
    item.querySelector(".timeline-state").textContent = "Waiting";
    item.title = "";
  }
  for (const button of elements.manualButtons) button.disabled = true;
}

async function checkHealth() {
  try {
    const data = await api("/api/health");
    state.configuration = data.configuration;
    const { dryRun, elevenLabsCalls, twilioSms } = data.configuration;

    if (dryRun) {
      elements.systemMode.textContent = "Dry-run mode active";
      elements.liveDot.classList.add("dry");
      showNotice("Dry-run mode is active. Calls and texts will be simulated until DEMO_DRY_RUN=false.");
    } else if (elevenLabsCalls.ready && twilioSms.ready) {
      elements.systemMode.textContent = "Live communication ready";
      elements.liveDot.classList.add("ready");
    } else {
      elements.systemMode.textContent = "Setup incomplete";
      const missing = [
        ...elevenLabsCalls.missing,
        ...twilioSms.missing,
      ];
      showNotice(`Add the missing environment values: ${missing.join(", ")}.`);
    }
  } catch (error) {
    elements.systemMode.textContent = "Server unavailable";
    showNotice(error.message, "error");
  }
}

elements.form.addEventListener("submit", runFullDemo);
elements.resetButton.addEventListener("click", resetDemo);
for (const button of elements.manualButtons) {
  button.addEventListener("click", async () => {
    hideNotice();
    button.disabled = true;
    try {
      await runAction(button.dataset.action);
      showNotice(`${button.textContent} started successfully.`, "success");
    } catch {
      // The shared handler already displays the error.
    } finally {
      button.disabled = false;
    }
  });
}

restoreInputs();
resetDemo();
checkHealth();
