# Beacon MVP Specification

## Product sentence

When a simulated emergency affects someone, Beacon calls that resident, alerts their trusted contact, and texts both people a shared destination they can open immediately in Google Maps.

## Demo actors

- Resident: person inside the simulated four-mile wildfire zone
- Trusted contact: person registered to help the resident
- Presenter: creates the scenario from the Beacon dashboard

## Required visible journey

1. Presenter enters two consented, verified phone numbers.
2. Presenter marks resident profile needs, including pets or transportation.
3. Presenter declares the simulated wildfire.
4. Dashboard creates the incident and selects a demo meeting point.
5. Resident receives a personalized ElevenLabs call.
6. Resident receives a Twilio SMS with a clickable Google Maps link.
7. Trusted contact receives a role-specific ElevenLabs call.
8. Trusted contact receives the same destination by SMS.
9. Presenter can retry any failed step independently.

## Technical stack

- Node.js built-in HTTP server
- Static HTML, CSS, and browser JavaScript
- ElevenLabs outbound-call API
- Twilio Programmable Messaging REST API
- Google Maps directions URL
- Optional Glendale GIS MCP streamable HTTP client
- In-memory scenario state

## Non-goals

- Real emergency declaration
- Real-time wildfire ingestion
- Real resident location tracking
- Native mobile application
- Authentication
- Production database
- Official shelter designation
- iMessage, WhatsApp, or call merging
- First-responder dashboard

## Reliability contract

- GIS failure selects a known Glendale fallback.
- Resident call failure does not block resident SMS.
- Resident communication failure does not block trusted-contact communication.
- Every action has a manual retry button.
- Dry-run mode exercises the entire interface without external side effects.
- Every communication identifies the scenario as a hackathon simulation.

## Completion criteria

The MVP is ready when two verified phones can receive the correct role-specific call and SMS, and the SMS link opens driving directions to the selected demo meeting point.
