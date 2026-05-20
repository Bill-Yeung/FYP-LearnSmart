//
// AssetAPIService.swift
// Testing Ground
//
// Created by copilot on 10/2/2026.
//

import Foundation
import zlib
#if canImport(Network)
import Network
#endif

// MARK: - USDZ Helpers

private extension UInt16 {
    var littleEndianBytes: [UInt8] {
        let le = self.littleEndian
        return [UInt8(le & 0xFF), UInt8(le >> 8)]
    }
}

private extension UInt32 {
    var littleEndianBytes: [UInt8] {
        let le = self.littleEndian
        return [UInt8(le & 0xFF), UInt8((le >> 8) & 0xFF), UInt8((le >> 16) & 0xFF), UInt8(le >> 24)]
    }
}

private extension Data {
    func crc32() -> UInt32 {
        return self.withUnsafeBytes { (ptr: UnsafeRawBufferPointer) -> UInt32 in
            let bound = ptr.bindMemory(to: UInt8.self)
            let result = zlib.crc32(0, bound.baseAddress, uInt(self.count))
            return UInt32(result)
        }
    }
}

// MARK: - API Response Models

struct DownloadOption: Codable, Identifiable {
    let id: String
    let componentType: String?
    let resolution: String?
    let fileFormat: String
    let url: String
    let fileSize: Int?
    let md5Hash: String?
    let includeMap: [String: [String: Any]]?
    
    enum CodingKeys: String, CodingKey {
        case id, url
        case componentType = "component_type"
        case resolution
        case fileFormat = "file_format"
        case fileSize = "file_size"
        case md5Hash = "md5_hash"
        case includeMap = "include_map"
    }
    
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        componentType = try container.decodeIfPresent(String.self, forKey: .componentType)
        resolution = try container.decodeIfPresent(String.self, forKey: .resolution)
        fileFormat = try container.decode(String.self, forKey: .fileFormat)
        url = try container.decode(String.self, forKey: .url)
        fileSize = try container.decodeIfPresent(Int.self, forKey: .fileSize)
        md5Hash = try container.decodeIfPresent(String.self, forKey: .md5Hash)
        
        // Decode include_map as [String: [String: AnyCodableValue]] then convert
        if let rawMap = try container.decodeIfPresent([String: [String: AnyCodableValue]].self, forKey: .includeMap) {
            var result: [String: [String: Any]] = [:]
            for (key, dict) in rawMap {
                result[key] = dict.mapValues { $0.value }
            }
            includeMap = result
        } else {
            includeMap = nil
        }
    }
    
    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encodeIfPresent(componentType, forKey: .componentType)
        try container.encodeIfPresent(resolution, forKey: .resolution)
        try container.encode(fileFormat, forKey: .fileFormat)
        try container.encode(url, forKey: .url)
        try container.encodeIfPresent(fileSize, forKey: .fileSize)
        try container.encodeIfPresent(md5Hash, forKey: .md5Hash)
        // Skip encoding includeMap for simplicity
    }
}

// MARK: - API Service

enum AssetAPIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case httpError(statusCode: Int)
    case networkError(Error)
    case decodingError(Error)
    case noDownloadsAvailable
    case serverNotReachable
    case timeout
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .httpError(let statusCode):
            if statusCode == 404 {
                return "API endpoint not found (404). Check server path."
            } else if statusCode == 401 || statusCode == 403 {
                return "Unauthorized (401/403). Please log in again."
            }
            return "Server returned HTTP error \(statusCode)"
        case .networkError(let error):
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain {
                switch nsError.code {
                case NSURLErrorTimedOut:
                    return "Request timed out. Check if backend server is running."
                case NSURLErrorCannotFindHost, NSURLErrorCannotConnectToHost:
                    return "Cannot connect to server. Is the backend running on localhost:8000?"
                case NSURLErrorNotConnectedToInternet:
                    return "No internet connection"
                default:
                    return "Network error: \(error.localizedDescription)"
                }
            }
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Failed to parse response: \(error.localizedDescription)"
        case .noDownloadsAvailable:
            return "No download options available for this asset"
        case .serverNotReachable:
            return "Backend server is not reachable. Please start the server."
        case .timeout:
            return "Request timed out. Server may be slow or not running."
        }
    }
    
    // For backward compatibility
    var localizedDescription: String {
        return errorDescription ?? "Unknown error"
    }
}

final class AssetAPIService {
    static let shared = AssetAPIService()
    
    // Cache for discovered backend URL
    private var discoveredURL: String?
    private var isDiscovering = false
    
    // MARK: - Dynamic Backend URL Detection
    
    /// Get the backend URL — always follows BackendConfig (Settings → Server mode)
    var baseURL: String {
        return "\(BackendConfig.baseURL)/api/models"
    }

    func cachedModelURL(assetId: String, resolution: String = "1k") -> URL? {
        if let cached = AssetCacheManager.shared.cachedURL(for: "usdz_\(assetId)_\(resolution).usdz") {
            return cached
        }
        if let cached = AssetCacheManager.shared.cachedURL(for: "usdz_\(assetId)_\(resolution).usdc") {
            return cached
        }

        guard let cachesDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            return nil
        }

        let modelDir = cachesDir
            .appendingPathComponent("AssetCache", isDirectory: true)
            .appendingPathComponent("\(assetId)_usd", isDirectory: true)

        guard let files = try? FileManager.default.contentsOfDirectory(
            at: modelDir,
            includingPropertiesForKeys: nil
        ) else {
            return nil
        }

        return files.first { file in
            let ext = file.pathExtension.lowercased()
            return ext == "usd" || ext == "usdc" || ext == "usdz"
        }
    }
    
    /// Manually set the backend URL (persists across app launches)
    func setBackendURL(_ url: String) {
        UserDefaults.standard.set(url, forKey: "BackendURL")
        print("Backend URL set to: \(url)")
    }
    
    /// Clear manual override and use auto-detection
    func clearBackendURL() {
        UserDefaults.standard.removeObject(forKey: "BackendURL")
        discoveredURL = nil
        print("Backend URL cleared, using auto-detection")
    }
    
    /// Generic retry wrapper with auto-discovery on iOS
    private func withAutoDiscovery<T>(_ operation: () async throws -> T) async throws -> T {
        do {
            return try await operation()
        } catch {
            #if targetEnvironment(simulator) || os(iOS) || os(visionOS)
            // If we haven't discovered yet and not already discovering, try auto-discovery
            if discoveredURL == nil && !isDiscovering && BackendConfig.serverMode == .localhost {
                print("Request failed, attempting auto-discovery...")
                isDiscovering = true
                
                if let discovered = await discoverBackend() {
                    discoveredURL = discovered
                    print("Auto-discovery successful, retrying request...")
                    isDiscovering = false
                    return try await operation()
                }
                isDiscovering = false
            }
            #endif
            
            // If discovery failed or we're on macOS, re-throw original error
            throw error
        }
    }
    
    /// Get the device's local IP address
    private func getLocalIPAddress() -> String? {
        var address: String?
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        
        if getifaddrs(&ifaddr) == 0 {
            var ptr = ifaddr
            while ptr != nil {
                defer { ptr = ptr?.pointee.ifa_next }
                
                guard let interface = ptr?.pointee else { continue }
                let addrFamily = interface.ifa_addr.pointee.sa_family
                
                // Check for IPv4
                if addrFamily == UInt8(AF_INET) {
                    let name = String(cString: interface.ifa_name)
                    
                    // Look for WiFi interface (en0) or cellular (pdp_ip0)
                    if name == "en0" || name == "pdp_ip0" {
                        var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                        getnameinfo(
                            interface.ifa_addr,
                            socklen_t(interface.ifa_addr.pointee.sa_len),
                            &hostname,
                            socklen_t(hostname.count),
                            nil,
                            socklen_t(0),
                            NI_NUMERICHOST
                        )
                        address = String(cString: hostname)
                    }
                }
            }
            freeifaddrs(ifaddr)
        }
        
        return address
    }
    
    // Custom URLSession with longer timeout
    private let urlSession: URLSession
    
    private init() {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 120 // 2 minutes
        configuration.timeoutIntervalForResource = 600 // 10 minutes for large model downloads
        configuration.waitsForConnectivity = true
        configuration.allowsExpensiveNetworkAccess = true
        configuration.allowsConstrainedNetworkAccess = true
        self.urlSession = URLSession(configuration: configuration)
    }
    
    // MARK: - Connection Testing
    
    /// Test if the backend server is reachable
    func testConnection() async -> Bool {
        guard let url = URL(string: baseURL.replacingOccurrences(of: "/api/models", with: "/health")) else {
            return false
        }
        
        do {
            let (_, response) = try await urlSession.data(from: url)
            if let httpResponse = response as? HTTPURLResponse {
                return httpResponse.statusCode == 200
            }
            return false
        } catch {
            print("Connection test failed: \(error.localizedDescription)")
            return false
        }
    }
    
    /// Auto-discover backend server on local network
    /// Tries common IP addresses on the same subnet
    func discoverBackend() async -> String? {
        guard let localIP = getLocalIPAddress() else {
            print("Could not get local IP address")
            return nil
        }
        
        let components = localIP.split(separator: ".")
        guard components.count == 4 else { return nil }
        
        let subnet = "\(components[0]).\(components[1]).\(components[2])"
        
        // Common IPs to try: gateway (.1), common static IPs (.10, .100, .2-5)
        let candidateIPs = [1, 10, 100, 2, 3, 4, 5, 20, 50]
        
        print("Searching for backend on subnet \(subnet).x...")
        
        for lastOctet in candidateIPs {
            let candidateIP = "\(subnet).\(lastOctet)"
            let testURL = "http://\(candidateIP):8000"
            
            if await testBackendURL(testURL) {
                print("Found backend at \(candidateIP)")
                return testURL + "/api/models"
            }
        }
        
        print("Could not find backend on network")
        return nil
    }
    
    /// Test if a specific backend URL is reachable
    private func testBackendURL(_ baseURL: String) async -> Bool {
        guard let url = URL(string: baseURL + "/health") else { return false }
        
        do {
            let configuration = URLSessionConfiguration.default
            configuration.timeoutIntervalForRequest = 2 // Quick timeout for discovery
            let session = URLSession(configuration: configuration)
            
            let (_, response) = try await session.data(from: url)
            if let httpResponse = response as? HTTPURLResponse {
                return httpResponse.statusCode == 200
            }
        } catch {
            // Silently fail for discovery
        }
        return false
    }
    
    // MARK: - List Assets
    
    func listAssets(
        assetType: String? = "model",
        search: String? = nil,
        page: Int = 1,
        pageSize: Int = 50
    ) async throws -> AssetListResponse {
        return try await withAutoDiscovery {
            try await self.performListAssets(assetType: assetType, search: search, page: page, pageSize: pageSize)
        }
    }
    
    private func performListAssets(
        assetType: String? = "model",
        search: String? = nil,
        page: Int = 1,
        pageSize: Int = 50
    ) async throws -> AssetListResponse {
        guard var components = URLComponents(string: baseURL) else {
            throw AssetAPIError.invalidURL
        }
        
        var queryItems: [URLQueryItem] = [
            URLQueryItem(name: "page", value: "\(page)"),
            URLQueryItem(name: "page_size", value: "\(pageSize)")
        ]
        
        if let assetType = assetType {
            queryItems.append(URLQueryItem(name: "asset_type", value: assetType))
        }
        
        if let search = search, !search.isEmpty {
            queryItems.append(URLQueryItem(name: "search", value: search))
        }
        
        components.queryItems = queryItems
        
        guard let url = components.url else {
            throw AssetAPIError.invalidURL
        }
        
        print("API Request: \(url.absoluteString)")
        
        do {
            let (data, response) = try await urlSession.data(from: url)
            
            // Detailed logging
            print("Response received:")
            print("   - Data size: \(data.count) bytes")
            if let httpResponse = response as? HTTPURLResponse {
                print("   - HTTP Status: \(httpResponse.statusCode)")
                print("   - Headers: \(httpResponse.allHeaderFields)")
            }
            if data.count > 0 && data.count < 1000 {
                print("   - Body: \(String(data: data, encoding: .utf8) ?? "<non-utf8>")")
            }
            
            // Check HTTP status code
            if let httpResponse = response as? HTTPURLResponse {
                if httpResponse.statusCode != 200 {
                    let errorMsg = String(data: data, encoding: .utf8) ?? "HTTP \(httpResponse.statusCode)"
                    print("HTTP Error \(httpResponse.statusCode): \(errorMsg)")
                    throw AssetAPIError.httpError(statusCode: httpResponse.statusCode)
                }
            }
            
            // Check for empty response
            if data.isEmpty {
                print("API returned empty response (0 bytes), returning empty asset list")
                return AssetListResponse(assets: [], total: 0, page: page, pageSize: pageSize)
            }
            
            do {
                let decoder = JSONDecoder()
                let response = try decoder.decode(AssetListResponse.self, from: data)
                return response
            } catch let decodingError as DecodingError {
                print("Decoding failed! Detailed Error: \(decodingError)")
                
                switch decodingError {
                case .keyNotFound(let key, let context):
                    print("   - Key '\(key.stringValue)' not found. Path: \(context.codingPath.map { $0.stringValue }.joined(separator: "."))")
                case .typeMismatch(let type, let context):
                    print("   - Type mismatch for '\(type)'. Path: \(context.codingPath.map { $0.stringValue }.joined(separator: "."))")
                case .valueNotFound(let type, let context):
                    print("   - Value of type '\(type)' not found. Path: \(context.codingPath.map { $0.stringValue }.joined(separator: "."))")
                case .dataCorrupted(let context):
                    print("   - Data corrupted. Path: \(context.codingPath.map { $0.stringValue }.joined(separator: "."))")
                @unknown default:
                    print("   - Unknown decoding error.")
                }

                // Fallback: some backends return a top-level array of assets
                if let items = try? JSONDecoder().decode([AssetItem].self, from: data) {
                    print("   - Fallback successful: decoded as [AssetItem] array")
                    return AssetListResponse(assets: items, total: items.count, page: page, pageSize: pageSize)
                }

                // Include response body in the thrown error to aid debugging
                let responseString = String(data: data, encoding: .utf8) ?? "<non-utf8 response>"
                let ns = NSError(domain: "AssetAPIService.Decoding", code: 0, userInfo: [NSLocalizedDescriptionKey: "Decoding failed: \(decodingError.localizedDescription). Response: \(responseString)"])
                throw AssetAPIError.decodingError(ns)
            }
        } catch let error as DecodingError {
            // Defensive: should be handled above, but preserve behaviour
            throw AssetAPIError.decodingError(error)
        } catch {
            throw AssetAPIError.networkError(error)
        }
    }
    
    // MARK: - Get Asset Details
    
    func getAsset(id: String) async throws -> AssetItem {
        return try await withAutoDiscovery {
            try await self.performGetAsset(id: id)
        }
    }
    
    private func performGetAsset(id: String) async throws -> AssetItem {
        guard let url = URL(string: "\(baseURL)/\(id)") else {
            throw AssetAPIError.invalidURL
        }
        
        do {
            let (data, response) = try await urlSession.data(from: url)
            
            // Check HTTP status code
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode != 200 {
                let errorMsg = String(data: data, encoding: .utf8) ?? "HTTP \(httpResponse.statusCode)"
                print("HTTP Error \(httpResponse.statusCode): \(errorMsg)")
                throw AssetAPIError.httpError(statusCode: httpResponse.statusCode)
            }
            
            // Check for empty response
            if data.isEmpty {
                throw AssetAPIError.decodingError(NSError(domain: "AssetAPIService", code: 0, userInfo: [NSLocalizedDescriptionKey: "Server returned empty response for asset \(id)"]))
            }
            
            do {
                let asset = try JSONDecoder().decode(AssetItem.self, from: data)
                return asset
            } catch let decodingError as DecodingError {
                let responseString = String(data: data, encoding: .utf8) ?? "<non-utf8 response>"
                let ns = NSError(domain: "AssetAPIService.Decoding", code: 0, userInfo: [NSLocalizedDescriptionKey: "Decoding failed: \(decodingError.localizedDescription). Response: \(responseString)"])
                throw AssetAPIError.decodingError(ns)
            }
        } catch let error as DecodingError {
            throw AssetAPIError.decodingError(error)
        } catch {
            throw AssetAPIError.networkError(error)
        }
    }

    /// Fetch a single asset by id, or if `assetId` is nil return a list of assets from the database.
    /// This implements the "default to all content" behaviour when callers don't supply an asset id.
    func fetchAssets(assetId: String? = nil, page: Int = 1, pageSize: Int = 100) async throws -> AssetListResponse {
        if let id = assetId, !id.isEmpty {
            // Return single asset wrapped in AssetListResponse for compatibility
            let asset = try await getAsset(id: id)
            return AssetListResponse(assets: [asset], total: 1, page: page, pageSize: pageSize)
        }

        // No id provided — fetch all (paged) assets from the backend
        return try await listAssets(assetType: nil, search: nil, page: page, pageSize: pageSize)
    }
    
    // MARK: - Get Downloads
    
    func getDownloads(assetId: String) async throws -> [DownloadOption] {
        return try await withAutoDiscovery {
            try await self.performGetDownloads(assetId: assetId)
        }
    }
    
    private func performGetDownloads(assetId: String) async throws -> [DownloadOption] {
        guard let url = URL(string: "\(baseURL)/\(assetId)/downloads") else {
            throw AssetAPIError.invalidURL
        }
        
        do {
            let (data, response) = try await urlSession.data(from: url)
            
            // Check HTTP status code
            if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode != 200 {
                let errorMsg = String(data: data, encoding: .utf8) ?? "HTTP \(httpResponse.statusCode)"
                print("HTTP Error \(httpResponse.statusCode): \(errorMsg)")
                throw AssetAPIError.httpError(statusCode: httpResponse.statusCode)
            }
            
            // Check for empty response - return empty array for downloads
            if data.isEmpty {
                print("API returned empty response for downloads, returning empty array")
                return []
            }
            
            do {
                let downloads = try JSONDecoder().decode([DownloadOption].self, from: data)
                return downloads
            } catch let decodingError as DecodingError {
                let responseString = String(data: data, encoding: .utf8) ?? "<non-utf8 response>"
                let ns = NSError(domain: "AssetAPIService.Decoding", code: 0, userInfo: [NSLocalizedDescriptionKey: "Decoding failed: \(decodingError.localizedDescription). Response: \(responseString)"])
                throw AssetAPIError.decodingError(ns)
            }
        } catch let error as DecodingError {
            throw AssetAPIError.decodingError(error)
        } catch {
            throw AssetAPIError.networkError(error)
        }
    }
    
    // MARK: - Download Model File
    
    func downloadModelFile(from downloadOption: DownloadOption) async throws -> URL {
        guard let remoteURL = URL(string: downloadOption.url) else {
            throw AssetAPIError.invalidURL
        }

        let res = downloadOption.resolution ?? "default"
        let cacheKey = "asset_\(downloadOption.id)_\(res).\(downloadOption.fileFormat)"

        print("Downloading from: \(remoteURL.absoluteString)")
        print("   Format: \(downloadOption.fileFormat.uppercased())  Resolution: \(res)")

        do {
            return try await AssetCacheManager.shared.localURL(for: cacheKey, remoteURL: remoteURL)
        } catch {
            throw AssetAPIError.networkError(error)
        }
    }
    
    // MARK: - Convenience: Download Best Available Format
    
    func downloadAsset(assetId: String, preferredFormats: [String] = ["usdz", "usd", "glb", "gltf", "obj"]) async throws -> URL {
        print("Getting download options for asset: \(assetId)")
        
        // Try USDZ conversion endpoint first (best for visionOS)
        if preferredFormats.contains("usdz") || preferredFormats.isEmpty {
            do {
                print("Trying USDZ conversion endpoint...")
                return try await downloadAssetAsUSDZ(assetId: assetId, resolution: "1k")
            } catch {
                print("USDZ endpoint failed: \(error.localizedDescription)")
                print("Falling back to standard download...")
            }
        }
        
        // Fallback to original method if USDZ conversion fails
        // Get all download options
        let downloads = try await getDownloads(assetId: assetId)
        
        guard !downloads.isEmpty else {
            print("No downloads available")
            throw AssetAPIError.noDownloadsAvailable
        }
        
        print("Available formats: \(downloads.map { $0.fileFormat }.joined(separator: ", "))")
        print("Preferred formats: \(preferredFormats.joined(separator: ", "))")
        
        // Find best match based on preferred formats
        var selectedDownload: DownloadOption?
        
        for format in preferredFormats {
            if let match = downloads.first(where: { $0.fileFormat.lowercased() == format.lowercased() }) {
                selectedDownload = match
                print("Selected format: \(format.uppercased())")
                break
            }
        }
        
        // If no preferred format found, use first available
        guard let download = selectedDownload ?? downloads.first else {
            throw AssetAPIError.noDownloadsAvailable
        }
        
        if selectedDownload == nil {
            print("No preferred format found, using: \(download.fileFormat.uppercased())")
        }
        
        // Download the file
        return try await downloadModelFile(from: download)
    }
    
    /// Download asset directly as USD using the server conversion endpoint
    /// This is the preferred method for visionOS/RealityKit compatibility
    func downloadAssetAsUSDZ(assetId: String, resolution: String = "1k") async throws -> URL {
        // Return cached USDZ if it already exists
        let usdzCacheKey = "usdz_\(assetId)_\(resolution).usdz"
        if let cached = AssetCacheManager.shared.cachedURL(for: usdzCacheKey) {
            print("[Cache] HIT usdz \(assetId) @ \(resolution)")
            return cached
        }
        // Also check for cached USDC (before conversion)
        let usdcCacheKey = "usdz_\(assetId)_\(resolution).usdc"
        if let cached = AssetCacheManager.shared.cachedURL(for: usdcCacheKey) {
            print("[Cache] HIT usdc \(assetId) @ \(resolution)")
            return cached
        }

        let endpoint = "\(baseURL)/\(assetId)/download/usdz?resolution=\(resolution)"

        guard let url = URL(string: endpoint) else {
            throw AssetAPIError.invalidURL
        }

        print("Downloading USD from: \(endpoint)")

        // Create URLRequest
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.timeoutInterval = 120 // Longer timeout for slow networks + conversion

        // Cloudflare Access (reads from .env or environment variables)
        APIService.shared.applyCloudflareAccessHeaders(to: &request)

        // Attach auth token
        if let token = KeychainService.get(forKey: "access_token") {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        } else {
            print("[USDZ] Warning: no auth token, request may fail with 401")
        }

        // Download the file
        let (localURL, response) = try await urlSession.download(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AssetAPIError.invalidResponse
        }
        
        guard httpResponse.statusCode == 200 else {
            print("USD download failed with status: \(httpResponse.statusCode)")
            throw AssetAPIError.httpError(statusCode: httpResponse.statusCode)
        }
        
        // Detect actual file extension from the final redirect URL or response
        var fileExtension = "usdc"  // Default — Polyhaven serves .usdc files
        if let finalURL = httpResponse.url {
            let ext = finalURL.pathExtension.lowercased()
            if !ext.isEmpty {
                fileExtension = ext
                print("Detected file extension from URL: .\(ext)")
            }
        }
        
        // Stage into a temp dir, convert if needed, then register with AssetCacheManager
        let fm = FileManager.default
        let tempDir = fm.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try fm.createDirectory(at: tempDir, withIntermediateDirectories: true)
        defer { try? fm.removeItem(at: tempDir) }

        let stagedURL = tempDir.appendingPathComponent("model.\(fileExtension)")
        try fm.moveItem(at: localURL, to: stagedURL)

        if fileExtension == "usdc" {
            // Wrap into uncompressed USDZ zip so RealityKit can load it
            let usdcData = try Data(contentsOf: stagedURL)
            let usdzData = try createUSDZFromUSDC(usdcData: usdcData, filename: "model.usdc")
            let usdzStaged = tempDir.appendingPathComponent("model.usdz")
            try usdzData.write(to: usdzStaged)

            // Register the final USDZ with AssetCacheManager
            let cacheKey = "usdz_\(assetId)_\(resolution).usdz"
            let finalURL = try await AssetCacheManager.shared.localURL(for: cacheKey, remoteURL: usdzStaged)
            print("Converted .usdc → .usdz and cached: \(finalURL.lastPathComponent)")
            return finalURL
        }

        let cacheKey = "usdz_\(assetId)_\(resolution).\(fileExtension)"
        let finalURL = try await AssetCacheManager.shared.localURL(for: cacheKey, remoteURL: stagedURL)
        print("USD cached: \(finalURL.lastPathComponent)")
        return finalURL

    }
    
    /// Create a USDZ file (uncompressed ZIP) from raw USDC data.
    /// USDZ spec: ZIP archive with no compression, 64-byte aligned entries.
    private func createUSDZFromUSDC(usdcData: Data, filename: String) throws -> Data {
        var result = Data()
        
        // Local file header
        let localHeader: [UInt8] = [0x50, 0x4B, 0x03, 0x04] // PK\x03\x04
        result.append(contentsOf: localHeader)
        result.append(contentsOf: UInt16(20).littleEndianBytes)  // version needed
        result.append(contentsOf: UInt16(0).littleEndianBytes)   // flags
        result.append(contentsOf: UInt16(0).littleEndianBytes)   // compression (0 = stored)
        result.append(contentsOf: UInt16(0).littleEndianBytes)   // mod time
        result.append(contentsOf: UInt16(0).littleEndianBytes)   // mod date
        
        // CRC32
        let crc = usdcData.crc32()
        result.append(contentsOf: crc.littleEndianBytes)
        
        // Compressed size = uncompressed size (no compression)
        let size = UInt32(usdcData.count)
        result.append(contentsOf: size.littleEndianBytes)  // compressed
        result.append(contentsOf: size.littleEndianBytes)  // uncompressed
        
        guard let filenameData = filename.data(using: .utf8) else {
            throw AssetAPIError.invalidURL
        }
        result.append(contentsOf: UInt16(filenameData.count).littleEndianBytes) // filename length
        
        // Calculate padding needed for 64-byte alignment of data
        let headerSize = 30 + filenameData.count
        let padding = (64 - (headerSize % 64)) % 64
        result.append(contentsOf: UInt16(padding).littleEndianBytes) // extra field length
        
        result.append(filenameData)
        result.append(contentsOf: [UInt8](repeating: 0, count: padding))
        
        result.append(usdcData)
        
        // Central directory entry
        let centralDirOffset = UInt32(result.count)
        let centralHeader: [UInt8] = [0x50, 0x4B, 0x01, 0x02] // PK\x01\x02
        result.append(contentsOf: centralHeader)
        result.append(contentsOf: UInt16(20).littleEndianBytes)  // version made by
        result.append(contentsOf: UInt16(20).littleEndianBytes)  // version needed
        result.append(contentsOf: UInt16(0).littleEndianBytes)   // flags
        result.append(contentsOf: UInt16(0).littleEndianBytes)   // compression
        result.append(contentsOf: UInt16(0).littleEndianBytes)   // mod time
        result.append(contentsOf: UInt16(0).littleEndianBytes)   // mod date
        result.append(contentsOf: crc.littleEndianBytes)
        result.append(contentsOf: size.littleEndianBytes)        // compressed
        result.append(contentsOf: size.littleEndianBytes)        // uncompressed
        result.append(contentsOf: UInt16(filenameData.count).littleEndianBytes)
        result.append(contentsOf: UInt16(0).littleEndianBytes)   // extra field length
        result.append(contentsOf: UInt16(0).littleEndianBytes)   // comment length
        result.append(contentsOf: UInt16(0).littleEndianBytes)   // disk number
        result.append(contentsOf: UInt16(0).littleEndianBytes)   // internal attrs
        result.append(contentsOf: UInt32(0).littleEndianBytes)   // external attrs
        result.append(contentsOf: UInt32(0).littleEndianBytes)   // local header offset
        result.append(filenameData)
        
        // End of central directory
        let centralDirSize = UInt32(result.count) - centralDirOffset
        let endRecord: [UInt8] = [0x50, 0x4B, 0x05, 0x06] // PK\x05\x06
        result.append(contentsOf: endRecord)
        result.append(contentsOf: UInt16(0).littleEndianBytes)   // disk number
        result.append(contentsOf: UInt16(0).littleEndianBytes)   // central dir disk
        result.append(contentsOf: UInt16(1).littleEndianBytes)   // entries on disk
        result.append(contentsOf: UInt16(1).littleEndianBytes)   // total entries
        result.append(contentsOf: centralDirSize.littleEndianBytes)
        result.append(contentsOf: centralDirOffset.littleEndianBytes)
        result.append(contentsOf: UInt16(0).littleEndianBytes)   // comment length
        
        return result
    }

    // MARK: - Download USD with Textures

    /// Download USD model with all companion texture files.
    /// The USDC references textures at relative paths like `./textures/model_diff_1k.jpg`.
    /// We download the .usdc + all textures from include_map into the same directory,
    /// then RealityKit can load the .usdc with full PBR materials.
    func downloadAssetWithTextures(assetId: String, resolution: String = "1k") async throws -> URL {
        if let cached = cachedModelURL(assetId: assetId, resolution: resolution) {
            print("[Cache] HIT model \(assetId) @ \(resolution)")
            return cached
        }

        print("Fetching download options for USD with textures...")
        let downloads = try await getDownloads(assetId: assetId)

        // Find the USD entry matching the requested resolution
        // Backend sets component_type="model", file_format="usdz"
        let usdEntry: DownloadOption? =
            downloads.first(where: { $0.fileFormat == "usdz" && $0.resolution == resolution })
            ?? downloads.first(where: { $0.fileFormat == "usdz" })
            ?? downloads.first(where: { ($0.fileFormat == "usd" || $0.fileFormat == "usdc") && $0.resolution == resolution })
            ?? downloads.first(where: { $0.fileFormat == "usd" || $0.fileFormat == "usdc" })
        guard let usdEntry else {
            print("No USD download with textures available")
            throw AssetAPIError.noDownloadsAvailable
        }

        let textureCount = usdEntry.includeMap?.count ?? 0
        print("Found USD entry: res=\(usdEntry.resolution ?? "?"), textures: \(textureCount)")

        // Prepare cache directory: AssetCache/<assetId>_usd/
        guard let cachesDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            throw URLError(.fileDoesNotExist)
        }
        let cacheBase = cachesDir.appendingPathComponent("AssetCache", isDirectory: true)
        let modelDir = cacheBase.appendingPathComponent("\(assetId)_usd", isDirectory: true)
        try? FileManager.default.createDirectory(at: cacheBase, withIntermediateDirectories: true)

        // Clean and recreate model sub-directory
        try? FileManager.default.removeItem(at: modelDir)
        try FileManager.default.createDirectory(at: modelDir, withIntermediateDirectories: true)

        // 1) Download the .usdc file
        guard let usdcRemoteURL = URL(string: usdEntry.url) else {
            throw AssetAPIError.invalidURL
        }
        let usdcFilename = usdcRemoteURL.lastPathComponent  // e.g. BarberShopChair_01_1k.usdc
        let localUSDC = modelDir.appendingPathComponent(usdcFilename)
        print("Downloading USDC: \(usdcFilename)")
        let (usdcTmp, _) = try await URLSession.shared.download(from: usdcRemoteURL)
        try FileManager.default.moveItem(at: usdcTmp, to: localUSDC)

        // 2) Download all companion textures from include_map
        if let includeMap = usdEntry.includeMap {
            for (relativePath, info) in includeMap {
                guard let fileURLStr = info["url"] as? String,
                      let fileURL = URL(string: fileURLStr) else { continue }

                // Create subdirectory if needed (e.g. "textures/")
                let localPath = modelDir.appendingPathComponent(relativePath)
                let localParent = localPath.deletingLastPathComponent()
                try? FileManager.default.createDirectory(at: localParent, withIntermediateDirectories: true)

                print("  Downloading texture: \(relativePath)")
                let (tmpFile, _) = try await URLSession.shared.download(from: fileURL)
                try? FileManager.default.removeItem(at: localPath)
                try FileManager.default.moveItem(at: tmpFile, to: localPath)
            }
        }

        // List what we downloaded
        let fm = FileManager.default
        func listDir(_ dir: URL, prefix: String = "") {
            if let items = try? fm.contentsOfDirectory(atPath: dir.path) {
                for item in items {
                    let full = dir.appendingPathComponent(item)
                    var isDir: ObjCBool = false
                    fm.fileExists(atPath: full.path, isDirectory: &isDir)
                    if isDir.boolValue {
                        print("\(prefix)\(item)/")
                        listDir(full, prefix: prefix + "  ")
                    } else {
                        let size = (try? fm.attributesOfItem(atPath: full.path)[.size] as? Int64) ?? 0
                        print("\(prefix)\(item) (\(ByteCountFormatter.string(fromByteCount: size, countStyle: .file)))")
                    }
                }
            }
        }
        print("Downloaded model directory:")
        listDir(modelDir)

        print("USD + textures download complete: \(localUSDC.path)")
        return localUSDC
    }

    // MARK: - Download Thumbnail Image

    /// Downloads the model's thumbnail via the server proxy (`/api/models/{id}/thumbnail`)
    /// and caches it in the app caches directory. Returns the local file URL.
    func downloadThumbnail(assetId: String) async throws -> URL {
        let cacheKey = "thumb_\(assetId).jpg"
        if let cached = AssetCacheManager.shared.cachedURL(for: cacheKey) {
            return cached
        }

        let endpoint = "\(baseURL)/\(assetId)/thumbnail"
        guard let url = URL(string: endpoint) else {
            throw AssetAPIError.invalidURL
        }

        do {
            return try await AssetCacheManager.shared.localURL(for: cacheKey, remoteURL: url)
        } catch {
            throw AssetAPIError.networkError(error)
        }
    }

}
