// Zero dipendenze esterne (solo _lib/cors + fetch globale di Node) quindi
// qui il blocco npm non c'entra: test RED→GREEN reale al 100%, comprese le
// chiamate a OpenAI (fetch globale sostituito con una finta funzione — è
// l'unica cosa che va per forza "finta", dato che una chiamata vera
// costerebbe soldi e richiederebbe una chiave reale).
const assert = require("node:assert/strict");
const { fakeReq, fakeRes } = require("./_testHelpers.js");

const handler = require("../generateArticle.js");

async function main() {
  // OPTIONS → 204
  {
    const req = fakeReq({ method: "OPTIONS" });
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 204);
  }

  // Metodo non permesso → 405
  {
    const req = fakeReq({ method: "GET" });
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 405);
  }

  // POST senza title → 400
  {
    const req = fakeReq({ method: "POST", body: { summary: "solo un riassunto" } });
    const res = fakeRes();
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /title/);
  }

  // POST con title, OpenAI risponde bene → 200 con { content }
  {
    const originalFetch = global.fetch;
    let capturedUrl, capturedOptions;
    global.fetch = async (url, options) => {
      capturedUrl = url;
      capturedOptions = options;
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "  Un bellissimo articolo su Verstappen.  " } }] }),
      };
    };
    try {
      process.env.OPENAI_API_KEY = "sk-test-not-real";
      const req = fakeReq({ method: "POST", body: { title: "Verstappen vince ancora", category: "NEWS" } });
      const res = fakeRes();
      await handler(req, res);

      assert.equal(res.statusCode, 200);
      assert.equal(res.body.content, "Un bellissimo articolo su Verstappen.", "deve fare trim del contenuto");
      assert.equal(capturedUrl, "https://api.openai.com/v1/chat/completions");
      assert.equal(capturedOptions.headers.Authorization, "Bearer sk-test-not-real");
      const sentBody = JSON.parse(capturedOptions.body);
      assert.match(sentBody.messages[0].content, /Verstappen vince ancora/, "il titolo deve finire nel prompt");
    } finally {
      global.fetch = originalFetch;
    }
  }

  // POST con title, OpenAI risponde male → 502
  {
    const originalFetch = global.fetch;
    global.fetch = async () => ({ ok: false, status: 500, text: async () => "boom" });
    try {
      const req = fakeReq({ method: "POST", body: { title: "Titolo qualsiasi" } });
      const res = fakeRes();
      await handler(req, res);
      assert.equal(res.statusCode, 502);
    } finally {
      global.fetch = originalFetch;
    }
  }

  console.log("PASS generateArticle.test.js");
}

main().catch((e) => {
  console.error("FAIL generateArticle.test.js:", e.message);
  process.exit(1);
});
