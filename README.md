Buhrsi's v0.15.3 – Elternbereich explizite Navigation

v0.15.2 war zu indirekt: Es versuchte bestehende Profilkarten über generische Selektoren klickbar zu machen.
v0.15.3 hängt stattdessen direkt an die tatsächliche Elternliste `#parentList` unter jedes Kinderprofil einen sichtbaren Button:

ALS KIND STARTEN

Der Button:
- ermittelt das konkrete Profil über dessen @Benutzername
- setzt dieses Profil als aktives Kind
- speichert es als letztes Geräteprofil
- verlässt den Elternbereich und öffnet die Zahnputz-Hauptseite

Keine Supabase-Änderung.
45-Sekunden-Testmodus und bestehende Sounds bleiben unverändert.
