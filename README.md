# PLY Twin Viewer

A mobile app for opening and exploring the 3D maps produced by the final year project *3D Mapping of
Operating Facilities with Dynamic SLAM for Building Baseline Models for Digital Twins with Low-Cost
Sensors*. A robot with low-cost sensors maps an indoor facility with dynamic SLAM (RTAB-Map plus
filters for people and forklifts) and exports PLY point clouds. This app opens those PLY files on a
phone.

Built for the *Dispositivos Móveis* course (Engenharia Informática, Universidade Lusófona do Porto).
It runs in **Expo Go**: no custom native modules and no development build.

## Features

- **Map library:** import PLY files (ASCII or binary, point clouds or meshes) from the phone. Each file
  is copied into the app and analysed once (type, point count, size in metres, format), and gets a
  thumbnail the first time it is opened.
- **3D viewer** (three.js through React Three Fiber): points or lit meshes, rendered on demand.
  - **Touch:** drag to orbit, pinch to zoom.
  - **Gyro:** turn, steer or tilt the phone to orbit. Movement is measured relative to the pose at
    Recenter, so it works whatever angle the phone is held at.
  - **HUD:** live camera position (m), azimuth, elevation, distance and map size.
  - **Views:** top, front, side and 3D presets, plus auto-rotate.
  - **Tools:** measure the distance between two tapped points, cut away everything above a height
    (floor-plan view), colour by original colour, height or evaluation error, show the robot's path,
    and share a screenshot.
- **Before and after:** two bundled samples of the simulated facility: the raw SLAM map and the
  filtered, DUFOMap-cleaned map. The *Errors* colour mode shows the residue left by people and
  forklifts in red (29,773 residue points before, 1,341 after).
- **Settings:** light, dark or system theme, point size, colour mode, gyro sensitivity, smoothing and
  direction, sensor diagnostics.

## Bundled demo models

| Model | Source |
|---|---|
| Simulated facility: BEFORE and AFTER filtering (two samples) | This project (twin-mapping), with robot trajectory and evaluation classes |
| Copy room (real scan) | BundleFusion, Stanford, CC BY-NC-SA 4.0 |
| Living room, Office | Augmented ICL-NUIM, CC BY 3.0 |
| Stanford Bunny | Stanford 3D Scanning Repository |

All models are downsampled for mobile. Full credits are in [assets/models/CREDITS.md](assets/models/CREDITS.md).

## Running it

Requirements: Node 20 or newer and the Expo Go app on the phone.

```bash
npm install
npm run start:tunnel   # scan the QR code with Expo Go (tunnel needed from WSL2)
npm run typecheck
```

## Preparing maps

SLAM point clouds can have millions of points. Downsample them before importing:

```bash
# Voxel-grid downsampling (any PLY, including PCL/RTAB-Map exports)
node scripts/prepare-maps.mjs input.ply output.ply 0.05

# Level a tilted mesh scan (e.g. BundleFusion) before downsampling
node scripts/align-mesh.mjs scan.ply scan_levelled.ply

# Before/after map with evaluation classes from a twin-mapping run
node scripts/prepare-compare.mjs --rgb run/export/rtabmap_cloud.ply \
  --errors run/eval/error_cloud.ply --out before.ply \
  --poses run/export/rtabmap_poses.txt --trajectory trajectory.json
```

Then copy the file to the phone (Files, Drive, AirDrop) and tap **+ Import PLY**.

## Project structure

```
src/
  navigation/   native stack navigator (themed)
  screens/      Library, MapDetails, Viewer, Settings, SensorDebug
  three/        PlyModel, OrbitCamera, overlays (path, measurement, scene bridge), orbit maths
  hooks/        device orientation (gyro), orbit gestures, settings context
  storage/      map metadata (AsyncStorage) and files (document directory), settings
  utils/        PLY header + geometry, colours, import, samples, formatting
scripts/        data preparation (downsampling, alignment, before/after)
```

## Stack

Expo SDK 58, React Native 0.88, TypeScript, React Navigation, expo-gl, three.js r187,
@react-three/fiber 9, react-native-gesture-handler 3, expo-sensors (DeviceMotion),
expo-document-picker, expo-file-system, expo-sharing, AsyncStorage.
