with open("src/routes/calendar.routes.ts", "r", encoding="utf-8") as f:
    ts = f.read()

ts = ts.replace("authMiddleware", "requireAuth")

with open("src/routes/calendar.routes.ts", "w", encoding="utf-8") as f:
    f.write(ts)
print("calendar.routes.ts updated")
