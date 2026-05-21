# User Story: Interface modulaire de configuration des agents et serveurs MCP

## Contexte
En tant qu'utilisateur de MCP Server Manager, je veux une interface à onglets qui me permet de gérer de façon modulaire la configuration de mes agents et de leurs serveurs MCP, avec des sous-onglets extensibles pour chaque aspect de la configuration.

## Critères d'acceptation

### Navigation principale
- [ ] Le sélecteur de branche reste toujours visible en haut
- [ ] 3 onglets principaux : Home, Configuration des agents, Configuration serveur MCP
- [ ] La navigation entre onglets conserve la branche sélectionnée

### Tab Home
- [ ] Vue d'ensemble actuelle (catégories toggle, activation/désactivation rapide)
- [ ] Aucun changement fonctionnel par rapport à l'existant

### Tab Configuration des agents
- [ ] Menu déroulant pour sélectionner un agent
- [ ] Sous-onglets : Général, Prompt, Mémoire, Tools, Resources
- [ ] Sous-tab Général : nom, description, welcome message (éditable)
- [ ] Sous-tab Prompt : affichage/édition du contenu du fichier prompt
- [ ] Sous-tab Mémoire : configuration mémoire
- [ ] Sous-tab Tools : liste des tools autorisés (éditable)
- [ ] Sous-tab Resources : patterns de fichiers
- [ ] Bouton Sauvegarder par sous-onglet

### Tab Configuration serveur MCP
- [ ] Menu déroulant agent + menu déroulant serveur
- [ ] Sous-onglets : Serveur, Wrapper, Variables d'env, + extensible
- [ ] Sous-tab Serveur : description, configuration JSON complète (éditeur)
- [ ] Sous-tab Wrapper : chemin + contenu du wrapper (éditeur de code)
- [ ] Sous-tab Variables d'env : tableau clé/valeur éditable avec ajout/suppression
- [ ] Bouton "+ Ajouter section" pour créer un sous-onglet personnalisé
- [ ] Bouton Sauvegarder par sous-onglet

### Technique
- [ ] Sauvegarde atomique par section (commit + push vers GitHub)
- [ ] Lecture du wrapper depuis le filesystem via le backend
- [ ] Extensibilité : nouveau sous-onglet = nouvelle entrée sans refactoring
