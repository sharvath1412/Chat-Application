class Chatify {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.currentContact = null;
        this.contacts = [];
        this.typingTimer = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.showUserSetup();
    }

    initializeElements() {
        // Modals
        this.userSetupModal = document.getElementById('userSetupModal');
        
        // User setup
        this.userNameInput = document.getElementById('userNameInput');
        this.selectedAvatar = document.getElementById('selectedAvatar');
        this.startChattingBtn = document.getElementById('startChatting');
        
        // Sidebar
        this.contactsList = document.getElementById('contactsList');
        this.userAvatar = document.getElementById('userAvatar');
        this.userName = document.getElementById('userName');
        
        // Chat area
        this.defaultScreen = document.getElementById('defaultScreen');
        this.activeChat = document.getElementById('activeChat');
        this.messagesList = document.getElementById('messagesList');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.typingText = document.getElementById('typingText');
        
        // Contact info
        this.contactAvatar = document.getElementById('contactAvatar');
        this.contactName = document.getElementById('contactName');
        this.contactStatus = document.getElementById('contactStatus');
    }

    setupEventListeners() {
        // User setup
        this.startChattingBtn.addEventListener('click', () => this.setupUser());
        document.querySelectorAll('.avatar-option').forEach(option => {
            option.addEventListener('click', (e) => this.selectAvatar(e.target));
        });

        // Message sending
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Typing indicators
        this.messageInput.addEventListener('input', () => this.handleTyping());
        
        // Avatar selection in user setup
        document.querySelectorAll('.avatar-option').forEach(option => {
            option.addEventListener('click', (e) => {
                const avatar = e.target.getAttribute('data-avatar');
                this.selectedAvatar.textContent = avatar;
                
                // Update selection
                document.querySelectorAll('.avatar-option').forEach(opt => {
                    opt.classList.remove('selected');
                });
                e.target.classList.add('selected');
            });
        });

        // Enter key in user setup
        this.userNameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.setupUser();
            }
        });
    }

    showUserSetup() {
        this.userSetupModal.classList.remove('hidden');
        this.userNameInput.focus();
    }

    hideUserSetup() {
        this.userSetupModal.classList.add('hidden');
    }

    selectAvatar(avatarElement) {
        document.querySelectorAll('.avatar-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        avatarElement.classList.add('selected');
        this.selectedAvatar.textContent = avatarElement.textContent;
    }

    setupUser() {
        const name = this.userNameInput.value.trim();
        const avatar = this.selectedAvatar.textContent;

        if (!name) {
            alert('Please enter your name');
            return;
        }

        this.currentUser = { name, avatar };
        this.userAvatar.textContent = avatar;
        this.userName.textContent = name;

        this.initializeSocket();
        this.hideUserSetup();
    }

    initializeSocket() {
        this.socket = io();

        // Send user setup data
        this.socket.emit('user_setup', {
            name: this.currentUser.name,
            avatar: this.currentUser.avatar
        });

        // Socket event listeners
        this.socket.on('contacts_data', (contacts) => {
            this.contacts = contacts;
            this.renderContacts();
        });

        this.socket.on('chat_history', (data) => {
            this.renderChatHistory(data.messages);
        });

        this.socket.on('new_message', (data) => {
            if (this.currentContact && data.contactId === this.currentContact.id) {
                this.displayMessage(data.message, 'received');
                this.scrollToBottom();
                
                // Mark as read
                this.socket.emit('message_read', {
                    messageId: data.message.id,
                    contactId: data.contactId
                });
            }
            this.updateContactLastMessage(data.contactId, data.message);
        });

        this.socket.on('message_sent', (message) => {
            this.displayMessage(message, 'sent');
            this.scrollToBottom();
        });

        this.socket.on('message_status_update', (data) => {
            this.updateMessageStatus(data.messageId, data.status);
        });

        this.socket.on('user_typing', (data) => {
            if (this.currentContact && data.contactId === this.currentContact.id) {
                this.showTypingIndicator(data.userId);
            }
        });

        this.socket.on('user_stop_typing', (data) => {
            if (this.currentContact && data.contactId === this.currentContact.id) {
                this.hideTypingIndicator();
            }
        });

        this.socket.on('user_status_change', (data) => {
            this.updateUserStatus(data.userId, data.status, data.lastSeen);
        });
    }

    renderContacts() {
        this.contactsList.innerHTML = '';
        
        this.contacts.forEach(contact => {
            const contactElement = document.createElement('div');
            contactElement.className = 'contact-item';
            contactElement.innerHTML = `
                <div class="avatar contact-avatar">${contact.avatar}</div>
                <div class="contact-details">
                    <div class="contact-name">${contact.name}</div>
                    <div class="contact-last-message">${contact.status}</div>
                </div>
                <div class="contact-meta">
                    <div class="contact-time">${this.formatTime(contact.lastSeen)}</div>
                </div>
            `;
            
            contactElement.addEventListener('click', () => this.selectContact(contact));
            this.contactsList.appendChild(contactElement);
        });
    }

    selectContact(contact) {
        this.currentContact = contact;
        
        // Update UI
        document.querySelectorAll('.contact-item').forEach(item => {
            item.classList.remove('active');
        });
        event.currentTarget.classList.add('active');
        
        // Show chat area
        this.defaultScreen.classList.add('hidden');
        this.activeChat.classList.remove('hidden');
        
        // Update contact info
        this.contactAvatar.textContent = contact.avatar;
        this.contactName.textContent = contact.name;
        this.contactStatus.textContent = this.getContactStatusText(contact);
        
        // Load chat history
        this.socket.emit('get_chat_history', contact.id);
        this.messageInput.focus();
    }

    getContactStatusText(contact) {
        if (contact.isGroup) {
            return `${contact.members} members`;
        }
        
        switch (contact.status) {
            case 'Online':
                return 'online';
            case 'Away':
                return `last seen ${this.formatLastSeen(contact.lastSeen)}`;
            case 'Offline':
                return `last seen ${this.formatLastSeen(contact.lastSeen)}`;
            default:
                return 'click here for contact info';
        }
    }

    renderChatHistory(messages) {
        this.messagesList.innerHTML = '';
        messages.forEach(message => {
            this.displayMessage(message, message.sender === 'current' ? 'sent' : 'received');
        });
        this.scrollToBottom();
    }

    displayMessage(message, type) {
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.dataset.messageId = message.id;
        
        const time = this.formatTime(message.timestamp);
        const statusIcon = type === 'sent' ? this.getStatusIcon(message.status) : '';
        
        messageElement.innerHTML = `
            <div class="message-text">${this.escapeHtml(message.text)}</div>
            <div class="message-time">
                ${time}
                ${statusIcon}
            </div>
        `;
        
        this.messagesList.appendChild(messageElement);
    }

    getStatusIcon(status) {
        switch (status) {
            case 'sent':
                return '<i class="fas fa-check message-status"></i>';
            case 'delivered':
                return '<i class="fas fa-check-double message-status"></i>';
            case 'read':
                return '<i class="fas fa-check-double message-status" style="color: var(--whatsapp-green);"></i>';
            default:
                return '';
        }
    }

    updateMessageStatus(messageId, status) {
        const messageElement = this.messagesList.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            const statusElement = messageElement.querySelector('.message-status');
            if (statusElement) {
                statusElement.outerHTML = this.getStatusIcon(status);
            }
        }
    }

    sendMessage() {
        const text = this.messageInput.value.trim();
        
        if (!text || !this.currentContact) return;
        
        this.socket.emit('send_message', {
            contactId: this.currentContact.id,
            text: text
        });
        
        this.messageInput.value = '';
        this.stopTyping();
    }

    handleTyping() {
        if (!this.typingTimer && this.currentContact) {
            this.socket.emit('typing_start', this.currentContact.id);
        }
        
        clearTimeout(this.typingTimer);
        this.typingTimer = setTimeout(() => {
            this.stopTyping();
        }, 1000);
    }

    stopTyping() {
        if (this.typingTimer && this.currentContact) {
            clearTimeout(this.typingTimer);
            this.typingTimer = null;
            this.socket.emit('typing_stop', this.currentContact.id);
        }
    }

    showTypingIndicator(userId) {
        const user = this.contacts.find(c => c.id === userId);
        if (user) {
            this.typingText.textContent = `${user.name} is typing`;
            this.typingIndicator.style.display = 'flex';
        }
    }

    hideTypingIndicator() {
        this.typingIndicator.style.display = 'none';
    }

    updateContactLastMessage(contactId, message) {
        // Update the contact's last message in the sidebar
        const contactElement = this.contactsList.querySelector(`[data-contact-id="${contactId}"]`);
        if (contactElement) {
            const lastMessageElement = contactElement.querySelector('.contact-last-message');
            lastMessageElement.textContent = message.text;
        }
    }

    updateUserStatus(userId, status, lastSeen) {
        const contact = this.contacts.find(c => c.id === userId);
        if (contact) {
            contact.status = status;
            contact.lastSeen = lastSeen;
            
            if (this.currentContact && this.currentContact.id === userId) {
                this.contactStatus.textContent = this.getContactStatusText(contact);
            }
            
            this.renderContacts();
        }
    }

    formatTime(timestamp) {
        if (!timestamp) return '';
        return moment(timestamp).format('HH:mm');
    }

    formatLastSeen(timestamp) {
        if (!timestamp) return '';
        return moment(timestamp).fromNow();
    }

    scrollToBottom() {
        this.messagesList.scrollTop = this.messagesList.scrollHeight;
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new Chatify();
});