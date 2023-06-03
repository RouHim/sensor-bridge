const {invoke} = window.__TAURI__.tauri;
import {saveConfig} from './base.js';
import {onLcdSelected} from './lcd.js';

window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-refresh-com-ports").addEventListener("click", loadComPorts);

    // Select current config view
    document.getElementById("txt-display-mode").addEventListener("change", outputModeSelected);

    document.getElementById("main-chk-transfer-active").addEventListener("click",
        () => toggleSync(document.getElementById("main-chk-transfer-active").checked)
    );

    loadComPorts();
    onLcdSelected();
});

function outputModeSelected() {
    // Get selected output mode
    let outputMode = document.getElementById("txt-display-mode").value;

    // match output mode to the corresponding config view
    switch (outputMode) {
        case "Lcd":
            document.getElementById("lcd-panel").style.display = "block";
            document.getElementById("i2c-panel").style.display = "none";
            document.getElementById("spi-panel").style.display = "none";
            onLcdSelected();
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
    let portName = element.innerText;

    document.getElementById("com-port-name-header").innerText = portName;

    invoke('load_port_config', {comPort: portName}).then(
        (portConfig) => {
            // cast port config to json object
            portConfig = JSON.parse(portConfig);

            document.getElementById("txt-display-mode").value = portConfig.mode;
        }
    );
}

// Toggles the sync for the selected com port
function toggleSync(checked) {
    if (checked) {
        console.log("enable sync");
        invoke('enable_sync', {comPort: document.getElementById("com-port-name-header").innerText});
    } else {
        console.log("disable sync");
        invoke('disable_sync', {comPort: document.getElementById("com-port-name-header").innerText});
    }
}