// Configuration - placeholders will be replaced during build process - Updated API key
const config = {
    googleApiKey: 'AIzaSyC2Ru0Ov7RaNBwXwF0nbGvEhQsurkbNFnM',
    openRouterApiKey: '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',
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
