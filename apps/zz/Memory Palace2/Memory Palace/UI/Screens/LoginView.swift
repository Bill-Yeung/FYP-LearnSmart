import SwiftUI

struct LoginView: View {

    @Environment(AuthViewModel.self) private var authVM

    @State private var email = ""
    @State private var password = ""
    @State private var username = ""
    @State private var displayName = ""
    @State private var isRegistering = false

    var body: some View {
        ScrollView {
            VStack(spacing: 32) {

                // Logo & Branding
                VStack(spacing: 12) {
                    LearnSmartLogo(size: 64, color: Brand.primary)

                    Text("LearnSmart")
                        .font(.system(size: 36, weight: .bold))
                        .foregroundStyle(.primary)

                    Text("Memory Palace")
                        .font(.title3)
                        .foregroundStyle(.secondary)
                    Text("Learn Smarter, Not Harder")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }

                // Form Card
                VStack(spacing: 20) {
                    Text(isRegistering ? "Create Account" : "Welcome Back")
                        .font(.title2)
                        .fontWeight(.semibold)

                    VStack(spacing: 14) {
                        if isRegistering {
                            formField(icon: "person", placeholder: "Username", text: $username)
                            formField(icon: "person.text.rectangle", placeholder: "Display Name", text: $displayName)
                        }
                        formField(icon: "envelope", placeholder: "Email", text: $email)
                        SecureField("Password", text: $password)
                            .textContentType(isRegistering ? .newPassword : .password)
                            .padding(12)
                            .background(Color.white.opacity(0.1))
                            .clipShape(RoundedRectangle(cornerRadius: 10))
                    }

                    if let error = authVM.errorMessage {
                        Label(error, systemImage: "exclamationmark.triangle")
                            .foregroundStyle(.red)
                            .font(.callout)
                            .multilineTextAlignment(.center)
                    }

                    Button {
                        Task {
                            if isRegistering {
                                await authVM.register(
                                    email: email, password: password,
                                    username: username, displayName: displayName
                                )
                            } else {
                                await authVM.login(email: email, password: password)
                            }
                        }
                    } label: {
                        Group {
                            if authVM.isLoading {
                                ProgressView()
                            } else {
                                Text(isRegistering ? "Create Account" : "Sign In")
                                    .fontWeight(.semibold)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 4)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Brand.primary)
                    .disabled(authVM.isLoading || email.isEmpty || password.isEmpty)

                    Button(isRegistering ? "Already have an account? Sign In" : "Don't have an account? Register") {
                        withAnimation { isRegistering.toggle() }
                        authVM.errorMessage = nil
                    }
                    .font(.callout)
                    .foregroundStyle(.primary)
                }
                .padding(28)
                .frame(maxWidth: 420)
                .background(.thickMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 20))

                // Quick Login (Dev)
                VStack(spacing: 8) {
                    Text("Quick Login")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    HStack(spacing: 10) {
                        quickLoginButton("Student", icon: "person", email: "student@hkive.com")
                        quickLoginButton("Teacher", icon: "person.fill.viewfinder", email: "teacher@hkive.com")
                        quickLoginButton("Admin", icon: "shield", email: "admin@learningplatform.com")
                    }
                }

            }
            .padding(32)
            .frame(maxWidth: .infinity)
        }
    }

    private func quickLoginButton(_ role: String, icon: String, email: String) -> some View {
        Button {
            Task {
                await authVM.login(email: email, password: "password123")
            }
        } label: {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.title3)
                Text(role)
                    .font(.caption)
            }
            .frame(width: 90, height: 56)
        }
        .buttonStyle(.bordered)
        .disabled(authVM.isLoading)
    }

    private func formField(icon: String, placeholder: String, text: Binding<String>) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(Brand.primary)
                .frame(width: 20)
            TextField(placeholder, text: text)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
        }
        .padding(12)
        .background(Color.white.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
