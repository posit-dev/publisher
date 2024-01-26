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
ARG GOVERSION=1.21.6
ARG GOCHECKSUM=3f934f40ac360b9c01f616a9aa1796d227d8b0328bf64cb045c7b8c4ee9caea4
ARG GOARCHIVE=go$GOVERSION.linux-amd64.tar.gz
ENV PATH="$PATH:/usr/local/go/bin"
RUN\
    curl -L -O https://go.dev/dl/$GOARCHIVE\
    && echo "$GOCHECKSUM $GOARCHIVE" | sha256sum -c -\
    && tar -C /usr/local -xzf $GOARCHIVE\
    && rm $GOARCHIVE\
    && go env -w GOPATH=/usr/local/go\
    # staticcheck is required to for linting Go
    && go install honnef.co/go/tools/cmd/staticcheck@latest

# AWS is required by this project. The build tooling uses it!
ARG AWSARCHIVE=awscli-exe-linux-x86_64.zip
RUN curl -L -O "https://awscli.amazonaws.com/${AWSARCHIVE}" \
    && unzip -q "${AWSARCHIVE}" \
    && rm "${AWSARCHIVE}"\
    && ./aws/install\
    && rm -r ./aws
