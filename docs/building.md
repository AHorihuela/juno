# Building and Packaging Juno

This document provides instructions on how to build and package the Juno application for different platforms.

## Prerequisites

- Node.js (v16 or later)
- npm (v7 or later)

## Building for Development

To build the application for development:

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

## Building for Production

### macOS

To build the application for macOS:

```bash
# Build the application
npm run build:mac
```

This will:
1. Build the application with webpack
2. Package the application with electron-builder
3. Generate the following files:
   - DMG installer: `dist/Juno-[version]-arm64.dmg`
   - ZIP archive: `dist/Juno-[version]-arm64-mac.zip`
   - Application bundle: `dist/mac-arm64/Juno.app`

#### Known Issues

- The application is not code-signed, so you may need to bypass macOS security restrictions when opening it for the first time.
- The `robotjs` native dependency is temporarily removed during the build process due to compatibility issues with Electron.

### Windows

To build the application for Windows:

```bash
# Build the application
npm run build

# Package the application
npm run dist
```

### Linux

To build the application for Linux:

```bash
# Build the application
npm run build

# Package the application
npm run dist
```

## Manual Packaging

If you need more control over the packaging process, you can use the following commands:

```bash
# Build the application
npm run build

# Create an unpacked directory (for testing)
npm run pack

# Create distributable packages
npm run dist
```

## Customizing the Build

The build configuration is defined in the `build` field of `package.json`. You can customize the build by modifying this configuration.

For more information, see the [electron-builder documentation](https://www.electron.build/). 