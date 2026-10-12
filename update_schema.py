import re

with open("prisma/schema.prisma", "r", encoding="utf-8") as f:
    schema = f.read()

# Add models to the end
models = """

model Calendar {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  description String?
  timezone    String   @default("UTC")
  availability Json    // e.g. { "monday": ["09:00-17:00"] }
  duration    Int      @default(30) // Default meeting duration in minutes
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  meetings    Meeting[]
  projects    Project[]
}

model Meeting {
  id          String   @id @default(uuid())
  calendarId  String
  calendar    Calendar @relation(fields: [calendarId], references: [id], onDelete: Cascade)
  leadId      String?
  lead        Lead?    @relation(fields: [leadId], references: [id], onDelete: SetNull)
  guestName   String
  guestEmail  String
  startTime   DateTime
  endTime     DateTime
  status      String   @default("SCHEDULED") // SCHEDULED, CANCELED, COMPLETED
  notes       String?  @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
"""

if "model Calendar {" not in schema:
    schema += models

# Update User model to have calendars array
if "calendars    Calendar[]" not in schema:
    schema = re.sub(r"(projects\s+Project\[\])", r"\1\n  calendars    Calendar[]", schema)

# Update Project model to have calendarId and calendar
if "calendarId  String?" not in schema:
    schema = re.sub(
        r"(leads       Lead\[\]\s*\n})",
        r"leads       Lead[]\n    calendarId  String?\n    calendar    Calendar? @relation(fields: [calendarId], references: [id], onDelete: SetNull)\n}",
        schema
    )

# Update Lead model to have meetings array
if "meetings      Meeting[]" not in schema:
    schema = re.sub(
        r"(activities    Activity\[\])",
        r"\1\n    meetings      Meeting[]",
        schema
    )

with open("prisma/schema.prisma", "w", encoding="utf-8") as f:
    f.write(schema)

print("Schema updated successfully")
