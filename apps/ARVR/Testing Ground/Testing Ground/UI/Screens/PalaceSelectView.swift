import SwiftUI

struct PalaceSelectView: View {

    @Environment(AppModel.self) private var appModel
    #if os(visionOS)
    @Environment(\.openImmersiveSpace) private var openImmersiveSpace
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace
    #endif

    @State private var palaceVM = PalaceViewModel()
    @State private var showCreateSheet = false
    @State private var newName = ""
    @State private var newDescription = ""
    @State private var selectedPreset = "library"
    @State private var palaceToDelete: MemoryPalace?
    @State private var palaceToEnter: MemoryPalace?
    @State private var showPalaceContent = false
    @State private var enteredPalaceId = ""
    @State private var immersiveError: String? = nil

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
        palaceList
            .navigationTitle("Memory Palaces")
            .navigationDestination(isPresented: $showPalaceContent) {
                PalaceContentView(palaceId: enteredPalaceId)
            }
            .task { await loadOnAppear() }
            .onChange(of: appModel.deepLinkPalaceId) { _, newValue in handleDeepLinkChange(newValue) }
            .onChange(of: appModel.immersionMode) { _, newMode in
                Task { await palaceVM.loadPalaces(mode: newMode.rawValue.lowercased()) }
            }
            .sheet(isPresented: $showCreateSheet) { createPalaceSheet }
            .confirmationDialog("Enter Palace?",
                isPresented: .init(get: { palaceToEnter != nil }, set: { if !$0 { palaceToEnter = nil } }),
                presenting: palaceToEnter
            ) { palace in
                Button("Enter \(palace.name)") { Task { await enterPalace(palace) } }
                Button("Cancel", role: .cancel) { palaceToEnter = nil }
            } message: { palace in
                Text("Open \(palace.name) in \(palace.mode.uppercased()) mode?")
            }
            .alert("Delete Palace?",
                isPresented: .init(get: { palaceToDelete != nil }, set: { if !$0 { palaceToDelete = nil } })
            ) {
                Button("Delete", role: .destructive) {
                    if let palace = palaceToDelete { Task { await palaceVM.deletePalace(palace) } }
                }
                Button("Cancel", role: .cancel) { palaceToDelete = nil }
            } message: {
                Text("This will remove the palace and all its items.")
            }
            .alert("Error",
                isPresented: .init(get: { palaceVM.errorMessage != nil }, set: { if !$0 { palaceVM.errorMessage = nil } })
            ) {
                Button("OK") { palaceVM.errorMessage = nil }
            } message: {
                Text(palaceVM.errorMessage ?? "")
            }
            .alert("Immersive Space Error",
                isPresented: .init(get: { immersiveError != nil }, set: { if !$0 { immersiveError = nil } })
            ) {
                Button("OK") { immersiveError = nil }
            } message: {
                Text(immersiveError ?? "")
            }
    }

    private var palaceList: some View {
        ScrollView {
            VStack(spacing: 20) {
                modeIndicator
                createButton
                palaceListContent
            }
            .padding(.horizontal, 40)
            .padding(.vertical, 24)
        }
    }

    private var createButton: some View {
        Button { showCreateSheet = true } label: {
            Label("Create New Palace", systemImage: "plus.circle.fill")
                .fontWeight(.medium)
                .frame(maxWidth: .infinity)
                .padding()
                .background(Brand.primary.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 8))
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private var palaceListContent: some View {
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
            palaceGrid
        }
    }

    @ViewBuilder
    private var palaceGrid: some View {
        if !recentPalaces.isEmpty {
            sectionHeader("Recent")
            LazyVGrid(columns: gridColumns, spacing: 12) {
                ForEach(recentPalaces) { palace in palaceCard(palace) }
            }
        }
        sectionHeader("All Palaces")
        LazyVGrid(columns: gridColumns, spacing: 12) {
            ForEach(palaceVM.palaces) { palace in palaceCard(palace) }
        }
    }

    private func loadOnAppear() async {
        await palaceVM.seedDemoIfNeeded()
        let mode = appModel.immersionMode.rawValue.lowercased()
        await palaceVM.loadPalaces(mode: mode)
        if let id = appModel.deepLinkPalaceId,
           let palace = palaceVM.palaces.first(where: { $0.id == id }) {
            appModel.deepLinkPalaceId = nil
            await enterPalace(palace)
        }
    }

    // MARK: - Subviews

    private var modeIndicator: some View {
        HStack(spacing: 10) {
            Image(systemName: "visionpro.fill")
                .font(.title3)
                .foregroundStyle(Brand.primary)
            VStack(alignment: .leading, spacing: 2) {
                Text("VR Mode")
                    .font(.headline)
                Text("Full immersive skybox environment")
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
        ActionCard(
            title: palace.name,
            subtitle: palace.description ?? (palace.isVR
                ? (palace.skyboxPreset?.capitalized ?? "VR Palace")
                : "AR Palace"),
            systemImage: presetIcons[palace.skyboxPreset ?? ""] ?? "building.columns",
            prominence: .secondary,
            tint: palace.isVR ? Brand.primary : .green,
            action: { palaceToEnter = palace }
        )
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
            Form {
                Section("Palace Details") {
                    TextField("Name", text: $newName)
                    TextField("Description (optional)", text: $newDescription)
                }
                if appModel.immersionMode == .vr {
                    Section("Skybox Environment") {
                        LazyVGrid(columns: [
                            GridItem(.flexible()),
                            GridItem(.flexible()),
                            GridItem(.flexible()),
                        ], spacing: 12) {
                            ForEach(skyboxPresets, id: \.self) { preset in
                                Button {
                                    selectedPreset = preset
                                } label: {
                                    VStack(spacing: 6) {
                                        ZStack {
                                            RoundedRectangle(cornerRadius: 10)
                                                .fill(selectedPreset == preset
                                                      ? Brand.primary.opacity(0.2)
                                                      : Color.clear)
                                                .frame(height: 60)
                                            Image(systemName: presetIcons[preset] ?? "photo")
                                                .font(.title2)
                                                .foregroundStyle(selectedPreset == preset
                                                                 ? Brand.primary
                                                                 : .secondary)
                                        }
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 10)
                                                .strokeBorder(selectedPreset == preset
                                                              ? Brand.primary
                                                              : Color.clear,
                                                              lineWidth: 2)
                                        )
                                        Text(preset.capitalized)
                                            .font(.caption)
                                            .foregroundStyle(selectedPreset == preset
                                                             ? Brand.primary
                                                             : .secondary)
                                    }
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                } else {
                    Section {
                        Label("AR palaces use your real environment as the backdrop.",
                              systemImage: "arkit")
                            .font(.callout)
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("New Palace")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showCreateSheet = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task {
                            let mode = appModel.immersionMode.rawValue.lowercased()
                            await palaceVM.createPalace(
                                name: newName,
                                description: newDescription.isEmpty ? nil : newDescription,
                                mode: mode,
                                skyboxType: appModel.immersionMode == .vr ? "preset" : "preset",
                                skyboxPreset: appModel.immersionMode == .vr ? selectedPreset : nil
                            )
                            showCreateSheet = false
                            newName = ""
                            newDescription = ""
                        }
                    }
                    .disabled(newName.isEmpty)
                }
            }
        }
        .frame(minWidth: 400, minHeight: 500)
    }

    // MARK: - Deep Link

    private func handleDeepLinkChange(_ id: String?) {
        guard let id else { return }
        let palaces = palaceVM.palaces
        let match = palaces.first { $0.id == id }
        guard let palace = match else { return }
        appModel.deepLinkPalaceId = nil
        Task { await enterPalace(palace) }
    }

    // MARK: - Enter Palace

    private func enterPalace(_ palace: MemoryPalace) async {
        // 1. Touch palace for recent tracking — fall back to the original palace if API is unreachable
        let updated = await palaceVM.openPalace(palace) ?? palace

        // 2. Set palace on AppModel so ImmersiveView can access it
        appModel.currentPalace = updated

        // 3. Set mode to match palace
        appModel.immersionMode = updated.isAR ? .ar : .vr

        // 4. Close existing immersive space if open
        if appModel.immersiveSpaceState == .open {
            appModel.immersiveSpaceState = .inTransition
            #if os(visionOS)
            await dismissImmersiveSpace()
            #endif
            try? await Task.sleep(for: .milliseconds(300))
        }

        guard appModel.immersiveSpaceState == .closed else { return }
        appModel.immersiveSpaceState = .inTransition

        #if os(visionOS)
        let result = await openImmersiveSpace(id: appModel.immersiveSpaceID)
        switch result {
        case .opened:
            appModel.immersiveSpaceState = .open
            enteredPalaceId = updated.id
            showPalaceContent = true
        case .userCancelled:
            appModel.immersiveSpaceState = .closed
            appModel.currentPalace = nil
        case .error:
            appModel.immersiveSpaceState = .closed
            appModel.currentPalace = nil
            immersiveError = "Failed to open immersive space. Make sure no other immersive app is running."
        @unknown default:
            appModel.immersiveSpaceState = .closed
            appModel.currentPalace = nil
        }
        #else
        appModel.immersiveSpaceState = .open
        enteredPalaceId = updated.id
        showPalaceContent = true
        #endif
    }
}

