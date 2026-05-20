//
// ModelDownloader.swift
// Testing Ground
//
// Created by copilot on 10/2/2026.
//

import Foundation
import RealityKit

enum ModelDownloadError: Error {
    case downloadFailed
}

struct ModelItem: Identifiable, Hashable {
    let id: String
    let name: String
    let thumbnailURL: URL?
    let modelURL: URL
}

final class ModelDownloader {
    static let shared = ModelDownloader()

    private init() {}

    func downloadModel(_ item: ModelItem) async throws -> URL {
        let cacheKey = "model_\(item.id)_\(item.modelURL.lastPathComponent)"
        return try await AssetCacheManager.shared.localURL(for: cacheKey, remoteURL: item.modelURL)
    }

    func downloadFromURL(_ remote: URL) async throws -> URL {
        let cacheKey = "url_\(remote.lastPathComponent)"
        return try await AssetCacheManager.shared.localURL(for: cacheKey, remoteURL: remote)
    }
}
