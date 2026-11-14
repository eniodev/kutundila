import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

// Step 6: point size, color mode, gyro sensitivity, smoothing, reset.
export default function SettingsScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.text}>Definições (em construção)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.textMuted },
});
