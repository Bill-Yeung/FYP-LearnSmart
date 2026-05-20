import SwiftUI

struct SettingsView: View {

    @Environment(AppModel.self) private var appModel
    @Environment(AuthViewModel.self) private var authVM
    @State private var backendURL = BackendConfig.baseURL
    @State private var connectionStatus: ConnectionStatus = .unknown
    @State private var isTesting = false

    enum ConnectionStatus {
        case unknown, connected, failed
    }

    var body: some View {
        @Bindable var model = appModel

        Form {
                Section {
                    HStack(spacing: 10) {
                        Image(systemName: "server.rack")
                            .foregroundStyle(Brand.primary)
                        TextField("Backend URL", text: $backendURL)
                            .textContentType(.URL)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .onSubmit { saveBackendURL() }
                    }

                    HStack {
                        Button {
                            saveBackendURL()
                            testConnection()
                        } label: {
                            Label("Save & Test", systemImage: "bolt.fill")
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Brand.primary)
                        .disabled(isTesting)

                        Spacer()

                        switch connectionStatus {
                        case .unknown:
                            EmptyView()
                        case .connected:
                            Label("Connected", systemImage: "checkmark.circle.fill")
                                .foregroundStyle(Brand.accent)
                        case .failed:
                            Label("Failed", systemImage: "xmark.circle.fill")
                                .foregroundStyle(.red)
                        }

                        if isTesting {
                            ProgressView()
                        }
                    }

                    Button("Reset to Default") {
                        UserDefaults.standard.removeObject(forKey: "BackendURL")
                        backendURL = BackendConfig.baseURL
                        connectionStatus = .unknown
                    }
                    .foregroundStyle(.secondary)
                } header: {
                    Label("Backend Connection", systemImage: "network")
                }

                Section {
                    Toggle(isOn: $model.spatialAudioEnabled) {
                        Label("Spatial Audio", systemImage: "ear.and.waveform")
                    }
                    Toggle(isOn: $model.arSoundEnabled) {
                        Label("AR Sound Effects", systemImage: "arkit")
                    }
                    Toggle(isOn: $model.vrSoundEnabled) {
                        Label("VR Sound Effects", systemImage: "visionpro")
                    }

                    VStack(alignment: .leading) {
                        Text("Master Volume: \(Int(model.masterVolume * 100))%")
                            .font(.subheadline)
                        Slider(value: $model.masterVolume, in: 0...1)
                            .tint(Brand.primary)
                    }
                    VStack(alignment: .leading) {
                        Text("Effects Volume: \(Int(model.effectsVolume * 100))%")
                            .font(.subheadline)
                        Slider(value: $model.effectsVolume, in: 0...1)
                            .tint(Brand.secondary)
                    }
                } header: {
                    Label("Audio", systemImage: "speaker.wave.3")
                }

                Section {
                    Toggle(isOn: $model.hapticsEnabled) {
                        Label("Haptic Feedback", systemImage: "hand.tap")
                    }
                } header: {
                    Label("Interaction", systemImage: "hand.point.up.left")
                }

                Section {
                    Button(role: .destructive) {
                        authVM.logout()
                    } label: {
                        HStack {
                            Spacer()
                            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                                .fontWeight(.medium)
                            Spacer()
                        }
                    }
                }
            }
    }

    private func saveBackendURL() {
        let trimmed = backendURL.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty || trimmed == BackendConfig.baseURL {
            UserDefaults.standard.removeObject(forKey: "BackendURL")
        } else {
            UserDefaults.standard.set(trimmed, forKey: "BackendURL")
        }
    }

    private func testConnection() {
        isTesting = true
        connectionStatus = .unknown
        Task {
            let ok = await APIService.shared.testConnection()
            connectionStatus = ok ? .connected : .failed
            isTesting = false
        }
    }
}
