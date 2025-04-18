import { Plugin, MarkdownPostProcessorContext, TFile, TAbstractFile, Modal, Setting, Menu, addIcon, PluginSettingTab, App } from 'obsidian';
import type { MenuItem } from 'obsidian';
import { CardUtils } from './src/utils';
import type { CardLocation } from './src/utils';
import { CardsGalleryView, VIEW_TYPE_CARDS_GALLERY } from './src/CardsGalleryView';

// 添加布局网格图标
addIcon('layout-grid', `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`);

// 添加灯泡图标
addIcon('bulb', `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lightbulb"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"></path><path d="M9 18h6"></path><path d="M10 22h4"></path></svg>`);

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
    movieCard: '```movie-card\ntitle: \nyear: \ndirector: \ndescription: \nrating: \n```',
    ideaCard: '```idea-card\nidea: \nsource: \ndate: \ntags: \nurl: \n```',
    quoteCard: '```quote-card\nquote: \nsource: \ndate: \ntags: \nurl: \n```'
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

    containerEl.createEl('h3', {text: '卡片模板设置'});

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

import { QuickNoteView, VIEW_TYPE_QUICK_NOTE } from './src/QuickNoteView';

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
      const simpleBadge = ratingContainer.createDiv({ cls: 'simple-badge' });
      simpleBadge.createSpan({ text: rating });
    }
  }


  private view: CardsGalleryView;

  async onload() {
    await this.loadSettings();

    // 添加设置页面
    this.addSettingTab(new NewCardsSettingTab(this.app, this));

    // 注册快速记录视图
    this.registerView(
      VIEW_TYPE_QUICK_NOTE,
      (leaf) => new QuickNoteView(leaf, this)
    );

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
    
        const excludedNames = ['想法', '摘录', '电影', '音乐', '书籍'];
        const baseName = file.basename;
        if (!excludedNames.includes(baseName)) {
          const content = await this.app.vault.read(file);
          const lines = content.split('\n');
    
          const tagTypes = ['music-card', 'book-card', 'movie-card', 'quote-card', 'idea-card'];
          const foundTags = new Set<string>();
    
          const codeBlockRegex = /^```(music-card|book-card|movie-card|quote-card|idea-card)$/;
          let inBlock = false;
          let blockLines: string[] = [];
    
          for (let line of lines) {
            const trimmed = line.trim();
    
            if (!inBlock) {
              const match = trimmed.match(codeBlockRegex);
              if (match) {
                inBlock = true;
                blockLines = [];
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
    
          // 更新 frontmatter tags 属性
          const metadata = this.app.metadataCache.getFileCache(file);
          const frontmatter = metadata?.frontmatter;
          const hasFrontmatter = content.startsWith('---\n');
          
          const rawTags = frontmatter?.tags as string[] | undefined;
            const existingTags = new Set((rawTags ?? []).map(t => t.trim()));
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
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        let currentLine = 0;
    
        interface CodeBlockState {
          type: string;
          startLine: number;
          content: string[];
        }
        const blockStack: CodeBlockState[] = [];
    
        while (currentLine < lines.length) {
          const line = lines[currentLine].trim();
    
          if (line.startsWith('```')) {
            const cardTypes = ['music-card', 'book-card', 'movie-card'];
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
                const newCID = await CardUtils.updateCardIndex(this.app.vault, cid, fullContent, {
                  path: file.path,
                  startLine: currentBlock.startLine,
                  endLine: currentLine
                });
                if (newCID !== cid) {
                  console.log(`Card content merged with existing card: ${newCID}`);
                }
              }
            }
          } else if (blockStack.length > 0) {
            blockStack[blockStack.length - 1].content.push(lines[currentLine]);
          }
          currentLine++;
        }
    
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
          const cardTypes = ['music-card', 'book-card', 'movie-card', 'quote-card', 'idea-card'];
          
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
                      let insertText = '';
            
                      if (isInCodeBlock) {
                        const lines = content.split('\n');
                        const firstLine = '   ' + lines[0];
                        const otherLines = lines.slice(1).map(line => '    ' + line);
                        insertText = [firstLine, ...otherLines].join('\n') + '\n';
                      } else {
                        insertText = content + '\n'; // 减少一个前导换行符
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
      
    // 注册想法卡片处理器
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
      data.tags.forEach(tag => {
        tagsContainer.createEl('a', {
          text: tag,
          cls: 'tag'
        });
      });
    }
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
      data.tags.forEach(tag => {
        tagsContainer.createEl('a', {
          text: tag,
          cls: 'tag'
        });
      });
    }
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
   
    
    if (data.rating) {
      const ratingContainer = infoContainer.createDiv({ cls: 'rating' });
      const ratingScore = parseFloat(data.rating);
      
      // 根据评分范围设置不同的评分徽章样式
      if (ratingScore >= 7.0) {
        ratingContainer.setAttribute('data-score', 'excellent');
        const ratingBadge = ratingContainer.createDiv({ cls: 'rating-badge' });
        ratingBadge.createDiv({ cls: 'rating-score', text: data.rating });
        ratingBadge.innerHTML += `
         <svg t="1744038348712" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2606" data-darkreader-inline-fill="" width="200" height="200"><path d="M510.742357 92.463901c230.651171 0 418.307108 187.654914 418.307107 418.307108s-187.654914 418.307108-418.307107 418.307108-418.307108-187.654914-418.307108-418.307108 187.655937-418.307108 418.307108-418.307108m0-29.879517c-247.518327 0-448.185602 200.667276-448.185602 448.185602s200.667276 448.185602 448.185602 448.185602c247.532653 0 448.185602-200.667276 448.185602-448.185602S758.27501 62.584384 510.742357 62.584384z" fill="" p-id="2607"></path></svg>
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

     
    if (data.description) {
      infoContainer.createEl('div', { text: data.description, cls: 'card-info-description' });
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
          <svg t="1744038348712" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2606" data-darkreader-inline-fill="" width="200" height="200"><path d="M510.742357 92.463901c230.651171 0 418.307108 187.654914 418.307107 418.307108s-187.654914 418.307108-418.307107 418.307108-418.307108-187.654914-418.307108-418.307108 187.655937-418.307108 418.307108-418.307108m0-29.879517c-247.518327 0-448.185602 200.667276-448.185602 448.185602s200.667276 448.185602 448.185602 448.185602c247.532653 0 448.185602-200.667276 448.185602-448.185602S758.27501 62.584384 510.742357 62.584384z" fill="" p-id="2607"></path></svg>
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
          <svg t="1744038348712" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2606" data-darkreader-inline-fill="" width="200" height="200"><path d="M510.742357 92.463901c230.651171 0 418.307108 187.654914 418.307107 418.307108s-187.654914 418.307108-418.307107 418.307108-418.307108-187.654914-418.307108-418.307108 187.655937-418.307108 418.307108-418.307108m0-29.879517c-247.518327 0-448.185602 200.667276-448.185602 448.185602s200.667276 448.185602 448.185602 448.185602c247.532653 0 448.185602-200.667276 448.185602-448.185602S758.27501 62.584384 510.742357 62.584384z" fill="" p-id="2607"></path></svg>
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