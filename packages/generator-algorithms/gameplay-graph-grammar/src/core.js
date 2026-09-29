export const GAMEPLAY_GRAPH_GRAMMAR_ALGORITHM_VERSION = '1';

const DEFAULTS=Object.freeze({ roomSizeMin:7, roomSizeMax:9, cellSpacing:14 });

function createPrng(seed){
  let state=seed>>>0;
  return()=>{
    state=(state+0x6d2b79f5)>>>0;
    let value=state;
    value=Math.imul(value^(value>>>15),value|1);
    value^=value+Math.imul(value^(value>>>7),value|61);
    return((value^(value>>>14))>>>0)/4294967296;
  };
}

function randomInt(prng,min,max){ return min+Math.floor(prng()*(max-min+1)); }
function clamp01(value){ return Math.max(0,Math.min(1,value)); }
function edgeKey(a,b){ return a<b?a+'|'+b:b+'|'+a; }

function validate({seed,roomCount,extraConnectionRatio,enemyCount,treasureCount,trapCount,recoveryCount,greedPunishment,fairness,exploration,roomSizeMin,roomSizeMax,cellSpacing}){
  if(!Number.isSafeInteger(seed)||seed<0) throw new TypeError('seed must be a non-negative safe integer');
  if(!Number.isInteger(roomCount)||roomCount<3||roomCount>64) throw new RangeError('roomCount must be an integer between 3 and 64');
  if(typeof extraConnectionRatio!=='number'||!Number.isFinite(extraConnectionRatio)||extraConnectionRatio<0||extraConnectionRatio>1) throw new RangeError('extraConnectionRatio must be between 0 and 1');
  for(const [name,value] of Object.entries({enemyCount,treasureCount,trapCount,recoveryCount})){
    if(!Number.isInteger(value)||value<0||value>128) throw new RangeError(name+' must be an integer between 0 and 128');
  }
  for(const [name,value] of Object.entries({greedPunishment,fairness,exploration})){
    if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1) throw new RangeError(name+' must be between 0 and 1');
  }
  if(!Number.isInteger(roomSizeMin)||!Number.isInteger(roomSizeMax)||roomSizeMin<4||roomSizeMax<roomSizeMin||roomSizeMax>16) throw new RangeError('room size bounds are invalid');
  if(!Number.isInteger(cellSpacing)||cellSpacing<roomSizeMax+3||cellSpacing>40) throw new RangeError('cellSpacing is invalid');
}

function buildLogicalCells(roomCount,seed){
  const width=Math.max(2,Math.ceil(Math.sqrt(roomCount)));
  const height=Math.ceil(roomCount/width);
  const raw=[];
  for(let z=0;z<height;z+=1){
    const remaining=roomCount-raw.length;
    const rowCount=Math.min(width,remaining);
    const xs=Array.from({length:rowCount},(_,x)=>x);
    if(z%2===1) xs.reverse();
    for(const x of xs) raw.push({x,z});
  }

  const rotation=seed%4;
  const reflected=((seed>>>2)&1)===1;
  const transformed=raw.map((cell)=>{
    let x=cell.x;
    let z=cell.z;
    if(reflected) x=-x;
    for(let turn=0;turn<rotation;turn+=1){
      const nextX=-z;
      const nextZ=x;
      x=nextX;
      z=nextZ;
    }
    return {x,z};
  });
  return {width,height,rotation,reflected,cells:transformed};
}

function chooseMotif(prng,weights){
  const entries=[
    ['challenge-reward',weights.challenge],
    ['hazard-recovery',weights.hazard],
    ['choice-reward',weights.choice],
    ['exploration',weights.exploration],
  ];
  const total=entries.reduce((sum,[,weight])=>sum+weight,0);
  let cursor=prng()*total;
  for(const [name,weight] of entries){
    cursor-=weight;
    if(cursor<=0) return name;
  }
  return entries.at(-1)[0];
}

function expandGrammar({roomCount,enemyCount,treasureCount,trapCount,recoveryCount,greedPunishment,fairness,exploration,prng}){
  const interior=roomCount-2;
  const roles=[];
  const applications=[];
  const weights={
    challenge:1+enemyCount*0.35,
    hazard:0.8+trapCount*0.4+greedPunishment,
    choice:0.7+treasureCount*0.25+exploration,
    exploration:0.8+exploration*1.5+fairness*0.25,
  };

  while(roles.length<interior){
    const motif=chooseMotif(prng,weights);
    let expansion;
    if(motif==='challenge-reward') expansion=['challenge','reward'];
    else if(motif==='hazard-recovery') expansion=['hazard','recovery'];
    else if(motif==='choice-reward') expansion=['choice','reward'];
    else expansion=['exploration'];
    const accepted=expansion.slice(0,interior-roles.length);
    roles.push(...accepted);
    applications.push({
      rule:'PROGRESS -> '+motif.toUpperCase().replaceAll('-','_'),
      expansion:accepted.slice(),
    });
  }

  if(enemyCount>0&&!roles.includes('challenge')) roles[0]='challenge';
  if(trapCount>0&&!roles.includes('hazard')) roles[Math.min(1,roles.length-1)]='hazard';
  if(treasureCount>0&&!roles.includes('reward')) roles[Math.max(0,roles.length-1)]='reward';
  if(recoveryCount>0&&!roles.includes('recovery')) roles[Math.floor(roles.length/2)]='recovery';

  return {roles,applications};
}

function buildBackbone(roomCount){
  return Array.from({length:roomCount-1},(_,index)=>({
    a:index,b:index+1,kind:'gameplay-grammar-backbone',
  }));
}

function buildLoopCandidates(cells,backbone){
  const indexByKey=new Map(cells.map((cell,index)=>[cell.x+','+cell.z,index]));
  const backboneKeys=new Set(backbone.map((edge)=>edgeKey(edge.a,edge.b)));
  const candidates=[];
  for(let a=0;a<cells.length;a+=1){
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const b=indexByKey.get((cells[a].x+dx)+','+(cells[a].z+dz));
      if(!Number.isInteger(b)||b<=a) continue;
      const key=edgeKey(a,b);
      if(backboneKeys.has(key)) continue;
      if(a===0&&b===cells.length-1) continue;
      candidates.push({a,b,kind:'gameplay-grammar-choice'});
    }
  }
  return candidates.sort((l,r)=>l.a-r.a||l.b-r.b);
}

function selectLoops(candidates,ratio,prng){
  const scored=candidates.map((edge,index)=>({edge,index,score:prng()}))
    .sort((l,r)=>l.score-r.score||l.index-r.index);
  const target=Math.round(ratio*candidates.length);
  return scored.slice(0,target).map(({edge})=>edge).sort((l,r)=>l.a-r.a||l.b-r.b);
}

function roleBuckets(nodes){
  const buckets=new Map();
  for(const node of nodes){
    for(const role of node.roles){
      if(!buckets.has(role)) buckets.set(role,[]);
      buckets.get(role).push(node.index);
    }
  }
  return buckets;
}

function assignEntities(nodes,counts,prng){
  const buckets=roleBuckets(nodes);
  const interior=nodes.filter((node)=>!node.roles.includes('start')&&!node.roles.includes('goal')).map((node)=>node.index);
  const assignments={enemy:[],treasure:[],trap:[],recovery:[]};
  const preferred={enemy:['challenge','choice'],treasure:['reward','choice'],trap:['hazard','choice'],recovery:['recovery','exploration']};

  for(const type of Object.keys(assignments)){
    const pool=[];
    for(const role of preferred[type]){
      for(const index of buckets.get(role)??[]){
        if(!pool.includes(index)) pool.push(index);
      }
    }
    for(const index of interior){ if(!pool.includes(index)) pool.push(index); }
    const offset=pool.length>0?Math.floor(prng()*pool.length):0;
    for(let n=0;n<counts[type];n+=1){
      assignments[type].push(pool[(offset+n)%pool.length]);
    }
  }
  return assignments;
}

function buildRooms(cells,{roomSizeMin,roomSizeMax,cellSpacing,prng}){
  const minX=Math.min(...cells.map((cell)=>cell.x));
  const maxX=Math.max(...cells.map((cell)=>cell.x));
  const minZ=Math.min(...cells.map((cell)=>cell.z));
  const maxZ=Math.max(...cells.map((cell)=>cell.z));
  const centerX=(minX+maxX)/2;
  const centerZ=(minZ+maxZ)/2;
  return cells.map((cell,index)=>({
    id:'room-'+String(index+1).padStart(3,'0'),
    cellX:cell.x,cellZ:cell.z,
    x:(cell.x-centerX)*cellSpacing,
    z:(cell.z-centerZ)*cellSpacing,
    width:randomInt(prng,roomSizeMin,roomSizeMax),
    depth:randomInt(prng,roomSizeMin,roomSizeMax),
  }));
}

export function generateGameplayGraphGrammarCore({
  seed,roomCount=8,extraConnectionRatio=0.5,
  enemyCount=1,treasureCount=2,trapCount=1,recoveryCount=1,
  greedPunishment=0.5,fairness=0.7,exploration=0.6,
  roomSizeMin=DEFAULTS.roomSizeMin,roomSizeMax=DEFAULTS.roomSizeMax,cellSpacing=DEFAULTS.cellSpacing,
}={}){
  validate({seed,roomCount,extraConnectionRatio,enemyCount,treasureCount,trapCount,recoveryCount,greedPunishment,fairness,exploration,roomSizeMin,roomSizeMax,cellSpacing});
  const grammarPrng=createPrng((seed^0x6772616d)>>>0);
  const loopPrng=createPrng((seed^0x6c6f6f70)>>>0);
  const assignmentPrng=createPrng((seed^0x726f6c65)>>>0);
  const roomPrng=createPrng((seed^0x726f6f6d)>>>0);

  const lattice=buildLogicalCells(roomCount,seed);
  const grammar=expandGrammar({roomCount,enemyCount,treasureCount,trapCount,recoveryCount,greedPunishment,fairness,exploration,prng:grammarPrng});
  const nodes=Array.from({length:roomCount},(_,index)=>({
    id:'node-'+String(index+1).padStart(3,'0'),
    index,
    roles:index===0?['start']:index===roomCount-1?['goal']:[grammar.roles[index-1]],
    cell:lattice.cells[index],
  }));
  const backbone=buildBackbone(roomCount);
  const loopCandidates=buildLoopCandidates(lattice.cells,backbone);
  const extraEdges=selectLoops(loopCandidates,extraConnectionRatio,loopPrng);
  for(const edge of extraEdges){
    for(const index of [edge.a,edge.b]){
      if(!nodes[index].roles.includes('choice')&&!nodes[index].roles.includes('start')&&!nodes[index].roles.includes('goal')) nodes[index].roles.push('choice');
    }
  }
  const assignments=assignEntities(nodes,{enemy:enemyCount,treasure:treasureCount,trap:trapCount,recovery:recoveryCount},assignmentPrng);
  const rooms=buildRooms(lattice.cells,{roomSizeMin,roomSizeMax,cellSpacing,prng:roomPrng});
  const finalEdges=[...backbone,...extraEdges];

  return {
    algorithm:'gameplay-graph-grammar',
    algorithmVersion:GAMEPLAY_GRAPH_GRAMMAR_ALGORITHM_VERSION,
    seed,
    options:{roomCount,extraConnectionRatio,enemyCount,treasureCount,trapCount,recoveryCount,greedPunishment:clamp01(greedPunishment),fairness:clamp01(fairness),exploration:clamp01(exploration),roomSizeMin,roomSizeMax,cellSpacing},
    grammar:{
      startSymbol:'DUNGEON',
      rootRule:'DUNGEON -> START PROGRESS GOAL',
      applications:grammar.applications,
    },
    lattice:{width:lattice.width,height:lattice.height,rotation:lattice.rotation,reflected:lattice.reflected},
    nodes,
    rooms,
    backboneEdges:backbone,
    extraEdges,
    finalEdges,
    entityAssignments:assignments,
    diagnostics:{
      roomCount,
      grammarApplicationCount:grammar.applications.length,
      roleCounts:Object.fromEntries(['challenge','hazard','reward','recovery','choice','exploration'].map((role)=>[role,nodes.filter((node)=>node.roles.includes(role)).length])),
      treeEdgeCount:backbone.length,
      extraCandidateCount:loopCandidates.length,
      extraEdgeCount:extraEdges.length,
      cycleRank:finalEdges.length-roomCount+1,
    },
  };
}
