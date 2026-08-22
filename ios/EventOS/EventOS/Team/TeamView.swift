import SwiftUI

struct TeamView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm = TeamViewModel()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                if let team = vm.team {
                    statsCard(team)

                    if team.members.isEmpty {
                        Text("Open an event workspace to create tasks and assign teammates.")
                            .foregroundStyle(Theme.textSecondary)
                    }

                    ForEach(team.members) { member in
                        memberCard(member)
                    }
                } else if vm.loading {
                    ProgressView("Loading team…").tint(Theme.green)
                        .frame(maxWidth: .infinity)
                        .padding(.top, 40)
                } else if let error = vm.error {
                    Text(error).foregroundStyle(Theme.statusRisk)
                }

                Button {
                    session.signOut()
                } label: {
                    Text("Sign out").frame(maxWidth: .infinity)
                }
                .buttonStyle(StakeSecondaryButtonStyle(tint: Theme.statusRisk))
            }
            .padding(16)
        }
        .background(Theme.bg)
        .navigationTitle("Team")
        .task { await vm.load() }
        .refreshable { await vm.load() }
    }

    private func statsCard(_ team: TeamOverview) -> some View {
        HStack(spacing: 0) {
            StatBlock(value: "\(team.totalTasks)", label: "Total tasks")
            StatBlock(value: "\(team.openTasks)", label: "Open tasks")
            StatBlock(value: "\(team.members.count)", label: "Contributors", color: Theme.green)
        }
        .cardStyle()
    }

    private func memberCard(_ member: TeamMember) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 10) {
                ZStack {
                    Circle().fill(Theme.headerGradient).frame(width: 36, height: 36)
                    Text(member.name.prefix(1).uppercased())
                        .font(.caption.bold()).foregroundStyle(.white)
                }
                VStack(alignment: .leading, spacing: 1) {
                    Text(member.name).font(.subheadline.bold()).foregroundStyle(Theme.textPrimary)
                    if !member.email.isEmpty {
                        Text(member.email).font(.caption2).foregroundStyle(Theme.textSecondary)
                    }
                }
                Spacer()
                Text("\(member.tasks.count)").font(.caption.bold()).foregroundStyle(Theme.green)
            }

            VStack(spacing: 8) {
                ForEach(member.tasks) { task in
                    NavigationLink {
                        EventWorkspaceView(eventCode: task.eventCode)
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 1) {
                                Text(task.eventCode).font(.caption.bold()).foregroundStyle(Theme.textSecondary)
                                Text(task.title).font(.subheadline).foregroundStyle(Theme.textPrimary)
                            }
                            Spacer()
                            statusPill(task.status)
                        }
                        .padding(10)
                        .background(Theme.cardAlt)
                        .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .cardStyle()
    }

    private func statusPill(_ status: TaskStatus) -> some View {
        let color: Color
        switch status {
        case .todo: color = Theme.textTertiary
        case .in_progress: color = Theme.statusInfo
        case .blocked: color = Theme.statusRisk
        case .done: color = Theme.statusGood
        }
        return Text(status.label.replacingOccurrences(of: "_", with: " "))
            .font(.caption2.weight(.semibold))
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.18))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
}

/// Outlined secondary button (mirrors Stake's "Sign out"-equivalent destructive/secondary actions).
struct StakeSecondaryButtonStyle: ButtonStyle {
    var tint: Color = Theme.textPrimary

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .foregroundStyle(tint)
            .padding(.vertical, 14)
            .background(Theme.card)
            .clipShape(RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: Theme.cornerSmall, style: .continuous).stroke(tint.opacity(0.4), lineWidth: 1)
            )
            .opacity(configuration.isPressed ? 0.85 : 1)
    }
}
