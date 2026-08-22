# Buhrsi's Mobile Prototype v0.3

Diese Version ist als installierbare PWA vorbereitet.

## Was bereits funktioniert
- 2-Minuten-Putzmodus
- 4 Putzphasen à 30 Sekunden
- XP, Glanz, Streak und Ei-Energie
- Reward-Screen
- lokale Speicherung
- App-Manifest und App-Icons
- Offline-Cache über Service Worker
- Standalone-Darstellung auf dem Homescreen

## Wichtig für automatische Updates
Eine PWA muss über HTTPS gehostet werden. Sobald diese Dateien z. B. auf Vercel liegen,
kann dieselbe Homescreen-App bei neuen Deployments aktualisiert werden. Der Service Worker
ist absichtlich network-first gebaut, damit neue Versionen bevorzugt geladen werden.

Lokales Öffnen der index.html reicht zum Testen, aber nicht für Installation/Updates wie eine echte App.
