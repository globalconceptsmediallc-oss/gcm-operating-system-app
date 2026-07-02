/******************************************************************************
 * Global Concepts Media Operating System
 * Version 2 Foundation
 * config.js
 ******************************************************************************/

const GCM_CONFIG = {

    APP_NAME: "Global Concepts Media Operating System",

    VERSION: "2.0 Foundation",

    COMPANY: "Global Concepts Media",

    /////////////////////////////////////////////////
    // OpenAI Configuration
    /////////////////////////////////////////////////

    OPENAI: {

        MODEL: "gpt-5.5",

        API_URL: "https://api.openai.com/v1/responses",

        API_KEY: ""

        // Never hard-code production API keys.
        // This value should be loaded from Settings
        // or a backend service in production.

    },

    /////////////////////////////////////////////////
    // Application Defaults
    /////////////////////////////////////////////////

    DEFAULTS: {

        TEMPERATURE: 0.2,

        MAX_OUTPUT_TOKENS: 6000,

        QUALIFICATION_THRESHOLD: 75

    },

    /////////////////////////////////////////////////
    // Dashboard Status
    /////////////////////////////////////////////////

    STATUS: {

        WAITING: "Awaiting New Opportunity",

        RESEARCHING: "Researching Website...",

        ANALYZING: "Analyzing Business...",

        BUILDING_REPORT: "Building Business Intelligence Brief...",

        GENERATING_EMAIL: "Generating First Contact Email...",

        GENERATING_SCRIPT: "Generating Discovery Call Script...",

        READY: "Ready For First Contact"

    },

    /////////////////////////////////////////////////
    // Export Options
    /////////////////////////////////////////////////

    EXPORT: {

        FILE_EXTENSION: ".md",

        COPY_SUCCESS: "Business record copied to clipboard.",

        DOWNLOAD_SUCCESS: "Business record downloaded."

    }

};

Object.freeze(GCM_CONFIG);
