NB_UID := $(shell id -u)
NB_GID := $(shell id -g)

BDIST_WHEEL := dist/connect_publishing-$(VERSION)-py2.py3-none-any.whl
JUPYTER_LOG_LEVEL ?= INFO

# NOTE: See the `dist` target for why this exists.
SOURCE_DATE_EPOCH := $(shell date +%s)
export SOURCE_DATE_EPOCH

PYTHONPATH ?= $(CURDIR)
export PYTHONPATH

.PHONY: prereqs
prereqs:
	pip install -U pip
	pip install -r requirements-dev.txt

.PHONY: install-latest-rsconnect-python
install-latest-rsconnect-python:
	pip install -U https://cdn.rstudio.com/connect/rsconnect-python/latest/rsconnect_python-latest-py2.py3-none-any.whl

.PHONY: clean
clean:
	rm -rf build/ dist/ docs/out/ rsconnect_jupyter.egg-info/

.PHONY: all-images
all-images: image3.7 image3.8 image3.9 image3.10 image3.11

image%:
	docker build \
		--tag $(IMAGE)$* \
		--file Dockerfile \
		--build-arg BASE_IMAGE=python:$*-slim \
		--build-arg NB_UID=$(NB_UID) \
		--build-arg NB_GID=$(NB_GID) \
		--build-arg PY_VERSION=$* \
		.

# NOTE: Wheels won't get built if _any_ file it tries to touch has a timestamp
# before 1980 (system files) so the $(SOURCE_DATE_EPOCH) current timestamp is
# exported as a point of reference instead.
.PHONY: dist
dist: version-frontend
	rm -vf dist/*.whl
	python setup.py bdist_wheel
	twine check $(BDIST_WHEEL)
	rm -vf dist/*.egg
	@echo "::set-output name=whl::$(BDIST_WHEEL)"
	@echo "::set-output name=whl_basename::$(notdir $(BDIST_WHEEL))"

run: install
	jupyter notebook \
		-y \
		--log-level=$(JUPYTER_LOG_LEVEL) \
		--notebook-dir=./notebooks3 \
		--ip='0.0.0.0' \
		--port=9999 \
		--no-browser \
		--NotebookApp.token=''

.PHONY: install
install: version-frontend
	jupyter nbextension uninstall connect_publishing || true
	jupyter nbextension install --symlink --user --py connect_publishing
	jupyter nbextension enable --py connect_publishing
	jupyter serverextension enable --py connect_publishing

.PHONY: yarn
yarn:
	yarn install

.PHONY: lint
lint: lint-js lint-py

.PHONY: lint-js
lint-js:
	npm run lint

.PHONY: lint-py
lint-py:
	black --check --diff ./connect_publishing
	flake8 ./connect_publishing

.PHONY: fmt
fmt:
	black ./connect_publishing

## Specify that Docker runs with the calling user's uid/gid to avoid file
## permission issues on Linux dev hosts.
DOCKER_RUN_AS =
ifeq (Linux,$(shell uname))
	DOCKER_RUN_AS = -u $(shell id -u):$(shell id -g)
endif

.PHONY: version
version:
	@echo $(VERSION)

.PHONY: version-frontend
version-frontend:
	printf '{"version":"%s"}\n' $(VERSION) >connect_publishing/static/version.json

