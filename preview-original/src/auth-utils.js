export const REMEMBERED_USERNAME_KEY='ctgdmn-remembered-username';

export function rememberedUsername(storage){return String(storage?.getItem(REMEMBERED_USERNAME_KEY)||'').trim();}

export function updateRememberedUsername(storage,username,enabled){
  if(enabled)storage.setItem(REMEMBERED_USERNAME_KEY,String(username||'').trim());
  else storage.removeItem(REMEMBERED_USERNAME_KEY);
}

export function containsStoredPassword(storage){
  for(let index=0;index<(storage?.length||0);index+=1){const key=storage.key(index);if(/pass(word)?|mat[-_ ]?khau/i.test(String(key||'')))return true;}
  return false;
}
