# Sensor Bridge - Product Context

## Project Overview

**Sensor Bridge** is a modern desktop application for Linux that serves system sensor information via HTTP API, enabling multiple display clients to connect and show real-time system data. The application has been completely redesigned with a modern HTTP-based architecture that separates server functionality from display clients.

## Core Purpose

Sensor Bridge solves the problem of centralized sensor monitoring by:
- Running as a server application on the main computer with sensors
- Serving real-time sensor data via RESTful HTTP API
- Supporting unlimited simultaneous display clients (Raspberry Pi, other computers, etc.)
- Providing WYSIWYG configuration for creating custom display layouts
- Enabling automatic client discovery and registration

## Architecture Overview

### Technology Stack
- **Framework**: Tauri 2.6.2 (Rust backend + JavaScript frontend)
- **Backend Language**: Rust (edition 2021, min version 1.57)
- **HTTP Server**: Warp 0.3 (lightweight, composable web server framework)
- **Frontend**: Vanilla JavaScript with modern web technologies
- **Async Runtime**: Tokio with full features
- **Serialization**: Serde JSON + Bincode for binary data
- **UI Framework**: Water CSS Dark theme + custom styling

### Core Architecture Components

1. **Server Application (Tauri)**
   - Rust backend handles sensor data collection and HTTP server
   - JavaScript frontend provides WYSIWYG display configuration UI
   - Tray icon integration for system-level access
   - File-based configuration management

2. **HTTP API Server (Warp)**
   - RESTful endpoints on port 25555
   - Client registration and management
   - Real-time sensor data streaming
   - Binary static data delivery (fonts, images)

3. **Client Registry System**
   - In-memory client tracking by MAC address
   - Automatic client lifecycle management
   - 24-hour inactive client cleanup
   - IP and resolution tracking

4. **Sensor Data Pipeline**
   - Multiple sensor backends: lm-sensors, systemstat, dmidecode, AMD GPU
   - Real-time data collection with configurable refresh rates
   - Historical data storage for graph generation
   - Value processing (raw, average, min, max)

## Key Features

### Display Configuration
- **WYSIWYG Editor**: Real-time preview while designing displays
- **Element Types**: Text, graphs, static images, conditional images
- **Flexible Layouts**: Custom positioning, sizing, fonts, colors
- **Live Preview**: See designs in real-time before deploying
- **Export/Import**: Save and share display configurations

### Client Management
- **Automatic Registration**: Clients register with MAC address, IP, resolution
- **Client Activation**: Manual activation through server UI
- **Device Naming**: Custom names for registered clients
- **Status Monitoring**: Track client connectivity and activity

### Sensor Support
- **System Metrics**: CPU, GPU, memory, temperature, fans
- **Hardware Sensors**: lm-sensors integration for hardware monitoring
- **AMD GPU**: Specialized AMD graphics card monitoring
- **Network Devices**: Custom network device configurations
- **Extensible**: Plugin-style architecture for additional sensors

### Real-time Features
- **Live Data Updates**: Configurable refresh rates
- **Graph Visualization**: Real-time line graphs with historical data
- **Conditional Displays**: Dynamic content based on sensor values
- **Performance Optimized**: Efficient data serialization and transmission

## Development Status

- **Current Version**: 0.41.x series (actively maintained)
- **Release Cadence**: Regular releases with incremental improvements
- **Platform**: Linux (AppImage distribution)
- **License**: Open source project
- **Repository**: GitHub-hosted with automated CI/CD pipeline

## Technical Implementation Details

### Frontend (JavaScript)
- Modern ES6+ JavaScript with modules
- Coloris color picker integration
- Feather icons for UI elements
- Custom element manipulation and positioning
- Real-time preview rendering
- Configuration import/export functionality

### Backend (Rust)
- Modular architecture with separate concerns:
  - `sensor.rs`: Core sensor data collection
  - `http_server.rs`: Warp-based HTTP API
  - `config.rs`: Configuration management
  - `fonts.rs`: System font handling
  - `lcd_preview.rs`: Preview generation
  - Platform-specific sensor modules

### Data Flow
1. Sensor modules collect system data
2. HTTP server exposes RESTful API endpoints
3. Clients register and receive display configurations
4. Real-time sensor data streamed to active clients
5. Frontend provides configuration interface and live preview

### API Architecture
- **Registration**: `POST /api/register` with client metadata
- **Data Access**: `GET /api/sensor-data?mac_address={mac}`
- **Health Check**: `GET /api/health`
- **Binary Data**: Optimized bincode serialization for static assets
- **Authentication**: MAC address-based client identification

## Integration Patterns

### Tauri Integration
- IPC bridge between Rust backend and JavaScript frontend
- Native system integration (tray, file dialogs, shell access)
- Cross-platform webview utilization
- Plugin system for extended functionality

### Warp HTTP Framework
- Filter-based routing and middleware
- Async request handling with Tokio
- Composable filter chains for API endpoints
- Efficient static file serving for assets

This architecture demonstrates modern desktop application patterns, combining the performance and safety of Rust with the flexibility of web technologies, while providing a robust HTTP-based service architecture for distributed sensor monitoring.