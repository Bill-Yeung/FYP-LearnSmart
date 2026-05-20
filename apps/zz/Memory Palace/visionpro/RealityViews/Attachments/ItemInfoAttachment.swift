import SwiftUI

/// SwiftUI attachment that appears above a 3D entity in the palace.
/// Shows item label on idle; expands to review card on tap.
struct ItemInfoAttachment: View {

    let item: PalaceItem
    var onTap: (() -> Void)?
    var onReview: ((Int) -> Void)?
    var onDelete: (() -> Void)?

    @State private var isExpanded = false

    var body: some View {
        VStack(spacing: 8) {
            if isExpanded {
                expandedView
            } else {
                compactView
            }
        }
        .animation(.spring(duration: 0.3), value: isExpanded)
    }

    // MARK: - Compact (label only)

    private var compactView: some View {
        VStack(spacing: 6) {
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
                        .foregroundStyle(.black)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(Color.white.opacity(0.95))
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)

            Button {
                onDelete?()
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "trash.fill")
                        .font(.body)
                    Text("Delete")
                        .font(.body)
                        .fontWeight(.semibold)
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 16)
                .padding(.vertical, 8)
                .background(Color.red)
                .clipShape(Capsule())
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Expanded (review card)

    private var expandedView: some View {
        VStack(spacing: 12) {
            // Header
            HStack {
                Image(systemName: displayTypeIcon)
                    .foregroundStyle(.blue)
                Text(item.label ?? "Review Item")
                    .font(.headline)
                    .foregroundStyle(.black)
                Spacer()
                if let onDelete {
                    Button(role: .destructive, action: onDelete) {
                        Image(systemName: "trash")
                            .font(.caption)
                            .foregroundStyle(.red)
                    }
                    .buttonStyle(.plain)
                }
                Button {
                    isExpanded = false
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.gray)
                }
                .buttonStyle(.plain)
            }

            // Content
            if let text = item.customText {
                ScrollView {
                    Text(text)
                        .font(.body)
                        .foregroundStyle(.black)
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
                .foregroundStyle(nextReview < Date() ? .red : .black.opacity(0.7))
            }

            // Review buttons
            if let onReview {
                Divider()
                Text("Rate your recall:")
                    .font(.caption)
                    .foregroundStyle(.black.opacity(0.7))
                HStack(spacing: 6) {
                    reviewButton(quality: 0, label: "Again", color: .red, action: onReview)
                    reviewButton(quality: 1, label: "Hard", color: .orange, action: onReview)
                    reviewButton(quality: 3, label: "Good", color: .green, action: onReview)
                    reviewButton(quality: 5, label: "Easy", color: .blue, action: onReview)
                }
            }
        }
        .padding(16)
        .frame(width: 400)
        .background(Color.white.opacity(0.95))
        .clipShape(RoundedRectangle(cornerRadius: 16))
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
