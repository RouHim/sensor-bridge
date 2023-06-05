const {invoke} = window.__TAURI__.tauri;

import {saveConfig} from './base.js';

const designerPane = document.getElementById("lcd-designer-pane");
const txtResolutionWidth = document.getElementById("lcd-txt-resolution-width");
const txtResolutionHeight = document.getElementById("lcd-txt-resolution-height");
const btnAddSensor = document.getElementById("lcd-btn-add-sensor");
const btnRemoveSensor = document.getElementById("lcd-btn-remove-sensor");
const lstDesignerPlacedElements = document.getElementById("lcd-designer-placed-elements");

const txtSensorDescription = document.getElementById("lcd-txt-sensor-description");
const cmbSensorTypeSelection = document.getElementById("lcd-cmb-sensor-type-selection");
const txtSensorTextFormat = document.getElementById("lcd-txt-sensor-text-format");
const txtSensorPositionX = document.getElementById("lcd-txt-sensor-position-x");
const txtSensorPositionY = document.getElementById("lcd-txt-sensor-position-y");

let lastSelectedSensorListElement = null;
let lastSelectedDesignerElement = null;

const LIST_ID_PREFIX = "list-";
const DESIGNER_ID_PREFIX = "designer-";

window.addEventListener("DOMContentLoaded", () => {
    // Register event for display resolution
    txtResolutionWidth.addEventListener("input", updateLcdDesignPaneDimensions);
    txtResolutionHeight.addEventListener("input", updateLcdDesignPaneDimensions);

    // Register event for sensor value add
    btnAddSensor.addEventListener("click", addSensor);
    btnRemoveSensor.addEventListener("click", removeSensor);

    // Register drag dropping
    designerPane.addEventListener('dragover', (event) => event.preventDefault());
    designerPane.addEventListener('drop', dropOnParent);
});

function loadLcdConfig(comPort) {
    invoke('load_port_config', {comPort: comPort}).then(
        (portConfig) => {
            // cast port config to json object
            portConfig = JSON.parse(portConfig);
            const lcdConfig = portConfig.lcd_config;

            // Set display resolution
            txtResolutionWidth.value = lcdConfig.resolution_width;
            txtResolutionHeight.value = lcdConfig.resolution_height;
        }
    ).then(() => {
        // Update ui elements with the loaded lcd config
        updateLcdDesignPaneDimensions();
    });
}

export function onLcdSelected(comPort) {
    // Load sensor values
    loadSensorValues();

    // Load lcd config
    loadLcdConfig(comPort);

}

function loadSensorValues() {
    invoke('get_sensor_values').then(
        (sensorValues) => {
            // cast sensor values to json object
            // Example string: [{"id":"SCPUCLK","value":"3393","label":"CPU Clock","sensor_type":"sys"},{"id":"SCPUUTI","value":"41","label":"CPU Utilization","sensor_type":"sys"},{"id":"SFREEMEM","value":"9241","label":"Free Memory","sensor_type":"sys"},{"id":"SGPU1UTI","value":"7","label":"GPU Utilization","sensor_type":"sys"},{"id":"TCPUPKG","value":"68","label":"CPU Package","sensor_type":"temp"},{"id":"TGPU1DIO","value":"46","label":"GPU Diode","sensor_type":"temp"},{"id":"FCPU","value":"3275","label":"CPU","sensor_type":"fan"},{"id":"PCPUPKG","value":"12.27","label":"CPU Package","sensor_type":"pwr"}]
            sensorValues = JSON.parse(sensorValues);

            // Add sensor values to the sensor value combo box
            cmbSensorTypeSelection.innerHTML = sensorValues.map(
                (sensorValue) => `<option value="${sensorValue.id}" data-unit="${sensorValue.unit}" title="${sensorValue.value}">${sensorValue.label}</option>`
            ).join("");

        }
    );
}

function setSelectedSensor(listHtmlElement) {
    let elementId = listHtmlElement.id;

    // Remove prefix xyz- including the minus from the id
    elementId = elementId.substring(elementId.indexOf("-") + 1);

    lastSelectedSensorListElement = document.getElementById(LIST_ID_PREFIX + elementId);
    lastSelectedDesignerElement = document.getElementById(DESIGNER_ID_PREFIX + elementId);
}

function addSensor() {
    if (txtSensorDescription.value === "") {
        alert("Please enter a description for the sensor.");
        return;
    }

    const calculatedId = txtSensorDescription.value.replace(" ", "-").toLowerCase();

    // Check if sensor is already exists
    if (document.getElementById(LIST_ID_PREFIX + calculatedId) !== null) {
        alert("Sensor already exists.");
        return;
    }

    const selectedSensor = cmbSensorTypeSelection.options[cmbSensorTypeSelection.selectedIndex];

    const sensorTextFormat = txtSensorTextFormat.value;
    const sensorId = selectedSensor.value;
    const sensorValue = selectedSensor.title;
    const sensorUnit = selectedSensor.getAttribute("data-unit");

    // Build designer element
    const sensorValueElement = document.createElement("div");
    sensorValueElement.id = DESIGNER_ID_PREFIX + calculatedId;
    sensorValueElement.title = txtSensorDescription.value;
    sensorValueElement.innerHTML = sensorTextFormat
        .replace("{value}", sensorValue)
        .replace("{unit}", sensorUnit);

    sensorValueElement.style.position = "absolute";
    sensorValueElement.style.left = txtSensorPositionX.value + "px";
    sensorValueElement.style.top = txtSensorPositionY.value + "px";
    sensorValueElement.draggable = true;

    sensorValueElement.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', event.target.id);
    });

    designerPane.appendChild(sensorValueElement);

    // Add sensor to the list
    lstDesignerPlacedElements.innerHTML += `<li id="list-${calculatedId}" data-sensor-id="${sensorId} data-sensor-text-format="${sensorTextFormat}">${txtSensorDescription.value}</li>`;
    // And register click event and pass the list element
    let listEntryElement = document.getElementById(LIST_ID_PREFIX + calculatedId);
    setSelectedSensor(listEntryElement);
    // Register click event
    document.getElementById(LIST_ID_PREFIX + calculatedId).addEventListener("click", onSensorListItemClick);

    // Save config
    saveConfig();
}

function removeSensor() {
    if (lastSelectedSensorListElement === null) {
        alert("Please select a sensor first.");
        return;
    }

    // Check if sensor exists in designer
    if (lastSelectedDesignerElement === null) {
        alert("Please select a sensor first.");
        return;
    }

    // Remove sensor from list
    lstDesignerPlacedElements.removeChild(lastSelectedSensorListElement);

    // Remove sensor from designer
    designerPane.removeChild(lastSelectedDesignerElement);

    // Save config
    saveConfig();
}

// FIXME: This works only for the last selected sensor
function onSensorListItemClick(event) {
    console.log("clicked: " + event.target.id);
    return;

    setSelectedSensor(event.target);

    // Load selected sensor into detail view
    const sensorId = lastSelectedSensorListElement.getAttribute("data-sensor-id");

    txtSensorDescription.value = lastSelectedSensorListElement.innerHTML;
    cmbSensorTypeSelection.value = sensorId;
    txtSensorTextFormat.value = lastSelectedSensorListElement.getAttribute("data-sensor-text-format");
    txtSensorPositionX.value = lastSelectedDesignerElement.style.left.replace("px", "");
    txtSensorPositionY.value = lastSelectedDesignerElement.style.top.replace("px", "");
}

function dropOnParent(event) {
    event.preventDefault();

    const elementId = event.dataTransfer.getData('text/plain');
    const htmlElement = document.getElementById(elementId);

    setSelectedSensor(htmlElement);

    let x = event.clientX - designerPane.getBoundingClientRect().left - htmlElement.clientWidth / 2;
    let y = event.clientY - designerPane.getBoundingClientRect().top - htmlElement.clientHeight / 2;

    // allow only positive values
    x = x < 0 ? 0 : x;
    y = y < 0 ? 0 : y;

    htmlElement.style.left = `${x}px`;
    htmlElement.style.top = `${y}px`;

    saveConfig();
}

function updateLcdDesignPaneDimensions() {
    let width = txtResolutionWidth.value;
    let height = txtResolutionHeight.value;

    designerPane.style.width = width + "px";
    designerPane.style.height = height + "px";

    saveConfig();
}
