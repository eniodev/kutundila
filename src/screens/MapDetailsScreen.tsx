import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteMap, getMap } from '../storage/maps';
import { colors } from '../theme';
import type { MapMeta, RootStackParamList, UpAxis } from '../types';
import { fmt, fmtBytes, fmtInt } from '../utils/format';
import { changeUpAxis } from '../utils/importMap';

type Props = NativeStackScreenProps<RootStackParamList, 'MapDetails'>;

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

export default function MapDetailsScreen({ route, navigation }: Props) {
  const { mapId } = route.params;
  const insets = useSafeAreaInsets();
  const [map, setMap] = useState<MapMeta | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getMap(mapId).then((m) => {
        setMap(m ?? null);
        if (m) navigation.setOptions({ title: m.name });
      });
    }, [mapId, navigation]),
  );

  if (map === undefined) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (map === null) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.muted}>Mapa não encontrado.</Text>
      </View>
    );
  }

  const onAxis = async (axis: UpAxis) => {
    if (axis === map.upAxis || busy) return;
    setBusy(true);
    try {
      setMap(await changeUpAxis(map, axis));
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () =>
    Alert.alert('Apagar mapa', `Apagar “${map.name}”? Esta ação não pode ser desfeita.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await deleteMap(map.id);
          navigation.goBack();
        },
      },
    ]);

  const d = map.dimensions;
  const rows: [string, string][] = [
    ['Tipo', map.hasFaces ? 'Malha (com faces)' : 'Nuvem de pontos'],
    [map.hasFaces ? 'Vértices' : 'Pontos', fmtInt(map.pointCount)],
    ['Dimensões (L × P × A)', `${fmt(d.x)} × ${fmt(d.z)} × ${fmt(d.y)} m`],
    ['Formato', map.format === 'binary' ? 'Binário' : 'ASCII'],
    ['Cor', map.hasColor ? 'Sim' : 'Não'],
    ['Tamanho', fmtBytes(map.sizeBytes)],
    ['Importado em', fmtDate(map.importedAt)],
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.preview}>
        <Text style={styles.previewIcon}>{map.hasFaces ? '◆' : '⁘'}</Text>
        <Text style={styles.muted}>{map.hasFaces ? 'Malha 3D' : 'Nuvem de pontos 3D'}</Text>
      </View>

      <View style={styles.card}>
        {rows.map(([k, v]) => (
          <View key={k} style={styles.row}>
            <Text style={styles.key}>{k}</Text>
            <Text style={styles.value}>{v}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.key}>Eixo vertical</Text>
        <Text style={styles.hint}>Mapas de SLAM/ROS costumam usar Z para cima. Mude se o mapa aparecer deitado.</Text>
        <View style={styles.segment}>
          {(['z', 'y'] as UpAxis[]).map((a) => (
            <Pressable
              key={a}
              disabled={busy}
              onPress={() => onAxis(a)}
              style={[styles.segmentItem, map.upAxis === a && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, map.upAxis === a && styles.segmentTextActive]}>
                {a.toUpperCase()} para cima
              </Text>
            </Pressable>
          ))}
        </View>
        {busy && <ActivityIndicator color={colors.accent} />}
      </View>

      <Pressable
        style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
        onPress={() => navigation.navigate('Viewer', { source: { kind: 'map', mapId: map.id } })}
      >
        <Text style={styles.primaryText}>Abrir em 3D</Text>
      </Pressable>

      <Pressable style={({ pressed }) => [styles.danger, pressed && styles.pressed]} onPress={onDelete}>
        <Text style={styles.dangerText}>Apagar mapa</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 14 },
  muted: { color: colors.textMuted },
  preview: {
    height: 160,
    backgroundColor: colors.surface,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewIcon: { color: colors.accent, fontSize: 48 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  key: { color: colors.textMuted, fontSize: 14 },
  value: { color: colors.text, fontSize: 14, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17 },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: 10, padding: 3 },
  segmentItem: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.accent },
  segmentText: { color: colors.textMuted, fontWeight: '600' },
  segmentTextActive: { color: '#00131c' },
  primary: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#00131c', fontWeight: '700', fontSize: 16 },
  danger: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: colors.danger },
  dangerText: { color: colors.danger, fontWeight: '600', fontSize: 16 },
  pressed: { opacity: 0.7 },
});
