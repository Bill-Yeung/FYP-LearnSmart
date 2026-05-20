import Foundation
import Observation

@MainActor @Observable
class AuthViewModel {

    var isAuthenticated = false
    var isLoading = false
    var errorMessage: String?
    var currentUser: UserSession?

    private let api = APIService.shared

    init() {
        // Check for existing token on launch
        if KeychainService.get(forKey: "access_token") != nil {
            isAuthenticated = true
        }
    }

    func login(email: String, password: String) async {
        isLoading = true
        errorMessage = nil
        do {
            let session = try await api.login(email: email, password: password)
            currentUser = session
            isAuthenticated = true
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func register(email: String, password: String, username: String, displayName: String) async {
        isLoading = true
        errorMessage = nil
        do {
            let session = try await api.register(
                email: email, password: password,
                username: username, displayName: displayName
            )
            currentUser = session
            isAuthenticated = true
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
    }

    func restoreSession() async {
        guard KeychainService.get(forKey: "access_token") != nil else { return }
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
        } catch {
            // Token expired and refresh failed
            logout()
        }
    }

    func logout() {
        api.logout()
        currentUser = nil
        isAuthenticated = false
    }
}
