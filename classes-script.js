// Classes Page Script - Standalone class grid functionality

// Global variables
let allClasses = [];
let filteredClasses = [];

// Google Sheets configuration
const GOOGLE_SHEET_ID = '1GFYV6qiAy8fUk8nDbbnHiiOL_jzADSWgZZuzVJ55JC0';

// Initialize when page loads
window.onload = function() {
    loadClassesFromGoogleSheets();
    setupFilters();
};

// Load classes from Google Sheets using API v4
async function loadClassesFromGoogleSheets() {
    try {
        showLoading(true);
        
        if (!GOOGLE_SHEET_ID) throw new Error('Google Sheet ID is not configured');
        
        const apiKey = window.appConfig?.googleApiKey;
        if (!apiKey || apiKey === '{{GOOGLE_API_KEY}}') {
            throw new Error('Google API key is not configured or not replaced during build');
        }

        // First, get sheet metadata to find all sheet names
        const metadataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}?key=${apiKey}&fields=sheets(properties(sheetId,title))`;
        
        console.log('Fetching sheet metadata...');
        const metadataResponse = await fetch(metadataUrl);
        
        if (!metadataResponse.ok) {
            throw new Error('Failed to fetch sheet metadata');
        }
        
        const metadata = await metadataResponse.json();
        const sheets = metadata.sheets || [];
        
        console.log('Available sheets:', sheets.map(s => s.properties.title));
        
        // Filter to only Monday through Saturday sheets
        const classSheets = sheets.filter(sheet => {
            const title = sheet.properties.title.toLowerCase();
            return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].includes(title);
        });
        
        console.log('Class sheets found:', classSheets.map(s => s.properties.title));
        
        // Load classes from all relevant sheets
        const allClassPromises = classSheets.map(sheet => 
            loadClassesFromSheet(sheet.properties.title, apiKey)
        );
        
        const classArrays = await Promise.all(allClassPromises);
        allClasses = classArrays.flat().filter(cls => cls && cls.name);
        
        console.log(`Loaded ${allClasses.length} classes total`);
        
        // Display all classes initially
        filteredClasses = [...allClasses];
        
        // Analyze age ranges and create buckets
        createAgeBuckets();
        displayClasses();
        
    } catch (error) {
        console.error('Error loading classes:', error);
        showError('Failed to load classes. Please try again later.');
    } finally {
        showLoading(false);
    }
}

// Load classes from a specific sheet
async function loadClassesFromSheet(sheetName, apiKey) {
    try {
        const range = `${sheetName}!A:F`; // A-F columns only
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}?key=${apiKey}`;
        
        console.log(`Loading classes from sheet: ${sheetName}`);
        const response = await fetch(url);
        
        if (!response.ok) {
            console.warn(`Failed to load sheet ${sheetName}:`, response.status);
            return [];
        }
        
        const data = await response.json();
        const rows = data.values || [];
        
        if (rows.length < 2) {
            console.warn(`Sheet ${sheetName} has insufficient data`);
            return [];
        }
        
        // Parse classes from rows (skip header row)
        const classes = [];
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            if (row.length >= 4 && row[0] && row[3]) { // Ensure name and time exist
                console.log('Raw row data:', row);
                const classObj = {
                    name: row[0] || '',           // A: Class Name
                    description: row[1] || '',    // B: Description  
                    performance: row[2] || '',    // C: Performance
                    time: row[3] || '',           // D: Time
                    ages: row[4] || 'All Ages',   // E: Ages
                    instructor: row[5] || '',     // F: Instructor
                    day: sheetName,
                    styles: extractDanceStyles(row[0] || ''),
                    ageBucket: parseAgeBucket(row[4] || 'All Ages')
                };
                console.log('Processed class:', classObj.name, 'ages:', classObj.ages, 'time:', classObj.time);
                classes.push(classObj);
            }
        }
        
        console.log(`Loaded ${classes.length} classes from ${sheetName}`);
        return classes;
        
    } catch (error) {
        console.error(`Error loading sheet ${sheetName}:`, error);
        return [];
    }
}

// Extract dance styles from class name
function extractDanceStyles(className) {
    const styles = [];
    const name = className.toLowerCase();
    
    if (name.includes('ballet')) styles.push('ballet');
    if (name.includes('jazz')) styles.push('jazz');
    if (name.includes('tap')) styles.push('tap');
    if (name.includes('hip hop') || name.includes('hip-hop')) styles.push('hip-hop');
    if (name.includes('contemporary')) styles.push('contemporary');
    if (name.includes('musical theater') || name.includes('musical theatre')) styles.push('musical-theater');
    if (name.includes('lyrical')) styles.push('lyrical');
    if (name.includes('acro')) styles.push('acro');
    
    return styles;
}

// Parse age range into buckets
function parseAgeBucket(ageString) {
    if (!ageString || ageString.trim() === '') {
        return 'all-ages';
    }
    
    const age = ageString.toLowerCase();
    
    // Extract numbers from age string
    const numbers = age.match(/\d+/g) || [];
    const minAge = numbers.length > 0 ? parseInt(numbers[0]) : 0;
    const maxAge = numbers.length > 1 ? parseInt(numbers[1]) : minAge;
    
    // Categorize into buckets based on age ranges
    if (age.includes('adult') || minAge >= 18) return 'adult';
    if (age.includes('teen') || minAge >= 13 || (minAge >= 12 && maxAge >= 15)) return 'teen';
    if (minAge >= 8 || (minAge >= 6 && maxAge >= 10)) return 'elementary';
    if (minAge >= 4 || (minAge >= 3 && maxAge >= 6)) return 'preschool';
    if (minAge >= 1 && minAge <= 3) return 'toddler';
    if (age.includes('all')) return 'all-ages';
    
    // Default categorization based on typical ranges
    if (maxAge <= 3) return 'toddler';
    if (maxAge <= 6) return 'preschool';
    if (maxAge <= 12) return 'elementary';
    if (maxAge <= 17) return 'teen';
    
    return 'all-ages';
}

// Create age buckets from all classes
function createAgeBuckets() {
    const buckets = new Set();
    
    allClasses.forEach(cls => {
        const bucket = parseAgeBucket(cls.ages);
        buckets.add(bucket);
        cls.ageBucket = bucket; // Add bucket to class object
    });
    
    console.log('Age buckets found:', Array.from(buckets));
    
    // Update age filter dropdown
    updateAgeFilterOptions(Array.from(buckets));
}

// Update age filter dropdown with buckets
function updateAgeFilterOptions(buckets) {
    const ageFilter = document.getElementById('age-filter');
    
    // Clear existing options except "All Ages"
    ageFilter.innerHTML = '<option value="">All Ages</option>';
    
    // Add bucket options in logical order
    const bucketOrder = ['toddler', 'preschool', 'elementary', 'teen', 'adult', 'all-ages'];
    const bucketLabels = {
        'toddler': 'Toddler (1-3)',
        'preschool': 'Preschool (4-6)', 
        'elementary': 'Elementary (7-12)',
        'teen': 'Teen (13-17)',
        'adult': 'Adult (18+)',
        'all-ages': 'All Ages'
    };
    
    bucketOrder.forEach(bucket => {
        if (buckets.includes(bucket)) {
            const option = document.createElement('option');
            option.value = bucket;
            option.textContent = bucketLabels[bucket];
            ageFilter.appendChild(option);
        }
    });
}

// Setup filter functionality
function setupFilters() {
    const ageFilter = document.getElementById('age-filter');
    const styleFilter = document.getElementById('style-filter');
    const dayFilter = document.getElementById('day-filter');
    const clearButton = document.getElementById('clear-filters');
    
    ageFilter.addEventListener('change', applyFilters);
    styleFilter.addEventListener('change', applyFilters);
    dayFilter.addEventListener('change', applyFilters);
    clearButton.addEventListener('click', clearFilters);
}

// Apply filters to classes
function applyFilters() {
    const ageFilter = document.getElementById('age-filter').value;
    const styleFilter = document.getElementById('style-filter').value;
    const dayFilter = document.getElementById('day-filter').value;
    
    filteredClasses = allClasses.filter(cls => {
        // Age filter - now using buckets
        if (ageFilter && cls.ageBucket !== ageFilter) {
            return false;
        }
        
        // Style filter
        if (styleFilter && !cls.styles.includes(styleFilter)) {
            return false;
        }
        
        // Day filter
        if (dayFilter && cls.day.toLowerCase() !== dayFilter.toLowerCase()) {
            return false;
        }
        
        return true;
    });
    
    displayClasses();
}

// Clear all filters
function clearFilters() {
    document.getElementById('age-filter').value = '';
    document.getElementById('style-filter').value = '';
    document.getElementById('day-filter').value = '';
    
    filteredClasses = [...allClasses];
    displayClasses();
}

// Display classes in grid
function displayClasses() {
    const grid = document.getElementById('classes-grid');
    
    if (filteredClasses.length === 0) {
        grid.innerHTML = `
            <div class="no-classes">
                <i class="fas fa-search"></i>
                <h3>No classes found</h3>
                <p>Try adjusting your filters to see more classes.</p>
            </div>
        `;
        return;
    }
    
    console.log('Sample class data:', filteredClasses[0]);
    
    grid.innerHTML = filteredClasses.map(cls => `
        <div class="class-card">
            <h3>${cls.name}</h3>
            <div class="class-info">
                <div class="class-info-item">
                    <i class="fas fa-clock"></i>
                    <span>${cls.time}</span>
                </div>
                <div class="class-info-item">
                    <i class="fas fa-calendar-day"></i>
                    <span>${cls.day}</span>
                </div>
                <div class="class-info-item">
                    <i class="fas fa-users"></i>
                    <span>${cls.ages}</span>
                </div>
                ${cls.instructor ? `
                    <div class="class-info-item">
                        <i class="fas fa-user"></i>
                        <span>${cls.instructor}</span>
                    </div>
                ` : ''}
                ${cls.level ? `
                    <div class="class-info-item">
                        <i class="fas fa-star"></i>
                        <span>${cls.level}</span>
                    </div>
                ` : ''}
                ${cls.duration ? `
                    <div class="class-info-item">
                        <i class="fas fa-hourglass-half"></i>
                        <span>${cls.duration}</span>
                    </div>
                ` : ''}
            </div>
            ${cls.description ? `
                <div class="class-description">
                    ${cls.description}
                </div>
            ` : ''}
        </div>
    `).join('');
}

// Show/hide loading indicator
function showLoading(show) {
    const loading = document.getElementById('loading');
    const grid = document.getElementById('classes-grid');
    
    if (show) {
        loading.style.display = 'block';
        grid.style.display = 'none';
    } else {
        loading.style.display = 'none';
        grid.style.display = 'grid';
    }
}

// Show error message
function showError(message) {
    const grid = document.getElementById('classes-grid');
    grid.innerHTML = `
        <div class="error-message">
            <i class="fas fa-exclamation-triangle"></i>
            <h3>Error</h3>
            <p>${message}</p>
            <button onclick="loadClassesFromGoogleSheets()" class="btn-secondary">Try Again</button>
        </div>
    `;
}
