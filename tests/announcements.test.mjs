import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {transition,createSeed} from '../domain.js';
import {mutate,readState,present} from '../lib/store.js';
import {testDatabase} from './database-helper.mjs';
import {sortedAnnouncements,renderAnnouncements} from '../announcements.js';

test('announcement drafts, publication, edits, pinning, and retries preserve inventory',()=>{
 const seed=createSeed(),id=randomUUID();
 const action={type:'addAnnouncement',id,announcement:{title:'New batch update',body:'First line\nSecond line',published:false,pinned:false}};
 const draft=transition(seed,action);
 assert.equal(draft.announcements[0].publishedAt,null);
 assert.deepEqual(draft.products,seed.products);assert.deepEqual(draft.ingredients,seed.ingredients);assert.deepEqual(draft.orders,seed.orders);
 assert.deepEqual(transition(draft,action),draft);
 const published=transition(draft,{type:'toggleAnnouncement',id});assert.equal(published.announcements[0].published,true);assert.ok(published.announcements[0].publishedAt);
 const edited=transition(published,{type:'editAnnouncement',id,announcement:{...action.announcement,title:'Corrected batch update',published:true,pinned:true}});
 assert.equal(edited.announcements[0].pinned,true);assert.equal(edited.announcements[0].publishedAt,published.announcements[0].publishedAt);
 const hidden=transition(edited,{type:'toggleAnnouncement',id});assert.equal(hidden.announcements[0].published,false);
 assert.deepEqual(present(hidden,{admin:false,owner:'guest'}).announcements,[]);
 assert.equal(present(hidden,{admin:true,owner:'owner'}).announcements.length,1);
 assert.throws(()=>transition(seed,{...action,announcement:{...action.announcement,title:' '}}),/title/);
 assert.throws(()=>transition(seed,{...action,announcement:{...action.announcement,body:'x'.repeat(5001)}}),/5,000|5000/);
 assert.throws(()=>transition(seed,{...action,announcement:{...action.announcement,published:'true'}}),/visibility/);
 assert.throws(()=>transition(seed,{type:'editAnnouncement',id,announcement:action.announcement}),/no longer exists/);
});

test('shared database hides drafts, rejects customer writes, and publishes to customer state',async t=>{
 const db=await testDatabase();t.after(()=>db.close());
 const admin={admin:true,owner:'admin'},guest={admin:false,owner:'guest'},id=randomUUID();
 assert.deepEqual((await readState(db,guest)).announcements,[]);
 const action={type:'addAnnouncement',id,announcement:{title:'Kitchen update',body:'Customer-visible text',published:false,pinned:true}};
 await assert.rejects(mutate(db,guest,{action,revision:0}),{status:403});
 const draft=await mutate(db,admin,{action,revision:0});
 assert.equal(draft.announcements.length,1);assert.equal((await readState(db,guest)).announcements.length,0);
 await assert.rejects(mutate(db,guest,{action:{type:'toggleAnnouncement',id},revision:draft.revision}),{status:403});
 await assert.rejects(mutate(db,admin,{action:{type:'toggleAnnouncement',id},revision:0}),{status:409});
 const published=await mutate(db,admin,{action:{type:'toggleAnnouncement',id},revision:draft.revision});
 assert.equal((await readState(db,guest)).announcements[0].title,'Kitchen update');
 await mutate(db,admin,{action:{type:'toggleAnnouncement',id},revision:published.revision});
 assert.equal((await readState(db,guest)).announcements.length,0);
});

test('announcement rendering escapes HTML and keeps pinned updates first',()=>{
 const old={id:randomUUID(),title:'<script>alert(1)</script>',body:'<img src=x onerror=alert(1)>',published:true,pinned:true,createdAt:'2026-11-01T00:00:00Z',publishedAt:'2026-11-01T00:00:00Z'};
 const recent={...old,id:randomUUID(),pinned:false,createdAt:'2026-11-16T00:00:00Z',publishedAt:'2026-11-16T00:00:00Z'};
 assert.equal(sortedAnnouncements([recent,old])[0].id,old.id);
 const container={innerHTML:''};renderAnnouncements(container,[old,{...recent,published:false,title:'Secret draft'}]);
 assert.ok(container.innerHTML.includes('&lt;script&gt;'));assert.ok(container.innerHTML.includes('&lt;img'));
 assert.ok(!container.innerHTML.includes('<script>'));assert.ok(!container.innerHTML.includes('Secret draft'));
});

test('published photos stay matched to their announcement and additional photos can be expanded',()=>{
 const publishedAt='2026-11-19T00:00:00Z';
 const banana={id:'1c5abd31-b984-44a4-96dd-672fcf497f20',title:'Banana bread is back',body:'Our October update.',published:true,publishedAt};
 const textOnly={id:randomUUID(),title:'Text-only update',body:'An update without photos.',published:true,publishedAt};
 const container={innerHTML:''};
 renderAnnouncements(container,[banana,textOnly]);
 assert.equal((container.innerHTML.match(/<img /g)||[]).length,6);
 assert.match(container.innerHTML,/<summary>Show 2 more photos<\/summary>/);
 assert.match(container.innerHTML,/alt="Banana bread loaves in foil pans"/);
 assert.match(container.innerHTML,/<time datetime="2026-10-30T17:53:00\+08:00">October 30, 2026<\/time>/);
 assert.match(container.innerHTML,/<time datetime="2026-11-19T00:00:00Z">November 19, 2026<\/time>/);
 assert.equal(sortedAnnouncements([banana,textOnly])[0],textOnly);
 assert.equal(banana.publishedAt,publishedAt);
 assert.equal((container.innerHTML.match(/class="announcement-photos"/g)||[]).length,1);
 renderAnnouncements(container,[{...banana,published:false},textOnly]);
 assert.doesNotMatch(container.innerHTML,/<img /);
});
