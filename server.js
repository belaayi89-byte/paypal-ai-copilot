/**
 * PayPal AI Invoicing Copilot — zero-dependency Node.js server.
 *
 * Turn natural-language instructions into real PayPal actions on the sandbox:
 *   "Invoice John Doe $500 for web design, due in 30 days"  -> creates + sends an invoice
 *   "What invoices are outstanding?"                        -> lists open invoices
 *   "Create a $25 payment link for a logo sketch"           -> creates an order link
 *
 * AI  : any OpenAI-compatible chat-completions endpoint (env: AI_BASE_URL, AI_API_KEY, AI_MODEL)
 * PayPal: REST sandbox (env: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_ENV=sandbox)
 *
 * Run:  cp .env.example .env  &&  node server.js
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---- tiny .env loader (zero deps) -----------------------------------------
(function loadDotEnv() {
  const p = path.join(__dirname, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

const PORT = process.env.PORT || 3000;
const PAYPAL_ENV = (process.env.PAYPAL_ENV || 'sandbox').toLowerCase();
const PAYPAL_API = PAYPAL_ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';
const AI_BASE_URL = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
const AI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

// ---- PayPal REST helpers ---------------------------------------------------
let tokenCache = { token: '', exp: 0 };

async function paypalToken() {
  const { PAYPAL_CLIENT_ID: id, PAYPAL_CLIENT_SECRET: secret } = process.env;
  if (!id || !secret) throw new Error('PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET not set');
  if (tokenCache.token && Date.now() < tokenCache.exp) return tokenCache.token;

  const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`paypal oauth ${res.status}: ${JSON.stringify(data)}`);
  tokenCache = { token: data.access_token, exp: Date.now() + (data.expires_in - 60) * 1000 };
  return tokenCache.token;
}

async function paypal(method, endpoint, body) {
  const token = await paypalToken();
  const res = await fetch(`${PAYPAL_API}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`paypal ${method} ${endpoint} -> ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// ---- AI: natural language -> structured action -----------------------------
const ACTION_SCHEMA = `{
  "action": "create_invoice" | "list_invoices" | "create_order" | "help",
  "params": {
    "customerName": string,        // create_invoice
    "customerEmail": string|null,  // create_invoice (optional)
    "amount": number,              // create_invoice | create_order
    "currency": string,            // ISO code, default "USD"
    "description": string,         // item description
    "dueDays": number,             // create_invoice, default 30
    "note": string                 // optional
  }
}`;

async function aiParse(userMessage) {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) throw new Error('AI_API_KEY not set');

  const system = [
    'You are the parser for a PayPal invoicing copilot.',
    'Convert the user request into ONE JSON object matching this schema:',
    ACTION_SCHEMA,
    'Rules:',
    '- Reply with JSON only. No prose, no markdown fences.',
    '- Use create_invoice when the user wants to bill someone.',
    '- Use list_invoices when the user asks about existing/outstanding invoices.',
    '- Use create_order when the user wants a simple shareable payment link.',
    '- Use help when the intent is unclear.',
    '- Defaults: currency "USD", dueDays 30.',
  ].join('\n');

  const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: AI_MODEL,
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMessage },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`ai ${res.status}: ${JSON.stringify(data)}`);
  const content = data.choices?.[0]?.message?.content || '{}';
  return JSON.parse(content);
}

// ---- Actions ---------------------------------------------------------------
function isoDatePlusDays(days) {
  const d = new Date(Date.now() + days * 86400000);
  return d.toISOString().slice(0, 10);
}

async function createInvoice(p) {
  const amount = Number(p.amount);
  if (!(amount > 0)) throw new Error('amount must be > 0');
  const currency = (p.currency || 'USD').toUpperCase();
  const dueDays = Number(p.dueDays) || 30;

  const name = String(p.customerName || '').trim();
  const [first, ...rest] = name.split(/\s+/).filter(Boolean);
  const recipient = first
    ? { name: { given_name: first, surname: rest.join(' ') || undefined } }
    : undefined;
  if (p.customerEmail) recipient.email_address = String(p.customerEmail);

  const draft = {
    detail: {
      currency_code: currency,
      note: p.note || undefined,
      payment_term: { term_type: 'DUE_ON_DATE_SPECIFIED', due_date: isoDatePlusDays(dueDays) },
    },
    invoicer: {},
    primary_recipients: recipient ? [{ billing_info: { name: recipient.name, email_address: recipient.email_address } }] : [],
    items: [
      {
        name: String(p.description || 'Services').slice(0, 100),
        quantity: '1',
        unit_amount: { currency_code: currency, value: amount.toFixed(2) },
      },
    ],
  };

  const created = await paypal('POST', '/v2/invoicing/invoices', draft);
  const invoiceId = created.id || created.href?.split('/').pop();

  let sent = null;
  try {
    sent = await paypal('POST', `/v2/invoicing/invoices/${invoiceId}/send`, {
      send_to_recipient: true,
      send_to_invoicer: false,
    });
  } catch (e) {
    sent = { error: String(e.message || e) };
  }

  const detail = await paypal('GET', `/v2/invoicing/invoices/${invoiceId}`).catch(() => null);
  return {
    invoiceId,
    status: detail?.status || 'DRAFT',
    recipientViewUrl: detail?.detail?.metadata?.recipient_view_url || null,
    invoicerViewUrl: detail?.detail?.metadata?.invoicer_view_url || null,
    sent,
  };
}

async function listInvoices() {
  const data = await paypal('GET', '/v2/invoicing/invoices?page=1&page_size=10&total_required=true');
  const items = (data.items || []).map((inv) => ({
    id: inv.id,
    status: inv.status,
    invoiceNumber: inv.detail?.invoice_number,
    currency: inv.detail?.currency_code,
    recipient: inv.primary_recipients?.[0]?.billing_info?.name?.given_name || '(no name)',
    recipientEmail: inv.primary_recipients?.[0]?.billing_info?.email_address || null,
    total: inv.amount?.value,
    dueDate: inv.detail?.payment_term?.due_date,
  }));
  return { total: data.total_items ?? items.length, invoices: items };
}

async function createOrder(p) {
  const amount = Number(p.amount);
  if (!(amount > 0)) throw new Error('amount must be > 0');
  const currency = (p.currency || 'USD').toUpperCase();

  const order = await paypal('POST', '/v2/checkout/orders', {
    intent: 'CAPTURE',
    purchase_units: [
      {
        description: String(p.description || 'Payment').slice(0, 127),
        amount: { currency_code: currency, value: amount.toFixed(2) },
      },
    ],
    application_context: { shipping_preference: 'NO_SHIPPING', user_action: 'PAY_NOW' },
  });

  const approve = (order.links || []).find((l) => l.rel === 'approve' || l.rel === 'payer-action');
  return {
    orderId: order.id,
    status: order.status,
    amount: amount.toFixed(2),
    currency,
    description: String(p.description || 'Payment').slice(0, 127),
    approvalUrl: approve?.href || null,
  };
}

async function runAction(parsed) {
  switch (parsed.action) {
    case 'create_invoice': return { type: 'create_invoice', data: await createInvoice(parsed.params || {}) };
    case 'list_invoices': return { type: 'list_invoices', data: await listInvoices() };
    case 'create_order': return { type: 'create_order', data: await createOrder(parsed.params || {}) };
    default: return { type: 'help', data: {
      examples: [
        'Invoice John Doe $500 for web design, due in 30 days',
        'Create a $25 payment link for a logo sketch',
        'What invoices are outstanding?',
      ],
    } };
  }
}

// ---- HTTP server -----------------------------------------------------------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

function sendJSON(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req, limit = 1024 * 64) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('payload too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  // API: health
  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJSON(res, 200, {
      ok: true,
      paypalEnv: PAYPAL_ENV,
      paypalConfigured: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
      aiConfigured: Boolean(process.env.AI_API_KEY),
      aiModel: AI_MODEL,
      version: '1.0.0',
    });
  }

  // API: natural-language -> action -> PayPal
  if (req.method === 'POST' && url.pathname === '/api/chat') {
    try {
      const raw = await readBody(req);
      const { message } = JSON.parse(raw || '{}');
      if (!message || !String(message).trim()) return sendJSON(res, 400, { error: 'message required' });

      const parsed = await aiParse(String(message));
      const result = await runAction(parsed);
      return sendJSON(res, 200, { ok: true, parsed, result });
    } catch (e) {
      return sendJSON(res, 500, { ok: false, error: String(e.message || e) });
    }
  }

  // static
  let file = url.pathname === '/' ? '/index.html' : url.pathname;
  file = path.normalize(file).replace(/^(\.\.[/\\])+/, '');
  const full = path.join(__dirname, 'public', file);
  if (!full.startsWith(path.join(__dirname, 'public'))) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
    res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log(`PayPal AI Invoicing Copilot -> http://localhost:${PORT}`);
  console.log(`  paypal env : ${PAYPAL_ENV}`);
  console.log(`  ai model   : ${AI_MODEL}`);
});

module.exports = { server, aiParse, createInvoice, listInvoices, createOrder, runAction };
