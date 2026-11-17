const EPS=1e-7;
export function updateGuard(fighter,opponent,input={}) {
  const facing=Math.sign(opponent.x-fighter.x)||fighter.facing;
  const horizontal=Number(!!input.right)-Number(!!input.left);
  fighter.guardFacing=facing;
  fighter.guardLow=!!input.crouch;
  fighter.guarding=horizontal===-facing&&fighter.grounded&&!fighter.currentMove&&fighter.stun<=EPS&&!fighter.jumpStartup;
}
export function guardContact(attacker,target,move,direction) {
  if(!target.guarding||direction!==-target.guardFacing)return 'none';
  const overhead=!attacker.grounded&&move.kind!=='projectile';
  const low=!overhead&&(move.hitY??move.height??1.35)<.9;
  if((low&&!target.guardLow)||(overhead&&target.guardLow))return 'none';
  const cost=Math.max(10,Math.ceil(move.damage*.75));
  if(target.energy+EPS<cost){target.energy=0;target.guarding=false;target.guardBreak=.6;return 'broken';}
  target.energy-=cost;
  return 'blocked';
}
export function createSupplies(map) {
  return (map.supplies||[]).map(s=>({...s,active:false,remaining:s.initialDelay??8,cycle:s.initialDelay??8,contested:false}));
}
export function updateSupplies(game,dt) {
  for(const supply of game.state.supplies){
    if(!supply.active){supply.remaining=Math.max(0,supply.remaining-dt);if(supply.remaining<=EPS)supply.active=true;}
    supply.contested=false;
    if(!supply.active)continue;
    const nearby=game.state.fighters.filter(f=>f.hp>0&&f.grounded&&Math.abs(f.x-supply.x)<(supply.radius||1.25));
    if(nearby.length!==1){supply.contested=nearby.length>1;continue;}
    const fighter=nearby[0];
    if(fighter.stun>EPS||fighter.character.maxEnergy-fighter.energy<1)continue;
    const gain=Math.min(supply.energy,fighter.character.maxEnergy-fighter.energy);
    fighter.energy+=gain;supply.active=false;supply.remaining=supply.respawn;supply.cycle=supply.respawn;
    game.effect('pulse',supply.x,.7,'#7ce8ff',.4,{radius:1.2,visual:'supply'});
    game.event('supply',{player:fighter.id,energy:Math.round(gain),station:supply.id});
  }
}
