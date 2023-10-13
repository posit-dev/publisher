FROM --platform=$BUILDPLATFORM ubuntu:jammy

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
        xauth\
        xvfb\
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
ARG GOVERSION=1.21.3
ARG GOCHECKSUM=1241381b2843fae5a9707eec1f8fb2ef94d827990582c7c7c32f5bdfbfd420c8
ARG GOARCHIVE=go$GOVERSION.linux-amd64.tar.gz
ENV PATH="$PATH:/usr/local/go/bin"
RUN \
    --mount=type=cache,target=/usr/local/go,sharing=locked \
    curl -L -O https://go.dev/dl/$GOARCHIVE\
    && echo "$GOCHECKSUM $GOARCHIVE" | sha256sum -c - \
    && tar -C /usr/local -xzf $GOARCHIVE\
    && rm $GOARCHIVE\
    && go env -w GOPATH=/usr/local/go\
    # staticcheck is required to for linting Go
    && go install honnef.co/go/tools/cmd/staticcheck@latest
