FROM rockylinux:8

RUN dnf -y update\
    && dnf -y install\
        curl\
        findutils\
        git\
        tar\
    && dnf -y module enable nodejs:18\
    && dnf -y module install nodejs:18

RUN dnf -y install epel-release
RUN dnf -y install ShellCheck

RUN curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to /usr/local/bin

RUN curl -L -O https://go.dev/dl/go1.21.1.linux-amd64.tar.gz\
    && rm -rf /usr/local/go\
    && tar -C /usr/local -xzf go1.21.1.linux-amd64.tar.gz
ENV PATH="$PATH:/usr/local/go/bin"

RUN go env -w GOBIN=/usr/local/go/bin\
 && go install honnef.co/go/tools/cmd/staticcheck@latest

RUN git config --global --add safe.directory '*'

RUN git clone https://github.com/bats-core/bats-core.git\
    && ./bats-core/install.sh /usr/local\
    && git clone https://github.com/ztombol/bats-support.git\
    && git clone https://github.com/ztombol/bats-assert.git
