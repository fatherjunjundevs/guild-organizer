# Preparation requires explicit operator approval. No defaults or mutable tags.
ARG POSTGREST_IMAGE
ARG NODE_IMAGE
FROM ${POSTGREST_IMAGE} AS postgrest
FROM ${NODE_IMAGE}
ARG POSTGREST_IMAGE
ARG NODE_IMAGE
ARG POSTGREST_VERSION
ARG POSTGREST_SHA256
ARG SOURCE_SHA256
COPY --from=postgrest /bin/postgrest /usr/local/bin/postgrest
COPY scripts/docker/postgrest-http/harness.mjs /opt/go-http/scripts/docker/postgrest-http/harness.mjs
COPY scripts/postgrest-http-contract.mjs /opt/go-http/scripts/postgrest-http-contract.mjs
# Reject unpinned inputs and verify the copied executable; no package installation.
RUN node --input-type=module -e 'import{createHash}from"node:crypto";import{readFileSync}from"node:fs";import{spawnSync}from"node:child_process";const [p,n,v,h,s]=process.argv.slice(1);if(![p,n].every(x=>/@sha256:[a-f0-9]{64}$/.test(x))||!/^\d+\.\d+$/.test(v)||!/[a-f0-9]{64}/.test(s)||createHash("sha256").update(readFileSync("/usr/local/bin/postgrest")).digest("hex")!==h)process.exit(1);const r=spawnSync("/usr/local/bin/postgrest",["--version"],{encoding:"utf8"});if(r.status!==0||r.stdout.match(/\b\d+\.\d+\b/)?.[0]!==v)process.exit(1)' "$POSTGREST_IMAGE" "$NODE_IMAGE" "$POSTGREST_VERSION" "$POSTGREST_SHA256" "$SOURCE_SHA256"
LABEL go.http.source="${SOURCE_SHA256}" \
      go.http.postgrest.version="${POSTGREST_VERSION}" \
      go.http.postgrest.sha256="${POSTGREST_SHA256}" \
      go.http.postgrest.image="${POSTGREST_IMAGE}" \
      go.http.node.image="${NODE_IMAGE}"
WORKDIR /opt/go-http
USER 10001:10001
ENTRYPOINT ["node", "/opt/go-http/scripts/docker/postgrest-http/harness.mjs"]
CMD []
