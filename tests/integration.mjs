// Opt-in integration check. It refuses every non-loopback Supabase URL.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID,createHmac} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const source=await readFile(process.env.NOX_TEST_ENV ?? '../supabase-status.env','utf8');
const env=Object.fromEntries([...source.matchAll(/^([A-Z_]+)="(.*)"$/gm)].map(match=>[match[1],match[2]]));
assert.ok(['127.0.0.1','localhost'].includes(new URL(env.API_URL).hostname),'Integration tests require a disposable local Supabase');
const options={auth:{persistSession:false,autoRefreshToken:false}};
const admin=createClient(env.API_URL,env.SERVICE_ROLE_KEY,options);
const pass='Nox-local-test-only-2026!';
const users=[];
for(const name of ['alice','bob','outsider','mfa']) {
  const email=`nox_qa_${name}@example.test`;
  const result=await admin.auth.admin.createUser({email,password:pass,email_confirm:true,user_metadata:{full_name:`${name} QA`,username:`nox_qa_${name}`}});
  let account=result.data.user;
  if (result.error) {
    const list=await admin.auth.admin.listUsers(); account=list.data.users.find(user=>user.email===email);
    if (!account) throw result.error;
  }
  const client=createClient(env.API_URL,env.ANON_KEY,options);
  const login=await client.auth.signInWithPassword({email,password:pass});assert.ifError(login.error);
  users.push({name,email,id:login.data.user.id,client});
}
const [a,b,c,m]=users;
const ok=(label)=>console.log(`PASS: ${label}`);
const pairs=await Promise.all(Array.from({length:12},(_,n)=>(n%2?a.client:b.client).rpc('get_or_create_dm',{p_other:n%2?b.id:a.id})));
for(const result of pairs)assert.ifError(result.error);
const conversation=pairs[0].data;assert.equal(new Set(pairs.map(x=>x.data)).size,1);ok('concurrent DM creation is atomic and unique');
for(const member of [a,b]) { const result=await member.client.from('conversation_members').select('*').eq('conversation_id',conversation);assert.ifError(result.error);assert.equal(result.data.length,2); }
ok('both participants can resolve a DM and its participants');
const channel=await a.client.rpc('create_channel',{p_name:'integration-room',p_private:true}).single();assert.ifError(channel.error);assert.equal(channel.data.created_by,a.id);ok('channel RPC returns a channel and owner membership');
const outsiders=await c.client.from('direct_messages').select('*').eq('conversation_id',conversation);assert.ifError(outsiders.error);assert.equal(outsiders.data.length,0);
assert.ok((await c.client.rpc('join_channel',{p_channel:channel.data.id})).error);
assert.ok((await a.client.from('profiles').update({badges:['owner']}).eq('id',a.id)).error);
assert.ok((await a.client.from('profiles').select('email')).error);ok('direct REST cannot bypass membership or private profile columns');
function subscribed(channel, postgres = false) {return new Promise((resolve,reject)=>{
  let joined=false, ready=!postgres;
  const timeout=setTimeout(()=>reject(new Error('Realtime subscription timed out')),15000);
  const done=()=>{if(joined&&ready){clearTimeout(timeout);resolve(channel);}};
  if(postgres)channel.on('system',{},payload=>{if(payload.extension==='postgres_changes'&&payload.status==='ok'){ready=true;done();}});
  channel.subscribe((status)=>{if(status==='SUBSCRIBED'){joined=true;done();}if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){clearTimeout(timeout);reject(new Error(`Realtime ${status}`));}});
});}
let gotMessage;
const received=new Promise(resolve=>{gotMessage=resolve;});
const history=b.client.channel(`dm:${conversation}:history`,{config:{private:true}}).on('postgres_changes',{event:'INSERT',schema:'public',table:'direct_messages',filter:`conversation_id=eq.${conversation}`},payload=>gotMessage(payload.new));
await subscribed(history,true);
const id=randomUUID();
const sent=await a.client.from('direct_messages').insert({id,conversation_id:conversation,sender_id:a.id,content:'Integration message'}).select('*,profiles(display_name)').single();assert.ifError(sent.error);
const realtime=await Promise.race([received,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Realtime INSERT was not delivered')),15000))]);assert.equal(realtime.id,id);ok('recipient receives a persisted message through real Realtime');
const duplicate=await a.client.from('direct_messages').insert({id,conversation_id:conversation,sender_id:a.id,content:'Integration message'});assert.equal(duplicate.error?.code,'23505');ok('retry identity cannot create duplicate messages');
await a.client.from('direct_messages').update({content:'Edited'}).eq('id',id);assert.equal((await b.client.from('direct_messages').select('content').eq('id',id).single()).data.content,'Edited');ok('edits are visible to the recipient');
let privateSync;
const typingReceived=new Promise(resolve=>{privateSync=resolve;});
const topic=`dm:${conversation}:typing`;
const typingB=b.client.channel(topic,{config:{private:true,presence:{key:b.id}}}).on('presence',{event:'sync'},()=>{if(Object.keys(typingB.presenceState()).includes(a.id))privateSync();});
const typingA=a.client.channel(topic,{config:{private:true,presence:{key:a.id}}});
await Promise.all([subscribed(typingA),subscribed(typingB)]);await typingA.track({name:'Alice QA',typing:true});
await Promise.race([typingReceived,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Private presence was not delivered')),15000))]);ok('private typing works between members');
const stranger=c.client.channel(topic,{config:{private:true}});
await assert.rejects(subscribed(stranger),/CHANNEL_ERROR|TIMED_OUT|timed out/);ok('outsider cannot join the private typing topic');
const path=`dm-${conversation}/${a.id}/${randomUUID()}-check.txt`;
assert.ifError((await a.client.storage.from('attachments').upload(path,new Blob(['private integration file'],{type:'text/plain'}))).error);
const signed=await b.client.storage.from('attachments').createSignedUrl(path,60);assert.ifError(signed.error);assert.equal(await (await fetch(signed.data.signedUrl)).text(),'private integration file');
assert.ok((await c.client.storage.from('attachments').createSignedUrl(path,60)).error);
assert.ok((await c.client.storage.from('attachments').upload(path,new Blob(['forged'],{type:'text/plain'}),{upsert:true})).error);
const publicURL=a.client.storage.from('attachments').getPublicUrl(path).data.publicUrl;assert.ok(!(await fetch(publicURL)).ok);ok('attachments work for participants and reject public/outsider access');
const oldFactors=await admin.auth.admin.mfa.listFactors({userId:m.id});assert.ifError(oldFactors.error);
for(const factor of oldFactors.data.factors)assert.ifError((await admin.auth.admin.mfa.deleteFactor({userId:m.id,id:factor.id})).error);
const enrollment=await m.client.auth.mfa.enroll({factorType:'totp',friendlyName:'Local integration test'});assert.ifError(enrollment.error);
function totp(secret) {
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const char of secret.replaceAll('=',''))bits+=alphabet.indexOf(char).toString(2).padStart(5,'0');
 const bytes=Buffer.from((bits.match(/.{8}/g)??[]).map(bit=>parseInt(bit,2)));const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(Math.floor(Date.now()/30000)));
 const digest=createHmac('sha1',bytes).update(counter).digest();const offset=digest.at(-1)&15;return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0');
}
const verified=await m.client.auth.mfa.challengeAndVerify({factorId:enrollment.data.id,code:totp(enrollment.data.totp.secret)});assert.ifError(verified.error);
await m.client.auth.signOut({scope:'local'});assert.ifError((await m.client.auth.signInWithPassword({email:m.email,password:pass})).error);
assert.equal((await m.client.from('profiles').select('id')).data.length,0);assert.ok((await m.client.rpc('get_or_create_dm',{p_other:a.id})).error);ok('real AAL1 session cannot bypass an enrolled MFA factor');
assert.ifError((await m.client.auth.mfa.challengeAndVerify({factorId:enrollment.data.id,code:totp(enrollment.data.totp.secret)})).error);
assert.ok((await m.client.from('profiles').select('id')).data.length>=4);ok('MFA verification restores access at AAL2');
await writeFile('.test-fixtures.json',JSON.stringify({users:users.slice(0,3).map(({name,email,id})=>({name,email,id,password:pass})),conversation,channel:channel.data.id}),{mode:0o600});
for(const {client} of users)await client.removeAllChannels();
console.log('Integration checks passed; synthetic accounts retained for browser QA.');
