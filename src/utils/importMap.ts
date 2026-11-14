import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File, FileMode } from 'expo-file-system';

import { mapFile, saveMap } from '../storage/maps';
import type { MapMeta, UpAxis } from '../types';
import { nextFrame } from './files';
import { buildPlyGeometry, parsePlyHeader, type PlyHeader } from './ply';

/** Above this many vertices, ask before importing (parsing may be slow or run out of memory). */
export const LARGE_POINT_COUNT = 2_000_000;

export type PickedPly = {
  uri: string;
  name: string;
  size: number;
  header: PlyHeader;
};

/** Opens the document picker and validates the header. Returns null if the user cancels. */
export async function pickPlyFile(): Promise<PickedPly | null> {
  // PLY has no registered MIME type on most devices, so accept anything and validate.
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];

  if (!asset.name.toLowerCase().endsWith('.ply')) {
    throw new Error('Please choose a file with the .ply extension.');
  }

  // Read only the first chunk for the header.
  const handle = new File(asset.uri).open(FileMode.ReadOnly);
  let headerBytes: Uint8Array;
  try {
    headerBytes = handle.readBytesSync(64 * 1024);
  } finally {
    handle.close();
  }
  const header = parsePlyHeader(headerBytes);

  return { uri: asset.uri, name: asset.name, size: asset.size ?? new File(asset.uri).size, header };
}

/** Copies the picked file into the app, parses it once for metadata and saves the map. */
export async function importPly(picked: PickedPly, upAxis: UpAxis = 'z'): Promise<MapMeta> {
  const id = Crypto.randomUUID();
  const dest = mapFile(id);
  await new File(picked.uri).copy(dest);

  try {
    const bytes = await dest.bytes();
    await nextFrame();
    const { geometry, header, dimensions, center } = buildPlyGeometry(bytes, upAxis);
    geometry.dispose();

    const map: MapMeta = {
      id,
      name: picked.name.replace(/\.ply$/i, ''),
      filePath: dest.uri,
      importedAt: new Date().toISOString(),
      sizeBytes: picked.size,
      format: header.format,
      pointCount: header.vertexCount,
      hasFaces: header.faceCount > 0,
      hasColor: header.hasColor,
      upAxis,
      dimensions,
      center,
    };
    await saveMap(map);
    return map;
  } catch (e) {
    if (dest.exists) dest.delete();
    throw e;
  }
}

/** Re-parses a stored map with a different up axis and updates its dimensions. */
export async function changeUpAxis(map: MapMeta, upAxis: UpAxis): Promise<MapMeta> {
  const bytes = await mapFile(map.id).bytes();
  await nextFrame();
  const { geometry, dimensions, center } = buildPlyGeometry(bytes, upAxis);
  geometry.dispose();
  const updated = { ...map, upAxis, dimensions, center };
  await saveMap(updated);
  return updated;
}
