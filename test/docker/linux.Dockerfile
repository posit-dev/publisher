FROM ubuntu:jammy-20230425
VOLUME ${PWD}/../:/publishing-client
WORKDIR /publishing-client/test

RUN export DEBIAN_FRONTEND=noninteractive && \
    apt-get clean && \
    apt-get update && \
    apt-get install -y \
    curl \
    git-all

RUN git clone --depth=1 https://github.com/bats-core/bats-core.git /libs/bats-core && \
    cd /libs/bats-core && \
    ./install.sh /libs/bats-core/installation && \
    git clone --depth=1 https://github.com/ztombol/bats-support.git /libs/bats-support && \
    git clone --depth=1 https://github.com/ztombol/bats-assert.git /libs/bats-assert && \
    curl -fsSL https://github.com/casey/just/releases/download/1.14.0/just-1.14.0-x86_64-unknown-linux-musl.tar.gz \
    | tar -C /libs -xz just

ENV PATH=$PATH:/libs
ENV PATH=$PATH:/libs/bats-core/bin