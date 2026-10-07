# Releasing Folium

A release produces:

| Artifact | Built by |
|---|---|
| GitHub release | [release workflow](.github/workflows/release.yml), on tag push |
| `folium-<version>-linux-{x64,arm64}.tar.gz` | release workflow, on tag push |
| `Folium-<version>-{arm64,x64}.dmg` | [`macos/build.sh`](macos/build.sh), on your Mac (needs your Developer ID) |
| Homebrew formula and cask bumps | [mveselovski/homebrew-tap](https://github.com/mveselovski/homebrew-tap)'s hourly update workflow — formula once the tag exists, cask once both dmgs are uploaded |

## Steps

1. Bump `version` in `package.json` and merge to `main`.
2. Tag and push:

   ```bash
   git tag -a v0.2.0 -m "Folium 0.2.0" && git push origin v0.2.0
   ```

   The release workflow checks the tag matches `package.json`, creates the GitHub release, and builds, smoke-tests and uploads the Linux binaries.
3. Build, sign and notarize the macOS app:

   ```bash
   macos/build.sh
   ```

   This writes `dist/Folium-<version>-{arm64,x64}.dmg`. Upload them:

   ```bash
   gh release upload v0.2.0 dist/Folium-0.2.0-*.dmg
   ```
4. The tap's update workflow bumps the formula and cask within the hour. To do it immediately:

   ```bash
   gh workflow run update-folium.yml -R mveselovski/homebrew-tap
   ```

## One-time setup for macOS signing

- Xcode → Settings → Accounts → Manage Certificates → **+** → *Developer ID Application*
- Store notarization credentials, using an app-specific password from [account.apple.com](https://account.apple.com) → Sign-In and Security → App-Specific Passwords:

  ```bash
  xcrun notarytool store-credentials folium-notary --apple-id <apple-id> --team-id <team-id>
  ```

`SKIP_NOTARIZE=1 macos/build.sh` builds a signed app without notarizing, for local testing. `ARCHS=arm64` builds one architecture.

## Building the Linux binary locally

`scripts/build-standalone.sh` builds for the Linux machine it runs on, using the `node` on `PATH` (use Node 24, matching the workflow). From a Mac, run it in a container:

```bash
docker run --rm --platform linux/amd64 -v "$PWD":/src -w /src node:24.21.0-bookworm \
  bash -c 'npm ci && scripts/build-standalone.sh'
```

Note that `npm ci` inside the container replaces `node_modules` with Linux builds; run `npm ci` again on the Mac afterwards.
