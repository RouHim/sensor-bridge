# Sensor Bridge HTTP API Documentation

This document describes the HTTP API endpoints that clients can use to connect to and interact with the Sensor Bridge server.

## Overview

The Sensor Bridge now uses HTTP communication instead of TCP. Clients register themselves with the server by providing their MAC address, IP address, and display resolution. The server then provides sensor data to registered and active clients.

## Base URL

The server runs on port `8080` by default.

```
http://<server-ip>:8080
```

## Authentication

Currently, no authentication is required. Clients are identified by their MAC address.

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
  "resolution_height": 1080,
  "name": "Optional custom name"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Client registered successfully",
  "client": {
    "mac_address": "aa:bb:cc:dd:ee:ff",
    "name": "Display aa:bb:cc",
    "ip_address": "192.168.1.100",
    "resolution_width": 1920,
    "resolution_height": 1080,
    "active": false,
    "last_seen": 1704067200,
    "display_config": {
      "resolution_width": 1920,
      "resolution_height": 1080,
      "elements": []
    }
  }
}
```

**Notes:**
- MAC address is used as the unique identifier
- If `name` is not provided, a default name will be generated
- Clients start as inactive and must be activated through the UI

## Sensor Data

### Get Sensor Data

Retrieves current sensor data and display configuration for a registered client.

**Endpoint:** `GET /api/sensor-data?mac_address={mac_address}`

**Parameters:**
- `mac_address`: The MAC address of the registered client

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
  "timestamp": 1704067200
}
```

**Error Responses:**
- `404 Not Found`: Client not registered
- `403 Forbidden`: Client is not active

## Health Check

### Server Health

Check if the server is running and responsive.

**Endpoint:** `GET /api/health`

**Response:**
```json
{
  "status": "healthy",
  "service": "sensor-bridge",
  "timestamp": 1704067200
}
```

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
    def __init__(self, server_host, server_port=8080):
        self.server_url = f"http://{server_host}:{server_port}"
        self.mac_address = get_mac_address()
        self.ip_address = get_local_ip()
        self.resolution_width = 1920
        self.resolution_height = 1080
        
    def register(self, name=None):
        """Register with the sensor bridge server"""
        registration_data = {
            "mac_address": self.mac_address,
            "ip_address": self.ip_address,
            "resolution_width": self.resolution_width,
            "resolution_height": self.resolution_height
        }
        
        if name:
            registration_data["name"] = name
            
        response = requests.post(
            f"{self.server_url}/api/register",
            json=registration_data
        )
        
        if response.status_code == 200:
            return response.json()
        else:
            raise Exception(f"Registration failed: {response.status_code}")
    
    def get_sensor_data(self):
        """Get current sensor data from the server"""
        response = requests.get(
            f"{self.server_url}/api/sensor-data",
            params={"mac_address": self.mac_address}
        )
        
        if response.status_code == 200:
            return response.json()
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
        registration_result = self.register("My Display Client")
        print(f"Registration successful: {registration_result['message']}")
        
        print("Waiting for activation in the server UI...")
        
        while True:
            try:
                # Get sensor data
                data = self.get_sensor_data()
                
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
    constructor(serverHost, serverPort = 8080) {
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
    
    async register(name = null) {
        const registrationData = {
            mac_address: this.macAddress,
            ip_address: this.ipAddress,
            resolution_width: this.resolutionWidth,
            resolution_height: this.resolutionHeight
        };
        
        if (name) {
            registrationData.name = name;
        }
        
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

The display configuration defines what elements should be rendered on the client display. Each element has a type and specific configuration options:

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

1. **Polling Frequency**: It's recommended to poll for sensor data every 1-2 seconds to balance responsiveness with server load.

2. **Error Handling**: Always implement proper error handling for network failures and server errors.

3. **Registration**: Clients should re-register if they receive a "not registered" error.

4. **MAC Address**: Ensure your MAC address detection works correctly on your target platform.

5. **Display Rendering**: The actual rendering of elements is up to the client implementation. The server provides the configuration and current sensor values.

6. **CORS**: The server has CORS enabled for web-based clients.

## Troubleshooting

- **404 Not Found**: Client needs to register first
- **403 Forbidden**: Client is registered but not activated in the server UI
- **Connection Refused**: Server is not running or wrong port/IP
- **Invalid JSON**: Check request body format
- **Registration Issues**: Verify MAC address format and network connectivity
