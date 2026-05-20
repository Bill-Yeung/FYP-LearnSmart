//
// ImageConverter.swift
// Testing Ground
//
// Created by copilot on 10/2/2026.
//

import SwiftUI
import ImageIO
import UniformTypeIdentifiers
import CryptoKit

enum ImageConversionError: Error {
    case unsupportedFormat
    case conversionFailed
    case downloadFailed
    
    var localizedDescription: String {
        switch self {
        case .unsupportedFormat:
            return "Image format not supported"
        case .conversionFailed:
            return "Failed to convert image format"
        case .downloadFailed:
            return "Failed to download image"
        }
    }
}

final class ImageConverter {
    static let shared = ImageConverter()
    
    private init() {}
    
    // MARK: - Cache Key Generation
    
    /// Generate unique cache filename from URL using hash to avoid collisions
    private func cacheFilename(for url: URL, extension ext: String) -> String {
        let urlString = url.absoluteString
        let hash = SHA256.hash(data: Data(urlString.utf8))
        let hashString = hash.compactMap { String(format: "%02x", $0) }.joined().prefix(16)
        return "\(hashString).\(ext)"
    }
    
    // MARK: - Supported Formats
    
    private let supportedFormats: Set<String> = [
        "png", "jpg", "jpeg", "heic", "heif", "gif", "bmp", "tiff", "webp"
    ]
    
    // MARK: - Download and Convert Image
    
    /// Downloads image from URL and converts to PNG if needed
    func downloadAndConvertImage(from url: URL) async throws -> URL {
        do {
            // Download to temporary location
            let (tempLocation, _) = try await URLSession.shared.download(from: url)
            
            // Get file extension
            let fileExtension = url.pathExtension.lowercased()
            
            // Check if format is supported
            if supportedFormats.contains(fileExtension) {
                // Move to cache without conversion
                return try moveToCache(from: tempLocation, originalURL: url)
            } else {
                // Convert to PNG
                return try convertToPNG(from: tempLocation, originalURL: url)
            }
        } catch {
            throw ImageConversionError.downloadFailed
        }
    }
    
    // MARK: - Convert to PNG
    
    private func convertToPNG(from sourceURL: URL, originalURL: URL) throws -> URL {
        // Load source image
        guard let imageSource = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
              let cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else {
            throw ImageConversionError.conversionFailed
        }
        
        // Create destination in cache
        let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let filename = cacheFilename(for: originalURL, extension: "png")
        let destinationURL = cacheDir.appendingPathComponent(filename)
        
        // Remove existing file
        try? FileManager.default.removeItem(at: destinationURL)
        
        // Create PNG destination
        guard let destination = CGImageDestinationCreateWithURL(
            destinationURL as CFURL,
            UTType.png.identifier as CFString,
            1,
            nil
        ) else {
            throw ImageConversionError.conversionFailed
        }
        
        // Add image to destination and write
        CGImageDestinationAddImage(destination, cgImage, nil)
        
        guard CGImageDestinationFinalize(destination) else {
            throw ImageConversionError.conversionFailed
        }
        
        return destinationURL
    }
    
    // MARK: - Move to Cache
    
    private func moveToCache(from tempURL: URL, originalURL: URL) throws -> URL {
        let fileManager = FileManager.default
        let cacheDir = fileManager.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let fileExtension = originalURL.pathExtension.isEmpty ? "jpg" : originalURL.pathExtension
        let filename = cacheFilename(for: originalURL, extension: fileExtension)
        let destinationURL = cacheDir.appendingPathComponent(filename)
        
        // Remove existing file
        if fileManager.fileExists(atPath: destinationURL.path) {
            try? fileManager.removeItem(at: destinationURL)
        }
        
        // Move to cache
        try fileManager.moveItem(at: tempURL, to: destinationURL)
        
        return destinationURL
    }
    
    // MARK: - Get Cached Image
    
    func getCachedImage(for url: URL) -> URL? {
        let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        
        // Check for original format
        let fileExtension = url.pathExtension.isEmpty ? "jpg" : url.pathExtension
        let originalFilename = cacheFilename(for: url, extension: fileExtension)
        let originalPath = cacheDir.appendingPathComponent(originalFilename)
        if FileManager.default.fileExists(atPath: originalPath.path) {
            return originalPath
        }
        
        // Check for PNG conversion
        let pngFilename = cacheFilename(for: url, extension: "png")
        let pngPath = cacheDir.appendingPathComponent(pngFilename)
        if FileManager.default.fileExists(atPath: pngPath.path) {
            return pngPath
        }
        
        return nil
    }
    
    // MARK: - Clear Cache
    
    func clearImageCache() throws {
        let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        let contents = try FileManager.default.contentsOfDirectory(at: cacheDir, includingPropertiesForKeys: nil)
        
        let imageExtensions = ["png", "jpg", "jpeg", "heic", "heif", "gif", "bmp", "tiff", "webp"]
        
        for fileURL in contents {
            let ext = fileURL.pathExtension.lowercased()
            if imageExtensions.contains(ext) {
                try? FileManager.default.removeItem(at: fileURL)
            }
        }
    }
}
