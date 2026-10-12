with open("prisma/schema.prisma", "r", encoding="utf-8") as f:
    schema = f.read()

# I mistakenly added `calendars Calendar[]` inside Calendar model. Let me remove it.
schema = schema.replace("  calendars    Calendar[]\n}", "}")

# And make sure it is inside User instead
if "calendars    Calendar[]" not in schema:
    schema = schema.replace("projects     Project[]", "projects     Project[]\n  calendars    Calendar[]")

with open("prisma/schema.prisma", "w", encoding="utf-8") as f:
    f.write(schema)

print("Schema fixed")
