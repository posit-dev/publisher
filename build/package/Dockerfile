# To build and run shell: `docker run -it $(docker build -q .)` from within `build/package` subdirectory
FROM centos:7

RUN yum update -y \
    && yum install -y curl git openssl mailcap tzdata xz nodejs xorg-x11-server-Xvfb gtk2-devel gtk3-devel libnotify-devel GConf2 nss libXScrnSaver alsa-lib \
    && yum groupinstall -y "Development Tools"

RUN export GOLANG_VERSION=1.21.0 \
    && export GOLANG_DOWNLOAD_SHA256=d0398903a16ba2232b389fb31032ddf57cac34efda306a0eebac34f0965a0742 \
    && curl -fsSL "https://go.dev/dl/go${GOLANG_VERSION}.linux-amd64.tar.gz" -o golang.tar.gz \
    && echo "${GOLANG_DOWNLOAD_SHA256}  golang.tar.gz" | sha256sum -c - \
    && tar -C /usr/local -xzf golang.tar.gz \
    && rm golang.tar.gz
ENV PATH="$PATH:/usr/local/go/bin"

RUN export GOPATH=/usr/local/gotools \
    && go install -v mvdan.cc/sh/v3/cmd/shfmt@latest \
    && go install -v golang.org/x/tools/go/analysis/passes/shadow/cmd/shadow@latest \
    && go install honnef.co/go/tools/cmd/staticcheck@latest
ENV PATH="$PATH:/usr/local/gotools/bin"

RUN export SHELLCHECK_VERSION=0.9.0 \
    && curl -fsSL https://github.com/koalaman/shellcheck/releases/download/v${SHELLCHECK_VERSION}/shellcheck-v${SHELLCHECK_VERSION}.linux.x86_64.tar.xz \
        | tar -C /usr/local/bin -xJ --strip=1 shellcheck-v${SHELLCHECK_VERSION}/shellcheck \
    && chown $(id -u):$(id -g) /usr/local/bin/shellcheck

# task runner
RUN export JUST_VERSION=1.14.0 \
    && curl -fsSL https://github.com/casey/just/releases/download/${JUST_VERSION}/just-${JUST_VERSION}-x86_64-unknown-linux-musl.tar.gz \
    | tar -C /usr/local/bin -xz just

# UX stack
RUN yum install epel-release
RUN yum install -y npm
