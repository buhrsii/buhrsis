# Buhrsi's v0.48 – Verlässliche Navigation

Die PWA verbindet den bisherigen Zahnputz- und Buhrsi-Bereich mit einem geschützten Organizer für Kinder und Eltern.

Neu in v0.48:

- abgelaufene Kinder-Sitzungen führen sicher zurück zur Anmeldung statt auf eine leere Seite
- Familien-Emoji und Familienname werden sichtbar zusammen angezeigt
- die Schule/Daheim-Auswahl und der Schulbereich haben einen direkten Rückweg zur Anmeldung

Bereits seit v0.47:

- jedes Kinderprofil besitzt ein vollständig getrenntes Schulprofil
- Schulen können über die offene JedeSchule-Datenbank gesucht oder manuell eingetragen werden
- Fächer werden als Haupt-/Nebenfach mit eigener Farbe angelegt
- Unterrichtszeiten und Pausen werden im farbigen Wochenplan angezeigt

Bereits seit v0.46:

- Familien lassen sich benennen und mit einem Emoji kennzeichnen
- alle angemeldeten Eltern der Familie dürfen diese Einstellungen bearbeiten
- Emil wurde ohne Verlust seines Profils in die gemeinsame Familie übernommen

Bereits seit v0.45:

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

Die Datenbankänderungen liegen in `supabase-v044-kids-organizer.sql`, `supabase-v045-family-groups.sql`, `supabase-v046-family-customization.sql` und `supabase-v047-school-schedules.sql`.
