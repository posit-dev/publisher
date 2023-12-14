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

# Check sudo access
unset HAVE_SUDO_ACCESS # unset this from the environment
have_sudo_access() {
  if [[ ! -x "/usr/bin/sudo" ]]
  then
    return 1
  fi

  local -a SUDO=("/usr/bin/sudo")
  if [[ -n "${SUDO_ASKPASS-}" ]]
  then
    SUDO+=("-A")
  elif [[ -n "${NONINTERACTIVE-}" ]]
  then
    SUDO+=("-n")
  fi

  if [[ -z "${HAVE_SUDO_ACCESS-}" ]]
  then
    if [[ -n "${NONINTERACTIVE-}" ]]
    then
      "${SUDO[@]}" -l mkdir &>/dev/null
    else
      "${SUDO[@]}" -v && "${SUDO[@]}" -l mkdir &>/dev/null
    fi
    HAVE_SUDO_ACCESS="$?"
  fi

  if [[ "${HAVE_SUDO_ACCESS}" -ne 0 ]]
  then
    error "Need sudo access (e.g. the user ${USER} needs to be an Administrator)!"
  fi

  return "${HAVE_SUDO_ACCESS}"
}

# execute with sudo function
execute_sudo() {
  local -a args=("$@")
  if [[ "${EUID:-${UID}}" != "0" ]] && have_sudo_access
  then
    if [[ -n "${SUDO_ASKPASS-}" ]]
    then
      args=("-A" "${args[@]}")
    fi
    execute "/usr/bin/sudo" "${args[@]}"
  else
    execute "${args[@]}"
  fi
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

wait_for_user() {
  local c
  echo "Press ${tty_bold}RETURN${tty_reset}/${tty_bold}ENTER${tty_reset} to continue or any other key to abort:"
  getc c
  # we test for \r and \n because some stuff does \r instead
  if ! [[ "${c}" == $'\r' || "${c}" == $'\n' ]]
  then
    exit 1
  fi
}

# =============================================================================
# main
# =============================================================================

# USER isn't always set so provide a fall back for the installer and subprocesses.
if [[ -z "${USER-}" ]]
then
    USER="$(chomp "$(id -un)")"
    export USER
fi

info "Checking for \`sudo\` access (which may request your password)..."
if [[ "${OS}" == "darwin" ]]
then
  [[ "${EUID:-${UID}}" == "0" ]] || have_sudo_access
elif ! [[ -w "${PREFIX}" ]] &&
     ! have_sudo_access
then
  error "$(
    cat <<EOABORT
Insufficient permissions to install Posit Publisher to ${PREFIX}.
EOABORT
  )"
fi

# Commands
DOWNLOAD=("curl")
MKTMP=("mktemp" "-d")
TAR=("tar")

# Variables
NAME="publisher"
PREFIX="/usr/local/bin"
VERSION="0.0.dev6"
URL="https://cdn.posit.co/publisher/releases/tags/v${VERSION}"
TMPDIR=$(execute "${MKTMP[@]}")


# OS specific settings
OS="$(uname)"
if [[ "${OS}" == "Darwin" ]]
then
    OS="darwin"
    INSTALL=("/usr/bin/install" -o root -g "wheel" -m "0755")
elif [[ "${OS}" == "Linux" ]]
then
    OS="linux"
    GROUP="$(id -gn)"
    INSTALL=("/usr/bin/install" -o "${USER}" -g "${GROUP}" -m "0755")
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

info "This script will install:"
echo "${PREFIX}/${NAME}"
echo
wait_for_user
info "Downloading and installing Posit Publisher..."
execute "${DOWNLOAD[@]}" "-o" "${TMPDIR}/${NAME}-${VERSION}-${OS}-${ARCH}.tar.gz" "${URL}/${NAME}-${VERSION}-${OS}-${ARCH}.tar.gz" > /dev/null 2>&1
execute "${TAR[@]}" "-C" "${TMPDIR}" "-xf" "${TMPDIR}/${NAME}-${VERSION}-${OS}-${ARCH}.tar.gz"
execute_sudo "${INSTALL[@]}" "${TMPDIR}/${NAME}/bin/${NAME}" "${PREFIX}"
info "Installation successful!"
info "Next Steps..."
cat <<EOS

  Run ${tty_bold}publisher --help${tty_reset} to get started.

  An extension for VSCode is available for download at
  ${URL}/${NAME}-${VERSION}.vsix

EOS
