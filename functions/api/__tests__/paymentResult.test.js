const assert = require("node:assert/strict");
const { fakeReq, fakeRes } = require("./_testHelpers.js");

const handler = require("../paymentResult.js");

// ok=1 → messaggio di successo
{
  const req = fakeReq({ method: "GET", query: { ok: "1" } });
  const res = fakeRes();
  handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.match(res.body, /Pagamento completato/, "con ok=1 deve mostrare il messaggio di successo");
  assert.equal(res.headers["Content-Type"], "text/html; charset=utf-8");
}

// ok=0 (o assente) → messaggio di annullamento, non di successo
{
  const req = fakeReq({ method: "GET", query: { ok: "0" } });
  const res = fakeRes();
  handler(req, res);
  assert.match(res.body, /Pagamento annullato/, "con ok=0 deve mostrare il messaggio di annullamento");
  assert.doesNotMatch(res.body, /completato/, "non deve mostrare il messaggio di successo");
}

console.log("PASS paymentResult.test.js");
