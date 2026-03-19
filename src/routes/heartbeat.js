// src/routes/heartbeat.js
// AppAPI polls this endpoint to confirm the service is alive.
// No auth required — AppAPI calls this before the app secret is established.
// Must respond within 10 minutes or AppAPI considers the service dead.

export function heartbeat(_req, res) {
  res.json({ status: 'ok' })
}
