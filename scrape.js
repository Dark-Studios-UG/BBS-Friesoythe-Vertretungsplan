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

// Add retry logic helper function
const retry = async (fn, retries = 3, delay = 5000) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) throw error;
            console.log(`Attempt ${i + 1} failed, retrying in ${delay/1000} seconds...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

// Add URL validation function
const validateUrl = async (page, url) => {
    try {
        console.log(`Attempting to access ${url}...`);
        const response = await page.goto(url, { 
            waitUntil: ['networkidle2', 'domcontentloaded'],
            timeout: 60000  // Increased timeout to 60 seconds
        });
        
        if (!response.ok()) {
            throw new Error(`HTTP ${response.status()} on ${url}`);
        }

        // Check if we got redirected to a login page or error page
        const currentUrl = page.url();
        if (currentUrl.includes('login') || currentUrl.includes('error')) {
            throw new Error(`Redirected to ${currentUrl}`);
        }

        console.log(`Successfully accessed ${url}`);
        return true;
    } catch (error) {
        console.error(`Failed to access ${url}:`, error);
        return false;
    }
};

/**
 * Scrapt die Vertretungsdaten von WebUntis
 * @returns {Promise<{dataToday: Array, dataTomorrow: Array}>}
 */
const scrapeData = async () => {
    console.log("Starting scraping process...");
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        // Erstelle zwei separate Pages für parallele Verarbeitung
        const [pageToday, pageTomorrow] = await Promise.all([
            browser.newPage(),
            browser.newPage()
        ]);

        // Konfiguriere beide Pages
        for (const page of [pageToday, pageTomorrow]) {
            page.setDefaultTimeout(60000); // 60 seconds timeout
            await page.setViewport({ width: 1920, height: 1080 });
            await page.setRequestInterception(true);
            
            // Optimize page loading
            page.on('request', (request) => {
                if (['image', 'stylesheet', 'font'].includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });
        }

        // Parallel scraping für heute und morgen
        console.log("Starting parallel scraping for today and tomorrow...");
        const [dataToday, dataTomorrow] = await Promise.all([
            // Scrape heute
            retry(async () => {
                console.log("Scraping today's data...");
                if (!await validateUrl(pageToday, URLS.TODAY)) {
                    throw new Error("Failed to access today's URL");
                }
                const data = await extractTableData(pageToday);
                console.log(`Found ${data.length} entries for today`);
                return data;
            }),
            // Scrape morgen
            retry(async () => {
                console.log("Scraping tomorrow's data...");
                if (!await validateUrl(pageTomorrow, URLS.TOMORROW)) {
                    throw new Error("Failed to access tomorrow's URL");
                }
                const data = await extractTableData(pageTomorrow);
                console.log(`Found ${data.length} entries for tomorrow`);
                return data;
            })
        ]);

        return { dataToday, dataTomorrow };
    } catch (error) {
        console.error("Error during scraping:", error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};

/**
 * Extrahiert Tabellendaten von einer WebUntis-Seite
 * @param {Page} page - Puppeteer Page Objekt
 * @returns {Promise<Array>}
 */
const extractTableData = async (page) => {
    try {
        // Wait for the table to be present
        await page.waitForSelector('table tbody tr', { timeout: 30000 });
        
        return page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('table tbody tr'));
            if (!rows.length) {
                console.log("No rows found in table");
                return [];
            }

            return rows.map(row => {
                const cells = Array.from(row.querySelectorAll('td'));
                if (cells.length < 7) {
                    console.log("Row has insufficient cells:", cells.length);
                    return null;
                }

                return {
                    kurs: cells[0]?.innerText?.trim() || '',
                    stunde: cells[2]?.innerText?.trim() || '',
                    raum: cells[3]?.innerText?.trim() || '',
                    lehrer: cells[4]?.innerText?.trim() || '',
                    typ: cells[5]?.innerText?.trim() || '',
                    notizen: cells[6]?.innerText?.trim() || '',
                };
            }).filter(Boolean); // Remove any null entries
        });
    } catch (error) {
        console.error("Error extracting table data:", error);
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
