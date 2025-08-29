// Google Apps Script to handle form submissions
const SHEET_NAME = 'Call Bookings';

function doPost(e) {
  try {
    // Parse the incoming data
    const data = JSON.parse(e.postData.contents);
    
    // Get the active spreadsheet and the sheet
    const ss = SpreadsheetApp.openById('YOUR_SPREADSHEET_ID'); // Replace with your Google Sheet ID
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    // Create the sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      // Add headers if this is a new sheet
      sheet.appendRow([
        'Timestamp', 
        'Name', 
        'Email', 
        'Phone', 
        'Appointment Date', 
        'Appointment Time',
        'Status'
      ]);
    }
    
    // Add the new booking
    sheet.appendRow([
      new Date().toISOString(),
      data.name,
      data.email,
      data.phone,
      data.date,
      data.time,
      'Scheduled'
    ]);
    
    // Return success response
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Booking saved successfully'
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // Return error response
    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'error',
        message: error.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Helper function to test the script
function testDoPost() {
  const testData = {
    name: 'Test User',
    email: 'test@example.com',
    phone: '123-456-7890',
    date: '2023-12-15',
    time: '14:00'
  };
  
  const response = doPost({
    postData: {
      contents: JSON.stringify(testData)
    }
  });
  
  Logger.log(response.getContent());
}
