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
- **RESTful API**: Clean HTTP API for easy integration with custom clients

## Key Features

* **HTTP API Server**: Serves sensor data via RESTful endpoints
* **Automatic Client Discovery**: Clients register themselves with MAC address, IP, and resolution
* **Multiple Display Support**: Connect unlimited display clients simultaneously
* **WUSIWUG Configuration**: Design and manage displays
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

### 2. Start the Display Client

Download and run the sensor-display client on the device that will show the sensor data (this could be another computer,
Raspberry Pi, etc.):

Head over to the sensor-display [Releases](https://github.com/rouhim/sensor-display/releases) page and download the
latest version of
the sensor-display client for your platform.

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

## API Reference

For complete API documentation, see [API.md](API.md).

Quick reference:

- `POST /api/register` - Register/update client
- `GET /api/sensor-data?mac_address={mac}` - Get sensor data
- `GET /api/health` - Server health check
