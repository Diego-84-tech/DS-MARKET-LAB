export async function loadConfig({fetcher=fetch,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),attempts=3}={}){
 let last;
 for(let attempt=0;attempt<attempts;attempt++){
  try{
   const response=await fetcher('/api/lab/config',{cache:'no-store',signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error('HTTP '+response.status);
   const config=await response.json();
   if(config?.url!=='https://lfgmvycxqinoriamprhr.supabase.co'||typeof config.key!=='string'||!config.key||typeof config.workerConfigured!=='boolean')throw Error('Unexpected connection response');
   return config;
  }catch(error){last=error;if(attempt+1<attempts)await wait(750*(attempt+1));}
 }
 throw Error('Cannot reach the lab right now. Check your connection, then tap Retry connection. ('+(last?.name==='TimeoutError'?'Connection timed out':last?.message==='Unexpected connection response'?'Unexpected response':'Temporary connection error')+')');
}
