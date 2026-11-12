## Project title
PayPal AI Invoicing Copilot

## Short pitch (one line)
Turn plain English into real PayPal invoices, payment links and status with an AI copilot.

## Description
Freelancers and small teams lose time on invoices: opening a dashboard, filling fields, chasing
status, and doing it all again when a customer asks. The PayPal AI Invoicing Copilot collapses that into
one sentence.

You type *"Invoice Jane Cooper $1250 for brand redesign, due in 30 days" and the copilot:

1. an AI model turns the request into a typed action `{action: "create_invoice", params: {...}}`;
2. the server calls the PayPal Invoicing API (sandbox) with an OAuth2 token to create the invoice;
3. it sends the invoice and returns the PayPal-hosted link the customer pays from;
4. ask *"what invoices are outstanding?"* and it lists recent invoices with status, amount and due date.

### How it works
- The browser sends the plain-English request to a zero-dependency Node.js server.
- The server sends a strict system prompt + JSON schema to an OpenAI-compatible
  `/chat/completions` endpoint (`response_format: json_object`), and receives
  `{ action, params }` (e.g. `create_invoice` with customerName, amount, currency, description, dueDays).
- The server exchanges the PayPal sandbox client id/secret for an OAuth2 token and calls
  `/v2/invoicing/invoices` (create + send) or `/v2/checkout/orders` (payment link) or the
  Invoicing list endpoint.
- PayPal's own response (invoice id, status, `recipient_view_url`) is surfaced to the UI,
  including PayPal's own errors - failures are never silent.
- The AI layer is temperature-0 and returns a strict JSON schema, so the same sentence maps to the
  same action; the PayPal layer executes what the AI decided against the sandbox.

### Built with
- **PayPal**: PayPal REST API on the sandbox - OAuth2 `/v1/oauth2/token`, Invoicing
  `/v2/invoicing/invoices` (create, send, list) and Orders `/v2/checkout/orders`; all executed from a
  zero-dependency Node.js server that talks only to the server (credentials never reach the browser).
- **AI**: an OpenAI-compatible chat-completions endpoint with a JSON-schema system prompt that maps
  free-form requests to typed PayPal actions (create_invoice / create_order / list_invoices).
- Node.js (built-in `http` + `fetch`), a single-page UI, no runtime dependencies to install.

## What I am proud of / Built-with highlights
- **Both PayPal and AI are central**, not decorative: the AI produces the structured intent and
  PayPal executes it for real, so the demo is not a mock.
- **Zero runtime dependencies** - the HTTP server is Node's built-in `http` and outbound calls use
  the built-in `fetch`. There is nothing to `npm install`.
- **Credentials stay server-side.** API keys and the PayPal sandbox secret live in `.env`; the
  browser only talks to this server, and this server talks to PayPal and the AI provider.
- **Every response is real.** The UI surfaces PayPal's own invoice id, status and pay link, and
  PayPal's own error bodies on failure - no mocked success.

## Potential impact
- Audience: freelancers, contractors, agencies and small teams that bill on the hour.
- Problem: invoicing costs more time than the work itself, and chasing payment status means opening
  a dashboard and cross-checking fields by hand.
- The copilot removes that: one sentence in, a real PayPal invoice out, and a plain question gets
  the outstanding balance back. The same typed-action contract can be extended to send reminders,
  recurring billing or multi-currency invoicing without changing the UI.

## Innovation
The interesting part is not "an AI that types invoices". It is that the **AI output is a typed
contract**, not free-form text, and the **same contract drives real PayPal execution**. That keeps
the AI useful but bounded: it decides *what* to do*, and the PayPal layer decides *whether* and
it is allowed*, which is what keeps a demo honest when it touches real payments.

## Built with (for the Built With field)
Node.js (built-in `http`, `fetch`), PayPal REST API sandbox (OAuth2 `/v1/oauth2/token`, Invoicing
`/v2/invoicing/invoices`, Orders `/v2/checkout/orders`), an OpenAI-compatible chat-completions model,
and a single-page HTML/JS UI.

## Testing
`/api/health` shows the configuration. `/api/chat` takes `{ "message": "..." }`. The repo README has
the full setup and run instructions; a hosted URL is provided if the demo needs it. The demo is not
mocked - each action is executed against the PayPal sandbox.
