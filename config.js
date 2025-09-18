// Configuration - placeholders will be replaced during build process
const config = {
    googleApiKey: 'AIzaSyC96zgVPNsijSaPAUBOgEAY2r4o-g_Ou5E',
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
