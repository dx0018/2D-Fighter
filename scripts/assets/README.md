# Model preparation

Place a source model in GLB format, verify its license and add the required attribution before configuring it in `src/config/content.js` or `src/config/naruto.js`.

`rig-doraemon.py` re-centers and scales satriek's CC BY 4.0 model, then adds a simple articulated skeleton with head, torso, arms and legs. It does not run any scripts from the downloaded model.

```sh
blender --background --factory-startup --disable-autoexec \
  --python scripts/assets/rig-doraemon.py -- \
  /path/to/source.glb public/models/doraemon.glb
```

At runtime, `model-loader.js` caches the local GLB, clones skinned actors for each player, resolves their named bones and animation clips, and retains the built-in model if loading fails. Add a new `rig` adapter there when another model uses different bone names or requires different attachment points.
