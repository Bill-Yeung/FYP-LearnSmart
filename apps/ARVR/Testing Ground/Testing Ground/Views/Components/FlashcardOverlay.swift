import SwiftUI

struct FlashcardOverlay: View {

    let item: PalaceItem
    let onReview: (Int) -> Void
    let onDismiss: () -> Void

    @State private var showAnswer = false

    var body: some View {
        VStack(spacing: 20) {
            // Header
            HStack {
                Text(item.label ?? "Review")
                    .font(.headline)
                Spacer()
                Button(action: onDismiss) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
            }

            Divider()

            // Card content placeholder
            VStack(spacing: 12) {
                Text(item.customText ?? item.label ?? "What do you remember?")
                    .font(.title3)
                    .multilineTextAlignment(.center)

                if showAnswer {
                    Divider()
                    Text("Recall the information associated with this item.")
                        .font(.body)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
            }
            .frame(maxWidth: .infinity)
            .padding()
            .background(.regularMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 12))

            if !showAnswer {
                Button("Show Answer") {
                    withAnimation { showAnswer = true }
                }
                .buttonStyle(.borderedProminent)
                .tint(Brand.primary)
            } else {
                // Quality rating (SM-2: 0-5)
                VStack(spacing: 8) {
                    Text("How well did you remember?")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    HStack(spacing: 8) {
                        ratingButton(quality: 0, label: "Forgot", color: .red)
                        ratingButton(quality: 1, label: "Hard", color: .orange)
                        ratingButton(quality: 3, label: "Good", color: .yellow)
                        ratingButton(quality: 4, label: "Easy", color: .green)
                        ratingButton(quality: 5, label: "Perfect", color: Brand.primary)
                    }
                }
            }
        }
        .padding(24)
        .frame(width: 420)
        .glassBackground()
    }

    private func ratingButton(quality: Int, label: String, color: Color) -> some View {
        Button {
            onReview(quality)
        } label: {
            VStack(spacing: 4) {
                Text("\(quality)")
                    .font(.title3)
                    .fontWeight(.bold)
                Text(label)
                    .font(.caption2)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 8)
        }
        .buttonStyle(.bordered)
        .tint(color)
    }
}
