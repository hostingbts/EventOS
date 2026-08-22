import SwiftUI

struct RootView: View {
    @EnvironmentObject private var session: SessionStore

    var body: some View {
        Group {
            if !session.isReady {
                ProgressView()
            } else if session.user != nil {
                RootTabView()
            } else {
                LoginView()
            }
        }
    }
}

struct RootTabView: View {
    var body: some View {
        TabView {
            NavigationStack {
                DashboardView()
            }
            .tabItem { Label("Events", systemImage: "calendar") }

            NavigationStack {
                TeamView()
            }
            .tabItem { Label("Team", systemImage: "person.2") }
        }
    }
}
