// Access Tauri API functions for v2
const {invoke} = window.__TAURI__.core;

// Import dialog functions using Tauri v2 plugin approach
// This is the correct way for Tauri v2
let open, save;

// Wait for Tauri to be ready before initializing dialog functions
async function initializeDialogAPI() {
    try {
        // In Tauri v2, dialog functions are available through window.__TAURI__.dialog
        // after the dialog plugin is properly loaded
        if (window.__TAURI__ && window.__TAURI__.dialog) {
            open = window.__TAURI__.dialog.open;
            save = window.__TAURI__.dialog.save;
            console.log('Dialog API initialized successfully');
        } else {
            console.warn('Dialog API not available, retrying...');
            // Retry after a short delay
            setTimeout(initializeDialogAPI, 100);
        }
    } catch (error) {
        console.error('Failed to initialize dialog API:', error);
        // Provide fallback functions
        open = () => Promise.reject(new Error('Tauri dialog API not available'));
        save = () => Promise.reject(new Error('Tauri dialog API not available'));
    }
}

// Initialize dialog APIs immediately
initializeDialogAPI();

// Convert file source utility
const convertFileSrc = window.__TAURI__.core.convertFileSrc || ((filePath) => {
    // Fallback if convertFileSrc is not available
    return filePath;
});

// Modal dialog
const sensorSelectionDialog = document.getElementById("sensor-selection-dialog");
const sensorSelectionTable = document.getElementById("sensor-selection-table");
const txtSensorSelectionTableFilterInput = document.getElementById("sensor-selection-table-filter-input");

// Main buttons
const btnExportConfig = document.getElementById("btn-export-config");
const btnImportConfig = document.getElementById("btn-import-config");
const panelKillSwitch = document.getElementById("kill-switch-input");
const btnActivateSync = document.getElementById("main-chk-transfer-active");

// Server configuration
const btnSaveServerConfig = document.getElementById("btn-save-server-config");

// Network Device Management
const cmbNetworkDevices = document.getElementById("cmb-network-devices");
const btnAddNetworkDevice = document.getElementById("btn-add-network-device");
const btnRemoveNetworkDevice = document.getElementById("btn-remove-network-device");
const btnRefreshNetworkDevices = document.getElementById("btn-refresh-network-devices");

// LCD designer
const txtDeviceName = document.getElementById("lcd-txt-device-name");
const txtWebServerPort = document.getElementById("lcd-txt-web-server-port");
const txtDisplayResolutionWidth = document.getElementById("lcd-txt-resolution-width");
const txtDisplayResolutionHeight = document.getElementById("lcd-txt-resolution-height");
const designerPane = document.getElementById("lcd-designer-pane");
const lstDesignerPlacedElements = document.getElementById("lcd-designer-placed-elements");
const btnMoveElementUp = document.getElementById("lcd-btn-move-element-up");
const btnMoveElementDown = document.getElementById("lcd-btn-move-element-down");
const btnAddElement = document.getElementById("lcd-btn-add-element");
const btnRemoveElement = document.getElementById("lcd-btn-remove-element");
const btnSaveElement = document.getElementById("lcd-btn-save-element");
const btnDuplicateElement = document.getElementById("lcd-btn-duplicate-element");

// Control pad
const btnControlPadUp = document.getElementById("lcd-btn-designer-control-pad-up");
const btnControlPadLeft = document.getElementById("lcd-btn-designer-control-pad-left");
const btnControlPadChangeMoveUnit = document.getElementById("lcd-btn-designer-control-pad-move-unit");
const btnControlPadRight = document.getElementById("lcd-btn-designer-control-pad-right");
const btnControlPadDown = document.getElementById("lcd-btn-designer-control-pad-down");

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

// Text
const cmbTextSensorIdSelection = document.getElementById("lcd-cmb-sensor-id-selection");
const btnTextSensorIdSelectionDialog = document.getElementById("lcd-text-config-btn-select-sensor-id");
const cmbTextSensorValueModifier = document.getElementById("lcd-cmb-sensor-value-modifier");
const txtTextFormat = document.getElementById("lcd-txt-element-text-format");
const btnTextFormatAddValue = document.getElementById("lcd-btn-add-value-placeholder");
const btnTextFormatAddUnit = document.getElementById("lcd-btn-add-unit-placeholder");
const btnTextFormatAddValueAvg = document.getElementById("lcd-btn-add-value-avg-placeholder");
const btnTextFormatAddValueMin = document.getElementById("lcd-btn-add-value-min-placeholder");
const btnTextFormatAddValueMax = document.getElementById("lcd-btn-add-value-max-placeholder");
const cmbTextFontFamily = document.getElementById("lcd-cmb-element-font-family");
const txtTextFontSize = document.getElementById("lcd-txt-element-font-size");
const txtTextFontColor = document.getElementById("lcd-txt-element-font-color");
const txtTextWidth = document.getElementById("lcd-txt-element-width");
const txtTextHeight = document.getElementById("lcd-txt-element-height");
const cmbTextAlignment = document.getElementById("lcd-cmb-element-text-alignment");

// Static image
const btnSelectStaticImage = document.getElementById("lcd-btn-static-image-select");
const txtStaticImageFile = document.getElementById("lcd-txt-element-static-image-file");
const txtStaticImageWidth = document.getElementById("lcd-txt-element-static-image-width");
const txtStaticImageHeight = document.getElementById("lcd-txt-element-static-image-height");

// Graph
const cmbGraphSensorIdSelection = document.getElementById("lcd-cmb-number-sensor-id-selection");
const btnGraphSensorIdSelectionDialog = document.getElementById("lcd-graph-config-btn-select-sensor-id");
const txtGraphMinValue = document.getElementById("lcd-txt-element-graph-min-value");
const txtGraphMaxValue = document.getElementById("lcd-txt-element-graph-max-value");
const txtGraphWidth = document.getElementById("lcd-graph-width");
const txtGraphHeight = document.getElementById("lcd-graph-height");
const cmbGraphType = document.getElementById("lcd-graph-type");
const txtGraphColor = document.getElementById("lcd-graph-color");
const txtGraphStrokeWidth = document.getElementById("lcd-graph-stroke-width");
const txtGraphBackgroundColor = document.getElementById("lcd-graph-background-color");
const txtGraphBorderColor = document.getElementById("lcd-graph-border-color");

// Conditional image
const cmbConditionalImageSensorIdSelection = document.getElementById("lcd-cmb-conditional-image-sensor-id-selection");
const btnConditionalImageSensorIdSelectionDialog = document.getElementById("lcd-conditional-image-config-btn-select-sensor-id");
const btnConditionalImagePathSelection = document.getElementById("lcd-btn-conditional-image-select");
const txtConditionalImageImagesPath = document.getElementById("lcd-txt-element-conditional-image-images-path");
const txtConditionalImageMinValue = document.getElementById("lcd-txt-element-conditional-image-min-value");
const txtConditionalImageMaxValue = document.getElementById("lcd-txt-element-conditional-image-max-value");
const txtConditionalImageWidth = document.getElementById("lcd-txt-element-conditional-image-width");
const txtConditionalImageHeight = document.getElementById("lcd-txt-element-conditional-image-height");
const btnConditionalImageInfo = document.getElementById("lcd-btn-conditional-image-info");
const cmbConditionalImageCatalogEntrySelection = document.getElementById("lcd-cmb-conditional-image-catalog-entry-selection");
const btnConditionalImageApplyCatalogEntry = document.getElementById("lcd-btn-conditional-apply-catalog-entry");

// Global variables
let sensorValues = [];
let selectedListElement = null;
let selectedDesignerElement = null;
let draggedLiElement;
let currentNetworkDeviceId = null;

// Global constants
const DESIGNER_ID_PREFIX = "designer-";
const LIST_ID_PREFIX = "list-";

// Element types
const ELEMENT_TYPE_TEXT = "text";
const ELEMENT_TYPE_STATIC_IMAGE = "static-image";
const ELEMENT_TYPE_GRAPH = "graph";
const ELEMENT_TYPE_CONDITIONAL_IMAGE = "conditional-image";

// Generic element attributes
const ATTR_ELEMENT_ID = "data-element-id";
const ATTR_ELEMENT_NAME = "data-element-name";
const ATTR_ELEMENT_TYPE = "data-element-type";
const ATTR_ELEMENT_POSITION_X = "data-element-position-x";
const ATTR_ELEMENT_POSITION_Y = "data-element-position-y";

// Text element attributes
const ATTR_TEXT_SENSOR_ID = "data-text-sensor-id";
const ATTR_TEXT_VALUE_MODIFIER = "data-text-value-modifier";
const ATTR_TEXT_FORMAT = "data-text-display-format";
const ATTR_TEXT_FONT_FAMILY = "data-text-font-family";
const ATTR_TEXT_FONT_SIZE = "data-text-text-font-size";
const ATTR_TEXT_FONT_COLOR = "data-text-font-color";
const ATTR_TEXT_WIDTH = "data-text-text-width";
const ATTR_TEXT_HEIGHT = "data-text-text-height";
const ATTR_TEXT_ALIGNMENT = "data-text-text-alignment";

// Graph element attributes
const ATTR_STATIC_IMAGE_PATH = "data-static-image-path";
const ATTR_STATIC_IMAGE_WIDTH = "data-static-image-width";
const ATTR_STATIC_IMAGE_HEIGHT = "data-static-image-height";

// Graph element attributes
const ATTR_GRAPH_SENSOR_ID = "data-graph-sensor-id";
const ATTR_GRAPH_MIN_VALUE = "data-graph-min-value";
const ATTR_GRAPH_MAX_VALUE = "data-graph-max-value";
const ATTR_GRAPH_WIDTH = "data-graph-width";
const ATTR_GRAPH_HEIGHT = "data-graph-height";
const ATTR_GRAPH_TYPE = "data-graph-type";
const ATTR_GRAPH_COLOR = "data-graph-color";
const ATTR_GRAPH_STROKE_WIDTH = "data-graph-stroke-width";
const ATTR_GRAPH_BACKGROUND_COLOR = "data-graph-background-color";
const ATTR_GRAPH_BORDER_COLOR = "data-graph-border-color";

// Conditional image element attributes
const ATTR_CONDITIONAL_IMAGE_SENSOR_ID = "data-conditional-image-sensor-id";
const ATTR_CONDITIONAL_IMAGE_IMAGES_PATH = "data-conditional-image-images-path";
const ATTR_CONDITIONAL_IMAGE_WIDTH = "data-conditional-image-width";
const ATTR_CONDITIONAL_IMAGE_HEIGHT = "data-conditional-image-height";
const ATTR_CONDITIONAL_IMAGE_MIN_VALUE = "data-conditional-image-min-value";
const ATTR_CONDITIONAL_IMAGE_MAX_VALUE = "data-conditional-image-max-value";
const ATTR_CONDITIONAL_IMAGE_REPO_URL = "data-conditional-image-repo-url";
const ATTR_CONDITIONAL_IMAGE_RESOLUTION = "data-conditional-image-resolution";

// Other attributes
const ATTR_MOVE_UNIT = "data-move-unit";

window.addEventListener("DOMContentLoaded", () => {
    // Configure color picker
    window.Coloris && (Coloris({
        theme: 'large',
        themeMode: 'dark',
        alpha: true,
        forceAlpha: true,
    }));

    // Register event for display resolution
    txtDisplayResolutionWidth.addEventListener("input", updateDisplayDesignPaneDimensions);
    txtDisplayResolutionHeight.addEventListener("input", updateDisplayDesignPaneDimensions);

    // Register event for element type
    cmbElementType.addEventListener("change", onElementTypeChange);

    // Register button click events
    btnSaveServerConfig.addEventListener("click", saveConfig);
    btnExportConfig.addEventListener("click", exportConfig);
    btnImportConfig.addEventListener("click", importConfig);
    btnSaveElement.addEventListener("click", saveElement);
    btnActivateSync.addEventListener("click", () => toggleSync(btnActivateSync.checked));
    btnAddElement.addEventListener("click", addNewElement);
    btnRemoveElement.addEventListener("click", removeElement);
    btnMoveElementUp.addEventListener("click", moveElementUp);
    btnMoveElementDown.addEventListener("click", moveElementDown);
    btnDuplicateElement.addEventListener("click", duplicateElement);

    // Network Device Management event listeners
    cmbNetworkDevices.addEventListener("change", onNetworkDeviceSelected);
    btnAddNetworkDevice.addEventListener("click", addNetworkDevice);
    btnRemoveNetworkDevice.addEventListener("click", removeNetworkDevice);
    btnRefreshNetworkDevices.addEventListener("click", refreshNetworkDevices);

    btnSelectStaticImage.addEventListener("click", selectStaticImage);
    btnConditionalImageInfo.addEventListener("click", showConditionalImageInfo);
    btnConditionalImagePathSelection.addEventListener("click", selectConditionalImage);
    btnControlPadChangeMoveUnit.addEventListener("click", changeMoveUnit);
    btnControlPadUp.addEventListener("click", () => moveElementControlPad("up"));
    btnControlPadLeft.addEventListener("click", () => moveElementControlPad("left"));
    btnControlPadRight.addEventListener("click", () => moveElementControlPad("right"));
    btnControlPadDown.addEventListener("click", () => moveElementControlPad("down"));
    btnTextSensorIdSelectionDialog.addEventListener("click", showSensorSelectionDialog);
    btnGraphSensorIdSelectionDialog.addEventListener("click", showSensorSelectionDialog);
    btnConditionalImageSensorIdSelectionDialog.addEventListener("click", showSensorSelectionDialog);
    btnConditionalImageApplyCatalogEntry.addEventListener("click", applyConditionalImageCatalogEntry);
    btnTextFormatAddValue.addEventListener("click", () => addTextFormatPlaceholder("{value}"));
    btnTextFormatAddUnit.addEventListener("click", () => addTextFormatPlaceholder("{unit}"));
    btnTextFormatAddValueAvg.addEventListener("click", () => addTextFormatPlaceholder("{value-avg}"));
    btnTextFormatAddValueMin.addEventListener("click", () => addTextFormatPlaceholder("{value-min}"));
    btnTextFormatAddValueMax.addEventListener("click", () => addTextFormatPlaceholder("{value-max}"));

    // Modal dialog handling
    sensorSelectionDialog.addEventListener("close", () => onCloseSensorSelectionDialog(sensorSelectionDialog.returnValue));

    // Register drag dropping
    designerPane.addEventListener('dragover', (event) => event.preventDefault());
    designerPane.addEventListener('drop', dropOnDesignerPane);

    // Initialize the application
    initializeApp();

    // Allow enter key down on sensor selection dialog to select first sensor
    sensorSelectionDialog.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            if (sensorSelectionTable.getElementsByTagName("tr").length > 1) {
                sensorSelectionDialog.close(sensorSelectionTable.getElementsByTagName("tr")[1].id);
            }
        }
    });

    // Register arrow key press event to move the selected element on the designer pane
    document.addEventListener("keydown", handleKeydownEvent);

    // Load system fonts
    loadSystemFonts().then(() => {
    });

    // Load repo entries
    loadConditionalImageRepoEntries();
});

// Applies the selected conditional image catalog entry to the current selected conditional image element
function applyConditionalImageCatalogEntry() {
    const selectedOption = cmbConditionalImageCatalogEntrySelection.options[cmbConditionalImageCatalogEntrySelection.selectedIndex];
    txtConditionalImageImagesPath.value = selectedOption.getAttribute(ATTR_CONDITIONAL_IMAGE_REPO_URL);
    let resolution = selectedOption.getAttribute(ATTR_CONDITIONAL_IMAGE_RESOLUTION).split("x");
    txtConditionalImageWidth.value = resolution[0];
    txtConditionalImageHeight.value = resolution[1];
}

function loadConditionalImageRepoEntries() {
    invoke('get_conditional_image_repo_entries').then((entries) => {
        JSON.parse(entries).forEach((entry) => {
            const entryName = entry.name;
            const entryUrl = entry.url;
            const entryResolution = entry.resolution;

            const option = document.createElement("option");
            option.value = entryName;
            option.innerText = entryName;
            option.setAttribute(ATTR_CONDITIONAL_IMAGE_REPO_URL, entryUrl);
            option.setAttribute(ATTR_CONDITIONAL_IMAGE_RESOLUTION, entryResolution);

            cmbConditionalImageCatalogEntrySelection.appendChild(option);
        });
    });
}

async function loadSystemFonts() {
    return invoke('get_system_fonts')
        .then((fonts) => {
            JSON.parse(fonts)
                .forEach((font) => {
                    const option = document.createElement("option");
                    option.value = font;
                    option.innerText = font;
                    option.style.fontFamily = font;
                    cmbTextFontFamily.appendChild(option);
                });
        });
}

function buildSensorSelectionDialogTable(filterValue) {
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
                if (sensorValue.label.toLowerCase().includes(keyword.toLowerCase()) || sensorValue.value.toLowerCase().includes(keyword.toLowerCase())) {
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

function showSensorSelectionDialog() {
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
    txtSensorSelectionTableFilterInput.addEventListener("input", () => buildSensorSelectionDialogTable(txtSensorSelectionTableFilterInput.value));
}

function onCloseSensorSelectionDialog(selectedSensorId) {
    if (selectedSensorId === "" || selectedSensorId === undefined || selectedSensorId === null) {
        return;
    }

    cmbTextSensorIdSelection.value = selectedSensorId;
    cmbGraphSensorIdSelection.value = selectedSensorId;
    cmbConditionalImageSensorIdSelection.value = selectedSensorId;
}

/// Exports the current config to a file the use can save on his computer
function exportConfig() {
    // Open a tauri dialog to let the user select a file to export to
    save({
        multiple: false,
        directory: false,
        filters: [{
            name: 'JSON',
            extensions: ['json'],
        }]
    }).then(
        (selected) => {
            // If the user selected a file, save the config to the file
            if (typeof selected === "string" && selected !== "") {
                invoke('export_config', {filePath: selected});
            } else {
                console.log("No file selected");
            }
        }
    );
}

/// Imports a config from a file the user can select
function importConfig() {
    // Open a tauri dialog to let the user select a file to import from
    open({
        multiple: false,
        directory: false,
        filters: [{
            name: 'JSON',
            extensions: ['json'],
        }]
    }).then(
        (selected) => {
            // If the user selected a file, load the config from the file
            if (typeof selected === "string" && selected !== "") {
                invoke('import_config', {filePath: selected}).then(
                    () => {
                        // Show yes no dialog, that a restart is required
                        confirm("The config was imported successfully. A restart is required to apply the changes. Do you want to restart now?")
                            .then((pressedOk) => {
                                if (pressedOk) {
                                    invoke('restart_app');
                                } else {
                                    initializeApp();
                                }
                            });
                    }
                ).catch((error) => {
                    alert("Error while importing config. " + error);
                })
            } else {
                console.log("No file selected");
            }
        }
    );
}

/// Moves the current selected element with the move unit of btnControlPadChangeMoveUnit
function moveElementControlPad(direction) {
    const moveUnit = parseInt(btnControlPadChangeMoveUnit.getAttribute(ATTR_MOVE_UNIT));

    // If the selected element is null, return
    if (!selectedDesignerElement || !selectedListElement) {
        return;
    }

    moveSelectedElementBy(moveUnit, direction);
}

/// Toggle move unit between: 1, 5, 25, 50
function changeMoveUnit() {
    let currentMoveUnit = btnControlPadChangeMoveUnit.getAttribute(ATTR_MOVE_UNIT);
    switch (currentMoveUnit) {
        case "1":
            btnControlPadChangeMoveUnit.setAttribute(ATTR_MOVE_UNIT, "5");
            btnControlPadChangeMoveUnit.innerText = "5px";
            break;
        case "5":
            btnControlPadChangeMoveUnit.setAttribute(ATTR_MOVE_UNIT, "25");
            btnControlPadChangeMoveUnit.innerText = "25px";
            break;
        case "25":
            btnControlPadChangeMoveUnit.setAttribute(ATTR_MOVE_UNIT, "50");
            btnControlPadChangeMoveUnit.innerText = "50px";
            break;
        case "50":
            btnControlPadChangeMoveUnit.setAttribute(ATTR_MOVE_UNIT, "1");
            btnControlPadChangeMoveUnit.innerText = "1px";
            break;
    }
}

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
                txtStaticImageFile.value = selected;
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
                txtConditionalImageImagesPath.value = selected;
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
        case ELEMENT_TYPE_TEXT:
            layoutTextConfig.style.display = "block";
            break;
        case ELEMENT_TYPE_STATIC_IMAGE:
            layoutStaticImageConfig.style.display = "block";
            break;
        case ELEMENT_TYPE_GRAPH:
            layoutGraphConfig.style.display = "block";
            break;
        case ELEMENT_TYPE_CONDITIONAL_IMAGE:
            layoutConditionalImageConfig.style.display = "block";
            break;
    }
}

// Removes the current selected network device
function removeNetworkDevice() {
    // Get selected net port id
    let networkDeviceId = currentNetworkDeviceId;

    // If net port id is empty, not set or null, return
    if (networkDeviceId === "" || networkDeviceId === null || networkDeviceId === undefined) {
        return;
    }

    // Remove network device from list
    let toRemove = document.getElementById(networkDeviceId);
    cmbNetworkPorts.removeChild(toRemove);

    // Remove net port from backend
    invoke('remove_network_device_config', {networkDeviceId: networkDeviceId}).then(() => {
            onNetDeviceSelected(cmbNetworkPorts.options[0]);
        }
    ).catch((error) => {
        alert("Error while removing network device. " + error);
    });
}

// Disables the device interaction
function disableDeviceInteraction() {
    lcdBasePanel.style.display = "none";
    btnSaveNetworkDevice.disabled = true;
    btnRemoveNetworkDevice.disabled = true;
    btnToggleLivePreview.disabled = true;
    btnExportConfig.disabled = true;
    panelKillSwitch.style.display = "none";
}

// Enables device interaction usually when a network device was selected
function enableDeviceInteraction() {
    lcdBasePanel.style.display = "block";
    btnSaveNetworkDevice.disabled = false;
    btnRemoveNetworkDevice.disabled = false;
    btnToggleLivePreview.disabled = false;
    btnExportConfig.disabled = false;
    panelKillSwitch.style.display = "block";
}

function createNetworkPort() {
    invoke('create_network_device_config')
        .then((networkDeviceId) => {
            // Set port id as constant
            currentNetworkDeviceId = networkDeviceId;

            // Load all device configs from config
            loadDeviceConfigs().then(() => {
                // Select new network device
                let liElement = document.getElementById(networkDeviceId);
                onNetDeviceSelected(liElement);
            });
        })
        .catch((error) => {
                alert("Error while creating a new network device. " + error);
            }
        );
}

async function loadDeviceConfigs() {
    // Load config from backend
    return invoke('get_app_config')
        .then((appConfig) => {
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
            onNetDeviceSelected(cmbNetworkPorts.options[0]);
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

// Builds the graph config from the list item attributes
function buildGraphConfigFromAttributes(listItem) {
    return {
        sensor_id: listItem.getAttribute(ATTR_GRAPH_SENSOR_ID),
        min_sensor_value: parseFloat(listItem.getAttribute(ATTR_GRAPH_MIN_VALUE)),
        max_sensor_value: parseFloat(listItem.getAttribute(ATTR_GRAPH_MAX_VALUE)),
        width: parseInt(listItem.getAttribute(ATTR_GRAPH_WIDTH)),
        height: parseInt(listItem.getAttribute(ATTR_GRAPH_HEIGHT)),
        graph_type: listItem.getAttribute(ATTR_GRAPH_TYPE),
        graph_color: listItem.getAttribute(ATTR_GRAPH_COLOR),
        graph_stroke_width: parseInt(listItem.getAttribute(ATTR_GRAPH_STROKE_WIDTH)),
        background_color: listItem.getAttribute(ATTR_GRAPH_BACKGROUND_COLOR),
        border_color: listItem.getAttribute(ATTR_GRAPH_BORDER_COLOR),
        sensor_values: [],
    };
}

// Builds the graph config values from the list item attributes
function buildConditionalImageConfigFromAttributes(listItem) {
    return {
        sensor_id: listItem.getAttribute(ATTR_CONDITIONAL_IMAGE_SENSOR_ID),
        sensor_value: "",
        images_path: listItem.getAttribute(ATTR_CONDITIONAL_IMAGE_IMAGES_PATH),
        min_sensor_value: parseInt(listItem.getAttribute(ATTR_CONDITIONAL_IMAGE_MIN_VALUE)),
        max_sensor_value: parseInt(listItem.getAttribute(ATTR_CONDITIONAL_IMAGE_MAX_VALUE)),
        width: parseInt(listItem.getAttribute(ATTR_CONDITIONAL_IMAGE_WIDTH)),
        height: parseInt(listItem.getAttribute(ATTR_CONDITIONAL_IMAGE_HEIGHT)),
    };
}

// Builds the graph config values from the list item attributes
function buildStaticImageConfigFromAttributes(listItem) {
    return {
        image_path: listItem.getAttribute(ATTR_STATIC_IMAGE_PATH),
        width: parseInt(listItem.getAttribute(ATTR_STATIC_IMAGE_WIDTH)),
        height: parseInt(listItem.getAttribute(ATTR_STATIC_IMAGE_HEIGHT)),
    };
}

// Builds the text config values from the list item attributes
function buildTextConfigFromAttributes(listItem) {
    return {
        sensor_id: listItem.getAttribute(ATTR_TEXT_SENSOR_ID),
        value_modifier: listItem.getAttribute(ATTR_TEXT_VALUE_MODIFIER),
        format: listItem.getAttribute(ATTR_TEXT_FORMAT),
        font_family: listItem.getAttribute(ATTR_TEXT_FONT_FAMILY),
        font_size: parseInt(listItem.getAttribute(ATTR_TEXT_FONT_SIZE)),
        font_color: listItem.getAttribute(ATTR_TEXT_FONT_COLOR),
        width: parseInt(listItem.getAttribute(ATTR_TEXT_WIDTH)),
        height: parseInt(listItem.getAttribute(ATTR_TEXT_HEIGHT)),
        alignment: listItem.getAttribute(ATTR_TEXT_ALIGNMENT),
    };
}

// Builds element config
function getElementConfig(listItem) {
    // Get element attributes
    const elementId = listItem.getAttribute(ATTR_ELEMENT_ID);
    const elementName = listItem.getAttribute(ATTR_ELEMENT_NAME);
    const elementType = listItem.getAttribute(ATTR_ELEMENT_TYPE);
    const elementX = parseInt(listItem.getAttribute(ATTR_ELEMENT_POSITION_X));
    const elementY = parseInt(listItem.getAttribute(ATTR_ELEMENT_POSITION_Y));

    let textConfig = null;
    let imageConfig = null;
    let graphConfig = null;
    let conditionalImageConfig = null;

    // Get element config depending on element type
    switch (elementType) {
        case ELEMENT_TYPE_TEXT:
            textConfig = buildTextConfigFromAttributes(listItem);
            break;
        case ELEMENT_TYPE_STATIC_IMAGE:
            imageConfig = buildStaticImageConfigFromAttributes(listItem);
            break;
        case ELEMENT_TYPE_GRAPH:
            graphConfig = buildGraphConfigFromAttributes(listItem);
            break;
        case ELEMENT_TYPE_CONDITIONAL_IMAGE:
            conditionalImageConfig = buildConditionalImageConfigFromAttributes(listItem);
            break;
    }

    // Build element config
    return {
        id: elementId,
        name: elementName,
        element_type: elementType,
        x: elementX,
        y: elementY,
        text_config: textConfig,
        image_config: imageConfig,
        graph_config: graphConfig,
        conditional_image_config: conditionalImageConfig,
    };
}

// Initialize the application for server mode
function initializeApp() {
    // Load network devices and display config
    loadNetworkDevices().then(() => {
        // Load sensor values
        loadSensorValues().then(() => {
            // Load display config for the selected device
            loadDisplayConfig();
        });
    }).catch((error) => {
        alert("Error while initializing application. " + error);
    });
}

// Load network devices configuration
function loadNetworkDevices() {
    return invoke('get_app_config').then((appConfigJson) => {
        const appConfig = JSON.parse(appConfigJson);

        // Clear devices dropdown
        cmbNetworkDevices.innerHTML = "";

        // Add default "no devices" option
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "No devices available";
        cmbNetworkDevices.appendChild(defaultOption);

        // Add network devices to dropdown
        const networkDevices = appConfig.network_devices;
        if (networkDevices && Object.keys(networkDevices).length > 0) {
            // Remove default option
            cmbNetworkDevices.removeChild(defaultOption);

            for (const deviceId in networkDevices) {
                const device = networkDevices[deviceId];
                addNetworkDeviceToDropdown(device.id, `${device.name} (Port: ${device.web_server_port})`);
            }

            // Select first device if available
            if (cmbNetworkDevices.options.length > 0) {
                cmbNetworkDevices.selectedIndex = 0;
                onNetworkDeviceSelected();
            }
        } else {
            // No devices available, disable controls
            disableDeviceControls();
        }
    }).catch((error) => {
        console.log("Error loading network devices:", error);
        disableDeviceControls();
    });
}

// Add network device to dropdown
function addNetworkDeviceToDropdown(id, displayName) {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = displayName;
    cmbNetworkDevices.appendChild(option);
}

// Handle network device selection from dropdown
function onNetworkDeviceSelected() {
    const selectedValue = cmbNetworkDevices.value;

    if (!selectedValue) {
        currentNetworkDeviceId = null;
        disableDeviceControls();
        return;
    }

    currentNetworkDeviceId = selectedValue;
    enableDeviceControls();

    // Load configuration for selected device
    invoke('get_network_device_config', {networkDeviceId: currentNetworkDeviceId}).then((configJson) => {
        const config = JSON.parse(configJson);

        // Update form fields
        txtDeviceName.value = config.name || '';
        txtWebServerPort.value = config.web_server_port || 8080;

        // Load display configuration
        loadDisplayConfig();
    }).catch((error) => {
        console.error("Error loading network device config:", error);
        alert("Error loading device configuration: " + error);
    });
}

// Add new network device
function addNetworkDevice() {
    invoke('create_network_device_config').then((deviceId) => {
        // Reload devices and select the new one
        loadNetworkDevices().then(() => {
            // Find and select the new device
            for (let i = 0; i < cmbNetworkDevices.options.length; i++) {
                if (cmbNetworkDevices.options[i].value === deviceId) {
                    cmbNetworkDevices.selectedIndex = i;
                    onNetworkDeviceSelected();
                    break;
                }
            }
        });
    }).catch((error) => {
        alert("Error creating new network device: " + error);
    });
}

// Remove current network device
function removeNetworkDevice() {
    if (!currentNetworkDeviceId) {
        alert("No device selected to remove.");
        return;
    }

    if (!confirm("Are you sure you want to remove this network device? This action cannot be undone.")) {
        return;
    }

    invoke('remove_network_device_config', {networkDeviceId: currentNetworkDeviceId}).then(() => {
        // Reload devices list
        loadNetworkDevices();
    }).catch((error) => {
        alert("Error removing network device: " + error);
    });
}

// Refresh network devices list
function refreshNetworkDevices() {
    loadNetworkDevices();
}

// Enable device controls when a device is selected
function enableDeviceControls() {
    txtDeviceName.disabled = false;
    txtWebServerPort.disabled = false;
    btnSaveServerConfig.disabled = false;
    btnRemoveNetworkDevice.disabled = false;
    btnActivateSync.disabled = false;

    // Enable LCD panel
    const lcdPanel = document.getElementById("lcd-panel");
    if (lcdPanel) {
        lcdPanel.style.opacity = "1";
        lcdPanel.style.pointerEvents = "auto";
    }
}

// Disable device controls when no device is selected
function disableDeviceControls() {
    txtDeviceName.disabled = true;
    txtWebServerPort.disabled = true;
    btnSaveServerConfig.disabled = true;
    btnRemoveNetworkDevice.disabled = true;
    btnActivateSync.disabled = true;

    // Clear form fields
    txtDeviceName.value = "";
    txtWebServerPort.value = "";

    // Disable LCD panel
    const lcdPanel = document.getElementById("lcd-panel");
    if (lcdPanel) {
        lcdPanel.style.opacity = "0.5";
        lcdPanel.style.pointerEvents = "none";
    }

    currentNetworkDeviceId = null;
}

// Save web server port and display configuration
function saveConfig() {
    if (!currentNetworkDeviceId) {
        alert("No network device selected.");
        return;
    }

    // Get display elements
    const lcdDesignerPlacedElementsListItemsArray = Array.from(lstDesignerPlacedElements.getElementsByTagName("li"));
    const displayElements = lcdDesignerPlacedElementsListItemsArray.map((listItem) => {
        return getElementConfig(listItem);
    });

    // Build display config object
    const displayConfig = {
        resolution_width: parseInt(txtDisplayResolutionWidth.value) || 240,
        resolution_height: parseInt(txtDisplayResolutionHeight.value) || 320,
        elements: displayElements,
    }

    // Save network device config using the correct backend API
    invoke('save_app_config', {
        networkDeviceId: currentNetworkDeviceId,
        name: txtDeviceName.value,
        active: btnActivateSync.checked,
        displayConfig: displayConfig,
    }).then(() => {
        console.log("Network device configuration saved successfully");
        // Show success feedback to user
        const saveButton = document.getElementById("btn-save-server-config");
        const originalTitle = saveButton.title;
        saveButton.title = "Configuration saved!";
        saveButton.style.color = "#4CAF50";

        // Update the dropdown display name
        const selectedOption = cmbNetworkDevices.options[cmbNetworkDevices.selectedIndex];
        if (selectedOption) {
            selectedOption.textContent = `${txtDeviceName.value} (Port: ${txtWebServerPort.value})`;
        }

        // Reset success indicator after 2 seconds
        setTimeout(() => {
            saveButton.title = originalTitle;
            saveButton.style.color = "";
        }, 2000);
    }).catch((error) => {
        console.error("Error saving network device configuration:", error);
        alert("Error saving network device configuration: " + error);
    });
}

// Update display design pane dimensions
function updateDisplayDesignPaneDimensions() {
    const width = parseInt(txtDisplayResolutionWidth.value) || 240;
    const height = parseInt(txtDisplayResolutionHeight.value) || 320;

    designerPane.style.width = width + "px";
    designerPane.style.height = height + "px";
    designerPane.style.border = "2px solid #ccc";
    designerPane.style.backgroundColor = "#f0f0f0";
}

// Show selected element details in the form
function showSelectedElementDetail() {
    if (!selectedListElement) {
        return;
    }

    // Update form with element details
    txtElementName.value = selectedListElement.getAttribute(ATTR_ELEMENT_NAME) || "";
    cmbElementType.value = selectedListElement.getAttribute(ATTR_ELEMENT_TYPE) || "text";
    txtElementPositionX.value = selectedListElement.getAttribute(ATTR_ELEMENT_POSITION_X) || "0";
    txtElementPositionY.value = selectedListElement.getAttribute(ATTR_ELEMENT_POSITION_Y) || "0";

    // Update element type specific fields
    onElementTypeChange();

    const elementType = cmbElementType.value;
    if (elementType === ELEMENT_TYPE_TEXT) {
        cmbTextSensorIdSelection.value = selectedListElement.getAttribute(ATTR_TEXT_SENSOR_ID) || "";
        cmbTextSensorValueModifier.value = selectedListElement.getAttribute(ATTR_TEXT_VALUE_MODIFIER) || "none";
        txtTextFormat.value = selectedListElement.getAttribute(ATTR_TEXT_FORMAT) || "{value} {unit}";
        cmbTextFontFamily.value = selectedListElement.getAttribute(ATTR_TEXT_FONT_FAMILY) || "Arial";
        txtTextFontSize.value = selectedListElement.getAttribute(ATTR_TEXT_FONT_SIZE) || "12";
        txtTextFontColor.value = selectedListElement.getAttribute(ATTR_TEXT_FONT_COLOR) || "#000000";
        txtTextWidth.value = selectedListElement.getAttribute(ATTR_TEXT_WIDTH) || "100";
        txtTextHeight.value = selectedListElement.getAttribute(ATTR_TEXT_HEIGHT) || "20";
        cmbTextAlignment.value = selectedListElement.getAttribute(ATTR_TEXT_ALIGNMENT) || "left";
    }
    // Add other element types as needed...
}

// Add text format placeholder to the text format input
function addTextFormatPlaceholder(placeholder) {
    if (txtTextFormat) {
        txtTextFormat.value += placeholder;
        txtTextFormat.focus();
    }
}

// Drag and drop functionality for designer pane
function dropOnDesignerPane(event) {
    event.preventDefault();
    // Implementation for dropping elements on designer pane
    console.log("Drop on designer pane functionality not fully implemented yet");
}

// List element drag functionality
function onListElementDragStart(event) {
    draggedLiElement = event.target;
}

function onListItemDragOver(event) {
    event.preventDefault();
}

function onListElementDrop(event) {
    event.preventDefault();
    // Implementation for reordering list elements
    console.log("List element reordering functionality not fully implemented yet");
}

// Element management functions
function moveElementUp() {
    if (!selectedListElement) {
        alert("Please select an element first.");
        return;
    }

    const previousElement = selectedListElement.previousElementSibling;
    if (previousElement) {
        lstDesignerPlacedElements.insertBefore(selectedListElement, previousElement);
    }
}

function moveElementDown() {
    if (!selectedListElement) {
        alert("Please select an element first.");
        return;
    }

    const nextElement = selectedListElement.nextElementSibling;
    if (nextElement) {
        lstDesignerPlacedElements.insertBefore(nextElement, selectedListElement);
    }
}

function removeElement() {
    if (!selectedListElement) {
        alert("Please select an element first.");
        return;
    }

    if (!confirm("Are you sure you want to remove this element?")) {
        return;
    }

    // Remove from designer pane
    if (selectedDesignerElement) {
        designerPane.removeChild(selectedDesignerElement);
    }

    // Remove from list
    lstDesignerPlacedElements.removeChild(selectedListElement);

    // Clear selection
    selectedListElement = null;
    selectedDesignerElement = null;
}

// Implement the missing functions referenced in the code
function addNewElement() {
    const elementId = generateUniqueElementId();
    const listId = LIST_ID_PREFIX + elementId;
    const designerId = DESIGNER_ID_PREFIX + elementId;
    const elementName = "New Element";

    // Create list element
    const listElement = document.createElement("li");
    listElement.id = listId;
    listElement.textContent = elementName;
    listElement.draggable = true;

    // Set attributes with default values
    listElement.setAttribute(ATTR_ELEMENT_ID, elementId);
    listElement.setAttribute(ATTR_ELEMENT_NAME, elementName);
    listElement.setAttribute(ATTR_ELEMENT_TYPE, ELEMENT_TYPE_TEXT);
    listElement.setAttribute(ATTR_ELEMENT_POSITION_X, "10");
    listElement.setAttribute(ATTR_ELEMENT_POSITION_Y, "10");

    // Set default text attributes
    listElement.setAttribute(ATTR_TEXT_SENSOR_ID, "");
    listElement.setAttribute(ATTR_TEXT_VALUE_MODIFIER, "none");
    listElement.setAttribute(ATTR_TEXT_FORMAT, "{value} {unit}");
    listElement.setAttribute(ATTR_TEXT_FONT_FAMILY, "Arial");
    listElement.setAttribute(ATTR_TEXT_FONT_SIZE, "12");
    listElement.setAttribute(ATTR_TEXT_FONT_COLOR, "#000000");
    listElement.setAttribute(ATTR_TEXT_WIDTH, "100");
    listElement.setAttribute(ATTR_TEXT_HEIGHT, "20");
    listElement.setAttribute(ATTR_TEXT_ALIGNMENT, "left");

    // Add event listeners
    listElement.addEventListener("click", () => setSelectedElement(listElement));
    listElement.addEventListener("dragstart", onListElementDragStart);
    listElement.addEventListener("dragover", onListItemDragOver);
    listElement.addEventListener("drop", onListElementDrop);

    // Create designer element
    const designerElement = document.createElement("div");
    designerElement.id = designerId;
    designerElement.className = "designer-element";
    designerElement.style.position = "absolute";
    designerElement.style.left = "10px";
    designerElement.style.top = "10px";
    designerElement.style.border = "1px solid #ccc";
    designerElement.style.padding = "2px";
    designerElement.style.backgroundColor = "rgba(255,255,255,0.8)";
    designerElement.style.cursor = "move";
    designerElement.style.minWidth = "50px";
    designerElement.style.minHeight = "20px";
    designerElement.textContent = elementName;
    designerElement.draggable = true;

    designerElement.addEventListener("click", () => setSelectedElement(listElement));
    designerElement.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData('text/plain', designerId);
        selectedListElement = listElement;
    });

    // Add elements to their containers
    lstDesignerPlacedElements.appendChild(listElement);
    designerPane.appendChild(designerElement);

    // Select the new element
    setSelectedElement(listElement);
}

function duplicateElement() {
    if (!selectedListElement) {
        alert("Please select an element first.");
        return;
    }

    const elementId = generateUniqueElementId();
    const listId = LIST_ID_PREFIX + elementId;
    const designerId = DESIGNER_ID_PREFIX + elementId;
    const elementName = selectedListElement.getAttribute(ATTR_ELEMENT_NAME) + " Copy";

    // Clone the selected list element
    const newListElement = selectedListElement.cloneNode(true);
    newListElement.id = listId;
    newListElement.textContent = elementName;
    newListElement.setAttribute(ATTR_ELEMENT_ID, elementId);
    newListElement.setAttribute(ATTR_ELEMENT_NAME, elementName);

    // Offset position slightly
    const currentX = parseInt(selectedListElement.getAttribute(ATTR_ELEMENT_POSITION_X)) || 0;
    const currentY = parseInt(selectedListElement.getAttribute(ATTR_ELEMENT_POSITION_Y)) || 0;
    newListElement.setAttribute(ATTR_ELEMENT_POSITION_X, currentX + 20);
    newListElement.setAttribute(ATTR_ELEMENT_POSITION_Y, currentY + 20);

    // Add event listeners
    newListElement.addEventListener("click", () => setSelectedElement(newListElement));
    newListElement.addEventListener("dragstart", onListElementDragStart);
    newListElement.addEventListener("dragover", onListItemDragOver);
    newListElement.addEventListener("drop", onListElementDrop);

    // Clone designer element
    const newDesignerElement = selectedDesignerElement.cloneNode(true);
    newDesignerElement.id = designerId;
    newDesignerElement.style.left = (currentX + 20) + "px";
    newDesignerElement.style.top = (currentY + 20) + "px";
    newDesignerElement.textContent = elementName;

    newDesignerElement.addEventListener("click", () => setSelectedElement(newListElement));
    newDesignerElement.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData('text/plain', designerId);
        selectedListElement = newListElement;
    });

    // Add elements to their containers
    lstDesignerPlacedElements.appendChild(newListElement);
    designerPane.appendChild(newDesignerElement);

    // Select the new element
    setSelectedElement(newListElement);
}

function toggleSync(active) {
    console.log("Toggle sync functionality - active:", active);
    // This would typically enable/disable real-time sync with the network device
    // Implementation depends on the backend sync mechanism
}
