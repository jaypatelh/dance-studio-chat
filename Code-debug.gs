const SHEET_NAME = 'Call Bookings';

function doGet() {
  return ContentService.createTextOutput('This is a POST-only endpoint')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    // Log the incoming request for debugging
    console.log('doPost called');
    console.log('e.parameter:', e.parameter);
    console.log('e.postData:', e.postData);
    
    // Parse the form data
    const data = e.parameter;
    
    // Log the parsed data
    console.log('Parsed data:', data);
    
    // Get the active spreadsheet (should be the one this script is bound to)
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    console.log('Spreadsheet ID:', ss.getId());
    console.log('Spreadsheet Name:', ss.getName());
    
    // Try to get the sheet
    let sheet = ss.getSheetByName(SHEET_NAME);
    
    // If sheet doesn't exist, create it
    if (!sheet) {
      console.log('Creating new sheet:', SHEET_NAME);
      sheet = ss.insertSheet(SHEET_NAME);
      // Add headers
      sheet.appendRow([
        'Timestamp', 
        'Name', 
        'Email', 
        'Phone', 
        'Appointment Date', 
        'Appointment Time',
        'Status'
      ]);
    } else {
      console.log('Sheet exists:', SHEET_NAME);
    }
    
    // Prepare the row data
    const rowData = [
      data.timestamp || new Date().toISOString(),
      data.name || '',
      data.email || '',
      data.phone || '',
      data.date || '',
      data.time || '',
      'Scheduled'
    ];
    
    console.log('Adding row data:', rowData);
    
    // Add the new booking
    sheet.appendRow(rowData);
    
    console.log('Row added successfully');
    
    // Return success page
    return createSuccessPage();
      
  } catch (error) {
    console.error('Error in doPost:', error);
    console.error('Error stack:', error.stack);
    return createErrorPage(error);
  }
}

function createSuccessPage() {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Booking Successful</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
          .success { color: #4CAF50; font-size: 24px; margin-bottom: 20px; }
          .info { margin: 20px 0; }
          .button { 
            background-color: #4CAF50;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 4px;
            display: inline-block;
            margin-top: 20px;
            border: none;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="success">✓ Booking Successful!</div>
        <div class="info">Your booking has been received.</div>
        <button class="button" onclick="window.close()">Close Window</button>
        <script>
          // Close the tab after 3 seconds
          setTimeout(() => window.close(), 3000);
        </script>
      </body>
    </html>
  `;
  return HtmlService.createHtmlOutput(html);
}

function createErrorPage(error) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Booking Error</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
          .error { color: #f44336; font-size: 24px; margin-bottom: 20px; }
          .info { margin: 20px 0; }
          .button { 
            background-color: #f44336;
            color: white;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 4px;
            display: inline-block;
            margin-top: 20px;
            border: none;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="error">✗ Booking Failed</div>
        <div class="info">There was an error processing your booking.</div>
        <div class="info">${error.message || 'Please try again later.'}</div>
        <button class="button" onclick="window.close()">Close Window</button>
      </body>
    </html>
  `;
  return HtmlService.createHtmlOutput(html);
}

// Test function to verify the script works
function testBooking() {
  const testData = {
    parameter: {
      timestamp: new Date().toISOString(),
      name: 'Test User',
      email: 'test@example.com',
      phone: '123-456-7890',
      date: '2023-12-15',
      time: '2:00 PM'
    }
  };
  
  const result = doPost(testData);
  console.log('Test result:', result);
}
