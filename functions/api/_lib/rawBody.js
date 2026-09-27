// Legge il corpo grezzo (non ancora interpretato) di una richiesta.
// IMPORTANTE: chi usa questa funzione non deve MAI leggere req.body prima
// di chiamarla — su Vercel req.body è un getter "pigro": basta leggerlo
// una volta per consumare lo stream, e questa funzione troverebbe lo
// stream già vuoto.
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

module.exports = { getRawBody };
