#!/bin/env bash
# Description:
#     Uploads a binary to the latest GitHub release of a repository.
#
# Parameters:
#     $1 - GitHub token
#     $2 - Path to the binary
#     $3 - Name of the binary
#
# Usage:
#     upload-asset-to-release.sh <github_token> <path_to_binary> <binary_name>
#
# Example:
#     upload-asset-to-release.sh 123456789 ./bin/sensor-bridge sensor-bridge
#####################
set -e

GITHUB_TOKEN=$1
BIN_PATH=$2
NAME=$3
echo "Uploading $BIN_PATH to $NAME"
RELEASE_ID=$(curl -s https://api.github.com/repos/RouHim/sensor-bridge/releases/latest | jq -r '.id' )
UPLOAD_URL="https://uploads.github.com/repos/RouHim/sensor-bridge/releases/${RELEASE_ID}/assets?name=${NAME}"
curl -X POST \
  -H "Content-Type: $(file -b --mime-type "$BIN_PATH")" \
	-H "Authorization: token ${GITHUB_TOKEN}"\
	-T "${BIN_PATH}" \
  "${UPLOAD_URL}"