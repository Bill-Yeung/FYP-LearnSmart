import SwiftUI

struct PalaceItemDetailWindow: View {
    @Environment(AppModel.self) private var appModel
    @Environment(\.dismiss) private var dismiss

    @State private var item: PalaceItem?
    @State private var name: String = ""
    @State private var memoryText: String = ""
    @State private var isLoading = false
    @State private var isSaving = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 0) {
            header
            Divider()
            content
        }
        .frame(minWidth: 420, minHeight: 420)
        .task(id: appModel.selectedPalaceItemId) {
            await loadItem()
        }
    }

    private var header: some View {
        HStack(spacing: 12) {
            Image(systemName: iconName)
                .font(.title3)
                .foregroundStyle(Brand.primary)

            VStack(alignment: .leading, spacing: 2) {
                Text(item?.label ?? "Item")
                    .font(.headline)
                    .lineLimit(1)
                Text(item?.displayType ?? "Palace object")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            Button {
                appModel.selectedPalaceItemId = nil
                dismiss()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title3)
                    .foregroundStyle(.secondary)
            }
            .buttonStyle(.plain)
        }
        .padding(16)
    }

    @ViewBuilder
    private var content: some View {
        if isLoading {
            Spacer()
            ProgressView("Loading item...")
            Spacer()
        } else if item == nil {
            ContentUnavailableView(
                "No Item Selected",
                systemImage: "cube.transparent",
                description: Text("Tap an object tag in the palace to inspect it here.")
            )
        } else {
            Form {
                Section("Object") {
                    TextField("Object name", text: $name)
                        .textInputAutocapitalization(.words)

                    if let item {
                        LabeledContent("Type", value: item.displayType)
                        if let assetId = item.assetId {
                            LabeledContent("Asset", value: assetId)
                        }
                    }
                }

                Section("Memory") {
                    TextEditor(text: $memoryText)
                        .frame(minHeight: 120)
                        .scrollContentBackground(.hidden)
                }

                if let item, item.nextReviewAt != nil {
                    Section("Review") {
                        HStack(spacing: 10) {
                            reviewButton(quality: 0, label: "Again", color: .red)
                            reviewButton(quality: 1, label: "Hard", color: .orange)
                            reviewButton(quality: 3, label: "Good", color: .green)
                            reviewButton(quality: 5, label: "Easy", color: .blue)
                        }
                    }
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button {
                        Task { await saveChanges() }
                    } label: {
                        Label(isSaving ? "Saving..." : "Save Changes", systemImage: "square.and.arrow.down")
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(isSaving || name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                    Button(role: .destructive) {
                        Task { await deleteItem() }
                    } label: {
                        Label("Remove From Palace", systemImage: "trash")
                            .frame(maxWidth: .infinity)
                    }
                    .disabled(isSaving)
                }
            }
        }
    }

    private func reviewButton(quality: Int, label: String, color: Color) -> some View {
        Button {
            Task { await submitReview(quality: quality) }
        } label: {
            Text(label)
                .font(.caption)
                .fontWeight(.semibold)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
        }
        .buttonStyle(.borderedProminent)
        .tint(color)
        .disabled(isSaving)
    }

    @MainActor
    private func loadItem() async {
        guard let palace = appModel.currentPalace,
              let itemId = appModel.selectedPalaceItemId else {
            item = nil
            return
        }

        isLoading = true
        errorMessage = nil
        defer { isLoading = false }

        do {
            let items = try await APIService.shared.getPalaceItems(palaceId: palace.id)
            guard let loaded = items.first(where: { $0.id == itemId }) else {
                item = nil
                errorMessage = "This item is no longer in the palace."
                return
            }
            item = loaded
            name = loaded.label ?? ""
            memoryText = loaded.customText ?? ""
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func saveChanges() async {
        guard let palace = appModel.currentPalace,
              let item else { return }

        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }

        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            let updated: PalaceItem
            if memoryText != (item.customText ?? "") {
                updated = try await APIService.shared.updateItemMemoryText(
                    palaceId: palace.id,
                    itemId: item.id,
                    customText: memoryText,
                    label: trimmedName
                )
            } else {
                updated = try await APIService.shared.updateItemLabel(
                    palaceId: palace.id,
                    itemId: item.id,
                    label: trimmedName
                )
            }
            self.item = updated
            name = updated.label ?? trimmedName
            memoryText = updated.customText ?? ""
            appModel.palaceItemRefreshTrigger += 1
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func submitReview(quality: Int) async {
        guard let palace = appModel.currentPalace,
              let item else { return }

        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            try await APIService.shared.submitReview(palaceId: palace.id, itemId: item.id, quality: quality)
            appModel.palaceItemRefreshTrigger += 1
            await loadItem()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    @MainActor
    private func deleteItem() async {
        guard let palace = appModel.currentPalace,
              let item else { return }

        isSaving = true
        errorMessage = nil
        defer { isSaving = false }

        do {
            try await APIService.shared.deleteItem(palaceId: palace.id, itemId: item.id)
            appModel.palaceItemRefreshTrigger += 1
            appModel.selectedPalaceItemId = nil
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private var iconName: String {
        switch item?.displayType {
        case "3d_model": return "cube"
        case "text_panel": return "text.alignleft"
        default: return "rectangle.portrait"
        }
    }
}
