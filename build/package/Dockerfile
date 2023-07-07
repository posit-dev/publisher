# To build and run shell: `docker run -it $(docker build -q .)` from within `build/package` subdirectory
FROM centos:7

RUN yum update -y \
    && yum install -y curl git openssl mailcap tzdata xz nodejs xorg-x11-server-Xvfb gtk2-devel gtk3-devel libnotify-devel GConf2 nss libXScrnSaver alsa-lib \
    && yum groupinstall -y "Development Tools"

RUN export GOLANG_VERSION=1.20.4 \
    && export GOLANG_DOWNLOAD_SHA256=698ef3243972a51ddb4028e4a1ac63dc6d60821bf18e59a807e051fee0a385bd \
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

# UX stack
RUN yum install -y http://dl.fedoraproject.org/pub/epel/epel-release-latest-7.noarch.rpm
RUN yum install -y npm

# pnpm
RUN export PNPM_VERSION=8.6.6 \
&& curl -fsSL https://get.pnpm.io/install.sh | sh -
ENV PATH="$PATH:/root/.local/share/pnpm"
ENV PNPM_HOME="/root/.local/share/pnpm"

# quasar CLI
# hardcoding to npm for now (instead of pnpm)
RUN npm install -g @quasar/cli 
RUN quasar --version
