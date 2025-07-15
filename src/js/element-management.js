// Element management functionality for LCD display elements

import {
    ELEMENT_TYPE_TEXT,
    ELEMENT_TYPE_STATIC_IMAGE,
    ELEMENT_TYPE_GRAPH,
    ELEMENT_TYPE_CONDITIONAL_IMAGE,
    DESIGNER_ID_PREFIX,
    LIST_ID_PREFIX,
    ATTR_ELEMENT_ID,
    ATTR_ELEMENT_NAME,
    ATTR_ELEMENT_TYPE,
    ATTR_ELEMENT_POSITION_X,
    ATTR_ELEMENT_POSITION_Y,
    ATTR_MOVE_UNIT
} from './constants.js';
import {
    designerPane,
    lstDesignerPlacedElements,
    txtElementName,
    cmbElementType,
    txtElementPositionX,
    txtElementPositionY,
    txtDisplayResolutionWidth,
    txtDisplayResolutionHeight,
    layoutTextConfig,
    layoutStaticImageConfig,
    layoutGraphConfig,
    layoutConditionalImageConfig,
    btnControlPadChangeMoveUnit,
    invoke,
    cmbTextSensorIdSelection,
    cmbTextSensorValueModifier,
    txtTextFormat,
    cmbTextFontFamily,
    txtTextFontSize,
    txtTextFontColor,
    txtTextWidth,
    txtTextHeight,
    cmbTextAlignment,
    txtStaticImageFile,
    txtStaticImageWidth,
    txtStaticImageHeight,
    cmbGraphSensorIdSelection,
    txtGraphMinValue,
    txtGraphMaxValue,
    txtGraphWidth,
    txtGraphHeight,
    cmbGraphType,
    txtGraphColor,
    txtGraphStrokeWidth,
    txtGraphBackgroundColor,
    txtGraphBorderColor,
    cmbConditionalImageSensorIdSelection,
    txtConditionalImageImagesPath,
    txtConditionalImageWidth,
    txtConditionalImageHeight
} from './dom-elements.js';
import {
    getSelectedListElement,
    getSelectedDesignerElement,
    setSelectedListElement,
    setSelectedDesignerElement,
    getCurrentClientMacAddress
} from './app-state.js';

/**
 * Updates the display design pane dimensions based on current resolution settings
 */
export function updateDisplayDesignPaneDimensions() {
    if (!designerPane) return;

    const width = parseInt(txtDisplayResolutionWidth.value);
    const height = parseInt(txtDisplayResolutionHeight.value);

    // Update the designer pane dimensions to match the display resolution
    designerPane.style.width = `${width}px`;
    designerPane.style.height = `${height}px`;

    console.log(`Updated display design pane dimensions to ${width}x${height}`);
}

/**
 * Handles element type change
 */
export function onElementTypeChange() {
    const selectedType = cmbElementType.value;

    // Hide all config panels
    layoutTextConfig.style.display = 'none';
    layoutStaticImageConfig.style.display = 'none';
    layoutGraphConfig.style.display = 'none';
    layoutConditionalImageConfig.style.display = 'none';

    // Get current selected element to check if we're changing types
    const selectedList = getSelectedListElement();
    const selectedDesigner = getSelectedDesignerElement();
    const isChangingType = selectedList && selectedList.getAttribute(ATTR_ELEMENT_TYPE) !== selectedType;

    // Show relevant config panel and set defaults only when changing types
    switch (selectedType) {
        case ELEMENT_TYPE_TEXT:
            layoutTextConfig.style.display = 'block';
            if (isChangingType || !selectedList) {
                setDefaultTextConfig();
            }
            break;
        case ELEMENT_TYPE_STATIC_IMAGE:
            layoutStaticImageConfig.style.display = 'block';
            if (isChangingType || !selectedList) {
                setDefaultStaticImageConfig();
            }
            break;
        case ELEMENT_TYPE_GRAPH:
            layoutGraphConfig.style.display = 'block';
            if (isChangingType || !selectedList) {
                setDefaultGraphConfig();
            }
            break;
        case ELEMENT_TYPE_CONDITIONAL_IMAGE:
            layoutConditionalImageConfig.style.display = 'block';
            if (isChangingType || !selectedList) {
                setDefaultConditionalImageConfig();
            }
            break;
    }

    if (selectedList && selectedDesigner) {
        // Update the element type attributes
        selectedList.setAttribute(ATTR_ELEMENT_TYPE, selectedType);
        selectedDesigner.setAttribute(ATTR_ELEMENT_TYPE, selectedType);

        // Clear any existing configuration for the old type when changing types
        if (isChangingType) {
            selectedList.removeAttribute('data-config');
            selectedDesigner.removeAttribute('data-config');
        }

        // Apply current form values to create new configuration for the new type
        applyFormToSelectedElement();

        // Update the preview to show the new element type
        updateElementPreview();

        console.log(`Changed element type to: ${selectedType}`);
    }
}

/**
 * Adds a new element to the designer
 */
export function addNewElement() {
    const elementId = generateElementId();
    const elementName = `Element ${elementId}`;

    // Create list item with reasonable default position
    const listItem = createListElement(elementId, elementName, ELEMENT_TYPE_TEXT);
    // Set default position attributes
    listItem.setAttribute(ATTR_ELEMENT_POSITION_X, '10');
    listItem.setAttribute(ATTR_ELEMENT_POSITION_Y, '10');
    lstDesignerPlacedElements.appendChild(listItem);

    // Create designer element with reasonable default position (offset from top-left)
    const defaultX = 10;
    const defaultY = 10;
    const designerElement = createDesignerElement(elementId, elementName, ELEMENT_TYPE_TEXT, defaultX, defaultY, null);
    designerPane.appendChild(designerElement);

    // Set form defaults first before selecting the element
    clearElementForm();

    // Select the new element 
    selectElement(listItem, designerElement);

    // Apply default configuration for text elements
    applyFormToSelectedElement();
}

/**
 * Removes the currently selected element
 */
export async function removeElement() {
    const selectedList = getSelectedListElement();
    const selectedDesigner = getSelectedDesignerElement();

    if (!selectedList || !selectedDesigner) {
        alert('Please select an element to remove.');
        return;
    }

    // Use Tauri's dialog plugin instead of browser confirm()
    const confirmRemoval = await window.__TAURI__.dialog.ask(
        'Are you sure you want to remove this element?\n\nThis action cannot be undone.',
        {
            title: 'Remove Element',
            kind: 'warning'
        }
    );
    
    if (!confirmRemoval) return;

    // Remove from DOM
    selectedList.remove();
    selectedDesigner.remove();

    // Clear selection
    setSelectedListElement(null);
    setSelectedDesignerElement(null);

    // Clear form
    clearElementForm();
}

/**
 * Moves the selected element up in the list
 */
export function moveElementUp() {
    const selectedList = getSelectedListElement();
    if (!selectedList || !selectedList.previousElementSibling) return;

    selectedList.parentNode.insertBefore(selectedList, selectedList.previousElementSibling);
}

/**
 * Moves the selected element down in the list
 */
export function moveElementDown() {
    const selectedList = getSelectedListElement();
    if (!selectedList || !selectedList.nextElementSibling) return;

    selectedList.parentNode.insertBefore(selectedList.nextElementSibling, selectedList);
}

/**
 * Duplicates the currently selected element
 */
export function duplicateElement() {
    const selectedList = getSelectedListElement();
    const selectedDesigner = getSelectedDesignerElement();

    if (!selectedList || !selectedDesigner) {
        alert('Please select an element to duplicate.');
        return;
    }

    const newElementId = generateElementId();
    const originalName = selectedList.getAttribute(ATTR_ELEMENT_NAME);
    const newName = `${originalName} Copy`;

    // Clone list element
    const newListItem = selectedList.cloneNode(true);
    newListItem.id = LIST_ID_PREFIX + newElementId;
    newListItem.setAttribute(ATTR_ELEMENT_ID, newElementId);
    newListItem.setAttribute(ATTR_ELEMENT_NAME, newName);

    // Clone designer element
    const newDesignerElement = selectedDesigner.cloneNode(true);
    newDesignerElement.id = DESIGNER_ID_PREFIX + newElementId;
    newDesignerElement.setAttribute(ATTR_ELEMENT_ID, newElementId);
    newDesignerElement.setAttribute(ATTR_ELEMENT_NAME, newName);

    // Offset position slightly to make the duplicate visible
    const currentX = parseInt(selectedDesigner.getAttribute(ATTR_ELEMENT_POSITION_X) || 0);
    const currentY = parseInt(selectedDesigner.getAttribute(ATTR_ELEMENT_POSITION_Y) || 0);
    newDesignerElement.setAttribute(ATTR_ELEMENT_POSITION_X, currentX + 20);
    newDesignerElement.setAttribute(ATTR_ELEMENT_POSITION_Y, currentY + 20);
    newDesignerElement.style.left = (currentX + 20) + 'px';
    newDesignerElement.style.top = (currentY + 20) + 'px';

    // Add to DOM
    lstDesignerPlacedElements.appendChild(newListItem);
    designerPane.appendChild(newDesignerElement);

    // Setup event handlers for new elements
    setupElementEventHandlers(newListItem, newDesignerElement);

    // Select the new element
    selectElement(newListItem, newDesignerElement);
}

/**
 * Moves element using control pad
 */
export function moveElementControlPad(direction) {
    const moveUnit = parseInt(btnControlPadChangeMoveUnit.getAttribute(ATTR_MOVE_UNIT));
    const selectedDesigner = getSelectedDesignerElement();
    const selectedList = getSelectedListElement();

    if (!selectedDesigner || !selectedList) {
        return;
    }

    const currentX = parseInt(selectedDesigner.getAttribute(ATTR_ELEMENT_POSITION_X) || 0);
    const currentY = parseInt(selectedDesigner.getAttribute(ATTR_ELEMENT_POSITION_Y) || 0);

    let newX = currentX;
    let newY = currentY;

    switch (direction) {
        case 'up':
            newY = Math.max(0, currentY - moveUnit);
            break;
        case 'down':
            newY = currentY + moveUnit;
            break;
        case 'left':
            newX = Math.max(0, currentX - moveUnit);
            break;
        case 'right':
            newX = currentX + moveUnit;
            break;
    }

    // Update element position
    updateElementPosition(selectedDesigner, newX, newY);
    updateElementForm();
}

/**
 * Changes the move unit for control pad
 */
export function changeMoveUnit() {
    const currentUnit = parseInt(btnControlPadChangeMoveUnit.getAttribute(ATTR_MOVE_UNIT)) || 1;
    const units = [1, 5, 10, 25];
    const currentIndex = units.indexOf(currentUnit);
    const nextIndex = (currentIndex + 1) % units.length;
    const newUnit = units[nextIndex];

    btnControlPadChangeMoveUnit.setAttribute(ATTR_MOVE_UNIT, newUnit);
    btnControlPadChangeMoveUnit.textContent = `${newUnit}px`;
}

/**
 * Handles drop events on designer pane
 */
export function dropOnDesignerPane(event) {
    event.preventDefault();
    // Implementation for drag and drop functionality
    console.log('Drop event on designer pane');
}

/**
 * Saves the current element configuration to the backend
 */
export async function saveElementConfiguration() {
    const macAddress = getCurrentClientMacAddress();
    if (!macAddress) {
        alert('Please select a client first.');
        return;
    }

    try {
        // First, apply current form values to the selected element
        applyFormToSelectedElement();

        const elements = collectAllElements();

        // Get the current client's resolution from the backend
        const clientsResponse = await invoke('get_registered_clients');
        const parsedClients = JSON.parse(clientsResponse);
        const currentClient = parsedClients[macAddress];

        if (!currentClient) {
            throw new Error('Current client not found');
        }

        // Create the complete DisplayConfig structure
        const displayConfig = {
            resolution_width: currentClient.resolution_width || 0,
            resolution_height: currentClient.resolution_height || 0,
            elements: elements
        };

        await invoke('update_client_display_config', {macAddress, displayConfig: JSON.stringify(displayConfig)});
        console.log('Element configuration saved successfully');
    } catch (error) {
        console.error('Failed to save element configuration:', error);
        alert('Error saving configuration: ' + error);
    }
}

/**
 * Loads display elements from configuration data
 * @param {Array} elements - Array of element configurations to load
 */
export function loadDisplayElements(elements = []) {
    // Clear existing elements
    clearAllElements();

    // Load each element from the configuration
    elements.forEach(elementData => {
        const {
            id,
            name,
            element_type,
            x,
            y,
            text_config,
            image_config,
            graph_config,
            conditional_image_config
        } = elementData;

        // Generate new ID if not provided or use existing
        const elementId = id || generateElementId();
        const elementName = name || `Element ${elementId}`;
        const elementType = element_type || ELEMENT_TYPE_TEXT;
        const posX = parseInt(x) || 0;
        const posY = parseInt(y) || 0;

        // Create list element
        const listElement = createListElement(elementId, elementName, elementType);
        listElement.setAttribute(ATTR_ELEMENT_POSITION_X, posX);
        listElement.setAttribute(ATTR_ELEMENT_POSITION_Y, posY);

        // Determine which config to use based on element type
        let config = null;
        switch (elementType) {
            case ELEMENT_TYPE_TEXT:
                config = text_config;
                break;
            case ELEMENT_TYPE_STATIC_IMAGE:
                config = image_config;
                break;
            case ELEMENT_TYPE_GRAPH:
                config = graph_config;
                break;
            case ELEMENT_TYPE_CONDITIONAL_IMAGE:
                config = conditional_image_config;
                break;
        }

        // Store configuration if available
        if (config) {
            listElement.setAttribute('data-config', JSON.stringify(config));
        }

        // Create designer element
        const designerElement = createDesignerElement(elementId, elementName, elementType, posX, posY, config);

        // Store configuration in designer element too (for consistency)
        if (config) {
            designerElement.setAttribute('data-config', JSON.stringify(config));
        }

        // Add to DOM
        lstDesignerPlacedElements.appendChild(listElement);
        designerPane.appendChild(designerElement);

        // Setup event handlers
        setupElementEventHandlers(listElement, designerElement);
    });

    console.log(`Loaded ${elements.length} display elements`);
}

/**
 * Clears all elements from both the list and designer pane
 */
function clearAllElements() {
    // Clear selection first
    clearElementSelection();
    setSelectedListElement(null);
    setSelectedDesignerElement(null);

    // Clear the list
    if (lstDesignerPlacedElements) {
        lstDesignerPlacedElements.innerHTML = '';
    }

    // Clear the designer pane
    if (designerPane) {
        const elements = designerPane.querySelectorAll('.designer-element');
        elements.forEach(element => element.remove());
    }

    // Clear the form
    clearElementForm();
}

/**
 * Updates the preview of the currently selected element
 */
export function updateElementPreview() {
    const selectedDesigner = getSelectedDesignerElement();
    if (!selectedDesigner) return;

    const elementType = selectedDesigner.getAttribute(ATTR_ELEMENT_TYPE);
    let preview;

    switch (elementType) {
        case ELEMENT_TYPE_TEXT:
            preview = renderTextElementPreview(getTextElementConfig());
            break;
        case ELEMENT_TYPE_STATIC_IMAGE:
            preview = renderStaticImageElementPreview(getStaticImageElementConfig());
            break;
        case ELEMENT_TYPE_GRAPH:
            preview = renderGraphElementPreview(getGraphElementConfig());
            break;
        case ELEMENT_TYPE_CONDITIONAL_IMAGE:
            preview = renderConditionalImageElementPreview(getConditionalImageElementConfig());
            break;
    }

    if (preview) {
        // Clear existing content but preserve the designer element attributes and position
        selectedDesigner.innerHTML = '';
        selectedDesigner.appendChild(preview);
    }
}

// Helper functions

function generateElementId() {
    return Date.now().toString();
}

function createListElement(id, name, type) {
    const li = document.createElement('li');
    li.id = LIST_ID_PREFIX + id;
    li.textContent = name;
    li.setAttribute(ATTR_ELEMENT_ID, id);
    li.setAttribute(ATTR_ELEMENT_NAME, name);
    li.setAttribute(ATTR_ELEMENT_TYPE, type);
    li.draggable = true;
    return li;
}

function createDesignerElement(id, name, type, x, y, config = null) {
    const div = document.createElement('div');
    div.id = DESIGNER_ID_PREFIX + id;
    div.className = 'designer-element';
    div.textContent = name;
    div.style.position = 'absolute';
    div.style.left = x + 'px';
    div.style.top = y + 'px';
    div.style.border = '1px solid #ccc';
    div.style.padding = '5px';
    div.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    div.setAttribute(ATTR_ELEMENT_ID, id);
    div.setAttribute(ATTR_ELEMENT_NAME, name);
    div.setAttribute(ATTR_ELEMENT_TYPE, type);
    div.setAttribute(ATTR_ELEMENT_POSITION_X, x);
    div.setAttribute(ATTR_ELEMENT_POSITION_Y, y);

    // Use renderers to show previews
    let preview;
    switch (type) {
        case ELEMENT_TYPE_TEXT:
            preview = renderTextElementPreview(config || getTextElementConfig());
            break;
        case ELEMENT_TYPE_STATIC_IMAGE:
            preview = renderStaticImageElementPreview(config || getStaticImageElementConfig());
            break;
        case ELEMENT_TYPE_GRAPH:
            preview = renderGraphElementPreview(config || getGraphElementConfig());
            break;
        case ELEMENT_TYPE_CONDITIONAL_IMAGE:
            preview = renderConditionalImageElementPreview(config || getConditionalImageElementConfig());
            break;
    }

    if (preview) {
        // Clear existing content
        div.innerHTML = '';
        div.appendChild(preview);
    }

    return div;
}

function selectElement(listElement, designerElement) {
    // Clear previous selection
    clearElementSelection();

    // Set new selection
    setSelectedListElement(listElement);
    setSelectedDesignerElement(designerElement);

    // Visual feedback
    listElement.classList.add('selected');
    designerElement.classList.add('selected');

    // Update form
    updateElementForm();
}

function clearElementSelection() {
    const currentList = getSelectedListElement();
    const currentDesigner = getSelectedDesignerElement();

    if (currentList) currentList.classList.remove('selected');
    if (currentDesigner) currentDesigner.classList.remove('selected');
}

function clearElementForm() {
    txtElementName.value = '';
    cmbElementType.value = ELEMENT_TYPE_TEXT; // Set default element type
    txtElementPositionX.value = '10'; // Set reasonable default position
    txtElementPositionY.value = '10';

    // Set defaults for all element type configs
    setDefaultTextConfig();
    setDefaultStaticImageConfig();
    setDefaultGraphConfig();
    setDefaultConditionalImageConfig();
}

/**
 * Sets default values for text element configuration
 */
function setDefaultTextConfig() {
    if (cmbTextSensorIdSelection) cmbTextSensorIdSelection.value = '';
    if (cmbTextSensorValueModifier) cmbTextSensorValueModifier.value = 'none';
    if (txtTextFormat) txtTextFormat.value = '{value} {unit}';
    if (cmbTextFontFamily) {
        // Try to set Arial as default, fallback to first available font
        const options = cmbTextFontFamily.options;
        let foundArial = false;
        for (let i = 0; i < options.length; i++) {
            if (options[i].value.toLowerCase().includes('arial')) {
                cmbTextFontFamily.value = options[i].value;
                foundArial = true;
                break;
            }
        }
        // If Arial not found, set to first available font or empty
        if (!foundArial && options.length > 0) {
            cmbTextFontFamily.value = options[0].value;
        }
    }
    if (txtTextFontSize) txtTextFontSize.value = '12';
    if (txtTextFontColor) txtTextFontColor.value = '#ffffffff';
    if (txtTextWidth) txtTextWidth.value = '100';
    if (txtTextHeight) txtTextHeight.value = '20';
    if (cmbTextAlignment) cmbTextAlignment.value = 'left';
}

/**
 * Sets default values for static image element configuration
 */
function setDefaultStaticImageConfig() {
    if (txtStaticImageFile) txtStaticImageFile.value = '';
    if (txtStaticImageWidth) txtStaticImageWidth.value = '100';
    if (txtStaticImageHeight) txtStaticImageHeight.value = '100';
}

/**
 * Sets default values for graph element configuration
 */
function setDefaultGraphConfig() {
    if (cmbGraphSensorIdSelection) cmbGraphSensorIdSelection.value = '';
    if (txtGraphMinValue) txtGraphMinValue.value = ''; // Leave empty for auto-scaling
    if (txtGraphMaxValue) txtGraphMaxValue.value = ''; // Leave empty for auto-scaling
    if (txtGraphWidth) txtGraphWidth.value = '200';
    if (txtGraphHeight) txtGraphHeight.value = '50';
    if (cmbGraphType) cmbGraphType.value = 'line';
    if (txtGraphColor) txtGraphColor.value = '#0066ccff'; // Nice blue color with alpha
    if (txtGraphStrokeWidth) txtGraphStrokeWidth.value = '2'; // Better visibility
    if (txtGraphBackgroundColor) txtGraphBackgroundColor.value = '#00000000'; // Transparent
    if (txtGraphBorderColor) txtGraphBorderColor.value = '#ffffff00'; // Transparent border
}

/**
 * Sets default values for conditional image element configuration
 */
function setDefaultConditionalImageConfig() {
    if (cmbConditionalImageSensorIdSelection) cmbConditionalImageSensorIdSelection.value = '';
    if (txtConditionalImageImagesPath) txtConditionalImageImagesPath.value = '';
    if (txtConditionalImageWidth) txtConditionalImageWidth.value = '130'; // Match backend default
    if (txtConditionalImageHeight) txtConditionalImageHeight.value = '25'; // Match backend default
}

/**
 * Updates the form fields for the selected element
 */
function updateElementForm() {
    const selectedList = getSelectedListElement();
    if (!selectedList) return;

    // Load basic properties with fallbacks to current form values
    txtElementName.value = selectedList.getAttribute(ATTR_ELEMENT_NAME) || txtElementName.value || '';
    cmbElementType.value = selectedList.getAttribute(ATTR_ELEMENT_TYPE) || cmbElementType.value || ELEMENT_TYPE_TEXT;
    txtElementPositionX.value = selectedList.getAttribute(ATTR_ELEMENT_POSITION_X) || txtElementPositionX.value || '10';
    txtElementPositionY.value = selectedList.getAttribute(ATTR_ELEMENT_POSITION_Y) || txtElementPositionY.value || '10';

    // Load detailed configuration if available, otherwise keep current form values
    const configAttr = selectedList.getAttribute('data-config');
    if (configAttr) {
        try {
            const config = JSON.parse(configAttr);
            loadConfigIntoForm(config, selectedList.getAttribute(ATTR_ELEMENT_TYPE));
        } catch (error) {
            console.warn('Failed to parse element config:', error);
        }
    }
    // If no config exists, don't override the current form values (which should be defaults)

    // Trigger element type change to show correct config panel
    onElementTypeChange();
}

/**
 * Loads configuration data into form fields based on element type
 */
function loadConfigIntoForm(config, elementType) {
    switch (elementType) {
        case ELEMENT_TYPE_TEXT:
            if (cmbTextSensorIdSelection) cmbTextSensorIdSelection.value = config.sensor_id || '';
            if (cmbTextSensorValueModifier) cmbTextSensorValueModifier.value = config.value_modifier || 'none';
            if (txtTextFormat) txtTextFormat.value = config.format || '{value} {unit}';
            if (cmbTextFontFamily) cmbTextFontFamily.value = config.font_family || 'Arial';
            if (txtTextFontSize) txtTextFontSize.value = config.font_size || 12;
            if (txtTextFontColor) txtTextFontColor.value = config.font_color || '#ffffffff';
            if (txtTextWidth) txtTextWidth.value = config.width || 100;
            if (txtTextHeight) txtTextHeight.value = config.height || 20;
            if (cmbTextAlignment) cmbTextAlignment.value = config.alignment || 'left';
            break;

        case ELEMENT_TYPE_STATIC_IMAGE:
            if (txtStaticImageFile) txtStaticImageFile.value = config.image_path || '';
            if (txtStaticImageWidth) txtStaticImageWidth.value = config.width || 100;
            if (txtStaticImageHeight) txtStaticImageHeight.value = config.height || 100;
            break;

        case ELEMENT_TYPE_GRAPH:
            if (cmbGraphSensorIdSelection) cmbGraphSensorIdSelection.value = config.sensor_id || '';
            if (txtGraphMinValue) txtGraphMinValue.value = config.min_sensor_value || '';
            if (txtGraphMaxValue) txtGraphMaxValue.value = config.max_sensor_value || '';
            if (txtGraphWidth) txtGraphWidth.value = config.width || 200;
            if (txtGraphHeight) txtGraphHeight.value = config.height || 50;
            if (cmbGraphType) cmbGraphType.value = config.graph_type || 'line';
            if (txtGraphColor) txtGraphColor.value = config.graph_color || '#0066ccff';
            if (txtGraphStrokeWidth) txtGraphStrokeWidth.value = config.graph_stroke_width || 2;
            if (txtGraphBackgroundColor) txtGraphBackgroundColor.value = config.background_color || '#00000000';
            if (txtGraphBorderColor) txtGraphBorderColor.value = config.border_color || '#ffffff00';
            break;

        case ELEMENT_TYPE_CONDITIONAL_IMAGE:
            if (cmbConditionalImageSensorIdSelection) cmbConditionalImageSensorIdSelection.value = config.sensor_id || '';
            if (txtConditionalImageImagesPath) txtConditionalImageImagesPath.value = config.images_path || '';
            if (txtConditionalImageWidth) txtConditionalImageWidth.value = config.width || 130;
            if (txtConditionalImageHeight) txtConditionalImageHeight.value = config.height || 25;
            break;
    }
}

/**
 * Moves element to a new position
 */
function updateElementPosition(element, x, y) {
    element.style.left = x + 'px';
    element.style.top = y + 'px';
    element.setAttribute(ATTR_ELEMENT_POSITION_X, x);
    element.setAttribute(ATTR_ELEMENT_POSITION_Y, y);

    // Update corresponding list element
    const listElement = document.getElementById(LIST_ID_PREFIX + element.getAttribute(ATTR_ELEMENT_ID));
    if (listElement) {
        listElement.setAttribute(ATTR_ELEMENT_POSITION_X, x);
        listElement.setAttribute(ATTR_ELEMENT_POSITION_Y, y);
    }
}

function setupElementEventHandlers(listElement, designerElement) {
    listElement.addEventListener('click', () => selectElement(listElement, designerElement));
    designerElement.addEventListener('click', () => selectElement(listElement, designerElement));
}

function collectAllElements() {
    const elements = [];
    const listElements = lstDesignerPlacedElements.querySelectorAll('li');

    listElements.forEach(li => {
        const elementData = {
            id: li.getAttribute(ATTR_ELEMENT_ID),
            name: li.getAttribute(ATTR_ELEMENT_NAME),
            element_type: li.getAttribute(ATTR_ELEMENT_TYPE), // Changed from 'type' to 'element_type'
            x: parseInt(li.getAttribute(ATTR_ELEMENT_POSITION_X) || 0),
            y: parseInt(li.getAttribute(ATTR_ELEMENT_POSITION_Y) || 0),
            // Initialize all config fields as null
            text_config: null,
            image_config: null,
            graph_config: null,
            conditional_image_config: null
        };

        // Include detailed configuration if available
        const configAttr = li.getAttribute('data-config');
        if (configAttr) {
            try {
                const config = JSON.parse(configAttr);
                const elementType = li.getAttribute(ATTR_ELEMENT_TYPE);

                // Map the generic config to the appropriate typed config field
                switch (elementType) {
                    case ELEMENT_TYPE_TEXT:
                        elementData.text_config = config;
                        break;
                    case ELEMENT_TYPE_STATIC_IMAGE:
                        elementData.image_config = config;
                        break;
                    case ELEMENT_TYPE_GRAPH:
                        elementData.graph_config = config;
                        break;
                    case ELEMENT_TYPE_CONDITIONAL_IMAGE:
                        elementData.conditional_image_config = config;
                        break;
                    default:
                        console.warn(`Unknown element type: ${elementType}`);
                }
            } catch (error) {
                console.warn('Failed to parse element config:', error);
            }
        }

        elements.push(elementData);
    });

    return elements;
}

/**
 * Gets configuration data for a text element
 */
function getTextElementConfig() {
    return {
        sensor_id: cmbTextSensorIdSelection?.value || '',
        value_modifier: cmbTextSensorValueModifier?.value || 'none',
        format: txtTextFormat?.value || '{value} {unit}',
        font_family: cmbTextFontFamily?.value || 'Arial',
        font_size: parseInt(txtTextFontSize?.value) || 12,
        font_color: txtTextFontColor?.value || '#ffffffff',  // Match HTML default
        width: parseInt(txtTextWidth?.value) || 100,
        height: parseInt(txtTextHeight?.value) || 20,
        alignment: cmbTextAlignment?.value || 'left'
    };
}

/**
 * Gets configuration data for a static image element
 */
function getStaticImageElementConfig() {
    return {
        image_path: txtStaticImageFile?.value || '',
        width: parseInt(txtStaticImageWidth?.value) || 100,
        height: parseInt(txtStaticImageHeight?.value) || 100
    };
}

/**
 * Gets configuration data for a graph element
 */
function getGraphElementConfig() {
    return {
        sensor_id: cmbGraphSensorIdSelection?.value || '',
        sensor_values: [], // Initialize empty array for sensor values history
        min_sensor_value: txtGraphMinValue?.value ? parseFloat(txtGraphMinValue.value) : null,
        max_sensor_value: txtGraphMaxValue?.value ? parseFloat(txtGraphMaxValue.value) : null,
        width: parseInt(txtGraphWidth?.value) || 200,
        height: parseInt(txtGraphHeight?.value) || 50,
        graph_type: cmbGraphType?.value || 'line',
        graph_color: txtGraphColor?.value || '#0066ccff',
        graph_stroke_width: parseInt(txtGraphStrokeWidth?.value) || 2,
        background_color: txtGraphBackgroundColor?.value || '#00000000',
        border_color: txtGraphBorderColor?.value || '#ffffff00'
    };
}

/**
 * Gets configuration data for a conditional image element
 */
function getConditionalImageElementConfig() {
    return {
        sensor_id: cmbConditionalImageSensorIdSelection?.value || '',
        sensor_value: '', // Current sensor value (will be populated at render time)
        images_path: txtConditionalImageImagesPath?.value || '',
        min_sensor_value: 0.0,
        max_sensor_value: 100.0,
        width: parseInt(txtConditionalImageWidth?.value) || 100,
        height: parseInt(txtConditionalImageHeight?.value) || 100
    };
}

/**
 * Renders a text element preview
 */
function renderTextElementPreview(config) {
    const div = document.createElement('div');
    div.style.fontFamily = config.font_family || 'Arial';
    div.style.fontSize = `${config.font_size || 12}px`;
    div.style.color = config.font_color || '#ffffffff';
    div.style.width = `${config.width || 100}px`;
    div.style.height = `${config.height || 20}px`;
    div.style.textAlign = config.alignment || 'left';
    div.style.overflow = 'hidden';
    div.style.lineHeight = `${config.height || 20}px`;
    div.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    div.style.border = '1px solid #666';

    // Get real sensor data if a sensor is selected
    const sensorId = config.sensor_id;
    let previewText = config.format || '{value} {unit}';

    if (sensorId) {
        // Import getSensorValues to get real sensor data
        import('./app-state.js').then(module => {
            const sensorValues = module.getSensorValues();
            const selectedSensor = sensorValues.find(sensor => sensor.id === sensorId);

            if (selectedSensor) {
                // Replace placeholders with real sensor data
                let realText = previewText;
                realText = realText.replace(/{value}/g, selectedSensor.value);
                realText = realText.replace(/{unit}/g, selectedSensor.unit);
                realText = realText.replace(/{value-avg}/g, selectedSensor.value); // TODO: implement actual avg
                realText = realText.replace(/{value-min}/g, selectedSensor.value); // TODO: implement actual min
                realText = realText.replace(/{value-max}/g, selectedSensor.value); // TODO: implement actual max

                div.textContent = realText;
            } else {
                // Fallback to sample data if sensor not found
                previewText = previewText.replace(/{value}/g, '42.5');
                previewText = previewText.replace(/{unit}/g, '°C');
                previewText = previewText.replace(/{value-avg}/g, '41.2');
                previewText = previewText.replace(/{value-min}/g, '38.1');
                previewText = previewText.replace(/{value-max}/g, '45.3');
                div.textContent = previewText;
            }
        }).catch(() => {
            // Fallback to sample data if import fails
            previewText = previewText.replace(/{value}/g, '42.5');
            previewText = previewText.replace(/{unit}/g, '°C');
            previewText = previewText.replace(/{value-avg}/g, '41.2');
            previewText = previewText.replace(/{value-min}/g, '38.1');
            previewText = previewText.replace(/{value-max}/g, '45.3');
            div.textContent = previewText;
        });
    } else {
        // No sensor selected, use sample data
        previewText = previewText.replace(/{value}/g, '42.5');
        previewText = previewText.replace(/{unit}/g, '°C');
        previewText = previewText.replace(/{value-avg}/g, '41.2');
        previewText = previewText.replace(/{value-min}/g, '38.1');
        previewText = previewText.replace(/{value-max}/g, '45.3');
        div.textContent = previewText;
    }

    return div;
}

/**
 * Renders a static image element preview
 */
function renderStaticImageElementPreview(config) {
    const div = document.createElement('div');
    div.style.width = `${config.width}px`;
    div.style.height = `${config.height}px`;
    div.style.backgroundColor = '#333';
    div.style.border = '1px solid #666';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';
    div.style.color = '#999';
    div.style.fontSize = '10px';
    div.style.overflow = 'hidden';

    if (config.image_path) {
        const img = document.createElement('img');
        // Convert the file path to a secure URL that Tauri can access using global API
        const imagePath = config.image_path;
        img.src = window.__TAURI__.core.convertFileSrc(imagePath);
        img.style.maxWidth = '100%';
        img.style.maxHeight = '100%';
        img.style.objectFit = 'contain';
        img.onerror = () => {
            div.textContent = '🖼️ Image not found';
        };
        div.appendChild(img);
    } else {
        div.textContent = '🖼️ No image selected';
    }

    return div;
}

/**
 * Renders a graph element preview
 */
function renderGraphElementPreview(graphConfig) {
    const container = document.createElement('div');
    container.style.width = `${graphConfig.width}px`;
    container.style.height = `${graphConfig.height}px`;
    const bgColor = graphConfig.background_color || '#00000000';
    const borderColor = graphConfig.border_color || '#ffffff00';
    container.style.backgroundColor = bgColor;
    container.style.border = `1px solid ${borderColor === 'transparent' || borderColor === '#ffffff00' ? '#666' : borderColor}`;
    container.style.position = 'relative';

    // Invoke get_graph_preview_image and show base64 response data
    invoke('get_graph_preview_image', {graphConfig: graphConfig})
        .then(
            (base64Data) => {
                const img = document.createElement('img');
                img.src = `data:image/png;base64,${base64Data}`;
                img.style.width = '100%';
                img.style.height = '100%';
                img.style.objectFit = 'contain';
                container.appendChild(img);
            }
        ).catch((error) => {
            // Fallback preview if backend call fails
            container.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999; font-size: 10px; flex-direction: column;">
                    <div style="font-size: 14px; margin-bottom: 2px;">📊</div>
                    <div>Graph Preview</div>
                    <div style="font-size: 8px; opacity: 0.7;">${graphConfig.graph_type || 'line'}</div>
                </div>
            `;
        });

    return container;
}

/**
 * Renders a conditional image element preview
 */
function renderConditionalImageElementPreview(config) {
    const div = document.createElement('div');
    div.style.width = `${config.width}px`;
    div.style.height = `${config.height}px`;
    div.style.backgroundColor = '#333';
    div.style.border = '1px solid #666';
    div.style.display = 'flex';
    div.style.alignItems = 'center';
    div.style.justifyContent = 'center';
    div.style.color = '#999';
    div.style.fontSize = '10px';
    div.style.flexDirection = 'column';
    div.style.overflow = 'hidden';

    // Handle images path
    const imagesPath = config.images_path || '';
    
    if (imagesPath) {
        div.innerHTML = `
            <div style="font-size: 14px; margin-bottom: 2px;">🔄</div>
            <div style="text-align: center; word-break: break-all;">Conditional Image</div>
            <div style="font-size: 8px; opacity: 0.7;">${imagesPath}</div>
        `;
    } else {
        div.innerHTML = `
            <div style="font-size: 14px; margin-bottom: 2px;">🔄</div>
            <div>No image package</div>
        `;
    }

    return div;
}

/**
 * Applies current form values to the selected element
 */
export function applyFormToSelectedElement() {
    const selectedList = getSelectedListElement();
    const selectedDesigner = getSelectedDesignerElement();

    if (!selectedList || !selectedDesigner) {
        return; // No element selected
    }

    // Update basic properties
    const newName = txtElementName.value || selectedList.getAttribute(ATTR_ELEMENT_NAME);
    const newType = cmbElementType.value || selectedList.getAttribute(ATTR_ELEMENT_TYPE);
    const newX = parseInt(txtElementPositionX.value) || parseInt(selectedList.getAttribute(ATTR_ELEMENT_POSITION_X) || 0);
    const newY = parseInt(txtElementPositionY.value) || parseInt(selectedList.getAttribute(ATTR_ELEMENT_POSITION_Y) || 0);

    // Update list element attributes
    selectedList.setAttribute(ATTR_ELEMENT_NAME, newName);
    selectedList.setAttribute(ATTR_ELEMENT_TYPE, newType);
    selectedList.setAttribute(ATTR_ELEMENT_POSITION_X, newX);
    selectedList.setAttribute(ATTR_ELEMENT_POSITION_Y, newY);
    selectedList.textContent = newName;

    // Update designer element attributes and position
    selectedDesigner.setAttribute(ATTR_ELEMENT_NAME, newName);
    selectedDesigner.setAttribute(ATTR_ELEMENT_TYPE, newType);
    selectedDesigner.setAttribute(ATTR_ELEMENT_POSITION_X, newX);
    selectedDesigner.setAttribute(ATTR_ELEMENT_POSITION_Y, newY);
    selectedDesigner.style.left = newX + 'px';
    selectedDesigner.style.top = newY + 'px';

    // Store detailed configuration based on element type
    let config;
    switch (newType) {
        case ELEMENT_TYPE_TEXT:
            config = getTextElementConfig();
            break;
        case ELEMENT_TYPE_STATIC_IMAGE:
            config = getStaticImageElementConfig();
            break;
        case ELEMENT_TYPE_GRAPH:
            config = getGraphElementConfig();
            break;
        case ELEMENT_TYPE_CONDITIONAL_IMAGE:
            config = getConditionalImageElementConfig();
            break;
        default:
            config = {};
    }

    // Store configuration as a data attribute
    selectedList.setAttribute('data-config', JSON.stringify(config));
    selectedDesigner.setAttribute('data-config', JSON.stringify(config));

    // Update the visual preview of the element
    updateElementPreview();

    console.log(`Applied form values to element ${newName}:`, config);
}
