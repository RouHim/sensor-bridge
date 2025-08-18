# Agent Coding Guide for Sensor Bridge

**Build, Lint, and Test Commands**
- Backend (Rust/Tauri):
  - `cd src-tauri && cargo tauri dev` — Development mode
  - `cd src-tauri && cargo tauri build` — Production build
  - `cd src-tauri && cargo test` — Run all tests
  - `cd src-tauri && cargo test fonts_test` — Run a single test (see src-tauri/src/fonts_test.rs)
  - `cd src-tauri && cargo fmt --all -- --check` — Format check
  - `cd src-tauri && cargo clippy` — Linting
- CI/CD: Automated via .github/workflows/pipeline.yaml

**Agent Principles & Workflow**
- Use sequential thinking: break tasks into clear steps, plan before coding.
- Always read and use project memory files for context.
- Search online to verify library usage and patterns; use up-to-date docs.
- Document important logic and decisions, especially when using memory or external sources.
- Prefer simplicity and clarity over unnecessary complexity.
- Adapt and iterate: clarify requirements and adjust approach if needed.
- Use context7 for extended docs and project context when available.
- Follow project coding standards and best practices.

**Code Style Guidelines**
- **Imports**: Group by standard, external, then local. Use explicit imports.
- **Formatting**: Use `cargo fmt` for Rust, Prettier for JS. Indent: 4 spaces (Rust), 2 spaces (JS).
- **Types**: Prefer explicit types in Rust (`Result<T, String>` for errors). Use ES6 modules and JSDoc for JS.
- **Naming**: Use snake_case for Rust, camelCase for JS. Match frontend/backend param names (camelCase ↔ snake_case).
- **Error Handling & Logging**: Rust: `Result<T, String>` with descriptive errors, assertions in tests. JS: try/catch with user-friendly messages.
- **State**: Centralize state in `src/js/app-state.js` (frontend) and `AppState` (backend).
- **Testing**: Write unit/integration tests in Rust (see src-tauri/src/fonts_test.rs). Use mocks for system calls.

**Architecture & Patterns**
- See architecture diagrams in readme/architecture.png and .psd.
- Use Tauri command registration and frontend-backend param conversion.
- For advanced agentic patterns, see .github/copilot-instructions.md.

**Key Project Structure**
- **Backend**: `src-tauri/src/` - Rust modules (sensor.rs, http_server.rs, config.rs, etc.)
- **Frontend**: `src/js/` - ES6 modules (app-state.js, client-management.js, element-management.js)
- **API**: HTTP server on port 25555, documented in API.md
- **CLI Rules**: `.clinerules-*` files define mode-specific agent behaviors

**Common Patterns**
- **Tauri Commands**: Add `#[tauri::command]` to Rust functions, register in main.rs, call with `invoke('command_name', params)`
- **Frontend Modules**: Use ES6 imports, centralized state updates, try/catch error handling
- **Window Management**: Use backend commands, not frontend WebviewWindow API
- **Debugging**: `env_logger::init()` + `dbg!()` (Rust), DevTools + console.log (JS)

**Key Implementation Details**
- **Backend State**: `AppState` struct with `Arc<Mutex<T>>` for thread safety (root_shell, sensor_value_history, http_server_handle)
- **Sensor Integration**: Custom `sensor-core` library + Linux sensors (lm-sensors, dmidecode, systemstat, AMD GPU)
- **HTTP Server**: Warp-based REST API on port 25555 with client registration and sensor data endpoints
- **Async Runtime**: `#[tokio::main]` with `JoinHandle<()>` for background tasks and `oneshot::Sender<()>` for shutdown
- **Frontend State**: Simple object-based state in `app-state.js` with getter/setter functions
- **Error Handling**: `Result<T, String>` pattern throughout Rust code, try/catch in JS with user-friendly messages
- **Testing**: Uses `assertor` and `pretty_assertions` crates for BDD-style testing (see fonts_test.rs)
