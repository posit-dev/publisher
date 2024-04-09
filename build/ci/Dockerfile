FROM ubuntu:jammy

ARG NODEVERSION=18
RUN \
    --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update\
    && apt-get install -y\
        # ca-certificates is required in this file
        ca-certificates\
        # curl is required in this file
        curl\
        # git is required in this file
        git\
        # gnupg is required in this file
        gnupg\
        # The following are required by Cypress
        libgtk2.0-0\
        libgtk-3-0\
        libgbm-dev\
        libnotify-dev\
        libgconf-2-4\
        libnss3\
        libxss1\
        libasound2\
        libxtst6\
        python3\
        python-is-python3\
        python3-pip\
        xauth\
        xvfb\
        # The following are required for tooling
        zip\
        # NodeJS is required by this project. The source code for the client is written in it!
        && mkdir -p /etc/apt/keyrings\
        && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg\
        && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODEVERSION.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list\
        && apt-get update\
        && apt-get install -y\
            nodejs

# Mark all directories as safe for Git
RUN git config --global --add safe.directory '*'

# Just is required for this project (see justfile, ./web/justfile, etc.)
RUN curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin

# Go is required by this project. The source code is written in it!
ARG GOVERSION=1.22.2
ARG GOCHECKSUM=5901c52b7a78002aeff14a21f93e0f064f74ce1360fce51c6ee68cd471216a17
ARG GOARCHIVE=go$GOVERSION.linux-amd64.tar.gz
# The following is required for Go.
# /usr/local/go/bin is added to the path so that the Go binary is available to the root user.
# /root/go/bin is added to the path so that the Go tools are available to the root user.
ENV PATH="$PATH:/usr/local/go/bin:/root/go/bin"
RUN\
    curl -L -O https://go.dev/dl/$GOARCHIVE\
    && echo "$GOCHECKSUM $GOARCHIVE" | sha256sum -c -\
    && tar -C /usr/local -xzf $GOARCHIVE\
    && rm $GOARCHIVE\
    # staticcheck is required to for linting Go
    && go install honnef.co/go/tools/cmd/staticcheck@latest


# AWS is required by this project. The build tooling uses it!
ARG AWSARCHIVE=awscli-exe-linux-x86_64.zip
RUN curl -L -O "https://awscli.amazonaws.com/${AWSARCHIVE}" \
    && unzip -q "${AWSARCHIVE}" \
    && rm "${AWSARCHIVE}"\
    && ./aws/install\
    && rm -r ./aws

ARG QUARTO_VERSION="1.4.549"
ARG PACKAGE="quarto-${QUARTO_VERSION}-linux-amd64.tar.gz"

RUN\
    curl -fsSLO https://github.com/quarto-dev/quarto-cli/releases/download/v${QUARTO_VERSION}/${PACKAGE}\
    && mkdir /usr/local/quarto && tar xf ${PACKAGE} -C /usr/local/quarto --strip-components 1

ENV PATH="$PATH:/usr/local/quarto/bin"
