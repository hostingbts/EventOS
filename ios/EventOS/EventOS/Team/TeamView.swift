import SwiftUI

struct TeamView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm = TeamViewModel()

    var body: some View {
        List {
            if let team = vm.team {
                Section {
                    HStack(spacing: 16) {
                        stat("\(team.totalTasks)", "Total tasks")
                        stat("\(team.openTasks)", "Open tasks")
                        stat("\(team.members.count)", "Contributors")
                    }
                }

                if team.members.isEmpty {
                    Text("Open an event workspace to create tasks and assign teammates.")
                        .foregroundStyle(.secondary)
                }

                ForEach(team.members) { member in
                    Section(header: memberHeader(member)) {
                        ForEach(member.tasks) { task in
                            NavigationLink {
                                EventWorkspaceView(eventCode: task.eventCode)
                            } label: {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text("\(task.eventCode) — \(task.title)")
                                    Text(task.status.label).font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }
            } else if vm.loading {
                ProgressView("Loading team…")
            } else if let error = vm.error {
                Text(error).foregroundStyle(.red)
            }

            Section {
                Button("Sign out", role: .destructive) {
                    session.signOut()
                }
            }
        }
        .navigationTitle("Team")
        .task { await vm.load() }
        .refreshable { await vm.load() }
    }

    private func memberHeader(_ member: TeamMember) -> some View {
        VStack(alignment: .leading) {
            Text(member.name)
            if !member.email.isEmpty {
                Text(member.email).font(.caption2).foregroundStyle(.secondary)
            }
        }
    }

    private func stat(_ value: String, _ label: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.title3.bold())
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
