import SwiftUI

/// Horizontal icon shortcut row (Team / Tasks / Templates / Designs / Generators),
/// mirroring the icon-menu strip from the web app's navigation.
struct QuickAccessRow: View {
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 20) {
                NavigationLink { TeamView() } label: {
                    QuickAccessIcon(icon: "person.2.fill", label: "Team")
                }
                NavigationLink { TaskTemplatesView() } label: {
                    QuickAccessIcon(icon: "doc.text.fill", label: "Tasks")
                }
                NavigationLink {
                    ComingSoonView(title: "Templates", icon: "doc.on.doc.fill", message: "Org-wide document templates are coming to the iOS app soon.")
                } label: {
                    QuickAccessIcon(icon: "doc.on.doc.fill", label: "Templates")
                }
                NavigationLink {
                    ComingSoonView(title: "Designs", icon: "paintbrush.fill", message: "Badge, table tent, certificate, and banner design tools are coming to the iOS app soon.")
                } label: {
                    QuickAccessIcon(icon: "paintbrush.fill", label: "Designs")
                }
                NavigationLink {
                    ComingSoonView(title: "Generators", icon: "bolt.fill", message: "AV equipment, transfer list, per-diem, and SOW generator tools are coming to the iOS app soon.")
                } label: {
                    QuickAccessIcon(icon: "bolt.fill", label: "Generators")
                }
            }
            .padding(.horizontal, 2)
        }
        .buttonStyle(.plain)
    }
}

private struct QuickAccessIcon: View {
    let icon: String
    let label: String

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundStyle(Theme.textPrimary)
                .frame(width: 52, height: 52)
                .background(Theme.cardAlt)
                .clipShape(Circle())
                .overlay(Circle().stroke(Theme.border, lineWidth: 1))
            Text(label).font(.caption2).foregroundStyle(Theme.textSecondary)
        }
        .frame(width: 68)
    }
}
