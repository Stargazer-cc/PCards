import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import type NewCardsPlugin from '../main';
import { DoubanAPI, DoubanItemDetail } from './DoubanAPI';

export const VIEW_TYPE_QUICK_NOTE = 'quick-note-view';

export class QuickNoteView extends ItemView {
    private plugin: NewCardsPlugin;
    private container: HTMLElement;
    private type: 'idea' | 'quote' | 'movie' | 'book' | 'music' | 'tv' | 'anime' = 'idea';
    private doubanSearchResults: any[] = [];
    private doubanSearchModal: HTMLElement | null = null;

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
        return 'bulb';
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
            { type: 'idea', text: '想法' },
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
        this.type = newType;
        activeBtn.classList.add('active');
        inactiveButtons.forEach(btn => btn.classList.remove('active'));

        // 清除现有表单
        const form = this.container.querySelector('.quick-note-form') as HTMLElement;
        if (form) {
            form.empty();

            // 根据类型创建不同的表单字段
            this.buildFormFields(form, newType);
           

            // 重新添加保存按钮
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
                this.createFormGroup(form, '想法', 'content', true);
                this.createFormGroup(form, '标签', 'tags');
                this.createFormGroup(form, '链接', 'url');
                this.createFormGroup(form, '感于', 'source');
                this.createFormGroup(form, '日期', 'date', false, 'text', 'YYYY-MM-DD HH:mm:ss', currentDateTime);
                break;
            case 'quote':
                this.createFormGroup(form, '摘录', 'content', true);
                this.createFormGroup(form, '来源', 'source');
                this.createFormGroup(form, '标签', 'tags');
                this.createFormGroup(form, '链接', 'url');
                this.createFormGroup(form, '日期', 'date', false, 'text', 'YYYY-MM-DD HH:mm:ss', currentDateTime);
                break;
            case 'movie':
                this.createFormGroup(form, '影评', 'description', true);
                
                // 添加豆瓣搜索行
                const movieTitleRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(movieTitleRow, '名称', 'title');
                this.addDoubanSearchButton(movieTitleRow, 'movie');
                
                this.createFormGroup(form, '导演', 'director');
                
                // 创建评分和年份在同一行
                const movieRatingYearRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(movieRatingYearRow, '评分', 'rating', 'number');
                this.createInlineFormGroup(movieRatingYearRow, '年份', 'year', 'text', 'YYYY');
                
                this.createFormGroup(form, '封面', 'cover');
                this.createFormGroup(form, '链接', 'url');
                this.createFormGroup(form, '标签', 'tags');
                
                // 创建收录时间和状态在同一行
                const movieDateStatusRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(movieDateStatusRow, '收录', 'collection_date', 'text', 'YY-MM-DD', collectionDate);
                
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
                this.createInlineFormGroup(bookRatingYearRow, '评分', 'rating', 'number');
                this.createInlineFormGroup(bookRatingYearRow, '年份', 'year', 'text', 'YYYY');
                
                this.createFormGroup(form, '封面', 'cover');
                this.createFormGroup(form, '链接', 'url');
                this.createFormGroup(form, '标签', 'tags');
                
                // 创建收录时间和状态在同一行
                const bookDateStatusRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(bookDateStatusRow, '收录', 'collection_date', 'text', 'YY-MM-DD', collectionDate);
                
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
                
                // 添加豆瓣搜索行
                const tvTitleRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(tvTitleRow, '剧名', 'title');
                this.addDoubanSearchButton(tvTitleRow, 'movie'); // 豆瓣剧集也在movie分类下
                
                this.createFormGroup(form, '导演', 'director');
                
                // 创建评分和年份在同一行
                const tvRatingYearRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(tvRatingYearRow, '评分', 'rating', 'number');
                this.createInlineFormGroup(tvRatingYearRow, '年份', 'year', 'text', 'YYYY');
                
                this.createFormGroup(form, '封面', 'cover');
                this.createFormGroup(form, '链接', 'url');
                this.createFormGroup(form, '标签', 'tags');
                
                // 创建收录时间和状态在同一行
                const tvDateStatusRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(tvDateStatusRow, '收录', 'collection_date', 'text', 'YY-MM-DD', collectionDate);
                
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
                this.createFormGroup(form, '评论', 'description', true);
                
                // 添加豆瓣搜索行
                const animeTitleRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(animeTitleRow, '番名', 'title');
                this.addDoubanSearchButton(animeTitleRow, 'movie'); // 豆瓣番剧也在movie分类下
                
                this.createFormGroup(form, '导演', 'director');
                
                // 创建评分和年份在同一行
                const animeRatingYearRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(animeRatingYearRow, '评分', 'rating', 'number');
                this.createInlineFormGroup(animeRatingYearRow, '年份', 'year', 'text', 'YYYY');
                
                this.createFormGroup(form, '封面', 'cover');
                this.createFormGroup(form, '链接', 'url');
                this.createFormGroup(form, '标签', 'tags');
                
                // 创建收录时间和状态在同一行
                const animeDateStatusRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(animeDateStatusRow, '收录', 'collection_date', 'text', 'YY-MM-DD', collectionDate);
                
                // 添加状态选择到行容器中
                const animeStatusGroup = animeDateStatusRow.createDiv({ cls: 'form-group-inline' });
                animeStatusGroup.createEl('label', { text: '状态', attr: { for: 'status' } });
                const animeStatusSelect = animeStatusGroup.createEl('select', { attr: { id: 'status', name: 'status' } });    
                animeStatusSelect.createEl('option', { value: 'unread', text: '待看/待读' });
                animeStatusSelect.createEl('option', { value: 'read', text: '已看/已读' });
                
                // 添加自定义元数据字段
                this.addMetaFieldsSection(form);
                break;
            case 'music':
                this.createFormGroup(form, '乐评', 'description', true);
                this.createFormGroup(form, '歌名', 'title');
                this.createFormGroup(form, '歌手', 'artist');
                
                // 创建评分和年份在同一行
                const musicRatingYearRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(musicRatingYearRow, '评分', 'rating', 'number');
                this.createInlineFormGroup(musicRatingYearRow, '年份', 'year', 'text', 'YYYY');
                
                this.createFormGroup(form, '封面', 'cover');
                this.createFormGroup(form, '链接', 'url');
                this.createFormGroup(form, '标签', 'tags');
                
                // 创建收录时间和状态在同一行
                const musicDateStatusRow = form.createDiv({ cls: 'form-row' });
                this.createInlineFormGroup(musicDateStatusRow, '收录', 'collection_date', 'text', 'YY-MM-DD', collectionDate);
                
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
    }

    // 添加一个新的辅助方法，用于创建内联表单组
    private createInlineFormGroup(parent: HTMLElement, labelText: string, inputId: string, inputType: string = 'text', placeholder?: string, defaultValue?: string) {
        const group = parent.createDiv({ cls: 'form-group-inline' });
        group.createEl('label', { text: labelText, attr: { for: inputId } });
        const input = group.createEl('input', { 
            attr: { 
                id: inputId, 
                name: inputId, 
                type: inputType, 
                placeholder: placeholder || '' 
            } 
        });
        if (defaultValue) input.value = defaultValue;
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

    private createFormGroup(parent: HTMLElement, labelText: string, inputId: string, isTextarea: boolean = false, inputType: string = 'text', placeholder?: string, defaultValue?: string) {
        const isLongField = ['content', 'description'].includes(inputId);
        const group = parent.createDiv({ cls: `form-group${!isLongField ? ' form-group-inline' : ''}` });
        group.createEl('label', { text: labelText, attr: { for: inputId } });
        if (isTextarea) {
            const textarea = group.createEl('textarea', { attr: { id: inputId, name: inputId, placeholder: placeholder || '' } });
            textarea.style.whiteSpace = 'pre-wrap';
            if (defaultValue) textarea.value = defaultValue;
        } else {
            const input = group.createEl('input', { attr: { id: inputId, name: inputId, type: inputType, placeholder: placeholder || '' } });
            if (defaultValue) input.value = defaultValue;
        }
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
        // 只为想法和摘录卡片添加标识行
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
            case 'music':
            case 'tv':
            case 'anime':
                cardContent += `description: ${content}\n`;
                cardContent += `title: ${(this.container.querySelector('#title') as HTMLInputElement)?.value || ''}\n`;
                if (this.type === 'book') {
                    cardContent += `author: ${(this.container.querySelector('#author') as HTMLInputElement)?.value || ''}\n`;
                } else if (this.type === 'music') {
                    cardContent += `artist: ${(this.container.querySelector('#artist') as HTMLInputElement)?.value || ''}\n`;
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
            // 对于想法和摘录卡片，保持原有的保存逻辑
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
        formInputs.forEach((input: HTMLInputElement | HTMLTextAreaElement) => {
            input.value = '';
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
}