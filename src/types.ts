export type Vec3 = { x: number; y: number; z: number };

export type PlyFormat = 'ascii' | 'binary';
export type UpAxis = 'y' | 'z';

/** Stored map metadata (AsyncStorage). The PLY file itself lives in the document directory. */
export type MapMeta = {
  id: string;
  name: string;
  filePath: string;
  importedAt: string;
  sizeBytes: number;
  format: PlyFormat;
  pointCount: number;
  hasFaces: boolean;
  hasColor: boolean;
  upAxis: UpAxis;
  /** Meters, from the bounding box (after up-axis correction). */
  dimensions: Vec3;
  /** Original center before centering. */
  center: Vec3;
};

export type ColorMode = 'original' | 'height';

export type Settings = {
  pointSize: number;
  colorMode: ColorMode;
  gyroEnabled: boolean;
  gyroSensitivity: number;
  smoothing: number;
};

export const DEFAULT_SETTINGS: Settings = {
  pointSize: 0.02,
  colorMode: 'original',
  gyroEnabled: false,
  gyroSensitivity: 1.5,
  smoothing: 0.1,
};

/** Memory-only camera state shown in the HUD. Angles in degrees, distances in meters. */
export type CameraState = {
  position: Vec3;
  azimuth: number;
  elevation: number;
  distance: number;
};

/** What the viewer should open: a bundled sample or an imported map. */
export type ModelSource =
  | { kind: 'sample'; sampleId: string }
  | { kind: 'map'; mapId: string };

export type RootStackParamList = {
  Library: undefined;
  MapDetails: { mapId: string };
  Viewer: { source: ModelSource };
  Settings: undefined;
};
