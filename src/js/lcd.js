const {invoke} = window.__TAURI__.tauri;

const designerPane = document.getElementById("lcd-designer-pane");
const txtResolutionWidth = document.getElementById("lcd-txt-resolution-width");
const txtResolutionHeight = document.getElementById("lcd-txt-resolution-height");
const btnAddSensor = document.getElementById("lcd-btn-add-sensor");
window.addEventListener("DOMContentLoaded", () => {
    // Register event for display resolution
    txtResolutionWidth.addEventListener("input", updateLcdDesignPaneDimensions);
    txtResolutionHeight.addEventListener("input", updateLcdDesignPaneDimensions);

    // Register event for sensor value add
    btnAddSensor.addEventListener("click", () => {
        const sensorValueComboBox = document.getElementById("lcd-txt-add-sensor");
        const sensorId = sensorValueComboBox.options[sensorValueComboBox.selectedIndex].id;
        const sensorValue = sensorValueComboBox.options[sensorValueComboBox.selectedIndex].title;
        const sensorLabel = sensorValueComboBox.options[sensorValueComboBox.selectedIndex].value;

        const sensorValueElement = document.createElement("div");
        sensorValueElement.id = sensorId;
        sensorValueElement.title = sensorLabel;
        sensorValueElement.innerHTML = sensorValue;

        sensorValueElement.style.position = "absolute";
        sensorValueElement.style.left = "0px";
        sensorValueElement.style.top = "0px";
        sensorValueElement.draggable = true;

        sensorValueElement.addEventListener('dragstart', (event) => {
            event.dataTransfer.setData('text/plain', event.target.id);
        });

        designerPane.appendChild(sensorValueElement);
    });

    // Register drag dropping
    designerPane.addEventListener('dragover', (event) => event.preventDefault());
    designerPane.addEventListener('drop', dropOnParent);

    document.getElementById("child").addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', event.target.id);
    });
    document.getElementById("child2").addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', event.target.id);
    });
});

export function onLcdSelected() {
    // Load sensor values
    loadSensorValues();
}

function loadSensorValues() {
    invoke('get_sensor_values').then(
        (sensorValues) => {
            // cast sensor values to json object
            // Example string: [{"id":"SCPUCLK","value":"3393","label":"CPU Clock","sensor_type":"sys"},{"id":"SCPUUTI","value":"41","label":"CPU Utilization","sensor_type":"sys"},{"id":"SFREEMEM","value":"9241","label":"Free Memory","sensor_type":"sys"},{"id":"SGPU1UTI","value":"7","label":"GPU Utilization","sensor_type":"sys"},{"id":"TCPUPKG","value":"68","label":"CPU Package","sensor_type":"temp"},{"id":"TGPU1DIO","value":"46","label":"GPU Diode","sensor_type":"temp"},{"id":"FCPU","value":"3275","label":"CPU","sensor_type":"fan"},{"id":"PCPUPKG","value":"12.27","label":"CPU Package","sensor_type":"pwr"}]
            sensorValues = JSON.parse(sensorValues);

            // Add sensor values to the sensor value combo box
            let sensorValueComboBox = document.getElementById("lcd-txt-add-sensor");
            sensorValueComboBox.innerHTML = sensorValues.map(
                (sensorValue) => `<option value="${sensorValue.id}" title="${sensorValue.value}">${sensorValue.label}</option>`
            ).join("");

        }
    );
}

function dropOnParent(event) {
    event.preventDefault();
    const elementId = event.dataTransfer.getData('text/plain');
    const htmlElement = document.getElementById(elementId);

    const x = event.clientX - designerPane.getBoundingClientRect().left - htmlElement.clientWidth / 2;
    const y = event.clientY - designerPane.getBoundingClientRect().top - htmlElement.clientHeight / 2;

    console.log(x);
    console.log(y);

    htmlElement.style.left = `${x}px`;
    htmlElement.style.top = `${y}px`;
}

function updateLcdDesignPaneDimensions() {
    let width = txtResolutionWidth.value;
    let height = txtResolutionHeight.value;

    designerPane.style.width = width + "px";
    designerPane.style.height = height + "px";
}
