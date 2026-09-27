// Pagina di ritorno da Stripe Checkout. Nessun segreto, nessun Firestore:
// serve solo un feedback immediato nel browser/in-app browser mentre
// l'app rileva l'esito vero facendo polling su Firestore.
module.exports = (req, res) => {
  const ok = req.query.ok === "1";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(`<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>B&T</title>
<style>
  body{background:#0d0d0d;color:#fff;font-family:system-ui,-apple-system,sans-serif;
    display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;
    text-align:center;padding:24px}
  h1{font-style:italic;font-weight:900;font-size:22px}
  p{color:#aaa;font-size:14px;line-height:1.6}
</style></head><body><div>
<h1>${ok ? "Pagamento completato ✅" : "Pagamento annullato"}</h1>
<p>${ok
    ? "Torna all'app B&T: l'abbonamento Premium si attiverà entro pochi secondi."
    : "Puoi tornare all'app B&T e riprovare quando vuoi."}</p>
</div></body></html>`);
};
