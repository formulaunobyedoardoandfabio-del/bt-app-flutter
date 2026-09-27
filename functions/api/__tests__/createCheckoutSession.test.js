// NOTA: richiede il pacchetto "stripe" per caricarsi (require in cima al
// file dell'handler). Se il registro npm è bloccato in questo ambiente,
// questo test non può girare — vedi il ledger. Il test resta corretto e va
// eseguito non appena il pacchetto è installabile (anche solo su Vercel al
// primo deploy, che lo installa da solo).
const assert = require("node:assert/strict");
const { fakeReq, fakeRes } = require("./_testHelpers.js");

async function main() {
  const handler = require("../createCheckoutSession.js");

  // OPTIONS → 204, nessuna chiamata a Stripe/Firestore
  {
    const req = fakeReq({ method: "OPTIONS" });
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 204, "OPTIONS deve rispondere 204");
  }

  // Metodo sbagliato → 405
  {
    const req = fakeReq({ method: "GET" });
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 405, "GET deve rispondere 405");
  }

  // POST senza email → 400
  {
    const req = fakeReq({ method: "POST", body: { plan: "monthly" } });
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 400, "senza email deve rispondere 400");
    assert.ok(res.body?.error, "deve includere un messaggio di errore");
  }

  // POST con plan non valido → 400
  {
    const req = fakeReq({ method: "POST", body: { email: "a@b.it", plan: "settimanale" } });
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 400, "un plan non valido deve rispondere 400");
  }

  console.log("PASS createCheckoutSession.test.js");
}

main().catch((e) => {
  console.error("FAIL createCheckoutSession.test.js:", e.message);
  process.exit(1);
});
