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

app.use(cors());

// Statische Dateien bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// Funktion zum Scrapen und Speichern der Daten
const scrapeAndSaveData = async () => {
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

    // Speichere die gescrapten Daten in der JSON-Datei
    fs.writeFileSync('data.json', JSON.stringify({ data: dataToday, courses: [...new Set(dataToday.map(item => item.kurs))] }));
    fs.writeFileSync('morgen.json', JSON.stringify({ data: dataTomorrow, courses: [...new Set(dataTomorrow.map(item => item.kurs))] }));
};

// API-Endpunkt für die gescrapten Daten
app.get('/api/data', async (req, res) => {
    // Überprüfe, ob die Daten bereits in der JSON-Datei gespeichert sind
    if (fs.existsSync('data.json')) {
        // Lade die Daten aus der JSON-Datei
        const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
        return res.json(data);
    }

    // Wenn die Datei nicht existiert, scrape die Daten
    await scrapeAndSaveData(); // Scrape und speichere die Daten
    const data = JSON.parse(fs.readFileSync('data.json', 'utf8'));
    res.json(data);
});

// Aktualisiere die Daten alle 10 Minuten (600000 Millisekunden)
setInterval(scrapeAndSaveData, 60000); // 10 Minuten

// API-Endpunkt für die verfügbaren Kurse
app.get('/api/courses', async (req, res) => {
    // Diese Route kann entfernt werden, da die Kurse jetzt aus den gescrapten Daten extrahiert werden
    res.status(404).send('Nicht gefunden');
});

// Root-Endpunkt, der die HTML-Datei zurückgibt
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/morgen', async (req, res) => {
    if (fs.existsSync('morgen.json')) {
        const morgenData = JSON.parse(fs.readFileSync('morgen.json', 'utf8'));
        return res.json(morgenData);
    }
    res.status(404).send('Morgen-Daten nicht gefunden');
});

app.listen(port, () => {
    console.log(`Server läuft unter http://localhost:${port}`);
});
