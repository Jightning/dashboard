import { firefox } from "playwright";
import { spawn } from "node:child_process";

const PROJECT_DIR = "/home/jightning/projects/dashboard";
const URL = "http://localhost:1420";

function waitForServer(url, timeoutMs = 30000) {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        const tick = async () => {
            try {
                const res = await fetch(url);
                if (res.ok) return resolve();
            } catch {}
            if (Date.now() - start > timeoutMs) return reject(new Error("server timeout"));
            setTimeout(tick, 300);
        };
        tick();
    });
}

const server = spawn("npm", ["run", "dev"], { cwd: PROJECT_DIR, stdio: "pipe" });
try {
    await waitForServer(URL);
    console.log("SERVER READY");

    const browser = await firefox.launch();
    const page = await browser.newPage();

    page.on("console", (msg) => console.log(`[console.${msg.type()}]`, msg.text()));
    page.on("pageerror", (err) => console.log("[pageerror]", err.message));
    page.on("requestfailed", (req) =>
        console.log("[requestfailed]", req.url(), req.failure()?.errorText),
    );
    page.on("response", (res) => {
        if (res.url().includes("worker") || res.url().includes("sqlite")) {
            console.log("[response]", res.status(), res.url());
        }
    });

    await page.goto(URL);
    await page.waitForTimeout(6000);
    console.log("--- BODY TEXT after 6s ---");
    console.log((await page.locator("body").innerText()).slice(0, 2000));
    console.log("--- END BODY TEXT ---");

    await browser.close();
} catch (e) {
    console.error("CHECK FAILED:", e.message);
} finally {
    server.kill("SIGTERM");
}
