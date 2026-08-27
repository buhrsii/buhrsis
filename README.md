# Buhrsi's v0.45 – Familiengruppen

Die PWA verbindet den bisherigen Zahnputz- und Buhrsi-Bereich mit einem geschützten Organizer für Kinder und Eltern.

Neu in v0.45:

- Eltern registrieren sich mit einem eigenen Elternkonto
- ein Elternteil erstellt eine Familiengruppe
- weitere Eltern treten mit einem achtstelligen Familiencode bei
- alle Eltern der Familie können die zugehörigen Kinder verwalten
- vorhandene Kinder werden automatisch und ohne Datenverlust übernommen
- Kinder sehen weder Familiencode noch Lehrerkontaktdaten oder Elternverwaltung

Bereits seit v0.44:

- Startauswahl zwischen **Schule** und **Daheim**
- Schulprofil mit Schule, Schulart, Klasse, Klassenstufe, Schuljahr und Bundesland
- dynamische Anzeige der nächsten Schulferien nach Bundesland
- Haupt- und Nebenfächer, Lehrer, Kontaktdaten, Sprechzeiten und Hinweise
- Wochenstundenplan mit Fach, Lehrer, Raum und Uhrzeit
- Schulaufgaben, Tests, Referate, Abgaben und Elterntermine
- gewichtete Noten und getrennte Durchschnitte für Haupt-/Nebenfächer
- Lernzeiten und gute Noten vergeben XP
- Elternaufgaben für daheim mit frei wählbarer XP-Belohnung
- private Lehrerkontaktdaten bleiben im Elternzugang

Die Datenbankänderungen liegen in `supabase-v044-kids-organizer.sql` und `supabase-v045-family-groups.sql`.
