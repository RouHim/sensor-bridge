# Sensor Bridge

<p align="center">
    <img src=".github/readme/banner.png" width="300"/>
</p>

<p align="center">
    <img alt="GitHub release (with filter)" src="https://img.shields.io/github/v/release/rouhim/sensor-bridge">
    <img alt="GitHub Release Date - Published_At" src="https://img.shields.io/github/release-date/rouhim/sensor-bridge">
    <img alt="GitHub Workflow Status (with event)" src="https://img.shields.io/github/actions/workflow/status/rouhim/sensor-bridge/pipeline.yaml">
</p>

<p align="center">
    <i>Sensor Bridge is a desktop application for Linux that serves sensor information via HTTP API, allowing multiple display clients to connect and show real-time system data.</i>
</p>

<p align="center">
    <a id="sensor-bridge-download-linux" href="https://github.com/RouHim/sensor-bridge/releases/download/0.41.13/sensor-bridge_0.41.13_amd64.AppImage"><img src=".github/readme/dl-linux.png" width="250"/></a>
</p>

## Architecture Overview

Sensor Bridge has been completely redesigned with a modern HTTP-based architecture:

- **Server Application**: The main sensor-bridge application runs on your computer and serves sensor data via HTTP API
- **Client Registration**: Display clients automatically register themselves with the server using their MAC address
- **Web-based Management**: Configure and manage connected displays through an intuitive web interface
- **RESTful API**: Clean HTTP API for easy integration with custom clients

## Key Features

* **HTTP API Server**: Serves sensor data via RESTful endpoints (default port: 8080)
* **Automatic Client Discovery**: Clients register themselves with MAC address, IP, and resolution
* **Multiple Display Support**: Connect unlimited display clients simultaneously
* **Web-based Configuration**: Design and manage displays through the built-in web interface
* **Real-time Data**: Live sensor data updates with configurable refresh rates
* **Flexible Display Elements**: Support for text, graphs, images, and conditional displays
* **Client Management**: Enable/disable clients, assign custom names, and remove devices
* **Export/Import**: Save and share your display configurations
* **Live Preview**: See your designs in real-time before deploying

## Getting Started

### 1. Start the Server

Download and run the Sensor Bridge application on your main computer (the one with sensors you want to monitor):

```bash
./sensor-bridge_0.41.13_amd64.AppImage
```

The server will start on port 8080 and begin collecting sensor data.

### 2. Connect Display Clients

Display clients can connect to the server using the HTTP API. See the [API Documentation](API.md) for detailed implementation examples.

**Quick Python client example:**
```python
import requests

# Register with server
registration_data = {
    "mac_address": "aa:bb:cc:dd:ee:ff",
    "ip_address": "192.168.1.100", 
    "resolution_width": 1920,
    "resolution_height": 1080,
    "name": "My Display"
}

response = requests.post("http://server-ip:8080/api/register", json=registration_data)
```

### 3. Configure Displays

1. Open the Sensor Bridge web interface
2. Your registered clients will appear in the client list
3. Select a client and click "Activate" to enable it
4. Design your display by adding text, graph, and image elements
5. Save your configuration

### 4. Monitor in Real-time

Activated clients will automatically receive sensor data and display configuration updates.

## Client Development

Sensor Bridge provides a comprehensive HTTP API for building custom display clients. See [API.md](API.md) for:

- Complete API reference
- Client implementation examples (Python, JavaScript)
- Display configuration format
- Error handling guidelines

### Supported Client Platforms

- **Desktop Applications**: Any language with HTTP support
- **Web Browsers**: JavaScript/HTML5 implementations
- **Mobile Apps**: Android/iOS with HTTP capabilities
- **Embedded Devices**: Raspberry Pi, Arduino with network connectivity
- **Smart Displays**: Custom hardware implementations

## Configuration

### Server Configuration

The server runs with these default settings:
- **Port**: 8080 (HTTP API)
- **CORS**: Enabled for web clients
- **Data Update Rate**: 1 second
- **Client Timeout**: Configurable via UI

### Client Registration

Clients identify themselves using:
- **MAC Address**: Unique identifier (required)
- **IP Address**: Current network address (auto-detected)
- **Resolution**: Display dimensions (width x height)
- **Name**: Optional friendly name (auto-generated if not provided)

## Display Elements

Create rich displays using these element types:

### Text Elements
- Display sensor values with custom formatting
- Support for system fonts and colors
- Alignment and sizing options
- Value modifiers (raw, average, min, max)

### Graph Elements  
- Real-time line graphs of sensor data
- Configurable colors, stroke width, and background
- Auto-scaling or fixed value ranges
- Historical data visualization

### Image Elements
- Static images for logos and backgrounds
- Conditional images that change based on sensor values
- Support for multiple image formats
- Automatic scaling and positioning

## System Requirements

### Server (Sensor Bridge Application)
- **OS**: Linux (Ubuntu 18.04+, Fedora 30+, Arch Linux)
- **Memory**: 50MB RAM minimum
- **CPU**: Minimal impact, uses system sensor APIs
- **Network**: Local network access for client connections

### Display Clients
- **Network**: HTTP client capability
- **Display**: Any resolution supported
- **Processing**: Minimal - rendering handled client-side

## Migration from TCP Version

If you're upgrading from the TCP-based version:

1. **Automatic Migration**: Existing configurations are preserved
2. **Client Updates Required**: TCP clients must be updated to use HTTP API
3. **New Registration**: Clients now register automatically instead of manual configuration
4. **Enhanced Features**: Web-based management and improved multi-client support

## Troubleshooting

### Common Issues

**Clients not appearing in UI:**
- Ensure client is calling `/api/register` endpoint
- Check network connectivity between client and server
- Verify MAC address format in registration request

**"Client not active" errors:**
- Activate the client in the server UI
- Check that client is registered and visible in client list

**Connection refused:**
- Verify server is running on port 8080
- Check firewall settings
- Ensure correct server IP address

**Display not updating:**
- Confirm client is polling `/api/sensor-data` endpoint
- Check client active status in server UI
- Verify sensor data is being collected on server

## API Reference

For complete API documentation, see [API.md](API.md).

Quick reference:
- `POST /api/register` - Register/update client
- `GET /api/sensor-data?mac_address={mac}` - Get sensor data
- `GET /api/health` - Server health check

## Development

### Building from Source

```bash
# Install dependencies
npm install

# Build frontend
npm run build

# Build Rust backend  
cd src-tauri
cargo build --release
```

### Project Structure

```
sensor-bridge/
├── src/                    # Frontend (HTML, CSS, JavaScript)
├── src-tauri/             # Backend (Rust)
│   ├── src/
│   │   ├── main.rs        # Main application
│   │   ├── http_server.rs # HTTP API server
│   │   ├── config.rs      # Client management
│   │   └── ...
└── API.md                 # API documentation
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Roadmap

- [ ] **Mobile Apps**: Native Android/iOS applications
- [ ] **Web Dashboard**: Browser-based display client
- [ ] **Docker Support**: Containerized deployment
- [ ] **Plugin System**: Custom sensor data sources
- [ ] **Cloud Sync**: Configuration backup and sharing
- [ ] **Authentication**: Optional client authentication
- [ ] **Themes**: Pre-built display templates
- [ ] **Advanced Graphics**: 3D visualizations and animations

## Acknowledgments

- Built with [Tauri](https://tauri.app/) for the desktop application framework
- Uses [Axum](https://github.com/tokio-rs/axum) for the HTTP server
- Sensor data collection via Linux system APIs
