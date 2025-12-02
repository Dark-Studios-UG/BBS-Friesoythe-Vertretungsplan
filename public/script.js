// Konstanten
const API = {
    DATE: '/api/date',
    BOTH: '/api/both',
    BOTH_DATES: '/api/both' // Für zwei spezifische Daten
};

const STORAGE_KEYS = {
    SELECTED_COURSE: 'selectedCourse',
    SELECTED_DATE: 'selectedDate'
};

// DOM-Elemente werden nach dem vollständigen Laden der Seite initialisiert
let DOM = {};

document.addEventListener('DOMContentLoaded', () => {
    DOM = {
        date: document.getElementById('date'),
        datePicker: document.getElementById('datePicker'),
        bothDaysButton: document.getElementById('bothDaysButton'),
        courseFilter: document.getElementById('courseFilter'),
        dataBody: document.getElementById('data-body')
    };

    // Anwendung starten
    EventHandler.init();
});

// Datum-Management
class DateManager {
    static SWITCH_HOUR = 17;

    static isWeekend(date) {
        const day = date.getDay();
        return day === 0 || day === 6; // 0 = Sonntag, 6 = Samstag
    }

    static getNextSchoolDay(date) {
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        while (this.isWeekend(nextDay)) {
            nextDay.setDate(nextDay.getDate() + 1);
        }
        return nextDay;
    }

    static getCurrentDate() {
        const today = new Date();
        if (today.getHours() >= this.SWITCH_HOUR) {
            // Wenn aktuelle Zeit nach SWITCH_HOUR ist und heute Wochenende, zum nächsten Schultag springen
            if (this.isWeekend(today)) {
                return this.getNextSchoolDay(today);
            }
            
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            
            // Wenn morgen Wochenende ist, zum nächsten Schultag springen
            if (this.isWeekend(tomorrow)) {
                return this.getNextSchoolDay(today);
            }
            
            return tomorrow;
        } else if (this.isWeekend(today)) {
            // Wenn heute Wochenende ist, zum nächsten Schultag springen
            return this.getNextSchoolDay(today);
        }
        return today;
    }

    static getTomorrowDate() {
        const tomorrow = new Date(this.getCurrentDate());
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Wenn morgen Wochenende ist, zum nächsten Schultag springen
        if (this.isWeekend(tomorrow)) {
            return this.getNextSchoolDay(tomorrow);
        }
        
        return tomorrow;
    }

    static formatDate(date) {
        const options = { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' };
        return date.toLocaleDateString('de-DE', options);
    }

    static formatDateShort(date) {
        const options = { weekday: 'long' };
        return date.toLocaleDateString('de-DE', options);
    }

    static formatDateFromString(dateStr) {
        const date = new Date(dateStr);
        return this.formatDateShort(date);
    }

    static dateToString(date) {
        // Konvertiert Date zu YYYY-MM-DD String
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    static stringToDate(dateStr) {
        // Konvertiert YYYY-MM-DD String zu Date
        return new Date(dateStr + 'T00:00:00');
    }

    static getDefaultDates() {
        // Gibt heute und morgen zurück (berücksichtigt 17 Uhr Regel)
        const today = this.getCurrentDate();
        const tomorrow = this.getTomorrowDate();
        return {
            today: this.dateToString(today),
            tomorrow: this.dateToString(tomorrow)
        };
    }
}

// Daten-Management
class DataManager {
    static allData = [];
    static currentSortColumn = null;
    static isAscending = true;
    static currentMode = 'both'; // 'single' oder 'both'
    static currentDate = null; // YYYY-MM-DD für single mode
    static currentDates = null; // {date1, date2} für both mode

    static async fetchDataForDate(date) {
        try {
            const response = await fetch(`${API.DATE}/${date}`);
            if (!response.ok) throw new Error('Netzwerkantwort war nicht ok');
            
            const data = await response.json();
            return {
                data: (data.data || []).filter(item => item.kurs?.trim()),
                courses: (data.courses || []).filter(Boolean).sort()
            };
        } catch (error) {
            console.error('Fehler beim Abrufen der Daten:', error);
            throw error;
        }
    }

    static async fetchDataForBothDates(date1, date2) {
        try {
            const response = await fetch(`${API.BOTH}/${date1}/${date2}`);
            if (!response.ok) throw new Error('Netzwerkantwort war nicht ok');
            
            const data = await response.json();
            return {
                data: (data.data || []).filter(item => item.kurs?.trim()),
                courses: (data.courses || []).filter(Boolean).sort()
            };
        } catch (error) {
            console.error('Fehler beim Abrufen der Daten:', error);
            throw error;
        }
    }

    static async fetchData(mode, dateOrDates) {
        try {
            let result;
            if (mode === 'both') {
                const { date1, date2 } = dateOrDates;
                result = await this.fetchDataForBothDates(date1, date2);
                this.currentMode = 'both';
                this.currentDates = { date1, date2 };
                this.currentDate = null;
            } else {
                result = await this.fetchDataForDate(dateOrDates);
                this.currentMode = 'single';
                this.currentDate = dateOrDates;
                this.currentDates = null;
            }
            
            this.allData = result.data;
            return result;
        } catch (error) {
            console.error('Fehler beim Abrufen der Daten:', error);
            throw error;
        }
    }

    static filterData(selectedCourse) {
        let filteredData = selectedCourse === 'all' 
            ? this.allData 
            : this.allData.filter(item => item.kurs.trim() === selectedCourse.trim());
        
        if (this.currentSortColumn) {
            filteredData = this.sortData(filteredData, this.currentSortColumn, this.isAscending);
        }
        
        return filteredData;
    }

    static sortData(data, column, ascending) {
        return [...data].sort((a, b) => {
            const aVal = (a[column] || '').toString().trim().toLowerCase();
            const bVal = (b[column] || '').toString().trim().toLowerCase();
            
            // Numerische Sortierung für die Stunde
            if (column === 'stunde') {
                const aNum = parseInt(aVal) || 0;
                const bNum = parseInt(bVal) || 0;
                return ascending ? aNum - bNum : bNum - aNum;
            }
            
            // Alphabetische Sortierung für andere Spalten
            return ascending 
                ? aVal.localeCompare(bVal) 
                : bVal.localeCompare(aVal);
        });
    }
}

// UI-Management
class UIManager {
    static updateDateDisplay(mode, dateOrDates) {
        if (mode === 'both') {
            const { date1, date2 } = dateOrDates;
            const date1Obj = DateManager.stringToDate(date1);
            const date2Obj = DateManager.stringToDate(date2);
            DOM.date.textContent = `${DateManager.formatDate(date1Obj)} und ${DateManager.formatDate(date2Obj)}`;
        } else {
            const dateObj = DateManager.stringToDate(dateOrDates);
            DOM.date.textContent = DateManager.formatDate(dateObj);
        }

        // Zeige/Verstecke die Datumsspalte
        document.querySelectorAll('.date-column').forEach(el => {
            el.style.display = mode === 'both' ? '' : 'none';
        });
    }

    static updateDatePicker(date) {
        if (date) {
            DOM.datePicker.value = date;
        } else {
            // Setze auf heutiges Datum (berücksichtigt 17 Uhr Regel)
            const today = DateManager.getCurrentDate();
            DOM.datePicker.value = DateManager.dateToString(today);
        }
    }

    static setBothDaysButtonActive(active) {
        DOM.bothDaysButton.classList.toggle('active', active);
    }

    static updateCourseFilter(courses) {
        DOM.courseFilter.innerHTML = '<option value="all">Wähle einen Kurs</option>';
        courses.sort().forEach(course => {
            const option = document.createElement('option');
            option.value = course;
            option.textContent = course;
            DOM.courseFilter.appendChild(option);
        });
    }

    static updateSortIndicators(column) {
        const headers = document.querySelectorAll('th');
        headers.forEach(header => {
            header.classList.remove('sorted-asc', 'sorted-desc');
            if (header.dataset.sort === column) {
                header.classList.add(
                    DataManager.isAscending ? 'sorted-asc' : 'sorted-desc'
                );
            }
        });
    }

    static renderData(data) {
        if (!data || data.length === 0) {
            this.showMessage('Keine Daten verfügbar');
            return;
        }

        DOM.dataBody.innerHTML = '';
        data.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.kurs || '-'}</td>
                <td class="date-column" ${DataManager.currentMode !== 'both' ? 'style="display:none"' : ''}>
                    ${item.datum ? DateManager.formatDateFromString(item.datum) : '-'}
                </td>
                <td>${item.stunde || '-'}</td>
                <td>${item.raum || '-'}</td>
                <td>${item.lehrer || '-'}</td>
                <td>${item.typ || '-'}</td>
                <td>${item.notizen || '-'}</td>
            `;
            DOM.dataBody.appendChild(row);
        });
    }

    static showMessage(message) {
        const colspan = DataManager.currentMode === 'both' ? 7 : 6;
        DOM.dataBody.innerHTML = `
            <tr>
                <td colspan="${colspan}" style="text-align: center; padding: 20px;">
                    ${message}
                </td>
            </tr>
        `;
    }
}

// Storage-Management
class StorageManager {
    static isUpdatingHash = false;

    static saveSelectedCourse(course) {
        localStorage.setItem(STORAGE_KEYS.SELECTED_COURSE, course);
        this.updateUrlHash();
    }

    static saveSelectedDate(date) {
        if (date) {
            localStorage.setItem(STORAGE_KEYS.SELECTED_DATE, date);
        } else {
            localStorage.removeItem(STORAGE_KEYS.SELECTED_DATE);
        }
        this.updateUrlHash();
    }

    static loadSelectedCourse() {
        const hash = this.parseUrlHash();
        if (hash.course) {
            try {
                return decodeURIComponent(hash.course);
            } catch (e) {
                console.error("Fehler beim Dekodieren des Kurses aus Hash:", e);
                return hash.course;
            }
        }
        return localStorage.getItem(STORAGE_KEYS.SELECTED_COURSE) || 'all';
    }

    static loadSelectedDate() {
        const hash = this.parseUrlHash();
        if (hash.date) {
            return hash.date;
        }
        return localStorage.getItem(STORAGE_KEYS.SELECTED_DATE) || null;
    }

    static parseUrlHash() {
        // Get hash without the leading #
        const hash = decodeURIComponent(window.location.hash.slice(1));
        console.log("Parsing hash:", hash);
        
        const parts = hash.split(';');
        const result = { course: null, date: null };
        
        parts.forEach(part => {
            if (part.startsWith('date=')) {
                result.date = part.split('=')[1];
            } else if (part && !part.includes('=')) {
                result.course = part;
            }
        });
        
        console.log("Parsed hash result:", result);
        return result;
    }

    static updateUrlHash() {
        if (this.isUpdatingHash) return;
        
        try {
            this.isUpdatingHash = true;
            
            const course = localStorage.getItem(STORAGE_KEYS.SELECTED_COURSE);
            const date = localStorage.getItem(STORAGE_KEYS.SELECTED_DATE);
            let hash = '';

            if (course && course !== 'all') {
                hash = encodeURIComponent(course);
            }
            if (date) {
                hash = hash ? `${hash};date=${date}` : `date=${date}`;
            }

            // Only update if hash actually changed
            const currentHash = window.location.hash.slice(1);
            if (currentHash !== hash) {
                console.log("Updating hash to:", hash);
                if (hash) {
                    history.replaceState(null, document.title, `#${hash}`);
                } else {
                    history.replaceState(null, document.title, window.location.pathname + window.location.search);
                }
            }
        } finally {
            this.isUpdatingHash = false;
        }
    }
}

// Event-Handler
class EventHandler {
    static isHandlingHashChange = false;
    
    static async init() {
        console.log("Initial URL hash:", window.location.hash);
        
        // Event-Listener für Datumauswahl
        DOM.datePicker.addEventListener('change', () => this.handleDatePickerChange());
        DOM.bothDaysButton.addEventListener('click', () => this.handleBothDaysClick());
        DOM.courseFilter.addEventListener('change', () => this.handleCourseChange());

        // Listen for hash changes
        window.addEventListener('hashchange', (e) => {
            console.log("Hash changed:", e.newURL);
            this.handleHashChange();
        });

        // Sortier-Event-Listener hinzufügen
        document.querySelectorAll('th[data-sort]').forEach(header => {
            header.addEventListener('click', () => this.handleSort(header.dataset.sort));
        });

        // Initial load - Standard: beide Tage (heute und morgen)
        const hashData = StorageManager.parseUrlHash();
        await this.handleInitialLoad(hashData);
    }

    static async handleInitialLoad(hashData) {
        const savedDate = StorageManager.loadSelectedDate();
        
        if (savedDate && hashData.date !== savedDate) {
            // Einzelnes Datum aus Hash oder Storage
            await this.loadSingleDate(savedDate, hashData.course);
        } else if (hashData.date) {
            // Datum aus Hash
            await this.loadSingleDate(hashData.date, hashData.course);
        } else {
            // Standard: beide Tage (heute und morgen)
            await this.loadBothDays(hashData.course);
        }
    }
    
    static async loadSingleDate(date, initialCourse = null) {
        try {
            UIManager.updateDatePicker(date);
            UIManager.setBothDaysButtonActive(false);
            UIManager.updateDateDisplay('single', date);

            // Fetch data
            const data = await DataManager.fetchData('single', date);
            UIManager.updateCourseFilter(data.courses);
            
            // Set course selection
            const courseToSelect = this.selectCourse(data.courses, initialCourse);
            DOM.courseFilter.value = courseToSelect;
            
            // Update storage
            StorageManager.saveSelectedDate(date);
            if (courseToSelect !== 'all') {
                StorageManager.saveSelectedCourse(courseToSelect);
            }
            
            // Filter and render data
            const filteredData = DataManager.filterData(courseToSelect);
            UIManager.renderData(filteredData);
            
        } catch (error) {
            console.error('Fehler beim Laden der Daten:', error);
            UIManager.showMessage('Fehler beim Laden der Daten');
        }
    }

    static async loadBothDays(initialCourse = null) {
        try {
            const defaultDates = DateManager.getDefaultDates();
            const dates = { date1: defaultDates.today, date2: defaultDates.tomorrow };
            UIManager.updateDatePicker(null); // Reset auf heutiges Datum
            UIManager.setBothDaysButtonActive(true);
            UIManager.updateDateDisplay('both', dates);

            // Fetch data
            const data = await DataManager.fetchData('both', dates);
            UIManager.updateCourseFilter(data.courses);
            
            // Set course selection
            const courseToSelect = this.selectCourse(data.courses, initialCourse);
            DOM.courseFilter.value = courseToSelect;
            
            // Update storage - kein einzelnes Datum gespeichert
            StorageManager.saveSelectedDate(null);
            if (courseToSelect !== 'all') {
                StorageManager.saveSelectedCourse(courseToSelect);
            }
            
            // Filter and render data
            const filteredData = DataManager.filterData(courseToSelect);
            UIManager.renderData(filteredData);
            
        } catch (error) {
            console.error('Fehler beim Laden der Daten:', error);
            UIManager.showMessage('Fehler beim Laden der Daten');
        }
    }

    static selectCourse(availableCourses, initialCourse) {
        let courseToSelect = 'all';
        
        // First priority: URL hash course if specified
        if (initialCourse) {
            const matchingCourse = this.findCourseMatch(availableCourses, initialCourse);
            if (matchingCourse) {
                courseToSelect = matchingCourse;
                console.log("Using course from hash:", courseToSelect);
            }
        } else {
            // Second priority: Stored course preference
            const savedCourse = localStorage.getItem(STORAGE_KEYS.SELECTED_COURSE);
            if (savedCourse && (availableCourses.includes(savedCourse) || savedCourse === 'all')) {
                courseToSelect = savedCourse;
                console.log("Using saved course:", courseToSelect);
            }
        }
        
        return courseToSelect;
    }

    static handleDatePickerChange() {
        const selectedDate = DOM.datePicker.value;
        if (selectedDate) {
            const hashData = StorageManager.parseUrlHash();
            this.loadSingleDate(selectedDate, hashData.course);
        }
    }

    static handleBothDaysClick() {
        const hashData = StorageManager.parseUrlHash();
        this.loadBothDays(hashData.course);
    }

    static handleCourseChange(updateHash = true) {
        const selectedCourse = DOM.courseFilter.value;
        
        // Nur URL-Hash aktualisieren, wenn dies explizit angefordert wird
        if (updateHash) {
            localStorage.setItem(STORAGE_KEYS.SELECTED_COURSE, selectedCourse);
            StorageManager.updateUrlHash();
        }
        
        const filteredData = DataManager.filterData(selectedCourse);
        UIManager.renderData(filteredData);
    }

    static handleHashChange() {
        if (this.isHandlingHashChange) return;
        
        try {
            this.isHandlingHashChange = true;
            
            const hashData = StorageManager.parseUrlHash();
            
            if (hashData.date) {
                // Einzelnes Datum aus Hash
                this.loadSingleDate(hashData.date, hashData.course);
            } else {
                // Standard: beide Tage
                this.loadBothDays(hashData.course);
            }
        } finally {
            this.isHandlingHashChange = false;
        }
    }
    
    // Case-insensitive matching for course selection
    static findCourseMatch(availableCourses, targetCourse) {
        if (!targetCourse) return null;
        
        // Try direct match first
        if (availableCourses.includes(targetCourse)) {
            return targetCourse;
        }
        
        // Try case-insensitive match
        const lowercaseTarget = targetCourse.toLowerCase();
        const match = availableCourses.find(course => 
            course.toLowerCase() === lowercaseTarget);
        
        return match || null;
    }

    static handleSort(column) {
        if (DataManager.currentSortColumn === column) {
            DataManager.isAscending = !DataManager.isAscending;
        } else {
            DataManager.currentSortColumn = column;
            DataManager.isAscending = true;
        }

        UIManager.updateSortIndicators(column);
        this.handleCourseChange();
    }
} 