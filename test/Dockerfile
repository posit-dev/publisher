FROM rstudio/rstudio-connect-preview:dev-jammy-daily
ARG QUARTO_VERSION
ARG PYTHON_VERSION

RUN curl -fsSLO https://github.com/quarto-dev/quarto-cli/releases/download/v${QUARTO_VERSION}/quarto-${QUARTO_VERSION}-linux-amd64.tar.gz && \
    tar xf quarto-${QUARTO_VERSION}-linux-amd64.tar.gz -C /opt/quarto --strip-components 1 && \
    ( echo ""; echo 'export PATH=$PATH:/opt/quarto/bin' ; echo "" ) >> ~/.profile && \
    source ~/.profile

RUN curl -fsSL -o miniconda.sh https://repo.anaconda.com/miniconda/Miniconda3-py38_4.10.3-Linux-x86_64.sh && \
    chmod 755 miniconda.sh && \
    ./miniconda.sh -b -p /opt/miniconda && \
    rm -rf miniconda.sh

RUN /opt/miniconda/bin/conda create \
    --quiet \
    --yes \
    --prefix /opt/python/ \
    --channel conda-forge python=${PYTHON_VERSION}