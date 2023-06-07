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
    btnAddSensor.addEventListener("click", addOrUpdateSensor);
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

function updateSensor(calculatedId) {
    // Update sensor in the list
    let listEntryElement = document.getElementById(LIST_ID_PREFIX + calculatedId);
    listEntryElement.setAttribute("data-sensor-id", cmbSensorTypeSelection.value);
    listEntryElement.setAttribute("data-sensor-text-format", txtSensorTextFormat.value);
    listEntryElement.innerHTML = txtSensorDescription.value;

    // Update sensor in the designer
    let designerElement = document.getElementById(DESIGNER_ID_PREFIX + calculatedId);
    designerElement.title = txtSensorDescription.value;
    designerElement.innerHTML = txtSensorTextFormat.value
        .replace("{value}", cmbSensorTypeSelection.options[cmbSensorTypeSelection.selectedIndex].title)
        .replace("{unit}", cmbSensorTypeSelection.options[cmbSensorTypeSelection.selectedIndex].getAttribute("data-unit"));
    designerElement.style.left = txtSensorPositionX.value + "px";
    designerElement.style.top = txtSensorPositionY.value + "px";
}

function addOrUpdateSensor() {
    if (txtSensorDescription.value === "") {
        alert("Please enter a description for the sensor.");
        return;
    }

    const calculatedId = txtSensorDescription.value.replace(" ", "-").toLowerCase();

    // Check if sensor is already exists, if so, update the sensor
    if (document.getElementById(LIST_ID_PREFIX + calculatedId) !== null) {
        updateSensor(calculatedId);
        return;
    }

    const selectedSensor = cmbSensorTypeSelection.options[cmbSensorTypeSelection.selectedIndex];

    const sensorTextFormat = txtSensorTextFormat.value;
    const sensorId = selectedSensor.value;
    const sensorValue = selectedSensor.title;
    const sensorUnit = selectedSensor.getAttribute("data-unit");

    // Build designer element
    const designerElement = document.createElement("div");
    designerElement.id = DESIGNER_ID_PREFIX + calculatedId;
    designerElement.title = txtSensorDescription.value;
    designerElement.innerHTML = sensorTextFormat
        .replace("{value}", sensorValue)
        .replace("{unit}", sensorUnit);

    designerElement.style.position = "absolute";
    designerElement.style.left = txtSensorPositionX.value + "px";
    designerElement.style.top = txtSensorPositionY.value + "px";
    designerElement.draggable = true;

    designerElement.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', event.target.id);
    });

    designerPane.appendChild(designerElement);

    // Add sensor to the list
    lstDesignerPlacedElements.innerHTML += `<li id="list-${calculatedId}" data-sensor-id="${sensorId}" data-sensor-text-format="${sensorTextFormat}">${txtSensorDescription.value}</li>`;
    let listElement = document.getElementById(LIST_ID_PREFIX + calculatedId);
    setSelectedSensor(listElement);

    // Find all li element in the ul lcd-designer-placed-elements and register click event
    // We have to re-register the click event because the list was re-rendered
    const sensorListItems = document.querySelectorAll("#lcd-designer-placed-elements li");
    sensorListItems.forEach((sensorListItem) => {
        sensorListItem.addEventListener("click", onSensorListItemClick);
    });

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

function onSensorListItemClick(event) {
    setSelectedSensor(event.target);

    txtSensorDescription.value = lastSelectedSensorListElement.innerHTML;

    // Select the sensor type in the combo box
    cmbSensorTypeSelection.value = lastSelectedSensorListElement.getAttribute("data-sensor-id");
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
