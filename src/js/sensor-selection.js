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

    cmbTextSensorIdSelection.value = selectedSensorId;
    cmbGraphSensorIdSelection.value = selectedSensorId;
    cmbConditionalImageSensorIdSelection.value = selectedSensorId;
}
