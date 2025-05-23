// Konstanten
const API = {
    TODAY: '/api/data',
    TOMORROW: '/api/morgen',
    BOTH: '/api/both'
};

const STORAGE_KEYS = {
    SELECTED_COURSE: 'selectedCourse',
    SELECTED_VIEW: 'selectedView'
};

// DOM-Elemente werden nach dem vollständigen Laden der Seite initialisiert
let DOM = {};

document.addEventListener('DOMContentLoaded', () => {
    DOM = {
        date: document.getElementById('date'),
        todayButton: document.getElementById('todayButton'),
        tomorrowButton: document.getElementById('tomorrowButton'),
        allDaysButton: document.getElementById('allDaysButton'),
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
}

// Daten-Management
class DataManager {
    static allData = [];
    static currentSortColumn = null;
    static isAscending = true;
    static currentView = 'today'; // 'today', 'tomorrow', or 'both'

    static async fetchData(view = 'today') {
        try {
            const response = await fetch(
                view === 'today' ? API.TODAY : 
                view === 'tomorrow' ? API.TOMORROW : API.BOTH
            );
            if (!response.ok) throw new Error('Netzwerkantwort war nicht ok');
            
            const data = await response.json();
            // Filtere leere oder nur aus Leerzeichen bestehende Kurse
            this.allData = data.data.filter(item => item.kurs?.trim());
            this.currentView = view;
            return {
                data: this.allData,
                courses: data.courses.filter(Boolean).sort()
            };
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
    static updateDateDisplay(date, view = 'today') {
        if (view === 'both') {
            const today = DateManager.getCurrentDate();
            let tomorrow = DateManager.getTomorrowDate();
            
            // Ensure tomorrow is not a weekend
            if (DateManager.isWeekend(tomorrow)) {
                tomorrow = DateManager.getNextSchoolDay(today);
            }
            
            DOM.date.textContent = `${DateManager.formatDate(today)} und ${DateManager.formatDate(tomorrow)}`;
        } else {
            DOM.date.textContent = DateManager.formatDate(date);
        }

        // Zeige/Verstecke die Datumsspalte
        document.querySelectorAll('.date-column').forEach(el => {
            el.style.display = view === 'both' ? '' : 'none';
        });
    }

    static setActiveButton(view) {
        DOM.todayButton.classList.toggle('active', view === 'today');
        DOM.tomorrowButton.classList.toggle('active', view === 'tomorrow');
        DOM.allDaysButton.classList.toggle('active', view === 'both');
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
                <td class="date-column" ${DataManager.currentView !== 'both' ? 'style="display:none"' : ''}>
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
        const colspan = DataManager.currentView === 'both' ? 7 : 6;
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

    static saveSelectedView(view) {
        localStorage.setItem(STORAGE_KEYS.SELECTED_VIEW, view);
        this.updateUrlHash();
    }

    static loadSelectedCourse() {
        const hash = this.parseUrlHash();
        if (hash.course) {
            try {
                return decodeURIComponent(hash.course);
            } catch (e) {
                console.error("Fehler beim Dekodieren des Kurses aus Hash:", e);
                return hash.course; // Fallback, falls Dekodierung fehlschlägt
            }
        }
        return localStorage.getItem(STORAGE_KEYS.SELECTED_COURSE) || 'all';
    }

    static loadSelectedView() {
        const hash = this.parseUrlHash();
        if (hash.view) {
            return hash.view;
        }
        return localStorage.getItem(STORAGE_KEYS.SELECTED_VIEW) || 'today';
    }

    static parseUrlHash() {
        // Get hash without the leading #
        const hash = decodeURIComponent(window.location.hash.slice(1));
        console.log("Parsing hash:", hash);
        
        const parts = hash.split(';');
        const result = { course: null, view: null };
        
        parts.forEach(part => {
            if (part.startsWith('view=')) {
                result.view = part.split('=')[1];
            } else if (part) {
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
            const view = localStorage.getItem(STORAGE_KEYS.SELECTED_VIEW);
            let hash = '';

            if (course && course !== 'all') {
                hash = encodeURIComponent(course);
            }
            if (view && view !== 'today') {
                hash = hash ? `${hash};view=${view}` : `view=${view}`;
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
        // Add debug message on page load
        console.log("Initial URL hash:", window.location.hash);
        
        DOM.todayButton.addEventListener('click', () => this.handleDateChange('today'));
        DOM.tomorrowButton.addEventListener('click', () => this.handleDateChange('tomorrow'));
        DOM.allDaysButton.addEventListener('click', () => this.handleDateChange('both'));
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

        // Initial load - process hash directly
        const hashData = StorageManager.parseUrlHash();
        const initialView = hashData.view || 'today';

        // Load data for the selected view
        await this.handleDataLoad(initialView, hashData.course);
    }
    
    static async handleDataLoad(view, initialCourse = null) {
        try {
            UIManager.setActiveButton(view);
            if (view === 'both') {
                UIManager.updateDateDisplay(null, 'both');
            } else {
                UIManager.updateDateDisplay(
                    view === 'today' ? DateManager.getCurrentDate() : DateManager.getTomorrowDate(),
                    view
                );
            }

            // Fetch data
            const data = await DataManager.fetchData(view);
            UIManager.updateCourseFilter(data.courses);
            
            // Set course selection
            let courseToSelect = 'all';
            
            // First priority: URL hash course if specified
            if (initialCourse) {
                // Case insensitive match
                const matchingCourse = this.findCourseMatch(data.courses, initialCourse);
                if (matchingCourse) {
                    courseToSelect = matchingCourse;
                    console.log("Using course from hash:", courseToSelect);
                }
            } else {
                // Second priority: Stored course preference
                const savedCourse = localStorage.getItem(STORAGE_KEYS.SELECTED_COURSE);
                if (savedCourse && (data.courses.includes(savedCourse) || savedCourse === 'all')) {
                    courseToSelect = savedCourse;
                    console.log("Using saved course:", courseToSelect);
                }
            }
            
            // Set the selected course in UI and update data view
            DOM.courseFilter.value = courseToSelect;
            
            // Update storage without changing hash (if using hash value)
            if (initialCourse && courseToSelect !== 'all') {
                localStorage.setItem(STORAGE_KEYS.SELECTED_COURSE, courseToSelect);
            }
            
            // Update storage with view without changing hash
            localStorage.setItem(STORAGE_KEYS.SELECTED_VIEW, view);
            
            // Filter and render data
            const filteredData = DataManager.filterData(courseToSelect);
            UIManager.renderData(filteredData);
            
        } catch (error) {
            console.error('Fehler beim Laden der Daten:', error);
            UIManager.showMessage('Fehler beim Laden der Daten');
        }
    }

    static async handleDateChange(view) {
        try {
            // Save current course selection before changing views
            const currentCourse = DOM.courseFilter.value;
            
            // Update UI for the new view
            UIManager.setActiveButton(view);
            if (view === 'both') {
                UIManager.updateDateDisplay(null, 'both');
            } else {
                UIManager.updateDateDisplay(
                    view === 'today' ? DateManager.getCurrentDate() : DateManager.getTomorrowDate(),
                    view
                );
            }

            // Fetch new data for the selected view
            const data = await DataManager.fetchData(view);
            
            // Update the course filter dropdown with available courses
            UIManager.updateCourseFilter(data.courses);

            // Try to maintain the previously selected course if possible
            if (currentCourse !== 'all') {
                // Check if the previously selected course exists in the new view
                if (data.courses.includes(currentCourse)) {
                    DOM.courseFilter.value = currentCourse;
                } else {
                    // If course is not available in this view, use 'all'
                    DOM.courseFilter.value = 'all';
                    console.log(`Course ${currentCourse} not available in the ${view} view, reverting to all courses`);
                }
            }
            
            // Update storage and URL
            localStorage.setItem(STORAGE_KEYS.SELECTED_VIEW, view);
            StorageManager.updateUrlHash();
            
            // Update the displayed data
            this.handleCourseChange(false);
        } catch (error) {
            console.error('Fehler beim Laden der Daten:', error);
            UIManager.showMessage('Fehler beim Laden der Daten');
        }
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
            const view = hashData.view || 'today';
            
            // Direct handling of hash data for better reliability
            this.handleDataLoad(view, hashData.course);
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