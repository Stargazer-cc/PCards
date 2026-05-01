import { requestUrl } from 'obsidian';

export interface DoubanSearchResult {
  success: boolean;
  data?: any[];
  error?: string;
}

export interface DoubanItemDetail {
  title: string;
  subtitle?: string;
  original_title?: string;
  author?: string[];
  director?: string;
  artist?: string;
  year?: string;
  cover_url?: string;
  url?: string;
  rating?: {
    value?: number;
    count?: number;
  };
  description?: string;
  tags?: string[];
  id?: string;
  cover?: string;
}

export class DoubanAPI {
  private static cookie: string = '';
  
  // 设置豆瓣Cookie
  public static setCookie(cookie: string) {
    this.cookie = cookie;
    console.log('已设置豆瓣Cookie');
  }
  
  // 获取豆瓣Cookie
  public static getCookie(): string {
    return this.cookie;
  }
  
  // 搜索豆瓣上的内容
  public static async search(keyword: string, type: 'book' | 'movie'): Promise<DoubanSearchResult> {
    try {
      // 使用豆瓣网页上的搜索表单
      const encodedKeyword = encodeURIComponent(keyword);
      
      // 根据类型选择不同的搜索URL
      let searchUrl;
      if (type === 'book') {
        searchUrl = `https://search.douban.com/book/subject_search?search_text=${encodedKeyword}`;
      } else {
        searchUrl = `https://search.douban.com/movie/subject_search?search_text=${encodedKeyword}`;
      }
      
      console.log(`正在搜索豆瓣: ${searchUrl}`);
      
      // 添加随机延迟，避免被识别为爬虫
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
      
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': type === 'book' ? 'https://book.douban.com/' : 'https://movie.douban.com/',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-site',
        'Sec-Fetch-User': '?1'
      };
      
      // 如果有cookie，添加到请求头
      if (this.cookie) {
        headers['Cookie'] = this.cookie;
        console.log('使用用户提供的Cookie进行搜索');
      } else {
        console.log('未使用Cookie进行搜索');
      }
      
      // 尝试最多3次请求
      let response;
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          response = await requestUrl({
            url: searchUrl,
            method: 'GET',
            headers: headers
          });
          break; // 成功获取响应，跳出循环
        } catch (error) {
          retries++;
          console.log(`请求失败，第${retries}次重试...`);
          if (retries >= maxRetries) {
            throw error; // 达到最大重试次数，抛出错误
          }
          // 增加延迟时间
          await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500 * retries));
        }
      }

      if (!response) {
        throw new Error('请求失败，无法获取响应');
      }

      // 解析HTML响应
      const html = response.text;
      console.log(`获取到的HTML长度: ${html.length}`);
      
      // 检查是否被重定向到了单个条目页面
      const subjectMatch = html.match(/<link\s+rel="canonical"\s+href="[^"]*\/subject\/(\d+)/);
      if (subjectMatch && subjectMatch[1]) {
        const id = subjectMatch[1];
        console.log(`检测到直接重定向到条目: ${id}`);
        
        // 获取页面标题
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        const title = titleMatch ? titleMatch[1].replace(/\(豆瓣\)$/, '').trim() : `豆瓣${type === 'movie' ? '电影' : '图书'} #${id}`;
        
        // 获取封面图
        let coverUrl = '';
        const coverMatch = html.match(/<img[^>]*src="([^"@]+(@|\.jpg|\.png|\.webp))[^"]*"[^>]*title="点击看更多海报"/);
        if (coverMatch && coverMatch[1]) {
          coverUrl = coverMatch[1].split('@')[0];
        }
        
        return {
          success: true,
          data: [{
            id,
            title,
            cover: coverUrl,
            type,
            url: type === 'movie' ? `https://movie.douban.com/subject/${id}/` : `https://book.douban.com/subject/${id}/`,
            year: '',
            creator: '',
            rating: '',
            description: '通过重定向找到的唯一结果'
          }]
        };
      }
      
      // 检查是否返回了错误页面
      if (html.includes('页面不存在') || html.includes('错误')) {
        console.log('豆瓣返回了错误页面');
        return {
          success: false,
          error: '豆瓣返回了错误页面，请稍后再试'
        };
      }
      
      // 检查是否需要登录
      if (html.includes('登录') && html.includes('注册') && !html.includes('search_results') && !html.includes('item-root') && !html.includes('subject-item')) {
        console.log('豆瓣需要登录');
        return {
          success: false,
          error: '豆瓣需要登录才能搜索，请在设置中添加Cookie'
        };
      }
      
      // 调试: 保存HTML片段用于分析
      console.log('HTML片段:');
      console.log(html.substring(0, 1000));
      
      // 检查是否是JSON格式
      if (html.includes('window.__DATA__') || html.includes('application/json')) {
        console.log('检测到JSON格式的搜索结果');
        const data = this.extractJsonFromHtml(html);
        if (data) {
          console.log('成功提取JSON数据');
        } else {
          console.log('未能提取JSON数据');
        }
      }
      
      // 检查是否包含搜索结果
      if (html.includes('search_results') || html.includes('subject-item') || html.includes('item-root')) {
        console.log('找到搜索结果标记');
      } else {
        console.log('未找到搜索结果标记，可能是被重定向到了主页');
      }
      
      const results = await this.parseSearchResults(html, type);
      console.log(`解析到${results.length}个搜索结果`);
      
      if (results.length === 0) {
        // 如果没有结果，尝试检查是否有重定向
        if (html.includes('window.location.href') || html.includes('location.replace')) {
          console.log('检测到页面重定向');
          
          // 尝试提取重定向URL
          const redirectMatch = html.match(/(?:window\.location\.href|location\.replace)\s*=\s*["']([^"']+)["']/);
          if (redirectMatch && redirectMatch[1]) {
            const redirectUrl = redirectMatch[1];
            console.log(`提取到重定向URL: ${redirectUrl}`);
            
            // 检查是否重定向到了单个条目页面
            const subjectMatch = redirectUrl.match(/\/subject\/(\d+)/);
            if (subjectMatch && subjectMatch[1]) {
              const id = subjectMatch[1];
              console.log(`重定向到条目: ${id}`);
              
              return {
                success: true,
                data: [{
                  id,
                  title: `豆瓣${type === 'movie' ? '电影' : '图书'} #${id}`,
                  cover: '',
                  type,
                  url: redirectUrl.startsWith('http') ? redirectUrl : `https://${type}.douban.com${redirectUrl}`,
                  year: '',
                  creator: '',
                  rating: '',
                  description: '通过重定向找到的唯一结果'
                }]
              };
            }
            
            return {
              success: false,
              error: '豆瓣搜索被重定向，请尝试添加Cookie或稍后再试'
            };
          }
        }
        
        // 检查是否有验证码
        if (html.includes('验证码') || html.includes('captcha')) {
          console.log('检测到验证码');
          return {
            success: false,
            error: '豆瓣需要验证码，请在浏览器中访问豆瓣并完成验证后再试'
          };
        }
        
        return {
          success: false,
          error: '未找到搜索结果，请尝试其他关键词或添加Cookie'
        };
      }
      
      return {
        success: true,
        data: results
      };
    } catch (error) {
      console.error('豆瓣搜索失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 从HTML中提取JSON数据
  private static extractJsonFromHtml(html: string): any | null {
    try {
      // 尝试提取标准格式的JSON数据
      const dataMatch = html.match(/window\.__DATA__ = "([^"]+)"/);
      if (dataMatch && dataMatch[1]) {
        const jsonStr = dataMatch[1].replace(/\\/g, '');
        try {
          return JSON.parse(jsonStr);
        } catch (e) {
          console.error('标准JSON解析失败:', e);
        }
      }
      
      // 尝试提取替代格式的JSON数据
      const altDataMatch = html.match(/window\.__DATA__\s*=\s*({[^<]+})/);
      if (altDataMatch && altDataMatch[1]) {
        try {
          return JSON.parse(altDataMatch[1]);
        } catch (e) {
          console.error('替代JSON解析失败:', e);
        }
      }
      
      // 尝试提取其他可能的JSON格式
      const jsonScriptMatch = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/);
      if (jsonScriptMatch && jsonScriptMatch[1]) {
        try {
          return JSON.parse(jsonScriptMatch[1]);
        } catch (e) {
          console.error('脚本JSON解析失败:', e);
        }
      }
      
      // 尝试提取豆瓣新版API格式的JSON数据
      const apiDataMatch = html.match(/\{"payload":\{.*"total":\d+.*\}\}/);
      if (apiDataMatch && apiDataMatch[0]) {
        try {
          return JSON.parse(apiDataMatch[0]);
        } catch (e) {
          console.error('API JSON解析失败:', e);
        }
      }
      
      return null;
    } catch (error) {
      console.error('JSON提取失败:', error);
      return null;
    }
  }

  // 从HTML中直接提取电影/书籍ID
  private static extractIdsFromHtml(html: string, type: 'book' | 'movie'): string[] {
    const ids: string[] = [];
    const seenIds = new Set<string>();
    
    try {
      // 根据类型选择不同的正则表达式
      const idPattern = type === 'movie' 
        ? /(?:movie|subject)\.douban\.com\/subject\/(\d+)/g
        : /(?:book|subject)\.douban\.com\/subject\/(\d+)/g;
      
      let match;
      while ((match = idPattern.exec(html)) !== null) {
        const id = match[1];
        if (!seenIds.has(id)) {
          seenIds.add(id);
          ids.push(id);
        }
      }
      
      // 尝试匹配相对路径
      const relativePattern = /href="\/subject\/(\d+)/g;
      while ((match = relativePattern.exec(html)) !== null) {
        const id = match[1];
        if (!seenIds.has(id)) {
          seenIds.add(id);
          ids.push(id);
        }
      }
      
      console.log(`从HTML中直接提取到${ids.length}个ID`);
    } catch (error) {
      console.error('提取ID失败:', error);
    }
    
    return ids;
  }

  // 解析搜索结果HTML
  private static async parseSearchResults(html: string, type: 'book' | 'movie'): Promise<any[]> {
    const results: any[] = [];
    try {
      console.log('开始解析搜索结果');
      
      // 检查页面类型
      if (html.includes('window.__DATA__') || html.includes('application/json')) {
        console.log('检测到新版搜索结果页面，尝试提取JSON数据');
        
        // 使用新的辅助函数提取JSON数据
        const data = this.extractJsonFromHtml(html);
        
        if (data) {
          console.log('成功提取JSON数据');
          
          // 检查是否有搜索结果
          if (data.payload && data.payload.items && data.payload.items.length > 0) {
            console.log(`从JSON中找到${data.payload.items.length}个结果`);
            
            // 处理每个搜索结果
            data.payload.items.forEach((item: any) => {
              if (!item.id) return;
              
              const id = item.id;
              const title = item.title;
              const cover = item.cover_url;
              const url = item.url;
              
              let year = '';
              let creator = '';
              let rating = '';
              let description = '';
              
              // 提取年份
              if (item.year) {
                year = item.year;
              }
              
              // 提取导演/作者
              if (type === 'movie') {
                if (item.directors && item.directors.length > 0) {
                  creator = item.directors[0].name;
                }
              } else {
                if (item.authors && item.authors.length > 0) {
                  creator = item.authors[0];
                }
              }
              
              // 提取评分
              if (item.rating && item.rating.value) {
                rating = item.rating.value.toString();
              }
              
              // 提取描述
              if (item.abstract) {
                description = item.abstract;
              }
              
              results.push({
                id,
                title,
                cover,
                type,
                year,
                creator,
                rating,
                description,
                url
              });
            });
            
            if (results.length > 0) {
              return results;
            }
          } else {
            console.log('JSON中未找到搜索结果');
          }
        }
      }
      
      // 如果JSON解析失败，尝试正则表达式解析
      console.log('尝试使用正则表达式解析搜索结果');
      
      // 尝试多种模式提取搜索结果
      let foundResults = false;
      
      // 模式1: 标准搜索结果项
      if (type === 'movie') {
        // 电影搜索结果模式 - 更新以匹配新版豆瓣页面结构
        const itemRegexPatterns = [
          /<div class="item-root"[^>]*>[\s\S]*?<a[^>]*href="([^"]*?subject\/(\d+)[^"]*)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<div class="title">([^<]+)<\/div>[\s\S]*?(?:<div class="rating">[\s\S]*?<span class="rating_nums">([^<]*)<\/span>)?[\s\S]*?(?:<div class="abstract">([^<]*)<\/div>)?/g,
          /<div[^>]*class="root"[^>]*>[\s\S]*?<a[^>]*href="([^"]*?subject\/(\d+)[^"]*)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<div[^>]*>([^<]+)<\/div>[\s\S]*?(?:<span[^>]*>(\d\.\d)<\/span>)?[\s\S]*?(?:<div[^>]*>([^<]*)<\/div>)?/g
        ];
        
        for (const itemRegex of itemRegexPatterns) {
          let match;
          let matchCount = 0;
          while ((match = itemRegex.exec(html)) !== null) {
            const url = match[1];
            const id = match[2];
            const cover = match[3];
            const title = match[4].trim();
            const rating = match[5] ? match[5].trim() : '';
            const abstract = match[6] ? match[6].trim() : '';
            
            console.log(`找到电影: ${title}, ID: ${id}`);
            foundResults = true;
            matchCount++;
            
            // 从摘要中提取导演和年份
            let director = '';
            let year = '';
            
            const directorMatch = abstract.match(/导演[:：\s]*([^\/\n]+)/);
            if (directorMatch) {
              director = directorMatch[1].trim();
            }
            
            const yearMatch = abstract.match(/(\d{4})/);
            if (yearMatch) {
              year = yearMatch[1];
            }
            
            results.push({
              id,
              title,
              cover,
              type,
              year,
              creator: director,
              rating,
              description: abstract,
              url: url.startsWith('http') ? url : `https://movie.douban.com${url}`
            });
            
            // 最多提取10个结果
            if (results.length >= 10) {
              break;
            }
          }
          
          if (matchCount > 0) {
            console.log(`使用模式匹配到${matchCount}个结果`);
            break;
          }
        }
      } else {
        // 书籍搜索结果模式 - 更新以匹配新版豆瓣页面结构
        const itemRegexPatterns = [
          /<li class="subject-item"[^>]*>[\s\S]*?<div class="pic"[^>]*>[\s\S]*?<a[^>]*href="([^"]*?subject\/(\d+)[^"]*)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<div class="info">[\s\S]*?<a[^>]*>([^<]+)<\/a>[\s\S]*?(?:<div class="pub">([^<]*)<\/div>)?[\s\S]*?(?:<span class="rating_nums">([^<]*)<\/span>)?/g,
          /<div[^>]*class="root"[^>]*>[\s\S]*?<a[^>]*href="([^"]*?subject\/(\d+)[^"]*)"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"[^>]*>[\s\S]*?<div[^>]*>([^<]+)<\/div>[\s\S]*?(?:<span[^>]*>(\d\.\d)<\/span>)?[\s\S]*?(?:<div[^>]*>([^<]*)<\/div>)?/g
        ];
        
        for (const itemRegex of itemRegexPatterns) {
          let match;
          let matchCount = 0;
          while ((match = itemRegex.exec(html)) !== null) {
            const url = match[1];
            const id = match[2];
            const cover = match[3];
            const title = match[4].trim();
            const pubInfo = match[5] ? match[5].trim() : '';
            const rating = match[6] ? match[6].trim() : '';
            
            console.log(`找到书籍: ${title}, ID: ${id}`);
            foundResults = true;
            matchCount++;
            
            // 从出版信息中提取作者和年份
            let author = '';
            let year = '';
            
            const authorMatch = pubInfo.match(/^([^\/]+)/);
            if (authorMatch) {
              author = authorMatch[1].trim();
            }
            
            const yearMatch = pubInfo.match(/(\d{4})/);
            if (yearMatch) {
              year = yearMatch[1];
            }
            
            results.push({
              id,
              title,
              cover,
              type,
              year,
              creator: author,
              rating,
              description: pubInfo,
              url: url.startsWith('http') ? url : `https://book.douban.com${url}`
            });
            
            // 最多提取10个结果
            if (results.length >= 10) {
              break;
            }
          }
          
          if (matchCount > 0) {
            console.log(`使用模式匹配到${matchCount}个结果`);
            break;
          }
        }
      }
      
      // 如果没有找到结果，尝试通用模式
      if (!foundResults) {
        console.log('尝试通用模式提取搜索结果');
        
        // 通用模式: 查找所有可能的链接
        const linkPatterns = [
          type === 'movie' 
            ? /href="(https?:\/\/movie\.douban\.com\/subject\/(\d+)[^"]*)"[^>]*>([^<]+)<\/a>/g
            : /href="(https?:\/\/book\.douban\.com\/subject\/(\d+)[^"]*)"[^>]*>([^<]+)<\/a>/g,
          type === 'movie'
            ? /href="(\/subject\/(\d+)[^"]*)"[^>]*>([^<]+)<\/a>/g
            : /href="(\/subject\/(\d+)[^"]*)"[^>]*>([^<]+)<\/a>/g
        ];
        
        const seenIds = new Set();
        
        for (const linkPattern of linkPatterns) {
          let match;
          let matchCount = 0;
          
          while ((match = linkPattern.exec(html)) !== null) {
            const urlPath = match[1];
            const id = match[2];
            const title = match[3].trim();
            
            // 跳过已处理的ID和无效标题
            if (seenIds.has(id) || !title || title.length > 50 || title.includes('的更多') || title === '豆瓣' || title === '登录') {
              continue;
            }
            
            seenIds.add(id);
            console.log(`通用模式找到结果: ${title}, ID: ${id}`);
            matchCount++;
            
            const url = urlPath.startsWith('http') 
              ? urlPath 
              : (type === 'movie' ? `https://movie.douban.com${urlPath}` : `https://book.douban.com${urlPath}`);
            
            results.push({
              id,
              title,
              cover: '',
              type,
              year: '',
              creator: '',
              rating: '',
              description: '',
              url
            });
            
            // 最多提取10个结果
            if (results.length >= 10) {
              break;
            }
          }
          
          if (matchCount > 0) {
            console.log(`通用模式匹配到${matchCount}个结果`);
            foundResults = true;
            break;
          }
        }
        
        // 如果仍然没有找到结果，尝试最后的备用方案
        if (!foundResults) {
          console.log('尝试最后的备用方案');
          // 使用辅助函数直接提取ID
          const ids = this.extractIdsFromHtml(html, type);
          if (ids.length > 0) {
            foundResults = true;
            console.log(`备用方案找到${ids.length}个ID，尝试抓取详情...`);
            // 并发抓取详情
            const detailPromises = ids.slice(0, 10).map(id =>
              type === 'movie' ? this.getMovieDetail(id) : this.getBookDetail(id)
            );
            const details = await Promise.all(detailPromises);
            for (const detail of details) {
              if (detail) {
                // 将detail转换为搜索结果格式
                results.push({
                  id: detail.id,
                  title: detail.title,
                  cover: detail.cover || detail.cover_url,
                  type,
                  year: detail.year || '',
                  creator: type === 'movie' ? (detail.director || '') : (detail.author ? detail.author.join(', ') : ''),
                  rating: detail.rating?.value?.toString() || '',
                  url: detail.url
                });
              }
            }
          }
        }
      }
      
      // 打印解析结果
      console.log(`最终解析到${results.length}个搜索结果`);
      for (const result of results) {
        console.log(`- ${result.title} (${result.id}): ${result.url}`);
      }
      
      if (results.length === 0) {
        console.log('豆瓣搜索未返回结果');
      }
    } catch (error) {
      console.error('解析搜索结果出错:', error);
    }
    
    return results;
  }

  // 根据ID获取电影详情
  public static async getMovieDetail(doubanId: string): Promise<DoubanItemDetail | null> {
    try {
      // 使用桌面版API
      const url = `https://movie.douban.com/subject/${doubanId}/`;
      console.log(`获取电影详情: ${url}`);
      
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://movie.douban.com/'
      };
      
      // 如果有cookie，添加到请求头
      if (this.cookie) {
        headers['Cookie'] = this.cookie;
      }
      
      const response = await requestUrl({
        url: url,
        method: 'GET',
        headers: headers
      });

      const html = response.text;
      console.log(`获取到的HTML长度: ${html.length}`);
      
      return this.parseDesktopMovieDetail(html, url, doubanId);
    } catch (error) {
      console.error('获取电影详情失败:', error);
      return null;
    }
  }

  // 根据ID获取书籍详情
  public static async getBookDetail(doubanId: string): Promise<DoubanItemDetail | null> {
    try {
      // 使用桌面版API
      const url = `https://book.douban.com/subject/${doubanId}/`;
      console.log(`获取书籍详情: ${url}`);
      
      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://book.douban.com/'
      };
      
      // 如果有cookie，添加到请求头
      if (this.cookie) {
        headers['Cookie'] = this.cookie;
      }
      
      const response = await requestUrl({
        url: url,
        method: 'GET',
        headers: headers
      });

      const html = response.text;
      console.log(`获取到的HTML长度: ${html.length}`);
      
      return this.parseDesktopBookDetail(html, url, doubanId);
    } catch (error) {
      console.error('获取书籍详情失败:', error);
      return null;
    }
  }

  // 解析桌面版电影详情HTML
  private static parseDesktopMovieDetail(html: string, url: string, doubanId?: string): DoubanItemDetail | null {
    try {
      console.log('开始解析桌面版电影详情');
      const detail: DoubanItemDetail = {
        title: '',
        url: url
      };
      
      // 提取标题 - 多种模式尝试
      const titlePatterns = [
        /<span property="v:itemreviewed">([^<]+)<\/span>/,
        /<title>([^<]+)(?:\s*\(豆瓣\))?<\/title>/,
        /<h1>([^<]+)<\/h1>/
      ];
      
      for (const pattern of titlePatterns) {
        const titleMatch = html.match(pattern);
        if (titleMatch && titleMatch[1]) {
          detail.title = titleMatch[1].trim().replace(/\(豆瓣\)$/, '');
          console.log(`找到标题: ${detail.title}`);
          break;
        }
      }
      
      // 提取原始标题
      const originalTitlePatterns = [
        /<span class="pl">原名:<\/span>\s*([^<]+)/,
        /<span>原名:([^<]+)<\/span>/
      ];
      
      for (const pattern of originalTitlePatterns) {
        const originalTitleMatch = html.match(pattern);
        if (originalTitleMatch && originalTitleMatch[1]) {
          detail.original_title = originalTitleMatch[1].trim();
          console.log(`找到原始标题: ${detail.original_title}`);
          break;
        }
      }
      
      // 提取封面 - 多种模式尝试
      const coverPatterns = [
        /<img[^>]*src="([^"@]+(@|\.jpg|\.png|\.webp))[^"]*"[^>]*title="点击看更多海报"/,
        /<img[^>]*src="([^"@]+(@|\.jpg|\.png|\.webp))[^"]*"[^>]*alt="[^"]*海报"[^>]*>/,
        /<img[^>]*src="([^"@]+(@|\.jpg|\.png|\.webp))[^"]*"[^>]*class="[^"]*"[^>]*>/
      ];
      
      for (const pattern of coverPatterns) {
        const coverMatch = html.match(pattern);
        if (coverMatch && coverMatch[1]) {
          detail.cover_url = coverMatch[1].split('@')[0];
          console.log(`找到封面: ${detail.cover_url}`);
          break;
        }
      }
      
      // 提取年份 - 多种模式尝试
      const yearPatterns = [
        /<span class="year">\((\d{4})\)<\/span>/,
        />(\d{4})年<\/span>/,
        /(\d{4})年上映/
      ];
      
      for (const pattern of yearPatterns) {
        const yearMatch = html.match(pattern);
        if (yearMatch && yearMatch[1]) {
          detail.year = yearMatch[1];
          console.log(`找到年份: ${detail.year}`);
          break;
        }
      }
      
      // 提取导演 - 多种模式尝试
      const directorPatterns = [
        /<a[^>]*rel="v:directedBy"[^>]*>([^<]+)<\/a>/,
        /<span class='pl'>导演:<\/span>\s*<a[^>]*>([^<]+)<\/a>/,
        /导演:\s*<a[^>]*>([^<]+)<\/a>/
      ];
      
      for (const pattern of directorPatterns) {
        const directorMatch = html.match(pattern);
        if (directorMatch && directorMatch[1]) {
          detail.director = directorMatch[1].trim();
          console.log(`找到导演: ${detail.director}`);
          break;
        }
      }
      
      // 提取评分 - 多种模式尝试
      const ratingPatterns = [
        /<strong[^>]*class="ll rating_num"[^>]*>([^<]+)<\/strong>/,
        /<strong[^>]*>(\d+\.\d+)<\/strong>/
      ];
      
      for (const pattern of ratingPatterns) {
        const ratingMatch = html.match(pattern);
        if (ratingMatch && ratingMatch[1]) {
          detail.rating = {
            value: parseFloat(ratingMatch[1])
          };
          
          // 提取评分人数 - 多种模式尝试
          const ratingCountPatterns = [
            /<span property="v:votes">([^<]+)<\/span>/,
            />(\d+)人评价</
          ];
          
          for (const countPattern of ratingCountPatterns) {
            const ratingCountMatch = html.match(countPattern);
            if (ratingCountMatch && ratingCountMatch[1]) {
              detail.rating.count = parseInt(ratingCountMatch[1]);
              break;
            }
          }
          
          console.log(`找到评分: ${detail.rating.value} (${detail.rating.count || '未知'}人评价)`);
          break;
        }
      }
      
      // 提取简介 - 多种模式尝试
      const descPatterns = [
        /<span property="v:summary"[^>]*>([\s\S]*?)<\/span>/,
        /<span class="all hidden">([\s\S]*?)<\/span>/,
        /<div class="indent"[^>]*>\s*<span>([\s\S]*?)<\/span>/
      ];
      
      for (const pattern of descPatterns) {
        const descMatch = html.match(pattern);
        if (descMatch && descMatch[1]) {
          detail.description = descMatch[1].replace(/<[^>]+>/g, '').trim();
          console.log(`找到简介: ${detail.description.substring(0, 50)}...`);
          break;
        }
      }
      
      // 提取标签 - 多种模式尝试
      const tags: string[] = [];
      const tagsPatterns = [
        /<span class="tags-body">([\s\S]*?)<\/span>/,
        /<div class="tags-body">([\s\S]*?)<\/div>/
      ];
      
      for (const pattern of tagsPatterns) {
        const tagsMatch = html.match(pattern);
        if (tagsMatch && tagsMatch[1]) {
          const tagLinksRegex = /<a[^>]*>([^<]+)<\/a>/g;
          let tagMatch;
          while ((tagMatch = tagLinksRegex.exec(tagsMatch[1])) !== null) {
            tags.push(tagMatch[1].trim());
          }
          
          if (tags.length > 0) break;
        }
      }
      
      if (tags.length > 0) {
        detail.tags = tags;
        console.log(`找到标签: ${tags.join(', ')}`);
      }
      
      // 补全id和cover字段
      if (doubanId) detail.id = doubanId;
      if (detail.cover_url) detail.cover = detail.cover_url;
      if (!detail.url) detail.url = url;
      // 确保评分是字符串格式
      if (detail.rating?.value) {
        detail.rating.value = parseFloat(detail.rating.value.toString());
      }
      return detail;
    } catch (error) {
      console.error('解析电影详情失败:', error);
      return null;
    }
  }

  // 解析桌面版书籍详情HTML
  private static parseDesktopBookDetail(html: string, url: string, doubanId?: string): DoubanItemDetail | null {
    try {
      console.log('开始解析桌面版书籍详情');
      const detail: DoubanItemDetail = {
        title: '',
        url: url
      };
      
      // 提取标题 - 多种模式尝试
      const titlePatterns = [
        /<span property="v:itemreviewed">([^<]+)<\/span>/,
        /<title>([^<]+)(?:\s*\(豆瓣\))?<\/title>/,
        /<h1>([^<]+)<\/h1>/
      ];
      
      for (const pattern of titlePatterns) {
        const titleMatch = html.match(pattern);
        if (titleMatch && titleMatch[1]) {
          detail.title = titleMatch[1].trim().replace(/\(豆瓣\)$/, '');
          console.log(`找到标题: ${detail.title}`);
          break;
        }
      }
      
      // 提取封面 - 多种模式尝试
      const coverPatterns = [
        /<a class="nbg"[^>]*>\s*<img[^>]*src="([^"@]+(@|\.jpg|\.png|\.webp))[^"]*"[^>]*>/,
        /<img[^>]*src="([^"@]+(@|\.jpg|\.png|\.webp))[^"]*"[^>]*alt="[^"]*封面"[^>]*>/,
        /<img[^>]*src="([^"@]+(@|\.jpg|\.png|\.webp))[^"]*"[^>]*id="mainpic"[^>]*>/
      ];
      
      for (const pattern of coverPatterns) {
        const coverMatch = html.match(pattern);
        if (coverMatch && coverMatch[1]) {
          detail.cover_url = coverMatch[1].split('@')[0];
          console.log(`找到封面: ${detail.cover_url}`);
          break;
        }
      }
      
      // 提取作者 - 多种模式尝试
      const authorPatterns = [
        /<span class="pl">作者:<\/span>[\s\S]*?<a[^>]*>([^<]+)<\/a>/,
        /作者:[\s\S]*?<a[^>]*>([^<]+)<\/a>/,
        /<span class="pl">作者:<\/span>([\s\S]*?)<br\s*\/?>/
      ];
      
      for (const pattern of authorPatterns) {
        const authorMatch = html.match(pattern);
        if (authorMatch && authorMatch[1]) {
          const authorText = authorMatch[1].replace(/<[^>]+>/g, '').trim();
          detail.author = [authorText];
          console.log(`找到作者: ${authorText}`);
          break;
        }
      }
      
      // 提取出版年份 - 多种模式尝试
      const infoText = html.match(/<div id="info"[^>]*>([\s\S]*?)<\/div>/) || ['', html];
      const infoContent = infoText[1];
      
      const yearPatterns = [
        /出版年份?:?\s*(\d{4})/,
        /出版时间:?\s*(\d{4})/,
        /出版日期:?\s*(\d{4})/,
        /出版社:?[^<]*(\d{4})年/
      ];
      
      for (const pattern of yearPatterns) {
        const yearMatch = infoContent.match(pattern);
        if (yearMatch && yearMatch[1]) {
          detail.year = yearMatch[1];
          console.log(`找到年份: ${detail.year}`);
          break;
        }
      }
      
      // 提取评分 - 多种模式尝试
      const ratingPatterns = [
        /<strong class="ll rating_num"[^>]*>([^<]+)<\/strong>/,
        /<strong[^>]*>(\d+\.\d+)<\/strong>/
      ];
      
      for (const pattern of ratingPatterns) {
        const ratingMatch = html.match(pattern);
        if (ratingMatch && ratingMatch[1]) {
          detail.rating = {
            value: parseFloat(ratingMatch[1])
          };
          
          // 提取评分人数 - 多种模式尝试
          const ratingCountPatterns = [
            /<span property="v:votes">([^<]+)<\/span>/,
            />(\d+)人评价</
          ];
          
          for (const countPattern of ratingCountPatterns) {
            const ratingCountMatch = html.match(countPattern);
            if (ratingCountMatch && ratingCountMatch[1]) {
              detail.rating.count = parseInt(ratingCountMatch[1]);
              break;
            }
          }
          
          console.log(`找到评分: ${detail.rating.value} (${detail.rating.count || '未知'}人评价)`);
          break;
        }
      }
      
      // 提取简介 - 多种模式尝试
      const descPatterns = [
        /<div class="intro">[\s\S]*?<p>([\s\S]*?)<\/p>/,
        /<div class="indent"[^>]*>\s*<span>([\s\S]*?)<\/span>/,
        /<span class="all hidden">([\s\S]*?)<\/span>/
      ];
      
      for (const pattern of descPatterns) {
        const descMatch = html.match(pattern);
        if (descMatch && descMatch[1]) {
          detail.description = descMatch[1].replace(/<[^>]+>/g, '').trim();
          console.log(`找到简介: ${detail.description.substring(0, 50)}...`);
          break;
        }
      }
      
      // 提取标签 - 多种模式尝试
      const tags: string[] = [];
      const tagsPatterns = [
        /<a class="tag"[^>]*>([^<]+)<\/a>/g,
        /<a[^>]*href="\/tag\/[^"]+"[^>]*>([^<]+)<\/a>/g
      ];
      
      for (const pattern of tagsPatterns) {
        let tagMatch;
        while ((tagMatch = pattern.exec(html)) !== null) {
          const tag = tagMatch[1].trim();
          if (!tags.includes(tag)) {
            tags.push(tag);
          }
        }
        
        if (tags.length > 0) break;
      }
      
      if (tags.length > 0) {
        detail.tags = tags;
        console.log(`找到标签: ${tags.join(', ')}`);
      }
      
      // 补全id和cover字段
      if (doubanId) detail.id = doubanId;
      if (detail.cover_url) detail.cover = detail.cover_url;
      if (!detail.url) detail.url = url;
      // 确保评分是字符串格式
      if (detail.rating?.value) {
        detail.rating.value = parseFloat(detail.rating.value.toString());
      }
      return detail;
    } catch (error) {
      console.error('解析书籍详情失败:', error);
      return null;
    }
  }
} 