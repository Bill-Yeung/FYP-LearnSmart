//
//  SettingsView.swift
//  Testing Ground
//
//  Created by ituser on 29/1/2026.
//

import SwiftUI

struct SettingsView: View {
    @Environment(AppModel.self) private var appModel
    @State private var backendURL: String = ""
    @State private var showingURLEditor = false
    @State private var isDiscovering = false
    @State private var connectionStatus: String = ""

    var body: some View {
        Form {
            Section(header: Text("Backend Connection"), footer: Text("Backend is auto-discovered on first search. Manual discovery scans your network immediately.")) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Current URL:")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Text(AssetAPIService.shared.baseURL)
                        .font(.system(.caption, design: .monospaced))
                        .foregroundColor(.blue)
                }
                
                #if targetEnvironment(simulator) || os(iOS)
                if let ip = getDeviceIP() {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Device IP:")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Text(ip)
                            .font(.system(.caption, design: .monospaced))
                    }
                }
                
                Button(isDiscovering ? "Discovering..." : "Discover Backend Now") {
                    Task {
                        isDiscovering = true
                        if let discovered = await AssetAPIService.shared.discoverBackend() {
                            AssetAPIService.shared.setBackendURL(discovered)
                            connectionStatus = "Found backend!"
                        } else {
                            connectionStatus = "No backend found on network"
                        }
                        isDiscovering = false
                    }
                }
                .disabled(isDiscovering)
                #endif
                
                Button("Set Custom Backend URL") {
                    backendURL = UserDefaults.standard.string(forKey: "BackendURL") ?? ""
                    showingURLEditor = true
                }
                
                if UserDefaults.standard.string(forKey: "BackendURL") != nil {
                    Button("Reset to Auto-Detect", role: .destructive) {
                        AssetAPIService.shared.clearBackendURL()
                        connectionStatus = "Reset to auto-detection"
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
        .alert("Set Backend URL", isPresented: $showingURLEditor) {
            TextField("http://192.168.x.x:8000/api/models", text: $backendURL)
            Button("Cancel", role: .cancel) { }
            Button("Save") {
                if !backendURL.isEmpty {
                    AssetAPIService.shared.setBackendURL(backendURL)
                }
            }
        } message: {
            Text("Enter your Mac's IP address. Find it by running: ifconfig | grep 'inet '")
        }
    }
    
    private func getDeviceIP() -> String? {
        var address: String?
        var ifaddr: UnsafeMutablePointer<ifaddrs>?
        
        if getifaddrs(&ifaddr) == 0 {
            var ptr = ifaddr
            while ptr != nil {
                defer { ptr = ptr?.pointee.ifa_next }
                
                guard let interface = ptr?.pointee else { continue }
                let addrFamily = interface.ifa_addr.pointee.sa_family
                
                if addrFamily == UInt8(AF_INET) {
                    let name = String(cString: interface.ifa_name)
                    if name == "en0" || name == "pdp_ip0" {
                        var hostname = [CChar](repeating: 0, count: Int(NI_MAXHOST))
                        getnameinfo(
                            interface.ifa_addr,
                            socklen_t(interface.ifa_addr.pointee.sa_len),
                            &hostname,
                            socklen_t(hostname.count),
                            nil,
                            socklen_t(0),
                            NI_NUMERICHOST
                        )
                        address = String(cString: hostname)
                    }
                }
            }
            freeifaddrs(ifaddr)
        }
        return address
    }
    
}
