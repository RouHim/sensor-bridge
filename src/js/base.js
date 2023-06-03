const {invoke} = window.__TAURI__.tauri;

const txtDisplayMode = document.getElementById("txt-display-mode");
const lblComPortNameHeader = document.getElementById("com-port-name-header");

export function saveConfig() {
    // Get current com port by header id
    let comPort = lblComPortNameHeader.innerText;

    // If comport is empty, return
    if (comPort === "") {
        return;
    }

    // Get selected output mode
    let outputMode = txtDisplayMode.options[txtDisplayMode.selectedIndex].value;

    // Get LCD Resolution Height and cast to integer
    let lcdResolutionWidth = document.getElementById("lcd-txt-resolution-width").value;
    let lcdResolutionHeight = document.getElementById("lcd-txt-resolution-height").value;

    // Build lcd config object, with integers
    let lcdConfig = {
        resolution_width: parseInt(lcdResolutionWidth),
        resolution_height: parseInt(lcdResolutionHeight),
    }

    invoke('save_config', {
        comPort: comPort,
        outputMode: outputMode,
        lcdConfig: JSON.stringify(lcdConfig),
    });
}