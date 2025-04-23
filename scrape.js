const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Konstanten
const PORT = process.env.PORT || 3000;
const BACKUP_HOUR = 3; // Uhrzeit für tägliches Backup
const UPDATE_INTERVAL = 600000; // 10 Minuten in Millisekunden
const SWITCH_HOUR = 17; // Ab dieser Uhrzeit wird auf den nächsten Tag umgeschaltet

const URLS = {
    TODAY: 'https://kephiso.webuntis.com/WebUntis/monitor?school=BBS%20Friesoythe&monitorType=subst&format=Vertretung%20heute',
    TOMORROW: 'https://kephiso.webuntis.com/WebUntis/monitor?school=BBS%20Friesoythe&monitorType=subst&format=Vertretung%20morgen'
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
 * Ermittelt das korrekte Datum basierend auf der Tageszeit
 * @returns {string} Datum im Format YYYY-MM-DD
 */
const getCorrectDate = () => {
    const now = new Date();
    if (now.getHours() >= SWITCH_HOUR) {
        now.setDate(now.getDate() + 1);
    }
    return now.toISOString().split('T')[0];
};

/**
 * Scrapt die Vertretungsdaten von WebUntis
 * @returns {Promise<{dataToday: Array, dataTomorrow: Array}>}
 */
const scrapeData = async () => {
    console.log("Scraping data...");
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        
        // Scrape für heute
        await page.goto(URLS.TODAY, { waitUntil: 'networkidle2' });
        const dataToday = await extractTableData(page);

        // Scrape für morgen
        await page.goto(URLS.TOMORROW, { waitUntil: 'networkidle2' });
        const dataTomorrow = await extractTableData(page);

        return { dataToday, dataTomorrow };
    } finally {
        await browser.close();
    }
};

/**
 * Extrahiert Tabellendaten von einer WebUntis-Seite
 * @param {Page} page - Puppeteer Page Objekt
 * @returns {Promise<Array>}
 */
const extractTableData = async (page) => {
    return page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        return rows.map(row => {
            const cells = row.querySelectorAll('td');
            return {
                kurs: cells[0]?.innerText || '',
                stunde: cells[2]?.innerText || '',
                raum: cells[3]?.innerText || '',
                lehrer: cells[4]?.innerText || '',
                typ: cells[5]?.innerText || '',
                notizen: cells[6]?.innerText || '',
            };
        });
    });
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
        const tomorrowDateStr = tomorrowDate.toISOString().split('T')[0];

        // Backup-Verzeichnisse erstellen
        const createBackup = (data, date) => {
            const backupDir = path.join(dataDir, `data_${date}`);
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            fs.writeFileSync(
                path.join(backupDir, 'data.json'),
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
        const tomorrowDateStr = tomorrowDate.toISOString().split('T')[0];
        
        const data = await getDataForDate(tomorrowDateStr);
        res.json(data);
    } catch (error) {
        console.error('Fehler beim Abrufen der Morgen-Daten:', error);
        res.status(500).send('Serverfehler beim Abrufen der Morgen-Daten');
    }
});

/**
 * Liest Vertretungsdaten für ein bestimmtes Datum
 * @param {string} date - Datum im Format YYYY-MM-DD
 * @returns {Promise<Object>}
 */
const getDataForDate = async (date) => {
    const tempFile = path.join(dataDir, `temp_${date}.json`);
    const backupDir = path.join(dataDir, `data_${date}`);
    const backupFile = path.join(backupDir, 'data.json');

    // Versuche zuerst die temporäre Datei zu lesen
    if (fs.existsSync(tempFile)) {
        return JSON.parse(fs.readFileSync(tempFile, 'utf8'));
    }

    // Wenn keine temporäre Datei existiert, versuche die Backup-Datei
    if (fs.existsSync(backupFile)) {
        return JSON.parse(fs.readFileSync(backupFile, 'utf8'));
    }

    // Wenn keine Datei existiert, hole neue Daten
    await saveTemporaryData();
    if (fs.existsSync(tempFile)) {
        return JSON.parse(fs.readFileSync(tempFile, 'utf8'));
    }

    throw new Error('Keine Daten verfügbar');
};

// Server starten
app.listen(PORT, () => {
    console.log(`Server läuft unter http://localhost:${PORT}`);
    scheduleBackup();
});

// Regelmäßige Aktualisierung der Daten
setInterval(saveTemporaryData, UPDATE_INTERVAL);
