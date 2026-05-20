import Foundation
import CryptoKit
import UIKit

actor ImageCache {

    static let shared = ImageCache()

    private let fileManager = FileManager.default
    private var memoryCache: [String: UIImage] = [:]

    /// Load an image from cache or download it.
    func image(for url: URL) async throws -> UIImage {
        let key = cacheKey(for: url)

        // 1. Memory cache
        if let cached = memoryCache[key] {
            return cached
        }

        // 2. Disk cache
        let filePath = cacheDirectory().appendingPathComponent(key)
        if let data = try? Data(contentsOf: filePath), let img = UIImage(data: data) {
            memoryCache[key] = img
            return img
        }

        // 3. Download
        var request = URLRequest(url: url)
        if let token = await KeychainService.get(forKey: "access_token") {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
            throw CacheError.downloadFailed
        }
        guard let img = UIImage(data: data) else {
            throw CacheError.invalidImageData
        }

        // Store to disk and memory
        try? data.write(to: filePath, options: .atomic)
        memoryCache[key] = img
        return img
    }

    /// Clear memory cache (disk remains).
    func clearMemory() {
        memoryCache.removeAll()
    }

    /// Clear both memory and disk caches.
    func clearAll() {
        memoryCache.removeAll()
        let dir = cacheDirectory()
        try? fileManager.removeItem(at: dir)
        try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
    }

    // MARK: - Private

    private func cacheKey(for url: URL) -> String {
        let digest = SHA256.hash(data: Data(url.absoluteString.utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    private func cacheDirectory() -> URL {
        let caches = fileManager.urls(for: .cachesDirectory, in: .userDomainMask).first!
        let dir = caches.appendingPathComponent("ImageCache", isDirectory: true)
        if !fileManager.fileExists(atPath: dir.path) {
            try? fileManager.createDirectory(at: dir, withIntermediateDirectories: true)
        }
        return dir
    }

    enum CacheError: LocalizedError {
        case downloadFailed
        case invalidImageData

        var errorDescription: String? {
            switch self {
            case .downloadFailed: return "Failed to download image."
            case .invalidImageData: return "Invalid image data."
            }
        }
    }
}
