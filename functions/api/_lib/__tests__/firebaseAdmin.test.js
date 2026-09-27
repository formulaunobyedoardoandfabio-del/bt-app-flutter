const assert = require("node:assert/strict");
const crypto = require("node:crypto");

// Chiave RSA vera ma usa-e-getta, solo per superare la validazione di
// forma di admin.credential.cert() senza credenziali Firebase reali.
const { privateKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "pkcs1", format: "pem" },
});

process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({
  project_id: "test-project",
  client_email: "test@test-project.iam.gserviceaccount.com",
  private_key: privateKey,
});

const { getDb } = require("../firebaseAdmin.js");

// Non deve lanciare alla prima chiamata...
const db1 = getDb();
assert.ok(db1, "getDb() deve restituire qualcosa alla prima chiamata");

// ...né alla seconda: questo è esattamente il bug che il guard
// `if (!admin.apps.length)` previene (Vercel riusa il container caldo tra
// una richiesta e l'altra, quindi getDb() viene chiamata molte volte nello
// stesso processo).
const db2 = getDb();
assert.ok(db2, "getDb() deve restituire qualcosa anche alla seconda chiamata, senza lanciare");

console.log("PASS firebaseAdmin.test.js");
