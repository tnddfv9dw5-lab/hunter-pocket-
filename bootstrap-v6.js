(async()=>{'use strict';
  const fallback=()=>{const s=document.createElement('script');s.src='app-v5.js?v=6';s.onload=loadEnhancer;document.body.appendChild(s)};
  const loadEnhancer=()=>{const s=document.createElement('script');s.src='enhance-v6.js?v=6';document.body.appendChild(s)};
  try{
    const r=await fetch('app-v5.js?v=6',{cache:'no-store'});if(!r.ok)throw new Error('core '+r.status);
    let code=await r.text();
    const old="const RISK={safe:{entry:82,max:2,sl:-.055,tp:.09,size:.12,label:'Prudent'},balanced:{entry:74,max:4,sl:-.085,tp:.16,size:.16,label:'Équilibré'},aggressive:{entry:66,max:6,sl:-.13,tp:.28,size:.22,label:'Agressif'}};";
    const neu="const RISK={safe:{entry:82,max:2,sl:-.055,tp:.09,size:.12,label:'Prudent'},balanced:{entry:74,max:4,sl:-.085,tp:.16,size:.16,label:'Équilibré'},aggressive:{entry:66,max:6,sl:-.13,tp:.28,size:.22,label:'Agressif'},moonshot100:{entry:60,max:5,sl:-.22,tp:1,size:.08,label:'Moonshot +100%'},moonshot1000:{entry:55,max:7,sl:-.30,tp:9,size:.05,label:'Moonshot x10'}};";
    if(!code.includes(old))throw new Error('risk patch not found');
    code=code.replace(old,neu);
    (0,eval)(code);
    loadEnhancer();
  }catch(e){console.warn('Hunter V6 bootstrap fallback',e);fallback()}
})();