// Additional Studio Context for LLM
// This file contains comprehensive information about the dance studio
// beyond just class schedules, including billing, policies, and general information

window.STUDIO_CONTEXT = `
Dance Season:
- 2025-2026: Sept 8 to June 15 (10-month)
- Registration fee: $65 at sign-up

Monthly Tuition (Sept–June):
- Drop-in: $35
- 1 class/week: $100
- 2 classes/week: $195
- 3 classes/week: $285
- 4 classes/week: $365
- 5 classes/week: $445
- 6–8 classes/week: $515
- 9+ classes: add $25 per class
- Family (6–8 classes each): 2 dancers → $700; 3 dancers → $975
- Competition Solo/Duo/Trio: $50

Billing & Payments:
- Monthly fixed rate, regardless of number of classes per month
- Auto–credit-card only; no cash/check
- Due 1st; delinquent if not paid by 6 pm on 5th
- $15 late charge if payment declined and not updated before 5th
- Billing inquiries: admin@tdcoflosgatos.com

Refunds & Class Changes:
- No refunds after first class
- Class changes via email; transfer if space; new class start next week
- Full withdrawal: email two weeks before month; otherwise tuition continues
- Re-registration fee: $25 if re-enroll in same dance season
- Class cancellation (<4 dancers): full refund if no alternative available

Attendance & Studio Rules:
- Regular attendance required
- Dress code: hair in bun for ballet; ponytail for others
- Arrive 10 min early; >15 min late may affect participation
- No food/drinks/gum in studio/lobby (water OK)
- No make-ups; canceled class by teacher → a make-up scheduled at later date; if substitute offered and declined → no refund

Showcase (mid-June):
- All enrolled dancers participate
- Costume charges in early March
- No costume refunds after March deadline

Behavior & Social Media:
- Courtesy and respect expected from dancers and parents
- No mocking, teasing, harassment, gossip, sharing secrets via text or social media
- Inappropriate language or embarrassing photos/photos about dancers/family/studio prohibited

Recital & Observation:
- Recital is optional but common; costumes ordered in February; classes locked
- Closed-door policy: parents may observe first week each month via lobby windows only

Dress Code by Class:
- Combo/Tiny Tots: any leotard + skirt (above knee), ballet & tap shoes
- Pre Ballet: ballet shoes only, no tap shoes
- Jazz: any leotard/dance attire, no baggy clothing, jazz shoes required
- Lyrical: any leotard/dance attire, no baggy clothing, jazz or lyrical shoes
- Ballet: black leotard (no skirt), pink tights, pink ballet shoes, bun hair – no exceptions
- Tumbling: any leotard/dance attire, no baggy clothes, no shoes or full-footed tights
- Hip Hop: comfortable clothing, no tight jeans, skirts, flip-flops, elevated shoes; sneakers preferred
- Tap: comfortable attire, no dragging pants, visible feet, tap shoes required
- Flex/Turns/Jumps: any leotard/dance attire, no baggy clothing
`;

// Function to get studio context for LLM prompts
function getStudioContext() {
    return window.STUDIO_CONTEXT;
}

// Debug: Log when this file loads
console.log('studio-context.js loaded');
console.log('STUDIO_CONTEXT length:', window.STUDIO_CONTEXT ? window.STUDIO_CONTEXT.length : 'undefined');

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { STUDIO_CONTEXT: window.STUDIO_CONTEXT, getStudioContext };
}
