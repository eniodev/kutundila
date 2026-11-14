import Slider from '@react-native-community/slider';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '../hooks/useSettings';
import { makeStyles, useTheme } from '../theme';
import type { ColorMode, RootStackParamList, ThemePreference } from '../types';
import { fmt } from '../utils/format';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { settings, update, reset } = useSettings();
  const insets = useSafeAreaInsets();

  const onReset = () =>
    Alert.alert('Reset settings', 'Restore all settings to their default values?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: reset },
    ]);

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.section}>Appearance</Text>
      <View style={styles.card}>
        <Segmented<ThemePreference>
          value={settings.theme}
          options={[
            { label: 'System', value: 'system' },
            { label: 'Light', value: 'light' },
            { label: 'Dark', value: 'dark' },
          ]}
          onChange={(theme) => update({ theme })}
        />
      </View>

      <Text style={styles.section}>3D view</Text>
      <View style={styles.card}>
        <SliderRow
          label="Point size"
          value={settings.pointSize}
          display={`${fmt(settings.pointSize * 100, 1)} cm`}
          min={0.005}
          max={0.1}
          step={0.005}
          onChange={(pointSize) => update({ pointSize })}
        />
        <Divider />
        <Text style={styles.label}>Colour</Text>
        <Segmented<ColorMode>
          value={settings.colorMode}
          options={[
            { label: 'Original', value: 'original' },
            { label: 'By height', value: 'height' },
          ]}
          onChange={(colorMode) => update({ colorMode })}
        />
      </View>

      <Text style={styles.section}>Gyroscope</Text>
      <View style={styles.card}>
        <Text style={styles.hint}>
          Turn the phone left/right (or rotate it like a steering wheel) to orbit; tilt it towards or away
          from you to change the height. Movement is measured from where you last pressed Recenter.
        </Text>
        <Divider />
        <SliderRow
          label="Sensitivity"
          value={settings.gyroSensitivity}
          display={`${fmt(settings.gyroSensitivity, 1)}×`}
          min={0.5}
          max={4}
          step={0.1}
          onChange={(gyroSensitivity) => update({ gyroSensitivity })}
        />
        <Divider />
        <SliderRow
          label="Smoothing"
          value={1 - settings.smoothing}
          display={settings.smoothing >= 0.99 ? 'Off' : `${Math.round((1 - settings.smoothing) * 100)}%`}
          min={0}
          max={0.98}
          step={0.01}
          onChange={(v) => update({ smoothing: Math.round((1 - v) * 100) / 100 })}
        />
        <Text style={styles.hint}>More smoothing hides sensor noise but makes the camera lag behind.</Text>
        <Divider />
        <View style={styles.switchRow}>
          <Text style={styles.label}>Invert horizontal direction</Text>
          <Switch
            value={settings.gyroInvert}
            onValueChange={(gyroInvert) => update({ gyroInvert })}
            trackColor={{ true: colors.accent, false: colors.surfaceAlt }}
          />
        </View>
      </View>

      <Pressable style={({ pressed }) => [styles.link, pressed && styles.pressed]} onPress={() => navigation.navigate('SensorDebug')}>
        <Text style={styles.linkText}>Sensor diagnostics</Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Pressable style={({ pressed }) => [styles.reset, pressed && styles.pressed]} onPress={onReset}>
        <Text style={styles.resetText}>Reset to defaults</Text>
      </Pressable>
    </ScrollView>
  );
}

function SliderRow(props: {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHeader}>
        <Text style={styles.label}>{props.label}</Text>
        <Text style={styles.value}>{props.display}</Text>
      </View>
      <Slider
        value={props.value}
        minimumValue={props.min}
        maximumValue={props.max}
        step={props.step}
        onValueChange={props.onChange}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.surfaceAlt}
        thumbTintColor={colors.accent}
      />
    </View>
  );
}

function Segmented<T extends string>(props: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.segment}>
      {props.options.map((o) => {
        const active = o.value === props.value;
        return (
          <Pressable key={o.value} onPress={() => props.onChange(o.value)} style={[styles.segmentItem, active && styles.segmentActive]}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Divider() {
  const styles = useStyles();
  const { colors } = useTheme();
  return <View style={styles.divider} />;
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 10 },
  section: { color: colors.textMuted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginTop: 8 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.border },
  label: { color: colors.text, fontSize: 15 },
  value: { color: colors.accent, fontSize: 15, fontVariant: ['tabular-nums'] },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  sliderRow: { gap: 4 },
  sliderHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 3 },
  segmentItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { color: colors.textMuted, fontWeight: '600' },
  segmentTextActive: { color: colors.onAccent },
  link: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  linkText: { color: colors.text, fontSize: 15 },
  chevron: { color: colors.textMuted, fontSize: 18 },
  reset: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.danger, marginTop: 8 },
  resetText: { color: colors.danger, fontWeight: '600', fontSize: 16 },
  pressed: { opacity: 0.7 },
}),
);
