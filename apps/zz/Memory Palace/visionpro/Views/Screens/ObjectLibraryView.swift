import SwiftUI

struct ObjectLibraryView: View {

    enum LibraryTab: String, CaseIterable, Identifiable {
        case models = "3D Models"
        case scenes = "Scenes"
        var id: String { rawValue }
    }

    @Environment(AppModel.self) private var appModel

    @State private var selectedTab: LibraryTab = .models
    @State private var assetVM = AssetLibraryViewModel()
    @State private var searchText = ""

    // Scenes tab state
    @State private var scenePickerTab = 0          // 0 = Built-in, 1 = HDRI Library
    @State private var hdriScenes: [APIService.VisionProBackground] = []
    @State private var hdriSceneSearch = ""
    @State private var hdriScenePage = 1
    @State private var hdriSceneTotal = 0
    @State private var isLoadingScenes = false
    @State private var appliedSceneId: String? = nil  // tracks which is active

    private let skyboxPresets = ["library", "classroom", "museum", "garden", "temple", "observatory"]
    private let presetIcons: [String: String] = [
        "library": "books.vertical", "classroom": "graduationcap",
        "museum": "building.columns", "garden": "leaf",
        "temple": "building", "observatory": "star",
    ]

    var body: some View {
        VStack(spacing: 0) {
            Picker("Tab", selection: $selectedTab) {
                ForEach(LibraryTab.allCases) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding()

            switch selectedTab {
            case .models:
                modelsTab
            case .scenes:
                scenesTab
            }
        }
        .searchable(text: $searchText, prompt: "Search...")
        .onChange(of: searchText) { _, newValue in
            Task {
                try? await Task.sleep(for: .milliseconds(300))
                if selectedTab == .models {
                    await assetVM.search(newValue)
                } else if selectedTab == .scenes {
                    hdriSceneSearch = newValue
                }
            }
        }
        .onChange(of: hdriSceneSearch) { _, _ in
            guard selectedTab == .scenes, scenePickerTab == 1 else { return }
            Task {
                try? await Task.sleep(for: .milliseconds(350))
                await loadHDRIScenes(reset: true)
            }
        }
    }

    // MARK: - Models Tab

    private var modelsTab: some View {
        Group {
            if assetVM.isLoading && assetVM.assets.isEmpty {
                ProgressView("Loading models...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if assetVM.assets.isEmpty {
                ContentUnavailableView(
                    "No Models Found",
                    systemImage: "cube",
                    description: Text("Try a different search term.")
                )
            } else {
                List {
                    ForEach(assetVM.assets) { asset in
                        HStack(spacing: 12) {
                            // Thumbnail
                            if let url = assetVM.thumbnailURL(for: asset.id) {
                                AsyncImage(url: url) { image in
                                    image.resizable().aspectRatio(contentMode: .fill)
                                } placeholder: {
                                    ZStack {
                                        RoundedRectangle(cornerRadius: 8)
                                            .fill(Brand.libraryColor.opacity(0.1))
                                        Image(systemName: "cube")
                                            .font(.title2)
                                            .foregroundStyle(Brand.libraryColor)
                                    }
                                }
                                .frame(width: 60, height: 60)
                                .clipShape(RoundedRectangle(cornerRadius: 8))
                            }

                            VStack(alignment: .leading, spacing: 4) {
                                Text(asset.name)
                                    .font(.headline)
                                if let source = asset.source {
                                    Text(source)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }

                            Spacer()

                            if assetVM.downloadingAssetIds.contains(asset.id) {
                                ProgressView()
                            } else if assetVM.downloadedAssetIds.contains(asset.id) {
                                Button(role: .destructive) {
                                    Task { await assetVM.evictModel(assetId: asset.id) }
                                } label: {
                                    Image(systemName: "trash.circle.fill")
                                        .font(.title3)
                                        .foregroundStyle(.red)
                                }
                                .buttonStyle(.plain)
                            } else {
                                Button {
                                    Task {
                                        _ = await assetVM.downloadModel(assetId: asset.id)
                                    }
                                } label: {
                                    Image(systemName: "arrow.down.circle.fill")
                                        .font(.title3)
                                        .foregroundStyle(Brand.primary)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }

                    if assetVM.assets.count < assetVM.totalCount {
                        Button("Load More") {
                            Task { await assetVM.loadNextPage() }
                        }
                        .foregroundStyle(Brand.primary)
                    }
                }
            }
        }
        .task {
            await assetVM.loadModels(reset: true)
        }
    }

    // MARK: - Scenes Tab

    private var scenesTab: some View {
        VStack(spacing: 12) {
            Picker("Scene type", selection: $scenePickerTab) {
                Text("Built-in").tag(0)
                Text("HDRI Library").tag(1)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)

            if scenePickerTab == 0 {
                scenePresetGrid
            } else {
                sceneHDRISection
            }
        }
        .padding(.top, 4)
        .onChange(of: scenePickerTab) { _, tab in
            if tab == 1 && hdriScenes.isEmpty {
                Task { await loadHDRIScenes(reset: true) }
            }
        }
    }

    private var scenePresetGrid: some View {
        ScrollView {
            LazyVGrid(columns: [
                GridItem(.flexible(), spacing: 12),
                GridItem(.flexible(), spacing: 12),
                GridItem(.flexible(), spacing: 12),
            ], spacing: 12) {
                ForEach(skyboxPresets, id: \.self) { preset in
                    let isActive = appliedSceneId == nil && appModel.activeScenePreset == preset
                    Button {
                        appModel.activeSceneURL = nil
                        appModel.activeScenePreset = preset
                        appliedSceneId = nil
                    } label: {
                        VStack(spacing: 8) {
                            ZStack {
                                RoundedRectangle(cornerRadius: 12)
                                    .fill(isActive ? Brand.primary.opacity(0.2) : Color.secondary.opacity(0.1))
                                    .frame(height: 70)
                                Image(systemName: presetIcons[preset] ?? "photo")
                                    .font(.title2)
                                    .foregroundStyle(isActive ? Brand.primary : .secondary)
                            }
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .strokeBorder(isActive ? Brand.primary : Color.clear, lineWidth: 2)
                            )
                            Text(preset.capitalized)
                                .font(.caption)
                                .foregroundStyle(isActive ? Brand.primary : .secondary)
                            if isActive {
                                Label("Applied", systemImage: "checkmark.circle.fill")
                                    .font(.system(size: 10))
                                    .foregroundStyle(.green)
                            }
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding()
        }
    }

    private var sceneHDRISection: some View {
        VStack(spacing: 0) {
            if isLoadingScenes && hdriScenes.isEmpty {
                ProgressView("Loading scenes…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if hdriScenes.isEmpty {
                ContentUnavailableView(
                    "No Scenes Found",
                    systemImage: "photo.on.rectangle",
                    description: Text("Try a different search term.")
                )
            } else {
                List {
                    ForEach(hdriScenes) { scene in
                        let isActive = appliedSceneId == scene.id
                        Button {
                            appModel.activeSceneURL = scene.thumbnailUrl
                            appModel.activeScenePreset = nil
                            appliedSceneId = scene.id
                        } label: {
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
                                    .frame(width: 80, height: 40)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                                }

                                VStack(alignment: .leading, spacing: 4) {
                                    Text(scene.name.replacingOccurrences(of: "_", with: " ").capitalized)
                                        .font(.headline)
                                    if !scene.availableResolutions.isEmpty {
                                        Text(scene.availableResolutions.joined(separator: " · "))
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                    }
                                }

                                Spacer()

                                if isActive {
                                    Label("Applied", systemImage: "checkmark.circle.fill")
                                        .font(.caption)
                                        .foregroundStyle(.green)
                                } else {
                                    Image(systemName: "arrow.right.circle")
                                        .foregroundStyle(Brand.primary)
                                }
                            }
                            .padding(.vertical, 4)
                        }
                        .buttonStyle(.plain)
                    }

                    if hdriScenes.count < hdriSceneTotal {
                        Button("Load More (\(hdriSceneTotal - hdriScenes.count) remaining)") {
                            Task {
                                hdriScenePage += 1
                                await loadHDRIScenes(reset: false)
                            }
                        }
                        .foregroundStyle(Brand.primary)
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
        defer { isLoadingScenes = false }

        let page = reset ? 1 : hdriScenePage
        guard let result = try? await APIService.shared.listSceneBackgrounds(
            search: hdriSceneSearch.isEmpty ? nil : hdriSceneSearch,
            page: page,
            pageSize: 20
        ) else { return }

        if reset {
            hdriScenes = result.items
            hdriScenePage = 1
        } else {
            hdriScenes.append(contentsOf: result.items)
        }
        hdriSceneTotal = result.total
    }

}
