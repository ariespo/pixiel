// Music Service - Search and fetch music details
// Now uses backend proxy to avoid CORS issues

export interface MusicInfo {
  id: string;
  title: string;
  artist: string;
  album?: string;
  coverUrl?: string;
  playUrl: string;
  lyrics?: string;
  duration?: number;
}

/**
 * Search music by name - uses backend proxy to avoid CORS
 */
export async function searchMusic(keyword: string): Promise<MusicInfo | null> {
  // API 1: oick.cn via backend proxy
  try {
    console.log('[Music] Trying oick.cn proxy for:', keyword);

    const response = await fetch(`/api/music/netease?keyword=${encodeURIComponent(keyword)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    console.log('[Music] oick.cn proxy response:', data);

    if (data.code === 200 && data.data && data.data.length > 0) {
      const song = data.data[0];
      if (song.url) {
        return {
          id: String(song.id),
          title: song.song,
          artist: song.singer,
          coverUrl: song.cover,
          playUrl: song.url,
          lyrics: song.lrc,
        };
      }
    }
  } catch (e) {
    console.warn('[Music] oick.cn proxy failed:', e);
  }

  // API 2: uomg via backend proxy
  try {
    console.log('[Music] Trying uomg proxy for:', keyword);

    const searchRes = await fetch(`/api/music/netease-uomg?keyword=${encodeURIComponent(keyword)}`);
    if (!searchRes.ok) throw new Error(`HTTP ${searchRes.status}`);

    const searchData = await searchRes.json();
    console.log('[Music] uomg search response:', searchData);

    if (searchData.code === 1 && searchData.data && searchData.data.length > 0) {
      const song = searchData.data[0];
      // Get play URL
      const urlRes = await fetch(`/api/music/netease-uomg?songid=${song.songid}`);
      const urlData = await urlRes.json();

      if (urlData.code === 1 && urlData.data) {
        return {
          id: String(song.songid),
          title: song.title,
          artist: song.author,
          coverUrl: song.pic,
          playUrl: urlData.data.url,
          lyrics: urlData.data.lrc,
        };
      }
    }
  } catch (e) {
    console.warn('[Music] uomg proxy failed:', e);
  }

  // API 3: wljs via backend proxy
  try {
    console.log('[Music] Trying wljs proxy for:', keyword);

    const response = await fetch(`/api/music/wljs?keyword=${encodeURIComponent(keyword)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    console.log('[Music] wljs proxy response:', data);

    if (data.code === 200 && data.data && data.data.length > 0) {
      const song = data.data[0];
      return {
        id: String(song.id),
        title: song.name,
        artist: song.artist,
        coverUrl: song.picUrl,
        playUrl: song.url,
      };
    }
  } catch (e) {
    console.warn('[Music] wljs proxy failed:', e);
  }

  console.warn('[Music] All proxies failed for keyword:', keyword);
  return null;
}

/**
 * Fetch detailed music info (including lyrics)
 * Uses backend proxy
 */
export async function fetchMusicDetail(songId: string): Promise<MusicInfo | null> {
  try {
    const response = await fetch(`/api/music/netease?id=${encodeURIComponent(songId)}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    if (data.code === 200 && data.data && data.data.length > 0) {
      const song = data.data[0];
      return {
        id: songId,
        title: song.song,
        artist: song.singer,
        coverUrl: song.cover,
        playUrl: song.url,
        lyrics: song.lrc,
      };
    }

    console.warn('[Music] Failed to fetch detail for:', songId);
    return null;
  } catch (error) {
    console.error('[Music] Fetch detail failed:', error);
    return null;
  }
}

/**
 * Extract music tag content from text
 * Format: <音乐>歌曲名</音乐>
 */
export function extractMusicTag(text: string): string | null {
  const match = text.match(/<音乐>(.+?)<\/音乐>/);
  return match ? match[1].trim() : null;
}

/**
 * Remove music tags from text
 */
export function removeMusicTags(text: string): string {
  return text.replace(/<音乐>.+?<\/音乐>/g, '').trim();
}
