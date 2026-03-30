import { Router } from 'express';

const router = Router();

// NetEase music search via oick.cn
router.get('/netease', async (req, res) => {
  const { keyword, id } = req.query;

  try {
    if (id) {
      // Get song details by ID
      const response = await fetch(`https://api.oick.cn/netease/api.php?msg=${id}&type=song&n=1`);
      const data = await response.json();
      res.json(data);
    } else if (keyword) {
      // Search by keyword
      const response = await fetch(`https://api.oick.cn/netease/api.php?msg=${encodeURIComponent(String(keyword))}&type=1&n=1`);
      const data = await response.json();
      res.json(data);
    } else {
      res.status(400).json({ error: 'Missing keyword or id parameter' });
    }
  } catch (error) {
    console.error('[Music Proxy] oick.cn error:', error);
    res.status(500).json({ error: 'Music API request failed' });
  }
});

// Backup: uomg NetEase API
router.get('/netease-uomg', async (req, res) => {
  const { keyword, songid } = req.query;

  try {
    if (songid) {
      // Get play URL by song ID
      const response = await fetch(`https://api.uomg.com/api/netease.music?id=${songid}`);
      const data = await response.json();
      res.json(data);
    } else if (keyword) {
      // Search by keyword
      const response = await fetch(`https://api.uomg.com/api/netease.search?key=${encodeURIComponent(String(keyword))}&limit=1`);
      const data = await response.json();
      res.json(data);
    } else {
      res.status(400).json({ error: 'Missing keyword or songid parameter' });
    }
  } catch (error) {
    console.error('[Music Proxy] uomg error:', error);
    res.status(500).json({ error: 'Music API request failed' });
  }
});

// Backup: wljs API
router.get('/wljs', async (req, res) => {
  const { keyword } = req.query;

  if (!keyword) {
    return res.status(400).json({ error: 'Missing keyword parameter' });
  }

  try {
    const response = await fetch(`https://api.wljs.lol/music/netease/search?keyword=${encodeURIComponent(String(keyword))}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Music Proxy] wljs error:', error);
    res.status(500).json({ error: 'Music API request failed' });
  }
});

export default router;
