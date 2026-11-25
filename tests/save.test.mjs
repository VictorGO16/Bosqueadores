import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {GAME,personal,zip,unzip,inspect,guest,promote,slot} from '../lib/save.mjs';
import {fixture} from './fixture.mjs';
test('roundtrip host/client and preserve world',()=>{const w=inspect(fixture(true)),p=inspect(fixture(false,GAME,24,'B')),out=inspect(promote(w,p));for(const n of personal)assert.deepEqual(out.f.get(n),p.f.get(n));for(const [n,b] of w.f)if(!personal.includes(n)&&n!=='SaveData.json')assert.deepEqual(out.f.get(n),b);assert.equal(JSON.parse(out.f.get('SaveData.json')).Data.HeldOnlyItems,'B');assert.equal(JSON.parse(out.f.get('SaveData.json')).Data.VailWorldSim,'world');assert.equal(inspect(guest(out)).f.size,8);assert.deepEqual(inspect(slot(guest(out),false)).f.get(personal[0]),p.f.get(personal[0]));});
test('invalid game, CRC, traversal and ambiguous zip rejected',()=>{assert.throws(()=>inspect(fixture(false,'other')));const z=fixture();z[60]^=255;assert.throws(()=>inspect(z));assert.throws(()=>unzip(zip(new Map([['../x',Buffer.from('x')]]))));assert.throws(()=>inspect(zip(new Map([['a/SaveData.zip',fixture()],['b/SaveData.zip',fixture()]]))));});
test('real saves (when supplied)',{skip:!process.env.HOST_SAVE||!process.env.CLIENT_SAVE},()=>{const h=inspect(readFileSync(process.env.HOST_SAVE)),p=inspect(readFileSync(process.env.CLIENT_SAVE));assert.ok(h.f.size>=38);assert.equal(p.f.size,8);const out=inspect(promote(h,p));assert.equal(out.f.size,h.f.size);for(const n of personal)assert.deepEqual(out.f.get(n),p.f.get(n));for(const [n,b] of h.f)if(!personal.includes(n)&&n!=='SaveData.json')assert.deepEqual(out.f.get(n),b);const g=inspect(guest(h));assert.equal(g.f.size,8);for(const n of personal)assert.deepEqual(g.f.get(n),h.f.get(n));assert.equal(inspect(slot(promote(h,p),true)).state.GameId,GAME);});

test('download paths create correct role folder and retain inner save',()=>{for(const host of [true,false]){const original=fixture(host),packed=slot(original,host),files=unzip(packed),prefix=host?'Multiplayer':'MultiplayerClient';assert.equal(files.size,2);const path=[...files.keys()].find(n=>n.endsWith('/SaveData.zip'));assert.match(path,new RegExp('^'+prefix+'/[0-9]{10}/SaveData\\.zip$'));assert.deepEqual(files.get(path),original);assert.equal(inspect(packed).host,host);assert.ok([...files.keys()].every(n=>n.startsWith(prefix+'/')));}});

test('duplicate SOTF printer entries survive promotion; other duplicate paths rejected',()=>{
 const name='Resin3dPrinter_EntertainmentSaveData.json',a=Buffer.from('{"Data":{"resin":275}}'),b=Buffer.from('{"Data":{"resin":525}}');
 const f=unzip(fixture(true));const input=zip([...f,[name,a],[name,b]]);const w=inspect(input);const result=promote(w,inspect(fixture(false)));
 assert.deepEqual(unzip(result).get(name),b);
 // Inspect central directory and local data indirectly via a roundtrip, preserving both entries.
 assert.equal(result.readUInt16LE(result.length-12),f.size+2);
 assert.deepEqual(zip(unzip(result)),result);
 assert.throws(()=>unzip(zip([['x',a],['x',b]])),/Ruta ZIP inválida/);
});
