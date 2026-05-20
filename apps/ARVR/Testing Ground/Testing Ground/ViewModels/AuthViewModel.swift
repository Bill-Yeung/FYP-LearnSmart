import Foundation
import Observation

@MainActor @Observable
class AuthViewModel {

    var isAuthenticated = false
    var isLoading = false
    var errorMessage: String?
    var currentUser: UserSession?
    
    // Computed property for easy access to access token
    var accessToken: String? {
        currentUser?.accessToken
    }

    private let api = APIService.shared

    init() {
        // Check for existing token on launch
        if KeychainService.get(forKey: "access_token") != nil {
            isAuthenticated = true
        }
    }

    func login(email: String, password: String) async {
        print("[Auth] login → \(email) | backend: \(BackendConfig.baseURL)")
        isLoading = true
        errorMessage = nil
        do {
            let session = try await api.login(email: email, password: password)
            currentUser = session
            isAuthenticated = true
            print("[Auth] login OK → userId: \(session.userId) role: \(session.role)")
        } catch {
            errorMessage = error.localizedDescription
            print("[Auth] login FAILED → \(error)")
        }
        isLoading = false
    }

    func register(email: String, password: String, username: String, displayName: String) async {
        print("[Auth] register → \(email) | backend: \(BackendConfig.baseURL)")
        isLoading = true
        errorMessage = nil
        do {
            let session = try await api.register(
                email: email, password: password,
                username: username, displayName: displayName
            )
            currentUser = session
            isAuthenticated = true
            print("[Auth] register OK → userId: \(session.userId)")
        } catch {
            errorMessage = error.localizedDescription
            print("[Auth] register FAILED → \(error)")
        }
        isLoading = false
    }

    func restoreSession() async {
        guard KeychainService.get(forKey: "access_token") != nil else {
            print("[Auth] restoreSession → no token in Keychain")
            return
        }
        print("[Auth] restoreSession → token found, fetching profile | backend: \(BackendConfig.baseURL)")
        do {
            let profile = try await api.getProfile()
            currentUser = UserSession(
                accessToken: KeychainService.get(forKey: "access_token") ?? "",
                refreshToken: KeychainService.get(forKey: "refresh_token") ?? "",
                userId: profile.id,
                email: profile.email,
                displayName: profile.displayName ?? profile.username ?? profile.email,
                role: profile.role
            )
            isAuthenticated = true
            print("[Auth] restoreSession OK → userId: \(profile.id)")
        } catch {
            print("[Auth] restoreSession FAILED → \(error), logging out")
            logout()
        }
    }

    func logout() {
        api.logout()
        currentUser = nil
        isAuthenticated = false
    }
}
