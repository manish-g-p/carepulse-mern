// Tiny host-side relay for openFDA, mirroring how the NLLB translate server
// runs on the host and containers reach it via host.docker.internal.
//
// Why it exists: on some networks (observed 2026-07-18 on a Jio connection),
// Docker Desktop's NAT silently drops traffic to api.fda.gov -- every
// container times out while the Windows host reaches it in under a second.
// Rather than fight the VM networking, the containerized patient-service can
// be pointed here with OPENFDA_BASE=http://host.docker.internal:5556 (see
// docker-compose.yml); this process forwards the query string verbatim to
// the real API from the host's network stack.
//
// Run:  node scripts/openFdaProxy.js   (listens on :5556)
// Not needed on hosted deploys (Render reaches openFDA directly) or when
// the local Docker NAT works -- it's an opt-in workaround.
const http = require("http");

const PORT = process.env.OPENFDA_PROXY_PORT || 5556;
const TARGET = "https://api.fda.gov/drug/label.json";

const server = http.createServer(async (req, res) => {
  const query = req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "";
  try {
    const upstream = await fetch(`${TARGET}${query}`);
    const body = await upstream.text();
    res.writeHead(upstream.status, { "Content-Type": "application/json" });
    res.end(body);
  } catch (error) {
    console.error(`[openfda-proxy] ${error.message}`);
    res.writeHead(502, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "upstream unreachable" }));
  }
});

server.listen(PORT, () => console.log(`[openfda-proxy] relaying :${PORT} -> ${TARGET}`));
