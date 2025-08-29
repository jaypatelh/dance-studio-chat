// Configuration - will be replaced at build time by Netlify
const config = {
    groqApiKey: process.env.GROQ_API_KEY || '',
    googleApiKey: process.env.GOOGLE_API_KEY || ''
};

// For browser usage
if (typeof window !== 'undefined') {
    window.appConfig = config;
}

// For Node.js/CommonJS
if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
}
