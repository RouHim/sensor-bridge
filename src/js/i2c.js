const {invoke} = window.__TAURI__.tauri;

window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("i2c-btn-refresh-sensor-values").addEventListener("click", loadSensorValues);
    document.getElementById("i2c-btn-add-output-address").addEventListener("click", addOutputAddress);
    document.getElementById("i2-btn-delete-output-address").addEventListener("click", deleteOutputAddress);

    document.getElementById("i2c-txt-output-format").addEventListener("input", onAddressConfigChanged);

    // save config when baud rate or push rate is changed
    document.getElementById("i2c-txt-baud-rate").addEventListener("change", saveConfig);
    document.getElementById("i2c-txt-push-rate").addEventListener("change", saveConfig);
    document.getElementById("i2c-txt-font-size").addEventListener("change", saveConfig);

    document.getElementById("i2c-txt-output-address").addEventListener("change", onAddressChanged);
});

function addOutputAddress() {
    // Open modal dialog to request new output address using javascript prompt
    let newOutputAddress = prompt("Please enter the new output address", "");
    if (newOutputAddress != null) {
        // Get current com port by header id
        let comPort = document.getElementById("com-port-name-header").innerText;

        invoke('add_output_address', {comPort: comPort, address: newOutputAddress}).then(
            // Add to output address list and select
            document.getElementById("i2c-txt-output-address").innerHTML +=
                `<option value="${newOutputAddress}" selected>${newOutputAddress}</option>`
        );
    }
}

function deleteOutputAddress() {
    // Get current com port by header id
    let comPort = document.getElementById("com-port-name-header").innerText;

    // Get selected output address
    let outputAddress = document.getElementById("i2c-txt-output-address").value;

    // If it is empty, return
    if (outputAddress === "") {
        return;
    }

    invoke('delete_output_address', {comPort: comPort, address: outputAddress}).then(() => {
            // Remove from output address list
            let outputAddressList = document.getElementById("i2c-txt-output-address");
            outputAddressList.remove(outputAddressList.selectedIndex);

            // Select the first entry if there is one
            if (outputAddressList.length > 0) {
                outputAddressList.selectedIndex = 0;

                // Trigger onAddressChanged to load the first output address config
                onAddressChanged();
            } else {
                // Clear the preview and address config
                document.getElementById("i2c-txt-output-format").value = "";
                document.getElementById("i2c-txt-preview").innerHTML = "";
            }
        }
    );
}

function saveConfig() {
    // Get current com port by header id
    let comPort = document.getElementById("com-port-name-header").innerText;

    // Get selected output address
    let outputAddress = document.getElementById("i2c-txt-output-address").value;

    // If comport or output address is empty, return
    if (comPort === "" || outputAddress === "") {
        return;
    }

    let baudRate = document.getElementById("i2c-txt-baud-rate").value;
    let pushRate = document.getElementById("i2c-txt-push-rate").value;
    let dataConfig = document.getElementById("i2c-txt-output-format").value;
    let fontSize = document.getElementById("i2c-txt-font-size").selectedIndex;

    invoke('save_config', {
        comPort: comPort,
        outputAddress: outputAddress,
        dataConfig: dataConfig,
        fontSize: fontSize,
        baudRate: baudRate,
        pushRate: pushRate
    });
}

// Renders the i2c-txt-output-format text field with the current address config to the i2c-txt-preview text field
function onAddressConfigChanged() {
    let outputFormat = document.getElementById("i2c-txt-output-format").value;

    // Replace all sensor ids in the [ ] brackets with the sensor title
    let previewText = outputFormat.replace(/\[([^\]]+)\]/g, function (match, sensorId) {
        return document.getElementById(sensorId).title;
    });

    // set to preview text field
    document.getElementById("i2c-txt-preview").innerHTML = previewText;

    // Save address config
    saveConfig();
}

function onAddressChanged() {
    let comPort = document.getElementById("com-port-name-header").innerText;
    let outputAddress = document.getElementById("i2c-txt-output-address").value;

    // if comport or output address is empty, return
    if (comPort === "" || outputAddress === "") {
        return;
    }

    invoke('load_address_config', {comPort: comPort, outputAddress: outputAddress}).then(
        (addressConfig) => {
            addressConfig = JSON.parse(addressConfig);
            document.getElementById("i2c-txt-output-format").value = addressConfig.data_config;
            document.getElementById("i2c-txt-font-size").selectedIndex = addressConfig.font_size;
            onAddressConfigChanged();
        }
    );
}

// Appends a sensor to the i2c-txt-output-format at the current cursor position or at the end if no cursor position is set
function appendSensorToAddressConfig(sensorId) {
    let outputFormat = document.getElementById("i2c-txt-output-format");
    let cursorPosition = outputFormat.selectionStart;
    let textBefore = outputFormat.value.substring(0, cursorPosition);
    let textAfter = outputFormat.value.substring(cursorPosition, outputFormat.value.length);

    // Wrap sensor id with brackets
    sensorId = "[" + sensorId + "]";

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
            document.getElementById("i2c-available-sensor-values").innerHTML = sensorValues.map(
                (sensorValue) => `<li id="${sensorValue.id}" class="sensor-item" title="${sensorValue.value}">${sensorValue.label} (${sensorValue.sensor_type})</li>`
            ).join("");

            // Register click event listener for all sensor items
            const listItems = document.querySelectorAll("#i2c-available-sensor-values li");
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