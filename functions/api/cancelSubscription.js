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
