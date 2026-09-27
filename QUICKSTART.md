# Beacon 10-Minute Launch Checklist

## 1. Open the project folder

In PowerShell:

```powershell
cd path\to\beacon-mvp
Copy-Item .env.example .env
notepad .env
```

On macOS or Linux:

```bash
cd /path/to/beacon-mvp
cp .env.example .env
```

## 2. Paste the credentials

Required for SMS:

```text
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_FROM_NUMBER=+1...
```

Required for calls:

```text
ELEVENLABS_API_KEY=...
ELEVENLABS_AGENT_ID=...
ELEVENLABS_PHONE_NUMBER_ID=...
```

If you do not know the last two IDs, save the ElevenLabs API key first, then run:

```powershell
npm run discover:elevenlabs
```

Copy the printed values back into `.env`.

## 3. Improve the ElevenLabs agent

Open `ELEVENLABS_AGENT_PROMPT.md`.

In your ElevenLabs agent:

1. Choose GPT-4.1 Mini.
2. Set temperature near `0.2`.
3. Keep reasoning low or off.
4. Set First message to `{{opening_message}}`.
5. Paste the Beacon system prompt.
6. Save.

## 4. Test safely

Keep this value first:

```text
DEMO_DRY_RUN=true
```

Run:

```powershell
npm start
```

Open `http://localhost:8787`, enter two different test numbers, confirm consent, and run the demo. The dashboard should complete every step without making real calls.

## 5. Test one real SMS

Change:

```text
DEMO_DRY_RUN=false
```

Then run:

```powershell
npm run test:sms -- +13105551234
```

Use a Twilio-verified destination number during the trial.

## 6. Test one real call

```powershell
npm run test:call -- +13105551234
```

Confirm that the call starts with the personalized Beacon opening.

## 7. Run the live demo

```powershell
npm start
```

Open `http://localhost:8787` and use two verified phones.

## 8. Leave GIS off until calls and texts work

```text
GLENDALE_MCP_ENABLED=false
```

The dashboard will use its built-in Glendale fallback. Add the organizer key later and change the value to `true`.

## Emergency backup during judging

If one step fails, do not restart the whole demo. Use the four manual controls:

- Call resident
- Text resident
- Call trusted contact
- Text trusted contact

The remaining actions continue even when one provider returns an error.
