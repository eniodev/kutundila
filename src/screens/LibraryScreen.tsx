import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useLayoutEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listMaps } from '../storage/maps';
import { makeStyles, useTheme } from '../theme';
import type { MapMeta, RootStackParamList } from '../types';
import { fmt, fmtInt } from '../utils/format';
import { importPly, LARGE_POINT_COUNT, pickPlyFile, type PickedPly } from '../utils/importMap';
import { SAMPLES } from '../utils/samples';

type Props = NativeStackScreenProps<RootStackParamList, 'Library'>;

const confirmLarge = (picked: PickedPly) =>
  new Promise<boolean>((resolve) =>
    Alert.alert(
      'Very large map',
      `This file has ${fmtInt(picked.header.vertexCount)} points. Importing may be slow or run out of ` +
        'memory. Downsampling it first (voxel grid) is recommended.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Import anyway', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );

export default function LibraryScreen({ navigation }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [maps, setMaps] = useState<MapMeta[] | null>(null);
  const [importing, setImporting] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable hitSlop={8} onPress={() => navigation.navigate('Settings')}>
          <Text style={{ color: colors.accent, fontWeight: '600' }}>Settings</Text>
        </Pressable>
      ),
    });
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      listMaps().then(setMaps);
    }, []),
  );

  const onImport = async () => {
    try {
      const picked = await pickPlyFile();
      if (!picked) return;
      if (picked.header.vertexCount > LARGE_POINT_COUNT && !(await confirmLarge(picked))) return;

      setImporting(true);
      const map = await importPly(picked);
      setMaps(await listMaps());
      navigation.navigate('MapDetails', { mapId: map.id });
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : String(e));
    } finally {
      setImporting(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}>
        <Text style={styles.section}>My maps</Text>
        {maps === null ? (
          <ActivityIndicator color={colors.accent} />
        ) : maps.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No maps yet</Text>
            <Text style={styles.emptyText}>
              Export a map from the robot as a PLY file, copy it to this phone (Files, Drive, AirDrop…)
              and tap “+ Import PLY”.
            </Text>
          </View>
        ) : (
          maps.map((m) => (
            <Pressable
              key={m.id}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => navigation.navigate('MapDetails', { mapId: m.id })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={1}>{m.name}</Text>
                <Text style={styles.badge}>{m.hasFaces ? 'Mesh' : 'Point cloud'}</Text>
              </View>
              <Text style={styles.cardSub}>
                {m.format === 'binary' ? 'Binary' : 'ASCII'} · {fmtInt(m.pointCount)}{' '}
                {m.hasFaces ? 'vertices' : 'points'} · {fmt(m.dimensions.x, 1)} × {fmt(m.dimensions.z, 1)} ×{' '}
                {fmt(m.dimensions.y, 1)} m
              </Text>
            </Pressable>
          ))
        )}

        <Text style={styles.section}>Sample models</Text>
        {SAMPLES.map((s) => (
          <Pressable
            key={s.id}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => navigation.navigate('Viewer', { source: { kind: 'sample', sampleId: s.id } })}
          >
            <Text style={styles.cardTitle}>{s.name}</Text>
            <Text style={styles.cardSub}>{s.description}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Pressable
        disabled={importing}
        style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 24 }, (pressed || importing) && styles.pressed]}
        onPress={onImport}
      >
        <Text style={styles.fabText}>+ Import PLY</Text>
      </Pressable>

      {importing && (
        <View style={styles.overlay}>
          <View style={styles.overlayBox}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={styles.overlayText}>Importing and analysing the map…</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const useStyles = makeStyles((colors) =>
  StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 16, gap: 12 },
  section: { color: colors.textMuted, fontSize: 13, fontWeight: '600', textTransform: 'uppercase', marginTop: 8 },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    gap: 6,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  emptyText: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 4, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '600', flexShrink: 1 },
  badge: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  cardSub: { color: colors.textMuted, fontSize: 13 },
  pressed: { opacity: 0.7 },
  fab: {
    position: 'absolute',
    right: 20,
    backgroundColor: colors.accent,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 14,
    elevation: 4,
  },
  fabText: { color: colors.onAccent, fontWeight: '700', fontSize: 15 },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  overlayBox: { backgroundColor: colors.surface, borderRadius: 14, padding: 24, gap: 14, alignItems: 'center' },
  overlayText: { color: colors.text },
}),
);
