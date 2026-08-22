Buhrsi's v0.14.3 – Hatch Exit + Countdown Audio
- Hatch-Weiter-Button wird beim Laden technisch neu erzeugt. Dadurch können keine alten/mehrfach registrierten Click-Handler den Abschluss blockieren.
- Beim Verlassen des Hatch-Screens werden Hatch-, Reward-, Brush- und sonstige offene Overlay-Zustände hart bereinigt.
- Scroll-/Pointer-Locks auf body/html werden entfernt.
- Sammlung wird danach aktualisiert und die Hauptseite freigegeben.
- In den letzten 10 Sekunden ertönt jetzt JEDE Sekunde ein kurzer Tick.
- Bei 0 bleibt der längere, dreistufige Erfolgston erhalten.
- Der funktionierende Endzeit-Timer wird nicht verändert.
- Keine Supabase-Änderung.

Installation:
Alle Dateien ins bestehende GitHub-Repo hochladen und auf main committen.
Danach App auf dem iPhone vollständig beenden und neu öffnen, damit der neue Service-Worker-Cache sicher geladen wird.
