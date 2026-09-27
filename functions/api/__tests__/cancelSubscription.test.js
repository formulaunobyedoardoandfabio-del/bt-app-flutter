// NOTA: richiede "stripe" per caricarsi — vedi la stessa nota in
// createCheckoutSession.test.js e il ledger.
const assert = require("node:assert/strict");
const { fakeReq, fakeRes } = require("./_testHelpers.js");

async function main() {
  const handler = require("../cancelSubscription.js");

  {
    const req = fakeReq({ method: "OPTIONS" });
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 204, "OPTIONS deve rispondere 204");
  }

  {
    const req = fakeReq({ method: "GET" });
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 405, "GET deve rispondere 405");
  }

  {
    const req = fakeReq({ method: "POST", body: {} });
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 400, "senza email deve rispondere 400");
    assert.ok(res.body?.error, "deve includere un messaggio di errore");
  }

  console.log("PASS cancelSubscription.test.js");
}

main().catch((e) => {
  console.error("FAIL cancelSubscription.test.js:", e.message);
  process.exit(1);
});
