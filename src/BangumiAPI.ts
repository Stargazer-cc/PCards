import { Notice, requestUrl, RequestUrlResponse } from "obsidian";

export interface AnimeSearchResult {
    text: string;
    link: string;
    type: string;
    typeId: number;
}

export interface AnimeDetail {
    title: string;
    director: string;
    year: string;
    rating: string;
    description: string;
    cover?: string;
    tags?: string[];
    collection_date?: string;
    meta?: { [key: string]: string };
    url?: string;
}

export class BangumiAPI {
    private cookie: string;
    private headers: Record<string, string>;

    constructor(cookie?: string) {
        this.cookie = cookie || '';
        this.headers = {
            "Content-Type": "text/html; charset=utf-8",
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
            'Sec-Fetch-Site': 'same-site',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-User': '?1',
            'Sec-Fetch-Dest': 'document',
            'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        };

        if (this.cookie) {
            this.headers['Cookie'] = this.cookie;
        }
    }

    public setCookie(cookie: string): void {
        this.cookie = cookie;
        this.headers['Cookie'] = cookie;
    }

    /**
     * 搜索番剧
     * @param keyword 搜索关键词
     * @param page 页码
     * @returns 搜索结果列表
     */
    public async search(keyword: string, page: number = 1): Promise<AnimeSearchResult[]> {
        try {
            const url = `https://bgm.tv/subject_search/${encodeURIComponent(keyword)}?cat=2&page=${page}`;
            const response = await this.request(url);
            
            if (!response) {
                return [];
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(response, "text/html");
            const resultContainer = doc.querySelector("#browserItemList");
            
            if (!resultContainer) {
                return [];
            }

            const results = resultContainer.querySelectorAll(".inner");
            const itemList: AnimeSearchResult[] = [];

            // 添加下一页选项
            itemList.push({
                text: "❔ 没找到想要的作品 \n下一页",
                link: `https://bgm.tv/subject_search/${encodeURIComponent(keyword)}?cat=2&page=${page + 1}`,
                type: "none",
                typeId: 3
            });

            // 解析搜索结果项
            for (let i = 0; i < results.length; i++) {
                const item = results[i];
                const typeClass = item.querySelector("h3 span")?.getAttribute("class");
                
                if (typeClass && typeClass.includes("ico_subject_type subject_type_2")) {
                    const title = item.querySelector("h3 a")?.textContent?.trim() || "";
                    const info = item.querySelector(".info.tip")?.textContent?.trim() || "";
                    const link = "https://bgm.tv" + (item.querySelector("h3 a")?.getAttribute("href") || "");
                    
                    itemList.push({
                        text: "🎞️ 《" + title + "》 \n" + info,
                        link: link,
                        type: "anime",
                        typeId: 2
                    });
                }
            }

            // 按typeId排序
            return itemList.sort((a, b) => a.typeId - b.typeId);
        } catch (error) {
            console.error("搜索番剧出错:", error);
            return [];
        }
    }

    /**
     * 获取番剧详情
     * @param url 番剧页面URL
     * @returns 番剧详细信息
     */
    public async getAnimeDetail(url: string): Promise<AnimeDetail | null> {
        try {
            const response = await this.request(url);
            
            if (!response) {
                return null;
            }

            const parser = new DOMParser();
            const doc = parser.parseFromString(response, "text/html");
            const $ = (s: string) => doc.querySelector(s);

            // 检查是否为番剧页面
            const type = $("#headerSubject")?.getAttribute('typeof');
            if (type !== "v:Movie") {
                new Notice("非影视类型作品");
                return null;
            }

            // 解析基本信息
            const keywords = $("meta[name='keywords']")?.getAttribute('content')?.split(",") || [];
            const title = keywords[0] || "未知";
            const jpTitle = keywords[1] || "";
            
            // 获取封面图
            let coverUrl = $("div[align='center'] > a")?.getAttribute('href') || "";
            if (coverUrl) {
                if (!coverUrl.startsWith('http')) {
                    coverUrl = 'https:' + coverUrl;
                }
            }

            // 获取评分
            const rating = $("span[property='v:average']")?.textContent || "未知";

            // 获取简介
            let summary = $("#subject_summary")?.textContent || "暂无简介";
            summary = summary.replace(/&nbsp/g, "\n").trim();
            summary = summary.replace(/\s\s\s\s/g, "\n");

            // 获取其他信息
            const infoItems = doc.querySelectorAll("#infobox > li");
            const infoText = Array.from(infoItems).map(li => li.textContent).join("\n");

            // 解析导演
            const directorMatch = /导演:([^\n]*)/.exec(infoText);
            const director = directorMatch ? directorMatch[1].trim() : "未知";

            // 解析年份
            const dateMatch = /放送开始:([^\n]*)/.exec(infoText) || 
                              /发售日:([^\n]*)/.exec(infoText) || 
                              /上映年度:([^\n]*)/.exec(infoText);
            const date = dateMatch ? dateMatch[1].trim() : "未知";
            const year = date.split("年")[0] || "";

            // 创建标签数组（从类别、原作等信息生成）
            const tags: string[] = [];
            
            // 从类别提取标签
            const categoryItems = doc.querySelectorAll("#subject_detail .subject_tag_section a");
            categoryItems.forEach(item => {
                const tag = item.textContent?.trim();
                if (tag) tags.push(tag);
            });

            // 从原作提取标签
            const fromMatch = /原作:([^\n]*)/.exec(infoText);
            if (fromMatch && fromMatch[1].trim() !== "-" && fromMatch[1].trim() !== "未知") {
                tags.push(fromMatch[1].split("(")[0].split("・")[0].trim());
            }

            // 构建元数据
            const meta: Record<string, string> = {};
            
            // 解析动画制作公司
            const animeMakeMatch = /动画制作:([^\n]*)/.exec(infoText);
            if (animeMakeMatch) {
                meta["制作公司"] = animeMakeMatch[1].trim();
            }

        
            // 解析话数
            const episodeMatch = /话数:.(\d*)/.exec(infoText);
            if (episodeMatch) {
                meta["集数"] = episodeMatch[1].trim();
            }

            return {
                title: title,
                director: director,
                year: year,
                rating: rating,
                description: summary,
                cover: coverUrl,
                tags: tags,
                url: url,
                meta: meta
            };
        } catch (error) {
            console.error("获取番剧详情出错:", error);
            return null;
        }
    }

    /**
     * 发送HTTP请求
     * @param url 请求URL
     * @returns 请求响应内容
     */
    private async request(url: string): Promise<string | null> {
        try {
            const response: RequestUrlResponse = await requestUrl({
                url: url,
                method: "GET",
                headers: this.headers
            });

            if (response.status !== 200) {
                console.error("请求失败:", response.status, response.text);
                return null;
            }

            return response.text;
        } catch (error) {
            console.error("请求出错:", error);
            return null;
        }
    }
} 