// Sensor Bridge - Main Application Entry Point

import { initializeApplication } from './js/main.js';

// Wait for both DOM and Tauri to be ready
async function waitForTauriReady() {
    // Wait for DOM to be loaded first
    if (document.readyState !== 'loading') {
        return Promise.resolve();
    }

    return new Promise(resolve => {
        window.addEventListener('DOMContentLoaded', resolve);
    });
}

// Wait for Tauri API to be available
async function waitForTauriAPI() {
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max wait

    while (attempts < maxAttempts) {
        if (window.__TAURI__ && window.__TAURI__.core && window.__TAURI__.dialog) {
            console.log('Tauri API ready after', attempts * 100, 'ms');
            return;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    throw new Error('Tauri API not available after 5 seconds');
}

// Initialize the application when both DOM and Tauri are ready
async function initialize() {
    try {
        console.log('Waiting for DOM and Tauri to be ready...');
        await waitForTauriReady();
        await waitForTauriAPI();
        console.log('DOM and Tauri ready, initializing application...');
        await initializeApplication();
    } catch (error) {
        console.error('Failed to initialize application:', error);
        alert('Failed to initialize application: ' + error.message);
    }
}

initialize();
