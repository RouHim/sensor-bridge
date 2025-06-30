#!/usr/bin/env bash
#
# Author: Rouven Himmelstein
#
# Description:
#   This script sets the specified asset url for linux to the according download button.
#
# Parameter:
#   * $1 - New linux asset url
#
# Example:
#   set-asset-url-to-readme.sh "https://path/to/linux-v1.appimage"
#
# # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # # #
set -e

FILE_TO_EDIT="README.md"
NEW_LINUX_ASSET_URL=$1

LINUX_HTML_TAG_ID="sensor-bridge-download-linux"

# Ensure README.md exists
if [ ! -f "${FILE_TO_EDIT}" ]; then
  echo "Error: ${FILE_TO_EDIT} does not exist!"
  exit 1
fi

# Ensure URL HEAD http response code is smaller than 400
if [ "$(curl -s -o /dev/null -w "%{http_code}" "${NEW_LINUX_ASSET_URL}")" -ge 400 ]; then
  echo "Error: ${NEW_LINUX_ASSET_URL} is not reachable!"
  exit 1
fi

# Debug output
echo "Updating ${FILE_TO_EDIT} with new asset url:"
echo "  * Linux: ${NEW_LINUX_ASSET_URL}"

# Update the linux asset url
sed -i "s#<a id=\"${LINUX_HTML_TAG_ID}\" href=\".*\">#<a id=\"${LINUX_HTML_TAG_ID}\" href=\"${NEW_LINUX_ASSET_URL}\">#g" "${FILE_TO_EDIT}"
