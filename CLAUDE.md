# PLY Twin Viewer

Mobile app (Expo Go) for the "Dispositivos Móveis" course (Engenharia Informática, Universidade
Lusófona do Porto). Individual project. It opens and explores PLY maps exported by a dynamic-SLAM
robot with low-cost sensors (final year project: digital twin baseline models). Current maps
are of simulated facilities.

## Hard constraints
- Must run in **Expo Go**: no custom native modules, no dev builds. Only Expo Go packages or pure JS.
- Install with `npx expo install <pkg>` so versions match the SDK.
- TypeScript. UI text in **pt-PT**; code, comments and identifiers in English.
- Node 24 via nvm (`source ~/.nvm/nvm.sh && nvm use 24`). The default shell node may be v14.
- WSL2: run the dev server with `npm run start:tunnel` so the phone can reach it.
- Network quirks on this machine: the global ~/.npmrc points to a private registry, so the repo
  `.npmrc` pins the public npm registry. A TLS-intercepting proxy means Expo CLI needs
  `NODE_USE_SYSTEM_CA=1` (already in the npm scripts; prefix `npx expo install` with it too).
- Installed versions: SDK 58, React 19.3, RN 0.88, fiber v9, three r187, gesture-handler 3
  (hook API: usePanGesture/usePinchGesture/useSimultaneousGestures with `runOnJS: true`).
- Expo Go has no Hermes TextDecoder guarantee: `src/polyfills.ts` (imported first in index.ts).
- `src/utils/ply.ts` is pure (header + geometry) and testable in Node. Expo I/O lives in `src/utils/files.ts`.

## Scope
IN: import PLY (ASCII/binary, points or mesh) from device storage; render with three.js; orbit
camera via touch or device tilt; HUD (camera X/Y/Z in m, azimuth, elevation, map dims); local
library (metadata + copied files); settings (point size, color mode, gyro sensitivity, smoothing).
OUT: robot connection, streaming, first-person walking, AR, any backend.

## Stack
Expo (latest SDK) + React Native + TS, React Navigation native stack, expo-gl + three +
@react-three/fiber (`@react-three/fiber/native`; v9 for React 19, v8 for React 18), PLYLoader from
three examples, expo-sensors DeviceMotion, expo-document-picker, expo-file-system (new `File` API,
use bytes/arrayBuffer; no base64, no fetch('file://')), AsyncStorage, expo-crypto (randomUUID),
react-native-gesture-handler v2.

## Screens
1. Library (initial): map cards, FAB "+ Importar PLY", empty state.
2. MapDetails: preview placeholder, metadata, "Abrir em 3D", "Apagar mapa" (confirm).
3. Viewer: full-screen canvas, loading indicator, HUD, toggle "Gestos | Giroscópio",
   "Recentrar", "Definições".
4. Settings: point size, color mode (Original / Altura), gyro sensitivity, smoothing, "Repor valores".

## Data model
Map: id, name, filePath, importedAt (ISO), sizeBytes, format ('ascii'|'binary'), pointCount,
hasFaces, hasColor, upAxis ('z'|'y', default 'z'), dimensions {x,y,z} m, center {x,y,z}.
Settings defaults: pointSize 0.02, colorMode 'original', gyroEnabled false, gyroSensitivity 1.5,
smoothing 0.1.
CameraState (memory only): position, azimuth, elevation (deg), distance (m).

## Design decisions
- **Up axis**: SLAM/ROS exports are usually Z-up and three.js is Y-up. Rotate -90° about X when
  upAxis = 'z', before computing the bbox and centering. Height coloring uses the Y axis after that.
- Parse the PLY header ourselves (format, counts, properties) because PLYLoader doesn't expose the
  format. Warn on huge files before the full parse.
- Full parse once at import to compute bbox/dims/center, then store it. Never re-parse for details.
- Parsing blocks the JS thread: show the loader, yield a frame, then parse.
- Camera: spherical coords, lookAt origin; x = r·cos(e)·sin(a), y = r·sin(e), z = r·cos(e)·cos(a).
  Gesture/sensor input writes to refs; useFrame reads the refs; HUD state is throttled to ~10 Hz.
- Gestures: RNGH Pan + Pinch (Simultaneous), `.runOnJS(true)`. Don't use drei OrbitControls.
- Gyro: DeviceMotion `rotation` (not raw Gyroscope), setUpdateInterval(16), offsets on recenter,
  lerp smoothing, elev clamp [0.1, 1.4]. The yaw source (gamma vs alpha) stays switchable until
  tested on a phone. Request permission on iOS. Beware Euler issues near beta ≈ 90°.
- Color by height: cache the generated color buffer and keep the original colors so switching is instant.

## Structure
src/navigation, src/screens, src/three (PlyModel, OrbitCamera), src/hooks (useDeviceOrientation,
useSettings), src/storage (maps, settings), src/utils (ply, colors), src/types.ts.
Test models in assets/models/ (metro assetExts includes 'ply').

## Development order
0 env + scaffold → 1 navigation/structure → 2 3D spike (bundled PLYs) → 2b sensor logging spike →
3 library/import → 4 gesture orbit + HUD → 5 gyro → 6 settings + height colors → 7 real maps, perf.
