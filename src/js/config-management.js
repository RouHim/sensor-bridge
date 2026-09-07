// Configuration import/export functionality

import { open, save, invoke } from './dom-elements.js';
import { loadRegisteredClients } from './client-management.js';

// Store the original port value to detect changes
let originalPortValue = null;

/**
 * Exports the current config to a file the user can save on their computer
 */
export function exportConfig() {
    // Open a tauri dialog to let the user select a file to export to
    save({
        multiple: false,
        directory: false,
        filters: [
            {
                name: 'JSON',
                extensions: ['json']
            }
        ]
    }).then(selected => {
        // If the user selected a file, save the config to the file
        if (typeof selected === 'string' && selected !== '') {
            invoke('export_config', { filePath: selected });
        } else {
            // No file selected
        }
    });
}

/**
 * Imports a config from a file the user can select
 */
export async function importConfig() {
    try {
        // Open a tauri dialog to let the user select a file to import from
        const selected = await open({
            multiple: false,
            directory: false,
            filters: [
                {
                    name: 'Config files',
                    extensions: ['json']
                }
            ]
        });

        // If the user selected a file, load the config from the file
        if (typeof selected === 'string' && selected !== '') {
            await invoke('import_config', { filePath: selected });

            // Show yes no dialog, that a restart is required
            try {
                const shouldRestart = await window.__TAURI__.dialog.ask(
                    'The config was imported successfully. A restart is required to apply the changes. Do you want to restart now?',
                    { title: 'Restart Required' }
                );
                if (shouldRestart) {
                    invoke('restart_app');
                } else {
                    // Reload registered clients instead of device configs
                    loadRegisteredClients().catch(error => {
                        alert('Error while loading registered clients. ' + error);
                    });
                }
            } catch (error) {
                // Fallback to browser confirm if Tauri dialog fails
                const shouldRestart = confirm(
                    'The config was imported successfully. A restart is required to apply the changes. Do you want to restart now?'
                );
                if (shouldRestart) {
                    invoke('restart_app');
                } else {
                    // Reload registered clients instead of device configs
                    loadRegisteredClients().catch(error => {
                        alert('Error while loading registered clients. ' + error);
                    });
                }
            }
        }
    } catch (error) {
        alert('Error while importing config. ' + error);
    }
}

/**
 * Loads the currently saved HTTP port from the backend
 */
export async function loadHttpPort() {
    try {
        const port = await invoke('get_http_port');
        const httpPortInput = document.getElementById('http-port-input');
        if (httpPortInput) {
            httpPortInput.value = port;
            originalPortValue = parseInt(port);
        }
    } catch (error) {
        console.error('Failed to load HTTP port:', error);
    }
}

/**
 * Saves the HTTP port value to backend
 */
export async function saveHttpPort() {
    try {
        const httpPortInput = document.getElementById('http-port-input');
        const port = parseInt(httpPortInput.value);
        if (port >= 1024 && port <= 65535) {
            await invoke('set_http_port', { port });
        }
    } catch (error) {
        console.error('Failed to save HTTP port:', error);
    }
}

/**
 * Handles port input change - shows apply button if value changed
 */
export function onPortInputChange() {
    const httpPortInput = document.getElementById('http-port-input');
    const applyButton = document.getElementById('btn-apply-port-change');

    if (!httpPortInput || !applyButton) {
        console.error('HTTP port input or apply button element not found');
        return;
    }

    try {
        const newPort = parseInt(httpPortInput.value);

        // Validate port range
        if (newPort < 1024 || newPort > 65535) {
            console.warn('Port out of valid range (1024-65535)');
            applyButton.classList.add('hidden');
            applyButton.classList.remove('visible');
            return;
        }

        // Check if port actually changed from original value
        if (originalPortValue !== null && originalPortValue !== newPort) {
            applyButton.classList.add('visible');
            applyButton.classList.remove('hidden');
        } else {
            applyButton.classList.add('hidden');
            applyButton.classList.remove('visible');
        }
    } catch (error) {
        console.error('Error handling port change:', error);
        applyButton.classList.add('hidden');
        applyButton.classList.remove('visible');
    }
}

/**
 * Applies the port change and restarts the server
 */
export async function applyPortChange() {
    const httpPortInput = document.getElementById('http-port-input');
    const applyButton = document.getElementById('btn-apply-port-change');

    if (!httpPortInput || !applyButton) {
        console.error('HTTP port input or apply button element not found');
        return;
    }

    try {
        const newPort = parseInt(httpPortInput.value);

        // Validate port range
        if (newPort < 1024 || newPort > 65535) {
            alert('Port must be between 1024 and 65535');
            return;
        }

        // Disable button and show loading state
        applyButton.disabled = true;
        const originalIcon = applyButton.querySelector('i');
        if (originalIcon) {
            originalIcon.setAttribute('data-feather', 'loader');

            // Re-render feather icons to show loader
            if (typeof window.feather !== 'undefined') {
                window.feather.replace();
            }
        } else {
            console.warn('Could not find icon element in apply button for loading state');
            applyButton.textContent = '...'; // Fallback loading indicator
        }

        console.log(`Applying HTTP server port change from ${originalPortValue} to ${newPort}...`);

        // Apply the port change (this will restart the server automatically)
        await invoke('set_http_port', { port: newPort });

        // Update the stored original value
        originalPortValue = newPort;

        // Hide the apply button
        applyButton.classList.add('hidden');
        applyButton.classList.remove('visible');

        // Restore button state
        applyButton.disabled = false;
        const restoreIcon = applyButton.querySelector('i');
        if (restoreIcon) {
            restoreIcon.setAttribute('data-feather', 'check');

            // Re-render feather icons to show check icon
            if (typeof window.feather !== 'undefined') {
                window.feather.replace();
            }
        } else {
            console.warn('Could not find icon element in apply button for restore state');
            applyButton.innerHTML = '<i data-feather="check"></i>'; // Recreate icon
            if (typeof window.feather !== 'undefined') {
                window.feather.replace();
            }
        }

        console.log(`HTTP server port successfully changed to ${newPort} and server restarted`);
    } catch (error) {
        console.error('Error applying port change:', error);
        alert('Error changing port: ' + error);

        // Restore button state on error
        applyButton.disabled = false;
        const errorIcon = applyButton.querySelector('i');
        if (errorIcon) {
            errorIcon.setAttribute('data-feather', 'check');

            // Re-render feather icons
            if (typeof window.feather !== 'undefined') {
                window.feather.replace();
            }
        } else {
            console.warn('Could not find icon element in apply button for error state');
            applyButton.innerHTML = '<i data-feather="check"></i>'; // Recreate icon
            if (typeof window.feather !== 'undefined') {
                window.feather.replace();
            }
        }
    }
}
