const {invoke} = window.__TAURI__.tauri;

let lstComPorts;


function addOutputAddress() {
    // Open modal dialog to request new output address using javascript prompt
    let newOutputAddress = prompt("Please enter the new output address", "");
    if (newOutputAddress != null) {
        // Get current com port by header id
        let comPort = document.getElementById("lblHeaderComName").innerText;

        invoke('add_output_address', {comPort: comPort, address: newOutputAddress}).then(
            // Add to output address list and select
            document.getElementById("txtOutputAddress").innerHTML +=
                `<option value="${newOutputAddress}" selected>${newOutputAddress}</option>`
        );
    }
}

function deleteOutputAddress() {
    // Get current com port by header id
    let comPort = document.getElementById("lblHeaderComName").innerText;

    // Get selected output address
    let outputAddress = document.getElementById("txtOutputAddress").value;

    // If it is empty, return
    if (outputAddress === "") {
        return;
    }

    invoke('delete_output_address', {comPort: comPort, address: outputAddress}).then(() => {
            // Remove from output address list
            let outputAddressList = document.getElementById("txtOutputAddress");
            outputAddressList.remove(outputAddressList.selectedIndex);

            // Select the first entry if there is one
            if (outputAddressList.length > 0) {
                outputAddressList.selectedIndex = 0;

                // Trigger onAddressChanged to load the first output address config
                onAddressChanged();
            } else {
                // Clear the preview and address config
                document.getElementById("txtOutputFormat").value = "";
                document.getElementById("txtPreview").innerHTML = "";
            }
        }
    );
}

function saveAddressConfig() {
    // Get current com port by header id
    let comPort = document.getElementById("lblHeaderComName").innerText;

    // Get selected output address
    let outputAddress = document.getElementById("txtOutputAddress").value;

    // Get output format
    let dataConfig = document.getElementById("txtOutputFormat").value;

    // If comport or output address is empty, return
    if (comPort === "" || outputAddress === "") {
        return;
    }

    invoke('save_address_config', {comPort: comPort, outputAddress: outputAddress, dataConfig: dataConfig});
}

// Renders the txtOutputFormat text field with the current address config to the txtPreview text field
function onAddressConfigChanged() {
    let outputFormat = document.getElementById("txtOutputFormat").value;

    // Replace all sensor ids in the curly brackets with the sensor title
    let previewText = outputFormat.replace(/{([^}]+)}/g, function (match, sensorId) {
        return document.getElementById(sensorId).title;
    });

    // set to preview text field
    document.getElementById("txtPreview").innerHTML = previewText;

    // Save address config
    saveAddressConfig();
}

window.addEventListener("DOMContentLoaded", () => {
    lstComPorts = document.querySelector("#lstComPorts");
    document.querySelector("#btnRefreshComPorts").addEventListener("click", () => loadComPorts());
    document.querySelector("#btnRefreshSensorValues").addEventListener("click", () => loadSensorValues());
    document.querySelector("#btnAddOutputAddress").addEventListener("click", () => addOutputAddress());
    document.querySelector("#btnDeleteOutputAddress").addEventListener("click", () => deleteOutputAddress());

    document.getElementById("txtOutputFormat").addEventListener("input", onAddressConfigChanged);

    document.getElementById("kill-switch-input").addEventListener("change", function () {
        // TODO: this does not work correctly, state is always false
        if (this.checked) {
            enableSync();
        } else {
            disableSync();
        }
    });


    loadComPorts();
});

function loadComPorts() {
    // Receive all available com ports
    invoke('get_com_ports').then(
        // Then pass them as list items to the lstComPorts element
        (comPorts) => {
            document.getElementById("lstComPorts").innerHTML = comPorts.map(
                (comPort) => `<li class="com-port-item">${comPort}</li>`
            ).join("");

            const listItems = document.querySelectorAll("#lstComPorts li");
            listItems.forEach(function (item) {
                item.addEventListener("click", function () {
                    onComPortSelected(item);
                });
            });
        }
    );
}

function onComPortSelected(element) {
    let portName = element.innerText;
    invoke('load_port_config', {comPort: portName}).then(
        (portConfig) => {
            // load sensor values
            loadSensorValues();

            // cast port config to json object
            portConfig = JSON.parse(portConfig);

            // load output addresses into dropdown
            let outputAddresses = Object.keys(portConfig.output_config);
            let options = '';
            const selected = "selected";
            for (let i = 0; i < outputAddresses.length; i++) {
                let outputAddress = outputAddresses[i];
                options += `<option value="${outputAddress}" ${i === 0 ? selected : ""}>${outputAddress}</option>`;
            }
            document.getElementById("txtOutputAddress").innerHTML = options;
            document.getElementById("txtOutputAddress").addEventListener("change", onAddressChanged);

            // Fill com port config fields
            document.getElementById("lblHeaderComName").innerText = portConfig.com_port;
            document.getElementById("txtBaudRate").value = portConfig.baud_rate;
            document.getElementById("txtPushRate").value = portConfig.push_rate;
            document.getElementById("chkTransferActive").checked = portConfig.active;

            // Trigger onAddressChanged to load the first output address config
            onAddressChanged();
        }
    );
}

function onAddressChanged() {
    let comPort = document.getElementById("lblHeaderComName").innerText;
    let outputAddress = document.getElementById("txtOutputAddress").value;

    // if comport or output address is empty, return
    if (comPort === "" || outputAddress === "") {
        return;
    }

    invoke('load_address_config', {comPort: comPort, outputAddress: outputAddress}).then(
        (dataConfig) => {
            document.getElementById("txtOutputFormat").value = dataConfig;
            onAddressConfigChanged();
        }
    );
}

// Appends a sensor to the txtOutputFormat at the current cursor position or at the end if no cursor position is set
function appendSensorToAddressConfig(sensorId) {
    let outputFormat = document.getElementById("txtOutputFormat");
    let cursorPosition = outputFormat.selectionStart;
    let textBefore = outputFormat.value.substring(0, cursorPosition);
    let textAfter = outputFormat.value.substring(cursorPosition, outputFormat.value.length);

    // Wrap sensor id with curly brackets
    sensorId = "{" + sensorId + "}";

    outputFormat.value = textBefore + sensorId + textAfter;
}

function loadSensorValues() {
    invoke('get_sensor_values').then(
        (sensorValues) => {

            // cast sensor values to json object
            // Example string: [{"id":"SCPUCLK","value":"3393","label":"CPU Clock","sensor_type":"sys"},{"id":"SCPUUTI","value":"41","label":"CPU Utilization","sensor_type":"sys"},{"id":"SFREEMEM","value":"9241","label":"Free Memory","sensor_type":"sys"},{"id":"SGPU1UTI","value":"7","label":"GPU Utilization","sensor_type":"sys"},{"id":"TCPUPKG","value":"68","label":"CPU Package","sensor_type":"temp"},{"id":"TGPU1DIO","value":"46","label":"GPU Diode","sensor_type":"temp"},{"id":"FCPU","value":"3275","label":"CPU","sensor_type":"fan"},{"id":"PCPUPKG","value":"12.27","label":"CPU Package","sensor_type":"pwr"}]
            sensorValues = JSON.parse(sensorValues);

            // Use the id as id tag for the list item and set class to sensor-item
            // Also set the current value as tile
            // Use the label as text and add the sensor type in brackets
            document.getElementById("lstSensorValues").innerHTML = sensorValues.map(
                (sensorValue) => `<li id="${sensorValue.id}" class="sensor-item" title="${sensorValue.value}">${sensorValue.label} (${sensorValue.sensor_type})</li>`
            ).join("");

            // Register click event listener for all sensor items
            const listItems = document.querySelectorAll("#lstSensorValues li");
            listItems.forEach(function (item) {
                item.addEventListener("click", function () {
                    appendSensorToAddressConfig(item.id)
                    onAddressConfigChanged();
                });
            });

            // Re-render preview
            onAddressConfigChanged();
        }
    );
}

// Enables the sync for the selected com port
function enableSync() {
    invoke('enable_sync', {comPort: document.getElementById("lblHeaderComName").innerText});
}

// Disables the sync for the selected com port
function disableSync() {
    invoke('disable_sync', {comPort: document.getElementById("lblHeaderComName").innerText});
}
