import Foundation

@MainActor
final class TeamViewModel: ObservableObject {
    @Published var team: TeamOverview?
    @Published var loading = true
    @Published var error: String?

    func load() async {
        loading = true
        error = nil
        do {
            team = try await EventOSService.fetchTeamOverview()
        } catch {
            self.error = error.localizedDescription
        }
        loading = false
    }
}
