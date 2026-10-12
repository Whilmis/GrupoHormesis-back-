with open("src/index.ts", "r", encoding="utf-8") as f:
    ts = f.read()

if "import calendarRoutes" not in ts:
    ts = ts.replace("import leadRoutes from './routes/lead.routes';", "import leadRoutes from './routes/lead.routes';\nimport calendarRoutes from './routes/calendar.routes';")

if "/api/calendars" not in ts:
    ts = ts.replace("app.use('/api/leads', leadRoutes);", "app.use('/api/leads', leadRoutes);\napp.use('/api/calendars', calendarRoutes);")

with open("src/index.ts", "w", encoding="utf-8") as f:
    f.write(ts)
print("index.ts updated")
