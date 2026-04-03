// src/routes/init.js
// AppAPI calls POST /init during ExApp registration.
// We have no initialization work to do — return 200 immediately.

export function init(_req, res) {
  res.json({ status: 'ok' })
}