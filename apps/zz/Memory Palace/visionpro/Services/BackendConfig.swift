import Foundation

enum BackendConfig {

    static var baseURL: String {
        // 1. Manual override from Settings screen
        if let override = UserDefaults.standard.string(forKey: "BackendURL"),
           !override.isEmpty {
            return override
        }

        // 2. From build configuration (xcconfig)
        if let configured = Bundle.main.infoDictionary?["BACKEND_URL"] as? String,
           !configured.isEmpty {
            return configured
        }

        // 3. Default fallback
        return "http://localhost:8000"
    }

    static var apiURL: String { "\(baseURL)/api" }

    static var mediaURL: String { "\(baseURL)/media" }
}
