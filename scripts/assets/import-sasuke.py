"""Rig user-supplied Sasuke / Susanoo OBJ assets. Arguments: sasuke-dir susanoo-dir.
No uploaded code is executed. Exports local textured GLBs with game skeletons.
"""
import bpy,bmesh,sys,os,math
from array import array
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
 bow_path=[(1.25,-2.25,5.64),(1.78,-2.05,4.5),(1.8,-1.65,3.6),(1.58,-1.0,3.0),(1.8,-.1,2.55),(1.8,.8,1.6),(1.76,1.4,.7),(1.79,1.77,.28)]
 def bow_distance(p):return min(segment(p,Vector(a),Vector(b)) for a,b in zip(bow_path,bow_path[1:]))
 if name=='susanoo':
  # Remove the baked pale arrow and resting string. Both are driven effects now.
  image=next(im for im in bpy.data.images if im.source=='FILE')
  pixels=array('f',[0])*len(image.pixels);image.pixels.foreach_get(pixels);w,h=image.size
  uv=mesh.data.uv_layers.active.data;remove=[]
  arrow_center=Vector((-1.56259,-.63441,2.30986));arrow_direction=Vector((.112018,-.920537,-.374251)).normalized()
  for polygon in mesh.data.polygons:
   center=sum((mesh.data.vertices[i].co for i in polygon.vertices),Vector())/len(polygon.vertices)
   delta=center-arrow_center;distance=(delta-arrow_direction*delta.dot(arrow_direction)).length
   string_distance=segment(center,Vector(bow_path[0]),Vector(bow_path[-1]))
   if not ((center.x<-.8 and distance<.36) or (center.x>.6 and string_distance<.16)):continue
   colors=[]
   for index in polygon.loop_indices:
    u,v=uv[index].uv;ix=max(0,min(w-1,int(u*w)));iy=max(0,min(h-1,int(v*h)));i=(iy*w+ix)*4
    colors.append((pixels[i],pixels[i+2]))
   red=sum(c[0] for c in colors)/len(colors);blue=sum(c[1] for c in colors)/len(colors)
   if red>.18 and blue<red*1.35:remove.append(polygon.index)
  bm=bmesh.new();bm.from_mesh(mesh.data);bm.faces.ensure_lookup_table()
  bmesh.ops.delete(bm,geom=[bm.faces[i] for i in remove],context='FACES_ONLY');bm.to_mesh(mesh.data);bm.free()
  print('Removed baked arrow/string faces',len(remove))

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
  elbow=(side*.59,-.015,1.91);hand=(side*.73,-.04,1.53)
  if name=='susanoo':
   elbow=(.78,-.12,1.9) if side>0 else (-.75,-.09,1.78)
   hand=(.79,-.50,1.50) if side>0 else (-.78,-.43,1.20)
  bone('UpperArm_'+label,(side*sx,0,2.29),elbow,'Chest')
  bone('Forearm_'+label,elbow,hand,'UpperArm_'+label)
  bone('Hand_'+label,hand,(side*.76,-.05,1.37) if name=='sasuke' else (hand[0],hand[1]-.08,hand[2]-.12),'Forearm_'+label)
  bone('Thigh_'+label,(side*.23,0,1.35),(side*.25,-.03,.72),'Hips')
  bone('Shin_'+label,(side*.25,-.03,.72),(side*.26,0,.18),'Thigh_'+label)
  bone('Foot_'+label,(side*.26,0,.18),(side*.26,-.26,.10),'Shin_'+label)
 if name=='susanoo':
  grip=Vector((.79,-.5,1.5));up=(Vector(bow_path[0])-Vector(bow_path[-1])).normalized()
  bone('Bow_L',grip,grip+up*.25,'Hand_L')
 bpy.ops.object.mode_set(mode='OBJECT');groups={n:mesh.vertex_groups.new(name=n) for n in coords}
 for v in mesh.data.vertices:
  p=v.co;q=p/k;x,y,z=q;label='L' if x>=0 else 'R'
  if name=='susanoo' and p.x>.65 and bow_distance(p)<.5:
   choices=['Bow_L']
  elif z>2.49:choices=['Head']
  elif (z>1.36 and abs(x)>.53) or (z>1.72 and abs(x)>.37):choices=['UpperArm_'+label,'Forearm_'+label,'Hand_'+label]
  elif z<1.15:choices=['Thigh_'+label,'Shin_'+label,'Foot_'+label]
  else:choices=['Hips','Spine','Chest']
  ds=sorted([(segment(p,*coords[n]),n) for n in choices])[:2]
  if len(ds)==1:weights=[(ds[0][1],1)]
  else:
   ws=[1/max(.025*k,d)**4 for d,n in ds];weights=[(n,w/sum(ws)) for (d,n),w in zip(ds,ws)]
  for n,w in weights:groups[n].add([v.index],w,'REPLACE')
 if name=='susanoo':
  bow_points=[v.co for v in mesh.data.vertices if v.co.x>.65 and bow_distance(v.co)<.5]
  top=max(bow_points,key=lambda p:p.z);bottom=min(bow_points,key=lambda p:p.z)
  rig['bow_tip_top']=[top.x,top.z,-top.y];rig['bow_tip_bottom']=[bottom.x,bottom.z,-bottom.y]
 mesh.parent=rig;mod=mesh.modifiers.new('Game skeleton','ARMATURE');mod.object=rig
 for poly in mesh.data.polygons:poly.use_smooth=True
 for m in mesh.data.materials:
  bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Roughness'].default_value=.85;bs.inputs['Metallic'].default_value=0
 for image in bpy.data.images:
  if image.source=='FILE':
   image.scale(1024,1024);image.filepath_raw=os.path.join(folder,name+'-texture.jpg');image.file_format='JPEG';image.save();image.pack()
 bpy.ops.export_scene.gltf(filepath=os.path.join(out,name+'.glb'),export_format='GLB',export_animations=False,export_image_format='JPEG',export_extras=True)
 print('EXPORTED',name,len(mesh.data.vertices))
