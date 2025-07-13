# System Patterns

## Tauri Window Lifecycle Management Best Practices

### Problem Pattern: Window Reopening Issues
**Context**: When managing windows in Tauri applications, especially preview or secondary windows, users often experience issues where windows cannot be reopened after being closed.

**Root Causes**:
1. **Stale Window References**: Frontend WebviewWindow API may hold stale references to destroyed windows
2. **Incomplete Cleanup**: `close()` may not fully clean up window resources compared to `destroy()`
3. **Timing Issues**: Async window destruction may not complete before attempting to create new window

### Solution Pattern: Backend-Controlled Window Lifecycle

**Implementation Strategy**:
```rust
// Backend command approach (Preferred)
#[tauri::command]
pub fn show_window(app_handle: AppHandle, params: WindowParams) {
    // Always destroy existing window first
    if let Some(existing) = app_handle.get_webview_window(WINDOW_LABEL) {
        let _ = existing.destroy(); // Use destroy(), not close()
        
        // Critical: Wait for cleanup to complete
        std::thread::sleep(std::time::Duration::from_millis(50));
        
        // Verify window is actually gone
        if app_handle.get_webview_window(WINDOW_LABEL).is_some() {
            log::error!("Window still exists after destroy()");
            return;
        }
    }
    
    // Create new window
    let window = tauri::WebviewWindowBuilder::new(&app_handle, WINDOW_LABEL, url).build();
}
```

**Frontend Integration**:
```javascript
// Use backend command instead of frontend WebviewWindow API
await invoke('show_window', { macAddress: deviceId });
```

**Key Benefits**:
- **Reliable Cleanup**: Backend has direct control over window destruction
- **Verification**: Can verify window actually destroyed before creating new one
- **Error Handling**: Better error reporting and recovery
- **Timing Control**: Can add necessary delays for async operations

### Critical Technical Details

#### Parameter Naming Convention
**Tauri automatically converts JavaScript camelCase to Rust snake_case**:
```javascript
// Frontend call
invoke('command', { macAddress: "value" })
```
```rust
// Backend signature
#[tauri::command]
fn command(mac_address: String) { }
```

#### Window Destruction Methods
- **`destroy()`**: Forces immediate cleanup, bypasses close events ✅ Recommended
- **`close()`**: Emits close events, may be intercepted ⚠️ Less reliable for programmatic use

#### Security Configuration
**Required in `desktop.json` capabilities**:
```json
{
  "windows": ["window-label"],
  "permissions": [
    "core:webview:allow-create-webview-window"
  ]
}
```

### Pattern Application
**Use backend approach when**:
- Window needs to be reopened multiple times
- Complex window lifecycle management required
- Need reliable cleanup and error handling

**Use frontend approach when**:
- Simple one-time window creation
- Window lifecycle is straightforward
- No reopening requirements

### Debugging Approach
1. **Start Simple**: Try basic label synchronization
2. **Frontend First**: Attempt stale reference handling in UI layer
3. **Backend Migration**: Move to backend commands for robust control
4. **Parameter Validation**: Ensure camelCase ↔ snake_case conversion is correct

This pattern has been successfully validated in production Tauri applications and provides the most reliable window management experience.