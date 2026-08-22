Buhrsi's v0.15.4 – Elternnavigation direkt im Quellcode repariert

Ursache:
Die bisherigen Builds zielten auf falsche DOM-IDs/Container (`parentList`, generische Karten).
Die echte Kinderliste heißt `profileList`. Außerdem öffnete ein Klick auf ein Kind bisher ausschließlich das Verwaltungsmodal.

Jetzt direkt in `profiles()` repariert:
- Jedes Kinderprofil zeigt sichtbar `ALS KIND STARTEN`
- daneben `VERWALTEN`
- `ALS KIND STARTEN` ruft direkt die vorhandene `choose()`-Funktion auf
- `VERWALTEN` öffnet die bestehende Elternverwaltung
- auch im Verwaltungsmodal gibt es `ALS KIND STARTEN`
- nach neuem Kinderkonto wird die echte Liste neu geladen und diese Buttons sind sofort vorhanden

Keine Supabase-Änderung.
