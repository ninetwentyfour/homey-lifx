# Homey LIFX (LAN)

Homey Pro app for LIFX bulbs. Controls bulbs locally over UDP 56700, discovers
newer firmware via mDNS, accepts a manual IP for older bulbs (firmware < 4.110),
and delegates theme/scene activation to the LIFX cloud API so native Morph/Flame
effects work correctly on matrix devices like the Tube.

Built against the Homey Apps SDK v3.

## Features

- **LAN control** — onoff, dim, hue, saturation, color temperature. Fast, no
  cloud dependency.
- **Auto-discovery** via mDNS (`_lifx._udp`) for firmware ≥ 4.110.
- **Manual IP fallback** pair flow for legacy bulbs on firmware v2/v3.
- **Scene picker** on every device card — pulls the scenes you've saved in the
  LIFX mobile app (Art Series, Music, Moods, custom, favorites) via the LIFX
  HTTP API and lets you activate any of them with one tap. Scene list refreshes
  every 30 min and on token change.
- **Flow action** `Activate LIFX scene` with autocomplete over your scenes.
- **Flow trigger** `A LIFX scene was activated` fires on scene picker changes.
- **Smart override** — dragging hue/saturation/temp stops the active cloud
  effect before writing the new color (debounced 3 s to respect LIFX's
  120 req/min cloud rate limit). Dim changes pass through without killing the
  effect so "dim the morph" works.
- **Accurate energy estimates** per product ID (LIFX Original, A19 1100lm,
  Tube, Mini, BR30, Candle, Tile, Beam, Z, GU10, White 800/900).

## Setup

### 1. Install the Homey CLI and log in

```sh
npm install -g homey
homey login
```

### 2. Install dependencies

```sh
bun install
```

### 3. Network prerequisites

The app talks to bulbs via **UDP 56700** (both directions) and relies on
**mDNS** (`_lifx._udp`) to auto-discover newer firmware. If your Homey Pro and
bulbs are on different VLANs (common IoT segregation pattern):

- **Same zone, different networks** — you need three allow policies above any
  block between the zones (UniFi example):
  - Homey IP → Bulb network, UDP 56700 (commands)
  - Bulb network → Homey network, UDP 56700 (replies)
  - Enable Gateway mDNS Proxy across the VLANs (for auto-discovery; legacy
    firmware bulbs don't need this since they use manual IP)
- **Same VLAN** — nothing to configure.

### 4. LIFX cloud token (for scenes)

The device Scene picker and `Activate LIFX scene` flow action need a Personal
Access Token:

1. Visit [cloud.lifx.com/settings](https://cloud.lifx.com/settings) → **Generate new token**.
2. In Homey, open the LIFX app's **Settings** page.
3. Paste the token, click **Test** to verify, then **Save**.

Scenes saved in your LIFX mobile app will appear in the Scene picker within a
minute.

### 5. Run in dev

```sh
bun run homey
```

This composes `.homeycompose/` → `app.json`, runs the TypeScript type-check,
and installs the app on your paired Homey Pro in dev mode with live logs.

## Pairing bulbs

1. In Homey, add a new device → LIFX → LIFX Bulb.
2. Choose **Discover automatically (mDNS)** if your bulb is on firmware ≥ 4.110.
3. Choose **I know my bulb's IP address** for older firmware. Reserve the
   bulb's IP in your DHCP server so it doesn't change.

## Project layout

```
app.ts                               # cloud client, flow cards, device coordination
api.ts                               # /test-token endpoint for settings page
lib/
  LifxClient.ts                      # wraps lifx-lan-client for LAN control
  LifxCloudClient.ts                 # LIFX HTTP API (scenes, effects/off)
  energy.ts                          # product ID → watt lookup
  types.ts                           # shared types
drivers/bulb/
  driver.compose.json, driver.ts     # mDNS + manual-IP pair flow
  device.ts                          # capabilities, polling, state sync
  pair/start.html, pair/manual_ip.html
settings/index.html                  # cloud token setup
.homeycompose/                       # source manifests (app.json, caps, flow)
scripts/compose.ts                   # flattens .homeycompose → app.json
```

## Scripts

- `bun run homey` — compose + build + run on your Homey Pro (dev)
- `bun run build` — compose + type-check
- `bun run validate` — compose + Homey's publish-level validator
- `bun run lint` — oxlint
- `bun run fmt` — oxfmt

## Notes

- LIFX cloud rate limit is **120 requests/minute per token**. The app debounces
  `effects/off` calls per bulb to 3 s to stay well under.
- The bulb driver covers matrix devices (Tube, Tile, Candle) too — `SetColor`
  paints the whole device one color, which is all the stock capabilities need.
  Multi-tile effects come from the LIFX cloud Scene activation path.
- Linear multizone devices (Z, Beam, Neon, String) aren't currently supported.
  Add a dedicated driver if you ever pick one up.
