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
    ATTR_ELEMENT_POSITION_Y
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
    setSelectedDesignerElement
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
    updateElementZOrder();
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
    updateElementZOrder();
}

/**
 * Initializes drag and drop functionality for the list items
 */
export function initializeListDragAndDrop() {
    if (!lstDesignerPlacedElements) {
        return;
    }

    // Set up event listeners for the list container
    lstDesignerPlacedElements.addEventListener('dragover', handleListDragOver);
    lstDesignerPlacedElements.addEventListener('drop', handleListDrop);
    lstDesignerPlacedElements.addEventListener('dragenter', handleListDragEnter);
    lstDesignerPlacedElements.addEventListener('dragleave', handleListDragLeave);

    console.log('List drag and drop functionality initialized');
}

/**
 * Handles dragenter event for the list container
 */
function handleListDragEnter(event) {
    event.preventDefault();
    lstDesignerPlacedElements.classList.add('drag-over');
}

/**
 * Handles dragleave event for the list container
 */
function handleListDragLeave(event) {
    // Only remove drag-over class if we're actually leaving the container
    if (!lstDesignerPlacedElements.contains(event.relatedTarget)) {
        lstDesignerPlacedElements.classList.remove('drag-over');
    }
}

/**
 * Handles dragover event for the list container
 */
function handleListDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const draggingItem = document.querySelector('.list-item-dragging');
    if (!draggingItem) {
        return;
    }

    const afterElement = getDragAfterElement(lstDesignerPlacedElements, event.clientY);

    if (afterElement === null) {
        lstDesignerPlacedElements.appendChild(draggingItem);
    } else {
        lstDesignerPlacedElements.insertBefore(draggingItem, afterElement);
    }
}

/**
 * Handles drop event for the list container
 */
function handleListDrop(event) {
    event.preventDefault();
    lstDesignerPlacedElements.classList.remove('drag-over');

    const draggingItem = document.querySelector('.list-item-dragging');
    if (draggingItem) {
        draggingItem.classList.remove('list-item-dragging');

        // Update z-order based on new position
        updateElementZOrder();

        console.log('List item reordered');
    }
}

/**
 * Determines the element after which the dragged item should be inserted
 */
function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('li:not(.list-item-dragging)')];

    return draggableElements.reduce(
        (closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        },
        { offset: Number.NEGATIVE_INFINITY }
    ).element;
}

/**
 * Updates z-order for all elements based on their position in the list
 */
function updateElementZOrder() {
    const listItems = lstDesignerPlacedElements.querySelectorAll('li');

    listItems.forEach((item, index) => {
        const elementId = item.getAttribute(ATTR_ELEMENT_ID);
        const designerElement = document.getElementById(DESIGNER_ID_PREFIX + elementId);

        if (designerElement) {
            // Higher index = higher z-index (items lower in list appear in front)
            designerElement.style.zIndex = index + 1;
        }
    });

    console.log(`Updated z-order for ${listItems.length} elements`);
}

/**
 * Updates validation states for all elements
 */
export function updateAllElementValidationStates() {
    const listElements = lstDesignerPlacedElements.querySelectorAll('li');

    listElements.forEach(listElement => {
        updateElementValidationState(listElement);
    });

    console.log(`Updated validation states for ${listElements.length} elements`);
}

/**
 * Marks current element as touched and triggers validation
 */
export function markCurrentElementAsTouched() {
    const currentElement = getSelectedListElement();
    if (!currentElement) {
        return;
    }

    // Mark as touched
    currentElement.setAttribute('data-touched', 'true');

    // Trigger validation update for this element
    updateElementValidationState(currentElement);

    console.log(`Marked element as touched: ${currentElement.getAttribute(ATTR_ELEMENT_NAME)}`);
}

/**
 * Save element configuration for the currently selected client
 */
export async function saveElementConfiguration() {
    try {
        // First, apply current form values to selected element
        applyFormToSelectedElement();

        // Collect all elements
        const elements = collectAllElements();

        // Get display resolution
        const displayWidth = parseInt(txtDisplayResolutionWidth.value) || 128;
        const displayHeight = parseInt(txtDisplayResolutionHeight.value) || 64;

        // Create display configuration
        const displayConfig = {
            resolution_width: displayWidth,
            resolution_height: displayHeight,
            elements: elements
        };

        // Get the currently selected client (we need to determine which client is active)
        // For now, we'll try to get the first registered client or use a default
        const clientsResponse = await invoke('get_registered_clients');
        const clients = Object.values(JSON.parse(clientsResponse));

        if (clients.length === 0) {
            throw new Error('No registered clients found. Please register a client first.');
        }

        // Use the first active client, or the first client if none are active
        let selectedClient = clients.find(client => client.active);
        if (!selectedClient) {
            selectedClient = clients[0];
        }

        // Save configuration for the selected client
        await invoke('update_client_display_config', {
            macAddress: selectedClient.mac_address,
            displayConfig: JSON.stringify(displayConfig)
        });

        console.log(`Configuration saved for client: ${selectedClient.name}`);

        // Show success feedback
        // Note: We could add a toast notification here
    } catch (error) {
        console.error('Error saving configuration:', error);
        throw error; // Re-throw to let calling code handle it
    }
}

/**
 * Move element with control pad
 */
export function moveElementControlPad(direction) {
    const selectedDesigner = getSelectedDesignerElement();
    const selectedList = getSelectedListElement();

    if (!selectedDesigner || !selectedList) {
        return;
    }

    const currentX = parseInt(selectedDesigner.style.left) || 0;
    const currentY = parseInt(selectedDesigner.style.top) || 0;
    const moveUnit = getMoveUnit(); // Get current move unit

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
    default:
        console.warn(`Unknown direction: ${direction}`);
        return;
    }

    // Update visual position
    selectedDesigner.style.left = newX + 'px';
    selectedDesigner.style.top = newY + 'px';

    // Update attributes
    selectedDesigner.setAttribute(ATTR_ELEMENT_POSITION_X, newX);
    selectedDesigner.setAttribute(ATTR_ELEMENT_POSITION_Y, newY);
    selectedList.setAttribute(ATTR_ELEMENT_POSITION_X, newX);
    selectedList.setAttribute(ATTR_ELEMENT_POSITION_Y, newY);

    // Update form inputs
    txtElementPositionX.value = newX;
    txtElementPositionY.value = newY;

    // Apply changes and mark as touched
    applyFormToSelectedElement();
    markCurrentElementAsTouched();

    console.log(`Moved element ${direction} by ${moveUnit} pixels to (${newX}, ${newY})`);
}

/**
 * Change move unit
 */
export function changeMoveUnit() {
    // This function would typically update the move unit based on a form control
    // The actual move unit is retrieved by getMoveUnit() function
    console.log('Move unit changed');
}

/**
 * Gets the current move unit for control pad movement
 * @returns {number} Current move unit in pixels
 */
function getMoveUnit() {
    const moveUnitElement = document.getElementById('lcd-designer-control-pad-move-unit');
    if (moveUnitElement) {
        const unit = parseInt(moveUnitElement.value) || 1;
        return Math.max(1, unit); // Ensure minimum of 1 pixel
    }
    return 1; // Default move unit
}

/**
 * Cleanup stuck drag states
 */
function cleanupAnyStuckDragStates() {
    console.log('Cleaning up stuck drag states');

    // Clear global drag state
    globalDragState.isDragging = false;
    globalDragState.currentElement = null;
    globalDragState.startPosition = { x: 0, y: 0 };
    globalDragState.initialPosition = { x: 0, y: 0 };
    globalDragState.deferredOperations = [];

    // Remove drag-related CSS classes
    document.querySelectorAll('.dragging').forEach(element => {
        element.classList.remove('dragging');
        element.style.cursor = '';
    });

    document.querySelectorAll('.list-item-dragging').forEach(element => {
        element.classList.remove('list-item-dragging');
    });

    if (lstDesignerPlacedElements) {
        lstDesignerPlacedElements.classList.remove('drag-over');
    }

    console.log('Drag state cleanup completed');
}

/**
 * Execute deferred drag operations
 */
function executeDeferredDragOperations(element, x, y) {
    console.log('Executing deferred drag operations for element at', x, y);

    if (!element) {
        return;
    }

    // Update designer element position and attributes
    element.style.left = x + 'px';
    element.style.top = y + 'px';
    element.setAttribute(ATTR_ELEMENT_POSITION_X, x);
    element.setAttribute(ATTR_ELEMENT_POSITION_Y, y);

    // Update corresponding list element attributes
    const elementId = element.getAttribute(ATTR_ELEMENT_ID);
    const listElement = document.getElementById(LIST_ID_PREFIX + elementId);
    if (listElement) {
        listElement.setAttribute(ATTR_ELEMENT_POSITION_X, x);
        listElement.setAttribute(ATTR_ELEMENT_POSITION_Y, y);
    }

    // Update form inputs
    updateFormPositionInputsOnly(x, y);

    // Apply form values to update configuration
    applyFormToSelectedElement();

    // Mark element as touched and validate
    markCurrentElementAsTouched();

    // Process any queued deferred operations
    if (globalDragState.deferredOperations && globalDragState.deferredOperations.length > 0) {
        globalDragState.deferredOperations.forEach(operation => {
            try {
                operation();
            } catch (error) {
                console.error('Error executing deferred operation:', error);
            }
        });
        globalDragState.deferredOperations = [];
    }

    console.log(`Deferred drag operations completed for element at (${x}, ${y})`);
}

/**
 * Update form position inputs only (fast operation for drag feedback)
 */
function updateFormPositionInputsOnly(x, y) {
    // Use direct element references for performance
    if (txtElementPositionX) {
        txtElementPositionX.value = x;
    }
    if (txtElementPositionY) {
        txtElementPositionY.value = y;
    }
}

/**
 * Update element validation state
 */
function updateElementValidationState(element) {
    if (!element) {
        return;
    }

    const validationResult = validateElementDirectly(element);
    const elementId = element.getAttribute(ATTR_ELEMENT_ID);
    const designerElement = document.getElementById(DESIGNER_ID_PREFIX + elementId);

    // Apply or remove invalid class based on validation result
    if (validationResult.isValid) {
        element.classList.remove('invalid');
        if (designerElement) {
            designerElement.classList.remove('invalid');
        }
    } else {
        element.classList.add('invalid');
        if (designerElement) {
            designerElement.classList.add('invalid');
        }
    }

    // Store validation errors for potential display
    if (validationResult.errors && validationResult.errors.length > 0) {
        element.setAttribute('data-validation-errors', JSON.stringify(validationResult.errors));
    } else {
        element.removeAttribute('data-validation-errors');
    }

    console.log(
        `Validation state updated for element ${element.getAttribute(ATTR_ELEMENT_NAME)}: ${validationResult.isValid ? 'valid' : 'invalid'}`
    );
}

/**
 * Validate element directly
 * @param {HTMLElement} element - List element to validate
 * @returns {Object} Validation result with isValid boolean and errors array
 */
function validateElementDirectly(element) {
    if (!element) {
        return { isValid: false, errors: ['Element not found'] };
    }

    const elementName = element.getAttribute(ATTR_ELEMENT_NAME) || 'Unnamed Element';
    const elementType = element.getAttribute(ATTR_ELEMENT_TYPE);
    const errors = [];

    // Get element configuration
    let config = null;
    const configAttr = element.getAttribute('data-config');
    if (configAttr) {
        try {
            config = JSON.parse(configAttr);
        } catch (error) {
            errors.push(`${elementName}: Invalid configuration data`);
            return { isValid: false, errors };
        }
    }

    // Basic position validation
    const x = parseInt(element.getAttribute(ATTR_ELEMENT_POSITION_X));
    const y = parseInt(element.getAttribute(ATTR_ELEMENT_POSITION_Y));
    if (isNaN(x) || x < 0) {
        errors.push(`${elementName}: Invalid X position`);
    }
    if (isNaN(y) || y < 0) {
        errors.push(`${elementName}: Invalid Y position`);
    }

    // Type-specific validation
    if (!config) {
        errors.push(`${elementName}: No configuration found`);
    } else {
        switch (elementType) {
        case ELEMENT_TYPE_TEXT:
            validateTextElement(elementName, config, errors);
            break;
        case ELEMENT_TYPE_STATIC_IMAGE:
            validateStaticImageElement(elementName, config, errors);
            break;
        case ELEMENT_TYPE_GRAPH:
            validateGraphElement(elementName, config, errors);
            break;
        case ELEMENT_TYPE_CONDITIONAL_IMAGE:
            validateConditionalImageElement(elementName, config, errors);
            break;
        default:
            errors.push(`${elementName}: Unknown element type '${elementType}'`);
        }
    }

    return { isValid: errors.length === 0, errors };
}

/**
 * Validates a text element configuration
 */
function validateTextElement(elementName, config, errors) {
    if (!config.sensor_id || config.sensor_id.trim() === '') {
        errors.push(`${elementName}: No sensor selected`);
    }

    if (!config.width || config.width <= 0) {
        errors.push(`${elementName}: Width must be greater than 0`);
    }

    if (!config.height || config.height <= 0) {
        errors.push(`${elementName}: Height must be greater than 0`);
    }

    if (!config.font_family || config.font_family.trim() === '') {
        errors.push(`${elementName}: No font family selected`);
    }

    if (!config.font_size || config.font_size <= 0) {
        errors.push(`${elementName}: Font size must be greater than 0`);
    }

    if (!config.format || config.format.trim() === '') {
        errors.push(`${elementName}: No text format specified`);
    }
}

/**
 * Validates a static image element configuration
 */
function validateStaticImageElement(elementName, config, errors) {
    if (!config.image_path || config.image_path.trim() === '') {
        errors.push(`${elementName}: No image file selected`);
    }

    if (!config.width || config.width <= 0) {
        errors.push(`${elementName}: Width must be greater than 0`);
    }

    if (!config.height || config.height <= 0) {
        errors.push(`${elementName}: Height must be greater than 0`);
    }
}

/**
 * Validates a graph element configuration
 */
function validateGraphElement(elementName, config, errors) {
    if (!config.sensor_id || config.sensor_id.trim() === '') {
        errors.push(`${elementName}: No sensor selected`);
    }

    if (!config.width || config.width <= 0) {
        errors.push(`${elementName}: Width must be greater than 0`);
    }

    if (!config.height || config.height <= 0) {
        errors.push(`${elementName}: Height must be greater than 0`);
    }

    if (!config.graph_type || config.graph_type.trim() === '') {
        errors.push(`${elementName}: No graph type selected`);
    }

    if (config.graph_stroke_width && config.graph_stroke_width <= 0) {
        errors.push(`${elementName}: Stroke width must be greater than 0`);
    }
}

/**
 * Validates a conditional image element configuration
 */
function validateConditionalImageElement(elementName, config, errors) {
    if (!config.sensor_id || config.sensor_id.trim() === '') {
        errors.push(`${elementName}: No sensor selected`);
    }

    if (!config.images_path || config.images_path.trim() === '') {
        errors.push(`${elementName}: No images path specified`);
    }

    if (!config.width || config.width <= 0) {
        errors.push(`${elementName}: Width must be greater than 0`);
    }

    if (!config.height || config.height <= 0) {
        errors.push(`${elementName}: Height must be greater than 0`);
    }
}

/**
 * Sets up drag and drop event handlers for a list element
 */
function setupListItemDragHandlers(listElement) {
    listElement.addEventListener('dragstart', handleListItemDragStart);
    listElement.addEventListener('dragend', handleListItemDragEnd);
}

/**
 * Handles dragstart event for list items
 */
function handleListItemDragStart(event) {
    event.target.classList.add('list-item-dragging');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/html', event.target.outerHTML);
    console.log('Started dragging list item:', event.target.getAttribute('data-element-name'));
}

/**
 * Handles dragend event for list items
 */
function handleListItemDragEnd(event) {
    event.target.classList.remove('list-item-dragging');
    lstDesignerPlacedElements.classList.remove('drag-over');
    console.log('Finished dragging list item');
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

    // Update z-order for all elements
    updateElementZOrder();
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

    // Update z-order for all elements
    updateElementZOrder();

    // Update validation states for all loaded elements
    updateAllElementValidationStates();

    // Auto-select the first element if any elements were loaded
    if (elements.length > 0) {
        const firstListElement = lstDesignerPlacedElements.querySelector('li');
        if (firstListElement) {
            const elementId = firstListElement.getAttribute(ATTR_ELEMENT_ID);
            const firstDesignerElement = document.getElementById(DESIGNER_ID_PREFIX + elementId);
            if (firstDesignerElement) {
                selectElement(firstListElement, firstDesignerElement, true, true);
                console.log(`Auto-selected first design element: ${firstListElement.getAttribute(ATTR_ELEMENT_NAME)}`);
            }
        }
    }
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

    // Add list drag and drop handlers
    setupListItemDragHandlers(listElement);

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

export function collectAllElements() {
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
