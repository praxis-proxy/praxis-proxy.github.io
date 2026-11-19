FROM lycheeverse/lychee:0.24.2-alpine@sha256:2255c0b916cc8fc4193f59a4549358a6bae0f7d4ea16b5e1dd4c3b2733c35504 AS lychee

FROM ghcr.io/gohugoio/hugo:v0.170.1@sha256:4cc9f383086c0fba180efcf7132cf2f025969c462fedf5fcd2bf921915416797

COPY --from=lychee /usr/local/bin/lychee /usr/local/bin/lychee

USER root
RUN apk add --no-cache make python3 \
    && mkdir -p /project/node_modules \
    && chmod 1777 /project/node_modules

WORKDIR /project
ENTRYPOINT []
