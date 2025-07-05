# System Patterns and Architecture

## Design Patterns Used

### 1. Client-Server Architecture Pattern
- **Server**: Sensor Bridge application running on main computer
- **Clients**: Display devices (Raspberry Pi, other computers)
- **Communication**: HTTP-based RESTful API
- **Benefits**: Scalability, separation of concerns, platform independence

### 2. Observer Pattern (Event-Driven)
- **Sensor Data Updates**: Real-time data collection triggers UI updates
- **Client Registration**: Server observes client lifecycle events
- **Configuration Changes**: Live preview updates on configuration modifications
- **Implementation**: Tokio async runtime with event loops

### 3. Registry Pattern
- **Client Registry**: In-memory tracking of connected clients
- **Sensor Registry**: Dynamic sensor discovery and management
- **Configuration Registry**: Centralized display configuration storage
- **Cleanup**: Automatic expiration and cleanup mechanisms

### 4. Factory Pattern
- **Sensor Factories**: Different sensor types (lm-sensors, systemstat, AMD GPU)
- **Element Factories**: UI element creation (text, graphs, images)
- **Client Factories**: Display client instantiation based on registration

### 5. Strategy Pattern
- **Sensor Backends**: Pluggable sensor data sources
- **Rendering Strategies**: Different display element rendering approaches
- **Data Processing**: Various value modifiers (raw, average, min, max)

## Architectural Layers

### 1. Presentation Layer (Frontend)
```
JavaScript UI → Tauri IPC → Rust Backend
├── WYSIWYG Editor
├── Client Management Interface
├── Configuration Import/Export
└── Live Preview System
```

### 2. Application Layer (Tauri Bridge)
```
Tauri Application Layer
├── IPC Command Handlers
├── Menu and Tray Management
├── File System Operations
└── System Integration
```

### 3. Business Logic Layer (Rust Core)
```
Core Business Logic
├── Sensor Data Collection
├── Client Registry Management
├── Configuration Processing
└── Display Generation
```

### 4. Infrastructure Layer
```
Infrastructure Services
├── HTTP Server (Warp)
├── File System (Configuration Storage)
├── System APIs (Sensor Access)
└── Network Communication
```

## Data Flow Patterns

### 1. Sensor Data Pipeline
```
Hardware Sensors → Sensor Modules → Data Aggregation → HTTP API → Clients
```

### 2. Configuration Flow
```
UI Designer → Configuration Object → Validation → Storage → Client Distribution
```

### 3. Client Registration Flow
```
Client Request → MAC Validation → Registry Update → Static Data Response
```

## Concurrency Patterns

### 1. Async/Await Pattern (Tokio)
- **HTTP Server**: Non-blocking request handling
- **Sensor Collection**: Parallel sensor data gathering
- **File Operations**: Async file I/O for configurations

### 2. Message Passing
- **IPC Communication**: Tauri command/event system
- **Client Updates**: HTTP-based data streaming
- **Internal Communication**: Rust channel-based messaging

### 3. Shared State Management
- **Thread-Safe Collections**: Arc<Mutex<T>> for client registry
- **Configuration State**: Atomic reference counting for configs
- **Sensor History**: Protected historical data storage

## Error Handling Patterns

### 1. Result Type Pattern (Rust)
```rust
Result<T, E> chain propagation
├── Sensor read errors
├── HTTP request failures
├── Configuration validation errors
└── File I/O exceptions
```

### 2. Graceful Degradation
- **Sensor Failures**: Continue with available sensors
- **Client Disconnections**: Automatic cleanup and retry
- **Configuration Errors**: Fallback to defaults

### 3. Logging and Monitoring
- **Structured Logging**: env_logger integration
- **Error Propagation**: Context-aware error messages
- **Health Checks**: API endpoint for system status

## Performance Patterns

### 1. Lazy Loading
- **Font Loading**: Load fonts only when needed for elements
- **Image Processing**: Process images on-demand
- **Sensor Initialization**: Initialize sensors as accessed

### 2. Caching Strategies
- **Static Assets**: Cache fonts and images in memory
- **Sensor Data**: Historical data caching for graphs
- **Configuration**: Cache parsed configurations

### 3. Resource Pooling
- **HTTP Connections**: Connection reuse for client communication
- **Thread Pool**: Tokio runtime thread management
- **Memory Management**: Efficient Rust memory handling

## Security Patterns

### 1. Input Validation
- **MAC Address Normalization**: Consistent format enforcement
- **Configuration Validation**: Schema-based validation
- **File Path Sanitization**: Secure file operations

### 2. Resource Protection
- **File System Access**: Controlled directory access
- **Network Binding**: Restricted port binding
- **System Commands**: Sandboxed shell execution

### 3. Data Sanitization
- **Sensor Data**: Type-safe data handling
- **User Input**: Frontend input validation
- **File Content**: Safe deserialization practices

## Extensibility Patterns

### 1. Plugin Architecture
- **Sensor Plugins**: Modular sensor implementations
- **Display Plugins**: Extensible element types
- **Export Plugins**: Multiple configuration formats

### 2. Configuration-Driven Behavior
- **Display Elements**: JSON-configured rendering
- **Sensor Settings**: Runtime configuration changes
- **Client Behavior**: Configurable refresh rates

### 3. Interface Segregation
- **Sensor Traits**: Common interface for all sensors
- **Element Traits**: Unified rendering interface
- **Client Traits**: Standard client communication interface

This pattern implementation ensures maintainable, scalable, and robust sensor monitoring system architecture.