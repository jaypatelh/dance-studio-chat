// Configuration
const GROQ_API_KEY = window.appConfig?.groqApiKey || '';
const GOOGLE_API_KEY = window.appConfig?.googleApiKey || '';
const GOOGLE_SHEET_ID = '1oiD4w17jVWc9_4NDAIFZpfWa4Unli5wovxxVUqzyn88';

// DOM Elements
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-button');
const chatMessages = document.getElementById('chat-messages');

// Control whether the chat auto-scrolls
const AUTO_SCROLL = false;

// Store all classes and availability data
let allClasses = [];
let ownerAvailability = {};

// Generate unique conversation ID
const conversationId = 'conv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

// Track conversation state
const conversationState = {
    conversationHistory: [],
    userPreferences: {
        age: null,
        style: null,
        dayPreference: null
    },
    currentClasses: [],
    similarClasses: [],
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

// Save conversation to database
async function saveConversation() {
    try {
        // Only save if there are messages in the conversation
        if (conversationState.conversationHistory.length === 0) {
            return;
        }

        // Only save if there's at least one user message (actual user interaction)
        const hasUserMessages = conversationState.conversationHistory.some(msg => msg.role === 'user');
        if (!hasUserMessages) {
            return;
        }

        const conversationData = {
            conversationId: conversationId,
            messages: conversationState.conversationHistory,
            userPreferences: conversationState.userPreferences,
            timestamp: new Date().toISOString()
        };

        const response = await fetch('/.netlify/functions/save-conversation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(conversationData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log('Conversation saved successfully:', result);
        
    } catch (error) {
        console.error('Error saving conversation:', error);
        // Don't show error to user as this is a background operation
    }
}

// Debounced save function to avoid too many API calls
let saveTimeout;
function debouncedSaveConversation() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveConversation, 2000); // Save after 2 seconds of inactivity
}

// Initialize the chat when the page loads
window.onload = function() {
    loadClassesFromGoogleSheets();
    loadOwnerAvailability();
    loadCalendly(); // Load Calendly script
    
    // Setup event listeners
    if (sendBtn) {
        sendBtn.addEventListener('click', handleSendMessage);
    }
    
    if (userInput) {
        userInput.addEventListener('keypress', handleKeyPress);
        
        // Fix iOS Safari keyboard viewport issue
        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
            let initialViewportHeight = window.innerHeight;
            
            userInput.addEventListener('focus', () => {
                // Store initial height and scroll input into view
                initialViewportHeight = window.innerHeight;
                setTimeout(() => {
                    userInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
            });
            
            userInput.addEventListener('blur', () => {
                // Multiple attempts to fix viewport on keyboard close
                setTimeout(() => {
                    // Scroll to show latest user message at top
                    scrollToLatestUserMessage();
                }, 100);
                
                // Second attempt with longer delay
                setTimeout(() => {
                    if (window.visualViewport) {
                        scrollToLatestUserMessage();
                    }
                    // Force a repaint
                    document.body.style.height = '100%';
                    setTimeout(() => {
                        document.body.style.height = '';
                        scrollToLatestUserMessage();
                    }, 10);
                }, 300);
            });
            
            // Listen for visual viewport changes (iOS 13+)
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', () => {
                    if (window.visualViewport.height === initialViewportHeight) {
                        // Keyboard closed, scroll to show latest user message at top
                        setTimeout(() => {
                            scrollToLatestUserMessage();
                        }, 50);
                    }
                });
            }
        }
    }
    
    // Add welcome message after a short delay
    setTimeout(() => {
        const welcomeMessage = [
            "👋 Hi there! I'm your friendly AI assistant, and I'm here to help you find the perfect dance class for your child!",
            "",
            "I can help you with:",
            "• Finding classes based on your child's age and interests", 
            "• Answering questions about our studio policies, pricing, and dress codes",
            "• Scheduling a callback to learn more about our classes",
            "",
            "How would you like to get started? You can tell me your child's age, ask about a specific dance style, find classes on a particular day, or ask me anything else about our studio!"
        ].join('\n');
        
        // Initialize conversation history with welcome message
        conversationState.conversationHistory.push({
            role: 'assistant',
            content: welcomeMessage
        });
        addBotMessage(welcomeMessage);
        
        // Don't save yet - wait for user interaction
    }, 500); // Short delay to ensure classes are loaded
};

// Handle user responses with LLM-driven conversation
async function processUserResponse(message, event) {
    // Handle "Search again" button click
    if (event && event.target && event.target.classList.contains('search-again')) {
        conversationState.conversationHistory = [];
        conversationState.userPreferences = { age: null, style: null, dayPreference: null };
        conversationState.currentClasses = [];
        conversationState.similarClasses = [];
        addBotMessage("Let's find more classes! What's your child's age?");
        return;
    }

    // Handle similar classes follow-up
    if (conversationState.similarClasses.length > 0) {
        const userMessage = message.toLowerCase();
        if (userMessage.includes('yes') || userMessage.includes('learn more') || userMessage.includes('tell me more') || userMessage.includes('show me')) {
            // User wants to see the similar classes
            const messageText = "Here are the similar classes I found:";
            addBotMessage(messageText, conversationState.similarClasses);
            conversationState.currentClasses = conversationState.similarClasses;
            conversationState.similarClasses = []; // Clear similar classes after showing
            return;
        } else if (userMessage.includes('no') || userMessage.includes('call') || userMessage.includes('owner')) {
            // User prefers to schedule a call
            conversationState.similarClasses = []; // Clear similar classes
            addBotMessage("I'd be happy to help you schedule a callback so someone can call you to discuss your options!");
            showBookingForm();
            return;
        }
        // If neither yes nor no, continue with normal conversation flow but clear similar classes
        conversationState.similarClasses = [];
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
    
    // Save conversation after user message
    debouncedSaveConversation();
    
    // Show loading indicator
    const loadingId = showLoadingIndicator("Thinking...");
    
    // Scroll to show the loading indicator immediately
    scrollToBottom();
    
    try {
        // Get response from conversation management LLM with all classes included
        const response = await getConversationResponse(message, conversationState, allClasses);
        
        removeLoadingIndicator(loadingId);
        
        // Update user preferences if provided
        if (response.preferences) {
            conversationState.userPreferences = response.preferences;
        }
        
        // Handle the response based on its action
        if (response.action === 'schedule_call') {
            // User wants to schedule a callback
            addBotMessage(response.message);
            showBookingForm();
        } else {
            // Extract recommended classes if any
            if (response.recommendedClasses && response.recommendedClasses.length > 0) {
                const recommendedClasses = extractRecommendedClasses(response, allClasses);
                conversationState.currentClasses = recommendedClasses;
                
                // Show the message with recommended classes
                addBotMessage(response.message, recommendedClasses);
            } else {
                // Regular conversation response without specific class recommendations
                addBotMessage(response.message || 'Sorry, I encountered an error. Please try again.');
            }
        }
        
        // Add assistant response to conversation history (only if message exists)
        if (response.message) {
            conversationState.conversationHistory.push({
                role: 'assistant',
                content: response.message
            });
            
            // Save conversation after assistant response
            debouncedSaveConversation();
        }
        
    } catch (error) {
        console.error('Error processing conversation:', error);
        addBotMessage("I'm experiencing some technical difficulties. Please try again in a moment, or feel free to schedule a callback for immediate assistance.");
    } finally {
        removeLoadingIndicator(loadingId);
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
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Master Classes'];
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
    // Class grid functionality has been moved to separate classes.html page
    console.log('Class grid display has been moved to classes.html');
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
        console.log('All available sheets:', sheets.map(s => s.properties.title));
        
        const daySheets = sheets
            .map(sheet => sheet.properties)
            .filter(sheet => {
                // Include Monday through Saturday and Master Classes only
                const title = sheet.title;
                const targetSheets = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Master Classes'];
                
                return targetSheets.includes(title);
            });
            
        console.log('Sheets being loaded for classes:', daySheets.map(s => s.title));
        
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
    
    // Scroll immediately with debug
    console.log('Scrolling user message...');
    if (chatMessages) {
        console.log('chatMessages found, scrollHeight:', chatMessages.scrollHeight);
        console.log('clientHeight:', chatMessages.clientHeight);
        console.log('Before scroll - scrollTop:', chatMessages.scrollTop);
        
        // Scroll to absolute bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        console.log('After scrollTop assignment:', chatMessages.scrollTop);
        
        chatMessages.scrollTo(0, chatMessages.scrollHeight);
        console.log('After scrollTo:', chatMessages.scrollTop);
        
        // Don't use scrollIntoView as it interferes with the scroll position
    } else {
        console.log('chatMessages not found!');
    }
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
            <h3>Schedule a Callback to Learn More</h3>
            <p>Please provide your contact information and someone will call you at your desired time to help you understand your options better.</p>
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
        setTimeout(() => {
            const bookingForm = document.querySelector('.booking-form');
            if (bookingForm) {
                bookingForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 100);
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


// Simple markdown renderer for bot messages
function renderMarkdown(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
        .replace(/\n/g, '<br>'); // Line breaks
}

// Add a message from the bot to the chat
function addBotMessage(text, suggestedClasses = []) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message bot';
    
    // Handle undefined or null text
    if (!text || typeof text !== 'string') {
        console.error('addBotMessage received invalid text:', text);
        text = 'Sorry, I encountered an error. Please try again.';
    }
    
    // Convert markdown and line breaks to HTML
    const formattedText = renderMarkdown(text);
    
    let content = `<div class="content">
        <div class="message-text">${formattedText}</div>
    `;
    
    // Classes are now displayed inline with the message text using markdown formatting
    // No separate class cards needed
    
    content += '</div>'; // Close content div
    
    messageDiv.innerHTML = `
        <div class="avatar">
            <i class="fas fa-robot"></i>
        </div>
        ${content}
    `;
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll immediately with debug
    console.log('Scrolling bot message...');
    if (chatMessages) {
        console.log('chatMessages found, scrollHeight:', chatMessages.scrollHeight);
        console.log('clientHeight:', chatMessages.clientHeight);
        console.log('Before scroll - scrollTop:', chatMessages.scrollTop);
        
        // Scroll to absolute bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
        console.log('After scrollTop assignment:', chatMessages.scrollTop);
        
        chatMessages.scrollTo(0, chatMessages.scrollHeight);
        console.log('After scrollTo:', chatMessages.scrollTop);
    } else {
        console.log('chatMessages not found!');
    }
    
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
    
    // Scroll immediately after adding loading indicator
    console.log('Loading indicator added, scrolling...');
    scrollToBottom();
    return id;
}

// Update loading message text
function updateLoadingMessage(id, newMessage) {
    const loadingElement = document.getElementById(id);
    if (loadingElement) {
        const messageElement = loadingElement.querySelector('.loading-message');
        if (messageElement) {
            messageElement.innerHTML = `
                <div class="loading-spinner"></div>
                ${newMessage}
            `;
        }
    }
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
    if (chatMessages) {
        console.log('scrollToBottom called - scrollHeight:', chatMessages.scrollHeight);
        console.log('clientHeight:', chatMessages.clientHeight);
        console.log('offsetHeight:', chatMessages.offsetHeight);
        console.log('CSS overflow:', window.getComputedStyle(chatMessages).overflow);
        console.log('CSS overflowY:', window.getComputedStyle(chatMessages).overflowY);
        console.log('Is scrollable?', chatMessages.scrollHeight > chatMessages.clientHeight);
        
        // Scroll after DOM update
        setTimeout(() => {
            if (chatMessages) {
                chatMessages.scrollTop = chatMessages.scrollHeight;
                chatMessages.scrollTo(0, chatMessages.scrollHeight);
                console.log('scrollToBottom completed - scrollTop:', chatMessages.scrollTop);
            }
        }, 10);
    }
}

// Scroll to show latest user message at top of viewport
function scrollToLatestUserMessage() {
    const userMessages = document.querySelectorAll('.message.user');
    if (userMessages.length > 0) {
        const latestUserMessage = userMessages[userMessages.length - 1];
        latestUserMessage.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start',
            inline: 'nearest'
        });
    } else {
        // Fallback to scroll to top if no user messages found
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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

