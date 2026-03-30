import { Router } from 'express';
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import yaml from 'js-yaml';
import { PresetModel, DEFAULT_PRESET } from '../models/preset';

const router = Router();

// Configure multer for file uploads - use memory storage to avoid disk permission issues
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.json', '.yaml', '.yml'];
    const ext = path.extname(file.originalname).toLowerCase();
    console.log('[Upload] File filter checking:', file.originalname, 'ext:', ext);
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JSON and YAML files are allowed.'));
    }
  }
});

// List all presets
router.get('/', (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const presets = PresetModel.list(limit, offset);
    res.json(presets);
  } catch (error) {
    console.error('Error listing presets:', error);
    res.status(500).json({ error: 'Failed to list presets' });
  }
});

// Get default preset values
router.get('/defaults', (req, res) => {
  res.json(DEFAULT_PRESET);
});

// Get active preset - MUST be before /:id route
router.get('/active', (req, res) => {
  try {
    const preset = PresetModel.getActive();
    res.json(preset);
  } catch (error) {
    console.error('Error getting active preset:', error);
    res.status(500).json({ error: 'Failed to get active preset' });
  }
});

// Set active preset
router.post('/active', (req, res) => {
  try {
    const { preset_id } = req.body;
    PresetModel.setActive(preset_id || null);
    res.json({ success: true });
  } catch (error) {
    console.error('Error setting active preset:', error);
    res.status(500).json({ error: 'Failed to set active preset' });
  }
});

// Get specific preset
router.get('/:id', (req, res) => {
  try {
    const preset = PresetModel.getById(req.params.id);

    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    res.json(preset);
  } catch (error) {
    console.error('Error getting preset:', error);
    res.status(500).json({ error: 'Failed to get preset' });
  }
});

// Create new preset
router.post('/', (req, res) => {
  try {
    const presetData = req.body;

    if (!presetData.name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const preset = PresetModel.create(presetData);
    res.json(preset);
  } catch (error) {
    console.error('Error creating preset:', error);
    res.status(500).json({ error: 'Failed to create preset' });
  }
});

// Import preset from JSON
router.post('/import/json', (req, res) => {
  try {
    const data = req.body;

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid JSON data' });
    }

    const parsedData = PresetModel.parseSillyTavernPreset(data);
    const preset = PresetModel.create(parsedData);

    res.json(preset);
  } catch (error) {
    console.error('Error importing preset:', error);
    res.status(500).json({ error: 'Failed to import preset', details: (error as Error).message });
  }
});

// Debug endpoint to check server status
router.get('/debug', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uploadConfigured: true,
    multerStorage: 'memoryStorage'
  });
});

// Simple text import endpoint for testing
router.post('/import-test', express.json({ limit: '10mb' }), (req, res) => {
  try {
    console.log('[Import-Test] Received request');
    const data = req.body;
    console.log('[Import-Test] Body keys:', Object.keys(data).slice(0, 5));

    const parsedData = PresetModel.parseSillyTavernPreset(data);
    console.log('[Import-Test] Parsed:', parsedData.name, 'entries:', parsedData.prompt_entries?.length);

    const preset = PresetModel.create(parsedData);
    console.log('[Import-Test] Created:', preset.id);

    res.json(preset);
  } catch (error: any) {
    console.error('[Import-Test] Error:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Upload preset file (JSON or YAML)
router.post('/upload', upload.single('file'), (req, res) => {
  console.log('[Upload] ========== Upload request received ==========');

  try {
    if (!req.file) {
      console.error('[Upload] No file in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log('[Upload] File received:', req.file.originalname, 'size:', req.file.size, 'mimetype:', req.file.mimetype);

    const ext = path.extname(req.file.originalname).toLowerCase();
    console.log('[Upload] File extension:', ext);

    let data: any;

    // Parse file content from buffer
    try {
      console.log('[Upload] Reading buffer...');
      const content = req.file.buffer.toString('utf-8');
      console.log('[Upload] Buffer to string, length:', content.length);

      if (ext === '.json') {
        console.log('[Upload] Parsing JSON...');
        data = JSON.parse(content);
        console.log('[Upload] JSON parsed, top keys:', Object.keys(data).slice(0, 5));
      } else if (ext === '.yaml' || ext === '.yml') {
        console.log('[Upload] Parsing YAML...');
        data = yaml.load(content);
        console.log('[Upload] YAML parsed');
      } else {
        console.error('[Upload] Unsupported extension:', ext);
        return res.status(400).json({ error: 'Unsupported file format' });
      }
    } catch (parseError: any) {
      console.error('[Upload] Parse error:', parseError);
      return res.status(400).json({ error: 'Failed to parse file', details: parseError.message });
    }

    console.log('[Upload] Parsing SillyTavern preset...');
    const parsedData = PresetModel.parseSillyTavernPreset(data);
    console.log('[Upload] Parsed:', {
      name: parsedData.name,
      entries: parsedData.prompt_entries?.length,
      temp: parsedData.temperature
    });

    console.log('[Upload] Creating in database...');
    const preset = PresetModel.create(parsedData);
    console.log('[Upload] SUCCESS! Created:', preset.id, 'with', preset.prompt_entries?.length, 'entries');

    res.json(preset);
  } catch (error: any) {
    console.error('[Upload] ========== ERROR ==========');
    console.error('[Upload] Error:', error.message);
    console.error('[Upload] Stack:', error.stack);
    res.status(500).json({ error: 'Failed to upload preset', details: error.message, stack: error.stack });
  }
});

// Export preset to SillyTavern format
router.get('/:id/export', (req, res) => {
  try {
    const preset = PresetModel.getById(req.params.id);

    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    const exportData = PresetModel.toSillyTavernFormat(preset);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${preset.name.replace(/[^a-z0-9]/gi, '_')}.json"`);
    res.json(exportData);
  } catch (error) {
    console.error('Error exporting preset:', error);
    res.status(500).json({ error: 'Failed to export preset' });
  }
});

// Update preset
router.patch('/:id', (req, res) => {
  try {
    const updates = req.body;

    // Don't allow updating raw_data through this endpoint
    delete updates.raw_data;
    delete updates.id;
    delete updates.created_at;

    const success = PresetModel.update(req.params.id, updates);

    if (!success) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    const preset = PresetModel.getById(req.params.id);
    res.json(preset);
  } catch (error) {
    console.error('Error updating preset:', error);
    res.status(500).json({ error: 'Failed to update preset' });
  }
});

// Delete preset
router.delete('/:id', (req, res) => {
  try {
    const success = PresetModel.delete(req.params.id);

    if (!success) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting preset:', error);
    res.status(500).json({ error: 'Failed to delete preset' });
  }
});

// Prompt Entry Routes

// Get prompt entries for a preset
router.get('/:id/entries', (req, res) => {
  try {
    const preset = PresetModel.getById(req.params.id);
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    const entries = PresetModel.getPromptEntries(req.params.id);
    res.json(entries);
  } catch (error) {
    console.error('Error getting prompt entries:', error);
    res.status(500).json({ error: 'Failed to get prompt entries' });
  }
});

// Create prompt entry
router.post('/:id/entries', (req, res) => {
  try {
    const preset = PresetModel.getById(req.params.id);
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    const {
      name, content, enabled, position,
      role, system_prompt, identifier, marker,
      injection_position, injection_depth, injection_order,
      injection_trigger, forbid_overrides
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const entry = PresetModel.createPromptEntry(req.params.id, {
      name,
      content: content || '',
      enabled: enabled !== false,
      position: position ?? 0,
      role: role || 'system',
      system_prompt: system_prompt !== false,
      identifier: identifier || undefined,
      marker: marker === true,
      injection_position: injection_position ?? 0,
      injection_depth: injection_depth ?? 4,
      injection_order: injection_order ?? 100,
      injection_trigger: Array.isArray(injection_trigger) ? injection_trigger : undefined,
      forbid_overrides: forbid_overrides === true
    });

    res.json(entry);
  } catch (error) {
    console.error('Error creating prompt entry:', error);
    res.status(500).json({ error: 'Failed to create prompt entry' });
  }
});

// Update prompt entry
router.patch('/:id/entries/:entryId', (req, res) => {
  try {
    const updates = req.body;
    delete updates.id;
    delete updates.preset_id;
    delete updates.created_at;

    const success = PresetModel.updatePromptEntry(req.params.entryId, updates);

    if (!success) {
      return res.status(404).json({ error: 'Prompt entry not found' });
    }

    const entries = PresetModel.getPromptEntries(req.params.id);
    res.json(entries);
  } catch (error) {
    console.error('Error updating prompt entry:', error);
    res.status(500).json({ error: 'Failed to update prompt entry' });
  }
});

// Delete prompt entry
router.delete('/:id/entries/:entryId', (req, res) => {
  try {
    const success = PresetModel.deletePromptEntry(req.params.entryId);

    if (!success) {
      return res.status(404).json({ error: 'Prompt entry not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting prompt entry:', error);
    res.status(500).json({ error: 'Failed to delete prompt entry' });
  }
});

// Reorder prompt entries
router.post('/:id/entries/reorder', (req, res) => {
  try {
    const { entry_ids } = req.body;

    if (!Array.isArray(entry_ids)) {
      return res.status(400).json({ error: 'entry_ids must be an array' });
    }

    PresetModel.reorderPromptEntries(req.params.id, entry_ids);

    const entries = PresetModel.getPromptEntries(req.params.id);
    res.json(entries);
  } catch (error) {
    console.error('Error reordering prompt entries:', error);
    res.status(500).json({ error: 'Failed to reorder prompt entries' });
  }
});

export default router;
