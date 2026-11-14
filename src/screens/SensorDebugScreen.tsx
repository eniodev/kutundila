import { DeviceMotion, type DeviceMotionMeasurement } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { anglesFromRotation } from '../hooks/useDeviceOrientation';
import { colors } from '../theme';
import { fmt } from '../utils/format';

/**
 * Diagnostics: raw DeviceMotion rotation plus the derived angles the gyro camera uses,
 * to check axis signs and ranges on a real phone.
 */
type Axis = 'alpha' | 'beta' | 'gamma';
const AXES: Axis[] = ['alpha', 'beta', 'gamma'];
const HINT: Record<Axis, string> = {
  alpha: 'turn around (compass / yaw)',
  beta: 'tilt forward / back (pitch)',
  gamma: 'tilt left / right (roll)',
};
const DEG = 180 / Math.PI;

type Range = Record<Axis, { min: number; max: number }>;
const emptyRange = (): Range => ({
  alpha: { min: Infinity, max: -Infinity },
  beta: { min: Infinity, max: -Infinity },
  gamma: { min: Infinity, max: -Infinity },
});

export default function SensorDebugScreen() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'unavailable' | 'denied'>('checking');
  const [m, setM] = useState<DeviceMotionMeasurement | null>(null);
  const [hz, setHz] = useState(0);
  const range = useRef<Range>(emptyRange());
  const count = useRef(0);
  const [, force] = useState(0);

  useEffect(() => {
    let sub: { remove: () => void } | undefined;
    let last: DeviceMotionMeasurement | null = null;
    let cancelled = false;

    (async () => {
      if (!(await DeviceMotion.isAvailableAsync())) return setStatus('unavailable');
      const perm = await DeviceMotion.requestPermissionsAsync();
      if (!perm.granted) return setStatus('denied');
      if (cancelled) return;
      setStatus('ok');
      DeviceMotion.setUpdateInterval(16);
      sub = DeviceMotion.addListener((data) => {
        last = data;
        count.current++;
        if (!data.rotation) return;
        for (const a of AXES) {
          const v = data.rotation[a];
          const r = range.current[a];
          if (v < r.min) r.min = v;
          if (v > r.max) r.max = v;
        }
      });
    })();

    // Render at ~10 Hz; sensor runs at ~60 Hz.
    const ui = setInterval(() => last && setM(last), 100);
    const rate = setInterval(() => {
      setHz(count.current);
      count.current = 0;
    }, 1000);

    return () => {
      cancelled = true;
      sub?.remove();
      clearInterval(ui);
      clearInterval(rate);
    };
  }, []);

  if (status !== 'ok') {
    const text = {
      checking: 'Checking the sensor…',
      unavailable: 'DeviceMotion is not available on this device.',
      denied: 'Motion permission denied.',
    }[status];
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.muted}>{text}</Text>
      </View>
    );
  }

  const rot = m?.rotation;
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.muted}>
        {Platform.OS} · {hz} Hz · orientation {m?.orientation ?? '—'}
      </Text>

      {AXES.map((a) => {
        const v = rot?.[a] ?? 0;
        const r = range.current[a];
        // alpha spans 0..2π (or -π..π); beta -π..π; gamma -π/2..π/2. Normalize the bar to ±π.
        const pct = Math.max(0, Math.min(1, (v + Math.PI) / (2 * Math.PI)));
        return (
          <View key={a} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.axis}>{a}</Text>
              <Text style={styles.value}>
                {fmt(v * DEG, 1)}° <Text style={styles.muted}>({fmt(v, 3)} rad)</Text>
              </Text>
            </View>
            <Text style={styles.hint}>{HINT[a]}</Text>
            <View style={styles.bar}>
              <View style={styles.barMid} />
              <View style={[styles.barDot, { left: `${pct * 100}%` }]} />
            </View>
            <Text style={styles.muted}>
              min {Number.isFinite(r.min) ? fmt(r.min * DEG, 1) : '—'}° · max{' '}
              {Number.isFinite(r.max) ? fmt(r.max * DEG, 1) : '—'}°
            </Text>
          </View>
        );
      })}

      {rot && (
        <View style={styles.card}>
          <Text style={styles.axis}>Derived (used by the gyro camera)</Text>
          {(() => {
            const d = anglesFromRotation(rot.alpha, rot.beta, rot.gamma);
            return (
              <>
                <Text style={styles.value}>heading {fmt(d.heading * DEG, 1)}°</Text>
                <Text style={styles.value}>pitch {fmt(d.pitch * DEG, 1)}°</Text>
                <Text style={styles.value}>roll {fmt(d.roll * DEG, 1)}°</Text>
                <Text style={styles.hint}>
                  heading: where the back of the phone points · pitch: up/down · roll: steering-wheel rotation
                </Text>
              </>
            );
          })()}
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.6 }]}
        onPress={() => {
          range.current = emptyRange();
          force((n) => n + 1);
        }}
      >
        <Text style={styles.buttonText}>Reset min / max</Text>
      </Pressable>

      <Text style={styles.help}>
        Hold the phone upright (screen facing you), then tilt it left/right, forward/back and turn
        around. The derived angles below are what the gyro camera uses.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { padding: 16, gap: 12 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 14, gap: 6, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  axis: { color: colors.accent, fontSize: 18, fontWeight: '700' },
  value: { color: colors.text, fontSize: 18, fontVariant: ['tabular-nums'] },
  hint: { color: colors.textMuted, fontSize: 12 },
  bar: { height: 10, backgroundColor: colors.surfaceAlt, borderRadius: 5, justifyContent: 'center' },
  barMid: { position: 'absolute', left: '50%', width: 1, height: 10, backgroundColor: colors.border },
  barDot: { position: 'absolute', width: 14, height: 14, marginLeft: -7, borderRadius: 7, backgroundColor: colors.accent },
  muted: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  button: { alignSelf: 'center', backgroundColor: colors.surfaceAlt, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  buttonText: { color: colors.text, fontWeight: '600' },
  help: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
});
