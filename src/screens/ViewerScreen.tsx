import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Canvas } from '@react-three/fiber/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOrbitGestures } from '../hooks/useOrbitGestures';
import { useSettings } from '../hooks/useSettings';
import { createOrbitState, type OrbitState } from '../three/orbit';
import { OrbitCamera } from '../three/OrbitCamera';
import { PlyModel } from '../three/PlyModel';
import { colors } from '../theme';
import type { CameraState, ModelSource, RootStackParamList } from '../types';
import { fmt, fmtInt } from '../utils/format';
import { nextFrame, readAssetBytes } from '../utils/files';
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
    if (!sample) throw new Error('Modelo de teste não encontrado.');
    const bytes = await readAssetBytes(sample.module);
    await nextFrame();
    return { model: buildPlyGeometry(bytes, sample.upAxis), name: sample.name };
  }
  // Step 3: imported maps.
  throw new Error('Abrir mapas importados chega na próxima fase.');
}

export default function ViewerScreen({ route, navigation }: Props) {
  const { source } = route.params;
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [camera, setCamera] = useState<CameraState | null>(null);
  const orbit = useRef<OrbitState>(createOrbitState(1));
  const gesture = useOrbitGestures(orbit);

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
    if (state.status === 'ready') Object.assign(orbit.current, createOrbitState(state.model.radius));
  }, [state]);

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
              hasColor={state.model.header.hasColor}
              pointSize={settings.pointSize}
            />
            <OrbitCamera
              orbit={orbit}
              radius={state.model.radius}
              // Gestures are already smooth; the low default (0.1) is tuned for noisy gyro data.
              smoothing={Math.max(settings.smoothing, 0.25)}
              onCameraState={setCamera}
            />
          </Canvas>

          {/* Transparent layer that receives touches, so gestures don't compete with the GL view. */}
          <GestureDetector gesture={gesture}>
            <View style={StyleSheet.absoluteFill} />
          </GestureDetector>

          <View pointerEvents="box-none" style={[styles.overlay, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 16 }]}>
            <Hud camera={camera} model={state.model} />
            <View style={styles.actions}>
              <HudButton label="Recentrar" onPress={recenter} />
              <HudButton label="Definições" onPress={() => navigation.navigate('Settings')} />
            </View>
          </View>
        </>
      )}

      {state.status === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.muted}>A carregar o modelo…</Text>
        </View>
      )}

      {state.status === 'error' && (
        <View style={styles.center}>
          <Text style={styles.error}>Não foi possível abrir o modelo</Text>
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
            Azimute {fmt(camera.azimuth, 1)}°  Elevação {fmt(camera.elevation, 1)}°  Dist. {fmt(camera.distance)} m
          </Text>
        </>
      ) : (
        <Text style={styles.hudLine}>—</Text>
      )}
      <Text style={styles.hudLine}>
        Mapa {fmt(d.x)} × {fmt(d.y)} × {fmt(d.z)} m · {fmtInt(model.header.vertexCount)} {isMesh ? 'vértices' : 'pontos'}
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
  actions: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  button: { backgroundColor: colors.hudBg, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, borderWidth: 1, borderColor: colors.border },
  buttonText: { color: colors.text, fontWeight: '600' },
});
