// Client management functionality

import { invoke } from './dom-elements.js';
import { 
    cmbRegisteredClients,
    clientInfoContent,
    clientInfoPlaceholder,
    clientActiveToggle,
    clientStatusText,
    clientInfoName,
    clientInfoIp,
    clientInfoMac,
    clientInfoResolution,
    clientInfoLastSeen,
    txtClientName,
    txtDisplayResolutionWidth,
    txtDisplayResolutionHeight,
    lcdBasePanel
} from './dom-elements.js';
import { setCurrentClientMacAddress, getCurrentClientMacAddress } from './app-state.js';
import { loadDisplayElements } from './element-management.js';

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
export function onClientSelected(selectedOption) {
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
    loadClientConfiguration(clientData);

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
        if (clientInfoName) clientInfoName.textContent = clientData.name || 'Unnamed Client';
        if (clientInfoIp) clientInfoIp.textContent = clientData.ip_address || 'Unknown';
        if (clientInfoMac) clientInfoMac.textContent = clientData.mac_address;
        if (clientInfoResolution) {
            // Backend uses resolution_width/resolution_height, not display_width/display_height
            clientInfoResolution.textContent = `${clientData.resolution_width || 0}x${clientData.resolution_height || 0}`;
        }
        if (clientInfoLastSeen) {
            // last_seen is a Unix timestamp from the backend
            const lastSeen = clientData.last_seen ? new Date(clientData.last_seen * 1000).toLocaleString() : 'Never';
            clientInfoLastSeen.textContent = lastSeen;
        }
        
        // Update active toggle
        if (clientActiveToggle) {
            clientActiveToggle.checked = clientData.active || false;
        }
        
        // Update status text
        if (clientStatusText) {
            clientStatusText.textContent = clientData.active ? 'Active' : 'Inactive';
            clientStatusText.className = clientData.active ? 'status-active' : 'status-inactive';
        }
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
    if (lcdBasePanel) {
        lcdBasePanel.style.display = 'none';
    }
}

/**
 * Loads client configuration from backend
 */
function loadClientConfiguration(clientData) {
    try {
        // The clientData object now comes directly from the selection
        // No need to fetch it again from the backend

        // Update form fields
        if (txtClientName) txtClientName.value = clientData.name || '';
        if (txtDisplayResolutionWidth) txtDisplayResolutionWidth.value = clientData.resolution_width || 800;
        if (txtDisplayResolutionHeight) txtDisplayResolutionHeight.value = clientData.resolution_height || 600;

        // Load display elements
        loadDisplayElements(clientData.display_config ? clientData.display_config.elements : []);

    } catch (error) {
        console.error('Failed to load client configuration:', error);
    }
}

/**
 * Handles client active toggle change
 */
export async function handleClientActiveToggle() {
    const macAddress = getCurrentClientMacAddress();
    if (!macAddress) return;
    
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
    if (!macAddress) return;
    
    const confirmRemoval = confirm('Are you sure you want to remove this client? This action cannot be undone.');
    if (!confirmRemoval) return;
    
    try {
        await invoke('remove_client', { macAddress });
        
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
