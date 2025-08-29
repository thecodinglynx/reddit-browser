const { proxy } = require("./index");

// Minimal mock for req/res
function makeReq(url) {
  return { query: { url }, headers: {} };
}

function makeRes() {
  const res = {};
  res.statusCode = 200;
  res.headers = {};
  res.setHeader = (k, v) => {
    res.headers[k.toLowerCase()] = v;
  };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.type = (t) => {
    res.setHeader("content-type", t);
    return res;
  };
  res.send = (body) => {
    if (body && body.length && body.length > 2000)
      body = body.toString().slice(0, 2000) + "...";
    console.log("RESPONSE STATUS:", res.statusCode);
    console.log("RESPONSE HEADERS:", res.headers);
    console.log(
      "RESPONSE BODY (trimmed):",
      body && body.toString().slice(0, 1000)
    );
  };
  return res;
}

(async () => {
  const req = makeReq("https://www.reddit.com/r/earth/hot.json?limit=25");
  const res = makeRes();
  await proxy(req, res);
})();
