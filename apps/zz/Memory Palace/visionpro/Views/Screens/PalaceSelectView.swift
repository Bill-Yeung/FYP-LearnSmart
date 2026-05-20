import SwiftUI

struct PalaceSelectView: View {

    @Environment(AppModel.self) private var appModel
    @Environment(\.openImmersiveSpace) private var openImmersiveSpace
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace

    @State private var palaceVM = PalaceViewModel()
    @State private var showCreateSheet = false
    @State private var newName = ""
    @State private var newDescription = ""
    @State private var selectedPreset = "library"
    @State private var palaceToDelete: MemoryPalace?
    @State private var palaceToEnter: MemoryPalace?
    @State private var showPalaceContent = false
    @State private var enteredPalaceId = ""

    // HDRI background picker state
    @State private var bgPickerTab = 0          // 0 = Built-in presets, 1 = HDRI Library
    @State private var hdriBackgrounds: [APIService.VisionProBackground] = []
    @State private var hdriSearch = ""
    @State private var hdriPage = 1
    @State private var hdriTotal = 0
    @State private var isLoadingHDRI = false
    @State private var selectedHDRI: APIService.VisionProBackground? = nil

    private let skyboxPresets = ["library", "classroom", "museum", "garden", "temple", "observatory"]

    private let presetIcons: [String: String] = [
        "library": "books.vertical",
        "classroom": "graduationcap",
        "museum": "building.columns",
        "garden": "leaf",
        "temple": "building",
        "observatory": "star",
    ]

    private let gridColumns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12),
    ]

    /// Recent palaces: those with lastOpenedAt, limited to 3
    private var recentPalaces: [MemoryPalace] {
        palaceVM.palaces
            .filter { $0.lastOpenedAt != nil }
            .sorted { ($0.lastOpenedAt ?? .distantPast) > ($1.lastOpenedAt ?? .distantPast) }
            .prefix(3)
            .map { $0 }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Mode indicator
                modeIndicator

                // Create button
                Button { showCreateSheet = true } label: {
                    Label("Create New Palace", systemImage: "plus.circle.fill")
                        .fontWeight(.medium)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Brand.primary.opacity(0.1))
                        .clipShape(RoundedRectangle(cornerRadius: 8))
                }
                .buttonStyle(.plain)

                if palaceVM.isLoading {
                    ProgressView("Loading palaces...")
                        .padding(.top, 40)
                } else if palaceVM.palaces.isEmpty {
                    ContentUnavailableView(
                        "No \(appModel.immersionMode.rawValue) Palaces Yet",
                        systemImage: "building.columns",
                        description: Text("Create your first memory palace to get started.")
                    )
                } else {
                    // Recent section
                    if !recentPalaces.isEmpty {
                        sectionHeader("Recent")
                        LazyVGrid(columns: gridColumns, spacing: 12) {
                            ForEach(recentPalaces) { palace in
                                palaceCard(palace)
                            }
                        }
                    }

                    // All palaces section
                    sectionHeader("All Palaces")
                    LazyVGrid(columns: gridColumns, spacing: 12) {
                        ForEach(palaceVM.palaces) { palace in
                            palaceCard(palace)
                        }
                    }
                }
            }
            .padding(.horizontal, 40)
            .padding(.vertical, 24)
        }
        .navigationDestination(isPresented: $showPalaceContent) {
            PalaceContentView(palaceId: enteredPalaceId)
        }
        .task {
            await palaceVM.seedDemoIfNeeded()
            let mode = appModel.immersionMode.rawValue.lowercased()
            await palaceVM.loadPalaces(mode: mode)
        }
        .onChange(of: appModel.immersionMode) { _, newMode in
            Task {
                await palaceVM.loadPalaces(mode: newMode.rawValue.lowercased())
            }
        }
        .sheet(isPresented: $showCreateSheet) {
            createPalaceSheet
        }
        .confirmationDialog("Enter Palace?", isPresented: .init(
            get: { palaceToEnter != nil },
            set: { if !$0 { palaceToEnter = nil } }
        ), presenting: palaceToEnter) { palace in
            Button("Enter \(palace.name)") {
                Task { await enterPalace(palace) }
            }
            Button("Cancel", role: .cancel) { palaceToEnter = nil }
        } message: { palace in
            Text("Open \(palace.name) in \(palace.mode.uppercased()) mode?")
        }
        .alert("Delete Palace?", isPresented: .init(
            get: { palaceToDelete != nil },
            set: { if !$0 { palaceToDelete = nil } }
        )) {
            Button("Delete", role: .destructive) {
                if let palace = palaceToDelete {
                    Task { await palaceVM.deletePalace(palace) }
                }
            }
            Button("Cancel", role: .cancel) { palaceToDelete = nil }
        } message: {
            Text("This will remove the palace and all its items.")
        }
        .alert("Error", isPresented: .init(
            get: { palaceVM.errorMessage != nil },
            set: { if !$0 { palaceVM.errorMessage = nil } }
        )) {
            Button("OK") { palaceVM.errorMessage = nil }
        } message: {
            Text(palaceVM.errorMessage ?? "")
        }
    }

    // MARK: - Subviews

    private var modeIndicator: some View {
        HStack(spacing: 10) {
            Image(systemName: appModel.immersionMode == .vr ? "visionpro.fill" : "arkit")
                .font(.title3)
                .foregroundStyle(Brand.primary)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(appModel.immersionMode.rawValue) Mode")
                    .font(.headline)
                Text(appModel.immersionMode == .vr
                     ? "Full immersive skybox environment"
                     : "Place items in your real space")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(16)
        .background(Brand.primary.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.title3)
            .fontWeight(.semibold)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func palaceCard(_ palace: MemoryPalace) -> some View {
        Button {
            palaceToEnter = palace
        } label: {
            ActionCard(
                icon: palace.skyboxType == "uploaded"
                    ? "photo.fill"
                    : (presetIcons[palace.skyboxPreset ?? ""] ?? "building.columns"),
                title: palace.name,
                subtitle: palace.description ?? (palace.isVR
                    ? (palace.skyboxType == "uploaded"
                        ? "HDRI Background"
                        : (palace.skyboxPreset?.capitalized ?? "VR Palace"))
                    : "AR Palace"),
                accentColor: palace.isVR ? Brand.primary : .green
            )
        }
        .buttonStyle(.plain)
        .hoverEffectDisabled()
        .contextMenu {
            Button(role: .destructive) {
                palaceToDelete = palace
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }

    // MARK: - Create Palace Sheet

    private var createPalaceSheet: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {

                    // ── Palace Details ────────────────────────────────────
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Palace Details")
                            .font(.headline)
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 4)

                        VStack(spacing: 0) {
                            TextField("Name", text: $newName)
                                .padding(12)
                            Divider().padding(.horizontal, 12)
                            TextField("Description (optional)", text: $newDescription)
                                .padding(12)
                        }
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
                    }

                    // ── Scene Background ──────────────────────────────────
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Scene Background")
                            .font(.headline)
                            .foregroundStyle(.secondary)
                            .padding(.horizontal, 4)

                        if appModel.immersionMode == .ar {
                            Label("AR overlays items onto your real environment. You can optionally pin a reference image below.",
                                  systemImage: "arkit")
                                .font(.callout)
                                .foregroundStyle(.secondary)
                                .padding(12)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
                        }

                        Picker("Background type", selection: $bgPickerTab) {
                            Text("Built-in").tag(0)
                            Text("HDRI Library").tag(1)
                        }
                        .pickerStyle(.segmented)

                        if bgPickerTab == 0 {
                            presetGrid
                        } else {
                            hdriPickerSection
                        }
                    }
                }
                .padding(24)
            }
            .navigationTitle("New Palace")
            // Load first page when user switches to HDRI tab
            .onChange(of: bgPickerTab) { _, tab in
                if tab == 1 && hdriBackgrounds.isEmpty {
                    Task { await loadHDRIBackgrounds(reset: true) }
                }
            }
            // Debounced search: .task(id:) auto-cancels when hdriSearch changes
            .task(id: hdriSearch) {
                guard bgPickerTab == 1 else { return }
                try? await Task.sleep(for: .milliseconds(350))
                guard !Task.isCancelled else { return }
                await loadHDRIBackgrounds(reset: true)
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        showCreateSheet = false
                        resetCreateSheet()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task {
                            let mode = appModel.immersionMode.rawValue.lowercased()
                            if let hdri = selectedHDRI {
                                await palaceVM.createPalace(
                                    name: newName,
                                    description: newDescription.isEmpty ? nil : newDescription,
                                    mode: mode,
                                    skyboxType: "uploaded",
                                    skyboxPreset: nil,
                                    skyboxImageUrl: hdri.thumbnailUrl
                                )
                            } else {
                                await palaceVM.createPalace(
                                    name: newName,
                                    description: newDescription.isEmpty ? nil : newDescription,
                                    mode: mode,
                                    skyboxType: "preset",
                                    skyboxPreset: selectedPreset
                                )
                            }
                            showCreateSheet = false
                            resetCreateSheet()
                        }
                    }
                    .disabled(newName.trimmingCharacters(in: .whitespaces).isEmpty || palaceVM.isLoading)
                }
            }
        }
        .frame(minWidth: 480, minHeight: 580)
    }

    // MARK: - Preset Grid

    private var presetGrid: some View {
        LazyVGrid(columns: [
            GridItem(.flexible()),
            GridItem(.flexible()),
            GridItem(.flexible()),
        ], spacing: 12) {
            ForEach(skyboxPresets, id: \.self) { preset in
                let isSelected = selectedPreset == preset && selectedHDRI == nil
                Button {
                    selectedPreset = preset
                    selectedHDRI = nil
                } label: {
                    VStack(spacing: 6) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 10)
                                .fill(isSelected ? Brand.primary.opacity(0.2) : Color.secondary.opacity(0.1))
                                .frame(height: 60)
                            Image(systemName: presetIcons[preset] ?? "photo")
                                .font(.title2)
                                .foregroundStyle(isSelected ? Brand.primary : .secondary)
                        }
                        .overlay(
                            RoundedRectangle(cornerRadius: 10)
                                .strokeBorder(isSelected ? Brand.primary : Color.clear, lineWidth: 2)
                        )
                        Text(preset.capitalized)
                            .font(.caption)
                            .foregroundStyle(isSelected ? Brand.primary : .secondary)
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - HDRI Picker Section

    private var hdriPickerSection: some View {
        VStack(spacing: 12) {
            // Search field
            HStack {
                Image(systemName: "magnifyingglass")
                    .foregroundStyle(.secondary)
                TextField("Search backgrounds…", text: $hdriSearch)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                if !hdriSearch.isEmpty {
                    Button { hdriSearch = "" } label: {
                        Image(systemName: "xmark.circle.fill")
                            .foregroundStyle(.secondary)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(10)
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10))

            // Grid or state views
            if isLoadingHDRI && hdriBackgrounds.isEmpty {
                HStack {
                    Spacer()
                    VStack(spacing: 10) {
                        ProgressView()
                        Text("Loading backgrounds…")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                    .padding(40)
                    Spacer()
                }
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
            } else if hdriBackgrounds.isEmpty {
                HStack {
                    Spacer()
                    Text("No backgrounds found.")
                        .foregroundStyle(.secondary)
                        .padding(40)
                    Spacer()
                }
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
            } else {
                LazyVGrid(columns: [
                    GridItem(.flexible(), spacing: 10),
                    GridItem(.flexible(), spacing: 10),
                    GridItem(.flexible(), spacing: 10),
                    GridItem(.flexible(), spacing: 10),
                ], spacing: 10) {
                    ForEach(hdriBackgrounds) { bg in
                        hdriThumbnail(bg)
                    }
                }
                .padding(12)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))

                // Load more button
                if hdriBackgrounds.count < hdriTotal {
                    Button {
                        Task {
                            hdriPage += 1
                            await loadHDRIBackgrounds(reset: false)
                        }
                    } label: {
                        HStack {
                            Spacer()
                            if isLoadingHDRI {
                                ProgressView()
                            } else {
                                Label(
                                    "Load more (\(hdriTotal - hdriBackgrounds.count) remaining)",
                                    systemImage: "arrow.down.circle"
                                )
                                .font(.callout)
                            }
                            Spacer()
                        }
                        .padding(10)
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(Brand.primary)
                    .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10))
                }
            }

            // Selected background label
            if let hdri = selectedHDRI {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                    Text("Selected: \(hdri.name.replacingOccurrences(of: "_", with: " ").capitalized)")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10))
            }
        }
    }

    // MARK: - HDRI Thumbnail Cell

    private func hdriThumbnail(_ bg: APIService.VisionProBackground) -> some View {
        let isSelected = selectedHDRI?.id == bg.id
        return Button {
            selectedHDRI = bg
            selectedPreset = "library"
        } label: {
            VStack(spacing: 4) {
                ZStack {
                    RoundedRectangle(cornerRadius: 8)
                        .fill(Color.secondary.opacity(0.15))
                        .aspectRatio(2, contentMode: .fit)

                    if let urlStr = bg.thumbnailUrl, let url = URL(string: urlStr) {
                        AsyncImage(url: url) { phase in
                            switch phase {
                            case .success(let img):
                                img.resizable()
                                    .scaledToFill()
                                    .aspectRatio(2, contentMode: .fit)
                                    .clipShape(RoundedRectangle(cornerRadius: 8))
                            case .failure:
                                Image(systemName: "photo")
                                    .foregroundStyle(.secondary)
                            default:
                                ProgressView().scaleEffect(0.7)
                            }
                        }
                    } else {
                        Image(systemName: "photo.fill")
                            .foregroundStyle(.secondary)
                    }
                }
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .strokeBorder(isSelected ? Brand.primary : Color.clear, lineWidth: 2)
                )

                Text(bg.name.replacingOccurrences(of: "_", with: " ").capitalized)
                    .font(.system(size: 9))
                    .lineLimit(1)
                    .foregroundStyle(isSelected ? Brand.primary : .secondary)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - HDRI Data Loading

    /// Loads backgrounds from the API.
    /// - Parameter reset: true = first page (new search), false = append next page.
    @MainActor
    private func loadHDRIBackgrounds(reset: Bool) async {
        guard !isLoadingHDRI || reset else { return }
        isLoadingHDRI = true
        defer { isLoadingHDRI = false }

        let page = reset ? 1 : hdriPage
        guard let result = try? await APIService.shared.listSceneBackgrounds(
            search: hdriSearch.isEmpty ? nil : hdriSearch,
            page: page,
            pageSize: 20
        ) else { return }

        if reset {
            hdriBackgrounds = result.items
            hdriPage = 1
        } else {
            hdriBackgrounds.append(contentsOf: result.items)
        }
        hdriTotal = result.total
    }

    @MainActor
    private func resetCreateSheet() {
        newName = ""
        newDescription = ""
        selectedPreset = "library"
        selectedHDRI = nil
        bgPickerTab = 0
        hdriBackgrounds = []
        hdriSearch = ""
        hdriPage = 1
        hdriTotal = 0
        isLoadingHDRI = false
    }

    // MARK: - Enter Palace

    private func enterPalace(_ palace: MemoryPalace) async {
        // 1. Touch palace for recent tracking
        guard let updated = await palaceVM.openPalace(palace) else { return }

        // 2. Set palace on AppModel so ImmersiveView can access it
        appModel.currentPalace = updated

        // 3. Set mode to match palace
        appModel.immersionMode = updated.isAR ? .ar : .vr

        // 4. Open immersive space if not already open
        if appModel.immersiveSpaceState == .open {
            appModel.immersiveSpaceState = .inTransition
            await dismissImmersiveSpace()
            try? await Task.sleep(for: .milliseconds(300))
        }

        guard appModel.immersiveSpaceState == .closed else { return }
        appModel.immersiveSpaceState = .inTransition
        let result = await openImmersiveSpace(id: appModel.immersiveSpaceID)
        switch result {
        case .opened:
            // 5. Navigate to PalaceContentView
            enteredPalaceId = updated.id
            showPalaceContent = true
        case .userCancelled, .error:
            fallthrough
        @unknown default:
            appModel.immersiveSpaceState = .closed
            appModel.currentPalace = nil
        }
    }
}
