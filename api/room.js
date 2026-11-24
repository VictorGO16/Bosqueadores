import {randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {inspect,guest,promote,slot,GAME,MAX} from '../lib/save.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&timingSafeEqual(Buffer.from(hash(a)),Buffer.from(hash(b)));
const meta=x=>x?(({hash,owner,at,size,day,difficulty})=>({hash,owner,at,size,day,difficulty}))(x):null;
export function makeHandler({neon,put,get,del},env=process.env){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');const send=(n,x)=>res.status(n).json(x), conflict=()=>send(409,{error:'Sesión ocupada o versión desactualizada. Actualiza el portal.'});
 try{
 if(!env.DATABASE_URL||!env.BLOB_READ_WRITE_TOKEN||!env.ADMIN_KEY||!env.GROUP_KEY||env.ADMIN_KEY.length<24||env.GROUP_KEY.length<24||env.ADMIN_KEY===env.GROUP_KEY)return send(503,{error:'Configura las cuatro variables de entorno; códigos distintos de al menos 24 caracteres.'});
 const sql=neon(env.DATABASE_URL),a=req.query.action,method=req.method;
 if(a==='health'&&method==='GET'){const ready=await sql`SELECT id FROM bosque_web_room WHERE id=1`;if(!ready.length)return send(503,{error:'Ejecuta schema.sql'});return send(200,{ok:true,version:'0.5.0',game:GAME});}
 const key=String(req.headers.authorization||'').replace(/^Bearer /,'');const admin=equal(key,env.ADMIN_KEY);if(!admin&&!equal(key,env.GROUP_KEY))return send(401,{error:'Código de acceso incorrecto'});
 const token=String(req.headers['x-session']||''),th=hash(token);const [r]=await sql`SELECT * FROM bosque_web_room WHERE id=1`;if(!r)return send(503,{error:'Ejecuta schema.sql'});
 const own=Boolean(token&&equal(th,r.token_hash));
 const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
 const upload=()=>{if(typeof body.zip!=='string'||body.zip.length>4*1024*1024)throw Error('Sube un ZIP de máximo 3 MiB');const b=Buffer.from(body.zip,'base64');if(b.length>MAX)throw Error('ZIP demasiado grande');return inspect(b);};
 const load=async x=>{const b=await get(x.url,{access:'private',token:env.BLOB_READ_WRITE_TOKEN});if(!b||b.statusCode!==200)throw Error('Blob no disponible');const v=Buffer.from(await new Response(b.stream).arrayBuffer());if(hash(v)!==x.hash)throw Error('Integridad incorrecta');return inspect(v);};
 const download=(bytes,name)=>{res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition',`attachment; filename="${name}"`);return res.status(200).send(bytes);};
 if(a==='status'&&method==='GET')return send(200,{game:GAME,head:meta(r.head),history:r.history.map(meta),host:r.owner,started:r.started,own,admin});
 if(a==='guest'&&method==='POST'){let p;try{p=upload();}catch(e){return send(400,{error:e.message});}return download(slot(guest(p),false),'Bosqueadores-invitado.zip');}
 if(a==='prepare'&&method==='POST'){
 if(!r.head)return send(409,{error:'Primero publica el mundo inicial'});
 if(r.owner)return conflict();const name=String(body.name||'').trim().slice(0,50);if(!name)return send(400,{error:'Indica tu nombre'});
 let p;try{p=upload();}catch(e){return send(400,{error:e.message});}if(p.host)return send(400,{error:'Sube tu guardado MultiplayerClient más reciente, no una ranura host antigua'});
 const output=slot(promote(await load(r.head),p),true);if(output.length>MAX)return send(400,{error:'Resultado demasiado grande'});
 // Client generates token BEFORE request; retry can recover through cancel if download fails.
 if(!/^[a-f0-9]{64}$/.test(token))return send(400,{error:'Token de sesión inválido'});
 const rows=await sql`UPDATE bosque_web_room SET owner=${name},token_hash=${th},started=now() WHERE id=1 AND owner IS NULL AND head->>'hash'=${r.head.hash} RETURNING id`;
 if(!rows.length)return conflict();return download(output,'Bosqueadores-host.zip');}
 if(a==='publish'&&method==='POST'){
 if(!/^[a-f0-9]{64}$/.test(token))return send(400,{error:'Token de sesión inválido'});
 const initial=!r.head;if(initial?(!admin||r.owner):!own)return conflict();
 const name=initial?String(body.name||'').trim().slice(0,50):r.owner;if(!name)return send(400,{error:'Indica el nombre del host'});
 let p;try{p=upload();}catch(e){return send(400,{error:e.message});}if(!p.host)return send(400,{error:'Sube un guardado Multiplayer del anfitrión'});
 // Reject a save with a timestamp earlier than the source world, not proof of provenance.
 if(r.head?.saveTime&&Date.parse(p.state.SaveTime)<Date.parse(r.head.saveTime))return send(400,{error:'El guardado es anterior al mundo compartido'});
 const g=slot(guest(p),false), h=hash(p.bytes);const blob=await put(`world/${randomUUID()}.zip`,p.bytes,{access:'private',addRandomSuffix:false,contentType:'application/zip',token:env.BLOB_READ_WRITE_TOKEN});
 const next={hash:h,owner:name,at:Date.now(),size:p.bytes.length,day:p.day,difficulty:p.difficulty,saveTime:p.state.SaveTime??null,url:blob.url};const all=[next,...r.history], history=all.slice(0,10);
 // Save immutable reference for retry of guest download; only the publishing session can retrieve it.
 const receipt={token_hash:th,world:next};
 const rows=await sql`UPDATE bosque_web_room SET head=${JSON.stringify(next)}::jsonb,history=${JSON.stringify(history)}::jsonb,receipt=${JSON.stringify(receipt)}::jsonb,owner=NULL,token_hash=NULL,started=NULL WHERE id=1 AND coalesce(head->>'hash','')=${r.head?.hash||''} AND coalesce(token_hash,'')=${r.token_hash||''} AND coalesce(owner,'')=${r.owner||''} RETURNING id`;
 if(!rows.length){await del(blob.url,{token:env.BLOB_READ_WRITE_TOKEN}).catch(()=>{});return conflict();}for(const old of all.slice(10))await del(old.url,{token:env.BLOB_READ_WRITE_TOKEN}).catch(()=>{});
 return download(g,'Bosqueadores-invitado.zip');}
 if(a==='receipt'&&method==='GET'){if(!token||!r.receipt||!equal(th,r.receipt.token_hash))return send(404,{error:'No hay descarga pendiente de esta sesión. Puedes convertir tu save host manualmente.'});return download(slot(guest(await load(r.receipt.world)),false),'Bosqueadores-invitado.zip');}
 if(a==='cancel'&&method==='POST'){if(!own&&!admin)return send(403,{error:'Solo el host o administrador puede liberar la sesión'});const rows=await sql`UPDATE bosque_web_room SET owner=NULL,token_hash=NULL,started=NULL WHERE id=1 AND token_hash=${r.token_hash} RETURNING id`;return rows.length?send(200,{ok:true}):conflict();}
 if(a==='backup'&&method==='GET'){if(!admin)return send(403,{error:'Solo administrador'});const x=r.history.find(x=>x.hash===req.query.hash);if(!x)return send(404,{error:'Versión no encontrada'});return download((await load(x)).bytes,'SaveData.zip');}
 return send(404,{error:'Ruta desconocida'});
 }catch(e){console.error('Bosqueadores',e?.name,e?.message);return send(500,{error:'Error de infraestructura o procesamiento. Revisa los logs de Vercel.'});}
};}
export default async function handler(req,res){try{const [{neon},{put,get,del}]=await Promise.all([import('@neondatabase/serverless'),import('@vercel/blob')]);return await makeHandler({neon,put,get,del})(req,res);}catch(e){console.error(e?.message);return res.status(500).json({error:'Runtime no disponible'});}}
