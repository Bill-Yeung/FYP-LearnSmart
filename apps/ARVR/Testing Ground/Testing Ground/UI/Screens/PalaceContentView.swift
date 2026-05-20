import SwiftUI

/// Content view shown in the window while inside an immersive palace.
/// Displays palace items list and provides exit functionality.
struct PalaceContentView: View {

    @Environment(AppModel.self) private var appModel
    #if os(visionOS)
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace
    @Environment(\.openWindow) private var openWindow
    @Environment(\.dismissWindow) private var dismissWindow
    #endif
    @Environment(\.dismiss) private var dismiss

    @State private var palaceVM = PalaceViewModel()

    // Issue 3: separate sheet state per button
    @State private var showModels = false
    @State private var showConcepts = false
    @State private var showFlashcards = false
    @State private var showScenes = false
    @State private var showAISuggest = false

    // Issue 1: edit palace name/description
    @State private var showEditPalace = false
    @State private var editName = ""
    @State private var editDescription = ""
    @State private var isSavingEdit = false

    let palaceId: String

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Palace info header
                if let palace = appModel.currentPalace {
                    palaceHeader(palace)
                }

                // Issue 22: workflow mode picker
                Picker("Workflow Mode", selection: Binding(
                    get: { appModel.palaceWorkflowMode },
                    set: { appModel.palaceWorkflowMode = $0 }
                )) {
                    ForEach(AppModel.WorkflowMode.allCases) { mode in
                        Text(mode.rawValue).tag(mode)
                    }
                }
                .pickerStyle(.segmented)

                // Add Items Buttons — issues 3, 4, 22
                if appModel.palaceWorkflowMode == .selfConstruct {
                    LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                        Button {
                            #if os(visionOS)
                            openWindow(id: AppModel.LibraryWindowID.models)
                            #else
                            showModels = true
                            #endif
                        } label: {
                            Label("Models", systemImage: "cube")
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                                .padding()
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Brand.primary)

                        Button {
                            #if os(visionOS)
                            openWindow(id: AppModel.LibraryWindowID.concepts)
                            #else
                            showConcepts = true
                            #endif
                        } label: {
                            Label("Concepts", systemImage: "lightbulb")
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                                .padding()
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.orange)

                        Button {
                            #if os(visionOS)
                            openWindow(id: AppModel.LibraryWindowID.flashcards)
                            #else
                            showFlashcards = true
                            #endif
                        } label: {
                            Label("Flashcards", systemImage: "rectangle.on.rectangle")
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                                .padding()
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.indigo)

                        // Issue 4: reduced brightness — use secondary/muted teal
                        Button {
                            #if os(visionOS)
                            openWindow(id: AppModel.LibraryWindowID.scenes)
                            #else
                            showScenes = true
                            #endif
                        } label: {
                            Label("Scenes", systemImage: "photo.on.rectangle")
                                .fontWeight(.semibold)
                                .frame(maxWidth: .infinity)
                                .padding()
                        }
                        .buttonStyle(.bordered)
                        .tint(.teal)
                    }
                } else {
                    Button {
                        showAISuggest = true
                    } label: {
                        Label("Generate Palace with AI", systemImage: "sparkles")
                            .fontWeight(.semibold)
                            .frame(maxWidth: .infinity)
                            .padding()
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.purple)
                    .disabled(appModel.currentPalace == nil)
                }

                // Issue 13: active scene indicator
                if appModel.activeScenePreset != nil || appModel.activeSceneURL != nil {
                    HStack(spacing: 6) {
                        Image(systemName: "photo.on.rectangle")
                            .font(.caption)
                            .foregroundStyle(.teal)
                        Text("Scene: \(appModel.activeScenePreset?.capitalized ?? "Custom")")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }

                // Issue 5: Exit button — use borderedProminent with red for strong contrast
                Button(role: .destructive) {
                    Task { await exitPalace() }
                } label: {
                    Label("Exit Palace", systemImage: "xmark.circle.fill")
                        .fontWeight(.bold)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                }
                .buttonStyle(.borderedProminent)
                .tint(.red)

                Divider()

                // Items in palace
                if palaceVM.isLoading {
                    ProgressView("Loading items...")
                        .padding(.top, 20)
                } else if palaceVM.items.isEmpty {
                    ContentUnavailableView(
                        "No Items Placed",
                        systemImage: "cube.transparent",
                        description: Text("Items placed in the immersive space will appear here.")
                    )
                } else {
                    Text("\(palaceVM.items.count) Items")
                        .font(.title3)
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    LazyVStack(spacing: 12) {
                        ForEach(palaceVM.items) { item in
                            itemRow(item)
                        }
                    }
                }
            }
            .padding(.horizontal, 40)
            .padding(.vertical, 24)
        }
        .navigationTitle(appModel.currentPalace?.name ?? "Palace")
        .navigationBarBackButtonHidden(true)
        // Issue 3: fallback sheets for non-visionOS builds
        .sheet(isPresented: $showModels) {
            ObjectLibraryView(initialTab: .models, lockedMode: .models, showsTabs: false, title: "Models")
                .onDisappear { Task { await palaceVM.loadItems() } }
        }
        .sheet(isPresented: $showConcepts) {
            ObjectLibraryView(initialTab: .concepts, lockedMode: .concepts, showsTabs: false, title: "Concepts")
                .onDisappear { Task { await palaceVM.loadItems() } }
        }
        .sheet(isPresented: $showFlashcards) {
            ObjectLibraryView(initialTab: .flashcards, lockedMode: .flashcards, showsTabs: false, title: "Flashcards")
                .onDisappear { Task { await palaceVM.loadItems() } }
        }
        .sheet(isPresented: $showScenes) {
            ObjectLibraryView(initialTab: .scenes, lockedMode: .scenes, showsTabs: false, title: "Scenes")
                .onDisappear { Task { await palaceVM.loadItems() } }
        }
        // Issue 1: edit palace sheet
        .sheet(isPresented: $showEditPalace) {
            editPalaceSheet
        }
        // Issue 22: AI-suggest mode
        .sheet(isPresented: $showAISuggest) {
            if let palace = appModel.currentPalace {
                AISuggestView(palace: palace) {
                    appModel.palaceItemRefreshTrigger += 1
                    Task { await palaceVM.loadItems() }
                }
            }
        }
        .task {
            if let palace = appModel.currentPalace {
                palaceVM.currentPalace = palace
                await palaceVM.loadItems()
            }
        }
        .onChange(of: appModel.palaceItemRefreshTrigger) { _, _ in
            Task { await palaceVM.loadItems() }
        }
    }

    // MARK: - Subviews

    private func palaceHeader(_ palace: MemoryPalace) -> some View {
        HStack(spacing: 12) {
            Image(systemName: palace.isVR ? "visionpro.fill" : "arkit")
                .font(.title2)
                .foregroundStyle(Brand.primary)
            VStack(alignment: .leading, spacing: 4) {
                Text(palace.name)
                    .font(.title3)
                    .fontWeight(.semibold)
                if let desc = palace.description {
                    Text(desc)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                // Issue 2: removed deep link URI — replaced with mode/count only
                Text("\(palace.mode.uppercased()) Mode  •  \(palaceVM.items.count) items")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            Spacer()
            // Issue 1: edit button
            Button {
                editName = palace.name
                editDescription = palace.description ?? ""
                showEditPalace = true
            } label: {
                Image(systemName: "pencil.circle")
                    .font(.title2)
                    .foregroundStyle(Brand.primary)
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .background(Brand.primary.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    // Issue 1: edit palace sheet
    private var editPalaceSheet: some View {
        NavigationStack {
            Form {
                Section("Palace Name") {
                    TextField("Name", text: $editName)
                }
                Section("Description") {
                    TextField("Description (optional)", text: $editDescription, axis: .vertical)
                        .lineLimit(2...4)
                }
            }
            .navigationTitle("Edit Palace")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showEditPalace = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task { await savePalaceEdit() }
                    }
                    .disabled(editName.trimmingCharacters(in: .whitespaces).isEmpty || isSavingEdit)
                }
            }
            .overlay {
                if isSavingEdit { ProgressView() }
            }
        }
    }

    private func savePalaceEdit() async {
        guard let palace = appModel.currentPalace else { return }
        isSavingEdit = true
        let trimmedName = editName.trimmingCharacters(in: .whitespaces)
        let trimmedDesc = editDescription.trimmingCharacters(in: .whitespaces)
        do {
            let updated = try await APIService.shared.updatePalace(
                id: palace.id,
                name: trimmedName,
                description: trimmedDesc.isEmpty ? nil : trimmedDesc
            )
            appModel.currentPalace = updated
        } catch {
            // silently keep existing values on failure
        }
        isSavingEdit = false
        showEditPalace = false
    }

    private func itemRow(_ item: PalaceItem) -> some View {
        DisclosureGroup {
            if let text = item.customText, !text.isEmpty {
                Text(text)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 4)
            }
        } label: {
            HStack(spacing: 12) {
                Image(systemName: displayTypeIcon(item.displayType))
                    .font(.title3)
                    .foregroundStyle(Brand.primary)
                    .frame(width: 40, height: 40)

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.label ?? "Item")
                        .font(.headline)
                    if let text = item.customText {
                        Text(text)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }

                Spacer()

                if let nextReview = item.nextReviewAt, nextReview < Date() {
                    Image(systemName: "exclamationmark.circle.fill")
                        .foregroundStyle(.orange)
                        .font(.caption)
                }
            }
        }
        .padding(12)
        .background(Color.white.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func displayTypeIcon(_ type: String) -> String {
        switch type {
        case "3d_model": return "cube"
        case "text_panel": return "text.alignleft"
        default: return "rectangle.portrait"
        }
    }

    // MARK: - Exit

    private func exitPalace() async {
        if appModel.immersiveSpaceState == .open || appModel.immersiveSpaceState == .inTransition {
            appModel.immersiveSpaceState = .inTransition
            #if os(visionOS)
            await dismissImmersiveSpace()
            #endif
            appModel.immersiveSpaceState = .closed
        }
        closePalaceWindows()
        appModel.clearPalaceSession()
        palaceVM.exitPalace()
        dismiss()
    }

    private func closePalaceWindows() {
        #if os(visionOS)
        dismissWindow(id: AppModel.LibraryWindowID.models)
        dismissWindow(id: AppModel.LibraryWindowID.concepts)
        dismissWindow(id: AppModel.LibraryWindowID.flashcards)
        dismissWindow(id: AppModel.LibraryWindowID.scenes)
        dismissWindow(id: AppModel.ItemWindowID.detail)
        #endif
    }
}
