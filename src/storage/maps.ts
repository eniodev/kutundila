import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import type { MapMeta } from '../types';

const KEY = '@plytwin/maps';

/** Folder in the app document directory that holds the copied PLY files. */
export function mapsDirectory(): Directory {
  const dir = new Directory(Paths.document, 'maps');
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/**
 * The file for a map, resolved from its id. On iOS the document directory path can change
 * between app updates, so the stored filePath is informative and this is the source of truth.
 */
export function mapFile(id: string): File {
  return new File(mapsDirectory(), `${id}.ply`);
}

/** Thumbnail captured the first time a map is opened in 3D (may not exist). */
export function mapThumbnail(id: string): File {
  return new File(mapsDirectory(), `${id}.jpg`);
}

export async function listMaps(): Promise<MapMeta[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const maps: MapMeta[] = raw ? JSON.parse(raw) : [];
    return maps.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
  } catch {
    return [];
  }
}

export async function getMap(id: string): Promise<MapMeta | undefined> {
  return (await listMaps()).find((m) => m.id === id);
}

export async function saveMap(map: MapMeta): Promise<void> {
  const maps = (await listMaps()).filter((m) => m.id !== map.id);
  maps.push(map);
  await AsyncStorage.setItem(KEY, JSON.stringify(maps));
}

export async function deleteMap(id: string): Promise<void> {
  const file = mapFile(id);
  if (file.exists) file.delete();
  const thumb = mapThumbnail(id);
  if (thumb.exists) thumb.delete();
  const maps = (await listMaps()).filter((m) => m.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(maps));
}
