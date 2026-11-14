# Bundled model credits

All files were downsampled with `scripts/prepare-maps.mjs` (voxel grid) for mobile use.

| File | Source | Licence / terms |
|---|---|---|
| `facility_before.ply`, `facility_after.ply`, `facility_trajectory.json` | twin-mapping project, simulated warehouse with people and forklifts. Before = run `sim_baseline_20261102-1650_1` raw RTAB-Map cloud; after = run `sim_semgeo_20261102-1650_1` final map (semantic + geometric filter, DUFOMap). Built with `scripts/prepare-compare.mjs` (world frame, 7 cm voxels, per-voxel evaluation class from `error_cloud.ply`); trajectory from the baseline run's `rtabmap_poses.txt` | Own work |
| `bundlefusion_copyroom.ply` | BundleFusion dataset, `copyroom` (Dai, Nießner, Zollhöfer, Izadi, Theobalt, *BundleFusion*, ACM TOG 2017), https://graphics.stanford.edu/projects/bundlefusion/ — levelled with `scripts/align-mesh.mjs`, vertices only, 2 cm voxels | CC BY-NC-SA 4.0 (this derivative is shared under the same licence) |
| `icl_livingroom.ply`, `icl_office.ply` | Augmented ICL-NUIM (Choi, Zhou, Koltun, *Robust Reconstruction of Indoor Scenes*, CVPR 2015), based on ICL-NUIM (Handa et al., ICRA 2014); via Open3D downloads — 4 cm voxels, colour dropped (all white) | CC BY 3.0 |
| `stanford_bunny.ply` | Stanford 3D Scanning Repository (via Open3D downloads), unmodified | Free for research; credit Stanford Computer Graphics Laboratory |
