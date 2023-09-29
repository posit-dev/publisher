FROM rockylinux:8

RUN dnf -y update\
    && dnf -y install\
        # curl is required in this file
        curl\
        # findutils is required by bats
        findutils\
        # git is required in this file
        git\
        # Python3 is required to for testing
        python3\
        # tar is required in this file
        tar\
        # The following are required by Cypress
        alsa-lib\
        GConf2\
        glibc\
        gtk2-devel\
        gtk3-devel\
        libnotify-devel\
        libXScrnSaver\
        nss\
        xorg-x11-server-Xvfb\
    # NodeJS is required by this project. The source code for the client is written in it!
    && dnf -y module enable nodejs:16\
    && dnf -y module install nodejs:16

# epel-release is required by ShellCheck
RUN dnf -y install epel-release

# epel-release is required by ShellCheck
RUN dnf -y install ShellCheck

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

RUN git clone https://github.com/bats-core/bats-core.git\
    && ./bats-core/install.sh /usr/local\
    && git clone https://github.com/ztombol/bats-support.git\
    && git clone https://github.com/ztombol/bats-assert.git
