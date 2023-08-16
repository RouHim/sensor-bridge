# Description:
#     Uploads a binary to the latest GitHub release of a repository.
#
# Parameters:
#     \$1 - GitHub token
#     \$2 - Path to the binary
#     \$3 - Name of the binary in the release
#
# Usage:
#     upload-asset-to-release.ps1 <github_token> <path_to_binary> <binary_name>
#
# Example:
#     upload-asset-to-release.ps1 123456789 ./bin/sensor-bridge sensor-bridge

param (
	[Parameter(Mandatory=$true)]
	[string]$GITHUB_TOKEN,

	[Parameter(Mandatory=$true)]
	[string]$BIN_PATH,

	[Parameter(Mandatory=$true)]
	[string]$NAME
)

Write-Host "Uploading ${BIN_PATH} to ${NAME}"

# Determine the release ID
$RELEASE_ID = Invoke-RestMethod -Uri https://api.github.com/repos/RouHim/sensor-bridge/releases/latest | Select-Object -ExpandProperty id

# Build the upload URL
$UPLOAD_URL = "https://uploads.github.com/repos/RouHim/sensor-bridge/releases/${RELEASE_ID}/assets?name=${NAME}"

# Get the MIME type of the binary
$MIME_TYPE = (Get-File -Path $BIN_PATH).MimeType

# Create headers for the request
$HEADERS = @{
	"Content-Type" = $MIME_TYPE
	"Authorization" = "token ${GITHUB_TOKEN}"
}

# Upload the binary to GitHub latest github release
Invoke-RestMethod -Method Post -Uri $UPLOAD_URL -Headers $HEADERS -InFile $BIN_PATH -TimeoutSec 60
