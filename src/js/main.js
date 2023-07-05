const {invoke} = window.__TAURI__.tauri;
import {saveConfig} from './base.js';
import {onLcdSelected} from './lcd.js';

let currentComPort = "";

const lblNetPortNameHeader = document.getElementById("net-port-name-header");

window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-refresh-net-ports").addEventListener("click", loadNetPorts);

    document.getElementById("main-chk-transfer-active").addEventListener("click",
        () => toggleSync(document.getElementById("main-chk-transfer-active").checked)
    );

    loadNetPorts();
});

function loadNetPorts() {
    // Receive all available net ports
    invoke('get_net_ports').then(
        // Then pass them as list items to the main-net-ports element
        (netPorts) => {
            document.getElementById("main-net-ports").innerHTML = netPorts.map(
                (netPort) => `<li class="net-port-item">${netPort}</li>`
            ).join("");

            const listItems = document.querySelectorAll("#main-net-ports li");
            listItems.forEach(function (item) {
                item.addEventListener("click", function () {
                    onComPortSelected(item);
                });
            });

            // Fire onComPortSelected for the first net port
            if (listItems.length > 0) {
                onComPortSelected(listItems[0]);
            }
        }
    );
}

function onNetPortSelected(element) {
    currentComPort = element.innerText;

    lblComPortNameHeader.innerText = currentComPort;

    invoke('load_port_config', {netPort: currentComPort}).then(
        (portConfig) => {
            // cast port config to json object
            portConfig = JSON.parse(portConfig);

            // Set net port mode and fire outputModeChanged
            cmbPortMode.value = portConfig.mode;
            outputModeChanged();
        }
    );
}

// Toggles the sync for the selected net port
function toggleSync(checked) {
    if (checked) {
        console.log("enable sync");
        invoke('enable_sync', {netPort: lblComPortNameHeader.innerText});
    } else {
        console.log("disable sync");
        invoke('disable_sync', {netPort: lblComPortNameHeader.innerText});
    }
}