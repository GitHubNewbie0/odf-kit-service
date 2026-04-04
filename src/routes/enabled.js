// src/routes/enabled.js
// AppAPI calls PUT /enabled?enabled=1 when the app is activated,
// and PUT /enabled?enabled=0 when it is deactivated.
//
// On enable:  register file action menu entries with Nextcloud via OCS API.
// On disable: unregister them.
//
// File actions registered:
//   odf-export-md   — text/markdown  — "Export as ODT"
//   odf-export-html — text/html      — "Export as ODT"
//   odf-export-txt  — text/plain     — "Export as ODT"
//
// Each action calls POST /file-action on this service with the file context.
// Multi-file selection is supported — AppAPI sends all selected file IDs.

const FILE_ACTIONS = [
  { name: 'odf-export-md',   mime: 'text/markdown', displayName: 'Export as ODT' },
  { name: 'odf-export-html', mime: 'text/html',     displayName: 'Export as ODT' },
  { name: 'odf-export-txt',  mime: 'text/plain',    displayName: 'Export as ODT' },
]

/** Build AppAPIAuth header for system-level calls (no user). */
function systemAuthHeader() {
  return Buffer.from(`:${process.env.APP_SECRET}`).toString('base64')
}

/** Common headers for OCS calls from this service to Nextcloud. */
function ocsHeaders() {
  return {
    'Content-Type':          'application/json',
    'OCS-APIRequest':        'true',
    'Authorization-App-Api': systemAuthHeader(),
    'Ex-App-Id':             process.env.APP_ID,
    'Ex-App-Version':        process.env.APP_VERSION,
    'Aa-Version':            process.env.AA_VERSION ?? '2.0.0',
  }
}

/** Register a single file action with Nextcloud AppAPI. */
async function registerFileAction(action) {
  const url = `${process.env.WEBDAV_URL ?? process.env.NEXTCLOUD_URL}/ocs/v2.php/apps/app_api/api/v2/ui/files-actions-menu`
  const res = await fetch(url, {
    method:  'POST',
    headers: ocsHeaders(),
    body: JSON.stringify({
      name:          action.name,
      displayName:   action.displayName,
      mime:          action.mime,
      actionHandler: 'file-action',
      icon:          '',
      permissions:   31,
      order:         0,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error(`Failed to register file action ${action.name}: ${res.status} ${text}`)
  } else {
    console.log(`Registered file action: ${action.name}`)
  }
}

/** Unregister a single file action from Nextcloud AppAPI. */
async function unregisterFileAction(action) {
  const url = `${process.env.WEBDAV_URL ?? process.env.NEXTCLOUD_URL}/ocs/v2.php/apps/app_api/api/v2/ui/files-actions-menu/${action.name}`
  const res = await fetch(url, {
    method:  'DELETE',
    headers: ocsHeaders(),
  })
  if (!res.ok) {
    console.error(`Failed to unregister file action ${action.name}: ${res.status}`)
  } else {
    console.log(`Unregistered file action: ${action.name}`)
  }
}

export async function enabled(req, res) {
  const isEnabled = req.query.enabled === '1'
  console.log(`odf-kit-service ${isEnabled ? 'enabled' : 'disabled'}`)

  // Always respond 200 first — AppAPI has a 30-second timeout on /enabled
  res.json({ enabled: isEnabled })

  // Register or unregister file actions asynchronously after responding
  if (isEnabled) {
    for (const action of FILE_ACTIONS) {
      await registerFileAction(action).catch(console.error)
    }
  } else {
    for (const action of FILE_ACTIONS) {
      await unregisterFileAction(action).catch(console.error)
    }
  }
}
