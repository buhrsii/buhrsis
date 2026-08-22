Buhrsi's v0.7
- Startauswahl Kind / Eltern
- Kinderkonto mit eigenem Benutzernamen + 4-stelliger PIN
- Eltern erstellen/verwalten Kinderkonten
- Buhrsi-Code pro Kinderkonto
- PIN wird nur gehasht gespeichert
- Registrierung nutzt die aktuelle App-Domain als E-Mail-Redirect

WICHTIG: zuerst `supabase-v07.sql` im Supabase SQL Editor ausführen.
Danach Dateien ins bestehende GitHub-Repo hochladen und auf main committen.

Sicherheitsnotiz: Kinder-PIN-Login ist in v0.7 ein Prototyp. Vor öffentlichem Produktivbetrieb sollte die PIN-Prüfung serverseitig mit Rate-Limiting und kurzlebigen signierten Sessions umgesetzt werden.
