Buhrsi's v0.13.1 – iPhone Audio Fix
- Der funktionierende Endzeit-Timer aus v0.13 bleibt unverändert.
- Wechsel- und Erfolgssound sind jetzt echte lokale WAV-Dateien.
- Audio wird beim Start vorab geladen und innerhalb der Benutzer-Geste entsperrt.
- 30/60/90 Sekunden: kurzer Wechselton.
- 120 Sekunden: dreistufiger Erfolgston.
- Vibration bleibt als Fallback/Ergänzung erhalten, sofern unterstützt.

Keine Supabase-Änderung.
Alle Dateien inklusive `assets`-Ordner in das bestehende GitHub-Repo hochladen und auf main committen.
Auf dem iPhone muss die Medienlautstärke hörbar sein; Lautlos-/Focus-Verhalten kann je nach iOS-Konfiguration variieren.
