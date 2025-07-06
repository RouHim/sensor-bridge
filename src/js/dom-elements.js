// DOM element references for Sensor Bridge application

// Tauri API references
export const {invoke} = window.__TAURI__.core;
export const {convertFileSrc} = window.__TAURI__.core;
export const {open, save} = window.__TAURI__.dialog;

// Modal dialog elements
export const sensorSelectionDialog = document.getElementById("sensor-selection-dialog");
export const sensorSelectionTable = document.getElementById("sensor-selection-table");
export const txtSensorSelectionTableFilterInput = document.getElementById("sensor-selection-table-filter-input");

// Client selection and management elements
export const cmbRegisteredClients = document.getElementById("main-registered-clients-select");
export const lcdBasePanel = document.getElementById("lcd-panel");

// Main buttons
export const btnRefreshClients = document.getElementById("btn-refresh-clients");
export const btnSaveClientConfig = document.getElementById("lcd-btn-save-client-config");
export const btnToggleLivePreview = document.getElementById("btn-lcd-toggle-live-preview");
export const btnRemoveClient = document.getElementById("lcd-btn-remove-client");
export const btnExportConfig = document.getElementById("btn-export-config");
export const btnImportConfig = document.getElementById("btn-import-config");
export const panelKillSwitch = document.getElementById("kill-switch-input");
export const btnActivateSync = document.getElementById("main-chk-transfer-active");
export const httpPortInput = document.getElementById("http-port-input");

// Client configuration elements
export const txtClientName = document.getElementById("lcd-txt-client-name");
export const lblClientInfo = document.getElementById("lcd-lbl-client-info");
export const txtDisplayResolutionWidth = document.getElementById("lcd-txt-resolution-width");
export const txtDisplayResolutionHeight = document.getElementById("lcd-txt-resolution-height");

// Client information display elements
export const clientInfoContent = document.getElementById("client-info-content");
export const clientInfoPlaceholder = document.getElementById("client-info-placeholder");
export const clientActiveToggle = document.getElementById("client-active-toggle");
export const clientStatusText = document.getElementById("client-status-text");
export const clientInfoName = document.getElementById("client-info-name");
export const clientInfoIp = document.getElementById("client-info-ip");
export const clientInfoMac = document.getElementById("client-info-mac");
export const clientInfoResolution = document.getElementById("client-info-resolution");
export const clientInfoLastSeen = document.getElementById("client-info-last-seen");

// Designer elements
export const designerPane = document.getElementById("lcd-designer-pane");
export const lstDesignerPlacedElements = document.getElementById("lcd-designer-placed-elements");
export const btnMoveElementUp = document.getElementById("lcd-btn-move-element-up");
export const btnMoveElementDown = document.getElementById("lcd-btn-move-element-down");
export const btnAddElement = document.getElementById("lcd-btn-add-element");
export const btnRemoveElement = document.getElementById("lcd-btn-remove-element");
export const btnSaveElement = document.getElementById("lcd-btn-save-element");
export const btnDuplicateElement = document.getElementById("lcd-btn-duplicate-element");

// Control pad elements
export const btnControlPadUp = document.getElementById("lcd-btn-designer-control-pad-up");
export const btnControlPadLeft = document.getElementById("lcd-btn-designer-control-pad-left");
export const btnControlPadChangeMoveUnit = document.getElementById("lcd-btn-designer-control-pad-move-unit");
export const btnControlPadRight = document.getElementById("lcd-btn-designer-control-pad-right");
export const btnControlPadDown = document.getElementById("lcd-btn-designer-control-pad-down");

// Config panes
export const layoutTextConfig = document.getElementById("lcd-text-config");
export const layoutStaticImageConfig = document.getElementById("lcd-static-image-config");
export const layoutGraphConfig = document.getElementById("lcd-graph-config");
export const layoutConditionalImageConfig = document.getElementById("lcd-conditional-image-config");

// Generic element controls
export const txtElementName = document.getElementById("lcd-txt-element-name");
export const cmbElementType = document.getElementById("lcd-cmb-element-type");
export const txtElementPositionX = document.getElementById("lcd-txt-element-position-x");
export const txtElementPositionY = document.getElementById("lcd-txt-element-position-y");

// Text element controls
export const cmbTextSensorIdSelection = document.getElementById("lcd-cmb-sensor-id-selection");
export const btnTextSensorIdSelectionDialog = document.getElementById("lcd-text-config-btn-select-sensor-id");
export const cmbTextSensorValueModifier = document.getElementById("lcd-cmb-sensor-value-modifier");
export const txtTextFormat = document.getElementById("lcd-txt-element-text-format");
export const btnTextFormatAddValue = document.getElementById("lcd-btn-add-value-placeholder");
export const btnTextFormatAddUnit = document.getElementById("lcd-btn-add-unit-placeholder");
export const btnTextFormatAddValueAvg = document.getElementById("lcd-btn-add-value-avg-placeholder");
export const btnTextFormatAddValueMin = document.getElementById("lcd-btn-add-value-min-placeholder");
export const btnTextFormatAddValueMax = document.getElementById("lcd-btn-add-value-max-placeholder");
export const cmbTextFontFamily = document.getElementById("lcd-cmb-element-font-family");
export const txtTextFontSize = document.getElementById("lcd-txt-element-font-size");
export const txtTextFontColor = document.getElementById("lcd-txt-element-font-color");
export const txtTextWidth = document.getElementById("lcd-txt-element-width");
export const txtTextHeight = document.getElementById("lcd-txt-element-height");
export const cmbTextAlignment = document.getElementById("lcd-cmb-element-text-alignment");

// Static image element controls
export const btnSelectStaticImage = document.getElementById("lcd-btn-static-image-select");
export const txtStaticImageFile = document.getElementById("lcd-txt-element-static-image-file");
export const txtStaticImageWidth = document.getElementById("lcd-txt-element-static-image-width");
export const txtStaticImageHeight = document.getElementById("lcd-txt-element-static-image-height");

// Graph element controls
export const cmbGraphSensorIdSelection = document.getElementById("lcd-cmb-number-sensor-id-selection");
export const btnGraphSensorIdSelectionDialog = document.getElementById("lcd-graph-config-btn-select-sensor-id");
export const txtGraphMinValue = document.getElementById("lcd-txt-element-graph-min-value");
export const txtGraphMaxValue = document.getElementById("lcd-txt-element-graph-max-value");
export const txtGraphWidth = document.getElementById("lcd-graph-width");
export const txtGraphHeight = document.getElementById("lcd-graph-height");
export const cmbGraphType = document.getElementById("lcd-graph-type");
export const txtGraphColor = document.getElementById("lcd-graph-color");
export const txtGraphStrokeWidth = document.getElementById("lcd-graph-stroke-width");
export const txtGraphBackgroundColor = document.getElementById("lcd-graph-background-color");
export const txtGraphBorderColor = document.getElementById("lcd-graph-border-color");

// Conditional image element controls
export const cmbConditionalImageSensorIdSelection = document.getElementById("lcd-cmb-conditional-image-sensor-id-selection");
export const btnConditionalImageSensorIdSelectionDialog = document.getElementById("lcd-conditional-image-config-btn-select-sensor-id");
export const btnConditionalImagePathSelection = document.getElementById("lcd-btn-conditional-image-select");
export const txtConditionalImageImagesPath = document.getElementById("lcd-txt-element-conditional-image-images-path");
export const txtConditionalImageMinValue = document.getElementById("lcd-txt-element-conditional-image-min-value");
export const txtConditionalImageMaxValue = document.getElementById("lcd-txt-element-conditional-image-max-value");
export const txtConditionalImageWidth = document.getElementById("lcd-txt-element-conditional-image-width");
export const txtConditionalImageHeight = document.getElementById("lcd-txt-element-conditional-image-height");
export const btnConditionalImageInfo = document.getElementById("lcd-btn-conditional-image-info");
export const cmbConditionalImageCatalogEntrySelection = document.getElementById("lcd-cmb-conditional-image-catalog-entry-selection");
export const btnConditionalImageApplyCatalogEntry = document.getElementById("lcd-btn-conditional-apply-catalog-entry");
