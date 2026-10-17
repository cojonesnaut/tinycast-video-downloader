#!/bin/zsh
set -e
cd "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  print "Install Node.js with npm, then run this file again."
  read "?Press Return to close."
  exit 1
fi
npm install --ignore-scripts
npm run build
print "Build complete. Add this folder in Tinycast Settings > Extensions > Install > Add Folder."
read "?Press Return to close."
