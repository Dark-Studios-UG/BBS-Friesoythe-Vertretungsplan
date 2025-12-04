# TASKS

## Aktive & Abgeschlossene Aufgaben
- [x] 2025-01-27 – Standardansicht auf "Beide" gesetzt
  - Beschreibung: Standardansicht in `public/script.js` von "Heute" auf "Beide" geändert. URL-Hash-Logik entsprechend angepasst.
- [x] 2025-01-27 – Aktualisierung der WebUntis-URLs
  - Beschreibung: URLs in `scrape.js` von `kephiso.webuntis.com` auf `bbs-friesoythe.webuntis.com` aktualisiert.
- [x] 2025-12-04 – Stabilisierung der Tabellenextraktion in `extractTableData`
  - Beschreibung: Fallback implementieren, damit bei fehlenden Tabellenzeilen (z. B. am Wochenende) kein Timeout mehr entsteht.
- [x] 2025-01-27 – Behebung des Timeout-Fehlers in `extractTableData`
  - Beschreibung: Timeout-Fehler behoben durch kürzeren Timeout (20s statt 60s), Fallback-Mechanismus nach Timeout, verbesserte Fehlerbehandlung und erweiterte Selektoren für leere Zustände.

## Discovered During Work
- (Keine neuen Punkte während dieser Änderung identifiziert.)
