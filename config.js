// Configuration - placeholders will be replaced during build process
const config = {
    openRouterApiKey: '{{OPENROUTER_API_KEY}}',
    googleApiKey: '{{GOOGLE_API_KEY}}'
};

// For browser usage
if (typeof window !== 'undefined') {
    window.appConfig = config;
}

// For Node.js/CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
}
