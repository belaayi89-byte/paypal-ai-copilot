# PayPal AI Invoicing Copilot

**Plain English in → real PayPal invoices, payment links and payment status out.**

You type *"Invoice Jane Cooper $1250 for brand redesign, due in 30 days"* and the copilot:

1. parses your intent with an **AI** model into a structured action,
2. calls the **PayPal REST API (sandbox)** to create *and send* the invoice,
3. returns the invoice id and the PayPal-hosted link a customer can pay.

No dashboard clicking. No forms. Just say what you want billed.

Built for the **PayPal AI Hackathon**.

---

## Why it exists

Freelancers and small teams lose time on invoices — opening a dashboard, filling fields, chasing status.
The copilot collapses that into one sentence, and the payment side is real: the AI decision is executed
against PayPal, not mocked. Because the parser returns a typed action, the same UI also answers
*"what's outstanding?"* and creates shareable payment links.

## What you can say

| You say | Copilot does |
| --- | --- |
| `Invoice Jane Cooper $1250 for brand redesign, due in 30 days` | Creates + sends a PayPal invoice, returns the pay link |
| `Create a $25 payment link for a logo sketch` | Creates a PayPal order, returns the approval URL |
| `What invoices are outstanding?` | Lists recent invoices with status, amount, due date |
| `help` | Shows examples |

## How it works

```
┌──────────┐    plain English    ┌───────────────┐   structured action   ┌────────────────────┐
│  Browser │ ──────────────────▶ │  Node server  │ ────────────────────▶ │  OpenAI-compatible │
│  (UI)    │                     │  (zero deps)  │ ◀──── JSON action ──── │  chat completions  │
└────┬─────┘ ◀── result + link ──└───────┬───────┘                       └────────────────────┘
     │                                   │ OAuth2 client_credentials
     │                                   ▼
     │                        ┌─────────────────────────┐
     └──── pay link ───────── │  PayPal REST (sandbox)  │  /v2/invoicing, /v2/checkout/orders
                              └─────────────────────────┘
```

- **AI layer** — the server sends a strict system prompt + JSON schema to any OpenAI-compatible
  `/chat/completions` endpoint (`response_format: json_object`) and receives
  `{ action, params }`. Temperature is 0 so the same sentence maps to the same action.
- **PayPal layer** — the server exchanges the sandbox client id/secret for an OAuth2 token
  (`/v1/oauth2/token`) and calls the Invoicing and Orders APIs. Every response is surfaced,
  including PayPal's own error body, so failures are never silent.
- **Zero runtime dependencies** — the HTTP server uses Node's built-in `http`; outbound calls use the
  built-in `fetch`. Nothing to `npm install`, nothing to audit.

## Setup

Requires **Node.js 18+** (built-in `fetch`). Tested on Node 20+.

### 1. PayPal sandbox credentials (free)

1. Sign in at <https://developer.paypal.com/dashboard/applications/sandbox>.
2. Create a **Sandbox App** (any name).
3. Copy its **Client ID** and **Secret**.

### 2. An AI key

Any OpenAI-compatible endpoint works (OpenAI, Azure OpenAI, OpenRouter, a local vLLM, …).
You need a base URL, an API key and a model name.

### 3. Configure

```bash
cp .env.example .env
# then edit .env:
#   PAYPAL_CLIENT_ID=...
#   PAYPAL_CLIENT_SECRET=...
#   AI_API_KEY=...
#   AI_BASE_URL=https://api.openai.com/v1
#   AI_MODEL=gpt-4o-mini
```

Secrets live only in `.env` (server-side). Nothing is exposed to the browser — the UI talks to this
server, and the server talks to PayPal and the AI provider.

### 4. Run

```bash
node server.js
# open http://localhost:3000
```

## Verify it is running

```bash
curl -s localhost:3000/api/health
# {"ok":true,"paypalEnv":"sandbox","paypalConfigured":true,"aiConfigured":true,"aiModel":"gpt-4o-mini","version":"1.0.0"}
```

Then open the UI and click an example chip — you should get a real sandbox invoice with a
`recipient_view_url` you can open.

## API

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| `GET` | `/api/health` | – | configuration + version |
| `POST` | `/api/chat` | `{ "message": "..." }` | `{ ok, parsed, result }` |

`parsed` is the AI's structured action; `result` is what PayPal returned (invoice id, pay link, list, …).

## Project layout

```
paypal-ai-copilot/
├── server.js            # HTTP server, AI parser, PayPal client, actions
├── public/index.html    # single-page UI
├── .env.example         # configuration template
├── LICENSE              # MIT
└── README.md
```

## Security notes

- Credentials are read from environment variables only; `.env` is git-ignored.
- No secret is ever sent to the browser.
- The PayPal layer is sandbox-only by default (`PAYPAL_ENV=sandbox`); switch to `live` deliberately.
- Request bodies are size-capped (64 KB) and static file serving is path-confined.

## License

MIT — see [LICENSE](./LICENSE).
