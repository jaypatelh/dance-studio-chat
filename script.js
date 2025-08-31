// Configuration
const GROQ_API_KEY = window.appConfig?.groqApiKey || '';
const GOOGLE_API_KEY = window.appConfig?.googleApiKey || '';
// Google Sheet ID from the URL: https://docs.google.com/spreadsheets/d/1GFYV6qiAy8fUk8nDbbnHiiOL_jzADSWgZZuzVJ55JC0/edit
const GOOGLE_SHEET_ID = '1GFYV6qiAy8fUk8nDbbnHiiOL_jzADSWgZZuzVJ55JC0';

// DOM Elements
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const chatMessages = document.getElementById('chat-messages');

// Control whether the chat auto-scrolls
const AUTO_SCROLL = false;

// Store all classes and availability data
let allClasses = [];
let ownerAvailability = {};

// Track conversation state
const conversationState = {
    conversationHistory: [],
    userPreferences: {
        age: null,
        style: null,
        dayPreference: null
    },
    currentClasses: [],
    waitingForBookingConfirmation: false,
    waitingForBookingInfo: false,
    phone: ''
};

// Store booking info
let bookingInfo = {
    name: '',
    email: '',
    phone: ''
};

// Force reload classes from Google Sheets
function reloadClasses() {
    console.log('Forcing reload of classes...');
    loadClassesFromGoogleSheets();
    return false; // Prevent default form submission
}

// Initialize the chat when the page loads
window.onload = function() {
    loadClassesFromGoogleSheets();
    loadOwnerAvailability();
    loadCalendly(); // Load Calendly script
    
    // Add welcome message after a short delay
    setTimeout(() => {
        const welcomeMessage = [
            "👋 Hi! To get started, what's your child's age?"
        ].join('\n');
        
        // Initialize conversation history with welcome message
        conversationState.conversationHistory.push({
            role: 'assistant',
            content: welcomeMessage
        });
        addBotMessage(welcomeMessage);
    }, 500); // Short delay to ensure classes are loaded
};

// Handle user responses with LLM-driven conversation
async function processUserResponse(message, event) {
    // Handle "Search again" button click
    if (event && event.target && event.target.classList.contains('search-again')) {
        conversationState.conversationHistory = [];
        conversationState.userPreferences = { age: null, style: null, dayPreference: null };
        conversationState.currentClasses = [];
        addBotMessage("Let's find more classes! What's your child's age?");
        return;
    }

    // Handle booking confirmation
    if (conversationState.waitingForBookingConfirmation) {
        if (message.toLowerCase().includes('yes') || message.toLowerCase().includes('sure') || message === 'y') {
            // Handle booking confirmation logic here
        }
        conversationState.waitingForBookingConfirmation = false;
        return;
    }
    
    // Handle booking info submission (handled by Calendly)
    if (conversationState.waitingForBookingInfo) {
        // This is handled by the form, not text input
        return;
    }
    
    // Add user message to conversation history
    conversationState.conversationHistory.push({
        role: 'user',
        content: message
    });
    
    // Show loading indicator
    const loadingId = showLoadingIndicator("Thinking...");
    
    try {
        // Get response from conversation management LLM
        const response = await getConversationResponse(message, conversationState);
        
        // Handle the response based on its action
        if (response.action === 'get_classes') {
            // Only call class recommendation LLM if we have age and preferences have changed
            const hasAge = response.preferences && response.preferences.age;
            const preferencesChanged = !conversationState.userPreferences || 
                JSON.stringify(conversationState.userPreferences) !== JSON.stringify(response.preferences);
            
            if (hasAge && preferencesChanged) {
                // Show loading message for class search
                const retryLoadingId = showLoadingIndicator("Searching for classes...");
                
                try {
                    // Extract preferences and get class recommendations
                    const classes = await getClassRecommendations(response.preferences);
                    conversationState.currentClasses = classes;
                    conversationState.userPreferences = response.preferences;
                    
                    removeLoadingIndicator(retryLoadingId);
                    
                    if (classes.length > 0) {
                        const matchType = classes[0]?.matchType || 'direct';
                        // Use the LLM's explanation text which now includes compromise details for closest matches
                        const messageText = classes[0]?.text || (matchType === 'direct' 
                            ? "Here are some classes that match your preferences:"
                            : "I found some similar classes that might work:");
                        
                        addBotMessage(messageText, classes);
                    } else {
                        addBotMessage(response.message || "I couldn't find any classes that match your preferences. Would you like to schedule a call with our studio owner to discuss options?");
                    }
                    
                    displayAllClasses();
                } catch (classError) {
                    removeLoadingIndicator(retryLoadingId);
                    addBotMessage("I'm having trouble accessing our class database right now. Please try again in a moment, or schedule a call with our studio owner for immediate assistance.");
                }
            } else if (!hasAge) {
                // No age provided, just show the conversation response
                addBotMessage(response.message);
            } else {
                // Preferences haven't changed, show existing classes
                addBotMessage(response.message);
                if (conversationState.currentClasses.length > 0) {
                    displayAllClasses();
                }
            }
        } else if (response.action === 'refine_classes') {
            // Show loading for class refinement
            const refineLoadingId = showLoadingIndicator("Finding updated classes...");
            
            try {
                // Refine existing class suggestions
                const refinedClasses = await refineClassSuggestions(response.preferences, conversationState.currentClasses);
                conversationState.currentClasses = refinedClasses;
                conversationState.userPreferences = { ...conversationState.userPreferences, ...response.preferences };
                
                removeLoadingIndicator(refineLoadingId);
                
                if (refinedClasses.length > 0) {
                    // Use the LLM's explanation text for refined classes too
                    const messageText = refinedClasses[0]?.text || response.message || "Here are the updated class suggestions:";
                    addBotMessage(messageText, refinedClasses);
                    displayAllClasses();
                } else {
                    addBotMessage(response.message || "I couldn't find classes matching those specific requirements. Would you like to schedule a call to discuss other options?");
                }
            } catch (refineError) {
                removeLoadingIndicator(refineLoadingId);
                addBotMessage("I'm having trouble updating the class suggestions right now. Please try again in a moment.");
            }
        } else if (response.action === 'schedule_call') {
            // Suggest scheduling a call
            addBotMessage(response.message);
        } else {
            // Regular conversation response
            addBotMessage(response.message || 'Sorry, I encountered an error. Please try again.');
        }
        
        // Add assistant response to conversation history (only if message exists)
        if (response.message) {
            conversationState.conversationHistory.push({
                role: 'assistant',
                content: response.message
            });
        }
        
    } catch (error) {
        console.error('Error processing conversation:', error);
        addBotMessage("I'm experiencing some technical difficulties. Please try again in a moment, or feel free to schedule a call with our studio owner for immediate assistance.");
    } finally {
        removeLoadingIndicator(loadingId);
    }
}

// Get class recommendations from LLM based on user preferences
async function getClassRecommendations(prefs) {
    try {
            
        // Prepare class data with unique identifiers, filtering out empty classes
        const classData = allClasses
            .filter(cls => cls.name && cls.name.trim()) // Only include classes with valid names
            .map((cls, index) => ({
                id: `class_${index}`, // Unique identifier
                name: cls.name.trim(),
                description: cls.description || 'No description available',
                ageRange: cls.ageRange || 'All ages',
                day: cls.day || 'Not specified',
                time: cls.time || 'Time TBD',
                instructor: cls.instructor || 'TBD',
                performance: cls.performance || '',
                level: cls.level || ''
            }));
        
            
        // Call the LLM with the preferences and class data
        const response = await callGroqAPI(JSON.stringify({
            task: 'recommend_classes',
            preferences: prefs,
            availableClasses: classData
        }));

        
        // Handle the LLM response
        if (response && response.classes && Array.isArray(response.classes)) {
                
            // Map class IDs back to full class objects using the same mapping as sent to LLM
            const classDataMap = {};
            classData.forEach(cls => {
                classDataMap[cls.id] = cls;
            });
            
                
            // Map back to original allClasses objects using direct ID lookup
            const recommendedClasses = response.classes
                .map(classId => {
                    const classFromLLM = classDataMap[classId];
                    if (!classFromLLM) {
                        console.warn(`Class ID ${classId} not found in map`);
                        return null;
                    }
                    
                    
                    const classIndex = parseInt(classId.replace('class_', ''));
                    const originalClass = allClasses[classIndex];
                    
                    if (!originalClass) {
                        console.warn(`Original class at index ${classIndex} not found`);
                        return classFromLLM; // Fallback to LLM data
                    }
                    return originalClass;
                })
                .filter(Boolean); // Remove any undefined entries
                
                
            // Add match type to the classes for UI display
            const classesWithMatchType = recommendedClasses.map(cls => ({
                ...cls,
                matchType: response.matchType || 'direct'
            }));
            
            return classesWithMatchType;
        }
        
        console.warn('No valid classes found in LLM response');
        return [];
    } catch (error) {
        console.error('Error getting recommendations:', error);
        return [];
    }
}

// Extract sheet ID from URL
function extractSheetId(url) {
    const match = url.match(/[\w-]{20,}/);
    return match ? match[0] : null;
}

// Fetch and parse data from a specific sheet
async function fetchAndParseSheet(sheetId, sheetName, apiKey) {
    console.log(`Fetching sheet: ${sheetName}`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}!A:Z?key=${apiKey}`;
    console.log('Request URL:', url);
    
    try {
        const response = await fetch(url);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response:', errorText);
            throw new Error(`Failed to fetch sheet: ${sheetName}. Status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Raw data from API:', data);
        
        if (!data.values || data.values.length <= 1) {
            console.log(`No data found in sheet: ${sheetName}`);
            return [];
        }

        const classes = [];
        console.log('Headers:', data.values[0]);
        
        // Process each row (skip header)
        for (let i = 1; i < data.values.length; i++) {
            const row = data.values[i];
            console.log(`Processing row ${i}:`, row);
            
            if (!row || row.length === 0) {
                console.log('Skipping empty row');
                continue;
            }
            
            // Skip rows that don't have a class name in the first column
            if (!row[0]?.toString().trim()) {
                console.log('Skipping row - no class name');
                continue;
            }
            
            // Map columns by position
            const classData = {
                name: (row[0] || '').toString().trim(),
                description: (row[1] || '').toString().trim(),
                performance: (row[2] || '').toString().trim(),
                time: (row[3] || '').toString().trim(),
                ageRange: (row[4] || '').toString().trim(),
                instructor: (row[5] || '').toString().trim(),
                day: sheetName
            };
            
            console.log('Processed class data:', classData);
            
            // Clean up the time format if needed
            if (classData.time) {
                classData.time = classData.time.split(' ').pop();
                console.log('Cleaned time:', classData.time);
            }
            
            classes.push(classData);
        }
        
        console.log(`Found ${classes.length} classes in ${sheetName}`, classes);
        return classes;
    } catch (error) {
        console.error(`Error processing sheet ${sheetName}:`, error);
        throw error;
    }
}

// Fetch all week data
async function fetchAllWeekData(sheetId, apiKey) {
    try {
        // Try to fetch from Google Sheets first
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        let allClasses = [];
        
        // Fetch data for each day
        for (const day of days) {
            try {
                const dayData = await fetchAndParseSheet(sheetId, day, apiKey);
                allClasses = [...allClasses, ...dayData];
            } catch (error) {
                console.warn(`Skipping ${day}:`, error.message);
                // If we can't fetch any data, return sample data
                if (allClasses.length === 0 && day === days[days.length - 1]) {
                    throw new Error('Could not fetch any class data');
                }
            }
        }
        
        return allClasses.length > 0 ? allClasses : getSampleData();
    } catch (error) {
        console.error('Error fetching week data, using sample data instead:', error);
        return getSampleData();
    }
}

// Get sample class data
function getSampleData() {
    return [
        {
            name: "Tiny Dancers",
            ageRange: "3-5",
            day: "Monday",
            time: "10:00 AM",
            level: "Beginner",
            description: "Introduction to movement and music for our youngest dancers."
        },
        {
            name: "Ballet Basics",
            ageRange: "5-7",
            day: "Tuesday",
            time: "4:00 PM",
            level: "Beginner",
            description: "Learn the fundamentals of ballet in a fun and supportive environment."
        },
        {
            name: "Hip Hop Kids",
            ageRange: "6-9",
            day: "Wednesday",
            time: "5:00 PM",
            level: "All Levels",
            description: "High-energy class teaching hip hop basics and choreography."
        },
        {
            name: "Advanced Contemporary",
            ageRange: "12-18",
            day: "Friday",
            time: "6:30 PM",
            level: "Advanced",
            description: "For experienced dancers to explore contemporary techniques."
        }
    ];
}

// Display all classes in accordion format grouped by day
function displayAllClasses() {
    const grid = document.getElementById('class-grid');
    
    if (!grid) {
        console.error('Class grid element not found!');
        return;
    }
    
    // Clear existing content
    grid.innerHTML = '';
    
    if (allClasses.length === 0) {
        console.log('No classes to display');
        grid.innerHTML = '<p>No classes available at the moment.</p>';
        return;
    }
    
    // Group classes by day
    const classesByDay = {};
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    // Initialize all days
    dayOrder.forEach(day => {
        classesByDay[day] = [];
    });
    
    // Group classes
    allClasses.forEach(cls => {
        const day = cls.day || 'Unknown';
        if (classesByDay[day]) {
            classesByDay[day].push(cls);
        }
    });
    
    // Create accordion structure
    grid.innerHTML = '<div class="classes-accordion"></div>';
    const accordion = grid.querySelector('.classes-accordion');
    
    dayOrder.forEach(day => {
        const dayClasses = classesByDay[day];
        if (dayClasses.length === 0) return; // Skip days with no classes
        
        const daySection = document.createElement('div');
        daySection.className = 'accordion-section';
        
        daySection.innerHTML = `
            <div class="accordion-header" data-day="${day}">
                <h3>${day}</h3>
                <span class="class-count">${dayClasses.length} class${dayClasses.length !== 1 ? 'es' : ''}</span>
                <span class="accordion-toggle">▼</span>
            </div>
            <div class="accordion-content">
                <div class="day-classes-grid"></div>
            </div>
        `;
        
        const classesGrid = daySection.querySelector('.day-classes-grid');
        
        // Add classes for this day
        dayClasses.forEach(cls => {
            try {
                const card = createClassCard(cls);
                if (card) {
                    classesGrid.appendChild(card);
                }
            } catch (error) {
                console.error('Error creating class card:', error, 'Class data:', cls);
            }
        });
        
        accordion.appendChild(daySection);
    });
    
    // Add click handlers for accordion
    setupAccordionHandlers();
}

// Setup accordion click handlers
function setupAccordionHandlers() {
    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', () => {
            const section = header.parentElement;
            const content = section.querySelector('.accordion-content');
            const toggle = header.querySelector('.accordion-toggle');
            
            // Toggle this section
            const isOpen = section.classList.contains('open');
            
            if (isOpen) {
                section.classList.remove('open');
                content.style.maxHeight = '0';
                toggle.textContent = '▼';
            } else {
                section.classList.add('open');
                content.style.maxHeight = content.scrollHeight + 'px';
                toggle.textContent = '▲';
            }
        });
    });
}

// Process sheet data from Google Sheets
function processSheetData(rows) {
    console.log('Processing sheet data:', rows);
    const classes = [];
    
    // Process data rows (skip header row)
    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row.c) continue;
        
        // Extract cell values with null checks
        const getCellValue = (index) => {
            return row.c[index]?.v?.toString().trim() || '';
        };
        
        // Handle age range specially to handle date formatting
        const getAgeRange = () => {
            const ageCell = row.c[4];
            if (!ageCell) return '';
            // Use formatted value if available (e.g., '4-6'), otherwise use raw value
            return ageCell.f || ageCell.v?.toString().trim() || '';
        };
        
        const classData = {
            name: getCellValue(0),
            description: getCellValue(1),
            performance: getCellValue(2),
            time: getCellValue(3),
            ageRange: getAgeRange(),
            instructor: getCellValue(5),
            day: '' // Will be set by the calling function
        };
        
        // Clean up time format
        if (classData.time) {
            classData.time = classData.time.split(' ')[0]; // Take only the time part
        }
        
        console.log('Processed class:', classData);
        
        // Only add if we have a class name
        if (classData.name) {
            classes.push(classData);
        }
    }
    
    console.log('Total classes processed:', classes.length);
    return classes;
}

// Extract sheet ID from URL
function extractSheetId(url) {
    const match = url.match(/[\/\-][\w-]{30,}(?=\?|$)/);
    return match ? match[0].substring(1) : null;
}

// Load classes from Google Sheets using API v4
async function loadClassesFromGoogleSheets() {
    try {
            
        if (!GOOGLE_SHEET_ID) throw new Error('Google Sheet ID is not configured');
        
        // First, get the list of all sheets in the document
        const sheetsResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}?key=${GOOGLE_API_KEY}&fields=sheets(properties(sheetId,title))`
        );
        
        if (!sheetsResponse.ok) {
            throw new Error('Failed to fetch sheet metadata');
        }
        
        const { sheets } = await sheetsResponse.json();
        const daySheets = sheets
            .map(sheet => sheet.properties)
            .filter(sheet => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                .includes(sheet.title));
        
        // Fetch data from each sheet in parallel
        const sheetPromises = daySheets.map(async (sheet) => {
            const response = await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(sheet.title)}!A:F?key=${GOOGLE_API_KEY}`
            );
            
            if (!response.ok) {
                console.warn(`Failed to fetch ${sheet.title} data`);
                return [];
            }
            
            const { values } = await response.json();
            if (!values || values.length < 2) return [];
            
            // Skip the header row and process each class row
            return values.slice(1).map(row => {
                // Ensure we have at least 6 columns (A-F) as per the sheet structure
                const [className, description, performance, time, ages, instructor] = row.map(cell => cell ? cell.trim() : '');
                
                // Only include classes with a name
                if (!className) return null;
                
                return {
                    day: sheet.title,
                    name: className,
                    description: description || 'No description available',
                    performance: performance || '',
                    time: time || 'TBD',
                    ageRange: ages || 'All ages',
                    instructor: instructor || 'TBD'
                };
            }).filter(Boolean); // Remove any null entries
        });
        
        const allDayClasses = await Promise.all(sheetPromises);
        allClasses = allDayClasses.flat();
        
        displayAllClasses();
        
    } catch (error) {
        console.error('Error loading classes:', error);
        allClasses = getSampleData();
        displayAllClasses();
        addBotMessage("Error loading class data. Showing sample data instead.");
    }
}

// Load owner availability from Google Sheets
async function loadOwnerAvailability() {
    try {
            
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/Call%20Availabilities!A:B?key=${GOOGLE_API_KEY}`
        );
        
        if (!response.ok) {
            throw new Error('Failed to fetch availability data');
        }
        
        const { values } = await response.json();
        if (!values || values.length < 2) {
            console.warn('No availability data found');
            return;
        }
        
        // Parse availability data (skip header row)
        ownerAvailability = {};
        values.slice(1).forEach(row => {
            const [day, times] = row;
            if (day && times) {
                ownerAvailability[day.toLowerCase()] = times.toLowerCase() === 'none' ? [] : times.split(',').map(t => t.trim());
            }
        });
        
            
        // Update calendar configuration with dynamic availability
        updateCalendarAvailability();
        
    } catch (error) {
        console.error('Error loading owner availability:', error);
        // Keep default availability if loading fails
    }
}

// Update calendar configuration based on owner availability
function updateCalendarAvailability() {
    const dayMap = {
        'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3, 
        'thursday': 4, 'friday': 5, 'saturday': 6
    };
    
    // Clear existing slots and ensure daysToShow is set
    window.calendarConfig = window.calendarConfig || {};
    window.calendarConfig.availableSlots = [];
    window.calendarConfig.daysToShow = 7;
    
    // Generate slots based on owner availability
    Object.keys(ownerAvailability).forEach(dayName => {
        const dayNumber = dayMap[dayName];
        const times = ownerAvailability[dayName];
        
        if (dayNumber !== undefined && times.length > 0) {
            times.forEach(timeStr => {
                // Parse time string (e.g., "2:00 PM" or "14:00" or "9:00 AM - 12:00 PM")
                const slots = parseTimeSlot(timeStr, dayNumber);
                if (slots) {
                    // Handle both single slots and arrays of slots (from ranges)
                    if (Array.isArray(slots)) {
                        window.calendarConfig.availableSlots.push(...slots);
                    } else {
                        window.calendarConfig.availableSlots.push(slots);
                    }
                }
            });
        }
    });
    
}

// Parse time slot from string format (supports ranges and individual times)
function parseTimeSlot(timeStr, dayNumber) {
    try {
        // Check if it's a time range (e.g., "9:00 AM - 12:00 PM")
        if (timeStr.includes(' - ')) {
            return parseTimeRange(timeStr, dayNumber);
        }
        
        // Handle individual time slots
        let time24, label;
        
        if (timeStr.includes('am') || timeStr.includes('pm')) {
            // 12-hour format (e.g., "2:00 PM")
            const [time, period] = timeStr.split(/\s*(am|pm)\s*/i);
            let [hours, minutes = '00'] = time.split(':');
            hours = parseInt(hours);
            
            if (period.toLowerCase() === 'pm' && hours !== 12) {
                hours += 12;
            } else if (period.toLowerCase() === 'am' && hours === 12) {
                hours = 0;
            }
            
            time24 = `${hours.toString().padStart(2, '0')}:${minutes.padStart(2, '0')}`;
            label = timeStr;
        } else {
            // 24-hour format (e.g., "14:00")
            time24 = timeStr;
            const [hours, minutes] = timeStr.split(':');
            const hour12 = parseInt(hours) > 12 ? parseInt(hours) - 12 : parseInt(hours);
            const period = parseInt(hours) >= 12 ? 'PM' : 'AM';
            label = `${hour12}:${minutes} ${period}`;
        }
        
        return {
            day: [dayNumber],
            time: time24,
            label: label
        };
    } catch (error) {
        console.error('Error parsing time slot:', timeStr, error);
        return null;
    }
}

// Parse time range and generate 10-minute slots
function parseTimeRange(rangeStr, dayNumber) {
    try {
        const [startStr, endStr] = rangeStr.split(' - ').map(s => s.trim());
        
        const startTime = parseTimeString(startStr);
        const endTime = parseTimeString(endStr);
        
        if (!startTime || !endTime) {
            console.error('Could not parse time range:', rangeStr);
            return null;
        }
        
        // Generate 10-minute slots between start and end time
        const slots = [];
        let currentTime = new Date();
        currentTime.setHours(startTime.hours, startTime.minutes, 0, 0);
        
        const endDateTime = new Date();
        endDateTime.setHours(endTime.hours, endTime.minutes, 0, 0);
        
        while (currentTime < endDateTime) {
            const time24 = `${currentTime.getHours().toString().padStart(2, '0')}:${currentTime.getMinutes().toString().padStart(2, '0')}`;
            const hour12 = currentTime.getHours() > 12 ? currentTime.getHours() - 12 : (currentTime.getHours() === 0 ? 12 : currentTime.getHours());
            const period = currentTime.getHours() >= 12 ? 'PM' : 'AM';
            const label = `${hour12}:${currentTime.getMinutes().toString().padStart(2, '0')} ${period}`;
            
            slots.push({
                day: [dayNumber],
                time: time24,
                label: label
            });
            
            // Add 10 minutes
            currentTime.setMinutes(currentTime.getMinutes() + 10);
        }
        
        return slots;
    } catch (error) {
        console.error('Error parsing time range:', rangeStr, error);
        return null;
    }
}

// Helper function to parse individual time strings
function parseTimeString(timeStr) {
    try {
        if (timeStr.includes('am') || timeStr.includes('pm')) {
            // 12-hour format
            const [time, period] = timeStr.split(/\s*(am|pm)\s*/i);
            let [hours, minutes = '00'] = time.split(':');
            hours = parseInt(hours);
            minutes = parseInt(minutes);
            
            if (period.toLowerCase() === 'pm' && hours !== 12) {
                hours += 12;
            } else if (period.toLowerCase() === 'am' && hours === 12) {
                hours = 0;
            }
            
            return { hours, minutes };
        } else {
            // 24-hour format
            const [hours, minutes = '00'] = timeStr.split(':');
            return { hours: parseInt(hours), minutes: parseInt(minutes) };
        }
    } catch (error) {
        console.error('Error parsing time string:', timeStr, error);
        return null;
    }
}

// Handle sending a message
function handleSendMessage() {
    const message = userInput.value.trim();
    if (message === '') return;
    
    // Add user message to chat
    addUserMessage(message);
    
    // Clear input
    userInput.value = '';
    
    // Process the user's response in our conversation flow
    processUserResponse(message);
}


// Add a message from the user to the chat
function addUserMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `
        <div class="avatar">
            <i class="fas fa-user"></i>
        </div>
        <div class="content">
            <p>${text}</p>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
}

// Add Calendly widget script
function loadCalendly() {
    const script = document.createElement('script');
    script.src = 'https://assets.calendly.com/assets/external/widget.js';
    script.async = true;
    document.body.appendChild(script);
}

// Show booking form
function showBookingForm() {
    const form = document.createElement('div');
    form.className = 'booking-form';
    form.innerHTML = `
        <div class="booking-header">
            <h3>Schedule a Call with Our Studio Owner</h3>
            <p>Please provide your contact information to schedule a 10-minute consultation call.</p>
        </div>
        <div id="contact-form">
            <div class="form-group">
                <label for="booking-name">Name *</label>
                <input type="text" id="booking-name" required placeholder="Your full name">
            </div>
            <div class="form-group">
                <label for="booking-email">Email *</label>
                <input type="email" id="booking-email" required placeholder="your.email@example.com">
            </div>
            <div class="form-group">
                <label for="booking-phone">Phone Number *</label>
                <input type="tel" id="booking-phone" required placeholder="(555) 123-4567">
            </div>
            <button id="continue-to-calendar" class="btn-primary">Continue to Calendar</button>
        </div>
        <div id="booking-calendar" style="display: none;"></div>
    `;
    
    chatMessages.appendChild(form);
    
    // Add event listener for continue button
    const continueBtn = form.querySelector('#continue-to-calendar');
    continueBtn.addEventListener('click', () => {
        const name = form.querySelector('#booking-name').value.trim();
        const email = form.querySelector('#booking-email').value.trim();
        const phone = form.querySelector('#booking-phone').value.trim();
        
        if (!name || !email || !phone) {
            alert('Please fill in all required fields.');
            return;
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            alert('Please enter a valid email address.');
            return;
        }
        
        // Store booking info
        bookingInfo.name = name;
        bookingInfo.email = email;
        bookingInfo.phone = phone;
        
        // Hide contact form and show calendar
        form.querySelector('#contact-form').style.display = 'none';
        form.querySelector('#booking-calendar').style.display = 'block';
        form.querySelector('.booking-header p').textContent = 'Select your preferred date and time for a 10-minute consultation call.';
        
        // Scroll to show the calendar
        scrollToBottom();
        
        // Initialize calendar with contact info
        const calendarContainer = form.querySelector('#booking-calendar');
        if (window.BookingCalendar && calendarContainer) {
            bookingCalendar = new window.BookingCalendar(calendarContainer);
            // Pass the contact info to the calendar
            bookingCalendar.bookingInfo = {
                name: name,
                email: email,
                phone: phone
            };
            bookingCalendar.render();
        } else {
            console.error('BookingCalendar not available or container not found');
        }
    });
}

// Initialize booking calendar
let bookingCalendar = null;

// Add event delegation for dynamic buttons
document.addEventListener('click', (e) => {
    // Handle schedule call button
    if (e.target.classList.contains('schedule-call')) {
        e.preventDefault();
        conversationState.waitingForBookingConfirmation = true;
        showBookingForm();
        // Scroll to show the booking form
        setTimeout(() => scrollToBottom(), 100);
    }
    
    // Handle search again button
    if (e.target.classList.contains('search-again')) {
        e.preventDefault();
        conversationState.waitingForAge = true;
        conversationState.userPreferences = {};
        addBotMessage("Let's find more classes! What's your child's age?");
    }
    
    // Handle no thanks button
    if (e.target.textContent.trim() === 'No thanks') {
        const button = e.target;
        const messageDiv = button.closest('.message');
        if (messageDiv) {
            const buttonGroup = button.closest('.button-group');
            if (buttonGroup) {
                buttonGroup.innerHTML = '<p>No problem! Let me know if you have any other questions.</p>';
            }
        }
    }
});


// Add a message from the bot to the chat
function addBotMessage(text, suggestedClasses = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    
    // Handle undefined or null text
    if (!text || typeof text !== 'string') {
        console.error('addBotMessage received invalid text:', text);
        text = 'Sorry, I encountered an error. Please try again.';
    }
    
    // Convert line breaks to HTML
    const formattedText = text.replace(/\n/g, '<br>');
    
    let content = `<div class="content">
        <div class="message-text">${formattedText}</div>
    `;
    
    // Only show suggested classes in the chat if there are any
    if (suggestedClasses && suggestedClasses.length > 0) {
        const showCount = Math.min(suggestedClasses.length, 3);
        const remainingCount = suggestedClasses.length - showCount;
        
        content += '<div class="class-suggestions">';
        content += `<p class="suggestion-note">Here are ${showCount} classes that might interest you:</p>`;
        
        // Show max 3 classes with full details
        suggestedClasses.slice(0, 3).forEach((cls, index) => {
            if (!cls) return;
            
            const isClosestMatch = cls.matchType === 'closest';
            const matchBadge = isClosestMatch ? '<span class="match-badge closest">Similar Match</span>' : '<span class="match-badge direct">Perfect Match</span>';
            
            content += `
                <div class="class-card ${isClosestMatch ? 'closest-match' : 'direct-match'}">
                    <div class="class-header">
                        <h4>${cls.name || 'Unnamed Class'}</h4>
                        ${matchBadge}
                    </div>
                    <p><i class="fas fa-user-friends"></i> ${cls.ageRange || 'All Ages'}</p>
                    ${cls.day ? `<p><i class="far fa-calendar-alt"></i> ${cls.day} at ${cls.time || 'TBD'}</p>` : ''}
                    <p><i class="fas fa-signal"></i> ${cls.level || 'All Levels'}</p>
                    ${cls.description ? `<div class="class-description">${cls.description}</div>` : ''}
                </div>
            `;
        });
        
        // Add follow-up options
        if (suggestedClasses.length > 0) {
            content += `
                <div class="follow-up">
                    <p>What would you like to do next?</p>
                    <div class="button-group">
                        <button class="btn-primary schedule-call">Schedule a call with our studio owner</button>
                    </div>
                </div>
            `;
        }
        
        content += `${suggestedClasses.length > 3 ? 
                        `<p class="more-classes">There are ${remainingCount} more classes available. You can view them in the list below or ask me about specific criteria.</p>` 
                        : ''
                    }`;
        
        content += '</div>'; // Close class-suggestions
    }
    
    content += '</div>'; // Close content div
    
    messageDiv.innerHTML = `
        <div class="avatar">
            <i class="fas fa-robot"></i>
        </div>
        ${content}
    `;
    
    chatMessages.appendChild(messageDiv);
    scrollToBottom();
    
    // Do not scroll the class grid into view
    // (Requirement: keep conversation view stable without jumping)
}

// Show loading indicator
function showLoadingIndicator(message = "Processing...") {
    const id = 'loading-' + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.id = id;
    loadingDiv.className = 'message bot';
    loadingDiv.innerHTML = `
        <div class="avatar">
            <i class="fas fa-robot"></i>
        </div>
        <div class="content">
            <div class="loading-message">
                <div class="loading-spinner"></div>
                ${message}
            </div>
        </div>
    `;
    chatMessages.appendChild(loadingDiv);
    scrollToBottom();
    return id;
}

// Show typing indicator
function showTypingIndicator() {
    const id = 'typing-' + Date.now();
    const typingDiv = document.createElement('div');
    typingDiv.id = id;
    typingDiv.className = 'message bot';
    typingDiv.innerHTML = `
        <div class="avatar">
            <i class="fas fa-robot"></i>
        </div>
        <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        </div>
    `;
    chatMessages.appendChild(typingDiv);
    scrollToBottom();
    return id;
}

// Remove loading indicator
function removeLoadingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) {
        indicator.remove();
    }
}

// Remove typing indicator
function removeTypingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) {
        indicator.remove();
    }
}

// Handle Enter key press
function handleKeyPress(e) {
    if (e.key === 'Enter') {
        handleSendMessage();
    }
}

// Scroll chat to bottom
function scrollToBottom() {
    setTimeout(() => {
        const chatContainer = document.getElementById('chat-messages');
        if (chatContainer) {
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    }, 100);
}

// Create a class card element
function createClassCard(cls) {
    const card = document.createElement('div');
    card.className = 'class-card';
    
    // Helper to create a field element if the value exists
    const createField = (label, value) => {
        if (!value) return '';
        return `<p><strong>${label}:</strong> ${value}</p>`;
    };
    
    card.innerHTML = `
        <h3>${cls.name || 'Unnamed Class'}</h3>
        ${createField('Day', cls.day)}
        ${createField('Time', cls.time)}
        ${createField('Ages', cls.ageRange)}
        ${createField('Instructor', cls.instructor)}
        ${createField('Performance', cls.performance)}
        ${cls.description ? `<div class="class-description">${cls.description}</div>` : ''}
        <button class="book-btn" data-class="${encodeURIComponent(JSON.stringify(cls))}">
            Book This Class
        </button>
    `;
    
    return card;
}

// Helper function to save text to a file
function saveToFile(filename, content) {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Call Groq API
async function callGroqAPI(query) {
    try {
        // Parse the query to get the context
        const queryData = JSON.parse(query);
        const { task, preferences, availableClasses } = queryData;
        
        // Prepare simple text-based prompt
        const systemPrompt = `You are a dance class assistant. Suggest the best matching classes from the given list based on user preferences.

Return your response as JSON:
{
  "text": "Brief explanation of recommendations - if matchType is 'closest', explain what compromises were made",
  "classes": ["list", "of", "class", "ids"],
  "matchType": "direct" or "closest"
}

Use "direct" when classes perfectly match all criteria (age, style, day).
Use "closest" when you had to compromise on style or day preferences but age still matches.

IMPORTANT: If using "closest" match, your text must clearly explain what preferences couldn't be met exactly (e.g., "I couldn't find ballet classes on Mondays for your child's age, but here are some great ballet classes on other days" or "No hip hop classes available for 5-year-olds, but these classes accept similar ages and might be perfect").`;

        // Format user preferences in simple text
        const prefsText = `Child's Age: ${preferences.age}
Dance Style Preference: ${preferences.style || 'Any style'}
Day Preference: ${preferences.dayPreference || 'Any day'}`;

        // Format classes in simple text
        const classesText = availableClasses.map(cls => 
            `Class ID: ${cls.id}
Name: ${cls.name}
Age Range: ${cls.ageRange}
Day: ${cls.day}
Time: ${cls.time}
Description: ${cls.description}
---`
        ).join('\n');

        const userPrompt = `USER PREFERENCES:
${prefsText}

AVAILABLE CLASSES:
${classesText}`;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        // Retry logic for API calls with longer delays for rate limits
        const maxRetries = 2;
        let retryCount = 0;
        
        while (retryCount <= maxRetries) {
            try {
                const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${config.openRouterApiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': window.location.origin,
                        'X-Title': 'Dance Studio Chat'
                    },
                    body: JSON.stringify({
                        model: 'openai/gpt-4.1-nano',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: userPrompt }
                        ],
                        temperature: 0.7,
                        max_tokens: 4096,
                        response_format: { type: 'json_object' }
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }
                
                const data = await response.json();
                const responseContent = data.choices[0].message.content;
                
                
                // Try to parse JSON, fallback if it's plain text
                try {
                    return JSON.parse(responseContent);
                } catch (parseError) {
                    return {
                        text: responseContent,
                        classes: [],
                        matchType: "closest"
                    };
                }
                
            } catch (error) {
                console.error(`Class recommendation API error (attempt ${retryCount + 1}):`, error);
                retryCount++;

                if (retryCount <= maxRetries) {
                // Wait before retrying (exponential backoff)
                const waitTime = Math.pow(2, retryCount) * 1000; // 2s, 4s
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }
        
        // All retries failed
        throw new Error('Failed to get class recommendations after multiple attempts');
    } catch (error) {
        console.error('API call failed:', error);
        return {
            text: "I'm having trouble connecting to the class information right now. Here are all our available classes:",
            classes: allClasses.map(c => c.name)
        };
    }
}
