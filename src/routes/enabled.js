// src/routes/enabled.js
// AppAPI calls PUT /enabled?enabled=1 when the app is activated,
// and PUT /enabled?enabled=0 when it is deactivated.
//
// Top menu registration will be added here when the top menu UI is built.

export async function enabled(req, res) {
  const isEnabled = req.query.enabled === '1'
  console.log(`odf-kit-service ${isEnabled ? 'enabled' : 'disabled'}`)
  res.json({ enabled: isEnabled })
}
