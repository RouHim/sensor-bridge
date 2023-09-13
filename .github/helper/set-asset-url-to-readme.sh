#!/usr/bin/env bash
#
# Author: Rouven Himmelstein
#
# Description:
#   This script sets the specified asset url for linux and windows to the according download button.
#
# Parameter:
#   * $1 - New linux asset url
#   * $2 - New windows asset url
#
# Example:
#   set-asset-url-to-readme.sh "https://path/to/linux-v1.appimage" "https://path/to/windows-v1.exe"
#
# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
set -e

FILE_TO_EDIT="README.md"
NEW_LINUX_ASSET_URL=$2
NEW_WINDOWS_ASSET_URL=$3

LINUX_HTML_TAG_ID="sensor-bridge-download-linux"
WINDOWS_HTML_TAG_ID="sensor-bridge-download-windows"

# Ensure README.md exists
if [ ! -f "${FILE_TO_EDIT}" ]; then
    echo "Error: ${FILE_TO_EDIT} does not exist!"
    exit 1
fi

# Update the linux asset url
sed -i "s#<a id=\"${LINUX_HTML_TAG_ID}\" href=\".*\">#<a id=\"${LINUX_HTML_TAG_ID}\" href=\"${NEW_LINUX_ASSET_URL}\">#g" "${FILE_TO_EDIT}"

# Update the windows asset url
sed -i "s#<a id=\"${WINDOWS_HTML_TAG_ID}\" href=\".*\">#<a id=\"${WINDOWS_HTML_TAG_ID}\" href=\"${NEW_WINDOWS_ASSET_URL}\">#g" "${FILE_TO_EDIT}"