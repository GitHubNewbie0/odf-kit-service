// src/routes/enabled.js
// AppAPI calls PUT /enabled?enabled=1 when the app is activated,
// and PUT /enabled?enabled=0 when it is deactivated.
//
// We have no UI to register and no setup/teardown work to do,
// so we just acknowledge. AppAPI treats any 2xx as success and proceeds.

export function enabled(req, res) {
  const isEnabled = req.query.enabled === '1'
  console.log(`odf-kit-service ${isEnabled ? 'enabled' : 'disabled'}`)
  res.json({ enabled: isEnabled })
}
