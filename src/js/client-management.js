// Client management functionality

import {
    clientActiveToggle,
    clientConfigHeader,
    clientInfoContent,
    clientInfoIp,
    clientInfoLastSeen,
    clientInfoMac,
    clientInfoName,
    clientInfoPlaceholder,
    clientStatusContainer,
    clientStatusDot,
    clientStatusText,
    cmbRegisteredClients,
    collapseIcon,
    invoke,
    lcdBasePanel,
    resolutionDisplay,
    txtClientName
} from './dom-elements.js';
import { getCurrentClientMacAddress, setCurrentClientMacAddress } from './app-state.js';
import { loadDisplayElements, updateDisplayDesignPaneDimensions } from './element-management.js';

/**
 * Loads all registered clients from the backend
 */
export async function loadRegisteredClients() {
    try {
        const clientsResponse = await invoke('get_registered_clients');

        // Parse the response - it could be a JSON object (HashMap) or an error string
        let parsedClients;
        try {
            parsedClients = JSON.parse(clientsResponse);
        } catch (parseError) {
            console.error('Failed to parse clients response:', parseError);
            console.error('Raw response:', clientsResponse);
            throw new Error('Invalid response format from server');
        }

        // Convert HashMap object to array of clients
        // The backend returns a HashMap<String, RegisteredClient> which becomes a JSON object
        const clientList = Object.values(parsedClients);

        // Clear existing options
        cmbRegisteredClients.innerHTML = '<option value="">Select a client...</option>';

        // Add clients to dropdown
        clientList.forEach(client => {
            const option = document.createElement('option');
            option.value = client.mac_address;
            option.textContent = client.name || client.mac_address;
            option.dataset.clientData = JSON.stringify(client);
            cmbRegisteredClients.appendChild(option);
        });

        // If no clients, show placeholder
        if (clientList.length === 0) {
            showClientInfoPlaceholder();
        } else {
            // Auto-select the first client if there are any clients
            cmbRegisteredClients.selectedIndex = 1; // Skip the "Select a client..." option
            const firstOption = cmbRegisteredClients.options[1];
            await onClientSelected(firstOption);
        }
    } catch (error) {
        console.error('Failed to load registered clients:', error);
        // Show placeholder on error
        showClientInfoPlaceholder();
        // Clear dropdown to prevent stale data
        if (cmbRegisteredClients) {
            cmbRegisteredClients.innerHTML = '<option value="">Error loading clients...</option>';
        }
        throw error;
    }
}

/**
 * Handles client selection from dropdown
 */
export async function onClientSelected(selectedOption) {
    if (!selectedOption || !selectedOption.value) {
        showClientInfoPlaceholder();
        setCurrentClientMacAddress(null);
        return;
    }

    const clientData = JSON.parse(selectedOption.dataset.clientData);
    setCurrentClientMacAddress(clientData.mac_address);

    // Update client info display
    updateClientInfoDisplay(clientData);

    // Load client configuration
    await loadClientConfiguration(clientData);

    // Show LCD panel
    if (lcdBasePanel) {
        lcdBasePanel.style.display = 'block';
    }
}

/**
 * Updates the client information display
 */
function updateClientInfoDisplay(clientData) {
    if (clientInfoPlaceholder) {
        clientInfoPlaceholder.style.display = 'none';
    }

    if (clientInfoContent) {
        clientInfoContent.style.display = 'block';

        // Update client info fields - using exact backend field names
        if (clientInfoName) {
            clientInfoName.textContent = clientData.name || 'Unnamed Client';
        }
        if (clientInfoIp) {
            clientInfoIp.textContent = clientData.ip_address || 'Unknown';
        }
        if (clientInfoMac) {
            clientInfoMac.textContent = clientData.mac_address;
        }
        if (clientInfoLastSeen) {
            // Use formatted_last_seen from backend if available, otherwise fallback
            const lastSeen = clientData.formatted_last_seen || 'Never';
            clientInfoLastSeen.textContent = lastSeen;
        }

        // Update active toggle and status indicator
        const isActive = clientData.active || false;
        if (clientActiveToggle) {
            clientActiveToggle.checked = isActive;
        }

        // Show status container and update status elements
        if (clientStatusContainer) {
            clientStatusContainer.style.display = 'flex';
        }

        if (clientStatusText) {
            clientStatusText.textContent = isActive ? 'Active' : 'Inactive';
            clientStatusText.className = isActive ? 'status-active' : 'status-inactive';
        }

        if (clientStatusDot) {
            if (isActive) {
                clientStatusDot.classList.add('active');
            } else {
                clientStatusDot.classList.remove('active');
            }
        }

        // Keep the panel collapsed by default when new client is selected
        if (!clientInfoContent.classList.contains('expanded')) {
            clientInfoContent.classList.add('collapsed');
            clientInfoContent.classList.remove('expanded');
            if (collapseIcon) {
                collapseIcon.classList.remove('expanded');
            }
        }
    }
}

/**
 * Updates visual status indicators
 */
function updateStatusIndicators(isActive) {
    if (clientStatusDot) {
        if (isActive) {
            clientStatusDot.classList.add('active');
        } else {
            clientStatusDot.classList.remove('active');
        }
    }
    if (clientStatusText) {
        clientStatusText.textContent = isActive ? 'Active' : 'Inactive';
    }
}

/**
 * Initialize status toggle event handler
 */
function initializeStatusToggle() {
    if (clientActiveToggle) {
        clientActiveToggle.addEventListener('change', async e => {
            const isActive = e.target.checked;
            updateStatusIndicators(isActive);

            // Save to backend
            const currentMac = getCurrentClientMacAddress();
            if (currentMac) {
                try {
                    await invoke('set_client_active', { macAddress: currentMac, active: isActive });
                } catch (error) {
                    console.error('Error setting client active status:', error);
                    // Revert on error
                    e.target.checked = !isActive;
                    updateStatusIndicators(!isActive);
                }
            }
        });
    }
}

/**
 * Shows the client info placeholder when no client is selected
 */
function showClientInfoPlaceholder() {
    if (clientInfoContent) {
        clientInfoContent.style.display = 'none';
    }
    if (clientInfoPlaceholder) {
        clientInfoPlaceholder.style.display = 'block';
    }
    if (clientStatusContainer) {
        clientStatusContainer.style.display = 'none';
    }
    if (lcdBasePanel) {
        lcdBasePanel.style.display = 'none';
    }
}

/**
 * Loads client configuration from backend
 */
async function loadClientConfiguration(clientData) {
    try {
        // The clientData object now comes directly from the selection
        // No need to fetch it again from the backend

        // Update form fields
        if (txtClientName) {
            txtClientName.value = clientData.name || '';
        }

        // Update resolution display text
        if (resolutionDisplay) {
            const width = clientData.resolution_width || 800;
            const height = clientData.resolution_height || 600;
            resolutionDisplay.textContent = `${width} × ${height} px`;
        }

        // Update the designer pane dimensions to match the client's resolution
        await updateDisplayDesignPaneDimensions();

        // Load display elements
        const elements = clientData.elements || [];
        loadDisplayElements(elements);
    } catch (error) {
        console.error('Failed to load client configuration:', error);
    }
}

/**
 * Handles client active toggle change
 */
export async function handleClientActiveToggle() {
    const macAddress = getCurrentClientMacAddress();
    if (!macAddress) {
        return;
    }

    try {
        const isActive = clientActiveToggle.checked;
        await invoke('set_client_active', { macAddress, active: isActive });

        // Update status display
        if (clientStatusText) {
            clientStatusText.textContent = isActive ? 'Active' : 'Inactive';
            clientStatusText.className = isActive ? 'status-active' : 'status-inactive';
        }
    } catch (error) {
        console.error('Failed to toggle client active state:', error);
        alert('Error updating client status: ' + error);
        // Revert toggle state
        clientActiveToggle.checked = !clientActiveToggle.checked;
    }
}

/**
 * Removes the currently selected client
 */
export async function removeClient() {
    const macAddress = getCurrentClientMacAddress();
    if (!macAddress) {
        alert('Please select a client to remove.');
        return;
    }

    // Use Tauri's dialog plugin instead of browser confirm()
    const confirmRemoval = await window.__TAURI__.dialog.ask(
        `Are you sure you want to remove this client?\n\nThis action cannot be undone.\n\nMAC Address: ${macAddress}`,
        {
            title: 'Remove Client',
            kind: 'warning'
        }
    );

    if (!confirmRemoval) {
        return;
    }

    try {
        await invoke('remove_registered_client', { macAddress });

        // Reload clients list
        await loadRegisteredClients();

        // Clear selection
        cmbRegisteredClients.value = '';
        showClientInfoPlaceholder();
        setCurrentClientMacAddress(null);
    } catch (error) {
        console.error('Failed to remove client:', error);
        alert('Error removing client: ' + error);
    }
}

/**
 * Toggles the collapsed/expanded state of the client configuration panel
 */
function toggleClientConfigPanel() {
    if (!clientInfoContent || !collapseIcon) {
        return;
    }

    const isCurrentlyExpanded = clientInfoContent.classList.contains('expanded');

    if (isCurrentlyExpanded) {
        // Collapse
        clientInfoContent.classList.remove('expanded');
        clientInfoContent.classList.add('collapsed');
        collapseIcon.classList.remove('expanded');
    } else {
        // Expand
        clientInfoContent.classList.remove('collapsed');
        clientInfoContent.classList.add('expanded');
        collapseIcon.classList.add('expanded');
    }
}

/**
 * Initialize collapsible functionality
 */
function initializeCollapsibleHeader() {
    if (clientConfigHeader) {
        clientConfigHeader.addEventListener('click', e => {
            // Prevent toggle when clicking on the status toggle switch or action buttons
            if (
                e.target.closest('.status-toggle') ||
                e.target.closest('input[type="checkbox"]') ||
                e.target.closest('.header-action-buttons') ||
                e.target.closest('button')
            ) {
                return;
            }
            toggleClientConfigPanel();
        });
    }
}

/**
 * Saves client configuration (name, etc.)
 */
export async function saveClientConfiguration() {
    try {
        const macAddress = getCurrentClientMacAddress();
        if (!macAddress) {
            throw new Error('No client selected. Please select a client first.');
        }

        // Get current client name from the form
        const clientName = txtClientName?.value?.trim() || '';

        if (clientName === '') {
            throw new Error('Client name cannot be empty.');
        }

        // Update client name via backend API
        await invoke('update_client_name', {
            macAddress: macAddress,
            name: clientName
        });

        // Refresh the clients list to show updated name
        await loadRegisteredClients();

        // Find and re-select the updated client to maintain selection
        const clientsResponse = await invoke('get_registered_clients');
        const clients = Object.values(JSON.parse(clientsResponse));
        const updatedClient = clients.find(client => client.mac_address === macAddress);

        if (updatedClient) {
            // Update the dropdown selection
            cmbRegisteredClients.value = macAddress;
            // Update the client info display
            await loadClientConfiguration(updatedClient);
        }
    } catch (error) {
        console.error('Error saving client configuration:', error);
        throw error; // Re-throw to let calling code handle it
    }
}

// Initialize collapsible functionality when the module loads
document.addEventListener('DOMContentLoaded', () => {
    initializeCollapsibleHeader();
    initializeStatusToggle();
});
