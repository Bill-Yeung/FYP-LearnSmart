import SwiftUI

/// SwiftUI attachment that appears above a 3D entity in the palace.
/// Shows item label on idle; expands to review card on tap.
struct ItemInfoAttachment: View {

    let item: PalaceItem
    @Binding var isExpanded: Bool
    var onTap: (() -> Void)?
    var onReview: ((Int) -> Void)?

    @GestureState private var dragOffset: CGSize = .zero
    @State private var savedOffset: CGSize = .zero

    var body: some View {
        VStack(spacing: 8) {
            if isExpanded {
                expandedView
                    .offset(x: savedOffset.width + dragOffset.width,
                            y: savedOffset.height + dragOffset.height)
            } else {
                compactView
            }
        }
        .animation(.spring(duration: 0.3), value: isExpanded)
    }

    // MARK: - Compact (label only)

    private var compactView: some View {
        Button {
            isExpanded = true
            onTap?()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: displayTypeIcon)
                    .font(.body)
                    .foregroundStyle(.blue)
                Text(item.label ?? "Item")
                    .font(.body)
                    .fontWeight(.semibold)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
        }
        .buttonStyle(.plain)
        .glassBackgroundEffect()
    }

    // MARK: - Expanded (review card)

    private var expandedView: some View {
        VStack(spacing: 12) {
            // Draggable header — drag anywhere on it to move the panel (#18)
            HStack {
                Image(systemName: displayTypeIcon)
                    .foregroundStyle(Brand.primary)
                Text(item.label ?? "Review Item")
                    .font(.headline)
                Spacer()
                Image(systemName: "line.3.horizontal")
                    .foregroundStyle(.tertiary)
                    .padding(.trailing, 4)
                Button {
                    isExpanded = false
                    savedOffset = .zero
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
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

            // Content
            if let text = item.customText {
                ScrollView {
                    Text(text)
                        .font(.body)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .frame(maxHeight: 200)
            }

            // Review due indicator
            if let nextReview = item.nextReviewAt {
                HStack {
                    Image(systemName: "clock")
                    Text(nextReview < Date() ? "Review overdue" : "Next review: \(nextReview, style: .relative)")
                        .font(.caption)
                }
                .foregroundStyle(nextReview < Date() ? .red : .secondary)
            }

            // Review buttons
            if let onReview {
                Divider()
                Text("Rate your recall:")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                HStack(spacing: 6) {
                    reviewButton(quality: 0, label: "Again", color: .red, action: onReview)
                    reviewButton(quality: 1, label: "Hard", color: .orange, action: onReview)
                    reviewButton(quality: 3, label: "Good", color: .green, action: onReview)
                    reviewButton(quality: 5, label: "Easy", color: Brand.primary, action: onReview)
                }
            }
        }
        .padding(16)
        .frame(width: 400)
        .glassBackgroundEffect()
    }

    private func reviewButton(quality: Int, label: String, color: Color, action: @escaping (Int) -> Void) -> some View {
        Button {
            action(quality)
        } label: {
            Text(label)
                .font(.caption)
                .fontWeight(.medium)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 6)
        }
        .buttonStyle(.bordered)
        .tint(color)
    }

    private var displayTypeIcon: String {
        switch item.displayType {
        case "3d_model": return "cube"
        case "text_panel": return "text.alignleft"
        default: return "rectangle.portrait"
        }
    }
}
