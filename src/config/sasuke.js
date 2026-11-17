const assetBase = import.meta.env?.BASE_URL || "/";
export const sasuke = {
  id: "sasuke", name: "宇智波佐助", englishName: "SASUKE UCHIHA",
  tagline: "以雷火破局，以须佐制胜",
  description: "草薙剑近身压制，半须佐横劈控制距离，火遁远攻，完全体须佐蓄力射出查克拉之箭。",
  color: "#b794ff", bodyStyle: "sasuke",
  model: {src: `${assetBase}models/sasuke.glb`, height: 3.1, frontAxis: 1, rig: "sasuke"},
  previewImage: "previews/sasuke.webp", stats: {power:5,speed:4,range:4},
  maxHp:100,maxEnergy:100,speed:7.5,jump:12.6,
  locomotion:{stride:2.6,lift:.22,armSwing:.35},
  moves: {
    attack: {
      name:"草薙斩",description:"快速近身斩击，命中恢复能量；蹲下和空中有不同攻击。",
      kind:"melee",animation:"sasuke-slash",visual:"sword-slash",motion:{prepare:.3,reach:.9},
      inputBuffer:.18,recoveryMovement:.5,damage:8,range:2.45,cooldown:.43,cost:0,
      windup:.1,active:.1,recovery:.22,knockback:3.4,stun:.22,impact:{stop:.03,shake:.2},color:"#d6c3ff",
      variants:{
        crouch:{name:"草薙低扫",description:"蹲下横扫下段，可以被跳过。",animation:"sweep",posture:"crouch",range:2.65,hitY:.4,hitHeight:.7,damage:7,windup:.12},
        air:{name:"空中剑斩",description:"空中向前斩击，拦截跳跃对手。",animation:"air-kick",range:2.7,hitY:.7,hitHeight:1.35,damage:9},
      },
    },
    skill:{
      name:"须佐横劈",description:"身后显现紫色骨架，挥动查克拉剑向前横劈；只命中有效范围内的目标。",
      kind:"melee",animation:"susanoo-slash",visual:"susanoo-slash",damage:20,range:4.8,
      hitY:1.35,hitHeight:2.0,cooldown:3,cost:24,windup:.32,active:.16,recovery:.36,knockback:6,stun:.35,
      impact:{stop:.065,shake:.45},color:"#c39aff",
      variants:{
        forward:{name:"千鸟突进",description:"向敌人移动＋技能，掌心凝雷向前突刺。",kind:"dash",animation:"chidori",visual:"chidori",damage:18,range:2.5,dashSpeed:14,windup:.22,active:.28,recovery:.32,color:"#91caff"},
        backward:{name:"火遁·豪火球",description:"后退＋技能，结印后向前吐出火球，适合远程牵制。",kind:"projectile",animation:"fireball",visual:"fireball",damage:16,range:20,height:2.1,originX:1.0,radius:.5,projectileSpeed:13,windup:.35,active:.1,recovery:.3,knockback:5,color:"#ff934b"},
        crouch:{name:"须佐肋骨震",description:"蹲下＋技能，以肋骨护身并震开附近敌人；无额外无敌时间。",kind:"pulse",animation:"susanoo-guard",visual:"susanoo-guard",posture:"crouch",damage:14,range:3.2,hitY:.6,hitHeight:1.1,windup:.22,active:.16,recovery:.34},
        air:{name:"火遁·凤仙火",description:"空中＋技能，向斜下方射出小火球，落地会结束尚未释放的招式。",kind:"projectile",animation:"fireball",visual:"fireball",damage:14,range:18,height:1.2,originX:.9,radius:.4,projectileSpeed:15,angle:-.32,windup:.2,active:.12,recovery:.28,color:"#ffb15c"},
      },
    },
    ultimate:{name:"完全体须佐·天之矢",description:"完全体须佐在身后显形、抬弓蓄力后射出穿空之箭；蓄力可被打断。",
      kind:"projectile",animation:"susanoo-arrow",visual:"susanoo-arrow",aim:"susanoo-bow",damage:39,range:32,
      cooldown:11,cost:70,windup:1.2,active:.12,recovery:.5,height:3.05,originX:1.5,radius:.45,angle:-.12,
      projectileSpeed:25,knockback:10,stun:.65,impact:{stop:.1,shake:.8},color:"#bb8bff"},
  },
};
