/******************************************************************************
 * Global Concepts Media Operating System
 * Version 2 Foundation
 * ui.js
 ******************************************************************************/

const UI = {

    setStatus(status) {

        const element = document.getElementById("statusText");

        if (element) {
            element.textContent = status;
        }

    },

    updateDashboard(snapshot) {

        this.setText("businessName", snapshot.businessName);
        this.setText("industry", snapshot.industry);
        this.setText("market", snapshot.market);
        this.setText("websiteDisplay", snapshot.website);

        this.setText(
            "scoreDisplay",
            snapshot.qualificationScore
        );

        this.setText(
            "decisionDisplay",
            snapshot.decision
        );

    },

    updateReport(record) {

        const report =
            document.getElementById("reportOutput");

        if (!report) return;

        report.textContent =
            record.report || "No report generated.";

    },

    updateEmail(record) {

        const email =
            document.getElementById("emailOutput");

        if (!email) return;

        email.textContent =
            record.email || "No email generated.";

    },

    updateCallScript(record) {

        const script =
            document.getElementById("scriptOutput");

        if (!script) return;

        script.textContent =
            record.callScript || "No call script generated.";

    },

    updateMarkdown(markdown) {

        const output =
            document.getElementById("recordOutput");

        if (!output) return;

        output.textContent = markdown;

    },

    completeWorkflow() {

        this.activate("stepResearch");

        this.complete("stepResearch");

        this.activate("stepAnalyze");

        this.complete("stepAnalyze");

        this.activate("stepOutreach");

        this.complete("stepOutreach");

        this.activate("stepReady");

        this.complete("stepReady");

    },

    activate(id) {

        const element =
            document.getElementById(id);

        if (!element) return;

        element.classList.add("active");

    },

    complete(id) {

        const element =
            document.getElementById(id);

        if (!element) return;

        element.classList.remove("active");

        element.classList.add("done");

    },

    setText(id, value) {

        const element =
            document.getElementById(id);

        if (!element) return;

        element.textContent =
            value || "Unknown";

    }

};

/******************************************************************************
 * Outreach Tabs
 ******************************************************************************/

document.addEventListener("DOMContentLoaded", () => {

    const tabs =
        document.querySelectorAll(".tab");

    tabs.forEach(tab => {

        tab.addEventListener("click", () => {

            tabs.forEach(t =>
                t.classList.remove("active")
            );

            tab.classList.add("active");

            document
                .querySelectorAll(
                    "#emailOutput,#questionsOutput,#scriptOutput"
                )
                .forEach(panel =>
                    panel.classList.add("hidden")
                );

            switch (tab.dataset.tab) {

                case "email":
                    document
                        .getElementById("emailOutput")
                        .classList.remove("hidden");
                    break;

                case "questions":
                    document
                        .getElementById("questionsOutput")
                        .classList.remove("hidden");
                    break;

                case "script":
                    document
                        .getElementById("scriptOutput")
                        .classList.remove("hidden");
                    break;

            }

        });

    });

});

/******************************************************************************
 * Copy Markdown
 ******************************************************************************/

document.addEventListener("DOMContentLoaded", () => {

    const button =
        document.getElementById("copyRecordButton");

    if (!button) return;

    button.addEventListener("click", async () => {

        const text =
            document.getElementById("recordOutput").textContent;

        try {

            await navigator.clipboard.writeText(text);

            alert("Business Record copied.");

        }

        catch {

            alert("Unable to copy.");

        }

    });

});

/******************************************************************************
 * Download Markdown
 ******************************************************************************/

document.addEventListener("DOMContentLoaded", () => {

    const button =
        document.getElementById("downloadRecordButton");

    if (!button) return;

    button.addEventListener("click", () => {

        const text =
            document.getElementById("recordOutput").textContent;

        const blob =
            new Blob([text], {
                type: "text/markdown"
            });

        const url =
            URL.createObjectURL(blob);

        const a =
            document.createElement("a");

        a.href = url;

        a.download = "business-intelligence-brief.md";

        a.click();

        URL.revokeObjectURL(url);

    });

});
