# Sensor Bridge HTTP API Documentation

This document describes the HTTP API endpoints that clients can use to connect to and interact with the Sensor Bridge
server.

## Overview

The Sensor Bridge uses HTTP communication for client-server interaction. Clients register themselves with the server by
providing their MAC address, IP address, and display resolution. The server maintains an in-memory client registry for
high-performance access control and provides sensor data to registered and active clients.

## Base URL

The server runs on port `55555` by default.

```
http://<server-ip>:55555
```

## Authentication

Currently, no authentication is required. Clients are identified by their MAC address, which is normalized before every
lookup: leading and trailing whitespace is removed and the address is uppercased, so `aa:bb:cc:dd:ee:ff ` and
`AA:BB:CC:DD:EE:FF` resolve to the same client. The separator style is preserved.

## Client Lifecycle

1. **Registration**: Client registers with server using `/api/register` (returns JSON confirmation)
2. **Static Data**: Client retrieves initial static data using `/api/static-data`
3. **Confirmation**: Client confirms the persisted payload via `POST /api/static-data/ack`
4. **Activation**: Client must be activated through the server UI (clients start as inactive)
5. **Data Access**: Active clients can access sensor data via `/api/sensor-data`
6. **Dynamic Updates**: When UI elements change, `static_data_reload_required` flag prompts client to reload static data
7. **Cleanup**: Inactive clients are automatically removed after 24 hours

## Client Registration

### Register/Update Client

Registers a new client or updates an existing client's information.

**Endpoint:** `POST /api/register`

**Request Body:**

```json
{
  "mac_address": "aa:bb:cc:dd:ee:ff",
  "ip_address": "192.168.1.100",
  "resolution_width": 1920,
  "resolution_height": 1080
}
```

**Response:**

**Content-Type:** `application/json`

The registration endpoint now returns a JSON confirmation. Static data is no longer returned from this endpoint.

```json
{
  "success": true,
  "message": "Client registered successfully",
  "mac_address": "aa:bb:cc:dd:ee:ff"
}
```

**Error Responses:**

```json
{
  "error": "mac_address is required",
  "status": 400
}
```

**Notes:**

- Registration now only handles client registration
- Static data must be requested separately via `/api/static-data`
- Existing clients will need to be updated to use the new flow

**Data Contents:**

1. **`text_data`** - Font files keyed by font family name
    - Contains TTF/OTF font data as binary bytes
    - Only includes fonts used by text elements in the display configuration

2. **`static_image_data`** - Pre-processed static images
    - Images are pre-scaled to the exact dimensions specified in element configs
    - All images are converted to PNG format for consistency
    - Keyed by element ID for direct lookup

3. **`conditional_image_data`** - Dynamic image sets for conditional elements
    - Each element contains multiple images for different sensor value conditions
    - Images are pre-processed and converted to PNG format
    - Nested structure: element_id -> image_name -> image_bytes

**Client Implementation Example:**

```rust
// Rust client example using bincode
let response = reqwest::get("http://server:55555/api/register")
.await?
.bytes()
.await?;

let static_data: StaticClientData = bincode::deserialize( & response) ?;

// Access font data
for (font_family, font_bytes) in static_data.text_data {
load_font(font_family, font_bytes);
}

// Access static images
for (element_id, image_bytes) in static_data.static_image_data {
load_static_image(element_id, image_bytes);
}

// Access conditional images
for (element_id, image_map) in static_data.conditional_image_data {
for (image_name, image_bytes) in image_map {
load_conditional_image(element_id, image_name, image_bytes);
}
}
```

```javascript
// JavaScript client example
const response = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registrationData)
});

if (response.ok) {
    const binaryData = await response.arrayBuffer();
    console.log(`Received ${binaryData.byteLength} bytes of static data`);

    // Note: JavaScript clients would need a bincode decoder
    // or the server could provide a JSON alternative endpoint
    processStaticData(new Uint8Array(binaryData));
} else {
    const errorData = await response.json();
    console.error('Registration failed:', errorData.error);
}
```

**Notes:**

- If `name` is not provided, a default name will be generated based on MAC address
- Clients start as inactive and must be activated through the UI
- Existing clients are updated with new information (IP, resolution)

**Error Responses:**

```json
{
  "error": "mac_address is required",
  "status": 400
}
```

## Static Data

### Get Static Data

Retrieves static assets (fonts, images) needed for client rendering.

**Endpoint:** `GET /api/static-data?mac_address={mac_address}`

**Parameters:**

- `mac_address`: The MAC address of the registered client

**Response headers:**

- `Content-Type: application/octet-stream`
- `X-Static-Data-Revision`: revision identifier of the delivered payload (MD5 of the element configuration). Pass this
  value back to the confirmation endpoint.
- `X-Protocol-Version`: protocol version of the bridge (`sensor_core::PROTOCOL_VERSION`). A client MUST NOT decode the
  payload when this differs from its own protocol version.

Returns binary static data serialized using bincode containing all static assets needed by the client for rendering.

**Binary Data Structure:**
The response contains a single bincode-serialized `StaticClientData` struct:

```rust
struct StaticClientData {
    /// Font data: font family name -> (md5 hash, font bytes)
    text_data: HashMap<String, (String, Vec<u8>)>,
    /// Static images: element ID -> (md5 hash, PNG image bytes)
    static_image_data: HashMap<String, (String, Vec<u8>)>,
    /// Conditional images: element ID -> (image name -> (md5 hash, PNG image bytes))
    conditional_image_data: HashMap<String, HashMap<String, (String, Vec<u8>)>>,
}
```

**Data Contents:**

1. **`text_data`** - Font files keyed by font family name
    - Contains TTF/OTF font data as binary bytes
    - Only includes fonts used by text elements in the display configuration

2. **`static_image_data`** - Pre-processed static images
    - Images are pre-scaled to the exact dimensions specified in element configs
    - All images are converted to PNG format for consistency
    - Keyed by element ID for direct lookup

3. **`conditional_image_data`** - Dynamic image sets for conditional elements
    - Each element contains multiple images for different sensor value conditions
    - Images are pre-processed and converted to PNG format
    - Nested structure: element_id -> image_name -> image_bytes

**Error Responses:**

**404 Not Found - Client not registered:**

```json
{
  "error": "Client not registered",
  "status": 404
}
```

**403 Forbidden - Client not active:**

```json
{
  "error": "Client not active",
  "status": 403
}
```

**400 Bad Request - Missing MAC address:**

```json
{
  "error": "mac_address parameter required",
  "status": 400
}
```

**Notes:**

- `GET /api/static-data` never clears the client's reload flag. The flag is cleared only by `POST /api/static-data/ack`
  after the client persisted the payload successfully, so a crash between download and persist cannot produce silently
  stale assets.
- The payload is prepared at most once per element revision and cached (bounded), so repeated fetches and clients with
  identical element configurations are cheap.
- When preparation of any required asset (font, static image, conditional image) or serialization fails, the endpoint
  responds `500` and leaves the reload flag unchanged. It never serves an empty or partial payload as success.

### Confirm Static Data

**Endpoint:** `POST /api/static-data/ack`

Confirms that the client persisted a delivered payload, so the bridge clears its per-client reload flag.

**Request body:**

```json
{
  "mac_address": "AA:BB:CC:DD:EE:FF",
  "revision": "9f2c…"
}
```

- `revision`: the `X-Static-Data-Revision` value of the payload the client persisted

**Response:**

```json
{
  "success": true,
  "pending_cleared": true
}
```

**Error Responses:**

- `404 Not Found` — client not registered
- `403 Forbidden` — client not active
- `400 Bad Request` — missing/invalid body

**Notes:**

- Only a confirmation for the revision that is current for the client's elements clears the flag: a confirmation that
  arrives after the elements changed leaves the newer pending update in place.
- Repeated confirmations are idempotent (`pending_cleared: false` when the flag was already clear).

## Sensor Data

### Get Sensor Data

Retrieves current sensor data and display configuration for a registered client.

**Endpoint:** `GET /api/sensor-data?mac_address={mac_address}`

**Parameters:**

- `mac_address`: The MAC address of the registered client (any format accepted)

**Response:**

```json
{
  "render_data": {
    "display_config": {
      "resolution_width": 1920,
      "resolution_height": 1080,
      "elements": [
        {
          "id": "element-uuid",
          "name": "CPU Temperature",
          "element_type": "text",
          "x": 10,
          "y": 10,
          "text_config": {
            "sensor_id": "cpu_temp",
            "format": "{value} {unit}",
            "font_size": 20,
            "font_color": "#ffffff",
            "width": 200,
            "height": 30
          }
        }
      ]
    },
    "sensor_values": [
      {
        "id": "cpu_temp",
        "label": "CPU Temperature",
        "value": "45.2",
        "unit": "°C",
        "sensor_type": "number"
      }
    ]
  },
  "static_data_reload_required": false
}
```

**Error Responses:**

**404 Not Found - Client not registered:**

```json
{
  "error": "Client not registered",
  "status": 404
}
```

**403 Forbidden - Client not active:**

```json
{
  "error": "Client not active",
  "status": 403
}
```

**400 Bad Request - Missing MAC address:**

```json
{
  "error": "mac_address parameter required",
  "status": 400
}
```

**Notes:**

- Sensor values are served from the bridge's latest cached snapshot. The bridge samples all sensors once per second in a
  dedicated thread; requests never trigger a measurement.
- Before the first sampling pass completes, the endpoint responds `503`:
  `{"error": "No sensor sample available yet", "status": 503}`
- `static_data_reload_required: true` means the client should fetch and persist static data, then confirm it via
  `POST /api/static-data/ack`.
- MAC address format is automatically normalized before lookup

## Health Check

### Server Health

Check if the server is running and responsive.

**Endpoint:** `GET /health`

**Response:**

```json
{
  "status": "healthy",
  "service": "sensor-bridge",
  "protocol_version": 2,
  "timestamp": 1704067200
}
```

## Error Handling

All API endpoints return structured JSON error responses with appropriate HTTP status codes:

| Status Code | Description           | Example Response                                      |
|-------------|-----------------------|-------------------------------------------------------|
| 200         | Success               | Data response                                         |
| 400         | Bad Request           | `{"error": "mac_address is required", "status": 400}` |
| 403         | Forbidden             | `{"error": "Client not active", "status": 403}`       |
| 404         | Not Found             | `{"error": "Client not registered", "status": 404}`   |
| 500         | Internal Server Error | `{"error": "Internal server error", "status": 500}`   |

## Client Management Features

### MAC Address Normalization

The server automatically handles different MAC address formats:

- Case variants of the same MAC address resolve to the same client on register, sensor-data, static-data and confirmation
- Leading/trailing whitespace around the MAC address is ignored
- Separator style (colons, dashes, none) is preserved and intentionally not rewritten

### Client Lifecycle Management

- **Registration**: Clients are added to the in-memory registry
- **Activation**: Must be done through the server UI
- **Static Data Confirmation**: The per-client reload flag is cleared only after the client confirms a persisted payload via `POST /api/static-data/ack`
- **Automatic Cleanup**: Clients inactive for 24+ hours are automatically removed

### Performance Optimizations

- **In-Memory Registry**: Fast client lookups using `Arc<RwLock<HashMap>>`
- **Concurrent Access**: Multiple clients can be served simultaneously
- **Efficient Updates**: No file I/O on every API request
- **Background Cleanup**: Hourly cleanup task removes stale clients

## Client Implementation Example

Here's a basic example of how a client might implement the registration and data polling:

### Python Client Example

```python
import requests
import time
import json
from uuid import getnode

def get_mac_address():
    """Get the MAC address of this machine"""
    mac = getnode()
    return ':'.join(('%012X' % mac)[i:i+2] for i in range(0, 12, 2))

def get_local_ip():
    """Get the local IP address"""
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = '127.0.0.1'
    finally:
        s.close()
    return ip

class SensorBridgeClient:
    def __init__(self, server_host, server_port=55555):
        self.server_url = f"http://{server_host}:{server_port}"
        self.mac_address = get_mac_address()
        self.ip_address = get_local_ip()
        self.resolution_width = 1920
        self.resolution_height = 1080

    def register(self):
        """Register with the sensor bridge server"""
        registration_data = {
            "mac_address": self.mac_address,
            "ip_address": self.ip_address,
            "resolution_width": self.resolution_width,
            "resolution_height": self.resolution_height
        }

        response = requests.post(
            f"{self.server_url}/api/register",
            json=registration_data
        )

        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Registration failed: {response.status_code}")

    def persist_static_data(self, payload):
        # write the payload where the display reads it
        ...

    def fetch_and_persist_static_data(self):
        response = requests.get(f"{self.base_url}/api/static-data", params={"mac_address": self.mac_address})
        response.raise_for_status()
        self.persist_static_data(response.content)
        revision = response.headers["X-Static-Data-Revision"]
        ack = requests.post(
            f"{self.base_url}/api/static-data/ack",
            json={"mac_address": self.mac_address, "revision": revision},
        )
        ack.raise_for_status()

    def get_sensor_data(self):
        """Get current sensor data from the server"""
        response = requests.get(
            f"{self.server_url}/api/sensor-data",
            params={"mac_address": self.mac_address}
        )

        if response.status_code == 503:
            print("Bridge has no sensor sample yet")
            return None
        elif response.status_code == 200:
            data = response.json()
            if data["static_data_reload_required"]:
                self.fetch_and_persist_static_data()
            return data
        elif response.status_code == 404:
            raise Exception("Client not registered")
        elif response.status_code == 403:
            raise Exception("Client not active")
        else:
            raise Exception(f"Failed to get sensor data: {response.status_code}")

    def run(self):
        """Main client loop"""
        print(f"Registering client with MAC: {self.mac_address}")

        # Register with server
        registration_result = self.register()
        print(f"Registration successful: {registration_result['message']}")

        print("Waiting for activation in the server UI...")

        while True:
            try:
                # Get sensor data
                data = self.get_sensor_data()
                if data is None:
                    time.sleep(1)
                    continue

                # Process the display configuration and sensor values
                render_data = data['render_data']
                display_config = render_data['display_config']
                sensor_values = render_data['sensor_values']

                print(f"Received {len(sensor_values)} sensor values")
                print(f"Display config has {len(display_config['elements'])} elements")

                # Here you would render the display based on the configuration
                # and sensor values

            except Exception as e:
                print(f"Error: {e}")
                if "not active" in str(e):
                    print("Client is not active, waiting...")
                elif "not registered" in str(e):
                    print("Client not registered, re-registering...")
                    self.register()

            # Wait before next poll
            time.sleep(1)

if __name__ == "__main__":
    client = SensorBridgeClient("192.168.1.10")  # Replace with server IP
    client.run()
```

### JavaScript/Node.js Client Example

```javascript
const axios = require('axios');
const os = require('os');

class SensorBridgeClient {
    constructor(serverHost, serverPort = 55555) {
        this.serverUrl = `http://${serverHost}:${serverPort}`;
        this.macAddress = this.getMacAddress();
        this.ipAddress = this.getLocalIP();
        this.resolutionWidth = 1920;
        this.resolutionHeight = 1080;
    }

    getMacAddress() {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const interface of interfaces[name]) {
                if (!interface.internal && interface.mac !== '00:00:00:00:00:00') {
                    return interface.mac;
                }
            }
        }
        return '00:00:00:00:00:00';
    }

    getLocalIP() {
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const interface of interfaces[name]) {
                if (interface.family === 'IPv4' && !interface.internal) {
                    return interface.address;
                }
            }
        }
        return '127.0.0.1';
    }

    async register() {
        const registrationData = {
            mac_address: this.macAddress,
            ip_address: this.ipAddress,
            resolution_width: this.resolutionWidth,
            resolution_height: this.resolutionHeight
        };

        try {
            const response = await axios.post(`${this.serverUrl}/api/register`, registrationData);
            return response.data;
        } catch (error) {
            throw new Error(`Registration failed: ${error.response?.status || error.message}`);
        }
    }

    async getSensorData() {
        try {
            const response = await axios.get(`${this.serverUrl}/api/sensor-data`, {
                params: { mac_address: this.macAddress }
            });
            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {
                throw new Error('Client not registered');
            } else if (error.response?.status === 403) {
                throw new Error('Client not active');
            } else {
                throw new Error(`Failed to get sensor data: ${error.response?.status || error.message}`);
            }
        }
    }

    async run() {
        console.log(`Registering client with MAC: ${this.macAddress}`);

        try {
            const registrationResult = await this.register('My JS Display Client');
            console.log(`Registration successful: ${registrationResult.message}`);
        } catch (error) {
            console.error(`Registration failed: ${error.message}`);
            return;
        }

        console.log('Waiting for activation in the server UI...');

        setInterval(async () => {
            try {
                const data = await this.getSensorData();
                const renderData = data.render_data;
                const displayConfig = renderData.display_config;
                const sensorValues = renderData.sensor_values;

                console.log(`Received ${sensorValues.length} sensor values`);
                console.log(`Display config has ${displayConfig.elements.length} elements`);

                // Here you would render the display based on the configuration
                // and sensor values

                // Static data follows the same flow as the Python client: fetch
                // /api/static-data, keep the X-Static-Data-Revision header, then POST
                // it to /api/static-data/ack before using the assets.
            } catch (error) {
                console.error(`Error: ${error.message}`);

                if (error.message.includes('not active')) {
                    console.log('Client is not active, waiting...');
                } else if (error.message.includes('not registered')) {
                    console.log('Client not registered, re-registering...');
                    try {
                        await this.register();
                    } catch (regError) {
                        console.error(`Re-registration failed: ${regError.message}`);
                    }
                }
            }
        }, 1000); // Poll every second
    }
}

// Usage
const client = new SensorBridgeClient('192.168.1.10'); // Replace with server IP
client.run();
```

## Display Configuration Format

The display configuration defines what elements should be rendered on the client display. Each element has a type and
specific configuration options:

### Element Types

1. **Text Elements**: Display sensor values as text
2. **Static Images**: Display static images
3. **Graphs**: Display sensor data as line graphs
4. **Conditional Images**: Display different images based on sensor values

### Text Element Configuration

```json
{
  "id": "element-uuid",
  "name": "CPU Temperature",
  "element_type": "text",
  "x": 10,
  "y": 10,
  "text_config": {
    "sensor_id": "cpu_temp",
    "value_modifier": "raw",
    "format": "{value} {unit}",
    "font_family": "Arial",
    "font_size": 20,
    "font_color": "#ffffff",
    "width": 200,
    "height": 30,
    "alignment": "left"
  }
}
```

### Graph Element Configuration

```json
{
  "id": "element-uuid",
  "name": "CPU Usage Graph",
  "element_type": "graph",
  "x": 10,
  "y": 50,
  "graph_config": {
    "sensor_id": "cpu_usage",
    "min_sensor_value": 0.0,
    "max_sensor_value": 100.0,
    "width": 300,
    "height": 100,
    "graph_type": "line",
    "graph_color": "#00ff00",
    "graph_stroke_width": 2,
    "background_color": "#000000",
    "border_color": "#ffffff"
  }
}
```

## Implementation Notes

1. **Polling Frequency**: It's recommended to poll for sensor data every 1-2 seconds to balance responsiveness with
   server load.

2. **Error Handling**: Always implement proper error handling for network failures and server errors.

3. **Registration**: Clients should re-register if they receive a "not registered" error.

4. **MAC Address**: Ensure your MAC address detection works correctly on your target platform.

5. **Display Rendering**: The actual rendering of elements is up to the client implementation. The server provides the
   configuration and current sensor values.

6. **CORS**: The server has CORS enabled for web-based clients.

## Troubleshooting

- **404 Not Found**: Client needs to register first
- **403 Forbidden**: Client is registered but not activated in the server UI
- **Connection Refused**: Server is not running or wrong port/IP
- **Invalid JSON**: Check request body format
- **Registration Issues**: Verify MAC address format and network connectivity
