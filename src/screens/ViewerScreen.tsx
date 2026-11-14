import Slider from '@react-native-community/slider';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Canvas, invalidate } from '@react-three/fiber/native';
import { GLView } from 'expo-gl';
import { File } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Raycaster, Vector2, type Object3D } from 'three';

import { useDeviceOrientation, type OrientationDelta } from '../hooks/useDeviceOrientation';
import { useOrbitGestures } from '../hooks/useOrbitGestures';
import { useSettings } from '../hooks/useSettings';
import { getMap, mapFile, mapThumbnail } from '../storage/maps';
import {
  clamp,
  createOrbitState,
  ELEVATION_MAX,
  ELEVATION_MIN,
  presetAngles,
  type OrbitState,
  type ViewPreset,
} from '../three/orbit';
import { OrbitCamera } from '../three/OrbitCamera';
import { Measurement, Polyline, SceneBridge, type SceneHandle } from '../three/Overlays';
import { PlyModel } from '../three/PlyModel';
import { makeStyles, useTheme } from '../theme';
import type { CameraState, ColorMode, ModelSource, RootStackParamList, Vec3 } from '../types';
import { ERROR_CLASSES } from '../utils/colors';
import { nextFrame, readAssetBytes } from '../utils/files';
import { fmt, fmtInt } from '../utils/format';
import { buildPlyGeometry, type LoadedPly } from '../utils/ply';
import { getSample, type Sample } from '../utils/samples';

type Props = NativeStackScreenProps<RootStackParamList, 'Viewer'>;

type Layer = { key: string; label: string; note: string; model: LoadedPly };
type Scene3D = {
  name: string;
  layers: Layer[];
  defaultLayer: number;
  trajectory?: Vec3[];
  stats?: Sample['stats'];
  /** Set for imported maps (used for the thumbnail). */
  mapId?: string;
};

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; scene: Scene3D };

/** File coordinates → the viewer's Y-up, centered frame (same transform as the geometry). */
function toViewer([x, y, z]: number[], upAxis: 'y' | 'z', c: Vec3, lift = 0): Vec3 {
  const p = upAxis === 'z' ? { x, y: z, z: -y } : { x, y, z };
  return { x: p.x - c.x, y: p.y - c.y + lift, z: p.z - c.z };
}

async function loadSource(source: ModelSource): Promise<Scene3D> {
  if (source.kind === 'sample') {
    const sample = getSample(source.sampleId);
    if (!sample) throw new Error('Sample model not found.');
    const layers: Layer[] = [];
    for (const l of sample.layers) {
      const bytes = await readAssetBytes(l.module);
      await nextFrame();
      // Later layers reuse the first layer's center so they stay aligned.
      const model = buildPlyGeometry(bytes, sample.upAxis, layers[0]?.model.center);
      layers.push({ key: l.key, label: l.label, note: l.note, model });
    }
    const c = layers[0].model.center;
    return {
      name: sample.name,
      layers,
      defaultLayer: sample.defaultLayer ?? 0,
      trajectory: sample.trajectory?.map((p) => toViewer(p, sample.upAxis, c, 0.3)),
      stats: sample.stats,
    };
  }
  const map = await getMap(source.mapId);
  if (!map) throw new Error('Map not found.');
  const file = mapFile(map.id);
  if (!file.exists) throw new Error('The map file no longer exists on this device.');
  const bytes = await file.bytes();
  await nextFrame();
  const model = buildPlyGeometry(bytes, map.upAxis);
  return { name: map.name, layers: [{ key: 'main', label: 'Map', note: '', model }], defaultLayer: 0, mapId: map.id };
}

/** Renders the current view and saves it as a JPEG; returns its file URI. */
async function snapshot(handle: SceneHandle | null): Promise<string> {
  if (!handle) throw new Error('The 3D view is not ready yet.');
  handle.gl.render(handle.scene, handle.camera); // fresh frame (the loop renders on demand)
  const shot = await GLView.takeSnapshotAsync(handle.gl.getContext() as never, { format: 'jpeg', compress: 0.85 });
  return String(shot.uri);
}

export default function ViewerScreen({ route, navigation }: Props) {
  const { source } = route.params;
  const { settings, update } = useSettings();
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const gyro = settings.gyroEnabled;

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [layerIndex, setLayerIndex] = useState(0);
  const [panel, setPanel] = useState<'views' | 'tools' | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showPath, setShowPath] = useState(true);
  const [cut, setCut] = useState(1); // 0..1 of the model height; 1 = off
  const [measuring, setMeasuring] = useState(false);
  const [measurePts, setMeasurePts] = useState<Vec3[]>([]);
  const [viewSize, setViewSize] = useState({ width: 1, height: 1 });

  const cameraState = useRef<CameraState | null>(null);
  const gyroDelta = useRef<OrientationDelta | null>(null);
  const sceneHandle = useRef<SceneHandle | null>(null);
  const modelObject = useRef<Object3D>(null);
  const orbit = useRef<OrbitState>(createOrbitState(1));
  /** Orbit pose that gyro deltas are applied on top of (set on load, recenter, presets, mode switch). */
  const base = useRef<OrbitState>(createOrbitState(1));

  const scene = state.status === 'ready' ? state.scene : null;
  const layer = scene?.layers[layerIndex];
  const model = layer?.model;
  const radius = model?.radius ?? 1;

  // Height cut in the centered frame.
  const box = model?.geometry.boundingBox;
  const minY = box?.min.y ?? 0;
  const height = box ? box.max.y - box.min.y : 0;
  const cutHeight = cut >= 0.999 ? Infinity : minY + cut * height;

  // ---- Measuring: tap → raycast against the visible model.
  const raycaster = useMemo(() => new Raycaster(), []);
  const onTap = useCallback(
    (x: number, y: number) => {
      const handle = sceneHandle.current;
      const object = modelObject.current;
      if (!measuring || !handle || !object) return;
      const ndc = new Vector2((x / viewSize.width) * 2 - 1, -(y / viewSize.height) * 2 + 1);
      raycaster.params.Points = { threshold: Math.max(0.01, radius * 0.006) };
      raycaster.setFromCamera(ndc, handle.camera);
      const hit = raycaster.intersectObject(object, false).find((h) => h.point.y <= cutHeight + 1e-6);
      if (!hit) return;
      const p = { x: hit.point.x, y: hit.point.y, z: hit.point.z };
      setMeasurePts((prev) => (prev.length >= 2 ? [p] : [...prev, p]));
      invalidate();
    },
    [measuring, viewSize, radius, cutHeight, raycaster],
  );

  const gesture = useOrbitGestures(orbit, {
    rotate: !gyro,
    onTap,
    onInteract: () => setAutoRotate(false),
  });

  // ---- Gyro: phone movement since the reference pose → azimuth/elevation offsets.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const onDelta = useRef((d: OrientationDelta) => {
    const s = orbit.current;
    const { gyroSensitivity: k, gyroInvert } = settingsRef.current;
    s.azimuth = base.current.azimuth + (gyroInvert ? -1 : 1) * d.horizontal * k;
    s.elevation = clamp(base.current.elevation - d.vertical * k, ELEVATION_MIN, ELEVATION_MAX);
    gyroDelta.current = d;
    invalidate();
  });
  const { recenter: recenterSensor } = useDeviceOrientation(gyro && !!scene, onDelta);

  // ---- Loading.
  useEffect(() => {
    let cancelled = false;
    let loaded: Scene3D | null = null;
    setState({ status: 'loading' });

    (async () => {
      try {
        await nextFrame(); // let the spinner render first
        const s = await loadSource(source);
        loaded = s;
        if (cancelled) return s.layers.forEach((l) => l.model.geometry.dispose());
        const r = s.layers[0].model.radius;
        orbit.current = createOrbitState(r);
        base.current = createOrbitState(r);
        setLayerIndex(s.defaultLayer);
        setState({ status: 'ready', scene: s });
        navigation.setOptions({ title: s.name });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();

    return () => {
      cancelled = true;
      loaded?.layers.forEach((l) => l.model.geometry.dispose());
    };
  }, [source, navigation]);

  // ---- Thumbnail for imported maps, captured once after the first frames.
  useEffect(() => {
    if (!scene?.mapId) return;
    const thumb = mapThumbnail(scene.mapId);
    if (thumb.exists) return;
    const id = setTimeout(async () => {
      try {
        const uri = await snapshot(sceneHandle.current);
        await new File(uri).copy(thumb);
      } catch {
        // Thumbnails are optional; the details screen falls back to an icon.
      }
    }, 1200);
    return () => clearTimeout(id);
  }, [scene]);

  // ---- Camera helpers.
  const applyAngles = useCallback(
    (azimuth: number, elevation: number) => {
      Object.assign(orbit.current, { azimuth, elevation });
      base.current = { ...orbit.current };
      gyroDelta.current = null;
      recenterSensor();
      invalidate();
    },
    [recenterSensor],
  );

  const recenter = useCallback(() => {
    const fresh = createOrbitState(radius);
    setAutoRotate(false);
    applyAngles(fresh.azimuth, fresh.elevation);
  }, [radius, applyAngles]);

  const applyPreset = (preset: ViewPreset) => {
    const a = presetAngles(preset);
    setAutoRotate(false);
    applyAngles(a.azimuth, a.elevation);
  };

  const setGyro = (enabled: boolean) => {
    if (enabled === gyro) return;
    base.current = { ...orbit.current }; // continue from the current view
    gyroDelta.current = null;
    recenterSensor();
    if (enabled) setAutoRotate(false);
    update({ gyroEnabled: enabled });
  };

  const share = async () => {
    try {
      const uri = await snapshot(sceneHandle.current);
      if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
      await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: scene?.name });
    } catch (e) {
      Alert.alert('Could not share the view', e instanceof Error ? e.message : String(e));
    }
  };

  const hasErrors = !!model?.header.hasErrorClass;
  const measureDistance =
    measurePts.length === 2
      ? Math.hypot(measurePts[0].x - measurePts[1].x, measurePts[0].y - measurePts[1].y, measurePts[0].z - measurePts[1].z)
      : null;

  return (
    <View style={styles.root} onLayout={(e) => setViewSize(e.nativeEvent.layout)}>
      {scene && model && layer && (
        <>
          {/* Render on demand: only when the camera or the scene changes (saves CPU/GPU and battery). */}
          <Canvas style={StyleSheet.absoluteFill} camera={{ fov: 60 }} frameloop="demand">
            <color attach="background" args={[colors.canvas]} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[5, 10, 7]} intensity={1.4} />
            <SceneBridge handle={sceneHandle} />
            <PlyModel
              key={layer.key}
              geometry={model.geometry}
              hasFaces={model.header.faceCount > 0}
              pointSize={settings.pointSize}
              colorMode={settings.colorMode}
              flatColor={colors.accent}
              cutHeight={cutHeight}
              objectRef={modelObject}
            />
            {scene.trajectory && <Polyline points={scene.trajectory} color="#ff9800" visible={showPath} />}
            <Measurement points={measurePts} size={Math.max(0.02, radius * 0.008)} color="#ff4081" />
            <OrbitCamera
              orbit={orbit}
              radius={radius}
              // Touch input is already smooth; the smoothing setting is mainly for noisy gyro data.
              smoothing={gyro ? settings.smoothing : Math.max(settings.smoothing, 0.25)}
              cameraState={cameraState}
              autoRotate={autoRotate && !gyro}
            />
          </Canvas>

          {/* Transparent layer that receives touches, so gestures don't compete with the GL view. */}
          <GestureDetector gesture={gesture}>
            <View style={StyleSheet.absoluteFill} />
          </GestureDetector>

          <View
            pointerEvents="box-none"
            style={[styles.overlay, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 12 }]}
          >
            <Hud
              cameraState={cameraState}
              gyroDelta={gyro ? gyroDelta : null}
              model={model}
              layer={scene.layers.length > 1 ? layer : null}
              stats={scene.stats?.[layer.key]}
              legend={settings.colorMode === 'errors' && hasErrors}
              distance={measureDistance}
              measuring={measuring}
            />

            <View pointerEvents="box-none" style={styles.bottom}>
              {gyro && (
                <Text style={styles.tip}>Turn or steer the phone to orbit, tilt it to change height. Pinch to zoom.</Text>
              )}
              {measuring && measurePts.length < 2 && (
                <Text style={styles.tip}>Tap {measurePts.length === 0 ? 'the first' : 'the second'} point to measure.</Text>
              )}

              {panel === 'views' && (
                <View style={styles.panel}>
                  <View style={styles.row}>
                    {(['top', 'front', 'side', 'iso'] as ViewPreset[]).map((p) => (
                      <SmallButton
                        key={p}
                        label={{ top: 'Top', front: 'Front', side: 'Side', iso: '3D' }[p]}
                        onPress={() => applyPreset(p)}
                      />
                    ))}
                  </View>
                  <SwitchRow label="Auto-rotate" value={autoRotate && !gyro} disabled={gyro} onChange={setAutoRotate} />
                </View>
              )}

              {panel === 'tools' && (
                <View style={styles.panel}>
                  <View style={styles.row}>
                    <SmallButton
                      label={measuring ? 'Stop measuring' : 'Measure'}
                      active={measuring}
                      onPress={() => {
                        setMeasuring((m) => !m);
                        setMeasurePts([]);
                        invalidate();
                      }}
                    />
                    <SmallButton label="Share view" onPress={share} />
                  </View>
                  <View>
                    <View style={styles.sliderHeader}>
                      <Text style={styles.panelLabel}>Height cut</Text>
                      <Text style={styles.panelValue}>{cut >= 0.999 ? 'Off' : `${fmt(cut * height)} m`}</Text>
                    </View>
                    <Slider
                      value={cut}
                      minimumValue={0.05}
                      maximumValue={1}
                      step={0.01}
                      onValueChange={setCut}
                      minimumTrackTintColor={colors.accent}
                      maximumTrackTintColor={colors.surfaceAlt}
                      thumbTintColor={colors.accent}
                    />
                  </View>
                  <Segmented<ColorMode>
                    value={settings.colorMode === 'errors' && !hasErrors ? 'original' : settings.colorMode}
                    options={[
                      { label: 'Colour', value: 'original' },
                      { label: 'Height', value: 'height' },
                      ...(hasErrors ? [{ label: 'Errors', value: 'errors' as const }] : []),
                    ]}
                    onChange={(colorMode) => update({ colorMode })}
                  />
                  {scene.trajectory && <SwitchRow label="Robot path" value={showPath} onChange={setShowPath} />}
                </View>
              )}

              {scene.layers.length > 1 && (
                <Segmented<number>
                  value={layerIndex}
                  options={scene.layers.map((l, i) => ({ label: l.label, value: i }))}
                  onChange={(i) => {
                    setLayerIndex(i);
                    invalidate();
                  }}
                />
              )}
              <Segmented<boolean>
                value={gyro}
                options={[
                  { label: 'Touch', value: false },
                  { label: 'Gyro', value: true },
                ]}
                onChange={setGyro}
              />
              <View style={styles.row}>
                <HudButton label="Recenter" onPress={recenter} />
                <HudButton
                  label="Views"
                  active={panel === 'views'}
                  onPress={() => setPanel((p) => (p === 'views' ? null : 'views'))}
                />
                <HudButton
                  label="Tools"
                  active={panel === 'tools'}
                  onPress={() => setPanel((p) => (p === 'tools' ? null : 'tools'))}
                />
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

const DEG = 180 / Math.PI;

/** Polls the camera ref at ~10 Hz, so only this small component re-renders. */
function Hud({
  cameraState,
  gyroDelta,
  model,
  layer,
  stats,
  legend,
  distance,
  measuring,
}: {
  cameraState: RefObject<CameraState | null>;
  gyroDelta: RefObject<OrientationDelta | null> | null;
  model: LoadedPly;
  layer: Layer | null;
  stats?: { residue: number; people: number; forklifts: number };
  legend: boolean;
  distance: number | null;
  measuring: boolean;
}) {
  const styles = useStyles();
  const [camera, setCamera] = useState<CameraState | null>(null);
  const [delta, setDelta] = useState<OrientationDelta | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      setCamera((prev) => (prev === cameraState.current ? prev : cameraState.current));
      setDelta(gyroDelta?.current ?? null);
    }, 100);
    return () => clearInterval(id);
  }, [cameraState, gyroDelta]);

  const d = model.dimensions;
  const isMesh = model.header.faceCount > 0;
  return (
    <View pointerEvents="none" style={styles.hud}>
      {camera && (
        <>
          <Text style={styles.hudLine}>
            X {fmt(camera.position.x)}  Y {fmt(camera.position.y)}  Z {fmt(camera.position.z)} m
          </Text>
          <Text style={styles.hudLine}>
            Azimuth {fmt(camera.azimuth, 1)}°  Elevation {fmt(camera.elevation, 1)}°  Dist. {fmt(camera.distance)} m
          </Text>
        </>
      )}
      <Text style={styles.hudLine}>
        Map {fmt(d.x)} × {fmt(d.z)} × {fmt(d.y)} m (W×D×H) · {fmtInt(model.header.vertexCount)}{' '}
        {isMesh ? 'vertices' : 'points'}
      </Text>
      {layer && (
        <Text style={styles.hudStrong}>
          {layer.label}: {layer.note}
        </Text>
      )}
      {stats && (
        <Text style={styles.hudLine}>
          Dynamic residue {fmtInt(stats.residue)} pts · people {fmtInt(stats.people)} · forklifts {fmtInt(stats.forklifts)}
        </Text>
      )}
      {legend &&
        ERROR_CLASSES.map((c) => (
          <View key={c.label} style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: c.color }]} />
            <Text style={styles.hudLine}>{c.label}</Text>
          </View>
        ))}
      {(measuring || distance !== null) && (
        <Text style={styles.hudStrong}>{distance !== null ? `Distance ${fmt(distance)} m` : 'Measuring…'}</Text>
      )}
      {gyroDelta && (
        <Text style={styles.hudLine}>
          Gyro {delta ? `turn ${fmt(delta.horizontal * DEG, 1)}°  tilt ${fmt(delta.vertical * DEG, 1)}°` : 'waiting for sensor…'}
        </Text>
      )}
    </View>
  );
}

function HudButton({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) {
  const styles = useStyles();
  return (
    <Pressable
      style={({ pressed }) => [styles.button, active && styles.buttonActive, pressed && { opacity: 0.6 }]}
      onPress={onPress}
    >
      <Text style={[styles.buttonText, active && styles.buttonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SmallButton({ label, onPress, active }: { label: string; onPress: () => void; active?: boolean }) {
  const styles = useStyles();
  return (
    <Pressable
      style={({ pressed }) => [styles.small, active && styles.buttonActive, pressed && { opacity: 0.6 }]}
      onPress={onPress}
    >
      <Text style={[styles.buttonText, active && styles.buttonTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SwitchRow(props: { label: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.switchRow}>
      <Text style={[styles.panelLabel, props.disabled && { opacity: 0.5 }]}>{props.label}</Text>
      <Switch
        value={props.value}
        disabled={props.disabled}
        onValueChange={props.onChange}
        trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
      />
    </View>
  );
}

function Segmented<T extends string | number | boolean>(props: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.segment}>
      {props.options.map((o) => {
        const active = o.value === props.value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => props.onChange(o.value)}
            style={[styles.segmentItem, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
    muted: { color: colors.textMuted, textAlign: 'center' },
    error: { color: colors.danger, fontSize: 16, fontWeight: '600' },
    overlay: { ...StyleSheet.absoluteFill, justifyContent: 'space-between', paddingHorizontal: 12 },
    hud: {
      backgroundColor: colors.hudBg,
      borderRadius: 10,
      padding: 10,
      gap: 2,
      alignSelf: 'flex-start',
      maxWidth: '100%',
    },
    hudLine: { color: colors.text, fontSize: 12, fontVariant: ['tabular-nums'] },
    hudStrong: { color: colors.text, fontSize: 12, fontWeight: '700' },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 9, height: 9, borderRadius: 5 },
    bottom: { gap: 8, alignItems: 'center' },
    row: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' },
    panel: {
      alignSelf: 'stretch',
      backgroundColor: colors.hudBg,
      borderRadius: 14,
      padding: 12,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    panelLabel: { color: colors.text, fontSize: 14 },
    panelValue: { color: colors.accent, fontSize: 14, fontVariant: ['tabular-nums'] },
    sliderHeader: { flexDirection: 'row', justifyContent: 'space-between' },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    segment: {
      flexDirection: 'row',
      backgroundColor: colors.hudBg,
      borderRadius: 20,
      padding: 3,
      borderWidth: 1,
      borderColor: colors.border,
      alignSelf: 'center',
    },
    segmentItem: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 17 },
    segmentActive: { backgroundColor: colors.accent },
    segmentText: { color: colors.text, fontWeight: '600' },
    segmentTextActive: { color: colors.onAccent },
    button: {
      backgroundColor: colors.hudBg,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: colors.border,
    },
    small: { backgroundColor: colors.surfaceAlt, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
    buttonActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    buttonText: { color: colors.text, fontWeight: '600' },
    buttonTextActive: { color: colors.onAccent },
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
  }),
);
