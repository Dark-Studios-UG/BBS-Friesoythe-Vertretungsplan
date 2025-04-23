const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const puppeteer = require('puppeteer');
const fs = require('fs');

const app = express();
const port = 3000;

const urlToday = 'https://kephiso.webuntis.com/WebUntis/monitor?school=BBS%20Friesoythe&monitorType=subst&format=Vertretung%20heute';
const urlTomorrow = 'https://kephiso.webuntis.com/WebUntis/monitor?school=BBS%20Friesoythe&monitorType=subst&format=Vertretung%20morgen';

// Ensure directories exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

app.use(cors());

// Statische Dateien bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// Funktion zum Ermitteln des korrekten Datums (nach 17 Uhr ist es der nächste Tag)
const getCorrectDate = () => {
    const now = new Date();
    if (now.getHours() >= 17) {
        now.setDate(now.getDate() + 1);
    }
    return now.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
};

// Funktion zum Scrapen der Daten
const scrapeData = async () => {
    console.log("Scraping data...");
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
      
    const page = await browser.newPage();

    // Scrape für heute
    await page.goto(urlToday, { waitUntil: 'networkidle2' });
    const dataToday = await page.evaluate(() => {
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

    // Scrape für morgen
    await page.goto(urlTomorrow, { waitUntil: 'networkidle2' });
    const dataTomorrow = await page.evaluate(() => {
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

    await browser.close();
    return { dataToday, dataTomorrow };
};

// Funktion zum Speichern der temporären Daten
const saveTemporaryData = async () => {
    const { dataToday, dataTomorrow } = await scrapeData();
    const currentDate = getCorrectDate();
    const tomorrowDate = new Date(currentDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowDateStr = tomorrowDate.toISOString().split('T')[0];

    // Speichere temporäre Dateien direkt im data Ordner
    fs.writeFileSync(
        path.join(dataDir, `temp_${currentDate}.json`),
        JSON.stringify({ data: dataToday, courses: [...new Set(dataToday.map(item => item.kurs))] })
    );
    fs.writeFileSync(
        path.join(dataDir, `temp_${tomorrowDateStr}.json`),
        JSON.stringify({ data: dataTomorrow, courses: [...new Set(dataTomorrow.map(item => item.kurs))] })
    );
};

// Funktion zum Erstellen des täglichen Backups um 3 Uhr
const createDailyBackup = async () => {
    console.log("Creating daily backup...");
    const { dataToday, dataTomorrow } = await scrapeData();
    const currentDate = getCorrectDate();
    const tomorrowDate = new Date(currentDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowDateStr = tomorrowDate.toISOString().split('T')[0];

    // Erstelle Verzeichnisse für das aktuelle und morgige Datum
    const todayDir = path.join(dataDir, `data_${currentDate}`);
    const tomorrowDir = path.join(dataDir, `data_${tomorrowDateStr}`);

    if (!fs.existsSync(todayDir)) {
        fs.mkdirSync(todayDir, { recursive: true });
    }
    if (!fs.existsSync(tomorrowDir)) {
        fs.mkdirSync(tomorrowDir, { recursive: true });
    }

    // Speichere die Backup-Dateien
    fs.writeFileSync(
        path.join(todayDir, 'data.json'),
        JSON.stringify({ data: dataToday, courses: [...new Set(dataToday.map(item => item.kurs))] })
    );
    fs.writeFileSync(
        path.join(tomorrowDir, 'data.json'),
        JSON.stringify({ data: dataTomorrow, courses: [...new Set(dataTomorrow.map(item => item.kurs))] })
    );
};

// Plane das tägliche Backup für 3 Uhr morgens
const scheduleBackup = () => {
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setHours(3, 0, 0, 0);
    
    if (now >= nextRun) {
        nextRun.setDate(nextRun.getDate() + 1);
    }

    const timeUntilNextRun = nextRun - now;
    setTimeout(async () => {
        await createDailyBackup();
        // Plane das nächste Backup
        setInterval(createDailyBackup, 24 * 60 * 60 * 1000);
    }, timeUntilNextRun);
};

// Starte die Backup-Planung
scheduleBackup();

// API-Endpunkt für die gescrapten Daten
app.get('/api/data', async (req, res) => {
    const currentDate = getCorrectDate();
    const tempFile = path.join(dataDir, `temp_${currentDate}.json`);
    const backupDir = path.join(dataDir, `data_${currentDate}`);
    const backupFile = path.join(backupDir, 'data.json');

    try {
        // Versuche zuerst die temporäre Datei zu lesen
        if (fs.existsSync(tempFile)) {
            const data = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
            return res.json(data);
        }

        // Wenn keine temporäre Datei existiert, versuche die Backup-Datei zu lesen
        if (fs.existsSync(backupFile)) {
            const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
            return res.json(data);
        }

        // Wenn keine Datei existiert, hole neue Daten
        await saveTemporaryData();
        if (fs.existsSync(tempFile)) {
            const data = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
            return res.json(data);
        }

        res.status(404).send('Daten konnten nicht abgerufen werden');
    } catch (error) {
        console.error('Fehler beim Abrufen der Daten:', error);
        res.status(500).send('Serverfehler beim Abrufen der Daten');
    }
});

app.get('/api/morgen', async (req, res) => {
    const currentDate = getCorrectDate();
    const tomorrowDate = new Date(currentDate);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowDateStr = tomorrowDate.toISOString().split('T')[0];
    
    const tempFile = path.join(dataDir, `temp_${tomorrowDateStr}.json`);
    const backupDir = path.join(dataDir, `data_${tomorrowDateStr}`);
    const backupFile = path.join(backupDir, 'data.json');

    try {
        // Versuche zuerst die temporäre Datei zu lesen
        if (fs.existsSync(tempFile)) {
            const data = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
            return res.json(data);
        }

        // Wenn keine temporäre Datei existiert, versuche die Backup-Datei zu lesen
        if (fs.existsSync(backupFile)) {
            const data = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
            return res.json(data);
        }

        // Wenn keine Datei existiert, hole neue Daten
        await saveTemporaryData();
        if (fs.existsSync(tempFile)) {
            const data = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
            return res.json(data);
        }

        res.status(404).send('Morgen-Daten nicht gefunden');
    } catch (error) {
        console.error('Fehler beim Abrufen der Morgen-Daten:', error);
        res.status(500).send('Serverfehler beim Abrufen der Morgen-Daten');
    }
});

// Aktualisiere die temporären Daten alle 10 Minuten
setInterval(saveTemporaryData, 600000);

// Root-Endpunkt, der die HTML-Datei zurückgibt
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server läuft unter http://localhost:${port}`);
});
