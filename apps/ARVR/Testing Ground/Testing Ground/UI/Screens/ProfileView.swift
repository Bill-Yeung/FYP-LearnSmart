//
//  ProfileView.swift
//  Testing Ground
//

import SwiftUI

struct ProfileView: View {
    @StateObject private var viewModel = ProfileViewModel()

    var body: some View {
        ZStack {
            Color(.systemGroupedBackground)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Picker("", selection: $viewModel.selectedTab) {
                    Text("Overview").tag(ProfileViewModel.ProfileTab.overview)
                    Text("Badges").tag(ProfileViewModel.ProfileTab.badges)
                    Text("Reputation").tag(ProfileViewModel.ProfileTab.reputation)
                    Text("Points").tag(ProfileViewModel.ProfileTab.points)
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.vertical, 8)

                if viewModel.isLoading {
                    loadingView
                } else if let error = viewModel.errorMessage {
                    errorView(error)
                } else {
                    contentView
                }
            }
        }
        .navigationTitle("Profile")
        .task {
            await viewModel.loadAllProfileData()
        }
    }

    @ViewBuilder
    private var contentView: some View {
        switch viewModel.selectedTab {
        case .overview:   overviewContent
        case .badges:     badgesContent
        case .reputation: reputationContent
        case .points:     pointsContent
        }
    }

    // MARK: - Overview

    private var overviewContent: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let user = viewModel.userData {
                    profileHeaderCard(user: user)
                        .padding(.horizontal)

                    HStack(spacing: 10) {
                        if let rep = viewModel.reputationInfo {
                            statTile(title: "Reputation",
                                     value: String(Int(rep.totalScore ?? 0)),
                                     tint: .blue)
                        }
                        if let pts = viewModel.pointsSummary {
                            statTile(title: "Points",
                                     value: String(pts.balance),
                                     tint: .green)
                        }
                        statTile(title: "Badges",
                                 value: String(viewModel.badges.filter { $0.earned == true }.count),
                                 tint: .orange)
                    }
                    .padding(.horizontal)
                } else {
                    Text("Loading profile…")
                        .foregroundStyle(.secondary)
                        .padding(.top, 40)
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
    }

    // MARK: - Badges

    private var badgesContent: some View {
        ScrollView {
            if viewModel.badges.isEmpty {
                emptyState(icon: "star.fill", title: "No Badges Yet", subtitle: "Complete tasks to earn badges")
            } else {
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    ForEach(viewModel.badges) { badge in
                        BadgeCard(badge: badge)
                    }
                }
                .padding()
            }
        }
    }

    // MARK: - Reputation

    private var reputationContent: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let rep = viewModel.reputationInfo {
                    sectionCard {
                        VStack(spacing: 12) {
                            VStack(spacing: 2) {
                                Text(String(Int(rep.totalScore ?? 0)))
                                    .font(.system(size: 40, weight: .bold, design: .rounded))
                                    .foregroundStyle(.blue)
                                Text("Total Score")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Divider()

                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Level")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Text(rep.levelName ?? "—")
                                        .font(.headline)
                                        .fontWeight(.semibold)
                                        .foregroundStyle(.primary)
                                }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 2) {
                                    Text("Rank")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Text(String(format: "Top %.0f%%", rep.rankPercentile ?? 0))
                                        .font(.headline)
                                        .fontWeight(.semibold)
                                        .foregroundStyle(.primary)
                                }
                            }

                            if let nextLevel = rep.nextLevelName, let toNext = rep.pointsToNext {
                                Divider()
                                VStack(spacing: 6) {
                                    HStack {
                                        Text("Next: \(nextLevel)")
                                            .font(.caption)
                                            .foregroundStyle(.secondary)
                                        Spacer()
                                        Text("\(toNext) pts to go")
                                            .font(.caption2)
                                            .fontWeight(.semibold)
                                            .foregroundStyle(.secondary)
                                    }
                                    ProgressView(value: Double(max(0, Int(rep.totalScore ?? 0) % 100)), total: 100)
                                        .tint(.blue)
                                }
                            }
                        }
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
    }

    // MARK: - Points

    private var pointsContent: some View {
        ScrollView {
            VStack(spacing: 16) {
                if let pts = viewModel.pointsSummary {
                    sectionCard {
                        VStack(spacing: 12) {
                            VStack(spacing: 2) {
                                Text(String(pts.balance))
                                    .font(.system(size: 40, weight: .bold, design: .rounded))
                                    .foregroundStyle(.green)
                                Text("Point Balance")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }

                            Divider()

                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Earned")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Text(String(pts.totalEarned))
                                        .font(.headline)
                                        .fontWeight(.semibold)
                                        .foregroundStyle(.green)
                                }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 2) {
                                    Text("Spent")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Text(String(pts.totalSpent))
                                        .font(.headline)
                                        .fontWeight(.semibold)
                                        .foregroundStyle(.red)
                                }
                            }

                            Divider()

                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("Current Streak")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Text("\(pts.streak.current) days")
                                        .font(.headline)
                                        .fontWeight(.semibold)
                                        .foregroundStyle(.orange)
                                }
                                Spacer()
                                VStack(alignment: .trailing, spacing: 2) {
                                    Text("Longest Streak")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                    Text("\(pts.streak.longest) days")
                                        .font(.headline)
                                        .fontWeight(.semibold)
                                        .foregroundStyle(.orange)
                                }
                            }
                        }
                    }
                    .padding(.horizontal)
                }
            }
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
    }

    // MARK: - Helpers

    private var loadingView: some View {
        VStack(spacing: 16) {
            ProgressView()
            Text("Loading profile…")
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorView(_ error: String) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(size: 48))
                .foregroundStyle(.red)
            Text("Error Loading Profile")
                .font(.headline)
                .foregroundStyle(.primary)
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
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding()
    }

    private func emptyState(icon: String, title: String, subtitle: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text(title)
                .font(.headline)
                .foregroundStyle(.primary)
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 60)
    }

    private func sectionCard<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .padding()
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
    }

    private func profileHeaderCard(user: APIService.ProfileResponse) -> some View {
        VStack(spacing: 14) {
            ZStack {
                Circle()
                    .fill(Color.blue.opacity(0.12))
                    .frame(width: 88, height: 88)
                Image(systemName: "person.fill")
                    .font(.system(size: 36))
                    .foregroundStyle(.blue)
            }

            VStack(spacing: 4) {
                Text(user.displayName ?? user.username ?? user.email)
                    .font(.title3)
                    .fontWeight(.semibold)
                    .foregroundStyle(.primary)

                Text(user.email)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text(user.role.uppercased())
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundStyle(.blue)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 3)
                    .background(Color.blue.opacity(0.1))
                    .clipShape(Capsule())
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 20)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private func statTile(title: String, value: String, tint: Color) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title3)
                .fontWeight(.bold)
                .foregroundStyle(tint)
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(tint.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    }
}

// MARK: - Badge Card

struct BadgeCard: View {
    let badge: Badge

    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle()
                    .fill(Color.blue.opacity(badge.earned == true ? 0.15 : 0.06))
                    .frame(height: 64)
                Image(systemName: "star.fill")
                    .font(.system(size: 26))
                    .foregroundStyle(badge.earned == true ? Color.blue : Color.secondary)
            }

            VStack(spacing: 3) {
                Text(badge.name)
                    .font(.caption)
                    .fontWeight(.semibold)
                    .lineLimit(2)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.primary)

                if let desc = badge.description {
                    Text(desc)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(2)
                        .multilineTextAlignment(.center)
                }

                Text(badge.earned == true ? "Earned" : "Locked")
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundStyle(badge.earned == true ? .green : .secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .opacity(badge.earned == true ? 1.0 : 0.55)
    }
}

#Preview {
    NavigationStack {
        ProfileView()
    }
}
