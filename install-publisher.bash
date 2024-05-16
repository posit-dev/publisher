#!/usr/bin/env bash
set -e
if [ "${DEBUG:-false}" = true ];
then
  set -x
fi

# Fail fast with a concise message when not using bash
# Single brackets are needed here for POSIX compatibility
if [ -z "${BASH_VERSION:-}" ]
then
    error "Bash is required to interpret this script."
fi

# Check if script is run in POSIX mode
if [[ -n "${POSIXLY_CORRECT+1}" ]]
then
    error 'Bash must not run in POSIX mode. Please unset POSIXLY_CORRECT and try again.'
fi

# String formatters
if [[ -t 1 ]]
then
    tty_escape() { printf "\033[%sm" "$1"; }
else
    tty_escape() { :; }
fi
tty_mkbold() { tty_escape "1;$1"; }
tty_blue="$(tty_mkbold 34)"
tty_red="$(tty_mkbold 31)"
tty_bold="$(tty_mkbold 39)"
tty_reset="$(tty_escape 0)"

shell_join() {
    local arg
    printf "%s" "$1"
    shift
    for arg in "$@"
    do
        printf " "
        printf "%s" "${arg// /\ }"
    done
}

chomp() {
    printf "%s" "${1/"$'\n'"/}"
}

info() {
    printf "${tty_blue}==>${tty_bold} %s${tty_reset}\n" "$(shell_join "$@")"
}

warn() {
    printf "${tty_red}Warning${tty_reset}: %s\n" "$(chomp "$1")" >&2
}

error() {
    printf "%s\n" "$@" >&2
    exit 1
}

# execute function
execute() {
  if ! "$@"
  then
    error "$(printf "Failed during: %s" "$(shell_join "$@")")"
  fi
}

getc() {
  local save_state
  save_state="$(/bin/stty -g)"
  /bin/stty raw -echo
  IFS='' read -r -n 1 -d '' "$@"
  /bin/stty "${save_state}"
}

confirm_install() {
  local c
  info "Found $1, would you like to install the publisher extension for $1? [Y/n]:"

  getc c
  # we test for \r and \n because some stuff does \r instead
  if [[ "${c}" == $'\r' || "${c}" == $'\n' || "${c}" == "y" ]]; then
    execute $1 "--install-extension" "${TMPDIR}/${NAME}-${VERSION}-${OS}-${ARCH}.vsix"
  else
    echo "Skipping $1"
  fi
}

check_ides() {
  local ides
  local ides_found
  ides=("positron" "code") 
  ides_found=()
  for program in "${ides[@]}"; do
    if command -v "$program" &> /dev/null; then
        ides_found+=("$program") 
    fi
  done

  echo "${ides_found[@]}"
}

# =============================================================================
# main
# =============================================================================

# Commands
DOWNLOAD=("curl")
MKTMP=("mktemp" "-d")
TAR=("tar")


case $# in
  2)
    VERSION_TYPE=${1-release}
    VERSION=${2-latest}
    ;;
  1)
    ARG=$1
    case $ARG in
      release|nightly)
        VERSION_TYPE=$ARG
        VERSION=latest
        ;;
      *)
        VERSION_TYPE=release
        VERSION=$ARG
        ;;
    esac
    ;;
  0)
    VERSION_TYPE=release
    VERSION=latest
    ;;
esac

# ensure that our version type is right, otherwise show usage
case $VERSION_TYPE in
  release|nightly)
    ;;
  *) 
   echo "usage: $0 [release(default)|nightly] <version specifier>"
   exit 1 
   ;;
esac

# version override, swap out latest with the latest and greatest
if [[ $VERSION_TYPE == "release" && $VERSION == "latest" ]]; then
  VERSION="1.0.alpha4"
fi

# Variables
NAME="publisher"
TMPDIR=$(execute "${MKTMP[@]}")
case $VERSION_TYPE in
  release)
    URL="https://cdn.posit.co/publisher/releases/tags" ;;
  nightly)
    URL="https://cdn.posit.co/publisher/releases/nightly" ;;
esac


# OS specific settings
OS="$(uname)"
if [[ "${OS}" == "Darwin" ]]
then
    OS="darwin"
elif [[ "${OS}" == "Linux" ]]
then
    OS="linux"
else
    error "This script is only supported on macOS and Linux."
fi

# Check architecture
ARCH="$(/usr/bin/uname -m)"
if [[ "${ARCH}" == "arm64" || "${ARCH}" == "aarch64" ]]
then
    # On ARM64
    ARCH="arm64"
elif [[ "${ARCH}" == "x86_64" ]]
then
    # On AMD64
    ARCH="amd64"
else
    error "This script is only supported on arm64 and x86_64 architectures."
fi

# If none are found, warn before downloading
ides_found=($(check_ides))

if (( ${#ides_found[@]} < 1 )); then
  info "Could not find either positron or code (for vscode) in your path. "
  info "You can install either to your path by using Cmd+Shift+P from the IDE "
  info "and then selecting the 'Shell Command: install ... command in PATH'"
  info "For more information: https://github.com/posit-dev/publisher/blob/main/docs/installation.md"
  exit 1
fi

echo "Downloading Posit Publisher..."
if [[ $VERSION_TYPE == "nightly" && $VERSION == "latest" ]]
then
  # Try today and the last 10 dates, there should be one since then
  for i in {0..10}
  do
    if [[ "${OS}" == "darwin" ]]
    then
      DAY=$(date -j -v -"$i"d -I)
    else
      DAY=$(date --date="$i day ago" -I) 
    fi

    URL_TO_TRY="${URL}/v${DAY}/${NAME}-${DAY}-${OS}-${ARCH}.vsix"
    OUTPATH="${TMPDIR}/${NAME}-${DAY}-${OS}-${ARCH}.vsix"

    # Set the version to day so that the commands later works.
    VERSION=$DAY

    # Try each date, stopping on the first one that works
    echo "Trying ${URL_TO_TRY}"
    if "${DOWNLOAD[@]}" "--fail-with-body" "-o" "$OUTPATH" "$URL_TO_TRY" > /dev/null 2>&1
    then
      break
    fi
  done
else
  echo "Trying ${URL}/v${VERSION}/${NAME}-${VERSION}-${OS}-${ARCH}.vsix"
  execute "${DOWNLOAD[@]}" "-o" "${TMPDIR}/${NAME}-${VERSION}-${OS}-${ARCH}.vsix" "${URL}/v${VERSION}/${NAME}-${VERSION}-${OS}-${ARCH}.vsix" > /dev/null 2>&1
fi

for ide in "${ides_found[@]}"; do
  confirm_install $ide
done

echo
info "You may need to relaunch your IDE or CMD/CTRL+SHIFT+P > Reload Window to use the new version. Goodbye!"
