const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const moment = require('moment');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Store users and chats
const users = new Map();
const chats = new Map(); // roomId -> messages

// Sample contacts data
const sampleContacts = [
  { id: '1', name: 'John Doe', avatar: '👨', status: 'Online', lastSeen: null },
  { id: '2', name: 'Jane Smith', avatar: '👩', status: 'Away', lastSeen: moment().subtract(30, 'minutes').toISOString() },
  { id: '3', name: 'Mike Johnson', avatar: '👨‍💼', status: 'Offline', lastSeen: moment().subtract(2, 'hours').toISOString() },
  { id: '4', name: 'Sarah Wilson', avatar: '👩‍🎓', status: 'Online', lastSeen: null },
  { id: '5', name: 'Work Group', avatar: '👥', status: 'Group', members: 8, isGroup: true }
];

// Initialize sample chats
sampleContacts.forEach(contact => {
  if (!chats.has(contact.id)) {
    chats.set(contact.id, []);
  }
});

// Add some sample messages
chats.get('1').push(
  { id: '1', sender: '1', text: 'Hey there! How are you?', timestamp: moment().subtract(2, 'hours').toISOString(), status: 'delivered' },
  { id: '2', sender: 'current', text: "I'm good! Working on a new project.", timestamp: moment().subtract(1, 'hours').toISOString(), status: 'read' },
  { id: '3', sender: '1', text: 'That sounds interesting! Tell me more.', timestamp: moment().subtract(30, 'minutes').toISOString(), status: 'delivered' }
);

chats.get('2').push(
  { id: '4', sender: '2', text: 'Are we still meeting tomorrow?', timestamp: moment().subtract(1, 'day').toISOString(), status: 'read' },
  { id: '5', sender: 'current', text: 'Yes, 2 PM at the usual place.', timestamp: moment().subtract(1, 'day').toISOString(), status: 'read' }
);

chats.get('5').push(
  { id: '6', sender: '4', text: 'Team meeting scheduled for Friday', timestamp: moment().subtract(3, 'hours').toISOString(), status: 'delivered' },
  { id: '7', sender: '3', text: "I'll prepare the presentation", timestamp: moment().subtract(2, 'hours').toISOString(), status: 'delivered' }
);

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle user setup
  socket.on('user_setup', (userData) => {
    users.set(socket.id, {
      id: socket.id,
      name: userData.name,
      avatar: userData.avatar,
      status: 'online'
    });

    // Send contacts and initial data
    socket.emit('contacts_data', sampleContacts);
    
    // Notify others about online status
    socket.broadcast.emit('user_status_change', {
      userId: 'current', // In real app, this would be user ID
      status: 'online'
    });
  });

  // Handle get chat history
  socket.on('get_chat_history', (contactId) => {
    const chatHistory = chats.get(contactId) || [];
    socket.emit('chat_history', {
      contactId,
      messages: chatHistory
    });
  });

  // Handle sending message
  socket.on('send_message', (data) => {
    const user = users.get(socket.id);
    const { contactId, text } = data;
    
    if (!chats.has(contactId)) {
      chats.set(contactId, []);
    }

    const message = {
      id: Date.now().toString(),
      sender: 'current',
      text: text,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    // Add to chat history
    chats.get(contactId).push(message);

    // Emit to sender for confirmation
    socket.emit('message_sent', message);

    // Simulate message delivery and read status
    setTimeout(() => {
      message.status = 'delivered';
      socket.emit('message_status_update', {
        messageId: message.id,
        status: 'delivered'
      });
    }, 1000);

    setTimeout(() => {
      message.status = 'read';
      socket.emit('message_status_update', {
        messageId: message.id,
        status: 'read'
      });
    }, 3000);

    // In real app, emit to the recipient
    socket.broadcast.emit('new_message', {
      contactId,
      message,
      from: user
    });
  });

  // Handle typing indicators
  socket.on('typing_start', (contactId) => {
    socket.broadcast.emit('user_typing', {
      contactId,
      userId: 'current'
    });
  });

  socket.on('typing_stop', (contactId) => {
    socket.broadcast.emit('user_stop_typing', {
      contactId,
      userId: 'current'
    });
  });

  // Handle message status updates
  socket.on('message_read', (data) => {
    const { messageId, contactId } = data;
    const chat = chats.get(contactId);
    if (chat) {
      const message = chat.find(msg => msg.id === messageId);
      if (message && message.sender !== 'current') {
        message.status = 'read';
      }
    }
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user) {
      users.delete(socket.id);
      
      // Notify others about offline status
      socket.broadcast.emit('user_status_change', {
        userId: 'current',
        status: 'offline',
        lastSeen: new Date().toISOString()
      });
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`WhatsApp clone server running on port ${PORT}`);
});