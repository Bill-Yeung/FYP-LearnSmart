//
// RemoteImageView.swift
// Testing Ground
//
// Created by copilot on 10/2/2026.
//

import SwiftUI

/// AsyncImage wrapper with automatic format conversion and caching
struct RemoteImageView: View {
    let url: URL?
    let width: CGFloat?
    let height: CGFloat?
    let cornerRadius: CGFloat
    
    @State private var phase: AsyncImagePhase = .empty
    @State private var convertedURL: URL?
    
    init(
        url: URL?,
        width: CGFloat? = nil,
        height: CGFloat? = nil,
        cornerRadius: CGFloat = 8
    ) {
        self.url = url
        self.width = width
        self.height = height
        self.cornerRadius = cornerRadius
    }
    
    var body: some View {
        Group {
            if let convertedURL = convertedURL {
                AsyncImage(url: convertedURL) { phase in
                    switch phase {
                    case .empty:
                        ZStack {
                            Color.gray.opacity(0.2)
                            ProgressView()
                        }
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure:
                        ZStack {
                            Color.gray.opacity(0.2)
                            Image(systemName: "photo.fill")
                                .foregroundStyle(.secondary)
                                .font(.system(size: (width ?? 64) * 0.3))
                        }
                    @unknown default:
                        EmptyView()
                    }
                }
                .frame(width: width, height: height)
                .clipped()
                .cornerRadius(cornerRadius)
            } else {
                ZStack {
                    Color.gray.opacity(0.2)
                    if url != nil {
                        ProgressView()
                    } else {
                        Image(systemName: "photo")
                            .foregroundStyle(.secondary)
                            .font(.system(size: (width ?? 64) * 0.3))
                    }
                }
                .frame(width: width, height: height)
                .cornerRadius(cornerRadius)
            }
        }
        .task {
            await prepareImage()
        }
    }
    
    @MainActor
    private func prepareImage() async {
        guard let url = url else { return }
        
        print("Loading image from: \(url.absoluteString)")
        
        // Check if already cached
        if let cachedURL = ImageConverter.shared.getCachedImage(for: url) {
            print("Found cached image: \(cachedURL.lastPathComponent)")
            convertedURL = cachedURL
            return
        }
        
        // Download and convert if needed
        do {
            print("Downloading image...")
            let localURL = try await ImageConverter.shared.downloadAndConvertImage(from: url)
            print("Image downloaded and saved: \(localURL.lastPathComponent)")
            convertedURL = localURL
        } catch {
            print("Failed to load image from \(url): \(error)")
            // On error, try to load original URL directly
            convertedURL = url
        }
    }
}
