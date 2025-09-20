// Admin Dashboard JavaScript
class ConversationDashboard {
    constructor() {
        this.conversations = [];
        this.filteredConversations = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.searchTerm = '';
        this.sortBy = 'newest';
        
        this.initializeElements();
        this.attachEventListeners();
        this.loadConversations();
    }

    initializeElements() {
        this.elements = {
            searchInput: document.getElementById('searchInput'),
            sortSelect: document.getElementById('sortSelect'),
            refreshBtn: document.getElementById('refreshBtn'),
            loadingState: document.getElementById('loadingState'),
            errorState: document.getElementById('errorState'),
            emptyState: document.getElementById('emptyState'),
            conversationsList: document.getElementById('conversationsList'),
            pagination: document.getElementById('pagination'),
            prevBtn: document.getElementById('prevBtn'),
            nextBtn: document.getElementById('nextBtn'),
            pageInfo: document.getElementById('pageInfo'),
            totalConversations: document.getElementById('totalConversations'),
            todayConversations: document.getElementById('todayConversations'),
            totalMessages: document.getElementById('totalMessages'),
            avgMessagesPerConv: document.getElementById('avgMessagesPerConv')
        };
    }

    attachEventListeners() {
        this.elements.searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.filterAndSort();
        });

        this.elements.sortSelect.addEventListener('change', (e) => {
            this.sortBy = e.target.value;
            this.filterAndSort();
        });

        this.elements.refreshBtn.addEventListener('click', () => {
            this.loadConversations();
        });

        this.elements.prevBtn.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderConversations();
            }
        });

        this.elements.nextBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(this.filteredConversations.length / this.itemsPerPage);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderConversations();
            }
        });
    }

    async loadConversations() {
        this.showLoading();
        
        try {
            const response = await fetch('/.netlify/functions/get-conversations', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.success) {
                this.conversations = data.conversations || [];
                this.filterAndSort();
                this.updateStats();
                this.hideLoading();
            } else {
                throw new Error(data.error || 'Failed to load conversations');
            }
        } catch (error) {
            console.error('Error loading conversations:', error);
            this.showError();
        }
    }

    filterAndSort() {
        // Filter conversations based on search term
        this.filteredConversations = this.conversations.filter(conv => {
            if (!this.searchTerm) return true;
            
            const searchableText = [
                conv.conversation_id,
                JSON.stringify(conv.user_preferences),
                conv.messages.map(m => m.content).join(' ')
            ].join(' ').toLowerCase();
            
            return searchableText.includes(this.searchTerm);
        });

        // Sort conversations
        this.filteredConversations.sort((a, b) => {
            switch (this.sortBy) {
                case 'newest':
                    return new Date(b.updated_at) - new Date(a.updated_at);
                case 'oldest':
                    return new Date(a.updated_at) - new Date(b.updated_at);
                case 'most_messages':
                    return b.messages.length - a.messages.length;
                default:
                    return new Date(b.updated_at) - new Date(a.updated_at);
            }
        });

        this.currentPage = 1;
        this.renderConversations();
    }

    renderConversations() {
        if (this.filteredConversations.length === 0) {
            this.showEmpty();
            return;
        }

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageConversations = this.filteredConversations.slice(startIndex, endIndex);

        const conversationsHTML = pageConversations.map(conv => this.renderConversationItem(conv)).join('');
        
        this.elements.conversationsList.innerHTML = conversationsHTML;
        this.updatePagination();
        
        // Show the conversations list
        this.elements.conversationsList.style.display = 'block';
        this.elements.emptyState.style.display = 'none';
    }

    renderConversationItem(conversation) {
        const createdAt = new Date(conversation.timestamp);
        const updatedAt = new Date(conversation.updated_at);
        const messageCount = conversation.messages.length;
        const userMessages = conversation.messages.filter(m => m.role === 'user').length;
        const assistantMessages = conversation.messages.filter(m => m.role === 'assistant').length;

        // Format preferences
        const preferences = conversation.user_preferences || {};
        const preferencesHTML = Object.entries(preferences)
            .filter(([key, value]) => value !== null && value !== undefined && value !== '')
            .map(([key, value]) => `<span class="preferences-item">${key}: ${value}</span>`)
            .join('');

        // Format messages preview
        const messagesHTML = conversation.messages
            .slice(-6) // Show last 6 messages
            .map(message => `
                <div class="message ${message.role}">
                    <div class="message-role">${message.role}</div>
                    <div class="message-content">${this.truncateText(message.content, 150)}</div>
                </div>
            `).join('');

        return `
            <div class="conversation-item" data-conversation-id="${conversation.conversation_id}">
                <div class="conversation-header">
                    <div class="conversation-info">
                        <div class="conversation-id">${conversation.conversation_id}</div>
                        <div class="conversation-time">
                            Created: ${this.formatDate(createdAt)} | 
                            Updated: ${this.formatDate(updatedAt)}
                        </div>
                    </div>
                    <div class="conversation-stats">
                        <div>${messageCount} messages</div>
                        <div>${userMessages} user, ${assistantMessages} assistant</div>
                    </div>
                </div>
                
                ${preferencesHTML ? `
                    <div class="user-preferences">
                        <strong>User Preferences:</strong><br>
                        ${preferencesHTML}
                    </div>
                ` : ''}
                
                <div class="messages-preview">
                    ${messagesHTML || '<p style="color: #718096; font-style: italic;">No messages</p>'}
                </div>
            </div>
        `;
    }

    updateStats() {
        const total = this.conversations.length;
        const today = new Date().toDateString();
        const todayCount = this.conversations.filter(conv => 
            new Date(conv.timestamp).toDateString() === today
        ).length;
        
        const totalMessages = this.conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
        const avgMessages = total > 0 ? (totalMessages / total).toFixed(1) : 0;

        this.elements.totalConversations.textContent = total;
        this.elements.todayConversations.textContent = todayCount;
        this.elements.totalMessages.textContent = totalMessages;
        this.elements.avgMessagesPerConv.textContent = avgMessages;
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredConversations.length / this.itemsPerPage);
        
        if (totalPages <= 1) {
            this.elements.pagination.style.display = 'none';
            return;
        }

        this.elements.pagination.style.display = 'flex';
        this.elements.prevBtn.disabled = this.currentPage === 1;
        this.elements.nextBtn.disabled = this.currentPage === totalPages;
        this.elements.pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
    }

    showLoading() {
        this.elements.loadingState.style.display = 'block';
        this.elements.errorState.style.display = 'none';
        this.elements.emptyState.style.display = 'none';
        this.elements.conversationsList.style.display = 'none';
        this.elements.pagination.style.display = 'none';
    }

    hideLoading() {
        this.elements.loadingState.style.display = 'none';
    }

    showError() {
        this.elements.loadingState.style.display = 'none';
        this.elements.errorState.style.display = 'block';
        this.elements.emptyState.style.display = 'none';
        this.elements.conversationsList.style.display = 'none';
        this.elements.pagination.style.display = 'none';
    }

    showEmpty() {
        this.elements.loadingState.style.display = 'none';
        this.elements.errorState.style.display = 'none';
        this.elements.emptyState.style.display = 'block';
        this.elements.conversationsList.style.display = 'none';
        this.elements.pagination.style.display = 'none';
    }

    formatDate(date) {
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ConversationDashboard();
});

// Add some utility functions for potential future features
window.dashboardUtils = {
    exportConversations: async function() {
        try {
            const response = await fetch('/.netlify/functions/get-conversations');
            const data = await response.json();
            
            if (data.success) {
                const blob = new Blob([JSON.stringify(data.conversations, null, 2)], {
                    type: 'application/json'
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `conversations-${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Error exporting conversations:', error);
            alert('Failed to export conversations');
        }
    },

    downloadConversationCSV: function(conversations) {
        const headers = ['ID', 'Created', 'Updated', 'Messages', 'User Age', 'Style Preference', 'Day Preference'];
        const csvContent = [
            headers.join(','),
            ...conversations.map(conv => [
                conv.conversation_id,
                conv.timestamp,
                conv.updated_at,
                conv.messages.length,
                conv.user_preferences?.age || '',
                conv.user_preferences?.style || '',
                conv.user_preferences?.dayPreference || ''
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `conversations-summary-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};
