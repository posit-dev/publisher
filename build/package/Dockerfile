FROM centos:7

RUN yum update -y \
    && yum install -y curl git openssl mailcap tzdata xz \
    && yum groupinstall -y "Development Tools"

RUN export GOLANG_VERSION=1.19.5 \
    && export GOLANG_DOWNLOAD_SHA256=36519702ae2fd573c9869461990ae550c8c0d955cd28d2827a6b159fda81ff95 \
    && curl -fsSL "https://go.dev/dl/go${GOLANG_VERSION}.linux-amd64.tar.gz" -o golang.tar.gz \
    && echo "${GOLANG_DOWNLOAD_SHA256}  golang.tar.gz" | sha256sum -c - \
    && tar -C /usr/local -xzf golang.tar.gz \
    && rm golang.tar.gz
ENV PATH="$PATH:/usr/local/go/bin"

RUN export GOPATH=/usr/local/gotools \
    && go install -v mvdan.cc/sh/v3/cmd/shfmt@latest \
    && go install -v golang.org/x/tools/go/analysis/passes/shadow/cmd/shadow@latest
ENV PATH="$PATH:/usr/local/gotools/bin"

RUN export SHELLCHECK_VERSION=0.9.0 \
    && curl -fsSL https://github.com/koalaman/shellcheck/releases/download/v${SHELLCHECK_VERSION}/shellcheck-v${SHELLCHECK_VERSION}.linux.x86_64.tar.xz \
        | tar -C /usr/local/bin -xJ --strip=1 shellcheck-v${SHELLCHECK_VERSION}/shellcheck \
    && chown $(id -u):$(id -g) /usr/local/bin/shellcheck

# task runner
RUN export JUST_VERSION=1.13.0 \
    && curl -fsSL https://github.com/casey/just/releases/download/${JUST_VERSION}/just-${JUST_VERSION}-x86_64-unknown-linux-musl.tar.gz \
    | tar -C /usr/local/bin -xz just
