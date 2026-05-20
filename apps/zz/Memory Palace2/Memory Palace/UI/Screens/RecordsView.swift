//
//  RecordsView.swift
//  Testing Ground
//
//  Created by ituser on 29/1/2026.
//

import SwiftUI

struct RecordsView: View {
    @StateObject private var viewModel = RecordsViewModel()

    var body: some View {
        ZStack {
            Brand.backgroundGradient
                .ignoresSafeArea()

            if viewModel.isLoading {
                loadingView
            } else if let error = viewModel.errorMessage {
                errorView(error)
            } else if viewModel.reviewRecords.isEmpty {
                emptyView
            } else {
                recordsList
            }
        }
        .navigationTitle("Review History")
        .task {
            await viewModel.loadReviewHistory()
        }
    }

    // MARK: - Content

    private var recordsList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                Text("\(viewModel.reviewRecords.count) Sessions")
                    .font(.title3)
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 40)
                    .padding(.top, 8)

                ForEach(viewModel.reviewRecords) { record in
                    ReviewRecordCard(record: record)
                        .padding(.horizontal, 40)
                }
            }
            .padding(.vertical, 24)
        }
        .refreshable { await viewModel.refresh() }
    }

    private var emptyView: some View {
        ContentUnavailableView(
            "No Review History",
            systemImage: "rectangle.stack",
            description: Text("Complete flashcard reviews to see your history here.")
        )
    }

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text("Loading history...")
                .foregroundStyle(.secondary)
        }
    }

    private func errorView(_ error: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: 48))
                .foregroundStyle(.red)
            Text("Could Not Load History")
                .font(.headline)
            Text(error)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await viewModel.refresh() }
            } label: {
                Text("Retry")
                    .fontWeight(.semibold)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Brand.primary)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 8))
            }
        }
        .padding(.horizontal, 40)
    }
}

// MARK: - Review Record Card

struct ReviewRecordCard: View {
    let record: FlashcardReviewRecord

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            // Header row
            HStack(spacing: 10) {
                ratingBadge(record.rating)

                VStack(alignment: .leading, spacing: 2) {
                    Text(record.front ?? "Flashcard")
                        .font(.headline)
                        .lineLimit(2)
                    if let topic = record.topic {
                        Text(topic)
                            .font(.caption)
                            .foregroundStyle(Brand.primary)
                    }
                }

                Spacer()

                if let dateStr = record.reviewAt {
                    Text(formatDate(dateStr))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            // Back answer preview
            if let back = record.back, !back.isEmpty {
                Text(back)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }

            // Footer stats
            HStack(spacing: 16) {
                if let ms = record.durationMs {
                    Label(formatDuration(ms), systemImage: "clock")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                if let mode = record.reviewMode {
                    Label(mode.capitalized, systemImage: "rectangle.stack")
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
                Spacer()
                if let interval = record.actualInterval {
                    Text(String(format: "Interval: %.0fd", interval))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }
        }
        .padding(16)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color.white.opacity(0.12), lineWidth: 1)
        )
    }

    // MARK: - Helpers

    @ViewBuilder
    private func ratingBadge(_ rating: Int?) -> some View {
        let (label, color) = ratingInfo(rating)
        ZStack {
            Circle()
                .fill(color.opacity(0.18))
                .frame(width: 44, height: 44)
            Text(label)
                .font(.title3)
        }
    }

    private func ratingInfo(_ rating: Int?) -> (String, Color) {
        switch rating {
        case 1: return ("😓", .red)
        case 2: return ("😐", .orange)
        case 3: return ("🙂", .yellow)
        case 4: return ("😄", .green)
        default: return ("📖", Brand.primary)
        }
    }

    private func formatDate(_ iso: String) -> String {
        let parser = ISO8601DateFormatter()
        parser.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let date = parser.date(from: iso) ?? ISO8601DateFormatter().date(from: iso)
        guard let date else { return iso }
        let f = DateFormatter()
        let cal = Calendar.current
        if cal.isDateInToday(date) {
            f.timeStyle = .short
            f.dateStyle = .none
        } else if cal.isDateInYesterday(date) {
            return "Yesterday"
        } else {
            f.dateStyle = .short
            f.timeStyle = .none
        }
        return f.string(from: date)
    }

    private func formatDuration(_ ms: Int) -> String {
        let s = ms / 1000
        if s < 60 { return "\(s)s" }
        return "\(s / 60)m \(s % 60)s"
    }
}

#Preview {
    NavigationStack {
        RecordsView()
    }
}
