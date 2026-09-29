export const GAMEPLAY_GRAMMAR_ALGORITHM_VERSION = '1';

const DEFAULTS=Object.freeze({
  roomSizeMin:7,
  roomSizeMax:9,
  cellSpacing:14,
});

function createPrng(seed){
  let state=seed>>>0;
  return ()=>{
    state=(state+0x6d2b79f5)>>>0;
    let value=state;
    value=Math.imul(value^(value>>>15),value|1);
    value^=value+Math.imul(value^(value>>>7),value|61);
    return ((value^(value>>>14))>>>0)/4294967296;
  };
}

function randomInt(prng,min,max){
  return min+Math.floor(prng()*(max-min+1));
}

function shuffle(values,prng){
  const copy=values.slice();
  for(let index=copy.length-1;index>0;index-=1){
    const other=Math.floor(prng()*(index+1));
    [copy[index],copy[other]]=[copy[other],copy[index]];
  }
  return copy;
}

function clamp(value,min,max){
  return Math.max(min,Math.min(max,value));
}

function validateOptions({
  seed,roomCount,routeChoice,exploration,combatWeight,hazardWeight,
  rewardWeight,deceptionWeight,recoveryWeight,roomSizeMin,roomSizeMax,cellSpacing,
}){
  if(!Number.isSafeInteger(seed)||seed<0) throw new TypeError('seed must be a non-negative safe integer');
  if(!Number.isInteger(roomCount)||roomCount<3||roomCount>64) throw new RangeError('roomCount must be an integer between 3 and 64');
  for(const [name,value] of Object.entries({routeChoice,exploration,combatWeight,hazardWeight,rewardWeight,deceptionWeight,recoveryWeight})){
    if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1){
      throw new RangeError(name+' must be between 0 and 1');
    }
  }
  if(!Number.isInteger(roomSizeMin)||!Number.isInteger(roomSizeMax)||roomSizeMin<4||roomSizeMax<roomSizeMin||roomSizeMax>16){
    throw new RangeError('room size bounds are invalid');
  }
  if(!Number.isInteger(cellSpacing)||cellSpacing<roomSizeMax+3||cellSpacing>40){
    throw new RangeError('cellSpacing must be an integer at least roomSizeMax + 3 and at most 40');
  }
}

function weightedRole(prng,weights){
  const entries=Object.entries(weights).filter(([,weight])=>weight>0);
  const total=entries.reduce((sum,[,weight])=>sum+weight,0);
  if(total<=0) return 'traversal';
  let cursor=prng()*total;
  for(const [role,weight] of entries){
    cursor-=weight;
    if(cursor<=0) return role;
  }
  return entries.at(-1)[0];
}

function semanticWeights({combatWeight,hazardWeight,rewardWeight,deceptionWeight,recoveryWeight,exploration}){
  return {
    challenge:0.15+combatWeight*1.15,
    hazard:0.10+hazardWeight*1.0+deceptionWeight*0.25,
    reward:0.10+rewardWeight*0.95,
    recovery:0.05+recoveryWeight*0.7,
    traversal:0.15+exploration*0.9,
  };
}

function chooseBranchCount(roomCount,exploration){
  const available=roomCount-3;
  if(available<=0) return 0;
  const fraction=0.28+exploration*0.28;
  return clamp(Math.round(available*fraction),0,available);
}

function buildSpine(spineCount,rolePrng,weights){
  const nodes=[];
  for(let index=0;index<spineCount;index+=1){
    let role;
    if(index===0) role='start';
    else if(index===spineCount-1) role='goal';
    else if(index===spineCount-2) role='climax';
    else role=weightedRole(rolePrng,weights);
    nodes.push({
      id:'node-'+String(index+1).padStart(3,'0'),
      source:'spine',
      role,
      cellX:index,
      cellZ:0,
      spineIndex:index,
    });
  }
  const edges=[];
  for(let index=0;index<spineCount-1;index+=1){
    edges.push({
      a:index,
      b:index+1,
      kind:'grammar-spine',
      semantic:'progression',
    });
  }
  return {nodes,edges};
}

function branchTemplateRoles(length,prng,weights,deceptionWeight){
  if(length<=0) return [];
  if(length===1){
    return [weightedRole(prng,weights)];
  }
  const roll=prng();
  if(roll<0.34+deceptionWeight*0.18){
    return length===2
      ? ['reward','hazard']
      : ['reward','hazard','reward'];
  }
  if(roll<0.67){
    return length===2
      ? ['challenge','reward']
      : ['challenge','traversal','reward'];
  }
  return length===2
    ? ['traversal','recovery']
    : ['traversal','challenge','recovery'];
}

function buildGrammar({
  roomCount,routeChoice,exploration,rolePrng,branchPrng,weights,deceptionWeight,
}){
  const branchCount=chooseBranchCount(roomCount,exploration);
  const spineCount=roomCount-branchCount;
  const spine=buildSpine(spineCount,rolePrng,weights);
  const nodes=[...spine.nodes];
  const edges=[...spine.edges];
  const derivation=[{rule:'MISSION→SPINE',produced:spineCount}];

  const maxBypass=Math.min(spineCount-1,Math.floor(branchCount/2));
  const bypassTarget=Math.round(routeChoice*maxBypass);
  let remaining=branchCount;
  let branchOrdinal=0;
  const occupied=new Set(
    spine.nodes.map((node)=>node.cellX+','+node.cellZ),
  );

  const bypassSlots=shuffle(
    Array.from({length:spineCount-1},(_,segment)=>
      [1,-1].map((lane)=>({segment,lane})),
    ).flat(),
    branchPrng,
  );
  let bypassCount=0;

  for(const slot of bypassSlots){
    if(bypassCount>=bypassTarget||remaining<2) break;
    const leftKey=slot.segment+','+slot.lane;
    const rightKey=(slot.segment+1)+','+slot.lane;
    if(occupied.has(leftKey)||occupied.has(rightKey)) continue;

    const roles=branchTemplateRoles(2,rolePrng,weights,deceptionWeight);
    const startIndex=nodes.length;
    const cells=[
      {cellX:slot.segment,cellZ:slot.lane},
      {cellX:slot.segment+1,cellZ:slot.lane},
    ];
    for(let i=0;i<2;i+=1){
      nodes.push({
        id:'node-'+String(nodes.length+1).padStart(3,'0'),
        source:'bypass',
        role:roles[i],
        branchOrdinal,
        cellX:cells[i].cellX,
        cellZ:cells[i].cellZ,
        anchorSpineIndex:slot.segment,
      });
      occupied.add(cells[i].cellX+','+cells[i].cellZ);
    }
    edges.push({a:slot.segment,b:startIndex,kind:'grammar-branch',semantic:'detour-entry'});
    edges.push({a:startIndex,b:startIndex+1,kind:'grammar-branch',semantic:'detour'});
    edges.push({a:startIndex+1,b:slot.segment+1,kind:'grammar-bypass',semantic:'rejoin'});
    derivation.push({rule:'CHOICE→BYPASS(2)',anchor:slot.segment,produced:2});
    bypassCount+=1;
    branchOrdinal+=1;
    remaining-=2;
  }

  const deadSlots=shuffle(
    Array.from({length:spineCount},(_,anchor)=>
      [1,-1].map((sign)=>({anchor,sign})),
    ).flat(),
    branchPrng,
  );
  let deadSlotCursor=0;
  let deadEndBranchCount=0;

  while(remaining>0){
    const length=Math.min(2,remaining);
    let slot=null;

    while(deadSlotCursor<deadSlots.length){
      const candidate=deadSlots[deadSlotCursor];
      deadSlotCursor+=1;
      const firstKey=candidate.anchor+','+candidate.sign;
      const secondKey=candidate.anchor+','+(candidate.sign*2);
      if(occupied.has(firstKey)) continue;
      if(length===2&&occupied.has(secondKey)) continue;
      slot=candidate;
      break;
    }

    if(!slot){
      throw new Error('Gameplay Grammar branch slots exhausted');
    }

    const roles=branchTemplateRoles(length,rolePrng,weights,deceptionWeight);
    const startIndex=nodes.length;
    for(let i=0;i<length;i+=1){
      const cellX=slot.anchor;
      const cellZ=slot.sign*(i+1);
      nodes.push({
        id:'node-'+String(nodes.length+1).padStart(3,'0'),
        source:'dead-end',
        role:roles[i],
        branchOrdinal,
        cellX,
        cellZ,
        anchorSpineIndex:slot.anchor,
      });
      occupied.add(cellX+','+cellZ);
    }
    edges.push({a:slot.anchor,b:startIndex,kind:'grammar-branch',semantic:'detour-entry'});
    for(let i=1;i<length;i+=1){
      edges.push({a:startIndex+i-1,b:startIndex+i,kind:'grammar-branch',semantic:'detour'});
    }
    derivation.push({rule:'CHOICE→DEAD_END('+length+')',anchor:slot.anchor,produced:length});
    branchOrdinal+=1;
    deadEndBranchCount+=1;
    remaining-=length;
  }

  return {
    nodes,edges,derivation,
    diagnostics:{
      spineCount,
      branchNodeCount:branchCount,
      bypassBranchCount:bypassCount,
      deadEndBranchCount,
    },
  };
}

function buildRooms(nodes,{roomSizeMin,roomSizeMax,cellSpacing,prng}){
  const minX=Math.min(...nodes.map((node)=>node.cellX));
  const maxX=Math.max(...nodes.map((node)=>node.cellX));
  const minZ=Math.min(...nodes.map((node)=>node.cellZ));
  const maxZ=Math.max(...nodes.map((node)=>node.cellZ));
  const centerX=(minX+maxX)/2;
  const centerZ=(minZ+maxZ)/2;
  return nodes.map((node,index)=>({
    id:'room-'+String(index+1).padStart(3,'0'),
    nodeId:node.id,
    role:node.role,
    source:node.source,
    cellX:node.cellX,
    cellZ:node.cellZ,
    x:(node.cellX-centerX)*cellSpacing,
    z:(node.cellZ-centerZ)*cellSpacing,
    width:randomInt(prng,roomSizeMin,roomSizeMax),
    depth:randomInt(prng,roomSizeMin,roomSizeMax),
  }));
}

function validateGenerated(nodes,edges,rooms){
  if(nodes.length!==rooms.length) throw new Error('Gameplay Grammar node/Room count mismatch');
  const seenCells=new Set();
  for(const room of rooms){
    const cell=room.cellX+','+room.cellZ;
    if(seenCells.has(cell)) throw new Error('Gameplay Grammar duplicate embedded cell: '+cell);
    seenCells.add(cell);
  }
  const adjacency=new Map(rooms.map((_,index)=>[index,[]]));
  const edgeSet=new Set();
  for(const edge of edges){
    if(edge.a===edge.b) throw new Error('Gameplay Grammar self edge');
    const ek=edge.a<edge.b?edge.a+'|'+edge.b:edge.b+'|'+edge.a;
    if(edgeSet.has(ek)) throw new Error('Gameplay Grammar duplicate edge: '+ek);
    edgeSet.add(ek);
    adjacency.get(edge.a).push(edge.b);
    adjacency.get(edge.b).push(edge.a);
    const a=rooms[edge.a];
    const b=rooms[edge.b];
    const manhattan=Math.abs(a.cellX-b.cellX)+Math.abs(a.cellZ-b.cellZ);
    if(Math.abs(manhattan-1)>1e-9){
      throw new Error('Gameplay Grammar non-cardinal edge: '+a.id+'/'+b.id);
    }
  }
  const visited=new Set([0]);
  const queue=[0];
  while(queue.length){
    const current=queue.shift();
    for(const next of adjacency.get(current)){
      if(visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }
  if(visited.size!==rooms.length){
    throw new Error('Gameplay Grammar graph disconnected: '+visited.size+'/'+rooms.length);
  }
}

export function generateGameplayGrammarCore({
  seed,roomCount=8,routeChoice=0.5,exploration=0.5,combatWeight=0.5,hazardWeight=0.5,
  rewardWeight=0.5,deceptionWeight=0.5,recoveryWeight=0.5,
  roomSizeMin=DEFAULTS.roomSizeMin,roomSizeMax=DEFAULTS.roomSizeMax,cellSpacing=DEFAULTS.cellSpacing,
}={}){
  validateOptions({
    seed,roomCount,routeChoice,exploration,combatWeight,hazardWeight,rewardWeight,
    deceptionWeight,recoveryWeight,roomSizeMin,roomSizeMax,cellSpacing,
  });
  const rolePrng=createPrng((seed^0x6772616d)>>>0);
  const branchPrng=createPrng((seed^0x6272616e)>>>0);
  const roomPrng=createPrng((seed^0x726f6f6d)>>>0);
  const weights=semanticWeights({combatWeight,hazardWeight,rewardWeight,deceptionWeight,recoveryWeight,exploration});
  const grammar=buildGrammar({
    roomCount,routeChoice,exploration,rolePrng,branchPrng,weights,deceptionWeight,
  });
  const rooms=buildRooms(grammar.nodes,{roomSizeMin,roomSizeMax,cellSpacing,prng:roomPrng});
  validateGenerated(grammar.nodes,grammar.edges,rooms);
  const roleCounts={};
  for(const node of grammar.nodes) roleCounts[node.role]=(roleCounts[node.role]??0)+1;
  return {
    algorithm:'gameplay-grammar',
    algorithmVersion:GAMEPLAY_GRAMMAR_ALGORITHM_VERSION,
    seed,
    options:{
      roomCount,routeChoice,exploration,combatWeight,hazardWeight,rewardWeight,
      deceptionWeight,recoveryWeight,roomSizeMin,roomSizeMax,cellSpacing,
    },
    nodes:grammar.nodes,
    edges:grammar.edges,
    rooms,
    derivation:grammar.derivation,
    diagnostics:{
      ...grammar.diagnostics,
      edgeCount:grammar.edges.length,
      cycleRank:grammar.edges.length-rooms.length+1,
      derivationStepCount:grammar.derivation.length,
      roleCounts,
    },
  };
}
