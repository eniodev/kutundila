import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme';
import type { RootStackParamList } from '../types';
import { SAMPLES } from '../utils/samples';

type Props = NativeStackScreenProps<RootStackParamList, 'Library'>;

export default function LibraryScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const onImport = () => {
    // Step 3: document picker + copy + metadata.
    Alert.alert('Importar PLY', 'A importação de ficheiros chega na próxima fase.');
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}>
        <Text style={styles.section}>Os meus mapas</Text>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Ainda não há mapas</Text>
          <Text style={styles.emptyText}>
            Exporte um mapa do robô em formato PLY, copie-o para o telemóvel e toque em
            “+ Importar PLY”.
          </Text>
        </View>

        <Text style={styles.section}>Modelos de teste</Text>
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
        style={({ pressed }) => [styles.fab, { bottom: insets.bottom + 24 }, pressed && styles.pressed]}
        onPress={onImport}
      >
        <Text style={styles.fabText}>+ Importar PLY</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
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
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
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
  fabText: { color: '#00131c', fontWeight: '700', fontSize: 15 },
});
