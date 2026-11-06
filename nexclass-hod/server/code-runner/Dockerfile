FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       ca-certificates python3 nodejs default-jdk-headless gcc g++ \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 runner \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin runner

WORKDIR /work
USER 10001:10001
CMD ["/bin/true"]
