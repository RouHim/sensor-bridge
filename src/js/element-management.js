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

    // Show relevant config panel
    switch (selectedType) {
        case ELEMENT_TYPE_TEXT:
            layoutTextConfig.style.display = 'block';
            break;
        case ELEMENT_TYPE_STATIC_IMAGE:
            layoutStaticImageConfig.style.display = 'block';
            break;
        case ELEMENT_TYPE_GRAPH:
            layoutGraphConfig.style.display = 'block';
            break;
        case ELEMENT_TYPE_CONDITIONAL_IMAGE:
            layoutConditionalImageConfig.style.display = 'block';
            break;
    }

    // If we have a selected element, update its type immediately
    const selectedList = getSelectedListElement();
    const selectedDesigner = getSelectedDesignerElement();

    if (selectedList && selectedDesigner) {
        // Update the element type attributes
        selectedList.setAttribute(ATTR_ELEMENT_TYPE, selectedType);
        selectedDesigner.setAttribute(ATTR_ELEMENT_TYPE, selectedType);

        // Clear any existing configuration for the old type
        selectedList.removeAttribute('data-config');
        selectedDesigner.removeAttribute('data-config');

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

    // Create list item
    const listItem = createListElement(elementId, elementName, ELEMENT_TYPE_TEXT);
    lstDesignerPlacedElements.appendChild(listItem);

    // Create designer element
    const designerElement = createDesignerElement(elementId, elementName, ELEMENT_TYPE_TEXT, 0, 0);
    designerPane.appendChild(designerElement);

    // Select the new element
    selectElement(listItem, designerElement);
}

/**
 * Removes the currently selected element
 */
export function removeElement() {
    const selectedList = getSelectedListElement();
    const selectedDesigner = getSelectedDesignerElement();

    if (!selectedList || !selectedDesigner) {
        alert('Please select an element to remove.');
        return;
    }

    const confirmRemoval = confirm('Are you sure you want to remove this element?');
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

    // Offset position slightly
    const currentX = parseInt(selectedDesigner.getAttribute(ATTR_ELEMENT_POSITION_X) || 0);
    const currentY = parseInt(selectedDesigner.getAttribute(ATTR_ELEMENT_POSITION_Y) || 0);
    newDesignerElement.setAttribute(ATTR_ELEMENT_POSITION_X, currentX + 10);
    newDesignerElement.setAttribute(ATTR_ELEMENT_POSITION_Y, currentY + 10);
    newDesignerElement.style.left = (currentX + 10) + 'px';
    newDesignerElement.style.top = (currentY + 10) + 'px';

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
        const {id, name, element_type, x, y, text_config, image_config, graph_config, conditional_image_config} = elementData;

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
        const designerElement = createDesignerElement(elementId, elementName, elementType, posX, posY);

        // Store configuration in designer element too
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

function createDesignerElement(id, name, type, x, y) {
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
    cmbElementType.value = '';
    txtElementPositionX.value = '';
    txtElementPositionY.value = '';
}

function updateElementForm() {
    const selectedList = getSelectedListElement();
    if (!selectedList) return;

    // Load basic properties
    txtElementName.value = selectedList.getAttribute(ATTR_ELEMENT_NAME) || '';
    cmbElementType.value = selectedList.getAttribute(ATTR_ELEMENT_TYPE) || '';
    txtElementPositionX.value = selectedList.getAttribute(ATTR_ELEMENT_POSITION_X) || '';
    txtElementPositionY.value = selectedList.getAttribute(ATTR_ELEMENT_POSITION_Y) || '';

    // Load detailed configuration if available
    const configAttr = selectedList.getAttribute('data-config');
    if (configAttr) {
        try {
            const config = JSON.parse(configAttr);
            loadConfigIntoForm(config, selectedList.getAttribute(ATTR_ELEMENT_TYPE));
        } catch (error) {
            console.warn('Failed to parse element config:', error);
        }
    }

    // Trigger element type change to show correct config panel
    onElementTypeChange();
}

/**
 * Loads configuration data into form fields based on element type
 */
function loadConfigIntoForm(config, elementType) {
    switch (elementType) {
        case ELEMENT_TYPE_TEXT:
            if (txtTextFormat) txtTextFormat.value = config.format || '{value} {unit}';
            if (cmbTextFontFamily) cmbTextFontFamily.value = config.fontFamily || 'Arial';
            if (txtTextFontSize) txtTextFontSize.value = config.fontSize || 12;
            if (txtTextFontColor) txtTextFontColor.value = config.fontColor || '#ffffffff';
            if (txtTextWidth) txtTextWidth.value = config.width || 100;
            if (txtTextHeight) txtTextHeight.value = config.height || 20;
            if (cmbTextAlignment) cmbTextAlignment.value = config.alignment || 'left';
            break;

        case ELEMENT_TYPE_STATIC_IMAGE:
            if (txtStaticImageFile) txtStaticImageFile.value = config.imagePath || '';
            if (txtStaticImageWidth) txtStaticImageWidth.value = config.width || 100;
            if (txtStaticImageHeight) txtStaticImageHeight.value = config.height || 100;
            break;

        case ELEMENT_TYPE_GRAPH:
            if (cmbGraphSensorIdSelection) cmbGraphSensorIdSelection.value = config.sensorId || '';
            if (txtGraphMinValue) txtGraphMinValue.value = config.minValue || '';
            if (txtGraphMaxValue) txtGraphMaxValue.value = config.maxValue || '';
            if (txtGraphWidth) txtGraphWidth.value = config.width || 200;
            if (txtGraphHeight) txtGraphHeight.value = config.height || 50;
            if (cmbGraphType) cmbGraphType.value = config.type || 'line';
            if (txtGraphColor) txtGraphColor.value = config.color || '#000000';
            if (txtGraphStrokeWidth) txtGraphStrokeWidth.value = config.strokeWidth || 1;
            if (txtGraphBackgroundColor) txtGraphBackgroundColor.value = config.backgroundColor || '#00000000';
            if (txtGraphBorderColor) txtGraphBorderColor.value = config.borderColor || '#00000000';
            break;

        case ELEMENT_TYPE_CONDITIONAL_IMAGE:
            if (cmbConditionalImageSensorIdSelection) cmbConditionalImageSensorIdSelection.value = config.sensorId || '';
            if (txtConditionalImageImagesPath) txtConditionalImageImagesPath.value = config.imagesPath || '';
            if (txtConditionalImageWidth) txtConditionalImageWidth.value = config.width || 100;
            if (txtConditionalImageHeight) txtConditionalImageHeight.value = config.height || 100;
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
        format: txtTextFormat?.value || '{value} {unit}',
        fontFamily: cmbTextFontFamily?.value || 'Arial',
        fontSize: parseInt(txtTextFontSize?.value) || 12,
        fontColor: txtTextFontColor?.value || '#ffffffff',  // Match HTML default
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
        imagePath: txtStaticImageFile?.value || '',
        width: parseInt(txtStaticImageWidth?.value) || 100,
        height: parseInt(txtStaticImageHeight?.value) || 100
    };
}

/**
 * Gets configuration data for a graph element
 */
function getGraphElementConfig() {
    return {
        sensorId: cmbGraphSensorIdSelection?.value || '',
        minValue: txtGraphMinValue?.value || null,
        maxValue: txtGraphMaxValue?.value || null,
        width: parseInt(txtGraphWidth?.value) || 200,
        height: parseInt(txtGraphHeight?.value) || 50,
        type: cmbGraphType?.value || 'line',
        color: txtGraphColor?.value || '#000000ff',
        strokeWidth: parseInt(txtGraphStrokeWidth?.value) || 1,
        backgroundColor: txtGraphBackgroundColor?.value || '#00000000',
        borderColor: txtGraphBorderColor?.value || '#00000000'
    };
}

/**
 * Gets configuration data for a conditional image element
 */
function getConditionalImageElementConfig() {
    return {
        sensorId: cmbConditionalImageSensorIdSelection?.value || '',
        imagesPath: txtConditionalImageImagesPath?.value || '',
        width: parseInt(txtConditionalImageWidth?.value) || 100,
        height: parseInt(txtConditionalImageHeight?.value) || 100
    };
}

/**
 * Renders a text element preview
 */
function renderTextElementPreview(config) {
    const div = document.createElement('div');
    div.style.fontFamily = config.fontFamily;
    div.style.fontSize = `${config.fontSize}px`;
    div.style.color = config.fontColor;
    div.style.width = `${config.width}px`;
    div.style.height = `${config.height}px`;
    div.style.textAlign = config.alignment;
    div.style.overflow = 'hidden';
    div.style.lineHeight = `${config.height}px`;
    div.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    div.style.border = '1px solid #666';

    // Replace placeholders with sample data
    let previewText = config.format;
    previewText = previewText.replace(/{value}/g, '42.5');
    previewText = previewText.replace(/{unit}/g, '°C');
    previewText = previewText.replace(/{value-avg}/g, '41.2');
    previewText = previewText.replace(/{value-min}/g, '38.1');
    previewText = previewText.replace(/{value-max}/g, '45.3');

    div.textContent = previewText;
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

    if (config.imagePath) {
        const img = document.createElement('img');
        // Convert the file path to a secure URL that Tauri can access using global API
        img.src = window.__TAURI__.core.convertFileSrc(config.imagePath);
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
function renderGraphElementPreview(config) {
    const container = document.createElement('div');
    container.style.width = `${config.width}px`;
    container.style.height = `${config.height}px`;
    container.style.backgroundColor = config.backgroundColor;
    container.style.border = `1px solid ${config.borderColor === 'transparent' ? '#666' : config.borderColor}`;
    container.style.position = 'relative';

    // Create SVG for graph preview
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', config.width);
    svg.setAttribute('height', config.height);
    svg.style.display = 'block';

    // Generate sample data points
    const points = [];
    const numPoints = Math.min(config.width / 4, 20);
    for (let i = 0; i < numPoints; i++) {
        const x = (i / (numPoints - 1)) * config.width;
        const y = config.height - (Math.sin(i * 0.5) * 0.3 + 0.5 + Math.random() * 0.2) * config.height;
        points.push(`${x},${y}`);
    }

    if (config.type === 'line-fill') {
        // Create filled area
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const fillPoints = `0,${config.height} ${points.join(' ')} ${config.width},${config.height}`;
        polygon.setAttribute('points', fillPoints);
        polygon.setAttribute('fill', config.color + '40'); // Add transparency
        polygon.setAttribute('stroke', 'none');
        svg.appendChild(polygon);
    }

    // Create line
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', points.join(' '));
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', config.color);
    polyline.setAttribute('stroke-width', config.strokeWidth);
    svg.appendChild(polyline);

    container.appendChild(svg);
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

    if (config.imagesPath) {
        div.innerHTML = `
            <div style="font-size: 14px; margin-bottom: 2px;">🔄</div>
            <div style="text-align: center; word-break: break-all;">Conditional Image</div>
            <div style="font-size: 8px; opacity: 0.7;">${config.imagesPath}</div>
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
function applyFormToSelectedElement() {
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
