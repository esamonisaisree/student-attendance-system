
const API = "/api";

const studentForm = document.getElementById("student-form");
const studentMessage = document.getElementById("student-message");
const attendanceMessage = document.getElementById("attendance-message");
const reportMessage = document.getElementById("report-message");

const attendanceDate = document.getElementById("attendance-date");
const periodSelect = document.getElementById("period");

const reportYear = document.getElementById("report-year");
const reportMonth = document.getElementById("report-month");

const studentBody = document.getElementById("student-body");
const attendanceList = document.getElementById("attendance-list");
const reportBody = document.getElementById("report-body");

let students = [];

// Format a date using local time, not UTC.
function getLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

// Safely display API responses and errors.
async function apiRequest(url, options = {}) {
    const response = await fetch(url, options);
    const contentType = response.headers.get("content-type") || "";

    let data;

    if (contentType.includes("application/json")) {
        data = await response.json();
    } else {
        data = await response.text();
    }

    if (!response.ok) {
        const message =
            typeof data === "object" && data !== null
                ? data.error || data.message
                : data;

        throw new Error(message || `Request failed: ${response.status}`);
    }

    return data;
}

function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.style.color = isError ? "#c62828" : "#218447";
}

// Display all students in the student table.
async function loadStudents() {
    try {
        students = await apiRequest(`${API}/students`);

        studentBody.replaceChildren();

        students.forEach(student => {
            const row = document.createElement("tr");

            [
                student.roll_number,
                student.name,
                student.department
            ].forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value ?? "";
                row.appendChild(cell);
            });

            studentBody.appendChild(row);
        });

        renderAttendanceList();
    } catch (error) {
        showMessage(
            studentMessage,
            `Could not load students: ${error.message}`,
            true
        );
    }
}

// Add a student.
studentForm.addEventListener("submit", async event => {
    event.preventDefault();

    const student = {
        roll_number: document.getElementById("roll-number").value.trim(),
        name: document.getElementById("student-name").value.trim(),
        department: document.getElementById("department").value.trim()
    };

    if (!student.roll_number || !student.name || !student.department) {
        showMessage(studentMessage, "Please fill in all fields.", true);
        return;
    }

    try {
        await apiRequest(`${API}/students`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(student)
        });

        studentForm.reset();

        showMessage(studentMessage, "Student added successfully.");

        await loadStudents();
    } catch (error) {
        showMessage(
            studentMessage,
            `Could not add student: ${error.message}`,
            true
        );
    }
});

// Build the attendance entry list for the selected period.
function renderAttendanceList() {
    attendanceList.replaceChildren();

    if (students.length === 0) {
        attendanceList.textContent = "No students found. Add a student first.";
        return;
    }

    students.forEach(student => {
        const row = document.createElement("div");
        row.className = "attendance-row";

        const name = document.createElement("span");
        name.textContent =
            `${student.roll_number} - ${student.name}`;

        const statusSelect = document.createElement("select");
        statusSelect.setAttribute(
            "aria-label",
            `Attendance status for ${student.name}`
        );

        [
            { value: "Present", label: "Present" },
            { value: "Absent", label: "Absent" }
        ].forEach(optionData => {
            const option = document.createElement("option");
            option.value = optionData.value;
            option.textContent = optionData.label;
            statusSelect.appendChild(option);
        });

        const saveButton = document.createElement("button");
        saveButton.type = "button";
        saveButton.textContent = "Save";

        saveButton.addEventListener("click", async () => {
            if (!attendanceDate.value) {
                showMessage(
                    attendanceMessage,
                    "Please select an attendance date.",
                    true
                );
                return;
            }

            saveButton.disabled = true;

            try {
                await apiRequest(`${API}/attendance`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        student_id: student.id,
                        attendance_date: attendanceDate.value,
                        period: Number(periodSelect.value),
                        status: statusSelect.value
                    })
                });

                showMessage(
                    attendanceMessage,
                    `Attendance saved for ${student.name}.`
                );

                await loadReport();
            } catch (error) {
                showMessage(
                    attendanceMessage,
                    `Could not save attendance: ${error.message}`,
                    true
                );
            } finally {
                saveButton.disabled = false;
            }
        });

        row.append(name, statusSelect, saveButton);
        attendanceList.appendChild(row);
    });
}

// Load and display the monthly report.
async function loadReport() {
    const year = Number(reportYear.value);
    const month = Number(reportMonth.value);

    if (
        !Number.isInteger(year) ||
        year < 2000 ||
        year > 2100 ||
        !Number.isInteger(month) ||
        month < 1 ||
        month > 12
    ) {
        showMessage(reportMessage, "Select a valid year and month.", true);
        return;
    }

    const query = `year=${year}&month=${month}`;

    document.getElementById("download-report").href =
        `${API}/reports/monthly/csv?${query}`;

    try {
        const report = await apiRequest(
            `${API}/reports/monthly?${query}`
        );

        reportBody.replaceChildren();

        report.forEach(student => {
            const row = document.createElement("tr");

            const values = [
                student.roll_number,
                student.name,
                student.department,
                student.total_periods,
                student.present_periods,
                student.absent_periods,
                `${student.attendance_percentage}%`,
                student.low_attendance ? "Low Attendance" : "Good"
            ];

            values.forEach((value, index) => {
                const cell = document.createElement("td");
                cell.textContent = value ?? "";

                if (index === 7) {
                    cell.className = student.low_attendance
                        ? "status-low"
                        : "status-good";
                }

                row.appendChild(cell);
            });

            reportBody.appendChild(row);
        });

        showMessage(
            reportMessage,
            `Monthly report loaded: ${report.length} student(s).`
        );
    } catch (error) {
        showMessage(
            reportMessage,
            `Could not load report: ${error.message}`,
            true
        );
    }
}

document.getElementById("load-report").addEventListener(
    "click",
    loadReport
);

// Changing the period refreshes the attendance entry list.
periodSelect.addEventListener("change", renderAttendanceList);

// Initialize the dashboard.
const today = new Date();

attendanceDate.value = getLocalDate();
reportYear.value = today.getFullYear();
reportMonth.value = today.getMonth() + 1;

document.getElementById("download-report").href =
    `${API}/reports/monthly/csv?year=${reportYear.value}&month=${reportMonth.value}`;

loadStudents();
loadReport();
