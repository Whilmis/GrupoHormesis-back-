filename = "src/services/execution.engine.ts"
with open(filename, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("return `${frontendUrl}/portal/calendars/public/${calendarId}?token=${token}`;", "return `${frontendUrl}/book/${calendarId}?token=${token}`;")

with open(filename, "w", encoding="utf-8") as f:
    f.write(content)
