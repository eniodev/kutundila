import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';

import LibraryScreen from '../screens/LibraryScreen';
import MapDetailsScreen from '../screens/MapDetailsScreen';
import SensorDebugScreen from '../screens/SensorDebugScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ViewerScreen from '../screens/ViewerScreen';
import { useTheme } from '../theme';
import type { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const { colors, isDark } = useTheme();

  const theme = useMemo<Theme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: colors.bg,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        primary: colors.accent,
      },
    };
  }, [colors, isDark]);

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
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationContainer>
  );
}
