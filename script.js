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

// Store all classes
let allClasses = [];

// Track conversation state
let conversationState = {
    waitingForAge: false,
    waitingForStyle: false,
    waitingForDay: false,
    waitingForBookingConfirmation: false,
    waitingForBookingInfo: false,
    userPreferences: {}
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
    loadCalendly(); // Load Calendly script
    
    // Add welcome message after a short delay
    setTimeout(() => {
        const welcomeMessage = [
            "👋 Hi there! I'm your Dance Class Assistant. Let's find the perfect dance class!",
            "",
            "I'll ask you a few questions to understand what you're looking for.",
            "",
            "First, how old is your child? (e.g., '5 years old' or 'She\'s 7')"
        ].join('\n');
        
        conversationState.waitingForAge = true;
        addBotMessage(welcomeMessage);
    }, 500); // Short delay to ensure classes are loaded
};

// Handle user responses
async function processUserResponse(message, event) {
    // Handle "Search again" button click
    if (event && event.target && event.target.classList.contains('search-again')) {
        conversationState.waitingForAge = true;
        conversationState.userPreferences = {};
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
    
    if (conversationState.waitingForAge) {
        // Extract age from message (simple number extraction)
        const ageMatch = message.match(/\d+/);
        if (ageMatch) {
            conversationState.userPreferences.age = parseInt(ageMatch[0]);
            conversationState.waitingForAge = false;
            conversationState.waitingForStyle = true;
            
            setTimeout(() => {
                addBotMessage([
                    `Great! I see your child is ${conversationState.userPreferences.age} years old.`,
                    "",
                    "What style of dance are you interested in? (e.g., ballet, hip hop, jazz, tap, or 'not sure')"
                ].join('\n'));
            }, 500);
        } else {
            addBotMessage("I didn't catch that. Could you tell me your child's age? For example, '5 years old' or 'She's 7'");
        }
    } 
    else if (conversationState.waitingForStyle) {
        conversationState.userPreferences.style = message.toLowerCase();
        conversationState.waitingForStyle = false;
        conversationState.waitingForDay = true;
        
        setTimeout(() => {
            addBotMessage([
                `Got it! You're interested in ${conversationState.userPreferences.style}.`,
                "",
                "Do you have a preferred day of the week for classes? (e.g., 'Monday', 'weekends', or 'any day')"
            ].join('\n'));
        }, 500);
    }
    else if (conversationState.waitingForDay) {
        conversationState.userPreferences.dayPreference = message.toLowerCase();
        conversationState.waitingForDay = false;
        
        // Show loading indicator while processing
        const loadingId = showLoadingIndicator("Finding the perfect classes for you...");
        
        try {
            // Get recommendations from LLM
            const recommendedClasses = await getClassRecommendations(conversationState.userPreferences);
            
            if (recommendedClasses.length > 0) {
                // Check if these are direct or closest matches
                const matchType = recommendedClasses[0]?.matchType || 'direct';
                const messageText = matchType === 'direct' 
                    ? "Here are some classes that match your preferences:"
                    : "I couldn't find perfect matches, but here are some similar classes that might work:";
                
                addBotMessage([
                    messageText,
                    ""
                ].join('\n'), recommendedClasses);
            } else {
                // If no matches from LLM, try a simple fallback based on age
                console.log('No LLM matches, trying fallback matching...');
                const fallbackClasses = allClasses.filter(cls => {
                    if (!conversationState.userPreferences.age) return true;
                    
                    const ageRange = cls.ageRange || '';
                    if (ageRange.includes('-')) {
                        const [min, max] = ageRange.split('-').map(n => parseInt(n.trim()));
                        return conversationState.userPreferences.age >= min && conversationState.userPreferences.age <= max;
                    }
                    return true;
                }).slice(0, 3); // Limit to 3 classes
                
                if (fallbackClasses.length > 0) {
                    addBotMessage([
                        "Here are some classes that might work for your child:",
                        ""
                    ].join('\n'), fallbackClasses);
                } else {
                    addBotMessage("I couldn't find any classes that match your criteria.");
                }
            }
            
            // Keep the grid updated but don't scroll to it
            displayAllClasses();
            
        } catch (error) {
            console.error('Error getting class recommendations:', error);
            addBotMessage("I'm having trouble finding classes right now. Please try again later.");
        } finally {
            removeLoadingIndicator(loadingId);
        }
        
        // Reset conversation state for a new query
        setTimeout(() => {
            conversationState.waitingForAge = true;
        }, 1000);
    }
}

// Get class recommendations from LLM based on user preferences
async function getClassRecommendations(prefs) {
    try {
        console.log('Getting class recommendations with prefs:', prefs);
        
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
        
        console.log('Sending class data to LLM:', classData);
        console.log('User preferences:', prefs);
        
        // Call the LLM with the preferences and class data
        const response = await callGroqAPI(JSON.stringify({
            task: 'recommend_classes',
            preferences: prefs,
            availableClasses: classData
        }));

        console.log('Received response from LLM:', response);
        console.log('Response classes array:', response?.classes);
        console.log('Match type:', response?.matchType);
        
        // Handle the LLM response
        if (response && response.classes && Array.isArray(response.classes)) {
            console.log('LLM returned class IDs:', response.classes);
            
            // Map class IDs back to full class objects using the same mapping as sent to LLM
            const classDataMap = {};
            classData.forEach(cls => {
                classDataMap[cls.id] = cls;
            });
            
            console.log('Available class IDs in map:', Object.keys(classDataMap));
            
            // Map back to original allClasses objects using direct ID lookup
            const recommendedClasses = response.classes
                .map(classId => {
                    const classFromLLM = classDataMap[classId];
                    if (!classFromLLM) {
                        console.warn(`Class ID ${classId} not found in map`);
                        return null;
                    }
                    
                    console.log(`Direct mapping ${classId}:`, classFromLLM);
                    
                    // Extract the index from the class ID (e.g., "class_35" -> 35)
                    const index = parseInt(classId.replace('class_', ''));
                    const originalClass = allClasses[index];
                    
                    if (!originalClass) {
                        console.warn(`Original class at index ${index} not found`);
                        return classFromLLM; // Fallback to LLM data
                    }
                    
                    console.log(`Successfully mapped to index ${index}:`, originalClass);
                    return originalClass;
                })
                .filter(Boolean); // Remove any undefined entries
                
            console.log('Final mapped recommended classes:', recommendedClasses);
            
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

// Display all classes in the grid
function displayAllClasses() {
    console.log('Displaying all classes:', allClasses);
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
    
    console.log(`Rendering ${allClasses.length} classes`);
    
    allClasses.forEach((cls, index) => {
        console.log(`Rendering class ${index + 1}:`, cls);
        try {
            const card = createClassCard(cls);
            if (card) {
                grid.appendChild(card);
            } else {
                console.error('Failed to create card for class:', cls);
            }
        } catch (error) {
            console.error('Error creating class card:', error, 'Class data:', cls);
        }
    });
    
    console.log('Finished rendering classes');
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
        console.log('Fetching classes from Google Sheets API...');
        
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
        
        console.log(`Loaded ${allClasses.length} classes from ${daySheets.length} sheets`);
        displayAllClasses();
        
    } catch (error) {
        console.error('Error loading classes:', error);
        allClasses = getSampleData();
        displayAllClasses();
        addBotMessage("Error loading class data. Showing sample data instead.");
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
    chatMessages.appendChild(form);
    
    // Initialize the booking calendar
    bookingCalendar = new BookingCalendar(form, (date, time) => {
        console.log('Booking confirmed for:', date, time);
        conversationState.waitingForBookingConfirmation = false;
        
        // Add confirmation message to chat
        setTimeout(() => {
            addBotMessage([
                "✅ **Booking Confirmed!**",
                "",
                `Your call has been scheduled for ${date} at ${time}.`,
                "",
                "Our studio owner will call you at the scheduled time to discuss dance classes for your child.",
                "",
                "If you need to reschedule or have any questions, please contact us directly."
            ].join('\n'));
        }, 1000);
    });
    
    // Show the booking form
    bookingCalendar.showBookingForm();
    
    // Scroll to show the booking form
    scrollToBottom();
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
    
    let content = `<div class="content">
        <div class="message-text">${text}</div>
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
                        <button class="btn-secondary schedule-call">Schedule a call with our studio owner</button>
                        <button class="btn-outline search-again">Search for different classes</button>
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
    console.log('Creating card for class:', cls);
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

IMPORTANT: Only suggest classes where the child's age fits the age range exactly.

Return your response as JSON:
{
  "text": "Brief explanation of recommendations",
  "classes": ["list", "of", "class", "ids"],
  "matchType": "direct" or "closest"
}

Use "direct" when classes perfectly match all criteria (age, style, day).
Use "closest" when you had to compromise on style or day preferences but age still matches.`;

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
${classesText}

Find classes that match the child's age and preferences. Age ${preferences.age} must fit within the class age range.`;

        // Save the prompt to a file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const promptFilename = `llm-prompt-${timestamp}.txt`;
        const fullPrompt = `=== SYSTEM PROMPT ===\n${systemPrompt}\n\n=== USER PROMPT ===\n${userPrompt}`;
        saveToFile(promptFilename, fullPrompt);
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: 'openai/gpt-oss-120b',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 1.0,
                max_tokens: 8192,
                response_format: { type: 'json_object' }
            })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        const responseContent = data.choices[0].message.content;
        
        // Save the response to a file
        const responseFilename = `llm-response-${timestamp}.txt`;
        saveToFile(responseFilename, responseContent);
        
        return JSON.parse(responseContent);
    } catch (error) {
        console.error('API call failed:', error);
        return {
            text: "I'm having trouble connecting to the class information right now. Here are all our available classes:",
            classes: allClasses.map(c => c.name)
        };
    }
}

