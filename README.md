# sensor bridge

## 

## Build instructions

### Prerequisites

* [Rust](https://www.rust-lang.org/tools/install)
* [Tauri prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites)
* clang
    * On
      Windows: [Enable the "C++ Clang tools for Windows" component in the Visual Studio Installer](https://www.wikihow.com/Install-Clang-on-Windows)
    * On Linux: `sudo apt install clang` or `sudo pacman -S clang` or `sudo dnf install clang`

### Build

For building the project, run the following command in the root directory of the project:

```bash
cargo tauri build
```

### Run

For running the project, run the following command in the root directory of the project:

```bash
cargo tauri dev
```

### Build for production

For building the project for production, run the following command in the root directory of the project:

```bash
cargo tauri build --release
```

