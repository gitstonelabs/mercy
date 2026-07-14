# Installing StoneLabs Printer UI v2

This is a first-draft install guide. It targets a host that already runs Klipper and Moonraker. The UI is a Moonraker client; it does not install or configure Klipper.

## 1. What this is and what it needs

StoneLabs Printer UI v2 is a static web app (HTML, CSS, JavaScript) built by Vite. You serve the built files from the printer host and open them in a browser, or run them full-screen on an attached touchscreen (kiosk mode). You can do both at once.

You need:

- A host already running Klipper and Moonraker. If you have no Klipper yet, set it up first with KIAUH (https://github.com/dw-0/kiauh) or start from a MainsailOS image, then come back here.
- Moonraker reachable over the network (default port 7125).
- A browser on your phone or computer, or a screen attached to the host for kiosk mode.

## 2. Supported targets

- Raspberry Pi (Pi 3, Pi 4, Pi 5, Zero 2 W).
- Generic Linux SBC running Debian or Ubuntu (Jetson, Orange Pi, and similar).

Windows and macOS are not supported yet as a host. You can still open the UI from a Windows or Mac browser; only the host that serves it must be Linux for now.

## 3. Prerequisites checklist

Before you start, confirm:

- [ ] Klipper is running. `systemctl status klipper` shows active.
- [ ] Moonraker is running. `systemctl status moonraker` shows active.
- [ ] Moonraker answers on the network. From another machine: `curl http://<host-ip>:7125/printer/info` returns JSON.
- [ ] You know the host's IP or hostname. `hostname -I` prints the IP.
- [ ] For building on the host: Node.js 18 or newer. `node -v` prints v18 or higher. If it is missing, install it: `sudo apt-get install -y nodejs npm` (or use nvm for a newer version).

## 4. Install steps

You have two ways to get the built files onto the host. Building on the host is simplest; building on a faster machine and copying the output is quicker on a Pi Zero.

### 4a. Build on the host

```
git clone <this-repo-url> stonelabs-ui-v2
cd stonelabs-ui-v2
npm install
npm run build
```

The output lands in `stonelabs-ui-v2/dist/`.

### 4b. Build on a workstation, copy the output

On the workstation:

```
git clone <this-repo-url> stonelabs-ui-v2
cd stonelabs-ui-v2
npm install
npm run build
```

Copy `dist/` to the host:

```
scp -r dist/ pi@<host-ip>:/tmp/stonelabs-dist
```

### 4c. Serve the files from Moonraker (recommended)

Serving from Moonraker puts the UI on the same origin as the API, so there is no CORS setup and the WebSocket connects without extra config. Publish the build into a folder Moonraker serves:

```
mkdir -p ~/printer_data/www-stonelabs
cp -r dist/* ~/printer_data/www-stonelabs/          # or from /tmp/stonelabs-dist/*
```

Add a `static_files` section to `~/printer_data/config/moonraker.conf`:

```
[static_files stonelabs]
path: /home/<user>/printer_data/www-stonelabs
```

Replace `<user>` with your login name. Restart Moonraker:

```
sudo systemctl restart moonraker
```

Open the UI at:

```
http://<host-ip>:7125/server/files/stonelabs/index.html
```

### 4d. Serve the files standalone (alternative)

If you would rather serve on a separate port, use any static file server, for example:

```
cd ~/printer_data/www-stonelabs
python3 -m http.server 8088
```

Open `http://<host-ip>:8088`. This origin is different from Moonraker's, so you must add it to Moonraker's `cors_domains` (section 5) or every API call fails.

## 5. Moonraker CORS setup

Skip this if you serve from Moonraker (section 4c); same origin needs no CORS. If you serve standalone (section 4d) or open the app from a different host, add the origin to Moonraker.

Edit `~/printer_data/config/moonraker.conf` and add the origin under `[authorization]`:

```
[authorization]
cors_domains:
    http://<host-ip>:8088
    http://<host-hostname>.local:8088
```

Use the exact scheme, host, and port you open in the browser. Reload Moonraker:

```
sudo systemctl restart moonraker
```

A missing CORS entry is the most common first-run failure. It shows up as a blank page and CORS errors in the browser console.

## 6. First run: the setup wizard

The first time you open the UI with no saved config, it routes to the setup wizard. The first screen states that every setting can be changed later in Settings.

1. Pick your printer. Choose a profile. A Prusa (Buddy) profile shows a warning that it needs a community Klipper reflash for this UI to control it. A Creality K-series profile shows that Moonraker may be on a non-default port and may need root.
   `[screenshot placeholder: wizard step 1]`
2. Webcam. On or off. When on, set the stream URL, a name, and the aspect.
   `[screenshot placeholder: wizard step 2]`
3. Interface type. Touchscreen, web, or both. Touchscreen asks for screen size and resolution, then whether the screen is attached to this host (pick the display output, HDMI0 or HDMI1) or on a separate SBC kiosk (enter this printer's IP so the kiosk knows what to connect to).
   `[screenshot placeholder: wizard step 3]`
4. Theme. Pick one of the six accents and light or dark. The preview updates live.
   `[screenshot placeholder: wizard step 4]`
5. Logo. Optionally upload a logo for the top bar. PNG, SVG, WebP, or JPG; about 512x512 px or an SVG, under roughly 1 MB.
   `[screenshot placeholder: wizard step 5]`

The closing screen summarizes your choices and repeats that everything lives in Settings. Finish sets the wizard-completed flag and opens the dashboard.

## 7. Kiosk setup (optional)

For a Pi with an attached touchscreen, run a browser full-screen pointed at the served URL, launched by a systemd unit at boot. This mirrors the v1 kiosk approach.

1. Attach the screen and confirm the URL from section 4c loads in a normal browser first.
2. In wizard step 3, if the screen is attached to this host, note the display output it uses (HDMI0 or HDMI1).
3. Install the kiosk service. A first-draft `install.sh` (to be added to `kiosk/`, mirroring the v1 script) will: install Chromium and X, publish `dist/` into the Moonraker static folder, install `/etc/default/stonelabs-ui` with the URL, install a `stonelabs-ui.service` systemd unit, and enable it on `graphical.target`.

Until that script is added, the v1 kiosk unit at `StoneLabs-3D-Printer-UI7-7-26-update/release/stonelabs-ui-v1.9.0/web-ui/kiosk/` is the reference. Change its `KIOSK_URL` to the v2 URL:

```
http://localhost:7125/server/files/stonelabs/index.html
```

Start and check it:

```
sudo systemctl start stonelabs-ui
journalctl -u stonelabs-ui -f
```

## 8. Settings: where the wizard choices live afterward

Every wizard choice has a permanent home on the Settings page, grouped the same way: Printer profile, Webcam, Interface and display, Theme and mode, Logo, and the Moonraker connection host. Open Settings from the gear in the top bar. The wizard is only the first pass through these same fields.

## 9. Troubleshooting

Blank page, CORS error in the console. The serving origin is not in Moonraker's `cors_domains`. Add it (section 5) and restart Moonraker, or serve from Moonraker to avoid CORS entirely (section 4c).

Cannot reach Moonraker. Confirm `curl http://<host-ip>:7125/printer/info` returns JSON from the machine running the browser. Check the host IP, the firewall, and that Moonraker is on port 7125.

Socket keeps dropping. The UI reconnects with exponential backoff on its own. If it never reaches "ready", check `systemctl status klipper moonraker` and the Klipper state; a klippy shutdown shows in the connection banner with a prompt to FIRMWARE_RESTART.

Webcam not showing. Confirm the stream URL works on its own in a browser tab. Check that the webcam is enabled in Settings and that crowsnest is running. Moonraker lists cameras at `/server/webcams/list`.

Kiosk not launching. Confirm the URL loads in a normal browser on the host first. Then check `journalctl -u stonelabs-ui -f` for the Chromium or X startup error. On Wayland, use cage or weston instead of startx.

## 10. Updating and uninstalling

Update: pull the repo, rebuild, and republish the files.

```
cd stonelabs-ui-v2
git pull
npm install
npm run build
cp -r dist/* ~/printer_data/www-stonelabs/
```

If you run the kiosk, restart it after republishing:

```
sudo systemctl restart stonelabs-ui
```

Uninstall:

```
sudo systemctl disable --now stonelabs-ui        # if the kiosk was installed
sudo rm -f /etc/systemd/system/stonelabs-ui.service /etc/default/stonelabs-ui
sudo systemctl daemon-reload
rm -rf ~/printer_data/www-stonelabs
```

Remove the `[static_files stonelabs]` section from `~/printer_data/config/moonraker.conf` and restart Moonraker. To wipe the saved UI config from a browser, clear the site data for the served origin (the config is stored under the `stonelabs-ui-config` key in localStorage).
