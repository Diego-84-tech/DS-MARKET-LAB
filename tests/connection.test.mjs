import test from 'node:test';
import assert from 'node:assert/strict';
import {loadConfig} from '../dist/connection.mjs';
const valid={url:'https://lfgmvycxqinoriamprhr.supabase.co',key:'public-test-key',workerConfigured:true};
const ok=()=>new Response(JSON.stringify(valid),{headers:{'Content-Type':'application/json'}});
test('startup recovers after a temporary network failure',async()=>{let calls=0;const c=await loadConfig({fetcher:async()=>{if(++calls===1)throw TypeError('Network failure');return ok();},wait:async()=>{}});assert.equal(c.workerConfigured,true);assert.equal(calls,2);});
test('temporary HTTP and HTML error responses are retried',async()=>{let calls=0;await loadConfig({fetcher:async()=>++calls===1?new Response('Unavailable',{status:503}):calls===2?new Response('<html>Error</html>'):ok(),wait:async()=>{}});assert.equal(calls,3);});
test('persistent failure is bounded and retrying later can recover',async()=>{let calls=0;await assert.rejects(loadConfig({fetcher:async()=>{calls++;throw Error('Offline');},wait:async()=>{}}),/Retry connection/);assert.equal(calls,3);assert.deepEqual(await loadConfig({fetcher:async()=>ok()}),valid);});
test('unexpected connection hosts are rejected before credentials can be sent',async()=>{await assert.rejects(loadConfig({fetcher:async()=>new Response(JSON.stringify({...valid,url:'https://example.invalid'})),wait:async()=>{}}),/Unexpected response/);});
