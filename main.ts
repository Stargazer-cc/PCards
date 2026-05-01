import { Plugin, MarkdownPostProcessorContext, TFile, TAbstractFile, Modal, Setting, Menu, addIcon, PluginSettingTab, App, Editor, MarkdownView, Notice } from 'obsidian';
import type { MenuItem } from 'obsidian';
import { CardUtils } from './src/utils';
import type { CardLocation } from './src/utils';
import { CardsGalleryView, VIEW_TYPE_CARDS_GALLERY } from './src/CardsGalleryView';
import { QuickNoteView, VIEW_TYPE_QUICK_NOTE } from './src/QuickNoteView';
import { DoubanAPI } from './src/DoubanAPI';
import { MusicTagAPI } from './src/MusicTagAPI';
import { BangumiAPI } from './src/BangumiAPI';
import { TMDBAPI } from './src/TMDBAPI';

// 添加布局网格图标
addIcon('layout-grid', `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`);


interface CardData {
  title: string;
  year: string;
  description: string;
  rating?: string;
  tags?: string[];
  cover?: string;
  meta?: { [key: string]: string };
  url?: string;
}

interface MusicCardData extends CardData {
  artist: string;
  album?: string;
  collection_date?: string;
}

interface BookCardData extends CardData {
  author: string;
}

interface MovieCardData extends CardData {
  director: string;
  collection_date?: string;
}

interface TvCardData extends CardData {
  director: string;
  collection_date?: string;
}

interface AnimeCardData extends CardData {
  director: string;
  collection_date?: string;
}

interface BookCardData extends CardData {
  author: string;
  collection_date?: string;
}

interface MusicCardData extends CardData {
  artist: string;
  collection_date?: string;
}

interface IdeaCardData extends CardData {
  idea: string;
  source: string;
  date: string;
  tags: string[];
  url?: string;
}

interface QuoteCardData extends CardData {
  quote: string;
  source: string;
  date: string;
  tags: string[];
  url?: string;
}

interface GallerySettings {
  columnCount: number;
  hiddenFields: string[];
  selectedCardType: string;
  selectedCardTypes?: string[]; // 多选类型筛选
  sortField: string;
  displayMode?: 'card' | 'poster' | 'timeline' | 'carousel';
  filterDefinition?: {
    conjunction: 'and' | 'or';
    conditions: Array<{
      field: string;
      operator: string;
      value: string;
      enabled: boolean;
    }>;
  };
  sortDefinition?: {
    criteria: Array<{
      field: string;
      order: 'asc' | 'desc';
      enabled: boolean;
    }>;
  };
  savedWindowSizes?: Record<string, { width?: number, height?: number }>; // 保存不同模式下的窗口大小
}

interface NewCardsPluginSettings {
  gallerySettings: GallerySettings;
  cardTemplates: {
    musicCard: string;
    bookCard: string;
    movieCard: string;
    tvCard: string;
    animeCard: string;
    ideaCard: string;
    quoteCard: string;
  };
  cardStoragePaths: {
    musicCard: string;
    bookCard: string;
    movieCard: string;
    tvCard: string;
    animeCard: string;
    ideaCard: string;
    quoteCard: string;
  };
  textColors: {
    title: string;
    description: string;
    artist: string;
    author: string;
    director: string;
    year: string;
    meta: string;
  };
  doubanCookie?: string;
  tmdbApiKey?: string;
  tmdbAccessToken?: string;
  useDoubanUrlForChineseTMDB?: boolean;
  maxVisibleTags: number; // 添加新的配置项：最大可见标签数
}

const DEFAULT_SETTINGS: NewCardsPluginSettings = {
  gallerySettings: {
    columnCount: 3,
    hiddenFields: [],
    selectedCardType: 'all',
    selectedCardTypes: [], // 多选类型筛选
    sortField: 'year',
    displayMode: 'card', // 设置默认显示模式为卡片模式
    savedWindowSizes: {} // 初始化空的窗口大小记录
  },
  cardTemplates: {
    musicCard: '```music-card\ntitle: \nyear: \nartist: \nalbum: \ndescription: \nrating: \n```',
    bookCard: '```book-card\ntitle: \nyear: \nauthor: \ndescription: \nrating: \n```',
    movieCard: '```movie-card\ntitle: \nyear: \ndirector: \ndescription: \nrating: \n```',
    tvCard: '```tv-card\ntitle: \nyear: \ndirector: \ndescription: \nrating: \n```',
    animeCard: '```anime-card\ntitle: \nyear: \ndirector: \ndescription: \nrating: \n```',
    ideaCard: '```idea-card\nidea: \nsource: \ndate: \ntags: \nurl: \n```',
    quoteCard: '```quote-card\nquote: \nsource: \ndate: \ntags: \nurl: \n```'
  },
  cardStoragePaths: {
    musicCard: '音乐.md',
    bookCard: '书籍.md',
    movieCard: '电影.md',
    tvCard: '剧集.md',
    animeCard: '番剧.md',
    ideaCard: '闪念.md',
    quoteCard: '摘录.md'
  },
  textColors: {
    title: 'rgb(91, 136, 241)',
    description: 'rgb(245, 216, 179)',
    artist: 'rgb(211, 171, 120)',
    author: 'rgb(211, 171, 120)',
    director: 'rgb(211, 171, 120)',
    year: 'rgb(245, 216, 179)',
    meta: 'rgb(245, 216, 179)'
  },
  doubanCookie: '',
  tmdbApiKey: '',
  tmdbAccessToken: '',
  useDoubanUrlForChineseTMDB: true,
  maxVisibleTags: 3 // 默认显示3个标签
}

class CIDInputModal extends Modal {
  constructor(
    app: any,
    onSubmit: (cid: string) => void
  ) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onSubmit: (cid: string) => void;

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: '输入卡片ID' });

    new Setting(contentEl)
      .setName('CID')
      .addText((text) =>
        text.onChange((value) => {
          text.inputEl.onkeydown = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
              this.onSubmit(value);
              this.close();
            }
          };
        })
      );
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class NewCardsSettingTab extends PluginSettingTab {
  plugin: NewCardsPlugin;

  constructor(app: App, plugin: NewCardsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    // 添加豆瓣设置
    containerEl.createEl('h3', { text: '豆瓣设置' });

    new Setting(containerEl)
      .setName('豆瓣Cookie')
      .setDesc('设置豆瓣Cookie，用于获取更完整的数据')
      .addExtraButton(button => {
        button
          .setIcon('external-link')
          .setTooltip('查看获取方法')
          .onClick(() => {
            window.open('https://blog.csdn.net/m0_62205683/article/details/146944749', '_blank');
          });
      })
      .addTextArea(text => text
        .setPlaceholder('请输入豆瓣Cookie，例如：bid=xxxx; dbcl2=xxxx;')
        .setValue(this.plugin.settings.doubanCookie || '')
        .onChange(async (value) => {
          this.plugin.settings.doubanCookie = value;
          // 更新DoubanAPI的Cookie
          DoubanAPI.setCookie(value);
          await this.plugin.saveSettings();
        })
        .inputEl.style.cssText = 'height: 80px; width: 100%; min-width: 400px;');

    // 添加TMDB设置
    containerEl.createEl('h3', { text: 'TMDB 设置' });

    new Setting(containerEl)
      .setName('TMDB API Key')
      .setDesc('设置 TMDB API Key (v3 auth)')
      .addText(text => text
        .setPlaceholder('请输入 TMDB API Key')
        .setValue(this.plugin.settings.tmdbApiKey || '')
        .onChange(async (value) => {
          this.plugin.settings.tmdbApiKey = value;
          TMDBAPI.setApiKey(value);
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('TMDB API 令牌')
      .setDesc('设置 TMDB API 访问令牌 (v4 auth)')
      .addTextArea(text => text
        .setPlaceholder('请输入 TMDB Access Token')
        .setValue(this.plugin.settings.tmdbAccessToken || '')
        .onChange(async (value) => {
          this.plugin.settings.tmdbAccessToken = value;
          TMDBAPI.setAccessToken(value);
          await this.plugin.saveSettings();
        })
        .inputEl.style.cssText = 'height: 80px; width: 100%; min-width: 400px;');

    new Setting(containerEl)
      .setName('中文影片优先使用豆瓣链接')
      .setDesc('对于原语言为中文的 TMDB 影片，自动搜索并使用其对应的豆瓣链接（如果能找到）')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useDoubanUrlForChineseTMDB ?? true)
        .onChange(async (value) => {
          this.plugin.settings.useDoubanUrlForChineseTMDB = value;
          await this.plugin.saveSettings();
        }));

    // 添加卡片显示设置
    containerEl.createEl('h3', { text: '卡片显示设置' });

    new Setting(containerEl)
      .setName('最大可见标签数量')
      .setDesc('设置卡片上默认显示的最大标签数量，超过此数量的标签将被隐藏，可通过点击"更多"按钮查看')
      .addSlider(slider => slider
        .setLimits(1, 10, 1)
        .setValue(this.plugin.settings.maxVisibleTags || 3)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.maxVisibleTags = value;
          await this.plugin.saveSettings();
        }))
      .addExtraButton(button => button
        .setIcon('reset')
        .setTooltip('重置为默认值(3)')
        .onClick(async () => {
          this.plugin.settings.maxVisibleTags = 3;
          await this.plugin.saveSettings();
          this.display();
        }));

    // 添加卡片存储路径设置
    containerEl.createEl('h3', { text: '卡片存储路径设置' });

    new Setting(containerEl)
      .setName('音乐卡片存储路径')
      .setDesc('设置音乐卡片的默认存储文件夹，例：速记/音乐')
      .addSearch(cb => {
        cb.setPlaceholder('例：速记/音乐')
          .setValue(this.plugin.settings.cardStoragePaths.musicCard)
          .onChange(async (value) => {
            this.plugin.settings.cardStoragePaths.musicCard = value;
            await this.plugin.saveSettings();
          })
      });

    new Setting(containerEl)
      .setName('书籍卡片存储路径')
      .setDesc('设置书籍卡片的默认存储文件夹，例：速记/书籍')
      .addSearch(cb => {
        cb.setPlaceholder('例：速记/书籍')
          .setValue(this.plugin.settings.cardStoragePaths.bookCard)
          .onChange(async (value) => {
            this.plugin.settings.cardStoragePaths.bookCard = value;
            await this.plugin.saveSettings();
          })
      });

    new Setting(containerEl)
      .setName('电影卡片存储路径')
      .setDesc('设置电影卡片的默认存储文件夹，例：速记/电影')
      .addSearch(cb => {
        cb.setPlaceholder('例：速记/电影')
          .setValue(this.plugin.settings.cardStoragePaths.movieCard)
          .onChange(async (value) => {
            this.plugin.settings.cardStoragePaths.movieCard = value;
            await this.plugin.saveSettings();
          })
      });

    new Setting(containerEl)
      .setName('剧集卡片存储路径')
      .setDesc('设置剧集卡片的默认存储文件夹，例：速记/剧集')
      .addSearch(cb => {
        cb.setPlaceholder('例：速记/剧集')
          .setValue(this.plugin.settings.cardStoragePaths.tvCard)
          .onChange(async (value) => {
            this.plugin.settings.cardStoragePaths.tvCard = value;
            await this.plugin.saveSettings();
          })
      });

    new Setting(containerEl)
      .setName('番剧卡片存储路径')
      .setDesc('设置番剧卡片的默认存储文件夹，例：速记/番剧')
      .addSearch(cb => {
        cb.setPlaceholder('例：速记/番剧')
          .setValue(this.plugin.settings.cardStoragePaths.animeCard)
          .onChange(async (value) => {
            this.plugin.settings.cardStoragePaths.animeCard = value;
            await this.plugin.saveSettings();
          })
      });

    new Setting(containerEl)
      .setName('闪念卡片存储路径')
      .setDesc('设置闪念卡片的默认存储笔记，务必使用空白笔记。例：速记/闪念.md')
      .addSearch(cb => {
        cb.setPlaceholder('例：速记/闪念.md')
          .setValue(this.plugin.settings.cardStoragePaths.ideaCard)
          .onChange(async (value) => {
            this.plugin.settings.cardStoragePaths.ideaCard = value;
            await this.plugin.saveSettings();
          })
      });

    new Setting(containerEl)
      .setName('摘录卡片存储路径')
      .setDesc('设置摘录卡片的默认存储笔记，务必使用空白笔记。例：速记/摘录.md')
      .addSearch(cb => {
        cb.setPlaceholder('例：速记/摘录.md')
          .setValue(this.plugin.settings.cardStoragePaths.quoteCard)
          .onChange(async (value) => {
            this.plugin.settings.cardStoragePaths.quoteCard = value;
            await this.plugin.saveSettings();
          })
      });

    containerEl.createEl('h3', { text: '卡片模板设置' });

    new Setting(containerEl)
      .setName('音乐卡片模板')
      .setDesc('设置音乐卡片的默认模板')
      .addTextArea(text => text
        .setPlaceholder('输入音乐卡片模板')
        .setValue(this.plugin.settings.cardTemplates.musicCard)
        .onChange(async (value) => {
          this.plugin.settings.cardTemplates.musicCard = value;
          await this.plugin.saveSettings();
        })
        .inputEl.style.cssText = 'height: 150px; width: 100%; min-width: 400px;');

    new Setting(containerEl)
      .setName('书籍卡片模板')
      .setDesc('设置书籍卡片的默认模板')
      .addTextArea(text => text
        .setPlaceholder('输入书籍卡片模板')
        .setValue(this.plugin.settings.cardTemplates.bookCard)
        .onChange(async (value) => {
          this.plugin.settings.cardTemplates.bookCard = value;
          await this.plugin.saveSettings();
        })
        .inputEl.style.cssText = 'height: 150px; width: 100%; min-width: 400px;');

    new Setting(containerEl)
      .setName('电影卡片模板')
      .setDesc('设置电影卡片的默认模板')
      .addTextArea(text => text
        .setPlaceholder('输入电影卡片模板')
        .setValue(this.plugin.settings.cardTemplates.movieCard)
        .onChange(async (value) => {
          this.plugin.settings.cardTemplates.movieCard = value;
          await this.plugin.saveSettings();
        })
        .inputEl.style.cssText = 'height: 150px; width: 100%; min-width: 400px;');

    new Setting(containerEl)
      .setName('剧集卡片模板')
      .setDesc('设置剧集卡片的默认模板')
      .addTextArea(text => text
        .setPlaceholder('输入剧集卡片模板')
        .setValue(this.plugin.settings.cardTemplates.tvCard)
        .onChange(async (value) => {
          this.plugin.settings.cardTemplates.tvCard = value;
          await this.plugin.saveSettings();
        })
        .inputEl.style.cssText = 'height: 150px; width: 100%; min-width: 400px;');

    new Setting(containerEl)
      .setName('番剧卡片模板')
      .setDesc('设置番剧卡片的默认模板')
      .addTextArea(text => text
        .setPlaceholder('输入番剧卡片模板')
        .setValue(this.plugin.settings.cardTemplates.animeCard)
        .onChange(async (value) => {
          this.plugin.settings.cardTemplates.animeCard = value;
          await this.plugin.saveSettings();
        })
        .inputEl.style.cssText = 'height: 150px; width: 100%; min-width: 400px;');
  }
}

export default class NewCardsPlugin extends Plugin {
  private async activateQuickNoteView() {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(VIEW_TYPE_QUICK_NOTE);

    if (existing.length) {
      workspace.revealLeaf(existing[0]);
      await existing[0].view.setState({
        type: VIEW_TYPE_QUICK_NOTE,
        active: true,
      }, { history: true });
    } else {
      const leaf = workspace.getLeaf('tab');
      await leaf.setViewState({
        type: VIEW_TYPE_QUICK_NOTE,
        active: true,
      });
      workspace.revealLeaf(leaf);
    }
  }
  public settings: NewCardsPluginSettings;
  public view: CardsGalleryView;  // 改为 public
  public bangumiAPI: BangumiAPI;  // 添加BangumiAPI实例

  private isInCodeBlock(editor: any, line: number): boolean {
    // 获取整个文档内容
    const content = editor.getValue();
    // 检查是否包含```timeline标记
    return content.includes('```timeline');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.applyTextColors();
  }

  private applyTextColors() {
    document.documentElement.style.setProperty('--card-title-color', this.settings.textColors.title);
    document.documentElement.style.setProperty('--card-description-color', this.settings.textColors.description);
    document.documentElement.style.setProperty('--card-creator-color', this.settings.textColors.author);
    document.documentElement.style.setProperty('--card-year-color', this.settings.textColors.year);
    document.documentElement.style.setProperty('--card-meta-color', this.settings.textColors.meta);
  }

  private renderRatingBadge(rating: string, container: HTMLElement) {
    const ratingContainer = container.createDiv({ cls: 'rating' });
    const ratingValue = parseFloat(rating);

    if (ratingValue >= 7.0 && ratingValue <= 10.0) {
      ratingContainer.setAttribute('data-score', 'excellent');
      const badge = ratingContainer.createDiv({ cls: 'rating-badge' });
      badge.innerHTML = `<svg t="1744038348712" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2606" data-darkreader-inline-fill="" width="200" height="200"><path d="M510.742357 92.463901c230.651171 0 418.307108 187.654914 418.307107 418.307108s-187.654914 418.307108-418.307107 418.307108-418.307108-187.654914-418.307108-418.307108 187.655937-418.307108 418.307108-418.307108m0-29.879517c-247.518327 0-448.185602 200.667276-448.185602 448.185602s200.667276 448.185602 448.185602 448.185602c247.532653 0 448.185602-200.667276 448.185602-448.185602S758.27501 62.584384 510.742357 62.584384z" fill="" p-id="2607"></path></svg>`;
      badge.createSpan({ text: rating });
    } else {
      ratingContainer.setAttribute('data-score', 'good');
      const badge = ratingContainer.createDiv({ cls: 'simple-badge' });
      badge.innerHTML = `<svg t="1747991540919" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="17372" width="200" height="200"><path d="M851.411627 578.194773c7.051947 0.16384 14.107307 0.331093 21.159253 0.494933 4.00384-88.285867 8.004267-57.56928 12.059307-147.032747-18.13504 0-29.51168 0-45.653333 0C843.209387 522.079573 847.312213 490.642773 851.411627 578.194773z" p-id="17373" fill="#707070"></path><path d="M961.73056 353.498453c-146.08384 0-762.402133 0-908.48256 0-1.099093 10.625707 9.611947 291.099307 10.082987 292.017493 5.393067 10.356053 10.881707 20.66432 16.35328 30.979413 4.79232-9.844053 12.2368-19.27168 13.820587-29.597013 3.19488-20.872533 15.506773-216.108373 16.489813-228.287147 12.765867-0.723627 782.226773-0.723627 794.996053 0 0.979627 12.178773 13.294933 207.414613 16.489813 228.287147 1.580373 10.325333 9.03168 19.75296 13.817173 29.597013 5.474987-10.315093 10.960213-20.62336 16.35328-30.979413C952.1152 644.59776 962.833067 364.12416 961.73056 353.498453z" p-id="17374" fill="#707070"></path><path d="M142.40768 578.686293c7.051947-0.16384 14.107307-0.331093 21.162667-0.494933 4.096-87.548587 8.198827-56.111787 12.434773-146.541227-16.141653 0-27.521707 0-45.653333 0C134.403413 521.117013 138.40384 490.400427 142.40768 578.686293z" p-id="17375" fill="#707070"></path><path d="M507.48416 340.933973c151.98208 0.02048 303.977813 0.139947 455.95648-0.457387 9.427627-0.034133 18.824533-6.662827 28.23168-10.222933-5.021013-10.123947-7.461547-24.87296-15.588693-29.39904-16.704853-9.28768-36.430507-18.302293-54.941013-18.367147-132.28032-0.498347-264.553813-0.72704-396.83072-0.785067l0-0.03072c-5.608107 0-11.2128 0.013653-16.831147 0.013653-5.608107 0-11.216213-0.013653-16.82432-0.013653l0 0.03072c-132.27008 0.058027-264.5504 0.28672-396.823893 0.785067-18.510507 0.064853-38.239573 9.079467-54.9376 18.367147-8.133973 4.529493-10.574507 19.275093-15.592107 29.39904 9.407147 3.560107 18.807467 10.185387 28.235093 10.222933C203.516587 341.07392 355.505493 340.954453 507.48416 340.933973z" p-id="17376" fill="#707070"></path></svg>`;
      badge.createSpan({ text: rating });
    }
  }


  async onload() {
    // 加载设置
    await this.loadSettings();

    // 将Cookie传递给DoubanAPI
    if (this.settings.doubanCookie) {
      DoubanAPI.setCookie(this.settings.doubanCookie);
    }

    // 初始化BangumiAPI，不需要cookie
    this.bangumiAPI = new BangumiAPI();

    // 初始化TMDBAPI
    if (this.settings.tmdbApiKey) {
      TMDBAPI.setApiKey(this.settings.tmdbApiKey);
    }
    if (this.settings.tmdbAccessToken) {
      TMDBAPI.setAccessToken(this.settings.tmdbAccessToken);
    }

    // 加载Swiper CSS
    // this.loadSwiperCSS();

    // 注册视图
    this.registerView(
      VIEW_TYPE_CARDS_GALLERY,
      (leaf) => (this.view = new CardsGalleryView(leaf, this))
    );

    // 添加快速记录视图
    this.registerView(
      VIEW_TYPE_QUICK_NOTE,
      (leaf) => new QuickNoteView(leaf, this)
    );

    // 在插件的 onload() 方法中注册事件监听
    this.registerEvent(
      this.app.vault.on('delete', async (file) => {
        if (file instanceof TFile && file.extension === 'md') {
          try {
            console.log(`文件已删除: ${file.path}，正在清理相关卡片索引...`);
            await CardUtils.removeCardsByPath(this.app.vault, file.path);
            console.log(`已清理文件 ${file.path} 的卡片索引`);

            // 如果卡片库视图已打开，刷新显示
            const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CARDS_GALLERY);
            if (leaves.length > 0) {
              for (const leaf of leaves) {
                if (leaf.view instanceof CardsGalleryView) {
                  leaf.view.renderCards();
                }
              }
            }
          } catch (error) {
            console.error(`清理已删除文件 ${file.path} 的卡片索引时出错:`, error);
          }
        }
      })
    );

    // 添加设置页面
    this.addSettingTab(new NewCardsSettingTab(this.app, this));

    // 添加快速记录按钮到左侧功能区
    this.addRibbonIcon('carrot', '快速记录', () => {
      this.activateQuickNoteView();
    });

    // 添加快速记录的快捷键命令
    this.addCommand({
      id: 'open-quick-note',
      name: '打开快速记录',
      callback: () => {
        this.activateQuickNoteView();
      },
      hotkeys: [{
        modifiers: ['Mod', 'Shift'],
        key: 'n'
      }]
    });


    // 应用文字颜色设置
    this.applyTextColors();

    // 监听设置变更
    this.registerEvent(
      this.app.workspace.on('css-change', () => {
        this.applyTextColors();
      })
    );


    // 监听文件打开事件
    this.registerEvent(
      this.app.workspace.on('file-open', async (file) => {
        if (!(file instanceof TFile)) return;

        // 检查是否为普通的Markdown笔记
        if (file.extension !== 'md' || file.path.endsWith('.canvas.md')) return;
        const excludedNames = Object.values(this.settings.cardStoragePaths).map(path => path.split('/').pop()?.replace('.md', ''));
        const baseName = file.basename;
        if (!excludedNames.includes(baseName)) {
          try {
            const content = await this.app.vault.read(file);
            const lines = content.split('\n');

            const tagTypes = ['music-card', 'book-card', 'movie-card', 'tv-card', 'anime-card', 'quote-card', 'idea-card'];
            const foundTags = new Set<string>();

            const codeBlockRegex = /^```(music-card|book-card|movie-card|tv-card|anime-card|quote-card|idea-card)$/;
            let inBlock = false;
            let blockLines: string[] = [];
            let hasCard = false;

            for (let line of lines) {
              const trimmed = line.trim();

              if (!inBlock) {
                const match = trimmed.match(codeBlockRegex);
                if (match) {
                  inBlock = true;
                  blockLines = [];
                  hasCard = true;
                }
              } else if (trimmed === '```') {
                // 尝试找到 tag 或 tags 字段
                const tagLine = blockLines.find(l =>
                  l.trim().toLowerCase().startsWith('tags:') || l.trim().toLowerCase().startsWith('tag:')
                );
                if (tagLine) {
                  const tagField = tagLine.split(':').slice(1).join(':').trim();
                  const matches = tagField.match(/#[^\s#，,]+/g);
                  matches?.forEach(tag => foundTags.add(tag.replace(/^#/, ''))); // 去掉前缀 #
                }
                inBlock = false;
                blockLines = [];
              } else {
                blockLines.push(line);
              }
            }

            // 只有当文件中包含卡片时才更新frontmatter
            if (hasCard) {
              // 更新 frontmatter tags 属性
              const metadata = this.app.metadataCache.getFileCache(file);
              const frontmatter = metadata?.frontmatter;
              const hasFrontmatter = content.startsWith('---\n');

              const rawTags = frontmatter?.tags as string[] | undefined;
              const existingTags = new Set(
                (rawTags ?? []).filter((t): t is string => typeof t === 'string').map(t => t.trim())
              );
              const allTags = new Set([...existingTags, ...foundTags]);

              if (!hasFrontmatter) {
                // 如果文件没有frontmatter，直接在开头添加
                const tagsStr = Array.from(allTags).join('\n  - ');
                const newContent = `---\ntags:\n  - ${tagsStr}\n---\n${content.trimStart()}`;
                await this.app.vault.modify(file, newContent);
              } else {
                // 如果已有frontmatter，使用processFrontMatter更新
                await this.app.fileManager.processFrontMatter(file, (fm) => {
                  fm.tags = Array.from(allTags);
                });
              }
            }

            // 👇原有卡片索引逻辑（保留）
            let currentLine = 0;
            // 加载现有索引，只加载一次
            const index = await CardUtils.loadCardIndex(this.app.vault);
            let indexModified = false; // 跟踪索引是否被修改
            // 跟踪代码块的嵌套
            interface CodeBlockState {
              type: string;
              startLine: number;
              content: string[];
            }
            const blockStack: CodeBlockState[] = [];
            const cardsToUpdate: { cid: string, content: string, location: CardLocation }[] = [];
            while (currentLine < lines.length) {
              const line = lines[currentLine].trim();
              if (line.startsWith('```')) {
                const cardTypes = ['music-card', 'book-card', 'movie-card', 'tv-card', 'anime-card'];
                const isCardStart = cardTypes.some(type => line === '```' + type);
                if (isCardStart) {
                  const blockType = line.substring(3);
                  blockStack.push({
                    type: blockType,
                    startLine: currentLine,
                    content: []
                  });
                } else if (line === '```') {
                  if (blockStack.length > 0) {
                    const currentBlock = blockStack.pop()!;
                    const fullContent = '```' + currentBlock.type + '\n' + currentBlock.content.join('\n') + '\n```';
                    const existingCID = await CardUtils.findCIDByContent(this.app.vault, fullContent);
                    const cid = existingCID || CardUtils.generateCID(fullContent);
                    // 收集卡片信息而不是立即更新
                    cardsToUpdate.push({
                      cid: cid,
                      content: fullContent,
                      location: {
                        path: file.path,
                        startLine: currentBlock.startLine,
                        endLine: currentLine
                      }
                    });
                    indexModified = true;
                  }
                }
              } else if (blockStack.length > 0) {
                blockStack[blockStack.length - 1].content.push(lines[currentLine]);
              }
              currentLine++;
            }
            // 处理未闭合的代码块
            while (blockStack.length > 0) {
              const unclosedBlock = blockStack.pop()!;
              const fullContent = '```' + unclosedBlock.type + '\n' + unclosedBlock.content.join('\n') + '\n```';
              const existingCID = await CardUtils.findCIDByContent(this.app.vault, fullContent);
              const cid = existingCID || CardUtils.generateCID(fullContent);
              // 收集卡片信息
              cardsToUpdate.push({
                cid: cid,
                content: fullContent,
                location: {
                  path: file.path,
                  startLine: unclosedBlock.startLine,
                  endLine: lines.length - 1
                }
              });
              indexModified = true;
            }
            // 批量更新索引
            if (indexModified && cardsToUpdate.length > 0) {
              // 移除文件中的旧卡片位置
              Object.keys(index).forEach(cid => {
                if (index[cid] && index[cid].locations) {
                  index[cid].locations = index[cid].locations.filter(loc => loc.path !== file.path);
                }
              });
              // 更新所有卡片的索引
              for (const card of cardsToUpdate) {
                const newCID = CardUtils.generateCID(card.content);
                // 如果是新的CID
                if (!index[card.cid] || newCID !== card.cid) {
                  const existingWithSameContent = Object.keys(index).find(key =>
                    CardUtils.generateCID(index[key]?.content || '') === newCID
                  );
                  if (existingWithSameContent) {
                    // 如果存在相同内容的卡片，合并位置
                    index[existingWithSameContent].locations.push(card.location);
                  } else {
                    // 创建新条目
                    index[newCID] = {
                      content: card.content,
                      locations: [card.location],
                      lastUpdated: new Date().toISOString()
                    };
                  }
                  // 如果旧CID存在但没有其他位置引用，则删除
                  if (index[card.cid] && index[card.cid].locations.length === 0) {
                    delete index[card.cid];
                  }
                } else {
                  // 使用现有CID，添加位置
                  if (!index[card.cid]) {
                    index[card.cid] = {
                      content: card.content,
                      locations: [],
                      lastUpdated: new Date().toISOString()
                    };
                  }
                  index[card.cid].locations.push(card.location);
                }
              }
              // 清理没有位置的卡片
              Object.keys(index).forEach(cid => {
                if (index[cid] && index[cid].locations && index[cid].locations.length === 0) {
                  delete index[cid];
                }
              });
              // 一次性保存所有更改
              await CardUtils.saveCardIndex(this.app.vault, index);
            }
          } catch (error) {
            console.error('处理文件打开事件时出错:', error);
          }
        }
      })
    );



    // 添加侧边栏图标
    this.addRibbonIcon('door-open', '卡片总览', async () => {
      const { workspace } = this.app;
      const existing = workspace.getLeavesOfType(VIEW_TYPE_CARDS_GALLERY);

      if (existing.length) {
        workspace.revealLeaf(existing[0]);
        await existing[0].view.setState({
          type: VIEW_TYPE_CARDS_GALLERY,
          active: true,
        }, { history: true });
      } else {
        const leaf = workspace.getLeaf('tab');
        await leaf.setViewState({
          type: VIEW_TYPE_CARDS_GALLERY,
          active: true,
        });
        workspace.revealLeaf(leaf);
      }
    });

    // 监听文件修改事件
    this.registerEvent(
      this.app.vault.on('modify', async (file) => {
        if (file instanceof TFile) {
          const content = await this.app.vault.read(file);
          const oldCards = await this.getCardsFromFile({ path: file.path, startLine: 0, endLine: 0 });
          const newCards = this.extractCardsFromContent(content);
          // 获取文件中所有卡片的位置信息
          const index = await CardUtils.loadCardIndex(this.app.vault);
          const oldCardLocations: { [key: string]: CardLocation } = {};

          Object.entries(index).forEach(([cid, data]) => {
            const location = data.locations.find(loc => loc.path === file.path);
            if (location) {
              oldCardLocations[cid] = location;
            }
          });

          // 检查是否有卡片被删除或修改
          const deletedCards = oldCards.filter(cid => !newCards.includes(cid));
          if (deletedCards.length > 0) {
            // 处理删除的卡片
            for (const cid of deletedCards) {
              const location = oldCardLocations[cid];
              if (location) {
                await CardUtils.removeCardLocation(this.app.vault, location);
              }
            }
          }

          // 处理修改的卡片
          const lines = content.split('\n');
          let currentLine = 0;
          let inCardBlock = false;
          let cardContent = '';
          let cardStartLine = 0;

          // 定义卡片类型
          const cardTypes = ['music-card', 'book-card', 'movie-card', 'tv-card', 'anime-card', 'quote-card', 'idea-card'];

          // 使用栈来跟踪代码块嵌套
          const blockStack: { type: string, startLine: number, content: string[] }[] = [];

          while (currentLine < lines.length) {
            const line = lines[currentLine].trim();

            if (line.startsWith('```')) {
              const blockType = line.substring(3).trim();
              if (cardTypes.includes(blockType)) {
                // 进入卡片代码块
                blockStack.push({ type: blockType, startLine: currentLine, content: [line] });
                if (blockStack.length === 1) { // 只在最外层卡片块开始时初始化
                  inCardBlock = true;
                  cardStartLine = currentLine;
                }
              } else if (line === '```' && blockStack.length > 0) {
                // 结束当前代码块
                const currentBlock = blockStack.pop();
                if (currentBlock) {
                  currentBlock.content.push(line);
                  if (blockStack.length === 0) { // 确保是最外层卡片块结束
                    inCardBlock = false;
                    cardContent = currentBlock.content.join('\n');

                    // 从卡片内容中提取现有的CID
                    const cidMatch = cardContent.match(/\[\[card:([^\]]+)\]\]/);
                    const existingCID = cidMatch ? cidMatch[1] : null;

                    // 优先使用已有的CID，如果没有则生成新的
                    const cid = existingCID || CardUtils.generateCID(cardContent);

                    // 立即更新索引
                    await CardUtils.updateCardIndex(this.app.vault, cid, cardContent, {
                      path: file.path,
                      startLine: cardStartLine,
                      endLine: currentLine
                    });
                  } else {
                    // 如果不是最外层，将内容添加到父块
                    blockStack[blockStack.length - 1].content.push(...currentBlock.content);
                  }
                }
              }
            } else if (inCardBlock && blockStack.length > 0) {
              blockStack[blockStack.length - 1].content.push(lines[currentLine]);
            }
            currentLine++;
          }
        }
      })
    );

    // 添加右键菜单
    this.app.workspace.on('editor-menu', (menu: Menu, editor) => {
      menu.addItem((item: MenuItem) => {
        item
          .setTitle('插入卡片')
          .setIcon('arrow-down-from-line')
          .onClick(() => {
            const submenu = new Menu();

            // 添加通过ID添加选项
            submenu.addItem((subItem: MenuItem) => {
              subItem
                .setTitle('通过ID添加')
                .setIcon('search')
                .onClick(async () => {
                  const cursor = editor.getCursor('to');
                  console.log('光标位置:', cursor);
                  const isInBlock = this.isInCodeBlock(editor, cursor.line);
                  console.log('是否在代码块中:', isInBlock);

                  const modal = new CIDInputModal(this.app, async (cid) => {
                    const content = await CardUtils.getCardContentByCID(this.app.vault, cid);
                    if (content && cursor) {
                      const isInCodeBlock = this.isInCodeBlock(editor, cursor.line);
                      let insertText = '';

                      if (isInCodeBlock) {
                        const lines = content.split('\n');
                        const firstLine = '   ' + lines[0];
                        const otherLines = lines.slice(1).map(line => '    ' + line);
                        insertText = [firstLine, ...otherLines].join('\n') + '\n';
                      } else {
                        insertText = '\n' + content + '\n'; // 减少一个前导换行符
                      }

                      editor.replaceRange(insertText, cursor);

                      // ✅ 插入后将光标移动到插入代码块的下一行开头
                      const insertLines = insertText.split('\n').length;
                      editor.setCursor({ line: cursor.line + insertLines, ch: 0 });

                      const currentFile = this.app.workspace.getActiveFile();
                      if (currentFile) {
                        const startLine = cursor.line;
                        const endLine = startLine + content.split('\n').length - 1;
                        await CardUtils.updateCardIndex(this.app.vault, cid, content, {
                          path: currentFile.path,
                          startLine,
                          endLine
                        });
                      }
                    }
                  });
                  modal.open();
                });
            });

            // 添加插入音乐卡片选项
            submenu.addItem((subItem: MenuItem) => {
              subItem
                .setTitle('插入音乐卡片')
                .setIcon('music')
                .onClick(() => {
                  const cursor = editor.getCursor('to');
                  console.log('光标位置:', cursor);
                  const isInBlock = this.isInCodeBlock(editor, cursor.line);
                  console.log('是否在代码块中:', isInBlock);
                  const line = editor.getLine(cursor.line);
                  const isInCodeBlock = this.isInCodeBlock(editor, cursor.line);
                  const template = this.settings.cardTemplates.musicCard;
                  const contentToInsert = '\n' + template + '\n';

                  if (isInCodeBlock) {
                    // 如果在代码块内，需要适当缩进
                    const lines = contentToInsert.split('\n');
                    const firstLine = '   ' + lines[0]; // 假设代码块内缩进为4个空格
                    const otherLines = lines.slice(1).map(line => '    ' + line);
                    editor.replaceRange('\n' + [firstLine, ...otherLines].join('\n') + '\n', cursor);
                  } else {
                    editor.replaceRange(contentToInsert, cursor);
                  }
                });
            });

            // 添加插入书籍卡片选项
            submenu.addItem((subItem: MenuItem) => {
              subItem
                .setTitle('插入书籍卡片')
                .setIcon('book')
                .onClick(() => {
                  const cursor = editor.getCursor('to');
                  console.log('光标位置:', cursor);
                  const isInBlock = this.isInCodeBlock(editor, cursor.line);
                  console.log('是否在代码块中:', isInBlock);
                  const line = editor.getLine(cursor.line);
                  const isInCodeBlock = this.isInCodeBlock(editor, cursor.line);
                  const template = this.settings.cardTemplates.bookCard;
                  const contentToInsert = '\n' + template + '\n';

                  if (isInCodeBlock) {
                    // 如果在代码块内，需要适当缩进
                    const lines = contentToInsert.split('\n');
                    const firstLine = '   ' + lines[0]; // 假设代码块内缩进为4个空格
                    const otherLines = lines.slice(1).map(line => '    ' + line);
                    editor.replaceRange('\n' + [firstLine, ...otherLines].join('\n') + '\n', cursor);
                  } else {
                    editor.replaceRange(contentToInsert, cursor);
                  }
                });
            });

            // 添加插入电影卡片选项
            submenu.addItem((subItem: MenuItem) => {
              subItem
                .setTitle('插入电影卡片')
                .setIcon('film')
                .onClick(() => {
                  const cursor = editor.getCursor('to');
                  console.log('光标位置:', cursor);
                  const isInBlock = this.isInCodeBlock(editor, cursor.line);
                  console.log('是否在代码块中:', isInBlock);
                  const line = editor.getLine(cursor.line);
                  const isInCodeBlock = this.isInCodeBlock(editor, cursor.line);
                  const template = this.settings.cardTemplates.movieCard;
                  const contentToInsert = '\n' + template + '\n';

                  if (isInCodeBlock) {
                    // 如果在代码块内，需要适当缩进
                    const lines = contentToInsert.split('\n');
                    const firstLine = '   ' + lines[0]; // 假设代码块内缩进为4个空格
                    const otherLines = lines.slice(1).map(line => '    ' + line);
                    editor.replaceRange('\n' + [firstLine, ...otherLines].join('\n') + '\n', cursor);
                  } else {
                    editor.replaceRange(contentToInsert, cursor);
                  }
                });
            });

            // 添加插入剧集卡片选项
            submenu.addItem((subItem: MenuItem) => {
              subItem
                .setTitle('插入剧集卡片')
                .setIcon('film')
                .onClick(() => {
                  const cursor = editor.getCursor('to');
                  console.log('光标位置:', cursor);
                  const isInBlock = this.isInCodeBlock(editor, cursor.line);
                  console.log('是否在代码块中:', isInBlock);
                  const line = editor.getLine(cursor.line);
                  const isInCodeBlock = this.isInCodeBlock(editor, cursor.line);
                  const template = this.settings.cardTemplates.tvCard;
                  const contentToInsert = '\n' + template + '\n';

                  if (isInCodeBlock) {
                    // 如果在代码块内，需要适当缩进
                    const lines = contentToInsert.split('\n');
                    const firstLine = '   ' + lines[0]; // 假设代码块内缩进为4个空格
                    const otherLines = lines.slice(1).map(line => '    ' + line);
                    editor.replaceRange('\n' + [firstLine, ...otherLines].join('\n') + '\n', cursor);
                  } else {
                    editor.replaceRange(contentToInsert, cursor);
                  }
                });
            });

            // 添加插入番剧卡片选项
            submenu.addItem((subItem: MenuItem) => {
              subItem
                .setTitle('插入番剧卡片')
                .setIcon('film')
                .onClick(() => {
                  const cursor = editor.getCursor('to');
                  console.log('光标位置:', cursor);
                  const isInBlock = this.isInCodeBlock(editor, cursor.line);
                  console.log('是否在代码块中:', isInBlock);
                  const line = editor.getLine(cursor.line);
                  const isInCodeBlock = this.isInCodeBlock(editor, cursor.line);
                  const template = this.settings.cardTemplates.animeCard;
                  const contentToInsert = '\n' + template + '\n';

                  if (isInCodeBlock) {
                    // 如果在代码块内，需要适当缩进
                    const lines = contentToInsert.split('\n');
                    const firstLine = '   ' + lines[0]; // 假设代码块内缩进为4个空格
                    const otherLines = lines.slice(1).map(line => '    ' + line);
                    editor.replaceRange('\n' + [firstLine, ...otherLines].join('\n') + '\n', cursor);
                  } else {
                    editor.replaceRange(contentToInsert, cursor);
                  }
                });
            });

            // 显示子菜单
            submenu.showAtMouseEvent(event as MouseEvent);
          });
      });
    });

    // 注册音乐卡片处理器
    this.registerMarkdownCodeBlockProcessor('music-card', async (source, el, ctx) => {
      const data = this.parseYaml(source) as MusicCardData;
      const fullContent = '```music-card\n' + source + '\n```';
      let cid = await CardUtils.findCIDByContent(this.app.vault, fullContent) || CardUtils.generateCID(fullContent);
      if (ctx.sourcePath) {
        const sectionInfo = ctx.getSectionInfo(el);
        const startLine = sectionInfo ? sectionInfo.lineStart : 0;
        const endLine = sectionInfo ? sectionInfo.lineEnd : 0;
        cid = await CardUtils.updateCardIndex(this.app.vault, cid, fullContent, { path: ctx.sourcePath, startLine, endLine });
      }
      this.renderMusicCard(data, el, cid);
    });

    // 注册书籍卡片处理器
    this.registerMarkdownCodeBlockProcessor('book-card', async (source, el, ctx) => {
      const data = this.parseYaml(source) as BookCardData;
      const fullContent = '```book-card\n' + source + '\n```';
      let cid = await CardUtils.findCIDByContent(this.app.vault, fullContent) || CardUtils.generateCID(fullContent);
      if (ctx.sourcePath) {
        const sectionInfo = ctx.getSectionInfo(el);
        const startLine = sectionInfo ? sectionInfo.lineStart : 0;
        const endLine = sectionInfo ? sectionInfo.lineEnd : 0;
        cid = await CardUtils.updateCardIndex(this.app.vault, cid, fullContent, { path: ctx.sourcePath, startLine, endLine });
      }
      this.renderBookCard(data, el, cid);
    });

    // 注册电影卡片处理器
    this.registerMarkdownCodeBlockProcessor('movie-card', async (source, el, ctx) => {
      const data = this.parseYaml(source) as MovieCardData;
      const fullContent = '```movie-card\n' + source + '\n```';
      let cid = await CardUtils.findCIDByContent(this.app.vault, fullContent) || CardUtils.generateCID(fullContent);
      if (ctx.sourcePath) {
        const sectionInfo = ctx.getSectionInfo(el);
        const startLine = sectionInfo ? sectionInfo.lineStart : 0;
        const endLine = sectionInfo ? sectionInfo.lineEnd : 0;
        cid = await CardUtils.updateCardIndex(this.app.vault, cid, fullContent, { path: ctx.sourcePath, startLine, endLine });
      }
      this.renderMovieCard(data, el, cid);
    });

    // 注册剧集卡片处理器
    this.registerMarkdownCodeBlockProcessor('tv-card', async (source, el, ctx) => {
      const data = this.parseYaml(source) as TvCardData;
      const fullContent = '```tv-card\n' + source + '\n```';
      let cid = await CardUtils.findCIDByContent(this.app.vault, fullContent) || CardUtils.generateCID(fullContent);
      if (ctx.sourcePath) {
        const sectionInfo = ctx.getSectionInfo(el);
        const startLine = sectionInfo ? sectionInfo.lineStart : 0;
        const endLine = sectionInfo ? sectionInfo.lineEnd : 0;
        cid = await CardUtils.updateCardIndex(this.app.vault, cid, fullContent, { path: ctx.sourcePath, startLine, endLine });
      }
      this.renderTvCard(data, el, cid);
    });

    // 注册番剧卡片处理器
    this.registerMarkdownCodeBlockProcessor('anime-card', async (source, el, ctx) => {
      const data = this.parseYaml(source) as AnimeCardData;
      const fullContent = '```anime-card\n' + source + '\n```';
      let cid = await CardUtils.findCIDByContent(this.app.vault, fullContent) || CardUtils.generateCID(fullContent);
      if (ctx.sourcePath) {
        const sectionInfo = ctx.getSectionInfo(el);
        const startLine = sectionInfo ? sectionInfo.lineStart : 0;
        const endLine = sectionInfo ? sectionInfo.lineEnd : 0;
        cid = await CardUtils.updateCardIndex(this.app.vault, cid, fullContent, { path: ctx.sourcePath, startLine, endLine });
      }
      this.renderAnimeCard(data, el, cid);
    });

    // 注册摘录卡片处理器
    this.registerMarkdownCodeBlockProcessor('quote-card', async (source, el, ctx) => {
      const data = this.parseYaml(source) as QuoteCardData;
      const fullContent = '```quote-card\n' + source + '\n```';
      let cid = await CardUtils.findCIDByContent(this.app.vault, fullContent) || CardUtils.generateCID(fullContent);
      if (ctx.sourcePath) {
        const sectionInfo = ctx.getSectionInfo(el);
        const startLine = sectionInfo ? sectionInfo.lineStart : 0;
        const endLine = sectionInfo ? sectionInfo.lineEnd : 0;
        cid = await CardUtils.updateCardIndex(this.app.vault, cid, fullContent, { path: ctx.sourcePath, startLine, endLine });
      }
      this.renderQuoteCard(data, el, cid);
    });

    // 注册闪念卡片处理器
    this.registerMarkdownCodeBlockProcessor('idea-card', async (source, el, ctx) => {
      const data = this.parseYaml(source) as IdeaCardData;
      const fullContent = '```idea-card\n' + source + '\n```';
      let cid = await CardUtils.findCIDByContent(this.app.vault, fullContent) || CardUtils.generateCID(fullContent);
      if (ctx.sourcePath) {
        const sectionInfo = ctx.getSectionInfo(el);
        const startLine = sectionInfo ? sectionInfo.lineStart : 0;
        const endLine = sectionInfo ? sectionInfo.lineEnd : 0;
        cid = await CardUtils.updateCardIndex(this.app.vault, cid, fullContent, { path: ctx.sourcePath, startLine, endLine });
      }
      this.renderIdeaCard(data, el, cid);
    });
  }



  public parseYaml(source: string): any {
    const lines = source.split('\n');
    const data: any = {};
    const meta: { [key: string]: string } = {};

    // 处理可能包含多行的字段
    const processMultilineFields = (key: string, startLine: number): { value: string, endLine: number } => {
      let value = lines[startLine].substring(lines[startLine].indexOf(':') + 1).trim();
      let endLine = startLine;

      // 如果当前行是空值，尝试读取多行内容
      if (!value) {
        let multilineValue = [];
        let i = startLine + 1;
        while (i < lines.length) {
          const line = lines[i];
          // 如果下一行是新的键值对，则结束多行读取
          if (line.includes(':') && !line.startsWith(' ') && !line.startsWith('\t')) {
            break;
          }
          multilineValue.push(line);
          i++;
        }
        endLine = i - 1;
        value = multilineValue.join('\n');
      }

      return { value, endLine };
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const colonIndex = line.indexOf(':');

      if (colonIndex !== -1) {
        const key = line.substring(0, colonIndex).trim();
        let value = line.substring(colonIndex + 1).trim();

        if (key) {
          // 对描述和内容字段进行特殊处理，保留换行符
          if (key === 'description' || key === 'content' || key === 'quote' || key === 'idea') {
            const result = processMultilineFields(key, i);
            value = result.value;
            i = result.endLine;
          }

          if (key === 'tags') {
            data[key] = value.split(' ').filter(tag => tag.trim());
          } else if (key === 'meta') {
            // 忽略单独的meta字段
            continue;
          } else if (key.startsWith('meta.')) {
            const metaKey = key.substring(5).trim();
            if (metaKey) {
              meta[metaKey] = value;
            }
          } else {
            data[key] = value;
          }
        }
      }
    }

    if (Object.keys(meta).length > 0) {
      data.meta = meta;
    }

    return data;
  }

  public renderQuoteCard(data: QuoteCardData, el: HTMLElement, cid: string) {
    const container = el.createDiv({ cls: 'new-cards-container quote-card' });

    // 添加点击事件处理
    if (data.url) {
      container.addClass('clickable');
      container.addEventListener('click', (e) => {
        // 检查点击是否在标签容器或CID区域内
        const isTagClick = (e.target as HTMLElement).closest('.card-tags-container');
        const isCidClick = (e.target as HTMLElement).closest('.card-id');
        if (!isTagClick && !isCidClick) {
          if (data.url && (data.url.startsWith('http://') || data.url.startsWith('https://'))) {
            window.open(data.url);
          } else if (data.url && data.url.startsWith('obsidian://')) {
            // 处理obsidian://协议链接
            const url = new URL(data.url);
            const vault = decodeURIComponent(url.searchParams.get('vault') || '');
            const file = decodeURIComponent(url.searchParams.get('file') || '');
            this.app.workspace.openLinkText(file, vault, true);
          } else {
            // 处理内部链接
            const targetFile = this.app.metadataCache.getFirstLinkpathDest(data.url || '', '');
            if (targetFile) {
              this.app.workspace.getLeaf().openFile(targetFile);
            }
          }
        }
      });
    }

    // 添加卡片ID
    const cidEl = container.createDiv({ cls: 'card-id', text: cid });
    cidEl.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(cid);
    });

    // 创建内容容器
    const contentContainer = container.createDiv({ cls: 'quote-content' });
    contentContainer.createEl('div', { text: data.quote });

    // 创建元信息容器
    const metaContainer = container.createDiv({ cls: 'quote-meta' });

    // 添加来源信息
    if (data.source) {
      metaContainer.createEl('div', {
        cls: 'quote-source',
        text: data.source
      });
    }

    // 添加日期信息
    if (data.date) {
      metaContainer.createEl('div', {
        cls: 'quote-date',
        text: data.date
      });
    }

    // 添加标签
    if (data.tags && data.tags.length > 0) {
      const tagsContainer = metaContainer.createDiv({ cls: 'card-tags-container' });
      this.renderTags(data, tagsContainer);
    }
  }

  // 添加一个辅助函数用于渲染标签
  private renderTags(data: { tags?: string[] }, tagsContainer: HTMLElement) {
    if (!data.tags || !data.tags.length) return;

    const maxVisible = this.settings.maxVisibleTags || 3;
    const allTags = data.tags;
    const visibleTags = allTags.slice(0, maxVisible);
    const hiddenTags = allTags.slice(maxVisible);

    // 渲染可见标签
    visibleTags.forEach(tag => {
      this.createTagElement(tag, tagsContainer);
    });

    // 如果有隐藏的标签，添加"更多"按钮
    if (hiddenTags.length > 0) {
      // 创建一个包装容器，用于正确定位
      const moreButtonContainer = tagsContainer.createDiv({
        cls: 'more-tags-container'
      });

      const moreButton = moreButtonContainer.createEl('a', {
        text: `+${hiddenTags.length}`,
        cls: 'tag more-tags-button'
      });

      // 创建悬浮窗容器，默认隐藏
      const tooltipContainer = document.body.createDiv({
        cls: 'hidden-tags-tooltip'
      });

      // 添加所有隐藏的标签到悬浮窗
      hiddenTags.forEach(tag => {
        this.createTagElement(tag, tooltipContainer);
      });

      // 鼠标悬停显示悬浮窗
      moreButton.addEventListener('mouseenter', (event) => {
        const buttonRect = moreButton.getBoundingClientRect();

        // 计算悬浮窗位置
        tooltipContainer.style.left = `${buttonRect.left}px`;
        tooltipContainer.style.top = `${buttonRect.bottom + 5}px`; // 在按钮下方5px处

        // 显示悬浮窗
        tooltipContainer.style.display = 'flex';

        // 检查悬浮窗是否超出视口边界
        setTimeout(() => {
          const rect = tooltipContainer.getBoundingClientRect();

          // 如果悬浮窗右侧超出视口右侧，则向左对齐
          if (rect.right > window.innerWidth - 20) {
            tooltipContainer.style.left = `${window.innerWidth - rect.width - 20}px`;
          }

          // 如果悬浮窗底部超出视口底部，则向上显示
          if (rect.bottom > window.innerHeight - 20) {
            tooltipContainer.style.top = `${buttonRect.top - rect.height - 5}px`;
          }
        }, 10);
      });

      // 鼠标离开隐藏悬浮窗
      moreButton.addEventListener('mouseleave', () => {
        // 添加延迟，以便用户可以移动到悬浮窗上
        setTimeout(() => {
          if (!tooltipContainer.matches(':hover')) {
            tooltipContainer.style.display = 'none';
          }
        }, 200);
      });

      // 鼠标离开悬浮窗时隐藏
      tooltipContainer.addEventListener('mouseleave', () => {
        tooltipContainer.style.display = 'none';
      });

      // 当卡片被移除时，也移除悬浮窗
      const cardContainer = moreButtonContainer.closest('.new-cards-container');
      if (cardContainer) {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'childList' &&
              Array.from(mutation.removedNodes).includes(cardContainer as Node)) {
              tooltipContainer.remove();
              observer.disconnect();
            }
          });
        });

        const parentElement = cardContainer.parentElement;
        if (parentElement) {
          observer.observe(parentElement, { childList: true });
        }
      }
    }
  }

  // 创建单个标签元素的辅助函数
  private createTagElement(tag: string, container: HTMLElement) {
    const tagEl = container.createEl('a', {
      text: tag,
      cls: 'tag'
    });

    // 添加点击事件，点击标签时添加标签筛选
    tagEl.addEventListener('click', (e) => {
      e.stopPropagation(); // 阻止事件冒泡
      // 如果当前在卡片总览视图中，添加标签筛选
      if (this.view) {
        this.view.addTagFilter(tag);
      } else {
        // 在笔记中时，直接触发搜索命令并设置搜索内容
        try {
          // 使用类型断言来绕过类型检查
          const app = this.app as any;

          // 尝试通过命令触发搜索
          app.commands.executeCommandById('global-search:open');

          // 等待搜索界面加载
          setTimeout(() => {
            // 获取搜索输入框并设置搜索内容
            const searchInput = document.querySelector('.search-input-container input');
            if (searchInput) {
              (searchInput as HTMLInputElement).value = `tag:${tag}`;
              // 触发input事件以激活搜索
              searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }, 100);
        } catch (error) {
          console.error('打开搜索视图失败:', error);
        }
      }
    });

    return tagEl;
  }

  public renderIdeaCard(data: IdeaCardData, el: HTMLElement, cid: string) {
    const container = el.createDiv({ cls: 'new-cards-container idea-card' });

    // 添加点击事件处理
    if (data.url) {
      container.addClass('clickable');
      container.addEventListener('click', (e) => {
        // 检查点击是否在标签容器或CID区域内
        const isTagClick = (e.target as HTMLElement).closest('.card-tags-container');
        const isCidClick = (e.target as HTMLElement).closest('.card-id');
        if (!isTagClick && !isCidClick) {
          if (data.url && (data.url.startsWith('http://') || data.url.startsWith('https://'))) {
            window.open(data.url);
          } else if (data.url && data.url.startsWith('obsidian://')) {
            // 处理obsidian://协议链接
            const url = new URL(data.url);
            const vault = decodeURIComponent(url.searchParams.get('vault') || '');
            const file = decodeURIComponent(url.searchParams.get('file') || '');
            this.app.workspace.openLinkText(file, vault, true);
          } else {
            // 处理内部链接
            const targetFile = this.app.metadataCache.getFirstLinkpathDest(data.url || '', '');
            if (targetFile) {
              this.app.workspace.getLeaf().openFile(targetFile);
            }
          }
        }
      });
    }

    // 添加卡片ID
    const cidEl = container.createDiv({ cls: 'card-id', text: cid });
    cidEl.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(cid);
    });

    // 创建内容容器
    const contentContainer = container.createDiv({ cls: 'idea-content' });
    contentContainer.createEl('div', { text: data.idea });

    // 创建元信息容器
    const metaContainer = container.createDiv({ cls: 'idea-meta' });

    // 添加来源信息
    if (data.source) {
      metaContainer.createEl('div', {
        cls: 'idea-source',
        text: `有感于:${data.source}`
      });
    }

    // 添加日期信息
    if (data.date) {
      metaContainer.createEl('div', {
        cls: 'idea-date',
        text: data.date
      });
    }

    // 添加标签
    if (data.tags && data.tags.length > 0) {
      const tagsContainer = metaContainer.createDiv({ cls: 'card-tags-container' });
      this.renderTags(data, tagsContainer);
    }
  }

  // 辅助方法：创建描述元素，始终只显示两行，由CSS控制
  private createDescriptionElement(container: HTMLElement, description: string) {
    if (!description) return null;
    const descEl = container.createEl('div', { cls: 'card-info-description' });
    descEl.textContent = description;
    return descEl;
  }

  public renderMusicCard(data: MusicCardData, el: HTMLElement, cid: string) {
    const container = el.createDiv({ cls: 'new-cards-container music-card' });

    // 添加卡片ID
    const cidEl = container.createDiv({ cls: 'card-id', text: cid });
    cidEl.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(cid);
    });

    // 添加点击事件处理
    if (data.url) {
      container.addClass('clickable');
      container.addEventListener('click', (e) => {
        // 检查点击是否在标签容器或CID区域内
        const isTagClick = (e.target as HTMLElement).closest('.card-tags-container');
        const isCidClick = (e.target as HTMLElement).closest('.card-id');
        if (!isTagClick && !isCidClick) {
          if (data.url && (data.url.startsWith('http://') || data.url.startsWith('https://'))) {
            // 处理网络链接
            window.open(data.url);
          } else if (data.url && data.url.startsWith('obsidian://')) {
            // 处理obsidian://协议链接
            const url = new URL(data.url);
            const vault = decodeURIComponent(url.searchParams.get('vault') || '');
            const file = decodeURIComponent(url.searchParams.get('file') || '');
            this.app.workspace.openLinkText(file, vault, true);
          } else if (data.url && data.url.startsWith('file:///')) {
            // 处理本地文件链接，例如音乐文件
            try {
              // 解码URL，处理中文和其他特殊字符
              let filePath = data.url;

              // 如果路径包含URL编码的字符，先进行解码
              if (filePath.includes('%')) {
                try {
                  filePath = decodeURIComponent(filePath);
                } catch (decodeErr) {
                  console.warn('URL解码失败，将使用原始路径:', decodeErr);
                }
              }

              // 在Windows上使用适当的路径格式
              if (process.platform === 'win32') {
                // 移除file:///前缀，保留盘符
                filePath = filePath.replace('file:///', '');
              } else {
                // 对于非Windows系统，保留file://但去除第三个/
                filePath = filePath.replace('file:///', 'file://');
              }

              console.log('正在尝试打开文件:', filePath);

              // 使用electron的shell.openExternal来打开文件
              // @ts-ignore
              const { shell } = require('electron');
              shell.openPath(filePath)
                .then((error: string) => {
                  if (error) {
                    console.error('打开文件返回错误:', error);
                    new Notice(`打开文件失败: ${error}`);
                    // 备用方案：尝试使用openExternal
                    return shell.openExternal(data.url);
                  } else {
                    new Notice('正在打开本地文件...');
                  }
                })
                .catch((err: any) => {
                  console.error('openPath调用失败，尝试使用openExternal:', err);
                  return shell.openExternal(data.url);
                });
            } catch (error) {
              console.error('打开本地文件失败:', error);
              new Notice(`打开本地文件失败: ${error.message}`);

              // 备用方案：尝试复制路径到剪贴板
              navigator.clipboard.writeText(data.url)
                .then(() => new Notice('已复制文件路径到剪贴板'))
                .catch(err => new Notice('复制文件路径失败'));
            }
          } else {
            // 处理内部链接
            const targetFile = this.app.metadataCache.getFirstLinkpathDest(data.url || '', '');
            if (targetFile) {
              this.app.workspace.getLeaf().openFile(targetFile);
            }
          }
        }
      });
    }

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
      coverContainer.createEl('img', {
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

    if (data.artist) {
      infoContainer.createEl('div', { text: data.artist, cls: 'artist' });
    }

    // 创建年份与专辑的容器（类似于标签容器）
    if (data.year || data.album) {
      const yearContainer = infoContainer.createDiv({ cls: 'year-container' });

      // 添加年份
      if (data.year) {
        yearContainer.createEl('div', { text: data.year, cls: 'year' });
      }

      // 添加专辑信息，放在年份容器中
      if (data.album) {
        yearContainer.createEl('div', { text: `专辑: ${data.album}`, cls: 'album' });
      }
    } else {
      // 如果没有年份但有专辑，直接添加专辑
      if (data.album) {
        infoContainer.createEl('div', { text: `专辑: ${data.album}`, cls: 'album' });
      }
    }

    if (data.rating) {
      const ratingContainer = infoContainer.createDiv({ cls: 'rating' });
      const ratingScore = parseFloat(data.rating);

      // 根据评分范围设置不同的评分徽章样式
      if (ratingScore >= 7.0) {
        ratingContainer.setAttribute('data-score', 'excellent');
        const ratingBadge = ratingContainer.createDiv({ cls: 'rating-badge' });
        ratingBadge.createDiv({ cls: 'rating-score', text: data.rating });
        ratingBadge.innerHTML += `
         <svg t="1748435026173" class="icon" viewBox="0 0 1332 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="706" width="200" height="200"><path d="M754.999373 984.409613s-40.018391-7.918077-58.42257-18.618181c-18.618182-10.700104-120.483177-56.28255-189.39185-12.840126 0 0-28.462278 24.182236-57.35256 27.178266 0 0 36.808359 13.482132 74.900731 2.782027 0 0 32.528318-9.20209 50.932498-22.47022 0 0 40.660397-17.976176 78.538767 0.214002 37.87837 18.190178 33.170324 23.326228 64.842633 28.248276 31.672309 5.13605 35.952351-4.494044 35.952351-4.494044zM509.324974 912.076907s-16.692163-47.722466-74.472727-62.060606c0 0 9.20209 41.730408 56.068547 57.780564 0 0-93.732915 1.498015-130.11327 54.784535-0.214002 0 75.75674 29.960293 148.51745-50.504493z" fill="#f1c54c" p-id="707"></path><path d="M413.66604 896.454754s-3.638036-50.504493-55.640544-79.608777c0 0-2.140021 42.800418 38.734379 70.406688 0 0-90.950888-23.326228-139.957367 18.618181 0.214002 0 65.484639 49.006479 156.863532-9.416092z" fill="#f1c54c" p-id="708"></path><path d="M312.229049 767.411494s27.820272 47.294462-2.782027 98.440962c0 0-93.304911 28.67628-153.011494-39.590387 0 0 75.114734-24.824242 148.089446 35.096343 0.214002 0-22.042215-53.928527 7.704075-93.946918z" fill="#f1c54c" p-id="709"></path><path d="M252.308464 796.301776s-16.692163-53.28652 11.770115-84.102821c0 0 26.964263 48.792476-9.630094 91.16489 0 0-101.436991 19.902194-139.957367-49.862487 0 0.428004 61.632602-19.902194 137.817346 42.800418z" fill="#f1c54c" p-id="710"></path><path d="M202.873981 729.961129s-9.844096-47.936468 19.046186-78.966772c0 0 23.754232 43.656426-15.194148 87.954859 0 0-106.787043-2.354023-128.401254-60.990595-0.214002 0.214002 81.748798-3.852038 124.549216 52.002508z" fill="#f1c54c" p-id="711"></path><path d="M189.177847 585.081714s13.482132 52.644514-24.182236 81.106792c0 0-87.740857 2.354023-115.77513-67.410659 0 0 75.114734 2.140021 112.993103 60.990596 0 0-2.140021-51.360502 26.964263-74.686729z" fill="#f1c54c" p-id="712"></path><path d="M161.143574 519.811076s12.412121 43.442424-26.536259 73.616719c0 0-84.316823-4.494044-105.931035-70.406687 0 0 66.340648 2.782027 101.650993 64.842633 0-0.214002-2.782027-38.94838 30.816301-68.052665z" fill="#f1c54c" p-id="713"></path><path d="M151.085475 456.466458s6.206061 35.096343-33.81233 69.336677c0 0-82.176803-22.470219-92.876907-78.324765 0 0 70.192685 14.980146 91.806897 73.616719 0.214002-0.214002-2.568025-36.808359 34.88234-64.628631z" fill="#f1c54c" p-id="714"></path><path d="M147.875444 398.899896s2.354023 39.162382-40.232393 57.780564c0 0-79.394775-35.952351-76.184744-85.600836 0 0 48.15047 4.494044 76.184744 80.464786 0.214002 0 9.20209-38.306374 40.232393-52.644514z" fill="#f1c54c" p-id="715"></path><path d="M154.723511 340.049321s-6.206061 35.310345-46.010449 50.932497c0 0-66.982654-43.442424-61.632602-91.806896 0 0 54.142529 24.824242 61.846604 85.814838 0 0 7.918077-24.396238 45.796447-44.940439zM166.493626 281.198746s-4.06604 33.384326-46.224451 44.512435c0 0-55.854545-25.680251-52.644515-91.592895 0 0 48.578474 24.61024 53.286521 86.242843-0.214002 0 16.906165-37.236364 45.582445-39.162383zM185.753814 225.986207s-26.750261 2.354023-47.722466 33.170324c0 0-4.06604-65.270637-44.726437-85.386834 0 0-14.552142 49.006479 43.01442 92.876907 0.214002 0 36.594357-6.848067 49.434483-40.660397z" fill="#f1c54c" p-id="716"></path><path d="M205.442006 176.551724S189.605852 208.438036 157.71954 209.722048c0 0-47.722466-41.730408-35.310345-89.880878 0 0 36.166353 26.322257 36.594358 83.032811 0.214002 0 15.622153-24.61024 46.438453-26.322257zM230.052247 128.615256s-9.20209 28.67628-50.076489 29.532288c0 0-38.520376-47.08046-20.972205-89.880877 0 0 29.104284 23.54023 24.182236 81.9628 0-0.214002 20.330199-22.898224 46.866458-21.614211zM258.514525 85.814838s-14.980146 26.536259-47.936469 23.326228c0 0-37.664368-49.006479-15.194148-86.670847 0 0 27.392268 26.536259 17.334169 80.464786 0 0 19.688192-19.47419 45.796448-17.120167z" fill="#f1c54c" p-id="717"></path><path d="M279.914734 53.500522s-13.910136 25.894253-49.648485 21.186207c0 0-5.564054-39.804389 19.47419-52.21651 0 0 7.276071 20.544201-7.490073 41.302404-0.214002 0 11.984117-12.412121 37.664368-10.272101z" fill="#f1c54c" p-id="718"></path><path d="M291.256844 24.824242s-3.424033 24.182236-29.318286 22.042216c0 0 1.498015-20.116196 29.318286-22.042216z" fill="#f1c54c" p-id="719"></path><path d="M556.405434 984.409613s40.018391-7.918077 58.42257-18.618181 120.483177-56.28255 189.39185-12.840126c0 0 28.462278 24.182236 57.35256 27.178266 0 0-36.808359 13.482132-74.900732 2.782027 0 0-32.528318-9.20209-50.932497-22.47022 0 0-40.660397-17.976176-78.538767 0.214002-37.87837 18.190178-33.170324 23.326228-64.842633 28.248276C560.685475 994.039707 556.405434 984.409613 556.405434 984.409613zM802.079833 912.076907s16.692163-47.722466 74.472727-62.060606c0 0-9.20209 41.730408-56.068547 57.780564 0 0 93.732915 1.498015 130.11327 54.784535 0.214002 0-75.75674 29.960293-148.51745-50.504493z" fill="#f1c54c" p-id="720"></path><path d="M897.738767 896.454754s3.638036-50.504493 55.640543-79.608777c0 0 2.140021 42.800418-38.734378 70.406688 0 0 90.950888-23.326228 139.957367 18.618181-0.214002 0-65.484639 49.006479-156.863532-9.416092z" fill="#f1c54c" p-id="721"></path><path d="M999.175758 767.411494s-27.820272 47.294462 2.782027 98.440962c0 0 93.304911 28.67628 153.011494-39.590387 0 0-75.114734-24.824242-148.303448 35.096343 0 0 22.256217-53.928527-7.490073-93.946918z" fill="#f1c54c" p-id="722"></path><path d="M1059.096343 796.301776s16.692163-53.28652-11.770115-84.102821c0 0-26.964263 48.792476 9.630094 91.16489 0 0 101.436991 19.902194 139.957367-49.862487 0 0.428004-61.632602-19.902194-137.817346 42.800418z" fill="#f1c54c" p-id="723"></path><path d="M1108.530825 729.961129s9.844096-47.936468-19.046186-78.966772c0 0-23.754232 43.656426 15.194149 87.954859 0 0 106.787043-2.354023 128.401254-60.990595 0.214002 0.214002-81.748798-3.852038-124.549217 52.002508z" fill="#f1c54c" p-id="724"></path><path d="M1122.226959 585.081714s-13.482132 52.644514 24.182236 81.106792c0 0 87.740857 2.354023 115.775131-67.410659 0 0-75.114734 2.140021-112.993103 60.990596 0 0 2.140021-51.360502-26.964264-74.686729z" fill="#f1c54c" p-id="725"></path><path d="M1150.261233 519.811076s-12.412121 43.442424 26.536259 73.616719c0 0 84.316823-4.494044 105.931035-70.406687 0 0-66.340648 2.782027-101.650993 64.842633 0-0.214002 2.568025-38.94838-30.816301-68.052665z" fill="#f1c54c" p-id="726"></path><path d="M1160.105329 456.466458s-6.206061 35.096343 33.81233 69.336677c0 0 82.176803-22.470219 92.876907-78.324765 0 0-70.192685 14.980146-91.806896 73.616719 0-0.214002 2.568025-36.808359-34.882341-64.628631z" fill="#f1c54c" p-id="727"></path><path d="M1163.315361 398.899896s-2.354023 39.162382 40.232392 57.780564c0 0 79.394775-35.952351 76.184744-85.600836 0 0-48.15047 4.494044-76.184744 80.464786 0 0-9.20209-38.306374-40.232392-52.644514z" fill="#f1c54c" p-id="728"></path><path d="M1156.681296 340.049321s6.206061 35.310345 46.010449 50.932497c0 0 66.982654-43.442424 61.632602-91.806896 0 0-54.142529 24.824242-61.846604 85.814838 0 0-8.132079-24.396238-45.796447-44.940439zM1144.911181 281.198746s4.06604 33.384326 46.224451 44.512435c0 0 55.854545-25.680251 52.644514-91.592895 0 0-48.578474 24.61024-53.28652 86.242843 0.214002 0-16.906165-37.236364-45.582445-39.162383zM1125.650993 225.986207s26.750261 2.354023 47.722466 33.170324c0 0 4.06604-65.270637 44.726437-85.386834 0 0 14.552142 49.006479-43.014421 92.876907-0.214002 0-36.594357-6.848067-49.434482-40.660397z" fill="#f1c54c" p-id="729"></path><path d="M1105.9628 176.551724s15.836155 31.886311 47.722466 33.170324c0 0 47.722466-41.730408 35.310345-89.880878 0 0-36.166353 26.322257-36.594357 83.032811-0.214002 0-15.836155-24.61024-46.438454-26.322257zM1081.35256 128.615256s9.20209 28.67628 50.076489 29.532288c0 0 38.520376-47.08046 20.972205-89.880877 0 0-29.104284 23.54023-24.182236 81.9628-0.214002-0.214002-20.544201-22.898224-46.866458-21.614211zM1052.890282 85.814838s14.980146 26.536259 47.936468 23.326228c0 0 37.664368-49.006479 15.194149-86.670847 0 0-27.392268 26.536259-17.33417 80.464786 0 0-19.902194-19.47419-45.796447-17.120167z" fill="#f1c54c" p-id="730"></path><path d="M1031.490073 53.500522s13.910136 25.894253 49.862487 21.186207c0 0 5.564054-39.804389-19.47419-52.21651 0 0-7.276071 20.544201 7.490073 41.302404-0.214002 0-12.198119-12.412121-37.87837-10.272101z" fill="#f1c54c" p-id="731"></path><path d="M1019.93396 24.824242s3.424033 24.182236 29.532289 22.042216c0 0-1.712017-20.116196-29.532289-22.042216z" fill="#f1c54c" p-id="732"></path></svg>`;
      } else if (ratingScore >= 5.0) {
        ratingContainer.setAttribute('data-score', 'good');
        const ratingBadge = ratingContainer.createDiv({ cls: 'simple-badge' });
        ratingBadge.createDiv({ cls: 'simple-score', text: data.rating });
        ratingBadge.innerHTML += `<svg t="1747995989766" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1354" width="200" height="200"><path d="M0 870.4m32 0l960 0q32 0 32 32l0 0q0 32-32 32l-960 0q-32 0-32-32l0 0q0-32 32-32Z" p-id="1355" fill="#c0c0c0"></path><path d="M64 640m0 32l0 230.4q0 32-32 32l0 0q-32 0-32-32l0-230.4q0-32 32-32l0 0q32 0 32 32Z" p-id="1356" fill="#c0c0c0"></path><path d="M1024 640m0 32l0 230.4q0 32-32 32l0 0q-32 0-32-32l0-230.4q0-32 32-32l0 0q32 0 32 32Z" p-id="1357" fill="#c0c0c0"></path><path d="M358.4 960m32 0l230.4 0q32 0 32 32l0 0q0 32-32 32l-230.4 0q-32 0-32-32l0 0q0-32 32-32Z" p-id="1358" fill="#c0c0c0"></path></svg>`;


      } else {
        ratingContainer.setAttribute('data-score', 'poor');
        ratingContainer.createDiv({ text: data.rating });
      }
    }

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

    // 使用辅助方法添加描述
    if (data.description) {
      this.createDescriptionElement(infoContainer, data.description);
    }

    // 添加标签和收录时间
    if ((data.tags && data.tags.length > 0) || data.collection_date) {
      const tagsContainer = infoContainer.createDiv({ cls: 'card-tags-container' });
      if (data.tags) {
        this.renderTags(data, tagsContainer);
      }
      if (data.collection_date) {
        const collectionDateEl = tagsContainer.createDiv({ cls: 'collection-date', text: data.collection_date });
      }
    }
  }

  public renderBookCard(data: BookCardData, el: HTMLElement, cid: string) {
    const container = el.createDiv({ cls: 'new-cards-container book-card' });

    // 添加卡片ID
    const cidEl = container.createDiv({ cls: 'card-id', text: cid });
    cidEl.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(cid);
    });

    // 添加点击事件处理
    if (data.url) {
      container.addClass('clickable');
      container.addEventListener('click', (e) => {
        // 检查点击是否在标签容器或CID区域内
        const isTagClick = (e.target as HTMLElement).closest('.card-tags-container');
        const isCidClick = (e.target as HTMLElement).closest('.card-id');
        if (!isTagClick && !isCidClick) {
          if (data.url && (data.url.startsWith('http://') || data.url.startsWith('https://'))) {
            window.open(data.url);
          } else if (data.url && data.url.startsWith('obsidian://')) {
            // 处理obsidian://协议链接
            const url = new URL(data.url);
            const vault = decodeURIComponent(url.searchParams.get('vault') || '');
            const file = decodeURIComponent(url.searchParams.get('file') || '');
            this.app.workspace.openLinkText(file, vault, true);
          } else {
            // 处理内部链接
            const targetFile = this.app.metadataCache.getFirstLinkpathDest(data.url || '', '');
            if (targetFile) {
              this.app.workspace.getLeaf().openFile(targetFile);
            }
          }
        }
      });
    }

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
    if (data.rating) {
      const ratingContainer = infoContainer.createDiv({ cls: 'rating' });
      const ratingScore = parseFloat(data.rating);

      // 根据评分范围设置不同的评分徽章样式
      if (ratingScore >= 7.0) {
        ratingContainer.setAttribute('data-score', 'excellent');
        const ratingBadge = ratingContainer.createDiv({ cls: 'rating-badge' });
        ratingBadge.createDiv({ cls: 'rating-score', text: data.rating });
        ratingBadge.innerHTML += `
          <svg t="1748435026173" class="icon" viewBox="0 0 1332 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="706" width="200" height="200"><path d="M754.999373 984.409613s-40.018391-7.918077-58.42257-18.618181c-18.618182-10.700104-120.483177-56.28255-189.39185-12.840126 0 0-28.462278 24.182236-57.35256 27.178266 0 0 36.808359 13.482132 74.900731 2.782027 0 0 32.528318-9.20209 50.932498-22.47022 0 0 40.660397-17.976176 78.538767 0.214002 37.87837 18.190178 33.170324 23.326228 64.842633 28.248276 31.672309 5.13605 35.952351-4.494044 35.952351-4.494044zM509.324974 912.076907s-16.692163-47.722466-74.472727-62.060606c0 0 9.20209 41.730408 56.068547 57.780564 0 0-93.732915 1.498015-130.11327 54.784535-0.214002 0 75.75674 29.960293 148.51745-50.504493z" fill="#f1c54c" p-id="707"></path><path d="M413.66604 896.454754s-3.638036-50.504493-55.640544-79.608777c0 0-2.140021 42.800418 38.734379 70.406688 0 0-90.950888-23.326228-139.957367 18.618181 0.214002 0 65.484639 49.006479 156.863532-9.416092z" fill="#f1c54c" p-id="708"></path><path d="M312.229049 767.411494s27.820272 47.294462-2.782027 98.440962c0 0-93.304911 28.67628-153.011494-39.590387 0 0 75.114734-24.824242 148.089446 35.096343 0.214002 0-22.042215-53.928527 7.704075-93.946918z" fill="#f1c54c" p-id="709"></path><path d="M252.308464 796.301776s-16.692163-53.28652 11.770115-84.102821c0 0 26.964263 48.792476-9.630094 91.16489 0 0-101.436991 19.902194-139.957367-49.862487 0 0.428004 61.632602-19.902194 137.817346 42.800418z" fill="#f1c54c" p-id="710"></path><path d="M202.873981 729.961129s-9.844096-47.936468 19.046186-78.966772c0 0 23.754232 43.656426-15.194148 87.954859 0 0-106.787043-2.354023-128.401254-60.990595-0.214002 0.214002 81.748798-3.852038 124.549216 52.002508z" fill="#f1c54c" p-id="711"></path><path d="M189.177847 585.081714s13.482132 52.644514-24.182236 81.106792c0 0-87.740857 2.354023-115.77513-67.410659 0 0 75.114734 2.140021 112.993103 60.990596 0 0-2.140021-51.360502 26.964263-74.686729z" fill="#f1c54c" p-id="712"></path><path d="M161.143574 519.811076s12.412121 43.442424-26.536259 73.616719c0 0-84.316823-4.494044-105.931035-70.406687 0 0 66.340648 2.782027 101.650993 64.842633 0-0.214002-2.782027-38.94838 30.816301-68.052665z" fill="#f1c54c" p-id="713"></path><path d="M151.085475 456.466458s6.206061 35.096343-33.81233 69.336677c0 0-82.176803-22.470219-92.876907-78.324765 0 0 70.192685 14.980146 91.806897 73.616719 0.214002-0.214002-2.568025-36.808359 34.88234-64.628631z" fill="#f1c54c" p-id="714"></path><path d="M147.875444 398.899896s2.354023 39.162382-40.232393 57.780564c0 0-79.394775-35.952351-76.184744-85.600836 0 0 48.15047 4.494044 76.184744 80.464786 0.214002 0 9.20209-38.306374 40.232393-52.644514z" fill="#f1c54c" p-id="715"></path><path d="M154.723511 340.049321s-6.206061 35.310345-46.010449 50.932497c0 0-66.982654-43.442424-61.632602-91.806896 0 0 54.142529 24.824242 61.846604 85.814838 0 0 7.918077-24.396238 45.796447-44.940439zM166.493626 281.198746s-4.06604 33.384326-46.224451 44.512435c0 0-55.854545-25.680251-52.644515-91.592895 0 0 48.578474 24.61024 53.286521 86.242843-0.214002 0 16.906165-37.236364 45.582445-39.162383zM185.753814 225.986207s-26.750261 2.354023-47.722466 33.170324c0 0-4.06604-65.270637-44.726437-85.386834 0 0-14.552142 49.006479 43.01442 92.876907 0.214002 0 36.594357-6.848067 49.434483-40.660397z" fill="#f1c54c" p-id="716"></path><path d="M205.442006 176.551724S189.605852 208.438036 157.71954 209.722048c0 0-47.722466-41.730408-35.310345-89.880878 0 0 36.166353 26.322257 36.594358 83.032811 0.214002 0 15.622153-24.61024 46.438453-26.322257zM230.052247 128.615256s-9.20209 28.67628-50.076489 29.532288c0 0-38.520376-47.08046-20.972205-89.880877 0 0 29.104284 23.54023 24.182236 81.9628 0-0.214002 20.330199-22.898224 46.866458-21.614211zM258.514525 85.814838s-14.980146 26.536259-47.936469 23.326228c0 0-37.664368-49.006479-15.194148-86.670847 0 0 27.392268 26.536259 17.334169 80.464786 0 0 19.688192-19.47419 45.796448-17.120167z" fill="#f1c54c" p-id="717"></path><path d="M279.914734 53.500522s-13.910136 25.894253-49.648485 21.186207c0 0-5.564054-39.804389 19.47419-52.21651 0 0 7.276071 20.544201-7.490073 41.302404-0.214002 0 11.984117-12.412121 37.664368-10.272101z" fill="#f1c54c" p-id="718"></path><path d="M291.256844 24.824242s-3.424033 24.182236-29.318286 22.042216c0 0 1.498015-20.116196 29.318286-22.042216z" fill="#f1c54c" p-id="719"></path><path d="M556.405434 984.409613s40.018391-7.918077 58.42257-18.618181 120.483177-56.28255 189.39185-12.840126c0 0 28.462278 24.182236 57.35256 27.178266 0 0-36.808359 13.482132-74.900732 2.782027 0 0-32.528318-9.20209-50.932497-22.47022 0 0-40.660397-17.976176-78.538767 0.214002-37.87837 18.190178-33.170324 23.326228-64.842633 28.248276C560.685475 994.039707 556.405434 984.409613 556.405434 984.409613zM802.079833 912.076907s16.692163-47.722466 74.472727-62.060606c0 0-9.20209 41.730408-56.068547 57.780564 0 0 93.732915 1.498015 130.11327 54.784535 0.214002 0-75.75674 29.960293-148.51745-50.504493z" fill="#f1c54c" p-id="720"></path><path d="M897.738767 896.454754s3.638036-50.504493 55.640543-79.608777c0 0 2.140021 42.800418-38.734378 70.406688 0 0 90.950888-23.326228 139.957367 18.618181-0.214002 0-65.484639 49.006479-156.863532-9.416092z" fill="#f1c54c" p-id="721"></path><path d="M999.175758 767.411494s-27.820272 47.294462 2.782027 98.440962c0 0 93.304911 28.67628 153.011494-39.590387 0 0-75.114734-24.824242-148.303448 35.096343 0 0 22.256217-53.928527-7.490073-93.946918z" fill="#f1c54c" p-id="722"></path><path d="M1059.096343 796.301776s16.692163-53.28652-11.770115-84.102821c0 0-26.964263 48.792476 9.630094 91.16489 0 0 101.436991 19.902194 139.957367-49.862487 0 0.428004-61.632602-19.902194-137.817346 42.800418z" fill="#f1c54c" p-id="723"></path><path d="M1108.530825 729.961129s9.844096-47.936468-19.046186-78.966772c0 0-23.754232 43.656426 15.194149 87.954859 0 0 106.787043-2.354023 128.401254-60.990595 0.214002 0.214002-81.748798-3.852038-124.549217 52.002508z" fill="#f1c54c" p-id="724"></path><path d="M1122.226959 585.081714s-13.482132 52.644514 24.182236 81.106792c0 0 87.740857 2.354023 115.775131-67.410659 0 0-75.114734 2.140021-112.993103 60.990596 0 0 2.140021-51.360502-26.964264-74.686729z" fill="#f1c54c" p-id="725"></path><path d="M1150.261233 519.811076s-12.412121 43.442424 26.536259 73.616719c0 0 84.316823-4.494044 105.931035-70.406687 0 0-66.340648 2.782027-101.650993 64.842633 0-0.214002 2.568025-38.94838-30.816301-68.052665z" fill="#f1c54c" p-id="726"></path><path d="M1160.105329 456.466458s-6.206061 35.096343 33.81233 69.336677c0 0 82.176803-22.470219 92.876907-78.324765 0 0-70.192685 14.980146-91.806896 73.616719 0-0.214002 2.568025-36.808359-34.882341-64.628631z" fill="#f1c54c" p-id="727"></path><path d="M1163.315361 398.899896s-2.354023 39.162382 40.232392 57.780564c0 0 79.394775-35.952351 76.184744-85.600836 0 0-48.15047 4.494044-76.184744 80.464786 0 0-9.20209-38.306374-40.232392-52.644514z" fill="#f1c54c" p-id="728"></path><path d="M1156.681296 340.049321s6.206061 35.310345 46.010449 50.932497c0 0 66.982654-43.442424 61.632602-91.806896 0 0-54.142529 24.824242-61.846604 85.814838 0 0-8.132079-24.396238-45.796447-44.940439zM1144.911181 281.198746s4.06604 33.384326 46.224451 44.512435c0 0 55.854545-25.680251 52.644514-91.592895 0 0-48.578474 24.61024-53.28652 86.242843 0.214002 0-16.906165-37.236364-45.582445-39.162383zM1125.650993 225.986207s26.750261 2.354023 47.722466 33.170324c0 0 4.06604-65.270637 44.726437-85.386834 0 0 14.552142 49.006479-43.014421 92.876907-0.214002 0-36.594357-6.848067-49.434482-40.660397z" fill="#f1c54c" p-id="729"></path><path d="M1105.9628 176.551724s15.836155 31.886311 47.722466 33.170324c0 0 47.722466-41.730408 35.310345-89.880878 0 0-36.166353 26.322257-36.594357 83.032811-0.214002 0-15.836155-24.61024-46.438454-26.322257zM1081.35256 128.615256s9.20209 28.67628 50.076489 29.532288c0 0 38.520376-47.08046 20.972205-89.880877 0 0-29.104284 23.54023-24.182236 81.9628-0.214002-0.214002-20.544201-22.898224-46.866458-21.614211zM1052.890282 85.814838s14.980146 26.536259 47.936468 23.326228c0 0 37.664368-49.006479 15.194149-86.670847 0 0-27.392268 26.536259-17.33417 80.464786 0 0-19.902194-19.47419-45.796447-17.120167z" fill="#f1c54c" p-id="730"></path><path d="M1031.490073 53.500522s13.910136 25.894253 49.862487 21.186207c0 0 5.564054-39.804389-19.47419-52.21651 0 0-7.276071 20.544201 7.490073 41.302404-0.214002 0-12.198119-12.412121-37.87837-10.272101z" fill="#f1c54c" p-id="731"></path><path d="M1019.93396 24.824242s3.424033 24.182236 29.532289 22.042216c0 0-1.712017-20.116196-29.532289-22.042216z" fill="#f1c54c" p-id="732"></path></svg>`;
      } else if (ratingScore >= 5.0) {
        ratingContainer.setAttribute('data-score', 'good');
        const ratingBadge = ratingContainer.createDiv({ cls: 'simple-badge' });
        ratingBadge.createDiv({ cls: 'simple-score', text: data.rating });
        ratingBadge.innerHTML += `<svg t="1747995989766" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1354" width="200" height="200"><path d="M0 870.4m32 0l960 0q32 0 32 32l0 0q0 32-32 32l-960 0q-32 0-32-32l0 0q0-32 32-32Z" p-id="1355" fill="#c0c0c0"></path><path d="M64 640m0 32l0 230.4q0 32-32 32l0 0q-32 0-32-32l0-230.4q0-32 32-32l0 0q32 0 32 32Z" p-id="1356" fill="#c0c0c0"></path><path d="M1024 640m0 32l0 230.4q0 32-32 32l0 0q-32 0-32-32l0-230.4q0-32 32-32l0 0q32 0 32 32Z" p-id="1357" fill="#c0c0c0"></path><path d="M358.4 960m32 0l230.4 0q32 0 32 32l0 0q0 32-32 32l-230.4 0q-32 0-32-32l0 0q0-32 32-32Z" p-id="1358" fill="#c0c0c0"></path></svg>`;


      } else {
        ratingContainer.setAttribute('data-score', 'poor');
        ratingContainer.createDiv({ text: data.rating });
      }
    }

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

    if (data.description) {
      // 判断是否为单行
      const isSingleLine = !data.description.includes('\n') && data.description.length > 0 && data.description.length < 60;
      const descEl = infoContainer.createEl('div', { text: data.description, cls: 'card-info-description' });
      if (isSingleLine) {
        descEl.addClass('single-line');
      }
    }

    // 添加标签和收录时间
    if ((data.tags && data.tags.length > 0) || data.collection_date) {
      const tagsContainer = infoContainer.createDiv({ cls: 'card-tags-container' });
      if (data.tags) {
        this.renderTags(data, tagsContainer);
      }
      if (data.collection_date) {
        tagsContainer.createDiv({ cls: 'collection-date', text: data.collection_date });
      }
    }
  }

  public renderAnimeCard(data: AnimeCardData, el: HTMLElement, cid: string) {
    const container = el.createDiv({ cls: 'new-cards-container anime-card', });

    // 添加卡片ID
    const cidEl = container.createDiv({ cls: 'card-id', text: cid });
    cidEl.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(cid);
    });

    // 添加点击事件处理
    if (data.url) {
      container.addClass('clickable');
      container.addEventListener('click', (e) => {
        // 检查点击是否在标签容器或CID区域内
        const isTagClick = (e.target as HTMLElement).closest('.card-tags-container');
        const isCidClick = (e.target as HTMLElement).closest('.card-id');
        if (!isTagClick && !isCidClick) {
          if (data.url && (data.url.startsWith('http://') || data.url.startsWith('https://'))) {
            window.open(data.url);
          } else if (data.url && data.url.startsWith('obsidian://')) {
            // 处理obsidian://协议链接
            const url = new URL(data.url);
            const vault = decodeURIComponent(url.searchParams.get('vault') || '');
            const file = decodeURIComponent(url.searchParams.get('file') || '');
            this.app.workspace.openLinkText(file, vault, true);
          } else {
            // 处理内部链接
            const targetFile = this.app.metadataCache.getFirstLinkpathDest(data.url || '', '');
            if (targetFile) {
              this.app.workspace.getLeaf().openFile(targetFile);
            }
          }
        }
      });
    }

    // 创建背景容器
    if (data.cover) {
      const backgroundContainer = container.createDiv({ cls: 'background-container' });
      backgroundContainer.createEl('img', {
        attr: { src: this.getCoverImageSrc(data.cover) }
      });
    }

    const coverContainer = container.createDiv({ cls: 'cover-container' });
    const infoContainer = container.createDiv({ cls: 'info-container' });

    // 添加封面图片或番剧图标
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
    if (data.rating) {
      const ratingContainer = infoContainer.createDiv({ cls: 'rating' });
      const ratingScore = parseFloat(data.rating);

      // 根据评分范围设置不同的评分徽章样式
      if (ratingScore >= 7.0) {
        ratingContainer.setAttribute('data-score', 'excellent');
        const ratingBadge = ratingContainer.createDiv({ cls: 'rating-badge' });
        ratingBadge.createDiv({ cls: 'rating-score', text: data.rating });
        ratingBadge.innerHTML += `
          <svg t="1748435026173" class="icon" viewBox="0 0 1332 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="706" width="200" height="200"><path d="M754.999373 984.409613s-40.018391-7.918077-58.42257-18.618181c-18.618182-10.700104-120.483177-56.28255-189.39185-12.840126 0 0-28.462278 24.182236-57.35256 27.178266 0 0 36.808359 13.482132 74.900731 2.782027 0 0 32.528318-9.20209 50.932498-22.47022 0 0 40.660397-17.976176 78.538767 0.214002 37.87837 18.190178 33.170324 23.326228 64.842633 28.248276 31.672309 5.13605 35.952351-4.494044 35.952351-4.494044zM509.324974 912.076907s-16.692163-47.722466-74.472727-62.060606c0 0 9.20209 41.730408 56.068547 57.780564 0 0-93.732915 1.498015-130.11327 54.784535-0.214002 0 75.75674 29.960293 148.51745-50.504493z" fill="#f1c54c" p-id="707"></path><path d="M413.66604 896.454754s-3.638036-50.504493-55.640544-79.608777c0 0-2.140021 42.800418 38.734379 70.406688 0 0-90.950888-23.326228-139.957367 18.618181 0.214002 0 65.484639 49.006479 156.863532-9.416092z" fill="#f1c54c" p-id="708"></path><path d="M312.229049 767.411494s27.820272 47.294462-2.782027 98.440962c0 0-93.304911 28.67628-153.011494-39.590387 0 0 75.114734-24.824242 148.089446 35.096343 0.214002 0-22.042215-53.928527 7.704075-93.946918z" fill="#f1c54c" p-id="709"></path><path d="M252.308464 796.301776s-16.692163-53.28652 11.770115-84.102821c0 0 26.964263 48.792476-9.630094 91.16489 0 0-101.436991 19.902194-139.957367-49.862487 0 0.428004 61.632602-19.902194 137.817346 42.800418z" fill="#f1c54c" p-id="710"></path><path d="M202.873981 729.961129s-9.844096-47.936468 19.046186-78.966772c0 0 23.754232 43.656426-15.194148 87.954859 0 0-106.787043-2.354023-128.401254-60.990595-0.214002 0.214002 81.748798-3.852038 124.549216 52.002508z" fill="#f1c54c" p-id="711"></path><path d="M189.177847 585.081714s13.482132 52.644514-24.182236 81.106792c0 0-87.740857 2.354023-115.77513-67.410659 0 0 75.114734 2.140021 112.993103 60.990596 0 0-2.140021-51.360502 26.964263-74.686729z" fill="#f1c54c" p-id="712"></path><path d="M161.143574 519.811076s12.412121 43.442424-26.536259 73.616719c0 0-84.316823-4.494044-105.931035-70.406687 0 0 66.340648 2.782027 101.650993 64.842633 0-0.214002-2.782027-38.94838 30.816301-68.052665z" fill="#f1c54c" p-id="713"></path><path d="M151.085475 456.466458s6.206061 35.096343-33.81233 69.336677c0 0-82.176803-22.470219-92.876907-78.324765 0 0 70.192685 14.980146 91.806897 73.616719 0.214002-0.214002-2.568025-36.808359 34.88234-64.628631z" fill="#f1c54c" p-id="714"></path><path d="M147.875444 398.899896s2.354023 39.162382-40.232393 57.780564c0 0-79.394775-35.952351-76.184744-85.600836 0 0 48.15047 4.494044 76.184744 80.464786 0.214002 0 9.20209-38.306374 40.232393-52.644514z" fill="#f1c54c" p-id="715"></path><path d="M154.723511 340.049321s-6.206061 35.310345-46.010449 50.932497c0 0-66.982654-43.442424-61.632602-91.806896 0 0 54.142529 24.824242 61.846604 85.814838 0 0 7.918077-24.396238 45.796447-44.940439zM166.493626 281.198746s-4.06604 33.384326-46.224451 44.512435c0 0-55.854545-25.680251-52.644515-91.592895 0 0 48.578474 24.61024 53.286521 86.242843-0.214002 0 16.906165-37.236364 45.582445-39.162383zM185.753814 225.986207s-26.750261 2.354023-47.722466 33.170324c0 0-4.06604-65.270637-44.726437-85.386834 0 0-14.552142 49.006479 43.01442 92.876907 0.214002 0 36.594357-6.848067 49.434483-40.660397z" fill="#f1c54c" p-id="716"></path><path d="M205.442006 176.551724S189.605852 208.438036 157.71954 209.722048c0 0-47.722466-41.730408-35.310345-89.880878 0 0 36.166353 26.322257 36.594358 83.032811 0.214002 0 15.622153-24.61024 46.438453-26.322257zM230.052247 128.615256s-9.20209 28.67628-50.076489 29.532288c0 0-38.520376-47.08046-20.972205-89.880877 0 0 29.104284 23.54023 24.182236 81.9628 0-0.214002 20.330199-22.898224 46.866458-21.614211zM258.514525 85.814838s-14.980146 26.536259-47.936469 23.326228c0 0-37.664368-49.006479-15.194148-86.670847 0 0 27.392268 26.536259 17.334169 80.464786 0 0 19.688192-19.47419 45.796448-17.120167z" fill="#f1c54c" p-id="717"></path><path d="M279.914734 53.500522s-13.910136 25.894253-49.648485 21.186207c0 0-5.564054-39.804389 19.47419-52.21651 0 0 7.276071 20.544201-7.490073 41.302404-0.214002 0 11.984117-12.412121 37.664368-10.272101z" fill="#f1c54c" p-id="718"></path><path d="M291.256844 24.824242s-3.424033 24.182236-29.318286 22.042216c0 0 1.498015-20.116196 29.318286-22.042216z" fill="#f1c54c" p-id="719"></path><path d="M556.405434 984.409613s40.018391-7.918077 58.42257-18.618181 120.483177-56.28255 189.39185-12.840126c0 0 28.462278 24.182236 57.35256 27.178266 0 0-36.808359 13.482132-74.900732 2.782027 0 0-32.528318-9.20209-50.932497-22.47022 0 0-40.660397-17.976176-78.538767 0.214002-37.87837 18.190178-33.170324 23.326228-64.842633 28.248276C560.685475 994.039707 556.405434 984.409613 556.405434 984.409613zM802.079833 912.076907s16.692163-47.722466 74.472727-62.060606c0 0-9.20209 41.730408-56.068547 57.780564 0 0 93.732915 1.498015 130.11327 54.784535 0.214002 0-75.75674 29.960293-148.51745-50.504493z" fill="#f1c54c" p-id="720"></path><path d="M897.738767 896.454754s3.638036-50.504493 55.640543-79.608777c0 0 2.140021 42.800418-38.734378 70.406688 0 0 90.950888-23.326228 139.957367 18.618181-0.214002 0-65.484639 49.006479-156.863532-9.416092z" fill="#f1c54c" p-id="721"></path><path d="M999.175758 767.411494s-27.820272 47.294462 2.782027 98.440962c0 0 93.304911 28.67628 153.011494-39.590387 0 0-75.114734-24.824242-148.303448 35.096343 0 0 22.256217-53.928527-7.490073-93.946918z" fill="#f1c54c" p-id="722"></path><path d="M1059.096343 796.301776s16.692163-53.28652-11.770115-84.102821c0 0-26.964263 48.792476 9.630094 91.16489 0 0 101.436991 19.902194 139.957367-49.862487 0 0.428004-61.632602-19.902194-137.817346 42.800418z" fill="#f1c54c" p-id="723"></path><path d="M1108.530825 729.961129s9.844096-47.936468-19.046186-78.966772c0 0-23.754232 43.656426 15.194149 87.954859 0 0 106.787043-2.354023 128.401254-60.990595 0.214002 0.214002-81.748798-3.852038-124.549217 52.002508z" fill="#f1c54c" p-id="724"></path><path d="M1122.226959 585.081714s-13.482132 52.644514 24.182236 81.106792c0 0 87.740857 2.354023 115.775131-67.410659 0 0-75.114734 2.140021-112.993103 60.990596 0 0 2.140021-51.360502-26.964264-74.686729z" fill="#f1c54c" p-id="725"></path><path d="M1150.261233 519.811076s-12.412121 43.442424 26.536259 73.616719c0 0 84.316823-4.494044 105.931035-70.406687 0 0-66.340648 2.782027-101.650993 64.842633 0-0.214002 2.568025-38.94838-30.816301-68.052665z" fill="#f1c54c" p-id="726"></path><path d="M1160.105329 456.466458s-6.206061 35.096343 33.81233 69.336677c0 0 82.176803-22.470219 92.876907-78.324765 0 0-70.192685 14.980146-91.806896 73.616719 0-0.214002 2.568025-36.808359-34.882341-64.628631z" fill="#f1c54c" p-id="727"></path><path d="M1163.315361 398.899896s-2.354023 39.162382 40.232392 57.780564c0 0 79.394775-35.952351 76.184744-85.600836 0 0-48.15047 4.494044-76.184744 80.464786 0 0-9.20209-38.306374-40.232392-52.644514z" fill="#f1c54c" p-id="728"></path><path d="M1156.681296 340.049321s6.206061 35.310345 46.010449 50.932497c0 0 66.982654-43.442424 61.632602-91.806896 0 0-54.142529 24.824242-61.846604 85.814838 0 0-8.132079-24.396238-45.796447-44.940439zM1144.911181 281.198746s4.06604 33.384326 46.224451 44.512435c0 0 55.854545-25.680251 52.644514-91.592895 0 0-48.578474 24.61024-53.28652 86.242843 0.214002 0-16.906165-37.236364-45.582445-39.162383zM1125.650993 225.986207s26.750261 2.354023 47.722466 33.170324c0 0 4.06604-65.270637 44.726437-85.386834 0 0 14.552142 49.006479-43.014421 92.876907-0.214002 0-36.594357-6.848067-49.434482-40.660397z" fill="#f1c54c" p-id="729"></path><path d="M1105.9628 176.551724s15.836155 31.886311 47.722466 33.170324c0 0 47.722466-41.730408 35.310345-89.880878 0 0-36.166353 26.322257-36.594357 83.032811-0.214002 0-15.836155-24.61024-46.438454-26.322257zM1081.35256 128.615256s9.20209 28.67628 50.076489 29.532288c0 0 38.520376-47.08046 20.972205-89.880877 0 0-29.104284 23.54023-24.182236 81.9628-0.214002-0.214002-20.544201-22.898224-46.866458-21.614211zM1052.890282 85.814838s14.980146 26.536259 47.936468 23.326228c0 0 37.664368-49.006479 15.194149-86.670847 0 0-27.392268 26.536259-17.33417 80.464786 0 0-19.902194-19.47419-45.796447-17.120167z" fill="#f1c54c" p-id="730"></path><path d="M1031.490073 53.500522s13.910136 25.894253 49.862487 21.186207c0 0 5.564054-39.804389-19.47419-52.21651 0 0-7.276071 20.544201 7.490073 41.302404-0.214002 0-12.198119-12.412121-37.87837-10.272101z" fill="#f1c54c" p-id="731"></path><path d="M1019.93396 24.824242s3.424033 24.182236 29.532289 22.042216c0 0-1.712017-20.116196-29.532289-22.042216z" fill="#f1c54c" p-id="732"></path></svg>`;
      } else if (ratingScore >= 5.0) {
        ratingContainer.setAttribute('data-score', 'good');
        const ratingBadge = ratingContainer.createDiv({ cls: 'simple-badge' });
        ratingBadge.createDiv({ cls: 'simple-score', text: data.rating });
        ratingBadge.innerHTML += `<svg t="1747995989766" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1354" width="200" height="200"><path d="M0 870.4m32 0l960 0q32 0 32 32l0 0q0 32-32 32l-960 0q-32 0-32-32l0 0q0-32 32-32Z" p-id="1355" fill="#c0c0c0"></path><path d="M64 640m0 32l0 230.4q0 32-32 32l0 0q-32 0-32-32l0-230.4q0-32 32-32l0 0q32 0 32 32Z" p-id="1356" fill="#c0c0c0"></path><path d="M1024 640m0 32l0 230.4q0 32-32 32l0 0q-32 0-32-32l0-230.4q0-32 32-32l0 0q32 0 32 32Z" p-id="1357" fill="#c0c0c0"></path><path d="M358.4 960m32 0l230.4 0q32 0 32 32l0 0q0 32-32 32l-230.4 0q-32 0-32-32l0 0q0-32 32-32Z" p-id="1358" fill="#c0c0c0"></path></svg>`;


      } else {
        ratingContainer.setAttribute('data-score', 'poor');
        ratingContainer.createDiv({ text: data.rating });
      }
    }

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

    if (data.description) {
      // 判断是否为单行
      const isSingleLine = !data.description.includes('\n') && data.description.length > 0 && data.description.length < 60;
      const descEl = infoContainer.createEl('div', { text: data.description, cls: 'card-info-description' });
      if (isSingleLine) {
        descEl.addClass('single-line');
      }
    }

    // 添加标签和收录时间
    if ((data.tags && data.tags.length > 0) || data.collection_date) {
      const tagsContainer = infoContainer.createDiv({ cls: 'card-tags-container' });
      if (data.tags) {
        this.renderTags(data, tagsContainer);
      }
      if (data.collection_date) {
        tagsContainer.createDiv({ cls: 'collection-date', text: data.collection_date });
      }
    }
  }

  public renderTvCard(data: TvCardData, el: HTMLElement, cid: string) {
    const container = el.createDiv({ cls: 'new-cards-container tv-card', });

    // 添加卡片ID
    const cidEl = container.createDiv({ cls: 'card-id', text: cid });
    cidEl.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(cid);
    });

    // 添加点击事件处理
    if (data.url) {
      container.addClass('clickable');
      container.addEventListener('click', (e) => {
        // 检查点击是否在标签容器或CID区域内
        const isTagClick = (e.target as HTMLElement).closest('.card-tags-container');
        const isCidClick = (e.target as HTMLElement).closest('.card-id');
        if (!isTagClick && !isCidClick) {
          if (data.url && (data.url.startsWith('http://') || data.url.startsWith('https://'))) {
            window.open(data.url);
          } else if (data.url && data.url.startsWith('obsidian://')) {
            // 处理obsidian://协议链接
            const url = new URL(data.url);
            const vault = decodeURIComponent(url.searchParams.get('vault') || '');
            const file = decodeURIComponent(url.searchParams.get('file') || '');
            this.app.workspace.openLinkText(file, vault, true);
          } else {
            // 处理内部链接
            const targetFile = this.app.metadataCache.getFirstLinkpathDest(data.url || '', '');
            if (targetFile) {
              this.app.workspace.getLeaf().openFile(targetFile);
            }
          }
        }
      });
    }

    // 创建背景容器
    if (data.cover) {
      const backgroundContainer = container.createDiv({ cls: 'background-container' });
      backgroundContainer.createEl('img', {
        attr: { src: this.getCoverImageSrc(data.cover) }
      });
    }

    const coverContainer = container.createDiv({ cls: 'cover-container' });
    const infoContainer = container.createDiv({ cls: 'info-container' });

    // 添加封面图片或剧集图标
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
    if (data.rating) {
      const ratingContainer = infoContainer.createDiv({ cls: 'rating' });
      const ratingScore = parseFloat(data.rating);

      // 根据评分范围设置不同的评分徽章样式
      if (ratingScore >= 7.0) {
        ratingContainer.setAttribute('data-score', 'excellent');
        const ratingBadge = ratingContainer.createDiv({ cls: 'rating-badge' });
        ratingBadge.createDiv({ cls: 'rating-score', text: data.rating });
        ratingBadge.innerHTML += `
          <svg t="1748435026173" class="icon" viewBox="0 0 1332 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="706" width="200" height="200"><path d="M754.999373 984.409613s-40.018391-7.918077-58.42257-18.618181c-18.618182-10.700104-120.483177-56.28255-189.39185-12.840126 0 0-28.462278 24.182236-57.35256 27.178266 0 0 36.808359 13.482132 74.900731 2.782027 0 0 32.528318-9.20209 50.932498-22.47022 0 0 40.660397-17.976176 78.538767 0.214002 37.87837 18.190178 33.170324 23.326228 64.842633 28.248276 31.672309 5.13605 35.952351-4.494044 35.952351-4.494044zM509.324974 912.076907s-16.692163-47.722466-74.472727-62.060606c0 0 9.20209 41.730408 56.068547 57.780564 0 0-93.732915 1.498015-130.11327 54.784535-0.214002 0 75.75674 29.960293 148.51745-50.504493z" fill="#f1c54c" p-id="707"></path><path d="M413.66604 896.454754s-3.638036-50.504493-55.640544-79.608777c0 0-2.140021 42.800418 38.734379 70.406688 0 0-90.950888-23.326228-139.957367 18.618181 0.214002 0 65.484639 49.006479 156.863532-9.416092z" fill="#f1c54c" p-id="708"></path><path d="M312.229049 767.411494s27.820272 47.294462-2.782027 98.440962c0 0-93.304911 28.67628-153.011494-39.590387 0 0 75.114734-24.824242 148.089446 35.096343 0.214002 0-22.042215-53.928527 7.704075-93.946918z" fill="#f1c54c" p-id="709"></path><path d="M252.308464 796.301776s-16.692163-53.28652 11.770115-84.102821c0 0 26.964263 48.792476-9.630094 91.16489 0 0-101.436991 19.902194-139.957367-49.862487 0 0.428004 61.632602-19.902194 137.817346 42.800418z" fill="#f1c54c" p-id="710"></path><path d="M202.873981 729.961129s-9.844096-47.936468 19.046186-78.966772c0 0 23.754232 43.656426-15.194148 87.954859 0 0-106.787043-2.354023-128.401254-60.990595-0.214002 0.214002 81.748798-3.852038 124.549216 52.002508z" fill="#f1c54c" p-id="711"></path><path d="M189.177847 585.081714s13.482132 52.644514-24.182236 81.106792c0 0-87.740857 2.354023-115.77513-67.410659 0 0 75.114734 2.140021 112.993103 60.990596 0 0-2.140021-51.360502 26.964263-74.686729z" fill="#f1c54c" p-id="712"></path><path d="M161.143574 519.811076s12.412121 43.442424-26.536259 73.616719c0 0-84.316823-4.494044-105.931035-70.406687 0 0 66.340648 2.782027 101.650993 64.842633 0-0.214002-2.782027-38.94838 30.816301-68.052665z" fill="#f1c54c" p-id="713"></path><path d="M151.085475 456.466458s6.206061 35.096343-33.81233 69.336677c0 0-82.176803-22.470219-92.876907-78.324765 0 0 70.192685 14.980146 91.806897 73.616719 0.214002-0.214002-2.568025-36.808359 34.88234-64.628631z" fill="#f1c54c" p-id="714"></path><path d="M147.875444 398.899896s2.354023 39.162382-40.232393 57.780564c0 0-79.394775-35.952351-76.184744-85.600836 0 0 48.15047 4.494044 76.184744 80.464786 0.214002 0 9.20209-38.306374 40.232393-52.644514z" fill="#f1c54c" p-id="715"></path><path d="M154.723511 340.049321s-6.206061 35.310345-46.010449 50.932497c0 0-66.982654-43.442424-61.632602-91.806896 0 0 54.142529 24.824242 61.846604 85.814838 0 0 7.918077-24.396238 45.796447-44.940439zM166.493626 281.198746s-4.06604 33.384326-46.224451 44.512435c0 0-55.854545-25.680251-52.644515-91.592895 0 0 48.578474 24.61024 53.286521 86.242843-0.214002 0 16.906165-37.236364 45.582445-39.162383zM185.753814 225.986207s-26.750261 2.354023-47.722466 33.170324c0 0-4.06604-65.270637-44.726437-85.386834 0 0-14.552142 49.006479 43.01442 92.876907 0.214002 0 36.594357-6.848067 49.434483-40.660397z" fill="#f1c54c" p-id="716"></path><path d="M205.442006 176.551724S189.605852 208.438036 157.71954 209.722048c0 0-47.722466-41.730408-35.310345-89.880878 0 0 36.166353 26.322257 36.594358 83.032811 0.214002 0 15.622153-24.61024 46.438453-26.322257zM230.052247 128.615256s-9.20209 28.67628-50.076489 29.532288c0 0-38.520376-47.08046-20.972205-89.880877 0 0 29.104284 23.54023 24.182236 81.9628 0-0.214002 20.330199-22.898224 46.866458-21.614211zM258.514525 85.814838s-14.980146 26.536259-47.936469 23.326228c0 0-37.664368-49.006479-15.194148-86.670847 0 0 27.392268 26.536259 17.334169 80.464786 0 0 19.688192-19.47419 45.796448-17.120167z" fill="#f1c54c" p-id="717"></path><path d="M279.914734 53.500522s-13.910136 25.894253-49.648485 21.186207c0 0-5.564054-39.804389 19.47419-52.21651 0 0 7.276071 20.544201-7.490073 41.302404-0.214002 0 11.984117-12.412121 37.664368-10.272101z" fill="#f1c54c" p-id="718"></path><path d="M291.256844 24.824242s-3.424033 24.182236-29.318286 22.042216c0 0 1.498015-20.116196 29.318286-22.042216z" fill="#f1c54c" p-id="719"></path><path d="M556.405434 984.409613s40.018391-7.918077 58.42257-18.618181 120.483177-56.28255 189.39185-12.840126c0 0 28.462278 24.182236 57.35256 27.178266 0 0-36.808359 13.482132-74.900732 2.782027 0 0-32.528318-9.20209-50.932497-22.47022 0 0-40.660397-17.976176-78.538767 0.214002-37.87837 18.190178-33.170324 23.326228-64.842633 28.248276C560.685475 994.039707 556.405434 984.409613 556.405434 984.409613zM802.079833 912.076907s16.692163-47.722466 74.472727-62.060606c0 0-9.20209 41.730408-56.068547 57.780564 0 0 93.732915 1.498015 130.11327 54.784535 0.214002 0-75.75674 29.960293-148.51745-50.504493z" fill="#f1c54c" p-id="720"></path><path d="M897.738767 896.454754s3.638036-50.504493 55.640543-79.608777c0 0 2.140021 42.800418-38.734378 70.406688 0 0 90.950888-23.326228 139.957367 18.618181-0.214002 0-65.484639 49.006479-156.863532-9.416092z" fill="#f1c54c" p-id="721"></path><path d="M999.175758 767.411494s-27.820272 47.294462 2.782027 98.440962c0 0 93.304911 28.67628 153.011494-39.590387 0 0-75.114734-24.824242-148.303448 35.096343 0 0 22.256217-53.928527-7.490073-93.946918z" fill="#f1c54c" p-id="722"></path><path d="M1059.096343 796.301776s16.692163-53.28652-11.770115-84.102821c0 0-26.964263 48.792476 9.630094 91.16489 0 0 101.436991 19.902194 139.957367-49.862487 0 0.428004-61.632602-19.902194-137.817346 42.800418z" fill="#f1c54c" p-id="723"></path><path d="M1108.530825 729.961129s9.844096-47.936468-19.046186-78.966772c0 0-23.754232 43.656426 15.194149 87.954859 0 0 106.787043-2.354023 128.401254-60.990595 0.214002 0.214002-81.748798-3.852038-124.549217 52.002508z" fill="#f1c54c" p-id="724"></path><path d="M1122.226959 585.081714s-13.482132 52.644514 24.182236 81.106792c0 0 87.740857 2.354023 115.775131-67.410659 0 0-75.114734 2.140021-112.993103 60.990596 0 0 2.140021-51.360502-26.964264-74.686729z" fill="#f1c54c" p-id="725"></path><path d="M1150.261233 519.811076s-12.412121 43.442424 26.536259 73.616719c0 0 84.316823-4.494044 105.931035-70.406687 0 0-66.340648 2.782027-101.650993 64.842633 0-0.214002 2.568025-38.94838-30.816301-68.052665z" fill="#f1c54c" p-id="726"></path><path d="M1160.105329 456.466458s-6.206061 35.096343 33.81233 69.336677c0 0 82.176803-22.470219 92.876907-78.324765 0 0-70.192685 14.980146-91.806896 73.616719 0-0.214002 2.568025-36.808359-34.882341-64.628631z" fill="#f1c54c" p-id="727"></path><path d="M1163.315361 398.899896s-2.354023 39.162382 40.232392 57.780564c0 0 79.394775-35.952351 76.184744-85.600836 0 0-48.15047 4.494044-76.184744 80.464786 0 0-9.20209-38.306374-40.232392-52.644514z" fill="#f1c54c" p-id="728"></path><path d="M1156.681296 340.049321s6.206061 35.310345 46.010449 50.932497c0 0 66.982654-43.442424 61.632602-91.806896 0 0-54.142529 24.824242-61.846604 85.814838 0 0-8.132079-24.396238-45.796447-44.940439zM1144.911181 281.198746s4.06604 33.384326 46.224451 44.512435c0 0 55.854545-25.680251 52.644514-91.592895 0 0-48.578474 24.61024-53.28652 86.242843 0.214002 0-16.906165-37.236364-45.582445-39.162383zM1125.650993 225.986207s26.750261 2.354023 47.722466 33.170324c0 0 4.06604-65.270637 44.726437-85.386834 0 0 14.552142 49.006479-43.014421 92.876907-0.214002 0-36.594357-6.848067-49.434482-40.660397z" fill="#f1c54c" p-id="729"></path><path d="M1105.9628 176.551724s15.836155 31.886311 47.722466 33.170324c0 0 47.722466-41.730408 35.310345-89.880878 0 0-36.166353 26.322257-36.594357 83.032811-0.214002 0-15.836155-24.61024-46.438454-26.322257zM1081.35256 128.615256s9.20209 28.67628 50.076489 29.532288c0 0 38.520376-47.08046 20.972205-89.880877 0 0-29.104284 23.54023-24.182236 81.9628-0.214002-0.214002-20.544201-22.898224-46.866458-21.614211zM1052.890282 85.814838s14.980146 26.536259 47.936468 23.326228c0 0 37.664368-49.006479 15.194149-86.670847 0 0-27.392268 26.536259-17.33417 80.464786 0 0-19.902194-19.47419-45.796447-17.120167z" fill="#f1c54c" p-id="730"></path><path d="M1031.490073 53.500522s13.910136 25.894253 49.862487 21.186207c0 0 5.564054-39.804389-19.47419-52.21651 0 0-7.276071 20.544201 7.490073 41.302404-0.214002 0-12.198119-12.412121-37.87837-10.272101z" fill="#f1c54c" p-id="731"></path><path d="M1019.93396 24.824242s3.424033 24.182236 29.532289 22.042216c0 0-1.712017-20.116196-29.532289-22.042216z" fill="#f1c54c" p-id="732"></path></svg>`;
      } else if (ratingScore >= 5.0) {
        ratingContainer.setAttribute('data-score', 'good');
        const ratingBadge = ratingContainer.createDiv({ cls: 'simple-badge' });
        ratingBadge.createDiv({ cls: 'simple-score', text: data.rating });
        ratingBadge.innerHTML += `<svg t="1747995989766" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1354" width="200" height="200"><path d="M0 870.4m32 0l960 0q32 0 32 32l0 0q0 32-32 32l-960 0q-32 0-32-32l0 0q0-32 32-32Z" p-id="1355" fill="#c0c0c0"></path><path d="M64 640m0 32l0 230.4q0 32-32 32l0 0q-32 0-32-32l0-230.4q0-32 32-32l0 0q32 0 32 32Z" p-id="1356" fill="#c0c0c0"></path><path d="M1024 640m0 32l0 230.4q0 32-32 32l0 0q-32 0-32-32l0-230.4q0-32 32-32l0 0q32 0 32 32Z" p-id="1357" fill="#c0c0c0"></path><path d="M358.4 960m32 0l230.4 0q32 0 32 32l0 0q0 32-32 32l-230.4 0q-32 0-32-32l0 0q0-32 32-32Z" p-id="1358" fill="#c0c0c0"></path></svg>`;


      } else {
        ratingContainer.setAttribute('data-score', 'poor');
        ratingContainer.createDiv({ text: data.rating });
      }
    }

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

    if (data.description) {
      // 判断是否为单行
      const isSingleLine = !data.description.includes('\n') && data.description.length > 0 && data.description.length < 60;
      const descEl = infoContainer.createEl('div', { text: data.description, cls: 'card-info-description' });
      if (isSingleLine) {
        descEl.addClass('single-line');
      }
    }

    // 添加标签和收录时间
    if ((data.tags && data.tags.length > 0) || data.collection_date) {
      const tagsContainer = infoContainer.createDiv({ cls: 'card-tags-container' });
      if (data.tags) {
        this.renderTags(data, tagsContainer);
      }
      if (data.collection_date) {
        tagsContainer.createDiv({ cls: 'collection-date', text: data.collection_date });
      }
    }
  }

  public renderMovieCard(data: MovieCardData, el: HTMLElement, cid: string) {
    const container = el.createDiv({ cls: 'new-cards-container movie-card' });
    // 添加卡片ID
    const cidEl = container.createDiv({ cls: 'card-id', text: cid });
    cidEl.addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(cid);
    });
    // 添加点击事件处理
    if (data.url) {
      container.addClass('clickable');
      container.addEventListener('click', (e) => {
        const isTagClick = (e.target as HTMLElement).closest('.card-tags-container');
        const isCidClick = (e.target as HTMLElement).closest('.card-id');
        if (!isTagClick && !isCidClick) {
          if (data.url && (data.url.startsWith('http://') || data.url.startsWith('https://'))) {
            window.open(data.url);
          } else if (data.url && data.url.startsWith('obsidian://')) {
            const url = new URL(data.url);
            const vault = decodeURIComponent(url.searchParams.get('vault') || '');
            const file = decodeURIComponent(url.searchParams.get('file') || '');
            this.app.workspace.openLinkText(file, vault, true);
          } else {
            const targetFile = this.app.metadataCache.getFirstLinkpathDest(data.url || '', '');
            if (targetFile) {
              this.app.workspace.getLeaf().openFile(targetFile);
            }
          }
        }
      });
    }
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
      coverContainer.createEl('img', {
        attr: { src: this.getCoverImageSrc(data.cover) },
        cls: 'cover-image'
      });
    } else {
      coverContainer.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
          <circle cx="7" cy="7" r="1.5"/>
          <circle cx="17" cy="7" r="1.5"/>
          <circle cx="7" cy="17" r="1.5"/>
          <circle cx="17" cy="17" r="1.5"/>
        </svg>
      `;
    }
    // 添加信息
    infoContainer.createEl('h3', { text: data.title, cls: 'card-info-title' });
    infoContainer.createEl('div', { text: data.director, cls: 'director' });
    infoContainer.createEl('div', { text: data.year, cls: 'year' });
    if (data.rating) {
      const ratingContainer = infoContainer.createDiv({ cls: 'rating' });
      const ratingScore = parseFloat(data.rating);

      // 根据评分范围设置不同的评分徽章样式
      if (ratingScore >= 7.0) {
        ratingContainer.setAttribute('data-score', 'excellent');
        const ratingBadge = ratingContainer.createDiv({ cls: 'rating-badge' });
        ratingBadge.createDiv({ cls: 'rating-score', text: data.rating });
        ratingBadge.innerHTML += `
          <svg t="1748435026173" class="icon" viewBox="0 0 1332 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="706" width="200" height="200"><path d="M754.999373 984.409613s-40.018391-7.918077-58.42257-18.618181c-18.618182-10.700104-120.483177-56.28255-189.39185-12.840126 0 0-28.462278 24.182236-57.35256 27.178266 0 0 36.808359 13.482132 74.900731 2.782027 0 0 32.528318-9.20209 50.932498-22.47022 0 0 40.660397-17.976176 78.538767 0.214002 37.87837 18.190178 33.170324 23.326228 64.842633 28.248276 31.672309 5.13605 35.952351-4.494044 35.952351-4.494044zM509.324974 912.076907s-16.692163-47.722466-74.472727-62.060606c0 0 9.20209 41.730408 56.068547 57.780564 0 0-93.732915 1.498015-130.11327 54.784535-0.214002 0 75.75674 29.960293 148.51745-50.504493z" fill="#f1c54c" p-id="707"></path><path d="M413.66604 896.454754s-3.638036-50.504493-55.640544-79.608777c0 0-2.140021 42.800418 38.734379 70.406688 0 0-90.950888-23.326228-139.957367 18.618181 0.214002 0 65.484639 49.006479 156.863532-9.416092z" fill="#f1c54c" p-id="708"></path><path d="M312.229049 767.411494s27.820272 47.294462-2.782027 98.440962c0 0-93.304911 28.67628-153.011494-39.590387 0 0 75.114734-24.824242 148.089446 35.096343 0.214002 0-22.042215-53.928527 7.704075-93.946918z" fill="#f1c54c" p-id="709"></path><path d="M252.308464 796.301776s-16.692163-53.28652 11.770115-84.102821c0 0 26.964263 48.792476-9.630094 91.16489 0 0-101.436991 19.902194-139.957367-49.862487 0 0.428004 61.632602-19.902194 137.817346 42.800418z" fill="#f1c54c" p-id="710"></path><path d="M202.873981 729.961129s-9.844096-47.936468 19.046186-78.966772c0 0 23.754232 43.656426-15.194148 87.954859 0 0-106.787043-2.354023-128.401254-60.990595-0.214002 0.214002 81.748798-3.852038 124.549216 52.002508z" fill="#f1c54c" p-id="711"></path><path d="M189.177847 585.081714s13.482132 52.644514-24.182236 81.106792c0 0-87.740857 2.354023-115.77513-67.410659 0 0 75.114734 2.140021 112.993103 60.990596 0 0-2.140021-51.360502 26.964263-74.686729z" fill="#f1c54c" p-id="712"></path><path d="M161.143574 519.811076s12.412121 43.442424-26.536259 73.616719c0 0-84.316823-4.494044-105.931035-70.406687 0 0 66.340648 2.782027 101.650993 64.842633 0-0.214002-2.782027-38.94838 30.816301-68.052665z" fill="#f1c54c" p-id="713"></path><path d="M151.085475 456.466458s6.206061 35.096343-33.81233 69.336677c0 0-82.176803-22.470219-92.876907-78.324765 0 0 70.192685 14.980146 91.806897 73.616719 0.214002-0.214002-2.568025-36.808359 34.88234-64.628631z" fill="#f1c54c" p-id="714"></path><path d="M147.875444 398.899896s2.354023 39.162382-40.232393 57.780564c0 0-79.394775-35.952351-76.184744-85.600836 0 0 48.15047 4.494044 76.184744 80.464786 0.214002 0 9.20209-38.306374 40.232393-52.644514z" fill="#f1c54c" p-id="715"></path><path d="M154.723511 340.049321s-6.206061 35.310345-46.010449 50.932497c0 0-66.982654-43.442424-61.632602-91.806896 0 0 54.142529 24.824242 61.846604 85.814838 0 0 7.918077-24.396238 45.796447-44.940439zM166.493626 281.198746s-4.06604 33.384326-46.224451 44.512435c0 0-55.854545-25.680251-52.644515-91.592895 0 0 48.578474 24.61024 53.286521 86.242843-0.214002 0 16.906165-37.236364 45.582445-39.162383zM185.753814 225.986207s-26.750261 2.354023-47.722466 33.170324c0 0-4.06604-65.270637-44.726437-85.386834 0 0-14.552142 49.006479 43.01442 92.876907 0.214002 0 36.594357-6.848067 49.434483-40.660397z" fill="#f1c54c" p-id="716"></path><path d="M205.442006 176.551724S189.605852 208.438036 157.71954 209.722048c0 0-47.722466-41.730408-35.310345-89.880878 0 0 36.166353 26.322257 36.594358 83.032811 0.214002 0 15.622153-24.61024 46.438453-26.322257zM230.052247 128.615256s-9.20209 28.67628-50.076489 29.532288c0 0-38.520376-47.08046-20.972205-89.880877 0 0 29.104284 23.54023 24.182236 81.9628 0-0.214002 20.330199-22.898224 46.866458-21.614211zM258.514525 85.814838s-14.980146 26.536259-47.936469 23.326228c0 0-37.664368-49.006479-15.194148-86.670847 0 0 27.392268 26.536259 17.334169 80.464786 0 0 19.688192-19.47419 45.796448-17.120167z" fill="#f1c54c" p-id="717"></path><path d="M279.914734 53.500522s-13.910136 25.894253-49.648485 21.186207c0 0-5.564054-39.804389 19.47419-52.21651 0 0 7.276071 20.544201-7.490073 41.302404-0.214002 0 11.984117-12.412121 37.664368-10.272101z" fill="#f1c54c" p-id="718"></path><path d="M291.256844 24.824242s-3.424033 24.182236-29.318286 22.042216c0 0 1.498015-20.116196 29.318286-22.042216z" fill="#f1c54c" p-id="719"></path><path d="M556.405434 984.409613s40.018391-7.918077 58.42257-18.618181 120.483177-56.28255 189.39185-12.840126c0 0 28.462278 24.182236 57.35256 27.178266 0 0-36.808359 13.482132-74.900732 2.782027 0 0-32.528318-9.20209-50.932497-22.47022 0 0-40.660397-17.976176-78.538767 0.214002-37.87837 18.190178-33.170324 23.326228-64.842633 28.248276C560.685475 994.039707 556.405434 984.409613 556.405434 984.409613zM802.079833 912.076907s16.692163-47.722466 74.472727-62.060606c0 0-9.20209 41.730408-56.068547 57.780564 0 0 93.732915 1.498015 130.11327 54.784535 0.214002 0-75.75674 29.960293-148.51745-50.504493z" fill="#f1c54c" p-id="720"></path><path d="M897.738767 896.454754s3.638036-50.504493 55.640543-79.608777c0 0 2.140021 42.800418-38.734378 70.406688 0 0 90.950888-23.326228 139.957367 18.618181-0.214002 0-65.484639 49.006479-156.863532-9.416092z" fill="#f1c54c" p-id="721"></path><path d="M999.175758 767.411494s-27.820272 47.294462 2.782027 98.440962c0 0 93.304911 28.67628 153.011494-39.590387 0 0-75.114734-24.824242-148.303448 35.096343 0 0 22.256217-53.928527-7.490073-93.946918z" fill="#f1c54c" p-id="722"></path><path d="M1059.096343 796.301776s16.692163-53.28652-11.770115-84.102821c0 0-26.964263 48.792476 9.630094 91.16489 0 0 101.436991 19.902194 139.957367-49.862487 0 0.428004-61.632602-19.902194-137.817346 42.800418z" fill="#f1c54c" p-id="723"></path><path d="M1108.530825 729.961129s9.844096-47.936468-19.046186-78.966772c0 0-23.754232 43.656426 15.194149 87.954859 0 0 106.787043-2.354023 128.401254-60.990595 0.214002 0.214002-81.748798-3.852038-124.549217 52.002508z" fill="#f1c54c" p-id="724"></path><path d="M1122.226959 585.081714s-13.482132 52.644514 24.182236 81.106792c0 0 87.740857 2.354023 115.775131-67.410659 0 0-75.114734 2.140021-112.993103 60.990596 0 0 2.140021-51.360502-26.964264-74.686729z" fill="#f1c54c" p-id="725"></path><path d="M1150.261233 519.811076s-12.412121 43.442424 26.536259 73.616719c0 0 84.316823-4.494044 105.931035-70.406687 0 0-66.340648 2.782027-101.650993 64.842633 0-0.214002 2.568025-38.94838-30.816301-68.052665z" fill="#f1c54c" p-id="726"></path><path d="M1160.105329 456.466458s-6.206061 35.096343 33.81233 69.336677c0 0 82.176803-22.470219 92.876907-78.324765 0 0-70.192685 14.980146-91.806896 73.616719 0-0.214002 2.568025-36.808359-34.882341-64.628631z" fill="#f1c54c" p-id="727"></path><path d="M1163.315361 398.899896s-2.354023 39.162382 40.232392 57.780564c0 0 79.394775-35.952351 76.184744-85.600836 0 0-48.15047 4.494044-76.184744 80.464786 0 0-9.20209-38.306374-40.232392-52.644514z" fill="#f1c54c" p-id="728"></path><path d="M1156.681296 340.049321s6.206061 35.310345 46.010449 50.932497c0 0 66.982654-43.442424 61.632602-91.806896 0 0-54.142529 24.824242-61.846604 85.814838 0 0-8.132079-24.396238-45.796447-44.940439zM1144.911181 281.198746s4.06604 33.384326 46.224451 44.512435c0 0 55.854545-25.680251 52.644514-91.592895 0 0-48.578474 24.61024-53.28652 86.242843 0.214002 0-16.906165-37.236364-45.582445-39.162383zM1125.650993 225.986207s26.750261 2.354023 47.722466 33.170324c0 0 4.06604-65.270637 44.726437-85.386834 0 0 14.552142 49.006479-43.014421 92.876907-0.214002 0-36.594357-6.848067-49.434482-40.660397z" fill="#f1c54c" p-id="729"></path><path d="M1105.9628 176.551724s15.836155 31.886311 47.722466 33.170324c0 0 47.722466-41.730408 35.310345-89.880878 0 0-36.166353 26.322257-36.594357 83.032811-0.214002 0-15.836155-24.61024-46.438454-26.322257zM1081.35256 128.615256s9.20209 28.67628 50.076489 29.532288c0 0 38.520376-47.08046 20.972205-89.880877 0 0-29.104284 23.54023-24.182236 81.9628-0.214002-0.214002-20.544201-22.898224-46.866458-21.614211zM1052.890282 85.814838s14.980146 26.536259 47.936468 23.326228c0 0 37.664368-49.006479 15.194149-86.670847 0 0-27.392268 26.536259-17.33417 80.464786 0 0-19.902194-19.47419-45.796447-17.120167z" fill="#f1c54c" p-id="730"></path><path d="M1031.490073 53.500522s13.910136 25.894253 49.862487 21.186207c0 0 5.564054-39.804389-19.47419-52.21651 0 0-7.276071 20.544201 7.490073 41.302404-0.214002 0-12.198119-12.412121-37.87837-10.272101z" fill="#f1c54c" p-id="731"></path><path d="M1019.93396 24.824242s3.424033 24.182236 29.532289 22.042216c0 0-1.712017-20.116196-29.532289-22.042216z" fill="#f1c54c" p-id="732"></path></svg>`;
      } else if (ratingScore >= 5.0) {
        ratingContainer.setAttribute('data-score', 'good');
        const ratingBadge = ratingContainer.createDiv({ cls: 'simple-badge' });
        ratingBadge.createDiv({ cls: 'simple-score', text: data.rating });
        ratingBadge.innerHTML += `<svg t="1747995989766" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="1354" width="200" height="200"><path d="M0 870.4m32 0l960 0q32 0 32 32l0 0q0 32-32 32l-960 0q-32 0-32-32l0 0q0-32 32-32Z" p-id="1355" fill="#c0c0c0"></path><path d="M64 640m0 32l0 230.4q0 32-32 32l0 0q-32 0-32-32l0-230.4q0-32 32-32l0 0q32 0 32 32Z" p-id="1356" fill="#c0c0c0"></path><path d="M1024 640m0 32l0 230.4q0 32-32 32l0 0q-32 0-32-32l0-230.4q0-32 32-32l0 0q32 0 32 32Z" p-id="1357" fill="#c0c0c0"></path><path d="M358.4 960m32 0l230.4 0q32 0 32 32l0 0q0 32-32 32l-230.4 0q-32 0-32-32l0 0q0-32 32-32Z" p-id="1358" fill="#c0c0c0"></path></svg>`;


      } else {
        ratingContainer.setAttribute('data-score', 'poor');
        ratingContainer.createDiv({ text: data.rating });
      }
    }

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

    if (data.description) {
      // 判断是否为单行
      const isSingleLine = !data.description.includes('\n') && data.description.length > 0 && data.description.length < 60;
      const descEl = infoContainer.createEl('div', { text: data.description, cls: 'card-info-description' });
      if (isSingleLine) {
        descEl.addClass('single-line');
      }
    }

    // 添加标签和收录时间
    if ((data.tags && data.tags.length > 0) || data.collection_date) {
      const tagsContainer = infoContainer.createDiv({ cls: 'card-tags-container' });
      if (data.tags) {
        this.renderTags(data, tagsContainer);
      }
      if (data.collection_date) {
        tagsContainer.createDiv({ cls: 'collection-date', text: data.collection_date });
      }
    }
  }

  private extractCardsFromContent(content: string): string[] {
    const cards: string[] = [];
    const cardTypes = ['music-card', 'book-card', 'movie-card', 'tv-card', 'anime-card'];

    for (const type of cardTypes) {
      const regex = new RegExp('```' + type + '\\n([\\s\\S]*?)```', 'g');
      let match;
      while ((match = regex.exec(content)) !== null) {
        const cardContent = '```' + type + '\n' + match[1] + '```';
        const cid = CardUtils.generateCID(cardContent);
        cards.push(cid);
      }
    }

    return cards;
  }

  private async getCardsFromFile(location: CardLocation): Promise<string[]> {
    const index = await CardUtils.loadCardIndex(this.app.vault);
    const cards: string[] = [];

    for (const cid in index) {
      if (index[cid].locations.some(loc => loc.path === location.path)) {
        cards.push(cid);
      }
    }

    return cards;
  }

  private getCoverImageSrc(cover: string): string {


    // 处理外部链接
    if (cover.startsWith('http://') || cover.startsWith('https://')) {
      return cover;
    }

    // 处理内部链接 ![[filename]]
    const internalLinkMatch = cover.match(/!\[\[(.*?)(\|.*?)?\]\]/);
    if (internalLinkMatch && internalLinkMatch[1]) {
      let filename = internalLinkMatch[1].trim();

      // 获取当前文件所在的 vault
      const vault = this.app.vault;

      // 查找文件
      const file = vault.getAbstractFileByPath(filename) ||
        vault.getFiles().find(f => f.name === filename);

      if (file && file instanceof TFile) {
        const resourcePath = vault.getResourcePath(file as TFile);
        return resourcePath;
      }
    }
    return '';
  }

  onunload() {
    // 卸载视图
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_CARDS_GALLERY);
  }

  /**
   * 通用卡片URL点击跳转逻辑，供展播台等调用
   */
  public handleCardUrlClick(data: any, event?: MouseEvent) {
    if (!data || !data.url) return;
    if (event) event.stopPropagation();
    
    let url = data.url;
    
    // 如果URL被[[ ]]包裹，去掉括号
    const match = url.match(/^\[\[(.*)\]\]$/);
    if (match) {
      url = match[1];
    }
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
      window.open(url);
    } else if (url.startsWith('obsidian://')) {
      if (url.startsWith('obsidian://open')) {
        try {
          const u = new URL(url);
          const file = decodeURIComponent(u.searchParams.get('file') || '');
          this.openInternalLinkSmart(file);
        } catch (e) {
          // 解析失败，回退到默认处理
        }
      } else {
        // 对于其他 obsidian:// 协议（如 obsidian://pdf-plus），尝试提取 file 参数并智能打开
        try {
          const u = new URL(url);
          const file = u.searchParams.get('file');
          if (file) {
            // 有 file 参数，尝试用内部链接方式打开（可复用已打开的叶子）
            const decodedFile = decodeURIComponent(file);
            // 将其他参数（如 page, selection 等）组装为子路径
            const params: string[] = [];
            u.searchParams.forEach((v, k) => {
              if (k !== 'file' && k !== 'vault') {
                params.push(`${k}=${v}`);
              }
            });
            const subpath = params.length > 0 ? '#' + params.join('&') : '';
            this.openInternalLinkSmart(decodedFile + subpath);
          } else {
            // 没有 file 参数，回退到让 Obsidian 处理
            window.open(url);
          }
        } catch (e) {
          window.open(url);
        }
      }
    } else if (url.startsWith('file:///')) {
      try {
        let filePath = url;
        if (filePath.includes('%')) {
          try { filePath = decodeURIComponent(filePath); } catch { }
        }
        if (process.platform === 'win32') {
          filePath = filePath.replace('file:///', '');
        } else {
          filePath = filePath.replace('file:///', 'file://');
        }
        // @ts-ignore
        const { shell } = require('electron');
        shell.openPath(filePath)
          .then((error: string) => {
            if (error) {
              new Notice(`打开文件失败: ${error}`);
              return shell.openExternal(url);
            } else {
              new Notice('正在打开本地文件...');
            }
          })
          .catch(() => shell.openExternal(url));
      } catch (error) {
        new Notice('打开本地文件失败');
        navigator.clipboard.writeText(url).then(() => new Notice('已复制文件路径到剪贴板'));
      }
    } else {
      // 内部链接（包括 .pdf#page=1&selection=...）
      this.openInternalLinkSmart(url);
    }
  }

  /**
   * 智能打开内部链接：优先复用已打开的叶子，避免重复打开新窗口
   * 支持带 #page=N&selection=... 子路径的 PDF 链接
   */
  private openInternalLinkSmart(linkText: string) {
    const hashIdx = linkText.indexOf('#');
    const filePath = hashIdx >= 0 ? linkText.substring(0, hashIdx) : linkText;
    
    // 解析文件路径，找到对应的 TFile
    const resolvedFile = this.app.metadataCache.getFirstLinkpathDest(filePath, '');
    
    if (resolvedFile) {
      // 查找是否已有打开此文件的叶子
      let existingLeaf: any = null;
      this.app.workspace.iterateAllLeaves((leaf: any) => {
        const viewFile = leaf.view?.file;
        if (viewFile && viewFile.path === resolvedFile.path) {
          existingLeaf = leaf;
        }
      });
      
      if (existingLeaf) {
        // 已有打开的叶子，激活它并导航到子路径
        this.app.workspace.setActiveLeaf(existingLeaf, { focus: true });
        // 用 openLinkText 在当前活跃叶子中导航到具体位置
        this.app.workspace.openLinkText(linkText, '', false);
      } else {
        // 没有已打开的叶子，在新标签页中打开（不是新窗口）
        this.app.workspace.openLinkText(linkText, '', false);
      }
    } else {
      // 文件未找到，尝试直接打开
      this.app.workspace.openLinkText(linkText, '', false);
    }
  }

  /**
   * 打开笔记并滚动到指定行
   */
  public async scrollToLineInFile(path: string, line: number) {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!file || !(file instanceof TFile)) return;
    // 打开文件（优先编辑模式）
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file, { active: true, state: { mode: 'source' } });
    // 定位到指定行
    setTimeout(() => {
      const view = leaf.view;
      // @ts-ignore
      const editor = view && view.editor;
      if (editor && typeof editor.setCursor === 'function') {
        editor.setCursor({ line, ch: 0 });
      }
    }, 300);
  }
}