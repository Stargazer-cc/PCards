import { ItemView, WorkspaceLeaf, TFile, Notice, Modal, App } from 'obsidian';
import type NewCardsPlugin from '../main';
import { DoubanAPI, DoubanItemDetail } from './DoubanAPI';
import { MusicTagAPI, MusicTagItemDetail } from './MusicTagAPI';
import { BangumiAPI } from './BangumiAPI';
import { TMDBAPI, TMDBItemDetail } from './TMDBAPI';

export const VIEW_TYPE_QUICK_NOTE = 'quick-note-view';

export class QuickNoteView extends ItemView {
    public static readonly VIEW_TYPE = "new-cards-quick-note";
    private plugin: NewCardsPlugin;
    private container: HTMLElement;
    private type: 'idea' | 'quote' | 'movie' | 'book' | 'music' | 'tv' | 'anime' = 'idea';
    private doubanSearchResults: any[] = [];
    private doubanSearchModal: HTMLElement | null = null;
    private neteaseMusicSearchResults: any[] = [];
    private neteaseMusicSearchModal: HTMLElement | null = null;
    private bangumiSearchResults: any[] = [];
    private bangumiSearchModal: HTMLElement | null = null;
    private tmdbSearchResults: any[] = [];
    private tmdbSearchModal: HTMLElement | null = null;
    private formElements: { [key: string]: HTMLElement } = {}; // 存储表单元素

    constructor(leaf: WorkspaceLeaf, plugin: NewCardsPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_QUICK_NOTE;
    }

    getDisplayText(): string {
        return '快速记录';
    }

    getIcon(): string {
        return 'carrot';
    }

    async onOpen() {
        this.container = this.containerEl.children[1] as HTMLElement;
        this.container.empty();
        this.container.addClass('quick-note-container');

        // 创建页面内容
        const contentEl = this.container.createDiv({ cls: 'quick-note-content' });

        // 类型选择器
        const typeSelector = contentEl.createDiv({ cls: 'quick-note-type-selector' });
        const buttons: Array<{ type: 'idea' | 'quote' | 'movie' | 'book' | 'music' | 'tv' | 'anime', text: string }> = [
            { type: 'idea', text: '闪念' },
            { type: 'quote', text: '摘录' },
            { type: 'movie', text: '电影' },
            { type: 'book', text: '书籍' },
            { type: 'music', text: '音乐' },
            { type: 'tv', text: '剧集' },
            { type: 'anime', text: '番剧' }
        ];

        const typeButtons = buttons.map(({ type, text }) => {
            const btn = typeSelector.createEl('button', {
                cls: `type-button ${type === this.type ? 'active' : ''}`,
                text
            });
            btn.onclick = () => this.switchType(type, btn, typeButtons.filter(b => b !== btn));
            return btn;
        });

        // 表单
        const form = contentEl.createEl('form', { cls: 'quick-note-form' });

        // 根据初始类型创建表单字段
        this.buildFormFields(form, this.type);

        // 添加保存按钮和事件监听器
        this.addSaveButton(form);

        form.onsubmit = async (e) => {
            e.preventDefault();
            await this.saveNote();
        };

    }

    private switchType(newType: 'idea' | 'quote' | 'movie' | 'book' | 'music' | 'tv' | 'anime', activeBtn: HTMLElement, inactiveButtons: HTMLElement[]) {
        // 更新激活状态
        activeBtn.addClass('active');
        inactiveButtons.forEach(btn => btn.removeClass('active'));

        // 更新类型
        this.type = newType;

        // 设置容器的数据属性，用于CSS选择器
        this.container.setAttribute('data-card-type', this.type);

        // 清空并重建表单
        const form = this.container.querySelector('.quick-note-form') as HTMLElement;
        if (form) {
            form.empty();
            this.formElements = {}; // 清空表单元素存储
            this.buildFormFields(form, this.type);
            this.addSaveButton(form);
        }
    }

    // 新增方法：根据类型构建表单字段
    private buildFormFields(form: HTMLElement, type: 'idea' | 'quote' | 'movie' | 'book' | 'music' | 'tv' | 'anime') {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        const currentDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        const currentDate = `${year}-${month}-${day}`;
        const collectionDate = `${year.toString().slice(-2)}-${month}-${day}`;

        switch (type) {
            case 'idea':
                this.createFormGroup(form, '闪念', 'content', true);
                this.createFormGroup(form, '标签', 'tags', false, { placeholder: '输入标签，如 #标签1 #标签2' });
                this.createFormGroup(form, '链接', 'url', false, { placeholder: '输入https://格式、file:///格式、obsidian://格式链接' });
                this.createFormGroup(form, '来源', 'source');
                this.createFormGroup(form, '日期', 'date', false, { placeholder: 'YYYY-MM-DD HH:mm:ss', defaultValue: currentDateTime });
                break;
            case 'quote':
                this.createFormGroup(form, '摘录', 'content', true);
                this.createFormGroup(form, '出处', 'source');
                this.createFormGroup(form, '标签', 'tags', false, { placeholder: '输入标签，如 #标签1 #标签2' });
                this.createFormGroup(form, '链接', 'url', false, { placeholder: '输入https://格式、file:///格式、obsidian://格式链接' });
                this.createFormGroup(form, '日期', 'date', false, { placeholder: 'YYYY-MM-DD HH:mm:ss', defaultValue: currentDateTime });
                break;
            case 'movie':
                this.createFormGroup(form, '影评', 'description', true);

                // 添加搜索行
                const movieTitleRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(movieTitleRow, '名称', 'title');
                this.addTMDBSearchButton(movieTitleRow, 'movie');
                this.addDoubanSearchButton(movieTitleRow, 'movie');

                this.createFormGroup(form, '导演', 'director');

                // 创建评分和年份在同一行
                const movieRatingYearRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(movieRatingYearRow, '评分', 'rating', false, { type: 'number' });
                this.createInlineFormGroup(movieRatingYearRow, '年份', 'year', false, { placeholder: 'YYYY' });

                this.createFormGroup(form, '封面', 'cover', false, { placeholder: '输入图片URL或者![](图片URL)' });
                this.createFormGroup(form, '链接', 'url', false, { placeholder: '输入https://格式、file:///格式、obsidian://格式链接' });
                this.createFormGroup(form, '标签', 'tags', false, { placeholder: '输入标签，如 #标签1 #标签2' });

                // 创建收录时间和状态在同一行
                const movieDateStatusRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(movieDateStatusRow, '收录', 'collection_date', false, { placeholder: 'YY-MM-DD', defaultValue: collectionDate });

                // 添加状态选择到行容器中
                const movieStatusGroup = movieDateStatusRow.createDiv({ cls: 'form-group-inline' });
                movieStatusGroup.createEl('label', { text: '状态', attr: { for: 'status' } });
                const movieStatusSelect = movieStatusGroup.createEl('select', { attr: { id: 'status', name: 'status' } });
                movieStatusSelect.createEl('option', { value: 'unread', text: '待看/待读' });
                movieStatusSelect.createEl('option', { value: 'read', text: '已看/已读' });

                // 添加自定义元数据字段
                this.addMetaFieldsSection(form);
                break;
            case 'book':
                this.createFormGroup(form, '书评', 'description', true);

                // 添加豆瓣搜索行
                const bookTitleRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(bookTitleRow, '书名', 'title');
                this.addDoubanSearchButton(bookTitleRow, 'book');

                this.createFormGroup(form, '作者', 'author');

                // 创建评分和年份在同一行
                const bookRatingYearRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(bookRatingYearRow, '评分', 'rating', false, { type: 'number' });
                this.createInlineFormGroup(bookRatingYearRow, '年份', 'year', false, { placeholder: 'YYYY' });

                this.createFormGroup(form, '封面', 'cover', false, { placeholder: '输入图片URL或者![](图片URL)' });
                this.createFormGroup(form, '链接', 'url', false, { placeholder: '输入https://格式、file:///格式、obsidian://格式链接' });
                this.createFormGroup(form, '标签', 'tags', false, { placeholder: '输入标签，如 #标签1 #标签2' });

                // 创建收录时间和状态在同一行
                const bookDateStatusRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(bookDateStatusRow, '收录', 'collection_date', false, { placeholder: 'YY-MM-DD', defaultValue: collectionDate });

                // 添加状态选择到行容器中
                const bookStatusGroup = bookDateStatusRow.createDiv({ cls: 'form-group-inline' });
                bookStatusGroup.createEl('label', { text: '状态', attr: { for: 'status' } });
                const bookStatusSelect = bookStatusGroup.createEl('select', { attr: { id: 'status', name: 'status' } });
                bookStatusSelect.createEl('option', { value: 'unread', text: '待看/待读' });
                bookStatusSelect.createEl('option', { value: 'read', text: '已看/已读' });

                // 添加自定义元数据字段
                this.addMetaFieldsSection(form);
                break;
            case 'tv':
                this.createFormGroup(form, '剧评', 'description', true);

                // 添加搜索行
                const tvTitleRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(tvTitleRow, '剧名', 'title');
                this.addTMDBSearchButton(tvTitleRow, 'tv');
                this.addDoubanSearchButton(tvTitleRow, 'movie'); // 豆瓣剧集也在movie分类下

                this.createFormGroup(form, '导演', 'director');

                // 创建评分和年份在同一行
                const tvRatingYearRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(tvRatingYearRow, '评分', 'rating', false, { type: 'number' });
                this.createInlineFormGroup(tvRatingYearRow, '年份', 'year', false, { placeholder: 'YYYY' });

                this.createFormGroup(form, '封面', 'cover', false, { placeholder: '输入图片URL或者![](图片URL)' });
                this.createFormGroup(form, '链接', 'url', false, { placeholder: '输入https://格式、file:///格式、obsidian://格式链接' });
                this.createFormGroup(form, '标签', 'tags', false, { placeholder: '输入标签，如 #标签1 #标签2' });

                // 创建收录时间和状态在同一行
                const tvDateStatusRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(tvDateStatusRow, '收录', 'collection_date', false, { placeholder: 'YY-MM-DD', defaultValue: collectionDate });

                // 添加状态选择到行容器中
                const tvStatusGroup = tvDateStatusRow.createDiv({ cls: 'form-group-inline' });
                tvStatusGroup.createEl('label', { text: '状态', attr: { for: 'status' } });
                const tvStatusSelect = tvStatusGroup.createEl('select', { attr: { id: 'status', name: 'status' } });
                tvStatusSelect.createEl('option', { value: 'unread', text: '待看/待读' });
                tvStatusSelect.createEl('option', { value: 'read', text: '已看/已读' });

                // 添加自定义元数据字段
                this.addMetaFieldsSection(form);
                break;
            case 'anime':
                // 长文本字段
                this.createFormGroup(form, '评论', 'description', true);

                // 添加标题和Bangumi搜索
                const animeTitleRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(animeTitleRow, '番名', 'title');
                this.addBangumiSearchButton(animeTitleRow);

                // 导演
                this.createFormGroup(form, '导演', 'director');

                // 评分和年份在同一行
                const animeRatingYearRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(animeRatingYearRow, '评分', 'rating', false, { type: 'number' });
                this.createInlineFormGroup(animeRatingYearRow, '年份', 'year', false, { placeholder: 'YYYY' });

                // 封面、链接和标签
                this.createFormGroup(form, '封面', 'cover', false, { placeholder: '输入图片URL或者![](图片URL)' });
                this.createFormGroup(form, '链接', 'url', false, { placeholder: '输入https://格式、file:///格式、obsidian://格式链接' });
                this.createFormGroup(form, '标签', 'tags', false, { placeholder: '输入标签，如 #标签1 #标签2' });

                // 收录时间和状态在同一行
                const animeDateStatusRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(animeDateStatusRow, '收录', 'collection_date', false, { placeholder: 'YY-MM-DD', defaultValue: collectionDate });

                // 状态选择
                const animeStatusGroup = animeDateStatusRow.createDiv({ cls: 'form-group-inline' });
                animeStatusGroup.createEl('label', { text: '状态', attr: { for: 'status' } });
                const animeStatusSelect = animeStatusGroup.createEl('select', { attr: { id: 'status', name: 'status' } });
                animeStatusSelect.createEl('option', { value: 'unread', text: '待看/待读' });
                animeStatusSelect.createEl('option', { value: 'read', text: '已看/已读' });

                // 添加元数据
                this.addMetaFieldsSection(form);
                break;
            case 'music':
                this.createFormGroup(form, '乐评', 'description', true);

                // 添加网易云音乐搜索行
                const musicTitleRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(musicTitleRow, '歌名', 'title');
                this.addNeteaseMusicSearchButton(musicTitleRow);

                // 创建歌手和专辑在同一行
                const artistAlbumRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(artistAlbumRow, '歌手', 'artist');
                this.createInlineFormGroup(artistAlbumRow, '专辑', 'album');

                // 创建评分和年份在同一行
                const musicRatingYearRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(musicRatingYearRow, '评分', 'rating', false, { type: 'number' });
                this.createInlineFormGroup(musicRatingYearRow, '年份', 'year', false, { placeholder: 'YYYY' });

                this.createFormGroup(form, '封面', 'cover', false, { placeholder: '输入图片URL或者![](图片URL)' });

                // 创建链接字段
                this.createFormGroup(form, '链接', 'url', false, { placeholder: '输入https://格式、file:///格式、obsidian://格式链接' });

                // 添加本地文件路径格式化按钮
                const urlInput = this.container.querySelector('#url') as HTMLInputElement;
                if (urlInput) {
                    const urlGroup = urlInput.closest('.form-group') as HTMLElement;
                    if (urlGroup) {
                        const localFileButton = urlGroup.createEl('button', {
                            cls: 'local-file-button',
                            text: '转换本地路径'
                        });

                        localFileButton.addEventListener('click', (e) => {
                            e.preventDefault();
                            const currentPath = urlInput.value.trim();

                            if (currentPath) {
                                // 尝试格式化路径为正确的file:///格式
                                try {
                                    // 处理Windows路径格式 (例如 F:\桌面\music\file.flac)
                                    let formattedPath = currentPath;

                                    // 检查是否已经是file:///格式
                                    if (!formattedPath.startsWith('file:///')) {
                                        // 替换反斜杠为正斜杠
                                        formattedPath = formattedPath.replace(/\\/g, '/');

                                        // 确保路径开头有正确的盘符格式
                                        if (/^[a-zA-Z]:\//.test(formattedPath)) {
                                            // 添加file:///前缀
                                            formattedPath = 'file:///' + formattedPath;
                                        } else if (!formattedPath.startsWith('/')) {
                                            new Notice('无效的文件路径格式');
                                            return;
                                        } else if (!formattedPath.startsWith('file:///')) {
                                            // 对于以/开头但不是file:///开头的路径
                                            formattedPath = 'file://' + formattedPath;
                                        }
                                    }

                                    // 确保路径中的非ASCII字符（如中文）被正确处理
                                    // 注意：我们不在这里进行encodeURI，因为Electron在打开时会处理这个问题
                                    // 如果出现乱码问题，可以取消下面的注释来启用编码
                                    /*
                                    // 只对路径部分进行编码，保留file:///前缀
                                    if (formattedPath.startsWith('file:///')) {
                                        const pathPart = formattedPath.substring(8); // 跳过file:///
                                        const encodedPath = encodeURI(pathPart).replace(/%5C/g, '/');
                                        formattedPath = 'file:///' + encodedPath;
                                    }
                                    */

                                    // 更新输入框值
                                    urlInput.value = formattedPath;
                                    new Notice('路径已格式化为: ' + formattedPath);

                                    // 如果该路径是音频文件，尝试从文件名解析艺术家和标题信息
                                    const audioExtensions = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.opus'];
                                    const isAudioFile = audioExtensions.some(ext => formattedPath.toLowerCase().endsWith(ext));

                                    // 移除对已删除方法的调用
                                    // if (isAudioFile) {
                                    //     // 提取文件名部分
                                    //     const fileName = formattedPath.split('/').pop() || '';
                                    //     if (fileName) {
                                    //         this.tryParseFilename(fileName);
                                    //     }
                                    // }
                                } catch (error) {
                                    console.error('格式化路径出错:', error);
                                    new Notice('格式化路径出错: ' + error.message);
                                }
                            } else {
                                new Notice('请先输入文件路径');
                            }
                        });
                    }
                }

                this.createFormGroup(form, '标签', 'tags', false, { placeholder: '输入标签，如 #标签1 #标签2' });

                // 创建收录时间和状态在同一行
                const musicDateStatusRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(musicDateStatusRow, '收录', 'collection_date', false, { placeholder: 'YY-MM-DD', defaultValue: collectionDate });

                // 添加状态选择到行容器中
                const musicStatusGroup = musicDateStatusRow.createDiv({ cls: 'form-group-inline' });
                musicStatusGroup.createEl('label', { text: '状态', attr: { for: 'status' } });
                const musicStatusSelect = musicStatusGroup.createEl('select', { attr: { id: 'status', name: 'status' } });
                musicStatusSelect.createEl('option', { value: 'unread', text: '待看/待读' });
                musicStatusSelect.createEl('option', { value: 'read', text: '已看/已读' });

                // 添加自定义元数据字段
                this.addMetaFieldsSection(form);
                break;
        }

        // 在url字段创建之后添加一个本地文件路径选择按钮
        // 注意：已移除重复的链接字段

        // 移除重复的标签字段 - 每个卡片类型已经在自己的case中添加了标签字段
        // this.createFormGroup(form, '标签', 'tags');
    }

    // 添加一个新的辅助方法，用于创建内联表单组
    private createInlineFormGroup<T extends HTMLElement>(container: HTMLElement, label: string, id: string, isTextArea: boolean = false, options: { type?: string, placeholder?: string, defaultValue?: string } = {}): T {
        const formGroup = container.createDiv({ cls: 'form-group inline' });
        formGroup.createEl('label', { text: label, attr: { for: id } });

        let input: T;
        if (isTextArea) {
            input = formGroup.createEl('textarea', {
                attr: {
                    id,
                    placeholder: options.placeholder || `输入${label}...`
                }
            }) as unknown as T;
        } else {
            input = formGroup.createEl('input', {
                attr: {
                    id,
                    type: options.type || 'text',
                    placeholder: options.placeholder || `输入${label}...`
                }
            }) as unknown as T;
        }

        if (options.defaultValue) {
            (input as unknown as HTMLInputElement).value = options.defaultValue;
        }

        // 存储表单元素
        this.formElements[id] = input as unknown as HTMLElement;

        return input;
    }

    // 新增方法：添加保存按钮及其逻辑
    private addSaveButton(form: HTMLElement) {
        const actions = form.createDiv({ cls: 'quick-note-actions' });
        const saveButton = actions.createEl('button', {
            cls: 'quick-note-button primary save-button-container'
        });

        const buttonWrapper = saveButton.createDiv({ cls: 'buttonWrapper' });
        buttonWrapper.createSpan({ text: '保存' });

        // 添加鸟动画相关代码
        const birdBox = saveButton.createDiv({ cls: 'birdBox' });
        for (let i = 0; i < 3; i++) {
            const bird = birdBox.createDiv({ cls: 'bird' });
            bird.createDiv({ cls: 'birdFace' });
        }

        saveButton.addEventListener('click', async (e) => {
            e.preventDefault();
            await this.saveNote();
        });

        // 添加鸟动画相关事件监听器
        saveButton.addEventListener('mouseenter', () => {
            const birds = birdBox.querySelectorAll('.bird');
            birds.forEach(bird => bird.classList.add('wakeup'));
        });

        saveButton.addEventListener('mouseleave', () => {
            const birds = birdBox.querySelectorAll('.bird');
            birds.forEach(bird => bird.classList.remove('wakeup'));
        });
    }

    private createFormGroup<T extends HTMLElement>(container: HTMLElement, label: string, id: string, isTextArea: boolean = false, options: { type?: string, placeholder?: string, defaultValue?: string } = {}): T {
        const isLongField = ['content', 'description'].includes(id);
        const formGroup = container.createDiv({ cls: `form-group${!isLongField ? ' form-group-inline' : ''}` });
        formGroup.createEl('label', { text: label, attr: { for: id } });

        let input: T;
        if (isTextArea) {
            input = formGroup.createEl('textarea', {
                attr: {
                    id,
                    name: id,
                    placeholder: options.placeholder || `输入${label}...`
                }
            }) as unknown as T;
        } else {
            input = formGroup.createEl('input', {
                attr: {
                    id,
                    name: id,
                    type: options.type || 'text',
                    placeholder: options.placeholder || `输入${label}...`
                }
            }) as unknown as T;
        }

        if (options.defaultValue) {
            (input as unknown as HTMLInputElement).value = options.defaultValue;
        }

        // 存储表单元素
        this.formElements[id] = input as unknown as HTMLElement;

        return input;
    }

    // 添加自定义元数据字段区域
    private addMetaFieldsSection(form: HTMLElement) {
        // 创建标题和按钮的容器，使用水平布局
        const headerContainer = form.createDiv({ cls: 'meta-header-container' });

        // 创建自定义元数据区域的标题
        headerContainer.createEl('h3', {
            text: '自定义元数据',
            cls: 'meta-section-title'
        });

        // 添加按钮直接在标题容器中
        const addButton = headerContainer.createEl('button', {
            text: '添加元数据字段',
            cls: 'meta-add-button',
            attr: { type: 'button' }
        });

        // 创建元数据字段容器，默认隐藏
        const metaFieldsContainer = form.createDiv({
            cls: 'meta-fields-container',
            attr: { id: 'meta-fields-container' }
        });

        // 默认隐藏元数据字段容器
        metaFieldsContainer.style.display = 'none';

        // 添加按钮点击事件
        addButton.addEventListener('click', () => {
            // 如果容器是隐藏的，显示它并添加一个字段
            if (metaFieldsContainer.style.display === 'none') {
                metaFieldsContainer.style.display = 'flex';
                // 只有在第一次显示时添加一个空字段
                if (metaFieldsContainer.children.length === 0) {
                    this.addNewMetaField(metaFieldsContainer);
                }
            } else {
                // 如果已经显示，则添加新字段
                this.addNewMetaField(metaFieldsContainer);
            }
        });
    }

    // 添加新的元数据字段
    private addNewMetaField(container: HTMLElement) {
        const metaFieldGroup = container.createDiv({ cls: 'meta-field-group' });

        // 字段名输入框
        const keyInput = metaFieldGroup.createEl('input', {
            cls: 'meta-key-input',
            attr: {
                type: 'text',
                placeholder: '字段名',
                'data-meta-key': 'true'
            }
        });

        // 字段值输入框
        const valueInput = metaFieldGroup.createEl('input', {
            cls: 'meta-value-input',
            attr: {
                type: 'text',
                placeholder: '字段值',
                'data-meta-value': 'true'
            }
        });

        // 删除按钮
        const removeButton = metaFieldGroup.createEl('button', {
            text: '×',
            cls: 'meta-remove-button',
            attr: { type: 'button' }
        });

        // 删除按钮点击事件
        removeButton.addEventListener('click', () => {
            metaFieldGroup.remove();
        });
    }

    private async saveNote() {
        const content = (this.container.querySelector('#content, #description') as HTMLTextAreaElement)?.value;
        if (!content) return;

        let cardContent = '';
        // 只为闪念和摘录卡片添加标识行
        if (['idea', 'quote'].includes(this.type)) {
            const dateValue = (this.container.querySelector('#date') as HTMLInputElement)?.value || '';
            const tags = (this.container.querySelector('#tags') as HTMLInputElement)?.value || '#标签';
            const identifierLine = `${dateValue.split(' ')[0]} ${tags}`;
            cardContent = `${identifierLine}\n`;
        }

        cardContent += `\`\`\`${this.type}-card\n`; // 添加卡片类型标记

        // 根据不同类型构建卡片内容
        switch (this.type) {
            case 'idea':
                cardContent += `idea: ${content}\n`;
                cardContent += `source: ${(this.container.querySelector('#source') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `tags: ${(this.container.querySelector('#tags') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `url: ${(this.container.querySelector('#url') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `date: ${(this.container.querySelector('#date') as HTMLInputElement)?.value || ''}\n`; // Use value directly
                break;
            case 'quote':
                cardContent += `quote: ${content}\n`;
                cardContent += `source: ${(this.container.querySelector('#source') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `author: ${(this.container.querySelector('#author') as HTMLInputElement)?.value || ''}\n`; // Assuming author might be relevant for quote
                cardContent += `tags: ${(this.container.querySelector('#tags') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `url: ${(this.container.querySelector('#url') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `date: ${(this.container.querySelector('#date') as HTMLInputElement)?.value || ''}\n`; // Use value directly
                break;
            case 'movie':
            case 'book':
            case 'tv':
            case 'anime':
                cardContent += `description: ${content}\n`;
                cardContent += `title: ${(this.container.querySelector('#title') as HTMLInputElement)?.value || ''}\n`;
                if (this.type === 'book') {
                    cardContent += `author: ${(this.container.querySelector('#author') as HTMLInputElement)?.value || ''}\n`;
                } else {
                    cardContent += `director: ${(this.container.querySelector('#director') as HTMLInputElement)?.value || ''}\n`;
                }
                cardContent += `rating: ${(this.container.querySelector('#rating') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `cover: ${(this.container.querySelector('#cover') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `url: ${(this.container.querySelector('#url') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `tags: ${(this.container.querySelector('#tags') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `year: ${(this.container.querySelector('#year') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `collection_date: ${(this.container.querySelector('#collection_date') as HTMLInputElement)?.value || ''}\n`;

                // 收集自定义元数据字段
                const metaFields = this.collectMetaFields();
                if (Object.keys(metaFields).length > 0) {
                    for (const [key, value] of Object.entries(metaFields)) {
                        if (key && value) {
                            cardContent += `meta.${key}: ${value}\n`;
                        }
                    }
                }
                break;
            case 'music':
                cardContent += `description: ${content}\n`;
                cardContent += `title: ${(this.container.querySelector('#title') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `artist: ${(this.container.querySelector('#artist') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `album: ${(this.container.querySelector('#album') as HTMLInputElement)?.value || ''}\n`; // 添加专辑字段
                cardContent += `rating: ${(this.container.querySelector('#rating') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `cover: ${(this.container.querySelector('#cover') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `url: ${(this.container.querySelector('#url') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `tags: ${(this.container.querySelector('#tags') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `year: ${(this.container.querySelector('#year') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `collection_date: ${(this.container.querySelector('#collection_date') as HTMLInputElement)?.value || ''}\n`;

                // 收集自定义元数据字段
                const musicMetaFields = this.collectMetaFields();
                if (Object.keys(musicMetaFields).length > 0) {
                    for (const [key, value] of Object.entries(musicMetaFields)) {
                        if (key && value) {
                            cardContent += `meta.${key}: ${value}\n`;
                        }
                    }
                }
                break;
        }

        cardContent += '```'; // 移除末尾多余的换行符

        // 获取目标路径和文件名
        if (['movie', 'book', 'music', 'tv', 'anime'].includes(this.type)) {
            const title = (this.container.querySelector('#title') as HTMLInputElement)?.value;
            if (!title) return;

            const folderPath = this.plugin.settings.cardStoragePaths[`${this.type}Card`];
            const fileName = `${title}.md`;
            const fullPath = `${folderPath}/${fileName}`;

            // 创建文件夹（如果不存在）
            if (!await this.app.vault.adapter.exists(folderPath)) {
                await this.app.vault.createFolder(folderPath);
            }

            // 创建或更新文件
            let targetFile = this.app.vault.getAbstractFileByPath(fullPath);
            const status = (this.container.querySelector('#status') as HTMLSelectElement)?.value || 'unread';
            const frontmatter = `---\nstatus: ${status}\n---\n\n`;
            if (!targetFile) {
                targetFile = await this.app.vault.create(fullPath, frontmatter + cardContent);
            } else if (targetFile instanceof TFile) {
                await this.app.vault.modify(targetFile, frontmatter + cardContent);
            }
        } else {
            // 对于闪念和摘录卡片，保持原有的保存逻辑
            const targetFileName = this.plugin.settings.cardStoragePaths[`${this.type}Card`];
            let targetFile = this.app.vault.getAbstractFileByPath(targetFileName);

            if (!targetFile) {
                targetFile = await this.app.vault.create(targetFileName, '');
            }

            if (targetFile instanceof TFile) {
                const currentContent = await this.app.vault.read(targetFile);
                await this.app.vault.modify(targetFile, currentContent + '\n' + cardContent);
            }
        }

        // 清空表单
        const formInputs = this.container.querySelectorAll('input, textarea');
        // 获取当前时间
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        const day = now.getDate().toString().padStart(2, '0');
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const seconds = now.getSeconds().toString().padStart(2, '0');
        const currentDateTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        const collectionDate = `${year.toString().slice(-2)}-${month}-${day}`;
        formInputs.forEach((input: HTMLInputElement | HTMLTextAreaElement) => {
            if (input.id === 'date') {
                input.value = currentDateTime;
            } else if (input.id === 'collection_date') {
                input.value = collectionDate;
            } else {
                input.value = '';
            }
        });

        // 清空自定义元数据字段
        const metaFieldsContainer = this.container.querySelector('#meta-fields-container') as HTMLElement;
        if (metaFieldsContainer) {
            metaFieldsContainer.empty();
            // 添加一个空的元数据字段
            this.addNewMetaField(metaFieldsContainer);
        }
    }

    // 收集所有元数据字段
    private collectMetaFields(): Record<string, string> {
        const metaFields: Record<string, string> = {};

        // 获取所有元数据字段组
        const metaFieldGroups = this.container.querySelectorAll('.meta-field-group');

        metaFieldGroups.forEach((group) => {
            const keyInput = group.querySelector('[data-meta-key]') as HTMLInputElement;
            const valueInput = group.querySelector('[data-meta-value]') as HTMLInputElement;

            if (keyInput && valueInput && keyInput.value.trim() && valueInput.value.trim()) {
                metaFields[keyInput.value.trim()] = valueInput.value.trim();
            }
        });

        return metaFields;
    }

    // 添加豆瓣搜索按钮
    private addDoubanSearchButton(parent: HTMLElement, type: 'book' | 'movie') {
        const searchButtonContainer = parent.createDiv({ cls: 'douban-search-button-container' });
        const searchButton = searchButtonContainer.createEl('button', {
            cls: 'douban-search-button',
            text: '豆瓣搜索'
        });

        searchButton.addEventListener('click', async (e) => {
            e.preventDefault();

            // 获取输入的标题
            const titleInput = this.container.querySelector('#title') as HTMLInputElement;
            if (!titleInput || !titleInput.value) {
                new Notice('请先输入标题进行搜索');
                return;
            }

            // 显示加载状态
            searchButton.setText('搜索中...');
            searchButton.disabled = true;

            try {
                // 显示搜索开始通知
                new Notice(`正在搜索: ${titleInput.value}`);

                // 调用豆瓣API搜索
                const result = await DoubanAPI.search(titleInput.value, type);

                if (result.success && result.data && result.data.length > 0) {
                    this.doubanSearchResults = result.data;
                    this.showDoubanSearchResults();
                    new Notice(`找到 ${result.data.length} 个结果`);
                } else {
                    // 显示更详细的错误信息
                    if (result.error) {
                        new Notice(`搜索失败: ${result.error}`);
                        console.error('豆瓣搜索错误:', result.error);
                    } else {
                        new Notice('未找到相关结果，请尝试其他关键词');
                        console.log('豆瓣搜索未返回结果');
                    }
                }
            } catch (error) {
                console.error('豆瓣搜索出错:', error);
                new Notice(`搜索出错: ${error.message}`);
            } finally {
                // 恢复按钮状态
                searchButton.setText('豆瓣搜索');
                searchButton.disabled = false;
            }
        });
    }

    // 添加 TMDB 搜索按钮
    private addTMDBSearchButton(parent: HTMLElement, type: 'movie' | 'tv') {
        const searchButtonContainer = parent.createDiv({ cls: 'tmdb-search-button-container' });
        const searchButton = searchButtonContainer.createEl('button', {
            cls: 'tmdb-search-button',
            text: 'TMDB 搜索'
        });

        searchButton.addEventListener('click', async (e) => {
            e.preventDefault();

            const titleInput = this.container.querySelector('#title') as HTMLInputElement;
            if (!titleInput || !titleInput.value) {
                new Notice('请先输入标题进行搜索');
                return;
            }

            searchButton.setText('搜索中...');
            searchButton.disabled = true;

            try {
                new Notice(`正在搜索 TMDB: ${titleInput.value}`);
                const result = await TMDBAPI.search(titleInput.value, type);

                if (result.success && result.data && result.data.length > 0) {
                    this.tmdbSearchResults = result.data;
                    this.showTMDBSearchResults();
                    new Notice(`找到 ${result.data.length} 个结果`);
                } else {
                    new Notice(result.error || '未找到相关结果');
                }
            } catch (error) {
                console.error('TMDB 搜索出错:', error);
                new Notice(`搜索出错: ${error.message}`);
            } finally {
                searchButton.setText('TMDB 搜索');
                searchButton.disabled = false;
            }
        });
    }

    // 显示 TMDB 搜索结果弹窗
    private showTMDBSearchResults() {
        if (this.tmdbSearchModal) {
            this.tmdbSearchModal.remove();
        }

        this.tmdbSearchModal = document.createElement('div');
        this.tmdbSearchModal.className = 'douban-search-modal'; // 复用豆瓣模态框样式

        const modalHeader = this.tmdbSearchModal.createDiv({ cls: 'douban-modal-header' });
        modalHeader.createEl('h3', { text: 'TMDB 搜索结果' });

        const closeButton = modalHeader.createEl('button', { cls: 'douban-modal-close', text: '×' });
        closeButton.addEventListener('click', () => {
            this.tmdbSearchModal?.remove();
            this.tmdbSearchModal = null;
        });

        const resultsList = this.tmdbSearchModal.createDiv({ cls: 'douban-results-list' });

        if (this.tmdbSearchResults.length === 0) {
            resultsList.createEl('div', {
                cls: 'douban-no-results',
                text: '未找到相关结果'
            });
        } else {
            this.tmdbSearchResults.forEach((result) => {
                const resultItem = resultsList.createDiv({ cls: 'douban-result-item' });

                if (result.cover) {
                    resultItem.createEl('img', {
                        cls: 'douban-result-cover',
                        attr: { src: result.cover }
                    });
                } else {
                    const coverPlaceholder = resultItem.createDiv({ cls: 'douban-result-cover-placeholder' });
                    coverPlaceholder.createSpan({ text: '无封面' });
                }

                const resultInfo = resultItem.createDiv({ cls: 'douban-result-info' });
                const titleEl = resultInfo.createEl('h4', { text: result.title });
                titleEl.createSpan({
                    cls: 'douban-result-id',
                    text: `ID: ${result.id}`
                });

                const infoTexts = [];
                if (result.year) infoTexts.push(`${result.year}年`);
                if (result.type === 'movie') infoTexts.push('电影');
                else if (result.type === 'tv') infoTexts.push('剧集');

                if (infoTexts.length > 0) {
                    resultInfo.createEl('div', {
                        cls: 'douban-result-subinfo',
                        text: infoTexts.join(' · ')
                    });
                }

                if (result.url) {
                    const linkContainer = resultInfo.createDiv({ cls: 'douban-result-link-container' });
                    linkContainer.createEl('a', {
                        cls: 'douban-result-link',
                        text: '在 TMDB 查看',
                        attr: {
                            href: result.url,
                            target: '_blank',
                            rel: 'noopener noreferrer'
                        }
                    });
                }

                const selectButton = resultItem.createEl('button', {
                    cls: 'douban-result-select',
                    text: '选择'
                });

                selectButton.addEventListener('click', async () => {
                    this.tmdbSearchModal?.remove();
                    this.tmdbSearchModal = null;
                    await this.fillFormWithTMDBData(result.id, result.type);
                });
            });
        }

        document.body.appendChild(this.tmdbSearchModal);
    }

    // 用 TMDB 数据填充表单
    private async fillFormWithTMDBData(tmdbId: string, type: 'movie' | 'tv') {
        try {
            new Notice(`正在获取详情...`);
            const detail = await TMDBAPI.getDetail(tmdbId, type);

            if (!detail) {
                new Notice('获取详情失败');
                return;
            }

            // 1. 如果开启了设置且原语言是中文，尝试替换为豆瓣 URL
            const isChinese = detail.original_language === 'zh' || detail.original_language === 'cn' || detail.original_language?.startsWith('zh-');
            if (this.plugin.settings.useDoubanUrlForChineseTMDB && isChinese) {
                try {
                    const searchKeyword = detail.imdb_id || detail.original_title || detail.title;
                    if (searchKeyword) {
                        console.log(`正在尝试获取豆瓣链接，关键词: ${searchKeyword}`);
                        const doubanResult = await DoubanAPI.search(searchKeyword, 'movie');
                        if (doubanResult.success && doubanResult.data && doubanResult.data.length > 0) {
                            const bestMatch = doubanResult.data[0];
                            if (bestMatch.url) {
                                console.log(`已成功获取豆瓣链接: ${bestMatch.url}`);
                                detail.url = bestMatch.url;
                                new Notice('已自动切换为豆瓣链接');
                            }
                        } else {
                            console.log('未找到匹配的豆瓣条目');
                        }
                    }
                } catch (e) {
                    console.error('获取豆瓣链接失败:', e);
                }
            }

            // 2. 选择海报
            let selectedCover = detail.cover_url;
            if (detail.posters && detail.posters.length > 1) {
                selectedCover = await new Promise((resolve) => {
                    const modal = new PosterSelectionModal(this.app, detail.posters!, (url) => {
                        resolve(url);
                    });
                    modal.open();
                });
            }

            // 填充表单
            const titleInput = this.container.querySelector('#title') as HTMLInputElement;
            if (titleInput) titleInput.value = detail.title || '';

            const directorInput = this.container.querySelector('#director') as HTMLInputElement;
            if (directorInput && detail.director) directorInput.value = detail.director;

            const yearInput = this.container.querySelector('#year') as HTMLInputElement;
            if (yearInput && detail.year) yearInput.value = detail.year;

            const coverInput = this.container.querySelector('#cover') as HTMLInputElement;
            if (coverInput && selectedCover) coverInput.value = selectedCover;

            const urlInput = this.container.querySelector('#url') as HTMLInputElement;
            if (urlInput && detail.url) urlInput.value = detail.url;

            const ratingInput = this.container.querySelector('#rating') as HTMLInputElement;
            if (ratingInput && detail.rating?.value) ratingInput.value = detail.rating.value.toFixed(1);

            const tagsInput = this.container.querySelector('#tags') as HTMLInputElement;
            if (tagsInput && detail.tags && detail.tags.length > 0) {
                tagsInput.value = detail.tags.slice(0, 5).map(tag => `#${tag}`).join(' ');
            }

            const descInput = this.container.querySelector('#description') as HTMLTextAreaElement;
            if (descInput && !descInput.value && detail.description) {
                descInput.value = detail.description;
            }

            new Notice('已成功填充数据');
        } catch (error) {
            console.error('填充 TMDB 数据出错:', error);
            new Notice(`填充数据时出错: ${error.message}`);
        }
    }

    // 显示豆瓣搜索结果弹窗
    private showDoubanSearchResults() {
        // 如果已经有弹窗，先移除
        if (this.doubanSearchModal) {
            this.doubanSearchModal.remove();
        }

        // 创建弹窗
        this.doubanSearchModal = document.createElement('div');
        this.doubanSearchModal.className = 'douban-search-modal';

        // 创建弹窗标题
        const modalHeader = this.doubanSearchModal.createDiv({ cls: 'douban-modal-header' });
        modalHeader.createEl('h3', { text: '豆瓣搜索结果' });

        // 创建关闭按钮
        const closeButton = modalHeader.createEl('button', { cls: 'douban-modal-close', text: '×' });
        closeButton.addEventListener('click', () => {
            this.doubanSearchModal?.remove();
            this.doubanSearchModal = null;
        });

        // 创建结果列表
        const resultsList = this.doubanSearchModal.createDiv({ cls: 'douban-results-list' });

        if (this.doubanSearchResults.length === 0) {
            resultsList.createEl('div', {
                cls: 'douban-no-results',
                text: '未找到相关结果，请尝试调整搜索关键词'
            });
        } else {
            // 添加搜索结果
            this.doubanSearchResults.forEach((result) => {
                const resultItem = resultsList.createDiv({ cls: 'douban-result-item' });

                // 添加封面图片
                if (result.cover) {
                    resultItem.createEl('img', {
                        cls: 'douban-result-cover',
                        attr: { src: result.cover }
                    });
                } else {
                    // 如果没有封面，创建一个占位符
                    const coverPlaceholder = resultItem.createDiv({ cls: 'douban-result-cover-placeholder' });
                    coverPlaceholder.createSpan({ text: '无封面' });
                }

                // 添加标题和其他信息
                const resultInfo = resultItem.createDiv({ cls: 'douban-result-info' });

                // 标题
                const titleEl = resultInfo.createEl('h4', { text: result.title });

                // 添加ID作为小标签
                titleEl.createSpan({
                    cls: 'douban-result-id',
                    text: `ID: ${result.id}`
                });

                // 年份和创作者信息
                const infoTexts = [];
                if (result.year) infoTexts.push(`${result.year}年`);
                if (result.creator) {
                    infoTexts.push(result.type === 'movie' ? `导演: ${result.creator}` : `作者: ${result.creator}`);
                }

                if (infoTexts.length > 0) {
                    resultInfo.createEl('div', {
                        cls: 'douban-result-subinfo',
                        text: infoTexts.join(' · ')
                    });
                }

                // 添加豆瓣链接
                if (result.url) {
                    const linkContainer = resultInfo.createDiv({ cls: 'douban-result-link-container' });
                    const linkEl = linkContainer.createEl('a', {
                        cls: 'douban-result-link',
                        text: '在豆瓣查看',
                        attr: {
                            href: result.url,
                            target: '_blank',
                            rel: 'noopener noreferrer'
                        }
                    });
                }

                // 添加选择按钮
                const selectButton = resultItem.createEl('button', {
                    cls: 'douban-result-select',
                    text: '选择'
                });

                // 选择按钮点击事件
                selectButton.addEventListener('click', async () => {
                    await this.fillFormWithDoubanData(result.id, result.type);
                    this.doubanSearchModal?.remove();
                    this.doubanSearchModal = null;
                });
            });
        }

        // 将弹窗添加到页面
        document.body.appendChild(this.doubanSearchModal);
    }

    // 用豆瓣数据填充表单
    private async fillFormWithDoubanData(doubanId: string, type: string) {
        try {
            new Notice(`正在获取详情...`);
            console.log(`开始填充豆瓣数据，ID: ${doubanId}, 类型: ${type}`);

            let detail: DoubanItemDetail | null = null;

            // 根据类型获取详情
            if (type === 'movie') {
                detail = await DoubanAPI.getMovieDetail(doubanId);
            } else if (type === 'book') {
                detail = await DoubanAPI.getBookDetail(doubanId);
            }

            if (!detail) {
                // 如果获取详情失败，尝试使用搜索结果中的信息
                const selectedResult = this.doubanSearchResults.find(r => r.id === doubanId);
                if (selectedResult) {
                    console.log(`使用搜索结果填充表单:`, selectedResult);
                    detail = {
                        title: selectedResult.title,
                        cover_url: selectedResult.cover,
                        url: selectedResult.url,
                        year: selectedResult.year,
                        director: selectedResult.creator,
                        author: type === 'book' ? [selectedResult.creator] : undefined
                    };
                    new Notice('无法获取完整详情，将使用基本信息填充');
                } else {
                    new Notice('获取详情失败');
                    return;
                }
            } else {
                console.log(`成功获取详情:`, detail);
            }

            console.log(`准备填充表单，详情:`, detail);

            // 填充表单
            const titleInput = this.container.querySelector('#title') as HTMLInputElement;
            if (titleInput) {
                console.log(`填充标题: ${detail.title}`);
                titleInput.value = detail.title || '';
            } else {
                console.log('未找到标题输入框');
            }

            // 填充导演/作者
            if (this.type === 'movie' || this.type === 'tv' || this.type === 'anime') {
                const directorInput = this.container.querySelector('#director') as HTMLInputElement;
                if (directorInput && detail.director) {
                    console.log(`填充导演: ${detail.director}`);
                    directorInput.value = detail.director;
                } else {
                    console.log(`未找到导演输入框或导演信息为空`);
                }
            } else if (this.type === 'book') {
                const authorInput = this.container.querySelector('#author') as HTMLInputElement;
                if (authorInput && detail.author && detail.author.length > 0) {
                    const authorText = detail.author.join(', ');
                    console.log(`填充作者: ${authorText}`);
                    authorInput.value = authorText;
                } else {
                    console.log(`未找到作者输入框或作者信息为空`);
                }
            }

            // 填充年份
            const yearInput = this.container.querySelector('#year') as HTMLInputElement;
            if (yearInput && detail.year) {
                console.log(`填充年份: ${detail.year}`);
                yearInput.value = detail.year;
            } else {
                console.log(`未找到年份输入框或年份信息为空`);
            }

            // 填充封面
            const coverInput = this.container.querySelector('#cover') as HTMLInputElement;
            if (coverInput && detail.cover_url) {
                console.log(`填充封面: ${detail.cover_url}`);
                coverInput.value = detail.cover_url;
            } else {
                console.log(`未找到封面输入框或封面URL为空`);
            }

            // 填充链接
            const urlInput = this.container.querySelector('#url') as HTMLInputElement;
            if (urlInput && detail.url) {
                console.log(`填充链接: ${detail.url}`);
                urlInput.value = detail.url;
            } else {
                console.log(`未找到链接输入框或链接为空`);
            }

            // 填充评分
            const ratingInput = this.container.querySelector('#rating') as HTMLInputElement;
            if (ratingInput && detail.rating && detail.rating.value) {
                console.log(`填充评分: ${detail.rating.value}`);
                ratingInput.value = detail.rating.value.toString();
            } else {
                console.log(`未找到评分输入框或评分信息为空`);
            }

            // 填充标签
            const tagsInput = this.container.querySelector('#tags') as HTMLInputElement;
            if (tagsInput && detail.tags && detail.tags.length > 0) {
                // 最多取5个标签，并转换为#标签格式
                const formattedTags = detail.tags.slice(0, 5).map(tag => `#${tag}`).join(' ');
                console.log(`填充标签: ${formattedTags}`);
                tagsInput.value = formattedTags;
            } else {
                console.log(`未找到标签输入框或标签为空`);
            }

            // 填充描述
            if (detail.description) {
                const descInput = this.container.querySelector('#description') as HTMLTextAreaElement;
                if (descInput && !descInput.value) {
                    // 只有在描述为空时才填充，避免覆盖用户已输入的内容
                    console.log(`填充描述: ${detail.description.substring(0, 50)}...`);
                    descInput.value = detail.description;
                } else {
                    console.log(`未找到描述输入框或描述已有内容`);
                }
            }

            new Notice('已成功填充数据');
        } catch (error) {
            console.error('填充豆瓣数据出错:', error);
            new Notice(`填充数据时出错: ${error.message}`);
        }
    }

    // 修改addNeteaseMusicSearchButton方法，使用MusicTagAPI替代NeteaseMusicAPI
    private addNeteaseMusicSearchButton(parent: HTMLElement) {
        const searchButtonContainer = parent.createDiv({ cls: 'neteasemusic-search-button-container' });

        // 数据源选择下拉菜单
        const sourceSelect = searchButtonContainer.createEl('select', {
            cls: 'music-source-select',
            attr: { title: '选择音乐数据源' }
        });

        // 添加数据源选项
        const sources = MusicTagAPI.getAvailableSources();
        for (const source of sources) {
            const displayName = this.getSourceDisplayName(source);
            sourceSelect.createEl('option', { value: source, text: displayName });
        }

        // 设置当前选中的数据源
        sourceSelect.value = MusicTagAPI.getCurrentSource();

        // 数据源变更事件
        sourceSelect.addEventListener('change', () => {
            MusicTagAPI.setDataSource(sourceSelect.value);
        });

        // 搜索按钮
        const searchButton = searchButtonContainer.createEl('button', {
            cls: 'neteasemusic-search-button',
            text: '音乐搜索'
        });

        searchButton.addEventListener('click', async (e) => {
            e.preventDefault();

            // 获取输入的标题
            const titleInput = this.container.querySelector('#title') as HTMLInputElement;
            if (!titleInput || !titleInput.value) {
                new Notice('请先输入歌名进行搜索');
                return;
            }

            // 显示加载状态
            searchButton.setText('搜索中...');
            searchButton.disabled = true;

            try {
                // 显示搜索开始通知
                const currentSource = MusicTagAPI.getCurrentSource();
                new Notice(`正在使用${this.getSourceDisplayName(currentSource)}搜索: ${titleInput.value}`);

                // 调用MusicTagAPI搜索
                const result = await MusicTagAPI.search(titleInput.value);

                if (result.success && result.data && result.data.length > 0) {
                    this.neteaseMusicSearchResults = result.data;
                    this.showMusicTagSearchResults();
                    new Notice(`找到 ${result.data.length} 个结果`);
                } else {
                    // 显示更详细的错误信息
                    if (result.error) {
                        new Notice(`搜索失败: ${result.error}`);
                        console.error('音乐搜索错误:', result.error);
                    } else {
                        new Notice('未找到相关结果，请尝试其他关键词');
                        console.log('音乐搜索未返回结果');
                    }
                }
            } catch (error) {
                console.error('音乐搜索出错:', error);
                new Notice(`搜索出错: ${error.message}`);
            } finally {
                // 恢复按钮状态
                searchButton.setText('音乐搜索');
                searchButton.disabled = false;
            }
        });
    }

    // 获取数据源的显示名称
    private getSourceDisplayName(source: string): string {
        const sourceNames: { [key: string]: string } = {
            'netease': '网易云',
            'kugou': '酷狗',
            'kuwo': '酷我',
            'qq': 'QQ',
            'migu': '咪咕'
        };

        return sourceNames[source] || source;
    }

    // 显示音乐搜索结果弹窗
    private showMusicTagSearchResults() {
        // 如果已经有弹窗，先移除
        if (this.neteaseMusicSearchModal) {
            this.neteaseMusicSearchModal.remove();
        }

        // 创建弹窗
        this.neteaseMusicSearchModal = document.createElement('div');
        this.neteaseMusicSearchModal.className = 'neteasemusic-search-modal';

        // 创建模态框内容容器
        const modalContent = this.neteaseMusicSearchModal.createDiv();

        // 创建弹窗标题
        const modalHeader = modalContent.createDiv({ cls: 'neteasemusic-modal-header' });
        modalHeader.createEl('h3', { text: '音乐搜索结果' });

        // 创建关闭按钮
        const closeButton = modalHeader.createEl('button', { cls: 'neteasemusic-modal-close', text: '×' });
        closeButton.addEventListener('click', () => {
            this.neteaseMusicSearchModal?.remove();
            this.neteaseMusicSearchModal = null;
        });

        // 创建结果列表
        const resultsList = modalContent.createDiv({ cls: 'neteasemusic-results-list' });

        if (this.neteaseMusicSearchResults.length === 0) {
            resultsList.createEl('div', {
                cls: 'neteasemusic-no-results',
                text: '未找到相关结果，请尝试调整搜索关键词'
            });
        } else {
            // 添加搜索结果
            this.neteaseMusicSearchResults.forEach((result) => {
                const resultItem = resultsList.createDiv({ cls: 'neteasemusic-result-item' });

                // 添加封面图片
                if (result.cover && typeof result.cover === 'string' && result.cover.trim() !== '') {
                    console.log(`尝试加载封面图片: ${result.cover}`);

                    // 修复网易云音乐图片URL可能的问题
                    let coverUrl = result.cover;

                    // 确保URL使用HTTPS
                    if (coverUrl.startsWith('http://')) {
                        coverUrl = coverUrl.replace('http://', 'https://');
                    }

                    // 对于网易云的图片，可以添加参数控制尺寸
                    if (coverUrl.includes('music.126.net')) {
                        // 添加参数?param=60y60以获取适当大小的图片
                        if (!coverUrl.includes('?param=')) {
                            coverUrl = `${coverUrl}?param=60y60`;
                        }
                    }

                    console.log(`处理后的封面URL: ${coverUrl}`);

                    // 创建封面容器
                    const coverContainer = resultItem.createDiv({ cls: 'neteasemusic-cover-container' });

                    // 创建图片元素
                    const coverImg = coverContainer.createEl('img', {
                        cls: 'neteasemusic-result-cover',
                        attr: {
                            src: coverUrl,
                            alt: `${result.title} 封面`,
                            // 添加crossorigin属性以解决可能的跨域问题
                            crossorigin: 'anonymous'
                        }
                    });

                    // 处理图片加载失败
                    coverImg.addEventListener('error', (e) => {
                        console.error(`封面图片加载失败: ${coverUrl}`, e);
                        coverImg.style.display = 'none';
                        const placeholder = coverContainer.createDiv({ cls: 'neteasemusic-result-cover-placeholder' });
                        placeholder.createSpan({ text: '封面加载失败' });
                    });

                    // 添加加载成功的日志
                    coverImg.addEventListener('load', () => {
                        console.log(`封面图片加载成功: ${coverUrl}`);
                    });
                } else {
                    // 如果没有封面，创建一个占位符
                    const coverPlaceholder = resultItem.createDiv({ cls: 'neteasemusic-result-cover-placeholder' });
                    coverPlaceholder.createSpan({ text: '无封面' });
                }

                // 添加标题和其他信息
                const resultInfo = resultItem.createDiv({ cls: 'neteasemusic-result-info' });

                // 标题
                const titleEl = resultInfo.createEl('h4', { text: result.title });

                // 添加ID作为小标签
                titleEl.createSpan({
                    cls: 'neteasemusic-result-id',
                    text: `ID: ${result.id}`
                });

                // 添加数据源标签
                if (result.source) {
                    titleEl.createSpan({
                        cls: 'neteasemusic-result-source',
                        text: this.getSourceDisplayName(result.source)
                    });
                }

                // 年份和歌手信息
                const infoTexts = [];
                if (result.artist) infoTexts.push(`歌手: ${result.artist}`);
                if (result.album) infoTexts.push(`专辑: ${result.album}`);
                if (result.year) infoTexts.push(`${result.year}年`);

                if (infoTexts.length > 0) {
                    resultInfo.createEl('div', {
                        cls: 'neteasemusic-result-subinfo',
                        text: infoTexts.join(' · ')
                    });
                }

                // 添加链接
                if (result.url) {
                    const linkContainer = resultInfo.createDiv({ cls: 'neteasemusic-result-link-container' });
                    const linkEl = linkContainer.createEl('a', {
                        cls: 'neteasemusic-result-link',
                        text: `在${result.source ? this.getSourceDisplayName(result.source) : '音乐平台'}查看`,
                        attr: {
                            href: result.url,
                            target: '_blank',
                            rel: 'noopener noreferrer'
                        }
                    });
                }

                // 添加选择按钮
                const selectButton = resultItem.createEl('button', {
                    cls: 'neteasemusic-result-select',
                    text: '选择'
                });

                // 选择按钮点击事件
                selectButton.addEventListener('click', async () => {
                    await this.fillFormWithMusicTagData(result.id, result.source || 'netease');
                    this.neteaseMusicSearchModal?.remove();
                    this.neteaseMusicSearchModal = null;
                });
            });
        }

        // 将弹窗添加到页面
        document.body.appendChild(this.neteaseMusicSearchModal);
    }

    // 用音乐标签数据填充表单
    private async fillFormWithMusicTagData(songId: string, source: string = 'netease') {
        try {
            new Notice(`正在获取详情...`);
            console.log(`开始填充音乐数据，ID: ${songId}, 数据源: ${source}`);

            // 获取歌曲详情
            const detail = await MusicTagAPI.getSongDetail(songId, source);

            if (!detail) {
                // 如果获取详情失败，尝试使用搜索结果中的信息
                const selectedResult = this.neteaseMusicSearchResults.find(r => r.id === songId);
                if (selectedResult) {
                    console.log(`使用搜索结果填充表单:`, selectedResult);
                    // 填充表单
                    const titleInput = this.container.querySelector('#title') as HTMLInputElement;
                    if (titleInput) {
                        console.log(`填充标题: ${selectedResult.title}`);
                        titleInput.value = selectedResult.title || '';
                    }

                    const artistInput = this.container.querySelector('#artist') as HTMLInputElement;
                    if (artistInput) {
                        console.log(`填充歌手: ${selectedResult.artist}`);
                        artistInput.value = selectedResult.artist || '';
                    }

                    const albumInput = this.container.querySelector('#album') as HTMLInputElement;
                    if (albumInput && selectedResult.album) {
                        console.log(`填充专辑: ${selectedResult.album}`);
                        albumInput.value = selectedResult.album;
                    }

                    const yearInput = this.container.querySelector('#year') as HTMLInputElement;
                    if (yearInput && selectedResult.year) {
                        console.log(`填充年份: ${selectedResult.year}`);
                        yearInput.value = selectedResult.year;
                    }

                    const coverInput = this.container.querySelector('#cover') as HTMLInputElement;
                    if (coverInput && selectedResult.cover) {
                        console.log(`填充封面: ${selectedResult.cover}`);
                        coverInput.value = selectedResult.cover;
                    }

                    const urlInput = this.container.querySelector('#url') as HTMLInputElement;
                    if (urlInput && selectedResult.url) {
                        console.log(`填充链接: ${selectedResult.url}`);
                        urlInput.value = selectedResult.url;
                    }

                    new Notice('无法获取完整详情，已使用基本信息填充');
                } else {
                    new Notice('获取详情失败');
                }
                return;
            }

            console.log(`成功获取详情:`, detail);

            // 填充表单
            const titleInput = this.container.querySelector('#title') as HTMLInputElement;
            if (titleInput) {
                console.log(`填充标题: ${detail.title}`);
                titleInput.value = detail.title || '';
            }

            const artistInput = this.container.querySelector('#artist') as HTMLInputElement;
            if (artistInput) {
                console.log(`填充歌手: ${detail.artist}`);
                artistInput.value = detail.artist || '';
            }

            const albumInput = this.container.querySelector('#album') as HTMLInputElement;
            if (albumInput && detail.album) {
                console.log(`填充专辑: ${detail.album}`);
                albumInput.value = detail.album;
            }

            const yearInput = this.container.querySelector('#year') as HTMLInputElement;
            if (yearInput && detail.year) {
                console.log(`填充年份: ${detail.year}`);
                yearInput.value = detail.year;
            }

            const coverInput = this.container.querySelector('#cover') as HTMLInputElement;
            if (coverInput && detail.cover_url) {
                console.log(`填充封面: ${detail.cover_url}`);
                coverInput.value = detail.cover_url;
            }

            const urlInput = this.container.querySelector('#url') as HTMLInputElement;
            if (urlInput && detail.url) {
                console.log(`填充链接: ${detail.url}`);
                urlInput.value = detail.url;
            }

            // 填充标签
            const tagsInput = this.container.querySelector('#tags') as HTMLInputElement;
            if (tagsInput && detail.tags && detail.tags.length > 0) {
                // 最多取5个标签，并转换为#标签格式
                const formattedTags = detail.tags.slice(0, 5).map(tag => `#${tag}`).join(' ');
                console.log(`填充标签: ${formattedTags}`);
                tagsInput.value = formattedTags;
            }

            // 填充描述
            if (detail.description) {
                const descInput = this.container.querySelector('#description') as HTMLTextAreaElement;
                if (descInput && !descInput.value) {
                    // 只有在描述为空时才填充，避免覆盖用户已输入的内容
                    console.log(`填充歌词/描述: ${detail.description.substring(0, 50)}...`);
                    descInput.value = detail.description;
                }
            }

            new Notice('已成功填充数据');
        } catch (error) {
            console.error('填充音乐数据出错:', error);
            new Notice(`填充数据时出错: ${error.message}`);
        }
    }

    // 添加Bangumi搜索按钮
    private addBangumiSearchButton(container: HTMLElement) {
        const buttonContainer = container.createDiv({ cls: 'bangumi-search-button-container' });
        const searchButton = buttonContainer.createEl('button', {
            text: '搜索Bangumi',
            cls: 'bangumi-search-button'
        });

        searchButton.addEventListener('click', async () => {
            const titleInput = this.formElements['title'] as HTMLInputElement;
            if (!titleInput || !titleInput.value) {
                new Notice('请先输入番名');
                return;
            }

            searchButton.disabled = true;
            searchButton.textContent = '搜索中...';

            try {
                const results = await this.plugin.bangumiAPI.search(titleInput.value);
                if (results.length === 0) {
                    new Notice('未找到相关番剧');
                    return;
                }

                this.bangumiSearchResults = results;
                this.showBangumiSearchResults();
            } catch (error) {
                console.error('Bangumi搜索出错:', error);
                new Notice('搜索失败，请稍后重试');
            } finally {
                searchButton.disabled = false;
                searchButton.textContent = '搜索Bangumi';
            }
        });
    }

    // 显示Bangumi搜索结果
    private showBangumiSearchResults() {
        if (this.bangumiSearchModal) {
            document.body.removeChild(this.bangumiSearchModal);
        }

        this.bangumiSearchModal = document.createElement('div');
        this.bangumiSearchModal.className = 'bangumi-search-modal';

        // 创建模态框头部
        const modalHeader = document.createElement('div');
        modalHeader.className = 'bangumi-modal-header';

        const modalTitle = document.createElement('h3');
        modalTitle.textContent = 'Bangumi搜索结果';
        modalHeader.appendChild(modalTitle);

        const closeButton = document.createElement('button');
        closeButton.className = 'bangumi-modal-close';
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', () => {
            if (this.bangumiSearchModal) {
                document.body.removeChild(this.bangumiSearchModal);
                this.bangumiSearchModal = null;
            }
        });
        modalHeader.appendChild(closeButton);

        this.bangumiSearchModal.appendChild(modalHeader);

        // 创建结果列表容器
        const resultsList = document.createElement('div');
        resultsList.className = 'bangumi-results-list';

        if (!this.bangumiSearchResults || this.bangumiSearchResults.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'bangumi-no-results';
            noResults.textContent = '未找到相关结果';
            resultsList.appendChild(noResults);
        } else {
            this.bangumiSearchResults.forEach((item, index) => {
                // 跳过下一页选项
                if (item.typeId === 3) {
                    const nextPageItem = document.createElement('div');
                    nextPageItem.className = 'bangumi-result-item bangumi-next-page';
                    nextPageItem.textContent = '加载更多结果...';
                    nextPageItem.addEventListener('click', async () => {
                        if (this.bangumiSearchModal) {
                            document.body.removeChild(this.bangumiSearchModal);
                            this.bangumiSearchModal = null;
                        }

                        try {
                            const urlObj = new URL(item.link);
                            const page = parseInt(urlObj.searchParams.get('page') || '1');
                            const keyword = urlObj.pathname.split('/').pop() || '';

                            const results = await this.plugin.bangumiAPI.search(decodeURIComponent(keyword), page);
                            this.bangumiSearchResults = results;
                            this.showBangumiSearchResults();
                        } catch (error) {
                            console.error('获取下一页结果出错:', error);
                            new Notice('获取更多结果失败');
                        }
                    });
                    resultsList.appendChild(nextPageItem);
                    return;
                }

                const resultItem = document.createElement('div');
                resultItem.className = 'bangumi-result-item';

                // 内容容器
                const contentContainer = document.createElement('div');
                contentContainer.className = 'bangumi-result-content';
                contentContainer.innerHTML = item.text.replace(/\n/g, '<br>');

                resultItem.appendChild(contentContainer);

                // 选择按钮
                const selectButton = document.createElement('button');
                selectButton.className = 'bangumi-result-select';
                selectButton.textContent = '选择';
                selectButton.addEventListener('click', async () => {
                    // 显示加载中状态
                    selectButton.disabled = true;
                    selectButton.textContent = '加载中...';

                    try {
                        const animeDetail = await this.plugin.bangumiAPI.getAnimeDetail(item.link);
                        if (animeDetail) {
                            this.fillFormWithBangumiData(animeDetail);
                        } else {
                            new Notice('获取番剧详情失败');
                        }
                    } catch (error) {
                        console.error('获取番剧详情出错:', error);
                        new Notice('获取番剧详情失败');
                    } finally {
                        if (this.bangumiSearchModal) {
                            document.body.removeChild(this.bangumiSearchModal);
                            this.bangumiSearchModal = null;
                        }
                    }
                });

                resultItem.appendChild(selectButton);
                resultsList.appendChild(resultItem);
            });
        }

        this.bangumiSearchModal.appendChild(resultsList);
        document.body.appendChild(this.bangumiSearchModal);
    }

    // 用Bangumi数据填充表单
    private fillFormWithBangumiData(data: any) {
        if (this.formElements['title']) {
            (this.formElements['title'] as HTMLInputElement).value = data.title || '';
        }

        if (this.formElements['director']) {
            (this.formElements['director'] as HTMLInputElement).value = data.director || '';
        }

        if (this.formElements['year']) {
            (this.formElements['year'] as HTMLInputElement).value = data.year || '';
        }

        if (this.formElements['rating']) {
            (this.formElements['rating'] as HTMLInputElement).value = data.rating || '';
        }

        if (this.formElements['url']) {
            (this.formElements['url'] as HTMLInputElement).value = data.url || '';
        }

        if (this.formElements['cover']) {
            (this.formElements['cover'] as HTMLInputElement).value = data.cover || '';
        }

        // 注意：根据用户要求，标签和评论字段不进行自动填充

        // 处理元数据
        if (data.meta) {
            // 清除现有的元数据字段
            const metaContainer = this.container.querySelector('.meta-fields-container') as HTMLElement;
            if (metaContainer) {
                metaContainer.empty();
                this.addNewMetaField(metaContainer);

                // 添加番剧特有的元数据
                Object.entries(data.meta).forEach(([key, value], index) => {
                    if (index > 0) {
                        this.addNewMetaField(metaContainer);
                    }

                    const metaRows = metaContainer.querySelectorAll('.meta-field-group');
                    const lastRow = metaRows[metaRows.length - 1] as HTMLElement;

                    const keyInput = lastRow.querySelector('[data-meta-key]') as HTMLInputElement;
                    const valueInput = lastRow.querySelector('[data-meta-value]') as HTMLInputElement;

                    if (keyInput && valueInput) {
                        keyInput.value = key;
                        valueInput.value = value as string;
                    }
                });
            }
        }
    }
}

class PosterSelectionModal extends Modal {
    private posters: string[];
    private onChoose: (url: string) => void;

    constructor(app: App, posters: string[], onChoose: (url: string) => void) {
        super(app);
        this.posters = posters;
        this.onChoose = onChoose;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h3', { text: '请选择封面海报' });

        const grid = contentEl.createDiv({ cls: 'tmdb-poster-grid' });
        grid.style.display = 'grid';
        grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(120px, 1fr))';
        grid.style.gap = '10px';
        grid.style.marginTop = '20px';

        this.posters.forEach((url) => {
            const item = grid.createDiv({ cls: 'tmdb-poster-item' });
            item.style.cursor = 'pointer';
            item.style.border = '2px solid transparent';
            item.style.borderRadius = '4px';
            item.style.overflow = 'hidden';
            item.style.transition = 'border-color 0.2s';

            const img = item.createEl('img', {
                attr: { src: url.replace('/original/', '/w342/') } // 使用更小的分辨率预览
            });
            img.style.width = '100%';
            img.style.height = 'auto';
            img.style.display = 'block';

            item.addEventListener('mouseenter', () => {
                item.style.borderColor = 'var(--interactive-accent)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.borderColor = 'transparent';
            });

            item.addEventListener('click', () => {
                this.onChoose(url);
                this.close();
            });
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}