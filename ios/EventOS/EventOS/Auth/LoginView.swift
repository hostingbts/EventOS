import SwiftUI

struct LoginView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm = AuthViewModel()
    @FocusState private var focusedField: Field?

    enum Field { case email, password, confirm, name }

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                brand

                switch vm.step {
                case .email: emailStep
                case .password: passwordStep
                case .notFound: notFoundStep
                case .register: registerStep
                }
            }
            .padding(24)
            .frame(maxWidth: 420)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
    }

    private var brand: some View {
        VStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: 44))
                .foregroundStyle(.teal)
            Text("EventOS")
                .font(.title.bold())
        }
        .padding(.top, 40)
    }

    private var errorText: some View {
        Group {
            if let error = vm.error {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
            }
        }
    }

    private var emailStep: some View {
        VStack(spacing: 16) {
            Text("Welcome to EventOS").font(.title2.bold())
            Text("Don't have an account? Enter your email to get started.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)

            VStack(alignment: .leading, spacing: 6) {
                Text("Work email").font(.caption).foregroundStyle(.secondary)
                TextField("name@company.com", text: $vm.email)
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .focused($focusedField, equals: .email)
                    .submitLabel(.continue)
                    .onSubmit { Task { await vm.continueWithEmail() } }
            }

            errorText

            Button {
                Task { await vm.continueWithEmail() }
            } label: {
                if vm.loading {
                    ProgressView().frame(maxWidth: .infinity)
                } else {
                    Text("Continue to EventOS").frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(vm.loading)
        }
        .onAppear { focusedField = .email }
    }

    private var passwordStep: some View {
        VStack(spacing: 16) {
            backButton(action: vm.goBackToEmail)
            Text("Welcome back").font(.title2.bold())
            Text(vm.email).font(.footnote).foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 6) {
                Text("Password").font(.caption).foregroundStyle(.secondary)
                SecureField("Enter your password", text: $vm.password)
                    .textFieldStyle(.roundedBorder)
                    .focused($focusedField, equals: .password)
                    .submitLabel(.go)
                    .onSubmit { Task { await vm.signIn(session: session) } }
            }

            errorText

            Button {
                Task { await vm.signIn(session: session) }
            } label: {
                if vm.loading {
                    ProgressView().frame(maxWidth: .infinity)
                } else {
                    Text("Sign in").frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(vm.loading)
        }
        .onAppear { focusedField = .password }
    }

    private var notFoundStep: some View {
        VStack(spacing: 16) {
            backButton(action: vm.goBackToEmail)
            Text("No account found").font(.title2.bold())
            Text("We couldn't find an account for **\(vm.email)**.")
                .font(.subheadline)
                .multilineTextAlignment(.center)

            errorText

            Button {
                vm.error = nil
                vm.step = .register
            } label: {
                Text("Create an account").frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
        }
    }

    private var registerStep: some View {
        VStack(spacing: 16) {
            backButton { vm.step = .notFound }
            Text("Create your account").font(.title2.bold())
            Text(vm.email).font(.footnote).foregroundStyle(.secondary)

            VStack(alignment: .leading, spacing: 6) {
                Text("Full name").font(.caption).foregroundStyle(.secondary)
                TextField("Jane Doe", text: $vm.name)
                    .textFieldStyle(.roundedBorder)
                    .focused($focusedField, equals: .name)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Password").font(.caption).foregroundStyle(.secondary)
                SecureField("At least 8 characters", text: $vm.password)
                    .textFieldStyle(.roundedBorder)
                    .focused($focusedField, equals: .password)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Confirm password").font(.caption).foregroundStyle(.secondary)
                SecureField("Repeat password", text: $vm.confirmPassword)
                    .textFieldStyle(.roundedBorder)
                    .focused($focusedField, equals: .confirm)
                    .submitLabel(.go)
                    .onSubmit { Task { await vm.register(session: session) } }
            }

            errorText

            Button {
                Task { await vm.register(session: session) }
            } label: {
                if vm.loading {
                    ProgressView().frame(maxWidth: .infinity)
                } else {
                    Text("Create account").frame(maxWidth: .infinity)
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(vm.loading)
        }
        .onAppear { focusedField = .name }
    }

    private func backButton(action: @escaping () -> Void) -> some View {
        HStack {
            Button(action: action) {
                Label("Back", systemImage: "chevron.left")
            }
            Spacer()
        }
    }
}

#Preview {
    LoginView().environmentObject(SessionStore())
}
