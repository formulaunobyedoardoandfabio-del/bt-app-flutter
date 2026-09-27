// Helper condivisi per testare gli handler (req, res) senza un server vero.
// Il prefisso "_" li esclude anche dal routing di Vercel, per coerenza con
// _lib — anche se qui non servirebbe (sono sotto __tests__, non deployato).
function fakeReq({ method = "POST", body = {}, headers = {}, query = {} } = {}) {
  return { method, body, headers, query };
}

function fakeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.body = obj;
      return this;
    },
    send(data) {
      this.body = data;
      return this;
    },
  };
}

module.exports = { fakeReq, fakeRes };
