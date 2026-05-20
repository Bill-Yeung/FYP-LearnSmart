import SwiftUI

struct RecordsView: View {

    @State private var viewModel = RecordsViewModel()

    var body: some View {
        VStack(spacing: 0) {
                Picker("Tab", selection: $viewModel.selectedTab) {
                    ForEach(RecordsViewModel.Tab.allCases) { tab in
                        Text(tab.rawValue).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .padding()

                switch viewModel.selectedTab {
                case .games:
                    gamesTab
                case .activity:
                    activityTab
                }
            }
        .alert("Error", isPresented: .init(
            get: { viewModel.errorMessage != nil },
            set: { if !$0 { viewModel.errorMessage = nil } }
        )) {
            Button("OK") { viewModel.errorMessage = nil }
        } message: {
            Text(viewModel.errorMessage ?? "")
        }
    }

    // MARK: - Games Tab

    private var gamesTab: some View {
        Group {
            if viewModel.isLoading && viewModel.gameRecords.isEmpty {
                ProgressView("Loading records...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if viewModel.gameRecords.isEmpty {
                ContentUnavailableView(
                    "No Game Records",
                    systemImage: "gamecontroller",
                    description: Text("Play games to see your records here.")
                )
            } else {
                List(viewModel.gameRecords) { record in
                    HStack(spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 10)
                                .fill(Brand.recordsColor.opacity(0.1))
                                .frame(width: 44, height: 44)
                            Image(systemName: "gamecontroller.fill")
                                .foregroundStyle(Brand.recordsColor)
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            Text(record.scriptTitle ?? "Untitled")
                                .font(.headline)
                            if let summary = record.scriptSummary {
                                Text(summary)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                    .lineLimit(2)
                            }
                            HStack(spacing: 16) {
                                if let method = record.generationMethod {
                                    Label(method, systemImage: "wand.and.stars")
                                }
                                if let count = record.playCount {
                                    Label("\(count) plays", systemImage: "play.circle")
                                }
                                if let status = record.validationStatus {
                                    Label(status, systemImage: "checkmark.seal")
                                }
                            }
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                        }
                    }
                    .padding(.vertical, 4)
                }
            }
        }
        .task {
            await viewModel.loadGameRecords()
        }
    }

    // MARK: - Activity Tab

    private var activityTab: some View {
        Group {
            if viewModel.isLoading && viewModel.activityFeed.isEmpty {
                ProgressView("Loading activity...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if viewModel.activityFeed.isEmpty {
                ContentUnavailableView(
                    "No Activity",
                    systemImage: "clock",
                    description: Text("Your activity feed will appear here.")
                )
            } else {
                List(viewModel.activityFeed) { record in
                    HStack(spacing: 12) {
                        if let avatarUrl = record.user?.avatarUrl, let url = URL(string: avatarUrl) {
                            AsyncImage(url: url) { image in
                                image.resizable().aspectRatio(contentMode: .fill)
                            } placeholder: {
                                Image(systemName: "person.circle.fill")
                                    .font(.title2)
                                    .foregroundStyle(Brand.primary)
                            }
                            .frame(width: 40, height: 40)
                            .clipShape(Circle())
                        } else {
                            Image(systemName: "person.circle.fill")
                                .font(.title2)
                                .foregroundStyle(Brand.primary)
                                .frame(width: 40, height: 40)
                        }

                        VStack(alignment: .leading, spacing: 4) {
                            HStack {
                                Text(record.user?.displayName ?? record.user?.username ?? "User")
                                    .fontWeight(.medium)
                                if let type = record.type {
                                    Text(type)
                                        .font(.caption)
                                        .padding(.horizontal, 6)
                                        .padding(.vertical, 2)
                                        .background(Brand.primary.opacity(0.1))
                                        .foregroundStyle(Brand.primary)
                                        .clipShape(Capsule())
                                }
                            }
                            if let title = record.content?.title {
                                Text(title)
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                            }
                            if let date = record.createdAt {
                                Text(date, style: .relative)
                                    .font(.caption2)
                                    .foregroundStyle(.tertiary)
                            }
                        }
                    }
                    .padding(.vertical, 2)
                }
            }
        }
        .task {
            await viewModel.loadActivityFeed()
        }
    }
}
