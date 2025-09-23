// Calendar configuration
const calendarConfig = {
    // Available time slots (in 24-hour format)
    availableSlots: [
        // Weekday slots (Monday - Friday)
        { day: [1,2,3,4,5], time: '16:00', label: '4:00 PM' },
        { day: [1,2,3,4,5], time: '17:00', label: '5:00 PM' },
        { day: [1,2,3,4,5], time: '18:00', label: '6:00 PM' },
        
        // Weekend slots (Saturday - Sunday)
        { day: [6,0], time: '10:00', label: '10:00 AM' },
        { day: [6,0], time: '11:00', label: '11:00 AM' },
        { day: [6,0], time: '12:00', label: '12:00 PM' },
        { day: [6,0], time: '13:00', label: '1:00 PM' },
        { day: [6,0], time: '14:00', label: '2:00 PM' },
    ],
    
    // Days to show in the calendar (next 7 days only)
    daysToShow: 7,
    
    // Timezone offset in hours (e.g., -7 for PST)
    timezoneOffset: -7
};

class BookingCalendar {
    constructor(container, onDateSelect) {
        this.container = container;
        this.onDateSelect = onDateSelect;
        this.selectedDate = null;
        this.selectedTime = null;
        this.bookingInfo = null;
    }
    
    render() {
        // Get current date in local timezone (no conversion needed)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const dateGrid = this.generateDateGrid(today);
        
        let calendarHTML = `
            <div class="calendar-header">
                <h3>Select a Date & Time</h3>
                <p>Choose from available time slots in the next 7 days</p>
            </div>
            <div class="calendar-dates">
                ${dateGrid}
            </div>
            <div class="time-slots">
                <h4>Available Times</h4>
                <div class="time-slots-grid" id="time-slots">
                    <p>Please select a date first to see available times.</p>
                </div>
            </div>
            <div class="booking-summary" id="booking-summary" style="display: none;">
                <h4>Your Booking</h4>
                <p><strong>Date:</strong> <span id="selected-date"></span></p>
                <p><strong>Time:</strong> <span id="selected-time"></span></p>
                <button id="confirm-booking" class="btn-primary">Confirm Booking</button>
                <button id="change-selection" class="btn-secondary">Change</button>
            </div>
        `;
        
        this.container.innerHTML = calendarHTML;
        this.setupEventListeners();
    }
    
    generateDateGrid(startDate) {
        let grid = '<div class="dates-simple">';
        
        // Generate dates for the next 7 days only
        const config = window.calendarConfig || {
            availableSlots: [],
            daysToShow: 7,
            timezoneOffset: -7
        };
        
        for (let i = 0; i < config.daysToShow; i++) {
            const date = new Date(startDate);
            date.setDate(startDate.getDate() + i);
            
            const dayOfWeek = date.getDay();
            // Use local date string to avoid timezone issues
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dateStr = `${year}-${month}-${day}`;
            const dayNum = date.getDate();
            const monthName = date.toLocaleDateString('en-US', { month: 'short' });
            const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
            
            // Check if this day has available slots
            const availableSlots = this.getAvailableSlotsForDay(dayOfWeek);
            const hasSlots = availableSlots.length > 0;
            const isToday = i === 0; // First day is always today
            
            const cardHTML = `
                <div class="date-card ${hasSlots ? 'available' : 'unavailable'} ${isToday ? 'today' : ''}" 
                     data-date="${dateStr}" data-day="${dayOfWeek}">
                    <div class="day-name">${dayName}</div>
                    <div class="day-number">${dayNum}</div>
                    <div class="month">${monthName}</div>
                    ${hasSlots ? '<div class="available-indicator">Available</div>' : '<div class="unavailable-indicator">No slots</div>'}
                </div>
            `;
            
            grid += cardHTML;
        }
        
        grid += '</div>';
        return grid;
    }
    
    updateTimeSlots(date) {
        const dayOfWeek = date.getDay();
        this.updateTimeSlotsByDay(dayOfWeek);
    }
    
    updateTimeSlotsByDay(dayOfWeek) {
        const availableSlots = this.getAvailableSlotsForDay(dayOfWeek);
        const timeSlotsContainer = this.container.querySelector('#time-slots');
        
        if (availableSlots.length === 0) {
            timeSlotsContainer.innerHTML = '<p>No available time slots for this day.</p>';
            return;
        }
        
        timeSlotsContainer.innerHTML = availableSlots.map(slot => `
            <button class="time-slot" data-time="${slot.time}" data-label="${slot.label}">
                ${slot.label}
            </button>
        `).join('');
        
        // Remove duplicate event listeners - handled by main setupEventListeners
    }
    
    showBookingForm() {
        this.container.innerHTML = `
            <div class="booking-form-container">
                <h3>Schedule a Call</h3>
                <p>Please provide your details to book a call with our studio owner.</p>
                
                <div class="form-group">
                    <label for="booking-name">Full Name</label>
                    <input type="text" id="booking-name" placeholder="Your name" required>
                </div>
                
                <div class="form-group">
                    <label for="booking-email">Email</label>
                    <input type="email" id="booking-email" placeholder="Your email" required>
                </div>
                
                <div class="form-group">
                    <label for="booking-phone">Phone Number</label>
                    <input type="tel" id="booking-phone" placeholder="Your phone number" required>
                </div>
                
                <div class="form-actions">
                    <button id="show-calendar" class="btn-primary">Choose Date & Time</button>
                    <button id="cancel-booking" class="btn-secondary">Cancel</button>
                </div>
            </div>
            <div id="calendar-container" style="display: none;"></div>
        `;
        
        document.getElementById('show-calendar').addEventListener('click', () => {
            const name = document.getElementById('booking-name').value;
            const email = document.getElementById('booking-email').value;
            const phone = document.getElementById('booking-phone').value;
            
            if (!name || !email || !phone) {
                alert('Please fill in all fields');
                return;
            }
            
            this.bookingInfo = { name, email, phone };
            document.querySelector('.booking-form-container').style.display = 'none';
            document.getElementById('calendar-container').style.display = 'block';
            this.container = document.getElementById('calendar-container');
            this.render();
        });
        
        document.getElementById('cancel-booking').addEventListener('click', () => {
            this.container.closest('.booking-form').remove();
            conversationState.waitingForBookingInfo = false;
            conversationState.waitingForBookingConfirmation = false;
        });
    }
    
    showBookingSummary(date) {
        const dateStr = this.formatDate(date, 'full');
        const timeStr = this.selectedTime;
        
        document.getElementById('selected-date').textContent = dateStr;
        document.getElementById('selected-time').textContent = timeStr;
        
        document.querySelector('.calendar-dates').style.display = 'none';
        document.querySelector('.time-slots').style.display = 'none';
        document.getElementById('booking-summary').style.display = 'block';
        
        document.getElementById('confirm-booking').addEventListener('click', () => {
            this.confirmBooking(dateStr, timeStr);
        });
        
        document.getElementById('change-selection').addEventListener('click', () => {
            document.querySelector('.calendar-dates').style.display = 'block';
            document.querySelector('.time-slots').style.display = 'block';
            document.getElementById('booking-summary').style.display = 'none';
        });
    }
    
    async confirmBooking(dateStr, timeStr) {
        // Show loading indicator
        this.container.innerHTML = `
            <div class="booking-loading">
                <div class="loading-spinner"></div>
                <p>Booking your call...</p>
            </div>
        `;
        
        try {
            // Save to Google Sheets - create booking data with contact info
            const timeDisplay = typeof timeStr === 'object' ? timeStr.label : timeStr;
            const bookingData = {
                date: dateStr,
                time: timeDisplay,
                timestamp: new Date().toISOString(),
                name: this.bookingInfo?.name || '',
                email: this.bookingInfo?.email || '',
                phone: this.bookingInfo?.phone || ''
            };
            
            await this.saveBookingToSheets(bookingData);
            
            // Send email notification with conversation summary
            if (window.emailService) {
                try {
                    console.log('Attempting to send email notification...');
                    const emailResult = await window.emailService.sendBookingNotification(bookingData);
                    console.log('Email notification result:', emailResult);
                    if (emailResult.success) {
                        console.log('Email notification sent successfully');
                    } else {
                        console.error('Email notification failed:', emailResult.message);
                    }
                } catch (emailError) {
                    console.error('Failed to send email notification:', emailError);
                }
            } else {
                console.error('Email service not available');
            }
            
            this.container.innerHTML = `
                <div class="booking-confirmation">
                    <div class="checkmark">✓</div>
                    <h3>Booking Confirmed!</h3>
                    <p>We've scheduled your call for:</p>
                    <p><strong>${dateStr} at ${timeDisplay}</strong></p>
                    <p>We'll call you at the scheduled time.</p>
                </div>
            `;
            
            // Automatically clean up after a short delay
            setTimeout(() => {
                this.container.closest('.booking-form').remove();
                conversationState.waitingForBookingInfo = false;
                conversationState.waitingForBookingConfirmation = false;
            }, 2000); // Auto-close after 2 seconds
            
            // Add persistent reminder message to chat
            setTimeout(() => {
                // Parse date string manually to avoid timezone issues
                const [year, month, day] = dateStr.split('-').map(Number);
                const dateObj = new Date(year, month - 1, day); // month is 0-indexed
                const formattedDate = this.formatDate(dateObj, 'full');
                const timeDisplay = typeof timeStr === 'object' ? timeStr.label : timeStr;
                
                addBotMessage([
                    "✅ **Booking Confirmed!**",
                    "",
                    `Your call has been scheduled for **${formattedDate} at ${timeDisplay}**.`,
                    "",
                    "Our studio owner will call you at the scheduled time to discuss dance classes for your child.",
                    "",
                    "If you need to reschedule or have any questions, please contact us at (408) 204-6849."
                ].join('\n'));
            }, 1000);
            
            // Call the callback with booking details
            if (this.onDateSelect) {
                this.onDateSelect(dateStr, timeStr);
            }
        } catch (error) {
            console.error('Error saving booking:', error);
            alert('There was an error saving your booking. Please try again.');
        }
    }
    
    async saveBookingToSheets(bookingData) {
        const SCRIPT_URL = 'https://script.google.com/macros/s/1-nT82laJHcR0bFnMihScchiFbuhmu6yjoK3cdPOcpUT8Y1esk6R61e7K/exec';
        
        try {
            console.log('Sending booking data:', bookingData);
            
            // Add timestamp
            bookingData.timestamp = new Date().toISOString();
            
            // Submit data via fetch to avoid page redirect
            const response = await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors', // This prevents CORS issues but we won't get response details
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams(bookingData)
            });
            
            // Since we're using no-cors mode, we can't read the response
            // Just assume success if no network error occurred
            console.log('Booking data sent successfully');
            return { status: 'success', message: 'Booking submitted successfully' };
            
        } catch (error) {
            console.error('Error submitting booking:', {
                error: error.message,
                name: error.name,
                stack: error.stack
            });
            throw new Error('Failed to submit booking. Please try again later.');
        }
    }
    
    // Helper methods
    getMonthYearString(date) {
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    
    getAvailableSlotsForDay(dayOfWeek) {
        const config = window.calendarConfig || {
            availableSlots: [],
            daysToShow: 7,
            timezoneOffset: -7
        };
        return config.availableSlots.filter(slot => 
            slot.day.includes(dayOfWeek)
        );
    }
    
    isDateAvailable(dayOfWeek) {
        return this.getAvailableSlotsForDay(dayOfWeek).length > 0;
    }
    
    formatDate(date, format = 'short') {
        const options = format === 'full' 
            ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
            : { month: 'short', day: 'numeric' };
            
        return date.toLocaleDateString('en-US', options);
    }
    
    setupEventListeners() {
        // Date selection
        this.container.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent event bubbling that might trigger external libraries
            if (e.target.closest('.date-card')) {
                e.preventDefault();
                e.stopImmediatePropagation();
                
                const dateElement = e.target.closest('.date-card');
                if (!dateElement) return;
                
                // Check if dataset exists and has required properties
                if (!dateElement.dataset || !dateElement.dataset.date || !dateElement.dataset.day) {
                    console.warn('Date element missing required data attributes');
                    return;
                }
                
                const dateStr = dateElement.dataset.date;
                const dayOfWeek = parseInt(dateElement.dataset.day);
                
                if (dateElement.classList.contains('available')) {
                    // Remove previous selection
                    this.container.querySelectorAll('.date-card.selected').forEach(el => {
                        if (el && el.classList) {
                            el.classList.remove('selected');
                        }
                    });
                    
                    // Add selection to clicked date
                    dateElement.classList.add('selected');
                    this.selectedDate = dateStr;
                    
                    // Update time slots for selected date - use dayOfWeek directly
                    this.updateTimeSlotsByDay(dayOfWeek);
                    
                    if (this.onDateSelect) {
                        this.onDateSelect(dateStr);
                    }
                }
            }
            
            // Time slot selection
            if (e.target.classList.contains('time-slot')) {
                e.preventDefault();
                e.stopImmediatePropagation();
                
                const timeSlot = e.target;
                if (!timeSlot) return;
                
                // Check if dataset exists and has required properties
                if (!timeSlot.dataset || !timeSlot.dataset.time || !timeSlot.dataset.label) {
                    console.warn('Time slot element missing required data attributes');
                    return;
                }
                
                const timeStr = timeSlot.dataset.time;
                const timeLabel = timeSlot.dataset.label;
                
                if (!timeSlot.classList.contains('unavailable')) {
                    // Remove previous selection
                    this.container.querySelectorAll('.time-slot.selected').forEach(el => {
                        if (el && el.classList) {
                            el.classList.remove('selected');
                        }
                    });
                    
                    // Add selection to clicked time
                    timeSlot.classList.add('selected');
                    this.selectedTime = { time: timeStr, label: timeLabel };
                    
                    // Show booking summary
                    this.showBookingSummary();
                    
                    // Scroll to show the booking summary panel
                    setTimeout(() => {
                        const bookingSummary = document.getElementById('booking-summary');
                        if (bookingSummary) {
                            bookingSummary.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }, 100);
                }
            }
            
            // Confirm booking button
            if (e.target.id === 'confirm-booking') {
                if (this.selectedDate && this.selectedTime) {
                    this.confirmBooking(this.selectedDate, this.selectedTime);
                    
                    // Scroll to show the confirmation (keep it reasonable)
                    setTimeout(() => {
                        const bookingForm = document.querySelector('.booking-form');
                        if (bookingForm) {
                            // Scroll to show the booking form without going too far
                            bookingForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }, 500);
                }
            }
            
            // Change selection button
            if (e.target.id === 'change-selection') {
                this.hideBookingSummary();
            }
        });
    }
    
    showBookingSummary() {
        if (this.selectedDate && this.selectedTime) {
            const summary = this.container.querySelector('#booking-summary');
            const selectedDateSpan = this.container.querySelector('#selected-date');
            const selectedTimeSpan = this.container.querySelector('#selected-time');
            
            if (summary && selectedDateSpan && selectedTimeSpan) {
                // Parse date string manually to avoid timezone issues
                const [year, month, day] = this.selectedDate.split('-').map(Number);
                const date = new Date(year, month - 1, day); // month is 0-indexed
                selectedDateSpan.textContent = this.formatDate(date, 'full');
                selectedTimeSpan.textContent = this.selectedTime.label;
                
                summary.style.display = 'block';
            }
        }
    }
    
    hideBookingSummary() {
        const summary = this.container.querySelector('#booking-summary');
        summary.style.display = 'none';
        
        // Clear selections
        this.container.querySelectorAll('.selected').forEach(el => {
            if (el && el.classList) {
                el.classList.remove('selected');
            }
        });
        
        this.selectedDate = null;
        this.selectedTime = null;
    }
    
}

// Export for use in other files
window.BookingCalendar = BookingCalendar;
