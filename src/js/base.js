const {invoke} = window.__TAURI__.tauri;

const txtDisplayMode = document.getElementById("txt-display-mode");
const lblComPortNameHeader = document.getElementById("com-port-name-header");

export function saveConfig() {
    // Get current com port by header id
    let comPort = lblComPortNameHeader.innerText;

    let outputMode = txtDisplayMode.options[txtDisplayMode.selectedIndex].value;

    invoke('save_config', {
        comPort: comPort,
        outputMode: outputMode,
    });
}