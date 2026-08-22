import SwiftUI

/// Small circular floating button pinned above the tab bar, mirroring the
/// dark floating icon button seen on Stake's screens.
struct FloatingActionButton: View {
    let systemImage: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 20, weight: .semibold))
                .foregroundStyle(Theme.textPrimary)
                .frame(width: 54, height: 54)
                .background(Theme.cardAlt)
                .clipShape(Circle())
                .overlay(Circle().stroke(Theme.border, lineWidth: 1))
                .shadow(color: .black.opacity(0.4), radius: 10, y: 4)
        }
        .buttonStyle(.plain)
    }
}
