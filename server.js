import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

app.use(express.json());

// CORS pour permettre les requêtes depuis le frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Route pour sauvegarder un fichier agent
app.post('/api/save-agent', async (req, res) => {
  try {
    console.log('Received save request:', req.body);
    const { agentName, mcpServers } = req.body;
    
    if (!agentName || !mcpServers) {
      console.error('Missing required fields');
      return res.status(400).json({ error: 'agentName et mcpServers requis' });
    }

    const agentsDir = path.join(os.homedir(), '.kiro', 'agents');
    await fs.mkdir(agentsDir, { recursive: true });
    
    const filePath = path.join(agentsDir, `${agentName}.json`);
    console.log('Saving to:', filePath);
    
    // Lire le fichier existant pour préserver les autres champs
    let existingContent = {};
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      existingContent = JSON.parse(fileContent);
      console.log('Existing content loaded');
    } catch (error) {
      console.log('No existing file, creating new');
    }
    
    // Fusionner les mcpServers mis à jour avec le contenu existant
    const updatedContent = {
      ...existingContent,
      name: agentName,
      mcpServers
    };
    
    await fs.writeFile(filePath, JSON.stringify(updatedContent, null, 2));
    console.log('File saved successfully');
    
    res.json({ success: true, path: filePath });
  } catch (error) {
    console.error('Erreur sauvegarde:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend démarré sur http://localhost:${PORT}`);
});
