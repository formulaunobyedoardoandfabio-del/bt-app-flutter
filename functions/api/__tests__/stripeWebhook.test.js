// Il test più importante di tutto il trasloco: verifica per davvero (in
// locale, senza rete, senza account Stripe reale) che la firma del webhook
// venga controllata correttamente — usando l'helper ufficiale di Stripe
// pensato apposta per questo (stripe.webhooks.generateTestHeaderString),
// non un finto controllo. Firestore viene sostituito con un finto
// getDb() via require.cache: quello che stiamo verificando qui è SOLO la
// logica di firma/instradamento, non se Firestore scrive davvero (quello
// non si può testare senza credenziali vere — verificato per davvero al
// Task 9, con un pagamento di prova reale).
//
// NOTA: richiede "stripe" per caricarsi — vedi il ledger per il blocco npm
// in questo ambiente.
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const Stripe = require("stripe");
const { fakeRes } = require("./_testHelpers.js");

const TEST_WEBHOOK_SECRET = "whsec_test_only_never_a_real_secret";

// Sostituisce _lib/firebaseAdmin con una finta in-memory, così il test non
// tocca mai un Firestore vero.
const firebaseAdminPath = require.resolve("../_lib/firebaseAdmin.js");
const writes = [];
require.cache[firebaseAdminPath] = {
  id: firebaseAdminPath,
  filename: firebaseAdminPath,
  loaded: true,
  exports: {
    getDb: () => ({
      collection: () => ({
        doc: (id) => ({
          set: async (data, opts) => {
            writes.push({ id, data, opts });
          },
        }),
      }),
    }),
  },
};

function fakeWebhookReq(rawBodyString, signatureHeader) {
  const req = new EventEmitter();
  req.headers = { "stripe-signature": signatureHeader };
  process.nextTick(() => {
    req.emit("data", Buffer.from(rawBodyString));
    req.emit("end");
  });
  return req;
}

async function main() {
  process.env.STRIPE_SECRET = "sk_test_not_real_local_signature_test_only";
  process.env.STRIPE_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

  const handler = require("../stripeWebhook.js");
  const stripeForTestHelper = Stripe(process.env.STRIPE_SECRET);

  // 1) Firma non valida → 400, nessuna scrittura su Firestore
  {
    const payload = JSON.stringify({ type: "checkout.session.completed", data: { object: {} } });
    const req = fakeWebhookReq(payload, "t=1,v1=firma_finta_non_valida");
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 400, "firma non valida deve rispondere 400");
    assert.equal(writes.length, 0, "con firma non valida non deve scrivere nulla su Firestore");
  }

  // 2) Firma valida, checkout.session.completed → attiva Premium
  {
    writes.length = 0;
    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { btEmail: "prova@test.it", btPlan: "monthly" },
          customer: "cus_123",
          subscription: "sub_123",
        },
      },
    };
    const payload = JSON.stringify(event);
    const header = stripeForTestHelper.webhooks.generateTestHeaderString({
      payload,
      secret: TEST_WEBHOOK_SECRET,
    });
    const req = fakeWebhookReq(payload, header);
    const res = fakeRes();
    await handler(req, res);

    assert.equal(res.statusCode, 200, "firma valida deve rispondere 200");
    assert.equal(writes.length, 1, "deve scrivere esattamente un documento");
    assert.equal(writes[0].id, "prova@test.it", "deve usare l'email come id documento");
    assert.equal(writes[0].data.isPremium, true, "deve impostare isPremium a true");
    assert.equal(writes[0].data.plan, "monthly");
  }

  console.log("PASS stripeWebhook.test.js");
}

main().catch((e) => {
  console.error("FAIL stripeWebhook.test.js:", e.message);
  process.exit(1);
});
