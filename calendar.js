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
    
    // Days to show in the calendar (default: next 14 days)
    daysToShow: 14,
    
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
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let calendarHTML = `
            <div class="calendar-header">
                <h3>Select a Date & Time</h3>
                <p>Choose from available time slots below</p>
            </div>
            <div class="calendar-navigation">
                <button class="btn-secondary prev-week">← Previous</button>
                <span class="month-year">${this.getMonthYearString(today)}</span>
                <button class="btn-primary next-week">Next →</button>
            </div>
            <div class="calendar-dates">
                ${this.generateDateGrid(today)}
            </div>
            <div class="time-slots">
                <h4>Available Times</h4>
                <div class="time-slots-grid" id="time-slots">
                    <!-- Time slots will be populated here -->
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
        this.updateTimeSlots(today);
    }
    
    generateDateGrid(startDate) {
        let grid = '<div class="weekdays">';
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        // Add weekday headers
        weekdays.forEach(day => {
            grid += `<div class="weekday">${day}</div>`;
        });
        grid += '</div><div class="dates">';
        
        // Add dates
        const today = new Date(startDate);
        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);
            
            const dayOfWeek = date.getDay();
            const dayOfMonth = date.getDate();
            const isToday = i === 0;
            const isAvailable = this.isDateAvailable(dayOfWeek);
            
            grid += `
                <div class="date-cell ${isToday ? 'today' : ''} ${isAvailable ? 'available' : 'unavailable'}" 
                     data-date="${this.formatDate(date)}" 
                     data-day="${dayOfWeek}"
                     ${!isAvailable ? 'disabled' : ''}>
                    <span class="day">${dayOfMonth}</span>
                    ${isToday ? '<span class="today-label">Today</span>' : ''}
                </div>
            `;
        }
        
        grid += '</div>';
        return grid;
    }
    
    updateTimeSlots(date) {
        const dayOfWeek = date.getDay();
        const availableSlots = this.getAvailableSlotsForDay(dayOfWeek);
        const timeSlotsContainer = this.container.querySelector('#time-slots');
        
        if (availableSlots.length === 0) {
            timeSlotsContainer.innerHTML = '<p>No available time slots for this day.</p>';
            return;
        }
        
        timeSlotsContainer.innerHTML = availableSlots.map(slot => `
            <button class="time-slot" data-time="${slot.time}">
                ${slot.label}
            </button>
        `).join('');
        
        // Add event listeners to time slots
        timeSlotsContainer.querySelectorAll('.time-slot').forEach(slot => {
            slot.addEventListener('click', (e) => {
                this.selectedTime = e.target.dataset.time;
                this.showBookingSummary(date);
            });
        });
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
        try {
            // Save to Google Sheets
            await this.saveBookingToSheets({
                ...this.bookingInfo,
                date: dateStr,
                time: timeStr,
                timestamp: new Date().toISOString()
            });
            
            this.container.innerHTML = `
                <div class="booking-confirmation">
                    <div class="checkmark">✓</div>
                    <h3>Booking Confirmed!</h3>
                    <p>We've scheduled your call for:</p>
                    <p><strong>${dateStr} at ${timeStr}</strong></p>
                    <p>We'll call you at ${this.bookingInfo.phone} at the scheduled time.</p>
                    <button class="btn-primary" id="close-booking">Done</button>
                </div>
            `;
            
            document.getElementById('close-booking').addEventListener('click', () => {
                this.container.closest('.booking-form').remove();
                conversationState.waitingForBookingInfo = false;
                conversationState.waitingForBookingConfirmation = false;
            });
        } catch (error) {
            console.error('Error saving booking:', error);
            alert('There was an error saving your booking. Please try again.');
        }
    }
    
    async saveBookingToSheets(bookingData) {
        const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwqTA5mGKYhqJjleoPU_msJEDzBbd26HlZemXLeZRmwV8PdyXHHyaw5JhzfrYDUruqf/exec';
        
        try {
            console.log('Sending booking data:', bookingData);
            
            // Add timestamp
            bookingData.timestamp = new Date().toISOString();
            
            // Create a form to submit the data (works around CORS issues)
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = SCRIPT_URL;
            form.target = '_blank'; // Open in new tab to see any errors
            
            // Add data as hidden inputs
            Object.entries(bookingData).forEach(([key, value]) => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = value;
                form.appendChild(input);
            });
            
            // Add form to page and submit
            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
            
            // Since we're submitting a form, we can't get the response directly
            // Just assume success if no errors
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
        return calendarConfig.availableSlots.filter(slot => 
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
            const dateCell = e.target.closest('.date-cell.available');
            if (dateCell && !dateCell.disabled) {
                const dateStr = dateCell.dataset.date;
                const date = new Date(dateStr);
                this.selectedDate = date;
                this.updateTimeSlots(date);
                
                // Update selected state
                this.container.querySelectorAll('.date-cell').forEach(cell => {
                    cell.classList.remove('selected');
                });
                dateCell.classList.add('selected');
            }
        });
        
        // Navigation
        this.container.querySelector('.prev-week')?.addEventListener('click', () => {
            // Implementation for previous week
        });
        
        this.container.querySelector('.next-week')?.addEventListener('click', () => {
            // Implementation for next week
        });
    }
}

// Export for use in other files
window.BookingCalendar = BookingCalendar;
