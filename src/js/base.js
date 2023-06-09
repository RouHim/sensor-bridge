const {invoke} = window.__TAURI__.tauri;

const txtDisplayMode = document.getElementById("txt-display-mode");
const lblComPortNameHeader = document.getElementById("com-port-name-header");

export function saveConfig() {
    // Get current com port by header id
    let comPort = lblComPortNameHeader.innerText;

    // If comport is empty, return
    if (comPort === "") {
        return;
    }

    // Get selected output mode
    let outputMode = txtDisplayMode.options[txtDisplayMode.selectedIndex].value;

    // Get LCD Resolution Height and cast to integer
    let lcdResolutionWidth = document.getElementById("lcd-txt-resolution-width").value;
    let lcdResolutionHeight = document.getElementById("lcd-txt-resolution-height").value;

    // Find all list items of lcd-designer-placed-elements extract sensors and save them to the lcd config
    let lcdDesignerPlacedElements = document.getElementById("lcd-designer-placed-elements");
    let lcdDesignerPlacedElementsListItems = lcdDesignerPlacedElements.getElementsByTagName("li");
    let lcdDesignerPlacedElementsListItemsArray = Array.from(lcdDesignerPlacedElementsListItems);
    let lcdElements = lcdDesignerPlacedElementsListItemsArray.map((listItem) => {
        let sensorName = listItem.innerText.trim();
        let sensorId = listItem.getAttribute("data-sensor-id");
        let sensorTextFormat = listItem.getAttribute("data-sensor-text-format");
        let sensorX = parseInt(listItem.getAttribute("data-sensor-position-x"));
        let sensorY = parseInt(listItem.getAttribute("data-sensor-position-y"));

        // Build sensor object
        return {
            name: sensorName,
            sensor_id: sensorId,
            text_format: sensorTextFormat,
            x: sensorX,
            y: sensorY,
        };
    });


    // Build lcd config object, with integers
    let lcdConfig = {
        resolution_width: parseInt(lcdResolutionWidth),
        resolution_height: parseInt(lcdResolutionHeight),
        elements: lcdElements,
    }

    invoke('save_config', {
        comPort: comPort,
        outputMode: outputMode,
        lcdConfig: JSON.stringify(lcdConfig),
    });
}