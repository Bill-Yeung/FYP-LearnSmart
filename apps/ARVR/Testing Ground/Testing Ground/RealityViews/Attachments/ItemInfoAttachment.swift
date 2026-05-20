import SwiftUI

/// SwiftUI attachment that appears above a 3D entity in the palace.
/// Shows item label on idle; expands to an in-scene editor near the object.
struct ItemInfoAttachment: View {

    let item: PalaceItem
    @Binding var isExpanded: Bool
    var aiContextText: String = ""
    var onTap: (() -> Void)?
    var onSave: ((String, String) -> Void)?
    var onReview: ((Int) -> Void)?
    var onDelete: (() -> Void)?

    @State private var name: String
    @State private var memoryText: String
    @State private var isEditing = false
    @State private var showsAI = false
    @GestureState private var dragOffset: CGSize = .zero
    @State private var savedOffset: CGSize = .zero

    init(
        item: PalaceItem,
        isExpanded: Binding<Bool>,
        aiContextText: String = "",
        onTap: (() -> Void)? = nil,
        onSave: ((String, String) -> Void)? = nil,
        onReview: ((Int) -> Void)? = nil,
        onDelete: (() -> Void)? = nil
    ) {
        self.item = item
        self._isExpanded = isExpanded
        self.aiContextText = aiContextText
        self.onTap = onTap
        self.onSave = onSave
        self.onReview = onReview
        self.onDelete = onDelete
        self._name = State(initialValue: item.label ?? "")
        self._memoryText = State(initialValue: item.customText ?? "")
    }

    var body: some View {
        Group {
            if isExpanded {
                expandedView
                    .offset(x: savedOffset.width + dragOffset.width,
                            y: savedOffset.height + dragOffset.height)
            } else {
                compactView
            }
        }
        .animation(.spring(duration: 0.25), value: isExpanded)
        .onChange(of: item.id) { _, _ in resetFields() }
        .onChange(of: item.label) { _, _ in resetFields() }
        .onChange(of: item.customText) { _, _ in resetFields() }
    }

    private var compactView: some View {
        Button {
            isExpanded = true
            onTap?()
        } label: {
            HStack(spacing: 8) {
                if item.flashcardId == nil {
                    Image(systemName: displayTypeIcon)
                        .font(.body)
                        .foregroundStyle(.blue)
                }
                Text(item.label ?? "Item")
                    .font(.body)
                    .fontWeight(.semibold)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
        }
        .buttonStyle(.plain)
        .palaceAttachmentBackground()
    }

    private var expandedView: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(spacing: 12) {
                header

                if isEditing {
                    editorContent
                } else {
                    readContent
                }

                HStack(spacing: 8) {
                    if isEditing {
                        Button {
                            onSave?(name, memoryText)
                            isEditing = false
                        } label: {
                            Label("Save", systemImage: "square.and.arrow.down")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                        Button {
                            resetFields()
                            isEditing = false
                        } label: {
                            Text("Cancel")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.bordered)
                    } else {
                        Button {
                            isEditing = true
                        } label: {
                            Label("Edit", systemImage: "pencil")
                                .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                    }

                    Button {
                        showsAI.toggle()
                    } label: {
                        Label("Ask AI", systemImage: "sparkles")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.bordered)
                    .tint(.purple)
                }

                if let onReview, item.flashcardId != nil {
                    Divider()
                    Text("Review attached flashcard")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    HStack(spacing: 8) {
                        reviewButton(quality: 0, label: "Again", color: .red, action: onReview)
                        reviewButton(quality: 1, label: "Hard", color: .orange, action: onReview)
                        reviewButton(quality: 3, label: "Good", color: .green, action: onReview)
                        reviewButton(quality: 5, label: "Easy", color: .blue, action: onReview)
                    }
                }
            }
            .padding(14)
            .frame(width: 360)
            .palaceAttachmentBackground()

            if showsAI {
                AIHelperPanel(
                    modelName: item.label ?? item.assetId ?? "Object",
                    contextText: aiContextText,
                    onClose: { showsAI = false }
                )
                .transition(.opacity.combined(with: .move(edge: .leading)))
            }
        }
    }

    private var readContent: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(item.label ?? "Item")
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .leading)

            if let text = item.customText, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                ScrollView {
                    Text(text)
                        .font(.callout)
                        .foregroundStyle(.primary)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxHeight: 120)
            } else {
                Text("No memory text yet.")
                    .font(.callout)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var editorContent: some View {
        VStack(alignment: .leading, spacing: 8) {
            TextField("Object name", text: $name)
                .font(.callout)
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(Color.white.opacity(0.92))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .colorScheme(.light)

            TextEditor(text: $memoryText)
                .frame(minHeight: 72, maxHeight: 110)
                .font(.callout)
                .scrollContentBackground(.hidden)
                .padding(6)
                .background(Color.white.opacity(0.92))
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .colorScheme(.light)
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            Image(systemName: "line.3.horizontal")
                .foregroundStyle(.tertiary)
                .font(.caption)

            if item.flashcardId == nil {
                Image(systemName: displayTypeIcon)
                    .foregroundStyle(Brand.primary)
            }

            Text(item.label ?? "Item")
                .font(.headline)
                .lineLimit(1)

            Spacer()

            if let onDelete {
                Button(role: .destructive, action: onDelete) {
                    Image(systemName: "trash.circle.fill")
                        .foregroundStyle(.red)
                        .font(.title3)
                }
                .buttonStyle(.plain)
            }

            Button {
                isExpanded = false
                isEditing = false
                showsAI = false
                savedOffset = .zero
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .foregroundStyle(.secondary)
                    .font(.title3)
            }
            .buttonStyle(.plain)
        }
        .contentShape(Rectangle())
        .gesture(
            DragGesture()
                .updating($dragOffset) { value, state, _ in
                    state = value.translation
                }
                .onEnded { value in
                    savedOffset = CGSize(
                        width: savedOffset.width + value.translation.width,
                        height: savedOffset.height + value.translation.height
                    )
                }
        )
    }

    private func reviewButton(quality: Int, label: String, color: Color, action: @escaping (Int) -> Void) -> some View {
        Button {
            action(quality)
        } label: {
            Text(label)
                .font(.caption)
                .fontWeight(.semibold)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
        }
        .buttonStyle(.borderedProminent)
        .tint(color)
    }

    private func resetFields() {
        name = item.label ?? ""
        memoryText = item.customText ?? ""
        isEditing = false
        showsAI = false
    }

    private var displayTypeIcon: String {
        switch item.displayType {
        case "3d_model": return "cube"
        case "text_panel": return "text.alignleft"
        default: return "rectangle.portrait"
        }
    }
}
