import { useState, useEffect } from 'react';

export const useServers = () => {
  const [servers, setServers] = useState([]);

  const loadServers = async () => {
    try {
      const keys = await window.storage.list('mcp_server:');
      if (keys && keys.keys) {
        const serverData = await Promise.all(
          keys.keys.map(async (key) => {
            try {
              const result = await window.storage.get(key);
              return result ? { id: key, ...JSON.parse(result.value) } : null;
            } catch (e) {
              return null;
            }
          })
        );
        setServers(serverData.filter(s => s !== null));
      }
    } catch (error) {
      console.log('No servers found yet');
    }
  };

  const addServer = async (serverData) => {
    const serverId = `mcp_server:${Date.now()}_${serverData.name}`;
    await window.storage.set(serverId, JSON.stringify(serverData));
    await loadServers();
  };

  const deleteServer = async (serverId) => {
    await window.storage.delete(serverId);
    await loadServers();
  };

  useEffect(() => {
    loadServers();
  }, []);

  return { servers, loadServers, addServer, deleteServer };
};
