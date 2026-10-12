const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function test() {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

    const calendarAPI = google.calendar({ version: 'v3', auth: oauth2Client });
    const event = await calendarAPI.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      sendUpdates: 'all',
      requestBody: {
        summary: `ReuniA3n: Prueba - Calendario Prueba`,
        description: '',
        start: { dateTime: new Date().toISOString() },
        end: { dateTime: new Date(Date.now() + 3600000).toISOString() },
        attendees: [{ email: "whilmis21@gmail.com" }],
        conferenceData: {
          createRequest: { requestId: uuidv4() }
        }
      }
    });
    
    console.log("SUCCESS:", event.data.hangoutLink);
  } catch (e) {
    console.error("ERROR FULL:", e);
  }
}
test();
