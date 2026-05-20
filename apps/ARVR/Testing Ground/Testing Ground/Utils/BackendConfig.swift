//
//  BackendConfig.swift
//  Testing Ground
//
//  Single source of truth for backend URL.
//

import Foundation

enum ServerMode: String, CaseIterable {
    case production = "production"
    case localhost  = "localhost"
    case custom     = "custom"

    var displayName: String {
        switch self {
        case .production: return "Production (app.youstube.xyz)"
        case .localhost:  return "Localhost"
        case .custom:     return "Custom IP"
        }
    }
}

enum BackendConfig {
    static let productionURL = "https://app.youstube.xyz"

    static var serverMode: ServerMode {
        get {
            let raw = UserDefaults.standard.string(forKey: "ServerMode") ?? ServerMode.production.rawValue
            return ServerMode(rawValue: raw) ?? .production
        }
        set { UserDefaults.standard.set(newValue.rawValue, forKey: "ServerMode") }
    }

    // Custom mode settings
    static var customScheme: String {
        get { UserDefaults.standard.string(forKey: "CustomScheme") ?? "http" }
        set { UserDefaults.standard.set(newValue, forKey: "CustomScheme") }
    }

    static var customAddress: String {
        get { UserDefaults.standard.string(forKey: "CustomAddress") ?? "" }
        set { UserDefaults.standard.set(newValue, forKey: "CustomAddress") }
    }

    static var customPort: String {
        get { UserDefaults.standard.string(forKey: "CustomPort") ?? "8000" }
        set { UserDefaults.standard.set(newValue, forKey: "CustomPort") }
    }

    /// Base URL without trailing slash, e.g. "http://192.168.0.4:8000"
    static var baseURL: String {
        switch serverMode {
        case .production:
            return productionURL
        case .localhost:
            return "http://localhost:8000"
        case .custom:
            let address = customAddress.isEmpty ? "localhost" : customAddress
            let port = customPort.isEmpty ? "8000" : customPort
            return "\(customScheme)://\(address):\(port)"
        }
    }

    /// Convenience: baseURL + "/api"
    static var apiURL: String { "\(baseURL)/api" }
}
