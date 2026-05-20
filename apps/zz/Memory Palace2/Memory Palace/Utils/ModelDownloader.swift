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
        // Download to a temp location and return local file URL
        let remote = item.modelURL
        let (location, _) = try await URLSession.shared.download(from: remote)

        // Move to caches directory with stable name
        let fm = FileManager.default
        let caches = fm.urls(for: .cachesDirectory, in: .userDomainMask).first!
        let dest = caches.appendingPathComponent(remote.lastPathComponent)

        // Remove existing
        if fm.fileExists(atPath: dest.path) {
            try? fm.removeItem(at: dest)
        }

        try fm.moveItem(at: location, to: dest)
        return dest
    }

    func downloadFromURL(_ remote: URL) async throws -> URL {
        let (location, _) = try await URLSession.shared.download(from: remote)
        let fm = FileManager.default
        let caches = fm.urls(for: .cachesDirectory, in: .userDomainMask).first!
        let dest = caches.appendingPathComponent(remote.lastPathComponent)

        if fm.fileExists(atPath: dest.path) {
            try? fm.removeItem(at: dest)
        }

        try fm.moveItem(at: location, to: dest)
        return dest
    }
}
