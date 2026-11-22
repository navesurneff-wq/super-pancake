LIFE TRACKER — PWA

INSTALLATION SANS MAC
1. Publier le contenu de ce dossier sur un hébergement HTTPS (GitHub Pages est une option gratuite).
2. Ouvrir l'adresse publiée dans Safari sur l'iPhone.
3. Appuyer sur Partager, puis Sur l'écran d'accueil, puis Ajouter.
4. Lancer LIFE TRACKER depuis sa nouvelle icône.
5. Ouvrir l'app une première fois avec Internet pour mettre en cache les fichiers. Les données sont ensuite enregistrées localement.

IMPORTANT
- L'app fonctionne hors ligne après son premier chargement réussi.
- Les données sont stockées dans IndexedDB sur cet appareil/navigateur. Effacer les données de Safari peut les supprimer : exporter régulièrement une sauvegarde JSON.
- L'import restaure les données dans le stockage local.
- Le verrouillage par code est une protection d'interface, pas un coffre-fort cryptographique. Ne stockez pas de mots de passe ou de données extrêmement sensibles.
- Une PWA iOS ne peut pas garantir des alarmes locales en arrière-plan comme une app native. Les notifications web dépendent des versions iOS, de l'installation à l'écran d'accueil et des autorisations.
- Le verrouillage par code n'est pas Face ID.
- L'assistant est déterministe : règles et statistiques locales, pas d'IA générative.
- Le projet ne contacte aucun serveur applicatif. Google Fonts est déclaré dans la feuille de style à titre esthétique; les polices système prennent le relais hors ligne. Pour une version strictement sans aucune requête tierce, supprimer la ligne @import Google Fonts de style.css.
