const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { getRawBody } = require("../rawBody.js");

async function main() {
  const req = new EventEmitter();
  const promise = getRawBody(req);

  req.emit("data", Buffer.from("foo"));
  req.emit("data", Buffer.from("bar"));
  req.emit("end");

  const result = await promise;
  assert.ok(Buffer.isBuffer(result), "getRawBody deve risolvere in un Buffer");
  assert.equal(result.toString(), "foobar", "deve concatenare tutti i chunk nell'ordine ricevuto");

  console.log("PASS rawBody.test.js");
}

main().catch((e) => {
  console.error("FAIL rawBody.test.js:", e.message);
  process.exit(1);
});
