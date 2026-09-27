import { sendSms } from "../src/services/twilio.mjs";

const to = process.argv[2];
if (!to) {
  console.error("Usage: npm run test:sms -- +13105551234");
  process.exit(1);
}

try {
  const result = await sendSms({
    to,
    body: [
      "BEACON HACKATHON TEST",
      "Your Twilio SMS connection is working.",
      "Directions: https://www.google.com/maps/dir/?api=1&destination=820%20E%20Maple%20St%2C%20Glendale%2C%20CA%2091205&travelmode=driving",
    ].join("\n"),
  });
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
