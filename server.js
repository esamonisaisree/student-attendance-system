
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
console.log("Loaded server file:", __filename);
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Database connection
const db = new sqlite3.Database(
    path.join(__dirname, "attendance.db"),
    (err) => {
        if (err) {
            console.error("Database connection failed:", err.message);
        } else {
            console.log("Connected to SQLite database.");
        }
    }
);

// Home route
app.get("/api/health", (req, res) => {
    res.json({
        message: "Student Attendance Management System backend is running!"
    });
});

// Get all students
app.get("/api/students", (req, res) => {
    db.all(
        "SELECT * FROM students ORDER BY roll_number",
        [],
        (err, rows) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }

            res.json(rows);
        }
    );
});

// Add a student
app.post("/api/students", (req, res) => {
    const { roll_number, name, department } = req.body;

    if (
        typeof roll_number !== "string" ||
        typeof name !== "string" ||
        typeof department !== "string" ||
        !roll_number.trim() ||
        !name.trim() ||
        !department.trim()
    ) {
        return res.status(400).json({
            error: "Roll number, name, and department are required."
        });
    }

    db.run(
        `INSERT INTO students (roll_number, name, department)
         VALUES (?, ?, ?)`,
        [roll_number.trim(), name.trim(), department.trim()],
        function (err) {
            if (err) {
                if (err.code === "SQLITE_CONSTRAINT") {
                    return res.status(409).json({
                        error: "This roll number already exists."
                    });
                }

                return res.status(500).json({ error: err.message });
            }

            res.status(201).json({
                message: "Student added successfully!",
                student: {
                    id: this.lastID,
                    roll_number: roll_number.trim(),
                    name: name.trim(),
                    department: department.trim()
                }
            });
        }
    );
});

 // Record attendance for a student and period
app.post("/api/attendance", (req, res) => {
    const { student_id, attendance_date, period, status } = req.body;

    if (
        !Number.isInteger(student_id) ||
        student_id <= 0 ||
        typeof attendance_date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(attendance_date) ||
        !Number.isInteger(period) ||
        period < 1 ||
        period > 7 ||
        !["Present", "Absent"].includes(status)
    ) {
        return res.status(400).json({
            error: "Provide a valid student_id, date, period (1-7), and status (Present or Absent)."
        });
    }

    db.run(
        `INSERT INTO attendance
         (student_id, attendance_date, period, status)
         VALUES (?, ?, ?, ?)`,
        [student_id, attendance_date, period, status],
        function (err) {
            if (err) {
                if (err.code === "SQLITE_CONSTRAINT") {
                    return res.status(409).json({
                        error: "Attendance already exists for this student, date, and period, or the student does not exist."
                    });
                }

                return res.status(500).json({ error: err.message });
            }

            res.status(201).json({
                message: "Attendance recorded successfully!",
                attendance_id: this.lastID
            });
        }
    );
});

// View attendance records
app.get("/api/attendance", (req, res) => {
    const { date, student_id } = req.query;

    let sql = `
        SELECT a.id, s.roll_number, s.name, s.department,
               a.student_id, a.attendance_date, a.period, a.status
        FROM attendance a
        JOIN students s ON s.id = a.student_id
    `;

    const conditions = [];
    const params = [];

    if (date) {
        conditions.push("a.attendance_date = ?");
        params.push(date);
    }

    if (student_id) {
        conditions.push("a.student_id = ?");
        params.push(student_id);
    }

    if (conditions.length) {
        sql += " WHERE " + conditions.join(" AND ");
    }

    sql += " ORDER BY a.attendance_date DESC, s.roll_number, a.period";

    db.all(sql, params, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        res.json(rows);
    });
});
app.get("/api/debug-routes", (req, res) => {
    res.json({
        expressVersion: require("express/package.json").version,
        attendanceGetRegistered: typeof app.router,
        message: "Debug endpoint is working"
    });
});
function getMonthlyReport(year, month, callback) {
    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;

    const endDate = new Date(year, month, 1)
        .toISOString()
        .split("T")[0];

    const sql = `
        SELECT
            s.id AS student_id,
            s.roll_number,
            s.name,
            s.department,
            COUNT(a.id) AS total_periods,
            COALESCE(SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END),0) AS present_periods,
            COALESCE(SUM(CASE WHEN a.status='Absent' THEN 1 ELSE 0 END),0) AS absent_periods
        FROM students s
        LEFT JOIN attendance a
            ON s.id = a.student_id
            AND a.attendance_date >= ?
            AND a.attendance_date < ?
        GROUP BY s.id
        ORDER BY s.roll_number
    `;

    db.all(sql, [startDate, endDate], (err, rows) => {
        if (err) return callback(err);

        const report = rows.map(row => {
            const percentage =
                row.total_periods === 0
                    ? 0
                    : Number(
                        (
                            row.present_periods /
                            row.total_periods *
                            100
                        ).toFixed(2)
                    );

            return {
                ...row,
                attendance_percentage: percentage,
                low_attendance: percentage < 75
            };
        });

        callback(null, report);
    });
}

// Monthly Report API
app.get("/api/reports/monthly", (req, res) => {
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    if (!year || !month) {
        return res.status(400).json({
            error: "Provide year and month."
        });
    }

    getMonthlyReport(year, month, (err, report) => {
        if (err)
            return res.status(500).json({
                error: err.message
            });

        res.json(report);
    });
});

// CSV Export API
app.get("/api/reports/monthly/csv", (req, res) => {
    const year = Number(req.query.year);
    const month = Number(req.query.month);

    getMonthlyReport(year, month, (err, report) => {
        if (err)
            return res.status(500).json({
                error: err.message
            });

        let csv =
            "Roll Number,Name,Department,Total Periods,Present,Absent,Percentage,Low Attendance\n";

        report.forEach(r => {
            csv += `${r.roll_number},${r.name},${r.department},${r.total_periods},${r.present_periods},${r.absent_periods},${r.attendance_percentage},${r.low_attendance ? "Yes" : "No"}\n`;
        });

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=attendance-report.csv"
        );

        res.send(csv);
    });
});
    // Start server

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
