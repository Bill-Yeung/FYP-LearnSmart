//
// ObjectLibraryView.swift
// Testing Ground
//
// Created by copilot on 10/2/2026.
//

import SwiftUI
import RealityKit

// MARK: - URL Extension for File Size

extension URL {
    var fileSize: Int? {
        do {
            let resourceValues = try resourceValues(forKeys: [.fileSizeKey])
            return resourceValues.fileSize
        } catch {
            return nil
        }
    }
}

struct ObjectLibraryView: View {
    #if os(visionOS)
    @Environment(\.openImmersiveSpace) private var openImmersiveSpace
    #endif
    @Environment(AuthViewModel.self) private var authVM
    @Environment(AppModel.self) private var appModel
    @Environment(\.dismiss) private var dismiss
    
    // Parameters
    var accessToken: String? = nil
    
    // Models
    @State private var library: [AssetItem] = []
    @State private var selected: AssetItem? = nil
    @State private var isLoading: Bool = false
    @State private var showAlert: Bool = false
    @State private var alertMessage: String = ""
    @State private var searchText: String = ""
    @State private var totalAssets: Int = 0
    @State private var searchTask: Task<Void, Never>?
    @State private var lastError: String?
    @State private var downloadProgress: Double = 0.0
    @State private var isDownloading: Bool = false
    @State private var showSuccessToast: Bool = false
    @State private var successMessage: String = ""
    
    // Flashcards
    @State private var flashcards: [ReviewCard] = []
    @State private var selectedFlashcard: ReviewCard? = nil
    @State private var isLoadingFlashcards: Bool = false
    @State private var flashcardError: String?
    @State private var viewMode: ViewMode = .models
    @State private var showFlashcardPreview: Bool = false
    @State private var isImportingFlashcard: Bool = false
    @State private var showCreateFlashcard: Bool = false
    @State private var newCardFront: String = ""
    @State private var newCardBack: String = ""
    @State private var newCardTopic: String = ""
    @State private var newCardTips: String = ""
    @State private var isSavingFlashcard: Bool = false
    
    enum ViewMode {
        case models
        case flashcards
    }

    @Environment(\.isPresented) private var isPresented

    var body: some View {
        Group {
            if isPresented {
                NavigationStack {
                    mainContent
                        .toolbar {
                            ToolbarItem(placement: .cancellationAction) {
                                Button("Close") {
                                    dismiss()
                                }
                            }
                        }
                }
            } else {
                mainContent
            }
        }
        .onAppear {
            Task {
                if library.isEmpty {
                    // Test connection first
                    print("Testing backend connection...")
                    let isConnected = await AssetAPIService.shared.testConnection()
                    if !isConnected {
                        print("Backend not reachable. Attempting to load anyway...")
                    } else {
                        print("Backend connection OK")
                    }
                    await loadFromAPI()
                }
                if flashcards.isEmpty {
                    await loadFlashcards()
                }
            }
        }
    }
    
    private var mainContent: some View {
        VStack(spacing: 0) {
            // View Mode Picker
            Picker("Content", selection: $viewMode) {
                Text("3D Models").tag(ViewMode.models)
                Text("Flashcards").tag(ViewMode.flashcards)
            }
            .pickerStyle(.segmented)
            .padding()
            
            if viewMode == .models {
                modelsView
            } else {
                flashcardsView
            }
        }
        .navigationTitle("Library")
    }
    
    var modelsView: some View {
        VStack(spacing: 0) {
            // Search bar
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                TextField("Search models...", text: $searchText)
                    .textFieldStyle(.plain)
                    .submitLabel(.search)
                    .autocorrectionDisabled()
                if !searchText.isEmpty {
                    Button(action: {
                        searchText = ""
                    }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(Color(white: 0.95))
            .onChange(of: searchText) { oldValue, newValue in
                // Debounce search - wait 0.5 seconds after user stops typing
                searchTask?.cancel()
                searchTask = Task {
                    try? await Task.sleep(nanoseconds: 500_000_000) // 0.5 seconds
                    if !Task.isCancelled {
                        await loadFromAPI()
                    }
                }
            }
            
            // Results header
            if !library.isEmpty {
                HStack {
                    if !searchText.isEmpty {
                        Text("Results for '\(searchText)'")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text("•")
                            .foregroundStyle(.tertiary)
                    }
                    Text("\(totalAssets) model\(totalAssets == 1 ? "" : "s")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    if isLoading {
                        ProgressView()
                            .scaleEffect(0.8)
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 6)
            }
            
            if library.isEmpty && !isLoading {
                VStack(spacing: 16) {
                    Image(systemName: lastError != nil ? "exclamationmark.triangle" : (searchText.isEmpty ? "cube.transparent" : "magnifyingglass"))
                        .font(.system(size: 48))
                        .foregroundStyle(lastError != nil ? .orange : .secondary)
                    
                    Text(searchText.isEmpty ? "No models available" : "No models found")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                    
                    if let error = lastError {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.orange)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    } else if !searchText.isEmpty {
                        Text("No results for '\(searchText)'")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                    }
                    
                    if lastError != nil || library.isEmpty {
                        Button(action: {
                            Task { await loadFromAPI() }
                        }) {
                            Label("Retry", systemImage: "arrow.clockwise")
                        }
                        .buttonStyle(.borderedProminent)
                        .padding(.top, 8)
                        
                        VStack(spacing: 4) {
                            Text("Troubleshooting:")
                                .font(.caption2)
                                .fontWeight(.semibold)
                                .foregroundStyle(.secondary)
                            Text("• Make sure backend server is running")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                            Text("• Check if it's on http://localhost:8000")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                        }
                        .padding(.top, 8)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if isLoading && library.isEmpty {
                VStack(spacing: 12) {
                    ProgressView()
                    Text("Loading models...")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(library) { item in
                    HStack(spacing: 12) {
                        // Thumbnail image - use server proxy to avoid selecting normal maps
                        if let proxyThumb = URL(string: "\(AssetAPIService.shared.baseURL)/\(item.id)/thumbnail") {
                            RemoteImageView(
                                url: proxyThumb,
                                width: 64,
                                height: 64,
                                cornerRadius: 8
                            )
                        } else {
                            // Fallback icon
                            ZStack {
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(Color.blue.opacity(0.1))
                                    .frame(width: 64, height: 64)
                                Image(systemName: "cube.fill")
                                    .font(.system(size: 24))
                                    .foregroundStyle(.blue)
                            }
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            let itemName = item.name ?? "Unknown"
                            Text(itemName)
                                .fontWeight(.semibold)
                            if let source = item.source {
                                Text("Source: \(source)")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            if let externalId = item.externalId {
                                Text("ID: \(externalId)")
                                    .font(.caption2)
                                    .foregroundStyle(.tertiary)
                            }
                        }

                        Spacer()

                        Button("Download") {
                            selected = item
                        }
                        .buttonStyle(.bordered)
                    }
                    .padding(.vertical, 6)
                }
            }
        }
        .sheet(item: $selected) { item in
            VStack(spacing: 16) {
                // Model thumbnail preview
                if let thumbURL = URL(string: "\(AssetAPIService.shared.baseURL)/\(item.id)/thumbnail") {
                    RemoteImageView(
                        url: thumbURL,
                        width: 240,
                        height: 240,
                        cornerRadius: 16
                    )
                    .shadow(color: .black.opacity(0.12), radius: 8, y: 4)
                } else {
                    ZStack {
                        RoundedRectangle(cornerRadius: 16)
                            .fill(Color.blue.opacity(0.08))
                            .frame(width: 240, height: 240)
                        Image(systemName: "cube.fill")
                            .font(.system(size: 64))
                            .foregroundStyle(.blue.opacity(0.5))
                    }
                }

                // Model info
                VStack(spacing: 4) {
                    let itemName = item.name ?? "Unknown"
                    Text(itemName)
                        .font(.title3)
                        .fontWeight(.semibold)
                        .foregroundColor(.black)
                        .multilineTextAlignment(.center)
                    if let source = item.source {
                        Text("Source: \(source)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    if let externalId = item.externalId {
                        Text(externalId)
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }

                // Download progress
                if isDownloading {
                    VStack(spacing: 8) {
                        ProgressView(value: downloadProgress)
                            .tint(.blue)
                        Text("Downloading... \(Int(downloadProgress * 100))%")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .padding(.horizontal)
                }

                Spacer()

                // Action buttons
                VStack(spacing: 10) {
                    Button {
                        Task {
                            await downloadAndImportUSDZ(item: item)
                        }
                    } label: {
                        HStack {
                            Image(systemName: isDownloading ? "hourglass" : "arkit")
                            Text(isDownloading ? "Downloading..." : "Download & Import to Scene")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isDownloading)

                    HStack(spacing: 10) {
                        Button {
                            Task {
                                await downloadAndAddAsUSDZ(item: item)
                            }
                        } label: {
                            Label("Save USDZ", systemImage: "arrow.down.circle.fill")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .disabled(isDownloading)

                        Button {
                            Task {
                                await downloadAndAdd(item: item)
                            }
                        } label: {
                            Label("Save Original", systemImage: "arrow.down.doc.fill")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                        .disabled(isDownloading)
                    }

                    Button("Cancel") {
                        selected = nil
                    }
                    .foregroundColor(.secondary)
                    .disabled(isDownloading)
                }
            }
            .padding(24)
            .presentationDetents([.medium, .large])
        }
        .alert(isPresented: $showAlert) {
            Alert(
                title: Text("Notice"),
                message: Text(alertMessage),
                dismissButton: .default(Text("OK"))
            )
        }
        .overlay(alignment: .top) {
            if showSuccessToast {
                VStack(spacing: 12) {
                    HStack(spacing: 12) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.title2)
                            .foregroundStyle(.green)

                        VStack(alignment: .leading, spacing: 4) {
                            Text("Success!")
                                .font(.headline)
                                .foregroundColor(.black)
                            Text(successMessage)
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }

                        Spacer()

                        Button {
                            withAnimation {
                                showSuccessToast = false
                            }
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding()
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
                    .shadow(color: .black.opacity(0.1), radius: 10, y: 5)
                }
                .padding()
                .transition(.move(edge: .top).combined(with: .opacity))
                .zIndex(999)
            }
        }
    }
    
    var flashcardsView: some View {
        VStack(spacing: 0) {
            // Toolbar row
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                TextField("Search flashcards...", text: $searchText)
                    .textFieldStyle(.plain)
                    .autocorrectionDisabled()
                if !searchText.isEmpty {
                    Button(action: { searchText = "" }) {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                    }
                }
                Divider().frame(height: 20).padding(.horizontal, 4)
                Button {
                    newCardFront = ""; newCardBack = ""; newCardTopic = ""; newCardTips = ""
                    showCreateFlashcard = true
                } label: {
                    Label("New", systemImage: "plus")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.small)
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(Color(white: 0.95))
            .sheet(isPresented: $showCreateFlashcard) {
                createFlashcardSheet
            }
            
            // Results header
            if !flashcards.isEmpty {
                HStack {
                    Text("\(flashcards.count) flashcard\(flashcards.count == 1 ? "" : "s")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    if isLoadingFlashcards {
                        ProgressView()
                            .scaleEffect(0.8)
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 6)
            }
            
            if flashcards.isEmpty && !isLoadingFlashcards {
                VStack(spacing: 16) {
                    Image(systemName: "book.fill")
                        .font(.system(size: 48))
                        .foregroundStyle(.secondary)
                    
                    Text("No flashcards available")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                    
                    if let error = flashcardError {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.orange)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }
                    
                    Button(action: {
                        Task { await loadFlashcards() }
                    }) {
                        Label("Retry", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if isLoadingFlashcards && flashcards.isEmpty {
                VStack(spacing: 12) {
                    ProgressView()
                    Text("Loading flashcards...")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(flashcards.filter { searchText.isEmpty || $0.front.localizedCaseInsensitiveContains(searchText) || ($0.topic?.localizedCaseInsensitiveContains(searchText) ?? false) }) { card in
                    HStack(spacing: 12) {
                        // Flashcard visual
                        ZStack(alignment: .topLeading) {
                            RoundedRectangle(cornerRadius: 10)
                                .fill(LinearGradient(
                                    colors: [Color.blue.opacity(0.15), Color.purple.opacity(0.1)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ))
                                .frame(width: 80, height: 64)

                            VStack(alignment: .leading, spacing: 4) {
                                if let topic = card.topic {
                                    Text(topic)
                                        .font(.system(size: 8, weight: .semibold))
                                        .foregroundStyle(.blue)
                                        .lineLimit(1)
                                }
                                Text(card.front)
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundStyle(.primary)
                                    .lineLimit(3)
                                    .multilineTextAlignment(.leading)
                            }
                            .padding(6)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            if let topic = card.topic {
                                Text(topic)
                                    .font(.caption2)
                                    .fontWeight(.semibold)
                                    .foregroundStyle(.blue)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.blue.opacity(0.1))
                                    .clipShape(Capsule())
                            }
                            Text(card.front)
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .lineLimit(2)
                            if let back = card.back {
                                Text(back)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(1)
                            }
                        }

                        Spacer()

                        Button("Import") {
                            selectedFlashcard = card
                            showFlashcardPreview = true
                        }
                        .buttonStyle(.bordered)
                        .font(.caption)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .sheet(item: $selectedFlashcard) { card in
            VStack(spacing: 20) {
                // Flashcard visual card
                ZStack(alignment: .topLeading) {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(LinearGradient(
                            colors: [Color.blue.opacity(0.18), Color.purple.opacity(0.12)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                        .frame(maxWidth: .infinity)
                        .frame(height: 140)

                    VStack(alignment: .leading, spacing: 8) {
                        if let topic = card.topic {
                            Text(topic.uppercased())
                                .font(.caption2)
                                .fontWeight(.bold)
                                .foregroundStyle(.blue)
                                .tracking(1)
                        }
                        Text(card.front)
                            .font(.title3)
                            .fontWeight(.semibold)
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.leading)
                    }
                    .padding(16)
                }
                .shadow(color: .black.opacity(0.08), radius: 6, y: 3)

                // Answer
                VStack(alignment: .leading, spacing: 4) {
                    Text("Answer")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Text(card.back ?? "N/A")
                        .font(.body)
                        .foregroundStyle(.primary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                // Card details
                if let cardType = card.cardType {
                    HStack {
                        Text("Type:")
                            .foregroundStyle(.secondary)
                        Text(cardType)
                            .fontWeight(.medium)
                    }
                    .font(.subheadline)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                
                // Tips
                if let tips = card.tips {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Tips")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(.secondary)
                        Text(tips)
                            .font(.caption)
                            .foregroundStyle(.primary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(8)
                    .background(Color.yellow.opacity(0.1))
                    .cornerRadius(8)
                }
                
                // Attachments preview
                if let attachments = card.attachments, !attachments.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Attachments: \(attachments.count)")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                Spacer()

                // Import Progress
                if isImportingFlashcard {
                    VStack(spacing: 8) {
                        ProgressView()
                        Text("Adding to AR scene...")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 8)
                }

                // Actions
                HStack(spacing: 12) {
                    Button("Cancel") {
                        selectedFlashcard = nil
                        isImportingFlashcard = false
                    }
                    .buttonStyle(.bordered)
                    .disabled(isImportingFlashcard)
                    
                    Spacer()
                    
                    Button {
                        Task {
                            await importFlashcardToScene(card: card)
                        }
                    } label: {
                        Label(isImportingFlashcard ? "Adding..." : "Add to AR Scene",
                              systemImage: isImportingFlashcard ? "hourglass" : "arkit.badge.xmark")
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isImportingFlashcard)
                }
            }
            .padding(24)
            .presentationDetents([.medium, .large])
        }
        .alert(isPresented: $showAlert) {
            Alert(
                title: Text("Notice"),
                message: Text(alertMessage),
                dismissButton: .default(Text("OK"))
            )
        }
        .overlay(alignment: .top) {
            if showSuccessToast {
                VStack(spacing: 12) {
                    HStack(spacing: 12) {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.title2)
                            .foregroundStyle(.green)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Success!")
                                .font(.headline)
                                .foregroundStyle(.primary)
                            Text(successMessage)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        
                        Spacer()
                        
                        Button {
                            withAnimation {
                                showSuccessToast = false
                            }
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding()
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
                    .shadow(color: .black.opacity(0.1), radius: 10, y: 5)
                }
                .padding()
                .transition(.move(edge: .top).combined(with: .opacity))
                .zIndex(999)
            }
        }
    }

    // MARK: - API Methods
    
    @MainActor
    func loadFromAPI() async {
        isLoading = true
        lastError = nil // Clear previous error
        defer { isLoading = false }

        do {
            print("Searching for: '\(searchText)'")
            print("Backend URL: \(AssetAPIService.shared.baseURL)")
            
            // Test connection first
            let isConnected = await AssetAPIService.shared.testConnection()
            print(isConnected ? "Connection OK" : "Connection test failed - attempting request anyway...")
            
            let response = try await AssetAPIService.shared.listAssets(
                assetType: "model",
                search: searchText.isEmpty ? nil : searchText,
                page: 1,
                pageSize: 50
            )
            
            let assetCount = response.assets?.count ?? 0
            print("Loaded \(assetCount) assets from API")
            print("============================================================")
            print("SUCCESS! Search Results:")
            print("   Query: '\(searchText.isEmpty ? "ALL" : searchText)'")
            print("   Results: \(assetCount) / \(response.total ?? assetCount)")
            print("============================================================")
            
            // Debug: Print first asset's thumbnail URL
            if let assets = response.assets, let firstAsset = assets.first {
                print("First asset: \(firstAsset.name ?? "unnamed")")
                print("   Thumbnail URL: \(firstAsset.thumbnailURL?.absoluteString ?? "nil")")
                if let rawData = firstAsset.rawApiData {
                    print("   Raw API data keys: \(rawData.keys.joined(separator: ", "))")
                }
            }
            
            library = response.assets ?? []
            totalAssets = response.total ?? (response.assets?.count ?? 0)
            
            // Show success toast
            if !searchText.isEmpty {
                successMessage = "Found \(library.count) model(s) for '\(searchText)'"
                withAnimation {
                    showSuccessToast = true
                }
                // Auto-hide after 3 seconds
                Task {
                    try? await Task.sleep(nanoseconds: 3_000_000_000)
                    await MainActor.run {
                        withAnimation {
                            showSuccessToast = false
                        }
                    }
                }
            }
            
        } catch let error as AssetAPIError {
            let errorMsg = error.localizedDescription
            print("API Error: \(errorMsg)")
            lastError = errorMsg
            // Don't show alert, show in empty state instead
        } catch {
            print("Error: \(error.localizedDescription)")
            print("   Error type: \(type(of: error))")
            print("   Error details: \(error)")
            let nsError = error as NSError
            print("   Domain: \(nsError.domain), Code: \(nsError.code)")
            if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorTimedOut {
                lastError = "Request timed out. Is your backend server running?"
            } else {
                lastError = "Failed to load models: \(error.localizedDescription)"
            }
        }
    }

    func downloadAndAdd(item: AssetItem) async {
        let itemName = item.name ?? "unnamed"
        isLoading = true
        isDownloading = false
        downloadProgress = 0.0
        defer { 
            isLoading = false
            isDownloading = false
            downloadProgress = 0.0
        }

        do {
            print("Starting download for: \(itemName)")
            
            // Get download options
            downloadProgress = 0.1
            print("Fetching download options...")
            let downloads = try await AssetAPIService.shared.getDownloads(assetId: item.id)
            
            guard !downloads.isEmpty else {
                alertMessage = "No download options available for this model"
                selected = nil
                Task {
                    try? await Task.sleep(nanoseconds: 400_000_000)
                    await MainActor.run { showAlert = true }
                }
                return
            }
            
            print("Found \(downloads.count) download options")
            downloads.forEach { option in
                print("   - \(option.fileFormat.uppercased()) (\(option.resolution ?? "N/A")) - \(formatFileSize(option.fileSize))")
            }
            
            downloadProgress = 0.2
            isDownloading = true
            
            // Simulate progress (in a real implementation, use URLSession delegate for actual progress)
            Task {
                for progress in stride(from: 0.2, through: 0.9, by: 0.1) {
                    try? await Task.sleep(nanoseconds: 200_000_000) // 0.2 seconds
                    await MainActor.run {
                        downloadProgress = progress
                    }
                }
            }
            
            // Download the asset using the API service
            print("Downloading model file...")
            let localURL = try await AssetAPIService.shared.downloadAsset(
                assetId: item.id,
                preferredFormats: ["glb", "gltf", "usdz", "usd", "obj"]
            )
            
            downloadProgress = 1.0
            
            print("Download complete: \(localURL.path)")
            print("File size: \(formatFileSize(localURL.fileSize))")
            
            // Show success toast
            successMessage = "Downloaded \(itemName) • \(formatFileSize(localURL.fileSize))"
            withAnimation {
                showSuccessToast = true
            }
            
            // Auto-hide after 5 seconds
            Task {
                try? await Task.sleep(nanoseconds: 5_000_000_000)
                await MainActor.run {
                    withAnimation {
                        showSuccessToast = false
                    }
                }
            }
            
            // Also show detailed alert
            alertMessage = "Downloaded successfully!\n\n" +
                          "Model: \(itemName)\n" +
                          "File: \(localURL.lastPathComponent)\n" +
                          "Size: \(formatFileSize(localURL.fileSize))\n\n" +
                          "Location:\n\(localURL.path)"
            selected = nil
            Task {
                try? await Task.sleep(nanoseconds: 400_000_000)
                await MainActor.run { showAlert = true }
            }
            
        } catch let error as AssetAPIError {
            print("Download error: \(error.localizedDescription)")
            alertMessage = "Download failed\n\n\(error.localizedDescription)"
            selected = nil
            Task {
                try? await Task.sleep(nanoseconds: 400_000_000)
                await MainActor.run { showAlert = true }
            }
        } catch {
            print("Unexpected error: \(error.localizedDescription)")
            alertMessage = "Download failed\n\n\(error.localizedDescription)"
            selected = nil
            Task {
                try? await Task.sleep(nanoseconds: 400_000_000)
                await MainActor.run { showAlert = true }
            }
        }
    }

    func downloadAndAddAsUSDZ(item: AssetItem) async {
        let itemName = item.name ?? "unnamed"
        isLoading = true
        isDownloading = true
        downloadProgress = 0.0
        defer {
            isLoading = false
            isDownloading = false
            downloadProgress = 0.0
        }

        do {
            print("Starting USDZ download for: \(itemName)")
            downloadProgress = 0.1

            // Simulate progress
            Task {
                for progress in stride(from: 0.1, through: 0.8, by: 0.1) {
                    try? await Task.sleep(nanoseconds: 300_000_000)
                    await MainActor.run { downloadProgress = progress }
                }
            }

            // Attempt to download USDZ via conversion endpoint
            let localURL = try await AssetAPIService.shared.downloadAssetAsUSDZ(assetId: item.id, resolution: "1k")

            downloadProgress = 1.0

            print("USDZ Download complete: \(localURL.path)")

            successMessage = "Downloaded USDZ: \(itemName) - \(formatFileSize(localURL.fileSize))"
            withAnimation {
                showSuccessToast = true
            }

            Task {
                try? await Task.sleep(nanoseconds: 5_000_000_000)
                await MainActor.run {
                    withAnimation { showSuccessToast = false }
                }
            }

            alertMessage = "USDZ downloaded successfully!\n\nModel: \(itemName)\nFile: \(localURL.lastPathComponent)\nSize: \(formatFileSize(localURL.fileSize))\n\nLocation:\n\(localURL.path)"
            selected = nil
            Task {
                try? await Task.sleep(nanoseconds: 400_000_000)
                await MainActor.run { showAlert = true }
            }
        } catch let error as AssetAPIError {
            print("USDZ download error: \(error.localizedDescription)")
            alertMessage = "Download failed\n\n\(error.localizedDescription)"
            selected = nil
            Task {
                try? await Task.sleep(nanoseconds: 400_000_000)
                await MainActor.run { showAlert = true }
            }
        } catch {
            print("Unexpected error: \(error.localizedDescription)")
            alertMessage = "Download failed\n\n\(error.localizedDescription)"
            selected = nil
            Task {
                try? await Task.sleep(nanoseconds: 400_000_000)
                await MainActor.run { showAlert = true }
            }
        }
    }

    /// Download USDZ and immediately import into the RealityKit AR scene
    @MainActor
    func downloadAndImportUSDZ(item: AssetItem) async {
        let itemName = item.name ?? "unnamed"
        isLoading = true
        isDownloading = true
        downloadProgress = 0.0
        defer {
            isLoading = false
            isDownloading = false
            downloadProgress = 0.0
        }

        do {
            print("Starting model download + import for: \(itemName)")
            downloadProgress = 0.1

            // Simulate progress during download
            let progressTask = Task {
                for progress in stride(from: 0.1, through: 0.7, by: 0.05) {
                    try? await Task.sleep(nanoseconds: 200_000_000)
                    if !Task.isCancelled {
                        await MainActor.run { downloadProgress = progress }
                    }
                }
            }

            // Try USD with textures first (proper PBR), then fall back to bare USDZ
            var localURL: URL
            do {
                print("Trying USD with textures (best quality)...")
                localURL = try await AssetAPIService.shared.downloadAssetWithTextures(assetId: item.id, resolution: "1k")
                print("USD + textures download succeeded")
            } catch {
                print("USD+textures not available (\(error.localizedDescription)), falling back to bare USDZ...")
                localURL = try await AssetAPIService.shared.downloadAssetAsUSDZ(assetId: item.id, resolution: "1k")
            }
            progressTask.cancel()
            downloadProgress = 0.8

            print("Model file downloaded to: \(localURL.path)")
            print("File size: \(formatFileSize(localURL.fileSize))")

            // Load into a RealityKit Entity
            downloadProgress = 0.9
            print("Loading model into RealityKit Entity...")

            let entity = try await Entity(contentsOf: localURL)

            // Scale to reasonable size (0.3m) if needed
            let bounds = entity.visualBounds(relativeTo: nil)
            let maxExtent = max(bounds.extents.x, bounds.extents.y, bounds.extents.z)
            if maxExtent > 0 {
                let targetSize: Float = 0.3 // 30cm
                let scale = targetSize / maxExtent
                entity.scale = [scale, scale, scale]
                print("Scaled model: maxExtent=\(maxExtent) -> scale=\(scale)")
            }

            // Place in front of user at eye level
            entity.position = [0, 1.2, -1.0]
            entity.name = itemName

            // Generate collision shapes for interaction
            entity.generateCollisionShapes(recursive: true)

            // Make entity interactive (tap, drag)
            entity.components.set(InputTargetComponent())

            downloadProgress = 1.0

            if let palace = appModel.currentPalace {
                // We are inside a palace, save to database
                var createItem = PalaceItemCreate()
                createItem.assetId = item.id
                createItem.label = itemName
                createItem.displayType = "3d_model"
                
                _ = try await APIService.shared.placeItem(palaceId: palace.id, item: createItem)
                print("Model saved to Palace DB: \(itemName)")
                
                // Open immersive space if not already open
                if appModel.immersiveSpaceState != .open {
                    print("Opening immersive space...")
                    #if os(visionOS)
                    let result = await openImmersiveSpace(id: appModel.immersiveSpaceID)
                    switch result {
                    case .opened:
                        try? await Task.sleep(nanoseconds: 500_000_000)
                    default: break
                    }
                    #endif
                }

                successMessage = "Added \(itemName) to Palace"
                withAnimation { showSuccessToast = true }

            } else {
                // Open immersive space if not already open
                if appModel.immersiveSpaceState != .open {
                    print("Opening immersive space...")
                    #if os(visionOS)
                    let result = await openImmersiveSpace(id: appModel.immersiveSpaceID)
                    switch result {
                    case .opened:
                        print("Immersive space opened")
                        // Give the scene a moment to initialize
                        try? await Task.sleep(nanoseconds: 500_000_000)
                    case .error:
                        print("Failed to open immersive space")
                    case .userCancelled:
                        print("User cancelled immersive space")
                    @unknown default:
                        break
                    }
                    #endif
                }

                // Add to scene via SceneController
                SceneController.shared.addEntity(entity)

                print("Model imported to AR scene: \(itemName)")

                successMessage = "Imported \(itemName) to AR scene"
                withAnimation {
                    showSuccessToast = true
                }
                
                alertMessage = "Model imported to AR scene!\n\nModel: \(itemName)\nFormat: USDZ\nSize: \(formatFileSize(localURL.fileSize))\n\nThe model has been placed in your AR scene. You can move and interact with it."
                Task {
                    try? await Task.sleep(nanoseconds: 400_000_000)
                    await MainActor.run { showAlert = true }
                }
            }

            Task {
                try? await Task.sleep(nanoseconds: 5_000_000_000)
                await MainActor.run {
                    withAnimation { showSuccessToast = false }
                }
            }

            selected = nil

        } catch let error as AssetAPIError {
            print("Download + import error: \(error.localizedDescription)")
            alertMessage = "Import failed\n\n\(error.localizedDescription)"
            selected = nil
            Task {
                try? await Task.sleep(nanoseconds: 400_000_000)
                await MainActor.run { showAlert = true }
            }
        } catch {
            print("Import error: \(error.localizedDescription)")
            alertMessage = "Import failed\n\nCould not load model into AR scene.\n\n\(error.localizedDescription)"
            selected = nil
            Task {
                try? await Task.sleep(nanoseconds: 400_000_000)
                await MainActor.run { showAlert = true }
            }
        }
    }
    
    private func formatFileSize(_ bytes: Int?) -> String {
        guard let bytes = bytes, bytes > 0 else { return "Unknown size" }
        
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB, .useGB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(bytes))
    }
    
    // MARK: - Create Flashcard Sheet

    private var createFlashcardSheet: some View {
        NavigationStack {
            Form {
                Section("Question *") {
                    TextEditor(text: $newCardFront)
                        .frame(minHeight: 80)
                }
                Section("Answer *") {
                    TextEditor(text: $newCardBack)
                        .frame(minHeight: 80)
                }
                Section("Optional") {
                    TextField("Topic (e.g. Physics)", text: $newCardTopic)
                    TextField("Tips / Hints", text: $newCardTips)
                }
            }
            .navigationTitle("New Flashcard")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showCreateFlashcard = false }
                        .disabled(isSavingFlashcard)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await saveNewFlashcard() }
                    } label: {
                        if isSavingFlashcard {
                            ProgressView().controlSize(.small)
                        } else {
                            Text("Save")
                        }
                    }
                    .disabled(newCardFront.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
                              newCardBack.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
                              isSavingFlashcard)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    @MainActor
    private func saveNewFlashcard() async {
        isSavingFlashcard = true
        defer { isSavingFlashcard = false }
        do {
            _ = try await APIService.shared.createFlashcard(
                front: newCardFront.trimmingCharacters(in: .whitespacesAndNewlines),
                back: newCardBack.trimmingCharacters(in: .whitespacesAndNewlines),
                topic: newCardTopic.isEmpty ? nil : newCardTopic.trimmingCharacters(in: .whitespacesAndNewlines),
                tips: newCardTips.isEmpty ? nil : newCardTips.trimmingCharacters(in: .whitespacesAndNewlines)
            )
            showCreateFlashcard = false
            await loadFlashcards()
        } catch {
            flashcardError = "Failed to save: \(error.localizedDescription)"
            showCreateFlashcard = false
        }
    }

    // MARK: - Flashcard Methods

    @MainActor
    func loadFlashcards() async {
        isLoadingFlashcards = true
        flashcardError = nil
        defer { isLoadingFlashcards = false }
        
        do {
            print("Loading flashcards...")
            
            // Get access token from parameter, environment, or Keychain fallback
            let token = accessToken ?? authVM.currentUser?.accessToken ?? KeychainService.get(forKey: "access_token") ?? ""

            if token.isEmpty {
                flashcardError = "Not authenticated. Please login first."
                print("Error: No access token available")
                return
            }
            
            let cards = try await FlashcardService.shared.fetchReviewCards(accessToken: token)
            
            print("Loaded \(cards.count) flashcards")
            flashcards = cards
            
            if !cards.isEmpty {
                successMessage = "Loaded \(cards.count) flashcard(s)"
                withAnimation {
                    showSuccessToast = true
                }
                // Auto-hide after 2 seconds
                Task {
                    try? await Task.sleep(nanoseconds: 2_000_000_000)
                    await MainActor.run {
                        withAnimation {
                            showSuccessToast = false
                        }
                    }
                }
            }
        } catch {
            print("Flashcard loading error: \(error.localizedDescription)")
            flashcardError = "Failed to load flashcards: \(error.localizedDescription)"
        }
    }
    
    @MainActor
    func importFlashcardToScene(card: ReviewCard) async {
        isImportingFlashcard = true
        defer { isImportingFlashcard = false }
        
        print("Importing flashcard: \(card.front)")
        
        if let palace = appModel.currentPalace {
            // Save to database
            do {
                var createItem = PalaceItemCreate()
                createItem.flashcardId = card.id
                createItem.label = card.front
                createItem.displayType = "text_panel"
                createItem.customText = "\(card.front)\n\n\(card.back ?? "")"
                
                _ = try await APIService.shared.placeItem(palaceId: palace.id, item: createItem)
                
                // Open immersive space if not already open
                if appModel.immersiveSpaceState != .open {
                    #if os(visionOS)
                    _ = await openImmersiveSpace(id: appModel.immersiveSpaceID)
                    #endif
                    try? await Task.sleep(nanoseconds: 500_000_000)
                }
                
                appModel.palaceItemRefreshTrigger += 1

                successMessage = "Added flashcard to Palace"
                withAnimation { showSuccessToast = true }

                Task {
                    try? await Task.sleep(nanoseconds: 3_000_000_000)
                    await MainActor.run { withAnimation { showSuccessToast = false } }
                }

                selectedFlashcard = nil
                
            } catch {
                alertMessage = "Failed to add to palace: \(error.localizedDescription)"
                showAlert = true
            }
        } else {
            alertMessage = "Please enter a Memory Palace first before importing flashcards."
            showAlert = true
            selectedFlashcard = nil
        }
    }
}
