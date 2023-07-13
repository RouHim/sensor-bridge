const {invoke} = window.__TAURI__.tauri;

const listNetPorts = document.getElementById("main-net-ports");

const btnAddNetworkDevice = document.getElementById("btn-add-network-device");
const btnSaveNetworkDevice = document.getElementById("lcd-btn-save-network-device");
const btnRemoveNetworkDevice = document.getElementById("lcd-btn-remove-network-device");

const btnTransferActive = document.getElementById("main-chk-transfer-active");
const txtDeviceName = document.getElementById("lcd-txt-device-name");
const txtNetworkAddress = document.getElementById("lcd-txt-network-address");
const txtResolutionWidth = document.getElementById("lcd-txt-resolution-width");
const txtResolutionHeight = document.getElementById("lcd-txt-resolution-height");
const designerPane = document.getElementById("lcd-designer-pane");
const btnSaveSensor = document.getElementById("lcd-btn-save-sensor");
const btnRemoveSensor = document.getElementById("lcd-btn-remove-sensor");
const lstDesignerPlacedElements = document.getElementById("lcd-designer-placed-elements");
const btnToggleLivePreview = document.getElementById("btn-lcd-toggle-live-preview");

const txtSensorName = document.getElementById("lcd-txt-sensor-name");
const cmbSensorTypeSelection = document.getElementById("lcd-cmb-sensor-type-selection");
const txtSensorTextFormat = document.getElementById("lcd-txt-sensor-text-format");
const txtSensorPositionX = document.getElementById("lcd-txt-sensor-position-x");
const txtSensorPositionY = document.getElementById("lcd-txt-sensor-position-y");

let sensorValues = [];
let lastSelectedSensorListElement = null;
let lastSelectedDesignerElement = null;

const LIST_ID_PREFIX = "list-";
const DESIGNER_ID_PREFIX = "designer-";

let draggedLiElement;

let currentNetworkDeviceId = null;

window.addEventListener("DOMContentLoaded", () => {
    // Register event for display resolution
    txtResolutionWidth.addEventListener("input", updateLcdDesignPaneDimensions);
    txtResolutionHeight.addEventListener("input", updateLcdDesignPaneDimensions);

    // Register button click events
    btnAddNetworkDevice.addEventListener("click", createNetworkPort);
    btnRemoveNetworkDevice.addEventListener("click", removeDevice);
    btnSaveNetworkDevice.addEventListener("click", saveDeviceConfig);
    btnSaveSensor.addEventListener("click", saveDeviceConfig);
    btnTransferActive.addEventListener("click", () => toggleSync(btnTransferActive.checked));
    btnToggleLivePreview.addEventListener("click", toggleLivePreview);
    btnRemoveSensor.addEventListener("click", removeSensor);

    // Register drag dropping
    designerPane.addEventListener('dragover', (event) => event.preventDefault());
    designerPane.addEventListener('drop', dropOnParent);

    // Load all devices from config
    loadDeviceConfigs();
    // Select first net port
    if (listNetPorts.childElementCount > 0) {
        onNetDeviceSelected(listNetPorts.firstElementChild);
    }
});

function removeDevice() {
    // Get selected net port id
    let networkDeviceId = currentNetworkDeviceId;

    // If net port id is empty, return
    if (networkDeviceId === "") {
        return;
    }

    // Remove net port from list
    listNetPorts.removeChild(document.getElementById(networkDeviceId));

    // Remove net port from backend
    invoke('remove_network_device_config', {networkDeviceId: networkDeviceId});

    // If is at least one net port, select the first one
    if (listNetPorts.childElementCount > 0) {
        onNetDeviceSelected(listNetPorts.firstElementChild);
    } else {
        clearForm();
    }
}

function clearForm() {
    txtDeviceName.value = "";
    txtNetworkAddress.value = "";
    txtResolutionWidth.value = "";
    txtResolutionHeight.value = "";
    lstDesignerPlacedElements.innerHTML = "";
}

function createNetworkPort() {
    invoke('create_network_device_config')
        .then((networkDeviceId) => {
            // Set port id as constant
            currentNetworkDeviceId = networkDeviceId;

            // Load all device configs from config
            loadDeviceConfigs().then(() => {
                // Select new net device
                let liElement = document.getElementById(networkDeviceId);
                onNetDeviceSelected(liElement);
            });
        });
}

function loadDeviceConfigs() {
    // Load config from backend
    return invoke('get_app_config').then((appConfig) => {
        // Map config to JSON
        appConfig = JSON.parse(appConfig);

        // Clear net port list
        listNetPorts.innerHTML = "";

        // Add net ports to list
        let networkDevices = appConfig.network_devices;

        // If network devices is undefined or null or empty, return
        if (networkDevices === undefined || networkDevices === null || networkDevices.length === 0) {
            return;
        }

        // Iterate json array and add net ports to list
        for (const deviceId in networkDevices) {
            const device = networkDevices[deviceId];
            addNetworkDeviceToList(device.id, device.name);
        }

        // Select first net port
        if (listNetPorts.childElementCount > 0) {
            onNetDeviceSelected(listNetPorts.firstElementChild);
        }
    });
}

function addNetworkDeviceToList(id, name) {
    // Create new net port li element
    const liElement = document.createElement("li");
    liElement.id = id;
    liElement.innerText = name;
    liElement.classList.add("net-port-item");
    liElement.addEventListener("click", () => onNetDeviceSelected(liElement));

    // Add to net port list
    listNetPorts.appendChild(liElement);
}

function saveConfig() {
    // If net port id is empty, return
    if (currentNetworkDeviceId === "") {
        return;
    }

    // Get device name and network address
    let deviceName = txtDeviceName.value;
    let deviceAddress = txtNetworkAddress.value;

    // Get LCD Resolution Height and cast to integer
    let lcdResolutionWidth = txtResolutionWidth.value;
    let lcdResolutionHeight = txtResolutionHeight.value;

    // Find all list items of lcd-designer-placed-elements extract sensors and save them to the lcd config
    let lcdDesignerPlacedElementsListItems = lstDesignerPlacedElements.getElementsByTagName("li");
    let lcdDesignerPlacedElementsListItemsArray = Array.from(lcdDesignerPlacedElementsListItems);
    let lcdElements = lcdDesignerPlacedElementsListItemsArray.map((listItem) => {
        let elementId = listItem.getAttribute("data-element-id");
        let elementName = listItem.innerText.trim();
        let sensorId = listItem.getAttribute("data-sensor-id");
        let sensorTextFormat = listItem.getAttribute("data-sensor-text-format");
        let sensorX = parseInt(listItem.getAttribute("data-sensor-position-x"));
        let sensorY = parseInt(listItem.getAttribute("data-sensor-position-y"));

        // Build sensor object
        return {
            id: elementId,
            name: elementName,
            sensor_id: sensorId,
            text_format: sensorTextFormat,
            x: sensorX,
            y: sensorY,
        };
    });


    // Build lcd config object, with integers
    let lcdConfig = {
        resolution_width: parseInt(lcdResolutionWidth),
        resolution_height: parseInt(lcdResolutionHeight),
        elements: lcdElements,
    }

    invoke('save_app_config', {
        id: currentNetworkDeviceId,
        name: deviceName,
        address: deviceAddress,
        lcdConfig: JSON.stringify(lcdConfig),
    });
}

function onNetDeviceSelected(element) {
    let networkDeviceId = element.id;
    currentNetworkDeviceId = networkDeviceId;

    invoke('get_network_device_config', {networkDeviceId: networkDeviceId}).then(
        (portConfig) => {
            // cast port config to json object
            portConfig = JSON.parse(portConfig);

            // Set name, host and resolution
            txtDeviceName.value = portConfig.name;
            txtNetworkAddress.value = portConfig.address;

            // Set active sync state
            btnTransferActive.checked = portConfig.active;

            // Set as selected net port in list
            listNetPorts.querySelectorAll("li").forEach((liElement) => {
                liElement.classList.remove("selected");
            });
            element.classList.add("selected");

            // Load sensor values
            loadSensorValues();

            // Load lcd config
            loadLcdConfig(networkDeviceId);
        }
    );
}

// Toggles the sync for the selected net port
function toggleSync(checked) {
    if (checked) {
        invoke('enable_sync', {networkDeviceId: currentNetworkDeviceId});
    } else {
        invoke('disable_sync', {networkDeviceId: currentNetworkDeviceId});
    }
}


function toggleLivePreview() {
    invoke('toggle_lcd_live_preview', {networkDeviceId: currentNetworkDeviceId});
}

function loadLcdConfig(networkDeviceId) {
    invoke('get_network_device_config', {networkDeviceId: networkDeviceId}).then(
        (portConfig) => {
            // cast port config to json object
            portConfig = JSON.parse(portConfig);
            const lcdConfig = portConfig.lcd_config;

            // Set display resolution
            txtResolutionWidth.value = lcdConfig.resolution_width;
            txtResolutionHeight.value = lcdConfig.resolution_height;

            // Clear designer pane
            designerPane.innerHTML = "";

            // Clear sensor list
            lstDesignerPlacedElements.innerHTML = "";

            // Add elements to designer pane and list
            lcdConfig.elements.forEach((element) => {
                // Find sensor in sensor values list
                let sensor = sensorValues.find((sensor) => sensor.id === element.sensor_id);

                // Load sensor value and unit
                let sensorValue = sensor ? sensor.value : "";
                let sensorUnit = sensor ? sensor.unit : "";

                // Add sensor to list
                addSensorToList(element.id, element.sensor_id, element.text_format, element.x, element.y, element.name);

                // Add sensor to designer pane
                addSensorToDesignerPane(element.id, element.text_format, sensorValue, sensorUnit, element.name, element.x, element.y);
            });

            // If there are elements, select the first one
            if (lcdConfig.elements.length > 0) {
                setSelectedSensor(document.querySelector("#lcd-designer-placed-elements li"));
            }

            // Update designer pane dimensions
            designerPane.style.width = lcdConfig.resolution_width + "px";
            designerPane.style.height = lcdConfig.resolution_height + "px";
        }
    );
}

function addSensorToList(elementId, sensorId, sensorTextFormat, positionX, positionY, sensorName) {
    const liElement = document.createElement("li");
    liElement.id = LIST_ID_PREFIX + elementId;
    liElement.setAttribute("data-element-id", elementId);
    liElement.setAttribute("data-sensor-id", sensorId);
    liElement.setAttribute("data-sensor-text-format", sensorTextFormat);
    liElement.setAttribute("data-sensor-position-x", positionX);
    liElement.setAttribute("data-sensor-position-y", positionY);
    liElement.innerHTML = sensorName;
    liElement.draggable = true;
    liElement.ondragstart = onListItemDragStart;
    liElement.ondragover = onListItemDragOver;
    liElement.ondrop = onListItemDrop;


    // Add sensor to the list#
    lstDesignerPlacedElements.innerHTML += liElement.outerHTML;

    // Find all li element in the ul lcd-designer-placed-elements and register click event
    // We have to re-register the click event because the list was re-rendered
    const sensorListItems = document.querySelectorAll("#lcd-designer-placed-elements li");
    sensorListItems.forEach((sensorListItem) => {
        sensorListItem.addEventListener("click", onSensorListItemClick);
        sensorListItem.addEventListener('dragstart', onListItemDragStart);
        sensorListItem.addEventListener('dragover', onListItemDragOver);
        sensorListItem.addEventListener('drop', onListItemDrop);
    });

    // Set last selected sensor list element
    lastSelectedSensorListElement = liElement;
}

function loadSensorValues() {
    invoke('get_sensor_values').then(
        (loadedSensors) => {
            // cast sensor values to json object
            // Example string: [{"id":"SCPUCLK","value":"3393","label":"CPU Clock","sensor_type":"sys"},{"id":"SCPUUTI","value":"41","label":"CPU Utilization","sensor_type":"sys"},{"id":"SFREEMEM","value":"9241","label":"Free Memory","sensor_type":"sys"},{"id":"SGPU1UTI","value":"7","label":"GPU Utilization","sensor_type":"sys"},{"id":"TCPUPKG","value":"68","label":"CPU Package","sensor_type":"temp"},{"id":"TGPU1DIO","value":"46","label":"GPU Diode","sensor_type":"temp"},{"id":"FCPU","value":"3275","label":"CPU","sensor_type":"fan"},{"id":"PCPUPKG","value":"12.27","label":"CPU Package","sensor_type":"pwr"}]
            sensorValues = JSON.parse(loadedSensors);

            // Add sensor values to the sensor value combo box
            cmbSensorTypeSelection.innerHTML = sensorValues.map(
                (sensorValue) => `<option value="${sensorValue.id}" data-unit="${sensorValue.unit}" title="${sensorValue.value}">${sensorValue.label}</option>`
            ).join("");

        }
    );
}

function setSelectedSensor(listHtmlElement) {
    // If elementId is undefined or null, return
    if (!listHtmlElement || !listHtmlElement.id) {
        console.log("Element id is undefined or null");
        return;
    }

    let elementId = listHtmlElement.id;

    // Remove prefix xyz- including the minus from the id
    elementId = elementId.substring(elementId.indexOf("-") + 1);

    lastSelectedSensorListElement = document.getElementById(LIST_ID_PREFIX + elementId);
    lastSelectedDesignerElement = document.getElementById(DESIGNER_ID_PREFIX + elementId);

    // Register arrow key press event to move the selected sensor on the designer pane
    document.addEventListener("keydown", moveSelectedSensor);

    // Set background color of the selected sensor
    lastSelectedSensorListElement.style.backgroundColor = "rgb(0, 0, 0, 0.5)";

    // Set background color of all other li elements to transparent
    Array.from(lstDesignerPlacedElements.children).forEach(
        (child) => {
            if (child.id !== lastSelectedSensorListElement.id) {
                child.style.backgroundColor = "transparent";
            }
        }
    );

    // Show the sensor details of the last selected sensor
    showLastSelectedSensorDetail();
}


// If the ctrl key is pressed, entry is moved by 5px instead of 1px
function moveSelectedSensor() {
    // Check if the ctrl key or shift is pressed
    const isModifierPressed = event.ctrlKey || event.shiftKey;

    // Check if the arrow keys are pressed
    const isArrowUpPressed = event.key === "ArrowUp";
    const isArrowDownPressed = event.key === "ArrowDown";
    const isArrowLeftPressed = event.key === "ArrowLeft";
    const isArrowRightPressed = event.key === "ArrowRight";

    // Check if the user pressed the ctrl key and an arrow key
    if (isModifierPressed && (isArrowUpPressed || isArrowDownPressed || isArrowLeftPressed || isArrowRightPressed)) {
        // Move the selected sensor by 5px
        moveSelectedSensorBy(5, isArrowUpPressed, isArrowDownPressed, isArrowLeftPressed, isArrowRightPressed);
    } else if (isArrowUpPressed || isArrowDownPressed || isArrowLeftPressed || isArrowRightPressed) {
        // Move the selected sensor by 1px
        moveSelectedSensorBy(1, isArrowUpPressed, isArrowDownPressed, isArrowLeftPressed, isArrowRightPressed);
    }
}

function moveSelectedSensorBy(number, isArrowUpPressed, isArrowDownPressed, isArrowLeftPressed, isArrowRightPressed) {
    // Get the current position of the selected sensor
    let currentX = parseInt(lastSelectedDesignerElement.style.left);
    let currentY = parseInt(lastSelectedDesignerElement.style.top);

    // Move the selected sensor by the given number
    if (isArrowUpPressed) {
        currentY -= number;
    } else if (isArrowDownPressed) {
        currentY += number;
    } else if (isArrowLeftPressed) {
        currentX -= number;
    } else if (isArrowRightPressed) {
        currentX += number;
    }

    // Check if the sensor is out of bounds
    if (currentX < 0) {
        currentX = 0;
    }
    if (currentY < 0) {
        currentY = 0;
    }
    if (currentX > designerPane.clientWidth - lastSelectedDesignerElement.clientWidth) {
        currentX = designerPane.clientWidth - lastSelectedDesignerElement.clientWidth;
    }
    if (currentY > designerPane.clientHeight - lastSelectedDesignerElement.clientHeight) {
        currentY = designerPane.clientHeight - lastSelectedDesignerElement.clientHeight;
    }

    // Update the position of the selected sensor
    txtSensorPositionX.value = currentX;
    txtSensorPositionY.value = currentY;

    // Update the position of the selected sensor in the designer
    lastSelectedDesignerElement.style.left = currentX + "px";
    lastSelectedDesignerElement.style.top = currentY + "px";

    // Update the position of the selected sensor in the list
    lastSelectedSensorListElement.setAttribute("data-sensor-position-x", currentX);
    lastSelectedSensorListElement.setAttribute("data-sensor-position-y", currentY);

    // Save the updated sensor
    saveConfig();
}

function updateSensor(calculatedId) {
    // Update sensor in the list
    let listEntryElement = document.getElementById(LIST_ID_PREFIX + calculatedId);
    listEntryElement.setAttribute("data-sensor-id", cmbSensorTypeSelection.value);
    listEntryElement.setAttribute("data-sensor-text-format", txtSensorTextFormat.value);
    listEntryElement.setAttribute("data-sensor-position-x", txtSensorPositionX.value);
    listEntryElement.setAttribute("data-sensor-position-y", txtSensorPositionY.value);
    listEntryElement.innerHTML = txtSensorName.value;

    // Update sensor in the designer
    let designerElement = document.getElementById(DESIGNER_ID_PREFIX + calculatedId);
    designerElement.title = txtSensorName.value;
    designerElement.innerHTML = txtSensorTextFormat.value
        .replace("{value}", cmbSensorTypeSelection.options[cmbSensorTypeSelection.selectedIndex].title)
        .replace("{unit}", cmbSensorTypeSelection.options[cmbSensorTypeSelection.selectedIndex].getAttribute("data-unit"));
    designerElement.style.left = txtSensorPositionX.value + "px";
    designerElement.style.top = txtSensorPositionY.value + "px";
}

function addSensorToDesignerPane(elementId, sensorTextFormat, sensorValue, sensorUnit, sensorName, positionX, positionY) {
    const designerElement = document.createElement("div");
    designerElement.id = DESIGNER_ID_PREFIX + elementId;
    designerElement.title = sensorName;
    designerElement.innerHTML = sensorTextFormat
        .replace("{value}", sensorValue)
        .replace("{unit}", sensorUnit);

    designerElement.style.position = "absolute";
    designerElement.style.left = positionX + "px";
    designerElement.style.top = positionY + "px";
    designerElement.draggable = true;

    designerElement.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', event.target.id);
    });

    designerElement.addEventListener('mousedown', (event) => {
        setSelectedSensor(event.target);
    });

    designerPane.appendChild(designerElement);

    // Set last selected sensor to the new sensor
    lastSelectedDesignerElement = designerElement;
}

function saveDeviceConfig() {
    if (txtDeviceName.value === "") {
        alert("Please enter a name for the device.");
        return;
    }
    if (txtNetworkAddress.value === "") {
        alert("Please enter a network address for the device.");
        return;
    }
    if (txtSensorName.value === "") {
        alert("Please enter a name for the sensor.");
        return;
    }

    const calculatedId = txtSensorName.value.replace(" ", "-").toLowerCase();

    // Check if sensor is already exists, if so, update the sensor
    if (document.getElementById(LIST_ID_PREFIX + calculatedId) !== null) {
        updateSensor(calculatedId);
    } else {
        // Add new sensor to list
        const selectedSensor = cmbSensorTypeSelection.options[cmbSensorTypeSelection.selectedIndex];
        const sensorTextFormat = txtSensorTextFormat.value;
        const sensorId = selectedSensor.value;
        const sensorValue = selectedSensor.title;
        const sensorUnit = selectedSensor.getAttribute("data-unit");
        const sensorName = txtSensorName.value;
        let positionX = txtSensorPositionX.value;
        let positionY = txtSensorPositionY.value;

        // Create new li element
        addSensorToList(calculatedId, sensorId, sensorTextFormat, positionX, positionY, sensorName);

        // Build designer element
        addSensorToDesignerPane(calculatedId, sensorTextFormat, sensorValue, sensorUnit, sensorName, positionX, positionY);

        // Set the new li element as selected
        setSelectedSensor(document.getElementById(LIST_ID_PREFIX + calculatedId));
    }

    // Update the device name in list
    const deviceNameElement = document.getElementById(currentNetworkDeviceId);
    deviceNameElement.innerText = txtDeviceName.value;

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

    // Select the first sensor in the list
    setSelectedSensor(lstDesignerPlacedElements.firstChild);

    // Save config
    saveConfig();
}

function onSensorListItemClick(event) {
    setSelectedSensor(event.target);
}

function showLastSelectedSensorDetail() {
    txtSensorName.value = lastSelectedSensorListElement.innerHTML;
    cmbSensorTypeSelection.value = lastSelectedSensorListElement.getAttribute("data-sensor-id");
    txtSensorTextFormat.value = lastSelectedSensorListElement.getAttribute("data-sensor-text-format");
    txtSensorPositionX.value = lastSelectedSensorListElement.getAttribute("data-sensor-position-x");
    txtSensorPositionY.value = lastSelectedSensorListElement.getAttribute("data-sensor-position-y");
}

function dropOnParent(event) {
    event.preventDefault();

    const elementId = event.dataTransfer.getData('text/plain');
    const htmlElement = document.getElementById(elementId);

    let x = event.clientX - designerPane.getBoundingClientRect().left - htmlElement.clientWidth / 2;
    let y = event.clientY - designerPane.getBoundingClientRect().top - htmlElement.clientHeight / 2;

    // allow only positive values
    x = x < 0 ? 0 : x;
    y = y < 0 ? 0 : y;

    htmlElement.style.left = `${x}px`;
    htmlElement.style.top = `${y}px`;

    // Update sensor position attributes
    lastSelectedSensorListElement.setAttribute("data-sensor-position-x", x);
    lastSelectedSensorListElement.setAttribute("data-sensor-position-y", y);

    // Select the sensor in the list
    setSelectedSensor(lastSelectedSensorListElement);

    // Update X and Y position in the detail pane
    txtSensorPositionX.value = x;
    txtSensorPositionY.value = y;

    saveConfig();
}

function updateLcdDesignPaneDimensions() {
    let width = txtResolutionWidth.value;
    let height = txtResolutionHeight.value;

    // Check if width and height are valid numbers over 0, otherwise return
    if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0) {
        return;
    }

    designerPane.style.width = width + "px";
    designerPane.style.height = height + "px";

    saveConfig();
}

function onListItemDragStart(event) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', event.target.textContent);
    draggedLiElement = event.target;
}

function onListItemDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}

function onListItemDrop(event) {
    event.preventDefault();

    if (event.target.tagName === 'LI') {
        event.target.parentNode.insertBefore(draggedLiElement, event.target.nextSibling);
    } else {
        event.target.appendChild(draggedLiElement);
    }

    saveConfig();
}