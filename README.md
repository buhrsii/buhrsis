Buhrsi's v0.14.1 – Stabilität
- Freeze nach abgeschlossener Putzrunde behoben.
- Abschluss-Event wird erst ausgelöst, nachdem der Reward-Screen vollständig aufgebaut wurde.
- Weiter-Button räumt Brush-/Reward-Overlays und Body-Lock defensiv auf.
- Unsichtbare Overlays können keine Touch-Eingaben mehr blockieren.
- Funktionierender Endzeit-Timer aus v0.13.x bleibt unverändert.
- Keine neuen Gameplay-Funktionen.
- Kein neuer Supabase-Schritt.

WICHTIG ZUM IPHONE-DISPLAY:
Die PWA-Wake-Lock-Versuche bleiben vorerst nur als Best-Effort erhalten. iOS kann sie bei installierten Web-Apps weiterhin ignorieren.
Die zuverlässige Lösung wird die native iOS-Hülle. Dafür wird im nächsten Schritt ein eigenes App-Projekt vorbereitet; dieser Stabilitätsbuild verändert den Timer nicht.

Installation:
Alle Dateien in das bestehende GitHub-Repo hochladen und auf main committen. Keine SQL-Datei ausführen.
