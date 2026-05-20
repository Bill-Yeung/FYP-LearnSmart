// ResponseCache.swift
// Testing Ground
//
// Lightweight disk cache for Codable API responses.
// Strategy: stale-while-revalidate — returns cached data immediately,
// then the caller can refresh in the background.
//
// Usage:
//   // Save
//   ResponseCache.shared.store(scenes, forKey: "scenes-\(scriptId)")
//
//   // Load (returns nil if missing or expired)
//   let cached: [SceneRecord]? = ResponseCache.shared.load(forKey: "scenes-\(scriptId)")

import Foundation

final class ResponseCache {
    static let shared = ResponseCache()

    /// How long a cached entry is considered fresh. After this it is still
    /// served (stale-while-revalidate) but the caller should refresh.
    var ttl: TimeInterval = 5 * 60   // 5 minutes

    private let cacheDir: URL = {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let dir = caches.appendingPathComponent("ResponseCache", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }()

    private init() {}

    // MARK: - Public API

    /// Encode and write `value` to disk under `key`.
    func store<T: Encodable>(_ value: T, forKey key: String) {
        let envelope = CacheEnvelopeWrite(storedAt: Date(), payload: value)
        guard let data = try? JSONEncoder().encode(envelope) else { return }
        let url = fileURL(for: key)
        try? data.write(to: url, options: [.atomic])
        print("[ResponseCache] STORED \(key)")
    }

    /// Decode a value from disk.
    /// - Returns the value (possibly stale) or `nil` if nothing is cached.
    /// - Use `isFresh(forKey:)` to decide whether to background-refresh.
    func load<T: Decodable>(forKey key: String) -> T? {
        let url = fileURL(for: key)
        guard let data = try? Data(contentsOf: url),
              let envelope = try? JSONDecoder().decode(CacheEnvelopeRead<T>.self, from: data)
        else { return nil }
        print("[ResponseCache] \(isFresh(forKey: key) ? "HIT (fresh)" : "HIT (stale)") \(key)")
        return envelope.payload
    }

    /// `true` if the cached entry exists and is younger than `ttl`.
    func isFresh(forKey key: String) -> Bool {
        let url = fileURL(for: key)
        guard let data = try? Data(contentsOf: url),
              let envelope = try? JSONDecoder().decode(CacheEnvelopeTimestamp.self, from: data)
        else { return false }
        return Date().timeIntervalSince(envelope.storedAt) < ttl
    }

    /// Remove a single entry.
    func invalidate(forKey key: String) {
        try? FileManager.default.removeItem(at: fileURL(for: key))
    }

    /// Remove all cached responses.
    func clearAll() {
        let fm = FileManager.default
        guard let files = try? fm.contentsOfDirectory(at: cacheDir, includingPropertiesForKeys: nil) else { return }
        files.forEach { try? fm.removeItem(at: $0) }
        print("[ResponseCache] Cleared all \(files.count) entries")
    }

    // MARK: - Helpers

    private func fileURL(for key: String) -> URL {
        let safe = key
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: ":", with: "_")
            .replacingOccurrences(of: "?", with: "_")
            .replacingOccurrences(of: "&", with: "_")
            .replacingOccurrences(of: "=", with: "_")
        return cacheDir.appendingPathComponent("\(safe).json")
    }
}

// MARK: - Private envelope types

private struct CacheEnvelopeWrite<T: Encodable>: Encodable {
    let storedAt: Date
    let payload: T
}

private struct CacheEnvelopeRead<T: Decodable>: Decodable {
    let storedAt: Date
    let payload: T
}

/// Lightweight struct just for reading the timestamp without decoding the full payload.
private struct CacheEnvelopeTimestamp: Decodable {
    let storedAt: Date
}
