import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'MapDetails'>;

// Step 3: metadata, "Abrir em 3D", "Apagar mapa".
export default function MapDetailsScreen({ route }: Props) {
  return (
    <View style={styles.root}>
      <Text style={styles.text}>Detalhes do mapa {route.params.mapId}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.textMuted },
});
