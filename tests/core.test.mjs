import test from 'node:test';
import assert from 'node:assert/strict';
import { RealtimeClient } from '@supabase/realtime-js';
import { mergeMessages, submissionId } from '../src/lib/message-state.ts';
import { attachmentFilename } from '../src/lib/file-name.ts';
import { attachmentPath } from '../src/lib/attachment-path.ts';
import { readHistoryWindow } from '../src/lib/history-window.ts';
import { withDeadline, boundedFetch } from '../src/lib/request-budget.ts';

const message = (id, content = id) => ({ id, content, created_at:'2026-11-09T10:00:00Z', sender_id:'sender', profiles:null });
test('merges overlapping 250-message history without duplicates and retains edits', () => {
  const records = Array.from({length:250}, (_, n) => message(String(n).padStart(4,'0')));
  let history = mergeMessages([], records.slice(150));
  history = mergeMessages(history, records.slice(50,151));
  history = mergeMessages(history, records.slice(0,51));
  history = mergeMessages(history, [message('0175','edited'), records[249]]);
  assert.equal(history.length,250);
  assert.deepEqual(history.map(x => x.id), records.map(x => x.id));
  assert.equal(history[175].content,'edited');
});
test('uncertain send retries reuse identity; changing content creates a new message', () => {
  const first = submissionId(null,'draft');
  assert.equal(submissionId(first,'draft').id, first.id);
  assert.notEqual(submissionId(first,'changed').id, first.id);
  assert.notEqual(submissionId(first,'draft','another-chat').id, first.id);
});
test('signing accepts legacy and new paths only on the configured project', () => {
  const origin='https://project.supabase.co';
  for (const mode of ['public','sign','authenticated']) {
    assert.equal(attachmentPath(`${origin}/storage/v1/object/${mode}/attachments/dm-uuid/user/file%20name.png?token=ignored`,origin), 'dm-uuid/user/file name.png');
  }
  for (const value of [
    'https://evil.test/storage/v1/object/public/attachments/dm/file',
    `${origin}/storage/v1/object/public/avatars/file`,
    `${origin}/storage/v1/object/public/attachments/dm/%2E%2E/file`,
    `${origin}/storage/v1/object/public/attachments/dm/%5Cfile`,
    `${origin}/storage/v1/object/public/attachments/dm//file`,
    'not a url',
  ]) assert.equal(attachmentPath(value,origin),null);
});
test('deadline releases an unresponsive Auth request and propagates real failures', async () => {
  await assert.rejects(withDeadline(new Promise(()=>{}),15),/Service unavailable/);
  await assert.rejects(withDeadline(Promise.reject(new Error('auth failed')),100),/auth failed/);
  assert.equal(await withDeadline(Promise.resolve('ok'),100),'ok');
});
test('bounded fetch preserves an already aborted caller signal', async () => {
  const original=globalThis.fetch;
  globalThis.fetch=async (_url,init) => { assert.equal(init.signal.aborted,true); throw new Error('aborted'); };
  try { await assert.rejects(boundedFetch('https://test.invalid',{signal:AbortSignal.abort()}),/aborted/); }
  finally { globalThis.fetch=original; }
});
test('channel and DM typing have separate ownership, including immediate cleanup/remount', async () => {
  const client = new RealtimeClient('ws://127.0.0.1:1/socket',{params:{apikey:'isolated-test'}});
  client.connect=()=>{}; // Subscription lifecycle only: never opens a socket.
  const channel=client.channel('channel:uuid:typing',{config:{private:true}});
  channel.on('presence',{event:'sync'},()=>{}).subscribe();
  const dm=client.channel('dm:uuid:typing',{config:{private:true}});
  assert.notEqual(channel,dm);
  assert.doesNotThrow(()=>dm.on('presence',{event:'sync'},()=>{}).subscribe());
  void client.removeChannel(dm);
  const remount=client.channel('dm:uuid:typing',{config:{private:true}});
  assert.notEqual(remount,dm);
  assert.doesNotThrow(()=>remount.on('presence',{event:'sync'},()=>{}).subscribe());
  await client.removeAllChannels();
  await client.disconnect();
});

test('refresh reconciles more than 1000 messages within the REST row cap', async () => {
  const database=Array.from({length:1250},(_,i)=>message(String(i).padStart(4,'0'))).reverse();
  const provider=async (limit,cursor)=>{
    assert.ok(limit<=1000);
    return database.filter(row=>!cursor || row.id<cursor.id).slice(0,limit);
  };
  const first=await readHistoryWindow(100,provider);
  assert.equal(first.records[0].id,'1249'); assert.equal(first.records.length,100); assert.equal(first.hasMore,true);
  const all=await readHistoryWindow(1250,provider);
  assert.equal(all.records.length,1250); assert.equal(all.hasMore,false);
  database.splice(100,1);
  database[0]={...database[0],content:'changed while offline'};
  const refreshed=await readHistoryWindow(1250,provider);
  assert.equal(refreshed.records.length,1249);
  assert.equal(refreshed.records[0].content,'changed while offline');
});

test('attachment names retain original names for current, encoded and legacy paths', () => {
  const root='https://project.supabase.co/storage/v1/object/public/attachments/room/user/';
  const uuid='3d685634-0000-4000-8000-000000000001-';
  assert.equal(attachmentFilename(root+uuid+'nox-qa-attachment.txt'),'nox-qa-attachment.txt');
  assert.equal(attachmentFilename(root+uuid+encodeURIComponent('план-бета.txt')),'план-бета.txt');
  assert.equal(attachmentFilename(root+'meeting-notes-final.txt'),'meeting-notes-final.txt');
  assert.equal(attachmentFilename(root+'report.pdf-1794190712009.pdf'),'report.pdf');
  assert.equal(attachmentFilename(root+'report-1794190712009.pdf'),'report.pdf');
  assert.equal(attachmentFilename(root+'%ZZ.txt'),'%ZZ.txt');
});
