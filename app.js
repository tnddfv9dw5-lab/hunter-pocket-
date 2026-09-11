(function(){
  var ASSETS = [
    {id:'bitcoin',sym:'BTC',name:'Bitcoin',kind:'CORE',base:60000},
    {id:'ethereum',sym:'ETH',name:'Ethereum',kind:'CORE',base:2500},
    {id:'solana',sym:'SOL',name:'Solana',kind:'CORE',base:140},
    {id:'dogecoin',sym:'DOGE',name:'Dogecoin',kind:'SPEC',base:0.15},
    {id:'bonk',sym:'BONK',name:'Bonk',kind:'SPEC',base:0.00002},
    {id:'pepe',sym:'PEPE',name:'Pepe',kind:'SPEC',base:0.00001},
    {id:'dogwifcoin',sym:'WIF',name:'dogwifhat',kind:'SPEC',base:1.2}
  ];
  var RISK = {
    safe:{entry:80,max:2,core:18,spec:7,slCore:-0.03,tpCore:0.055,slSpec:-0.055,tpSpec:0.09,label:'Prudent'},
    balanced:{entry:74,max:3,core:20,spec:10,slCore:-0.045,tpCore:0.075,slSpec:-0.075,tpSpec:0.13,label:'Équilibré'},
    aggressive:{entry:68,max:4,core:22,spec:14,slCore:-0.06,tpCore:0.10,slSpec:-0.10,tpSpec:0.18,label:'Agressif'}
  };
  var KEY='hunter-pocket-v3';
  var mem={};
  function storeGet(k){try{return localStorage.getItem(k);}catch(e){return mem[k]||null;}}
  function storeSet(k,v){try{localStorage.setItem(k,v);}catch(e){mem[k]=v;}}
  function fresh(cap){cap=Number(cap)||100;return{capital:cap,cash:cap,positions:{},bot:false,risk:'balanced',trades:0,logs:[],selected:'bitcoin'};}
  var state; try{state=JSON.parse(storeGet(KEY)||'null');}catch(e){state=null;} if(!state) state=fresh(100);
  var market={}; var live=false; var source='Démo locale'; var demoTick=0; var busy=false; var toastTimer=null;
  function $(id){return document.getElementById(id);}
  function save(){storeSet(KEY,JSON.stringify(state));}
  function clamp(n,a,b){return Math.max(a,Math.min(b,n));}
  function euro(n){return (Number(n)||0).toLocaleString('fr-BE',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2});}
  function price(n){n=Number(n)||0;if(n>=1000)return n.toLocaleString('fr-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0});if(n>=1)return n.toLocaleString('fr-BE',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2});return n.toLocaleString('fr-BE',{style:'currency',currency:'EUR',minimumFractionDigits:n<0.01?6:3,maximumFractionDigits:n<0.01?8:4});}
  function pct(n){return (n>=0?'+':'')+(Number(n)||0).toFixed(2)+' %';}
  function asset(id){for(var i=0;i<ASSETS.length;i++)if(ASSETS[i].id===id)return ASSETS[i];return ASSETS[0];}
  function toast(msg){clearTimeout(toastTimer);$('toast').textContent=msg;$('toast').classList.add('show');toastTimer=setTimeout(function(){$('toast').classList.remove('show');},1500);}
  function log(type,title,detail){state.logs.unshift({type:type,title:title,detail:detail,time:Date.now()});state.logs=state.logs.slice(0,80);save();}

  function demoSeries(base,idx){var arr=[];for(var i=0;i<72;i++){var wave=Math.sin((i+idx*6+demoTick)/8)*0.015;var trend=(i-36)*0.00025*(idx%2===0?1:-0.3);arr.push(base*(1+wave+trend));}return arr;}
  function seedDemo(){demoTick++;for(var i=0;i<ASSETS.length;i++){var a=ASSETS[i],series=demoSeries(a.base,i),p=series[series.length-1],ch=((p/series[series.length-25])-1)*100;market[a.id]={price:p,change24:ch,volumeRatio:0.05+(i%3)*0.018,spark:series};}live=false;source='Démo locale';}

  async function fetchLive(){
    if(busy)return; busy=true; $('refreshBtn').textContent='…';
    try{
      var ids=ASSETS.map(function(a){return a.id;}).join(',');
      var url='https://api.coingecko.com/api/v3/coins/markets?vs_currency=eur&ids='+encodeURIComponent(ids)+'&order=market_cap_desc&per_page=20&page=1&sparkline=true&price_change_percentage=24h';
      var ctrl=new AbortController(); var timer=setTimeout(function(){ctrl.abort();},7000);
      var res=await fetch(url,{cache:'no-store',signal:ctrl.signal,headers:{'accept':'application/json'}}); clearTimeout(timer);
      if(!res.ok) throw new Error('HTTP '+res.status);
      var data=await res.json(); if(!Array.isArray(data)||data.length<3) throw new Error('Réponse incomplète');
      for(var i=0;i<data.length;i++){
        var x=data[i],sp=(x.sparkline_in_7d&&x.sparkline_in_7d.price)||[];
        market[x.id]={price:Number(x.current_price)||0,change24:Number(x.price_change_percentage_24h)||0,volumeRatio:(Number(x.total_volume)||0)/(Number(x.market_cap)||1),spark:sp.length?sp:[Number(x.current_price)||0]};
      }
      live=true; source='CoinGecko LIVE';
    }catch(e){seedDemo(); source='Démo locale · API indisponible';}
    busy=false; $('refreshBtn').textContent='Actualiser'; if(state.bot)evaluateBot(); render();
  }

  function scoreFor(a){
    var m=market[a.id]; if(!m)return 0;
    var s=52,sp=m.spark||[];
    var momentum=0;if(sp.length>8){var old=sp[Math.max(0,sp.length-9)]||m.price;momentum=((m.price/old)-1)*100;}
    s+=clamp(m.change24*1.2,-18,18); s+=clamp(momentum*3,-14,14); s+=clamp((m.volumeRatio||0)*180,0,18);
    if(a.kind==='SPEC')s-=4; if(m.change24>20)s-=12; if(m.change24<-16)s-=8;
    return Math.round(clamp(s,1,99));
  }
  function exposure(){var sum=0;var ps=Object.values(state.positions);for(var i=0;i<ps.length;i++){var p=ps[i];sum+=p.qty*((market[p.id]&&market[p.id].price)||p.entry);}return sum;}
  function equity(){return state.cash+exposure();}
  function buy(a){var cfg=RISK[state.risk],m=market[a.id];if(!m||state.positions[a.id]||Object.keys(state.positions).length>=cfg.max)return false;var amount=Math.min(a.kind==='CORE'?cfg.core:cfg.spec,state.cash);if(amount<5)return false;var fee=amount*0.001;state.cash-=amount;state.positions[a.id]={id:a.id,sym:a.sym,name:a.name,kind:a.kind,qty:(amount-fee)/m.price,cost:amount,entry:m.price,sl:a.kind==='CORE'?cfg.slCore:cfg.slSpec,tp:a.kind==='CORE'?cfg.tpCore:cfg.tpSpec};state.trades++;log('buy','Achat test '+a.sym,euro(amount)+' · score '+scoreFor(a)+'/100');return true;}
  function sell(id,why){var p=state.positions[id];if(!p)return false;var cur=(market[id]&&market[id].price)||p.entry;var proceeds=p.qty*cur*0.999;var pnl=proceeds-p.cost;state.cash+=proceeds;delete state.positions[id];state.trades++;log(pnl>=0?'win':'loss','Vente test '+p.sym,why+' · '+(pnl>=0?'+':'')+euro(pnl));return true;}
  function evaluateBot(){if(!state.bot)return;var cfg=RISK[state.risk],ps=Object.values(state.positions);for(var i=0;i<ps.length;i++){var p=ps[i],cur=(market[p.id]&&market[p.id].price)||p.entry,ret=cur/p.entry-1,sc=scoreFor(asset(p.id));if(ret<=p.sl)sell(p.id,'stop '+pct(ret*100));else if(ret>=p.tp)sell(p.id,'objectif '+pct(ret*100));else if(sc<38)sell(p.id,'score '+sc+'/100');}
    var ranked=ASSETS.slice().sort(function(a,b){return scoreFor(b)-scoreFor(a);});for(var j=0;j<ranked.length&&Object.keys(state.positions).length<cfg.max;j++){var a=ranked[j];if(scoreFor(a)>=cfg.entry&&!state.positions[a.id])buy(a);}save();}

  function svgLine(values,w,h,mini){if(!values||values.length<2)return '';var min=Math.min.apply(null,values),max=Math.max.apply(null,values),range=Math.max(max-min,0.000000001),pts=[];for(var i=0;i<values.length;i++){var x=2+i*(w-4)/(values.length-1),y=h-2-(values[i]-min)*(h-4)/range;pts.push(x.toFixed(1)+','+y.toFixed(1));}var up=values[values.length-1]>=values[0],c=up?'#22d67a':'#ff6070';if(mini)return '<polyline points="'+pts.join(' ')+'" fill="none" stroke="'+c+'" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';return '<defs><linearGradient id="fillChart" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+c+'" stop-opacity=".23"/><stop offset="1" stop-color="'+c+'" stop-opacity="0"/></linearGradient></defs><polygon points="2,'+(h-2)+' '+pts.join(' ')+' '+(w-2)+','+(h-2)+'" fill="url(#fillChart)"/><polyline points="'+pts.join(' ')+'" fill="none" stroke="'+c+'" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>';}

  function renderHero(){var a=asset(state.selected),m=market[a.id]||{price:a.base,change24:0,spark:demoSeries(a.base,0)},sp=m.spark||[];$('heroCoin').textContent=a.sym.slice(0,4);$('heroCoin').className='coin '+(a.kind==='SPEC'?'spec':'');$('heroName').textContent=a.name;$('heroPrice').textContent=price(m.price);$('heroChange').textContent=pct(m.change24);$('heroChange').className=m.change24>=0?'up':'down';$('marketChart').innerHTML=svgLine(sp,360,150,false);if(sp.length){$('chartLow').textContent='Bas '+price(Math.min.apply(null,sp));$('chartHigh').textContent='Haut '+price(Math.max.apply(null,sp));}}
  function marketRow(a){var m=market[a.id]||{price:a.base,change24:0,spark:demoSeries(a.base,0)},sc=scoreFor(a),spark=svgLine((m.spark||[]).slice(-48),72,34,true);return '<div class="marketRow" data-asset="'+a.id+'"><div class="coinWrap"><div class="coin '+(a.kind==='SPEC'?'spec':'')+'">'+a.sym.slice(0,3)+'</div><div><div class="sym">'+a.sym+'</div><div class="name">'+a.name+' · '+a.kind+'</div></div></div><div><div class="price">'+price(m.price)+'</div><div class="change '+(m.change24>=0?'up':'down')+'">'+pct(m.change24)+'</div><div class="score">score '+sc+'/100</div></div><div class="miniChart"><svg viewBox="0 0 72 34" preserveAspectRatio="none">'+spark+'</svg></div></div>';}
  function bindMarketRows(){var rows=document.querySelectorAll('[data-asset]');for(var i=0;i<rows.length;i++){rows[i].onclick=function(){state.selected=this.getAttribute('data-asset');save();renderHero();document.querySelector('[data-view="home"]').click();};}}
  function renderMarkets(){var ranked=ASSETS.slice().sort(function(a,b){return scoreFor(b)-scoreFor(a);});$('topMarkets').innerHTML=ranked.map(marketRow).join('');$('allMarkets').innerHTML=ranked.map(marketRow).join('');$('marketSource').textContent=source;bindMarketRows();}
  function renderPositions(){var ps=Object.values(state.positions);$('positionCount').textContent=ps.length+' ouverte'+(ps.length>1?'s':'');if(!ps.length){$('positionsList').innerHTML='<div class="empty"><strong>Aucune position</strong><span>Active l’Auto Pilot pour lancer le paper trading.</span></div>';return;}$('positionsList').innerHTML=ps.map(function(p){var cur=(market[p.id]&&market[p.id].price)||p.entry,val=p.qty*cur,pnl=val-p.cost,ret=(cur/p.entry-1)*100;return '<div class="position"><div class="row"><div><b>'+p.sym+'</b> <span class="pill">'+p.kind+'</span></div><b class="'+(pnl>=0?'up':'down')+'">'+(pnl>=0?'+':'')+euro(pnl)+'</b></div><div class="small">'+p.name+' · '+pct(ret)+'</div><div class="stats"><div class="stat"><span>Valeur</span><strong>'+euro(val)+'</strong></div><div class="stat"><span>Stop</span><strong>'+pct(p.sl*100)+'</strong></div><div class="stat"><span>Take profit</span><strong>'+pct(p.tp*100)+'</strong></div></div><button class="close" data-close="'+p.id+'">Fermer la position test</button></div>';}).join('');var btns=document.querySelectorAll('[data-close]');for(var i=0;i<btns.length;i++){btns[i].onclick=function(){sell(this.getAttribute('data-close'),'fermeture manuelle');render();};}}
  function renderActivity(){if(!state.logs.length){$('activityList').innerHTML='<div class="empty"><strong>Journal vide</strong><span>Les actions du moteur apparaîtront ici.</span></div>';return;}var ico={buy:'↗',win:'✓',loss:'↓',info:'•'};$('activityList').innerHTML=state.logs.map(function(l){return '<div class="activity"><div class="actIcon">'+(ico[l.type]||'•')+'</div><div><div class="actTitle">'+l.title+'</div><div class="actSub">'+l.detail+'</div></div><div class="actTime">'+new Date(l.time).toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'})+'</div></div>';}).join('');}
  function render(){var eq=equity(),pnl=eq-state.capital,pp=pnl/state.capital*100;$('equity').textContent=euro(eq);$('cash').textContent=euro(state.cash);$('exposure').textContent=euro(exposure());$('trades').textContent=state.trades;$('pnl').textContent=(pnl>=0?'+':'')+euro(pnl)+' ('+pct(pp)+')';$('pnl').className=pnl>0?'up':pnl<0?'down':'';$('statusText').textContent=live?'LIVE':'DÉMO';$('statusDot').className='dot '+(live?'live':'');$('source').textContent=source;$('botState').textContent=state.bot?'actif':'arrêté';$('botSwitch').classList.toggle('on',state.bot);var cfg=RISK[state.risk];$('rules').textContent='Entrée ≥ '+cfg.entry+' · '+cfg.max+' positions max · '+euro(cfg.core)+' / '+euro(cfg.spec)+' par position · stops automatiques';var presets=document.querySelectorAll('.preset');for(var i=0;i<presets.length;i++)presets[i].classList.toggle('active',presets[i].getAttribute('data-risk')===state.risk);renderHero();renderMarkets();renderPositions();renderActivity();save();}

  $('botSwitch').onclick=function(){state.bot=!state.bot;log('info',state.bot?'Auto Pilot activé':'Auto Pilot arrêté',RISK[state.risk].label+' · paper trading');if(state.bot)evaluateBot();render();};
  var presets=document.querySelectorAll('.preset');for(var i=0;i<presets.length;i++){presets[i].onclick=function(){state.risk=this.getAttribute('data-risk');log('info','Profil de risque',RISK[state.risk].label);if(state.bot)evaluateBot();render();};}
  $('refreshBtn').onclick=function(){toast('Actualisation des marchés…');fetchLive();};
  var nav=document.querySelectorAll('.navBtn');for(var n=0;n<nav.length;n++){nav[n].onclick=function(){var view=this.getAttribute('data-view');var all=document.querySelectorAll('.navBtn');for(var j=0;j<all.length;j++)all[j].classList.remove('active');this.classList.add('active');var views=document.querySelectorAll('.view');for(var k=0;k<views.length;k++)views[k].classList.remove('active');$(view).classList.add('active');};}
  $('settingsBtn').onclick=function(){$('capitalInput').value=state.capital;$('settingsModal').classList.add('show');};
  $('closeModal').onclick=$('closeModal2').onclick=function(){$('settingsModal').classList.remove('show');};
  $('settingsModal').onclick=function(e){if(e.target===$('settingsModal'))$('settingsModal').classList.remove('show');};
  $('resetBtn').onclick=function(){var c=clamp(Number($('capitalInput').value)||100,20,100000);state=fresh(c);seedDemo();log('info','Simulation réinitialisée','Capital '+euro(c));$('settingsModal').classList.remove('show');render();fetchLive();};
  $('clearLogBtn').onclick=function(){state.logs=[];save();renderActivity();toast('Journal effacé');};

  seedDemo();render();fetchLive();
  setInterval(function(){if(!live)seedDemo();if(state.bot)evaluateBot();render();},15000);
})();