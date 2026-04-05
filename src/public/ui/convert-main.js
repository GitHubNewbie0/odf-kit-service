/**
 * odf-kit-service — Top Menu UI
 *
 * Loaded by AppAPI when the user visits the "Export to ODT" top menu page.
 * Runs in the context of a Nextcloud embedded page — OC is available.
 *
 * Served by Express at GET /ui/convert-main.js
 * Proxied by AppAPI at /apps/app_api/proxy/odf-kit-service/ui/convert-main.js
 */

(function () {
  'use strict'

  const PROXY_BASE = '/apps/app_api/proxy/odf-kit-service'

  // Mime types we support
  const SUPPORTED_MIMES = ['text/markdown', 'text/html', 'text/plain']

  function render() {
    // Find AppAPI's content container
    const content = document.getElementById('app-content')
      || document.getElementById('content')
      || document.body

    content.innerHTML = `
      <div id="odf-kit-ui" style="
        padding: 32px;
        max-width: 640px;
        margin: 0 auto;
        font-family: var(--font-face, Arial, sans-serif);
        color: #ffffff;
      ">
        <h2 style="margin-bottom: 8px; color: #ffffff;">Export to ODT</h2>
        <p style="color: #ffffff; margin-bottom: 24px;">
          Select a Markdown, HTML, or plain text file to convert to ODT format.
          The ODT file will be saved in the same folder as the original.
        </p>

        <button id="odf-pick-btn" class="button primary" style="margin-bottom: 16px;">
          Choose File…
        </button>

        <div id="odf-selected" style="display:none; margin-bottom: 16px;">
          <div style="
            padding: 12px 16px;
            background: var(--color-background-dark, #f5f5f5);
            border-radius: 6px;
            display: flex;
            align-items: center;
            gap: 12px;
          ">
            <span id="odf-file-path" style="flex: 1; word-break: break-all;"></span>
            <button id="odf-convert-btn" class="button primary">Export as ODT</button>
          </div>
        </div>

        <div id="odf-result" style="display:none; padding: 12px 16px; border-radius: 6px;"></div>
      </div>
    `

    let selectedPath = null

    document.getElementById('odf-pick-btn').addEventListener('click', () => {
      OC.dialogs.filepicker(
        'Select file to export as ODT',
        (path) => {
          selectedPath = path
          document.getElementById('odf-file-path').textContent = path
          document.getElementById('odf-selected').style.display = 'block'
          document.getElementById('odf-result').style.display = 'none'
        },
        false,           // multiselect
        SUPPORTED_MIMES, // mime filter
        true,            // modal
        OC.dialogs.FILEPICKER_TYPE_CHOOSE
      )
    })

    document.getElementById('odf-convert-btn').addEventListener('click', async () => {
      const resultDiv = document.getElementById('odf-result')
      const convertBtn = document.getElementById('odf-convert-btn')

      convertBtn.disabled = true
      convertBtn.textContent = 'Converting…'
      resultDiv.style.display = 'none'

      try {
        const response = await fetch(`${PROXY_BASE}/ui/convert-file`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'requesttoken': OC.requestToken,
          },
          body: JSON.stringify({
            path:   selectedPath,
            userId: OC.currentUser,
          }),
        })

        const data = await response.json()

        resultDiv.style.display = 'block'

        if (response.ok) {
          resultDiv.style.background = 'var(--color-success-background, #e8f5e9)'
          resultDiv.innerHTML = `✅ Saved as <strong>${data.outputPath}</strong>`
        } else {
          resultDiv.style.background = 'var(--color-error-background, #fde8e8)'
          resultDiv.textContent = `❌ Error: ${data.error ?? 'Conversion failed'}`
        }
      } catch (err) {
        resultDiv.style.display = 'block'
        resultDiv.style.background = 'var(--color-error-background, #fde8e8)'
        resultDiv.textContent = `❌ Error: ${err.message}`
      } finally {
        convertBtn.disabled = false
        convertBtn.textContent = 'Export as ODT'
      }
    })
  }

  // Run after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render)
  } else {
    render()
  }
})()
