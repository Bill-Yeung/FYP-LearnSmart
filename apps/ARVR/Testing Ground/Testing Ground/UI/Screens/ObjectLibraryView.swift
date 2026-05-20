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
    var initialTab: ViewMode = .models
    var lockedMode: ViewMode? = nil
    var showsTabs: Bool = true
    var title: String? = nil
    
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
    @State private var downloadingModelAssetId: String? = nil
    @State private var importingModelAssetId: String? = nil
    @State private var showSuccessToast: Bool = false
    @State private var successMessage: String = ""
    
    // Scenes
    @State private var sceneTab = 0                  // 0 = Built-in, 1 = HDRI Library
    @State private var hdriScenes: [APIService.VisionProBackground] = []
    @State private var hdriSceneSearch: String = ""
    @State private var hdriScenePage = 1
    @State private var hdriSceneTotal = 0
    @State private var isLoadingScenes = false
    @State private var appliedSceneId: String? = nil
    @State private var sceneSearchTask: Task<Void, Never>?
    @State private var sceneError: String? = nil
    @State private var downloadedSceneIds: Set<String> = []
    @State private var downloadingSceneId: String? = nil
    @State private var applyingSceneId: String? = nil

    private let skyboxPresets = ["library", "classroom", "museum", "garden", "temple", "observatory"]
    private let presetIcons: [String: String] = [
        "library": "books.vertical", "classroom": "graduationcap",
        "museum": "building.columns", "garden": "leaf",
        "temple": "building", "observatory": "star",
    ]

    /// Asset IDs that have been downloaded in this session — used to show "Downloaded" badge (#8).
    @State private var downloadedAssetIds: Set<String> = []
    /// 3D model palace items available to attach a flashcard to (#12).
    @State private var palaceItemsForAttach: [PalaceItem] = []
    @State private var isLoadingAttachItems: Bool = false
    /// Card pending attachment to an existing object; triggers the object-picker sheet (#12).
    @State private var attachTargetCard: ReviewCard? = nil
    @State private var attachTargetConcept: ConceptItem? = nil

    // Flashcards
    @State private var flashcards: [ReviewCard] = []
    @State private var selectedFlashcard: ReviewCard? = nil
    @State private var isLoadingFlashcards: Bool = false
    @State private var flashcardError: String?
    @State private var concepts: [ConceptItem] = []
    @State private var selectedConcept: ConceptItem? = nil
    @State private var isLoadingConcepts: Bool = false
    @State private var conceptError: String?
    @State private var viewMode: ViewMode = .models
    @State private var showFlashcardPreview: Bool = false
    @State private var isImportingFlashcard: Bool = false
    
    enum ViewMode {
        case models
        case concepts
        case flashcards
        case scenes

        var title: String {
            switch self {
            case .models:
                "Models"
            case .concepts:
                "Concepts"
            case .flashcards:
                "Flashcards"
            case .scenes:
                "Scenes"
            }
        }
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
            viewMode = lockedMode ?? initialTab
            Task { await loadActiveModeIfNeeded() }
        }
        .onChange(of: viewMode) { _, _ in
            Task { await loadActiveModeIfNeeded() }
        }
        .onChange(of: appModel.palaceItemRefreshTrigger) { _, _ in
            Task { await loadAttachablePalaceObjects() }
        }
    }

    private var libraryTitle: String {
        title ?? (showsTabs ? "Library" : (lockedMode ?? viewMode).title)
    }

    private var filteredConcepts: [ConceptItem] {
        guard !searchText.isEmpty else { return concepts }
        return concepts.filter { concept in
            concept.title.localizedCaseInsensitiveContains(searchText)
            || (concept.description?.localizedCaseInsensitiveContains(searchText) ?? false)
            || (concept.conceptType?.localizedCaseInsensitiveContains(searchText) ?? false)
            || (concept.keywords?.contains { $0.localizedCaseInsensitiveContains(searchText) } ?? false)
        }
    }

    private var successToast: some View {
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

    @MainActor
    private func loadActiveModeIfNeeded() async {
        switch viewMode {
        case .models:
            if library.isEmpty {
                await loadFromAPI()
            } else {
                refreshDownloadedAssets()
            }
        case .concepts:
            if concepts.isEmpty {
                await loadConcepts()
            }
        case .flashcards:
            if flashcards.isEmpty {
                await loadFlashcards()
            }
        case .scenes:
            if sceneTab == 1 && hdriScenes.isEmpty {
                await loadHDRIScenes(reset: true)
            }
        }
    }
    
    private var mainContent: some View {
        VStack(spacing: 0) {
            // View Mode Picker
            if showsTabs && lockedMode == nil {
                Picker("Content", selection: $viewMode) {
                    Text("3D Models").tag(ViewMode.models)
                    Text("Concepts").tag(ViewMode.concepts)
                    Text("Flashcards").tag(ViewMode.flashcards)
                    Text("Scenes").tag(ViewMode.scenes)
                }
                .pickerStyle(.segmented)
                .padding()
            }

            if viewMode == .models {
                modelsView
            } else if viewMode == .concepts {
                conceptsView
            } else if viewMode == .flashcards {
                flashcardsView
            } else {
                scenesView
            }
        }
        .navigationTitle(libraryTitle)
    }
    
    var modelsView: some View { modelsViewBody }
    @ViewBuilder private var modelsViewBody: some View {
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
            .background(.ultraThinMaterial)
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Color.secondary.opacity(0.35), lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 10))
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
                            Text("• Server: \(BackendConfig.baseURL)")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                            Text("• Make sure the backend server is running")
                                .font(.caption2)
                                .foregroundStyle(.tertiary)
                            Text("• Go to Settings (⚙) to change the server")
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
                        if let proxyThumb = URL(string: "\(BackendConfig.baseURL)/api/models/\(item.id)/thumbnail") {
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

                        HStack(spacing: 8) {
                            let isDownloadingThisModel = downloadingModelAssetId == item.id
                            let isImportingThisModel = importingModelAssetId == item.id
                            let isBusyWithModel = downloadingModelAssetId != nil || importingModelAssetId != nil

                            if downloadedAssetIds.contains(item.id) {
                                Image(systemName: "checkmark.circle.fill")
                                    .font(.caption)
                                    .foregroundStyle(.green)
                                    .frame(width: 32, height: 28)
                            } else {
                                Button {
                                    Task { await downloadModelOnly(item: item) }
                                } label: {
                                    modelActionLabel(
                                        title: "Download",
                                        loadingTitle: "Loading",
                                        isLoading: isDownloadingThisModel,
                                        width: 72
                                    )
                                }
                                .buttonStyle(.bordered)
                                .controlSize(.small)
                                .disabled(isBusyWithModel)
                            }

                            Button {
                                Task { await downloadAndImportUSDZ(item: item) }
                            } label: {
                                modelActionLabel(
                                    title: "Import",
                                    loadingTitle: "Adding",
                                    isLoading: isImportingThisModel,
                                    width: 64
                                )
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.small)
                            .disabled(isBusyWithModel)
                        }
                    }
                    .padding(.vertical, 6)
                }
            }
        }
        .sheet(item: $selected) { item in
            VStack(spacing: 16) {
                // Model thumbnail preview
                if let thumbURL = URL(string: "\(BackendConfig.baseURL)/api/models/\(item.id)/thumbnail") {
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

                // Issue 9 & 10: two clear actions — Import to Palace (primary) and Download only (secondary)
                VStack(spacing: 10) {
                    Button {
                        Task { await downloadAndImportUSDZ(item: item) }
                    } label: {
                        HStack {
                            Image(systemName: isDownloading ? "hourglass" : "square.and.arrow.down.on.square")
                            Text(isDownloading ? "Importing…" : "Import to Palace")
                                .fontWeight(.semibold)
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 44)
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isDownloading)

                    Button {
                        Task { await downloadAndAdd(item: item) }
                    } label: {
                        Label("Download Only", systemImage: "arrow.down.circle")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .disabled(isDownloading)

                    Button("Cancel") { selected = nil }
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

    private func modelActionLabel(title: String, loadingTitle: String, isLoading: Bool, width: CGFloat) -> some View {
        HStack(spacing: 5) {
            if isLoading {
                ProgressView()
                    .scaleEffect(0.65)
            }
            Text(isLoading ? loadingTitle : title)
                .font(.caption)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .frame(width: width, height: 28)
    }
    
    var conceptsView: some View { conceptsViewBody }
    @ViewBuilder private var conceptsViewBody: some View {
        VStack(spacing: 0) {
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                TextField("Search concepts...", text: $searchText)
                    .textFieldStyle(.plain)
                    .autocorrectionDisabled()
                if !searchText.isEmpty {
                    Button {
                        searchText = ""
                    } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial)
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Color.secondary.opacity(0.35), lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 10))

            if !concepts.isEmpty {
                HStack {
                    Text("\(concepts.count) concept\(concepts.count == 1 ? "" : "s")")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    if isLoadingConcepts {
                        ProgressView()
                            .scaleEffect(0.8)
                    }
                }
                .padding(.horizontal)
                .padding(.vertical, 6)
            }

            if concepts.isEmpty && !isLoadingConcepts {
                VStack(spacing: 16) {
                    Image(systemName: "lightbulb")
                        .font(.system(size: 48))
                        .foregroundStyle(.secondary)
                    Text("No concepts available")
                        .font(.headline)
                        .foregroundStyle(.secondary)
                    if let error = conceptError {
                        Text(error)
                            .font(.caption)
                            .foregroundStyle(.orange)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }
                    Button {
                        Task { await loadConcepts() }
                    } label: {
                        Label("Retry", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if isLoadingConcepts && concepts.isEmpty {
                VStack(spacing: 12) {
                    ProgressView()
                    Text("Loading concepts...")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(filteredConcepts) { concept in
                    HStack(spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 10)
                                .fill(LinearGradient(
                                    colors: [Color.orange.opacity(0.18), Color.yellow.opacity(0.10)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ))
                                .frame(width: 72, height: 56)
                            Image(systemName: "lightbulb.fill")
                                .foregroundStyle(.orange)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            HStack(spacing: 6) {
                                if let type = concept.conceptType, !type.isEmpty {
                                    Text(type.replacingOccurrences(of: "_", with: " ").capitalized)
                                        .font(.caption2)
                                        .fontWeight(.semibold)
                                        .foregroundStyle(.orange)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Color.orange.opacity(0.12))
                                        .clipShape(Capsule())
                                }
                                if let difficulty = concept.difficultyLevel, !difficulty.isEmpty {
                                    Text(difficulty.capitalized)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            Text(concept.title)
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .lineLimit(2)
                            if let description = concept.description, !description.isEmpty {
                                Text(description)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(2)
                            }
                        }

                        Spacer()

                        Button("Attach") {
                            selectedConcept = concept
                        }
                        .buttonStyle(.bordered)
                        .font(.caption)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .sheet(item: $selectedConcept) { concept in
            VStack(spacing: 18) {
                ZStack(alignment: .topLeading) {
                    RoundedRectangle(cornerRadius: 16)
                        .fill(LinearGradient(
                            colors: [Color.orange.opacity(0.18), Color.yellow.opacity(0.12)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                        .frame(maxWidth: .infinity)
                        .frame(height: 130)

                    VStack(alignment: .leading, spacing: 8) {
                        Text((concept.conceptType ?? "Concept").replacingOccurrences(of: "_", with: " ").uppercased())
                            .font(.caption2)
                            .fontWeight(.bold)
                            .foregroundStyle(.orange)
                            .tracking(1)
                        Text(concept.title)
                            .font(.title3)
                            .fontWeight(.semibold)
                            .foregroundStyle(.primary)
                            .multilineTextAlignment(.leading)
                    }
                    .padding(16)
                }
                .shadow(color: .black.opacity(0.08), radius: 6, y: 3)

                if let description = concept.description, !description.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Description")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(description)
                            .font(.body)
                            .foregroundStyle(.primary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                if let keywords = concept.keywords, !keywords.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Keywords")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(keywords.prefix(8), id: \.self) { keyword in
                                    Text(keyword)
                                        .font(.caption2)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Color.orange.opacity(0.12))
                                        .clipShape(Capsule())
                                }
                            }
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                Spacer()

                VStack(spacing: 10) {
                    if appModel.currentPalace != nil {
                        Button {
                            attachTargetConcept = concept
                            selectedConcept = nil
                        } label: {
                            if isLoadingAttachItems {
                                Label("Loading objects...", systemImage: "hourglass")
                                    .frame(maxWidth: .infinity)
                            } else {
                                Label(palaceItemsForAttach.isEmpty ? "No 3D Objects in Palace" : "Attach to Existing Object",
                                      systemImage: "link")
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isLoadingAttachItems || palaceItemsForAttach.isEmpty)
                    }

                    Button("Cancel") {
                        selectedConcept = nil
                    }
                    .foregroundStyle(.secondary)
                }
            }
            .padding(24)
            .presentationDetents([.medium, .large])
            .task {
                await loadAttachablePalaceObjects()
            }
        }
        .sheet(item: $attachTargetConcept) { concept in
            NavigationStack {
                List(palaceItemsForAttach) { item in
                    Button {
                        Task { await attachConceptToObject(concept: concept, item: item) }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "cube.fill")
                                .foregroundStyle(.orange)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.label ?? "Unnamed Object")
                                    .fontWeight(.semibold)
                                if item.conceptId != nil {
                                    Text("Already linked to a concept")
                                        .font(.caption)
                                        .foregroundStyle(.orange)
                                }
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundStyle(.tertiary)
                        }
                        .padding(.vertical, 4)
                    }
                    .buttonStyle(.plain)
                }
                .navigationTitle("Attach to Object")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { attachTargetConcept = nil }
                    }
                }
            }
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
                successToast
            }
        }
    }

    var flashcardsView: some View { flashcardsViewBody }
    @ViewBuilder private var flashcardsViewBody: some View {
        VStack(spacing: 0) {
            // Search bar
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.secondary)
                TextField("Search flashcards...", text: $searchText)
                    .textFieldStyle(.plain)
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
            .background(.ultraThinMaterial)
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Color.secondary.opacity(0.35), lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 10))
            
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
                        ZStack {
                            RoundedRectangle(cornerRadius: 10)
                                .fill(LinearGradient(
                                    colors: [Color.blue.opacity(0.15), Color.purple.opacity(0.1)],
                                    startPoint: .topLeading,
                                    endPoint: .bottomTrailing
                                ))
                                .frame(width: 80, height: 64)

                            Image(systemName: "rectangle.portrait.on.rectangle.portrait")
                                .font(.system(size: 24, weight: .semibold))
                                .foregroundStyle(.blue)
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

                        Button("Attach") {
                            selectedFlashcard = card
                            showFlashcardPreview = true
                        }
                        .buttonStyle(.bordered)
                        .font(.caption)
                    }
                    .padding(.vertical, 4)
                    .contentShape(Rectangle())
                    .onTapGesture {
                        selectedFlashcard = card
                        showFlashcardPreview = true
                    }
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
                        Text("Adding to Palace…")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.vertical, 8)
                }

                // Actions
                VStack(spacing: 10) {
                    if appModel.currentPalace != nil {
                        Button {
                            attachTargetCard = card
                            selectedFlashcard = nil
                        } label: {
                            if isLoadingAttachItems {
                                Label("Loading objects…", systemImage: "hourglass")
                                    .frame(maxWidth: .infinity)
                            } else {
                                Label(palaceItemsForAttach.isEmpty ? "No 3D Objects in Palace" : "Attach to Existing Object",
                                      systemImage: "link")
                                    .frame(maxWidth: .infinity)
                            }
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isImportingFlashcard || isLoadingAttachItems || palaceItemsForAttach.isEmpty)
                    } else {
                        Text("Enter a Memory Palace to attach this flashcard to an object.")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                    }

                    Button("Cancel") {
                        selectedFlashcard = nil
                        isImportingFlashcard = false
                    }
                    .foregroundStyle(.secondary)
                    .disabled(isImportingFlashcard)
                }
            }
            .padding(24)
            .presentationDetents([.medium, .large])
            .task {
                // Pre-load 3D items so the Attach button is ready (#12)
                if let palace = appModel.currentPalace {
                    isLoadingAttachItems = true
                    if let items = try? await APIService.shared.getPalaceItems(palaceId: palace.id) {
                        palaceItemsForAttach = items.filter { $0.displayType == "3d_model" }
                    }
                    isLoadingAttachItems = false
                }
            }
        }
        // Object picker for attaching a flashcard to an existing 3D item (#12)
        .sheet(item: $attachTargetCard) { card in
            NavigationStack {
                List(palaceItemsForAttach) { item in
                    Button {
                        Task { await attachFlashcardToObject(card: card, item: item) }
                    } label: {
                        HStack(spacing: 12) {
                            Image(systemName: "cube.fill")
                                .foregroundStyle(.blue)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(item.label ?? "Unnamed Object")
                                    .fontWeight(.semibold)
                                if item.flashcardId != nil {
                                    Text("Already linked to a flashcard")
                                        .font(.caption)
                                        .foregroundStyle(.orange)
                                }
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .foregroundStyle(.tertiary)
                        }
                        .padding(.vertical, 4)
                    }
                    .buttonStyle(.plain)
                }
                .navigationTitle("Attach to Object")
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { attachTargetCard = nil }
                    }
                }
                .task {
                    await loadAttachablePalaceObjects()
                }
            }
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

    // MARK: - Scenes View

    var scenesView: some View {
        VStack(spacing: 0) {
            Picker("Scene type", selection: $sceneTab) {
                Text("Built-in").tag(0)
                Text("HDRI Library").tag(1)
            }
            .pickerStyle(.segmented)
            .padding()

            if sceneTab == 0 {
                scenePresetsGrid
            } else {
                sceneHDRIList
            }
        }
        .onChange(of: sceneTab) { _, tab in
            if tab == 1 && hdriScenes.isEmpty {
                Task { await loadHDRIScenes(reset: true) }
            }
        }
    }

    private var scenePresetsGrid: some View {
        ScrollView {
            LazyVGrid(columns: [
                GridItem(.flexible(), spacing: 12),
                GridItem(.flexible(), spacing: 12),
                GridItem(.flexible(), spacing: 12),
            ], spacing: 16) {
                ForEach(skyboxPresets, id: \.self) { preset in
                    presetCell(preset)
                }
            }
            .padding()
        }
    }

    private func presetCell(_ preset: String) -> some View {
        let isApplied: Bool = appliedSceneId == nil && appModel.activeScenePreset == preset
        let icon: String = presetIcons[preset] ?? "photo"
        return Button { applyPresetScene(preset) } label: {
            VStack(spacing: 8) {
                ZStack {
                    RoundedRectangle(cornerRadius: 12)
                        .fill(isApplied ? Color.blue.opacity(0.18) : Color.secondary.opacity(0.08))
                        .frame(height: 72)
                    Image(systemName: icon)
                        .font(.title2)
                        .foregroundStyle(isApplied ? Color.blue : Color.secondary)
                }
                .overlay(
                    RoundedRectangle(cornerRadius: 12)
                        .strokeBorder(isApplied ? Color.blue : Color.clear, lineWidth: 2)
                )
                Text(preset.capitalized)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(isApplied ? Color.blue : Color.secondary)
                if isApplied {
                    Label("Applied", systemImage: "checkmark.circle.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(Color.green)
                }
            }
        }
        .buttonStyle(.plain)
    }

    private var sceneHDRIList: some View {
        VStack(spacing: 0) {
            // Search bar
            HStack {
                Image(systemName: "magnifyingglass").foregroundColor(.secondary)
                TextField("Search scenes...", text: $hdriSceneSearch)
                    .textFieldStyle(.plain)
                    .autocorrectionDisabled()
                    .onChange(of: hdriSceneSearch) { _, _ in
                        sceneSearchTask?.cancel()
                        sceneSearchTask = Task {
                            try? await Task.sleep(nanoseconds: 400_000_000)
                            if !Task.isCancelled { await loadHDRIScenes(reset: true) }
                        }
                    }
                if !hdriSceneSearch.isEmpty {
                    Button { hdriSceneSearch = "" } label: {
                        Image(systemName: "xmark.circle.fill").foregroundColor(.secondary)
                    }
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
            .background(.ultraThinMaterial)
            .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Color.secondary.opacity(0.35), lineWidth: 1))
            .clipShape(RoundedRectangle(cornerRadius: 10))

            if isLoadingScenes && hdriScenes.isEmpty {
                VStack(spacing: 12) {
                    ProgressView()
                    Text("Loading scenes...").font(.caption).foregroundStyle(.secondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if hdriScenes.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: sceneError != nil ? "exclamationmark.triangle" : "photo.on.rectangle")
                        .font(.system(size: 48))
                        .foregroundStyle(sceneError != nil ? .orange : .secondary)
                    Text(sceneError != nil ? "Failed to load scenes" : "No scenes found")
                        .font(.headline).foregroundStyle(.secondary)
                    if let err = sceneError {
                        Text(err)
                            .font(.caption)
                            .foregroundStyle(.orange)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    }
                    Button { Task { await loadHDRIScenes(reset: true) } } label: {
                        Label("Retry", systemImage: "arrow.clockwise")
                    }
                    .buttonStyle(.borderedProminent)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List {
                    ForEach(hdriScenes) { scene in
                        let isApplied = appliedSceneId == scene.id
                        HStack(spacing: 12) {
                            if let urlStr = scene.thumbnailUrl, let url = URL(string: urlStr) {
                                AsyncImage(url: url) { image in
                                    image.resizable().aspectRatio(contentMode: .fill)
                                } placeholder: {
                                    ZStack {
                                        RoundedRectangle(cornerRadius: 8).fill(Color.secondary.opacity(0.15))
                                        Image(systemName: "photo").foregroundStyle(.secondary)
                                    }
                                }
                                .frame(width: 80, height: 44)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }

                            VStack(alignment: .leading, spacing: 4) {
                                Text(scene.name.replacingOccurrences(of: "_", with: " ").capitalized)
                                    .font(.subheadline).fontWeight(.semibold)
                                if !scene.availableResolutions.isEmpty {
                                    Text(scene.availableResolutions.joined(separator: " · "))
                                        .font(.caption).foregroundStyle(.secondary)
                                }
                            }

                            Spacer()

                            HStack(spacing: 8) {
                                let isDownloadingThisScene = downloadingSceneId == scene.id
                                let isApplyingThisScene = applyingSceneId == scene.id
                                let isBusyWithScene = downloadingSceneId != nil || applyingSceneId != nil

                                if downloadedSceneIds.contains(scene.id) {
                                    Image(systemName: "checkmark.circle.fill")
                                        .font(.caption)
                                        .foregroundStyle(.green)
                                        .frame(width: 32, height: 28)
                                } else {
                                    Button {
                                        Task { await downloadHDRISceneOnly(scene) }
                                    } label: {
                                        modelActionLabel(
                                            title: "Download",
                                            loadingTitle: "Loading",
                                            isLoading: isDownloadingThisScene,
                                            width: 72
                                        )
                                    }
                                    .buttonStyle(.bordered)
                                    .controlSize(.small)
                                    .disabled(isBusyWithScene || scenePanoramaURL(scene) == nil)
                                }

                                if isApplied {
                                    Label("Applied", systemImage: "checkmark.circle.fill")
                                        .font(.caption)
                                        .foregroundStyle(.green)
                                } else {
                                    Button {
                                        Task { await downloadAndApplyHDRIScene(scene) }
                                    } label: {
                                        modelActionLabel(
                                            title: "Apply",
                                            loadingTitle: "Applying",
                                            isLoading: isApplyingThisScene,
                                            width: 64
                                        )
                                    }
                                    .buttonStyle(.bordered)
                                    .controlSize(.small)
                                    .disabled(isBusyWithScene || scenePanoramaURL(scene) == nil)
                                }
                            }
                        }
                        .padding(.vertical, 4)
                    }

                    if hdriScenes.count < hdriSceneTotal {
                        Button("Load More (\(hdriSceneTotal - hdriScenes.count) remaining)") {
                            Task {
                                hdriScenePage += 1
                                await loadHDRIScenes(reset: false)
                            }
                        }
                        .foregroundStyle(.blue)
                    }
                }
            }
        }
        .task {
            if hdriScenes.isEmpty { await loadHDRIScenes(reset: true) }
        }
    }

    @MainActor
    private func loadHDRIScenes(reset: Bool) async {
        guard !isLoadingScenes || reset else { return }
        isLoadingScenes = true
        if reset { sceneError = nil }
        defer { isLoadingScenes = false }

        let page = reset ? 1 : hdriScenePage
        do {
            let result = try await APIService.shared.listSceneBackgrounds(
                search: hdriSceneSearch.isEmpty ? nil : hdriSceneSearch,
                page: page,
                pageSize: 20
            )
            sceneError = nil
            if reset {
                hdriScenes = result.items
                hdriScenePage = 1
            } else {
                hdriScenes.append(contentsOf: result.items)
            }
            hdriSceneTotal = result.total
            refreshDownloadedScenes()
        } catch {
            let msg = "\(BackendConfig.baseURL)/api/visionpro/scene/backgrounds — \(error.localizedDescription)"
            print("Scene load error: \(msg)")
            sceneError = msg
            lastError = "Scenes: \(error.localizedDescription)"
        }
    }

    private func applyPresetScene(_ preset: String) {
        appModel.activeSceneURL = nil
        appModel.activeScenePreset = preset
        appliedSceneId = nil
        successMessage = "Scene changed to \(preset.capitalized)"
        withAnimation { showSuccessToast = true }
        Task { await savePresetSceneToPalace(preset) }
        Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            await MainActor.run { withAnimation { showSuccessToast = false } }
        }
    }

    @MainActor
    private func savePresetSceneToPalace(_ preset: String) async {
        guard let palace = appModel.currentPalace else { return }

        do {
            let updated = try await APIService.shared.updatePalace(
                id: palace.id,
                skyboxType: "preset",
                skyboxPreset: preset
            )
            appModel.currentPalace = updated
        } catch {
            lastError = "Scene changed locally, but saving to palace failed: \(error.localizedDescription)"
        }
    }

    private func scenePanoramaURL(_ scene: APIService.VisionProBackground) -> String? {
        scene.hdrUrl ?? scene.exrUrl
    }

    private func cachedSceneURL(for scene: APIService.VisionProBackground) -> URL? {
        guard let remoteURLString = scenePanoramaURL(scene) else {
            return nil
        }
        return HDRISceneCache.cachedURL(for: remoteURLString)
    }

    @MainActor
    private func refreshDownloadedScenes() {
        downloadedSceneIds = Set(hdriScenes.compactMap { scene in
            cachedSceneURL(for: scene) == nil ? nil : scene.id
        })
    }

    @MainActor
    private func downloadHDRISceneOnly(_ scene: APIService.VisionProBackground) async {
        downloadingSceneId = scene.id
        defer { downloadingSceneId = nil }

        do {
            let localURL = try await downloadHDRIScene(scene)
            downloadedSceneIds.insert(scene.id)
            successMessage = "Downloaded \(scene.name.replacingOccurrences(of: "_", with: " ").capitalized) • \(formatFileSize(localURL.fileSize))"
            withAnimation { showSuccessToast = true }
            Task {
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                await MainActor.run { withAnimation { showSuccessToast = false } }
            }
        } catch {
            lastError = "Scene download failed: \(error.localizedDescription)"
            alertMessage = "Scene download failed\n\n\(error.localizedDescription)"
            showAlert = true
        }
    }

    @MainActor
    private func downloadAndApplyHDRIScene(_ scene: APIService.VisionProBackground) async {
        applyingSceneId = scene.id
        defer { applyingSceneId = nil }

        do {
            let localURL = try await downloadHDRIScene(scene)
            downloadedSceneIds.insert(scene.id)
            applyHDRIScene(scene, localURL: localURL)
        } catch {
            lastError = "Scene apply failed: \(error.localizedDescription)"
            alertMessage = "Scene apply failed\n\n\(error.localizedDescription)"
            showAlert = true
        }
    }

    private func downloadHDRIScene(_ scene: APIService.VisionProBackground) async throws -> URL {
        guard let remoteURLString = scenePanoramaURL(scene) else {
            throw URLError(.badURL)
        }
        return try await HDRISceneCache.downloadIfNeeded(remoteURLString: remoteURLString)
    }

    private func applyHDRIScene(_ scene: APIService.VisionProBackground, localURL: URL) {
        appModel.activeSceneURL = localURL.absoluteString
        appModel.activeScenePreset = nil
        appliedSceneId = scene.id
        successMessage = "Scene applied: \(scene.name.replacingOccurrences(of: "_", with: " ").capitalized)"
        withAnimation { showSuccessToast = true }
        Task { await saveHDRISceneToPalace(scene) }
        Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            await MainActor.run { withAnimation { showSuccessToast = false } }
        }
    }

    private func applyHDRIScene(_ scene: APIService.VisionProBackground) {
        guard let sceneURL = scenePanoramaURL(scene) else {
            lastError = "This scene only has a preview image, not a full HDRI/EXR panorama, so it cannot be used safely as a VR dome."
            return
        }

        appModel.activeSceneURL = sceneURL
        appModel.activeScenePreset = nil
        appliedSceneId = scene.id
        successMessage = "Scene imported: \(scene.name.replacingOccurrences(of: "_", with: " ").capitalized)"
        Task { await saveHDRISceneToPalace(scene) }
        withAnimation { showSuccessToast = true }
        Task {
            try? await Task.sleep(nanoseconds: 3_000_000_000)
            await MainActor.run { withAnimation { showSuccessToast = false } }
        }
    }

    @MainActor
    private func saveHDRISceneToPalace(_ scene: APIService.VisionProBackground) async {
        guard let palace = appModel.currentPalace,
              let remoteSceneURL = scenePanoramaURL(scene) else { return }

        do {
            let updated = try await APIService.shared.updatePalace(
                id: palace.id,
                skyboxType: "uploaded",
                skyboxImagePath: remoteSceneURL
            )
            appModel.currentPalace = updated
        } catch {
            lastError = "HDRI scene changed locally, but saving to palace failed: \(error.localizedDescription)"
        }
    }

    // MARK: - API Methods
    
    @MainActor
    func loadFromAPI() async {
        isLoading = true
        lastError = nil
        defer { isLoading = false }

        do {
            print("Backend URL: \(BackendConfig.baseURL)")
            let response = try await APIService.shared.listModels(
                search: searchText.isEmpty ? nil : searchText,
                page: 1,
                pageSize: 50
            )

            let fetched = response.assets ?? []
            library = fetched
            totalAssets = response.total ?? fetched.count
            refreshDownloadedAssets()

            // Issue 6: no success toast for search results
        } catch {
            let nsError = error as NSError
            if nsError.domain == NSURLErrorDomain && nsError.code == NSURLErrorTimedOut {
                lastError = "Request timed out. Server: \(BackendConfig.baseURL)"
            } else {
                lastError = error.localizedDescription
            }
        }
    }

    @MainActor
    private func refreshDownloadedAssets() {
        downloadedAssetIds = Set(library.compactMap { item in
            AssetAPIService.shared.cachedModelURL(assetId: item.id) == nil ? nil : item.id
        })
    }

    @MainActor
    func downloadModelOnly(item: AssetItem) async {
        let itemName = item.name ?? "unnamed"
        isDownloading = true
        downloadingModelAssetId = item.id
        downloadProgress = 0.0
        defer {
            isDownloading = false
            downloadingModelAssetId = nil
            downloadProgress = 0.0
        }

        do {
            downloadProgress = 0.1
            let localURL: URL
            do {
                localURL = try await AssetAPIService.shared.downloadAssetWithTextures(assetId: item.id, resolution: "1k")
            } catch {
                localURL = try await AssetAPIService.shared.downloadAssetAsUSDZ(assetId: item.id, resolution: "1k")
            }
            downloadProgress = 1.0
            downloadedAssetIds.insert(item.id)
            successMessage = "Downloaded \(itemName) • \(formatFileSize(localURL.fileSize))"
            withAnimation { showSuccessToast = true }
            Task {
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                await MainActor.run { withAnimation { showSuccessToast = false } }
            }
        } catch {
            alertMessage = "Download failed\n\n\(error.localizedDescription)"
            showAlert = true
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
            
            downloadedAssetIds.insert(item.id)

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
            let localURL = try await AssetAPIService.shared.downloadAssetAsUSDZ(assetId: item.id, resolution: "512")

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
        importingModelAssetId = item.id
        downloadProgress = 0.0
        defer {
            isLoading = false
            isDownloading = false
            importingModelAssetId = nil
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
                createItem.positionY = 0.15
                createItem.positionZ = -1.2
                
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

                downloadedAssetIds.insert(item.id)
                refreshDownloadedAssets()
                appModel.palaceItemRefreshTrigger += 1
                successMessage = "Added \(itemName) to scene"
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

                successMessage = "Imported \(itemName) to Palace scene"
                withAnimation {
                    showSuccessToast = true
                }

                alertMessage = "Model imported to Palace scene!\n\nModel: \(itemName)\nFormat: USDZ\nSize: \(formatFileSize(localURL.fileSize))\n\nThe model has been placed in your Palace. You can move and interact with it."
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
    
    @MainActor
    func attachFlashcardToObject(card: ReviewCard, item: PalaceItem) async {
        guard let palace = appModel.currentPalace else { return }
        do {
            let combinedText = "\(card.front)\n\n\(card.back ?? "")"
            _ = try await APIService.shared.updateItemFlashcard(
                palaceId: palace.id,
                itemId: item.id,
                flashcardId: card.id,
                customText: combinedText,
                label: item.label ?? card.front
            )
            attachTargetCard = nil
            appModel.palaceItemRefreshTrigger += 1
            successMessage = "Flashcard attached to \(item.label ?? "object")"
            withAnimation { showSuccessToast = true }
            Task {
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                await MainActor.run { withAnimation { showSuccessToast = false } }
            }
        } catch {
            attachTargetCard = nil
            alertMessage = "Failed to attach flashcard: \(error.localizedDescription)"
            showAlert = true
        }
    }

    private func formatFileSize(_ bytes: Int?) -> String {
        guard let bytes = bytes, bytes > 0 else { return "Unknown size" }
        
        let formatter = ByteCountFormatter()
        formatter.allowedUnits = [.useKB, .useMB, .useGB]
        formatter.countStyle = .file
        return formatter.string(fromByteCount: Int64(bytes))
    }

    @MainActor
    func loadAttachablePalaceObjects() async {
        guard let palace = appModel.currentPalace else {
            palaceItemsForAttach = []
            return
        }

        isLoadingAttachItems = true
        defer { isLoadingAttachItems = false }

        do {
            let items = try await APIService.shared.getPalaceItems(palaceId: palace.id)
            palaceItemsForAttach = items.filter { $0.displayType == "3d_model" }
        } catch {
            palaceItemsForAttach = []
        }
    }

    // MARK: - Concept Methods

    @MainActor
    func loadConcepts() async {
        isLoadingConcepts = true
        conceptError = nil
        defer { isLoadingConcepts = false }

        do {
            concepts = try await APIService.shared.getConcepts()
        } catch {
            conceptError = "Failed to load concepts: \(error.localizedDescription)"
        }
    }

    @MainActor
    func attachConceptToObject(concept: ConceptItem, item: PalaceItem) async {
        guard let palace = appModel.currentPalace else { return }

        do {
            let memoryText = [concept.title, concept.description]
                .compactMap { value in
                    guard let value, !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                        return nil
                    }
                    return value
                }
                .joined(separator: "\n\n")

            _ = try await APIService.shared.updateItemConcept(
                palaceId: palace.id,
                itemId: item.id,
                conceptId: concept.id,
                customText: memoryText,
                label: item.label ?? concept.title
            )

            attachTargetConcept = nil
            appModel.palaceItemRefreshTrigger += 1
            successMessage = "Concept attached to \(item.label ?? "object")"
            withAnimation { showSuccessToast = true }
            Task {
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                await MainActor.run { withAnimation { showSuccessToast = false } }
            }
        } catch {
            attachTargetConcept = nil
            alertMessage = "Failed to attach concept: \(error.localizedDescription)"
            showAlert = true
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
            
            // Get access token from parameter or environment
            let token = accessToken ?? authVM.currentUser?.accessToken ?? ""
            
            if token.isEmpty {
                flashcardError = "Not authenticated. Please login first."
                print("Error: No access token available")
                return
            }
            
            let cards = try await FlashcardService.shared.fetchReviewCards(accessToken: token)
            
            print("Loaded \(cards.count) flashcards")
            flashcards = cards
            
            // Issue 6: no success toast when flashcards load
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
