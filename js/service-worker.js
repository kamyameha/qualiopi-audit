(() => {
  if (!('serviceWorker' in navigator)) return;
  let rechargement=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(rechargement)return;rechargement=true;location.reload()});
  window.addEventListener('load',async()=>{
    const inscription=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
    await inscription.update();
    const afficher=()=>{const b=document.querySelector('#miseAJour');if(b)b.hidden=false};
    if(inscription.waiting)afficher();
    inscription.addEventListener('updatefound',()=>{const n=inscription.installing;n?.addEventListener('statechange',()=>{if(n.state==='installed'&&navigator.serviceWorker.controller)afficher()})});
    document.querySelector('#actualiserApplication')?.addEventListener('click',()=>inscription.waiting?.postMessage({type:'ACTIVER_MAINTENANT'}));
  });
})();
