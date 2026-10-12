filename = "src/controllers/calendar.controller.ts"
with open(filename, "r", encoding="utf-8") as f:
    ts = f.read()

# Add sendUpdates: 'all' to events.insert
old_insert = """        const event = await calendarAPI.events.insert({
          calendarId: 'primary',
          conferenceDataVersion: 1,
          requestBody: {"""
          
new_insert = """        const event = await calendarAPI.events.insert({
          calendarId: 'primary',
          conferenceDataVersion: 1,
          sendUpdates: 'all',
          requestBody: {"""
ts = ts.replace(old_insert, new_insert)

with open(filename, "w", encoding="utf-8") as f:
    f.write(ts)

print("Added sendUpdates: all")
