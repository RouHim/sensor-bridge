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
            // The backend set_http_port function now handles server restart automatically
            // if the server is running, so we just need to save the port
            await saveHttpPort();
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
        } else {
            await invoke('stop_http_server');
        }
    } catch (error) {
        console.error('Error toggling HTTP server:', error);
    }
}
