import Foundation

enum HDRISceneCache {
    private static let directoryName = "HDRISceneCache"

    static func cachedURL(for remoteURLString: String) -> URL? {
        guard let fileURL = cacheFileURL(for: remoteURLString),
              FileManager.default.fileExists(atPath: fileURL.path) else {
            return nil
        }
        return fileURL
    }

    static func downloadIfNeeded(remoteURLString: String) async throws -> URL {
        if let cachedURL = cachedURL(for: remoteURLString) {
            return cachedURL
        }

        guard let remoteURL = URL(string: remoteURLString),
              let destinationURL = cacheFileURL(for: remoteURLString) else {
            throw URLError(.badURL)
        }

        let (tempURL, _) = try await URLSession.shared.download(from: remoteURL)
        try? FileManager.default.removeItem(at: destinationURL)
        try FileManager.default.moveItem(at: tempURL, to: destinationURL)
        return destinationURL
    }

    private static func cacheFileURL(for remoteURLString: String) -> URL? {
        guard let remoteURL = URL(string: remoteURLString),
              let directory = cacheDirectory() else {
            return nil
        }

        let fileExtension = remoteURL.pathExtension.isEmpty ? "hdr" : remoteURL.pathExtension
        let fileName = safeCacheName(remoteURLString)
        return directory.appendingPathComponent(fileName).appendingPathExtension(fileExtension)
    }

    private static func cacheDirectory() -> URL? {
        guard let cachesBase = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else {
            return nil
        }
        let directory = cachesBase.appendingPathComponent(directoryName, isDirectory: true)
        try? FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    private static func safeCacheName(_ value: String) -> String {
        let scalars = value.unicodeScalars.map { scalar -> String in
            if CharacterSet.alphanumerics.contains(scalar) || scalar.value == 45 || scalar.value == 95 {
                return String(scalar)
            }
            return "_"
        }
        return scalars.joined()
    }
}
