#!/bin/env bash
# Description:
#     Uploads a binary to the latest GitHub release of a repository.
#
# Parameters:
#     $1 - GitHub token
#     $2 - Path to the binary
#     $3 - Name of the binary in the release
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

# Print the length of the GITHUB_TOKEN variable
echo "GITHUB_TOKEN length: ${#GITHUB_TOKEN}"
echo "Uploading '${BIN_PATH}' to '${NAME}'"

# Determine the release ID
RELEASE_ID=$(curl -s https://api.github.com/repos/RouHim/sensor-bridge/releases/latest | jq -r '.id' )

# Build the upload URL
UPLOAD_URL="https://uploads.github.com/repos/RouHim/sensor-bridge/releases/${RELEASE_ID}/assets?name=${NAME}"

# Upload the binary to GitHub latest github release
curl -X POST \
  -H "Content-Type: $(file -b --mime-type "${BIN_PATH}")" \
	-H "Authorization: token ${GITHUB_TOKEN}"\
	-T "${BIN_PATH}" \
	--connect-timeout 10 \
	--max-time 60 \
  "${UPLOAD_URL}"