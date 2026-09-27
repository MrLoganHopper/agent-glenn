# Beacon Live Demo Script

## Opening, 20 seconds

"Emergency alerts tell people that something is wrong. They often leave families asking three urgent questions: Am I affected? Where should I go? Does the person who can help me know? Beacon turns one emergency event into coordinated action."

## Set up the two people, 15 seconds

"Alex lives alone in Glendale and has a dog. Jamie is Alex's trusted emergency contact. For this demo, both numbers are verified and both people consented to receive the calls."

Enter the two phone numbers and check **Has pets**.

## Trigger, 10 seconds

Press **DECLARE WILDFIRE**.

Say:

"We are simulating a wildfire evacuation order within four miles of Alex's registered location."

## Resident interaction, 30 to 45 seconds

Answer the resident phone and ask:

"Where should I go, and did you tell Jamie?"

Then ask:

"What should I do about my dog?"

Open the SMS and tap the Google Maps directions link.

Say:

"Beacon translated the supplied incident data into clear, personalized guidance and sent an actionable destination."

## Trusted-contact interaction, 30 to 45 seconds

Answer the trusted-contact phone and ask:

"Who is affected, and what do they need?"

Open the second SMS.

Say:

"The same event reached the person at risk and the person positioned to help. Both now have one shared destination."

## GIS explanation, 20 seconds

"The Glendale GIS MCP can identify nearby city resources using local public data. It does not contain live evacuation orders, so Beacon keeps official incident authority separate from AI explanation. If GIS is unavailable, the communication flow continues with a clearly labeled demo fallback."

## Close, 15 seconds

"Beacon is conversational last-mile infrastructure for emergency alerts. When an alert says evacuate, Beacon tells you what happens next, and tells the people who care about you that you may need them."

## Judge questions

### Is the emergency real?

"The incident is simulated for the hackathon. In production, an authorized alert feed would create the incident. The AI communicates supplied facts and never declares an emergency itself."

### Is the destination an official shelter?

"No. The prototype labels it as a demo public meeting point. A production system would consume officially designated shelters and transportation resources."

### Why voice?

"Voice reaches older adults, visually impaired residents, people under stress, and residents who may not navigate multiple emergency websites quickly. SMS provides the persistent map link."

### What is original?

"Beacon connects the resident's emergency context to a trusted human support network. It coordinates both sides of the relationship rather than sending one generic alert."

### What would you build next?

"Consent-based registration, official alert ingestion, live shelter and road data, accessibility profiles, multilingual support, and a responder-facing status view."
