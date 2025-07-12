// UI utilities and helper functions

import { invoke } from './dom-elements.js';
import { getCurrentClientMacAddress } from './app-state.js';
import {
    cmbTextFontFamily,
    cmbConditionalImageCatalogEntrySelection,
    txtTextFormat,
    txtConditionalImageImagesPath,
    txtConditionalImageWidth,
    txtConditionalImageHeight,
    open
} from './dom-elements.js';
import {
    ATTR_CONDITIONAL_IMAGE_REPO_URL,
    ATTR_CONDITIONAL_IMAGE_RESOLUTION
} from './constants.js';

/**
 * Loads system fonts and populates the font family dropdown
 */
export async function loadSystemFonts() {
    try {
        const fonts = await invoke('get_system_fonts');
        JSON.parse(fonts).forEach((font) => {
            const option = document.createElement("option");
            option.value = font;
            option.innerText = font;
            option.style.fontFamily = font;
            cmbTextFontFamily.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load system fonts:', error);
    }
}

/**
 * Loads conditional image repository entries
 */
export function loadConditionalImageRepoEntries() {
    invoke('get_conditional_image_repo_entries').then((entries) => {
        JSON.parse(entries).forEach((entry) => {
            const entryName = entry.name;
            const entryUrl = entry.url;
            const entryResolution = entry.resolution;

            const option = document.createElement("option");
            option.value = entryName;
            option.innerText = entryName;
            option.setAttribute(ATTR_CONDITIONAL_IMAGE_REPO_URL, entryUrl);
            option.setAttribute(ATTR_CONDITIONAL_IMAGE_RESOLUTION, entryResolution);

            cmbConditionalImageCatalogEntrySelection.appendChild(option);
        });
    }).catch(error => {
        console.error('Failed to load conditional image repo entries:', error);
    });
}

/**
 * Applies the selected conditional image catalog entry to the current element
 */
export function applyConditionalImageCatalogEntry() {
    const selectedOption = cmbConditionalImageCatalogEntrySelection.options[cmbConditionalImageCatalogEntrySelection.selectedIndex];
    txtConditionalImageImagesPath.value = selectedOption.getAttribute(ATTR_CONDITIONAL_IMAGE_REPO_URL);
    let resolution = selectedOption.getAttribute(ATTR_CONDITIONAL_IMAGE_RESOLUTION).split("x");
    txtConditionalImageWidth.value = resolution[0];
    txtConditionalImageHeight.value = resolution[1];
}

/**
 * Adds a text format placeholder to the format input
 */
export function addTextFormatPlaceholder(placeholder) {
    const currentText = txtTextFormat.value;
    const cursorPosition = txtTextFormat.selectionStart;
    const textBefore = currentText.substring(0, cursorPosition);
    const textAfter = currentText.substring(txtTextFormat.selectionEnd);

    txtTextFormat.value = textBefore + placeholder + textAfter;
    txtTextFormat.focus();
    txtTextFormat.setSelectionRange(cursorPosition + placeholder.length, cursorPosition + placeholder.length);
}

/**
 * Selects a static image file
 */
export async function selectStaticImage() {
    try {
        const selected = await open({
            multiple: false,
            directory: false,
            filters: [{
                name: 'Images',
                extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg'],
            }]
        });

        if (typeof selected === "string" && selected !== "") {
            const txtStaticImageFile = document.getElementById("lcd-txt-element-static-image-file");
            if (txtStaticImageFile) {
                txtStaticImageFile.value = selected;
            }
        }
    } catch (error) {
        console.error('Failed to select static image:', error);
    }
}

/**
 * Selects a conditional image directory
 */
export async function selectConditionalImage() {
    try {
        const selected = await open({
            multiple: false,
            directory: true
        });

        if (typeof selected === "string" && selected !== "") {
            txtConditionalImageImagesPath.value = selected;
        }
    } catch (error) {
        console.error('Failed to select conditional image directory:', error);
    }
}

/**
 * Shows information about conditional images
 */
export function showConditionalImageInfo() {
    const infoText = `Conditional Images:

This element type displays different images based on sensor values. 

Setup:
1. Select a sensor that provides numeric values
2. Choose a directory containing numbered image files (0.png, 1.png, 2.png, etc.)
3. Set the minimum and maximum sensor values
4. The system will automatically map sensor values to image files

Example:
- Sensor range: 0-100 (temperature)
- Images: 0.png (cold), 50.png (medium), 100.png (hot)
- When sensor reads 75, it will show an image between 50.png and 100.png

Image files should be named with numbers corresponding to sensor values.`;

    alert(infoText);
}

/**
 * Toggles live preview mode
 */
export async function toggleLivePreview() {
    try {
        // Import WebviewWindow from Tauri API
        const { WebviewWindow } = window.__TAURI__.webviewWindow;

        // Get the current client MAC address
        const macAddress = getCurrentClientMacAddress();
        if (!macAddress) {
            console.error('No client selected. Cannot open LCD preview.');
            return;
        }

        // Check if preview window already exists using static method
        const existingWindow = await WebviewWindow.getByLabel('lcd-preview');

        if (existingWindow) {
            // If window exists, focus it (toggle behavior)
            await existingWindow.setFocus();
            console.log('LCD preview window focused');
        } else {
            // Create new preview window with MAC address in URL hash
            const previewWindow = new WebviewWindow('lcd-preview', {
                url: `/lcd_preview.html#${macAddress}`,
                title: 'LCD Preview',
                width: 800,
                height: 600,
                resizable: true,
                center: true
            });

            // Listen for window ready event
            previewWindow.once('tauri://created', () => {
                console.log('LCD preview window created successfully');
            });

            // Listen for any errors with detailed logging
            previewWindow.once('tauri://error', (e) => {
                console.error('Failed to create LCD preview window:', e);
                console.error('Error details:', JSON.stringify(e, null, 2));
            });
        }
    } catch (error) {
        console.error('Failed to toggle live preview:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
    }
}

/**
 * Handles keyboard events for element movement
 */
export function handleKeydownEvent(event) {
    // Check if an element is selected and if arrow keys are pressed
    const selectedElement = document.querySelector('.designer-element.selected');
    if (!selectedElement) return;

    let moveUnit = 1;
    if (event.shiftKey) moveUnit = 10;
    if (event.ctrlKey) moveUnit = 5;

    let moved = false;
    const currentX = parseInt(selectedElement.style.left) || 0;
    const currentY = parseInt(selectedElement.style.top) || 0;

    switch (event.key) {
        case 'ArrowUp':
            selectedElement.style.top = Math.max(0, currentY - moveUnit) + 'px';
            moved = true;
            break;
        case 'ArrowDown':
            selectedElement.style.top = (currentY + moveUnit) + 'px';
            moved = true;
            break;
        case 'ArrowLeft':
            selectedElement.style.left = Math.max(0, currentX - moveUnit) + 'px';
            moved = true;
            break;
        case 'ArrowRight':
            selectedElement.style.left = (currentX + moveUnit) + 'px';
            moved = true;
            break;
    }

    if (moved) {
        event.preventDefault();

        // Update data attributes
        selectedElement.setAttribute('data-element-position-x', selectedElement.style.left.replace('px', ''));
        selectedElement.setAttribute('data-element-position-y', selectedElement.style.top.replace('px', ''));

        // Update form inputs if they exist
        const posXInput = document.getElementById('lcd-txt-element-position-x');
        const posYInput = document.getElementById('lcd-txt-element-position-y');
        if (posXInput) posXInput.value = selectedElement.style.left.replace('px', '');
        if (posYInput) posYInput.value = selectedElement.style.top.replace('px', '');
    }
}

/**
 * Initializes color picker if available
 */
export function initializeColorPicker() {
    if (window.Coloris) {
        window.Coloris({
            theme: 'large',
            themeMode: 'dark',
            alpha: true,
            forceAlpha: true,
        });
    }
}

/**
 * Initializes Feather icons if available
 */
export function initializeFeatherIcons() {
    if (window.feather) {
        window.feather.replace();
    }
}
