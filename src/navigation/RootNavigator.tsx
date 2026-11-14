import { DarkTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import LibraryScreen from '../screens/LibraryScreen';
import MapDetailsScreen from '../screens/MapDetailsScreen';
import SensorDebugScreen from '../screens/SensorDebugScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ViewerScreen from '../screens/ViewerScreen';
import { colors } from '../theme';
import type { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.surface, primary: colors.accent },
};

export default function RootNavigator() {
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator initialRouteName="Library">
        <Stack.Screen name="Library" component={LibraryScreen} options={{ title: 'Maps' }} />
        <Stack.Screen name="MapDetails" component={MapDetailsScreen} options={{ title: 'Map details' }} />
        <Stack.Screen
          name="Viewer"
          component={ViewerScreen}
          options={{ title: '3D viewer', headerTransparent: true, headerTintColor: colors.text }}
        />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        <Stack.Screen name="SensorDebug" component={SensorDebugScreen} options={{ title: 'Sensor diagnostics' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
