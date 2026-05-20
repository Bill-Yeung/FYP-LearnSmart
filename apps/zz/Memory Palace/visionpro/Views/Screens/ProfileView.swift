import SwiftUI

struct ProfileView: View {

    @State private var viewModel = ProfileViewModel()

    var body: some View {
        VStack(spacing: 0) {
                Picker("Tab", selection: $viewModel.selectedTab) {
                    ForEach(ProfileViewModel.Tab.allCases) { tab in
                        Text(tab.rawValue).tag(tab)
                    }
                }
                .pickerStyle(.segmented)
                .padding()

                if viewModel.isLoading {
                    ProgressView("Loading profile...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    switch viewModel.selectedTab {
                    case .overview:
                        overviewTab
                    case .badges:
                        badgesTab
                    case .reputation:
                        reputationTab
                    case .points:
                        pointsTab
                    }
                }
            }
        .task {
            await viewModel.loadAll()
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

    // MARK: - Overview

    private var overviewTab: some View {
        List {
            if let profile = viewModel.profile {
                Section("Account") {
                    LabeledContent("Email", value: profile.email)
                    if let username = profile.username {
                        LabeledContent("Username", value: username)
                    }
                    if let name = profile.displayName {
                        LabeledContent("Display Name", value: name)
                    }
                    LabeledContent("Role", value: profile.role.capitalized)
                }
            }
            if let rep = viewModel.reputation {
                Section("Reputation") {
                    HStack {
                        Label("Level", systemImage: "star.fill")
                            .foregroundStyle(Brand.secondary)
                        Spacer()
                        Text("\(rep.level ?? 0) — \(rep.levelName ?? "N/A")")
                            .foregroundStyle(.secondary)
                    }
                    HStack {
                        Label("Score", systemImage: "chart.line.uptrend.xyaxis")
                            .foregroundStyle(Brand.accent)
                        Spacer()
                        Text(String(format: "%.0f", rep.totalScore ?? 0))
                            .foregroundStyle(.secondary)
                    }
                }
            }
            if let pts = viewModel.points {
                Section("Points") {
                    HStack {
                        Label("Balance", systemImage: "bitcoinsign.circle.fill")
                            .foregroundStyle(Brand.primary)
                        Spacer()
                        Text("\(pts.totalBalance ?? 0)")
                            .foregroundStyle(.secondary)
                    }
                    HStack {
                        Label("Streak", systemImage: "flame.fill")
                            .foregroundStyle(Brand.pink)
                        Spacer()
                        Text("\(pts.currentStreak ?? 0) days")
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    // MARK: - Badges

    private var badgesTab: some View {
        Group {
            if viewModel.badges.isEmpty {
                ContentUnavailableView(
                    "No Badges Yet",
                    systemImage: "medal",
                    description: Text("Complete activities to earn badges.")
                )
            } else {
                ScrollView {
                    LazyVGrid(columns: [
                        GridItem(.adaptive(minimum: 140), spacing: 16)
                    ], spacing: 16) {
                        ForEach(viewModel.badges) { badge in
                            VStack(spacing: 8) {
                                if let url = badge.iconUrl, let imageURL = URL(string: url) {
                                    AsyncImage(url: imageURL) { image in
                                        image.resizable().aspectRatio(contentMode: .fit)
                                    } placeholder: {
                                        Image(systemName: "medal.fill")
                                            .font(.largeTitle)
                                    }
                                    .frame(width: 48, height: 48)
                                } else {
                                    Image(systemName: "medal.fill")
                                        .font(.largeTitle)
                                        .foregroundStyle(badge.earned == true ? Brand.secondary : .secondary)
                                }
                                Text(badge.name)
                                    .font(.caption)
                                    .fontWeight(.medium)
                                    .multilineTextAlignment(.center)
                                if let desc = badge.description {
                                    Text(desc)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(2)
                                        .multilineTextAlignment(.center)
                                }
                            }
                            .padding()
                            .frame(maxWidth: .infinity)
                            .background(.regularMaterial)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .strokeBorder(badge.earned == true
                                                  ? Brand.secondary.opacity(0.3)
                                                  : Color.clear, lineWidth: 1)
                            )
                            .opacity(badge.earned == true ? 1 : 0.5)
                        }
                    }
                    .padding()
                }
            }
        }
    }

    // MARK: - Reputation

    private var reputationTab: some View {
        List {
            if let rep = viewModel.reputation {
                Section("Level") {
                    LabeledContent("Current Level", value: "\(rep.level ?? 0)")
                    LabeledContent("Level Name", value: rep.levelName ?? "N/A")
                    if let next = rep.nextLevelName {
                        LabeledContent("Next Level", value: next)
                    }
                    if let pts = rep.pointsToNext {
                        LabeledContent("Points to Next", value: "\(pts)")
                    }
                }
                Section("Stats") {
                    LabeledContent("Total Score", value: String(format: "%.0f", rep.totalScore ?? 0))
                    if let percentile = rep.rankPercentile {
                        LabeledContent("Rank Percentile", value: String(format: "Top %.0f%%", percentile))
                    }
                }
            } else {
                ContentUnavailableView(
                    "No Reputation Data",
                    systemImage: "star",
                    description: Text("Start learning to build your reputation.")
                )
            }
        }
    }

    // MARK: - Points

    private var pointsTab: some View {
        List {
            if let pts = viewModel.points {
                Section("Balance") {
                    LabeledContent("Total Points", value: "\(pts.totalBalance ?? 0)")
                }
                Section("Streaks") {
                    LabeledContent("Current Streak", value: "\(pts.currentStreak ?? 0) days")
                    LabeledContent("Longest Streak", value: "\(pts.longestStreak ?? 0) days")
                }
            } else {
                ContentUnavailableView(
                    "No Points Data",
                    systemImage: "bitcoinsign.circle",
                    description: Text("Earn points by completing reviews.")
                )
            }
        }
    }
}
