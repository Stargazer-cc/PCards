import { requestUrl } from 'obsidian';

export interface MusicTagSearchResult {
  success: boolean;
  data?: any[];
  error?: string;
}

export interface MusicTagItemDetail {
  title: string;
  subtitle?: string;
  album?: string;
  artist?: string;
  artistId?: string;
  albumId?: string;
  songId?: string;
  year?: string;
  cover_url?: string;
  url?: string;
  rating?: {
    value?: number;
    count?: number;
  };
  description?: string;
  tags?: string[];
  publishTime?: string;
  id?: string;
  cover?: string;
  source?: string; // 数据来源
}

export class MusicTagAPI {
  // 音乐标签获取的可用数据源
  private static dataSources = [
    'netease', // 网易云音乐
    'kugou',   // 酷狗音乐
    'kuwo',    // 酷我音乐
    'qq',      // QQ音乐
    'migu'     // 咪咕音乐
  ];
  
  // 当前选择的数据源
  private static currentSource = 'netease';
  
  // 最大重试次数
  private static maxRetries = 2;
  
  // API密钥
  private static apiKey: string = '';
  
  /**
   * 设置API密钥
   */
  public static setAPIKey(key: string): void {
    this.apiKey = key;
    console.log('已设置MusicTag API密钥');
  }
  
  /**
   * 获取API密钥
   */
  public static getAPIKey(): string {
    return this.apiKey;
  }
  
  /**
   * 设置当前使用的数据源
   */
  public static setDataSource(source: string): void {
    if (this.dataSources.includes(source)) {
      this.currentSource = source;
    } else {
      console.warn(`数据源 ${source} 不可用，将使用默认数据源 ${this.currentSource}`);
    }
  }
  
  /**
   * 获取当前使用的数据源
   */
  public static getCurrentSource(): string {
    return this.currentSource;
  }
  
  /**
   * 获取所有可用的数据源
   */
  public static getAvailableSources(): string[] {
    return this.dataSources;
  }
  
  /**
   * 切换到下一个数据源
   */
  private static switchToNextSource(): string {
    const currentIndex = this.dataSources.indexOf(this.currentSource);
    const nextIndex = (currentIndex + 1) % this.dataSources.length;
    this.currentSource = this.dataSources[nextIndex];
    return this.currentSource;
  }
  
  /**
   * 搜索音乐
   * @param keyword 搜索关键词
   * @param source 指定数据源（可选）
   * @returns 搜索结果
   */
  public static async search(keyword: string, source?: string): Promise<MusicTagSearchResult> {
    console.log(`开始搜索音乐: ${keyword}`);
    
    // 如果指定了数据源，则使用指定的数据源
    const useSource = source || this.currentSource;
    
    // 当前尝试次数
    let retryCount = 0;
    
    // 最后遇到的错误
    let lastError: any = null;
    
    while (retryCount < this.maxRetries) {
      try {
        // 根据数据源选择不同的搜索方法
        let result;
        
        switch (useSource) {
          case 'netease':
            // 使用网易云音乐API直接搜索
            try {
              const data = await callNeteaseAPI('search', keyword);
              const songs = data.result?.songs || [];
              
              // 将搜索结果转换为通用格式
              const results = songs.map((song: any) => {
                const artistNames = (song.artists || song.ar || []).map((artist: any) => artist.name).join(', ');
                const albumName = (song.album || song.al)?.name || '';
                
                // 获取发布年份 - 从publishTime或其他字段中提取
                let year = '';
                if ((song.album || song.al)?.publishTime) {
                  const date = new Date((song.album || song.al).publishTime);
                  year = date.getFullYear().toString();
                }
                
                return {
                  id: song.id.toString(),
                  title: song.name,
                  artist: artistNames,
                  album: albumName,
                  cover: (song.album || song.al)?.picUrl || '',
                  url: `https://music.163.com/#/song?id=${song.id}`,
                  year: year,
                  type: 'music'
                };
              });
              
              result = {
                success: true,
                data: results
              };
            } catch (error) {
              console.error('网易云音乐搜索出错:', error);
              throw error;
            }
            break;
            
          case 'kugou':
          case 'kuwo':
          case 'qq':
          case 'migu':
            // 暂时使用网易云音乐API，后续可以拓展其他API
            console.log(`数据源 ${useSource} 暂未实现，使用网易云音乐API代替`);
            try {
              const data = await callNeteaseAPI('search', keyword);
              const songs = data.result?.songs || [];
              
              // 将搜索结果转换为通用格式
              const results = songs.map((song: any) => {
                const artistNames = (song.artists || song.ar || []).map((artist: any) => artist.name).join(', ');
                const albumName = (song.album || song.al)?.name || '';
                
                // 获取发布年份 - 从publishTime或其他字段中提取
                let year = '';
                if ((song.album || song.al)?.publishTime) {
                  const date = new Date((song.album || song.al).publishTime);
                  year = date.getFullYear().toString();
                }
                
                return {
                  id: song.id.toString(),
                  title: song.name,
                  artist: artistNames,
                  album: albumName,
                  cover: (song.album || song.al)?.picUrl || '',
                  url: `https://music.163.com/#/song?id=${song.id}`,
                  year: year,
                  type: 'music'
                };
              });
              
              result = {
                success: true,
                data: results
              };
            } catch (error) {
              console.error('网易云音乐搜索出错:', error);
              throw error;
            }
            break;
            
          default:
            // 默认使用网易云音乐API
            try {
              const data = await callNeteaseAPI('search', keyword);
              const songs = data.result?.songs || [];
              
              // 将搜索结果转换为通用格式
              const results = songs.map((song: any) => {
                const artistNames = (song.artists || song.ar || []).map((artist: any) => artist.name).join(', ');
                const albumName = (song.album || song.al)?.name || '';
                
                // 获取发布年份 - 从publishTime或其他字段中提取
                let year = '';
                if ((song.album || song.al)?.publishTime) {
                  const date = new Date((song.album || song.al).publishTime);
                  year = date.getFullYear().toString();
                }
                
                return {
                  id: song.id.toString(),
                  title: song.name,
                  artist: artistNames,
                  album: albumName,
                  cover: (song.album || song.al)?.picUrl || '',
                  url: `https://music.163.com/#/song?id=${song.id}`,
                  year: year,
                  type: 'music'
                };
              });
              
              result = {
                success: true,
                data: results
              };
            } catch (error) {
              console.error('网易云音乐搜索出错:', error);
              throw error;
            }
        }
        
        // 处理结果，添加数据源信息
        if (result.success && result.data) {
          // 为每个结果添加数据源标记
          result.data = result.data.map((item: any) => ({
            ...item,
            source: useSource
          }));
        }
        
        return result;
      } catch (error) {
        console.error(`音乐搜索出错 (尝试 ${retryCount + 1}/${this.maxRetries}):`, error);
        lastError = error;
        
        // 如果还有重试次数，切换到下一个数据源
        if (retryCount < this.maxRetries - 1) {
          const nextSource = this.switchToNextSource();
          console.log(`切换到下一个数据源: ${nextSource}`);
        }
        
        // 增加重试次数
        retryCount++;
      }
    }
    
    // 如果所有尝试都失败了，返回错误
    return {
      success: false,
      error: `搜索出错: ${lastError ? lastError.message : '未知错误'}`
    };
  }
  
  /**
   * 获取歌曲详情
   * @param songId 歌曲ID
   * @param source 数据来源
   * @returns 歌曲详情
   */
  public static async getSongDetail(songId: string, source: string = 'netease'): Promise<MusicTagItemDetail | null> {
    console.log(`开始获取歌曲详情，ID: ${songId}，数据源: ${source}`);
    
    try {
      // 根据数据源选择不同的获取详情方法
      let detail: MusicTagItemDetail | null = null;
      
      switch (source) {
        case 'netease':
          // 使用网易云音乐API直接获取歌曲详情
          try {
            // 获取歌曲详情
            const songData = await callNeteaseAPI(`song/detail?ids=${songId}`, '');
            
            if (!songData || !songData.songs || songData.songs.length === 0) {
              throw new Error('返回的数据不包含歌曲信息');
            }
            
            const song = songData.songs[0];
            
            // 构建基本详情
            detail = {
              title: song.name,
              cover_url: song.al?.picUrl,
              url: `https://music.163.com/#/song?id=${song.id}`,
              id: song.id.toString(),
              songId: song.id.toString(),
              albumId: song.al?.id?.toString(),
              album: song.al?.name,
              artist: (song.ar || []).map((artist: any) => artist.name).join(', '),
              artistId: song.ar?.[0]?.id?.toString()
            };
            
            // 从时间戳中提取年份
            if (song.publishTime) {
              const date = new Date(song.publishTime);
              detail.year = date.getFullYear().toString();
              detail.publishTime = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
            }
            
            // 复制封面URL到cover字段
            if (detail.cover_url) {
              detail.cover = detail.cover_url;
            }
            
            // 获取歌词信息
            try {
              const lyricsData = await callNeteaseAPI(`lyric?id=${songId}`, '');
              
              if (lyricsData && lyricsData.lrc) {
                detail.description = lyricsData.lrc.lyric;
              }
            } catch (error) {
              console.error('获取歌词信息失败:', error);
              // 获取歌词失败不影响整体结果
            }
            
            // 尝试获取专辑信息以补充更多详情
            try {
              if (song.al?.id) {
                const albumData = await callNeteaseAPI(`album?id=${song.al.id}`, '');
                
                if (albumData && albumData.album) {
                  const album = albumData.album;
                  
                  // 更新专辑信息
                  detail.description = album.description || detail.description;
                  
                  // 如果有标签信息，添加标签
                  if (album.tags && album.tags.length > 0) {
                    detail.tags = album.tags;
                  }
                  
                  // 如果没有年份信息，尝试从专辑获取
                  if (!detail.year && album.publishTime) {
                    const date = new Date(album.publishTime);
                    detail.year = date.getFullYear().toString();
                  }
                }
              }
            } catch (error) {
              console.error('获取专辑信息失败:', error);
              // 获取专辑信息失败不影响整体结果
            }
          } catch (error) {
            console.error('获取网易云音乐歌曲详情出错:', error);
            throw error;
          }
          break;
          
        case 'kugou':
        case 'kuwo':
        case 'qq':
        case 'migu':
          // 暂时使用网易云音乐API，后续可以拓展其他API
          console.log(`数据源 ${source} 暂未实现，使用网易云音乐API代替`);
          try {
            // 获取歌曲详情
            const songData = await callNeteaseAPI(`song/detail?ids=${songId}`, '');
            
            if (!songData || !songData.songs || songData.songs.length === 0) {
              throw new Error('返回的数据不包含歌曲信息');
            }
            
            const song = songData.songs[0];
            
            // 构建基本详情
            detail = {
              title: song.name,
              cover_url: song.al?.picUrl,
              url: `https://music.163.com/#/song?id=${song.id}`,
              id: song.id.toString(),
              songId: song.id.toString(),
              albumId: song.al?.id?.toString(),
              album: song.al?.name,
              artist: (song.ar || []).map((artist: any) => artist.name).join(', '),
              artistId: song.ar?.[0]?.id?.toString()
            };
            
            // 从时间戳中提取年份
            if (song.publishTime) {
              const date = new Date(song.publishTime);
              detail.year = date.getFullYear().toString();
              detail.publishTime = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
            }
            
            // 复制封面URL到cover字段
            if (detail.cover_url) {
              detail.cover = detail.cover_url;
            }
            
            // 获取歌词信息
            try {
              const lyricsData = await callNeteaseAPI(`lyric?id=${songId}`, '');
              
              if (lyricsData && lyricsData.lrc) {
                detail.description = lyricsData.lrc.lyric;
              }
            } catch (error) {
              console.error('获取歌词信息失败:', error);
              // 获取歌词失败不影响整体结果
            }
          } catch (error) {
            console.error('获取网易云音乐歌曲详情出错:', error);
            throw error;
          }
          break;
          
        default:
          // 默认使用网易云音乐API
          try {
            // 获取歌曲详情
            const songData = await callNeteaseAPI(`song/detail?ids=${songId}`, '');
            
            if (!songData || !songData.songs || songData.songs.length === 0) {
              throw new Error('返回的数据不包含歌曲信息');
            }
            
            const song = songData.songs[0];
            
            // 构建基本详情
            detail = {
              title: song.name,
              cover_url: song.al?.picUrl,
              url: `https://music.163.com/#/song?id=${song.id}`,
              id: song.id.toString(),
              songId: song.id.toString(),
              albumId: song.al?.id?.toString(),
              album: song.al?.name,
              artist: (song.ar || []).map((artist: any) => artist.name).join(', '),
              artistId: song.ar?.[0]?.id?.toString()
            };
            
            // 从时间戳中提取年份
            if (song.publishTime) {
              const date = new Date(song.publishTime);
              detail.year = date.getFullYear().toString();
              detail.publishTime = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
            }
            
            // 复制封面URL到cover字段
            if (detail.cover_url) {
              detail.cover = detail.cover_url;
            }
          } catch (error) {
            console.error('获取网易云音乐歌曲详情出错:', error);
            throw error;
          }
      }
      
      // 如果获取到详情，添加数据源信息
      if (detail) {
        detail.source = source;
      }
      
      return detail;
    } catch (error) {
      console.error(`获取歌曲详情出错:`, error);
      return null;
    }
  }
  
  /**
   * 通过音频指纹识别音乐
   * 注：此功能仅为示例，实际实现需要集成ACRCloud等音频指纹识别服务
   * 
   * @param audioBlob 音频数据
   * @returns 识别结果
   */
  public static async recognizeMusic(audioBlob: Blob): Promise<MusicTagSearchResult> {
    console.log('开始识别音乐');
    
    try {
      // 此处应实现音频指纹识别的逻辑
      // 需要集成ACRCloud等服务的API
      
      // 示例返回
      return {
        success: false,
        error: '音频指纹识别功能尚未实现'
      };
    } catch (error) {
      console.error('音乐识别出错:', error);
      return {
        success: false,
        error: `识别出错: ${error.message}`
      };
    }
  }
  
  /**
   * 通过文件名解析音乐信息
   * 尝试从文件名中提取艺术家、歌名等信息
   * 
   * @param filename 文件名
   * @returns 解析结果
   */
  public static parseFilename(filename: string): {title?: string, artist?: string} {
    console.log(`尝试解析文件名: ${filename}`);
    
    const result: {title?: string, artist?: string} = {};
    
    // 常见的文件名格式：
    // 1. 艺术家 - 歌曲名.mp3
    // 2. 歌曲名 - 艺术家.mp3
    // 3. 艺术家_歌曲名.mp3
    
    // 移除文件扩展名
    const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
    
    // 尝试匹配格式1: 艺术家 - 歌曲名
    let match = nameWithoutExt.match(/^(.*?)\s*-\s*(.*)$/);
    if (match) {
      result.artist = match[1].trim();
      result.title = match[2].trim();
      return result;
    }
    
    // 尝试匹配格式3: 艺术家_歌曲名
    match = nameWithoutExt.match(/^(.*?)_(.*)$/);
    if (match) {
      result.artist = match[1].trim();
      result.title = match[2].trim();
      return result;
    }
    
    // 如果无法匹配任何格式，将整个文件名作为歌曲名
    result.title = nameWithoutExt.trim();
    
    return result;
  }
}

/**
 * 直接调用网易云音乐API
 * @internal 仅供内部使用
 */
async function callNeteaseAPI(path: string, keyword?: string): Promise<any> {
  const baseUrls = [
    'https://netease-cloud-music-api-gamma-woad.vercel.app',
    'https://netease-cloud-music-api-iota-five.vercel.app',
    'https://netease-cloud-music-api-xi.vercel.app'
  ];
  
  // 依次尝试不同的API地址
  for (let i = 0; i < baseUrls.length; i++) {
    try {
      const url = keyword 
        ? `${baseUrls[i]}/${path}${path.includes('?') ? '&' : '?'}keywords=${encodeURIComponent(keyword)}`
        : `${baseUrls[i]}/${path}`;
        
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://music.163.com/',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://music.163.com'
      };
      
      const response = await requestUrl({
        url: url,
        method: 'GET',
        headers: headers,
        throw: false
      });
      
      if (response.status === 200) {
        const data = response.json;
        if (data.code === 200) {
          return data;
        }
      }
    } catch (error) {
      console.error(`API端点 ${baseUrls[i]} 调用失败:`, error);
      // 继续尝试下一个API
      continue;
    }
  }
  
  throw new Error('所有API端点均调用失败');
} 