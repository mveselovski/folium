// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "Folium",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(name: "Folium", path: "Sources/Folium")
    ]
)
