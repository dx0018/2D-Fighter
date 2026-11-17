"""Rig user-supplied Sasuke / Susanoo OBJ assets. Arguments: sasuke-dir susanoo-dir.
No uploaded code is executed. Exports local textured GLBs with game skeletons.
"""
import bpy,sys,os,math
from mathutils import Vector
folders=sys.argv[sys.argv.index('--')+1:]
out=os.path.abspath(os.path.join(os.path.dirname(__file__),'../../public/models'))
def segment(p,a,b):
 v=b-a;t=max(0,min(1,(p-a).dot(v)/max(v.length_squared,1e-8)));return (p-a-v*t).length
for folder,name,height in zip(folders,['sasuke','susanoo'],[3.1,6.2]):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.wm.obj_import(filepath=os.path.join(folder,'sculptor-v2.obj'));mesh=bpy.context.selected_objects[0]
 bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
 lo=Vector([min(v.co[i] for v in mesh.data.vertices) for i in range(3)]);hi=Vector([max(v.co[i] for v in mesh.data.vertices) for i in range(3)])
 for v in mesh.data.vertices:v.co=(v.co-Vector(((lo.x+hi.x)/2,(lo.y+hi.y)/2,lo.z)))*(height/(hi.z-lo.z))
 mesh.name=name+'_skin';k=height/3.1
 data=bpy.data.armatures.new(name+'_skeleton');rig=bpy.data.objects.new(name+'_rig',data);bpy.context.collection.objects.link(rig)
 bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
 coords={}
 def bone(n,a,b,parent=None):
  a=Vector(a)*k;b=Vector(b)*k;item=data.edit_bones.new(n);item.head=a;item.tail=b
  if parent:item.parent=data.edit_bones[parent]
  coords[n]=(a,b)
 bone('Hips',(0,0,1.35),(0,0,1.65));bone('Spine',(0,0,1.65),(0,0,1.98),'Hips');bone('Chest',(0,0,1.98),(0,0,2.38),'Spine');bone('Head',(0,0,2.48),(0,0,2.95),'Chest')
 for side,label in [(1,'L'),(-1,'R')]:
  sx=.38 if name=='sasuke' else .45
  bone('UpperArm_'+label,(side*sx,0,2.29),(side*.59,-.015,1.91),'Chest')
  bone('Forearm_'+label,(side*.59,-.015,1.91),(side*.73,-.04,1.53),'UpperArm_'+label)
  bone('Hand_'+label,(side*.73,-.04,1.53),(side*.76,-.05,1.37),'Forearm_'+label)
  bone('Thigh_'+label,(side*.23,0,1.35),(side*.25,-.03,.72),'Hips')
  bone('Shin_'+label,(side*.25,-.03,.72),(side*.26,0,.18),'Thigh_'+label)
  bone('Foot_'+label,(side*.26,0,.18),(side*.26,-.26,.10),'Shin_'+label)
 bpy.ops.object.mode_set(mode='OBJECT');groups={n:mesh.vertex_groups.new(name=n) for n in coords}
 for v in mesh.data.vertices:
  p=v.co;q=p/k;x,y,z=q;label='L' if x>=0 else 'R'
  if name=='susanoo' and abs(x)>.82 and z>.60:
   choices=['Hand_'+label] # Keep held bow and arrow rigid with each hand.
  elif z>2.49:choices=['Head']
  elif (z>1.36 and abs(x)>.53) or (z>1.72 and abs(x)>.37):choices=['UpperArm_'+label,'Forearm_'+label,'Hand_'+label]
  elif z<1.15:choices=['Thigh_'+label,'Shin_'+label,'Foot_'+label]
  else:choices=['Hips','Spine','Chest']
  ds=sorted([(segment(p,*coords[n]),n) for n in choices])[:2]
  if len(ds)==1:weights=[(ds[0][1],1)]
  else:
   ws=[1/max(.025*k,d)**4 for d,n in ds];weights=[(n,w/sum(ws)) for (d,n),w in zip(ds,ws)]
  for n,w in weights:groups[n].add([v.index],w,'REPLACE')
 mesh.parent=rig;mod=mesh.modifiers.new('Game skeleton','ARMATURE');mod.object=rig
 for poly in mesh.data.polygons:poly.use_smooth=True
 for m in mesh.data.materials:
  bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.85;bs.inputs['Metallic'].default_value=0
 for image in bpy.data.images:
  if image.source=='FILE':
   image.scale(1024,1024);image.filepath_raw=os.path.join(folder,name+'-texture.jpg');image.file_format='JPEG';image.save();image.pack()
 bpy.ops.export_scene.gltf(filepath=os.path.join(out,name+'.glb'),export_format='GLB',export_animations=False,export_image_format='JPEG')
 print('EXPORTED',name,len(mesh.data.vertices))
