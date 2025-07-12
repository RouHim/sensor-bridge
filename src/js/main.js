// Main application initialization and coordination

import {
    loadRegisteredClients,
    onClientSelected,
    handleClientActiveToggle,
    removeClient
} from './client-management.js';

import {
    exportConfig,
    importConfig,
    loadHttpPort,
    onPortInputFocus,
    onPortInputChange,
    toggleHttpServer
} from './config-management.js';

import {
    updateDisplayDesignPaneDimensions,
    onElementTypeChange,
    addNewElement,
    removeElement,
    moveElementUp,
    moveElementDown,
    duplicateElement,
    moveElementControlPad,
    changeMoveUnit,
    dropOnDesignerPane,
    saveElementConfiguration,
    updateElementPreview
} from './element-management.js';

import {
    showSensorSelectionDialog,
    onCloseSensorSelectionDialog,
    populateAllSensorDropdowns,
    onSensorDropdownChange
} from './sensor-selection.js';

import {
    loadSystemFonts,
    loadConditionalImageRepoEntries,
    applyConditionalImageCatalogEntry,
    addTextFormatPlaceholder,
    selectStaticImage,
    selectConditionalImage,
    showConditionalImageInfo,
    toggleLivePreview,
    handleKeydownEvent,
    initializeColorPicker,
    initializeFeatherIcons
} from './ui-utils.js';

import { setSensorValues } from './app-state.js';
import { invoke } from './dom-elements.js';
import {
    cmbRegisteredClients,
    txtDisplayResolutionWidth,
    txtDisplayResolutionHeight,
    cmbElementType,
    btnRefreshClients,
    btnRemoveClient,
    btnExportConfig,
    btnImportConfig,
    btnSaveClientConfig,
    btnSaveElement,
    btnActivateSync,
    httpPortInput,
    btnToggleLivePreview,
    btnAddElement,
    btnRemoveElement,
    btnMoveElementUp,
    btnMoveElementDown,
    btnDuplicateElement,
    btnSelectStaticImage,
    btnConditionalImageInfo,
    btnConditionalImagePathSelection,
    btnControlPadChangeMoveUnit,
    btnControlPadUp,
    btnControlPadLeft,
    btnControlPadRight,
    btnControlPadDown,
    btnTextSensorIdSelectionDialog,
    btnGraphSensorIdSelectionDialog,
    btnConditionalImageSensorIdSelectionDialog,
    btnConditionalImageApplyCatalogEntry,
    btnTextFormatAddValue,
    btnTextFormatAddUnit,
    btnTextFormatAddValueAvg,
    btnTextFormatAddValueMin,
    btnTextFormatAddValueMax,
    clientActiveToggle,
    sensorSelectionDialog,
    designerPane,
    cmbTextSensorIdSelection,
    cmbGraphSensorIdSelection,
    cmbConditionalImageSensorIdSelection
} from './dom-elements.js';

/**
 * Main application initialization
 */
export function initializeApplication() {
    console.log('Initializing Sensor Bridge application...');

    // Initialize UI components
    initializeColorPicker();
    initializeFeatherIcons();

    // Setup event listeners
    setupEventListeners();

    // Load initial data
    loadInitialData();

    console.log('Application initialization complete');
}

/**
 * Sets up all event listeners
 */
function setupEventListeners() {
    // Client management events
    cmbRegisteredClients?.addEventListener("change", (event) => {
        onClientSelected(event.target.options[event.target.selectedIndex]);
    });

    clientActiveToggle?.addEventListener("change", handleClientActiveToggle);

    // Resolution inputs are read-only (determined by client hardware)
    // No event listeners needed since they cannot be manually changed

    // Element type change
    cmbElementType?.addEventListener("change", onElementTypeChange);

    // Button click events
    btnRefreshClients?.addEventListener("click", loadRegisteredClients);
    btnRemoveClient?.addEventListener("click", removeClient);
    btnExportConfig?.addEventListener("click", exportConfig);
    btnImportConfig?.addEventListener("click", importConfig);
    btnSaveClientConfig?.addEventListener("click", onSave);
    btnSaveElement?.addEventListener("click", onSave);
    btnActivateSync?.addEventListener("click", () => toggleHttpServer(btnActivateSync.checked));

    // HTTP port input events with auto-restart functionality
    httpPortInput?.addEventListener("focus", onPortInputFocus);
    httpPortInput?.addEventListener("change", onPortInputChange);
    httpPortInput?.addEventListener("blur", onPortInputChange);

    btnToggleLivePreview?.addEventListener("click", toggleLivePreview);

    // Element management events
    btnAddElement?.addEventListener("click", addNewElement);
    btnRemoveElement?.addEventListener("click", removeElement);
    btnMoveElementUp?.addEventListener("click", moveElementUp);
    btnMoveElementDown?.addEventListener("click", moveElementDown);
    btnDuplicateElement?.addEventListener("click", duplicateElement);

    // File selection events
    btnSelectStaticImage?.addEventListener("click", selectStaticImage);
    btnConditionalImageInfo?.addEventListener("click", showConditionalImageInfo);
    btnConditionalImagePathSelection?.addEventListener("click", selectConditionalImage);

    // Control pad events
    btnControlPadChangeMoveUnit?.addEventListener("click", changeMoveUnit);
    btnControlPadUp?.addEventListener("click", () => moveElementControlPad("up"));
    btnControlPadLeft?.addEventListener("click", () => moveElementControlPad("left"));
    btnControlPadRight?.addEventListener("click", () => moveElementControlPad("right"));
    btnControlPadDown?.addEventListener("click", () => moveElementControlPad("down"));

    // Sensor selection events
    btnTextSensorIdSelectionDialog?.addEventListener("click", showSensorSelectionDialog);
    btnGraphSensorIdSelectionDialog?.addEventListener("click", showSensorSelectionDialog);
    btnConditionalImageSensorIdSelectionDialog?.addEventListener("click", showSensorSelectionDialog);
    btnConditionalImageApplyCatalogEntry?.addEventListener("click", applyConditionalImageCatalogEntry);

    // Direct sensor dropdown selection events
    cmbTextSensorIdSelection?.addEventListener("change", (event) => onSensorDropdownChange(event.target));
    cmbGraphSensorIdSelection?.addEventListener("change", (event) => onSensorDropdownChange(event.target));
    cmbConditionalImageSensorIdSelection?.addEventListener("change", (event) => onSensorDropdownChange(event.target));

    // Text format placeholder events
    btnTextFormatAddValue?.addEventListener("click", () => addTextFormatPlaceholder("{value}"));
    btnTextFormatAddUnit?.addEventListener("click", () => addTextFormatPlaceholder("{unit}"));
    btnTextFormatAddValueAvg?.addEventListener("click", () => addTextFormatPlaceholder("{value-avg}"));
    btnTextFormatAddValueMin?.addEventListener("click", () => addTextFormatPlaceholder("{value-min}"));
    btnTextFormatAddValueMax?.addEventListener("click", () => addTextFormatPlaceholder("{value-max}"));

    // Modal dialog events
    sensorSelectionDialog?.addEventListener("close", () =>
        onCloseSensorSelectionDialog(sensorSelectionDialog.returnValue));

    // Drag and drop events
    designerPane?.addEventListener('dragover', (event) => event.preventDefault());
    designerPane?.addEventListener('drop', dropOnDesignerPane);

    // Keyboard events
    document.addEventListener("keydown", handleKeydownEvent);

    // Sensor selection dialog keyboard events
    sensorSelectionDialog?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            const sensorSelectionTable = document.getElementById("sensor-selection-table");
            if (sensorSelectionTable?.getElementsByTagName("tr").length > 1) {
                sensorSelectionDialog.close(sensorSelectionTable.getElementsByTagName("tr")[1].id);
            }
        }
    });

    // Element configuration preview update events
    setupPreviewUpdateListeners();
}

/**
 * Sets up event listeners that trigger preview updates
 */
function setupPreviewUpdateListeners() {
    // Text element configuration events
    document.getElementById('lcd-txt-element-text-format')?.addEventListener('input', updateElementPreview);
    document.getElementById('lcd-cmb-element-font-family')?.addEventListener('change', updateElementPreview);
    document.getElementById('lcd-txt-element-font-size')?.addEventListener('input', updateElementPreview);
    document.getElementById('lcd-txt-element-font-color')?.addEventListener('input', updateElementPreview);
    document.getElementById('lcd-txt-element-width')?.addEventListener('input', updateElementPreview);
    document.getElementById('lcd-txt-element-height')?.addEventListener('input', updateElementPreview);
    document.getElementById('lcd-cmb-element-text-alignment')?.addEventListener('change', updateElementPreview);

    // Static image element configuration events
    document.getElementById('lcd-txt-element-static-image-file')?.addEventListener('input', updateElementPreview);
    document.getElementById('lcd-txt-element-static-image-width')?.addEventListener('input', updateElementPreview);
    document.getElementById('lcd-txt-element-static-image-height')?.addEventListener('input', updateElementPreview);

    // Graph element configuration events
    document.getElementById('lcd-graph-width')?.addEventListener('input', updateElementPreview);
    document.getElementById('lcd-graph-height')?.addEventListener('input', updateElementPreview);
    document.getElementById('lcd-graph-type')?.addEventListener('change', updateElementPreview);
    document.getElementById('lcd-graph-color')?.addEventListener('input', updateElementPreview);
    document.getElementById('lcd-graph-stroke-width')?.addEventListener('input', updateElementPreview);
    document.getElementById('lcd-graph-background-color')?.addEventListener('input', updateElementPreview);
    document.getElementById('lcd-graph-border-color')?.addEventListener('input', updateElementPreview);

    // Conditional image element configuration events
    document.getElementById('lcd-txt-element-conditional-image-images-path')?.addEventListener('input', updateElementPreview);
    document.getElementById('lcd-txt-element-conditional-image-width')?.addEventListener('input', updateElementPreview);
    document.getElementById('lcd-txt-element-conditional-image-height')?.addEventListener('input', updateElementPreview);

    // Also update preview when element type changes
    document.getElementById('lcd-cmb-element-type')?.addEventListener('change', () => {
        onElementTypeChange();
        // Delay preview update to allow config panel to show
        setTimeout(updateElementPreview, 50);
    });
}

/**
 * Loads initial application data
 */
async function loadInitialData() {
    try {
        // Load current HTTP port value
        await loadHttpPort();

        // Load registered clients
        await loadRegisteredClients();

        // Load system fonts
        await loadSystemFonts();

        // Load conditional image repo entries
        loadConditionalImageRepoEntries();

        // Load sensor data from backend
        await loadSensorData();

    } catch (error) {
        console.error('Error loading initial data:', error);
        alert("Error while loading initial application data: " + error);
    }
}

/**
 * Loads sensor data from the backend
 */
async function loadSensorData() {
    try {
        console.log('Loading sensor data...');
        const sensorDataResponse = await invoke('get_sensor_values');

        // Parse the JSON response
        const sensorData = JSON.parse(sensorDataResponse);

        // Update app state with sensor data
        setSensorValues(sensorData);

        // Populate all sensor dropdowns with the loaded sensors
        populateAllSensorDropdowns();

        console.log('Loaded', sensorData.length, 'sensors');

    } catch (error) {
        console.error('Failed to load sensor data:', error);
        // Set empty array as fallback
        setSensorValues([]);
        throw error;
    }
}

/**
 * Generic save handler for both client config and elements
 */
async function onSave() {
    try {
        await saveElementConfiguration();
        console.log('Configuration saved successfully');
    } catch (error) {
        console.error('Error saving configuration:', error);
        alert('Error saving configuration: ' + error);
    }
}
