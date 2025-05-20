import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import type NewCardsPlugin from '../main';

export const VIEW_TYPE_QUICK_NOTE = 'quick-note-view';

export class QuickNoteView extends ItemView {
    private plugin: NewCardsPlugin;
    private container: HTMLElement;
    private type: 'idea' | 'quote' | 'movie' | 'book' | 'music' | 'tv' | 'anime' = 'idea';

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

        switch (type) {
            case 'idea':
                this.createFormGroup(form, '想法', 'content', true);
                this.createFormGroup(form, '标签', 'tags');
                this.createFormGroup(form, 'URL', 'url');
                this.createFormGroup(form, '感于', 'source');
                this.createFormGroup(form, '日期', 'date', false, 'text', 'YYYY-MM-DD HH:mm:ss', currentDateTime);
                break;
            case 'quote':
                this.createFormGroup(form, '摘录', 'content', true);
                this.createFormGroup(form, '来源', 'source');
                this.createFormGroup(form, '标签', 'tags');
                this.createFormGroup(form, 'URL', 'url');
                this.createFormGroup(form, '日期', 'date', false, 'text', 'YYYY-MM-DD HH:mm:ss', currentDateTime);
                break;
            case 'movie':
                this.createFormGroup(form, '影评', 'description', true);
                this.createFormGroup(form, '名称', 'title');
                this.createFormGroup(form, '导演', 'director');
                this.createFormGroup(form, '评分', 'rating', false, 'number');
                this.createFormGroup(form, '封面', 'cover');
                this.createFormGroup(form, 'URL', 'url');
                this.createFormGroup(form, '标签', 'tags');
                // For movie, book, music, keep using only date as default if needed, or adjust as required.
                this.createFormGroup(form, '年份', 'year', false, 'text', 'YYYY-MM-DD');
                break;
            case 'book':
                this.createFormGroup(form, '书评', 'description', true);
                this.createFormGroup(form, '书名', 'title');
                this.createFormGroup(form, '作者', 'author');
                this.createFormGroup(form, '评分', 'rating', false, 'number');
                this.createFormGroup(form, '封面', 'cover');
                this.createFormGroup(form, 'URL', 'url');
                this.createFormGroup(form, '标签', 'tags');
                this.createFormGroup(form, '年份', 'year', false, 'text', 'YYYY-MM-DD');
                break;
            case 'music':
                this.createFormGroup(form, '乐评', 'description', true);
                this.createFormGroup(form, '歌名', 'title');
                this.createFormGroup(form, '歌手', 'artist');
                this.createFormGroup(form, '评分', 'rating', false, 'number');
                this.createFormGroup(form, '封面', 'cover');
                this.createFormGroup(form, 'URL', 'url');
                this.createFormGroup(form, '标签', 'tags');
                this.createFormGroup(form, '年份', 'year', false, 'text', 'YYYY-MM-DD');
                break;
            case 'tv':
                this.createFormGroup(form, '剧评', 'description', true);
                this.createFormGroup(form, '剧名', 'title');
                this.createFormGroup(form, '导演', 'director');
                this.createFormGroup(form, '评分', 'rating', false, 'number');
                this.createFormGroup(form, '封面', 'cover');
                this.createFormGroup(form, 'URL', 'url');
                this.createFormGroup(form, '标签', 'tags');
                this.createFormGroup(form, '年份', 'year', false, 'text', 'YYYY-MM-DD');
                break;
            case 'anime':
                this.createFormGroup(form, '评论', 'description', true);
                this.createFormGroup(form, '番名', 'title');
                this.createFormGroup(form, '导演', 'director');
                this.createFormGroup(form, '评分', 'rating', false, 'number');
                this.createFormGroup(form, '封面', 'cover');
                this.createFormGroup(form, 'URL', 'url');
                this.createFormGroup(form, '标签', 'tags');
                this.createFormGroup(form, '年份', 'year', false, 'text', 'YYYY-MM-DD');
                break;
        }
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

    private async saveNote() {
        const content = (this.container.querySelector('#content, #description') as HTMLTextAreaElement)?.value;
        if (!content) return;

        let identifierLine = '';
        const tags = (this.container.querySelector('#tags') as HTMLInputElement)?.value || '#标签'; // 默认标签

        // 根据类型确定日期/年份字段和格式
        if (['idea', 'quote'].includes(this.type)) {
            const dateValue = (this.container.querySelector('#date') as HTMLInputElement)?.value || '';
            identifierLine = `${dateValue.split(' ')[0]} ${tags}`; // 取日期部分
        } else {
            const yearValue = (this.container.querySelector('#year') as HTMLInputElement)?.value || new Date().getFullYear().toString();
            identifierLine = `${yearValue} ${tags}`;
        }

        let cardContent = `${identifierLine}\n\`\`\`${this.type}-card\n`; // 将标识行添加到卡片内容之前

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
                cardContent += `description: ${content}\n`;
                cardContent += `title: ${(this.container.querySelector('#title') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `director: ${(this.container.querySelector('#director') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `rating: ${(this.container.querySelector('#rating') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `cover: ${(this.container.querySelector('#cover') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `url: ${(this.container.querySelector('#url') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `tags: ${(this.container.querySelector('#tags') as HTMLInputElement)?.value || ''}\n`;
                // Keep using 'year' for movie/book/music date field ID if that's intended
                cardContent += `year: ${(this.container.querySelector('#year') as HTMLInputElement)?.value || ''}\n`;
                break;
            case 'book':
                cardContent += `description: ${content}\n`;
                cardContent += `title: ${(this.container.querySelector('#title') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `author: ${(this.container.querySelector('#author') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `rating: ${(this.container.querySelector('#rating') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `cover: ${(this.container.querySelector('#cover') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `url: ${(this.container.querySelector('#url') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `tags: ${(this.container.querySelector('#tags') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `year: ${(this.container.querySelector('#year') as HTMLInputElement)?.value || ''}\n`;
                break;
            case 'music':
                cardContent += `description: ${content}\n`;
                cardContent += `title: ${(this.container.querySelector('#title') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `artist: ${(this.container.querySelector('#artist') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `rating: ${(this.container.querySelector('#rating') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `cover: ${(this.container.querySelector('#cover') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `url: ${(this.container.querySelector('#url') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `tags: ${(this.container.querySelector('#tags') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `year: ${(this.container.querySelector('#year') as HTMLInputElement)?.value || ''}\n`;
                break;
            case 'tv':
                cardContent += `description: ${content}\n`;
                cardContent += `title: ${(this.container.querySelector('#title') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `director: ${(this.container.querySelector('#director') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `rating: ${(this.container.querySelector('#rating') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `cover: ${(this.container.querySelector('#cover') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `url: ${(this.container.querySelector('#url') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `tags: ${(this.container.querySelector('#tags') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `year: ${(this.container.querySelector('#year') as HTMLInputElement)?.value || ''}\n`;
                break;
            case 'anime':
                cardContent += `description: ${content}\n`;
                cardContent += `title: ${(this.container.querySelector('#title') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `director: ${(this.container.querySelector('#director') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `rating: ${(this.container.querySelector('#rating') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `cover: ${(this.container.querySelector('#cover') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `url: ${(this.container.querySelector('#url') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `tags: ${(this.container.querySelector('#tags') as HTMLInputElement)?.value || ''}\n`;
                cardContent += `year: ${(this.container.querySelector('#year') as HTMLInputElement)?.value || ''}\n`;
                break;
        }

        cardContent += '```'; // 移除末尾多余的换行符

        // 获取目标文件
        const targetFileName = this.plugin.settings.cardStoragePaths[`${this.type}Card`];
        let targetFile = this.app.vault.getAbstractFileByPath(targetFileName);

        if (!targetFile) {
            // 如果文件不存在，创建新文件
            targetFile = await this.app.vault.create(targetFileName, '');
        }

        // 追加内容到文件
        if (targetFile instanceof TFile) {
            const currentContent = await this.app.vault.read(targetFile);
            await this.app.vault.modify(targetFile, currentContent + '\n' + cardContent);
        }

        // 清空表单
        const formInputs = this.container.querySelectorAll('input, textarea');
        formInputs.forEach((input: HTMLInputElement | HTMLTextAreaElement) => {
            input.value = '';
        });
    }

}