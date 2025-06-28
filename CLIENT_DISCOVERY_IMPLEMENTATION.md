# Client-Side Server Discovery Implementation Guide (Headless/CLI Clients)

## Overview
This guide provides instructions for implementing automatic server discovery in sensor-bridge client applications that have **no interactive GUI**. The server broadcasts its presence on the network, and clients need to discover and connect to these servers programmatically.

## Server Implementation Status
✅ **COMPLETED**: The sensor-bridge server now:
- Broadcasts its presence every 5 seconds on UDP port 10490
- Sends discovery messages containing service name, port, and version
- Responds to discovery requests automatically
- No manual configuration required on server side

## Headless Client Implementation Required

### 1. **Programmatic Server Discovery**

For clients without GUI, implement automatic discovery and connection:

#### **Option A: UDP Listener (Native Applications)**

```rust
// For Rust clients (recommended)
use std::net::UdpSocket;
use std::time::Duration;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
struct ServiceDiscoveryMessage {
    service_name: String,
    server_port: u16,
    version: String,
}

#[derive(Debug)]
struct DiscoveredServer {
    ip: String,
    port: u16,
    service_name: String,
    version: String,
}

async fn discover_servers_automatically() -> Result<Vec<DiscoveredServer>, Box<dyn std::error::Error>> {
    let socket = UdpSocket::bind("0.0.0.0:0")?;
    socket.set_broadcast(true)?;
    socket.set_read_timeout(Some(Duration::from_secs(5)))?;
    
    // Send discovery request
    let discovery_request = b"SENSOR_BRIDGE_DISCOVERY";
    socket.send_to(discovery_request, "255.255.255.255:10490")?;
    
    let mut discovered_servers = Vec::new();
    let mut buf = [0; 1024];
    
    // Listen for responses for 5 seconds
    let start_time = std::time::Instant::now();
    while start_time.elapsed() < Duration::from_secs(5) {
        match socket.recv_from(&mut buf) {
            Ok((size, addr)) => {
                if let Ok(message) = bincode::deserialize::<ServiceDiscoveryMessage>(&buf[..size]) {
                    let server = DiscoveredServer {
                        ip: addr.ip().to_string(),
                        port: message.server_port,
                        service_name: message.service_name,
                        version: message.version,
                    };
                    
                    // Avoid duplicates
                    if !discovered_servers.iter().any(|s| s.ip == server.ip && s.port == server.port) {
                        println!("Discovered server: {}:{} ({})", server.ip, server.port, server.version);
                        discovered_servers.push(server);
                    }
                }
            }
            Err(_) => {
                // Timeout or error, continue
                std::thread::sleep(Duration::from_millis(100));
            }
        }
    }
    
    Ok(discovered_servers)
}

// Usage in your client application
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Discovering sensor-bridge servers...");
    
    let servers = discover_servers_automatically().await?;
    
    if servers.is_empty() {
        println!("No servers found on the network");
        return Ok(());
    }
    
    // Connect to the first available server
    let server = &servers[0];
    println!("Connecting to server at {}:{}", server.ip, server.port);
    
    // Your connection logic here
    connect_to_server(server).await?;
    
    Ok(())
}

async fn connect_to_server(server: &DiscoveredServer) -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    let server_url = format!("http://{}:{}", server.ip, server.port);
    
    // Test connection
    let response = client.get(&format!("{}/ping", server_url)).send().await?;
    
    if response.status().is_success() {
        println!("Successfully connected to {}", server_url);
        
        // Register with the server
        register_with_server(&client, &server_url).await?;
        
        // Start data streaming
        start_data_streaming(&client, &server_url).await?;
    } else {
        return Err(format!("Server not responding: {}", response.status()).into());
    }
    
    Ok(())
}

async fn register_with_server(
    client: &reqwest::Client, 
    server_url: &str
) -> Result<String, Box<dyn std::error::Error>> {
    let registration = serde_json::json!({
        "name": "Headless Client",
        "display_config": {
            "resolution_width": 800,
            "resolution_height": 600,
            "elements": []
        }
    });
    
    let response = client
        .post(&format!("{}/register", server_url))
        .json(&registration)
        .send()
        .await?;
    
    let result: serde_json::Value = response.json().await?;
    let client_id = result["client_id"].as_str().unwrap_or("").to_string();
    
    println!("Registered with server, client ID: {}", client_id);
    Ok(client_id)
}

async fn start_data_streaming(
    client: &reqwest::Client,
    server_url: &str
) -> Result<(), Box<dyn std::error::Error>> {
    // Implementation depends on your client's needs
    // This is a basic example
    
    loop {
        let response = client
            .get(&format!("{}/data?client_id=YOUR_CLIENT_ID", server_url))
            .send()
            .await?;
        
        if response.status().is_success() {
            let data = response.bytes().await?;
            // Process sensor data
            process_sensor_data(&data).await?;
        }
        
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}

async fn process_sensor_data(data: &[u8]) -> Result<(), Box<dyn std::error::Error>> {
    // Deserialize and process the sensor data
    // Implementation depends on your client's purpose
    println!("Received {} bytes of sensor data", data.len());
    Ok(())
}
```

#### **Option B: Python Client Implementation**

```python
import socket
import struct
import time
import json
import requests
from typing import List, Dict, Optional

class DiscoveredServer:
    def __init__(self, ip: str, port: int, service_name: str, version: str):
        self.ip = ip
        self.port = port
        self.service_name = service_name
        self.version = version
    
    def __str__(self):
        return f"{self.service_name} at {self.ip}:{self.port} (v{self.version})"

def discover_servers() -> List[DiscoveredServer]:
    """Discover sensor-bridge servers on the network."""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    sock.settimeout(5.0)  # 5 second timeout
    
    try:
        # Send discovery request
        discovery_message = b"SENSOR_BRIDGE_DISCOVERY"
        sock.sendto(discovery_message, ('255.255.255.255', 10490))
        
        discovered_servers = []
        start_time = time.time()
        
        while time.time() - start_time < 5.0:  # Listen for 5 seconds
            try:
                data, addr = sock.recvfrom(1024)
                
                # Try to parse as discovery response
                try:
                    # Assuming the server sends JSON responses
                    # You may need to adjust this based on the actual message format
                    message = json.loads(data.decode('utf-8'))
                    
                    if message.get('service_name') == 'sensor_bridge':
                        server = DiscoveredServer(
                            ip=addr[0],
                            port=message.get('server_port', 10489),
                            service_name=message.get('service_name', 'sensor_bridge'),
                            version=message.get('version', 'unknown')
                        )
                        
                        # Avoid duplicates
                        if not any(s.ip == server.ip and s.port == server.port for s in discovered_servers):
                            print(f"Discovered: {server}")
                            discovered_servers.append(server)
                            
                except (json.JSONDecodeError, UnicodeDecodeError):
                    # Not a valid discovery response, ignore
                    continue
                    
            except socket.timeout:
                break
                
    finally:
        sock.close()
    
    return discovered_servers

def connect_to_server(server: DiscoveredServer) -> Optional[str]:
    """Connect to a discovered server and return client ID."""
    server_url = f"http://{server.ip}:{server.port}"
    
    try:
        # Test connection
        response = requests.get(f"{server_url}/ping", timeout=5)
        response.raise_for_status()
        
        print(f"Successfully connected to {server_url}")
        
        # Register with server
        registration_data = {
            "name": "Python Headless Client",
            "display_config": {
                "resolution_width": 800,
                "resolution_height": 600,
                "elements": []
            }
        }
        
        response = requests.post(f"{server_url}/register", json=registration_data, timeout=5)
        response.raise_for_status()
        
        result = response.json()
        client_id = result.get('client_id')
        
        print(f"Registered with server, client ID: {client_id}")
        return client_id
        
    except requests.RequestException as e:
        print(f"Failed to connect to {server_url}: {e}")
        return None

def stream_data(server: DiscoveredServer, client_id: str):
    """Stream sensor data from the server."""
    server_url = f"http://{server.ip}:{server.port}"
    
    print(f"Starting data stream from {server_url}")
    
    while True:
        try:
            response = requests.get(
                f"{server_url}/data",
                params={"client_id": client_id},
                timeout=10
            )
            
            if response.status_code == 200:
                # Process the sensor data
                data = response.content
                print(f"Received {len(data)} bytes of sensor data")
                
                # Your data processing logic here
                process_sensor_data(data)
                
            else:
                print(f"Error getting data: {response.status_code}")
                
        except requests.RequestException as e:
            print(f"Error streaming data: {e}")
            time.sleep(5)  # Wait before retrying
            continue
        
        time.sleep(1)  # Wait before next request

def process_sensor_data(data: bytes):
    """Process received sensor data."""
    # Implement your data processing logic here
    # This depends on what your client needs to do with the data
    pass

def main():
    print("Discovering sensor-bridge servers...")
    
    servers = discover_servers()
    
    if not servers:
        print("No servers found on the network")
        return
    
    # Connect to the first available server
    server = servers[0]
    print(f"Connecting to: {server}")
    
    client_id = connect_to_server(server)
    
    if client_id:
        # Start streaming data
        stream_data(server, client_id)
    else:
        print("Failed to connect to server")

if __name__ == "__main__":
    main()
```

#### **Option C: Node.js Client Implementation**

```javascript
const dgram = require('dgram');
const axios = require('axios');

class DiscoveredServer {
    constructor(ip, port, serviceName, version) {
        this.ip = ip;
        this.port = port;
        this.serviceName = serviceName;
        this.version = version;
    }
    
    toString() {
        return `${this.serviceName} at ${this.ip}:${this.port} (v${this.version})`;
    }
}

async function discoverServers() {
    return new Promise((resolve) => {
        const socket = dgram.createSocket('udp4');
        const discoveredServers = [];
        
        socket.bind(() => {
            socket.setBroadcast(true);
            
            // Listen for responses
            socket.on('message', (msg, rinfo) => {
                try {
                    const data = JSON.parse(msg.toString());
                    if (data.service_name === 'sensor_bridge') {
                        const server = new DiscoveredServer(
                            rinfo.address,
                            data.server_port || 10489,
                            data.service_name,
                            data.version || 'unknown'
                        );
                        
                        // Avoid duplicates
                        const exists = discoveredServers.some(s => 
                            s.ip === server.ip && s.port === server.port
                        );
                        
                        if (!exists) {
                            console.log(`Discovered: ${server}`);
                            discoveredServers.push(server);
                        }
                    }
                } catch (e) {
                    // Not a valid discovery response, ignore
                }
            });
            
            // Send discovery request
            const discoveryMessage = Buffer.from('SENSOR_BRIDGE_DISCOVERY');
            socket.send(discoveryMessage, 10490, '255.255.255.255');
            
            // Timeout after 5 seconds
            setTimeout(() => {
                socket.close();
                resolve(discoveredServers);
            }, 5000);
        });
    });
}

async function connectToServer(server) {
    const serverUrl = `http://${server.ip}:${server.port}`;
    
    try {
        // Test connection
        await axios.get(`${serverUrl}/ping`, { timeout: 5000 });
        console.log(`Successfully connected to ${serverUrl}`);
        
        // Register with server
        const registrationData = {
            name: "Node.js Headless Client",
            display_config: {
                resolution_width: 800,
                resolution_height: 600,
                elements: []
            }
        };
        
        const response = await axios.post(`${serverUrl}/register`, registrationData, {
            timeout: 5000
        });
        
        const clientId = response.data.client_id;
        console.log(`Registered with server, client ID: ${clientId}`);
        
        return clientId;
        
    } catch (error) {
        console.error(`Failed to connect to ${serverUrl}:`, error.message);
        return null;
    }
}

async function streamData(server, clientId) {
    const serverUrl = `http://${server.ip}:${server.port}`;
    console.log(`Starting data stream from ${serverUrl}`);
    
    while (true) {
        try {
            const response = await axios.get(`${serverUrl}/data`, {
                params: { client_id: clientId },
                timeout: 10000,
                responseType: 'arraybuffer'
            });
            
            const data = response.data;
            console.log(`Received ${data.length} bytes of sensor data`);
            
            // Process the sensor data
            processSensorData(data);
            
        } catch (error) {
            console.error('Error streaming data:', error.message);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait before retrying
            continue;
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before next request
    }
}

function processSensorData(data) {
    // Implement your data processing logic here
    // This depends on what your client needs to do with the data
}

async function main() {
    console.log('Discovering sensor-bridge servers...');
    
    const servers = await discoverServers();
    
    if (servers.length === 0) {
        console.log('No servers found on the network');
        return;
    }
    
    // Connect to the first available server
    const server = servers[0];
    console.log(`Connecting to: ${server}`);
    
    const clientId = await connectToServer(server);
    
    if (clientId) {
        // Start streaming data
        await streamData(server, clientId);
    } else {
        console.log('Failed to connect to server');
    }
}

main().catch(console.error);
```

### 2. **Configuration-Based Discovery**

For clients that need to remember discovered servers:

```rust
// Save discovered servers to configuration
use serde::{Deserialize, Serialize};
use std::fs;

#[derive(Debug, Serialize, Deserialize)]
struct ClientConfig {
    known_servers: Vec<DiscoveredServer>,
    preferred_server: Option<String>, // IP address
    auto_connect: bool,
    discovery_interval: u64, // seconds
}

impl ClientConfig {
    fn load_or_default() -> Self {
        match fs::read_to_string("client_config.json") {
            Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
            Err(_) => Self::default(),
        }
    }
    
    fn save(&self) -> Result<(), Box<dyn std::error::Error>> {
        let content = serde_json::to_string_pretty(self)?;
        fs::write("client_config.json", content)?;
        Ok(())
    }
    
    fn add_server(&mut self, server: DiscoveredServer) {
        // Remove existing entry for same IP
        self.known_servers.retain(|s| s.ip != server.ip);
        // Add new entry
        self.known_servers.push(server);
    }
}

impl Default for ClientConfig {
    fn default() -> Self {
        Self {
            known_servers: Vec::new(),
            preferred_server: None,
            auto_connect: true,
            discovery_interval: 30,
        }
    }
}
```

### 3. **Continuous Discovery Mode**

For clients that need to monitor for new servers:

```rust
async fn continuous_discovery_mode() -> Result<(), Box<dyn std::error::Error>> {
    let mut config = ClientConfig::load_or_default();
    let mut current_server: Option<DiscoveredServer> = None;
    
    loop {
        // Discover servers
        let servers = discover_servers_automatically().await?;
        
        // Update known servers
        for server in &servers {
            config.add_server(server.clone());
        }
        config.save()?;
        
        // Connect to preferred server or first available
        let target_server = if let Some(preferred_ip) = &config.preferred_server {
            servers.iter().find(|s| &s.ip == preferred_ip)
        } else {
            servers.first()
        };
        
        if let Some(server) = target_server {
            if current_server.as_ref().map(|s| &s.ip) != Some(&server.ip) {
                println!("Switching to server: {}:{}", server.ip, server.port);
                current_server = Some(server.clone());
                
                // Connect and start data streaming in background
                tokio::spawn(connect_and_stream(server.clone()));
            }
        } else if current_server.is_some() {
            println!("No servers available, disconnecting");
            current_server = None;
        }
        
        // Wait before next discovery
        tokio::time::sleep(Duration::from_secs(config.discovery_interval)).await;
    }
}

async fn connect_and_stream(server: DiscoveredServer) -> Result<(), Box<dyn std::error::Error>> {
    connect_to_server(&server).await?;
    // Continue with data streaming...
    Ok(())
}
```

### 4. **Command Line Interface**

For CLI clients that need some user interaction:

```rust
use clap::{Arg, Command};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let matches = Command::new("sensor-bridge-client")
        .version("1.0")
        .about("Sensor Bridge Client")
        .arg(Arg::new("discover")
            .long("discover")
            .help("Discover servers and exit")
            .action(clap::ArgAction::SetTrue))
        .arg(Arg::new("auto-connect")
            .long("auto-connect")
            .help("Automatically connect to first discovered server")
            .action(clap::ArgAction::SetTrue))
        .arg(Arg::new("server")
            .long("server")
            .value_name("IP")
            .help("Connect to specific server IP"))
        .get_matches();

    if matches.get_flag("discover") {
        // Discovery mode
        let rt = tokio::runtime::Runtime::new()?;
        rt.block_on(async {
            let servers = discover_servers_automatically().await?;
            for server in servers {
                println!("{}", server);
            }
            Ok::<(), Box<dyn std::error::Error>>(())
        })?;
    } else if matches.get_flag("auto-connect") {
        // Auto-connect mode
        let rt = tokio::runtime::Runtime::new()?;
        rt.block_on(continuous_discovery_mode())?;
    } else if let Some(server_ip) = matches.get_one::<String>("server") {
        // Connect to specific server
        println!("Connecting to specified server: {}", server_ip);
        // Implementation for connecting to specific IP
    } else {
        println!("Use --help for usage information");
    }

    Ok(())
}
```

## Implementation Strategy

1. **Choose the appropriate language/framework** for your client
2. **Implement UDP discovery** using the examples above
3. **Add server validation** to ensure discovered servers are legitimate
4. **Implement automatic connection** and data streaming
5. **Add configuration persistence** to remember discovered servers
6. **Handle network changes** and server disconnections gracefully

## Testing

Test your headless client by:

1. **Starting the sensor-bridge server**
2. **Running your client discovery code**
3. **Verifying automatic connection and data streaming**
4. **Testing network interruption recovery**

This approach allows headless clients to automatically discover and connect to sensor-bridge servers without any user interaction.
