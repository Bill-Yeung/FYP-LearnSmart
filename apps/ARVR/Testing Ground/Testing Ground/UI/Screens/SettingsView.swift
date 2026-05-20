//
//  SettingsView.swift
//  Testing Ground
//
//  Created by ituser on 29/1/2026.
//

import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var appModel
    @State private var selectedMode: ServerMode = BackendConfig.serverMode
    @State private var customScheme: String = BackendConfig.customScheme
    @State private var customAddress: String = BackendConfig.customAddress
    @State private var customPort: String = BackendConfig.customPort
    @State private var connectionStatus: String = ""

    var body: some View {
        Form {
            Section(header: Text("Server"), footer: Text(resolvedURLDescription)) {
                Picker("Mode", selection: $selectedMode) {
                    ForEach(ServerMode.allCases, id: \.self) { mode in
                        Text(mode.displayName).tag(mode)
                    }
                }
                .pickerStyle(.inline)
                .onChange(of: selectedMode) { _, newMode in
                    BackendConfig.serverMode = newMode
                    connectionStatus = ""
                }

                if selectedMode == .custom {
                    // Scheme: http / https
                    Picker("Scheme", selection: $customScheme) {
                        Text("http").tag("http")
                        Text("https").tag("https")
                    }
                    .pickerStyle(.segmented)
                    .onChange(of: customScheme) { _, v in
                        BackendConfig.customScheme = v
                        // Auto-update port to match scheme default
                        if v == "https" && customPort == "8000" {
                            customPort = "443"
                            BackendConfig.customPort = "443"
                        } else if v == "http" && customPort == "443" {
                            customPort = "8000"
                            BackendConfig.customPort = "8000"
                        }
                        connectionStatus = ""
                    }

                    // Address only (no scheme, no port)
                    HStack {
                        Text("Address")
                            .foregroundColor(.secondary)
                        TextField("192.168.1.10", text: $customAddress)
                            .autocorrectionDisabled()
                            .font(.system(.body, design: .monospaced))
                            .onChange(of: customAddress) { _, v in BackendConfig.customAddress = v; connectionStatus = "" }
                    }

                    // Port
                    HStack {
                        Text("Port")
                            .foregroundColor(.secondary)
                        TextField("8000", text: $customPort)
                            .autocorrectionDisabled()
                            .font(.system(.body, design: .monospaced))
                            .onChange(of: customPort) { _, v in BackendConfig.customPort = v; connectionStatus = "" }
                    }
                }

                Button("Test Connection") {
                    Task {
                        let success = await AssetAPIService.shared.testConnection()
                        connectionStatus = success ? "Connection successful!" : "Connection failed"
                    }
                }

                if !connectionStatus.isEmpty {
                    Text(connectionStatus)
                        .font(.caption)
                        .foregroundColor(connectionStatus.contains("successful") ? .green : .red)
                }
            }
            
            Section(header: Text("Audio")) {
                @Bindable var bindableModel = appModel
                Toggle("Spatial Audio", isOn: $bindableModel.spatialAudioEnabled)
            }

            Section(header: Text("AR Settings")) {
                @Bindable var bindableModel = appModel
                Toggle("Sound Enabled", isOn: $bindableModel.arSoundEnabled)

                HStack {
                    Text("Volume")
                    Slider(value: $bindableModel.masterVolume, in: 0...1)
                }
            }

            Section(header: Text("VR Settings")) {
                @Bindable var bindableModel = appModel
                Toggle("Sound Enabled", isOn: $bindableModel.vrSoundEnabled)

                HStack {
                    Text("Volume")
                    Slider(value: $bindableModel.effectsVolume, in: 0...1)
                }

                Toggle("Haptics", isOn: $bindableModel.hapticsEnabled)
            }

            Section(footer: Text("Changes take effect immediately where supported.")) {
                EmptyView()
            }
        }
        .navigationTitle("Settings")
    }

    private var resolvedURLDescription: String {
        "Active URL: \(BackendConfig.baseURL)"
    }

}
