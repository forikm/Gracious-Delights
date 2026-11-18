import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogGroups,variantLabels} from '../catalog-view.js';
import {createSeed,transition,available} from '../domain.js';

test('groups all selling options without losing flavor, size, price, or stock identity',()=>{
 const state=transition(createSeed(),{type:'importSignCatalog'});
 const groups=catalogGroups(state);
 assert.equal(groups.length,12);
 assert.equal(groups.reduce((n,g)=>n+g.variants.length,0),37);
 const rolls=groups.find(g=>g.id==='family-cinnamon');
 assert.equal(rolls.variants.length,12);
 assert.deepEqual(variantLabels(rolls.variants.find(p=>p.id==='sign-cinnamon-cheese-pan')),{flavor:'Cheese',size:'1 pan'});
 assert.equal(rolls.minPrice,65);assert.equal(rolls.maxPrice,130);
 assert.ok(groups.slice(0,5).every(g=>g.stock>0));
 assert.ok(groups.slice(5).every(g=>g.stock===0));
 assert.equal(catalogGroups(state,{inStock:true}).length,5);
 const match=catalogGroups(state,{query:'Oreo',category:'Ensaymada'});
 assert.equal(match.length,1);assert.ok(match[0].matches.some(p=>p.id==='sign-ensaymada-oreo'));
 assert.equal(catalogGroups(state,{query:'does not exist'}).length,0);
 assert.equal(available(state,state.products.find(p=>p.id==='sign-ensaymada-oreo')),0);
});

test('custom capacity permits a larger real batch but keeps ingredient deductions and validation',()=>{
 const before=createSeed(),product=before.products[0];
 let state=transition(before,{type:'editProduct',id:product.id,product:{...product,stockLimit:50}});
 state=transition(state,{type:'produce',id:product.id,quantity:20});
 assert.equal(state.products[0].stock,product.stock+20);
 assert.equal(state.ingredients.find(i=>i.id==='flour').quantity,before.ingredients.find(i=>i.id==='flour').quantity-4000);
 assert.throws(()=>transition(state,{type:'editProduct',id:product.id,product:{...state.products[0],stockLimit:5}}),/lower than current stock/);
 assert.throws(()=>transition(state,{type:'produce',id:product.id,quantity:23}),/Maximum 50/);
 assert.throws(()=>transition(state,{type:'editProduct',id:product.id,product:{...state.products[0],stockLimit:NaN}}),/Stock capacity/);
});
