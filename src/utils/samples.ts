import type { UpAxis } from '../types';

export type SampleLayer = {
  key: string;
  label: string;
  /** One line about what this layer shows. */
  note: string;
  module: number;
};

export type Sample = {
  id: string;
  name: string;
  description: string;
  /** Source and licence, shown under the description. See assets/models/CREDITS.md. */
  credit: string;
  upAxis: UpAxis;
  /** One layer for a normal model; several for a before/after comparison (same frame). */
  layers: SampleLayer[];
  /** Index of the layer shown first. */
  defaultLayer?: number;
  /** Robot path in the file's frame (Z-up), drawn as a line. */
  trajectory?: number[][];
  /** Per-layer evaluation numbers shown in the HUD. */
  stats?: Record<string, { residue: number; people: number; forklifts: number }>;
};

const single = (module: number): SampleLayer[] => [{ key: 'main', label: 'Map', note: '', module }];

/** Bundled models, so demos don't depend on importing files. All downsampled for mobile. */
export const SAMPLES: Sample[] = [
  {
    id: 'facility',
    name: 'Simulated facility: before and after',
    description:
      'This project’s warehouse map with people and forklifts moving. Compare the raw SLAM map with the filtered and cleaned one, and colour by errors to see the residue they left.',
    credit: 'twin-mapping project · runs sim_baseline_1 and sim_semgeo_1 · 7 cm voxels',
    upAxis: 'z',
    layers: [
      {
        key: 'before',
        label: 'Before',
        note: 'Raw RTAB-Map cloud, no filtering (baseline)',
        module: require('../../assets/models/facility_before.ply'),
      },
      {
        key: 'after',
        label: 'After',
        note: 'Semantic + geometric filter during SLAM, then DUFOMap cleaning',
        module: require('../../assets/models/facility_after.ply'),
      },
    ],
    defaultLayer: 1,
    trajectory: require('../../assets/models/facility_trajectory.json'),
    // From each run's metrics.json (dynamic residue = points within 15 cm of where movers were seen).
    stats: {
      before: { residue: 29773, people: 13408, forklifts: 16365 },
      after: { residue: 1341, people: 18, forklifts: 1323 },
    },
  },
  {
    id: 'copyroom',
    name: 'Copy room (real scan)',
    description: 'Handheld RGB-D SLAM reconstruction of a real room, levelled and downsampled.',
    credit: 'BundleFusion, Stanford (Dai et al. 2017) · CC BY-NC-SA 4.0',
    upAxis: 'z',
    layers: single(require('../../assets/models/bundlefusion_copyroom.ply')),
  },
  {
    id: 'livingroom',
    name: 'Living room',
    description: 'Complete synthetic living room. It has no colour, so try “By height”.',
    credit: 'ICL-NUIM / Augmented ICL-NUIM (Handa 2014, Choi 2015) · CC BY 3.0',
    upAxis: 'y',
    layers: single(require('../../assets/models/icl_livingroom.ply')),
  },
  {
    id: 'office',
    name: 'Office',
    description: 'Complete synthetic office. It has no colour, so try “By height”.',
    credit: 'ICL-NUIM / Augmented ICL-NUIM (Handa 2014, Choi 2015) · CC BY 3.0',
    upAxis: 'y',
    layers: single(require('../../assets/models/icl_office.ply')),
  },
  {
    id: 'bunny',
    name: 'Stanford Bunny',
    description: 'Classic 3D-scanned mesh (ASCII PLY with faces).',
    credit: 'Stanford 3D Scanning Repository',
    upAxis: 'y',
    layers: single(require('../../assets/models/stanford_bunny.ply')),
  },
];

export const getSample = (id: string) => SAMPLES.find((s) => s.id === id);
