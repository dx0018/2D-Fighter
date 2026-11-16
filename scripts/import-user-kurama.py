"""Convert the user's textured OBJ into static fox and separate orb GLBs.
Usage: blender -b --python scripts/import-user-kurama.py -- /path/to/unzipped/model
"""
import bpy,bmesh,sys,os
from mathutils import Vector
source=sys.argv[sys.argv.index('--')+1]
out=os.path.abspath(os.path.join(os.path.dirname(__file__),'../public/models'))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.wm.obj_import(filepath=os.path.join(source,'sculptor-v2.obj'))
fox=bpy.context.selected_objects[0]
# Weld duplicated OBJ seams to identify the disconnected sphere reliably.
bm=bmesh.new();bm.from_mesh(fox.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
remaining=set(bm.verts);components=[]
while remaining:
 seed=remaining.pop();group={seed};todo=[seed]
 while todo:
  for edge in todo.pop().link_edges:
   for v in edge.verts:
    if v in remaining:remaining.remove(v);group.add(v);todo.append(v)
 components.append(group)
ball=min(components,key=lambda group:((sum((v.co for v in group),Vector())/len(group))-Vector((-.463,.185,0))).length)
print('Orb component vertices',len(ball))
if not 100<len(ball)<1000:raise RuntimeError('Unexpected orb component')
coords=[v.co.copy() for v in ball]
# Copy the mesh first so UVs remain intact when separating.
orb=fox.copy();orb.data=fox.data.copy();bpy.context.collection.objects.link(orb)
# Use spatial membership on the original duplicate vertices to preserve UV seams.
for ob,keep_ball in [(fox,False),(orb,True)]:
 mesh=bmesh.new();mesh.from_mesh(ob.data)
 def is_ball(v):return min((v.co-p).length_squared for p in coords)<1e-9
 bmesh.ops.delete(mesh,geom=[v for v in mesh.verts if is_ball(v)!=keep_ball],context='VERTS')
 mesh.to_mesh(ob.data);mesh.free()
bm.free()
# Compact local texture for browser delivery; keep all UVs.
image=next(im for im in bpy.data.images if im.name.startswith('Image_0'))
image.scale(1024,1024);image.filepath_raw=os.path.join(source,'kurama-texture.jpg');image.file_format='JPEG';image.save();image.pack()
for m in fox.data.materials:
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.78;bs.inputs['Metallic'].default_value=0
# Head is anchored around local forward 0 so its muzzle aligns above Naruto.
for v in fox.data.vertices:
 world=fox.matrix_world@v.co
 v.co=Vector((-world.y,world.x+.39,world.z))*(6.2/.52354699)
fox.matrix_world.identity();fox.name='User_Kurama_FullBody'
for p in fox.data.polygons:p.use_smooth=True
# Sphere normalized to radius one, reused for both charge and projectile.
pts=[orb.matrix_world@v.co for v in orb.data.vertices];lo=Vector([min(p[i] for p in pts) for i in range(3)]);hi=Vector([max(p[i] for p in pts) for i in range(3)]);center=(lo+hi)/2;radius=max(hi-lo)/2
for v,p in zip(orb.data.vertices,pts):v.co=(p-center)/radius
orb.matrix_world.identity();orb.name='User_Bijuu_Orb'
for p in orb.data.polygons:p.use_smooth=True
for ob,filename in [(fox,'kurama-user.glb'),(orb,'bijuu-user.glb')]:
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob
 bpy.ops.export_scene.gltf(filepath=os.path.join(out,filename),export_format='GLB',use_selection=True,export_apply=True,export_image_format='JPEG')
