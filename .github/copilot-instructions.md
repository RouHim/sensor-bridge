# GitHub Copilot Instructions for Sensor Bridge

You are a coding assistant. For every task, follow these principles:

1. Sequential thinking: Break down complex problems into clear, ordered steps. Plan before you code.
2. Use project memory: Always read and understand the entire project memory (project_brief, active_context, system_patterns, tech_stack, progress_tracker) before starting. Use memory as your main source of project knowledge.
3. Online search: If you need clarification, want to verify library usage, or need examples, use online search tools to check documentation and find relevant usage patterns or sample code. Always ensure your answers are accurate and up-to-date.
4. Context7 MCP integration: Use the context7 server to access extended project context and external resources when needed.
5. Coding standards: Follow the project's coding conventions and best practices as defined in MCP or project documentation.
6. Reasoning documentation: Add comments explaining important logic and decisions, especially when you use information from memory, search, or external sources.
7. Iteration and adaptation: If you encounter errors or unclear requirements, pause, clarify, and adjust your approach before continuing.
8. Simplicity: Avoid unnecessary complexity or boilerplate. Focus on clear, maintainable solutions.

## Project Overview

**Sensor Bridge** is a linux desktop application built with **Tauri v2** that provides a bridge between system sensors and external display devices. The application serves as both a sensor data aggregator and a WYSIWYG display configuration tool.

### Architecture
- **Backend**: Rust with Tauri v2 framework
- **Frontend**: Vanilla JavaScript with ES6 modules
- **Communication**: Tauri commands for frontend-backend integration
- **HTTP API**: Warp-based REST server for client registration and data distribution
- **Sensor Core**: Custom library for reading various Linux sensor sources

## Core Technology Stack

### Backend Dependencies
```toml
# Key Dependencies (src-tauri/Cargo.toml)
tauri = { version = "2.6.2", features = ["protocol-asset", "tray-icon"] }
sensor-core = { path = "../../sensor-core" }  # Custom sensor library
warp = "0.3"                                   # HTTP server framework
tokio = { version = "1.0", features = ["full"] }
serde = { version = "1.0.197", features = ["derive"] }
lm-sensors = "0.2.1"                          # Linux sensor integration
systemstat = "0.2.3"                          # System statistics
```

### Frontend Structure
```
src/
├── index.html                 # Main application entry
├── js/
│   ├── main.js               # Application initialization
│   ├── app-state.js          # Centralized state management
│   ├── client-management.js   # HTTP client lifecycle
│   ├── element-management.js  # Display element configuration
│   ├── config-management.js   # Import/export functionality
│   ├── sensor-selection.js    # Sensor picker interface
│   ├── ui-utils.js           # DOM utilities and helpers
│   ├── dom-elements.js       # DOM element references
│   └── constants.js          # Application constants
└── libs/                     # Third-party libraries
    ├── coloris/              # Color picker
    ├── feather-icons/        # Icon library
    └── water-css-dark/       # CSS framework
```

## Key Architectural Patterns

### 1. Tauri Command Registration
All backend functionality is exposed through Tauri commands registered in `src-tauri/src/main.rs`:

```rust
.invoke_handler(tauri::generate_handler![
    get_sensor_values,
    get_registered_clients,
    update_client_name,
    remove_registered_client,
    set_client_active,
    update_client_display_config,
    show_lcd_live_preview,
    get_lcd_preview_image,
    // ... 23+ commands total
])
```

### 2. Frontend-Backend Integration
Frontend uses Tauri's `invoke` API with automatic parameter conversion:
- **JavaScript**: camelCase parameters (`macAddress`)
- **Rust**: snake_case parameters (`mac_address`)
- **Pattern**: `await invoke('command_name', { paramName: value })`

**Example**:
```javascript
// frontend: client-management.js
const result = await invoke('update_client_name', {
    macAddress: client.macAddress,
    newName: newName
});
```

```rust
// backend: main.rs
#[tauri::command]
async fn update_client_name(mac_address: String, new_name: String) -> Result<(), String>
```

### 3. HTTP Server Architecture
Warp-based HTTP server (`src-tauri/src/http_server.rs`) provides:
- Client registration via MAC address auto-discovery
- Sensor data distribution endpoints
- Health monitoring
- Graceful shutdown capabilities

### 4. State Management
- **Backend**: `AppState` struct managed by Tauri with Arc<Mutex<T>> for thread safety
- **Frontend**: `app-state.js` provides centralized state with reactive updates
- **Persistence**: Configuration stored in JSON format with import/export functionality

## Development Workflows

### Build Commands
```bash
# Development mode
cd src-tauri && cargo tauri dev

# Production build  
cd src-tauri && cargo tauri build

# Test suite
cd src-tauri && cargo test

# Code formatting
cd src-tauri && cargo fmt --all -- --check

# Linting
cd src-tauri && cargo clippy
```

### Dependencies Installation
```bash
# Tauri CLI
cargo install tauri-cli

# System dependencies (Ubuntu/Debian)
sudo apt update && sudo apt install -y \
    libwebkit2gtk-4.0-dev \
    build-essential \
    curl \
    wget \
    file \
    libssl-dev \
    libgtk-3-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libsensors4-dev \
    clang
```

## Core Functionality Areas

### 1. Sensor Data Management
- **File**: `src-tauri/src/sensor.rs`
- **Integration**: Linux lm-sensors, dmidecode, systemstat, AMD GPU sensors
- **Pattern**: Static values cached at startup, dynamic values read on-demand
- **Commands**: `get_sensor_values`, sensor-specific getters

### 2. Client Management
- **Backend**: `src-tauri/src/http_server.rs`
- **Frontend**: `src/js/client-management.js`
- **Flow**: Automatic registration → Configuration → Active status management
- **Key Pattern**: MAC address-based client identification

### 3. Display Configuration
- **Backend**: Element rendering in `lcd_preview.rs`, `text.rs`, `static_image.rs`
- **Frontend**: WYSIWYG editor in `element-management.js`
- **Preview**: Real-time preview system with `show_lcd_live_preview` command
- **Export**: Base64 image generation for external consumption

### 4. Window Management
- **Pattern**: Backend Tauri commands preferred over frontend WebviewWindow API
- **Lifecycle**: Destroy → Verify → Create with cleanup delays
- **Commands**: `show_lcd_live_preview` handles window lifecycle robustly

```rust
// Window management pattern
async fn show_lcd_live_preview(mac_address: String, app_handle: AppHandle) -> Result<(), String> {
    // 1. Destroy existing window
    // 2. Wait for cleanup (50ms)
    // 3. Verify destruction
    // 4. Create new window
}
```

## Common Tasks & Patterns

### Adding New Tauri Commands
1. Define function in appropriate Rust module with `#[tauri::command]`
2. Add to `invoke_handler` in `main.rs`
3. Call from frontend with `invoke('command_name', params)`
4. Handle async/await and error cases

### Frontend Module Pattern
```javascript
// ES6 module structure
import { invoke } from '@tauri-apps/api/core';
import { getAppState, updateAppState } from './app-state.js';

export async function functionName(params) {
    try {
        const result = await invoke('backend_command', params);
        updateAppState({ key: result });
        return result;
    } catch (error) {
        console.error('Operation failed:', error);
        throw error;
    }
}
```

### Configuration Management
- **Import**: `import_config` command with file dialog integration
- **Export**: `export_config` command with JSON serialization
- **Persistence**: Automatic saving on configuration changes
- **Validation**: Error handling for malformed configurations

### Error Handling Patterns
- **Backend**: `Result<T, String>` return types with descriptive error messages
- **Frontend**: Try-catch blocks with user-friendly error display
- **HTTP**: Proper status codes and error responses
- **Logging**: `log` crate for backend, `console` for frontend

## Testing Strategy

### Backend Tests
```bash
cd src-tauri && cargo test
```
- Unit tests for sensor reading logic
- Integration tests for HTTP endpoints
- Mock implementations for system dependencies

### CI/CD Pipeline
- **File**: `.github/workflows/pipeline.yaml`
- **Stages**: Format check → Code check → Test → Build → Release
- **Cross-platform**: Linux, Windows, macOS builds
- **Artifacts**: Signed binaries with auto-update support

## Key Files for Modification

### Adding New Sensors
- `src-tauri/src/sensor.rs` - Main sensor interface
- `src-tauri/src/linux_*_sensors.rs` - Platform-specific implementations
- `src/js/sensor-selection.js` - Frontend sensor picker

### UI Modifications
- `src/js/element-management.js` - Display element configuration
- `src/js/ui-utils.js` - Reusable UI components
- `src/style.css` - Application styling

### HTTP API Changes
- `src-tauri/src/http_server.rs` - Endpoint definitions
- `src/js/client-management.js` - Frontend client handling

### Configuration Schema
- `src-tauri/src/config.rs` - Backend configuration structures
- `src-tauri/src/export_import.rs` - Serialization logic

## Debugging Tips

### Backend Debugging
- Use `env_logger::init()` for console output
- Add `dbg!()` macros for variable inspection
- Check `target/debug/` for build artifacts

### Frontend Debugging
- Browser DevTools available in Tauri dev mode
- Console logging with structured error objects
- State inspection through `app-state.js`

### Common Issues
1. **Window Management**: Use backend commands, not frontend WebviewWindow API
2. **Parameter Naming**: Remember camelCase → snake_case conversion
3. **Async Handling**: Always await Tauri invoke calls
4. **State Synchronization**: Use centralized state management

## Security Considerations

- **File Access**: Limited to application directory and user-selected files
- **System Access**: Sensor reading requires appropriate permissions
- **HTTP Server**: CORS configuration and client validation
- **Auto-updater**: Signed releases with verification

## Performance Notes

- **Sensor Reading**: Cached static values, throttled dynamic reads
- **Image Generation**: Efficient rendering with memory management
- **HTTP Responses**: Lightweight JSON payloads
- **Frontend Updates**: Debounced state updates to prevent UI thrashing

This document provides the essential knowledge for AI coding agents to effectively work with the Sensor Bridge codebase. Focus on the command patterns, module structure, and architectural principles outlined above for maximum productivity.
