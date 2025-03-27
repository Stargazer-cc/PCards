import { Plugin, MarkdownPostProcessorContext, TFile, TAbstractFile } from 'obsidian';

interface CardData {
  title: string;
  year: string;
  description: string;
  tags?: string[];
  cover?: string;
  meta?: { [key: string]: string };
}

interface MusicCardData extends CardData {
  artist: string;
}

interface BookCardData extends CardData {
  author: string;
}

interface MovieCardData extends CardData {
  director: string;
}

export default class NewCardsPlugin extends Plugin {
  async onload() {
    // 注册音乐卡片处理器
    this.registerMarkdownCodeBlockProcessor('music-card', (source, el, ctx) => {
      const data = this.parseYaml(source) as MusicCardData;
      this.renderMusicCard(data, el);
    });

    // 注册书籍卡片处理器
    this.registerMarkdownCodeBlockProcessor('book-card', (source, el, ctx) => {
      const data = this.parseYaml(source) as BookCardData;
      this.renderBookCard(data, el);
    });

    // 注册电影卡片处理器
    this.registerMarkdownCodeBlockProcessor('movie-card', (source, el, ctx) => {
      const data = this.parseYaml(source) as MovieCardData;
      this.renderMovieCard(data, el);
    });
  }

  private parseYaml(source: string): any {
    const lines = source.split('\n');
    const data: any = {};
    const meta: { [key: string]: string } = {};
    
    lines.forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        if (key && value) {
          if (key === 'tags') {
            data[key] = value.split(' ').filter(tag => tag.trim());
          } else if (key === 'meta') {
            // Skip meta key itself as we handle meta data differently
            return;
          } else if (key.startsWith('meta.')) {
            // Handle meta data fields
            const metaKey = key.substring(5).trim();
            if (metaKey) {
              meta[metaKey] = value;
            }
          } else {
            data[key] = value;
          }
        }
      }
    });
    
    if (Object.keys(meta).length > 0) {
      data.meta = meta;
    }

    return data;
  }

  private renderMusicCard(data: MusicCardData, el: HTMLElement) {
    const container = el.createDiv({ cls: 'new-cards-container music-card' });
    
    // 创建背景容器
    if (data.cover) {
      const backgroundContainer = container.createDiv({ cls: 'background-container' });
      backgroundContainer.createEl('img', {
        attr: { src: this.getCoverImageSrc(data.cover) }
      });
    }
    
    const coverContainer = container.createDiv({ cls: 'cover-container' });
    const infoContainer = container.createDiv({ cls: 'info-container' });
    
    // 添加封面图片或音乐图标
    if (data.cover) {
      const coverImg = coverContainer.createEl('img', {
        attr: { src: this.getCoverImageSrc(data.cover) },
        cls: 'cover-image'
      });
    } else {
      coverContainer.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      `;
    }
    
    // 添加信息
    infoContainer.createEl('h3', { text: data.title, cls: 'card-info-title' });
    infoContainer.createEl('div', { text: data.artist, cls: 'artist' });
    infoContainer.createEl('div', { text: data.year, cls: 'year' });

    // 添加meta数据
    if (data.meta) {
      const metaContainer = infoContainer.createDiv({ cls: 'meta-container' });
      Object.entries(data.meta).forEach(([key, value]) => {
        metaContainer.createEl('div', {
          cls: 'meta-item',
          text: `${key}: ${value}`
        });
      });
    }

    infoContainer.createEl('p', { text: data.description, cls: 'card-info-description' });

    // 添加标签
    if (data.tags && data.tags.length > 0) {
      const tagsContainer = infoContainer.createDiv({ cls: 'card-tags-container' });
      data.tags.forEach(tag => {
        tagsContainer.createEl('a', {
          text: tag,
          cls: 'tag'
        });
      });
    }
  }

  private renderBookCard(data: BookCardData, el: HTMLElement) {
    const container = el.createDiv({ cls: 'new-cards-container book-card' });
    
    // 创建背景容器
    if (data.cover) {
      const backgroundContainer = container.createDiv({ cls: 'background-container' });
      backgroundContainer.createEl('img', {
        attr: { src: this.getCoverImageSrc(data.cover) }
      });
    }
    
    const coverContainer = container.createDiv({ cls: 'cover-container' });
    const infoContainer = container.createDiv({ cls: 'info-container' });
    
    // 添加封面图片或书籍图标
    if (data.cover) {
      const coverImg = coverContainer.createEl('img', {
        attr: { src: this.getCoverImageSrc(data.cover) },
        cls: 'cover-image'
      });
    } else {
      coverContainer.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
      `;
    }
    
    // 添加信息
    infoContainer.createEl('h3', { text: data.title, cls: 'card-info-title' });
    infoContainer.createEl('div', { text: data.author, cls: 'author' });
    infoContainer.createEl('div', { text: data.year, cls: 'year' });

    // 添加meta数据
    if (data.meta) {
      const metaContainer = infoContainer.createDiv({ cls: 'meta-container' });
      Object.entries(data.meta).forEach(([key, value]) => {
        metaContainer.createEl('div', {
          cls: 'meta-item',
          text: `${key}: ${value}`
        });
      });
    }

    infoContainer.createEl('p', { text: data.description, cls: 'card-info-description' });

    // 添加标签
    if (data.tags && data.tags.length > 0) {
      const tagsContainer = infoContainer.createDiv({ cls: 'card-tags-container' });
      data.tags.forEach(tag => {
        tagsContainer.createEl('a', {
          text: tag,
          cls: 'tag'
        });
      });
    }
  }

  private renderMovieCard(data: MovieCardData, el: HTMLElement) {
    const container = el.createDiv({ cls: 'new-cards-container movie-card' });
    
    // 创建背景容器
    if (data.cover) {
      const backgroundContainer = container.createDiv({ cls: 'background-container' });
      backgroundContainer.createEl('img', {
        attr: { src: this.getCoverImageSrc(data.cover) }
      });
    }
    
    const coverContainer = container.createDiv({ cls: 'cover-container' });
    const infoContainer = container.createDiv({ cls: 'info-container' });
    
    // 添加封面图片或电影图标
    if (data.cover) {
      const coverImg = coverContainer.createEl('img', {
        attr: { src: this.getCoverImageSrc(data.cover) },
        cls: 'cover-image'
      });
    } else {
      coverContainer.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
          <line x1="7" y1="2" x2="7" y2="22"/>
          <line x1="17" y1="2" x2="17" y2="22"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <line x1="2" y1="7" x2="7" y2="7"/>
          <line x1="2" y1="17" x2="7" y2="17"/>
          <line x1="17" y1="17" x2="22" y2="17"/>
          <line x1="17" y1="7" x2="22" y2="7"/>
        </svg>
      `;
    }
    
    // 添加信息
    infoContainer.createEl('h3', { text: data.title, cls: 'card-info-title' });
    infoContainer.createEl('div', { text: data.director, cls: 'director' });
    infoContainer.createEl('div', { text: data.year, cls: 'year' });

    // 添加meta数据
    if (data.meta) {
      const metaContainer = infoContainer.createDiv({ cls: 'meta-container' });
      Object.entries(data.meta).forEach(([key, value]) => {
        metaContainer.createEl('div', {
          cls: 'meta-item',
          text: `${key}: ${value}`
        });
      });
    }

    infoContainer.createEl('p', { text: data.description, cls: 'card-info-description' });

    // 添加标签
    if (data.tags && data.tags.length > 0) {
      const tagsContainer = infoContainer.createDiv({ cls: 'card-tags-container' });
      data.tags.forEach(tag => {
        tagsContainer.createEl('a', {
          text: tag,
          cls: 'tag'
        });
      });
    }
  }

  private getCoverImageSrc(cover: string): string {
    console.log("Received cover:", cover); // 输出 cover 变量的值

    // 处理外部链接
    if (cover.startsWith('http://') || cover.startsWith('https://')) {
      console.log("External URL detected:", cover);
      return cover;
    }

    // 处理内部链接 ![[filename]]
    const internalLinkMatch = cover.match(/!\[\[(.*?)(\|.*?)?\]\]/);
    if (internalLinkMatch && internalLinkMatch[1]) {
      let filename = internalLinkMatch[1].trim();
      console.log("Detected internal link, filename:", filename);

      // 获取当前文件所在的 vault
      const vault = this.app.vault;

      // 查找文件
      const file = vault.getAbstractFileByPath(filename) || 
                   vault.getFiles().find(f => f.name === filename);

      if (file && file instanceof TFile) {
        const resourcePath = vault.getResourcePath(file as TFile);
        console.log("Resolved file path:", resourcePath);
        return resourcePath;
      } else {
        console.log("File not found in vault:", filename);
      }
    }

    console.log("No valid cover found, returning empty string.");
    return '';
  }

  onunload() {

  }
}