## DEMO VIDEO SCRIPT — under 3 minutes

Record in this order (screen + voice-over). Total target: 2:30–2:50.

---

[0:00–0:20] — HOOK
On screen: the chat UI with one example chip visible.
Say: "Freelancers lose an hour a week to invoices — opening dashboards, filling forms, chasing status."

[0:20–0:50] — SHOW IT: PLAIN ENGLISH -> REAL INVOICE
Type: "Invoice Jane Cooper 1250 dollars for brand redesign, due in 30 days"
Send. Show the response:
  - the AI-parsed action (create_invoice, amount 1250, due 30d)
  - the PayPal sandbox invoice id + "View invoice" link opening the real PayPal-hosted invoice.
Say: "One sentence. The AI turns it into a structured action, and the copilot calls the PayPal sandbox and sends a real invoice — no dashboard, no forms."

[0:50–1:20] — SHOW IT: PAYMENT LINK + STATUS
Type: "Create a $25 payment link for a logo sketch"
Send. Show the approval URL opening.
Then type: "What invoices are outstanding?"
Show the list with status + amount + due date.
Say: "It also lists outstanding invoices and creates shareable payment links."

[1:20–1:50] — HOW IT WORKS (one diagram)
On screen: the architecture slide.
  Browser -> Node server (zero deps) -> OpenAI-compatible chat completions (structured action)
                                          -> PayPal REST sandbox (OAuth2 + Invoicing + Orders)
Say: "The AI returns a typed action, and the server executes it against PayPal. Every response is surfaced, including PayPal's own errors — never silent."

[1:50–2:20] — WHY IT MATTERS
On screen: a short list.
Say: "It meaningfully uses both PayPal and AI: the AI does intent parsing, PayPal executes the payment.
It targets freelancers and small teams, and every response is verified - the copilot surfaces
PayPal's own status, not a mocked one."

[2:20–2:45] — CLOSE
On screen: the GitHub repo page + the MIT license.
Say: "Open source, MIT licensed, repo and setup instructions in the description.
PayPal AI Invoicing Copilot - plain English in, real payments out."

[2:45–2:50] — END CARD
Logo + "PayPal AI Invoicing Copilot" + repo link.

---

## RECORDING TIPS
- 1920x1080, zoom the input box and the JSON response a little.
- No third-party music. PayPal wordmark is fine to show as the sandbox UI.
- Say "PayPal" and "AI" explicitly (judges check the description, Built With and video).
- Do not hide API keys - keep the input box and the .env out of frame.
