Buhrsi's v0.14.7 – Anmeldung merken
- Supabase-Elternsession bleibt auf dem Gerät gespeichert und wird automatisch erneuert.
- Das zuletzt verwendete Kinderprofil wird lokal auf diesem Gerät gespeichert.
- Beim erneuten Öffnen versucht die App automatisch, Elternsession + Kinderprofil wiederherzustellen.
- Wenn die Session abgelaufen/ungültig ist, bleibt die normale Anmeldung erhalten.
- 45-Sekunden-Testtimer bleibt unverändert.
- Keine Supabase-Migration nötig.

Test:
1. Einmal normal anmelden und Kinderprofil öffnen.
2. App vollständig schließen.
3. App erneut öffnen.
4. Sie sollte automatisch wieder in das zuletzt verwendete Kinderprofil wechseln.

Sicherheit:
Das ist Gerätekomfort, kein Ersatz für die spätere zusätzliche Elternbereich-Sperre. Explizites Abmelden soll die Session weiterhin beenden.
