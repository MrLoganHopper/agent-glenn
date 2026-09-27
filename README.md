# Beacon Emergency Circle

Beacon is a hackathon MVP that turns a simulated emergency event into two coordinated communication flows:

1. The at-risk resident receives a personalized ElevenLabs voice call and an SMS with a clickable destination.
2. Their trusted contact receives a separate voice call and the same destination by SMS.

The project is intentionally small and demo-first. It uses a dependency-free Node server, one static dashboard, ElevenLabs outbound calls through the connected Twilio number, and Twilio SMS.

## What is already built

- Polished single-page demo dashboard
- Two entered phone numbers and resident profile options
- Simulated four-mile wildfire evacuation zone
- One ElevenLabs agent personalized for two call roles
- Outbound resident call
- Outbound trusted-contact call
- Resident SMS with a direct Google Maps route
- Trusted-contact SMS with the same route
- Glendale GIS MCP client with a reliable fallback
- Manual retry buttons for every call and text
- Dry-run mode for safe testing
- Input validation, consent confirmation, structured logs, and tests

## Important demo limitation

Beacon does not detect a real wildfire or create an official evacuation order. The hackathon dashboard simulates the incident. Glendale GIS can supply a nearby public resource for the demo destination, but it does not provide live evacuation instructions. Every voice call and SMS clearly identifies itself as a simulation.

## Fast setup

### 1. Requirements

- Node.js 20.11 or newer
- A Twilio account and SMS-capable Twilio phone number
- An ElevenLabs agent connected to that Twilio number
- Two Twilio-verified destination numbers while using a Twilio trial account

No npm packages are required.

### 2. Create your environment file

From this project folder on macOS or Linux:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill in:

```text
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=+1XXXXXXXXXX

ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
ELEVENLABS_PHONE_NUMBER_ID=
```

Set this when you are ready for real calls and texts:

```text
DEMO_DRY_RUN=false
```

Keep this disabled for the first run:

```text
GLENDALE_MCP_ENABLED=false
```

### 3. Find the ElevenLabs agent and phone IDs

Add only your ElevenLabs API key to `.env`, then run:

```bash
npm run discover:elevenlabs
```

Copy the printed IDs into:

```text
ELEVENLABS_AGENT_ID=
ELEVENLABS_PHONE_NUMBER_ID=
```

### 4. Upgrade the agent quality

Open [ELEVENLABS_AGENT_PROMPT.md](./ELEVENLABS_AGENT_PROMPT.md), then:

1. Select a fast GPT model in the ElevenLabs agent settings. GPT-4.1 Mini is the safest fast choice for this demo.
2. Set temperature to approximately `0.2`.
3. Paste `{{opening_message}}` into the agent's First message field.
4. Paste the supplied Beacon prompt into the System prompt field.
5. Save the agent and test an outbound call from the ElevenLabs UI.

The application sends different dynamic variables for the resident and trusted-contact calls.

### 5. Test SMS by itself

Use one Twilio-verified phone number:

```bash
npm run test:sms -- +13105551234
```

Confirm that the SMS arrives and that the Google Maps link opens.

### 6. Test the voice call by itself

```bash
npm run test:call -- +13105551234
```

The call should begin with the personalized Beacon message. Use a different placeholder trusted-contact number if your own number ends in `0000`.

### 7. Run the application

```bash
npm start
```

Open:

```text
http://localhost:8787
```

Enter two verified phone numbers, confirm consent, and press **DECLARE WILDFIRE**.

## Recommended build sequence

Use this sequence before touching GIS:

1. Run the dashboard in dry-run mode.
2. Make one Twilio SMS work.
3. Make one ElevenLabs outbound call work.
4. Run the full resident plus trusted-contact demo.
5. Rehearse the manual retry controls.
6. Add the Glendale MCP key and test GIS only after the communication flow is stable.

## Glendale GIS MCP

The code is already prepared for the organizer's MCP server.

Add:

```text
GLENDALE_MCP_ENABLED=true
GLENDALE_MCP_API_KEY=YOUR_ORGANIZER_KEY
```

Default endpoint:

```text
https://glendale-gis-mcp-1053589358088.us-west2.run.app/mcp
```

The app calls the `nearest_resources` tool and requests parks, libraries, and schools near a point outside the simulated incident radius. If initialization, authentication, parsing, or the tool call fails, Beacon automatically selects a hardcoded Glendale public meeting point. The communication flow continues.

The returned location is described as a demo public resource, never as an official emergency shelter.

## Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `DEMO_DRY_RUN` | Yes | `true` simulates calls/texts, `false` sends them |
| `TWILIO_ACCOUNT_SID` | Live SMS | Twilio account identifier |
| `TWILIO_AUTH_TOKEN` | Live SMS | Twilio secret |
| `TWILIO_FROM_NUMBER` | Live SMS | SMS-capable Twilio number in E.164 format |
| `TWILIO_MESSAGING_SERVICE_SID` | Optional | Alternative to `TWILIO_FROM_NUMBER` |
| `ELEVENLABS_API_KEY` | Live calls | ElevenLabs API key |
| `ELEVENLABS_AGENT_ID` | Live calls | Connected ElevenLabs agent ID |
| `ELEVENLABS_PHONE_NUMBER_ID` | Live calls | ElevenLabs ID for the imported Twilio number |
| `ELEVENLABS_RECORD_CALLS` | Optional | Defaults to `false` |
| `ELEVENLABS_ENABLE_OVERRIDES` | Optional | Enables runtime model override when your agent permits it |
| `ELEVENLABS_LLM_OVERRIDE` | Optional | LLM slug used only when overrides are enabled |
| `GLENDALE_MCP_ENABLED` | Optional | Enables live Glendale GIS lookup |
| `GLENDALE_MCP_API_KEY` | Optional | Organizer-provided MCP bearer token |

## API routes

### Health and setup status

```http
GET /api/health
```

The response reports which integrations are configured without exposing credentials.

### Create a demo scenario

```http
POST /api/scenarios
Content-Type: application/json
```

Example body:

```json
{
  "resident": {
    "name": "Alex",
    "phone": "+13105550123",
    "hasPets": true,
    "needsTransportation": false,
    "preferredLanguage": "English"
  },
  "trustedContact": {
    "name": "Jamie",
    "phone": "+13105550456"
  },
  "consentConfirmed": true
}
```

### Trigger one communication step

```http
POST /api/scenarios/{scenarioId}/actions/call-resident
POST /api/scenarios/{scenarioId}/actions/sms-resident
POST /api/scenarios/{scenarioId}/actions/call-trusted
POST /api/scenarios/{scenarioId}/actions/sms-trusted
```

Each action is independent. A failed voice call does not block SMS, and a failed GIS lookup does not block either communication channel.

## Demo script

1. Ask for two pre-verified phone numbers, or use two preloaded team phones.
2. Say, "Alex lives alone. Jamie is the person Alex trusts to help during an emergency."
3. Press **DECLARE WILDFIRE**.
4. Let the dashboard show the simulated incident and destination.
5. Answer the resident call and ask, "Where should I go?"
6. Open the directions SMS.
7. Answer the trusted-contact call and ask, "Who is affected and do they need help?"
8. End with, "Emergency information reaches the resident, and responsibility reaches the person who can help."

## Testing

Run:

```bash
npm test
```

The tests cover phone normalization, destination selection, Google Maps links, personalized call variables, SMS content, and the complete API flow in dry-run mode.

## Deployment

The server uses in-memory scenario state. It works locally or on a normal Node host. Serverless deployment may lose a scenario between requests, so for the live hackathon demo, local execution is the safest route.

For a public deployment, use a persistent Node process on a service such as Render, Railway, Fly.io, or a small VM. Add a database only after the demo.

## Safety and privacy

- Use only phone numbers whose owners consented to the demo.
- Keep `.env` private and out of Git.
- Do not commit Twilio or ElevenLabs credentials.
- Do not describe demo meeting points as official shelters.
- In a real emergency, users should call 911 when appropriate and follow official local instructions.
