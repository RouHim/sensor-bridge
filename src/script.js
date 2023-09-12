const {invoke, convertFileSrc} = window.__TAURI__.tauri;
const {open, save} = window.__TAURI__.dialog;

// Modal dialog
const sensorSelectionDialog = document.getElementById("sensor-selection-dialog");
const sensorSelectionTable = document.getElementById("sensor-selection-table");
const txtSensorSelectionTableFilterInput = document.getElementById("sensor-selection-table-filter-input");

// Network port selection
const cmbNetworkPorts = document.getElementById("main-network-ports-select");
const lcdBasePanel = document.getElementById("lcd-panel");

// Main buttons
const btnAddNetworkDevice = document.getElementById("btn-add-network-device");
const btnSaveNetworkDevice = document.getElementById("lcd-btn-save-network-device");
const btnToggleLivePreview = document.getElementById("btn-lcd-toggle-live-preview");
const btnRemoveNetworkDevice = document.getElementById("lcd-btn-remove-network-device");
const btnExportConfig = document.getElementById("btn-export-config");
const btnImportConfig = document.getElementById("btn-import-config");
const panelKillSwitch = document.getElementById("kill-switch-input");
const btnActivateSync = document.getElementById("main-chk-transfer-active");

// LCD designer
const txtDeviceName = document.getElementById("lcd-txt-device-name");
const txtDeviceNetworkAddress = document.getElementById("lcd-txt-device-network-address");
const txtDisplayResolutionWidth = document.getElementById("lcd-txt-resolution-width");
const txtDisplayResolutionHeight = document.getElementById("lcd-txt-resolution-height");
const designerPane = document.getElementById("lcd-designer-pane");
const lstDesignerPlacedElements = document.getElementById("lcd-designer-placed-elements");
const btnSaveElement = document.getElementById("lcd-btn-save-element");
const btnRemoveElement = document.getElementById("lcd-btn-remove-element");
const btnMoveElementUp = document.getElementById("lcd-btn-move-element-up");
const btnMoveElementDown = document.getElementById("lcd-btn-move-element-down");
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
const txtTextFormat = document.getElementById("lcd-txt-element-text-format");
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

    // Register on network device selected onNetDeviceSelected(liElement)
    cmbNetworkPorts.addEventListener("change", (event) => {
        onNetDeviceSelected(event.target.options[event.target.selectedIndex]);
    });

    // Register event for display resolution
    txtDisplayResolutionWidth.addEventListener("input", updateDisplayDesignPaneDimensions);
    txtDisplayResolutionHeight.addEventListener("input", updateDisplayDesignPaneDimensions);

    // Register event for element type
    cmbElementType.addEventListener("change", onElementTypeChange);

    // Register button click events
    btnAddNetworkDevice.addEventListener("click", createNetworkPort);
    btnRemoveNetworkDevice.addEventListener("click", removeNetworkDevice);
    btnExportConfig.addEventListener("click", exportConfig);
    btnImportConfig.addEventListener("click", importConfig);
    btnSaveNetworkDevice.addEventListener("click", onSave);
    btnSaveElement.addEventListener("click", onSave);
    btnActivateSync.addEventListener("click", () => toggleSync(btnActivateSync.checked));
    btnToggleLivePreview.addEventListener("click", toggleLivePreview);
    btnRemoveElement.addEventListener("click", removeElement);
    btnMoveElementUp.addEventListener("click", moveElementUp);
    btnMoveElementDown.addEventListener("click", moveElementDown);
    btnDuplicateElement.addEventListener("click", duplicateElement);
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

    // Modal dialog handling
    sensorSelectionDialog.addEventListener("close", () => onCloseSensorSelectionDialog(sensorSelectionDialog.returnValue));

    // If lost focus, check network config
    txtDeviceNetworkAddress.addEventListener("focusout", verifyNetworkAddress);

    // Register drag dropping
    designerPane.addEventListener('dragover', (event) => event.preventDefault());
    designerPane.addEventListener('drop', dropOnDesignerPane);

    // Load all devices from config
    loadDeviceConfigs().catch((error) => {
            alert("Error while loading device configs. " + error);
        }
    );

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
                                    loadDeviceConfigs()
                                        .catch((error) => {
                                                alert("Error while loading device configs. " + error);
                                            }
                                        )
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

function verifyNetworkAddress() {
    // Call backend to verify network address
    invoke('verify_network_address', {address: txtDeviceNetworkAddress.value}).then(
        (isValid) => {
            if (isValid) {
                txtDeviceNetworkAddress.classList.remove("invalid");
            } else {
                txtDeviceNetworkAddress.classList.add("invalid");
            }
        }
    );
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

function saveConfig() {
    // If net port id is empty, return
    if (currentNetworkDeviceId === "") {
        return;
    }

    // Get device name and network address
    // Find all list items of lcd-designer-placed-elements extract sensors and save them to the lcd config
    const lcdDesignerPlacedElementsListItemsArray = Array.from(lstDesignerPlacedElements.getElementsByTagName("li"));

    const displayElements = lcdDesignerPlacedElementsListItemsArray.map((listItem) => {
        return getElementConfig(listItem);
    });

    // Build lcd config object, with integers
    const displayConfig = {
        resolution_width: parseInt(txtDisplayResolutionWidth.value),
        resolution_height: parseInt(txtDisplayResolutionHeight.value),
        elements: displayElements,
    }

    invoke('save_app_config', {
        id: currentNetworkDeviceId,
        name: txtDeviceName.value,
        address: txtDeviceNetworkAddress.value,
        displayConfig: JSON.stringify(displayConfig),
    }).catch(
        (error) => {
            alert("Error while saving config. " + error);
        }
    )
}

// Selects the current network device and loads its config
function onNetDeviceSelected(element) {
    if (element === null || element === undefined) {
        disableDeviceInteraction();
        currentNetworkDeviceId = undefined;
        return;
    }

    enableDeviceInteraction();

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
            btnActivateSync.checked = portConfig.active;

            // Set as selected net port combobox
            cmbNetworkPorts.value = networkDeviceId;

            // Load sensor values
            loadSensorValues().then(() => {
                    // Load lcd config
                    loadDisplayConfig(networkDeviceId);
                }
            );
        }
    ).catch((error) => {
        alert("Error while loading config for network device id: " + networkDeviceId + ". " + error);
    });
}

// Toggles the sync for the selected net port
function toggleSync(checked) {
    if (checked) {
        invoke('enable_display', {networkDeviceId: currentNetworkDeviceId})
            .catch((error) => {
                alert("Error while enabling network device. " + error);
            });
    } else {
        invoke('disable_display', {networkDeviceId: currentNetworkDeviceId})
            .catch((error) => {
                alert("Error while disabling network device. " + error);
            });
    }
}


function toggleLivePreview() {
    invoke('show_lcd_live_preview', {networkDeviceId: currentNetworkDeviceId})
        .catch((error) => {
            alert("Error while showing live preview. " + error);
        });
}

function loadDisplayConfig(networkDeviceId) {
    invoke('get_network_device_config', {networkDeviceId: networkDeviceId}).then(
        (portConfig) => {
            // cast port config to json object
            portConfig = JSON.parse(portConfig);
            const displayConfig = portConfig.display_config;

            // Set display resolution
            txtDisplayResolutionWidth.value = displayConfig.resolution_width;
            txtDisplayResolutionHeight.value = displayConfig.resolution_height;

            // Clear designer pane
            designerPane.innerHTML = "";

            // Clear sensor list
            lstDesignerPlacedElements.innerHTML = "";

            // Add elements to designer pane and list
            // iterate elements with index
            displayConfig.elements.forEach((element, index) => {
                // Add element to list
                addElementToList(element.id, element.x, element.y, element.name, element.element_type, element.text_config, element.image_config, element.graph_config, element.conditional_image_config);

                // Add element to designer pane
                addElementToDesignerPane(index, element.id, element.element_type, element.x, element.y, element.text_config, element.image_config, element.graph_config, element.conditional_image_config);
            });

            // If there are elements, select the first one
            if (displayConfig.elements.length > 0) {
                setSelectedElement(document.querySelector("#lcd-designer-placed-elements li"));
            }

            // Update designer pane dimensions
            designerPane.style.width = displayConfig.resolution_width + "px";
            designerPane.style.height = displayConfig.resolution_height + "px";
        }
    )
}

function addElementToList(elementId, positionX, positionY, elementName, elementType, elementTextConfig, elementImageConfig, elementGraphConfig, elementConditionalImageConfig) {
    const liElement = document.createElement("li");

    // Element config
    liElement.id = LIST_ID_PREFIX + elementId;
    liElement.setAttribute(ATTR_ELEMENT_ID, elementId);
    liElement.setAttribute(ATTR_ELEMENT_NAME, elementName);
    liElement.setAttribute(ATTR_ELEMENT_TYPE, elementType);
    liElement.setAttribute(ATTR_ELEMENT_POSITION_X, positionX);
    liElement.setAttribute(ATTR_ELEMENT_POSITION_Y, positionY);

    // Text config
    if (elementType === ELEMENT_TYPE_TEXT) {
        liElement.setAttribute(ATTR_TEXT_SENSOR_ID, elementTextConfig.sensor_id);
        liElement.setAttribute(ATTR_TEXT_FORMAT, elementTextConfig.format);
        liElement.setAttribute(ATTR_TEXT_FONT_COLOR, elementTextConfig.font_color);
        liElement.setAttribute(ATTR_TEXT_FONT_FAMILY, elementTextConfig.font_family);
        liElement.setAttribute(ATTR_TEXT_FONT_SIZE, elementTextConfig.font_size);
        liElement.setAttribute(ATTR_TEXT_WIDTH, elementTextConfig.width);
        liElement.setAttribute(ATTR_TEXT_HEIGHT, elementTextConfig.height);
        liElement.setAttribute(ATTR_TEXT_ALIGNMENT, elementTextConfig.alignment);
    }

    // Image config
    if (elementType === ELEMENT_TYPE_STATIC_IMAGE) {
        liElement.setAttribute(ATTR_STATIC_IMAGE_PATH, elementImageConfig.image_path);
        liElement.setAttribute(ATTR_STATIC_IMAGE_WIDTH, elementImageConfig.width);
        liElement.setAttribute(ATTR_STATIC_IMAGE_HEIGHT, elementImageConfig.height);
    }

    // Graph config
    if (elementType === ELEMENT_TYPE_GRAPH) {
        liElement.setAttribute(ATTR_GRAPH_SENSOR_ID, elementGraphConfig.sensor_id);
        liElement.setAttribute(ATTR_GRAPH_MIN_VALUE, elementGraphConfig.min_sensor_value);
        liElement.setAttribute(ATTR_GRAPH_MAX_VALUE, elementGraphConfig.max_sensor_value);
        liElement.setAttribute(ATTR_GRAPH_WIDTH, elementGraphConfig.width);
        liElement.setAttribute(ATTR_GRAPH_HEIGHT, elementGraphConfig.height);
        liElement.setAttribute(ATTR_GRAPH_TYPE, elementGraphConfig.graph_type);
        liElement.setAttribute(ATTR_GRAPH_COLOR, elementGraphConfig.graph_color);
        liElement.setAttribute(ATTR_GRAPH_STROKE_WIDTH, elementGraphConfig.graph_stroke_width);
        liElement.setAttribute(ATTR_GRAPH_BACKGROUND_COLOR, elementGraphConfig.background_color);
        liElement.setAttribute(ATTR_GRAPH_BORDER_COLOR, elementGraphConfig.border_color);
    }

    // Conditional image config
    if (elementType === ELEMENT_TYPE_CONDITIONAL_IMAGE) {
        liElement.setAttribute(ATTR_CONDITIONAL_IMAGE_SENSOR_ID, elementConditionalImageConfig.sensor_id);
        liElement.setAttribute(ATTR_CONDITIONAL_IMAGE_IMAGES_PATH, elementConditionalImageConfig.images_path);
        liElement.setAttribute(ATTR_CONDITIONAL_IMAGE_MIN_VALUE, elementConditionalImageConfig.min_sensor_value);
        liElement.setAttribute(ATTR_CONDITIONAL_IMAGE_MAX_VALUE, elementConditionalImageConfig.max_sensor_value);
        liElement.setAttribute(ATTR_CONDITIONAL_IMAGE_WIDTH, elementConditionalImageConfig.width);
        liElement.setAttribute(ATTR_CONDITIONAL_IMAGE_HEIGHT, elementConditionalImageConfig.height);
    }

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
        designerElement.addEventListener("click", event => setSelectedElement(event.target));
        designerElement.addEventListener('dragstart', onListElementDragStart);
        designerElement.addEventListener('dragover', onListItemDragOver);
        designerElement.addEventListener('drop', onListElementDrop);
    });

    // Set selected sensor list element
    selectedListElement = liElement;
}

function loadSensorValues() {
    return invoke('get_sensor_values').then(
        (loadedSensors) => {
            // cast sensor values to json object
            sensorValues = JSON.parse(loadedSensors);

            // Add sensor values to the sensor value combo box
            cmbTextSensorIdSelection.innerHTML = sensorValues.map(
                (sensorValue) => `<option value="${sensorValue.id}" data-unit="${sensorValue.unit}" title="${sensorValue.value}">${sensorValue.label}</option>`
            ).join("");

            // Add sensor values to cmbConditionalImageSensorIdSelection
            cmbConditionalImageSensorIdSelection.innerHTML = sensorValues.map(
                (sensorValue) => `<option value="${sensorValue.id}" data-unit="${sensorValue.unit}" title="${sensorValue.value}">${sensorValue.label}</option>`
            ).join("");

            // Filter out only number sensors and add them to cmbNumberSensorIdSelection
            cmbGraphSensorIdSelection.innerHTML = sensorValues.filter(
                (sensorValue) => sensorValue.sensor_type === "number"
            ).map(
                (sensorValue) => `<option value="${sensorValue.id}" data-unit="${sensorValue.unit}" title="${sensorValue.value}">${sensorValue.label}</option>`
            ).join("");
        }
    );
}

// Sets the selected element
function setSelectedElement(listHtmlElement) {
    // If elementId is undefined or null, return
    if (!listHtmlElement || !listHtmlElement.id) {
        console.log("Element id is undefined or null");
        return;
    }

    let elementId = listHtmlElement.id;

    // Remove prefix xyz- including the minus from the id
    elementId = elementId.substring(elementId.indexOf("-") + 1);

    selectedListElement = document.getElementById(LIST_ID_PREFIX + elementId);
    selectedDesignerElement = document.getElementById(DESIGNER_ID_PREFIX + elementId);

    // Remove the border from all designer elements
    Array.from(designerPane.children).forEach((child) => {
        child.style.border = "none";
    });

    // Add a border to the selected designer element
    selectedDesignerElement.style.border = "1px solid var(--selection)";

    // Set background color of the selected element to --background
    selectedListElement.style.backgroundColor = "var(--selection)";

    // Set background color of all other li elements to transparent
    Array.from(lstDesignerPlacedElements.children).forEach(
        (child) => {
            if (child.id !== selectedListElement.id) {
                child.style.backgroundColor = "var(--background)";
            }
        }
    );

    // Show the element details of the selected element
    showSelectedElementDetail();
}

// Handles the keydown events on application level
function handleKeydownEvent(event) {
    if (event.ctrlKey && event.key === "Delete") {
        event.preventDefault();
        removeElement();
        return;
    }
    if (event.ctrlKey && event.key === "s") {
        event.preventDefault();
        onSave();
        return;
    }
    if (event.ctrlKey && event.key === "d") {
        event.preventDefault();
        duplicateElement();
        return;
    }
    if (event.ctrlKey && event.key === "ArrowUp") {
        event.preventDefault();
        moveElementUp();
        return;
    }
    if (event.ctrlKey && event.key === "ArrowDown") {
        event.preventDefault();
        moveElementDown();
        return;
    }
    if (event.altKey && event.key === "ArrowUp") {
        event.preventDefault();
        selectPreviousElement();
        return;
    }
    if (event.altKey && event.key === "ArrowDown") {
        event.preventDefault();
        selectNextElement();
        return;
    }

    handleArrowKeydownEvent(event);
}

// Duplicate the selected element
function duplicateElement() {
    // If the selected element is null, return
    if (!selectedDesignerElement || !selectedListElement) {
        return;
    }

    // save the selected element with a new name ( + " Copy")
    txtElementName.value = txtElementName.value + " Copy";
    const calculatedId = txtElementName.value.replace(" ", "-").toLowerCase();

    createElement(calculatedId);
}

// Selects the previous element in the list
function selectPreviousElement() {
    // If the selected element is null, return
    if (!selectedDesignerElement || !selectedListElement) {
        return;
    }

    // Get the previous element
    let previousElement = selectedListElement.previousElementSibling;

    // If the previous element is null, return
    if (!previousElement) {
        return;
    }

    // Select the previous element
    setSelectedElement(previousElement);
}

// Selects the next element in the list
function selectNextElement() {
    // If the selected element is null, return
    if (!selectedDesignerElement || !selectedListElement) {
        return;
    }

    // Get the next element
    let nextElement = selectedListElement.nextElementSibling;

    // If the next element is null, return
    if (!nextElement) {
        return;
    }

    // Select the next element
    setSelectedElement(nextElement);
}

// Handles the arrow keydown events on application level
function handleArrowKeydownEvent(event) {
    // Check if the arrow keys are pressed
    const isArrowUpPressed = event.key === "ArrowUp";
    const isArrowDownPressed = event.key === "ArrowDown";
    const isArrowLeftPressed = event.key === "ArrowLeft";
    const isArrowRightPressed = event.key === "ArrowRight";

    // Check if the user pressed an arrow key
    if (isArrowUpPressed || isArrowDownPressed || isArrowLeftPressed || isArrowRightPressed) {
        // If target is an input element, prevent moving an designer element by keyboard
        if (event.target.tagName === "INPUT") {
            return;
        }

        // If target is body then prevent default
        if (event.target.tagName === "BODY") {
            event.preventDefault();
        }

        const direction = event.key.replace("Arrow", "").toLowerCase();
        const moveBy = parseInt(btnControlPadChangeMoveUnit.getAttribute(ATTR_MOVE_UNIT));
        moveSelectedElementBy(moveBy, direction);
    }
}

// Moves the selected element by the specified number in the specified direction
function moveSelectedElementBy(moveBy, direction) {
    // Get the current position of the selected element
    let xPos = parseInt(selectedDesignerElement.style.left);
    let yPos = parseInt(selectedDesignerElement.style.top);

    // Move the selected element by the given number
    switch (direction) {
        case "up":
            yPos -= moveBy;
            break;
        case "down":
            yPos += moveBy;
            break;
        case "left":
            xPos -= moveBy;
            break;
        case "right":
            xPos += moveBy;
            break;
    }

    // Check if the element is out of bounds
    if (xPos < 0) {
        xPos = 0;
    }
    if (yPos < 0) {
        yPos = 0;
    }
    if (xPos > designerPane.clientWidth - selectedDesignerElement.clientWidth) {
        xPos = designerPane.clientWidth - selectedDesignerElement.clientWidth;
    }
    if (yPos > designerPane.clientHeight - selectedDesignerElement.clientHeight) {
        yPos = designerPane.clientHeight - selectedDesignerElement.clientHeight;
    }

    // Update the position of the selected element
    txtElementPositionX.value = xPos;
    txtElementPositionY.value = yPos;

    // Update the position of the selected element in the designer
    selectedDesignerElement.style.left = xPos + "px";
    selectedDesignerElement.style.top = yPos + "px";

    // Update the position of the selected element in the list
    selectedListElement.setAttribute(ATTR_ELEMENT_POSITION_X, xPos);
    selectedListElement.setAttribute(ATTR_ELEMENT_POSITION_Y, yPos);
}

// Updates the element details of the selected element
function updateElement(calculatedId) {
    // Update element in the list
    let listEntryElement = document.getElementById(LIST_ID_PREFIX + calculatedId);

    // Update element config
    listEntryElement.setAttribute(ATTR_ELEMENT_ID, calculatedId);
    listEntryElement.setAttribute(ATTR_ELEMENT_NAME, txtElementName.value);
    listEntryElement.setAttribute(ATTR_ELEMENT_TYPE, cmbElementType.value);
    listEntryElement.setAttribute(ATTR_ELEMENT_POSITION_X, txtElementPositionX.value);
    listEntryElement.setAttribute(ATTR_ELEMENT_POSITION_Y, txtElementPositionY.value);

    // Text config
    if (cmbElementType.value === ELEMENT_TYPE_TEXT) {
        listEntryElement.setAttribute(ATTR_TEXT_SENSOR_ID, cmbTextSensorIdSelection.value);
        listEntryElement.setAttribute(ATTR_TEXT_FORMAT, txtTextFormat.value);
        listEntryElement.setAttribute(ATTR_TEXT_FONT_FAMILY, cmbTextFontFamily.value);
        listEntryElement.setAttribute(ATTR_TEXT_FONT_SIZE, txtTextFontSize.value);
        listEntryElement.setAttribute(ATTR_TEXT_FONT_COLOR, txtTextFontColor.value);
        listEntryElement.setAttribute(ATTR_TEXT_WIDTH, txtTextWidth.value);
        listEntryElement.setAttribute(ATTR_TEXT_HEIGHT, txtTextHeight.value);
        listEntryElement.setAttribute(ATTR_TEXT_ALIGNMENT, cmbTextAlignment.value);
    }

    // Image config
    if (cmbElementType.value === ELEMENT_TYPE_STATIC_IMAGE) {

        listEntryElement.setAttribute(ATTR_STATIC_IMAGE_PATH, txtStaticImageFile.value);
        listEntryElement.setAttribute(ATTR_STATIC_IMAGE_WIDTH, txtStaticImageWidth.value);
        listEntryElement.setAttribute(ATTR_STATIC_IMAGE_HEIGHT, txtStaticImageHeight.value);
    }

    // Graph config
    if (cmbElementType.value === ELEMENT_TYPE_GRAPH) {
        listEntryElement.setAttribute(ATTR_GRAPH_SENSOR_ID, cmbGraphSensorIdSelection.value);
        listEntryElement.setAttribute(ATTR_GRAPH_MIN_VALUE, txtGraphMinValue.value);
        listEntryElement.setAttribute(ATTR_GRAPH_MAX_VALUE, txtGraphMaxValue.value);
        listEntryElement.setAttribute(ATTR_GRAPH_WIDTH, txtGraphWidth.value);
        listEntryElement.setAttribute(ATTR_GRAPH_HEIGHT, txtGraphHeight.value);
        listEntryElement.setAttribute(ATTR_GRAPH_TYPE, cmbGraphType.value);
        listEntryElement.setAttribute(ATTR_GRAPH_COLOR, txtGraphColor.value);
        listEntryElement.setAttribute(ATTR_GRAPH_STROKE_WIDTH, txtGraphStrokeWidth.value);
        listEntryElement.setAttribute(ATTR_GRAPH_BACKGROUND_COLOR, txtGraphBackgroundColor.value);
        listEntryElement.setAttribute(ATTR_GRAPH_BORDER_COLOR, txtGraphBorderColor.value);
    }

    // Conditional image config
    if (cmbElementType.value === ELEMENT_TYPE_CONDITIONAL_IMAGE) {
        listEntryElement.setAttribute(ATTR_CONDITIONAL_IMAGE_SENSOR_ID, cmbConditionalImageSensorIdSelection.value);
        listEntryElement.setAttribute(ATTR_CONDITIONAL_IMAGE_IMAGES_PATH, txtConditionalImageImagesPath.value);
        listEntryElement.setAttribute(ATTR_CONDITIONAL_IMAGE_MIN_VALUE, txtConditionalImageMinValue.value);
        listEntryElement.setAttribute(ATTR_CONDITIONAL_IMAGE_MAX_VALUE, txtConditionalImageMaxValue.value);
        listEntryElement.setAttribute(ATTR_CONDITIONAL_IMAGE_WIDTH, txtConditionalImageWidth.value);
        listEntryElement.setAttribute(ATTR_CONDITIONAL_IMAGE_HEIGHT, txtConditionalImageHeight.value);
    }

    listEntryElement.innerHTML = txtElementName.value;

    // Update element in the designer
    let designerElement = document.getElementById(DESIGNER_ID_PREFIX + calculatedId);
    designerElement.style.left = txtElementPositionX.value + "px";
    designerElement.style.top = txtElementPositionY.value + "px";

    switch (cmbElementType.value) {
        default:
        case ELEMENT_TYPE_TEXT:
            designerElement.style.width = txtTextWidth.value + "px";
            designerElement.style.height = txtTextHeight.value + "px";
            invoke('get_text_preview_image', {
                imageWidth: parseInt(txtDisplayResolutionWidth.value),
                imageHeight: parseInt(txtDisplayResolutionHeight.value),
                textConfig: buildTextConfigFromAttributes(listEntryElement)
            })
                .then(response => {
                    designerElement.src = "data:image/png;base64," + response;
                })
            break;
        case ELEMENT_TYPE_STATIC_IMAGE:
            designerElement.style.width = txtStaticImageWidth.value + "px";
            designerElement.style.height = txtStaticImageHeight.value + "px";
            designerElement.src = toTauriAssetPath(txtStaticImageFile.value);
            break;
        case ELEMENT_TYPE_GRAPH:
            designerElement.style.width = txtGraphWidth.value + "px";
            designerElement.style.height = txtGraphHeight.value + "px";
            invoke('get_graph_preview_image', {
                graphConfig: buildGraphConfigFromAttributes(listEntryElement)
            })
                .then(response => {
                    designerElement.src = "data:image/png;base64," + response;
                })
            break;
        case ELEMENT_TYPE_CONDITIONAL_IMAGE:
            designerElement.style.width = txtConditionalImageWidth.value + "px";
            designerElement.style.height = txtConditionalImageHeight.value + "px";
            invoke('get_conditional_image_preview_image', {
                elementId: calculatedId,
                conditionalImageConfig: buildConditionalImageConfigFromAttributes(listEntryElement)
            })
                .then(response => {
                    designerElement.src = "data:image/png;base64," + response;
                })
            break;
    }
}

function addElementToDesignerPane(zIndex, elementId, sensorType, positionX, positionY, elementTextConfig, elementImageConfig, elementGraphConfig, elementConditionalImageConfig) {
    let designerElement;
    switch (sensorType) {
        default:
        case ELEMENT_TYPE_TEXT:
            designerElement = document.createElement("img");
            designerElement.style.height = elementTextConfig.font_size + "px";

            invoke('get_text_preview_image', {
                imageWidth: parseInt(txtDisplayResolutionWidth.value),
                imageHeight: parseInt(txtDisplayResolutionHeight.value),
                textConfig: buildTextConfigFromAttributes(selectedListElement)
            }).then(response => {
                designerElement.src = "data:image/png;base64," + response;
            })
            break;
        case ELEMENT_TYPE_STATIC_IMAGE:
            designerElement = document.createElement("img");

            designerElement.style.width = elementImageConfig.width + "px";
            designerElement.style.height = elementImageConfig.height + "px";
            designerElement.src = toTauriAssetPath(elementImageConfig.image_path);
            break;
        case ELEMENT_TYPE_GRAPH:
            designerElement = document.createElement("img");

            designerElement.style.width = elementGraphConfig.width + "px";
            designerElement.style.height = elementGraphConfig.height + "px";
            invoke('get_graph_preview_image', {
                networkDeviceId: currentNetworkDeviceId,
                graphConfig: buildGraphConfigFromAttributes(selectedListElement)
            }).then(response => {
                designerElement.src = "data:image/png;base64," + response;
            })
            break;
        case ELEMENT_TYPE_CONDITIONAL_IMAGE:
            designerElement = document.createElement("img");

            designerElement.style.width = elementConditionalImageConfig.width + "px";
            designerElement.style.height = elementConditionalImageConfig.height + "px";
            invoke('get_conditional_image_preview_image', {
                elementId: elementId,
                conditionalImageConfig: buildConditionalImageConfigFromAttributes(selectedListElement),
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

    // Set selected element to the new element
    selectedDesignerElement = designerElement;
}

// Converts an absolute file path, to a tauri compatible path using https://tauri.app/v1/api/js/tauri/#convertfilesrc
// If the image path is a http or https url, it will be returned as is
function toTauriAssetPath(image_path) {
    if (image_path.startsWith("http://") || image_path.startsWith("https://")) {
        return image_path;
    }

    return convertFileSrc(image_path);
}

function validateUi() {
    // Device config
    if (txtDeviceName.value === "") {
        alert("Please enter a name for the device.");
        return false;
    }
    if (txtDeviceNetworkAddress.value === "") {
        alert("Please enter a network address for the device.");
        return false;
    }
    // resolution
    if (txtDisplayResolutionWidth.value === "") {
        alert("Please enter a resolution width for the device.");
        return false;
    }
    if (txtDisplayResolutionHeight.value === "") {
        alert("Please enter a resolution height for the device.");
        return false;
    }

    // Element config
    if (txtElementName.value === "") {
        alert("Please enter a name for the element.");
        return false;
    }
    if (txtElementPositionX.value === "" || isNaN(txtElementPositionX.value)) {
        alert("Please enter a position X for the element.");
        return false;
    }
    if (txtElementPositionY.value === "" || isNaN(txtElementPositionY.value)) {
        alert("Please enter a position Y for the element.");
        return false;
    }

    // Text config
    if (cmbElementType.value === ELEMENT_TYPE_TEXT) {
        if (txtTextWidth.value === "" || isNaN(txtTextWidth.value)) {
            alert("Please enter a width for the text element.");
            return false;
        }
        if (txtTextHeight.value === "" || isNaN(txtTextHeight.value)) {
            alert("Please enter a height for the text element.");
            return false;
        }
        if (txtTextFontSize.value === "" || isNaN(txtTextFontSize.value)) {
            alert("Please enter a font size for the text element.");
            return false;
        }
        if (!/^#[0-9A-F]{8}$/i.test(txtTextFontColor.value)) {
            alert("Please enter a valid font color for the text element.");
            return false;
        }
        if (cmbTextFontFamily.value === "") {
            alert("Please select a font family for the text element.");
            return false;
        }
        if (cmbTextAlignment.value === "") {
            alert("Please select an alignment for the text element.");
            return false;
        }
    }

    // Static image
    if (cmbElementType.value === ELEMENT_TYPE_STATIC_IMAGE) {
        if (txtStaticImageFile.value === "") {
            alert("Please select a static image for the static image element.");
            return false;
        }
        // ensure txtElementStaticImageWidth and txtElementStaticImageHeight are numbers
        if (txtStaticImageWidth.value === "" || isNaN(txtStaticImageWidth.value)) {
            alert("Please enter a width for the static image element.");
            return false;
        }
        if (txtStaticImageHeight.value === "" || isNaN(txtStaticImageHeight.value)) {
            alert("Please enter a height for the static image element.");
            return false;
        }
    }

    // graph
    if (cmbElementType.value === ELEMENT_TYPE_GRAPH) {
        if (txtGraphWidth.value === "" || isNaN(txtGraphWidth.value)) {
            alert("Please enter a width for the graph element.");
            return false;
        }
        if (txtGraphHeight.value === "" || isNaN(txtGraphHeight.value)) {
            alert("Please enter a height for the graph element.");
            return false;
        }
        if (cmbGraphType.value === "") {
            alert("Please select a type for the graph element.");
            return false;
        }
        if (!/^#[0-9A-F]{8}$/i.test(txtGraphColor.value)) {
            alert("Please enter a valid color for the graph element.");
            return false;
        }
        if (txtGraphStrokeWidth.value === "" || isNaN(txtGraphStrokeWidth.value)) {
            alert("Please enter a stroke width for the graph element.");
            return false;
        }
        if (!/^#[0-9A-F]{8}$/i.test(txtGraphBackgroundColor.value)) {
            alert("Please enter a valid background color for the graph element.");
            return false;
        }
        if (!/^#[0-9A-F]{8}$/i.test(txtGraphBorderColor.value)) {
            alert("Please enter a valid border color for the graph element.");
            return false;
        }

    }

    // conditional image
    if (cmbElementType.value === ELEMENT_TYPE_CONDITIONAL_IMAGE) {
        if (cmbConditionalImageSensorIdSelection.value === "") {
            alert("Please select a sensor for the conditional image element.");
            return false;
        }
        if (txtConditionalImageImagesPath.value === "") {
            alert("Please enter a path for the conditional image element.");
            return false;
        }
        if (txtConditionalImageMinValue.value === "" || isNaN(txtConditionalImageMinValue.value)) {
            alert("Please enter a minimum value for the conditional image element.");
            return false;
        }
        if (txtConditionalImageMaxValue.value === "" || isNaN(txtConditionalImageMaxValue.value)) {
            alert("Please enter a maximum value for the conditional image element.");
            return false;
        }
        if (txtConditionalImageWidth.value === "" || isNaN(txtConditionalImageWidth.value)) {
            alert("Please enter a width for the conditional image element.");
            return false;
        }
        if (txtConditionalImageHeight.value === "" || isNaN(txtConditionalImageHeight.value)) {
            alert("Please enter a height for the conditional image element.");
            return false;
        }
    }


    return true;
}

// Creates a new element
function createElement(calculatedId) {
    // Read generic element values
    const elementName = txtElementName.value;
    const elementType = cmbElementType.value;
    const positionX = txtElementPositionX.value;
    const positionY = txtElementPositionY.value;

    let textConfig = {
        sensor_id: cmbTextSensorIdSelection.value,
        format: txtTextFormat.value,
        font_family: cmbTextFontFamily.value,
        font_size: txtTextFontSize.value,
        font_color: txtTextFontColor.value,
        width: txtTextWidth.value,
        height: txtTextHeight.value,
        alignment: cmbTextAlignment.value,
    }

    // build image config object
    let imageConfig = {
        width: txtStaticImageWidth.value,
        height: txtStaticImageHeight.value,
        image_path: txtStaticImageFile.value,
    }

    // build graph config object
    let graphConfig = {
        sensor_id: cmbGraphSensorIdSelection.value,
        min_sensor_value: txtGraphMinValue.value,
        max_sensor_value: txtGraphMaxValue.value,
        width: txtGraphWidth.value,
        height: txtGraphHeight.value,
        graph_type: cmbGraphType.value,
        graph_color: txtGraphColor.value,
        graph_stroke_width: txtGraphStrokeWidth.value,
        background_color: txtGraphBackgroundColor.value,
        border_color: txtGraphBorderColor.value,
    }

    // build conditional image config object
    let conditionalImageConfig = {
        sensor_id: cmbConditionalImageSensorIdSelection.value,
        images_path: txtConditionalImageImagesPath.value,
        min_sensor_value: txtConditionalImageMinValue.value,
        max_sensor_value: txtConditionalImageMaxValue.value,
        width: txtConditionalImageWidth.value,
        height: txtConditionalImageHeight.value,
    }

    // Create new li element
    addElementToList(calculatedId, positionX, positionY, elementName, elementType, textConfig, imageConfig, graphConfig, conditionalImageConfig);

    // Build designer element
    const index = lstDesignerPlacedElements.childElementCount;
    addElementToDesignerPane(index, calculatedId, elementType, positionX, positionY, textConfig, imageConfig, graphConfig, conditionalImageConfig);

    // Set the new li element as selected
    setSelectedElement(document.getElementById(LIST_ID_PREFIX + calculatedId));
}

function onSave() {
    if (!validateUi()) {
        return;
    }

    const calculatedId = txtElementName.value.replace(" ", "-").toLowerCase();

    // Check if element is already exists, if so, update the sensor
    if (document.getElementById(LIST_ID_PREFIX + calculatedId) !== null) {
        updateElement(calculatedId);
    } else {
        createElement(calculatedId);
    }

    // Update the device name in list
    let deviceNameElement = document.getElementById(currentNetworkDeviceId);
    deviceNameElement.innerText = txtDeviceName.value;

    // Writes config to backend
    saveConfig();
}

// Removes the selected element from the designer
function removeElement() {
    if (selectedListElement === null) {
        alert("Please select a element first.");
        return;
    }

    // Check if element exists in designer
    if (selectedDesignerElement === null) {
        alert("Please select a element first.");
        return;
    }

    // Determine the list index of the selected element in the lstDesignerPlacedElements
    const i = Array.from(lstDesignerPlacedElements.children).indexOf(selectedListElement);

    // Remove element from list
    lstDesignerPlacedElements.removeChild(selectedListElement);

    // Remove element from designer
    designerPane.removeChild(selectedDesignerElement);

    // Select the previous element in the list of the selected element
    setSelectedElement(lstDesignerPlacedElements.children[i - 1]);
}

function showSelectedElementDetail() {
    // Generic
    txtElementName.value = selectedListElement.getAttribute(ATTR_ELEMENT_NAME);
    cmbElementType.value = selectedListElement.getAttribute(ATTR_ELEMENT_TYPE);
    txtElementPositionX.value = selectedListElement.getAttribute(ATTR_ELEMENT_POSITION_X);
    txtElementPositionY.value = selectedListElement.getAttribute(ATTR_ELEMENT_POSITION_Y);
    onElementTypeChange();

    // Text
    if (cmbElementType.value === ELEMENT_TYPE_TEXT) {
        cmbTextSensorIdSelection.value = selectedListElement.getAttribute(ATTR_TEXT_SENSOR_ID);
        txtTextFormat.value = selectedListElement.getAttribute(ATTR_TEXT_FORMAT);
        cmbTextFontFamily.value = selectedListElement.getAttribute(ATTR_TEXT_FONT_FAMILY);
        txtTextFontSize.value = selectedListElement.getAttribute(ATTR_TEXT_FONT_SIZE);
        txtTextFontColor.value = selectedListElement.getAttribute(ATTR_TEXT_FONT_COLOR);
        txtTextFontColor.dispatchEvent(new Event('input', {bubbles: true}));
        txtTextWidth.value = selectedListElement.getAttribute(ATTR_TEXT_WIDTH);
        txtTextHeight.value = selectedListElement.getAttribute(ATTR_TEXT_HEIGHT);
        cmbTextAlignment.value = selectedListElement.getAttribute(ATTR_TEXT_ALIGNMENT);
    }

    // Static image
    if (cmbElementType.value === ELEMENT_TYPE_STATIC_IMAGE) {
        txtStaticImageFile.value = selectedListElement.getAttribute(ATTR_STATIC_IMAGE_PATH);
        txtStaticImageWidth.value = selectedListElement.getAttribute(ATTR_STATIC_IMAGE_WIDTH);
        txtStaticImageHeight.value = selectedListElement.getAttribute(ATTR_STATIC_IMAGE_HEIGHT);
    }

    // Graph
    if (cmbElementType.value === ELEMENT_TYPE_GRAPH) {
        cmbGraphSensorIdSelection.value = selectedListElement.getAttribute(ATTR_GRAPH_SENSOR_ID);
        txtGraphMinValue.value = selectedListElement.getAttribute(ATTR_GRAPH_MIN_VALUE);
        txtGraphMaxValue.value = selectedListElement.getAttribute(ATTR_GRAPH_MAX_VALUE);
        txtGraphWidth.value = selectedListElement.getAttribute(ATTR_GRAPH_WIDTH);
        txtGraphHeight.value = selectedListElement.getAttribute(ATTR_GRAPH_HEIGHT);
        cmbGraphType.value = selectedListElement.getAttribute(ATTR_GRAPH_TYPE);
        txtGraphColor.value = selectedListElement.getAttribute(ATTR_GRAPH_COLOR);
        txtGraphColor.dispatchEvent(new Event('input', {bubbles: true}));
        txtGraphStrokeWidth.value = selectedListElement.getAttribute(ATTR_GRAPH_STROKE_WIDTH);
        txtGraphBackgroundColor.value = selectedListElement.getAttribute(ATTR_GRAPH_BACKGROUND_COLOR);
        txtGraphBackgroundColor.dispatchEvent(new Event('input', {bubbles: true}));
        txtGraphBorderColor.value = selectedListElement.getAttribute(ATTR_GRAPH_BORDER_COLOR);
        txtGraphBorderColor.dispatchEvent(new Event('input', {bubbles: true}));
    }

    // Conditional image
    if (cmbElementType.value === ELEMENT_TYPE_CONDITIONAL_IMAGE) {
        cmbConditionalImageSensorIdSelection.value = selectedListElement.getAttribute(ATTR_CONDITIONAL_IMAGE_SENSOR_ID);
        txtConditionalImageImagesPath.value = selectedListElement.getAttribute(ATTR_CONDITIONAL_IMAGE_IMAGES_PATH);
        txtConditionalImageMinValue.value = selectedListElement.getAttribute(ATTR_CONDITIONAL_IMAGE_MIN_VALUE);
        txtConditionalImageMaxValue.value = selectedListElement.getAttribute(ATTR_CONDITIONAL_IMAGE_MAX_VALUE);
        txtConditionalImageWidth.value = selectedListElement.getAttribute(ATTR_CONDITIONAL_IMAGE_WIDTH);
        txtConditionalImageHeight.value = selectedListElement.getAttribute(ATTR_CONDITIONAL_IMAGE_HEIGHT);
    }
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
    selectedListElement.setAttribute(ATTR_ELEMENT_POSITION_X, x);
    selectedListElement.setAttribute(ATTR_ELEMENT_POSITION_Y, y);

    // Select the element in the list
    setSelectedElement(selectedListElement);

    // Update X and Y position in the detail pane
    txtElementPositionX.value = x;
    txtElementPositionY.value = y;
}

function updateDisplayDesignPaneDimensions() {
    let width = txtDisplayResolutionWidth.value;
    let height = txtDisplayResolutionHeight.value;

    // Check if width and height are valid numbers over 0, otherwise return
    if (isNaN(width) || width <= 0 || isNaN(height) || height <= 0) {
        return;
    }

    designerPane.style.width = width + "px";
    designerPane.style.height = height + "px";
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

// Moves the selected element up in the list
function moveElementUp() {
    if (selectedListElement === null) {
        alert("Please select a element first.");
        return;
    }

    // Check if element exists in designer
    if (selectedDesignerElement === null) {
        alert("Please select a element first.");
        return;
    }

    // Check if the element is already the first element
    if (selectedListElement.previousElementSibling === null) {
        return;
    }

    // Move the element in the list
    selectedListElement.parentNode.insertBefore(selectedListElement, selectedListElement.previousElementSibling);

    // Recalculate the z-index of all elements
    recalculateZIndex();
}

// Moves the selected element one position down in the list
function moveElementDown() {
    if (selectedListElement === null) {
        alert("Please select a element first.");
        return;
    }

    // Check if element exists in designer
    if (selectedDesignerElement === null) {
        alert("Please select a element first.");
        return;
    }

    // Check if the element is already the last element
    if (selectedListElement.nextElementSibling === null) {
        return;
    }

    // Move the element in the list
    selectedListElement.parentNode.insertBefore(selectedListElement.nextElementSibling, selectedListElement);

    // Recalculate the z-index of all elements
    recalculateZIndex();
}