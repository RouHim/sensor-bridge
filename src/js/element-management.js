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
    invoke
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
 * Saves the current element configuration
 */
export async function saveElementConfiguration() {
    const macAddress = getCurrentClientMacAddress();
    if (!macAddress) {
        alert('Please select a client first.');
        return;
    }

    try {
        const elements = collectAllElements();
        await invoke('update_client_display_config', { macAddress, displayConfig: JSON.stringify(elements) });
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
        const { id, name, type, x, y } = elementData;

        // Generate new ID if not provided or use existing
        const elementId = id || generateElementId();
        const elementName = name || `Element ${elementId}`;
        const elementType = type || ELEMENT_TYPE_TEXT;
        const posX = parseInt(x) || 0;
        const posY = parseInt(y) || 0;

        // Create list element
        const listElement = createListElement(elementId, elementName, elementType);
        listElement.setAttribute(ATTR_ELEMENT_POSITION_X, posX);
        listElement.setAttribute(ATTR_ELEMENT_POSITION_Y, posY);

        // Create designer element
        const designerElement = createDesignerElement(elementId, elementName, elementType, posX, posY);

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

    txtElementName.value = selectedList.getAttribute(ATTR_ELEMENT_NAME) || '';
    cmbElementType.value = selectedList.getAttribute(ATTR_ELEMENT_TYPE) || '';
    txtElementPositionX.value = selectedList.getAttribute(ATTR_ELEMENT_POSITION_X) || '';
    txtElementPositionY.value = selectedList.getAttribute(ATTR_ELEMENT_POSITION_Y) || '';

    // Trigger element type change to show correct config panel
    onElementTypeChange();
}

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
            type: li.getAttribute(ATTR_ELEMENT_TYPE),
            x: parseInt(li.getAttribute(ATTR_ELEMENT_POSITION_X) || 0),
            y: parseInt(li.getAttribute(ATTR_ELEMENT_POSITION_Y) || 0)
            // Additional element-specific properties would be collected here
        };
        elements.push(elementData);
    });

    return elements;
}
