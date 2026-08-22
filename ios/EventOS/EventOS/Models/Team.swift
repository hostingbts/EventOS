import Foundation

struct TeamMember: Codable, Identifiable {
    var email: String
    var name: String
    var tasks: [EventTask]

    var id: String { email.isEmpty ? name : email }
}

struct TeamOverview: Codable {
    var members: [TeamMember]
    var totalTasks: Int
    var openTasks: Int
}

struct WhoAmI: Codable {
    var isAdmin: Bool
    var email: String
}

struct AuthAccount: Codable, Equatable {
    var id: String
    var name: String
    var email: String
    var passwordHash: String
    var createdAt: String
}
