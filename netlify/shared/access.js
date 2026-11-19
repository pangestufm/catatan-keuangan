// Access check shared by the Netlify functions that read, write or spend on a workspace's behalf.
// It fails closed: with APP_ACCESS_TOKEN unset every request is refused, where the older checks
// let every request through. Lives outside netlify/functions so it is not deployed as an endpoint.
const { createHash, timingSafeEqual } = require("node:crypto");

function header(event, name) {
  const headers = event?.headers || {};
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
  return key ? headers[key] : "";
}

// Returns null when the request may continue, otherwise the status and message to answer with.
function checkAccess(event) {
  const required = process.env.APP_ACCESS_TOKEN;
  if (!required || !required.trim()) return { status: 503, error: "Token akses aplikasi belum dikonfigurasi." };
  const provided = header(event, "x-app-token");
  // Comparing fixed-length digests keeps the time taken independent of where the tokens differ.
  const digest = (value) => createHash("sha256").update(String(value ?? ""), "utf8").digest();
  return typeof provided === "string" && timingSafeEqual(digest(provided), digest(required))
    ? null
    : { status: 401, error: "Unauthorized" };
}

module.exports = { checkAccess, header };
