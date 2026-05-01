import { requestUrl } from 'obsidian';

export interface TMDBItemDetail {
    title: string;
    subtitle?: string;
    original_title?: string;
    director?: string;
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
    original_language?: string;
    imdb_id?: string;
    posters?: string[];
}

export interface TMDBSearchResult {
    success: boolean;
    data?: any[];
    error?: string;
}

export class TMDBAPI {
    private static apiKey: string = '';
    private static accessToken: string = '';

    public static setApiKey(key: string) {
        this.apiKey = key;
    }

    public static setAccessToken(token: string) {
        this.accessToken = token;
    }

    private static getHeaders() {
        const headers: Record<string, string> = {
            'Accept': 'application/json',
        };
        if (this.accessToken) {
            headers['Authorization'] = `Bearer ${this.accessToken}`;
        }
        return headers;
    }

    private static getUrl(path: string, params: Record<string, string> = {}) {
        const query = new URLSearchParams(params);
        if (this.apiKey && !this.accessToken) {
            query.append('api_key', this.apiKey);
        }
        query.append('language', 'zh-CN');
        return `https://api.themoviedb.org/3${path}?${query.toString()}`;
    }

    public static async search(keyword: string, type: 'movie' | 'tv'): Promise<TMDBSearchResult> {
        if (!this.apiKey && !this.accessToken) {
            return {
                success: false,
                error: '请先在设置中配置 TMDB API Key 或访问令牌'
            };
        }

        const path = `/search/${type}`;
        const url = this.getUrl(path, { query: keyword });

        try {
            console.log(`正在搜索 TMDB (${type}): ${url}`);
            const response = await requestUrl({
                url,
                method: 'GET',
                headers: this.getHeaders()
            });

            const data = response.json;
            if (data.results && data.results.length > 0) {
                return {
                    success: true,
                    data: data.results.map((item: any) => ({
                        id: item.id.toString(),
                        title: item.title || item.name,
                        cover: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
                        type: type,
                        year: (item.release_date || item.first_air_date || '').substring(0, 4),
                        rating: item.vote_average?.toString() || '',
                        description: item.overview,
                        url: `https://www.themoviedb.org/${type}/${item.id}`,
                        creator: '' // 搜索时无法直接获取导演，详情请求时再获取
                    }))
                };
            }
            return { success: false, error: '未找到相关结果' };
        } catch (error) {
            console.error('TMDB 搜索失败:', error);
            return { success: false, error: error.message };
        }
    }

    public static async getDetail(id: string, type: 'movie' | 'tv'): Promise<TMDBItemDetail | null> {
        if (!this.apiKey && !this.accessToken) {
            return null;
        }

        const path = `/${type}/${id}`;
        const url = this.getUrl(path, {
            append_to_response: 'credits,external_ids,images',
            include_image_language: 'zh-CN,en,null'
        });

        try {
            console.log(`获取 TMDB 详情: ${url}`);
            const response = await requestUrl({
                url,
                method: 'GET',
                headers: this.getHeaders()
            });

            const item = response.json;
            let director = '';
            if (item.credits && item.credits.crew) {
                // 对于电影，获取导演
                if (type === 'movie') {
                    const dir = item.credits.crew.find((person: any) => person.job === 'Director');
                    if (dir) director = dir.name;
                }
                // 对于剧集，通常使用 creator，但这里为了兼容 Douban 字段，我们尝试寻找关键人物
                else if (type === 'tv') {
                    if (item.created_by && item.created_by.length > 0) {
                        director = item.created_by.map((c: any) => c.name).join(', ');
                    }
                }
            }

            const detail: TMDBItemDetail = {
                id: item.id.toString(),
                title: item.title || item.name,
                original_title: item.original_title || item.original_name,
                director: director,
                year: (item.release_date || item.first_air_date || '').substring(0, 4),
                cover_url: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
                cover: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
                rating: {
                    value: item.vote_average,
                    count: item.vote_count
                },
                description: item.overview,
                tags: item.genres?.map((g: any) => g.name) || [],
                url: `https://www.themoviedb.org/${type}/${item.id}`,
                original_language: item.original_language,
                imdb_id: item.external_ids?.imdb_id,
                posters: item.images?.posters?.map((p: any) => `https://image.tmdb.org/t/p/original${p.file_path}`) || []
            };

            return detail;
        } catch (error) {
            console.error('TMDB 获取详情失败:', error);
            return null;
        }
    }
}
