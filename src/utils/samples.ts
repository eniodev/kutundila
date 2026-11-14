import type { UpAxis } from '../types';

export type Sample = {
  id: string;
  name: string;
  description: string;
  /** Source and licence, shown under the description. See assets/models/CREDITS.md. */
  credit: string;
  upAxis: UpAxis;
  module: number;
};

/** Bundled models, so demos don't depend on importing files. All downsampled for mobile. */
export const SAMPLES: Sample[] = [
  {
    id: 'facility',
    name: 'Simulated facility',
    description: 'Final map from this project: RTAB-Map SLAM, semantic + geometric filter, DUFOMap cleaning',
    credit: 'twin-mapping project · 8 cm voxels',
    upAxis: 'z',
    module: require('../../assets/models/sim_facility.ply'),
  },
  {
    id: 'copyroom',
    name: 'Copy room (real scan)',
    description: 'Handheld RGB-D SLAM reconstruction of a real room, levelled and downsampled',
    credit: 'BundleFusion, Stanford (Dai et al. 2017) · CC BY-NC-SA 4.0',
    upAxis: 'z',
    module: require('../../assets/models/bundlefusion_copyroom.ply'),
  },
  {
    id: 'livingroom',
    name: 'Living room',
    description: 'Complete synthetic living room (no colour — try “By height”)',
    credit: 'ICL-NUIM / Augmented ICL-NUIM (Handa 2014, Choi 2015) · CC BY 3.0',
    upAxis: 'y',
    module: require('../../assets/models/icl_livingroom.ply'),
  },
  {
    id: 'office',
    name: 'Office',
    description: 'Complete synthetic office (no colour — try “By height”)',
    credit: 'ICL-NUIM / Augmented ICL-NUIM (Handa 2014, Choi 2015) · CC BY 3.0',
    upAxis: 'y',
    module: require('../../assets/models/icl_office.ply'),
  },
  {
    id: 'bunny',
    name: 'Stanford Bunny',
    description: 'Classic 3D-scanned mesh (ASCII PLY with faces)',
    credit: 'Stanford 3D Scanning Repository',
    upAxis: 'y',
    module: require('../../assets/models/stanford_bunny.ply'),
  },
];

export const getSample = (id: string) => SAMPLES.find((s) => s.id === id);
