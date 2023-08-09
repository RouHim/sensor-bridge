const {invoke, convertFileSrc} = window.__TAURI__.tauri;
const {open} = window.__TAURI__.dialog;

// Network port selection
const cmbNetworkPorts = document.getElementById("main-network-ports-select");

// Main buttons
const btnAddNetworkDevice = document.getElementById("btn-add-network-device");
const btnSaveNetworkDevice = document.getElementById("lcd-btn-save-network-device");
const btnToggleLivePreview = document.getElementById("btn-lcd-toggle-live-preview");
const btnRemoveNetworkDevice = document.getElementById("lcd-btn-remove-network-device");
const btnTransferActive = document.getElementById("main-chk-transfer-active");

// LCD designer
const txtDeviceName = document.getElementById("lcd-txt-device-name");
const txtDeviceNetworkAddress = document.getElementById("lcd-txt-device-network-address");
const txtLcdResolutionWidth = document.getElementById("lcd-txt-resolution-width");
const txtLcdResolutionHeight = document.getElementById("lcd-txt-resolution-height");
const designerPane = document.getElementById("lcd-designer-pane");
const btnSaveElement = document.getElementById("lcd-btn-save-element");
const btnRemoveElement = document.getElementById("lcd-btn-remove-element");
const lstDesignerPlacedElements = document.getElementById("lcd-designer-placed-elements");

// Config panes
const layoutTextConfig = document.getElementById("lcd-text-config");
const layoutStaticImageConfig = document.getElementById("lcd-static-image-config");
const layoutGraphConfig = document.getElementById("lcd-graph-config");
const layoutConditionalImageConfig = document.getElementById("lcd-conditional-image-config");

// Generic element
const txtElementName = document.getElementById("lcd-txt-element-name");
const cmbElementType = document.getElementById("lcd-cmb-element-type");
const txtElementPositionX = document.getElementById("lcd-txt-element-position-x");
const txtElementPositionY = document.getElementById("lcd-txt-element-position-y");
const cmbSensorIdSelection = document.getElementById("lcd-cmb-sensor-id-selection");

// Text
const txtElementTextFormat = document.getElementById("lcd-txt-element-text-format");
const txtElementFontSize = document.getElementById("lcd-txt-element-font-size");
const txtElementFontColor = document.getElementById("lcd-txt-element-font-color");

// Static image
const btnElementSelectStaticImage = document.getElementById("lcd-btn-static-image-select");
const txtElementStaticImageFile = document.getElementById("lcd-txt-element-static-image-file");
const txtElementStaticImageWidth = document.getElementById("lcd-txt-element-static-image-width");
const txtElementStaticImageHeight = document.getElementById("lcd-txt-element-static-image-height");

// Graph
const cmbNumberSensorIdSelection = document.getElementById("lcd-cmb-number-sensor-id-selection");
const txtElementGraphWidth = document.getElementById("lcd-graph-width");
const txtElementGraphHeight = document.getElementById("lcd-graph-height");
const cmbElementGraphType = document.getElementById("lcd-graph-type");
const txtElementGraphColor = document.getElementById("lcd-graph-color");
const txtElementGraphStrokeWidth = document.getElementById("lcd-graph-stroke-width");
const txtElementGraphBackgroundColor = document.getElementById("lcd-graph-background-color");
const txtElementGraphBorderColor = document.getElementById("lcd-graph-border-color");
const btnElementConditionalImageInfo = document.getElementById("lcd-btn-conditional-image-info");

// Conditional image
const cmbConditionalImageSensorIdSelection = document.getElementById("lcd-cmb-conditional-image-sensor-id-selection");
const btnElementSelectConditionalImage = document.getElementById("lcd-btn-conditional-image-select");
const txtElementConditionalImageImagesPath = document.getElementById("lcd-txt-element-conditional-image-images-path");
const txtElementConditionalImageMinValue = document.getElementById("lcd-txt-element-conditional-image-min-value");
const txtElementConditionalImageMaxValue = document.getElementById("lcd-txt-element-conditional-image-max-value");
const txtElementConditionalImageWidth = document.getElementById("lcd-txt-element-conditional-image-width");
const txtElementConditionalImageHeight = document.getElementById("lcd-txt-element-conditional-image-height");

// Global variables
let sensorValues = [];
let lastSelectedListElement = null;
let lastSelectedDesignerElement = null;
let draggedLiElement;
let currentNetworkDeviceId = null;

// Global constants
const DESIGNER_ID_PREFIX = "designer-";
const LIST_ID_PREFIX = "list-";

window.addEventListener("DOMContentLoaded", () => {
    // Configure color picker
    window.Coloris && (Coloris({
        theme: 'large',
        themeMode: 'dark',
        alpha: true,
        forceAlpha: true,
    }));

    // Register on network device selected onNetDeviceSelected(liElement)
    cmbNetworkPorts.addEventListener("change", (event) => {
        onNetDeviceSelected(event.target.options[event.target.selectedIndex]);
    });

    // Register event for display resolution
    txtLcdResolutionWidth.addEventListener("input", updateLcdDesignPaneDimensions);
    txtLcdResolutionHeight.addEventListener("input", updateLcdDesignPaneDimensions);

    // Register button click events
    btnAddNetworkDevice.addEventListener("click", createNetworkPort);
    btnRemoveNetworkDevice.addEventListener("click", removeDevice);
    btnSaveNetworkDevice.addEventListener("click", saveDeviceConfig);
    btnSaveElement.addEventListener("click", saveDeviceConfig);
    btnTransferActive.addEventListener("click", () => toggleSync(btnTransferActive.checked));
    btnToggleLivePreview.addEventListener("click", toggleLivePreview);
    btnRemoveElement.addEventListener("click", removeElement);
    cmbElementType.addEventListener("change", onElementTypeChange);
    btnElementSelectStaticImage.addEventListener("click", selectStaticImage);
    btnElementConditionalImageInfo.addEventListener("click", () => showConditionalImageInfo());
    btnElementSelectConditionalImage.addEventListener("click", selectConditionalImage);

    // Register drag dropping
    designerPane.addEventListener('dragover', (event) => event.preventDefault());
    designerPane.addEventListener('drop', dropOnDesignerPane);

    // Load all devices from config
    loadDeviceConfigs();

    // Select first net port
    if (cmbNetworkPorts.options.length > 0) {
        onNetDeviceSelected(cmbNetworkPorts.options[0]);
    }
});

/// Show an info dialog which explains how to use conditional image upload
function showConditionalImageInfo() {
    alert(
        "To upload a conditional image, you need to create a zip file which contains all images you want to use.\n\n" +
        "The images must be named like this: '{sensor_value}.{extension}'.\n" +
        "Example: '20.png' or '20.0.jpg' or 'enabled.gif or 'Full.bmp'\n\n" +
        "The sensor value can be a number or text representing the current state of a sensor value. " +
        "If the sensor value is a number, the image with the closest value will be used. " +
        "If the sensor value is text, the image with the most similar text will be used.\n\n" +
        "The extension can be any image extension like 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'tga', 'tiff', 'ico'.\n\n" +
        "The zip file must contain at least one image."
    )
}

async function selectStaticImage() {
    open({
        multiple: false,
        directory: false,
        filters: [{
            name: 'Image',
            extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', "tga", "tiff", "ico"],
        }]
    }).then(
        (selected) => {
            if (typeof selected === "string" && selected !== "") {
                txtElementStaticImageFile.value = selected;
            } else {
                console.log("No file selected");
            }
        }
    )
}

async function selectConditionalImage() {
    open({
        multiple: false,
        directory: false,
        filters: [{
            name: 'Select conditional image package',
            extensions: ["zip"],
        }]
    }).then(
        (selected) => {
            if (selected !== "") {
                txtElementConditionalImageImagesPath.value = selected;
            } else {
                console.log("No file selected");
            }
        }
    )
}

function onElementTypeChange() {
    layoutTextConfig.style.display = "none";
    layoutStaticImageConfig.style.display = "none";
    layoutGraphConfig.style.display = "none";
    layoutConditionalImageConfig.style.display = "none";

    const selectedElement = cmbElementType.options[cmbElementType.selectedIndex].value;
    switch (selectedElement) {
        case "text":
            layoutTextConfig.style.display = "block";
            break;
        case "static-image":
            layoutStaticImageConfig.style.display = "block";
            break;
        case "graph":
            layoutGraphConfig.style.display = "block";
            break;
        case "conditional-image":
            layoutConditionalImageConfig.style.display = "block";
            break;
    }
}

function removeDevice() {
    // Get selected net port id
    let networkDeviceId = currentNetworkDeviceId;

    // If net port id is empty, return
    if (networkDeviceId === "") {
        return;
    }

    // Remove net port from list
    let toRemove = document.getElementById(networkDeviceId);
    cmbNetworkPorts.removeChild(toRemove);

    // Remove net port from backend
    invoke('remove_network_device_config', {networkDeviceId: networkDeviceId});

    // If is at least one net port, select the first one
    if (cmbNetworkPorts.options.length > 0) {
        onNetDeviceSelected(cmbNetworkPorts.options[0]);
    } else {
        clearForm();
    }
}

function clearForm() {
    txtDeviceName.value = "";
    txtDeviceNetworkAddress.value = "";
    txtLcdResolutionWidth.value = "";
    txtLcdResolutionHeight.value = "";
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

        // Clear net port combobox
        cmbNetworkPorts.innerHTML = "";

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
        if (cmbNetworkPorts.options.length > 0) {
            onNetDeviceSelected(cmbNetworkPorts.options[0]);
        }
    });
}

function addNetworkDeviceToList(id, name) {
    // Create new net port
    let netPortElement = document.createElement("option");
    netPortElement.id = id;
    netPortElement.value = id;
    netPortElement.innerText = name;

    // Add to net port combo box
    cmbNetworkPorts.appendChild(netPortElement);
}

function getGraphConfig(listItem) {
    // Get graph config attributes
    const elementGraphWidth = parseInt(listItem.getAttribute("data-element-graph-width"));
    const elementGraphHeight = parseInt(listItem.getAttribute("data-element-graph-height"));
    const elementGraphType = listItem.getAttribute("data-element-graph-type");
    const elementGraphColor = listItem.getAttribute("data-element-graph-color");
    const elementGraphStrokeWidth = parseInt(listItem.getAttribute("data-element-graph-stroke-width"));
    const elementGraphBackgroundColor = listItem.getAttribute("data-element-graph-background-color");
    const elementGraphBorderColor = listItem.getAttribute("data-element-graph-border-color");

    // Build GraphConfig struct
    return {
        width: elementGraphWidth,
        height: elementGraphHeight,
        graph_type: elementGraphType,
        graph_color: elementGraphColor,
        graph_stroke_width: elementGraphStrokeWidth,
        background_color: elementGraphBackgroundColor,
        border_color: elementGraphBorderColor,
        sensor_values: [],
    };
}

function getConditionalImageConfig(listItem) {
    // Get conditional image config attributes
    const sensorId = listItem.getAttribute("data-sensor-id");
    const elementConditionalImageImagesPath = listItem.getAttribute("data-element-conditional-image-images-path");
    const elementConditionalImageWidth = parseInt(listItem.getAttribute("data-element-conditional-image-width"));
    const elementConditionalImageHeight = parseInt(listItem.getAttribute("data-element-conditional-image-height"));
    const elementConditionalImageMinValue = parseInt(listItem.getAttribute("data-element-conditional-image-min-value"));
    const elementConditionalImageMaxValue = parseInt(listItem.getAttribute("data-element-conditional-image-max-value"));

    // Build ConditionalImageConfig struct
    return {
        sensor_id: sensorId,
        sensor_value: "",
        images_path: elementConditionalImageImagesPath,
        min_sensor_value: elementConditionalImageMinValue,
        max_sensor_value: elementConditionalImageMaxValue,
        width: elementConditionalImageWidth,
        height: elementConditionalImageHeight,
    };
}

function getImageConfig(listItem) {
    // Get image config attributes
    const elementStaticImage = listItem.getAttribute("data-element-static-image");
    const elementStaticImageWidth = parseInt(listItem.getAttribute("data-element-static-image-width"));
    const elementStaticImageHeight = parseInt(listItem.getAttribute("data-element-static-image-height"));

    // Build ImageConfig object
    return {
        width: elementStaticImageWidth,
        height: elementStaticImageHeight,
        image_path: elementStaticImage,
    };
}

function getTextConfig(listItem) {
    // Get text config attributes
    const elementTextFormat = listItem.getAttribute("data-element-text-format");
    const elementFontColor = listItem.getAttribute("data-element-font-color");
    const elementFontSize = parseInt(listItem.getAttribute("data-element-font-size"));
    // Build TextConfig object
    return {
        text_format: elementTextFormat,
        font_size: elementFontSize,
        font_color: elementFontColor,
    };
}

function saveConfig() {
    // If net port id is empty, return
    if (currentNetworkDeviceId === "") {
        return;
    }

    // Get device name and network address
    const deviceName = txtDeviceName.value;
    const deviceAddress = txtDeviceNetworkAddress.value;

    // Get LCD Resolution Height and cast to integer
    const lcdResolutionWidth = txtLcdResolutionWidth.value;
    const lcdResolutionHeight = txtLcdResolutionHeight.value;

    // Find all list items of lcd-designer-placed-elements extract sensors and save them to the lcd config
    const lcdDesignerPlacedElementsListItems = lstDesignerPlacedElements.getElementsByTagName("li");
    const lcdDesignerPlacedElementsListItemsArray = Array.from(lcdDesignerPlacedElementsListItems);
    const lcdElements = lcdDesignerPlacedElementsListItemsArray.map((listItem) => {
        // Get element attributes
        const elementId = listItem.getAttribute("data-element-id");
        const sensorId = listItem.getAttribute("data-sensor-id");
        const elementType = listItem.getAttribute("data-element-type");
        const elementName = listItem.getAttribute("data-element-name");
        const elementX = parseInt(listItem.getAttribute("data-element-position-x"));
        const elementY = parseInt(listItem.getAttribute("data-element-position-y"));

        const textConfig = getTextConfig(listItem);
        const imageConfig = getImageConfig(listItem);
        const graphConfig = getGraphConfig(listItem);
        const conditionalImageConfig = getConditionalImageConfig(listItem);

        // Build lcd element
        return {
            id: elementId,
            name: elementName,
            x: elementX,
            y: elementY,
            element_type: elementType,
            sensor_id: sensorId,
            text_config: textConfig,
            image_config: imageConfig,
            graph_config: graphConfig,
            conditional_image_config: conditionalImageConfig,
        };
    });

    // Build lcd config object, with integers
    const lcdConfig = {
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
            txtDeviceNetworkAddress.value = portConfig.address;

            // Set active sync state
            btnTransferActive.checked = portConfig.active;

            // Set as selected net port combobox
            cmbNetworkPorts.value = networkDeviceId;

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
            txtLcdResolutionWidth.value = lcdConfig.resolution_width;
            txtLcdResolutionHeight.value = lcdConfig.resolution_height;

            // Clear designer pane
            designerPane.innerHTML = "";

            // Clear sensor list
            lstDesignerPlacedElements.innerHTML = "";

            // Add elements to designer pane and list
            // iterate elements with index
            lcdConfig.elements.forEach((element, index) => {
                // Find sensor in sensor values list
                let sensor = sensorValues.find((sensorValue) => sensorValue.id === element.sensor_id);

                // Load sensor value and unit
                let sensorValue = sensor ? sensor.value : "";
                let sensorUnit = sensor ? sensor.unit : "";

                // Add element to list
                addElementToList(element.id, element.sensor_id, element.x, element.y, element.name, element.element_type, element.text_config, element.image_config, element.graph_config, element.conditional_image_config);

                // Add element to designer pane
                addElementToDesignerPane(index, element.id, sensorValue, sensorUnit, element.name, element.element_type, element.x, element.y, element.text_config, element.image_config, element.graph_config, element.conditional_image_config);
            });

            // If there are elements, select the first one
            if (lcdConfig.elements.length > 0) {
                setSelectedElement(document.querySelector("#lcd-designer-placed-elements li"));
            }

            // Update designer pane dimensions
            designerPane.style.width = lcdConfig.resolution_width + "px";
            designerPane.style.height = lcdConfig.resolution_height + "px";
        }
    );
}

function addElementToList(elementId, sensorId, positionX, positionY, elementName, elementType, elementTextConfig, elementImageConfig, elementGraphConfig, elementConditionalImageConfig) {
    const liElement = document.createElement("li");

    // Element config
    liElement.id = LIST_ID_PREFIX + elementId;
    liElement.setAttribute("data-element-id", elementId);
    liElement.setAttribute("data-sensor-id", sensorId);
    liElement.setAttribute("data-element-name", elementName);
    liElement.setAttribute("data-element-type", elementType);
    liElement.setAttribute("data-element-position-x", positionX);
    liElement.setAttribute("data-element-position-y", positionY);

    // Text config
    liElement.setAttribute("data-element-text-format", elementTextConfig.text_format);
    liElement.setAttribute("data-element-font-size", elementTextConfig.font_size);
    liElement.setAttribute("data-element-font-color", elementTextConfig.font_color);

    // Image config
    liElement.setAttribute("data-element-static-image", elementImageConfig.image_path);
    liElement.setAttribute("data-element-static-image-width", elementImageConfig.width);
    liElement.setAttribute("data-element-static-image-height", elementImageConfig.height);

    // Graph config
    liElement.setAttribute("data-element-graph-width", elementGraphConfig.width);
    liElement.setAttribute("data-element-graph-height", elementGraphConfig.height);
    liElement.setAttribute("data-element-graph-type", elementGraphConfig.graph_type);
    liElement.setAttribute("data-element-graph-color", elementGraphConfig.graph_color);
    liElement.setAttribute("data-element-graph-stroke-width", elementGraphConfig.graph_stroke_width);
    liElement.setAttribute("data-element-graph-background-color", elementGraphConfig.background_color);
    liElement.setAttribute("data-element-graph-border-color", elementGraphConfig.border_color);

    // Conditional image config
    liElement.setAttribute("data-element-conditional-image-images-path", elementConditionalImageConfig.images_path);
    liElement.setAttribute("data-element-conditional-image-min-value", elementConditionalImageConfig.min_sensor_value);
    liElement.setAttribute("data-element-conditional-image-max-value", elementConditionalImageConfig.max_sensor_value);
    liElement.setAttribute("data-element-conditional-image-width", elementConditionalImageConfig.width);
    liElement.setAttribute("data-element-conditional-image-height", elementConditionalImageConfig.height);

    // Build li element
    liElement.innerHTML = elementName;
    liElement.draggable = true;
    liElement.ondragstart = onListElementDragStart;
    liElement.ondragover = onListItemDragOver;
    liElement.ondrop = onListElementDrop;

    // Add element to the list#
    lstDesignerPlacedElements.innerHTML += liElement.outerHTML;

    // Find all li element in the ul lcd-designer-placed-elements and register click event
    // We have to re-register the click event because the list was re-rendered
    const designerPlacedElements = document.querySelectorAll("#lcd-designer-placed-elements li");
    designerPlacedElements.forEach((designerElement) => {
        designerElement.addEventListener("click", onListElementClick);
        designerElement.addEventListener('dragstart', onListElementDragStart);
        designerElement.addEventListener('dragover', onListItemDragOver);
        designerElement.addEventListener('drop', onListElementDrop);
    });

    // Set last selected sensor list element
    lastSelectedListElement = liElement;
}

function loadSensorValues() {
    invoke('get_sensor_values').then(
        (loadedSensors) => {
            // cast sensor values to json object
            sensorValues = JSON.parse(loadedSensors);

            // Add sensor values to the sensor value combo box
            cmbSensorIdSelection.innerHTML = sensorValues.map(
                (sensorValue) => `<option value="${sensorValue.id}" data-unit="${sensorValue.unit}" title="${sensorValue.value}">${sensorValue.label}</option>`
            ).join("");

            // Add sensor values to cmbConditionalImageSensorIdSelection
            cmbConditionalImageSensorIdSelection.innerHTML = sensorValues.map(
                (sensorValue) => `<option value="${sensorValue.id}" data-unit="${sensorValue.unit}" title="${sensorValue.value}">${sensorValue.label}</option>`
            ).join("");

            // Filter out only number sensors and add them to cmbNumberSensorIdSelection
            cmbNumberSensorIdSelection.innerHTML = sensorValues.filter(
                (sensorValue) => sensorValue.sensor_type === "number"
            ).map(
                (sensorValue) => `<option value="${sensorValue.id}" data-unit="${sensorValue.unit}" title="${sensorValue.value}">${sensorValue.label}</option>`
            ).join("");
        }
    );
}

function setSelectedElement(listHtmlElement) {
    // If elementId is undefined or null, return
    if (!listHtmlElement || !listHtmlElement.id) {
        console.log("Element id is undefined or null");
        return;
    }

    let elementId = listHtmlElement.id;

    // Remove prefix xyz- including the minus from the id
    elementId = elementId.substring(elementId.indexOf("-") + 1);

    lastSelectedListElement = document.getElementById(LIST_ID_PREFIX + elementId);
    lastSelectedDesignerElement = document.getElementById(DESIGNER_ID_PREFIX + elementId);

    // Register arrow key press event to move the selected element on the designer pane
    document.addEventListener("keydown", moveSelectedElement);

    // Set background color of the selected element
    lastSelectedListElement.style.backgroundColor = "rgb(0, 0, 0, 0.5)";

    // Set background color of all other li elements to transparent
    Array.from(lstDesignerPlacedElements.children).forEach(
        (child) => {
            if (child.id !== lastSelectedListElement.id) {
                child.style.backgroundColor = "transparent";
            }
        }
    );

    // Show the element details of the last selected element
    showLastSelectedElementDetail();
}


// If the ctrl key is pressed, entry is moved by 5px instead of 1px
function moveSelectedElement() {
    // Check if the ctrl key or shift is pressed
    const isModifierPressed = event.ctrlKey || event.shiftKey;

    // Check if the arrow keys are pressed
    const isArrowUpPressed = event.key === "ArrowUp";
    const isArrowDownPressed = event.key === "ArrowDown";
    const isArrowLeftPressed = event.key === "ArrowLeft";
    const isArrowRightPressed = event.key === "ArrowRight";

    // Check if the user pressed the ctrl key and an arrow key
    if (isModifierPressed && (isArrowUpPressed || isArrowDownPressed || isArrowLeftPressed || isArrowRightPressed)) {
        // Move the selected element by 5px
        moveSelectedElementBy(5, isArrowUpPressed, isArrowDownPressed, isArrowLeftPressed, isArrowRightPressed);
    } else if (isArrowUpPressed || isArrowDownPressed || isArrowLeftPressed || isArrowRightPressed) {
        // Move the selected element by 1px
        moveSelectedElementBy(1, isArrowUpPressed, isArrowDownPressed, isArrowLeftPressed, isArrowRightPressed);
    }
}

function moveSelectedElementBy(number, isArrowUpPressed, isArrowDownPressed, isArrowLeftPressed, isArrowRightPressed) {
    // Get the current position of the selected element
    let currentX = parseInt(lastSelectedDesignerElement.style.left);
    let currentY = parseInt(lastSelectedDesignerElement.style.top);

    // Move the selected element by the given number
    if (isArrowUpPressed) {
        currentY -= number;
    } else if (isArrowDownPressed) {
        currentY += number;
    } else if (isArrowLeftPressed) {
        currentX -= number;
    } else if (isArrowRightPressed) {
        currentX += number;
    }

    // Check if the element is out of bounds
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

    // Update the position of the selected element
    txtElementPositionX.value = currentX;
    txtElementPositionY.value = currentY;

    // Update the position of the selected element in the designer
    lastSelectedDesignerElement.style.left = currentX + "px";
    lastSelectedDesignerElement.style.top = currentY + "px";

    // Update the position of the selected element in the list
    lastSelectedListElement.setAttribute("data-element-position-x", currentX);
    lastSelectedListElement.setAttribute("data-element-position-y", currentY);

    // Save the updated element
    saveConfig();
}

function updateElement(calculatedId) {
    // Update element in the list
    let listEntryElement = document.getElementById(LIST_ID_PREFIX + calculatedId);

    // Get sensor id
    // If the element type is a graph, the sensor id is the number sensor id
    // If the element type is a conditional image, the sensor id is the conditional image sensor id
    let sensorId = cmbSensorIdSelection.value;
    if (cmbElementType.value === "graph") {
        sensorId = cmbNumberSensorIdSelection.value;
    } else if (cmbElementType.value === "conditional-image") {
        sensorId = cmbConditionalImageSensorIdSelection.value;
    }

    // Update element config
    listEntryElement.setAttribute("data-element-id", calculatedId);
    listEntryElement.setAttribute("data-sensor-id", sensorId);
    listEntryElement.setAttribute("data-element-name", txtElementName.value);
    listEntryElement.setAttribute("data-element-position-x", txtElementPositionX.value);
    listEntryElement.setAttribute("data-element-type", cmbElementType.value);

    // Text config
    listEntryElement.setAttribute("data-element-position-y", txtElementPositionY.value);
    listEntryElement.setAttribute("data-element-font-size", txtElementFontSize.value);
    listEntryElement.setAttribute("data-element-font-color", txtElementFontColor.value);

    // Image config
    listEntryElement.setAttribute("data-element-text-format", txtElementTextFormat.value);
    listEntryElement.setAttribute("data-element-static-image", txtElementStaticImageFile.value);
    listEntryElement.setAttribute("data-element-static-image-width", txtElementStaticImageWidth.value);
    listEntryElement.setAttribute("data-element-static-image-height", txtElementStaticImageHeight.value);

    // Graph config
    listEntryElement.setAttribute("data-element-graph-width", txtElementGraphWidth.value);
    listEntryElement.setAttribute("data-element-graph-height", txtElementGraphHeight.value);
    listEntryElement.setAttribute("data-element-graph-type", cmbElementGraphType.value);
    listEntryElement.setAttribute("data-element-graph-color", txtElementGraphColor.value);
    listEntryElement.setAttribute("data-element-graph-stroke-width", txtElementGraphStrokeWidth.value);
    listEntryElement.setAttribute("data-element-graph-background-color", txtElementGraphBackgroundColor.value);
    listEntryElement.setAttribute("data-element-graph-border-color", txtElementGraphBorderColor.value);

    // Conditional image config
    listEntryElement.setAttribute("data-element-conditional-image-images-path", txtElementConditionalImageImagesPath.value);
    listEntryElement.setAttribute("data-element-conditional-image-min-value", txtElementConditionalImageMinValue.value);
    listEntryElement.setAttribute("data-element-conditional-image-max-value", txtElementConditionalImageMaxValue.value);
    listEntryElement.setAttribute("data-element-conditional-image-width", txtElementConditionalImageWidth.value);
    listEntryElement.setAttribute("data-element-conditional-image-height", txtElementConditionalImageHeight.value);

    listEntryElement.innerHTML = txtElementName.value;

    // Update element in the designer
    let designerElement = document.getElementById(DESIGNER_ID_PREFIX + calculatedId);
    designerElement.style.left = txtElementPositionX.value + "px";
    designerElement.style.top = txtElementPositionY.value + "px";

    switch (cmbElementType.value) {
        default:
        case "text":
            designerElement.title = txtElementName.value;
            designerElement.innerHTML = txtElementTextFormat.value
                .replace("{value}", cmbSensorIdSelection.options[cmbSensorIdSelection.selectedIndex].title)
                .replace("{unit}", cmbSensorIdSelection.options[cmbSensorIdSelection.selectedIndex].getAttribute("data-unit"));
            designerElement.style.fontSize = txtElementFontSize.value + "px";
            designerElement.style.fontFamily = "monospace";
            designerElement.style.color = txtElementFontColor.value;
            break;
        case "static-image":
            designerElement.style.width = txtElementStaticImageWidth.value + "px";
            designerElement.style.height = txtElementStaticImageHeight.value + "px";
            designerElement.src = toTauriAssetPath(txtElementStaticImageFile.value);
            break;
        case "graph":
            designerElement.style.width = txtElementGraphWidth.value + "px";
            designerElement.style.height = txtElementGraphHeight.value + "px";
            invoke('get_graph_preview_image', {
                sensorId: sensorId,
                graphConfig: getGraphConfig(listEntryElement)
            })
                .then(response => {
                    designerElement.src = "data:image/png;base64," + response;
                })
            break;
        case "conditional-image":
            designerElement.style.width = txtElementConditionalImageWidth.value + "px";
            designerElement.style.height = txtElementConditionalImageHeight.value + "px";
            invoke('get_conditional_image_preview_image', {
                elementId: calculatedId,
                sensorId: sensorId,
                conditionalImageConfig: getConditionalImageConfig(listEntryElement)
            })
                .then(response => {
                    designerElement.src = "data:image/png;base64," + response;
                })
            break;
    }
}

function addElementToDesignerPane(zIndex, elementId, elementSensorValue, elementSensorUnit, sensorName, sensorType, positionX, positionY, elementTextConfig, elementImageConfig, elementGraphConfig, elementConditionalImageConfig) {
    let designerElement;
    switch (sensorType) {
        default:
        case "text":
            designerElement = document.createElement("div");

            designerElement.title = sensorName;
            designerElement.innerHTML = elementTextConfig.text_format.replace("{value}", elementSensorValue).replace("{unit}", elementSensorUnit);
            designerElement.style.fontSize = elementTextConfig.font_size + "px";
            designerElement.style.fontFamily = "monospace";
            designerElement.style.color = elementTextConfig.font_color;
            break;
        case "static-image":
            designerElement = document.createElement("img");

            designerElement.style.width = elementImageConfig.width + "px";
            designerElement.style.height = elementImageConfig.height + "px";
            designerElement.src = toTauriAssetPath(elementImageConfig.image_path);
            break;
        case "graph":
            designerElement = document.createElement("img");

            designerElement.style.width = elementGraphConfig.width + "px";
            designerElement.style.height = elementGraphConfig.height + "px";
            invoke('get_graph_preview_image', {
                networkDeviceId: currentNetworkDeviceId,
                sensorId: lastSelectedListElement.getAttribute("data-sensor-id"),
                graphConfig: getGraphConfig(lastSelectedListElement)
            }).then(response => {
                designerElement.src = "data:image/png;base64," + response;
            })
            break;
        case "conditional-image":
            designerElement = document.createElement("img");

            designerElement.style.width = elementConditionalImageConfig.width + "px";
            designerElement.style.height = elementConditionalImageConfig.height + "px";
            invoke('get_conditional_image_preview_image', {
                elementId: elementId,
                sensorId: lastSelectedListElement.getAttribute("data-sensor-id"),
                conditionalImageConfig: getConditionalImageConfig(lastSelectedListElement),
            }).then(response => {
                designerElement.src = "data:image/png;base64," + response;
            })
            break;
    }

    designerElement.id = DESIGNER_ID_PREFIX + elementId;
    designerElement.draggable = true;
    designerElement.style.position = "absolute";
    designerElement.style.left = positionX + "px";
    designerElement.style.top = positionY + "px";
    designerElement.style.zIndex = zIndex;

    designerElement.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', event.target.id);
    });

    designerElement.addEventListener('mousedown', (event) => {
        setSelectedElement(event.target);
    });

    designerPane.appendChild(designerElement);

    // Set last selected element to the new element
    lastSelectedDesignerElement = designerElement;
}

// Converts an absolute file path, to a tauri compatible path using https://tauri.app/v1/api/js/tauri/#convertfilesrc
function toTauriAssetPath(image_path) {
    return convertFileSrc(image_path);
}

function saveDeviceConfig() {
    if (txtDeviceName.value === "") {
        alert("Please enter a name for the device.");
        return;
    }
    if (txtDeviceNetworkAddress.value === "") {
        alert("Please enter a network address for the device.");
        return;
    }
    if (txtElementName.value === "") {
        alert("Please enter a name for the element.");
        return;
    }

    const calculatedId = txtElementName.value.replace(" ", "-").toLowerCase();

    // Check if element is already exists, if so, update the sensor
    if (document.getElementById(LIST_ID_PREFIX + calculatedId) !== null) {
        updateElement(calculatedId);
    } else {
        // If selected element type is text use cmbSensorIdSelection
        // If selected element type is static-image use cmbSensorIdSelection
        // If selected element type is graph use cmbNumberSensorIdSelection
        // If selected element type is conditional-image use cmbConditionalImageSensorIdSelection
        let selectedSensor = cmbSensorIdSelection.options[cmbSensorIdSelection.selectedIndex];
        if (cmbElementType.value === "graph") {
            selectedSensor = cmbNumberSensorIdSelection.options[cmbNumberSensorIdSelection.selectedIndex];
        } else if (cmbElementType.value === "conditional-image") {
            selectedSensor = cmbConditionalImageSensorIdSelection.options[cmbConditionalImageSensorIdSelection.selectedIndex];
        }

        // Read generic element values
        const elementName = txtElementName.value;
        const elementType = cmbElementType.value;
        const sensorId = selectedSensor.value;
        const sensorValue = selectedSensor.title;
        const sensorUnit = selectedSensor.getAttribute("data-unit");
        const positionX = txtElementPositionX.value;
        const positionY = txtElementPositionY.value;

        // Read text config
        const elementTextFormat = txtElementTextFormat.value;
        const elementFontSize = txtElementFontSize.value;
        const elementFontColor = txtElementFontColor.value;

        // Read image config
        const elementStaticImage = txtElementStaticImageFile.value;
        const elementStaticImageWidth = txtElementStaticImageWidth.value;
        const elementStaticImageHeight = txtElementStaticImageHeight.value;

        // Read graph config
        const elementGraphWidth = txtElementGraphWidth.value;
        const elementGraphHeight = txtElementGraphHeight.value;
        const elementGraphType = cmbElementGraphType.value;
        const elementGraphColor = txtElementGraphColor.value;
        const elementGraphStrokeWidth = txtElementGraphStrokeWidth.value;
        const elementGraphBackgroundColor = txtElementGraphBackgroundColor.value;
        const elementGraphBorderColor = txtElementGraphBorderColor.value;

        // Read conditional image config
        const elementConditionalImageImagesPath = txtElementConditionalImageImagesPath.value;
        const elementConditionalImageMinValue = txtElementConditionalImageMinValue.value;
        const elementConditionalImageMaxValue = txtElementConditionalImageMaxValue.value;
        const elementConditionalImageWidth = txtElementConditionalImageWidth.value;
        const elementConditionalImageHeight = txtElementConditionalImageHeight.value;

        // build text config object
        let textConfig = {
            text_format: elementTextFormat,
            font_size: elementFontSize,
            font_color: elementFontColor,
        }

        // build image config object
        let imageConfig = {
            width: elementStaticImageWidth,
            height: elementStaticImageHeight,
            image_path: elementStaticImage,
        }

        // build graph config object
        let graphConfig = {
            width: elementGraphWidth,
            height: elementGraphHeight,
            graph_type: elementGraphType,
            graph_color: elementGraphColor,
            graph_stroke_width: elementGraphStrokeWidth,
            background_color: elementGraphBackgroundColor,
            border_color: elementGraphBorderColor,
        }

        // build conditional image config object
        let conditionalImageConfig = {
            images_path: elementConditionalImageImagesPath,
            min_sensor_value: elementConditionalImageMinValue,
            max_sensor_value: elementConditionalImageMaxValue,
            width: elementConditionalImageWidth,
            height: elementConditionalImageHeight,
        }

        // Create new li element
        addElementToList(calculatedId, sensorId, positionX, positionY, elementName, elementType, textConfig, imageConfig, graphConfig, conditionalImageConfig);

        // Build designer element
        const index = lstDesignerPlacedElements.childElementCount;
        addElementToDesignerPane(index, calculatedId, sensorValue, sensorUnit, elementName, elementType, positionX, positionY, textConfig, imageConfig, graphConfig, conditionalImageConfig);

        // Set the new li element as selected
        setSelectedElement(document.getElementById(LIST_ID_PREFIX + calculatedId));
    }

    // Update the device name in list
    let deviceNameElement = document.getElementById(currentNetworkDeviceId);
    deviceNameElement.innerText = txtDeviceName.value;

    // Save config
    saveConfig();
}

function removeElement() {
    if (lastSelectedListElement === null) {
        alert("Please select a element first.");
        return;
    }

    // Check if element exists in designer
    if (lastSelectedDesignerElement === null) {
        alert("Please select a element first.");
        return;
    }

    // Remove element from list
    lstDesignerPlacedElements.removeChild(lastSelectedListElement);

    // Remove element from designer
    designerPane.removeChild(lastSelectedDesignerElement);

    // Select the first element in the list
    setSelectedElement(lstDesignerPlacedElements.firstChild);

    // Save config
    saveConfig();
}

function onListElementClick(event) {
    setSelectedElement(event.target);
}

function showLastSelectedElementDetail() {
    // Generic
    txtElementName.value = lastSelectedListElement.getAttribute("data-element-name");
    txtElementPositionX.value = lastSelectedListElement.getAttribute("data-element-position-x");
    txtElementPositionY.value = lastSelectedListElement.getAttribute("data-element-position-y");
    cmbElementType.value = lastSelectedListElement.getAttribute("data-element-type");
    onElementTypeChange();

    // Text
    txtElementTextFormat.value = lastSelectedListElement.getAttribute("data-element-text-format");
    cmbSensorIdSelection.value = lastSelectedListElement.getAttribute("data-sensor-id");
    txtElementFontSize.value = lastSelectedListElement.getAttribute("data-element-font-size");
    txtElementFontColor.value = lastSelectedListElement.getAttribute("data-element-font-color");

    // Static image
    txtElementStaticImageFile.value = lastSelectedListElement.getAttribute("data-element-static-image");
    txtElementStaticImageWidth.value = lastSelectedListElement.getAttribute("data-element-static-image-width");
    txtElementStaticImageHeight.value = lastSelectedListElement.getAttribute("data-element-static-image-height");

    // Graph
    cmbNumberSensorIdSelection.value = lastSelectedListElement.getAttribute("data-sensor-id");
    txtElementGraphWidth.value = lastSelectedListElement.getAttribute("data-element-graph-width");
    txtElementGraphHeight.value = lastSelectedListElement.getAttribute("data-element-graph-height");
    cmbElementGraphType.value = lastSelectedListElement.getAttribute("data-element-graph-type");
    txtElementGraphColor.value = lastSelectedListElement.getAttribute("data-element-graph-color");
    txtElementGraphStrokeWidth.value = lastSelectedListElement.getAttribute("data-element-graph-stroke-width");
    txtElementGraphBackgroundColor.value = lastSelectedListElement.getAttribute("data-element-graph-background-color");
    txtElementGraphBorderColor.value = lastSelectedListElement.getAttribute("data-element-graph-border-color");

    // Conditional image
    cmbConditionalImageSensorIdSelection.value = lastSelectedListElement.getAttribute("data-sensor-id");
    txtElementConditionalImageImagesPath.value = lastSelectedListElement.getAttribute("data-element-conditional-image-images-path");
    txtElementConditionalImageMinValue.value = lastSelectedListElement.getAttribute("data-element-conditional-image-min-value");
    txtElementConditionalImageMaxValue.value = lastSelectedListElement.getAttribute("data-element-conditional-image-max-value");
    txtElementConditionalImageWidth.value = lastSelectedListElement.getAttribute("data-element-conditional-image-width");
    txtElementConditionalImageHeight.value = lastSelectedListElement.getAttribute("data-element-conditional-image-height");
}

function dropOnDesignerPane(event) {
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

    // Update element position attributes
    lastSelectedListElement.setAttribute("data-element-position-x", x);
    lastSelectedListElement.setAttribute("data-element-position-y", y);

    // Select the element in the list
    setSelectedElement(lastSelectedListElement);

    // Update X and Y position in the detail pane
    txtElementPositionX.value = x;
    txtElementPositionY.value = y;

    saveConfig();
}

function updateLcdDesignPaneDimensions() {
    let width = txtLcdResolutionWidth.value;
    let height = txtLcdResolutionHeight.value;

    // Check if width and height are valid numbers over 0, otherwise return
    if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0) {
        return;
    }

    designerPane.style.width = width + "px";
    designerPane.style.height = height + "px";

    saveConfig();
}

function onListElementDragStart(event) {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', event.target.textContent);
    draggedLiElement = event.target;
}

function onListItemDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
}

function onListElementDrop(event) {
    event.preventDefault();

    if (event.target.tagName === 'LI') {
        event.target.parentNode.insertBefore(draggedLiElement, event.target.nextSibling);
    } else {
        event.target.appendChild(draggedLiElement);
    }

    // Recalculate the z-index of all elements
    recalculateZIndex();

    saveConfig();
}

// Recalculates the z-index of all designer elements
// The z-index is the index of the element in the placed list
// The first element in the list has the lowest z-index
function recalculateZIndex() {
    // Find all li element in lcd-designer-placed-elements
    const listElements = document.querySelectorAll("#lcd-designer-placed-elements li");
    //Iterate with index and find for each the corresponding designer element
    listElements.forEach((listElement, index) => {
        // Find designer element
        const id = listElement.id.replace(LIST_ID_PREFIX, DESIGNER_ID_PREFIX);
        const designerElement = document.getElementById(id);

        // Update the z-index of the designer element
        designerElement.style.zIndex = "" + index;
    });
}
