/**
 * Backend pagamenti B&T — Cloud Functions (Firebase, 2nd gen).
 *
 * Gestisce gli abbonamenti Premium con Stripe Checkout. La chiave segreta
 * di Stripe NON deve mai stare nel codice dell'app (sarebbe visibile a
 * chiunque scompatti l'APK): vive solo qui, sul server, come Secret Manager.
 *
 * Istruzioni complete di deploy: vedi README.md in questa cartella.
 */
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const Stripe = require("stripe");

admin.initializeApp();
const db = admin.firestore();

const REGION = "us-central1";
const PROJECT_ID = "bt-app-50703";
const stripeSecret = defineSecret("STRIPE_SECRET");
const stripeWebhookSecret = defineSecret("STRIPE_WEBHOOK_SECRET");

const PLANS = {
  monthly: { amountCents: 299, interval: "month", label: "B&T Premium — Mensile" },
  annual: { amountCents: 2499, interval: "year", label: "B&T Premium — Annuale" },
};

function setCors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

// ── 1) Crea una sessione di pagamento Stripe Checkout ──
// Chiamata dall'app quando l'utente tocca "ABBONATI". Ritorna { url } da aprire.
exports.createCheckoutSession = onRequest(
  { region: REGION, secrets: [stripeSecret], cors: true },
  async (req, res) => {
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

      const userRef = db.collection("users").doc(ek);
      const userSnap = await userRef.get();
      if (!userSnap.exists) return res.status(404).json({ error: "Utente non trovato" });
      const userData = userSnap.data();

      const stripe = Stripe(stripeSecret.value());

      let customerId = userData.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({ email: ek, metadata: { btEmail: ek } });
        customerId = customer.id;
        await userRef.set({ stripeCustomerId: customerId }, { merge: true });
      }

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
        success_url: `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/paymentResult?ok=1`,
        cancel_url: `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/paymentResult?ok=0`,
      });

      res.json({ url: session.url });
    } catch (e) {
      logger.error("createCheckoutSession error", e);
      res.status(500).json({ error: e.message || "Errore interno" });
    }
  }
);

// ── 2) Disdice l'abbonamento Stripe attivo ──
// Chiamata quando l'utente tocca "Disdici abbonamento" nel profilo.
exports.cancelSubscription = onRequest(
  { region: REGION, secrets: [stripeSecret], cors: true },
  async (req, res) => {
    setCors(res);
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ error: "Metodo non permesso" });

    try {
      const { email } = req.body || {};
      if (!email) return res.status(400).json({ error: "email obbligatoria" });
      const ek = String(email).toLowerCase().trim();

      const userRef = db.collection("users").doc(ek);
      const snap = await userRef.get();
      const data = snap.exists ? snap.data() : null;

      if (data?.stripeSubscriptionId) {
        const stripe = Stripe(stripeSecret.value());
        await stripe.subscriptions.cancel(data.stripeSubscriptionId).catch((e) => {
          logger.warn("Stripe subscription cancel failed (proseguo comunque)", e.message);
        });
      }

      await userRef.set({ isPremium: false, plan: "free" }, { merge: true });
      res.json({ ok: true });
    } catch (e) {
      logger.error("cancelSubscription error", e);
      res.status(500).json({ error: e.message || "Errore interno" });
    }
  }
);

// ── 3) Pagina di ritorno da Stripe Checkout ──
// Pagina statica minimale: l'app rileva l'esito facendo polling su Firestore,
// questa pagina serve solo a dare un feedback immediato nel browser/in-app browser.
exports.paymentResult = onRequest({ region: REGION }, (req, res) => {
  const ok = req.query.ok === "1";
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`<!doctype html><html lang="it"><head><meta charset="utf-8">
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
});

// ── 4) Webhook Stripe ──
// L'UNICA cosa che rende davvero Premium un utente: Stripe chiama questo endpoint
// quando il pagamento va a buon fine (o quando un abbonamento viene cancellato/fallisce).
// Da configurare nella Dashboard Stripe → Sviluppatori → Webhook.
exports.stripeWebhook = onRequest(
  { region: REGION, secrets: [stripeSecret, stripeWebhookSecret] },
  async (req, res) => {
    const stripe = Stripe(stripeSecret.value());
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        req.headers["stripe-signature"],
        stripeWebhookSecret.value()
      );
    } catch (err) {
      logger.error("Firma webhook non valida", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
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
          logger.info(`Premium attivato per ${email} (${plan})`);
        }
      }

      if (event.type === "customer.subscription.deleted") {
        const sub = event.data.object;
        const email = sub.metadata?.btEmail;
        if (email) {
          await db.collection("users").doc(email).set({ isPremium: false, plan: "free" }, { merge: true });
          logger.info(`Premium disattivato per ${email} (abbonamento cancellato)`);
        }
      }

      if (event.type === "invoice.payment_failed") {
        logger.warn("Pagamento fallito", event.data.object.customer);
        // Facoltativo: qui si potrebbe inviare una notifica in-app all'utente.
      }

      res.json({ received: true });
    } catch (e) {
      logger.error("stripeWebhook handler error", e);
      res.status(500).send("Errore interno");
    }
  }
);
