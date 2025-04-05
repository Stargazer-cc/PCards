import { Plugin, MarkdownPostProcessorContext, TFile, TAbstractFile, Modal, Setting, Menu, addIcon, PluginSettingTab, App } from 'obsidian';
import type { MenuItem } from 'obsidian';
import { CardUtils } from './utils';
import type { CardLocation } from './utils';
import { CardsGalleryView, VIEW_TYPE_CARDS_GALLERY } from './views/CardsGalleryView';

// 添加布局网格图标
addIcon('layout-grid', `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`);

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
}

interface BookCardData extends CardData {
  author: string;
}

interface MovieCardData extends CardData {
  director: string;
}

interface GallerySettings {
  columnCount: number;
  hiddenFields: string[];
  selectedCardType: string;
  sortField: string;
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
}

interface NewCardsPluginSettings {
  gallerySettings: GallerySettings;
  cardTemplates: {
    musicCard: string;
    bookCard: string;
    movieCard: string;
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
}

const DEFAULT_SETTINGS: NewCardsPluginSettings = {
  gallerySettings: {
    columnCount: 3,
    hiddenFields: [],
    selectedCardType: 'all',
    sortField: 'year'
  },
  cardTemplates: {
    musicCard: '```music-card\ntitle: \nyear: \nartist: \ndescription: \nrating: \n```',
    bookCard: '```book-card\ntitle: \nyear: \nauthor: \ndescription: \nrating: \n```',
    movieCard: '```movie-card\ntitle: \nyear: \ndirector: \ndescription: \nrating: \n```'
  },
  textColors: {
    title: 'rgb(91, 136, 241)',
    description: 'rgb(245, 216, 179)',
    artist: 'rgb(211, 171, 120)',
    author: 'rgb(211, 171, 120)',
    director: 'rgb(211, 171, 120)',
    year: 'rgb(245, 216, 179)',
    meta: 'rgb(245, 216, 179)'
  }
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
    const {containerEl} = this;

    containerEl.empty();

    // 添加文字颜色设置
    containerEl.createEl('h3', {text: '文字颜色设置'});

    new Setting(containerEl)
      .setName('标题颜色')
      .addColorPicker(color => color
        .setValue(this.plugin.settings.textColors.title)
        .onChange(async (value) => {
          this.plugin.settings.textColors.title = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('描述文字颜色')
      .addColorPicker(color => color
        .setValue(this.plugin.settings.textColors.description)
        .onChange(async (value) => {
          this.plugin.settings.textColors.description = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('作者/艺术家/导演颜色')
      .addColorPicker(color => color
        .setValue(this.plugin.settings.textColors.author)
        .onChange(async (value) => {
          this.plugin.settings.textColors.author = value;
          this.plugin.settings.textColors.artist = value;
          this.plugin.settings.textColors.director = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('年份颜色')
      .addColorPicker(color => color
        .setValue(this.plugin.settings.textColors.year)
        .onChange(async (value) => {
          this.plugin.settings.textColors.year = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('元数据颜色')
      .addColorPicker(color => color
        .setValue(this.plugin.settings.textColors.meta)
        .onChange(async (value) => {
          this.plugin.settings.textColors.meta = value;
          await this.plugin.saveSettings();
        }));

    containerEl.createEl('h3', {text: '卡片模板设置（务必保证代码左对齐）'});

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
  }
}

export default class NewCardsPlugin extends Plugin {
  public settings: NewCardsPluginSettings;

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
      badge.innerHTML = `<svg t="1743841440004" class="icon" viewBox="0 0 1332 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5351" width="200" height="200"><path d="M754.999373 984.409613s-40.018391-7.918077-58.42257-18.618181c-18.618182-10.700104-120.483177-56.28255-189.39185-12.840126 0 0-28.462278 24.182236-57.35256 27.178266 0 0 36.808359 13.482132 74.900731 2.782027 0 0 32.528318-9.20209 50.932498-22.47022 0 0 40.660397-17.976176 78.538767 0.214002 37.87837 18.190178 33.170324 23.326228 64.842633 28.248276 31.672309 5.13605 35.952351-4.494044 35.952351-4.494044zM509.324974 912.076907s-16.692163-47.722466-74.472727-62.060606c0 0 9.20209 41.730408 56.068547 57.780564 0 0-93.732915 1.498015-130.11327 54.784535-0.214002 0 75.75674 29.960293 148.51745-50.504493z" fill="#B68A11" p-id="5352"></path><path d="M413.66604 896.454754s-3.638036-50.504493-55.640544-79.608777c0 0-2.140021 42.800418 38.734379 70.406688 0 0-90.950888-23.326228-139.957367 18.618181 0.214002 0 65.484639 49.006479 156.863532-9.416092z" fill="#B68A11" p-id="5353"></path><path d="M312.229049 767.411494s27.820272 47.294462-2.782027 98.440962c0 0-93.304911 28.67628-153.011494-39.590387 0 0 75.114734-24.824242 148.089446 35.096343 0.214002 0-22.042215-53.928527 7.704075-93.946918z" fill="#B68A11" p-id="5354"></path><path d="M252.308464 796.301776s-16.692163-53.28652 11.770115-84.102821c0 0 26.964263 48.792476-9.630094 91.16489 0 0-101.436991 19.902194-139.957367-49.862487 0 0.428004 61.632602-19.902194 137.817346 42.800418z" fill="#B68A11" p-id="5355"></path><path d="M202.873981 729.961129s-9.844096-47.936468 19.046186-78.966772c0 0 23.754232 43.656426-15.194148 87.954859 0 0-106.787043-2.354023-128.401254-60.990595-0.214002 0.214002 81.748798-3.852038 124.549216 52.002508z" fill="#B68A11" p-id="5356"></path><path d="M189.177847 585.081714s13.482132 52.644514-24.182236 81.106792c0 0-87.740857 2.354023-115.77513-67.410659 0 0 75.114734 2.140021 112.993103 60.990596 0 0-2.140021-51.360502 26.964263-74.686729z" fill="#B68A11" p-id="5357"></path><path d="M161.143574 519.811076s12.412121 43.442424-26.536259 73.616719c0 0-84.316823-4.494044-105.931035-70.406687 0 0 66.340648 2.782027 101.650993 64.842633 0-0.214002-2.782027-38.94838 30.816301-68.052665z" fill="#B68A11" p-id="5358"></path><path d="M151.085475 456.466458s6.206061 35.096343-33.81233 69.336677c0 0-82.176803-22.470219-92.876907-78.324765 0 0 70.192685 14.980146 91.806897 73.616719 0.214002-0.214002-2.568025-36.808359 34.88234-64.628631z" fill="#B68A11" p-id="5359"></path><path d="M147.875444 398.899896s2.354023 39.162382-40.232393 57.780564c0 0-79.394775-35.952351-76.184744-85.600836 0 0 48.15047 4.494044 76.184744 80.464786 0.214002 0 9.20209-38.306374 40.232393-52.644514z" fill="#B68A11" p-id="5360"></path><path d="M154.723511 340.049321s-6.206061 35.310345-46.010449 50.932497c0 0-66.982654-43.442424-61.632602-91.806896 0 0 54.142529 24.824242 61.846604 85.814838 0 0 7.918077-24.396238 45.796447-44.940439zM166.493626 281.198746s-4.06604 33.384326-46.224451 44.512435c0 0-55.854545-25.680251-52.644515-91.592895 0 0 48.578474 24.61024 53.286521 86.242843-0.214002 0 16.906165-37.236364 45.582445-39.162383zM185.753814 225.986207s-26.750261 2.354023-47.722466 33.170324c0 0-4.06604-65.270637-44.726437-85.386834 0 0-14.552142 49.006479 43.01442 92.876907 0.214002 0 36.594357-6.848067 49.434483-40.660397z" fill="#B68A11" p-id="5361"></path><path d="M205.442006 176.551724S189.605852 208.438036 157.71954 209.722048c0 0-47.722466-41.730408-35.310345-89.880878 0 0 36.166353 26.322257 36.594358 83.032811 0.214002 0 15.622153-24.61024 46.438453-26.322257zM230.052247 128.615256s-9.20209 28.67628-50.076489 29.532288c0 0-38.520376-47.08046-20.972205-89.880877 0 0 29.104284 23.54023 24.182236 81.9628 0-0.214002 20.330199-22.898224 46.866458-21.614211zM258.514525 85.814838s-14.980146 26.536259-47.936469 23.326228c0 0-37.664368-49.006479-15.194148-86.670847 0 0 27.392268 26.536259 17.334169 80.464786 0 0 19.688192-19.47419 45.796448-17.120167z" fill="#B68A11" p-id="5362"></path><path d="M279.914734 53.500522s-13.910136 25.894253-49.648485 21.186207c0 0-5.564054-39.804389 19.47419-52.21651 0 0 7.276071 20.544201-7.490073 41.302404-0.214002 0 11.984117-12.412121 37.664368-10.272101z" fill="#B68A11" p-id="5363"></path><path d="M291.256844 24.824242s-3.424033 24.182236-29.318286 22.042216c0 0 1.498015-20.116196 29.318286-22.042216z" fill="#B68A11" p-id="5364"></path><path d="M556.405434 984.409613s40.018391-7.918077 58.42257-18.618181 120.483177-56.28255 189.39185-12.840126c0 0 28.462278 24.182236 57.35256 27.178266 0 0-36.808359 13.482132-74.900732 2.782027 0 0-32.528318-9.20209-50.932497-22.47022 0 0-40.660397-17.976176-78.538767 0.214002-37.87837 18.190178-33.170324 23.326228-64.842633 28.248276C560.685475 994.039707 556.405434 984.409613 556.405434 984.409613zM802.079833 912.076907s16.692163-47.722466 74.472727-62.060606c0 0-9.20209 41.730408-56.068547 57.780564 0 0 93.732915 1.498015 130.11327 54.784535 0.214002 0-75.75674 29.960293-148.51745-50.504493z" fill="#B68A11" p-id="5365"></path><path d="M897.738767 896.454754s3.638036-50.504493 55.640543-79.608777c0 0 2.140021 42.800418-38.734378 70.406688 0 0 90.950888-23.326228 139.957367 18.618181-0.214002 0-65.484639 49.006479-156.863532-9.416092z" fill="#B68A11" p-id="5366"></path><path d="M999.175758 767.411494s-27.820272 47.294462 2.782027 98.440962c0 0 93.304911 28.67628 153.011494-39.590387 0 0-75.114734-24.824242-148.303448 35.096343 0 0 22.256217-53.928527-7.490073-93.946918z" fill="#B68A11" p-id="5367"></path><path d="M1059.096343 796.301776s16.692163-53.28652-11.770115-84.102821c0 0-26.964263 48.792476 9.630094 91.16489 0 0 101.436991 19.902194 139.957367-49.862487 0 0.428004-61.632602-19.902194-137.817346 42.800418z" fill="#B68A11" p-id="5368"></path><path d="M1108.530825 729.961129s9.844096-47.936468-19.046186-78.966772c0 0-23.754232 43.656426 15.194149 87.954859 0 0 106.787043-2.354023 128.401254-60.990595 0.214002 0.214002-81.748798-3.852038-124.549217 52.002508z" fill="#B68A11" p-id="5369"></path><path d="M1122.226959 585.081714s-13.482132 52.644514 24.182236 81.106792c0 0 87.740857 2.354023 115.775131-67.410659 0 0-75.114734 2.140021-112.993103 60.990596 0 0 2.140021-51.360502-26.964264-74.686729z" fill="#B68A11" p-id="5370"></path><path d="M1150.261233 519.811076s-12.412121 43.442424 26.536259 73.616719c0 0 84.316823-4.494044 105.931035-70.406687 0 0-66.340648 2.782027-101.650993 64.842633 0-0.214002 2.568025-38.94838-30.816301-68.052665z" fill="#B68A11" p-id="5371"></path><path d="M1160.105329 456.466458s-6.206061 35.096343 33.81233 69.336677c0 0 82.176803-22.470219 92.876907-78.324765 0 0-70.192685 14.980146-91.806896 73.616719 0-0.214002 2.568025-36.808359-34.882341-64.628631z" fill="#B68A11" p-id="5372"></path><path d="M1163.315361 398.899896s-2.354023 39.162382 40.232392 57.780564c0 0 79.394775-35.952351 76.184744-85.600836 0 0-48.15047 4.494044-76.184744 80.464786 0 0-9.20209-38.306374-40.232392-52.644514z" fill="#B68A11" p-id="5373"></path><path d="M1156.681296 340.049321s6.206061 35.310345 46.010449 50.932497c0 0 66.982654-43.442424 61.632602-91.806896 0 0-54.142529 24.824242-61.846604 85.814838 0 0-8.132079-24.396238-45.796447-44.940439zM1144.911181 281.198746s4.06604 33.384326 46.224451 44.512435c0 0 55.854545-25.680251 52.644514-91.592895 0 0-48.578474 24.61024-53.28652 86.242843 0.214002 0-16.906165-37.236364-45.582445-39.162383zM1125.650993 225.986207s26.750261 2.354023 47.722466 33.170324c0 0 4.06604-65.270637 44.726437-85.386834 0 0 14.552142 49.006479-43.014421 92.876907-0.214002 0-36.594357-6.848067-49.434482-40.660397z" fill="#B68A11" p-id="5374"></path><path d="M1105.9628 176.551724s15.836155 31.886311 47.722466 33.170324c0 0 47.722466-41.730408 35.310345-89.880878 0 0-36.166353 26.322257-36.594357 83.032811-0.214002 0-15.836155-24.61024-46.438454-26.322257zM1081.35256 128.615256s9.20209 28.67628 50.076489 29.532288c0 0 38.520376-47.08046 20.972205-89.880877 0 0-29.104284 23.54023-24.182236 81.9628-0.214002-0.214002-20.544201-22.898224-46.866458-21.614211zM1052.890282 85.814838s14.980146 26.536259 47.936468 23.326228c0 0 37.664368-49.006479 15.194149-86.670847 0 0-27.392268 26.536259-17.33417 80.464786 0 0-19.902194-19.47419-45.796447-17.120167z" fill="#B68A11" p-id="5375"></path><path d="M1031.490073 53.500522s13.910136 25.894253 49.862487 21.186207c0 0 5.564054-39.804389-19.47419-52.21651 0 0-7.276071 20.544201 7.490073 41.302404-0.214002 0-12.198119-12.412121-37.87837-10.272101z" fill="#B68A11" p-id="5376"></path><path d="M1019.93396 24.824242s3.424033 24.182236 29.532289 22.042216c0 0-1.712017-20.116196-29.532289-22.042216z" fill="#B68A11" p-id="5377"></path></svg>`;
      badge.createSpan({ text: rating });
    } else {
      ratingContainer.setAttribute('data-score', 'good');
      const simpleBadge = ratingContainer.createDiv({ cls: 'simple-badge' });
      simpleBadge.createSpan({ text: rating });
    }
  }


  private view: CardsGalleryView;

  async onload() {
    await this.loadSettings();

    // 添加设置页面
    this.addSettingTab(new NewCardsSettingTab(this.app, this));

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
        if (file instanceof TFile) {
          const content = await this.app.vault.read(file);
          const lines = content.split('\n');
          let currentLine = 0;
          
          // 使用栈来跟踪代码块嵌套
          interface CodeBlockState {
            type: string;
            startLine: number;
            content: string[];
          }
          const blockStack: CodeBlockState[] = [];
          
          while (currentLine < lines.length) {
            const line = lines[currentLine].trim();
            
            // 检查是否进入或离开代码块
            if (line.startsWith('```')) {
              // 检查是否是卡片代码块的开始
              const cardTypes = ['music-card', 'book-card', 'movie-card'];
              const isCardStart = cardTypes.some(type => line === '```' + type);
              
              if (isCardStart) {
                // 进入新代码块
                const blockType = line.substring(3);
                blockStack.push({
                  type: blockType,
                  startLine: currentLine,
                  content: []
                });
              } else if (line === '```') {
                // 结束当前代码块
                if (blockStack.length > 0) {
                  const currentBlock = blockStack.pop()!;
                  const fullContent = '```' + currentBlock.type + '\n' + currentBlock.content.join('\n') + '\n```';
                  // 先尝试查找是否存在相同内容的卡片
                  const existingCID = await CardUtils.findCIDByContent(this.app.vault, fullContent);
                  const cid = existingCID || CardUtils.generateCID(fullContent);
                  const newCID = await CardUtils.updateCardIndex(this.app.vault, cid, fullContent, {
                    path: file.path,
                    startLine: currentBlock.startLine,
                    endLine: currentLine
                  });
                  // 如果返回的CID与原CID不同，说明内容已更新到现有卡片
                  if (newCID !== cid) {
                    console.log(`Card content merged with existing card: ${newCID}`);
                  }
                }
              }
            } else if (blockStack.length > 0) {
              // 如果在卡片代码块内，添加内容
              blockStack[blockStack.length - 1].content.push(lines[currentLine]);
            }
            currentLine++;
          }
          
          // 处理未正确关闭的代码块
          while (blockStack.length > 0) {
            const unclosedBlock = blockStack.pop()!;
            const fullContent = '```' + unclosedBlock.type + '\n' + unclosedBlock.content.join('\n') + '\n```';
            const cid = await CardUtils.findCIDByContent(this.app.vault, fullContent) || CardUtils.generateCID(fullContent);
            await CardUtils.updateCardIndex(this.app.vault, cid, fullContent, {
              path: file.path,
              startLine: unclosedBlock.startLine,
              endLine: lines.length - 1
            });
          }
        }
      })
    );

    // 注册卡片总览视图
    this.registerView(
      VIEW_TYPE_CARDS_GALLERY,
      (leaf) => (this.view = new CardsGalleryView(leaf, this))
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
          const cardTypes = ['music-card', 'book-card', 'movie-card'];
          
          // 使用栈来跟踪代码块嵌套
          const blockStack: {type: string, startLine: number, content: string[]}[] = [];
          
          while (currentLine < lines.length) {
            const line = lines[currentLine].trim();
            
            if (line.startsWith('```')) {
              const blockType = line.substring(3).trim();
              if (cardTypes.includes(blockType)) {
                // 进入卡片代码块
                blockStack.push({type: blockType, startLine: currentLine, content: [line]});
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
                      if (isInCodeBlock) {
                        const lines = content.split('\n');
                        const firstLine = '   ' + lines[0];
                        const otherLines = lines.slice(1).map(line => '    ' + line);
                        editor.replaceRange([firstLine, ...otherLines].join('\n') + '\n', cursor);
                      } else {
                        editor.replaceRange(content + '\n', cursor);
                      }
                      const currentFile = this.app.workspace.getActiveFile();
                      if (currentFile) {
                        const startLine = cursor.line;
                        const endLine = startLine + content.split('\n').length - 1;
                        await CardUtils.updateCardIndex(this.app.vault, cid, content, { path: currentFile.path, startLine, endLine });
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
                  if (isInCodeBlock) {
                    const lines = this.settings.cardTemplates.musicCard.split('\n');
                    const firstLine = '   ' + lines[0];
                    const otherLines = lines.slice(1).map(line => '    ' + line);
                    editor.replaceRange('\n' + [firstLine, ...otherLines].join('\n') + '\n', cursor);
                  } else {
                    editor.replaceRange(this.settings.cardTemplates.musicCard + '\n', cursor);
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
                  if (isInCodeBlock) {
                    const lines = this.settings.cardTemplates.bookCard.split('\n');
                    const firstLine = '   ' + lines[0];
                    const otherLines = lines.slice(1).map(line => '    ' + line);
                    editor.replaceRange('\n' + [firstLine, ...otherLines].join('\n') + '\n', cursor);
                  } else {
                    editor.replaceRange(this.settings.cardTemplates.bookCard + '\n', cursor);
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
                  if (isInCodeBlock) {
                    const lines = this.settings.cardTemplates.movieCard.split('\n');
                    const firstLine = '   ' + lines[0];
                    const otherLines = lines.slice(1).map(line => '    ' + line);
                    editor.replaceRange('\n' + [firstLine, ...otherLines].join('\n') + '\n', cursor);
                  } else {
                    editor.replaceRange(this.settings.cardTemplates.movieCard + '\n', cursor);
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
  }

  public parseYaml(source: string): any {
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
    
    if (data.year) {
      infoContainer.createEl('div', { text: data.year, cls: 'year' });
    }
    
    if (data.description) {
      infoContainer.createEl('div', { text: data.description, cls: 'card-info-description' });
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
         <svg t="1743841440004" class="icon" viewBox="0 0 1332 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5351" width="200" height="200"><path d="M754.999373 984.409613s-40.018391-7.918077-58.42257-18.618181c-18.618182-10.700104-120.483177-56.28255-189.39185-12.840126 0 0-28.462278 24.182236-57.35256 27.178266 0 0 36.808359 13.482132 74.900731 2.782027 0 0 32.528318-9.20209 50.932498-22.47022 0 0 40.660397-17.976176 78.538767 0.214002 37.87837 18.190178 33.170324 23.326228 64.842633 28.248276 31.672309 5.13605 35.952351-4.494044 35.952351-4.494044zM509.324974 912.076907s-16.692163-47.722466-74.472727-62.060606c0 0 9.20209 41.730408 56.068547 57.780564 0 0-93.732915 1.498015-130.11327 54.784535-0.214002 0 75.75674 29.960293 148.51745-50.504493z" fill="#B68A11" p-id="5352"></path><path d="M413.66604 896.454754s-3.638036-50.504493-55.640544-79.608777c0 0-2.140021 42.800418 38.734379 70.406688 0 0-90.950888-23.326228-139.957367 18.618181 0.214002 0 65.484639 49.006479 156.863532-9.416092z" fill="#B68A11" p-id="5353"></path><path d="M312.229049 767.411494s27.820272 47.294462-2.782027 98.440962c0 0-93.304911 28.67628-153.011494-39.590387 0 0 75.114734-24.824242 148.089446 35.096343 0.214002 0-22.042215-53.928527 7.704075-93.946918z" fill="#B68A11" p-id="5354"></path><path d="M252.308464 796.301776s-16.692163-53.28652 11.770115-84.102821c0 0 26.964263 48.792476-9.630094 91.16489 0 0-101.436991 19.902194-139.957367-49.862487 0 0.428004 61.632602-19.902194 137.817346 42.800418z" fill="#B68A11" p-id="5355"></path><path d="M202.873981 729.961129s-9.844096-47.936468 19.046186-78.966772c0 0 23.754232 43.656426-15.194148 87.954859 0 0-106.787043-2.354023-128.401254-60.990595-0.214002 0.214002 81.748798-3.852038 124.549216 52.002508z" fill="#B68A11" p-id="5356"></path><path d="M189.177847 585.081714s13.482132 52.644514-24.182236 81.106792c0 0-87.740857 2.354023-115.77513-67.410659 0 0 75.114734 2.140021 112.993103 60.990596 0 0-2.140021-51.360502 26.964263-74.686729z" fill="#B68A11" p-id="5357"></path><path d="M161.143574 519.811076s12.412121 43.442424-26.536259 73.616719c0 0-84.316823-4.494044-105.931035-70.406687 0 0 66.340648 2.782027 101.650993 64.842633 0-0.214002-2.782027-38.94838 30.816301-68.052665z" fill="#B68A11" p-id="5358"></path><path d="M151.085475 456.466458s6.206061 35.096343-33.81233 69.336677c0 0-82.176803-22.470219-92.876907-78.324765 0 0 70.192685 14.980146 91.806897 73.616719 0.214002-0.214002-2.568025-36.808359 34.88234-64.628631z" fill="#B68A11" p-id="5359"></path><path d="M147.875444 398.899896s2.354023 39.162382-40.232393 57.780564c0 0-79.394775-35.952351-76.184744-85.600836 0 0 48.15047 4.494044 76.184744 80.464786 0.214002 0 9.20209-38.306374 40.232393-52.644514z" fill="#B68A11" p-id="5360"></path><path d="M154.723511 340.049321s-6.206061 35.310345-46.010449 50.932497c0 0-66.982654-43.442424-61.632602-91.806896 0 0 54.142529 24.824242 61.846604 85.814838 0 0 7.918077-24.396238 45.796447-44.940439zM166.493626 281.198746s-4.06604 33.384326-46.224451 44.512435c0 0-55.854545-25.680251-52.644515-91.592895 0 0 48.578474 24.61024 53.286521 86.242843-0.214002 0 16.906165-37.236364 45.582445-39.162383zM185.753814 225.986207s-26.750261 2.354023-47.722466 33.170324c0 0-4.06604-65.270637-44.726437-85.386834 0 0-14.552142 49.006479 43.01442 92.876907 0.214002 0 36.594357-6.848067 49.434483-40.660397z" fill="#B68A11" p-id="5361"></path><path d="M205.442006 176.551724S189.605852 208.438036 157.71954 209.722048c0 0-47.722466-41.730408-35.310345-89.880878 0 0 36.166353 26.322257 36.594358 83.032811 0.214002 0 15.622153-24.61024 46.438453-26.322257zM230.052247 128.615256s-9.20209 28.67628-50.076489 29.532288c0 0-38.520376-47.08046-20.972205-89.880877 0 0 29.104284 23.54023 24.182236 81.9628 0-0.214002 20.330199-22.898224 46.866458-21.614211zM258.514525 85.814838s-14.980146 26.536259-47.936469 23.326228c0 0-37.664368-49.006479-15.194148-86.670847 0 0 27.392268 26.536259 17.334169 80.464786 0 0 19.688192-19.47419 45.796448-17.120167z" fill="#B68A11" p-id="5362"></path><path d="M279.914734 53.500522s-13.910136 25.894253-49.648485 21.186207c0 0-5.564054-39.804389 19.47419-52.21651 0 0 7.276071 20.544201-7.490073 41.302404-0.214002 0 11.984117-12.412121 37.664368-10.272101z" fill="#B68A11" p-id="5363"></path><path d="M291.256844 24.824242s-3.424033 24.182236-29.318286 22.042216c0 0 1.498015-20.116196 29.318286-22.042216z" fill="#B68A11" p-id="5364"></path><path d="M556.405434 984.409613s40.018391-7.918077 58.42257-18.618181 120.483177-56.28255 189.39185-12.840126c0 0 28.462278 24.182236 57.35256 27.178266 0 0-36.808359 13.482132-74.900732 2.782027 0 0-32.528318-9.20209-50.932497-22.47022 0 0-40.660397-17.976176-78.538767 0.214002-37.87837 18.190178-33.170324 23.326228-64.842633 28.248276C560.685475 994.039707 556.405434 984.409613 556.405434 984.409613zM802.079833 912.076907s16.692163-47.722466 74.472727-62.060606c0 0-9.20209 41.730408-56.068547 57.780564 0 0 93.732915 1.498015 130.11327 54.784535 0.214002 0-75.75674 29.960293-148.51745-50.504493z" fill="#B68A11" p-id="5365"></path><path d="M897.738767 896.454754s3.638036-50.504493 55.640543-79.608777c0 0 2.140021 42.800418-38.734378 70.406688 0 0 90.950888-23.326228 139.957367 18.618181-0.214002 0-65.484639 49.006479-156.863532-9.416092z" fill="#B68A11" p-id="5366"></path><path d="M999.175758 767.411494s-27.820272 47.294462 2.782027 98.440962c0 0 93.304911 28.67628 153.011494-39.590387 0 0-75.114734-24.824242-148.303448 35.096343 0 0 22.256217-53.928527-7.490073-93.946918z" fill="#B68A11" p-id="5367"></path><path d="M1059.096343 796.301776s16.692163-53.28652-11.770115-84.102821c0 0-26.964263 48.792476 9.630094 91.16489 0 0 101.436991 19.902194 139.957367-49.862487 0 0.428004-61.632602-19.902194-137.817346 42.800418z" fill="#B68A11" p-id="5368"></path><path d="M1108.530825 729.961129s9.844096-47.936468-19.046186-78.966772c0 0-23.754232 43.656426 15.194149 87.954859 0 0 106.787043-2.354023 128.401254-60.990595 0.214002 0.214002-81.748798-3.852038-124.549217 52.002508z" fill="#B68A11" p-id="5369"></path><path d="M1122.226959 585.081714s-13.482132 52.644514 24.182236 81.106792c0 0 87.740857 2.354023 115.775131-67.410659 0 0-75.114734 2.140021-112.993103 60.990596 0 0 2.140021-51.360502-26.964264-74.686729z" fill="#B68A11" p-id="5370"></path><path d="M1150.261233 519.811076s-12.412121 43.442424 26.536259 73.616719c0 0 84.316823-4.494044 105.931035-70.406687 0 0-66.340648 2.782027-101.650993 64.842633 0-0.214002 2.568025-38.94838-30.816301-68.052665z" fill="#B68A11" p-id="5371"></path><path d="M1160.105329 456.466458s-6.206061 35.096343 33.81233 69.336677c0 0 82.176803-22.470219 92.876907-78.324765 0 0-70.192685 14.980146-91.806896 73.616719 0-0.214002 2.568025-36.808359-34.882341-64.628631z" fill="#B68A11" p-id="5372"></path><path d="M1163.315361 398.899896s-2.354023 39.162382 40.232392 57.780564c0 0 79.394775-35.952351 76.184744-85.600836 0 0-48.15047 4.494044-76.184744 80.464786 0 0-9.20209-38.306374-40.232392-52.644514z" fill="#B68A11" p-id="5373"></path><path d="M1156.681296 340.049321s6.206061 35.310345 46.010449 50.932497c0 0 66.982654-43.442424 61.632602-91.806896 0 0-54.142529 24.824242-61.846604 85.814838 0 0-8.132079-24.396238-45.796447-44.940439zM1144.911181 281.198746s4.06604 33.384326 46.224451 44.512435c0 0 55.854545-25.680251 52.644514-91.592895 0 0-48.578474 24.61024-53.28652 86.242843 0.214002 0-16.906165-37.236364-45.582445-39.162383zM1125.650993 225.986207s26.750261 2.354023 47.722466 33.170324c0 0 4.06604-65.270637 44.726437-85.386834 0 0 14.552142 49.006479-43.014421 92.876907-0.214002 0-36.594357-6.848067-49.434482-40.660397z" fill="#B68A11" p-id="5374"></path><path d="M1105.9628 176.551724s15.836155 31.886311 47.722466 33.170324c0 0 47.722466-41.730408 35.310345-89.880878 0 0-36.166353 26.322257-36.594357 83.032811-0.214002 0-15.836155-24.61024-46.438454-26.322257zM1081.35256 128.615256s9.20209 28.67628 50.076489 29.532288c0 0 38.520376-47.08046 20.972205-89.880877 0 0-29.104284 23.54023-24.182236 81.9628-0.214002-0.214002-20.544201-22.898224-46.866458-21.614211zM1052.890282 85.814838s14.980146 26.536259 47.936468 23.326228c0 0 37.664368-49.006479 15.194149-86.670847 0 0-27.392268 26.536259-17.33417 80.464786 0 0-19.902194-19.47419-45.796447-17.120167z" fill="#B68A11" p-id="5375"></path><path d="M1031.490073 53.500522s13.910136 25.894253 49.862487 21.186207c0 0 5.564054-39.804389-19.47419-52.21651 0 0-7.276071 20.544201 7.490073 41.302404-0.214002 0-12.198119-12.412121-37.87837-10.272101z" fill="#B68A11" p-id="5376"></path><path d="M1019.93396 24.824242s3.424033 24.182236 29.532289 22.042216c0 0-1.712017-20.116196-29.532289-22.042216z" fill="#B68A11" p-id="5377"></path></svg>
        `;
      } else if (ratingScore >= 5.0) {
        ratingContainer.setAttribute('data-score', 'good');
        const simpleBadge = ratingContainer.createDiv({ cls: 'simple-badge' });
        simpleBadge.createDiv({text: data.rating });
        
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
          <svg t="1743841440004" class="icon" viewBox="0 0 1332 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5351" width="200" height="200"><path d="M754.999373 984.409613s-40.018391-7.918077-58.42257-18.618181c-18.618182-10.700104-120.483177-56.28255-189.39185-12.840126 0 0-28.462278 24.182236-57.35256 27.178266 0 0 36.808359 13.482132 74.900731 2.782027 0 0 32.528318-9.20209 50.932498-22.47022 0 0 40.660397-17.976176 78.538767 0.214002 37.87837 18.190178 33.170324 23.326228 64.842633 28.248276 31.672309 5.13605 35.952351-4.494044 35.952351-4.494044zM509.324974 912.076907s-16.692163-47.722466-74.472727-62.060606c0 0 9.20209 41.730408 56.068547 57.780564 0 0-93.732915 1.498015-130.11327 54.784535-0.214002 0 75.75674 29.960293 148.51745-50.504493z" fill="#B68A11" p-id="5352"></path><path d="M413.66604 896.454754s-3.638036-50.504493-55.640544-79.608777c0 0-2.140021 42.800418 38.734379 70.406688 0 0-90.950888-23.326228-139.957367 18.618181 0.214002 0 65.484639 49.006479 156.863532-9.416092z" fill="#B68A11" p-id="5353"></path><path d="M312.229049 767.411494s27.820272 47.294462-2.782027 98.440962c0 0-93.304911 28.67628-153.011494-39.590387 0 0 75.114734-24.824242 148.089446 35.096343 0.214002 0-22.042215-53.928527 7.704075-93.946918z" fill="#B68A11" p-id="5354"></path><path d="M252.308464 796.301776s-16.692163-53.28652 11.770115-84.102821c0 0 26.964263 48.792476-9.630094 91.16489 0 0-101.436991 19.902194-139.957367-49.862487 0 0.428004 61.632602-19.902194 137.817346 42.800418z" fill="#B68A11" p-id="5355"></path><path d="M202.873981 729.961129s-9.844096-47.936468 19.046186-78.966772c0 0 23.754232 43.656426-15.194148 87.954859 0 0-106.787043-2.354023-128.401254-60.990595-0.214002 0.214002 81.748798-3.852038 124.549216 52.002508z" fill="#B68A11" p-id="5356"></path><path d="M189.177847 585.081714s13.482132 52.644514-24.182236 81.106792c0 0-87.740857 2.354023-115.77513-67.410659 0 0 75.114734 2.140021 112.993103 60.990596 0 0-2.140021-51.360502 26.964263-74.686729z" fill="#B68A11" p-id="5357"></path><path d="M161.143574 519.811076s12.412121 43.442424-26.536259 73.616719c0 0-84.316823-4.494044-105.931035-70.406687 0 0 66.340648 2.782027 101.650993 64.842633 0-0.214002-2.782027-38.94838 30.816301-68.052665z" fill="#B68A11" p-id="5358"></path><path d="M151.085475 456.466458s6.206061 35.096343-33.81233 69.336677c0 0-82.176803-22.470219-92.876907-78.324765 0 0 70.192685 14.980146 91.806897 73.616719 0.214002-0.214002-2.568025-36.808359 34.88234-64.628631z" fill="#B68A11" p-id="5359"></path><path d="M147.875444 398.899896s2.354023 39.162382-40.232393 57.780564c0 0-79.394775-35.952351-76.184744-85.600836 0 0 48.15047 4.494044 76.184744 80.464786 0.214002 0 9.20209-38.306374 40.232393-52.644514z" fill="#B68A11" p-id="5360"></path><path d="M154.723511 340.049321s-6.206061 35.310345-46.010449 50.932497c0 0-66.982654-43.442424-61.632602-91.806896 0 0 54.142529 24.824242 61.846604 85.814838 0 0 7.918077-24.396238 45.796447-44.940439zM166.493626 281.198746s-4.06604 33.384326-46.224451 44.512435c0 0-55.854545-25.680251-52.644515-91.592895 0 0 48.578474 24.61024 53.286521 86.242843-0.214002 0 16.906165-37.236364 45.582445-39.162383zM185.753814 225.986207s-26.750261 2.354023-47.722466 33.170324c0 0-4.06604-65.270637-44.726437-85.386834 0 0-14.552142 49.006479 43.01442 92.876907 0.214002 0 36.594357-6.848067 49.434483-40.660397z" fill="#B68A11" p-id="5361"></path><path d="M205.442006 176.551724S189.605852 208.438036 157.71954 209.722048c0 0-47.722466-41.730408-35.310345-89.880878 0 0 36.166353 26.322257 36.594358 83.032811 0.214002 0 15.622153-24.61024 46.438453-26.322257zM230.052247 128.615256s-9.20209 28.67628-50.076489 29.532288c0 0-38.520376-47.08046-20.972205-89.880877 0 0 29.104284 23.54023 24.182236 81.9628 0-0.214002 20.330199-22.898224 46.866458-21.614211zM258.514525 85.814838s-14.980146 26.536259-47.936469 23.326228c0 0-37.664368-49.006479-15.194148-86.670847 0 0 27.392268 26.536259 17.334169 80.464786 0 0 19.688192-19.47419 45.796448-17.120167z" fill="#B68A11" p-id="5362"></path><path d="M279.914734 53.500522s-13.910136 25.894253-49.648485 21.186207c0 0-5.564054-39.804389 19.47419-52.21651 0 0 7.276071 20.544201-7.490073 41.302404-0.214002 0 11.984117-12.412121 37.664368-10.272101z" fill="#B68A11" p-id="5363"></path><path d="M291.256844 24.824242s-3.424033 24.182236-29.318286 22.042216c0 0 1.498015-20.116196 29.318286-22.042216z" fill="#B68A11" p-id="5364"></path><path d="M556.405434 984.409613s40.018391-7.918077 58.42257-18.618181 120.483177-56.28255 189.39185-12.840126c0 0 28.462278 24.182236 57.35256 27.178266 0 0-36.808359 13.482132-74.900732 2.782027 0 0-32.528318-9.20209-50.932497-22.47022 0 0-40.660397-17.976176-78.538767 0.214002-37.87837 18.190178-33.170324 23.326228-64.842633 28.248276C560.685475 994.039707 556.405434 984.409613 556.405434 984.409613zM802.079833 912.076907s16.692163-47.722466 74.472727-62.060606c0 0-9.20209 41.730408-56.068547 57.780564 0 0 93.732915 1.498015 130.11327 54.784535 0.214002 0-75.75674 29.960293-148.51745-50.504493z" fill="#B68A11" p-id="5365"></path><path d="M897.738767 896.454754s3.638036-50.504493 55.640543-79.608777c0 0 2.140021 42.800418-38.734378 70.406688 0 0 90.950888-23.326228 139.957367 18.618181-0.214002 0-65.484639 49.006479-156.863532-9.416092z" fill="#B68A11" p-id="5366"></path><path d="M999.175758 767.411494s-27.820272 47.294462 2.782027 98.440962c0 0 93.304911 28.67628 153.011494-39.590387 0 0-75.114734-24.824242-148.303448 35.096343 0 0 22.256217-53.928527-7.490073-93.946918z" fill="#B68A11" p-id="5367"></path><path d="M1059.096343 796.301776s16.692163-53.28652-11.770115-84.102821c0 0-26.964263 48.792476 9.630094 91.16489 0 0 101.436991 19.902194 139.957367-49.862487 0 0.428004-61.632602-19.902194-137.817346 42.800418z" fill="#B68A11" p-id="5368"></path><path d="M1108.530825 729.961129s9.844096-47.936468-19.046186-78.966772c0 0-23.754232 43.656426 15.194149 87.954859 0 0 106.787043-2.354023 128.401254-60.990595 0.214002 0.214002-81.748798-3.852038-124.549217 52.002508z" fill="#B68A11" p-id="5369"></path><path d="M1122.226959 585.081714s-13.482132 52.644514 24.182236 81.106792c0 0 87.740857 2.354023 115.775131-67.410659 0 0-75.114734 2.140021-112.993103 60.990596 0 0 2.140021-51.360502-26.964264-74.686729z" fill="#B68A11" p-id="5370"></path><path d="M1150.261233 519.811076s-12.412121 43.442424 26.536259 73.616719c0 0 84.316823-4.494044 105.931035-70.406687 0 0-66.340648 2.782027-101.650993 64.842633 0-0.214002 2.568025-38.94838-30.816301-68.052665z" fill="#B68A11" p-id="5371"></path><path d="M1160.105329 456.466458s-6.206061 35.096343 33.81233 69.336677c0 0 82.176803-22.470219 92.876907-78.324765 0 0-70.192685 14.980146-91.806896 73.616719 0-0.214002 2.568025-36.808359-34.882341-64.628631z" fill="#B68A11" p-id="5372"></path><path d="M1163.315361 398.899896s-2.354023 39.162382 40.232392 57.780564c0 0 79.394775-35.952351 76.184744-85.600836 0 0-48.15047 4.494044-76.184744 80.464786 0 0-9.20209-38.306374-40.232392-52.644514z" fill="#B68A11" p-id="5373"></path><path d="M1156.681296 340.049321s6.206061 35.310345 46.010449 50.932497c0 0 66.982654-43.442424 61.632602-91.806896 0 0-54.142529 24.824242-61.846604 85.814838 0 0-8.132079-24.396238-45.796447-44.940439zM1144.911181 281.198746s4.06604 33.384326 46.224451 44.512435c0 0 55.854545-25.680251 52.644514-91.592895 0 0-48.578474 24.61024-53.28652 86.242843 0.214002 0-16.906165-37.236364-45.582445-39.162383zM1125.650993 225.986207s26.750261 2.354023 47.722466 33.170324c0 0 4.06604-65.270637 44.726437-85.386834 0 0 14.552142 49.006479-43.014421 92.876907-0.214002 0-36.594357-6.848067-49.434482-40.660397z" fill="#B68A11" p-id="5374"></path><path d="M1105.9628 176.551724s15.836155 31.886311 47.722466 33.170324c0 0 47.722466-41.730408 35.310345-89.880878 0 0-36.166353 26.322257-36.594357 83.032811-0.214002 0-15.836155-24.61024-46.438454-26.322257zM1081.35256 128.615256s9.20209 28.67628 50.076489 29.532288c0 0 38.520376-47.08046 20.972205-89.880877 0 0-29.104284 23.54023-24.182236 81.9628-0.214002-0.214002-20.544201-22.898224-46.866458-21.614211zM1052.890282 85.814838s14.980146 26.536259 47.936468 23.326228c0 0 37.664368-49.006479 15.194149-86.670847 0 0-27.392268 26.536259-17.33417 80.464786 0 0-19.902194-19.47419-45.796447-17.120167z" fill="#B68A11" p-id="5375"></path><path d="M1031.490073 53.500522s13.910136 25.894253 49.862487 21.186207c0 0 5.564054-39.804389-19.47419-52.21651 0 0-7.276071 20.544201 7.490073 41.302404-0.214002 0-12.198119-12.412121-37.87837-10.272101z" fill="#B68A11" p-id="5376"></path><path d="M1019.93396 24.824242s3.424033 24.182236 29.532289 22.042216c0 0-1.712017-20.116196-29.532289-22.042216z" fill="#B68A11" p-id="5377"></path></svg>
        `;
      } else if (ratingScore >= 5.0) {
        ratingContainer.setAttribute('data-score', 'good');
        const simpleBadge = ratingContainer.createDiv({ cls: 'simple-badge' });
        simpleBadge.createDiv({ text: data.rating });
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
    if (data.rating) {
      const ratingContainer = infoContainer.createDiv({ cls: 'rating' });
      const ratingScore = parseFloat(data.rating);
      
      // 根据评分范围设置不同的评分徽章样式
      if (ratingScore >= 7.0) {
        ratingContainer.setAttribute('data-score', 'excellent');
        const ratingBadge = ratingContainer.createDiv({ cls: 'rating-badge' });
        ratingBadge.createDiv({ cls: 'rating-score', text: data.rating });
        ratingBadge.innerHTML += `
          <svg t="1743841440004" class="icon" viewBox="0 0 1332 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="5351" width="200" height="200"><path d="M754.999373 984.409613s-40.018391-7.918077-58.42257-18.618181c-18.618182-10.700104-120.483177-56.28255-189.39185-12.840126 0 0-28.462278 24.182236-57.35256 27.178266 0 0 36.808359 13.482132 74.900731 2.782027 0 0 32.528318-9.20209 50.932498-22.47022 0 0 40.660397-17.976176 78.538767 0.214002 37.87837 18.190178 33.170324 23.326228 64.842633 28.248276 31.672309 5.13605 35.952351-4.494044 35.952351-4.494044zM509.324974 912.076907s-16.692163-47.722466-74.472727-62.060606c0 0 9.20209 41.730408 56.068547 57.780564 0 0-93.732915 1.498015-130.11327 54.784535-0.214002 0 75.75674 29.960293 148.51745-50.504493z" fill="#B68A11" p-id="5352"></path><path d="M413.66604 896.454754s-3.638036-50.504493-55.640544-79.608777c0 0-2.140021 42.800418 38.734379 70.406688 0 0-90.950888-23.326228-139.957367 18.618181 0.214002 0 65.484639 49.006479 156.863532-9.416092z" fill="#B68A11" p-id="5353"></path><path d="M312.229049 767.411494s27.820272 47.294462-2.782027 98.440962c0 0-93.304911 28.67628-153.011494-39.590387 0 0 75.114734-24.824242 148.089446 35.096343 0.214002 0-22.042215-53.928527 7.704075-93.946918z" fill="#B68A11" p-id="5354"></path><path d="M252.308464 796.301776s-16.692163-53.28652 11.770115-84.102821c0 0 26.964263 48.792476-9.630094 91.16489 0 0-101.436991 19.902194-139.957367-49.862487 0 0.428004 61.632602-19.902194 137.817346 42.800418z" fill="#B68A11" p-id="5355"></path><path d="M202.873981 729.961129s-9.844096-47.936468 19.046186-78.966772c0 0 23.754232 43.656426-15.194148 87.954859 0 0-106.787043-2.354023-128.401254-60.990595-0.214002 0.214002 81.748798-3.852038 124.549216 52.002508z" fill="#B68A11" p-id="5356"></path><path d="M189.177847 585.081714s13.482132 52.644514-24.182236 81.106792c0 0-87.740857 2.354023-115.77513-67.410659 0 0 75.114734 2.140021 112.993103 60.990596 0 0-2.140021-51.360502 26.964263-74.686729z" fill="#B68A11" p-id="5357"></path><path d="M161.143574 519.811076s12.412121 43.442424-26.536259 73.616719c0 0-84.316823-4.494044-105.931035-70.406687 0 0 66.340648 2.782027 101.650993 64.842633 0-0.214002-2.782027-38.94838 30.816301-68.052665z" fill="#B68A11" p-id="5358"></path><path d="M151.085475 456.466458s6.206061 35.096343-33.81233 69.336677c0 0-82.176803-22.470219-92.876907-78.324765 0 0 70.192685 14.980146 91.806897 73.616719 0.214002-0.214002-2.568025-36.808359 34.88234-64.628631z" fill="#B68A11" p-id="5359"></path><path d="M147.875444 398.899896s2.354023 39.162382-40.232393 57.780564c0 0-79.394775-35.952351-76.184744-85.600836 0 0 48.15047 4.494044 76.184744 80.464786 0.214002 0 9.20209-38.306374 40.232393-52.644514z" fill="#B68A11" p-id="5360"></path><path d="M154.723511 340.049321s-6.206061 35.310345-46.010449 50.932497c0 0-66.982654-43.442424-61.632602-91.806896 0 0 54.142529 24.824242 61.846604 85.814838 0 0 7.918077-24.396238 45.796447-44.940439zM166.493626 281.198746s-4.06604 33.384326-46.224451 44.512435c0 0-55.854545-25.680251-52.644515-91.592895 0 0 48.578474 24.61024 53.286521 86.242843-0.214002 0 16.906165-37.236364 45.582445-39.162383zM185.753814 225.986207s-26.750261 2.354023-47.722466 33.170324c0 0-4.06604-65.270637-44.726437-85.386834 0 0-14.552142 49.006479 43.01442 92.876907 0.214002 0 36.594357-6.848067 49.434483-40.660397z" fill="#B68A11" p-id="5361"></path><path d="M205.442006 176.551724S189.605852 208.438036 157.71954 209.722048c0 0-47.722466-41.730408-35.310345-89.880878 0 0 36.166353 26.322257 36.594358 83.032811 0.214002 0 15.622153-24.61024 46.438453-26.322257zM230.052247 128.615256s-9.20209 28.67628-50.076489 29.532288c0 0-38.520376-47.08046-20.972205-89.880877 0 0 29.104284 23.54023 24.182236 81.9628 0-0.214002 20.330199-22.898224 46.866458-21.614211zM258.514525 85.814838s-14.980146 26.536259-47.936469 23.326228c0 0-37.664368-49.006479-15.194148-86.670847 0 0 27.392268 26.536259 17.334169 80.464786 0 0 19.688192-19.47419 45.796448-17.120167z" fill="#B68A11" p-id="5362"></path><path d="M279.914734 53.500522s-13.910136 25.894253-49.648485 21.186207c0 0-5.564054-39.804389 19.47419-52.21651 0 0 7.276071 20.544201-7.490073 41.302404-0.214002 0 11.984117-12.412121 37.664368-10.272101z" fill="#B68A11" p-id="5363"></path><path d="M291.256844 24.824242s-3.424033 24.182236-29.318286 22.042216c0 0 1.498015-20.116196 29.318286-22.042216z" fill="#B68A11" p-id="5364"></path><path d="M556.405434 984.409613s40.018391-7.918077 58.42257-18.618181 120.483177-56.28255 189.39185-12.840126c0 0 28.462278 24.182236 57.35256 27.178266 0 0-36.808359 13.482132-74.900732 2.782027 0 0-32.528318-9.20209-50.932497-22.47022 0 0-40.660397-17.976176-78.538767 0.214002-37.87837 18.190178-33.170324 23.326228-64.842633 28.248276C560.685475 994.039707 556.405434 984.409613 556.405434 984.409613zM802.079833 912.076907s16.692163-47.722466 74.472727-62.060606c0 0-9.20209 41.730408-56.068547 57.780564 0 0 93.732915 1.498015 130.11327 54.784535 0.214002 0-75.75674 29.960293-148.51745-50.504493z" fill="#B68A11" p-id="5365"></path><path d="M897.738767 896.454754s3.638036-50.504493 55.640543-79.608777c0 0 2.140021 42.800418-38.734378 70.406688 0 0 90.950888-23.326228 139.957367 18.618181-0.214002 0-65.484639 49.006479-156.863532-9.416092z" fill="#B68A11" p-id="5366"></path><path d="M999.175758 767.411494s-27.820272 47.294462 2.782027 98.440962c0 0 93.304911 28.67628 153.011494-39.590387 0 0-75.114734-24.824242-148.303448 35.096343 0 0 22.256217-53.928527-7.490073-93.946918z" fill="#B68A11" p-id="5367"></path><path d="M1059.096343 796.301776s16.692163-53.28652-11.770115-84.102821c0 0-26.964263 48.792476 9.630094 91.16489 0 0 101.436991 19.902194 139.957367-49.862487 0 0.428004-61.632602-19.902194-137.817346 42.800418z" fill="#B68A11" p-id="5368"></path><path d="M1108.530825 729.961129s9.844096-47.936468-19.046186-78.966772c0 0-23.754232 43.656426 15.194149 87.954859 0 0 106.787043-2.354023 128.401254-60.990595 0.214002 0.214002-81.748798-3.852038-124.549217 52.002508z" fill="#B68A11" p-id="5369"></path><path d="M1122.226959 585.081714s-13.482132 52.644514 24.182236 81.106792c0 0 87.740857 2.354023 115.775131-67.410659 0 0-75.114734 2.140021-112.993103 60.990596 0 0 2.140021-51.360502-26.964264-74.686729z" fill="#B68A11" p-id="5370"></path><path d="M1150.261233 519.811076s-12.412121 43.442424 26.536259 73.616719c0 0 84.316823-4.494044 105.931035-70.406687 0 0-66.340648 2.782027-101.650993 64.842633 0-0.214002 2.568025-38.94838-30.816301-68.052665z" fill="#B68A11" p-id="5371"></path><path d="M1160.105329 456.466458s-6.206061 35.096343 33.81233 69.336677c0 0 82.176803-22.470219 92.876907-78.324765 0 0-70.192685 14.980146-91.806896 73.616719 0-0.214002 2.568025-36.808359-34.882341-64.628631z" fill="#B68A11" p-id="5372"></path><path d="M1163.315361 398.899896s-2.354023 39.162382 40.232392 57.780564c0 0 79.394775-35.952351 76.184744-85.600836 0 0-48.15047 4.494044-76.184744 80.464786 0 0-9.20209-38.306374-40.232392-52.644514z" fill="#B68A11" p-id="5373"></path><path d="M1156.681296 340.049321s6.206061 35.310345 46.010449 50.932497c0 0 66.982654-43.442424 61.632602-91.806896 0 0-54.142529 24.824242-61.846604 85.814838 0 0-8.132079-24.396238-45.796447-44.940439zM1144.911181 281.198746s4.06604 33.384326 46.224451 44.512435c0 0 55.854545-25.680251 52.644514-91.592895 0 0-48.578474 24.61024-53.28652 86.242843 0.214002 0-16.906165-37.236364-45.582445-39.162383zM1125.650993 225.986207s26.750261 2.354023 47.722466 33.170324c0 0 4.06604-65.270637 44.726437-85.386834 0 0 14.552142 49.006479-43.014421 92.876907-0.214002 0-36.594357-6.848067-49.434482-40.660397z" fill="#B68A11" p-id="5374"></path><path d="M1105.9628 176.551724s15.836155 31.886311 47.722466 33.170324c0 0 47.722466-41.730408 35.310345-89.880878 0 0-36.166353 26.322257-36.594357 83.032811-0.214002 0-15.836155-24.61024-46.438454-26.322257zM1081.35256 128.615256s9.20209 28.67628 50.076489 29.532288c0 0 38.520376-47.08046 20.972205-89.880877 0 0-29.104284 23.54023-24.182236 81.9628-0.214002-0.214002-20.544201-22.898224-46.866458-21.614211zM1052.890282 85.814838s14.980146 26.536259 47.936468 23.326228c0 0 37.664368-49.006479 15.194149-86.670847 0 0-27.392268 26.536259-17.33417 80.464786 0 0-19.902194-19.47419-45.796447-17.120167z" fill="#B68A11" p-id="5375"></path><path d="M1031.490073 53.500522s13.910136 25.894253 49.862487 21.186207c0 0 5.564054-39.804389-19.47419-52.21651 0 0-7.276071 20.544201 7.490073 41.302404-0.214002 0-12.198119-12.412121-37.87837-10.272101z" fill="#B68A11" p-id="5376"></path><path d="M1019.93396 24.824242s3.424033 24.182236 29.532289 22.042216c0 0-1.712017-20.116196-29.532289-22.042216z" fill="#B68A11" p-id="5377"></path></svg>
        `;
      } else if (ratingScore >= 5.0) {
        ratingContainer.setAttribute('data-score', 'good');
        const simpleBadge = ratingContainer.createDiv({ cls: 'simple-badge' });
        simpleBadge.createDiv({ text: data.rating });
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

  private extractCardsFromContent(content: string): string[] {
    const cards: string[] = [];
    const cardTypes = ['music-card', 'book-card', 'movie-card'];
    
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
}