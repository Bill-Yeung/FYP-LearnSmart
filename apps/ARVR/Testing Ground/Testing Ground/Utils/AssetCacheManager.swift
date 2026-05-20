// AssetCacheManager.swift
// Testing Ground
//
// Central cache for all downloaded assets (models, textures, HDRI scenes).
// - Returns a cached file immediately if it already exists.
// - Downloads and caches the file if it does not exist.
// - Evicts least-recently-used files when total cache size exceeds the limit (default 10 GB).

import Foundation

final class AssetCacheManager {
    static let shared = AssetCacheManager()

    // MARK: - Configuration

    /// Maximum allowed cache size in bytes. Default 10 GB.
    var maxCacheBytes: Int = 10 * 1_024 * 1_024 * 1_024

    // MARK: - Cache Directory

    private let cacheDir: URL = {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let dir = caches.appendingPathComponent("AssetCache", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    private init() {}

    // MARK: - Public API

    /// Returns the cached local URL for `cacheKey` if it exists, otherwise downloads
    /// from `remoteURL`, stores it, enforces the size limit, and returns the local URL.
    func localURL(for cacheKey: String, remoteURL: URL) async throws -> URL {
        let destination = cacheDir.appendingPathComponent(sanitize(cacheKey))

        if FileManager.default.fileExists(atPath: destination.path) {
            print("[Cache] HIT  \(cacheKey)")
            touch(destination)          // update access time for LRU eviction
            return destination
        }

        print("[Cache] MISS \(cacheKey) — downloading \(remoteURL.absoluteString)")
        let (tempLocation, response) = try await URLSession.shared.download(from: remoteURL)

        if let http = response as? HTTPURLResponse, !(200...299).contains(http.statusCode) {
            throw URLError(.badServerResponse)
        }

        // Remove stale file if present (shouldn't happen, but be safe)
        try? FileManager.default.removeItem(at: destination)
        try FileManager.default.moveItem(at: tempLocation, to: destination)

        print("[Cache] STORED \(cacheKey) (\(formattedSize(destination)))")
        evictIfNeeded()
        return destination
    }

    /// Returns the cached local URL only if it already exists — no network call.
    func cachedURL(for cacheKey: String) -> URL? {
        let destination = cacheDir.appendingPathComponent(sanitize(cacheKey))
        guard FileManager.default.fileExists(atPath: destination.path) else { return nil }
        touch(destination)
        return destination
    }

    // MARK: - Cache Info

    /// Total bytes currently stored in the cache directory.
    var currentCacheBytes: Int {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(
            at: cacheDir,
            includingPropertiesForKeys: [.fileSizeKey]
        ) else { return 0 }
        return files.reduce(0) { sum, url in
            let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            return sum + size
        }
    }

    var currentCacheBytesFormatted: String { formattedSize(bytes: currentCacheBytes) }

    /// Remove all cached files.
    func clearAll() {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(at: cacheDir, includingPropertiesForKeys: nil) else { return }
        for file in files { try? fm.removeItem(at: file) }
        print("[Cache] Cleared all \(files.count) cached files")
    }

    // MARK: - LRU Eviction

    private func evictIfNeeded() {
        guard currentCacheBytes > maxCacheBytes else { return }

        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(
            at: cacheDir,
            includingPropertiesForKeys: [.fileSizeKey, .contentAccessDateKey]
        ) else { return }

        // Sort by last-access date, oldest first
        let sorted = files.sorted {
            let a = (try? $0.resourceValues(forKeys: [.contentAccessDateKey]).contentAccessDate) ?? .distantPast
            let b = (try? $1.resourceValues(forKeys: [.contentAccessDateKey]).contentAccessDate) ?? .distantPast
            return a < b
        }

        var totalBytes = currentCacheBytes
        for file in sorted {
            guard totalBytes > maxCacheBytes else { break }
            let size = (try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
            try? fm.removeItem(at: file)
            totalBytes -= size
            print("[Cache] EVICTED \(file.lastPathComponent) (\(formattedSize(bytes: size)))")
        }
    }

    // MARK: - Helpers

    /// Update the access date so LRU eviction stays accurate.
    private func touch(_ url: URL) {
        try? (url as NSURL).setResourceValue(Date(), forKey: .contentAccessDateKey)
    }

    /// Replace characters that are invalid or dangerous in file names.
    private func sanitize(_ key: String) -> String {
        let safe = key.unicodeScalars.map { scalar -> Character in
            let c = Character(scalar)
            let allowed = c.isLetter || c.isNumber || c == "." || c == "-"
            return allowed ? c : "_"
        }
        let result = String(safe).trimmingCharacters(in: CharacterSet(charactersIn: "._"))
        return result.isEmpty ? "_" : result
    }

    private func formattedSize(_ url: URL) -> String {
        let bytes = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        return formattedSize(bytes: bytes)
    }

    private func formattedSize(bytes: Int) -> String {
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB, .useGB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(bytes))
    }
}
