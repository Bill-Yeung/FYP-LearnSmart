//
//  ScriptScenesView.swift
//  Testing Ground
//

import SwiftUI

struct ScriptScenesView: View {
    let scriptId: String
    let scriptTitle: String

    @State private var scenes: [SceneRecord] = []
    @State private var isLoading = false
    @State private var errorMessage: String?

    private let api = APIService.shared

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading scenes…")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = errorMessage {
                VStack(spacing: 16) {
                    Image(systemName: "exclamationmark.circle")
                        .font(.system(size: 48))
                        .foregroundStyle(.red)
                    Text(error)
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                    Button("Retry") { Task { await loadScenes() } }
                }
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if scenes.isEmpty {
                ContentUnavailableView(
                    "No Scenes",
                    systemImage: "theatermasks",
                    description: Text("No scenes found for this script.")
                )
            } else {
                ScrollView {
                    LazyVStack(spacing: 12) {
                        ForEach(scenes) { scene in
                            SceneCard(scene: scene, index: scenes.firstIndex(where: { $0.id == scene.id }) ?? 0)
                        }
                    }
                    .padding(.horizontal, 24)
                    .padding(.vertical, 16)
                }
            }
        }
        .navigationTitle(scriptTitle)
        .task { await loadScenes() }
    }

    private func loadScenes() async {
        isLoading = true
        errorMessage = nil
        do {
            scenes = try await api.getScenes(scriptId: scriptId)
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }
}

// MARK: - Scene Card

struct SceneCard: View {
    let scene: SceneRecord
    let index: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                Text("\(index + 1)")
                    .font(.headline)
                    .fontWeight(.bold)
                    .foregroundStyle(.white)
                    .frame(width: 32, height: 32)
                    .background(Brand.primary)
                    .clipShape(Circle())

                VStack(alignment: .leading, spacing: 4) {
                    Text(scene.title)
                        .font(.headline)
                        .fontWeight(.semibold)

                    HStack(spacing: 8) {
                        if let act = scene.act {
                            Label("Act \(act)", systemImage: "book.fill")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        if let location = scene.location, !location.isEmpty {
                            Label(location, systemImage: "mappin")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                }

                Spacer()
            }

            if let desc = scene.description, !desc.isEmpty {
                Text(desc)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }

            HStack(spacing: 16) {
                if let chars = scene.charactersPresent, !chars.isEmpty {
                    Label("\(chars.count) character\(chars.count == 1 ? "" : "s")", systemImage: "person.2")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                if let clues = scene.clues, !clues.isEmpty {
                    Label("\(clues.count) clue\(clues.count == 1 ? "" : "s")", systemImage: "magnifyingglass")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                if let qs = scene.questions, !qs.isEmpty {
                    Label("\(qs.count) question\(qs.count == 1 ? "" : "s")", systemImage: "questionmark.circle")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(16)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .strokeBorder(Color.gray.opacity(0.15), lineWidth: 1)
        )
    }
}
