// Configuration
const GROQ_API_KEY = window.appConfig?.groqApiKey || '';
const GOOGLE_API_KEY = window.appConfig?.googleApiKey || '';
const GOOGLE_SHEET_LINK = 'https://docs.google.com/spreadsheets/d/1GFYV6qiAy8fUk8nDbbnHiiOL_jzADSWgZZuzVJ55JC0/edit?usp=sharing';

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
    // Add a reload button for testing
    const header = document.querySelector('header');
    if (header) {
        const reloadButton = document.createElement('button');
        reloadButton.textContent = 'Reload Classes';
        reloadButton.style.marginLeft = '10px';
        reloadButton.onclick = reloadClasses;
        header.appendChild(reloadButton);
    }
    
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
async function processUserResponse(message) {
    // Handle booking confirmation
    if (conversationState.waitingForBookingConfirmation) {
        if (message.toLowerCase().includes('yes') || message.toLowerCase().includes('sure') || message === 'y') {
            showBookingForm();
        } else {
            addBotMessage("No problem! Let me know if you have any other questions about our classes.");
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
        
        // Show typing indicator while processing
        const typingId = showTypingIndicator();
        
        try {
            // Get recommendations from LLM
            const recommendedClasses = await getClassRecommendations(conversationState.userPreferences);
            
            if (recommendedClasses.length > 0) {
                addBotMessage([
                    "Here are some classes that match your preferences:",
                    ""
                ].join('\n'), recommendedClasses);
            } else {
                // If no matches, show nothing
                addBotMessage("I couldn't find any classes that match your criteria.");
            }
            
            // Keep the grid updated but don't scroll to it
            displayAllClasses();
            
        } catch (error) {
            console.error('Error getting class recommendations:', error);
            addBotMessage("I'm having trouble finding classes right now. Please try again later.");
        } finally {
            removeTypingIndicator(typingId);
        }
        
        // Reset conversation state for a new query
        setTimeout(() => {
            conversationState.waitingForAge = true;
            conversationState.waitingForStyle = false;
            conversationState.waitingForDay = false;
            conversationState.userPreferences = {};
            
            addBotMessage([
                "Would you like to search for another class? Just let me know your child's age to get started!"
            ].join('\n'));
        }, 1000);
    }
}

// Get class recommendations from LLM based on user preferences
async function getClassRecommendations(prefs) {
    try {
        console.log('Getting class recommendations with prefs:', prefs);
        
        // Prepare class data with all available fields
        const classData = allClasses.map(cls => ({
            name: cls.name || '',
            description: cls.description || '',
            ageRange: cls.ageRange || '',
            day: cls.day || '',
            time: cls.time || '',
            instructor: cls.instructor || '',
            level: cls.level || '',
            style: cls.style || '',
            performance: cls.performance || ''
        }));
        
        console.log('Sending class data to LLM:', classData);
        
        // Call the LLM with the preferences and class data
        const response = await callGroqAPI(JSON.stringify({
            task: 'recommend_classes',
            preferences: prefs,
            availableClasses: classData
        }));

        console.log('Received response from LLM:', response);
        
        // Handle the LLM response
        if (response && response.classes && Array.isArray(response.classes)) {
            // If the response is an array of class names, map them back to full class objects
            if (typeof response.classes[0] === 'string') {
                const recommendedClasses = allClasses.filter(cls => 
                    response.classes.includes(cls.name)
                );
                console.log('Mapped recommended classes by name:', recommendedClasses);
                return recommendedClasses;
            } 
            // If the response is an array of class objects with name properties
            else if (response.classes[0] && response.classes[0].name) {
                const recommendedClassNames = response.classes.map(c => c.name);
                const recommendedClasses = allClasses.filter(cls => 
                    recommendedClassNames.includes(cls.name)
                );
                console.log('Mapped recommended classes from object array:', recommendedClasses);
                return recommendedClasses;
            }
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

// Load classes from Google Sheets
async function loadClassesFromGoogleSheets() {
    try {
        console.log('Starting to load classes from Google Sheets...');
        const sheetId = extractSheetId(GOOGLE_SHEET_LINK);
        if (!sheetId) {
            throw new Error('Invalid Google Sheet URL');
        }

        console.log('Using sheet ID:', sheetId);
        
        // Always fetch from individual day sheets to get all classes
        console.log('Fetching from all day sheets...');
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        allClasses = [];
        
        // Fetch classes for each day in parallel
        const dayPromises = days.map(async (day) => {
            try {
                console.log(`Fetching ${day}...`);
                let dayClasses = await fetchAndParseSheet(sheetId, day, GOOGLE_API_KEY);
                
                // Set the day for each class
                dayClasses = dayClasses.map(cls => ({
                    ...cls,
                    day: day
                }));
                
                console.log(`Found ${dayClasses.length} classes for ${day}`);
                return dayClasses;
            } catch (error) {
                console.warn(`Error fetching ${day}:`, error);
                return [];
            }
        });
        
        // Wait for all day fetches to complete
        const allDayClasses = await Promise.all(dayPromises);
        
        // Flatten the array of arrays into a single array
        allClasses = allDayClasses.flat();
        
        console.log('Total classes loaded from all days:', allClasses.length);
        
        if (allClasses.length > 0) {
            displayAllClasses();
        } else {
            // If no classes found in day sheets, try the main sheet as fallback
            console.log('No classes found in day sheets, trying main sheet...');
            try {
                const response = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json`);
                if (response.ok) {
                    const text = await response.text();
                    const json = JSON.parse(text.substring(47).slice(0, -2));
                    allClasses = processSheetData(json.table.rows);
                    console.log(`Found ${allClasses.length} classes in main sheet`);
                    displayAllClasses();
                } else {
                    throw new Error('No data found in any sheet');
                }
            } catch (error) {
                console.error('Error loading from any sheet:', error);
                allClasses = getSampleData();
                displayAllClasses();
                addBotMessage("Showing sample class data. Please check your Google Sheets configuration if you expected different classes.");
            }
        }
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
    // scrollToBottom(); // disabled by AUTO_SCROLL flag
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
        // This callback will be called when a booking is confirmed
        console.log('Booking confirmed:', { date, time });
    });
    
    // Show the booking form
    bookingCalendar.showBookingForm();
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
            
            content += `
                <div class="class-card">
                    <h4>${cls.name || 'Unnamed Class'}</h4>
                    <p><i class="fas fa-user-friends"></i> ${cls.ageRange || 'All Ages'}</p>
                    ${cls.day ? `<p><i class="far fa-calendar-alt"></i> ${cls.day} at ${cls.time || 'TBD'}</p>` : ''}
                    <p><i class="fas fa-signal"></i> ${cls.level || 'All Levels'}</p>
                    ${cls.description ? `<div class="class-description">${cls.description}</div>` : ''}
                </div>
            `;
        });
        
        // Add follow-up question
        if (suggestedClasses.length > 0) {
            content += `
                <div class="follow-up">
                    <p>Would you like to know more about any of these classes? Just let me know which one interests you!</p>
                    <p>Or would you like to schedule a 15-minute call with our studio owner to discuss these classes in more detail?</p>
                    <div class="button-group">
                        <button class="btn-secondary schedule-call" style="flex: 1;">Yes, schedule a call</button>
                        <button class="btn-secondary" style="flex: 1;">No thanks</button>
                    </div>
                    ${suggestedClasses.length > 3 ? 
                        `<p class="more-classes">There are ${remainingCount} more classes available. You can view them in the list below or ask me about specific criteria.</p>` 
                        : ''
                    }
                </div>`;
        }
        
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
    // scrollToBottom(); // disabled by AUTO_SCROLL flag
    
    // Do not scroll the class grid into view
    // (Requirement: keep conversation view stable without jumping)
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
    // scrollToBottom(); // disabled by AUTO_SCROLL flag
    return id;
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

// Scroll chat to bottom (disabled when AUTO_SCROLL is false)
function scrollToBottom() {
    if (!AUTO_SCROLL) return;
    chatMessages.scrollTop = chatMessages.scrollHeight;
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
        ${createField('Ages', cls.ageRange)}
        ${createField('Day', cls.day)}
        ${createField('Time', cls.time)}
        ${createField('Instructor', cls.instructor)}
        ${createField('Performance', cls.performance)}
        ${cls.description ? `<div class="class-description">${cls.description}</div>` : ''}
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
        
        // Prepare the prompt
        const systemPrompt = `You are a helpful dance class assistant. Your task is to recommend the most suitable dance classes based on the user's preferences.
                        
                        For each class, you'll receive:
                        - name: The name of the class
                        - ageRange: The required age range (e.g., "4-6", "7+")
                        - day: Day of the week the class is held
                        - time: Class time
                        - level: Skill level (Beginner, Intermediate, etc.)
                        - description: Detailed description of the class
                        
                        The user's preferences will include:
                        - age: The child's age
                        - style: Preferred dance style (if any)
                        - dayPreference: Preferred day(s) (if any)
                        
                        Return a JSON object with:
                        {
                            "text": "Your response to the user explaining the recommendations",
                            "classes": ["array", "of", "matching", "class", "names"]
                        }
                        
                        CRITICAL RULES:
                        1. STRICT AGE REQUIREMENT: Only include classes where the child's age is within the class's age range. For example:
                           - If age is 1.5, only include classes with age range like "1-2" or "1.5-3"
                           - If age is 4, include "3-5" but not "5-7"
                           - Never include classes where the age is outside the range
                           - If no classes match the age range, return an empty array
                        
                        2. If a style is specified, only include classes that match that style
                        
                        3. Only consider day preference if specified
                        
                        DO NOT suggest alternatives if no classes match. Just return an empty array.`;

        const userPrompt = `User Preferences: ${JSON.stringify(preferences, null, 2)}
                        
                        Available Classes:
                        ${JSON.stringify(availableClasses, null, 2)}`;

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
                model: 'llama3-70b-8192',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.3,
                max_tokens: 1500,
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

