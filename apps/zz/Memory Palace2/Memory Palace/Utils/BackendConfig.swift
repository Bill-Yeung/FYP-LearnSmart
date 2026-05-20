//
//  BackendConfig.swift
//  Testing Ground
//
//  Single source of truth for backend URL.
//  On the visionOS / iOS simulator, localhost does NOT reach the host Mac,
//  so we fall back to the Mac's LAN IP.
//

import Foundation

enum BackendConfig {
    /// Base URL without trailing slash, e.g. "http://192.168.0.4:8000"
    static var baseURL: String {
        // Allow manual override via UserDefaults (Settings screen can set this)
        if let override = UserDefaults.standard.string(forKey: "BackendURL"),
           !override.isEmpty {
            return override
        }

        // During local development, the API is running on localhost.
        // For the simulator, this maps directly to your Mac.
        return "http://localhost:8000"
    }

    /// Convenience: baseURL + "/api"
    static var apiURL: String { "\(baseURL)/api" }
}
