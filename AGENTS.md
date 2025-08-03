# Agent Coding Guide for Sensor Bridge

**Build, Lint, and Test Commands**
- Backend (Rust/Tauri):
  - `cd src-tauri && cargo tauri dev` — Run in development mode
  - `cd src-tauri && cargo tauri build` — Production build
  - `cd src-tauri && cargo test` — Run all tests
  - `cd src-tauri && cargo test fonts_test` — Run a single test
  - `cd src-tauri && cargo fmt --all -- --check` — Format check
  - `cd src-tauri && cargo clippy` — Linting

**Code Style Guidelines**
- **Imports**: Group by standard, external, then local. Use explicit imports.
- **Formatting**: Use `cargo fmt` for Rust, Prettier for JS. Indent with 4 spaces (Rust) or 2 spaces (JS).
- **Types**: Prefer explicit types in Rust (`Result<T, String>` for errors). Use ES6 modules and JSDoc for JS.
- **Naming**: Use snake_case for Rust, camelCase for JS. Match frontend/backend param names (camelCase ↔ snake_case).
- **Error Handling**: Use descriptive error messages. Rust: `Result<T, String>`. JS: try/catch with user-friendly errors.
- **Comments**: Document logic, especially when using project memory or external sources.
- **State**: Centralize state in `app-state.js` (frontend) and `AppState` (backend).
- **Testing**: Write unit and integration tests. Use mock dependencies for system calls.
- **Sequential Thinking**: Plan before coding. Break tasks into clear steps.
- **Online Search**: Always verify library usage and patterns with up-to-date docs.
- **Memory Bank**: Read and use project memory files for context.
- **Mode Triggers**: Switch between architect, code, debug, test, and ask modes as needed.
- **Documentation**: Update architecture, decision log, and progress in memory-bank/*.md.

For more details, see CLAUDE.md and .github/copilot-instructions.md.
