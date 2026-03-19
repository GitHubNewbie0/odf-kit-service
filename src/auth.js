// src/auth.js
// AppAPIAuth middleware for odf-kit-service.
//
// Every inbound request from Nextcloud carries:
//   AUTHORIZATION-APP-API: base64(userId:APP_SECRET)
//
// We decode, split on the first colon, and compare the right side
// against APP_SECRET. The userId on the left is attached to req.ncUserId
// for downstream use (WebDAV calls, etc.).
//
// /heartbeat is the only endpoint that bypasses this middleware.

export function requireAuth(req, res, next) {
  const header = req.headers['authorization-app-api']
  if (!header) {
    return res.status(401).json({ error: 'missing auth' })
  }

  let decoded
  try {
    decoded = Buffer.from(header, 'base64').toString('utf8')
  } catch {
    return res.status(401).json({ error: 'malformed auth header' })
  }

  const colonIdx = decoded.indexOf(':')
  if (colonIdx === -1) {
    return res.status(401).json({ error: 'malformed auth header' })
  }

  const userId = decoded.slice(0, colonIdx)
  const secret = decoded.slice(colonIdx + 1)

  if (secret !== process.env.APP_SECRET) {
    return res.status(401).json({ error: 'invalid secret' })
  }

  req.ncUserId = userId  // may be empty string for system-level calls
  next()
}
