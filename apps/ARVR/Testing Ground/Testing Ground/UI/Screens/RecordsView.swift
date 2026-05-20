//
//  RecordsView.swift
//  Testing Ground
//
//  Created by ituser on 29/1/2026.
//

import SwiftUI

struct RecordsView: View {
    @Environment(AppModel.self) private var appModel

    @State private var selectedTab: ReviewTab = .review
    @State private var palaces: [MemoryPalace] = []
    @State private var palaceItems: [PalaceReviewItem] = []
    @State private var reviewItems: [PalaceReviewItem] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    private enum ReviewTab: String, CaseIterable, Identifiable {
        case review = "Review"
        case progress = "Progress"

        var id: String { rawValue }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Picker("", selection: $selectedTab) {
                ForEach(ReviewTab.allCases) { tab in
                    Text(tab.rawValue).tag(tab)
                }
            }
            .pickerStyle(.segmented)
            .padding(.horizontal)
            .padding(.vertical, 8)

            if isLoading {
                loadingView
            } else if let error = errorMessage {
                errorView(error)
            } else {
                contentView
            }
        }
        .navigationTitle("Review")
        .task {
            await loadReviewData()
        }
        .onChange(of: appModel.palaceItemRefreshTrigger) { _, _ in
            Task { await loadReviewData() }
        }
    }
    
    @ViewBuilder
    private var contentView: some View {
        switch selectedTab {
        case .review:
            reviewContent
        case .progress:
            progressContent
        }
    }
    
    private var reviewContent: some View {
        ScrollView {
            if reviewItems.isEmpty {
                VStack(spacing: 16) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 48))
                        .foregroundColor(.green)
                    Text("No Items Due")
                        .font(.headline)
                    Text("Attached flashcards and concepts due for review will appear here.")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .padding()
            } else {
                LazyVStack(spacing: 12) {
                    ForEach(reviewItems) { item in
                        reviewItemCard(item)
                    }
                }
                .padding()
            }
        }
        .refreshable {
            await loadReviewData()
        }
    }
    
    private var progressContent: some View {
        ScrollView {
            VStack(spacing: 12) {
                HStack(spacing: 12) {
                    progressTile(title: "Palaces", value: "\(palaces.count)", tint: .blue)
                    progressTile(title: "Due", value: "\(reviewItems.count)", tint: .orange)
                }

                HStack(spacing: 12) {
                    progressTile(title: "Flashcards", value: "\(palaceItems.filter { $0.flashcardId != nil }.count)", tint: .purple)
                    progressTile(title: "Concepts", value: "\(palaceItems.filter { $0.conceptId != nil }.count)", tint: .green)
                }

                progressTile(
                    title: "Total Items",
                    value: "\(palaceItems.count)",
                    tint: .blue
                )

                progressTile(
                    title: "Completed Reviews",
                    value: "\(palaceItems.reduce(0) { $0 + $1.reviewCount })",
                    tint: .pink
                )
            }
            .padding()
        }
        .refreshable {
            await loadReviewData()
        }
    }
    
    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text("Loading review...")
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    
    private func errorView(_ error: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: 48))
                .foregroundColor(.red)
            Text("Error Loading Review")
                .font(.headline)
            Text(error)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
            Button(action: {
                Task {
                    await loadReviewData()
                }
            }) {
                Text("Retry")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Color.blue)
                    .cornerRadius(8)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }

    private func reviewItemCard(_ item: PalaceReviewItem) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(item.label ?? "Memory Item")
                        .font(.headline)
                        .fontWeight(.semibold)
                    Text("\(item.palaceName) • \(itemTypeLabel(item))")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
                Text("\(item.reviewCount) reviews")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            if let text = item.customText, !text.isEmpty {
                Text(text)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(4)
            }

            HStack(spacing: 8) {
                reviewButton("Hard", quality: 2, item: item, tint: .red)
                reviewButton("Good", quality: 4, item: item, tint: .blue)
                reviewButton("Easy", quality: 5, item: item, tint: .green)
            }
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.gray.opacity(0.1), lineWidth: 1)
        )
    }

    private func reviewButton(_ title: String, quality: Int, item: PalaceReviewItem, tint: Color) -> some View {
        Button {
            Task { await submitReview(item, quality: quality) }
        } label: {
            Text(title)
                .font(.caption)
                .fontWeight(.semibold)
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .background(tint)
                .cornerRadius(8)
        }
        .buttonStyle(.plain)
    }

    private func progressTile(title: String, value: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title)
                .font(.caption)
                .foregroundColor(.secondary)
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(tint)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.gray.opacity(0.1), lineWidth: 1)
        )
    }

    private func itemTypeLabel(_ item: PalaceReviewItem) -> String {
        if item.flashcardId != nil { return "Flashcard" }
        if item.conceptId != nil { return "Concept" }
        return item.displayType.replacingOccurrences(of: "_", with: " ").capitalized
    }

    private func loadReviewData() async {
        isLoading = true
        errorMessage = nil
        do {
            let loadedPalaces = try await APIService.shared.listPalaces()
            var allItems: [PalaceReviewItem] = []
            var dueItems: [PalaceReviewItem] = []

            for palace in loadedPalaces {
                async let items = APIService.shared.getPalaceItems(palaceId: palace.id)
                async let due = APIService.shared.getReviewItems(palaceId: palace.id)
                allItems.append(contentsOf: try await items.map { PalaceReviewItem(item: $0, palace: palace) })
                dueItems.append(contentsOf: try await due.map { PalaceReviewItem(item: $0, palace: palace) })
            }

            palaces = loadedPalaces
            palaceItems = allItems
            reviewItems = dueItems
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    private func submitReview(_ item: PalaceReviewItem, quality: Int) async {
        do {
            try await APIService.shared.submitReview(palaceId: item.palaceId, itemId: item.id, quality: quality)
            await loadReviewData()
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

private struct PalaceReviewItem: Identifiable {
    let item: PalaceItem
    let palaceId: String
    let palaceName: String

    init(item: PalaceItem, palace: MemoryPalace) {
        self.item = item
        self.palaceId = palace.id
        self.palaceName = palace.name
    }

    var id: String { item.id }
    var label: String? { item.label }
    var flashcardId: String? { item.flashcardId }
    var conceptId: String? { item.conceptId }
    var customText: String? { item.customText }
    var displayType: String { item.displayType }
    var reviewCount: Int { item.reviewCount }
}

// MARK: - Game Record Card

struct GameRecordCard: View {
    let record: GameRecord
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(record.title ?? record.documentName ?? "Unknown Title")
                        .font(.headline)
                        .fontWeight(.semibold)
                        .lineLimit(2)

                    if let module = record.moduleName {
                        Text(module)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }
                }

                Spacer()
            }

            if let createdAt = record.createdAt {
                Text(formatDate(createdAt))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.gray.opacity(0.1), lineWidth: 1)
        )
    }
    
    private func statusBadge(_ status: String) -> some View {
        Text(status.uppercased())
            .font(.caption2)
            .fontWeight(.semibold)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(statusColor(status).opacity(0.2))
            .foregroundColor(statusColor(status))
            .cornerRadius(4)
    }
    
    private func statusColor(_ status: String) -> Color {
        switch status.lowercased() {
        case "valid": return .green
        case "invalid": return .red
        case "pending": return .orange
        default: return .gray
        }
    }
    
    private func formatDate(_ dateString: String) -> String {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = parser.date(from: dateString) ?? ISO8601DateFormatter().date(from: dateString)
        guard let date else { return dateString }
        let displayFormatter = DateFormatter()
        displayFormatter.dateStyle = .short
        displayFormatter.timeStyle = .none
        return displayFormatter.string(from: date)
    }
}

// MARK: - Activity Record Card

struct ActivityRecordCard: View {
    let record: ActivityRecord
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 12) {
                // User Avatar
                Circle()
                    .fill(Color.blue.opacity(0.3))
                    .frame(width: 44, height: 44)
                    .overlay(
                        Image(systemName: "person.fill")
                            .foregroundColor(.blue)
                    )
                
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(record.user?.displayName ?? "Unknown User")
                            .font(.subheadline)
                            .fontWeight(.semibold)
                        
                        Spacer()
                        
                        if let createdAt = record.createdAt {
                            Text(formatDate(createdAt))
                                .font(.caption2)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    Text(record.content?.title ?? "Unknown Title")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            
            if let description = record.content?.description, !description.isEmpty {
                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            
            HStack(spacing: 16) {
                Label("\(record.likes ?? 0)", systemImage: "heart.fill")
                    .font(.caption2)
                    .foregroundColor(.red)
                
                Label("\(record.comments ?? 0)", systemImage: "bubble.right.fill")
                    .font(.caption2)
                    .foregroundColor(.blue)
                
                Spacer()
                
                Label(record.entityType ?? "Unknown", systemImage: "tag.fill")
                    .font(.caption2)
                    .foregroundColor(.gray)
            }
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(Color.gray.opacity(0.1), lineWidth: 1)
        )
    }
    
    private func formatDate(_ date: Date) -> String {
        let calendar = Calendar.current
        if calendar.isDateInToday(date) {
            let timeFormatter = DateFormatter()
            timeFormatter.timeStyle = .short
            return timeFormatter.string(from: date)
        } else {
            let displayFormatter = DateFormatter()
            displayFormatter.dateStyle = .short
            return displayFormatter.string(from: date)
        }
    }
}

#Preview {
    RecordsView()
}
