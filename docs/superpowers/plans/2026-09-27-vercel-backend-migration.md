# Spostamento backend pagamenti su Vercel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the 5 existing payment/ChatGPT Cloud Functions from Firebase Functions (blocked on the Blaze plan) to Vercel Node.js Functions, with zero behavior change for users, and get the OpenAI key out of the compiled APK.

**Architecture:** Five independent Vercel Functions under `functions/api/*.js` (Node.js runtime, classic `(req, res)` handler style — same shape as the current Firebase `onRequest` handlers), sharing three small `_lib/` helper modules (Firestore access, CORS headers, raw-body reading). Same Firestore database as today, reached via `firebase-admin` with a service-account credential instead of Cloud Functions' automatic credentials. Secrets move from Firebase Secret Manager to Vercel Environment Variables.

**Tech Stack:** Node.js 20, `firebase-admin` ^12.6.0, `stripe` ^17.3.0 (both already in use — no new dependencies). Vercel Node.js runtime (confirmed current as of 2026-08/09 Vercel docs: classic `(request, response)` handlers with `request.query`/`request.body`/`response.status()`/`.json()`/`.send()` helpers remain fully supported; files/folders prefixed with `_` under `/api` are excluded from routing — used for the shared lib).

**Spec:** `docs/superpowers/specs/2026-09-27-vercel-backend-migration-design.md`

## Global Constraints

- Never require a credit card anywhere in the stack — this is why Vercel was chosen over Blaze/Render/Railway (from spec).
- All 5 endpoints (`createCheckoutSession`, `cancelSubscription`, `paymentResult`, `stripeWebhook`, `generateArticle`) move; none stay on Firebase (from spec).
- `generateArticle` gets wired into the client (the Admin "Genera con ChatGPT" button), not just deployed unused (from spec).
- No change to Firestore data model, Stripe products/prices, or the rest of the app (from spec, "Fuori scope").
- Keep the top-level `functions/` folder name as-is; only its contents change (from spec, "Fuori scope").
- No secret value (Stripe keys, OpenAI key, Firebase service-account JSON) ever appears in a file committed to git — env vars only (from spec).
- `stripeWebhook` must verify the Stripe signature against the **raw, unparsed** request body — Firebase Functions v2 gave this automatically via `req.rawBody`; Vercel does not, and this is the single most safety-critical detail in this migration.

## Review Focus

- **Stripe webhook body already consumed before signature check** → if any code path in `stripeWebhook.js` touches `req.body` or otherwise reads the request before `getRawBody(req)` runs, the raw stream is drained and signature verification breaks silently (every webhook call returns 400). Task 5's manual test exercises this directly with a real Stripe CLI/test event.
- **Vercel cold start re-initializing Firebase Admin** → calling `admin.initializeApp()` twice in the same warm container throws. `_lib/firebaseAdmin.js` guards with `if (!admin.apps.length)`. This can't be honestly smoke-tested without real credentials (Task 1's check only confirms the module loads), so it's verified for real in Task 9: every test payment and every webhook delivery reuses the same warm container's `getDb()`, so a broken guard would surface as a failure on the second call onward, not just the first.
- **Email case/whitespace mismatch against Firestore doc IDs** → the original code always does `String(email).toLowerCase().trim()` before using it as a Firestore doc ID; every ported handler must keep this exact normalization or existing users' Premium status stops matching. Verified by code review against the original in each task.
- **CORS preflight (OPTIONS) not short-circuited** → any endpoint the browser/webview calls directly (`createCheckoutSession`, `cancelSubscription`, `generateArticle`) must return 204 on `OPTIONS` before touching Stripe/Firestore, or the browser blocks the real request. Kept identical to the original in Tasks 2, 3, 6.
- **Missing/malformed environment variable at runtime** → if `FIREBASE_SERVICE_ACCOUNT` isn't valid JSON, or a Stripe/OpenAI key is unset, handlers must fail with a clear `500 {error: ...}` rather than an opaque crash. The existing try/catch-and-report pattern from the original code is preserved in every task, so this falls out of the porting itself.

---

## File Structure

**Create:**
- `functions/api/_lib/firebaseAdmin.js` — lazy Firebase Admin init + `getDb()`, shared by 3 endpoints
- `functions/api/_lib/cors.js` — shared `setCors(res)` helper
- `functions/api/_lib/rawBody.js` — shared `getRawBody(req)` stream reader (webhook only, but kept isolated/testable)
- `functions/api/createCheckoutSession.js`
- `functions/api/cancelSubscription.js`
- `functions/api/paymentResult.js`
- `functions/api/stripeWebhook.js`
- `functions/api/generateArticle.js`

**Modify:**
- `functions/package.json` — drop `firebase-functions` (no longer used), drop Firebase-specific `scripts`
- `functions/README.md` — full rewrite: Vercel setup instead of Firebase CLI steps
- `src/App.jsx` — `FUNCTIONS_BASE` constant, remove `OPENAI_API_KEY` placeholder block, rewrite `genArticle`
- `codemagic.yaml` — remove the now-unused OpenAI key injection step

**Delete:**
- `functions/index.js` (fully superseded by `functions/api/*.js`)
- `firebase.json` (only contained the now-meaningless `functions.source` pointer)

---

### Task 1: Shared library modules

**Files:**
- Create: `functions/api/_lib/firebaseAdmin.js`
- Create: `functions/api/_lib/cors.js`
- Create: `functions/api/_lib/rawBody.js`
- Modify: `functions/package.json`

**Interfaces:**
- Produces: `getDb()` → Firestore instance (from `_lib/firebaseAdmin.js`), used by Tasks 2, 3, 5
- Produces: `setCors(res)` → sets 3 CORS headers on the response, no return value (from `_lib/cors.js`), used by Tasks 2, 3, 6
- Produces: `getRawBody(req)` → `Promise<Buffer>` of the full request body (from `_lib/rawBody.js`), used by Task 5

- [ ] **Step 1: Write `functions/api/_lib/firebaseAdmin.js`**

```javascript
// Init condiviso di Firebase Admin per le funzioni su Vercel.
// Fuori da Cloud Functions non ci sono credenziali automatiche: serve la
// service account key del progetto Firebase, passata come variabile
// d'ambiente FIREBASE_SERVICE_ACCOUNT (contenuto JSON, mai nel codice).
const admin = require("firebase-admin");

function getDb() {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  return admin.firestore();
}

module.exports = { getDb };
```

- [ ] **Step 2: Write `functions/api/_lib/cors.js`**

```javascript
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = { setCors };
```

- [ ] **Step 3: Write `functions/api/_lib/rawBody.js`**

```javascript
// Legge il corpo grezzo (non ancora interpretato) di una richiesta.
// IMPORTANTE: chi usa questa funzione non deve MAI leggere req.body prima
// di chiamarla — su Vercel req.body è un getter "pigro": basta leggerlo
// una volta per consumare lo stream, e questa funzione troverebbe lo
// stream già vuoto.
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = { getRawBody };
```

- [ ] **Step 4: Update `functions/package.json`**

Replace the entire file with:

```json
{
  "name": "bt-functions",
  "description": "Backend pagamenti Stripe + ChatGPT per B&T (Vercel Functions)",
  "private": true,
  "engines": {
    "node": "20"
  },
  "dependencies": {
    "firebase-admin": "^12.6.0",
    "stripe": "^17.3.0"
  }
}
```

(Drops `firebase-functions` — nothing here uses it anymore — and the Firebase-specific `main`/`scripts` fields, which no longer apply.)

- [ ] **Step 5: Install dependencies and smoke-test the shared modules**

Run:
```bash
cd functions && npm install
node -e "
const { getDb } = require('./api/_lib/firebaseAdmin.js');
const { setCors } = require('./api/_lib/cors.js');
const { getRawBody } = require('./api/_lib/rawBody.js');
console.log(typeof getDb, typeof setCors, typeof getRawBody);
"
```
Expected: `npm install` completes with no errors, and the script prints `function function function` (confirms all three modules load and export correctly — this does not call `getDb()`, which needs `FIREBASE_SERVICE_ACCOUNT` to be set, only that requiring the file works).

- [ ] **Step 6: Commit**

```bash
git add functions/api/_lib functions/package.json functions/package-lock.json
git commit -m "Aggiunge i moduli condivisi per le funzioni su Vercel (Firestore, CORS, raw body)"
```

---

### Task 2: `createCheckoutSession`

**Files:**
- Create: `functions/api/createCheckoutSession.js`

**Interfaces:**
- Consumes: `getDb()` from `_lib/firebaseAdmin.js`; `setCors(res)` from `_lib/cors.js`
- Produces: `POST /api/createCheckoutSession` — request `{email, plan: "monthly"|"annual"}` → response `{url}` (Stripe Checkout URL) or `{error}`. Consumed by Task 7 (`src/App.jsx`'s `FUNCTIONS_BASE` call site).

- [ ] **Step 1: Write `functions/api/createCheckoutSession.js`**

```javascript
// Crea una sessione di pagamento Stripe Checkout. Chiamata dall'app quando
// l'utente tocca "ABBONATI". Ritorna { url } da aprire. Stessa logica
// dell'originale functions/index.js (Firebase), solo il "vestito" cambia.
const Stripe = require("stripe");
const { getDb } = require("./_lib/firebaseAdmin");
const { setCors } = require("./_lib/cors");

const PLANS = {
  monthly: { amountCents: 299, interval: "month", label: "B&T Premium — Mensile" },
  annual: { amountCents: 2499, interval: "year", label: "B&T Premium — Annuale" },
};

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non permesso" });

  try {
    const { email, plan } = req.body || {};
    const planDef = PLANS[plan];
    if (!email || !planDef) {
      return res.status(400).json({ error: "email e plan (monthly|annual) sono obbligatori" });
    }
    const ek = String(email).toLowerCase().trim();

    const db = getDb();
    const userRef = db.collection("users").doc(ek);
    const userSnap = await userRef.get();
    if (!userSnap.exists) return res.status(404).json({ error: "Utente non trovato" });
    const userData = userSnap.data();

    const stripe = Stripe(process.env.STRIPE_SECRET);

    let customerId = userData.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({ email: ek, metadata: { btEmail: ek } });
      customerId = customer.id;
      await userRef.set({ stripeCustomerId: customerId }, { merge: true });
    }

    const origin = `https://${req.headers.host}`;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: { name: planDef.label },
            unit_amount: planDef.amountCents,
            recurring: { interval: planDef.interval },
          },
          quantity: 1,
        },
      ],
      metadata: { btEmail: ek, btPlan: plan },
      subscription_data: { metadata: { btEmail: ek, btPlan: plan } },
      success_url: `${origin}/api/paymentResult?ok=1`,
      cancel_url: `${origin}/api/paymentResult?ok=0`,
    });

    res.json({ url: session.url });
  } catch (e) {
    console.error("createCheckoutSession error", e);
    res.status(500).json({ error: e.message || "Errore interno" });
  }
};
```

Note the one real change from the original: `success_url`/`cancel_url` are built from `req.headers.host` (the domain Vercel is actually serving on) instead of the hardcoded Firebase `REGION`/`PROJECT_ID` — there is no equivalent fixed region/project concept on Vercel, and this is simpler and self-correcting if the domain ever changes.

- [ ] **Step 2: Syntax/load check**

Run:
```bash
cd functions && node -e "const h = require('./api/createCheckoutSession.js'); console.log(typeof h)"
```
Expected: prints `function` (confirms no syntax errors and the module loads).

- [ ] **Step 3: Commit**

```bash
git add functions/api/createCheckoutSession.js
git commit -m "Porta createCheckoutSession su Vercel"
```

---

### Task 3: `cancelSubscription`

**Files:**
- Create: `functions/api/cancelSubscription.js`

**Interfaces:**
- Consumes: `getDb()`, `setCors(res)`
- Produces: `POST /api/cancelSubscription` — request `{email}` → response `{ok: true}` or `{error}`. Consumed by Task 7.

- [ ] **Step 1: Write `functions/api/cancelSubscription.js`**

```javascript
// Disdice l'abbonamento Stripe attivo. Chiamata quando l'utente tocca
// "Disdici abbonamento" nel profilo. Stessa logica dell'originale.
const Stripe = require("stripe");
const { getDb } = require("./_lib/firebaseAdmin");
const { setCors } = require("./_lib/cors");

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non permesso" });

  try {
    const { email } = req.body || {};
    if (!email) return res.status(400).json({ error: "email obbligatoria" });
    const ek = String(email).toLowerCase().trim();

    const db = getDb();
    const userRef = db.collection("users").doc(ek);
    const snap = await userRef.get();
    const data = snap.exists ? snap.data() : null;

    if (data?.stripeSubscriptionId) {
      const stripe = Stripe(process.env.STRIPE_SECRET);
      await stripe.subscriptions.cancel(data.stripeSubscriptionId).catch((e) => {
        console.warn("Stripe subscription cancel failed (proseguo comunque)", e.message);
      });
    }

    await userRef.set({ isPremium: false, plan: "free" }, { merge: true });
    res.json({ ok: true });
  } catch (e) {
    console.error("cancelSubscription error", e);
    res.status(500).json({ error: e.message || "Errore interno" });
  }
};
```

- [ ] **Step 2: Syntax/load check**

Run:
```bash
cd functions && node -e "const h = require('./api/cancelSubscription.js'); console.log(typeof h)"
```
Expected: prints `function`.

- [ ] **Step 3: Commit**

```bash
git add functions/api/cancelSubscription.js
git commit -m "Porta cancelSubscription su Vercel"
```

---

### Task 4: `paymentResult`

**Files:**
- Create: `functions/api/paymentResult.js`

**Interfaces:**
- Produces: `GET /api/paymentResult?ok=1|0` → static HTML confirmation page. Used as the Stripe Checkout `success_url`/`cancel_url` target (set in Task 2).

- [ ] **Step 1: Write `functions/api/paymentResult.js`**

```javascript
// Pagina di ritorno da Stripe Checkout. Nessun segreto, nessun Firestore:
// serve solo un feedback immediato nel browser/in-app browser mentre
// l'app rileva l'esito vero facendo polling su Firestore.
module.exports = (req, res) => {
  const ok = req.query.ok === "1";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(`<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>B&T</title>
<style>
  body{background:#0d0d0d;color:#fff;font-family:system-ui,-apple-system,sans-serif;
    display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;
    text-align:center;padding:24px}
  h1{font-style:italic;font-weight:900;font-size:22px}
  p{color:#aaa;font-size:14px;line-height:1.6}
</style></head><body><div>
<h1>${ok ? "Pagamento completato ✅" : "Pagamento annullato"}</h1>
<p>${ok
    ? "Torna all'app B&T: l'abbonamento Premium si attiverà entro pochi secondi."
    : "Puoi tornare all'app B&T e riprovare quando vuoi."}</p>
</div></body></html>`);
};
```

- [ ] **Step 2: Syntax/load check**

Run:
```bash
cd functions && node -e "const h = require('./api/paymentResult.js'); console.log(typeof h)"
```
Expected: prints `function`.

- [ ] **Step 3: Commit**

```bash
git add functions/api/paymentResult.js
git commit -m "Porta paymentResult su Vercel"
```

---

### Task 5: `stripeWebhook` (the critical one)

**Files:**
- Create: `functions/api/stripeWebhook.js`

**Interfaces:**
- Consumes: `getDb()` from `_lib/firebaseAdmin.js`; `getRawBody(req)` from `_lib/rawBody.js`
- Produces: `POST /api/stripeWebhook` — called by Stripe directly (not by the app). Registered manually in the Stripe dashboard once this is live (same step 6 as the existing README already describes, just a new URL).

- [ ] **Step 1: Write `functions/api/stripeWebhook.js`**

```javascript
// L'UNICA cosa che rende davvero Premium un utente: Stripe chiama questo
// endpoint quando un pagamento va a buon fine (o un abbonamento viene
// cancellato/fallisce). CRITICO: questo handler non deve MAI leggere
// req.body — solo getRawBody(req) — altrimenti la verifica della firma
// Stripe fallisce sempre (vedi commento in _lib/rawBody.js).
const Stripe = require("stripe");
const { getDb } = require("./_lib/firebaseAdmin");
const { getRawBody } = require("./_lib/rawBody");

module.exports = async (req, res) => {
  const stripe = Stripe(process.env.STRIPE_SECRET);
  const rawBody = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Firma webhook non valida", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    const db = getDb();

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const email = session.metadata?.btEmail;
      const plan = session.metadata?.btPlan || "monthly";
      if (email) {
        await db.collection("users").doc(email).set(
          {
            isPremium: true,
            plan,
            premiumSince: new Date().toISOString(),
            stripeCustomerId: session.customer,
            stripeSubscriptionId: session.subscription,
          },
          { merge: true }
        );
        console.log(`Premium attivato per ${email} (${plan})`);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      const email = sub.metadata?.btEmail;
      if (email) {
        await db.collection("users").doc(email).set({ isPremium: false, plan: "free" }, { merge: true });
        console.log(`Premium disattivato per ${email} (abbonamento cancellato)`);
      }
    }

    if (event.type === "invoice.payment_failed") {
      console.warn("Pagamento fallito", event.data.object.customer);
    }

    res.json({ received: true });
  } catch (e) {
    console.error("stripeWebhook handler error", e);
    res.status(500).send("Errore interno");
  }
};
```

- [ ] **Step 2: Syntax/load check**

Run:
```bash
cd functions && node -e "const h = require('./api/stripeWebhook.js'); console.log(typeof h)"
```
Expected: prints `function`.

- [ ] **Step 3: Confirm the handler never touches `req.body`**

Run:
```bash
grep -n "req.body\|request.body" functions/api/stripeWebhook.js
```
Expected: **no output** (no match). If anything matches, the raw-body read will break — remove the match before continuing.

- [ ] **Step 4: Commit**

```bash
git add functions/api/stripeWebhook.js
git commit -m "Porta stripeWebhook su Vercel, con lettura del corpo grezzo per la firma"
```

---

### Task 6: `generateArticle`

**Files:**
- Create: `functions/api/generateArticle.js`

**Interfaces:**
- Consumes: `setCors(res)`
- Produces: `POST /api/generateArticle` — request `{title, summary?, category?}` → response `{content}` or `{error}`. Consumed by Task 7 (rewritten `genArticle` in `src/App.jsx`).

- [ ] **Step 1: Write `functions/api/generateArticle.js`**

```javascript
// Assistente ChatGPT per il pannello Admin. Stessa logica dell'originale
// functions/index.js: costruisce il prompt lato server, chiama OpenAI.
// La chiave OpenAI vive solo qui (env var), mai nel client.
const { setCors } = require("./_lib/cors");

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Metodo non permesso" });

  try {
    const { title, summary, category } = req.body || {};
    if (!title) return res.status(400).json({ error: "title obbligatorio" });

    const prompt = [
      `Scrivi un articolo per un'app di news di Formula 1 (B&T).`,
      `Categoria: ${category || "NEWS"}.`,
      `Titolo: ${title}`,
      summary ? `Sottotitolo/riassunto: ${summary}` : null,
      ``,
      `Scrivi in italiano, tono da redazione sportiva, 3-4 paragrafi brevi, senza inventare citazioni dirette di persone reali né dati di gara specifici non forniti. Restituisci solo il testo dell'articolo, senza titolo ripetuto e senza note editoriali.`,
    ].filter(Boolean).join("\n");

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 700,
        temperature: 0.7,
      }),
    });

    if (!r.ok) {
      const errBody = await r.text().catch(() => "");
      console.error("OpenAI error", r.status, errBody);
      return res.status(502).json({ error: "ChatGPT non ha risposto correttamente" });
    }

    const data = await r.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    res.json({ content });
  } catch (e) {
    console.error("generateArticle error", e);
    res.status(500).json({ error: e.message || "Errore interno" });
  }
};
```

- [ ] **Step 2: Syntax/load check**

Run:
```bash
cd functions && node -e "const h = require('./api/generateArticle.js'); console.log(typeof h)"
```
Expected: prints `function`.

- [ ] **Step 3: Commit**

```bash
git add functions/api/generateArticle.js
git commit -m "Porta generateArticle su Vercel"
```

---

### Task 7: Update the app (`src/App.jsx`)

**Files:**
- Modify: `src/App.jsx:53` (the `FUNCTIONS_BASE` constant)
- Modify: `src/App.jsx:54-66` (remove the `OPENAI_API_KEY` placeholder block)
- Modify: `src/App.jsx:1579` (rewrite `genArticle`)

**Interfaces:**
- Consumes: `/api/createCheckoutSession`, `/api/cancelSubscription`, `/api/generateArticle` (Tasks 2, 3, 6)

- [ ] **Step 1: Update `FUNCTIONS_BASE`**

In `src/App.jsx`, find:
```javascript
const FUNCTIONS_BASE = "https://us-central1-bt-app-50703.cloudfunctions.net";
```
Replace with:
```javascript
const FUNCTIONS_BASE = "https://bt-app-flutter.vercel.app/api";
```
(This keeps every existing call site — `${FUNCTIONS_BASE}/createCheckoutSession`, `${FUNCTIONS_BASE}/cancelSubscription` — unchanged, since the `/api` prefix now lives in the constant itself.)

- [ ] **Step 2: Remove the client-side OpenAI key**

In `src/App.jsx`, find the comment block and constant (currently lines 54-66):
```javascript
// Chiave OpenAI per il tasto "ChatGPT" nell'Admin (form NEWS). Per scelta di
// Edoardo sta lato client (niente piano Firebase Blaze per ora), quindi è
// estraibile da chi scompatta l'APK — come protezione resta il limite di
// spesa impostato su platform.openai.com. Il placeholder qui sotto viene
// sostituito con la chiave vera SOLO durante la build su Codemagic (script
// "Inserisci chiavi" in codemagic.yaml), a partire dalla variabile
// d'ambiente OPENAI_API_KEY impostata sul sito di Codemagic — così la
// chiave vera non finisce mai in questo file né nella cronologia Git
// (GitHub blocca comunque il push se rileva una chiave vera nel codice).
// Se in futuro si attiva Blaze, la funzione generateArticle in
// functions/index.js è già pronta per riprendere in mano questa chiamata
// lato server, più sicura.
const OPENAI_API_KEY = "__OPENAI_API_KEY__";
```
Delete this entire block (comment + const). The key now lives only on Vercel, never in the app.

- [ ] **Step 3: Rewrite `genArticle` to call the new backend**

Find (currently line 1579, one dense line):
```javascript
const genArticle=async()=>{if(!f.title){setGenErr("Scrivi prima un titolo");return;}setGenErr("");setGenLoading(true);try{const prompt=["Scrivi un articolo per un'app di news di Formula 1 (B&T).",`Categoria: ${f.category||"NEWS"}.`,`Titolo: ${f.title}`,f.summary?`Sottotitolo/riassunto: ${f.summary}`:null,"","Scrivi in italiano, tono da redazione sportiva, 3-4 paragrafi brevi, senza inventare citazioni dirette di persone reali né dati di gara specifici non forniti. Restituisci solo il testo dell'articolo, senza titolo ripetuto e senza note editoriali."].filter(Boolean).join("\n");const r=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${OPENAI_API_KEY}`},body:JSON.stringify({model:"gpt-4o-mini",messages:[{role:"user",content:prompt}],max_tokens:700,temperature:0.7})});const d=await r.json();if(!r.ok)throw new Error(d.error?.message||"Errore ChatGPT");setF(p=>({...p,content:d.choices?.[0]?.message?.content?.trim()||""}));}catch(err){console.error("genArticle error:",err);setGenErr("ChatGPT non ha risposto, riprova");}setGenLoading(false);};
```
Replace with:
```javascript
const genArticle=async()=>{if(!f.title){setGenErr("Scrivi prima un titolo");return;}setGenErr("");setGenLoading(true);try{const r=await fetch(`${FUNCTIONS_BASE}/generateArticle`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:f.title,summary:f.summary,category:f.category})});const d=await r.json();if(!r.ok)throw new Error(d.error||"Errore ChatGPT");setF(p=>({...p,content:d.content||""}));}catch(err){console.error("genArticle error:",err);setGenErr("ChatGPT non ha risposto, riprova");}setGenLoading(false);};
```
(The prompt-building logic moves entirely to `functions/api/generateArticle.js`, Task 6 — the client now just sends the raw fields.)

- [ ] **Step 4: Confirm the app still builds**

Run:
```bash
npm install && npm run build
```
Expected: build completes with no errors (confirms no leftover reference to the removed `OPENAI_API_KEY` constant and no syntax errors from the edits).

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "App: punta le chiamate backend a Vercel, chiave OpenAI non più nel client"
```

---

### Task 8: Retire the Firebase-specific files

**Files:**
- Delete: `functions/index.js`
- Delete: `firebase.json`
- Modify: `codemagic.yaml`
- Modify: `functions/README.md` (full rewrite)

- [ ] **Step 1: Delete the old Firebase Functions file**

```bash
git rm functions/index.js
```

- [ ] **Step 2: Delete `firebase.json`**

It currently only contains:
```json
{
  "functions": {
    "source": "functions"
  }
}
```
This pointed `firebase deploy --only functions` at the now-replaced code; since that command is never run again, remove the file:
```bash
git rm firebase.json
```

- [ ] **Step 3: Remove the unused OpenAI key injection from `codemagic.yaml`**

In `codemagic.yaml`, remove this whole anchor definition:
```yaml
    - &inject_secrets
      name: Inserisci chiavi da variabili d'ambiente Codemagic
      script: |
        if [ -n "$OPENAI_API_KEY" ]; then
          sed -i "s#__OPENAI_API_KEY__#${OPENAI_API_KEY}#" src/App.jsx
          echo "Chiave OpenAI inserita nella build."
        else
          echo "Nessuna variabile OPENAI_API_KEY impostata su Codemagic: il tasto ChatGPT in Admin non funzionerà in questa build."
        fi
```
And remove its two usages (`- *inject_secrets`) from the `apk-test` and `play-store` workflows' `scripts:` lists — each workflow's `scripts:` goes from:
```yaml
    scripts:
      - *install
      - *inject_secrets
      - *build_web
      - *capacitor
```
to:
```yaml
    scripts:
      - *install
      - *build_web
      - *capacitor
```
(Leave `groups: - bt_secrets` in place in both workflows — that group may hold other, unrelated values; only the injection step for the now-removed placeholder goes away.)

- [ ] **Step 4: Validate the YAML is still well-formed**

Run:
```bash
python3 -c "import yaml; print(list(yaml.safe_load(open('codemagic.yaml')).keys()))"
```
Expected: prints `['definitions', 'workflows']` with no parse error — confirms the edit didn't break YAML syntax. If `yaml` isn't installed, run `pip install --break-system-packages pyyaml` first.

- [ ] **Step 5: Rewrite `functions/README.md`**

Replace the entire file with:

```markdown
# Pagamenti reali B&T Premium — guida al deploy (Vercel)

Il codice in questa cartella è **completo e pronto**, ma per motivi di sicurezza
nessun servizio può creare da solo il tuo account Stripe o Vercel, o maneggiare
le tue chiavi segrete al posto tuo. Questi passaggi li devi fare tu, una volta
sola.

## Cosa fa questo backend

- `createCheckoutSession` — quando tocchi "ABBONATI" nell'app, crea una vera
  pagina di pagamento Stripe (Checkout) e la apre.
- `stripeWebhook` — l'unico punto che rende davvero Premium un account: Stripe
  lo chiama automaticamente quando il pagamento va a buon fine. **Il telefono
  non decide mai da solo di attivare Premium.**
- `cancelSubscription` — disdice davvero l'abbonamento su Stripe quando
  l'utente preme "Disdici" nel profilo.
- `paymentResult` — pagina di cortesia mostrata dopo il pagamento.
- `generateArticle` — genera testo con ChatGPT per il pannello Admin (la
  chiave OpenAI vive solo qui, mai nell'app).

Gira su **Vercel** (piano Hobby gratuito, nessuna carta richiesta) invece che
su Firebase Cloud Functions, per evitare del tutto il piano a pagamento Blaze.

## 1. Account Stripe (se non l'hai già)

Vedi i passaggi 1 e 7 della guida precedente: registrazione su
[stripe.com](https://dashboard.stripe.com/register), IBAN Postepay Evolution
collegato per l'incasso, chiavi in **Sviluppatori → Chiavi API**.

## 2. Progetto Vercel

Il repository `bt-app-flutter` è già importato su Vercel. Da controllare una
volta sola nelle impostazioni del progetto:

1. **Settings → General → Root Directory** → `functions`
2. **Settings → Environment Variables**, aggiungi:
   - `STRIPE_SECRET` — la Chiave segreta di Stripe
   - `STRIPE_WEBHOOK_SECRET` — vedi punto 4 qui sotto
   - `OPENAI_API_KEY` — la tua chiave da
     [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - `FIREBASE_SERVICE_ACCOUNT` — vedi punto 3 qui sotto

## 3. Chiave per far parlare Vercel con lo stesso database dell'app

1. [console.firebase.google.com](https://console.firebase.google.com/project/bt-app-50703/settings/serviceaccounts/adminsdk)
2. **Genera nuova chiave privata** → scarica il file `.json`
3. Apri il file, copia **tutto** il contenuto (comprese le graffe)
4. Incollalo come valore della variabile `FIREBASE_SERVICE_ACCOUNT` su Vercel
   (punto 2 qui sopra) — su una riga sola va bene, Vercel accetta testo lungo

Questo passaggio non richiede il piano Blaze: le service account key sono una
funzione base di Firebase, disponibile sul piano gratuito.

## 4. Collega il webhook su Stripe

1. Fai un primo deploy su Vercel (basta un push su `main` con il codice di
   questa cartella — Vercel ricostruisce da solo).
2. Nota l'indirizzo pubblico, es. `https://bt-app-flutter.vercel.app`.
3. Dashboard Stripe → **Sviluppatori → Webhook → Aggiungi endpoint**.
4. URL endpoint: `https://bt-app-flutter.vercel.app/api/stripeWebhook`.
5. Eventi da ascoltare: `checkout.session.completed`,
   `customer.subscription.deleted`, `invoice.payment_failed`.
6. Salva, copia il **Signing secret** (`whsec_...`) mostrato da Stripe.
7. Incollalo come valore della variabile `STRIPE_WEBHOOK_SECRET` su Vercel
   (punto 2 qui sopra).

## 5. Prova un pagamento

- Con la chiave `sk_test_...`, su Stripe Checkout paga con la carta di prova
  `4242 4242 4242 4242`, data futura qualsiasi, CVC qualsiasi.
- Quando sei pronto per i pagamenti veri, sostituisci `STRIPE_SECRET` con la
  chiave `sk_live_...` su Vercel.

## Dopo la configurazione

Ogni `git push` su `main` ricostruisce automaticamente le funzioni su Vercel
— non serve nessun comando da lanciare a mano, a differenza del vecchio
flusso Firebase CLI.
```

- [ ] **Step 6: Commit**

```bash
git add -A functions/index.js firebase.json codemagic.yaml functions/README.md
git commit -m "Ritira le Cloud Functions Firebase: README e CI aggiornati per Vercel"
```

---

### Task 9: Deploy, connect, and verify end-to-end (manual, with the user)

This task cannot be completed by code alone — it needs the user's Vercel dashboard and Stripe dashboard, same division of labor as every secret-handling step so far in this project.

- [ ] **Step 1: Push everything**

```bash
git push
```
(This is the single push for the whole migration — avoids triggering the Codemagic APK-build-on-push workflow once per task.)

- [ ] **Step 2: User sets Vercel project settings**

Guide the user through `functions/README.md` sections 2-4 (Root Directory, the 4 environment variables, connecting the webhook). Wait for confirmation at each secret before moving on — same pattern already used for the original Stripe/Firebase setup in this project.

- [ ] **Step 3: Confirm the deployment is green**

Ask the user to screenshot or confirm the Vercel deployment status is "Ready" after the settings are saved and a redeploy runs.

- [ ] **Step 4: End-to-end test payment**

With `STRIPE_SECRET`/`STRIPE_WEBHOOK_SECRET` still pointing at Stripe **test** keys: have the user tap "ABBONATI" in the app (or a test build of it), pay with `4242 4242 4242 4242`, and confirm Premium activates within a few seconds. This is the real test of the raw-body/signature-verification chain from Task 5 — nothing earlier in this plan can substitute for it.

- [ ] **Step 5: Go live**

Once the test payment activates Premium correctly, the user replaces `STRIPE_SECRET` on Vercel with the `sk_live_...` key and repeats Step 3 of `functions/README.md`'s webhook section with a live-mode endpoint (Stripe keeps test and live webhooks separate).
