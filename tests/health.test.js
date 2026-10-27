
const assert = require("node:assert/strict");
const http = require("node:http");
const { spawn } = require("node:child_process");
const path = require("node:path");

const projectDir = path.resolve(__dirname, "..");
const port = 3101;
const baseUrl = `http://127.0.0.1:${port}`;

async function waitForServer(child) {
    for (let attempt = 0; attempt < 40; attempt++) {
        if (child.exitCode !== null) {
            throw new Error("Server exited before becoming ready.");
        }

        try {
            const response = await fetch(`${baseUrl}/api/health`);
            return response;
        } catch {
            await new Promise(resolve => setTimeout(resolve, 250));
        }
    }

    throw new Error("Server did not become ready in time.");
}

async function main() {
    const child = spawn(
        process.execPath,
        [path.join(projectDir, "server.js")],
        {
            cwd: projectDir,
            env: { ...process.env, PORT: String(port) },
            stdio: "ignore"
        }
    );

    try {
        const response = await waitForServer(child);
        assert.equal(response.status, 200);

        const data = await response.json();
        assert.equal(
            data.message,
            "Student Attendance Management System backend is running!"
        );

        console.log("PASS: Health API returns HTTP 200 and the expected message.");
    } finally {
        child.kill();
    }
}

main().catch(error => {
    console.error("FAIL:", error.message);
    process.exitCode = 1;
});
