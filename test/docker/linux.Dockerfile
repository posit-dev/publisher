FROM golang:latest
VOLUME ${PWD}/../:/publishing-client
WORKDIR /publishing-client/

RUN export DEBIAN_FRONTEND=noninteractive && \
    apt-get update && \
    apt-get install -y \
    dialog apt-utils \
    curl \
    gnupg \
    git-all \
    sudo

RUN git clone --depth=1 https://github.com/bats-core/bats-core.git /libs/bats-core && \
    cd /libs/bats-core && \
    ./install.sh /libs/bats-core/installation && \
    git clone --depth=1 https://github.com/ztombol/bats-support.git /libs/bats-support && \
    git clone --depth=1 https://github.com/ztombol/bats-assert.git /libs/bats-assert && \
    curl -fsSL https://github.com/casey/just/releases/download/1.14.0/just-1.14.0-x86_64-unknown-linux-musl.tar.gz \
    | tar -C /libs -xz just

RUN sudo apt remove cmdtest && sudo apt remove yarn
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | apt-key add -
RUN echo "deb https://dl.yarnpkg.com/debian/ stable main" | tee /etc/apt/sources.list.d/yarn.list
RUN sudo apt-get update
RUN sudo apt-get install yarn -y

ENV PATH=$PATH:/libs