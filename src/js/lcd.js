const {invoke} = window.__TAURI__.tauri;

const txtLcdResolutionWidth = document.getElementById("lcd-txt-resolution-width");
const txtLcdResolutionHeight = document.getElementById("lcd-txt-resolution-height");
const parent = document.getElementById("lcd-designer-pane");

window.addEventListener("DOMContentLoaded", () => {
    // Register event for display resolution
    txtLcdResolutionWidth.addEventListener("input", updateLcdDesignPaneDimensions);
    txtLcdResolutionHeight.addEventListener("input", updateLcdDesignPaneDimensions);

    // Register drag dropping
    parent.addEventListener('dragover', (event) => event.preventDefault());
    parent.addEventListener('drop', dropOnParent);

    document.getElementById("child").addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', event.target.id);
    });
    document.getElementById("child2").addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('text/plain', event.target.id);
    });
});

function dropOnParent(event) {
    event.preventDefault();
    const elementId = event.dataTransfer.getData('text/plain');
    const htmlElement = document.getElementById(elementId);

    const x = event.clientX - parent.getBoundingClientRect().left - htmlElement.clientWidth / 2;
    const y = event.clientY - parent.getBoundingClientRect().top - htmlElement.clientHeight / 2;

    console.log(x);
    console.log(y);

    htmlElement.style.left = `${x}px`;
    htmlElement.style.top = `${y}px`;
}

function updateLcdDesignPaneDimensions() {
    let width = txtLcdResolutionWidth.value;
    let height = txtLcdResolutionHeight.value;

    parent.style.width = width + "px";
    parent.style.height = height + "px";
}
