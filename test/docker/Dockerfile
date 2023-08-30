FROM ubuntu:jammy-20230425
EXPOSE 9000
VOLUME ${PWD}/../:/publishing-client
WORKDIR /publishing-client/test
ARG platform
ARG FUZZBUCKET_SSH_KEY
ARG FUZZBUCKET_URL
ARG FUZZBUCKET_CREDENTIALS

ENV platform=$platform
ENV FUZZBUCKET_SSH_KEY=$FUZZBUCKET_SSH_KEY
ENV FUZZBUCKET_URL=$FUZZBUCKET_URL
ENV FUZZBUCKET_CREDENTIALS=$FUZZBUCKET_CREDENTIALS

RUN export DEBIAN_FRONTEND=noninteractive && \
    apt-get clean && \
    apt-get update && \
    apt-get install -y \
    curl \
    git-all \
    npm \
    xvfb \
    libnss3 \
    libatk1.0-0 \
    libgtk2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    libnotify-dev \
    libgconf-2-4 \
    libnss3 \
    libxss1 \
    libasound2 \
    libxtst6 \
    xauth \
    xvfb \
    python3 \
    python3-pip \
    python-is-python3 \
    jq

RUN export GOLANG_VERSION=1.20.4 \
    && export GOLANG_DOWNLOAD_SHA256=698ef3243972a51ddb4028e4a1ac63dc6d60821bf18e59a807e051fee0a385bd \
    && curl -fsSL "https://go.dev/dl/go${GOLANG_VERSION}.${platform}.tar.gz" -o golang.tar.gz \
    && tar -C /usr/local -xzf golang.tar.gz \
    && rm golang.tar.gz
ENV PATH="$PATH:/usr/local/go/bin"
ENV PATH="$PATH:"

RUN npm install -g n && \
    n stable

RUN git clone --depth=1 https://github.com/bats-core/bats-core.git /libs/bats-core && \
    cd /libs/bats-core && \
    ./install.sh /libs/bats-core/installation && \
    git clone --depth=1 https://github.com/ztombol/bats-support.git /libs/bats-support && \
    git clone --depth=1 https://github.com/ztombol/bats-assert.git /libs/bats-assert && \
    curl -fsSL https://github.com/casey/just/releases/download/1.14.0/just-1.14.0-x86_64-unknown-linux-musl.tar.gz \
    | tar -C /libs -xz just

ENV PATH=$PATH:/libs
ENV PATH=$PATH:/libs/bats-core/bin