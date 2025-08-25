// Main application initialization and coordination

import {
    loadRegisteredClients,
    onClientSelected,
    removeClient,
    handleClientActiveToggle,
    saveClientConfiguration
} from './client-management.js';

import { exportConfig, importConfig, loadHttpPort, onPortInputChange, applyPortChange } from './config-management.js';

import {
    addNewElement,
    changeMoveUnit,
    duplicateElement,
    initializeDragSafety,
    initializeListDragAndDrop,
    markCurrentElementAsTouched,
    moveElementControlPad,
    moveElementDown,
    moveElementUp,
    onElementTypeChange,
    removeElement,
    saveElementConfiguration,
    updateAllElementValidationStates,
    updateElementPreview
} from './element-management.js';

import {
    onCloseSensorSelectionDialog,
    onSensorDropdownChange,
    populateAllSensorDropdowns,
    showSensorSelectionDialog
} from './sensor-selection.js';

import {
    addTextFormatPlaceholder,
    applyConditionalImageCatalogEntry,
    handleKeydownEvent,
    initializeColorPicker,
    initializeFeatherIcons,
    loadConditionalImageRepoEntries,
    loadSystemFonts,
    selectConditionalImage,
    selectStaticImage,
    showConditionalImageInfo,
    toggleLivePreview
} from './ui-utils.js';

import { setSensorValues } from './app-state.js';
import {
    btnAddElement,
    btnApplyPortChange,
    btnConditionalImageApplyCatalogEntry,
    btnConditionalImageInfo,
    btnConditionalImagePathSelection,
    btnConditionalImageSensorIdSelectionDialog,
    btnControlPadChangeMoveUnit,
    btnControlPadDown,
    btnControlPadLeft,
    btnControlPadRight,
    btnControlPadUp,
    btnDuplicateElement,
    btnExportConfig,
    btnGraphSensorIdSelectionDialog,
    btnImportConfig,
    btnMoveElementDown,
    btnMoveElementUp,
    btnRefreshClients,
    btnRemoveClient,
    btnRemoveElement,
    btnSaveClientConfig,
    btnSaveElement,
    btnSelectStaticImage,
    btnTextFormatAddUnit,
    btnTextFormatAddValue,
    btnTextFormatAddValueAvg,
    btnTextFormatAddValueMax,
    btnTextFormatAddValueMin,
    btnTextSensorIdSelectionDialog,
    btnToggleLivePreview,
    clientActiveToggle,
    cmbConditionalImageSensorIdSelection,
    cmbElementType,
    cmbGraphSensorIdSelection,
    cmbRegisteredClients,
    cmbTextSensorIdSelection,
    designerPane,
    httpPortInput,
    invoke,
    sensorSelectionDialog
} from './dom-elements.js';

/**
 * Main application initialization
 */
export async function initializeApplication() {
    // Initialize UI components
    initializeColorPicker();

    // Initialize drag safety mechanisms
    initializeDragSafety();

    // Initialize list drag and drop
    initializeListDragAndDrop();

    // Setup event listeners
    setupEventListeners();

    // Load initial data
    await loadInitialData();

    // Initialize Feather Icons after all DOM elements are set up
    initializeFeatherIcons();

    // Application ready
}

/**
 * Sets up all event listeners
 */
function setupEventListeners() {
    // Client management events
    cmbRegisteredClients?.addEventListener('change', async event => {
        const selectedIndex = event.target.selectedIndex;
        const selectedOption = selectedIndex >= 0 ? event.target.options[selectedIndex] : null;
        await onClientSelected(selectedOption);
    });

    clientActiveToggle?.addEventListener('change', handleClientActiveToggle);

    // Resolution inputs are read-only (determined by client hardware)
    // No event listeners needed since they cannot be manually changed

    // Element type change
    cmbElementType?.addEventListener('change', onElementTypeChange);

    // Button click events
    btnRefreshClients?.addEventListener('click', loadRegisteredClients);
    btnRemoveClient?.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        removeClient();
    });
    btnExportConfig?.addEventListener('click', exportConfig);
    btnImportConfig?.addEventListener('click', importConfig);
    btnSaveClientConfig?.addEventListener('click', onSaveClientConfig);
    btnSaveElement?.addEventListener('click', onSaveElement);

    // HTTP port input events for apply button workflow
    httpPortInput?.addEventListener('input', onPortInputChange);
    btnApplyPortChange?.addEventListener('click', applyPortChange);

    btnToggleLivePreview?.addEventListener('click', toggleLivePreview);

    // Element management events
    btnAddElement?.addEventListener('click', async event => {
        event.preventDefault();
        await addNewElement();
    });
    btnRemoveElement?.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        removeElement();
    });
    btnMoveElementUp?.addEventListener('click', moveElementUp);
    btnMoveElementDown?.addEventListener('click', moveElementDown);
    btnDuplicateElement?.addEventListener('click', async event => {
        event.preventDefault();
        await duplicateElement();
    });

    // File selection events
    btnSelectStaticImage?.addEventListener('click', selectStaticImage);
    btnConditionalImageInfo?.addEventListener('click', showConditionalImageInfo);
    btnConditionalImagePathSelection?.addEventListener('click', selectConditionalImage);

    // Control pad events
    btnControlPadChangeMoveUnit?.addEventListener('click', changeMoveUnit);
    btnControlPadUp?.addEventListener('click', () => moveElementControlPad('up'));
    btnControlPadLeft?.addEventListener('click', () => moveElementControlPad('left'));
    btnControlPadRight?.addEventListener('click', () => moveElementControlPad('right'));
    btnControlPadDown?.addEventListener('click', () => moveElementControlPad('down'));

    // Sensor selection events
    btnTextSensorIdSelectionDialog?.addEventListener('click', showSensorSelectionDialog);
    btnGraphSensorIdSelectionDialog?.addEventListener('click', showSensorSelectionDialog);
    btnConditionalImageSensorIdSelectionDialog?.addEventListener('click', showSensorSelectionDialog);
    btnConditionalImageApplyCatalogEntry?.addEventListener('click', applyConditionalImageCatalogEntry);

    // Direct sensor dropdown selection events
    cmbTextSensorIdSelection?.addEventListener('change', event => onSensorDropdownChange(event.target));
    cmbGraphSensorIdSelection?.addEventListener('change', event => onSensorDropdownChange(event.target));
    cmbConditionalImageSensorIdSelection?.addEventListener('change', event => onSensorDropdownChange(event.target));

    // Text format placeholder events
    btnTextFormatAddValue?.addEventListener('click', () => addTextFormatPlaceholder('{value}'));
    btnTextFormatAddUnit?.addEventListener('click', () => addTextFormatPlaceholder('{unit}'));
    btnTextFormatAddValueAvg?.addEventListener('click', () => addTextFormatPlaceholder('{value-avg}'));
    btnTextFormatAddValueMin?.addEventListener('click', () => addTextFormatPlaceholder('{value-min}'));
    btnTextFormatAddValueMax?.addEventListener('click', () => addTextFormatPlaceholder('{value-max}'));

    // Modal dialog events
    sensorSelectionDialog?.addEventListener('close', () =>
        onCloseSensorSelectionDialog(sensorSelectionDialog.returnValue)
    );

    // Drag and drop events
    designerPane?.addEventListener('dragover', event => event.preventDefault());

    // Keyboard events
    document.addEventListener('keydown', handleKeydownEvent);

    // Sensor selection dialog keyboard events
    sensorSelectionDialog?.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            const sensorSelectionTable = document.getElementById('sensor-selection-table');
            if (sensorSelectionTable?.getElementsByTagName('tr').length > 1) {
                sensorSelectionDialog.close(sensorSelectionTable.getElementsByTagName('tr')[1].id);
            }
        }
    });

    // Element configuration preview update events
    setupPreviewUpdateListeners();
}

/**
 * Sets up event listeners that trigger preview updates and validation
 */
function setupPreviewUpdateListeners() {
    // Helper function to update preview and conditionally validate
    const updatePreviewAndValidation = () => {
        updateElementPreview();
        // Mark element as touched on first change, then validate
        markCurrentElementAsTouched();
    };

    // Text element configuration events
    document.getElementById('lcd-txt-element-text-format')?.addEventListener('input', updatePreviewAndValidation);
    document.getElementById('lcd-cmb-element-font-family')?.addEventListener('change', updatePreviewAndValidation);
    document.getElementById('lcd-txt-element-font-size')?.addEventListener('input', updatePreviewAndValidation);
    document.getElementById('lcd-txt-element-font-color')?.addEventListener('input', updatePreviewAndValidation);
    document.getElementById('lcd-txt-element-width')?.addEventListener('input', updatePreviewAndValidation);
    document.getElementById('lcd-txt-element-height')?.addEventListener('input', updatePreviewAndValidation);
    document.getElementById('lcd-cmb-element-text-alignment')?.addEventListener('change', updatePreviewAndValidation);

    // Static image element configuration events
    document.getElementById('lcd-txt-element-static-image-file')?.addEventListener('input', updatePreviewAndValidation);
    document
        .getElementById('lcd-txt-element-static-image-width')
        ?.addEventListener('input', updatePreviewAndValidation);
    document
        .getElementById('lcd-txt-element-static-image-height')
        ?.addEventListener('input', updatePreviewAndValidation);

    // Graph element configuration events
    document.getElementById('lcd-graph-width')?.addEventListener('input', updatePreviewAndValidation);
    document.getElementById('lcd-graph-height')?.addEventListener('input', updatePreviewAndValidation);
    document.getElementById('lcd-graph-type')?.addEventListener('change', updatePreviewAndValidation);
    document.getElementById('lcd-graph-color')?.addEventListener('input', updatePreviewAndValidation);
    document.getElementById('lcd-graph-stroke-width')?.addEventListener('input', updatePreviewAndValidation);
    document.getElementById('lcd-graph-background-color')?.addEventListener('input', updatePreviewAndValidation);
    document.getElementById('lcd-graph-border-color')?.addEventListener('input', updatePreviewAndValidation);

    // Conditional image element configuration events
    document
        .getElementById('lcd-txt-element-conditional-image-images-path')
        ?.addEventListener('input', updatePreviewAndValidation);
    document
        .getElementById('lcd-txt-element-conditional-image-width')
        ?.addEventListener('input', updatePreviewAndValidation);
    document
        .getElementById('lcd-txt-element-conditional-image-height')
        ?.addEventListener('input', updatePreviewAndValidation);

    // Core element configuration events
    document.getElementById('lcd-txt-element-name')?.addEventListener('input', updatePreviewAndValidation);
    document.getElementById('lcd-txt-element-position-x')?.addEventListener('input', updatePreviewAndValidation);
    document.getElementById('lcd-txt-element-position-y')?.addEventListener('input', updatePreviewAndValidation);

    // Sensor selection events that affect validation
    document.getElementById('lcd-cmb-sensor-id-selection')?.addEventListener('change', updatePreviewAndValidation);
    document
        .getElementById('lcd-cmb-number-sensor-id-selection')
        ?.addEventListener('change', updatePreviewAndValidation);
    document
        .getElementById('lcd-cmb-conditional-image-sensor-id-selection')
        ?.addEventListener('change', updatePreviewAndValidation);

    // Also update preview when element type changes
    document.getElementById('lcd-cmb-element-type')?.addEventListener('change', () => {
        onElementTypeChange();
        // Delay preview and validation update to allow config panel to show
        setTimeout(() => {
            updateElementPreview();
            updateAllElementValidationStates();
        }, 50);
    });
}

/**
 * Loads initial application data
 */
async function loadInitialData() {
    try {
        // Load current HTTP port value
        try {
            await loadHttpPort();
        } catch (error) {
            console.error('Failed to load HTTP port:', error);
        }

        // Load sensor data from backend FIRST (required for element auto-selection)
        try {
            await loadSensorData();
        } catch (error) {
            console.error('Failed to load sensor data:', error);
        }

        // Load registered clients
        try {
            await loadRegisteredClients();
        } catch (error) {
            console.error('Failed to load registered clients:', error);
        }

        // Load system fonts
        try {
            await loadSystemFonts();
        } catch (error) {
            console.error('Failed to load system fonts:', error);
        }

        // Load conditional image repo entries
        try {
            loadConditionalImageRepoEntries();
        } catch (error) {
            console.error('Failed to load conditional image repo entries:', error);
        }
    } catch (error) {
        console.error('Error loading initial data:', error);
        alert('Error while loading initial application data: ' + error);
    }
}

/**
 * Loads sensor data from the backend
 */
async function loadSensorData() {
    try {
        // Load sensor data
        const sensorDataResponse = await invoke('get_sensor_values');

        // Parse the JSON response
        const sensorData = JSON.parse(sensorDataResponse);

        // Update app state with sensor data
        setSensorValues(sensorData);

        // Populate all sensor dropdowns with the loaded sensors
        populateAllSensorDropdowns();

        // Sensor data loaded
    } catch (error) {
        console.error('Failed to load sensor data:', error);
        // Set empty array as fallback
        setSensorValues([]);
        throw error;
    }
}

/**
 * Specific handler for saving client configuration
 */
async function onSaveClientConfig() {
    try {
        const { getCurrentClientMacAddress } = await import('./app-state.js');
        const selectedClient = getCurrentClientMacAddress();

        if (!selectedClient) {
            throw new Error('No client selected. Please select a client first.');
        }

        await saveClientConfiguration();
        // Client configuration saved successfully
    } catch (error) {
        console.error('Error saving client configuration:', error);
        alert('Error saving client configuration: ' + error);
    }
}

/**
 * Specific handler for saving element configuration
 */
async function onSaveElement() {
    try {
        const { getSelectedListElement, getSelectedDesignerElement } = await import('./app-state.js');
        const selectedList = getSelectedListElement();
        const selectedDesigner = getSelectedDesignerElement();

        if (!selectedList || !selectedDesigner) {
            throw new Error('No element selected. Please select an element first.');
        }

        await saveElementConfiguration();
        // Element configuration saved successfully
    } catch (error) {
        console.error('Error saving element configuration:', error);
        alert('Error saving element configuration: ' + error);
    }
}
