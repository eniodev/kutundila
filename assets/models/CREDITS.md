# Bundled model credits

All files were downsampled with `scripts/prepare-maps.mjs` (voxel grid) for mobile use.

| File | Source | Licence / terms |
|---|---|---|
| `sim_facility.ply` | Final map (`map/map_clean.ply`) from the twin-mapping project, run `sim_semgeo_20261102-1650_1`, 8 cm voxels | Own work |
| `bundlefusion_copyroom.ply` | BundleFusion dataset, `copyroom` (Dai, Nießner, Zollhöfer, Izadi, Theobalt, *BundleFusion*, ACM TOG 2017), https://graphics.stanford.edu/projects/bundlefusion/ — levelled with `scripts/align-mesh.mjs`, vertices only, 2 cm voxels | CC BY-NC-SA 4.0 (this derivative is shared under the same licence) |
| `icl_livingroom.ply`, `icl_office.ply` | Augmented ICL-NUIM (Choi, Zhou, Koltun, *Robust Reconstruction of Indoor Scenes*, CVPR 2015), based on ICL-NUIM (Handa et al., ICRA 2014); via Open3D downloads — 4 cm voxels, colour dropped (all white) | CC BY 3.0 |
| `stanford_bunny.ply` | Stanford 3D Scanning Repository (via Open3D downloads), unmodified | Free for research; credit Stanford Computer Graphics Laboratory |
