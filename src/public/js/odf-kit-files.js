// src/frontend/odf-kit-files.ts
import { registerFileAction } from "@nextcloud/files";
var PROXY_BASE = "/apps/app_api/proxy/odf-kit-service";
var ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
</svg>`;
var ACTIONS = [
  { id: "odf-export-md", mime: "text/markdown" },
  { id: "odf-export-html", mime: "text/html" },
  { id: "odf-export-txt", mime: "text/plain" }
];
for (const { id, mime } of ACTIONS) {
  registerFileAction({
    id,
    displayName: () => "Export as ODT",
    mime,
    order: 100,
    iconSvgInline: () => ICON_SVG,
    enabled: (nodes) => {
      if (!nodes || nodes.length === 0) return false;
      return nodes.every((node) => node.mime === mime || node.mime?.startsWith(mime));
    },
    exec: async ({ node, currentUser }) => {
      try {
        const response = await fetch(`${PROXY_BASE}/file-action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileId: node.fileid,
            name: node.basename,
            directory: node.dirname,
            mime: node.mime,
            userId: currentUser?.uid ?? ""
          })
        });
        if (!response.ok) {
          console.error("[odf-kit-service] Export failed:", response.status, await response.text());
          return false;
        }
        const result = await response.json();
        console.log("[odf-kit-service] Exported to:", result.outputPath);
        return null;
      } catch (err) {
        console.error("[odf-kit-service] Export error:", err);
        return false;
      }
    },
    // Support multi-file export
    execBatch: async ({ nodes, currentUser, view, dir }) => {
      return Promise.all(
        nodes.map((node) => ({
          node,
          exec: async () => {
            try {
              const response = await fetch(`${PROXY_BASE}/file-action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  fileId: node.fileid,
                  name: node.basename,
                  directory: node.dirname,
                  mime: node.mime,
                  userId: currentUser?.uid ?? ""
                })
              });
              return response.ok ? null : false;
            } catch {
              return false;
            }
          }
        }).exec())
      );
    }
  });
}
