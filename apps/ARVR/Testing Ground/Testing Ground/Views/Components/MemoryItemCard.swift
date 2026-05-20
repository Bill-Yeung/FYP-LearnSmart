import SwiftUI

struct MemoryItemCard: View {

    let item: PalaceItem
    var onTap: (() -> Void)?
    var onDelete: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: displayTypeIcon)
                    .foregroundStyle(Brand.primary)
                Text(item.label ?? "Unnamed Item")
                    .font(.headline)
                Spacer()
                if let onDelete {
                    Button(role: .destructive, action: onDelete) {
                        Image(systemName: "trash")
                            .font(.caption)
                    }
                    .buttonStyle(.borderless)
                }
            }

            if let text = item.customText {
                Text(text)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }

            HStack(spacing: 12) {
                Label(item.displayType, systemImage: "tag")
                if let nextReview = item.nextReviewAt {
                    Label(nextReview, style: .relative)
                        .foregroundStyle(isOverdue ? .red : .secondary)
                }
            }
            .font(.caption)
            .foregroundStyle(.tertiary)
        }
        .padding()
        .frame(maxWidth: 300, alignment: .leading)
        .glassBackground()
        .onTapGesture {
            onTap?()
        }
    }

    private var displayTypeIcon: String {
        switch item.displayType {
        case "3d_model": return "cube"
        case "text_panel": return "text.alignleft"
        default: return "rectangle.portrait"
        }
    }

    private var isOverdue: Bool {
        guard let next = item.nextReviewAt else { return false }
        return next < Date()
    }
}

// Helper for Label with Date style
private extension Label where Title == Text, Icon == Image {
    init(_ date: Date, style: Text.DateStyle) {
        self.init {
            Text(date, style: style)
        } icon: {
            Image(systemName: "clock")
        }
    }
}
