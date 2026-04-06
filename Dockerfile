# odf-kit-service — Nextcloud ExApp
# Converts Markdown, HTML, and plain text files to ODT format.
#
# AppAPI provides all required environment variables at runtime:
#   APP_ID, APP_SECRET, APP_HOST, APP_PORT, APP_VERSION,
#   APP_DISPLAY_NAME, APP_PERSISTENT_STORAGE, NEXTCLOUD_URL,
#   AA_VERSION, COMPUTE_DEVICE

FROM node:22-alpine

WORKDIR /app

# Copy dependency files first for better layer caching
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Expose default ExApp port (AppAPI assigns actual port via APP_PORT env var)
EXPOSE 23000

# Start the service — reads APP_HOST and APP_PORT from environment
CMD ["node", "src/server.js"]
