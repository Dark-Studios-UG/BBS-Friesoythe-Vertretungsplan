const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { URLSearchParams } = require('url');

// Konstanten
const PORT = process.env.PORT || 3000;
const BACKUP_HOUR = 3; // Uhrzeit für tägliches Backup
const UPDATE_INTERVAL = 600000; // 10 Minuten in Millisekunden
const SWITCH_HOUR = 17; // Ab dieser Uhrzeit wird auf den nächsten Tag umgeschaltet

const API_URL = 'https://vertretung.bababue.com/query';
const API_HEADERS = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'curl/8.5.0',
    Accept: '*/*'
};

// Express App Setup
const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Verzeichnisstruktur
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

/**
 * Prüft, ob ein Datum ein Wochenende ist
 * @param {Date} date - Das zu prüfende Datum
 * @returns {boolean} true wenn Wochenende (Samstag oder Sonntag)
 */
const isWeekend = (date) => {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 = Sonntag, 6 = Samstag
};

/**
 * Ermittelt das nächste Schultag-Datum
 * @param {Date} date - Startdatum
 * @returns {Date} Nächster Schultag
 */
const getNextSchoolDay = (date) => {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    while (isWeekend(nextDay)) {
        nextDay.setDate(nextDay.getDate() + 1);
    }
    return nextDay;
};

/**
 * Ermittelt das korrekte Datum basierend auf der Tageszeit
 * @returns {string} Datum im Format YYYY-MM-DD
 */
const getCorrectDate = () => {
    // Erstelle Datum in deutscher Zeitzone
    const now = new Date();
    const germanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
    
    // Wenn es nach SWITCH_HOUR ist, zum nächsten Tag springen
    if (germanTime.getHours() >= SWITCH_HOUR) {
        // Wenn aktuell Wochenende ist und nach SWITCH_HOUR, zum nächsten Schultag springen
        if (isWeekend(germanTime)) {
            const nextSchoolDay = getNextSchoolDay(germanTime);
            return nextSchoolDay.toISOString().split('T')[0];
        }
        germanTime.setDate(germanTime.getDate() + 1);
        // Wenn der nächste Tag ein Wochenende ist, zum nächsten Schultag springen
        if (isWeekend(germanTime)) {
            const nextSchoolDay = getNextSchoolDay(germanTime);
            return nextSchoolDay.toISOString().split('T')[0];
        }
    } else if (isWeekend(germanTime)) {
        // Wenn aktuell Wochenende ist, zum nächsten Schultag springen
        const nextSchoolDay = getNextSchoolDay(germanTime);
        return nextSchoolDay.toISOString().split('T')[0];
    }
    
    return germanTime.toISOString().split('T')[0];
};

// Retry-Logik für API-Anfragen
const retry = async (fn, retries = 3, delay = 5000) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) throw error;
            console.log(`Versuch ${i + 1} fehlgeschlagen, wiederhole in ${delay/1000} Sekunden...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

/**
 * Holt die Vertretungsdaten von der neuen API
 * @param {string} date - Datum im Format YYYY-MM-DD
 * @param {string} kurs - Kursname oder 'Alle' für alle Kurse
 * @returns {Promise<Array>} Array von Vertretungseinträgen
 */
/**
 * Erstellt den Form-Body für die POST-Anfrage (exakt wie curl)
 * @param {string} date - Datum im Format YYYY-MM-DD
 * @param {string} kurs - Kursname oder 'Alle'
 * @returns {string} URL-encoded Form-String
 */
const buildFormBody = (date, kurs) => {
    // Exakt wie im curl-Befehl: 'date=2025-12-08&kurs=Alle'
    // 'Alle' muss nicht encoded werden, da es kein Sonderzeichen enthält
    return `date=${date}&kurs=${kurs}`;
};

/**
 * Holt die Vertretungsdaten von der neuen API
 * @param {string} date - Datum im Format YYYY-MM-DD
 * @param {string} kurs - Kursname oder 'Alle' für alle Kurse
 * @returns {Promise<Array>} Array von Vertretungseinträgen
 */
const fetchDataForDate = async (date, kurs = 'Alle') => {
    try {
        console.log(`Hole Daten für ${date}, Kurs: ${kurs}`);
        
        // Exakt wie curl senden: direkter String, keine URLSearchParams
        const formData = buildFormBody(date, kurs);
        
        const response = await axios.post(
            API_URL,
            formData,
            {
                headers: API_HEADERS,
                timeout: 30000, // 30 Sekunden Timeout
                maxRedirects: 0, // Keine Redirects
                validateStatus: (status) => status === 200 // Nur 200 akzeptieren
            }
        );
        
        // Prüfe, ob wir HTML zurückbekommen haben
        if (typeof response.data !== 'string' || !response.data.includes('<tbody')) {
            console.warn(`Unerwartete Antwort für ${date}:`, response.data.substring(0, 200));
        }
        
        const data = extractTableData(response.data);
        console.log(`Gefunden: ${data.length} Einträge für ${date}`);
        return data;
    } catch (error) {
        // Detaillierte Fehlerbehandlung
        if (error.response) {
            console.error(`HTTP ${error.response.status} Fehler für ${date}:`, error.response.statusText);
            console.error(`Response-Header:`, error.response.headers);
            if (error.response.data) {
                console.error(`Response-Body (erste 500 Zeichen):`, String(error.response.data).substring(0, 500));
            }
        } else if (error.request) {
            console.error(`Keine Antwort vom Server für ${date}:`, error.message);
        } else {
            console.error(`Fehler beim Abrufen der Daten für ${date}:`, error.message);
        }
        throw error;
    }
};

/**
 * Scrapt die Vertretungsdaten von der neuen API
 * @returns {Promise<{dataToday: Array, dataTomorrow: Array}>}
 */
const scrapeData = async () => {
    console.log("Starte Datenabruf...");
    const currentDate = getCorrectDate();
    const tomorrowDate = new Date(currentDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    
    // Wenn der nächste Tag ein Wochenende ist, zum nächsten Schultag springen
    const nextDate = isWeekend(tomorrowDate) 
        ? getNextSchoolDay(tomorrowDate) 
        : tomorrowDate;
    
    const tomorrowDateStr = nextDate.toISOString().split('T')[0];

    const fetchWithFallback = async (label, date) => {
        try {
            return await retry(() => fetchDataForDate(date, 'Alle'));
        } catch (error) {
            console.error(`Fehler beim Abrufen der ${label} Daten (${date}):`, error.message);
            return [];
        }
    };
    
    // Paralleler Abruf für heute und morgen mit Fallback
    console.log("Starte parallelen Datenabruf für heute und morgen...");
    const [dataToday, dataTomorrow] = await Promise.all([
        fetchWithFallback('heutigen', currentDate),
        fetchWithFallback('morgigen', tomorrowDateStr)
    ]);

    return { dataToday, dataTomorrow };
};

/**
 * Extrahiert Tabellendaten aus dem HTML-Response
 * @param {string} html - HTML-String der Antwort
 * @returns {Array} Array von Vertretungseinträgen
 */
const extractTableData = (html) => {
    try {
        // Das HTML enthält nur thead und tbody ohne table-Tag
        // Wir müssen es in ein table-Tag wrappen, damit Cheerio es richtig parsen kann
        const wrappedHtml = `<table>${html}</table>`;
        const $ = cheerio.load(wrappedHtml);
        const rows = $('tbody tr');
        
        if (rows.length === 0) {
            console.log("Keine Zeilen in der Tabelle gefunden");
            return [];
        }

        const data = [];
        rows.each((index, row) => {
            const $row = $(row);
            
            // Kurs ist in einem th-Element mit scope="row"
            const kurs = $row.find('th[scope="row"]').text().trim();
            
            // Andere Spalten sind in td-Elementen
            const tds = $row.find('td');
            if (tds.length < 5) {
                console.log(`Zeile ${index + 1} hat unzureichende Zellen: ${tds.length}`);
                return;
            }

            // Spaltenreihenfolge: Stunde, Raum, Lehrer, Typ, Notizen
            const stunde = $(tds[0]).text().trim();
            const raum = $(tds[1]).text().trim();
            const lehrer = $(tds[2]).text().trim();
            const typ = $(tds[3]).text().trim();
            const notizen = $(tds[4]).text().trim();

            // Nur Einträge mit Kurs hinzufügen
            if (kurs) {
                data.push({
                    kurs,
                    stunde,
                    raum,
                    lehrer,
                    typ,
                    notizen
                });
            }
        });

        return data;
    } catch (error) {
        console.error("Fehler beim Extrahieren der Tabellendaten:", error);
        return [];
    }
};

/**
 * Löscht alte temporäre Dateien im data-Verzeichnis
 */
const cleanupOldTempFiles = () => {
    try {
        // Aktuelle Datum und das morgige Datum (oder nächster Schultag) ermitteln
        const currentDateStr = getCorrectDate();
        const currentDate = new Date(currentDateStr);
        const tomorrowDate = new Date(currentDate);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        
        // Wenn der nächste Tag ein Wochenende ist, zum nächsten Schultag springen
        const nextDate = isWeekend(tomorrowDate) 
            ? getNextSchoolDay(tomorrowDate) 
            : tomorrowDate;
            
        const nextDateStr = nextDate.toISOString().split('T')[0];
        
        // Alle Dateien im data-Verzeichnis durchsuchen
        const files = fs.readdirSync(dataDir);
        
        // Temporäre Dateien filtern und löschen, außer die aktuellen und morgigen
        files.forEach(file => {
            if (file.startsWith('temp_') && 
                file !== `temp_${currentDateStr}.json` && 
                file !== `temp_${nextDateStr}.json`) {
                
                const filePath = path.join(dataDir, file);
                fs.unlinkSync(filePath);
                console.log(`Alte temporäre Datei gelöscht: ${file}`);
            }
        });
    } catch (error) {
        console.error('Fehler beim Löschen alter temporärer Dateien:', error);
    }
};

/**
 * Speichert die temporären Vertretungsdaten
 */
const saveTemporaryData = async () => {
    try {
        const { dataToday, dataTomorrow } = await scrapeData();
        const currentDate = getCorrectDate();
        const tomorrowDate = new Date(currentDate);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        
        // Lösche alte temporäre Dateien
        cleanupOldTempFiles();
        
        // Wenn der nächste Tag ein Wochenende ist, zum nächsten Schultag springen
        if (isWeekend(tomorrowDate)) {
            const nextSchoolDay = getNextSchoolDay(tomorrowDate);
            const nextSchoolDayStr = nextSchoolDay.toISOString().split('T')[0];
            
            // Speichere Daten mit Kurs-Liste
            const saveData = (data, date) => {
                fs.writeFileSync(
                    path.join(dataDir, `temp_${date}.json`),
                    JSON.stringify({
                        data,
                        courses: [...new Set(data.map(item => item.kurs))]
                    })
                );
            };

            saveData(dataToday, currentDate);
            saveData(dataTomorrow, nextSchoolDayStr);
            return;
        }
        
        const tomorrowDateStr = tomorrowDate.toISOString().split('T')[0];

        // Speichere Daten mit Kurs-Liste
        const saveData = (data, date) => {
            fs.writeFileSync(
                path.join(dataDir, `temp_${date}.json`),
                JSON.stringify({
                    data,
                    courses: [...new Set(data.map(item => item.kurs))]
                })
            );
        };

        saveData(dataToday, currentDate);
        saveData(dataTomorrow, tomorrowDateStr);
    } catch (error) {
        console.error('Fehler beim Speichern der temporären Daten:', error);
    }
};

/**
 * Erstellt ein tägliches Backup der Vertretungsdaten
 */
const createDailyBackup = async () => {
    try {
        console.log("Creating daily backup...");
        const { dataToday, dataTomorrow } = await scrapeData();
        const currentDate = getCorrectDate();
        const tomorrowDate = new Date(currentDate);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        
        // Wenn der nächste Tag ein Wochenende ist, zum nächsten Schultag springen
        if (isWeekend(tomorrowDate)) {
            const nextSchoolDay = getNextSchoolDay(tomorrowDate);
            const nextSchoolDayStr = nextSchoolDay.toISOString().split('T')[0];
            
            // Backup Daten speichern
            const createBackup = (data, date) => {
                fs.writeFileSync(
                    path.join(dataDir, `data_${date}.json`),
                    JSON.stringify({
                        data,
                        courses: [...new Set(data.map(item => item.kurs))]
                    })
                );
            };

            createBackup(dataToday, currentDate);
            createBackup(dataTomorrow, nextSchoolDayStr);
            return;
        }
        
        const tomorrowDateStr = tomorrowDate.toISOString().split('T')[0];

        // Backup Daten speichern
        const createBackup = (data, date) => {
            fs.writeFileSync(
                path.join(dataDir, `data_${date}.json`),
                JSON.stringify({
                    data,
                    courses: [...new Set(data.map(item => item.kurs))]
                })
            );
        };

        createBackup(dataToday, currentDate);
        createBackup(dataTomorrow, tomorrowDateStr);
    } catch (error) {
        console.error('Fehler beim Erstellen des Backups:', error);
    }
};

/**
 * Plant das tägliche Backup
 */
const scheduleBackup = () => {
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setHours(BACKUP_HOUR, 0, 0, 0);
    
    if (now >= nextRun) {
        nextRun.setDate(nextRun.getDate() + 1);
    }

    const timeUntilNextRun = nextRun - now;
    setTimeout(async () => {
        await createDailyBackup();
        setInterval(createDailyBackup, 24 * 60 * 60 * 1000);
    }, timeUntilNextRun);
};

// API-Endpunkte
app.get('/api/data', async (req, res) => {
    try {
        const currentDate = getCorrectDate();
        const data = await getDataForDate(currentDate);
        res.json(data);
    } catch (error) {
        console.error('Fehler beim Abrufen der Daten:', error);
        res.status(500).send('Serverfehler beim Abrufen der Daten');
    }
});

app.get('/api/morgen', async (req, res) => {
    try {
        const currentDate = getCorrectDate();
        const tomorrowDate = new Date(currentDate);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        
        // Wenn der nächste Tag ein Wochenende ist, zum nächsten Schultag springen
        if (isWeekend(tomorrowDate)) {
            const nextSchoolDay = getNextSchoolDay(tomorrowDate);
            const nextSchoolDayStr = nextSchoolDay.toISOString().split('T')[0];
            const data = await getDataForDate(nextSchoolDayStr);
            res.json(data);
            return;
        }
        
        const tomorrowDateStr = tomorrowDate.toISOString().split('T')[0];
        const data = await getDataForDate(tomorrowDateStr);
        res.json(data);
    } catch (error) {
        console.error('Fehler beim Abrufen der Morgen-Daten:', error);
        res.status(500).send('Serverfehler beim Abrufen der Morgen-Daten');
    }
});

// Endpunkt für beide Tage
app.get('/api/both', async (req, res) => {
    try {
        const currentDate = getCorrectDate();
        const tomorrowDate = new Date(currentDate);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        
        // Wenn der nächste Tag ein Wochenende ist, zum nächsten Schultag springen
        if (isWeekend(tomorrowDate)) {
            const nextSchoolDay = getNextSchoolDay(tomorrowDate);
            tomorrowDate.setTime(nextSchoolDay.getTime());
        }
        
        const tomorrowDateStr = tomorrowDate.toISOString().split('T')[0];

        const todayData = await getDataForDate(currentDate);
        const tomorrowData = await getDataForDate(tomorrowDateStr);

        // Füge das Datum zu jedem Eintrag hinzu
        const todayEntries = todayData.data.map(entry => ({
            ...entry,
            datum: currentDate
        }));
        const tomorrowEntries = tomorrowData.data.map(entry => ({
            ...entry,
            datum: tomorrowDateStr
        }));

        // Kombiniere die Daten und Kurse
        const combinedData = {
            data: [...todayEntries, ...tomorrowEntries].filter(item => item.kurs?.trim()),
            courses: [...new Set([...todayData.courses || [], ...tomorrowData.courses || []].filter(Boolean))]
        };

        res.json(combinedData);
    } catch (error) {
        console.error('Fehler beim Abrufen beider Tage:', error);
        res.status(500).send('Serverfehler beim Abrufen beider Tage');
    }
});

/**
 * Liest Vertretungsdaten für ein bestimmtes Datum
 * @param {string} date - Datum im Format YYYY-MM-DD
 * @returns {Promise<Object>}
 */
const getDataForDate = async (date) => {
    const tempFile = path.join(dataDir, `temp_${date}.json`);
    const backupFile = path.join(dataDir, `data_${date}.json`);

    try {
        // Versuche zuerst die temporäre Datei zu lesen
        if (fs.existsSync(tempFile)) {
            const data = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
            return {
                data: data.data || [],
                courses: [...new Set((data.courses || []).filter(Boolean))]
            };
        }

        // Wenn keine temporäre Datei existiert, versuche die Backup-Datei
        if (fs.existsSync(backupFile)) {
            const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
            return {
                data: data.data || [],
                courses: [...new Set((data.courses || []).filter(Boolean))]
            };
        }

        // Wenn keine Datei existiert, hole neue Daten
        await saveTemporaryData();
        if (fs.existsSync(tempFile)) {
            const data = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
            return {
                data: data.data || [],
                courses: [...new Set((data.courses || []).filter(Boolean))]
            };
        }

        return { data: [], courses: [] };
    } catch (error) {
        console.error(`Fehler beim Lesen der Daten für ${date}:`, error);
        return { data: [], courses: [] };
    }
};

// Server starten
app.listen(PORT, () => {
    console.log(`Server läuft unter http://localhost:${PORT}`);
    scheduleBackup();
});

// Regelmäßige Aktualisierung der Daten
setInterval(saveTemporaryData, UPDATE_INTERVAL);
