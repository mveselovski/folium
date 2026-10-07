// Renders the Folium app icon into an .iconset folder.
// Usage: swift make-icon.swift <output.iconset>
import AppKit

let out = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)

func render(size: Int) -> Data {
    let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
        samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
        bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    let ctx = NSGraphicsContext.current!.cgContext
    let s = CGFloat(size) / 1024
    ctx.scaleBy(x: s, y: s)

    // Squircle-ish tile on the standard macOS icon grid (824pt inside 1024).
    let tile = NSBezierPath(roundedRect: NSRect(x: 100, y: 100, width: 824, height: 824), xRadius: 185, yRadius: 185)
    NSGraphicsContext.saveGraphicsState()
    let shadow = NSShadow()
    shadow.shadowColor = NSColor.black.withAlphaComponent(0.3)
    shadow.shadowOffset = NSSize(width: 0, height: -10)
    shadow.shadowBlurRadius = 24
    shadow.set()
    NSColor(red: 0.12, green: 0.36, blue: 0.24, alpha: 1).setFill()
    tile.fill()
    NSGraphicsContext.restoreGraphicsState()
    NSGradient(
        starting: NSColor(red: 0.27, green: 0.62, blue: 0.40, alpha: 1),
        ending: NSColor(red: 0.10, green: 0.34, blue: 0.22, alpha: 1)
    )!.draw(in: tile, angle: -90)

    // Leaf: two arcs from the stem (bottom-left) to the tip (top-right).
    let base = NSPoint(x: 300, y: 290)
    let tip = NSPoint(x: 740, y: 750)
    let leaf = NSBezierPath()
    leaf.move(to: base)
    leaf.curve(to: tip, controlPoint1: NSPoint(x: 230, y: 600), controlPoint2: NSPoint(x: 470, y: 770))
    leaf.curve(to: base, controlPoint1: NSPoint(x: 760, y: 480), controlPoint2: NSPoint(x: 560, y: 260))
    leaf.close()
    NSColor(white: 1, alpha: 0.96).setFill()
    leaf.fill()

    // Midrib, veins and stem.
    NSColor(red: 0.18, green: 0.48, blue: 0.31, alpha: 1).setStroke()
    let rib = NSBezierPath()
    rib.lineWidth = 18
    rib.lineCapStyle = .round
    rib.move(to: NSPoint(x: 250, y: 240))
    rib.curve(to: NSPoint(x: 700, y: 705), controlPoint1: NSPoint(x: 420, y: 400), controlPoint2: NSPoint(x: 560, y: 560))
    for (from, to) in [((420, 410), (360, 560)), ((520, 510), (480, 660)), ((420, 410), (590, 380)), ((520, 510), (680, 500))] {
        rib.move(to: NSPoint(x: from.0, y: from.1))
        rib.line(to: NSPoint(x: to.0, y: to.1))
    }
    rib.stroke()

    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])!
}

for points in [16, 32, 128, 256, 512] {
    try render(size: points).write(to: out.appendingPathComponent("icon_\(points)x\(points).png"))
    try render(size: points * 2).write(to: out.appendingPathComponent("icon_\(points)x\(points)@2x.png"))
}
