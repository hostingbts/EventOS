import SwiftUI

struct EventWorkspaceView: View {
    @EnvironmentObject private var session: SessionStore
    @StateObject private var vm: WorkspaceViewModel
    @State private var tab: Tab = .tasks

    enum Tab: String, CaseIterable, Identifiable {
        case tasks = "Tasks", overview = "Overview", activity = "Activity"
        var id: String { rawValue }
    }

    init(eventCode: String) {
        _vm = StateObject(wrappedValue: WorkspaceViewModel(eventCode: eventCode))
    }

    var body: some View {
        Group {
            if vm.loading {
                ProgressView("Loading workspace…")
            } else if let error = vm.error, vm.data == nil {
                Text(error).foregroundStyle(.red)
            } else if let data = vm.data {
                content(data)
            }
        }
        .navigationTitle(vm.eventCode)
        .navigationBarTitleDisplayMode(.inline)
        .task { await vm.load() }
        .refreshable { await vm.load() }
    }

    @ViewBuilder
    private func content(_ data: WorkspaceData) -> some View {
        VStack(spacing: 0) {
            readinessBar

            Picker("Tab", selection: $tab) {
                ForEach(Tab.allCases) { Text($0.rawValue).tag($0) }
            }
            .pickerStyle(.segmented)
            .padding()

            switch tab {
            case .tasks: taskList(data)
            case .overview: overview(data)
            case .activity: activityLog(data)
            }
        }
    }

    private var readinessBar: some View {
        let r = vm.readiness
        return Group {
            if r.total > 0 {
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text("Operational readiness").font(.caption).foregroundStyle(.secondary)
                        Spacer()
                        Text("\(Int(Double(r.done) / Double(r.total) * 100))%").font(.caption.bold())
                    }
                    ProgressView(value: Double(r.done), total: Double(r.total))
                    HStack(spacing: 12) {
                        Text("\(r.done) complete").font(.caption2).foregroundStyle(.green)
                        Text("\(r.total - r.done) remaining").font(.caption2).foregroundStyle(.secondary)
                        if r.blocked > 0 { Text("\(r.blocked) blocked").font(.caption2).foregroundStyle(.red) }
                        if r.overdue > 0 { Text("\(r.overdue) overdue").font(.caption2).foregroundStyle(.orange) }
                    }
                }
                .padding(.horizontal)
                .padding(.top, 8)
            }
        }
    }

    private func taskList(_ data: WorkspaceData) -> some View {
        List {
            Section {
                HStack {
                    TextField("New task title", text: $vm.newTaskTitle)
                        .textFieldStyle(.roundedBorder)
                    Button("Add") {
                        Task { await vm.createTask(createdBy: session.user?.email ?? "") }
                    }
                    .disabled(vm.newTaskTitle.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }

            if data.tasks.isEmpty {
                Text("No operational tasks yet.").foregroundStyle(.secondary)
            }

            ForEach(data.tasks) { task in
                TaskRow(task: task, busy: vm.busyTaskId == task.taskId) {
                    Task { await vm.toggleComplete(task, actorEmail: session.user?.email ?? "") }
                } onStatusChange: { newStatus in
                    Task { await vm.updateStatus(task, to: newStatus, actorEmail: session.user?.email ?? "") }
                }
            }
        }
        .listStyle(.plain)
    }

    private func overview(_ data: WorkspaceData) -> some View {
        List {
            Section("Event details") {
                LabeledContent("Location", value: data.event.location.isEmpty ? "—" : data.event.location)
                LabeledContent("Dates", value: data.event.dates.isEmpty ? "—" : data.event.dates)
                LabeledContent("Venue", value: data.event.venue.isEmpty ? "—" : data.event.venue)
                LabeledContent("LEM", value: data.event.lem.isEmpty ? "—" : data.event.lem)
                LabeledContent("AV", value: data.event.av.isEmpty ? "—" : data.event.av)
                LabeledContent("Interpreters", value: data.event.interpreters.isEmpty ? "—" : data.event.interpreters)
                LabeledContent("SOW", value: data.event.sow.isEmpty ? "—" : data.event.sow)
                LabeledContent("Owner", value: data.event.ownerEmail.isEmpty ? "—" : data.event.ownerEmail)
                if !data.event.notes.isEmpty {
                    Text(data.event.notes).font(.footnote).foregroundStyle(.secondary)
                }
                if let url = data.event.driveFolderUrl, let link = URL(string: url) {
                    Link("Open Drive folder", destination: link)
                }
            }

            Section("Event-wide discussion") {
                ForEach(vm.eventLevelComments) { comment in
                    CommentRow(comment: comment)
                }
                commentComposer(taskId: nil)
            }
        }
    }

    private func activityLog(_ data: WorkspaceData) -> some View {
        List {
            if data.activity.isEmpty {
                Text("No activity yet.").foregroundStyle(.secondary)
            }
            ForEach(data.activity) { item in
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.summary)
                    HStack {
                        Text(item.actor).font(.caption).foregroundStyle(.secondary)
                        Spacer()
                        Text(item.createdAt).font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }
        }
        .listStyle(.plain)
    }

    private func commentComposer(taskId: String?) -> some View {
        HStack {
            TextField("Add a comment…", text: $vm.newCommentBody)
                .textFieldStyle(.roundedBorder)
            Button("Post") {
                Task {
                    await vm.addComment(taskId: taskId, authorEmail: session.user?.email ?? "", authorName: session.user?.name ?? "")
                }
            }
            .disabled(vm.newCommentBody.trimmingCharacters(in: .whitespaces).isEmpty)
        }
    }
}

private struct TaskRow: View {
    let task: EventTask
    let busy: Bool
    let onToggle: () -> Void
    let onStatusChange: (TaskStatus) -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button(action: onToggle) {
                Image(systemName: task.status == .done ? "checkmark.circle.fill" : "circle")
                    .foregroundStyle(task.status == .done ? .green : .secondary)
                    .font(.title3)
            }
            .buttonStyle(.plain)
            .disabled(busy)

            VStack(alignment: .leading, spacing: 2) {
                Text(task.title)
                    .strikethrough(task.status == .done)
                    .foregroundStyle(task.status == .done ? .secondary : .primary)
                HStack(spacing: 6) {
                    if !task.category.isEmpty {
                        Text(task.category).font(.caption2).foregroundStyle(.secondary)
                    }
                    if !task.assigneeName.isEmpty {
                        Text("• \(task.assigneeName)").font(.caption2).foregroundStyle(.secondary)
                    }
                    if !task.dueDate.isEmpty {
                        Text("• due \(task.dueDate.prefix(10))").font(.caption2).foregroundStyle(.secondary)
                    }
                }
            }

            Spacer()

            Menu {
                ForEach(TaskStatus.allCases, id: \.self) { status in
                    Button(status.label) { onStatusChange(status) }
                }
            } label: {
                StatusBadge(status: task.status)
            }
            .disabled(busy)
        }
        .padding(.vertical, 4)
        .opacity(busy ? 0.5 : 1)
    }
}

private struct StatusBadge: View {
    let status: TaskStatus

    private var color: Color {
        switch status {
        case .todo: return .gray
        case .in_progress: return .blue
        case .blocked: return .red
        case .done: return .green
        }
    }

    var body: some View {
        Text(status.label)
            .font(.caption2.weight(.medium))
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
}

private struct CommentRow: View {
    let comment: Comment

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(comment.authorName.isEmpty ? comment.authorEmail : comment.authorName).font(.caption.bold())
                Spacer()
                Text(comment.createdAt).font(.caption2).foregroundStyle(.secondary)
            }
            Text(comment.body).font(.subheadline)
        }
        .padding(.vertical, 2)
    }
}
