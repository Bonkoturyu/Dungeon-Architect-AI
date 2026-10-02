import assert from 'node:assert/strict';
import test from 'node:test';
import { generateDungeonSpecV3 } from '../../generator/src/dungeon-generator.js';
import { simulateDungeon } from '../src/simulator.js';
import { createShortestPathAgent, createCautiousAgent, createTreasureGreedyAgent } from '../src/agents.js';
test('built-in agents resolve special Goal houses and finish shops without purchases', () => {
  for(const kind of ['shop','monster-house','trap-house']) {
    const plan={id:'goal',targetRole:'goal',kind,floorNumber:1,roomId:null,entityCount:kind==='shop'?null:1,offers:kind==='shop'?[{id:'armor',type:'armor',tier:1,price:20,stock:1}]:[]};
    const spec=generateDungeonSpecV3({seed:25,roomCount:3,routeChoice:0,enemyCount:0,trapCount:0,treasureCount:0,roomPlans:[plan]});
    for(const factory of [createShortestPathAgent,createCautiousAgent,createTreasureGreedyAgent]) {
      const result=simulateDungeon(spec,factory(spec));
      assert.equal(result.ok,true);assert.equal(result.simulation.status,'cleared');
    }
  }
});
