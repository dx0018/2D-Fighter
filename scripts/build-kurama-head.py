"""Build the game's original Kurama-inspired chakra head. Run with Blender -b --python."""
import bpy, math, os
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
def mat(name,color,glow=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=.65
 bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=glow
 return m
fur=mat('Burnished orange chakra',(.66,.16,.018),.18); cheek=mat('Amber muzzle',(.88,.32,.035),.12);ink=mat('Black eye markings',(.018,.009,.014));red=mat('Crimson eyes',(.95,.055,.012),1.2);ivory=mat('Ivory fangs',(1,.8,.43));mouth=mat('Mouth shadow',(.055,.009,.009));earmat=mat('Ear interior',(.18,.035,.013))
def sphere(name,p,s,material):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=p);o=bpy.context.object;o.name=name;o.scale=s;o.data.materials.append(material)
 for poly in o.data.polygons:poly.use_smooth=True
 return o
def tube(name,pts,r,material):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=3
 sp=c.splines.new('BEZIER');sp.bezier_points.add(len(pts)-1)
 for b,p in zip(sp.bezier_points,pts):b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(material);return o
def spike(name,base,tip,width,depth,material):
 # Tapered triangular fur, with a rounded bevel for light catches.
 x,y,z=base;verts=[(x-width,y-depth,z),(x+width,y-depth,z),(x+width,y+depth,z),(x-width,y+depth,z),tip]
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],[(0,1,2,3),(0,4,1),(1,4,2),(2,4,3),(3,4,0)]);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.data.materials.append(material)
 bevel=o.modifiers.new('Soft sculpt edges','BEVEL');bevel.width=.04;bevel.segments=3;o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
sphere('Cranium',(0,.03,0),(.85,.66,.87),fur)
sphere('Long upper muzzle',(0,-.61,-.23),(.47,.67,.32),cheek)
sphere('Open grin',(0,-.70,-.49),(.46,.59,.16),mouth)
sphere('Lower jaw',(0,-.64,-.63),(.43,.55,.16),fur)
sphere('Black nose',(0,-1.23,-.15),(.24,.12,.135),ink)
for side in [-1,1]:
 spike('Tall swept ear',(side*.60,.04,.60),(side*1.02,.14,1.70),.30,.20,fur)
 spike('Dark inner ear',(side*.61,-.165,.72),(side*.95,-.03,1.49),.17,.035,earmat)
 # Layered cheek fur points give a distinctive angular silhouette.
 for i in range(3):
  spike('Cheek fur',(side*.64,.0,.12-i*.24),(side*(1.18-i*.03),-.03,.12-i*.39),.22,.28,fur)
 eye=sphere('Black angular eye socket',(side*.49,-.57,.18),(.32,.12,.17),ink);eye.rotation_euler[1]=side*-.24
 eye=sphere('Narrow ruby eye',(side*.48,-.686,.18),(.19,.027,.076),red);eye.rotation_euler[1]=side*-.24
 sphere('Vertical slit pupil',(side*.48,-.716,.18),(.018,.012,.07),ink)
 tube('Heavy brow',[(side*.20,-.63,.30),(side*.48,-.69,.38),(side*.74,-.46,.42)],.065,fur)
 tube('Nine tails eye marking',[(side*.25,-.66,.13),(side*.52,-.64,-.01),(side*.75,-.43,-.17),(side*.85,-.29,-.35)],.055,ink)
 tube('Smile crease',[(side*.15,-1.13,-.39),(side*.40,-.90,-.40),(side*.58,-.54,-.28)],.027,ink)
 for i in range(2):
  spike('Upper ivory fang',(side*(.31-i*.13),-.91-i*.18,-.33),(side*(.30-i*.13),-.95-i*.18,-.61),.055,.07,ivory)
# Bake mesh modifiers and curves into a static asset; no animation or skeleton overhead.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.convert(target='MESH')
# Normalize total head height to 1.48; runtime controls apparent size.
verts=[o.matrix_world@v.co for o in bpy.context.selected_objects for v in o.data.vertices]
lo=min(v.z for v in verts);hi=max(v.z for v in verts);factor=1.48/(hi-lo)
for o in bpy.context.selected_objects:
 for v in o.data.vertices:
  v.co=o.matrix_world@v.co;v.co.z-=(lo+hi)/2;v.co*=factor
 o.matrix_world.identity()
bpy.context.view_layer.objects.active=bpy.context.selected_objects[0]
bpy.ops.object.join()
out=os.path.abspath(os.path.join(os.path.dirname(__file__),'../public/models/kurama-head.glb'))
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_apply=True)
