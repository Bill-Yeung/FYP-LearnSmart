import SwiftUI

/// Floating panel to capture user memory text that links object, scene, and recall content.
/// Issue 20: made shorter and draggable.
struct MemoryNotePanel: View {

    let item: PalaceItem
    var errorMessage: String?
    var onSave: (ObjectSceneMemoryNote) -> Void
    var onClose: (() -> Void)?

    @State private var note: ObjectSceneMemoryNote
    @State private var dragOffset: CGSize = .zero

    init(
        item: PalaceItem,
        errorMessage: String? = nil,
        onSave: @escaping (ObjectSceneMemoryNote) -> Void,
        onClose: (() -> Void)? = nil
    ) {
        self.item = item
        self.errorMessage = errorMessage
        self.onSave = onSave
        self.onClose = onClose
        _note = State(initialValue: ObjectSceneMemoryNote.from(customText: item.customText, fallbackObjectName: nil))
    }

    var body: some View {
        VStack(spacing: 0) {
            // Drag handle + header
            HStack(spacing: 10) {
                Image(systemName: "line.3.horizontal")
                    .foregroundStyle(.tertiary)
                    .font(.caption)

                Image(systemName: "text.bubble")
                    .foregroundStyle(.blue)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Memory Note")
                        .font(.subheadline)
                        .fontWeight(.semibold)
                    Text(item.label ?? "Object")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer()
                Button { onClose?() } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                        .font(.body)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .contentShape(Rectangle())
            // Issue 20: drag to move the panel
            .gesture(
                DragGesture()
                    .onChanged { dragOffset = $0.translation }
            )

            Divider()

            VStack(spacing: 8) {
                TextField("Object name", text: $note.objectName)
                    .font(.callout)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(Color.white.opacity(0.95))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .colorScheme(.light)

                TextField("Scene context (e.g. museum hall)", text: $note.sceneContext)
                    .font(.callout)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(Color.white.opacity(0.95))
                    .clipShape(RoundedRectangle(cornerRadius: 10))
                    .colorScheme(.light)

                VStack(alignment: .leading, spacing: 4) {
                    Text("What should you remember?")
                        .font(.caption)
                        .foregroundStyle(.white.opacity(0.85))
                    // Issue 20: shorter editor — 60pt min instead of 110pt
                    TextEditor(text: $note.rememberContent)
                        .frame(minHeight: 60, maxHeight: 80)
                        .font(.callout)
                        .scrollContentBackground(.hidden)
                        .padding(6)
                        .background(Color.white.opacity(0.95))
                        .clipShape(RoundedRectangle(cornerRadius: 10))
                        .colorScheme(.light)
                }

                if let errorMessage, !errorMessage.isEmpty {
                    Text(errorMessage)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }

                Button {
                    onSave(note)
                } label: {
                    Label("Save", systemImage: "square.and.arrow.down")
                        .frame(maxWidth: .infinity)
                        .font(.callout)
                }
                .buttonStyle(.borderedProminent)
                .disabled(!note.isMeaningful)
            }
            .padding(12)
        }
        .frame(width: 360)
        .glassBackground()
        .offset(dragOffset)
    }
}
