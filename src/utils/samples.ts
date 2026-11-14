import type { UpAxis } from '../types';

export type Sample = {
  id: string;
  name: string;
  description: string;
  upAxis: UpAxis;
  module: number;
};

/** Bundled models, so development and demos don't depend on importing files. */
export const SAMPLES: Sample[] = [
  {
    id: 'facility',
    name: 'Simulated facility',
    description: 'Final SLAM map (semantic + geometric filter, DUFOMap-cleaned), 8 cm voxels',
    upAxis: 'z',
    module: require('../../assets/models/sim_facility.ply'),
  },
  {
    id: 'room',
    name: 'Synthetic room',
    description: 'Generated binary point cloud with colour (Z-up)',
    upAxis: 'z',
    module: require('../../assets/models/sample_room.ply'),
  },
  {
    id: 'torus',
    name: 'Torus mesh',
    description: 'Generated ASCII mesh with faces (Y-up)',
    upAxis: 'y',
    module: require('../../assets/models/sample_torus.ply'),
  },
];

export const getSample = (id: string) => SAMPLES.find((s) => s.id === id);
