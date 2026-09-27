const assert = require("node:assert/strict");
const { setCors } = require("../cors.js");

// Fake res that just records what setHeader was called with.
function fakeRes() {
  const calls = [];
  return { calls, setHeader: (name, value) => calls.push([name, value]) };
}

const res = fakeRes();
setCors(res);

assert.deepEqual(
  res.calls,
  [
    ["Access-Control-Allow-Origin", "*"],
    ["Access-Control-Allow-Methods", "POST, OPTIONS"],
    ["Access-Control-Allow-Headers", "Content-Type"],
  ],
  "setCors deve impostare esattamente questi 3 header, in questo ordine"
);

console.log("PASS cors.test.js");
