require('dotenv').config();
const { google } = require('googleapis');
const { v4: uuidv4 } = require('uuid');

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
            requestBody: {
                summary: 'Reunión de prueba',
                description: 'Prueba desde test_meet.js',
                start: { dateTime: new Date(Date.now() + 86400000).toISOString() }, // Tomorrow
                end: { dateTime: new Date(Date.now() + 90000000).toISOString() }, // Tomorrow + 1h
                attendees: [{ email: 'test@example.com' }],
                conferenceData: {
                    createRequest: { requestId: uuidv4() }
                }
            }
        });
        console.log("Success:", event.data.hangoutLink);
    } catch (err) {
        console.error("Google Error:", err.response?.data || err.message);
    }
}
test();
