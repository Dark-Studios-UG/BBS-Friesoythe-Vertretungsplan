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
const UPDATE_INTERVAL = 1800000; // 10 Minuten in Millisekunden
const SWITCH_HOUR = 17; // Ab dieser Uhrzeit wird auf den nächsten Tag umgeschaltet

const API_URL = 'https://vertretung.bababue.com/query';
const API_HEADERS = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'curl/8.5.0',
    Accept: '*/*'
};

// Rate-Limiting: 3 Sekunden zwischen erfolgreichen API-Anfragen
const API_REQUEST_DELAY = 3000; // 3 Sekunden in Millisekunden
let lastSuccessfulRequestTime = 0;

/**
 * Wartet, bis 3 Sekunden seit dem letzten erfolgreichen Request vergangen sind
 * @returns {Promise<void>}
 */
const waitForRateLimit = async () => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastSuccessfulRequestTime;
    
    if (timeSinceLastRequest < API_REQUEST_DELAY) {
        const waitTime = API_REQUEST_DELAY - timeSinceLastRequest;
        console.log(`Warte ${waitTime}ms vor nächstem Request (Rate-Limit: 3s)...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
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
 * Ermittelt das vorherige Schultag-Datum
 * @param {Date} date - Startdatum
 * @returns {Date} Vorheriger Schultag
 */
const getPreviousSchoolDay = (date) => {
    const prevDay = new Date(date);
    prevDay.setDate(prevDay.getDate() - 1);
    while (isWeekend(prevDay)) {
        prevDay.setDate(prevDay.getDate() - 1);
    }
    return prevDay;
};

/**
 * Ermittelt die nächsten N Schultage ab einem Startdatum
 * @param {Date} startDate - Startdatum
 * @param {number} count - Anzahl der Schultage
 * @returns {Array<string>} Array von Datumsstrings im Format YYYY-MM-DD
 */
const getNextSchoolDays = (startDate, count = 4) => {
    const dates = [];
    let currentDate = new Date(startDate);
    
    // Stelle sicher, dass wir mit einem Schultag starten
    if (isWeekend(currentDate)) {
        currentDate = getNextSchoolDay(currentDate);
    }
    
    while (dates.length < count) {
        const dateStr = currentDate.toISOString().split('T')[0];
        dates.push(dateStr);
        currentDate = getNextSchoolDay(currentDate);
    }
    
    return dates;
};

/**
 * Ermittelt die vergangenen N Schultage vor einem Startdatum
 * @param {Date} startDate - Startdatum
 * @param {number} count - Anzahl der Schultage
 * @returns {Array<string>} Array von Datumsstrings im Format YYYY-MM-DD
 */
const getPreviousSchoolDays = (startDate, count = 3) => {
    const dates = [];
    let currentDate = new Date(startDate);
    
    // Stelle sicher, dass wir mit einem Schultag starten
    if (isWeekend(currentDate)) {
        currentDate = getPreviousSchoolDay(currentDate);
    }
    
    // Gehe zum vorherigen Schultag
    currentDate = getPreviousSchoolDay(currentDate);
    
    while (dates.length < count) {
        const dateStr = currentDate.toISOString().split('T')[0];
        dates.unshift(dateStr); // Am Anfang einfügen, damit die ältesten zuerst kommen
        currentDate = getPreviousSchoolDay(currentDate);
    }
    
    return dates;
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

/**
 * Retry-Logik für API-Anfragen mit gestaffelten Delays
 * 3x nach 1 Sekunde, dann 1x nach 5 Sekunden, dann 1x nach 10 Sekunden
 * @param {Function} fn - Die auszuführende Funktion
 * @returns {Promise} Ergebnis der Funktion
 */
const retry = async (fn) => {
    // 3 Versuche mit 1 Sekunde Delay
    for (let i = 0; i < 3; i++) {
        try {
            return await fn();
        } catch (error) {
            console.log(`Versuch ${i + 1}/3 fehlgeschlagen (1s Delay)...`);
            if (i < 2) { // Nicht beim letzten Versuch warten
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    
    // 1 Versuch mit 5 Sekunden Delay
    try {
        console.log('Warte 5 Sekunden vor nächstem Versuch...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        return await fn();
    } catch (error) {
        console.log('Versuch nach 5s fehlgeschlagen, warte 10 Sekunden...');
    }
    
    // 1 Versuch mit 10 Sekunden Delay
    try {
        await new Promise(resolve => setTimeout(resolve, 10000));
        return await fn();
    } catch (error) {
        console.error('Alle Versuche fehlgeschlagen');
        throw error;
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
    // Warte 3 Sekunden seit dem letzten erfolgreichen Request
    await waitForRateLimit();
    
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
        
        // Aktualisiere Zeitpunkt des letzten erfolgreichen Requests
        lastSuccessfulRequestTime = Date.now();
        
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
 * Sequenzieller Abruf für vergangene 3 Schultage, heute und nächste 4 Schultage
 * @returns {Promise<Object>} Objekt mit Daten für alle Tage, keyed by date string
 */
const scrapeData = async () => {
    console.log("Starte Datenabruf...");
    const currentDate = getCorrectDate();
    const currentDateObj = new Date(currentDate);
    
    // Stelle sicher, dass wir mit einem Schultag starten
    let baseDate = currentDateObj;
    if (isWeekend(currentDateObj)) {
        baseDate = getNextSchoolDay(currentDateObj);
        console.log(`Aktuelles Datum ${currentDate} ist ein Wochenende, verwende ${baseDate.toISOString().split('T')[0]}`);
    }
    
    // Ermittle alle benötigten Daten: vergangene 3 + heute + nächste 4
    const previousDates = getPreviousSchoolDays(baseDate, 3);
    const nextDates = getNextSchoolDays(baseDate, 4);
    const allDates = [...previousDates, baseDate.toISOString().split('T')[0], ...nextDates];
    
    console.log(`Lade Daten für ${allDates.length} Tage: ${allDates.join(', ')}`);

    const fetchWithFallback = async (date) => {
        try {
            return await retry(() => fetchDataForDate(date, 'Alle'));
        } catch (error) {
            console.error(`Fehler beim Abrufen der Daten für ${date}:`, error.message);
            return [];
        }
    };
    
    // Sequenzieller Abruf (ein Tag nach dem anderen)
    console.log("Starte sequenziellen Datenabruf...");
    const allData = {};
    
    for (const dateStr of allDates) {
        console.log(`Lade Daten für ${dateStr}...`);
        const data = await fetchWithFallback(dateStr);
        allData[dateStr] = data;
    }

    return allData;
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
 * Behält die vergangenen 3 Schultage, heute und die nächsten 4 Schultage
 */
const cleanupOldTempFiles = () => {
    try {
        const currentDateStr = getCorrectDate();
        const currentDate = new Date(currentDateStr);
        
        // Stelle sicher, dass wir mit einem Schultag starten
        let baseDate = currentDate;
        if (isWeekend(currentDate)) {
            baseDate = getNextSchoolDay(currentDate);
        }
        
        // Ermittle alle zu behaltenden Daten: vergangene 3 + heute + nächste 4
        const previousDates = getPreviousSchoolDays(baseDate, 3);
        const nextDates = getNextSchoolDays(baseDate, 4);
        const baseDateStr = baseDate.toISOString().split('T')[0];
        const datesToKeep = new Set([...previousDates, baseDateStr, ...nextDates]);
        
        // Alle Dateien im data-Verzeichnis durchsuchen
        const files = fs.readdirSync(dataDir);
        
        // Temporäre Dateien filtern und löschen, außer die zu behaltenden
        files.forEach(file => {
            if (file.startsWith('temp_')) {
                // Extrahiere Datum aus Dateinamen (temp_YYYY-MM-DD.json)
                const dateMatch = file.match(/temp_(\d{4}-\d{2}-\d{2})\.json/);
                if (dateMatch) {
                    const fileDate = dateMatch[1];
                    if (!datesToKeep.has(fileDate)) {
                        const filePath = path.join(dataDir, file);
                        fs.unlinkSync(filePath);
                        console.log(`Alte temporäre Datei gelöscht: ${file}`);
                    }
                }
            }
        });
    } catch (error) {
        console.error('Fehler beim Löschen alter temporärer Dateien:', error);
    }
};

/**
 * Speichert die temporären Vertretungsdaten
 * Speichert Daten für vergangene 3 Schultage, heute und nächste 4 Schultage
 */
const saveTemporaryData = async () => {
    try {
        const allData = await scrapeData();
        
        // Lösche alte temporäre Dateien
        cleanupOldTempFiles();
        
        // Speichere Daten mit Kurs-Liste für alle Tage
        const saveData = (data, date) => {
            fs.writeFileSync(
                path.join(dataDir, `temp_${date}.json`),
                JSON.stringify({
                    data,
                    courses: [...new Set(data.map(item => item.kurs).filter(Boolean))]
                })
            );
            console.log(`Daten für ${date} gespeichert (${data.length} Einträge)`);
        };

        // Speichere alle Daten
        for (const [dateStr, data] of Object.entries(allData)) {
            saveData(data, dateStr);
        }
        
        console.log(`Insgesamt ${Object.keys(allData).length} Tage aktualisiert`);
    } catch (error) {
        console.error('Fehler beim Speichern der temporären Daten:', error);
    }
};

/**
 * Erstellt ein tägliches Backup der Vertretungsdaten
 * Speichert Backups für alle aktualisierten Tage (vergangene 3 + heute + nächste 4)
 */
const createDailyBackup = async () => {
    try {
        console.log("Creating daily backup...");
        const allData = await scrapeData();
        
        // Backup Daten speichern für alle Tage
        const createBackup = (data, date) => {
            fs.writeFileSync(
                path.join(dataDir, `data_${date}.json`),
                JSON.stringify({
                    data,
                    courses: [...new Set(data.map(item => item.kurs).filter(Boolean))]
                })
            );
            console.log(`Backup für ${date} erstellt (${data.length} Einträge)`);
        };

        // Speichere Backups für alle Tage
        for (const [dateStr, data] of Object.entries(allData)) {
            createBackup(data, dateStr);
        }
        
        console.log(`Insgesamt ${Object.keys(allData).length} Backups erstellt`);
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
        const currentDateObj = new Date(currentDate);
        
        // Prüfe, ob das Datum ein Wochenende ist
        let dateToUse = currentDate;
        if (isWeekend(currentDateObj)) {
            const nextSchoolDay = getNextSchoolDay(currentDateObj);
            dateToUse = nextSchoolDay.toISOString().split('T')[0];
            console.log(`Aktuelles Datum ${currentDate} ist Wochenende, verwende ${dateToUse}`);
        }
        
        const data = await getDataForDate(dateToUse);
        res.json(data);
    } catch (error) {
        console.error('Fehler beim Abrufen der Daten:', error);
        res.status(500).send('Serverfehler beim Abrufen der Daten');
    }
});

app.get('/api/morgen', async (req, res) => {
    try {
        const currentDate = getCorrectDate();
        const currentDateObj = new Date(currentDate);
        
        // Prüfe, ob das aktuelle Datum ein Wochenende ist
        let baseDate = currentDateObj;
        if (isWeekend(currentDateObj)) {
            baseDate = getNextSchoolDay(currentDateObj);
            console.log(`Aktuelles Datum ${currentDate} ist Wochenende, verwende ${baseDate.toISOString().split('T')[0]}`);
        }
        
        const tomorrowDate = new Date(baseDate);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        
        // Wenn der nächste Tag ein Wochenende ist, zum nächsten Schultag springen
        let tomorrowDateStr;
        if (isWeekend(tomorrowDate)) {
            const nextSchoolDay = getNextSchoolDay(tomorrowDate);
            tomorrowDateStr = nextSchoolDay.toISOString().split('T')[0];
            console.log(`Morgiges Datum wäre Wochenende, verwende ${tomorrowDateStr}`);
        } else {
            tomorrowDateStr = tomorrowDate.toISOString().split('T')[0];
        }
        
        const data = await getDataForDate(tomorrowDateStr);
        res.json(data);
    } catch (error) {
        console.error('Fehler beim Abrufen der Morgen-Daten:', error);
        res.status(500).send('Serverfehler beim Abrufen der Morgen-Daten');
    }
});

// Endpunkt für die nächsten 4 Schultage
app.get('/api/both', async (req, res) => {
    try {
        const currentDate = getCorrectDate();
        const currentDateObj = new Date(currentDate);
        
        // Prüfe, ob das aktuelle Datum ein Wochenende ist
        let startDate = currentDateObj;
        if (isWeekend(currentDateObj)) {
            startDate = getNextSchoolDay(currentDateObj);
            console.log(`Aktuelles Datum ${currentDate} ist Wochenende, verwende ${startDate.toISOString().split('T')[0]}`);
        }
        
        // Hole die nächsten 4 Schultage
        const schoolDays = getNextSchoolDays(startDate, 4);
        console.log(`Lade Daten für die nächsten 4 Schultage: ${schoolDays.join(', ')}`);

        // Sequenzieller Abruf für alle 4 Tage
        const allEntries = [];
        const allCourses = new Set();
        
        for (const dateStr of schoolDays) {
            try {
                const dayData = await getDataForDate(dateStr);
                const entries = dayData.data.map(entry => ({
                    ...entry,
                    datum: dateStr
                }));
                allEntries.push(...entries);
                
                // Sammle alle Kurse
                (dayData.courses || []).forEach(course => {
                    if (course) allCourses.add(course);
                });
            } catch (error) {
                console.error(`Fehler beim Abrufen der Daten für ${dateStr}:`, error);
            }
        }

        // Kombiniere die Daten und Kurse
        const combinedData = {
            data: allEntries.filter(item => item.kurs?.trim()),
            courses: Array.from(allCourses).sort()
        };

        res.json(combinedData);
    } catch (error) {
        console.error('Fehler beim Abrufen der nächsten 4 Schultage:', error);
        res.status(500).send('Serverfehler beim Abrufen der nächsten 4 Schultage');
    }
});

// Endpunkt für ein spezifisches Datum
app.get('/api/date/:date', async (req, res) => {
    try {
        const dateParam = req.params.date;
        // Validiere Datumsformat (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
            return res.status(400).json({ error: 'Ungültiges Datumsformat. Erwartet: YYYY-MM-DD' });
        }
        
        const data = await getDataForDate(dateParam);
        res.json(data);
    } catch (error) {
        console.error('Fehler beim Abrufen der Daten für Datum:', error);
        res.status(500).send('Serverfehler beim Abrufen der Daten');
    }
});

// Endpunkt für mehrere spezifische Daten (komma-separiert)
app.get('/api/both/:dates', async (req, res) => {
    try {
        const datesParam = req.params.dates;
        const dates = datesParam.split(',');
        
        // Validiere Datumsformate
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        for (const date of dates) {
            if (!dateRegex.test(date)) {
                return res.status(400).json({ error: 'Ungültiges Datumsformat. Erwartet: YYYY-MM-DD,YYYY-MM-DD,...' });
            }
        }

        // Sequenzieller Abruf für alle Daten
        const allEntries = [];
        const allCourses = new Set();
        
        for (const dateStr of dates) {
            try {
                const dayData = await getDataForDate(dateStr);
                const entries = dayData.data.map(entry => ({
                    ...entry,
                    datum: dateStr
                }));
                allEntries.push(...entries);
                
                // Sammle alle Kurse
                (dayData.courses || []).forEach(course => {
                    if (course) allCourses.add(course);
                });
            } catch (error) {
                console.error(`Fehler beim Abrufen der Daten für ${dateStr}:`, error);
            }
        }

        // Kombiniere die Daten und Kurse
        const combinedData = {
            data: allEntries.filter(item => item.kurs?.trim()),
            courses: Array.from(allCourses).sort()
        };

        res.json(combinedData);
    } catch (error) {
        console.error('Fehler beim Abrufen der Daten:', error);
        res.status(500).send('Serverfehler beim Abrufen der Daten');
    }
});

/**
 * Speichert Daten für ein spezifisches Datum
 * @param {string} date - Datum im Format YYYY-MM-DD
 * @param {Array} data - Array von Vertretungseinträgen
 */
const saveDataForDate = (date, data) => {
    try {
        const tempFile = path.join(dataDir, `temp_${date}.json`);
        fs.writeFileSync(
            tempFile,
            JSON.stringify({
                data,
                courses: [...new Set(data.map(item => item.kurs).filter(Boolean))]
            }, null, 2)
        );
        console.log(`Daten für ${date} gespeichert (${data.length} Einträge)`);
    } catch (error) {
        console.error(`Fehler beim Speichern der Daten für ${date}:`, error);
    }
};

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

        // Wenn keine Datei existiert, hole neue Daten für DIESES spezifische Datum
        console.log(`Keine Datei für ${date} gefunden, hole Daten von API...`);
        try {
            const fetchedData = await retry(() => fetchDataForDate(date, 'Alle'));
            // Speichere die Daten für dieses spezifische Datum
            saveDataForDate(date, fetchedData);
            return {
                data: fetchedData,
                courses: [...new Set(fetchedData.map(item => item.kurs).filter(Boolean))]
            };
        } catch (error) {
            console.error(`Fehler beim Abrufen der Daten für ${date}:`, error);
            return { data: [], courses: [] };
        }
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
