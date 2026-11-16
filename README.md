# Dexor

Dexor is a Windows desktop macro hub with a public, static online catalogue. The desktop client can capture the primary display, compare sampled screen colours, send configured mouse/keyboard input, run a timed clicker, and open a configured game executable. Macro packages contain data only; the client accepts a small allowlist of actions and never evaluates downloaded code.

## Run the desktop app

1. Install Node.js 20 or newer.
2. In this folder, run `npm install`.
3. Run `npm start`.

To build the Windows installer, run `npm run package:win`. For a portable ZIP, run `npm run package:portable:zip`. Both outputs appear in `release/`.

## Online catalogue and downloads

The catalogue is `public/catalog.json`. The desktop client reads it from the URL configured in **Ustawienia → Katalog online**. Before publishing, replace the placeholder URL in `desktop/config.json` with the GitHub Pages URL for the public repository.

The landing page is in `public/`. GitHub Pages publishes it from `/public`. The Windows installer and portable ZIP are published as GitHub Release assets; the workflow in `.github/workflows/release.yml` builds and attaches them when a version tag such as `v0.1.0` is pushed.

GitHub Pages and Releases are free for public projects within GitHub's usage limits. The Pages source and catalogue are public. The online catalogue is read-only for app users: adding or updating a macro means updating `public/catalog.json` in the repository and publishing that change.

## Macro actions

The editor supports `click`, `key`, `wait`, `waitColor`, `fischTrack`, and `launchGame` steps. `waitColor` watches one sampled point on the primary screen. Use the screenshot preview to sample the point and its current colour. `fischTrack` calibrates the fishing bar and fish marker from the screenshot, then holds or releases the left mouse button to follow the marker. It controls the fishing minigame only; casting the rod is a separate macro step. A routine can repeat until stopped. F8 stops a running routine; F6 toggles the auto-clicker.

Game profiles are starting templates and need calibration for each game's current UI and display resolution. The included Fisch profiles are not guaranteed to work without setting the in-game positions and colours. Fortnite's launcher profile opens the executable path selected by the user; it does not play a match automatically.

## Notes

- Screen capture and input run locally on Windows. The online service only provides the public macro catalogue and installer files.
- Dexor is an independent project and is not affiliated with Roblox, Epic Games, ExoPanda, or any game publisher.
- Use macros only where the game and its rules permit them.
