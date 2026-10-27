
const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./attendance.db", (err) => {
    if (err) {
        console.error("Database connection failed:", err.message);
        return;
    }

    console.log("SQLite database connected successfully!");
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            roll_number TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            department TEXT NOT NULL
        )
    `, (err) => {
        if (err) {
            console.error("Students table error:", err.message);
        } else {
            console.log("Students table created successfully!");
        }
    });

    db.run(`
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            attendance_date TEXT NOT NULL,
            period INTEGER NOT NULL CHECK(period BETWEEN 1 AND 7),
            status TEXT NOT NULL CHECK(status IN ('Present', 'Absent')),
            UNIQUE(student_id, attendance_date, period),
            FOREIGN KEY(student_id) REFERENCES students(id)
        )
    `, (err) => {
        if (err) {
            console.error("Attendance table error:", err.message);
        } else {
            console.log("Attendance table created successfully!");
        }

        db.close();
    });
});
