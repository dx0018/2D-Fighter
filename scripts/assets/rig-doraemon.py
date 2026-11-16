"""Bind satriek's CC BY 4.0 Doraemon to an articulated game rig.

blender --background --factory-startup --disable-autoexec --python \
  scripts/assets/rig-doraemon.py -- source.glb public/models/doraemon.glb
No downloaded Blender scripts or drivers are executed.
"""
import bpy
import sys
from mathutils import Vector, Matrix

source, destination = sys.argv[sys.argv.index("--") + 1:]
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=source)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
points = [o.matrix_world @ v.co for o in meshes for v in o.data.vertices]
lo = Vector([min(p[i] for p in points) for i in range(3)])
hi = Vector([max(p[i] for p in points) for i in range(3)])
offset = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
scale = 3.1 / (hi.z - lo.z)
for obj in meshes:
    world = obj.matrix_world.copy()
    for v in obj.data.vertices:
        v.co = (world @ v.co - offset) * scale
    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)
    for p in obj.data.polygons:
        p.use_smooth = True
for obj in list(bpy.context.scene.objects):
    if obj.type != "MESH":
        bpy.data.objects.remove(obj, do_unlink=True)

data = bpy.data.armatures.new("Doraemon_Rig")
rig = bpy.data.objects.new("Doraemon_Rig", data)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
rig.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
def bone(name, a, b, parent=None):
    item = data.edit_bones.new(name)
    item.head, item.tail = a, b
    if parent:
        item.parent = data.edit_bones[parent]
    return item
bone("Hips", (0, 0, .50), (0, 0, .85))
bone("Spine", (0, 0, .85), (0, 0, 1.20), "Hips")
bone("Chest", (0, 0, 1.20), (0, 0, 1.42), "Spine")
bone("Head", (0, 0, 1.42), (0, 0, 2.65), "Chest")
for side, label in [(1, "L"), (-1, "R")]:
    bone("UpperArm_" + label, (side * .56, 0, 1.22), (side * .85, 0, 1.01), "Chest")
    bone("Forearm_" + label, (side * .85, 0, 1.01), (side * 1.15, 0, .80), "UpperArm_" + label)
    bone("Hand_" + label, (side * 1.15, 0, .80), (side * 1.35, 0, .80), "Forearm_" + label)
    bone("Thigh_" + label, (side * .30, 0, .50), (side * .30, -.015, .32), "Hips")
    bone("Shin_" + label, (side * .30, -.015, .32), (side * .30, 0, .15), "Thigh_" + label)
    bone("Foot_" + label, (side * .30, 0, .15), (side * .30, -.30, .15), "Shin_" + label)
bpy.ops.object.mode_set(mode="OBJECT")

def components(mesh):
    neighbours = [[] for _ in mesh.vertices]
    for edge in mesh.edges:
        a, b = edge.vertices
        neighbours[a].append(b)
        neighbours[b].append(a)
    seen = set()
    for start in range(len(neighbours)):
        if start in seen:
            continue
        stack, found = [start], []
        seen.add(start)
        while stack:
            i = stack.pop()
            found.append(i)
            for n in neighbours[i]:
                if n not in seen:
                    seen.add(n)
                    stack.append(n)
        yield found

for obj in meshes:
    groups = {b.name: obj.vertex_groups.new(name=b.name) for b in data.bones}
    for component in components(obj.data):
        center = sum((obj.data.vertices[i].co for i in component), Vector()) / len(component)
        # Preserve disconnected face pieces as rigid head geometry: no melted eyes,
        # nose or whiskers. The collar and bell follow the chest independently.
        head = center.z > 1.55
        for i in component:
            p = obj.data.vertices[i].co
            label = "L" if p.x >= 0 else "R"
            if head:
                weights = {"Head": 1}
            elif obj.name.startswith("Object_20"):
                weights = {"Hand_" + label: 1}
            elif obj.name.startswith("Object_18"):
                t = max(0, min(1, (abs(p.x) - .72) / .32))
                weights = {"UpperArm_" + label: 1 - t, "Forearm_" + label: t}
            elif p.z < .26:
                weights = {"Foot_" + label: 1}
            elif p.z < .49 and abs(p.x) > .10:
                t = max(0, min(1, (p.z - .26) / .23))
                weights = {"Shin_" + label: 1 - t, "Thigh_" + label: t}
            else:
                t = max(0, min(1, (p.z - .55) / .64))
                weights = {"Hips": 1 - t, "Chest": t}
            for name, weight in weights.items():
                if weight > 0:
                    groups[name].add([i], weight, "REPLACE")
    obj.parent = rig
    modifier = obj.modifiers.new("Game skeleton", "ARMATURE")
    modifier.object = rig
rig["source"] = "https://sketchfab.com/3d-models/doraemon-b11372b0c29a4ef4b9691180d05870ec"
rig["author"] = "satriek"
rig["license"] = "CC BY 4.0"
rig["modifications"] = "Normalized, smoothed and rigged for Pocket Clash."
bpy.ops.export_scene.gltf(filepath=destination, export_format="GLB", export_extras=True,
                          export_animations=False, export_yup=True)
