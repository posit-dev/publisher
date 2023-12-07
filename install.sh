#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 0 ]; then
    echo "usage: $0"
    exit 1
fi

cmd=publisher
version="0.0.dev4"
os=$(uname | awk '{print tolower($0)}')
arch=$(uname -m | awk '{print tolower($0)}')

echo "Downloading version $version from GitHub" 1>&2
dir=$(mktemp -d)
gh release download "v$version" --clobber --dir "$dir" > /dev/null
tar -xf "$dir/$cmd-$version-$os-$arch"* -C "$dir"

echo "Installing executable to $HOME/.local/bin/$cmd" 1>&2
mkdir -p "$HOME/.local/bin/"
cp "$dir/$cmd/bin/$cmd" "$HOME/.local/bin/$cmd"
if ! [[ $(type -P "$cmd") ]]; then
    echo -e "!!! Please add the following command to your shell (.bashrc, .zshrc) !!!" 1>& 2;
    echo -e "\texport PATH=\$HOME/.local/bin:\$PATH" 1>&2;
fi

echo "Installing VSCode extension" 1>&2
code --install-extension "$dir/publisher-$version.vsix" > /dev/null 2>&1
