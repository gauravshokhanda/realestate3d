import assert from "node:assert/strict";

const origin = process.env.SMOKE_URL ?? "http://localhost:3000";
const post = (body, ip) => fetch(origin + "/api/lead", {
  method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body),
});
const invalid = await post({ name: "", email: "invalid", phone: "", unit: "residence-a", message: "" }, "198.51.100.100");
assert.equal(invalid.status, 400);
const error = await invalid.json();
assert(error.errors.name && error.errors.email);
// Honeypot requests never send email, even with configured Resend credentials.
const ip = "198.51.100." + (110 + Math.floor(Math.random() * 100));
for (let index = 0; index < 5; index++) {
  const response = await post({ website: "spam.example" }, ip);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
}
const limited = await post({ website: "spam.example" }, ip);
assert.equal(limited.status, 429);
assert(Number(limited.headers.get("retry-after")) > 0);
console.log("PASS: server validation, honeypot, five-request rate limit, and Retry-After. No emails sent.");
