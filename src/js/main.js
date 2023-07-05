const {invoke} = window.__TAURI__.tauri;
import {saveConfig} from './base.js';
import {onLcdSelected} from './lcd.js';

let currentComPort = "";

const lblComPortNameHeader = document.getElementById("com-port-name-header");
const cmbPortMode = document.getElementById("txt-display-mode");

window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-refresh-com-ports").addEventListener("click", loadComPorts);

    // Select current config view
    cmbPortMode.addEventListener("change", outputModeChanged);

    document.getElementById("main-chk-transfer-active").addEventListener("click",
        () => toggleSync(document.getElementById("main-chk-transfer-active").checked)
    );

    loadComPorts();
});

function outputModeChanged() {
    // Get selected output mode
    let outputMode = cmbPortMode.value;

    // match output mode to the corresponding config view
    switch (outputMode) {
        case "Lcd":
            document.getElementById("lcd-panel").style.display = "block";
            document.getElementById("i2c-panel").style.display = "none";
            document.getElementById("spi-panel").style.display = "none";
            onLcdSelected(currentComPort);
            break;
        case "I2c":
            document.getElementById("lcd-panel").style.display = "none";
            document.getElementById("i2c-panel").style.display = "block";
            document.getElementById("spi-panel").style.display = "none";
            break;
        case "Spi":
            document.getElementById("lcd-panel").style.display = "none";
            document.getElementById("i2c-panel").style.display = "none";
            document.getElementById("spi-panel").style.display = "block";
            break;
    }

    saveConfig();
}

function loadComPorts() {
    // Receive all available com ports
    invoke('get_com_ports').then(
        // Then pass them as list items to the main-com-ports element
        (comPorts) => {
            document.getElementById("main-com-ports").innerHTML = comPorts.map(
                (comPort) => `<li class="com-port-item">${comPort}</li>`
            ).join("");

            const listItems = document.querySelectorAll("#main-com-ports li");
            listItems.forEach(function (item) {
                item.addEventListener("click", function () {
                    onComPortSelected(item);
                });
            });

            // Fire onComPortSelected for the first com port
            if (listItems.length > 0) {
                onComPortSelected(listItems[0]);
            }
        }
    );
}

function onComPortSelected(element) {
    currentComPort = element.innerText;

    lblComPortNameHeader.innerText = currentComPort;

    invoke('load_port_config', {comPort: currentComPort}).then(
        (portConfig) => {
            // cast port config to json object
            portConfig = JSON.parse(portConfig);

            // Set com port mode and fire outputModeChanged
            cmbPortMode.value = portConfig.mode;
            outputModeChanged();
        }
    );
}

// Toggles the sync for the selected com port
function toggleSync(checked) {
    if (checked) {
        console.log("enable sync");
        invoke('enable_sync', {comPort: lblComPortNameHeader.innerText});
    } else {
        console.log("disable sync");
        invoke('disable_sync', {comPort: lblComPortNameHeader.innerText});
    }
}