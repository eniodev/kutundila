import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Canvas } from '@react-three/fiber/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDeviceOrientation, type OrientationDelta } from '../hooks/useDeviceOrientation';
import { useOrbitGestures } from '../hooks/useOrbitGestures';
import { useSettings } from '../hooks/useSettings';
import { getMap, mapFile } from '../storage/maps';
import { clamp, createOrbitState, ELEVATION_MAX, ELEVATION_MIN, type OrbitState } from '../three/orbit';
import { OrbitCamera } from '../three/OrbitCamera';
import { PlyModel } from '../three/PlyModel';
import { colors } from '../theme';
import type { CameraState, ModelSource, RootStackParamList } from '../types';
import { nextFrame, readAssetBytes } from '../utils/files';
import { fmt, fmtInt } from '../utils/format';
import { buildPlyGeometry, type LoadedPly } from '../utils/ply';
import { getSample } from '../utils/samples';

type Props = NativeStackScreenProps<RootStackParamList, 'Viewer'>;

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; model: LoadedPly; name: string };

async function loadSource(source: ModelSource): Promise<{ model: LoadedPly; name: string }> {
  if (source.kind === 'sample') {
    const sample = getSample(source.sampleId);
    if (!sample) throw new Error('Sample model not found.');
    const bytes = await readAssetBytes(sample.module);
    await nextFrame();
    return { model: buildPlyGeometry(bytes, sample.upAxis), name: sample.name };
  }
  const map = await getMap(source.mapId);
  if (!map) throw new Error('Map not found.');
  const file = mapFile(map.id);
  if (!file.exists) throw new Error('The map file no longer exists on this device.');
  const bytes = await file.bytes();
  await nextFrame();
  return { model: buildPlyGeometry(bytes, map.upAxis), name: map.name };
}

export default function ViewerScreen({ route, navigation }: Props) {
  const { source } = route.params;
  const { settings, update } = useSettings();
  const insets = useSafeAreaInsets();
  const gyro = settings.gyroEnabled;

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [camera, setCamera] = useState<CameraState | null>(null);
  const orbit = useRef<OrbitState>(createOrbitState(1));
  /** Orbit pose that gyro deltas are applied on top of (set on load, recenter and mode switch). */
  const base = useRef<OrbitState>(createOrbitState(1));
  const gesture = useOrbitGestures(orbit, { rotate: !gyro });

  // Gyro: phone movement since the reference pose → azimuth/elevation offsets.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onDelta = useRef((d: OrientationDelta) => {
    const s = orbit.current;
    const { gyroSensitivity: k, gyroInvert } = settingsRef.current;
    s.azimuth = base.current.azimuth + (gyroInvert ? -1 : 1) * d.horizontal * k;
    s.elevation = clamp(base.current.elevation - d.vertical * k, ELEVATION_MIN, ELEVATION_MAX);
  });
  const { recenter: recenterSensor } = useDeviceOrientation(
    gyro && state.status === 'ready',
    settings.gyroMode,
    onDelta,
  );

  useEffect(() => {
    let cancelled = false;
    let loaded: LoadedPly | null = null;
    setState({ status: 'loading' });

    (async () => {
      try {
        await nextFrame(); // let the spinner render first
        const { model, name } = await loadSource(source);
        loaded = model;
        if (cancelled) return model.geometry.dispose();
        orbit.current = createOrbitState(model.radius);
        base.current = createOrbitState(model.radius);
        setState({ status: 'ready', model, name });
        navigation.setOptions({ title: name });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();

    return () => {
      cancelled = true;
      loaded?.geometry.dispose();
    };
  }, [source, navigation]);

  const recenter = useCallback(() => {
    if (state.status !== 'ready') return;
    const fresh = createOrbitState(state.model.radius);
    fresh.distance = orbit.current.distance; // keep the zoom, reset the angles
    base.current = { ...fresh };
    Object.assign(orbit.current, fresh);
    recenterSensor();
  }, [state, recenterSensor]);

  const setGyro = (enabled: boolean) => {
    if (enabled === gyro) return;
    base.current = { ...orbit.current }; // continue from the current view
    recenterSensor();
    update({ gyroEnabled: enabled });
  };

  return (
    <View style={styles.root}>
      {state.status === 'ready' && (
        <>
          <Canvas style={StyleSheet.absoluteFill} camera={{ fov: 60 }}>
            <color attach="background" args={[colors.bg]} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 10, 7]} intensity={1.4} />
            <PlyModel
              geometry={state.model.geometry}
              hasFaces={state.model.header.faceCount > 0}
              pointSize={settings.pointSize}
              colorMode={settings.colorMode}
            />
            <OrbitCamera
              orbit={orbit}
              radius={state.model.radius}
              // Touch input is already smooth; the smoothing setting is mainly for noisy gyro data.
              smoothing={gyro ? settings.smoothing : Math.max(settings.smoothing, 0.25)}
              onCameraState={setCamera}
            />
          </Canvas>

          {/* Transparent layer that receives touches, so gestures don't compete with the GL view. */}
          <GestureDetector gesture={gesture}>
            <View style={StyleSheet.absoluteFill} />
          </GestureDetector>

          <View
            pointerEvents="box-none"
            style={[styles.overlay, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 16 }]}
          >
            <Hud camera={camera} model={state.model} />
            <View pointerEvents="box-none" style={styles.bottom}>
              {gyro && (
                <Text style={styles.tip}>
                  {settings.gyroMode === 'tilt'
                    ? 'Rotate the phone like a steering wheel and tilt it up/down. Pinch to zoom.'
                    : 'Point the phone around: turn left/right and tilt up/down. Pinch to zoom.'}
                </Text>
              )}
              <View style={styles.segment}>
                {[
                  { label: 'Touch', value: false },
                  { label: 'Gyro', value: true },
                ].map((o) => (
                  <Pressable
                    key={o.label}
                    onPress={() => setGyro(o.value)}
                    style={[styles.segmentItem, gyro === o.value && styles.segmentActive]}
                  >
                    <Text style={[styles.segmentText, gyro === o.value && styles.segmentTextActive]}>{o.label}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.actions}>
                <HudButton label="Recenter" onPress={recenter} />
                <HudButton label="Settings" onPress={() => navigation.navigate('Settings')} />
              </View>
            </View>
          </View>
        </>
      )}

      {state.status === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.muted}>Loading model…</Text>
        </View>
      )}

      {state.status === 'error' && (
        <View style={styles.center}>
          <Text style={styles.error}>Could not open the model</Text>
          <Text style={styles.muted}>{state.message}</Text>
        </View>
      )}
    </View>
  );
}

function Hud({ camera, model }: { camera: CameraState | null; model: LoadedPly }) {
  const d = model.dimensions;
  const isMesh = model.header.faceCount > 0;
  return (
    <View pointerEvents="none" style={styles.hud}>
      {camera ? (
        <>
          <Text style={styles.hudLine}>
            X {fmt(camera.position.x)}  Y {fmt(camera.position.y)}  Z {fmt(camera.position.z)} m
          </Text>
          <Text style={styles.hudLine}>
            Azimuth {fmt(camera.azimuth, 1)}°  Elevation {fmt(camera.elevation, 1)}°  Dist. {fmt(camera.distance)} m
          </Text>
        </>
      ) : (
        <Text style={styles.hudLine}>—</Text>
      )}
      <Text style={styles.hudLine}>
        Map {fmt(d.x)} × {fmt(d.z)} × {fmt(d.y)} m (W×D×H) · {fmtInt(model.header.vertexCount)}{' '}
        {isMesh ? 'vertices' : 'points'}
      </Text>
    </View>
  );
}

function HudButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  muted: { color: colors.textMuted, textAlign: 'center' },
  error: { color: colors.danger, fontSize: 16, fontWeight: '600' },
  overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between', paddingHorizontal: 12 },
  hud: { backgroundColor: colors.hudBg, borderRadius: 10, padding: 10, gap: 2, alignSelf: 'flex-start' },
  hudLine: { color: colors.text, fontSize: 12, fontVariant: ['tabular-nums'] },
  bottom: { gap: 10, alignItems: 'center' },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.hudBg,
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentItem: { paddingHorizontal: 22, paddingVertical: 8, borderRadius: 17 },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { color: colors.text, fontWeight: '600' },
  segmentTextActive: { color: '#00131c' },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  button: {
    backgroundColor: colors.hudBg,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buttonText: { color: colors.text, fontWeight: '600' },
  tip: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    backgroundColor: colors.hudBg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
