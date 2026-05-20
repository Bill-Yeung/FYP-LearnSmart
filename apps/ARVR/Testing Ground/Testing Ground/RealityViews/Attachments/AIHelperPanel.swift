import SwiftUI

/// Floating AI chat panel attached to a 3D model in the VR palace.
/// The user types a question about the model and the AI answers in context.
struct AIHelperPanel: View {

    let modelName: String
    let contextText: String
    var onClose: (() -> Void)?

    @State private var question: String = ""
    @State private var answer: String = ""
    @State private var isLoading = false
    @State private var errorMessage: String?
    @State private var history: [(question: String, answer: String)] = []

    var body: some View {
        VStack(spacing: 0) {

            // Header
            HStack(spacing: 10) {
                Image(systemName: "sparkles")
                    .foregroundStyle(.purple)
                VStack(alignment: .leading, spacing: 2) {
                    Text("AI Assistant")
                        .font(.headline)
                    Text(modelName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer()
                Button { onClose?() } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                        .font(.title3)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)

            Divider()

            // Conversation history
            if !history.isEmpty {
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        ForEach(history.indices, id: \.self) { i in
                            VStack(alignment: .leading, spacing: 6) {
                                // User question bubble
                                HStack {
                                    Spacer()
                                    Text(history[i].question)
                                        .font(.callout)
                                        .padding(.horizontal, 12)
                                        .padding(.vertical, 8)
                                        .background(Color.blue.opacity(0.2))
                                        .clipShape(RoundedRectangle(cornerRadius: 12))
                                }
                                // AI answer bubble
                                HStack(alignment: .top, spacing: 8) {
                                    Image(systemName: "sparkles")
                                        .foregroundStyle(.purple)
                                        .font(.caption)
                                        .padding(.top, 2)
                                    Text(history[i].answer)
                                        .font(.callout)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                            }
                        }
                    }
                    .padding(14)
                }
                .frame(maxHeight: 260)
            } else {
                // Empty state hint
                VStack(spacing: 8) {
                    Image(systemName: "sparkles")
                        .font(.largeTitle)
                        .foregroundStyle(.purple.opacity(0.6))
                    Text("Ask me anything about \"\(modelName)\"")
                        .font(.callout)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(24)
            }

            Divider()

            // Error
            if let error = errorMessage {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(.horizontal, 16)
                    .padding(.top, 8)
            }

            // Input row
            HStack(spacing: 10) {
                TextField("Ask about this model…", text: $question, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(1...3)
                    .disabled(isLoading)
                    .onSubmit { sendQuestion() }

                if isLoading {
                    ProgressView()
                        .scaleEffect(0.8)
                } else {
                    Button {
                        sendQuestion()
                    } label: {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.title2)
                            .foregroundStyle(question.trimmingCharacters(in: .whitespaces).isEmpty ? Color.secondary : Color.purple)
                    }
                    .buttonStyle(.plain)
                    .disabled(question.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
        }
        .frame(width: 420)
        .palaceAttachmentBackground()
    }

    private func sendQuestion() {
        let q = question.trimmingCharacters(in: .whitespaces)
        guard !q.isEmpty, !isLoading else { return }
        question = ""
        errorMessage = nil
        isLoading = true

        Task {
            do {
                let response = try await APIService.shared.askAI(
                    modelName: modelName,
                    question: q,
                    context: contextText
                )
                history.append((question: q, answer: response))
            } catch {
                errorMessage = error.localizedDescription
            }
            isLoading = false
        }
    }
}
