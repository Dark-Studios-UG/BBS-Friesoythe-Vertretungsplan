const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const path = require('path');
const puppeteer = require('puppeteer');

const app = express();
const port = 3000;

const url = 'https://kephiso.webuntis.com/WebUntis/monitor?school=BBS%20Friesoythe&monitorType=subst&format=Vertretung%20heute';

app.use(cors());

// Statische Dateien bereitstellen
app.use(express.static(path.join(__dirname, 'public')));

// API-Endpunkt für die gescrapten Daten
app.get('/api/data', async (req, res) => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const data = await page.evaluate(() => {
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        return rows.map(row => {
            const cells = row.querySelectorAll('td');
            return {
                kurs: cells[0]?.innerText || '',
                stunde: cells[1]?.innerText || '',
                raum: cells[2]?.innerText || '',
                lehrer: cells[3]?.innerText || '',
                typ: cells[4]?.innerText || '',
                notizen: cells[5]?.innerText || '',
            };
        });
    });

    await browser.close();
    
    // Extrahiere die Kurse
    const courses = [...new Set(data.map(item => item.kurs))]; // Einzigartige Kurse

    // Sende die Daten und die Kurse zurück
    res.json({ data, courses });
});

// API-Endpunkt für die verfügbaren Kurse
app.get('/api/courses', async (req, res) => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });

    const courses = await page.evaluate(() => {
        const courseOptions = Array.from(document.querySelectorAll('select#courseFilter option'));
        return courseOptions.map(option => ({
            value: option.value,
            text: option.innerText
        }));
    });

    await browser.close();
    res.json(courses);
});

// Root-Endpunkt, der die HTML-Datei zurückgibt
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server läuft unter http://localhost:${port}`);
});
