// Configuration import/export functionality

import { open, save, invoke } from './dom-elements.js';

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
        filters: [{
            name: 'JSON',
            extensions: ['json'],
        }]
    }).then(
        (selected) => {
            // If the user selected a file, save the config to the file
            if (typeof selected === "string" && selected !== "") {
                invoke('export_config', {filePath: selected});
            } else {
                console.log("No file selected");
            }
        }
    );
}

/**
 * Imports a config from a file the user can select
 */
export function importConfig() {
    // Open a tauri dialog to let the user select a file to import from
    open({
        multiple: false,
        directory: false,
        filters: [{
            name: 'JSON',
            extensions: ['json'],
        }]
    }).then(
        (selected) => {
            // If the user selected a file, load the config from the file
            if (typeof selected === "string" && selected !== "") {
                invoke('import_config', {filePath: selected}).then(
                    () => {
                        // Show yes no dialog, that a restart is required
                        const shouldRestart = confirm("The config was imported successfully. A restart is required to apply the changes. Do you want to restart now?");
                        if (shouldRestart) {
                            invoke('restart_app');
                        } else {
                            // Reload registered clients instead of device configs
                            loadRegisteredClients()
                                .catch((error) => {
                                    alert("Error while loading registered clients. " + error);
                                });
                        }
                    }
                ).catch((error) => {
                    alert("Error while importing config. " + error);
                })
            } else {
                console.log("No file selected");
            }
        }
    );
}

/**
 * Loads the current HTTP port value from backend
 */
export async function loadHttpPort() {
    try {
        const port = await invoke('get_http_port');
        const httpPortInput = document.getElementById('http-port-input');
        if (httpPortInput) {
            httpPortInput.value = port;
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
 * Handles port input focus - stores the original value
 */
export function onPortInputFocus() {
    const httpPortInput = document.getElementById('http-port-input');
    if (httpPortInput) {
        originalPortValue = parseInt(httpPortInput.value);
    }
}

/**
 * Handles port input change - detects changes and restarts server if needed
 */
export async function onPortInputChange() {
    const httpPortInput = document.getElementById('http-port-input');
    const btnActivateSync = document.getElementById('btn-activate-sync');

    if (!httpPortInput) {
        console.error('HTTP port input element not found');
        return;
    }

    try {
        const newPort = parseInt(httpPortInput.value);

        // Validate port range
        if (newPort < 1024 || newPort > 65535) {
            console.warn('Port out of valid range (1024-65535)');
            return;
        }

        // Check if port actually changed
        if (originalPortValue !== null && originalPortValue !== newPort) {
            console.log(`Port changed from ${originalPortValue} to ${newPort}`);

            // The backend set_http_port function now handles server restart automatically
            // if the server is running, so we just need to save the port
            await saveHttpPort();

            console.log('Port saved successfully - backend handled server restart if needed');
        } else {
            // Port didn't change, just save it
            await saveHttpPort();
        }

        // Update the stored original value
        originalPortValue = newPort;

    } catch (error) {
        console.error('Error handling port change:', error);
    }
}

/**
 * Toggles the HTTP server on/off
 * @param {boolean} enable - Whether to enable or disable the server
 */
export async function toggleHttpServer(enable) {
    try {
        if (enable) {
            await invoke('start_http_server');
            console.log('HTTP server started');
        } else {
            await invoke('stop_http_server');
            console.log('HTTP server stopped');
        }
    } catch (error) {
        console.error('Error toggling HTTP server:', error);
    }
}
