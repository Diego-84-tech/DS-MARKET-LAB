import {createHash} from 'node:crypto';
import {getStore} from '@netlify/blobs';
export async function readArchiveFile(detail,page,path,store=getStore({name:'market-lab-agent-archives',consistency:'strong'})){
 if(detail.status!=='verified'||!detail.manifest?.verified)throw Error('Archive is still being verified.');
 const index=detail.manifest;if(path==='index.json'){const original=await store.get(index.root+'index.json',{type:'arrayBuffer'});if(!original||createHash('sha256').update(new Uint8Array(original)).digest('hex')!==index.indexHash)throw Error('Archive index verification failed');return new Response(original,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store'}});}if(!Number.isInteger(page)||page<0||page>=index.pages.length)throw Error('Invalid archive page');
 const descriptor=index.pages[page],raw=await store.get(index.root+descriptor.path,{type:'arrayBuffer'});if(!raw||createHash('sha256').update(new Uint8Array(raw)).digest('hex')!==descriptor.sha256)throw Error('Archive manifest unavailable');
 if(path===descriptor.path)return new Response(raw,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store'}});
 const files=JSON.parse(new TextDecoder().decode(raw)).files;if(path===null)return Response.json({files},{headers:{'Cache-Control':'no-store'}});
 const file=files.find(f=>f.path===path);if(!file)throw Error('File outside archive');const bytes=await store.get(index.root+file.path,{type:'arrayBuffer'});if(!bytes||bytes.byteLength!==file.bytes||createHash('sha256').update(new Uint8Array(bytes)).digest('hex')!==file.sha256)throw Error('Archive file verification failed');
 return new Response(bytes,{headers:{'Content-Type':file.kind==='picture'?'image/webp':'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
