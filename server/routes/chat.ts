import { Router } from 'express';
import { ChatModel } from '../models/chat';
import { PresetModel } from '../models/preset';

const router = Router();

// Create new chat session
router.post('/sessions', (req, res) => {
  try {
    const { title, preset_id } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const session = ChatModel.createSession(title, preset_id);
    res.json(session);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// List all sessions
router.get('/sessions', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const sessions = ChatModel.listSessions(limit, offset);
    res.json(sessions);
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// Get specific session
router.get('/sessions/:id', (req, res) => {
  try {
    const session = ChatModel.getSession(req.params.id);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Get preset info if associated
    let preset = null;
    if (session.preset_id) {
      preset = PresetModel.getById(session.preset_id);
    }

    res.json({ ...session, preset });
  } catch (error) {
    console.error('Error getting session:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// Update session
router.patch('/sessions/:id', (req, res) => {
  try {
    const { title, preset_id } = req.body;

    const success = ChatModel.updateSession(req.params.id, {
      title,
      preset_id
    });

    if (!success) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = ChatModel.getSession(req.params.id);
    res.json(session);
  } catch (error) {
    console.error('Error updating session:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// Delete session
router.delete('/sessions/:id', (req, res) => {
  try {
    const success = ChatModel.deleteSession(req.params.id);

    if (!success) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// Get messages for a session
router.get('/sessions/:id/messages', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || undefined;
    const offset = parseInt(req.query.offset as string) || 0;

    const session = ChatModel.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const messages = ChatModel.getMessages(req.params.id, limit, offset);
    res.json(messages);
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Add message to session
router.post('/sessions/:id/messages', (req, res) => {
  try {
    const { role, content, metadata, created_at } = req.body;

    if (!role || !content) {
      return res.status(400).json({ error: 'Role and content are required' });
    }

    const session = ChatModel.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const message = ChatModel.addMessage(req.params.id, role, content, metadata, created_at);
    res.json(message);
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

// Update message
router.patch('/messages/:id', (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const success = ChatModel.updateMessage(req.params.id, content);

    if (!success) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

// Delete message
router.delete('/messages/:id', (req, res) => {
  try {
    const success = ChatModel.deleteMessage(req.params.id);

    if (!success) {
      return res.status(404).json({ error: 'Message not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

// Get message history formatted for LLM
router.get('/sessions/:id/history', (req, res) => {
  try {
    const maxMessages = parseInt(req.query.max as string) || 50;

    const session = ChatModel.getSession(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const history = ChatModel.getMessageHistoryForLLM(req.params.id, maxMessages);

    // Get preset settings if available
    let presetSettings = null;
    if (session.preset_id) {
      const preset = PresetModel.getById(session.preset_id);
      if (preset) {
        presetSettings = {
          temperature: preset.temperature,
          max_tokens: preset.openai_max_tokens,
          top_p: preset.top_p,
          presence_penalty: preset.presence_penalty,
          frequency_penalty: preset.frequency_penalty,
          stop_sequences: preset.stop_sequences
        };
      }
    }

    res.json({ history, preset: presetSettings });
  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

export default router;
