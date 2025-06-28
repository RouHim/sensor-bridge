# Sensor Bridge HTTP Server API

The sensor bridge now operates as an HTTP server where clients (displays) connect to receive sensor data and display configurations. The server runs on port **10489** by default.

## Architecture Overview

**Previous Architecture (Client Mode):**
- Sensor bridge acted as HTTP client
- Bridge connected to remote display devices
- Bridge pushed data to displays

**New Architecture (Server Mode):**
- Sensor bridge acts as HTTP server
- Display clients connect to the bridge
- Clients pull data from the bridge

## API Endpoints

### 1. Health Check
**GET** `/ping`

Returns "pong" to verify the server is running.

**Example:**
```bash
curl http://localhost:10489/ping
```

### 2. Client Registration
**POST** `/register`

Register a new display client with the server.

**Request Body:**
```json
{
  "name": "display-device-1",
  "display_config": {
    "width": 128,
    "height": 64,
    "color_depth": 1,
    "rotation": 0
  }
}
```

**Response:**
```json
{
  "client_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "registered"
}
```

**Example:**
```bash
curl -X POST http://localhost:10489/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-display",
    "display_config": {
      "width": 128,
      "height": 64,
      "color_depth": 1,
      "rotation": 0
    }
  }'
```

### 3. Get Sensor Data Stream
**GET** `/data?client_id=<client_id>`

Receive real-time sensor data. This endpoint blocks until new data is available.

**Query Parameters:**
- `client_id`: The client ID received from registration

**Response:**
- Binary data (application/octet-stream) containing serialized sensor values and display configuration

**Example:**
```bash
curl "http://localhost:10489/data?client_id=550e8400-e29b-41d4-a716-446655440000" \
  --output sensor_data.bin
```

### 4. Get Static Data
**GET** `/static/<data_type>`

Retrieve cached static data (fonts, images, etc.).

**Path Parameters:**
- `data_type`: Type of static data to retrieve:
  - `text_<device_name>`: Text rendering data
  - `static_image_<device_name>`: Static image data
  - `conditional_image_<device_name>`: Conditional image data

**Example:**
```bash
curl "http://localhost:10489/static/text_my-display" \
  --output text_data.bin
```

## Client Implementation Guide

### Basic Client Flow

1. **Register with the server:**
   ```python
   import requests
   import json
   
   registration_data = {
       "name": "my-display-device",
       "display_config": {
           "width": 128,
           "height": 64,
           "color_depth": 1,
           "rotation": 0
       }
   }
   
   response = requests.post(
       "http://sensor-bridge-ip:10489/register",
       json=registration_data
   )
   client_id = response.json()["client_id"]
   ```

2. **Continuously poll for data:**
   ```python
   while True:
       try:
           response = requests.get(
               f"http://sensor-bridge-ip:10489/data?client_id={client_id}",
               timeout=30
           )
           if response.status_code == 200:
               # Process binary sensor data
               sensor_data = response.content
               # Deserialize and render the data
               process_sensor_data(sensor_data)
       except requests.exceptions.Timeout:
           # Server may be busy, retry
           continue
       except Exception as e:
           print(f"Error: {e}")
           time.sleep(5)
   ```

3. **Handle static data (optional):**
   ```python
   # Download static resources once
   static_data = requests.get(
       f"http://sensor-bridge-ip:10489/static/text_{device_name}"
   ).content
   ```

### Data Format

The sensor data is serialized using bincode (Rust binary serialization). The structure is:

```rust
pub struct TransportMessage {
    pub transport_type: TransportType,
    pub data: Vec<u8>,
}

pub struct RenderData {
    pub display_config: DisplayConfig,
    pub sensor_values: Vec<SensorValue>,
}
```

## Server Configuration

The server behavior can be controlled through the existing sensor bridge configuration. Clients will be matched to network device configurations based on their registered name.

### Key Features

- **Client Management**: Automatic registration and cleanup of inactive clients
- **Broadcasting**: Efficient data distribution to multiple clients
- **Static Data Caching**: Pre-processed fonts, images, and layouts
- **CORS Support**: Cross-origin requests are allowed
- **Heartbeat**: Clients are automatically removed after 30 seconds of inactivity

### Migration from Previous Version

If you were previously running display devices as servers that the bridge connected to, you'll need to:

1. Update your display device code to act as HTTP clients
2. Implement the registration and data polling logic
3. Update any network configuration to point to the bridge's IP address

The bridge now runs the server, so make sure port 10489 is accessible from your display devices.
