/******************************************************************************
 * Global Concepts Media Operating System
 * Version 2 Foundation
 * app.js
 ******************************************************************************/

const App = {

    currentRecord: null,

    initialize() {

        console.log(GCM_CONFIG.APP_NAME);
        console.log("Version:", GCM_CONFIG.VERSION);

        this.bindEvents();

    },

    bindEvents() {

        const button = document.getElementById("researchButton");

        if (button) {

            button.addEventListener("click", () => {

                this.analyzeProspect();

            });

        }

    },

    async analyzeProspect() {

        const website =
            document.getElementById("websiteInput").value.trim();

        const business =
            document.getElementById("businessInput").value.trim();

        const referral =
            document.getElementById("referralInput").value.trim();

        const campaign =
            document.getElementById("campaignInput").value.trim();

        if (!website) {

            alert("Please enter a website URL.");

            return;

        }

        UI.setStatus(GCM_CONFIG.STATUS.RESEARCHING);

        try {

            const prompt = this.buildPrompt({

                website,

                business,

                referral,

                campaign

            });

            const aiResponse = await this.callOpenAI(prompt);

            UI.setStatus(GCM_CONFIG.STATUS.ANALYZING);

            const parsed =
                parseBusinessResponse(aiResponse);

            this.currentRecord = parsed.record;

            UI.updateDashboard(parsed.snapshot);

            UI.updateReport(parsed.record);

            UI.updateEmail(parsed.record);

            UI.updateCallScript(parsed.record);

            UI.updateMarkdown(parsed.markdown);

            UI.setStatus(GCM_CONFIG.STATUS.READY);

            UI.completeWorkflow();

        }

        catch (error) {

            console.error(error);

            UI.setStatus("Research Failed");

            alert("Unable to complete research.");

        }

    },

    buildPrompt(data) {

        return `

${GCM_PROMPTS.BUSINESS_INTELLIGENCE}

Business Website

${data.website}

Business Name

${data.business || "Unknown"}

Referral Source

${data.referral || "Unknown"}

Campaign

${data.campaign || "Unknown"}

`;

    },

    async callOpenAI(prompt) {

        /*
        **************************************
        TEMPORARY PLACEHOLDER

        Next phase connects to OpenAI.

        This placeholder lets us finish
        the UI first.
        **************************************
        */

        console.log(prompt);

        return JSON.stringify({

            businessName: "Sample Business",

            website:
                document.getElementById("websiteInput").value,

            industry: "Unknown",

            market: "Unknown",

            primaryService: "Unknown",

            qualificationScore: 82,

            decision: "YES",

            outreachReady: true,

            report:
                "Business Intelligence Brief will appear here.",

            email:
                "Draft first contact email.",

            callScript:
                "Discovery call script."

        });

    }

};

window.addEventListener("DOMContentLoaded", () => {

    App.initialize();

});
