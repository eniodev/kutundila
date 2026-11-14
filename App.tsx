import { StatusBar } from 'expo-status-bar';
import { LogBox } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SettingsProvider } from './src/hooks/useSettings';
import RootNavigator from './src/navigation/RootNavigator';

// Known-harmless warnings from @react-three/fiber internals and expo-gl's partial WebGL support.
LogBox.ignoreLogs([
  'THREE.Clock: This module has been deprecated',
  'THREE.WebGLRenderer: WEBGL_lose_context extension not supported',
  'THREE.WebGLRenderer: EXT_color_buffer_float extension not supported',
]);

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <RootNavigator />
          <StatusBar style="light" />
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
