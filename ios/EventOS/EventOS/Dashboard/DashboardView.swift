import SwiftUI

struct DashboardView: View {
    @StateObject private var vm = DashboardViewModel()

    var body: some View {
        List {
            if vm.summary.total > 0 {
                Section {
                    HealthSummaryRow(summary: vm.summary)
                }
            }

            Section {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(DashboardFilter.allCases) { filter in
                            FilterChip(filter: filter, isSelected: vm.filter == filter) {
                                vm.filter = filter
                            }
                        }
                    }
                }
                .listRowInsets(EdgeInsets())
                .padding(.vertical, 4)
                .padding(.horizontal, 12)
            }

            if vm.loading {
                ProgressView("Loading events…")
            } else if let error = vm.error {
                Text(error).foregroundStyle(.red)
            } else if vm.events.isEmpty {
                Text("No events yet.").foregroundStyle(.secondary)
            }

            ForEach(vm.activeGroups) { group in
                Section(header: monthHeader(group)) {
                    ForEach(group.events) { event in
                        NavigationLink {
                            EventWorkspaceView(eventCode: event.code)
                        } label: {
                            EventRow(event: event, health: vm.healthByCode[event.code], daysUntilStart: vm.daysUntilStart(event), isHappening: vm.isHappening(event))
                        }
                    }
                }
            }

            if !vm.loading && vm.activeCount == 0 && !vm.events.isEmpty {
                Text("No active events match the current filter.").foregroundStyle(.secondary)
            }

            if !vm.completedGroups.isEmpty {
                Section {
                    Button {
                        vm.showCompleted.toggle()
                    } label: {
                        HStack {
                            Text("Completed events")
                            Spacer()
                            Text("\(vm.completedGroups.reduce(0) { $0 + $1.events.count })").foregroundStyle(.secondary)
                            Image(systemName: vm.showCompleted ? "chevron.up" : "chevron.down")
                        }
                    }
                    .foregroundStyle(.primary)
                }

                if vm.showCompleted {
                    ForEach(vm.completedGroups) { group in
                        Section(header: monthHeader(group)) {
                            ForEach(group.events) { event in
                                NavigationLink {
                                    EventWorkspaceView(eventCode: event.code)
                                } label: {
                                    EventRow(event: event, health: vm.healthByCode[event.code], daysUntilStart: nil, isHappening: false)
                                }
                            }
                        }
                    }
                }
            }
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Event Operations")
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Task { await vm.load() }
                } label: {
                    Image(systemName: "arrow.clockwise")
                }
                .disabled(vm.loading)
            }
        }
        .task { await vm.load() }
        .refreshable { await vm.load() }
    }

    private func monthHeader(_ group: MonthGroup) -> some View {
        HStack {
            Text(group.month)
            Spacer()
            Text("\(group.events.count)")
        }
    }
}

private struct HealthSummaryRow: View {
    let summary: (total: Int, avgCompletion: Int, onTrack: Int, attention: Int, atRisk: Int, critical: Int)

    var body: some View {
        HStack(spacing: 16) {
            stat("\(summary.avgCompletion)%", "Completion")
            stat("\(summary.onTrack)", "On track", color: .green)
            stat("\(summary.attention)", "Attention", color: .orange)
            stat("\(summary.atRisk + summary.critical)", "At risk", color: .red)
        }
    }

    private func stat(_ value: String, _ label: String, color: Color = .primary) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(value).font(.title3.bold()).foregroundStyle(color)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

private struct FilterChip: View {
    let filter: DashboardFilter
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(filter.label)
                .font(.footnote.weight(.medium))
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? Color.accentColor : Color(.secondarySystemFill))
                .foregroundStyle(isSelected ? Color.white : Color.primary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }
}

private struct EventRow: View {
    let event: Event
    let health: EventHealth?
    let daysUntilStart: Int?
    let isHappening: Bool

    private var tierColor: Color {
        switch health?.tier {
        case "on-track": return .green
        case "attention": return .orange
        case "at-risk": return .red
        case "critical": return .red
        default: return .gray
        }
    }

    var body: some View {
        HStack(spacing: 12) {
            RoundedRectangle(cornerRadius: 2).fill(tierColor).frame(width: 4)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(event.code).font(.headline)
                    if event.venue.trimmingCharacters(in: .whitespaces).isEmpty {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(.orange)
                            .font(.caption)
                    }
                    if isHappening {
                        Text("● Now").font(.caption2.bold()).foregroundStyle(.green)
                    } else if let days = daysUntilStart, days >= 0, days <= 7 {
                        Text(days == 0 ? "Today" : "In \(days)d").font(.caption2.bold()).foregroundStyle(.orange)
                    }
                }
                Text(event.location.isEmpty ? "—" : event.location)
                    .font(.subheadline).foregroundStyle(.secondary)
                Text(event.dates).font(.caption).foregroundStyle(.secondary)
            }

            Spacer()

            if let health {
                VStack(alignment: .trailing, spacing: 4) {
                    Text("\(health.completion)%").font(.subheadline.bold())
                    Text("\(health.doneTasks)/\(health.totalTasks)").font(.caption2).foregroundStyle(.secondary)
                }
            }
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    NavigationStack { DashboardView() }
}
