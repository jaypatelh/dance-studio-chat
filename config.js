// Configuration - placeholders will be replaced during build process
const config = {
    googleApiKey: '{{GOOGLE_API_KEY}}',
    openRouterApiKey: '{{OPENROUTER_API_KEY}}',
    ownerPhoneNumber: '+16509954591'
};

// For browser usage
if (typeof window !== 'undefined') {
    window.appConfig = config;
}

// For Node.js/CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
}
