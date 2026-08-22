Buhrsi's v0.13 – zuverlässiger Putz-Timer
- Timer basiert jetzt auf einer absoluten Endzeit statt auf heruntergezählten setInterval-Sekunden.
- Wenn iOS den Bildschirm sperrt/JavaScript pausiert, springt die Anzeige nach dem Entsperren sofort auf die korrekte Restzeit.
- 30/60/90 Sekunden: kurzer Wechselton.
- 120 Sekunden: eigener Erfolgston.
- Vibration bei Bereichswechsel und Abschluss, sofern der Browser navigator.vibrate unterstützt.
- Wake Lock aus v0.12 bleibt als zusätzlicher Versuch aktiv.
- Schlüpfsystem und Mobile-Navigation aus v0.12 bleiben enthalten.

Kein neuer Supabase-Schritt für v0.13.
Falls `supabase-v011.sql` aus v0.12 noch NICHT ausgeführt wurde, muss dieser Schlüpf-Datenbank-Schritt weiterhin einmalig ausgeführt werden.
Danach v0.13 komplett in das bestehende GitHub-Repo hochladen und auf main committen.
