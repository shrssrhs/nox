"use client";
import { useCallback, useSyncExternalStore, type SetStateAction } from "react";
const memory = new Map<string,string>();
function read(key: string) {
  try { return sessionStorage.getItem(`nox-draft:${key}`) ?? memory.get(key) ?? ""; }
  catch { return memory.get(key) ?? ""; }
}
function subscribe(listener: () => void) {
  window.addEventListener("nox-draft",listener);
  return () => window.removeEventListener("nox-draft",listener);
}
export function useChatDraft(key: string) {
  const value=useSyncExternalStore(subscribe,()=>read(key),()=>"");
  const setDraft=useCallback((action: SetStateAction<string>)=>{
    const next=typeof action==="function"?action(read(key)):action;
    memory.set(key,next);
    try { if(next)sessionStorage.setItem(`nox-draft:${key}`,next); else sessionStorage.removeItem(`nox-draft:${key}`); } catch { /* memory remains available */ }
    window.dispatchEvent(new Event("nox-draft"));
  },[key]);
  return [value,setDraft] as const;
}
