FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    xz-utils \
    fontconfig \
    fonts-liberation \
    fonts-dejavu-core \
    fonts-noto-core \
  && rm -rf /var/lib/apt/lists/* \
  && fc-cache -fv

ARG TYPST_VERSION=0.14.2
ARG TARGETARCH
RUN case "$TARGETARCH" in \
      amd64) TYPST_ARCH="x86_64-unknown-linux-musl" ;; \
      arm64) TYPST_ARCH="aarch64-unknown-linux-musl" ;; \
      *) echo "Unsupported arch: $TARGETARCH" && exit 1 ;; \
    esac && \
    curl -fsSL \
      "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-${TYPST_ARCH}.tar.xz" \
      | tar -xJ --strip-components=1 -C /usr/local/bin/ "typst-${TYPST_ARCH}/typst" && \
    typst --version

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

EXPOSE $APP_PORT
CMD ["node", "src/server.js"]
