import Foundation
import zlib

/// Holds paths to a downloaded model and its texture maps.
struct ModelAsset {
    let modelURL: URL
    let diffuseURL: URL?
    let roughnessURL: URL?
}

actor ModelDownloader {

    static let shared = ModelDownloader()

    private let fileManager = FileManager.default

    private var activeDownloads: [String: Task<ModelAsset, Error>] = [:]

    /// Downloads USDC model + diffuse/roughness textures, returns local paths.
    func download(assetId: String) async throws -> ModelAsset {
        let modelDest = cacheDirectory().appendingPathComponent("\(assetId).usdz")
        let diffuseDest = cacheDirectory().appendingPathComponent("\(assetId)_diff.jpg")
        let roughnessDest = cacheDirectory().appendingPathComponent("\(assetId)_rough.jpg")

        // Return cached if model already exists
        if fileManager.fileExists(atPath: modelDest.path) {
            return ModelAsset(
                modelURL: modelDest,
                diffuseURL: fileManager.fileExists(atPath: diffuseDest.path) ? diffuseDest : nil,
                roughnessURL: fileManager.fileExists(atPath: roughnessDest.path) ? roughnessDest : nil
            )
        }

        // Coalesce concurrent requests for the same asset
        if let existing = activeDownloads[assetId] {
            return try await existing.value
        }

        let task = Task<ModelAsset, Error> {
            defer { activeDownloads.removeValue(forKey: assetId) }

            // 1. Download the model USDC via redirect endpoint
            guard let remoteURL = URL(string: "\(BackendConfig.apiURL)/models/\(assetId)/download/usdz") else {
                throw DownloadError.invalidURL
            }
            let (tempURL, response) = try await URLSession.shared.download(from: remoteURL)
            guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                throw DownloadError.serverError
            }

            // Detect file extension from redirect URL
            var fileExtension = "usdc"
            if let finalURL = http.url {
                let ext = finalURL.pathExtension.lowercased()
                if !ext.isEmpty { fileExtension = ext }
            }

            // Convert USDC → USDZ if needed
            if fileExtension == "usdc" {
                let usdcData = try Data(contentsOf: tempURL)
                let usdzData = try Self.createUSDZFromUSDC(usdcData: usdcData, filename: "model.usdc")
                try? fileManager.removeItem(at: modelDest)
                try usdzData.write(to: modelDest)
                try? fileManager.removeItem(at: tempURL)
            } else {
                try? fileManager.removeItem(at: modelDest)
                try fileManager.moveItem(at: tempURL, to: modelDest)
            }

            // 2. Fetch texture URLs from /downloads endpoint (include_map)
            var diffuseLocal: URL? = nil
            var roughnessLocal: URL? = nil

            if let downloadsURL = URL(string: "\(BackendConfig.apiURL)/models/\(assetId)/downloads") {
                do {
                    let (data, _) = try await URLSession.shared.data(from: downloadsURL)
                    let entries = try JSONDecoder().decode([DownloadEntry].self, from: data)

                    // Find a USD entry with include_map (prefer 1k resolution)
                    let entry = entries.first(where: { $0.includeMap != nil && $0.resolution == "1k" })
                                ?? entries.first(where: { $0.includeMap != nil })

                    if let includeMap = entry?.includeMap {
                        // Download diffuse texture (JPG only — skip EXR, RealityKit can't load it)
                        for (path, info) in includeMap {
                            let lowPath = path.lowercased()
                            guard let urlStr = info.url, let textureURL = URL(string: urlStr) else { continue }

                            if lowPath.contains("_diff_") && (lowPath.hasSuffix(".jpg") || lowPath.hasSuffix(".png")) {
                                diffuseLocal = try? await downloadTexture(from: textureURL, to: diffuseDest)
                            } else if lowPath.contains("_rough") && (lowPath.hasSuffix(".jpg") || lowPath.hasSuffix(".png")) {
                                roughnessLocal = try? await downloadTexture(from: textureURL, to: roughnessDest)
                            }
                        }
                    }
                } catch {
                    // Texture download is best-effort — model still loads without textures
                    print("Failed to fetch texture info for \(assetId): \(error)")
                }
            }

            return ModelAsset(modelURL: modelDest, diffuseURL: diffuseLocal, roughnessURL: roughnessLocal)
        }
        activeDownloads[assetId] = task
        return try await task.value
    }

    /// Legacy convenience — returns just the model URL.
    func localURL(for assetId: String) async throws -> URL {
        let asset = try await download(assetId: assetId)
        return asset.modelURL
    }

    // MARK: - Texture Download

    private func downloadTexture(from url: URL, to dest: URL) async throws -> URL {
        let (tempURL, response) = try await URLSession.shared.download(from: url)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw DownloadError.serverError
        }
        try? fileManager.removeItem(at: dest)
        try fileManager.moveItem(at: tempURL, to: dest)
        return dest
    }

    /// Remove a cached model and its textures.
    func evict(assetId: String) {
        let dir = cacheDirectory()
        for suffix in [".usdz", "_diff.jpg", "_rough.jpg"] {
            try? fileManager.removeItem(at: dir.appendingPathComponent("\(assetId)\(suffix)"))
        }
    }

    /// Returns the set of asset IDs that have a cached .usdz file.
    func cachedAssetIds() -> Set<String> {
        let dir = cacheDirectory()
        guard let files = try? fileManager.contentsOfDirectory(atPath: dir.path) else { return [] }
        return Set(files.compactMap { name -> String? in
            guard name.hasSuffix(".usdz") else { return nil }
            return String(name.dropLast(5))
        })
    }

    /// Total size of cached models in bytes.
    func cacheSize() -> Int64 {
        let dir = cacheDirectory()
        guard let files = try? fileManager.contentsOfDirectory(atPath: dir.path) else { return 0 }
        return files.reduce(into: Int64(0)) { total, name in
            let path = dir.appendingPathComponent(name).path
            let attrs = try? fileManager.attributesOfItem(atPath: path)
            total += (attrs?[.size] as? Int64) ?? 0
        }
    }

    private func cacheDirectory() -> URL {
        let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first!
        let dir = caches.appendingPathComponent("Models", isDirectory: true)
        if !fileManager.fileExists(atPath: dir.path) {
            try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }

    // MARK: - USDC → USDZ Conversion

    /// Create a USDZ file (uncompressed ZIP) from raw USDC data.
    /// USDZ spec: ZIP archive with no compression, 64-byte aligned entries.
    private static func createUSDZFromUSDC(usdcData: Data, filename: String) throws -> Data {
        var result = Data()

        // Local file header
        result.append(contentsOf: [0x50, 0x4B, 0x03, 0x04] as [UInt8]) // PK signature
        result.append(littleEndian: UInt16(20))  // version needed
        result.append(littleEndian: UInt16(0))   // flags
        result.append(littleEndian: UInt16(0))   // compression (0 = stored)
        result.append(littleEndian: UInt16(0))   // mod time
        result.append(littleEndian: UInt16(0))   // mod date

        let crc = usdcData.crc32Value()
        result.append(littleEndian: crc)

        let size = UInt32(usdcData.count)
        result.append(littleEndian: size)  // compressed size
        result.append(littleEndian: size)  // uncompressed size

        let filenameData = filename.data(using: .utf8)!
        result.append(littleEndian: UInt16(filenameData.count))

        // 64-byte alignment padding for data
        let headerSize = 30 + filenameData.count
        let padding = (64 - (headerSize % 64)) % 64
        result.append(littleEndian: UInt16(padding))

        result.append(filenameData)
        result.append(contentsOf: [UInt8](repeating: 0, count: padding))

        // File data
        result.append(usdcData)

        // Central directory entry
        let centralDirOffset = UInt32(result.count)
        result.append(contentsOf: [0x50, 0x4B, 0x01, 0x02] as [UInt8])
        result.append(littleEndian: UInt16(20))  // version made by
        result.append(littleEndian: UInt16(20))  // version needed
        result.append(littleEndian: UInt16(0))   // flags
        result.append(littleEndian: UInt16(0))   // compression
        result.append(littleEndian: UInt16(0))   // mod time
        result.append(littleEndian: UInt16(0))   // mod date
        result.append(littleEndian: crc)
        result.append(littleEndian: size)        // compressed
        result.append(littleEndian: size)        // uncompressed
        result.append(littleEndian: UInt16(filenameData.count))
        result.append(littleEndian: UInt16(0))   // extra field length
        result.append(littleEndian: UInt16(0))   // comment length
        result.append(littleEndian: UInt16(0))   // disk number
        result.append(littleEndian: UInt16(0))   // internal attrs
        result.append(littleEndian: UInt32(0))   // external attrs
        result.append(littleEndian: UInt32(0))   // local header offset
        result.append(filenameData)

        // End of central directory
        let centralDirSize = UInt32(result.count) - centralDirOffset
        result.append(contentsOf: [0x50, 0x4B, 0x05, 0x06] as [UInt8])
        result.append(littleEndian: UInt16(0))   // disk number
        result.append(littleEndian: UInt16(0))   // central dir disk
        result.append(littleEndian: UInt16(1))   // entries on disk
        result.append(littleEndian: UInt16(1))   // total entries
        result.append(littleEndian: centralDirSize)
        result.append(littleEndian: centralDirOffset)
        result.append(littleEndian: UInt16(0))   // comment length

        return result
    }

    // MARK: - JSON Models for /downloads endpoint

    private struct DownloadEntry: Codable {
        let resolution: String?
        let fileFormat: String?
        let url: String?
        let includeMap: [String: TextureInfo]?

        enum CodingKeys: String, CodingKey {
            case resolution, url
            case fileFormat = "file_format"
            case includeMap = "include_map"
        }
    }

    struct TextureInfo: Codable {
        let url: String?
        let size: Int?
        let md5: String?
    }

    enum DownloadError: LocalizedError {
        case invalidURL
        case serverError

        var errorDescription: String? {
            switch self {
            case .invalidURL: return "Invalid model download URL."
            case .serverError: return "Failed to download model from server."
            }
        }
    }
}

// MARK: - Binary Helpers

private extension Data {
    mutating func append(littleEndian value: UInt16) {
        let le = value.littleEndian
        Swift.withUnsafeBytes(of: le) { append(contentsOf: $0) }
    }

    mutating func append(littleEndian value: UInt32) {
        let le = value.littleEndian
        Swift.withUnsafeBytes(of: le) { append(contentsOf: $0) }
    }

    func crc32Value() -> UInt32 {
        self.withUnsafeBytes { (ptr: UnsafeRawBufferPointer) -> UInt32 in
            let bound = ptr.bindMemory(to: UInt8.self)
            return UInt32(zlib.crc32(0, bound.baseAddress, uInt(self.count)))
        }
    }
}
