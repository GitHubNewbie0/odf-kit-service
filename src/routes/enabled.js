// src/routes/enabled.js
// AppAPI calls PUT /enabled?enabled=1 when the app is activated,
// and PUT /enabled?enabled=0 when it is deactivated.
//
// On enable:  register our frontend script with AppAPI so it gets injected
//             into every Nextcloud page. The script uses @nextcloud/files v4
//             registerFileAction() directly — the correct method for NC33+.
//
// On disable: unregister the script.
//
// We do NOT use AppAPI's OCS file-actions-menu API — that writes to the
// @nextcloud/files v3 store which NC33's Files app does not read.

const SCRIPT_NAME = 'odf-kit-files'
const SCRIPT_PATH = 'js/odf-kit-files'  // .js appended automatically by AppAPI

function systemAuthHeader() {
  return Buffer.from(`:${process.env.APP_SECRET}`).toString('base64')
}

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

const baseUrl = () => process.env.WEBDAV_URL ?? process.env.NEXTCLOUD_URL

async function registerScript() {
  const url = `${baseUrl()}/ocs/v2.php/apps/app_api/api/v1/ui/script`
  const res = await fetch(url, {
    method:  'POST',
    headers: ocsHeaders(),
    body: JSON.stringify({
      type: 'top_menu',
      name: SCRIPT_NAME,
      path: SCRIPT_PATH,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error(`Failed to register script: ${res.status} ${text}`)
  } else {
    console.log(`Registered script: ${SCRIPT_NAME}`)
  }
}

async function unregisterScript() {
  const url = `${baseUrl()}/ocs/v2.php/apps/app_api/api/v1/ui/script`
  const res = await fetch(url, {
    method:  'DELETE',
    headers: ocsHeaders(),
    body: JSON.stringify({
      type: 'top_menu',
      name: SCRIPT_NAME,
      path: SCRIPT_PATH,
    }),
  })
  if (!res.ok) {
    console.error(`Failed to unregister script: ${res.status}`)
  } else {
    console.log(`Unregistered script: ${SCRIPT_NAME}`)
  }
}

export async function enabled(req, res) {
  const isEnabled = req.query.enabled === '1'
  console.log(`odf-kit-service ${isEnabled ? 'enabled' : 'disabled'}`)

  // Respond 200 first — AppAPI has a 30-second timeout on /enabled
  res.json({ enabled: isEnabled })

  // Register or unregister script asynchronously after responding
  if (isEnabled) {
    await registerScript().catch(console.error)
  } else {
    await unregisterScript().catch(console.error)
  }
}
