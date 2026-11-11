# sae-backend-test:dev — tests/apps/backend's test backend, built for Linux,
# for tests/apps/backend_wslc (docs/app-backend.md). build-image.sh stages
# the context (this file, main.ae, sdk/) and passes AE_PIN from sae's pins.
FROM ubuntu:22.04 AS build
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      ca-certificates curl gcc libc6-dev make git \
 && rm -rf /var/lib/apt/lists/*
ARG AE_PIN
# Empty: the AE_PIN release (binary). A branch or SHA: built from source.
ARG AETHER_REF=
ENV PATH=/root/.local/bin:$PATH
RUN curl -fsSL https://raw.githubusercontent.com/aether-lang-dev/aeb/main/get.sh -o /tmp/get.sh \
 && if [ -z "$AETHER_REF" ]; then unset AETHER_REF; fi \
 && AEBGET_SOURCE_ONLY=1 . /tmp/get.sh && AE_PIN="$AE_PIN" ae_ensure && ae version
COPY sdk /src/sdk
COPY main.ae /src/main.ae
RUN cd /src && AETHER_LIB_DIR=/src/sdk ae build main.ae -o /src/backend

FROM ubuntu:22.04
COPY --from=build /src/backend /sae/backend
