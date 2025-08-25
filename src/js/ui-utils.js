// UI utilities and helper functions

import { getCurrentClientMacAddress } from './app-state.js';
import {
    cmbConditionalImageCatalogEntrySelection,
    cmbTextFontFamily,
    invoke,
    open,
    txtConditionalImageHeight,
    txtConditionalImageImagesPath,
    txtConditionalImageWidth,
    txtTextFormat
} from './dom-elements.js';
import { ATTR_CONDITIONAL_IMAGE_REPO_URL, ATTR_CONDITIONAL_IMAGE_RESOLUTION } from './constants.js';

/**
 * Loads system fonts and populates the font family dropdown
 */
export async function loadSystemFonts() {
    try {
        const fonts = await invoke('get_system_fonts');
        JSON.parse(fonts).forEach(font => {
            const option = document.createElement('option');
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
    invoke('get_conditional_image_repo_entries')
        .then(entries => {
            JSON.parse(entries).forEach(entry => {
                const entryName = entry.name;
                const entryUrl = entry.url;
                const entryResolution = entry.resolution;

                const option = document.createElement('option');
                option.value = entryName;
                option.innerText = entryName;
                option.setAttribute(ATTR_CONDITIONAL_IMAGE_REPO_URL, entryUrl);
                option.setAttribute(ATTR_CONDITIONAL_IMAGE_RESOLUTION, entryResolution);

                cmbConditionalImageCatalogEntrySelection.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Failed to load conditional image repo entries:', error);
        });
}

/**
 * Applies the selected conditional image catalog entry to the current element
 */
export function applyConditionalImageCatalogEntry() {
    const selectedOption =
        cmbConditionalImageCatalogEntrySelection.options[cmbConditionalImageCatalogEntrySelection.selectedIndex];
    txtConditionalImageImagesPath.value = selectedOption.getAttribute(ATTR_CONDITIONAL_IMAGE_REPO_URL);
    const resolution = selectedOption.getAttribute(ATTR_CONDITIONAL_IMAGE_RESOLUTION).split('x');
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
            filters: [
                {
                    name: 'Images',
                    extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'svg']
                }
            ]
        });

        if (typeof selected === 'string' && selected !== '') {
            const txtStaticImageFile = document.getElementById('lcd-txt-element-static-image-file');
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

        if (typeof selected === 'string' && selected !== '') {
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
        // Get the current client MAC address
        const macAddress = getCurrentClientMacAddress();
        if (!macAddress) {
            console.error('No client selected. Cannot open LCD preview.');
            return;
        }

        // Use the backend Tauri command instead of frontend WebviewWindow API
        // This approach has better window lifecycle management

        // Import the invoke function from Tauri API
        const { invoke } = window.__TAURI__.core;

        await invoke('show_lcd_live_preview', {
            macAddress: macAddress
        });
    } catch (error) {
        console.error('Failed to toggle live preview:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
    }
}

/**
 * Handles keyboard events for element movement and selection
 */
export function handleKeydownEvent(event) {
    // Import element management functions
    import('./element-management.js')
        .then(module => {
            const selectedElement = document.querySelector('.designer-element.selected');

            // Handle element movement with arrow keys
            if (selectedElement && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
                let moveUnit = 1;
                if (event.shiftKey) {
                    moveUnit = 10;
                }
                if (event.ctrlKey) {
                    moveUnit = 5;
                }

                let moved = false;
                const currentX = parseInt(selectedElement.style.left) || 0;
                const currentY = parseInt(selectedElement.style.top) || 0;

                switch (event.key) {
                    case 'ArrowUp':
                        selectedElement.style.top = Math.max(0, currentY - moveUnit) + 'px';
                        moved = true;
                        break;
                    case 'ArrowDown':
                        selectedElement.style.top = currentY + moveUnit + 'px';
                        moved = true;
                        break;
                    case 'ArrowLeft':
                        selectedElement.style.left = Math.max(0, currentX - moveUnit) + 'px';
                        moved = true;
                        break;
                    case 'ArrowRight':
                        selectedElement.style.left = currentX + moveUnit + 'px';
                        moved = true;
                        break;
                }

                if (moved) {
                    event.preventDefault();

                    // Update element attributes using proper constants
                    selectedElement.setAttribute(
                        'data-element-position-x',
                        selectedElement.style.left.replace('px', '')
                    );
                    selectedElement.setAttribute(
                        'data-element-position-y',
                        selectedElement.style.top.replace('px', '')
                    );

                    // Update form inputs
                    const posXInput = document.getElementById('lcd-txt-element-position-x');
                    const posYInput = document.getElementById('lcd-txt-element-position-y');
                    if (posXInput) {
                        posXInput.value = selectedElement.style.left.replace('px', '');
                    }
                    if (posYInput) {
                        posYInput.value = selectedElement.style.top.replace('px', '');
                    }

                    // Apply the changes and mark as touched
                    if (module.applyFormToSelectedElement) {
                        module.applyFormToSelectedElement();
                    }
                    if (module.markCurrentElementAsTouched) {
                        module.markCurrentElementAsTouched();
                    }
                }
            }

            // Handle Tab navigation between elements
            if (event.key === 'Tab') {
                const allElements = document.querySelectorAll('.designer-element');
                const currentIndex = Array.from(allElements).findIndex(el => el.classList.contains('selected'));

                if (allElements.length > 0) {
                    event.preventDefault();
                    let nextIndex;

                    if (event.shiftKey) {
                        // Previous element (Shift+Tab)
                        nextIndex = currentIndex <= 0 ? allElements.length - 1 : currentIndex - 1;
                    } else {
                        // Next element (Tab)
                        nextIndex = currentIndex >= allElements.length - 1 ? 0 : currentIndex + 1;
                    }

                    const nextElement = allElements[nextIndex];
                    const elementId = nextElement.getAttribute('data-element-id');
                    const listElement = document.getElementById('list-' + elementId);

                    // Import selectElement function and call it
                    if (module.selectElementProgrammatically && listElement) {
                        module.selectElementProgrammatically(listElement, nextElement);
                    }
                }
            }

            // Handle Delete key to remove element
            if (event.key === 'Delete' && selectedElement) {
                event.preventDefault();
                if (module.removeElement) {
                    module.removeElement();
                }
            }

            // Handle Escape to clear selection
            if (event.key === 'Escape') {
                if (selectedElement) {
                    selectedElement.classList.remove('selected');
                    // Clear list selection too
                    const listElements = document.querySelectorAll('#lcd-designer-placed-elements li.selected');
                    listElements.forEach(li => li.classList.remove('selected'));
                }
            }
        })
        .catch(error => {
            console.warn('Could not import element management functions:', error);
        });
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
            forceAlpha: true
        });
    }
}

/**
 * Initializes Feather Icons with retry mechanism
 */
export function initializeFeatherIcons() {
    let attempts = 0;
    const maxAttempts = 10;

    const tryInitialize = () => {
        if (window.feather && typeof window.feather.replace === 'function') {
            try {
                window.feather.replace();
                return;
            } catch (error) {
                console.error('Error initializing Feather Icons:', error);
                return;
            }
        }

        attempts++;
        if (attempts < maxAttempts) {
            setTimeout(tryInitialize, 100);
        } else {
            console.warn('Failed to initialize Feather Icons after', maxAttempts, 'attempts');
        }
    };

    tryInitialize();
}
