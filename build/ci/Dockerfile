FROM ubuntu:jammy

RUN apt-get update\
    && apt-get install -y \
        # curl is required in this file
        curl\
        # git is required in this file
        git\
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
        xvfb

# Just is required for this project (see Justfile, ./web/Justfile, ./tests/Justfile)
RUN curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin

# Go is required by this project. The source code is written in it!
RUN curl -L -O https://go.dev/dl/go1.21.1.linux-amd64.tar.gz\
    && rm -rf /usr/local/go\
    && tar -C /usr/local -xzf go1.21.1.linux-amd64.tar.gz
ENV PATH="$PATH:/usr/local/go/bin"

# staticcheck is required to for linting Go
RUN go env -w GOBIN=/usr/local/go/bin\
 && go install honnef.co/go/tools/cmd/staticcheck@latest

RUN git config --global --add safe.directory '*'

# NodeJS is required by this project. The source code for the client is written in it!
RUN apt-get update\
    && apt-get install -y\
        ca-certificates\
        curl\
        gnupg\
    && mkdir -p /etc/apt/keyrings\
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg\
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_16.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list\
    && apt-get update\
    && apt-get install -y\
        nodejs
