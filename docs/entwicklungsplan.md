# Entwicklungsplan: Zug um Zug Elo

## Ausgangslage

Das Projekt verwendet Next.js 15 mit App Router, React 19, TypeScript im Strict-Modus, Prisma 5 und PostgreSQL. Die Anwendung befindet sich im Aufbau; als erster interaktiver UI-Prototyp steht die lokale Partieerfassung bereit.

Das bestehende Prisma-Modell bildet die Zieldomäne bereits umfassend ab:

- Benutzerkonten mit Rollen, Freigabe-, Sperr- und Löschstatus sowie Verifikations- und Passwort-Reset-Tokens
- Spielerprofile mit Elo-Ausgangs- und aktuellem Wert, Alias-Historie, Benutzerzuordnung und Zusammenführung
- Missionen sowie Partien mit Teilnehmern, Punkten, Platzierungen, Tiebreak, Missionsstatus und gespeicherten Wertungsänderungen
- Prüf- und Moderationsabläufe für Partien, Spielermeldungen und Profilansprüche
- Audit-Log für nachvollziehbare administrative Änderungen

Das Datenbankschema ist für die folgenden Schritte eine feste Vorgabe und wird nicht verändert.

## Entwicklungsphasen

1. **Technisches Fundament absichern**
   - Oberflächenstruktur der Elo-Anwendung schrittweise ausbauen.
   - Einheitliche Fehlerbehandlung, Eingabevalidierung, Logging und Konfiguration ergänzen.
   - Teststruktur für Domänenlogik, API-Routen und zentrale Benutzerabläufe einrichten.

2. **Authentifizierung und Berechtigungen**
   - Registrierung, E-Mail-Verifikation, Anmeldung, Abmeldung und Passwort-Reset implementieren.
   - Status- und rollenbasierte Zugriffe zentral durchsetzen (`USER`, `ADMIN` sowie die vorhandenen Benutzerstatus).
   - Freigabe, Sperre und Einschränkung der Partieerfassung gemäß den vorhandenen Benutzerfeldern abbilden.

3. **Spieler und Missionen**
   - Rangliste, Spielerprofile und Alias-Historie bereitstellen.
   - Zuordnung eines Benutzerkontos zu einem Spieler über den vorhandenen Claim-Prozess umsetzen.
   - Administrative Pflege von Spielern, Zusammenführungen und Missionen ergänzen.

4. **Partieerfassung und Elo-Berechnung**
   - Erfassungsablauf für Datum, Teilnehmer, Punkte, Platzierung, Tiebreak, Mission und optionales Foto bauen.
   - Elo-Berechnung als isolierte, deterministische und umfassend getestete Domänenfunktion implementieren.
   - Partie, Teilnehmerwerte und Wertungsänderungen atomar in einer Datenbanktransaktion speichern.
   - Vorhandene Review-Gründe und Benutzerrestriktionen beim Status einer Partie berücksichtigen.

5. **Historie, Prüfung und Moderation**
   - Partienliste und Detailansicht mit nachvollziehbarer Wertungsänderung erstellen.
   - Melde-, Prüf-, Bestätigungs-, Ablehnungs- und Soft-Delete-Abläufe implementieren.
   - Administrative Änderungen und Zusammenführungen über das vorhandene Audit-Modell protokollieren.

6. **Qualität und Auslieferung**
   - Responsive, barrierearme deutsche Oberfläche und konsistente Lade-, Leer- und Fehlerzustände fertigstellen.
   - Kritische Abläufe mit Integrations- und End-to-End-Tests absichern, insbesondere Berechtigungen und Elo-Neuberechnung.
   - Sicherheitsprüfung für Passwörter, Tokens, Autorisierung, Uploads und sensible Ausgaben durchführen.
   - Seed-/Betriebsdokumentation, Umgebungsvariablen und Deployment-Checks ergänzen, ohne das Schema anzupassen.

## Empfohlener erster Meilenstein

Ein nutzbares MVP umfasst Anmeldung, freigegebene Benutzer, Spieler- und Missionsauswahl, Partieerfassung mit getesteter Elo-Berechnung sowie Rangliste und Partienhistorie. Moderation, Claims, Meldungen, Spielerzusammenführung und Audit-Oberflächen folgen auf diesem stabilen Kern.

## Leitplanken

- Das bestehende Prisma-Schema und die vorhandene Migration bleiben unverändert.
- Elo-Änderungen werden serverseitig berechnet und zusammen mit der Partie transaktional gespeichert.
- Autorisierung erfolgt bei jeder serverseitigen Mutation, nicht nur in der Oberfläche.
- Soft-Delete-, Status- und Audit-Felder werden entsprechend ihrer bereits modellierten Bedeutung verwendet.
- Jede Phase soll bestehende Funktionen erhalten und durch automatisierte Tests absichern.
