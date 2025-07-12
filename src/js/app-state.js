// Application state management for Sensor Bridge

// Global application state
export const appState = {
    sensorValues: [],
    selectedListElement: null,
    selectedDesignerElement: null,
    draggedLiElement: null,
    currentClientMacAddress: null
};

// State management functions
export function setSensorValues(values) {
    appState.sensorValues = values;
}

export function getSensorValues() {
    return appState.sensorValues;
}

export function setSelectedListElement(element) {
    appState.selectedListElement = element;
}

export function getSelectedListElement() {
    return appState.selectedListElement;
}

export function setSelectedDesignerElement(element) {
    appState.selectedDesignerElement = element;
}

export function getSelectedDesignerElement() {
    return appState.selectedDesignerElement;
}

export function setDraggedLiElement(element) {
    appState.draggedLiElement = element;
}

export function getDraggedLiElement() {
    return appState.draggedLiElement;
}

export function setCurrentClientMacAddress(macAddress) {
    appState.currentClientMacAddress = macAddress;
}

export function getCurrentClientMacAddress() {
    return appState.currentClientMacAddress;
}
