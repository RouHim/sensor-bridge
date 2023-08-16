#!/usr/bin/env bash
# shellcheck disable=SC2046
#
# Description:
#   This script is used to build the update json file for sensor-bridge.
#
# Parameters:
#   $1: The version of the release without v
#
# Example:
#   ./build_update_json.sh 0.1.0
#
# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
set -e

UPDATER_FILE_NAME=sensorbridge_update.json

VERSION=$1
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)
NOTES=$(jq -r '.head_commit.message' "$GITHUB_EVENT_PATH")

echo "The update message is: '${NOTES}'"

# Collect linux AppImage data
APPIMAGE_URL="https://github.com/RouHim/sensor-bridge/releases/download/v${VERSION}/sensor-bridge_${VERSION}_amd64.AppImage.tar.gz"
APPIMAGE_SIG=$(curl -L --silent "https://github.com/RouHim/sensor-bridge/releases/download/v${VERSION}/sensor-bridge_${VERSION}_amd64.AppImage.tar.gz.sig")

# Collect windows MSI data
MSI_URL=https://github.com/RouHim/sensor-bridge/releases/download/v${VERSION}/sensor-bridge_${VERSION}_x64_en-US.msi.zip
MSI_SIG=$(curl -L --silent "https://github.com/RouHim/sensor-bridge/releases/download/v${VERSION}/sensor-bridge_${VERSION}_x64_en-US.msi.zip.sig")

# Set the generic version, notes and pub_date
cat <<< $(jq --arg VERSION "$VERSION" '.version = "\($VERSION)"' ${UPDATER_FILE_NAME}) > ${UPDATER_FILE_NAME}
cat <<< $(jq --arg NOTES "$NOTES" '.notes = "\($NOTES)"' ${UPDATER_FILE_NAME}) > ${UPDATER_FILE_NAME}
cat <<< $(jq --arg NOW "$NOW" '.pub_date = "\($NOW)"' ${UPDATER_FILE_NAME}) > ${UPDATER_FILE_NAME}

# Set the linux specific data
cat <<< $(jq --arg APPIMAGE_URL "$APPIMAGE_URL" '.platforms."linux-x86_64".url = "\($APPIMAGE_URL)"' ${UPDATER_FILE_NAME}) > ${UPDATER_FILE_NAME}
cat <<< $(jq --arg APPIMAGE_SIG "$APPIMAGE_SIG" '.platforms."linux-x86_64".signature = "\($APPIMAGE_SIG)"' ${UPDATER_FILE_NAME}) > ${UPDATER_FILE_NAME}

# Set the windows specific data
cat <<< $(jq --arg MSI_URL "$MSI_URL" '.platforms."windows-x86_64".url = "\($MSI_URL)"' ${UPDATER_FILE_NAME}) > ${UPDATER_FILE_NAME}
cat <<< $(jq --arg MSI_SIG "$MSI_SIG" '.platforms."windows-x86_64".signature = "\($MSI_SIG)"' ${UPDATER_FILE_NAME}) > ${UPDATER_FILE_NAME}