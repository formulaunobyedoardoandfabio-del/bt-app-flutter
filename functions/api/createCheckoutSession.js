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
