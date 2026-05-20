import SwiftUI

/// Content view shown in the window while inside an immersive palace.
/// Displays palace items list and provides exit functionality.
struct PalaceContentView: View {

    @Environment(AppModel.self) private var appModel
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace
    @Environment(\.dismiss) private var dismiss

    @State private var palaceVM = PalaceViewModel()

    let palaceId: String

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Palace info header
                if let palace = appModel.currentPalace {
                    palaceHeader(palace)
                }

                // Exit button
                Button(role: .destructive) {
                    Task { await exitPalace() }
                } label: {
                    Label("Exit Palace", systemImage: "xmark.circle.fill")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding()
                }
                .buttonStyle(.bordered)
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
        .navigationBarBackButtonHidden(true)
        .withAppToolbar(title: appModel.currentPalace?.name ?? "Palace")
        .task {
            if let palace = appModel.currentPalace {
                palaceVM.currentPalace = palace
                await palaceVM.loadItems()
            }
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
                Text("\(palace.mode.uppercased()) Mode  •  \(palaceVM.items.count) items")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            Spacer()
        }
        .padding(16)
        .background(Brand.primary.opacity(0.08))
        .clipShape(RoundedRectangle(cornerRadius: 8))
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

                Button(role: .destructive) {
                    Task { await palaceVM.removeItem(itemId: item.id) }
                } label: {
                    Image(systemName: "trash")
                        .foregroundStyle(.red)
                        .font(.body)
                }
                .buttonStyle(.plain)
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
        // 1. Close immersive space
        if appModel.immersiveSpaceState == .open {
            appModel.immersiveSpaceState = .inTransition
            await dismissImmersiveSpace()
        }
        // 2. Clear palace state
        appModel.currentPalace = nil
        palaceVM.exitPalace()
        // 3. Navigate back
        dismiss()
    }
}
