// Element management functionality for LCD display elements

// Global drag state management
const globalDragState = {
    isDragging: false,
    currentElement: null,
    startPosition: { x: 0, y: 0 },
    initialPosition: { x: 0, y: 0 },
    deferredOperations: []
};

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
    txtConditionalImageMinValue,
    txtConditionalImageMaxValue,
    txtConditionalImageWidth,
    txtConditionalImageHeight,
    cmbConditionalImageCatalogEntrySelection
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
    if (!designerPane) {
        return;
    }

    const width = parseInt(txtDisplayResolutionWidth.value);
    const height = parseInt(txtDisplayResolutionHeight.value);

    // Update the designer pane dimensions to match the display resolution
    designerPane.style.width = `${width}px`;
    designerPane.style.height = `${height}px`;

    console.log(`Updated display design pane dimensions to ${width}x${height}`);
}

/**
 * Initializes global drag safety mechanisms
 */
export function initializeDragSafety() {
    // Window-level mouse up handler to catch missed mouseup events
    window.addEventListener('mouseup', () => {
        if (globalDragState.isDragging) {
            console.warn('Window mouseup detected during drag - cleaning up drag state');
            cleanupAnyStuckDragStates();

            // If we have a current element, execute deferred operations
            if (globalDragState.currentElement) {
                const element = globalDragState.currentElement;
                const currentX = parseInt(element.style.left) || 0;
                const currentY = parseInt(element.style.top) || 0;
                executeDeferredDragOperations(element, currentX, currentY);
            }
        }
    });

    // Page visibility change handler (user switches tabs/windows during drag)
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && globalDragState.isDragging) {
            console.warn('Page visibility changed during drag - cleaning up drag state');
            cleanupAnyStuckDragStates();
        }
    });

    // Escape key handler to cancel drag operations
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && globalDragState.isDragging) {
            console.log('Escape key pressed during drag - cancelling drag operation');
            cleanupAnyStuckDragStates();
        }
    });

    console.log('Drag safety mechanisms initialized');
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
export async function addNewElement() {
    // Store the current element info before validation check
    const previousElement = getSelectedListElement();
    const previousElementName = previousElement ? previousElement.getAttribute(ATTR_ELEMENT_NAME) : 'None';

    console.log(`Adding new element, current selection: ${previousElementName}`);

    // Check if we can leave the current element (modal validation)
    const canLeave = await canLeaveCurrentElement();
    if (!canLeave) {
        console.log('Cannot leave current element, canceling new element creation');
        return; // Don't create new element
    }

    const elementId = generateElementId();
    const elementName = `Element ${elementId}`;

    console.log(`Creating new element: ${elementName}`);

    // Create list item with reasonable default position
    const listItem = createListElement(elementId, elementName, ELEMENT_TYPE_TEXT);
    // Set default position attributes
    listItem.setAttribute(ATTR_ELEMENT_POSITION_X, '10');
    listItem.setAttribute(ATTR_ELEMENT_POSITION_Y, '10');
    // Mark as new/untouched
    listItem.setAttribute('data-touched', 'false');
    lstDesignerPlacedElements.appendChild(listItem);

    // Create designer element with reasonable default position (offset from top-left)
    const defaultX = 10;
    const defaultY = 10;
    const designerElement = createDesignerElement(elementId, elementName, ELEMENT_TYPE_TEXT, defaultX, defaultY, null);
    designerPane.appendChild(designerElement);

    // IMPORTANT: Clear form BEFORE selection to avoid contamination
    clearElementForm();

    console.log(`Selecting new element: ${elementName}`);

    // Select the new element (skip validation check and display for clean start)
    await selectElement(listItem, designerElement, true, true);

    // Apply default configuration for text elements
    applyFormToSelectedElement();

    // Setup event handlers for the new element (if not already set up in createListElement/createDesignerElement)
    setupElementEventHandlers(listItem, designerElement);

    console.log(`New element created and selected: ${elementName}`);

    // Don't validate immediately - let user work with the new element
    // Validation will only occur when they try to navigate away or make changes
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

    // Find the element to select after deletion (previous sibling preferred)
    let elementToSelectAfterDeletion = selectedList.previousElementSibling;
    if (!elementToSelectAfterDeletion) {
        // If no previous sibling, try next sibling
        elementToSelectAfterDeletion = selectedList.nextElementSibling;
    }

    // Get the corresponding designer element for the element we'll select
    let designerElementToSelect = null;
    if (elementToSelectAfterDeletion) {
        const elementId = elementToSelectAfterDeletion.getAttribute(ATTR_ELEMENT_ID);
        designerElementToSelect = document.getElementById(DESIGNER_ID_PREFIX + elementId);
    }

    // Use Tauri's dialog plugin instead of browser confirm()
    const confirmRemoval = await window.__TAURI__.dialog.ask(
        'Are you sure you want to remove this element?\n\nThis action cannot be undone.',
        {
            title: 'Remove Element',
            kind: 'warning'
        }
    );

    if (!confirmRemoval) {
        return;
    }

    // Remove from DOM
    selectedList.remove();
    selectedDesigner.remove();

    // Auto-select the next best element if available
    if (elementToSelectAfterDeletion && designerElementToSelect) {
        selectElement(elementToSelectAfterDeletion, designerElementToSelect);
    } else {
        // No elements left to select
        setSelectedListElement(null);
        setSelectedDesignerElement(null);
        clearElementForm();
    }
}

/**
 * Moves the selected element up in the list
 */
export function moveElementUp() {
    const selectedList = getSelectedListElement();
    if (!selectedList || !selectedList.previousElementSibling) {
        return;
    }

    selectedList.parentNode.insertBefore(selectedList, selectedList.previousElementSibling);
}

/**
 * Moves the selected element down in the list
 */
export function moveElementDown() {
    const selectedList = getSelectedListElement();
    if (!selectedList || !selectedList.nextElementSibling) {
        return;
    }

    selectedList.parentNode.insertBefore(selectedList.nextElementSibling, selectedList);
}

/**
 * Duplicates the currently selected element
 */
export async function duplicateElement() {
    const selectedList = getSelectedListElement();
    const selectedDesigner = getSelectedDesignerElement();

    if (!selectedList || !selectedDesigner) {
        alert('Please select an element to duplicate.');
        return;
    }

    // Check if we can leave the current element (modal validation)
    const canLeave = await canLeaveCurrentElement();
    if (!canLeave) {
        return; // Don't duplicate
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
    newDesignerElement.style.left = currentX + 20 + 'px';
    newDesignerElement.style.top = currentY + 20 + 'px';

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

/**
 * Fast position update for form inputs during drag (no attribute updates)
 */
function updateFormPositionInputsOnly(x, y) {
    if (txtElementPositionX) {
        txtElementPositionX.value = x;
    }
    if (txtElementPositionY) {
        txtElementPositionY.value = y;
    }
}

/**
 * Executes deferred operations after drag completion
 */
function executeDeferredDragOperations(element, x, y) {
    console.log('Executing deferred drag operations');

    // Small delay to ensure drag operations are fully complete
    setTimeout(() => {
        // Update element position with all attributes
        updateElementPosition(element, x, y);

        // Update form to reflect all changes
        updateElementForm();

        // Mark element as touched for validation
        markCurrentElementAsTouched();

        // Apply form values and trigger preview update
        applyFormToSelectedElement();

        console.log('Deferred drag operations completed');
    }, 10); // 10ms delay for smooth completion
}

/**
 * Resets global drag state safely
 */
function resetGlobalDragState() {
    const wasInDragMode = globalDragState.isDragging;

    globalDragState.isDragging = false;
    globalDragState.currentElement = null;
    globalDragState.startPosition = { x: 0, y: 0 };
    globalDragState.initialPosition = { x: 0, y: 0 };
    globalDragState.deferredOperations = [];

    if (wasInDragMode) {
        console.log('Global drag state reset');
    }
}

/**
 * Emergency cleanup for stuck drag states
 */
function cleanupAnyStuckDragStates() {
    // Remove dragging class from any elements that might have it
    const draggingElements = document.querySelectorAll('.designer-element.dragging');
    draggingElements.forEach(el => {
        el.classList.remove('dragging');
        el.style.cursor = '';
    });

    // Reset global state
    resetGlobalDragState();

    if (draggingElements.length > 0) {
        console.log(`Cleaned up ${draggingElements.length} stuck drag states`);
    }
}

/**
 * Validates a text element configuration
 * @param {Object} config - Text element configuration
 * @param {string} elementName - Element name for error reporting
 * @returns {Array} Array of validation error messages
 */
function validateTextElement(config, elementName) {
    const errors = [];

    if (!config.sensor_id || config.sensor_id.trim() === '') {
        errors.push(`${elementName}: Please select a sensor`);
    }

    if (!config.format || config.format.trim() === '') {
        errors.push(`${elementName}: Text format cannot be empty`);
    }

    if (!config.font_size || config.font_size <= 0) {
        errors.push(`${elementName}: Font size must be a positive number`);
    }

    if (!config.width || config.width <= 0) {
        errors.push(`${elementName}: Width must be a positive number`);
    }

    if (!config.height || config.height <= 0) {
        errors.push(`${elementName}: Height must be a positive number`);
    }

    return errors;
}

/**
 * Validates a static image element configuration
 * @param {Object} config - Static image element configuration
 * @param {string} elementName - Element name for error reporting
 * @returns {Array} Array of validation error messages
 */
function validateStaticImageElement(config, elementName) {
    const errors = [];

    if (!config.image_path || config.image_path.trim() === '') {
        errors.push(`${elementName}: Please select an image file`);
    }

    if (!config.width || config.width <= 0) {
        errors.push(`${elementName}: Width must be a positive number`);
    }

    if (!config.height || config.height <= 0) {
        errors.push(`${elementName}: Height must be a positive number`);
    }

    return errors;
}

/**
 * Validates a graph element configuration
 * @param {Object} config - Graph element configuration
 * @param {string} elementName - Element name for error reporting
 * @returns {Array} Array of validation error messages
 */
function validateGraphElement(config, elementName) {
    const errors = [];

    if (!config.sensor_id || config.sensor_id.trim() === '') {
        errors.push(`${elementName}: Please select a sensor`);
    }

    if (!config.width || config.width <= 0) {
        errors.push(`${elementName}: Width must be a positive number`);
    }

    if (!config.height || config.height <= 0) {
        errors.push(`${elementName}: Height must be a positive number`);
    }

    if (config.min_sensor_value !== null && config.max_sensor_value !== null) {
        if (config.min_sensor_value >= config.max_sensor_value) {
            errors.push(`${elementName}: Minimum sensor value must be less than maximum sensor value`);
        }
    }

    if (!config.graph_stroke_width || config.graph_stroke_width <= 0) {
        errors.push(`${elementName}: Stroke width must be a positive number`);
    }

    return errors;
}

/**
 * Validates a conditional image element configuration
 * @param {Object} config - Conditional image element configuration
 * @param {string} elementName - Element name for error reporting
 * @returns {Array} Array of validation error messages
 */
function validateConditionalImageElement(config, elementName) {
    const errors = [];

    if (!config.sensor_id || config.sensor_id.trim() === '') {
        errors.push(`${elementName}: Please select a sensor`);
    }

    if (!config.images_path || config.images_path.trim() === '') {
        errors.push(`${elementName}: Please select an images path or catalog entry`);
    }

    if (!config.width || config.width <= 0) {
        errors.push(`${elementName}: Width must be a positive number`);
    }

    if (!config.height || config.height <= 0) {
        errors.push(`${elementName}: Height must be a positive number`);
    }

    if (config.min_sensor_value >= config.max_sensor_value) {
        errors.push(`${elementName}: Minimum sensor value must be less than maximum sensor value`);
    }

    return errors;
}

/**
 * Gets configuration for a specific element by generating it from the stored data or form
 * @param {Object} element - Element data
 * @param {HTMLElement} listElement - The list element DOM node
 * @returns {Object} Configuration object for the element
 */
function getElementConfigForValidation(element, listElement) {
    // Try to get config from stored data first
    const configAttr = listElement.getAttribute('data-config');
    if (configAttr) {
        try {
            return JSON.parse(configAttr);
        } catch (error) {
            console.warn('Failed to parse element config:', error);
        }
    }

    // If no stored config, generate default config based on type
    switch (element.element_type) {
    case ELEMENT_TYPE_TEXT:
        return {
            sensor_id: '', // Empty for new elements
            value_modifier: 'none',
            format: '{value} {unit}',
            font_family: 'Arial',
            font_size: 12,
            font_color: '#ffffffff',
            width: 100,
            height: 20,
            alignment: 'left'
        };

    case ELEMENT_TYPE_STATIC_IMAGE:
        return {
            image_path: '', // Empty for new elements
            width: 100,
            height: 100
        };

    case ELEMENT_TYPE_GRAPH:
        return {
            sensor_id: '', // Empty for new elements
            sensor_values: [],
            min_sensor_value: null,
            max_sensor_value: null,
            width: 200,
            height: 50,
            graph_type: 'line',
            graph_color: '#0066ccff',
            graph_stroke_width: 2,
            background_color: '#00000000',
            border_color: '#ffffff00'
        };

    case ELEMENT_TYPE_CONDITIONAL_IMAGE:
        return {
            sensor_id: '', // Empty for new elements
            sensor_value: '',
            images_path: '', // Empty for new elements
            min_sensor_value: 0.0,
            max_sensor_value: 100.0,
            width: 130,
            height: 25
        };

    default:
        return {};
    }
}

/**
 * Validates all elements in the current configuration
 * @returns {Array} Array of validation error messages
 */
function validateAllElements() {
    const errors = [];
    const listElements = lstDesignerPlacedElements.querySelectorAll('li');

    if (listElements.length === 0) {
        errors.push('No elements to save. Please add at least one element.');
        return errors;
    }

    listElements.forEach(li => {
        const element = {
            id: li.getAttribute(ATTR_ELEMENT_ID),
            name: li.getAttribute(ATTR_ELEMENT_NAME),
            element_type: li.getAttribute(ATTR_ELEMENT_TYPE)
        };

        const elementName = element.name || `Element ${element.id}`;
        const configToValidate = getElementConfigForValidation(element, li);

        switch (element.element_type) {
        case ELEMENT_TYPE_TEXT:
            errors.push(...validateTextElement(configToValidate, elementName));
            break;

        case ELEMENT_TYPE_STATIC_IMAGE:
            errors.push(...validateStaticImageElement(configToValidate, elementName));
            break;

        case ELEMENT_TYPE_GRAPH:
            errors.push(...validateGraphElement(configToValidate, elementName));
            break;

        case ELEMENT_TYPE_CONDITIONAL_IMAGE:
            errors.push(...validateConditionalImageElement(configToValidate, elementName));
            break;

        default:
            errors.push(`${elementName}: Unknown element type: ${element.element_type}`);
        }
    });

    return errors;
}

/**
 * Validates the currently selected element
 * @returns {Object} Object with isValid boolean and errors array
 */
// eslint-disable-next-line no-unused-vars
function validateCurrentElement() {
    const selectedList = getSelectedListElement();
    if (!selectedList) {
        return { isValid: true, errors: [] }; // No element selected is considered valid
    }

    const element = {
        id: selectedList.getAttribute(ATTR_ELEMENT_ID),
        name: selectedList.getAttribute(ATTR_ELEMENT_NAME),
        element_type: selectedList.getAttribute(ATTR_ELEMENT_TYPE)
    };

    const elementName = element.name || `Element ${element.id}`;
    const configToValidate = getElementConfigForValidation(element, selectedList);

    let errors = [];

    switch (element.element_type) {
    case ELEMENT_TYPE_TEXT:
        errors = validateTextElement(configToValidate, elementName);
        break;

    case ELEMENT_TYPE_STATIC_IMAGE:
        errors = validateStaticImageElement(configToValidate, elementName);
        break;

    case ELEMENT_TYPE_GRAPH:
        errors = validateGraphElement(configToValidate, elementName);
        break;

    case ELEMENT_TYPE_CONDITIONAL_IMAGE:
        errors = validateConditionalImageElement(configToValidate, elementName);
        break;

    default:
        errors = [`${elementName}: Unknown element type: ${element.element_type}`];
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * Updates the validation state visual indicators for an element
 * @param {HTMLElement} listElement - The list element to update
 */
function updateElementValidationState(listElement) {
    if (!listElement) {
        console.warn('updateElementValidationState called with null element');
        return;
    }

    const elementName = listElement.getAttribute(ATTR_ELEMENT_NAME) || 'Unknown';
    console.log('Validating element:', elementName);

    // Validate the element directly without changing selection
    const validationResult = validateElementDirectly(listElement);

    // Update visual indicators for the SPECIFIC element passed in
    // Only show indicators for INVALID elements - valid elements look normal
    if (validationResult.isValid) {
        listElement.classList.remove('invalid');
        listElement.classList.remove('valid'); // Remove any existing valid class
        listElement.title = ''; // Clear title
    } else {
        listElement.classList.remove('valid');
        listElement.classList.add('invalid');
        listElement.title = 'Invalid: ' + validationResult.errors.join('; ');
    }
}

/**
 * Validates an element directly without changing selection state
 * @param {HTMLElement} listElement - The list element to validate
 * @returns {Object} Object with isValid boolean and errors array
 */
function validateElementDirectly(listElement) {
    if (!listElement) {
        return { isValid: true, errors: [] };
    }

    const element = {
        id: listElement.getAttribute(ATTR_ELEMENT_ID),
        name: listElement.getAttribute(ATTR_ELEMENT_NAME),
        element_type: listElement.getAttribute(ATTR_ELEMENT_TYPE)
    };

    const elementName = element.name || `Element ${element.id}`;
    const configToValidate = getElementConfigForValidation(element, listElement);

    let errors = [];

    switch (element.element_type) {
    case ELEMENT_TYPE_TEXT:
        errors = validateTextElement(configToValidate, elementName);
        break;

    case ELEMENT_TYPE_STATIC_IMAGE:
        errors = validateStaticImageElement(configToValidate, elementName);
        break;

    case ELEMENT_TYPE_GRAPH:
        errors = validateGraphElement(configToValidate, elementName);
        break;

    case ELEMENT_TYPE_CONDITIONAL_IMAGE:
        errors = validateConditionalImageElement(configToValidate, elementName);
        break;

    default:
        errors = [`${elementName}: Unknown element type: ${element.element_type}`];
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * Updates validation only if the current element has been "touched" (modified after creation)
 */
export function updateValidationIfElementTouched() {
    const currentElement = getSelectedListElement();
    if (!currentElement) {
        return;
    }

    // Check if element has been marked as "touched"
    const isTouched = currentElement.getAttribute('data-touched') === 'true';

    if (isTouched) {
        updateElementValidationState(currentElement);
    }
}

/**
 * Updates validation states for all elements in the list
 */
export function updateAllElementValidationStates() {
    const listElements = lstDesignerPlacedElements.querySelectorAll('li');
    listElements.forEach(listElement => {
        updateElementValidationState(listElement);
    });
}

/**
 * Marks the current element as "touched" (user has made changes)
 */
export function markCurrentElementAsTouched() {
    // Skip validation operations during drag for performance
    if (globalDragState.isDragging) {
        console.log('Skipping markCurrentElementAsTouched during drag operation');
        return;
    }

    const currentElement = getSelectedListElement();
    if (currentElement) {
        currentElement.setAttribute('data-touched', 'true');
        // Now that it's touched, we can show validation - but only for this specific element
        updateElementValidationState(currentElement);
    }
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

        // Validate all elements before saving
        const validationErrors = validateAllElements();
        if (validationErrors.length > 0) {
            const errorMessage = 'Configuration validation failed:\n\n' + validationErrors.join('\n');
            alert(errorMessage);
            console.warn('Validation errors:', validationErrors);
            return;
        }

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

        await invoke('update_client_display_config', { macAddress, displayConfig: JSON.stringify(displayConfig) });
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
        const { id, name, element_type, x, y, text_config, image_config, graph_config, conditional_image_config } =
            elementData;

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

    // Update validation states for all loaded elements
    updateAllElementValidationStates();
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

// Global drag state management
let isDragModeActive = false;

/**
 * Sets the global drag mode state
 * @param {boolean} active - Whether drag mode is active
 */
// eslint-disable-next-line no-unused-vars
function setDragMode(active) {
    isDragModeActive = active;
    if (active) {
        console.log('🎯 Drag mode activated - preview updates disabled');
    } else {
        console.log('✅ Drag mode deactivated - preview updates enabled');
    }
}

/**
 * Checks if drag mode is currently active
 * @returns {boolean} True if drag mode is active
 */
function isDragMode() {
    return isDragModeActive;
}

/**
 * Updates the preview of the currently selected element
 */
export function updateElementPreview() {
    // Skip expensive preview rendering during drag operations
    if (isDragMode()) {
        console.log('⏭️ Skipping preview update - drag mode active');
        return;
    }

    const selectedDesigner = getSelectedDesignerElement();
    if (!selectedDesigner) {
        return;
    }

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
    case ELEMENT_TYPE_CONDITIONAL_IMAGE: {
        const elementId = selectedDesigner.getAttribute(ATTR_ELEMENT_ID);
        preview = renderConditionalImageElementPreview(getConditionalImageElementConfig(), elementId);
        break;
    }
    }

    if (preview) {
        // Clear existing content but preserve the designer element attributes and position
        selectedDesigner.innerHTML = '';
        selectedDesigner.appendChild(preview);
    }
}

// Helper functions

function generateElementId() {
    // Get all existing element IDs from the list
    const existingIds = [];
    if (lstDesignerPlacedElements) {
        const listElements = lstDesignerPlacedElements.querySelectorAll('li');
        listElements.forEach(li => {
            const id = li.getAttribute(ATTR_ELEMENT_ID);
            // Only consider numeric IDs for sequential numbering
            const numericId = parseInt(id);
            if (!isNaN(numericId) && numericId > 0) {
                existingIds.push(numericId);
            }
        });
    }

    // Find the next available sequential number
    existingIds.sort((a, b) => a - b);

    // Start from 1 and find the first gap or next number
    let nextId = 1;
    for (const id of existingIds) {
        if (id === nextId) {
            nextId++;
        } else if (id > nextId) {
            break; // Found a gap, use nextId
        }
    }

    return nextId.toString();
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
        preview = renderConditionalImageElementPreview(config || getConditionalImageElementConfig(), id);
        break;
    }

    if (preview) {
        // Clear existing content
        div.innerHTML = '';
        div.appendChild(preview);
    }

    return div;
}

async function selectElement(listElement, designerElement, skipValidation = false, skipValidationDisplay = false) {
    // Skip validation check if this is a re-selection after validation dialog
    if (!skipValidation) {
        // Check if we can leave the current element (if any)
        const canLeave = await canLeaveCurrentElement();
        if (!canLeave) {
            return false; // Prevent selection change
        }
    }

    // Clear previous selection
    clearElementSelection();

    // Set new selection
    setSelectedListElement(listElement);
    setSelectedDesignerElement(designerElement);

    // Visual feedback
    listElement.classList.add('selected');
    designerElement.classList.add('selected');

    // Make designer pane focusable for keyboard events
    if (designerPane) {
        designerPane.setAttribute('tabindex', '0');
        // Note: Focus removed to prevent jumping to designer pane when selecting from list
    }

    // Update form
    updateElementForm();

    // Only show validation state if not skipped (e.g., for new elements)
    if (!skipValidationDisplay) {
        updateElementValidationState(listElement);
    }

    return true; // Selection successful
}

/**
 * Checks if the user can leave the currently selected element
 * @returns {Promise<boolean>} True if can leave, false if validation prevents it
 */
async function canLeaveCurrentElement() {
    const currentElement = getSelectedListElement();
    if (!currentElement) {
        return true; // No current element, can select anything
    }

    // Check if element still exists in DOM (fixes bug where validation dialog appears for deleted elements)
    if (!currentElement.isConnected) {
        // Element was deleted, clear selection state and allow proceeding
        setSelectedListElement(null);
        setSelectedDesignerElement(null);
        return true;
    }

    // Apply current form values first
    applyFormToSelectedElement();

    // Check if current element is valid - use direct validation to avoid selection confusion
    const validationResult = validateElementDirectly(currentElement);

    if (!validationResult.isValid) {
        // Store current selection info before dialog (dialogs can interfere with focus)

        // Show validation dialog with fix/delete options
        const shouldDelete = await showValidationDialog(currentElement, validationResult);

        if (shouldDelete) {
            // Delete the invalid element
            await deleteInvalidElement(currentElement);
            return true; // Can proceed after deletion
        } else {
            // User chose to fix - restore proper selection after dialog
            await ensureElementStaysSelected(currentElement);

            // Add visual feedback for locked state
            currentElement.classList.add('validation-locked');
            setTimeout(() => {
                currentElement.classList.remove('validation-locked');
            }, 2000);

            return false; // Stay with current element to fix
        }
    }

    return true; // Element is valid, can leave
}

/**
 * Shows validation dialog with fix/delete options
 * @param {HTMLElement} element - The invalid element
 * @param {Object} validationResult - Validation result with errors
 * @returns {Promise<boolean>} True if user chose to delete, false to fix
 */
async function showValidationDialog(element, validationResult) {
    const elementName = element.getAttribute(ATTR_ELEMENT_NAME) || 'Current element';
    const elementType = element.getAttribute(ATTR_ELEMENT_TYPE) || 'element';

    let helpText = '';
    if (elementType === 'text') {
        helpText = '💡 To fix: Select a sensor and enter valid dimensions.';
    } else if (elementType === 'static-image') {
        helpText = '💡 To fix: Select an image file and enter valid dimensions.';
    } else if (elementType === 'graph') {
        helpText = '💡 To fix: Select a sensor and enter valid graph dimensions.';
    } else if (elementType === 'conditional-image') {
        helpText = '💡 To fix: Select a sensor, image path, and valid dimensions.';
    }

    const errorList = validationResult.errors.map(error => `• ${error.replace(elementName + ': ', '')}`).join('\n');

    const dialogMessage =
        `🔒 Cannot leave "${elementName}" - Validation Required\n\n` +
        `Issues found:\n${errorList}\n\n` +
        `${helpText}\n\n` +
        'What would you like to do?';

    try {
        // Use Tauri's ask dialog with custom options
        const result = await window.__TAURI__.dialog.ask(dialogMessage, {
            title: 'Element Validation Required',
            kind: 'warning',
            okLabel: 'Fix Issues',
            cancelLabel: 'Delete Element'
        });

        return !result; // True = Fix (OK), False = Delete (Cancel), so we invert
    } catch (error) {
        console.error('Dialog error:', error);
        // Fallback to simple confirm dialog
        return confirm(`${dialogMessage}\n\n` + 'Click OK to fix issues, or Cancel to delete the element.') === false; // Invert: Cancel = delete (true), OK = fix (false)
    }
}

/**
 * Ensures the element stays properly selected after validation dialog
 * @param {HTMLElement} listElement - The element that should remain selected
 */
async function ensureElementStaysSelected(listElement) {
    const elementId = listElement.getAttribute(ATTR_ELEMENT_ID);
    const designerElement = document.getElementById(DESIGNER_ID_PREFIX + elementId);

    // Make sure both elements are properly selected
    if (listElement && designerElement) {
        // Use selectElement with skipValidation=true to avoid recursion
        await selectElement(listElement, designerElement, true);
    }
}

/**
 * Deletes an invalid element after confirmation
 * @param {HTMLElement} element - The element to delete
 */
async function deleteInvalidElement(element) {
    const elementName = element.getAttribute(ATTR_ELEMENT_NAME) || 'Element';
    const elementId = element.getAttribute(ATTR_ELEMENT_ID);

    try {
        // Additional confirmation for deletion
        const confirmDelete = await window.__TAURI__.dialog.ask(
            `Are you sure you want to delete "${elementName}"?\n\nThis action cannot be undone.`,
            {
                title: 'Confirm Deletion',
                kind: 'warning',
                okLabel: 'Delete',
                cancelLabel: 'Cancel'
            }
        );

        if (!confirmDelete) {
            return; // User cancelled deletion
        }

        // Find corresponding designer element
        const designerElement = document.getElementById(DESIGNER_ID_PREFIX + elementId);

        // Remove from DOM
        if (designerElement) {
            designerElement.remove();
        }
        element.remove();

        // Clear selection since we deleted the selected element
        setSelectedListElement(null);
        setSelectedDesignerElement(null);
        clearElementForm();

        // Update validation states for all remaining elements
        updateAllElementValidationStates();
    } catch (error) {
        console.error('Error in delete confirmation:', error);
        // Fallback to basic confirm
        if (confirm(`Delete "${elementName}"? This cannot be undone.`)) {
            const designerElement = document.getElementById(DESIGNER_ID_PREFIX + elementId);
            if (designerElement) {
                designerElement.remove();
            }
            element.remove();
            setSelectedListElement(null);
            setSelectedDesignerElement(null);
            clearElementForm();
        }
    }
}

function clearElementSelection() {
    const currentList = getSelectedListElement();
    const currentDesigner = getSelectedDesignerElement();

    if (currentList) {
        currentList.classList.remove('selected');
    }
    if (currentDesigner) {
        currentDesigner.classList.remove('selected');
    }
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
    if (cmbTextSensorIdSelection) {
        cmbTextSensorIdSelection.value = '';
    }
    if (cmbTextSensorValueModifier) {
        cmbTextSensorValueModifier.value = 'none';
    }
    if (txtTextFormat) {
        txtTextFormat.value = '{value} {unit}';
    }
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
    if (txtTextFontSize) {
        txtTextFontSize.value = '12';
    }
    if (txtTextFontColor) {
        txtTextFontColor.value = '#ffffffff';
    }
    if (txtTextWidth) {
        txtTextWidth.value = '100';
    }
    if (txtTextHeight) {
        txtTextHeight.value = '20';
    }
    if (cmbTextAlignment) {
        cmbTextAlignment.value = 'left';
    }
}

/**
 * Sets default values for static image element configuration
 */
function setDefaultStaticImageConfig() {
    if (txtStaticImageFile) {
        txtStaticImageFile.value = '';
    }
    if (txtStaticImageWidth) {
        txtStaticImageWidth.value = '100';
    }
    if (txtStaticImageHeight) {
        txtStaticImageHeight.value = '100';
    }
}

/**
 * Sets default values for graph element configuration
 */
function setDefaultGraphConfig() {
    if (cmbGraphSensorIdSelection) {
        cmbGraphSensorIdSelection.value = '';
    }
    if (txtGraphMinValue) {
        txtGraphMinValue.value = '';
    } // Leave empty for auto-scaling
    if (txtGraphMaxValue) {
        txtGraphMaxValue.value = '';
    } // Leave empty for auto-scaling
    if (txtGraphWidth) {
        txtGraphWidth.value = '200';
    }
    if (txtGraphHeight) {
        txtGraphHeight.value = '50';
    }
    if (cmbGraphType) {
        cmbGraphType.value = 'line';
    }
    if (txtGraphColor) {
        txtGraphColor.value = '#0066ccff';
    } // Nice blue color with alpha
    if (txtGraphStrokeWidth) {
        txtGraphStrokeWidth.value = '2';
    } // Better visibility
    if (txtGraphBackgroundColor) {
        txtGraphBackgroundColor.value = '#00000000';
    } // Transparent
    if (txtGraphBorderColor) {
        txtGraphBorderColor.value = '#ffffff00';
    } // Transparent border
}

/**
 * Sets default values for conditional image element configuration
 */
function setDefaultConditionalImageConfig() {
    if (cmbConditionalImageSensorIdSelection) {
        cmbConditionalImageSensorIdSelection.value = '';
    }
    if (txtConditionalImageImagesPath) {
        txtConditionalImageImagesPath.value = '';
    }
    if (txtConditionalImageMinValue) {
        txtConditionalImageMinValue.value = '0';
    }
    if (txtConditionalImageMaxValue) {
        txtConditionalImageMaxValue.value = '100';
    }
    if (txtConditionalImageWidth) {
        txtConditionalImageWidth.value = '130';
    } // Match backend default
    if (txtConditionalImageHeight) {
        txtConditionalImageHeight.value = '25';
    } // Match backend default
}

/**
 * Updates the form fields for the selected element
 */
function updateElementForm() {
    const selectedList = getSelectedListElement();
    if (!selectedList) {
        return;
    }

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
        if (cmbTextSensorIdSelection) {
            cmbTextSensorIdSelection.value = config.sensor_id || '';
        }
        if (cmbTextSensorValueModifier) {
            cmbTextSensorValueModifier.value = config.value_modifier || 'none';
        }
        if (txtTextFormat) {
            txtTextFormat.value = config.format || '{value} {unit}';
        }
        if (cmbTextFontFamily) {
            cmbTextFontFamily.value = config.font_family || 'Arial';
        }
        if (txtTextFontSize) {
            txtTextFontSize.value = config.font_size || 12;
        }
        if (txtTextFontColor) {
            txtTextFontColor.value = config.font_color || '#ffffffff';
        }
        if (txtTextWidth) {
            txtTextWidth.value = config.width || 100;
        }
        if (txtTextHeight) {
            txtTextHeight.value = config.height || 20;
        }
        if (cmbTextAlignment) {
            cmbTextAlignment.value = config.alignment || 'left';
        }
        break;

    case ELEMENT_TYPE_STATIC_IMAGE:
        if (txtStaticImageFile) {
            txtStaticImageFile.value = config.image_path || '';
        }
        if (txtStaticImageWidth) {
            txtStaticImageWidth.value = config.width || 100;
        }
        if (txtStaticImageHeight) {
            txtStaticImageHeight.value = config.height || 100;
        }
        break;

    case ELEMENT_TYPE_GRAPH:
        if (cmbGraphSensorIdSelection) {
            cmbGraphSensorIdSelection.value = config.sensor_id || '';
        }
        if (txtGraphMinValue) {
            txtGraphMinValue.value = config.min_sensor_value || '';
        }
        if (txtGraphMaxValue) {
            txtGraphMaxValue.value = config.max_sensor_value || '';
        }
        if (txtGraphWidth) {
            txtGraphWidth.value = config.width || 200;
        }
        if (txtGraphHeight) {
            txtGraphHeight.value = config.height || 50;
        }
        if (cmbGraphType) {
            cmbGraphType.value = config.graph_type || 'line';
        }
        if (txtGraphColor) {
            txtGraphColor.value = config.graph_color || '#0066ccff';
        }
        if (txtGraphStrokeWidth) {
            txtGraphStrokeWidth.value = config.graph_stroke_width || 2;
        }
        if (txtGraphBackgroundColor) {
            txtGraphBackgroundColor.value = config.background_color || '#00000000';
        }
        if (txtGraphBorderColor) {
            txtGraphBorderColor.value = config.border_color || '#ffffff00';
        }
        break;

    case ELEMENT_TYPE_CONDITIONAL_IMAGE:
        if (cmbConditionalImageSensorIdSelection) {
            cmbConditionalImageSensorIdSelection.value = config.sensor_id || '';
        }
        if (txtConditionalImageImagesPath) {
            txtConditionalImageImagesPath.value = config.images_path || '';
        }
        if (txtConditionalImageWidth) {
            txtConditionalImageWidth.value = config.width || 130;
        }
        if (txtConditionalImageHeight) {
            txtConditionalImageHeight.value = config.height || 25;
        }
        break;
    }
}

/**
 * Fast visual-only position update during drag (no DOM attributes or form updates)
 * @param {HTMLElement} element - Designer element to move
 * @param {number} x - New X position
 * @param {number} y - New Y position
 */
// eslint-disable-next-line no-unused-vars
function updateElementPositionVisual(element, x, y) {
    element.style.left = x + 'px';
    element.style.top = y + 'px';
}

/**
 * Fast form input updates during drag (no validation or preview updates)
 * @param {number} x - New X position
 * @param {number} y - New Y position
 */
// eslint-disable-next-line no-unused-vars
function updateFormPositionInputs(x, y) {
    const posXInput = document.getElementById('lcd-txt-element-position-x');
    const posYInput = document.getElementById('lcd-txt-element-position-y');
    if (posXInput) {
        posXInput.value = x;
    }
    if (posYInput) {
        posYInput.value = y;
    }
}

function setupElementEventHandlers(listElement, designerElement) {
    listElement.addEventListener('click', async event => {
        event.preventDefault();
        await selectElement(listElement, designerElement);
    });

    designerElement.addEventListener('click', async event => {
        event.preventDefault();
        await selectElement(listElement, designerElement);
    });

    // Optimized drag and drop functionality
    const localDragState = {
        isDragging: false,
        startX: 0,
        startY: 0,
        initialX: 0,
        initialY: 0
    };

    designerElement.addEventListener('mousedown', async event => {
        // Only start drag if element is selected or can be selected
        const currentSelected = getSelectedDesignerElement();
        if (currentSelected !== designerElement) {
            const canSelect = await selectElement(listElement, designerElement);
            if (!canSelect) {
                return;
            } // Validation prevented selection
        }

        localDragState.isDragging = false;
        localDragState.startX = event.clientX;
        localDragState.startY = event.clientY;
        localDragState.initialX = parseInt(designerElement.style.left) || 0;
        localDragState.initialY = parseInt(designerElement.style.top) || 0;

        // Add visual feedback for potential drag
        designerElement.style.cursor = 'grabbing';

        event.preventDefault();
    });

    designerElement.addEventListener('mousemove', event => {
        if (event.buttons !== 1) {
            return;
        } // Only drag with left mouse button

        const deltaX = event.clientX - localDragState.startX;
        const deltaY = event.clientY - localDragState.startY;

        // Start dragging if moved more than threshold
        if (!localDragState.isDragging && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
            localDragState.isDragging = true;

            // Set global drag state to disable expensive operations
            globalDragState.isDragging = true;
            globalDragState.currentElement = designerElement;
            globalDragState.startPosition = { x: localDragState.startX, y: localDragState.startY };
            globalDragState.initialPosition = { x: localDragState.initialX, y: localDragState.initialY };

            designerElement.classList.add('dragging');
            console.log('Started drag operation - expensive operations disabled');
        }

        if (localDragState.isDragging) {
            const newX = Math.max(0, localDragState.initialX + deltaX);
            const newY = Math.max(0, localDragState.initialY + deltaY);

            // FAST: Only update visual position and form inputs
            designerElement.style.left = newX + 'px';
            designerElement.style.top = newY + 'px';

            // FAST: Update form inputs for live feedback
            updateFormPositionInputsOnly(newX, newY);

            // SKIP: All expensive operations are now skipped:
            // - No updateElementPosition() (expensive attribute updates)
            // - No updateElementForm() (expensive form sync)
            // - No markCurrentElementAsTouched() (expensive validation)
            // - No applyFormToSelectedElement() (expensive config + preview)
        }
    });

    designerElement.addEventListener('mouseup', () => {
        if (localDragState.isDragging) {
            localDragState.isDragging = false;

            // Get final position
            const finalX = parseInt(designerElement.style.left) || 0;
            const finalY = parseInt(designerElement.style.top) || 0;

            // Clear global drag state BEFORE executing deferred operations
            globalDragState.isDragging = false;
            globalDragState.currentElement = null;

            designerElement.classList.remove('dragging');

            console.log('Drag operation completed - executing deferred operations');

            // NOW: Execute all expensive operations once
            executeDeferredDragOperations(designerElement, finalX, finalY);
        }
        designerElement.style.cursor = '';
    });

    designerElement.addEventListener('mouseleave', () => {
        // Clean up drag state if mouse leaves element
        if (localDragState.isDragging) {
            // Get current position before cleanup
            const currentX = parseInt(designerElement.style.left) || 0;
            const currentY = parseInt(designerElement.style.top) || 0;

            localDragState.isDragging = false;

            // Clear global drag state
            globalDragState.isDragging = false;
            globalDragState.currentElement = null;

            designerElement.classList.remove('dragging');
            designerElement.style.cursor = '';

            console.log('Drag operation cancelled (mouse leave) - executing deferred operations');

            // Execute deferred operations with current position
            executeDeferredDragOperations(designerElement, currentX, currentY);
        }
    });

    // Add hover effects (only when not dragging)
    designerElement.addEventListener('mouseenter', () => {
        if (!localDragState.isDragging && !globalDragState.isDragging) {
            designerElement.classList.add('hovering');
        }
    });

    designerElement.addEventListener('mouseleave', () => {
        designerElement.classList.remove('hovering');
    });
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
        font_color: txtTextFontColor?.value || '#ffffffff', // Match HTML default
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
        import('./app-state.js')
            .then(module => {
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
            })
            .catch(() => {
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
    invoke('get_graph_preview_image', { graphConfig: graphConfig })
        .then(base64Data => {
            const img = document.createElement('img');
            img.src = `data:image/png;base64,${base64Data}`;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            container.appendChild(img);
        })
        .catch(_error => {
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
function renderConditionalImageElementPreview(config, elementId) {
    const container = document.createElement('div');
    container.style.width = `${config.width}px`;
    container.style.height = `${config.height}px`;
    container.style.position = 'relative';

    // Invoke get_conditional_image_preview_image and show base64 response data
    invoke('get_conditional_image_preview_image', {
        elementId: elementId,
        conditionalImageConfig: config
    })
        .then(base64Data => {
            const img = document.createElement('img');
            img.src = `data:image/png;base64,${base64Data}`;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            container.appendChild(img);
        })
        .catch(error => {
            console.log('Failed to render conditional image preview:', error);
            container.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #999; font-size: 10px; flex-direction: column;">
                    <div style="font-size: 14px; margin-bottom: 2px;">🖼️</div>
                    <div>Conditional Image Preview</div>
                    <div style="font-size: 8px; opacity: 0.7;">${config.sensor_id || 'No sensor selected'}</div>
                </div>
            `;
        });

    return container;
}

/**
 * Applies current form values to the selected element
 */
export function applyFormToSelectedElement() {
    const selectedList = getSelectedListElement();
    const selectedDesigner = getSelectedDesignerElement();

    if (!selectedList || !selectedDesigner) {
        console.warn('applyFormToSelectedElement: No element selected');
        return; // No element selected
    }

    // Update basic properties
    const newName = txtElementName.value || selectedList.getAttribute(ATTR_ELEMENT_NAME);
    const newType = cmbElementType.value || selectedList.getAttribute(ATTR_ELEMENT_TYPE);
    const newX =
        parseInt(txtElementPositionX.value) || parseInt(selectedList.getAttribute(ATTR_ELEMENT_POSITION_X) || 0);
    const newY =
        parseInt(txtElementPositionY.value) || parseInt(selectedList.getAttribute(ATTR_ELEMENT_POSITION_Y) || 0);

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

    // Update validation state
    updateElementValidationState(selectedList);

    console.log(`Applied form values to element ${newName}:`, config);
}

/**
 * Loads conditional image catalog entries from the backend and populates the dropdown
 */
export async function loadConditionalImageCatalog() {
    if (!cmbConditionalImageCatalogEntrySelection) {
        return;
    }

    try {
        const catalogResponse = await invoke('get_conditional_image_repo_entries');
        const catalogEntries = JSON.parse(catalogResponse);

        // Clear existing options
        cmbConditionalImageCatalogEntrySelection.innerHTML = '<option value="">Select from catalog...</option>';

        // Add catalog entries to dropdown
        catalogEntries.forEach(entry => {
            const option = document.createElement('option');
            option.value = entry.url;
            option.textContent = `${entry.name} (${entry.resolution})`;
            option.dataset.entryData = JSON.stringify(entry);
            cmbConditionalImageCatalogEntrySelection.appendChild(option);
        });

        console.log(`Loaded ${catalogEntries.length} conditional image catalog entries`);
    } catch (error) {
        console.error('Failed to load conditional image catalog:', error);
        // Add error option
        if (cmbConditionalImageCatalogEntrySelection) {
            cmbConditionalImageCatalogEntrySelection.innerHTML = '<option value="">Error loading catalog...</option>';
        }
    }
}

/**
 * Handles selection of a catalog entry and populates the images path field
 */
export function onConditionalImageCatalogEntrySelected() {
    if (!cmbConditionalImageCatalogEntrySelection || !txtConditionalImageImagesPath) {
        return;
    }

    const selectedOption = cmbConditionalImageCatalogEntrySelection.selectedOptions[0];
    if (selectedOption && selectedOption.value) {
        txtConditionalImageImagesPath.value = selectedOption.value;
        console.log('Applied catalog entry:', selectedOption.textContent);

        // Update preview if element is selected
        updateElementPreview();
    }
}

/**
 * Selects an element programmatically (exported for keyboard navigation)
 * @param {HTMLElement} listElement - List element to select
 * @param {HTMLElement} designerElement - Designer element to select
 * @param {boolean} skipValidation - Skip validation check
 * @param {boolean} skipValidationDisplay - Skip validation display
 * @returns {Promise<boolean>} True if selection successful
 */
export async function selectElementProgrammatically(
    listElement,
    designerElement,
    skipValidation = false,
    skipValidationDisplay = false
) {
    return await selectElement(listElement, designerElement, skipValidation, skipValidationDisplay);
}
