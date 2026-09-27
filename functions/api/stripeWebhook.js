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
