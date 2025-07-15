// Sensor selection dialog functionality

import { ELEMENT_TYPE_GRAPH } from './constants.js';
import {
    sensorSelectionDialog,
    sensorSelectionTable,
    txtSensorSelectionTableFilterInput,
    cmbElementType,
    cmbTextSensorIdSelection,
    cmbGraphSensorIdSelection,
    cmbConditionalImageSensorIdSelection
} from './dom-elements.js';
import { getSensorValues } from './app-state.js';
import { applyFormToSelectedElement, updateElementPreview } from './element-management.js';

export function buildSensorSelectionDialogTable(filterValue) {
    // If type is graph only use numeric sensors
    const onlyNumeric = cmbElementType.options[cmbElementType.selectedIndex].value === ELEMENT_TYPE_GRAPH;

    // Clear table entries
    sensorSelectionTable.innerHTML = "";

    // Add Name and value headers
    const thead = document.createElement("thead");
    const row = document.createElement("tr");
    const thName = document.createElement("th");
    const thValue = document.createElement("th");

    thName.innerText = "Name";
    thValue.innerText = "Value";

    row.appendChild(thName);
    row.appendChild(thValue);
    thead.appendChild(row);
    sensorSelectionTable.appendChild(thead);

    // Create tbody
    const tbody = document.createElement("tbody");
    sensorSelectionTable.appendChild(tbody);

    const sensorValues = getSensorValues();

    // Filter sensor values for graph
    let filteredSensorValues = onlyNumeric
        ? sensorValues.filter((sensorValue) => sensorValue.sensor_type === "number")
        : sensorValues;

    // Filter for keywords split by space
    if (filterValue !== "" && filterValue !== undefined && filterValue !== null) {
        filteredSensorValues = filteredSensorValues.filter((sensorValue) => {
            const keywords = filterValue.split(" ");
            let matches = 0;

            keywords.forEach((keyword) => {
                // Check if label or value contains keyword
                if (sensorValue.label.toLowerCase().includes(keyword.toLowerCase()) ||
                    sensorValue.value.toLowerCase().includes(keyword.toLowerCase())) {
                    matches++;
                }
            });

            return matches === keywords.length;
        });
    }

    // Fill sensor values into table
    filteredSensorValues.forEach((sensorValue) => {
        const row = document.createElement("tr");
        const name = document.createElement("td");
        const value = document.createElement("td");

        row.id = sensorValue.id;
        row.classList.add("sensor-selection-table-row");
        row.addEventListener("click", () => sensorSelectionDialog.close(sensorValue.id));
        name.innerText = sensorValue.label;
        value.innerText = sensorValue.value + " " + sensorValue.unit;

        row.appendChild(name);
        row.appendChild(value);

        tbody.appendChild(row);
    });
}

export function showSensorSelectionDialog() {
    // Show modal dialog
    sensorSelectionDialog.showModal();

    // When the user clicks anywhere outside the modal, close it
    window.onclick = function (event) {
        if (event.target === sensorSelectionDialog) {
            sensorSelectionDialog.close();
        }
    }

    // Build table
    buildSensorSelectionDialogTable("");

    // Prepare filter input
    txtSensorSelectionTableFilterInput.value = "";
    txtSensorSelectionTableFilterInput.select();
    txtSensorSelectionTableFilterInput.addEventListener("input", () =>
        buildSensorSelectionDialogTable(txtSensorSelectionTableFilterInput.value));
}

export function onCloseSensorSelectionDialog(selectedSensorId) {
    if (selectedSensorId === "" || selectedSensorId === undefined || selectedSensorId === null) {
        return;
    }

    // Update all sensor dropdowns with the selected sensor ID
    cmbTextSensorIdSelection.value = selectedSensorId;
    cmbGraphSensorIdSelection.value = selectedSensorId;
    cmbConditionalImageSensorIdSelection.value = selectedSensorId;

    // Populate the dropdown with the selected sensor so it displays properly
    populateSensorDropdown(selectedSensorId);

    // Trigger the element configuration update to save the new sensor selection
    applyFormToSelectedElement();

    // Update the preview to reflect the new sensor selection
    updateElementPreview();
}

/**
 * Populates the sensor dropdown with the selected sensor information
 */
function populateSensorDropdown(selectedSensorId) {
    const sensorValues = getSensorValues();
    const selectedSensor = sensorValues.find(sensor => sensor.id === selectedSensorId);

    if (!selectedSensor) {
        console.warn(`Sensor with ID ${selectedSensorId} not found`);
        return;
    }

    // Clear and populate all sensor dropdowns
    [cmbTextSensorIdSelection, cmbGraphSensorIdSelection, cmbConditionalImageSensorIdSelection].forEach(dropdown => {
        if (dropdown) {
            // Clear existing options
            dropdown.innerHTML = '';

            // Add the selected sensor as an option
            const option = document.createElement('option');
            option.value = selectedSensor.id;
            option.textContent = selectedSensor.label;
            option.selected = true;
            dropdown.appendChild(option);
        }
    });
}

/**
 * Populates all sensor dropdowns with available sensors
 */
export function populateAllSensorDropdowns() {
    const sensorValues = getSensorValues();

    if (!sensorValues || sensorValues.length === 0) {
        console.log('No sensors available to populate dropdowns');
        return;
    }

    // List of all sensor dropdowns to populate
    const sensorDropdowns = [
        cmbTextSensorIdSelection,
        cmbGraphSensorIdSelection,
        cmbConditionalImageSensorIdSelection
    ];

    sensorDropdowns.forEach(dropdown => {
        if (!dropdown) return;

        // Store current selection to restore it
        const currentValue = dropdown.value;

        // Clear existing options
        dropdown.innerHTML = '';

        // Add empty option for "no sensor selected"
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '-- Select Sensor --';
        dropdown.appendChild(emptyOption);

        // Add all available sensors with truncated display text
        sensorValues.forEach(sensor => {
            const option = document.createElement('option');
            option.value = sensor.id;

            // Create a shorter display text by truncating long sensor names
            const maxNameLength = 25;
            const truncatedName = sensor.label.length > maxNameLength
                ? sensor.label.substring(0, maxNameLength) + '...'
                : sensor.label;

            // Show truncated name with current value
            option.textContent = `${truncatedName} (${sensor.value} ${sensor.unit})`;

            // Add full information as tooltip
            option.title = `${sensor.label}\nCurrent Value: ${sensor.value} ${sensor.unit}\nSensor ID: ${sensor.id}`;

            dropdown.appendChild(option);
        });

        // Restore previous selection if it still exists
        if (currentValue && sensorValues.find(s => s.id === currentValue)) {
            dropdown.value = currentValue;
        }
    });

    console.log(`Populated sensor dropdowns with ${sensorValues.length} sensors`);
}

/**
 * Handles direct sensor selection from dropdown
 */
export function onSensorDropdownChange(dropdown) {
    const selectedSensorId = dropdown.value;

    if (!selectedSensorId) {
        console.log('No sensor selected from dropdown');
        return;
    }

    // Update all sensor dropdowns to have the same selection
    // (for consistency, similar to modal selection behavior)
    cmbTextSensorIdSelection.value = selectedSensorId;
    cmbGraphSensorIdSelection.value = selectedSensorId;
    cmbConditionalImageSensorIdSelection.value = selectedSensorId;

    // Trigger the element configuration update to save the new sensor selection
    applyFormToSelectedElement();

    // Update the preview to reflect the new sensor selection
    updateElementPreview();

    console.log(`Sensor selected from dropdown: ${selectedSensorId}`);
}
