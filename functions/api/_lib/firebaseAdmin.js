// Init condiviso di Firebase Admin per le funzioni su Vercel.
// Fuori da Cloud Functions non ci sono credenziali automatiche: serve la
// service account key del progetto Firebase, passata come variabile
// d'ambiente FIREBASE_SERVICE_ACCOUNT (contenuto JSON, mai nel codice).
const admin = require("firebase-admin");

function getDb() {
  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  return admin.firestore();
}

module.exports = { getDb };
