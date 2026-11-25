import {inflateRawSync,deflateRawSync} from 'node:zlib';
import {randomInt} from 'node:crypto';
export const GAME='2ccd9d09-f8ca-4ffc-9d2c-3fa72a914d1c', MAX=3*1024*1024;
const LIMIT=64*1024*1024;
const duplicatePrinter='Resin3dPrinter_EntertainmentSaveData.json';
const repeated=Symbol('repeated ZIP entries');
export const personal=['HotkeysSaveData.json','PlayerInventorySaveData.json','PlayerArmourSystemSaveData.json','PlayerClothingSystemSaveData.json','PlayerRetrieveDroppedInventoryActionSaveData.json','PlayerStateSaveData.json'];
const statefile='GameStateSaveData.json', mix='SaveData.json';
const table=Array.from({length:256},(_,i)=>{for(let j=0;j<8;j++)i=i&1?0xedb88320^(i>>>1):i>>>1;return i>>>0});
export function crc(b){let x=0xffffffff;for(const v of b)x=table[(x^v)&255]^(x>>>8);return (x^0xffffffff)>>>0;}
export function unzip(b,limit=LIMIT){
 if(!Buffer.isBuffer(b)||b.length<22||b.length>MAX)throw Error('ZIP inválido o superior a 3 MiB');
 let end=-1;for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(b.readUInt32LE(i)===0x06054b50&&i+22+b.readUInt16LE(i+20)===b.length){end=i;break;}
 if(end<0||b.readUInt16LE(end+4)||b.readUInt16LE(end+6))throw Error('ZIP incompleto');
 const count=b.readUInt16LE(end+10), start=b.readUInt32LE(end+16);if(!count||count>256||count!==b.readUInt16LE(end+8)||start+b.readUInt32LE(end+12)!==end)throw Error('Directorio ZIP inválido');
 const files=new Map();files[repeated]=[];let at=start,total=0;
 for(let i=0;i<count;i++){
 if(at+46>end||b.readUInt32LE(at)!==0x02014b50)throw Error('Entrada inválida');
 const flags=b.readUInt16LE(at+8), method=b.readUInt16LE(at+10), checksum=b.readUInt32LE(at+16), c=b.readUInt32LE(at+20), size=b.readUInt32LE(at+24), n=b.readUInt16LE(at+28), ex=b.readUInt16LE(at+30), co=b.readUInt16LE(at+32), off=b.readUInt32LE(at+42);
 if(at+46+n+ex+co>end||!n||flags&1||![0,8].includes(method)||off+30>start||b.readUInt32LE(off)!==0x04034b50)throw Error('ZIP no soportado');
 const name=b.subarray(at+46,at+46+n).toString('utf8'), ln=b.readUInt16LE(off+26), pos=off+30+ln+b.readUInt16LE(off+28);
 if(name.includes('\\')||name.startsWith('/')||name.split('/').some(s=>s==='..'||s==='.')||/[\x00-\x1f:]/.test(name)||(files.has(name)&&name!==duplicatePrinter)||pos+c>start||b.subarray(off+30,off+30+ln).toString('utf8')!==name)throw Error('Ruta ZIP inválida');
 total+=size;if(total>limit)throw Error('ZIP descomprimido demasiado grande');
 const raw=b.subarray(pos,pos+c), data=method===0?Buffer.from(raw):inflateRawSync(raw,{maxOutputLength:Math.max(1,size)});
 if(data.length!==size||crc(data)!==checksum)throw Error('CRC o tamaño incorrecto');if(files.has(name)){json(files.get(name));files[repeated].push([name,files.get(name)]);}files.set(name,data);at+=46+n+ex+co;
 }if(at!==end)throw Error('Directorio ZIP incorrecto');return files;
}
export function zip(files){let offset=0;const local=[],central=[];const entries=Array.from(files).flatMap(([name,b])=>[...(files[repeated]||[]).filter(([n])=>n===name),[name,b]]);for(const [name,b] of entries){const n=Buffer.from(name), d=deflateRawSync(b), check=crc(b), l=Buffer.alloc(30), c=Buffer.alloc(46);l.writeUInt32LE(0x04034b50);l.writeUInt16LE(20,4);l.writeUInt16LE(8,8);l.writeUInt32LE(check,14);l.writeUInt32LE(d.length,18);l.writeUInt32LE(b.length,22);l.writeUInt16LE(n.length,26);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);c.writeUInt32LE(check,16);c.writeUInt32LE(d.length,20);c.writeUInt32LE(b.length,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);local.push(l,n,d);central.push(c,n);offset+=l.length+n.length+d.length;}const cd=Buffer.concat(central),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50);e.writeUInt16LE(entries.length,8);e.writeUInt16LE(entries.length,10);e.writeUInt32LE(cd.length,12);e.writeUInt32LE(offset,16);return Buffer.concat([...local,cd,e]);}
function json(b){const x=JSON.parse(b.toString('utf8'));if(!x||typeof x!=='object'||Array.isArray(x))throw Error('JSON inválido');return x;}
function data(f,n){const x=json(f.get(n));if(!x.Data||typeof x.Data!=='object'||Array.isArray(x.Data))throw Error('Data inválido: '+n);return x;}
const encode=x=>Buffer.from(JSON.stringify(x));
export function inspect(bytes){let f=unzip(bytes);if(!f.has(statefile)){const candidates=[...f].filter(([n])=>n.split('/').at(-1)==='SaveData.zip');if(candidates.length!==1)throw Error('Sube un solo SaveData.zip o una carpeta de ranura comprimida');bytes=candidates[0][1];f=unzip(bytes);}
 for(const [n,b] of f){if(!/^[A-Za-z0-9_.-]+\.json$/.test(n))throw Error('Archivo interno no reconocido: '+n);json(b);}
 for(const n of [...personal,statefile,mix]){if(!f.has(n))throw Error('Falta '+n);data(f,n);}
 const s=json(Buffer.from(data(f,statefile).Data.GameState));if(s.GameId!==GAME)throw Error('El guardado no pertenece a este mundo');const host=f.has('ConstructionsSaveData.json')&&f.has('GameSetupSaveData.json');if(!host&&(f.size!==8||Object.keys(data(f,mix).Data).some(k=>k!=='HeldOnlyItems')))throw Error('Formato de invitado no reconocido');return {f,bytes,host,state:s,day:s.GameDays??null,difficulty:s.GameType??null};}
export function guest(save){const f=save.f,out=new Map(personal.map(n=>[n,f.get(n)]));const m=data(f,mix);m.Data=Object.hasOwn(m.Data,'HeldOnlyItems')?{HeldOnlyItems:m.Data.HeldOnlyItems}:{};out.set(mix,encode(m));const s=data(f,statefile),v={...save.state};delete v.GameName;delete v.IsRobbyDead;s.Data.GameState=JSON.stringify(v);out.set(statefile,encode(s));return zip(out);}
export function promote(world,player){if(!world.host)throw Error('No hay mundo host');const p=inspect(guest(player)),out=new Map(world.f);out[repeated]=world.f[repeated];for(const n of personal)out.set(n,p.f.get(n));const m=data(out,mix),v=data(p.f,mix);delete m.Data.HeldOnlyItems;Object.assign(m.Data,v.Data);out.set(mix,encode(m));return zip(out);}
export function slot(bytes,host){const n=String(randomInt(1,4294967296)).padStart(10,'0');return zip(new Map([[`${host?'Multiplayer':'MultiplayerClient'}/${n}/SaveData.zip`,bytes],[`${host?'Multiplayer':'MultiplayerClient'}/${n}/${host?'Bosqueadores':'MultiplayerClient'}.name`,Buffer.alloc(0)]]));}
