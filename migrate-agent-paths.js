// Script de migration pour ajouter agentPath aux serveurs existants
(async () => {
  const keys = await window.storage.list('mcp_server:');
  
  if (!keys || !keys.keys) {
    console.log('Aucun serveur trouvé');
    return;
  }
  
  let updated = 0;
  
  for (const key of keys.keys) {
    const result = await window.storage.get(key);
    if (result) {
      const server = JSON.parse(result.value);
      
      // Si le serveur n'a pas d'agentPath, l'ajouter
      if (!server.agentPath && server.agent) {
        server.agentPath = `/home/nizar/.kiro/agents/${server.agent}.json`;
        await window.storage.set(key, JSON.stringify(server));
        console.log(`✓ Mis à jour: ${server.name} (${server.agent})`);
        updated++;
      }
    }
  }
  
  console.log(`\n${updated} serveur(s) mis à jour avec agentPath`);
  console.log('Rechargez la page pour voir les changements');
})();
