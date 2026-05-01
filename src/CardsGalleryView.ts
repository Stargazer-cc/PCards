import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import { CardUtils, CardLocation } from './utils';
import type NewCardsPlugin from '../main';
import Swiper from 'swiper';

export const VIEW_TYPE_CARDS_GALLERY = 'cards-gallery-view';

export class CardsGalleryView extends ItemView {
    private plugin: NewCardsPlugin;
    private container: HTMLElement;
    private columnCount: number;
    private hiddenFields: Set<string>;
    private selectedCardTypes: Set<string>;
    private displayMode: 'card' | 'poster' | 'timeline' | 'carousel' = 'card';
    private previousDisplayMode: 'card' | 'poster' | 'timeline' | 'carousel' = 'card';
    private savedWindowSizes: Record<string, {width?: number, height?: number}> = {};
    private ideaSwiper: Swiper | null = null;
    private quoteSwiper: Swiper | null = null;
    private filterDefinition: {
        conjunction: 'and' | 'or';
        conditions: Array<{
            field: string;
            operator: string;
            value: string;
            enabled: boolean;
        }>;
    } = {
        conjunction: 'and',
        conditions: []
    };
    private sortDefinition: {
        criteria: Array<{
            field: string;
            order: 'asc' | 'desc';
            enabled: boolean;
        }>;
    };

    private loadSettings() {
        const settings = this.plugin.settings.gallerySettings;
        this.columnCount = settings.columnCount;
        this.hiddenFields = new Set(settings.hiddenFields);
        this.selectedCardTypes = new Set(settings.selectedCardTypes || ['all']);
        this.displayMode = settings.displayMode || 'card';
        this.previousDisplayMode = this.displayMode;
        this.filterDefinition = settings.filterDefinition || { conjunction: 'and', conditions: [] };
        this.sortDefinition = settings.sortDefinition || { criteria: [] };
        this.savedWindowSizes = settings.savedWindowSizes || {};
    }

    private saveSettings() {
        this.plugin.settings.gallerySettings = {
            columnCount: this.columnCount,
            hiddenFields: Array.from(this.hiddenFields),
            selectedCardType: Array.from(this.selectedCardTypes)[0] || 'all',
            selectedCardTypes: Array.from(this.selectedCardTypes),
            sortField: 'year',
            displayMode: this.displayMode,
            filterDefinition: this.filterDefinition,
            sortDefinition: this.sortDefinition,
            savedWindowSizes: this.savedWindowSizes
        };
        this.plugin.saveSettings();
    }

    constructor(leaf: WorkspaceLeaf, plugin: NewCardsPlugin) {
        super(leaf);
        this.plugin = plugin;
        this.loadSettings();
    }

    getViewType(): string {
        return VIEW_TYPE_CARDS_GALLERY;
    }

    getDisplayText(): string {
        return '卡片总览';
    }

    getIcon(): string {
        return 'door-open';
    }

    async onOpen() {
        this.container = this.containerEl.children[1] as HTMLElement;
        this.container.empty();
        this.container.addClass('cards-gallery-container');

        // 设置初始隐藏字段
        this.container.setAttribute('data-hidden-fields', Array.from(this.hiddenFields).join(' '));
        
        // 设置初始显示模式
        this.container.setAttribute('data-display-mode', this.displayMode);
        
        // 应用保存的窗口大小
        setTimeout(() => {
            this.applyWindowSize();
        }, 300); // 延迟一点应用窗口大小，确保视图已完全加载

        // 添加控制按钮容器
        const controlsContainer = this.container.createDiv({ cls: 'gallery-controls' });

        // 添加刷新按钮
        const refreshButton = controlsContainer.createEl('button', {
            text: '刷新索引',
            cls: 'gallery-refresh-button'
        });

        refreshButton.addEventListener('click', async () => {
            // 显示遍历提示
            const notice = new Notice('遍历笔记中，请稍后...', 0);
            
            try {
                // 获取所有笔记文件
                const files = this.plugin.app.vault.getMarkdownFiles();
                let processedCount = 0;
                
                // 先加载现有索引
                const newIndex = await CardUtils.loadCardIndex(this.plugin.app.vault);
                
                // 遍历所有笔记文件
                for (const file of files) {
                    try {
                        // 读取文件内容
                        const content = await this.plugin.app.vault.read(file);
                        
                        // 查找所有卡片内容
                        const cardRegex = /```([\w-]+)\n([\s\S]*?)```/g;
                        let match;
                        let lineCount = 0;
                        const lines = content.split('\n');
                        
                        // 计算每个匹配项的起始行和结束行
                        while ((match = cardRegex.exec(content)) !== null) {
                            const cardType = match[1];
                            // 只处理有效的卡片类型
                            if (!cardType.endsWith('-card')) continue;
                            
                            const cardContent = match[0]; // 包含整个卡片内容，包括 ``` 标记
                            const cid = CardUtils.generateCID(cardContent);
                            
                            // 计算起始行和结束行
                            const matchStart = content.substring(0, match.index).split('\n').length - 1;
                            const matchEnd = matchStart + cardContent.split('\n').length;
                            
                            // 创建位置信息
                            const location: CardLocation = {
                                path: file.path,
                                startLine: matchStart,
                                endLine: matchEnd
                            };
                            
                            // 更新索引
                            if (!newIndex[cid]) {
                                newIndex[cid] = {
                                    content: cardContent,
                                    locations: [location],
                                    lastUpdated: new Date().toISOString()
                                };
                            } else {
                                // 清理同一文件中的旧位置记录
                                newIndex[cid].locations = newIndex[cid].locations.filter(loc => loc.path !== file.path);
                                // 添加新的位置信息
                                newIndex[cid].locations.push(location);
                                newIndex[cid].lastUpdated = new Date().toISOString();
                            }
                        }
                    } catch (error) {
                        console.error(`处理文件 ${file.path} 时出错:`, error);
                        continue; // 继续处理下一个文件
                    }
                    
                    // 更新进度
                    processedCount++;
                    notice.setMessage(`遍历笔记中，请稍后... (${processedCount}/${files.length})`);
                }
                
                // 保存新的索引
                await CardUtils.saveCardIndex(this.plugin.app.vault, newIndex);
                
                // 关闭遍历提示
                notice.hide();
                
                // 显示完成提示
                new Notice('已完成遍历，索引已重构');
                
                // 刷新卡片显示
                this.renderCards();
                
            } catch (error) {
                console.error('更新索引失败:', error);
                notice.hide();
                new Notice('更新索引失败，请查看控制台获取详细信息');
            }
        });

        // 添加显示模式切换下拉菜单
        const modeControl = controlsContainer.createDiv({ cls: 'gallery-mode-control' });
        const modeToggle = modeControl.createEl('button', {
            text: this.displayMode === 'card' ? '卡片模式' : this.displayMode === 'poster' ? '海报墙模式' : this.displayMode === 'timeline' ? '时间轴模式' : '轮播模式',
            cls: 'gallery-mode-toggle'
        });
        const modeDropdown = modeControl.createDiv({ cls: 'gallery-mode-dropdown' });
        const modes = [
            { id: 'card', text: '卡片模式' },
            { id: 'poster', text: '海报墙模式' },
            { id: 'timeline', text: '时间轴模式' },
            { id: 'carousel', text: '轮播模式' }
        ];
        modes.forEach(mode => {
            const option = modeDropdown.createEl('button', {
                text: mode.text,
                cls: `mode-option ${this.displayMode === mode.id ? 'active' : ''}`
            });
            option.addEventListener('click', async () => {
                await this.switchDisplayMode(mode.id as 'card' | 'poster' | 'timeline' | 'carousel');
                modeToggle.setText(mode.text);
                modeDropdown.querySelectorAll('.mode-option').forEach(el => {
                    el.classList.remove('active');
                });
                option.classList.add('active');
                modeDropdown.classList.remove('show');
            });
        });
        modeToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            modeDropdown.classList.toggle('show');
        });
        document.addEventListener('click', (e) => {
            if (!modeControl.contains(e.target as Node)) {
                modeDropdown.classList.remove('show');
            }
        });

        // 移除"全部类型"和"书籍影视"选项，只保留具体类型
        const types = [
            { id: 'music-card', text: '音乐' },
            { id: 'book-card', text: '书籍' },
            { id: 'movie-card', text: '电影' },
            { id: 'tv-card', text: '剧集' },
            { id: 'anime-card', text: '番剧' },
            { id: 'idea-card', text: '闪念' },
            { id: 'quote-card', text: '摘录' }
        ];

        // 初始化selectedCardTypes为全选（如为空）
        if (!this.selectedCardTypes || this.selectedCardTypes.size === 0) {
            this.selectedCardTypes = new Set(types.map(t => t.id));
        }
        // 类型下拉菜单（多选复选框）
        const typeControl = controlsContainer.createDiv({ cls: 'gallery-type-control' });
        const currentTypeText = (() => {
            const typesText = types.filter(type => this.selectedCardTypes.has(type.id)).map(type => type.text);
            return typesText.length === types.length ? '全部类型' : (typesText.length > 0 ? typesText.join('、') : '全部类型');
        })();
        const typeToggle = typeControl.createEl('button', {
            text: currentTypeText,
            cls: 'gallery-type-toggle'
        });
        const typeDropdown = typeControl.createDiv({ cls: 'gallery-type-dropdown' });
        types.forEach(type => {
            const typeOption = typeDropdown.createDiv({ cls: 'type-option' });
            const checkbox = typeOption.createEl('input', { type: 'checkbox' });
            checkbox.checked = this.selectedCardTypes.has(type.id);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.selectedCardTypes.add(type.id);
                } else {
                    this.selectedCardTypes.delete(type.id);
                }
                // 如果全都没选，自动全选
                if (this.selectedCardTypes.size === 0) {
                    types.forEach(t => this.selectedCardTypes.add(t.id));
                }
                // 更新按钮文本
                const typesText = types.filter(t => this.selectedCardTypes.has(t.id)).map(t => t.text);
                typeToggle.textContent = this.selectedCardTypes.size === types.length ? '全部类型' : (typesText.length > 0 ? typesText.join('、') : '全部类型');
                this.plugin.settings.gallerySettings.selectedCardTypes = Array.from(this.selectedCardTypes);
                this.plugin.settings.gallerySettings.selectedCardType = Array.from(this.selectedCardTypes)[0] || types[0].id;
                this.plugin.saveSettings();
                this.renderCards();
            });
            typeOption.createSpan({ text: type.text });
        });
        typeToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            typeDropdown.classList.toggle('show');
        });
        document.addEventListener('click', (e) => {
            if (!typeControl.contains(e.target as Node)) {
                typeDropdown.classList.remove('show');
            }
        });

        // 添加字段控制
        const fieldsControl = controlsContainer.createDiv({ cls: 'gallery-fields-control' });
        const fieldsToggle = fieldsControl.createEl('button', {
            text: '显示字段',
            cls: 'gallery-fields-toggle'
        });

        // 创建字段选择下拉菜单
        const fieldsDropdown = fieldsControl.createDiv({ cls: 'gallery-fields-dropdown' });
        const fields = ['description', 'year', 'rating', 'tags', 'meta', 'collection_date', 'status'];
        
        const fieldLabels: { [key: string]: string } = {
            'description': '描述',
            'year': '年份',
            'rating': '评分',
            'tags': '标签',
            'meta': '元信息',
            'collection_date': '收录时间',
            'status': '阅读状态'
        };
        
        fields.forEach(field => {
            const fieldOption = fieldsDropdown.createDiv({ cls: 'field-option' });
            const checkbox = fieldOption.createEl('input', {
                type: 'checkbox',
                attr: { id: `field-${field}` }
            });
            fieldOption.createEl('label', {
                text: fieldLabels[field],
                attr: { for: `field-${field}` }
            });

            checkbox.checked = !this.hiddenFields.has(field);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    this.hiddenFields.delete(field);
                } else {
                    this.hiddenFields.add(field);
                }
                this.container.setAttribute('data-hidden-fields', Array.from(this.hiddenFields).join(' '));
                this.plugin.settings.gallerySettings.hiddenFields = Array.from(this.hiddenFields);
                this.plugin.saveSettings();
                this.renderCards();
            });
        });

        // 添加字段切换按钮点击事件
        fieldsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            fieldsDropdown.classList.toggle('show');
        });

        // 点击其他区域关闭下拉菜单
        document.addEventListener('click', (e) => {
            if (!fieldsControl.contains(e.target as Node)) {
                fieldsDropdown.classList.remove('show');
            }
        });

        // 添加筛选控制
        const filterControl = controlsContainer.createDiv({ cls: 'gallery-filter-control' });
        const filterToggle = filterControl.createEl('button', {
            text: '筛选',
            cls: 'gallery-filter-toggle'
        });

        // 创建筛选模态框
        const filterModal = this.containerEl.createDiv({ cls: 'gallery-modal filter-modal' });
        const filterModalContent = filterModal.createDiv({ cls: 'gallery-modal-content' });
        
        // 添加模态框标题
        const filterModalTitle = filterModalContent.createDiv({ cls: 'modal-title' });
        filterModalTitle.createSpan({ text: '筛选设置' });

        // 筛选字段定义
        const filterFields = [
            { field: 'year', text: '年份' },
            { field: 'rating', text: '评分' },
            { field: 'lastUpdate', text: '更新时间' },
            { field: 'title', text: '标题' },
            { field: 'description', text: '描述' },
            { field: 'collection_date', text: '收录时间' },
            { field: 'tags', text: '标签' }
        ];

        // 创建筛选条件添加界面
        const addFilterContainer = filterModalContent.createDiv({ cls: 'add-filter-container' });
        const fieldSelect = addFilterContainer.createEl('select', { cls: 'field-select' });
        filterFields.forEach(field => {
            const option = fieldSelect.createEl('option', {
                value: field.field,
                text: field.text
            });
        });

        const operatorSelect = addFilterContainer.createEl('select', { cls: 'operator-select' });
        const operators = [
            { value: 'contains', text: '包含' },
            { value: 'equals', text: '等于' },
            { value: 'greater', text: '大于' },
            { value: 'less', text: '小于' }
        ];
        operators.forEach(op => {
            operatorSelect.createEl('option', {
                value: op.value,
                text: op.text
            });
        });

        // 创建值输入框
        const valueInput = addFilterContainer.createEl('input', {
            type: 'text',
            cls: 'value-input',
            placeholder: '输入值'
        });

        const addButton = addFilterContainer.createEl('button', {
            text: '添加',
            cls: 'add-filter-button'
        });

        // 添加筛选条件
        const addFilterCondition = (field: string, operator: string, value: string) => {
            this.filterDefinition.conditions.push({
                field,
                operator,
                value,
                enabled: true
            });
            this.plugin.settings.gallerySettings.filterDefinition = this.filterDefinition;
            this.plugin.saveSettings();
            this.renderCards();
            this.updateFilterDisplayUI();
        };

        // 移除筛选条件
        const removeFilterCondition = (index: number) => {
            this.filterDefinition.conditions.splice(index, 1);
            this.plugin.settings.gallerySettings.filterDefinition = this.filterDefinition;
            this.plugin.saveSettings();
            this.renderCards();
            this.updateFilterDisplayUI();
        };

        addButton.addEventListener('click', () => {
            const field = fieldSelect.value;
            const operator = operatorSelect.value;
            const value = valueInput.value;
            if (field && operator && value) {
                addFilterCondition(field, operator, value);
                valueInput.value = '';
            }
        });

        // 显示当前筛选条件
        const activeFiltersContainer = filterModalContent.createDiv({ cls: 'active-filters' });

        // 更新筛选显示
        const updateFilterDisplay = () => {
            this.updateFilterDisplayUI();
        };

        updateFilterDisplay();
        
        // 添加元数据筛选部分（移到更靠后的位置）
        const metaFilterContainer = filterModalContent.createDiv({ cls: 'meta-filter-container' });
        const metaFilterTitle = metaFilterContainer.createEl('h3', { 
            text: '元数据筛选', 
            cls: 'meta-filter-title' 
        });
        
        // 创建元数据字段和值选择界面
        const metaFieldContainer = metaFilterContainer.createDiv({ cls: 'meta-field-container' });
        const metaFieldSelect = metaFieldContainer.createEl('select', { 
            cls: 'meta-field-select',
            attr: { placeholder: '选择元数据字段' }
        });
        
        // 添加默认选项
        metaFieldSelect.createEl('option', {
            value: '',
            text: '选择元数据字段',
            attr: { selected: true, disabled: true }
        });
        
        // 获取所有卡片的元数据字段
        this.loadMetaFields(metaFieldSelect);
        
        const metaOperatorSelect = metaFieldContainer.createEl('select', { cls: 'meta-operator-select' });
        
        // 添加操作符选项
        const metaOperators = [
            { value: 'contains', text: '包含' },
            { value: 'equals', text: '等于' },
            { value: 'greater', text: '大于' },
            { value: 'less', text: '小于' }
        ];
        
        metaOperators.forEach(op => {
            metaOperatorSelect.createEl('option', {
                value: op.value,
                text: op.text
            });
        });
        
        const metaValueInput = metaFieldContainer.createEl('input', {
            type: 'text',
            cls: 'meta-value-input',
            placeholder: '输入值'
        });
        
        const addMetaFilterButton = metaFieldContainer.createEl('button', {
            text: '添加',
            cls: 'add-meta-filter-button'
        });
        
        // 添加元数据筛选按钮点击事件
        addMetaFilterButton.addEventListener('click', () => {
            const metaField = metaFieldSelect.value;
            const operator = metaOperatorSelect.value;
            const value = metaValueInput.value;
            
            if (metaField && operator && value) {
                // 构建meta.字段名格式的字段值
                const fullField = `meta.${metaField}`;
                
                // 添加筛选条件
                addFilterCondition(fullField, operator, value);
                
                // 重置输入
                metaValueInput.value = '';
            }
        });

        // 添加阅读状态筛选
        const statusFilterContainer = filterModalContent.createDiv({ cls: 'status-filter-container' });
        statusFilterContainer.createSpan({ text: '阅读状态：' });
        const statusSelect = statusFilterContainer.createEl('select', { cls: 'status-select' });
        
        // 添加全部选项
        statusSelect.createEl('option', {
            value: '',
            text: '全部'
        });
        
        // 添加已阅和待阅选项
        ['已阅', '待阅'].forEach(status => {
            statusSelect.createEl('option', {
                value: status,
                text: status
            });
        });

        // 设置初始值
        const statusCondition = this.filterDefinition.conditions.find(c => c.field === 'status');
        if (statusCondition) {
            statusSelect.value = statusCondition.value;
        }

        // 添加事件监听
        statusSelect.addEventListener('change', () => {
            // 移除现有的状态筛选条件
            this.filterDefinition.conditions = this.filterDefinition.conditions.filter(c => c.field !== 'status');
            
            // 如果选择了状态，添加新的筛选条件
            if (statusSelect.value) {
                this.filterDefinition.conditions.push({
                    field: 'status',
                    operator: 'equals',
                    value: statusSelect.value,
                    enabled: true
                });
            }
            
            this.plugin.settings.gallerySettings.filterDefinition = this.filterDefinition;
            this.plugin.saveSettings();
            this.renderCards();
            this.updateFilterDisplayUI();
        });

        // 添加筛选按钮点击事件
        filterToggle.addEventListener('click', () => {
            filterModal.classList.add('show');
            
            // 每次打开筛选面板时，重新加载元数据字段
            const metaFieldSelect = this.containerEl.querySelector('.meta-field-select') as HTMLSelectElement;
            if (metaFieldSelect) {
                this.loadMetaFields(metaFieldSelect);
            }
        });

        // 点击模态框外部关闭
        filterModal.addEventListener('click', (e) => {
            if (e.target === filterModal) {
                filterModal.classList.remove('show');
            }
        });

        // 添加排序控制
        const sortControl = controlsContainer.createDiv({ cls: 'gallery-sort-control' });
        const sortToggle = sortControl.createEl('button', {
            text: '排序',
            cls: 'gallery-sort-toggle'
        });

        // 创建排序模态框
        const sortModal = this.containerEl.createDiv({ cls: 'gallery-modal sort-modal' });
        const sortModalContent = sortModal.createDiv({ cls: 'gallery-modal-content' });

        // 添加模态框标题
        const sortModalTitle = sortModalContent.createDiv({ cls: 'modal-title' });
        sortModalTitle.createSpan({ text: '排序设置' });

        const sortFields = [
            { field: 'year', text: '年份' },
            { field: 'rating', text: '评分' },
            { field: 'lastUpdate', text: '更新时间' },
            { field: 'title', text: '标题' },
            { field: 'collection_date', text: '收录时间' }
        ];

        // 创建排序条件添加界面
        const addSortContainer = sortModalContent.createDiv({ cls: 'add-sort-container' });
        const sortFieldSelect = addSortContainer.createEl('select', { cls: 'sort-field-select' });
        sortFields.forEach(field => {
            sortFieldSelect.createEl('option', {
                value: field.field,
                text: field.text
            });
        });

        const orderSelect = addSortContainer.createEl('select', { cls: 'order-select' });
        const orders = [
            { value: 'asc', text: '升序' },
            { value: 'desc', text: '降序' }
        ];
        orders.forEach(order => {
            orderSelect.createEl('option', {
                value: order.value,
                text: order.text
            });
        });

        const addSortButton = addSortContainer.createEl('button', {
            text: '添加',
            cls: 'add-sort-button'
        });

        // 添加排序条件
        const addSortCriterion = (field: string, order: 'asc' | 'desc') => {
            this.sortDefinition.criteria.push({
                field,
                order,
                enabled: true
            });
            this.plugin.settings.gallerySettings.sortDefinition = this.sortDefinition;
            this.plugin.saveSettings();
            this.renderCards();
            updateSortDisplay();
        };

        // 移除排序条件
        const removeSortCriterion = (index: number) => {
            this.sortDefinition.criteria.splice(index, 1);
            this.plugin.settings.gallerySettings.sortDefinition = this.sortDefinition;
            this.plugin.saveSettings();
            this.renderCards();
            updateSortDisplay();
        };

        addSortButton.addEventListener('click', () => {
            const field = sortFieldSelect.value;
            const order = orderSelect.value as 'asc' | 'desc';
            if (field) {
                addSortCriterion(field, order);
            }
        });

        // 显示当前排序条件
        const activeSortsContainer = sortModalContent.createDiv({ cls: 'active-sorts' });

        // 更新排序显示
        const updateSortDisplay = () => {
            activeSortsContainer.empty();
            this.sortDefinition.criteria.forEach((criterion, index) => {
                const field = sortFields.find(f => f.field === criterion.field);
                const sortTag = activeSortsContainer.createDiv({ cls: 'sort-tag' });
                const checkbox = sortTag.createEl('input', {
                    type: 'checkbox',
                    cls: 'sort-enable-toggle',
                    attr: { checked: criterion.enabled }
                });
                checkbox.addEventListener('change', () => {
                    criterion.enabled = checkbox.checked;
                    this.plugin.settings.gallerySettings.sortDefinition = this.sortDefinition;
                    this.plugin.saveSettings();
                    this.renderCards();
                });
                sortTag.createSpan({ text: `${field?.text || criterion.field} ${criterion.order === 'asc' ? '↑' : '↓'}` });
                if (index > 0) {
                    const upButton = sortTag.createEl('button', { cls: 'move-sort-up', text: '↑' });
                    upButton.addEventListener('click', () => {
                        const temp = this.sortDefinition.criteria[index];
                        this.sortDefinition.criteria[index] = this.sortDefinition.criteria[index - 1];
                        this.sortDefinition.criteria[index - 1] = temp;
                        this.plugin.settings.gallerySettings.sortDefinition = this.sortDefinition;
                        this.plugin.saveSettings();
                        this.renderCards();
                        updateSortDisplay();
                    });
                }
                const removeButton = sortTag.createEl('button', { cls: 'remove-sort' });
                removeButton.addEventListener('click', () => removeSortCriterion(index));
            });
        };

        updateSortDisplay();

        // 添加排序按钮点击事件
        sortToggle.addEventListener('click', () => {
            sortModal.classList.add('show');
        });

        // 点击模态框外部关闭
        sortModal.addEventListener('click', (e) => {
            if (e.target === sortModal) {
                sortModal.classList.remove('show');
            }
        });

        // 添加列数切换按钮
        const columnToggle = controlsContainer.createEl('button', {
            text: `${this.columnCount}列显示`,
            cls: 'gallery-column-toggle'
        });

        columnToggle.addEventListener('click', () => {
            this.columnCount = this.columnCount === 3 ? 4 : 3;
            columnToggle.textContent = `${this.columnCount}列显示`;
            this.container.setAttribute('data-columns', this.columnCount.toString());
            this.plugin.settings.gallerySettings.columnCount = this.columnCount;
            this.plugin.saveSettings();
        });

        // 设置初始列数
        this.container.setAttribute('data-columns', this.columnCount.toString());

        await this.renderCards();
    }

    async renderCards() {
        // 移除现有的卡片容器
        const existingContainer = this.container.querySelector('.gallery-cards-container');
        if (existingContainer) {
            existingContainer.remove();
        }
        const cardsContainer = this.container.createDiv({ cls: 'gallery-cards-container' });
        // 设置当前的显示模式样式
        if (this.displayMode === 'poster') {
            cardsContainer.classList.add('poster-mode');
            
            // 检查是否为音乐卡片专辑墙
            if (this.selectedCardTypes.has('music-card')) {
                cardsContainer.classList.add('music-wall');
            }
        } else if (this.displayMode === 'timeline') {
            cardsContainer.classList.add('timeline-mode');
            const timelineCards = await CardUtils.loadCardIndex(this.plugin.app.vault);
            const timeline = cardsContainer.createDiv({ cls: 'timeline-main' });
            timeline.createDiv({ cls: 'timeline-line' });
            let timelineCardsArray = Object.entries(timelineCards).map(([cid, cardInfo]) => {
                if (!cardInfo || !cardInfo.content) return null;
                const cardMatch = cardInfo.content.match(/```(.*?)\n([\s\S]*?)```/);
                if (!cardMatch) return null;
                const cardType = cardMatch[1];
                const cardContent = cardMatch[2];
                const cardData = this.plugin.parseYaml(cardContent);
                return {
                    cid,
                    type: cardType,
                    data: cardData,
                    lastUpdate: cardInfo.lastUpdated || 0
                };
            }).filter(card => card !== null);
            // 多选类型筛选逻辑
            timelineCardsArray = timelineCardsArray.filter(card => this.selectedCardTypes.has(card.type));
            timelineCardsArray.sort((a, b) => {
                const dateA = cardDateToSortable(a.data.collection_date);
                const dateB = cardDateToSortable(b.data.collection_date);
                if (dateA === dateB) {
                    return new Date(a.lastUpdate).getTime() - new Date(b.lastUpdate).getTime();
                }
                return dateA < dateB ? -1 : 1;
            });
            timelineCardsArray.forEach((card, idx) => {
                const side = idx % 2 === 0 ? 'left' : 'right';
                const node = timeline.createDiv({ cls: `timeline-node timeline-node-${side}` });
                // 时间点
                const dot = node.createDiv({ cls: 'timeline-dot' });
                dot.setAttr('title', card.data.collection_date);
                // 时间文本
                const dateLabel = node.createDiv({ cls: 'timeline-date' });
                dateLabel.setText(card.data.collection_date);
                // 卡片内容
                const cardBox = node.createDiv({ cls: 'timeline-card-box' });
                // 根据类型渲染卡片
                switch (card.type) {
                    case 'music-card':
                        this.plugin.renderMusicCard(card.data, cardBox, card.cid);
                        break;
                    case 'book-card':
                        this.plugin.renderBookCard(card.data, cardBox, card.cid);
                        break;
                    case 'movie-card':
                        this.plugin.renderMovieCard(card.data, cardBox, card.cid);
                        break;
                    case 'tv-card':
                        this.plugin.renderTvCard(card.data, cardBox, card.cid);
                        break;
                    case 'anime-card':
                        this.plugin.renderAnimeCard(card.data, cardBox, card.cid);
                        break;
                    case 'idea-card':
                        this.plugin.renderIdeaCard(card.data, cardBox, card.cid);
                        break;
                    case 'quote-card':
                        this.plugin.renderQuoteCard(card.data, cardBox, card.cid);
                        break;
                }
            });
            // 美化：主线、节点、左右交错、hover动画等交给CSS
            return;
        } else if (this.displayMode === 'carousel') {
            // 只渲染轮播
            const index = await CardUtils.loadCardIndex(this.plugin.app.vault);
            const cards = Object.entries(index).map(([cid, cardInfo]) => {
                if (!cardInfo || !cardInfo.content) return null;
                const cardMatch = cardInfo.content.match(/```(.*?)\n([\s\S]*?)```/);
                if (!cardMatch) return null;
                const cardType = cardMatch[1];
                const cardContent = cardMatch[2];
                const cardData = this.plugin.parseYaml(cardContent);
                return {
                    cid,
                    type: cardType,
                    data: cardData,
                    lastUpdate: cardInfo.lastUpdated || 0
                };
            }).filter(card => card !== null);
            await this.renderIdeaAndQuoteCarousel(cards, cardsContainer, index, Array.from(this.selectedCardTypes).join(','));
            return;
        }
        
        // 设置当前卡片类型属性
        this.container.setAttribute('data-card-type', Array.from(this.selectedCardTypes).join(','));

        const index = await CardUtils.loadCardIndex(this.plugin.app.vault);

        // 将卡片信息转换为数组并解析内容
        const cards = Object.entries(index).map(([cid, cardInfo]) => {
            if (!cardInfo || !cardInfo.content) return null;
            const cardMatch = cardInfo.content.match(/```(.*?)\n([\s\S]*?)```/);
            if (!cardMatch) return null;

            const cardType = cardMatch[1];
            const cardContent = cardMatch[2];
            const cardData = this.plugin.parseYaml(cardContent);
            return {
                cid,
                type: cardType,
                data: cardData,
                lastUpdate: cardInfo.lastUpdated || 0
            };
        }).filter(card => card !== null);
        
        // 应用筛选条件
        const applyFilter = async (card: {
            cid: string;
            type: string;
            data: {
                title?: string;
                year?: number;
                rating?: number;
                description?: string;
                collection_date?: string;
                tags?: string[];
                meta?: Record<string, any>;
                [key: string]: any;
            };
            lastUpdate: number;
        }) => {
            // 闪念和摘录卡片特殊处理
            // 在卡片模式下：选择这两种类型时，只在轮播中显示，不在普通卡片列表中显示
            // 在海报墙模式下：只有当选择了这些类型时才显示
            if (this.displayMode === 'card' && 
                ((this.selectedCardTypes.has('idea-card') && card.type === 'idea-card') || 
                (this.selectedCardTypes.has('quote-card') && card.type === 'quote-card'))) {
                return false; // 不在普通卡片列表中显示
            }
            
            // 在海报墙模式下，闪念和摘录卡片需要特别处理
            if (this.displayMode === 'poster' && (card.type === 'idea-card' || card.type === 'quote-card')) {
                // 只有当明确选择了这些类型时才显示
                if (!this.selectedCardTypes.has(card.type)) {
                    return false;
                }
            }
            
            // 处理"所有书籍影视"选项 - 显示除音乐外的所有卡片
            if (this.selectedCardTypes.has('all-media')) {
                if (card.type === 'music-card') {
                    return false;
                }
                // 其他类型都显示
            }
            // 正常的类型筛选
            else if (!this.selectedCardTypes.has(card.type)) {
                return false;
            }

            for (const condition of this.filterDefinition.conditions) {
                if (!condition.enabled) continue;

                if (condition.field === 'status') {
                    const cardLocations = index[card.cid]?.locations;
                    if (cardLocations && cardLocations.length > 0) {
                        const file = this.app.vault.getAbstractFileByPath(cardLocations[0].path);
                        if (file instanceof TFile) {
                            const content = await this.app.vault.read(file);
                            const frontmatterMatch = content.match(/^---[\r\n]([\s\S]*?)[\r\n]---/);
                            if (frontmatterMatch) {
                                const frontmatter = this.plugin.parseYaml(frontmatterMatch[1]);
                                const fileStatus = frontmatter.status || 'unread';
                                const filterStatus = condition.value === '已阅' ? 'read' : 'unread';
                                if (fileStatus !== filterStatus) return false;
                                continue;
                            }
                        }
                    }
                    return false;
                }

                // 特殊处理标签筛选
                if (condition.field === 'tags') {
                    const cardTags = card.data?.tags || [];
                    // 将标签转换为字符串数组，移除可能的#前缀
                    const normalizedTags = Array.isArray(cardTags) 
                        ? cardTags.map(tag => typeof tag === 'string' ? tag.replace(/^#/, '') : String(tag).replace(/^#/, ''))
                        : String(cardTags).split(/[\s,]+/).map(tag => tag.replace(/^#/, ''));
                    
                    // 将筛选条件也规范化，移除#前缀
                    const searchTag = condition.value.replace(/^#/, '');
                    
                    if (condition.operator === 'contains') {
                        // 检查任一标签是否包含搜索字符串
                        if (!normalizedTags.some(tag => tag.toLowerCase().includes(searchTag.toLowerCase()))) {
                            return false;
                        }
                        continue;
                    } else if (condition.operator === 'equals') {
                        // 检查是否有标签完全匹配
                        if (!normalizedTags.some(tag => tag.toLowerCase() === searchTag.toLowerCase())) {
                            return false;
                        }
                        continue;
                    }
                    // 其他操作符不适用于标签
                    return false;
                }

                const value = condition.field === 'lastUpdate' 
                    ? card.lastUpdate 
                    : condition.field.startsWith('meta.') 
                        ? card.data?.meta?.[condition.field.split('.')[1]] 
                        : card.data?.[condition.field];

                let matches = true;
                switch (condition.operator) {
                    case 'contains':
                        matches = String(value).toLowerCase().includes(String(condition.value).toLowerCase());
                        break;
                    case 'equals':
                        matches = String(value) === condition.value;
                        break;
                    case 'greater':
                        matches = parseFloat(value) > parseFloat(condition.value);
                        break;
                    case 'less':
                        matches = parseFloat(value) < parseFloat(condition.value);
                        break;
                }
                if (!matches) return false;
            }
            return true;
        };

        // 异步筛选所有卡片
        const filteredCards = [];
        for (const card of cards) {
            // 确保 lastUpdate 是数字类型
            const cardWithNumberLastUpdate = {
                ...card,
                lastUpdate: typeof card.lastUpdate === 'string' ? new Date(card.lastUpdate).getTime() : card.lastUpdate
            };
            const shouldInclude = await applyFilter(cardWithNumberLastUpdate);
            if (shouldInclude) {
                filteredCards.push(card);
            }
        }

        // 如果没有启用的筛选条件，仍然需要应用卡片类型筛选
        if (this.filterDefinition.conditions.every(c => !c.enabled)) {
            // 只添加符合当前选中类型的卡片
            filteredCards.push(...cards.filter(card => 
                this.selectedCardTypes.has(card.type) &&
                // 在海报墙模式下，特殊处理闪念和摘录卡片
                !(this.displayMode === 'poster' && 
                  (card.type === 'idea-card' || card.type === 'quote-card') && 
                  !this.selectedCardTypes.has(card.type))
            ));
        }

        // 首先按lastUpdate时间降序排序
        filteredCards.sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime());

        // 使用Map来存储每个title对应的最新卡片
        const titleMap = new Map();
        filteredCards.forEach(card => {
            const title = card.data?.title;
            if (title && (!titleMap.has(title) || card.lastUpdate > titleMap.get(title).lastUpdate)) {
                titleMap.set(title, card);
            }
        });

        // 获取去重后的卡片列表
        const uniqueCards = Array.from(titleMap.values());

        // 应用用户设置的排序条件
        uniqueCards.sort((a, b) => {
            for (const criterion of this.sortDefinition.criteria) {
                if (!criterion.enabled) continue;

                let valueA = criterion.field === 'lastUpdate' 
                    ? a.lastUpdate 
                    : criterion.field.startsWith('meta.') 
                        ? a.data?.meta?.[criterion.field.split('.')[1]] 
                        : a.data?.[criterion.field];
                let valueB = criterion.field === 'lastUpdate' 
                    ? b.lastUpdate 
                    : criterion.field.startsWith('meta.') 
                        ? b.data?.meta?.[criterion.field.split('.')[1]] 
                        : b.data?.[criterion.field];

                if (valueA === valueB) continue;
                if (valueA === undefined || valueA === null) return 1;
                if (valueB === undefined || valueB === null) return -1;

                const compareResult = valueA < valueB ? -1 : 1;
                return criterion.order === 'asc' ? compareResult : -compareResult;
            }
            return 0;
        });

        // 渲染筛选、去重和排序后的卡片
        let largeCardCounter = 0; // 用于计数，控制哪些音乐卡片作为大封面显示
        let musicCardPositions = new Map<string, number>(); // 存储所有音乐卡片的位置
        
        // 预先计算所有音乐卡片的位置
        if (this.displayMode === 'poster' && this.selectedCardTypes.has('music-card')) {
            let musicIndex = 0;
            for (const card of uniqueCards) {
                if (card.type === 'music-card') {
                    musicCardPositions.set(card.cid, musicIndex++);
                }
            }
            console.log(`Total music cards: ${musicIndex}, Music card positions:`, musicCardPositions);
        }
        
        // 预处理音乐卡片，找出高评分卡片并为它们分配随机且不相邻的位置
        const highRatingMusicCards = new Set<string>();
        const randomHighRatedPositions = new Map<string, number>(); // 存储高评分卡片ID到位置的映射
        
        if (this.displayMode === 'poster' && (this.selectedCardTypes.has('music-card') || this.selectedCardTypes.has('all'))) {
            console.log(`Processing for display mode: ${this.displayMode}, card type: ${Array.from(this.selectedCardTypes).join(',')}`);
            // 找出所有高评分音乐卡片
            const highRatedCards = uniqueCards.filter(card => {
                if (card.type === 'music-card') {
                    const rating = parseFloat(card.data?.rating || '0');
                    if (rating >= 9.5) {
                        highRatingMusicCards.add(card.cid);
                        return true;
                    }
                }
                return false;
            });
            
            // 如果有高评分卡片，为它们分配随机且不相邻的位置
            if (highRatedCards.length > 0) {
                // 计算音乐卡片总数和位置
                const musicCards = uniqueCards.filter(card => card.type === 'music-card');
                const musicCardCount = musicCards.length;
                
                // 为所有音乐卡片创建位置映射
                musicCards.forEach((card, index) => {
                    musicCardPositions.set(card.cid, index);
                });
                
                console.log(`Mapped ${musicCardPositions.size} music card positions`);
                
                // 计算每行卡片数量
                const columns = this.columnCount * 2; // 音乐墙模式下通常是普通列数的2倍
                
                // 创建所有可能的位置数组
                const allPositions = Array.from({length: musicCardCount}, (_, i) => i);
                
                // 随机打乱所有位置
                for (let i = allPositions.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [allPositions[i], allPositions[j]] = [allPositions[j], allPositions[i]];
                }
                
                // 选择不相邻的位置
                const selectedPositions: number[] = [];
                
                // 尝试为每个高评分卡片找到一个不相邻的位置
                for (const pos of allPositions) {
                    // 检查是否与已选择的任何位置相邻
                    let isAdjacent = false;
                    for (const selectedPos of selectedPositions) {
                        // 检查水平相邻
                        if (Math.abs(pos % columns - selectedPos % columns) <= 1 && 
                            Math.floor(pos / columns) === Math.floor(selectedPos / columns)) {
                            isAdjacent = true;
                            break;
                        }
                        
                        // 检查垂直相邻
                        if (Math.abs(Math.floor(pos / columns) - Math.floor(selectedPos / columns)) <= 1 && 
                            pos % columns === selectedPos % columns) {
                            isAdjacent = true;
                            break;
                        }
                        
                        // 检查对角线相邻
                        if (Math.abs(Math.floor(pos / columns) - Math.floor(selectedPos / columns)) <= 1 &&
                            Math.abs(pos % columns - selectedPos % columns) <= 1) {
                            isAdjacent = true;
                            break;
                        }
                    }
                    
                    // 如果不相邻，则添加到选中列表
                    if (!isAdjacent) {
                        selectedPositions.push(pos);
                        
                        // 如果已经选择了足够多的位置，就停止
                        if (selectedPositions.length >= highRatedCards.length) {
                            break;
                        }
                    }
                }
                
                // 将高评分卡片与选中的位置一一对应
                highRatedCards.forEach((card, index) => {
                    if (index < selectedPositions.length) {
                        randomHighRatedPositions.set(card.cid, selectedPositions[index]);
                        console.log(`Assigned position ${selectedPositions[index]} to card ${card.data?.title} with ID ${card.cid}`);
                    }
                });
                
                // 调试输出
                console.log(`Total high rated cards: ${highRatedCards.length}, Positions assigned: ${randomHighRatedPositions.size}`);
                console.log(`Selected positions: ${selectedPositions.join(', ')}`);
                console.log(`Is music-card selected: ${this.selectedCardTypes.has('music-card')}`);
                console.log(`Filter conditions: ${this.filterDefinition.conditions.length}, Sort criteria: ${this.sortDefinition.criteria.length}`);
                console.log(`Has filter or sort: ${this.filterDefinition.conditions.some(c => c.enabled) || this.sortDefinition.criteria.some(c => c.enabled)}`);
                
            }
        }
        
        for (const card of uniqueCards) {
            const cardContainer = cardsContainer.createDiv();
            
            // 为海报墙模式添加特殊处理
            if (this.displayMode === 'poster') {
                cardContainer.classList.add('poster-card-container');
                
                // 音乐卡片特殊处理 - 参考豆瓣音乐海报墙的布局
                if (card.type === 'music-card') {
                    // 只有评分达到要求的卡片才有资格成为大封面
                    const rating = parseFloat(card.data?.rating || '0');
                    
                    // 高评分卡片(>=9.5)才有资格成为大封面
                    if (rating >= 9.5) {
                        // 检查是否有筛选或排序条件
                        const hasFilterOrSort = 
                            this.filterDefinition.conditions.some(c => c.enabled) || 
                            this.sortDefinition.criteria.some(c => c.enabled);
                            
                        // 所有高评分音乐卡片都直接显示为大封面
                        cardContainer.classList.add('large-cover');
                        console.log(`Card ${card.data?.title}, Rating: ${rating} - Showing as large cover`);
                        
                        // 以下是旧的逻辑，现在已不再使用
                        /*
                        // 有筛选或排序条件时，所有高评分卡片都显示为大封面
                        if (hasFilterOrSort) {
                            cardContainer.classList.add('large-cover');
                        } 
                        // 没有筛选排序条件时，检查这个卡片是否在随机分配的位置上
                        else {
                            const assignedPosition = randomHighRatedPositions.get(card.cid);
                            
                            // 获取卡片在所有音乐卡片中的实际位置
                            const actualPosition = musicCardPositions.get(card.cid) || largeCardCounter;
                            
                            // 如果卡片有分配的位置，且实际位置等于该位置
                            if (assignedPosition === actualPosition) {
                                cardContainer.classList.add('large-cover');
                            }
                            // 调试输出
                            console.log(`Card ${card.data?.title}, Rating: ${rating}, Assigned: ${assignedPosition}, Actual: ${actualPosition}, Counter: ${largeCardCounter}, Is Large: ${assignedPosition === actualPosition}`);
                        }
                        */
                    }
                    
                    // 不再需要增加计数器，因为我们使用预计算的位置
                }
            }

            switch (card.type) {
                case 'music-card':
                    await this.plugin.renderMusicCard(card.data, cardContainer, card.cid);
                    // 确保音乐卡片有正确的类名，以便应用1:1比例样式
                    cardContainer.classList.add('music-card');
                    break;
                case 'book-card':
                    await this.plugin.renderBookCard(card.data, cardContainer, card.cid);
                    break;
                case 'movie-card':
                    await this.plugin.renderMovieCard(card.data, cardContainer, card.cid);
                    break;
                case 'tv-card':
                    await this.plugin.renderTvCard(card.data, cardContainer, card.cid);
                    break;
                case 'anime-card':
                    await this.plugin.renderAnimeCard(card.data, cardContainer, card.cid);
                    break;
                case 'idea-card':
                    this.plugin.renderIdeaCard(card.data, cardContainer, card.cid);
                    break;
                case 'quote-card':
                    this.plugin.renderQuoteCard(card.data, cardContainer, card.cid);
                    break;
            }

            // 获取卡片容器
            const newCardsContainer = cardContainer.querySelector('.new-cards-container');
            if (newCardsContainer) {
                const cardIndex = await CardUtils.loadCardIndex(this.plugin.app.vault);
                const cardLocations = cardIndex[card.cid]?.locations;
                if (cardLocations && cardLocations.length > 0) {
                    const notePath = cardLocations[0].path;
                    const startLine = cardLocations[0].startLine;
                    // 1. 展台区域（cardContainer）点击：跳转到笔记并定位
                    cardContainer.addEventListener('click', (e) => {
                        if (!(e.target as HTMLElement).closest('.new-cards-container')) {
                            this.plugin.scrollToLineInFile(notePath, startLine);
                        }
                    });
                    // 2. 卡片本体点击：跳转url
                    newCardsContainer.addEventListener('click', (e) => {
                        this.plugin.handleCardUrlClick(card.data, e as MouseEvent);
                    });
                }
                // 添加反链图标和容器
                const backlinksContainer = newCardsContainer.createDiv({ cls: 'card-backlinks-container' });
                const backlinksIcon = backlinksContainer.createDiv({ cls: 'card-backlinks-icon' });
                backlinksIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
                const backlinksDropdown = backlinksContainer.createDiv({ cls: 'card-backlinks-dropdown' });

                // 获取卡片所在的笔记和引用了当前卡片的笔记
                const backlinksCardIndex = await CardUtils.loadCardIndex(this.plugin.app.vault);
                const backlinksCardInfo = backlinksCardIndex[card.cid];
                const resolvedLinks = this.plugin.app.metadataCache.resolvedLinks;
                
                // 显示卡片所在的笔记
                if (backlinksCardInfo && backlinksCardInfo.locations && backlinksCardInfo.locations.length > 0) {
                    // 按文件路径排序
                    const locations = [...backlinksCardInfo.locations].sort((a, b) => a.path.localeCompare(b.path));
                    
                    // 添加标题
                    const locationTitle = backlinksDropdown.createDiv({ cls: 'backlink-section-title' });
                    locationTitle.textContent = '卡片所在笔记';
                    
                    // 添加所有卡片所在笔记
                    const addedPaths = new Set<string>();
                    for (const location of locations) {
                        // 避免重复添加同一个文件
                        if (addedPaths.has(location.path)) continue;
                        addedPaths.add(location.path);
                        
                        const sourceFile = this.plugin.app.vault.getAbstractFileByPath(location.path);
                        if (sourceFile instanceof TFile) {
                            const noteLink = backlinksDropdown.createDiv({ cls: 'backlink-item' });
                            // 去掉.md后缀
                            const displayName = sourceFile.basename.replace(/\.md$/, '');
                            noteLink.textContent = displayName;
                            noteLink.addEventListener('click', (e: MouseEvent) => {
                                e.stopPropagation(); // 阻止事件冒泡，防止同时触发卡片点击事件
                                // 关闭所有打开的反链下拉菜单
                                document.querySelectorAll('.card-backlinks-dropdown.show').forEach(dropdown => {
                                    dropdown.classList.remove('show');
                                });
                                this.plugin.app.workspace.openLinkText(location.path, '', true);
                            });
                        }
                    }
                }
    
                // 添加点击事件
                backlinksIcon.addEventListener('click', (e: MouseEvent) => {
                    e.stopPropagation();
                    // 关闭其他打开的下拉菜单
                    document.querySelectorAll('.card-backlinks-dropdown.show').forEach(dropdown => {
                        if (dropdown !== backlinksDropdown) {
                            dropdown.classList.remove('show');
                        }
                    });
                    backlinksDropdown.classList.toggle('show');
                });

                // 使用事件委托处理点击其他区域关闭下拉菜单
                if (!this.container.hasAttribute('data-backlinks-handler')) {
                    this.container.setAttribute('data-backlinks-handler', 'true');
                    this.container.addEventListener('click', (e: MouseEvent) => {
                        const target = e.target as Element;
                        const clickedBacklinksIcon = target.closest('.card-backlinks-icon');
                        if (!clickedBacklinksIcon) {
                            document.querySelectorAll('.card-backlinks-dropdown.show').forEach(dropdown => {
                                dropdown.classList.remove('show');
                            });
                        }
                    });
                }
            }
        }
    }

    async setState(state: any) {
        if (state && state.viewId) {
            this.loadSettings();
            this.container?.setAttribute('data-hidden-fields', Array.from(this.hiddenFields).join(' '));
            await this.onOpen();
        }
    }

    async onClose() {
        this.saveSettings();
        this.container.empty();
    }

    /**
     * 添加标签筛选条件
     * @param tag 要筛选的标签值
     */
    public addTagFilter(tag: string): void {
        // 检查是否已经存在相同的标签筛选
        const existingCondition = this.filterDefinition.conditions.find(
            c => c.field === 'tags' && c.value === tag
        );
        
        // 如果已存在相同筛选条件，则不再添加
        if (existingCondition) {
            // 确保筛选条件已启用
            existingCondition.enabled = true;
            this.plugin.settings.gallerySettings.filterDefinition = this.filterDefinition;
            this.plugin.saveSettings();
            this.renderCards();
            
            // 显示筛选面板
            const filterModal = this.containerEl.querySelector('.gallery-modal.filter-modal') as HTMLElement;
            if (filterModal) {
                filterModal.classList.add('show');
                // 更新筛选面板显示
                this.updateFilterDisplayUI();
            }
            
            return;
        }
        
        // 添加新的标签筛选条件
        this.filterDefinition.conditions.push({
            field: 'tags',
            operator: 'equals', // 使用精确匹配
            value: tag,
            enabled: true
        });
        
        // 保存设置并重新渲染卡片
        this.plugin.settings.gallerySettings.filterDefinition = this.filterDefinition;
        this.plugin.saveSettings();
        this.renderCards();
        
        // 显示筛选面板
        const filterModal = this.containerEl.querySelector('.gallery-modal.filter-modal') as HTMLElement;
        if (filterModal) {
            filterModal.classList.add('show');
            // 更新筛选面板显示
            this.updateFilterDisplayUI();
        }
        
        // 显示一个通知，提示用户已添加标签筛选
        new Notice(`已添加标签筛选：${tag}`, 2000);
    }
    
    /**
     * 从所有卡片中加载元数据字段
     */
    private async loadMetaFields(selectElement: HTMLSelectElement) {
        try {
            // 清空现有选项，保留默认选项
            while (selectElement.options.length > 1) {
                selectElement.remove(1);
            }
            
            // 加载卡片索引
            const index = await CardUtils.loadCardIndex(this.plugin.app.vault);
            
            // 收集所有卡片中的元数据字段
            const metaFields = new Set<string>();
            
            // 遍历所有卡片
            for (const cardId in index) {
                const cardInfo = index[cardId];
                if (!cardInfo || !cardInfo.content) continue;
                
                // 解析卡片内容
                const cardMatch = cardInfo.content.match(/```(.*?)\n([\s\S]*?)```/);
                if (!cardMatch) continue;
                
                const cardContent = cardMatch[2];
                const cardData = this.plugin.parseYaml(cardContent);
                
                // 如果有元数据，收集所有键
                if (cardData.meta && typeof cardData.meta === 'object') {
                    Object.keys(cardData.meta).forEach(key => metaFields.add(key));
                }
            }
            
            // 添加收集到的元数据字段到下拉选择框
            Array.from(metaFields).sort().forEach(field => {
                selectElement.createEl('option', {
                    value: field,
                    text: field
                });
            });
            
            // 如果没有找到任何元数据字段，添加提示
            if (metaFields.size === 0) {
                const option = selectElement.createEl('option', {
                    value: '',
                    text: '未找到元数据',
                    attr: { disabled: true }
                });
            }
            
        } catch (error) {
            console.error('加载元数据字段失败:', error);
            // 添加错误提示选项
            selectElement.createEl('option', {
                value: '',
                text: '加载失败',
                attr: { disabled: true }
            });
        }
    }
    
    /**
     * 更新筛选面板UI显示
     */
    private updateFilterDisplayUI(): void {
        const activeFiltersContainer = this.containerEl.querySelector('.active-filters');
        if (!activeFiltersContainer) return;
        
        // 清空现有内容
        activeFiltersContainer.empty();
        
        // 移除旧的清除按钮（如果存在）
        const oldClearButton = this.containerEl.querySelector('.filter-clear-all-button');
        if (oldClearButton) {
            oldClearButton.remove();
        }
        
        // 在筛选设置标题后添加清除全部筛选按钮
        if (this.filterDefinition.conditions.length > 0) {
            const modalTitle = this.containerEl.querySelector('.filter-modal .modal-title');
            if (modalTitle) {
                const clearAllButton = modalTitle.createEl('button', { 
                    text: '清除全部', 
                    cls: 'filter-clear-all-button' 
                });
                clearAllButton.addEventListener('click', () => {
                    this.filterDefinition.conditions = [];
                    this.plugin.settings.gallerySettings.filterDefinition = this.filterDefinition;
                    this.plugin.saveSettings();
                    this.renderCards();
                    this.updateFilterDisplayUI();
                    
                    // 更新状态选择框
                    const statusSelect = this.containerEl.querySelector('.status-select') as HTMLSelectElement;
                    if (statusSelect) {
                        statusSelect.value = '';
                    }
                    
                    new Notice('已清除所有筛选条件', 2000);
                });
            }
        }
        
        // 重新获取筛选字段定义
        const filterFields = [
            { field: 'year', text: '年份' },
            { field: 'rating', text: '评分' },
            { field: 'lastUpdate', text: '更新时间' },
            { field: 'title', text: '标题' },
            { field: 'description', text: '描述' },
            { field: 'collection_date', text: '收录时间' },
            { field: 'tags', text: '标签' }
        ];
        
        // 重新添加筛选条件标签
        this.filterDefinition.conditions.forEach((condition, index) => {
            // 跳过阅读状态筛选条件，因为它有专门的下拉框
            if (condition.field === 'status') return;
            
            // 处理元数据字段显示
            let fieldText = '';
            if (condition.field.startsWith('meta.')) {
                const metaKey = condition.field.split('.')[1];
                fieldText = `元数据:${metaKey}`;
            } else {
                const field = filterFields.find(f => f.field === condition.field);
                fieldText = field?.text || condition.field;
            }
            
            const filterTag = activeFiltersContainer.createDiv({ cls: 'filter-tag' });
            const checkbox = filterTag.createEl('input', {
                type: 'checkbox',
                cls: 'filter-enable-toggle',
                attr: { checked: condition.enabled }
            });
            
            checkbox.addEventListener('change', () => {
                condition.enabled = checkbox.checked;
                this.plugin.settings.gallerySettings.filterDefinition = this.filterDefinition;
                this.plugin.saveSettings();
                this.renderCards();
            });
            
            filterTag.createSpan({ text: `${fieldText} ${condition.operator} ${condition.value}` });
            const removeButton = filterTag.createEl('button', { cls: 'remove-filter' });
            
            // 使用闭包保存正确的索引
            const currentIndex = index;
            removeButton.addEventListener('click', () => {
                this.filterDefinition.conditions.splice(currentIndex, 1);
                this.plugin.settings.gallerySettings.filterDefinition = this.filterDefinition;
                this.plugin.saveSettings();
                this.renderCards();
                this.updateFilterDisplayUI();
            });
        });
    }

    // 新增：提取轮播渲染为独立方法
    private async renderIdeaAndQuoteCarousel(cards: any[], cardsContainer: HTMLElement, index: any, selectedType: string) {
        // 筛选
        let ideaCards: any[] = [];
        let quoteCards: any[] = [];
        if (selectedType === 'idea-card') {
            ideaCards = cards.filter(card => card.type === 'idea-card')
                .sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime())
                .slice(0, 10);
        } else if (selectedType === 'quote-card') {
            quoteCards = cards.filter(card => card.type === 'quote-card')
                .sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime())
                .slice(0, 10);
        } else {
            ideaCards = cards.filter(card => card.type === 'idea-card')
                .sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime())
                .slice(0, 10);
            quoteCards = cards.filter(card => card.type === 'quote-card')
                .sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime())
                .slice(0, 10);
        }
        // 闪念轮播
        if (ideaCards.length > 0) {
            const ideaSectionTitle = cardsContainer.createDiv({ cls: 'carousel-section-title' });
            ideaSectionTitle.setText('近期闪念');
            const ideaSwiperSection = cardsContainer.createDiv({ cls: 'swiper-section' });
            const ideaSwiperContainer = ideaSwiperSection.createDiv({ cls: 'swiper idea-quote-swiper' });
            const ideaSwiperWrapper = ideaSwiperContainer.createDiv({ cls: 'swiper-wrapper' });
            const ideaPrevBtn = ideaSwiperContainer.createDiv({ cls: 'swiper-button-prev' });
            const ideaNextBtn = ideaSwiperContainer.createDiv({ cls: 'swiper-button-next' });
            const ideaPagination = ideaSwiperContainer.createDiv({ cls: 'swiper-pagination' });
            for (const card of ideaCards) {
                const slide = ideaSwiperWrapper.createDiv({ cls: 'swiper-slide' });
                await this.plugin.renderIdeaCard(card.data, slide, card.cid);
                const cardLocations = index[card.cid]?.locations;
                if (cardLocations && cardLocations.length > 0) {
                    const notePath = cardLocations[0].path;
                    const startLine = cardLocations[0].startLine;
                    slide.addEventListener('click', (e) => {
                        if (!(e.target as HTMLElement).closest('.new-cards-container')) {
                            this.plugin.scrollToLineInFile(notePath, startLine);
                        }
                    });
                    const cardEl = slide.querySelector('.new-cards-container');
                    if (cardEl) {
                        cardEl.addEventListener('click', (e) => {
                            this.plugin.handleCardUrlClick(card.data, e as MouseEvent);
                        });
                    }
                }
            }
            if (this.ideaSwiper) this.ideaSwiper.destroy();
            this.ideaSwiper = new Swiper(ideaSwiperContainer, {
                direction: 'horizontal',
                slidesPerView: 'auto',
                centeredSlides: true,
                spaceBetween: 30,
                mousewheel: false,
                navigation: { nextEl: ideaNextBtn, prevEl: ideaPrevBtn },
                pagination: { el: ideaPagination, clickable: true },
                autoplay: { delay: 5000, disableOnInteraction: false },
                loop: true,
                loopAdditionalSlides: 2,
                effect: 'slide',
                keyboard: { enabled: true },
                simulateTouch: true,
                touchRatio: 1,
                grabCursor: true,
                threshold: 5,
                speed: 400,
                on: {
                    slideChangeTransitionStart: function() {
                        const activeSlide = this.slides[this.activeIndex];
                        if (activeSlide) {
                            activeSlide.style.transform = 'scale(0.9)';
                            activeSlide.style.transition = 'transform 0.3s';
                        }
                    },
                    slideChangeTransitionEnd: function() {
                        const activeSlide = this.slides[this.activeIndex];
                        if (activeSlide) {
                            activeSlide.style.transform = 'scale(1)';
                        }
                    }
                },
                cssMode: false,
                watchSlidesProgress: true,
                slideToClickedSlide: true,
            });
            if (ideaCards.length > 1) {
                ideaPrevBtn.style.display = 'flex';
                ideaNextBtn.style.display = 'flex';
            } else {
                ideaPrevBtn.style.display = 'none';
                ideaNextBtn.style.display = 'none';
            }
            ideaPrevBtn.addEventListener('click', (e) => { e.stopPropagation(); if (this.ideaSwiper) this.ideaSwiper.slidePrev(); });
            ideaNextBtn.addEventListener('click', (e) => { e.stopPropagation(); if (this.ideaSwiper) this.ideaSwiper.slideNext(); });
            ideaSwiperContainer.setAttribute('data-swiper-initialized', 'true');
            ideaSwiperContainer.classList.add('swiper-container-horizontal');
        }
        // 摘录轮播
        if (quoteCards.length > 0) {
            const quoteSectionTitle = cardsContainer.createDiv({ cls: 'carousel-section-title' });
            quoteSectionTitle.setText('近期摘录');
            const quoteSwiperSection = cardsContainer.createDiv({ cls: 'swiper-section' });
            const quoteSwiperContainer = quoteSwiperSection.createDiv({ cls: 'swiper idea-quote-swiper' });
            const quoteSwiperWrapper = quoteSwiperContainer.createDiv({ cls: 'swiper-wrapper' });
            const quotePrevBtn = quoteSwiperContainer.createDiv({ cls: 'swiper-button-prev' });
            const quoteNextBtn = quoteSwiperContainer.createDiv({ cls: 'swiper-button-next' });
            const quotePagination = quoteSwiperContainer.createDiv({ cls: 'swiper-pagination' });
            for (const card of quoteCards) {
                const slide = quoteSwiperWrapper.createDiv({ cls: 'swiper-slide' });
                await this.plugin.renderQuoteCard(card.data, slide, card.cid);
                const cardLocations = index[card.cid]?.locations;
                if (cardLocations && cardLocations.length > 0) {
                    const notePath = cardLocations[0].path;
                    const startLine = cardLocations[0].startLine;
                    slide.addEventListener('click', (e) => {
                        if (!(e.target as HTMLElement).closest('.new-cards-container')) {
                            this.plugin.scrollToLineInFile(notePath, startLine);
                        }
                    });
                    const cardEl = slide.querySelector('.new-cards-container');
                    if (cardEl) {
                        cardEl.addEventListener('click', (e) => {
                            this.plugin.handleCardUrlClick(card.data, e as MouseEvent);
                        });
                    }
                }
            }
            if (this.quoteSwiper) this.quoteSwiper.destroy();
            this.quoteSwiper = new Swiper(quoteSwiperContainer, {
                direction: 'horizontal',
                slidesPerView: 'auto',
                centeredSlides: true,
                spaceBetween: 30,
                mousewheel: false,
                navigation: { nextEl: quoteNextBtn, prevEl: quotePrevBtn },
                pagination: { el: quotePagination, clickable: true },
                autoplay: { delay: 5000, disableOnInteraction: false },
                loop: true,
                loopAdditionalSlides: 2,
                effect: 'slide',
                keyboard: { enabled: true },
                simulateTouch: true,
                touchRatio: 1,
                grabCursor: true,
                threshold: 5,
                speed: 400,
                on: {
                    slideChangeTransitionStart: function() {
                        const activeSlide = this.slides[this.activeIndex];
                        if (activeSlide) {
                            activeSlide.style.transform = 'scale(0.9)';
                            activeSlide.style.transition = 'transform 0.3s';
                        }
                    },
                    slideChangeTransitionEnd: function() {
                        const activeSlide = this.slides[this.activeIndex];
                        if (activeSlide) {
                            activeSlide.style.transform = 'scale(1)';
                        }
                    }
                },
                cssMode: false,
                watchSlidesProgress: true,
                slideToClickedSlide: true,
            });
            if (quoteCards.length > 1) {
                quotePrevBtn.style.display = 'flex';
                quoteNextBtn.style.display = 'flex';
            } else {
                quotePrevBtn.style.display = 'none';
                quoteNextBtn.style.display = 'none';
            }
            quotePrevBtn.addEventListener('click', (e) => { e.stopPropagation(); if (this.quoteSwiper) this.quoteSwiper.slidePrev(); });
            quoteNextBtn.addEventListener('click', (e) => { e.stopPropagation(); if (this.quoteSwiper) this.quoteSwiper.slideNext(); });
            quoteSwiperContainer.setAttribute('data-swiper-initialized', 'true');
            quoteSwiperContainer.classList.add('swiper-container-horizontal');
        }
    }

    // 切换显示模式并自动调整窗口大小
    private async switchDisplayMode(mode: 'card' | 'poster' | 'timeline' | 'carousel') {
        // 保存当前模式的窗口大小
        this.saveCurrentWindowSize();
        
        // 更新显示模式
        this.previousDisplayMode = this.displayMode;
        this.displayMode = mode;
        
        // 更新DOM属性
        this.container.setAttribute('data-display-mode', mode);
        
        // 应用保存的窗口大小，如果有的话
        this.applyWindowSize();
        
        // 重新渲染卡片
        await this.renderCards();
        
        // 保存设置
        this.saveSettings();
    }
    
    // 保存当前模式的窗口大小
    private saveCurrentWindowSize() {
        const leaf = this.leaf as any;
        if (leaf && leaf.width && leaf.height) {
            this.savedWindowSizes[this.displayMode] = {
                width: leaf.width,
                height: leaf.height
            };
        }
    }
    
    // 应用保存的窗口大小
    private applyWindowSize() {
        const savedSize = this.savedWindowSizes[this.displayMode];
        if (!savedSize) return;
        
        const leaf = this.leaf as any;
        if (!leaf) return;
        
        // 使用默认尺寸或保存的尺寸
        if (this.displayMode === 'poster' && savedSize.width) {
            // 海报墙模式通常需要更宽的视图
            leaf.setDimension({ width: savedSize.width, height: savedSize.height });
        } else if (this.displayMode === 'timeline' && savedSize.width) {
            // 时间轴模式需要较宽的视图
            leaf.setDimension({ width: savedSize.width, height: savedSize.height });
        } else if (this.displayMode === 'carousel' && savedSize.width) {
            // 轮播模式需要较宽的视图
            leaf.setDimension({ width: savedSize.width, height: savedSize.height });
        } else if (this.displayMode === 'card' && savedSize.width) {
            // 卡片模式可以适应较窄的视图
            leaf.setDimension({ width: savedSize.width, height: savedSize.height });
        }
    }
}

// 工具函数：将YY-MM-DD或YYYY-MM-DD转为可排序的数字
function cardDateToSortable(dateStr: string): number {
    if (!dateStr) return 0;
    // 支持YY-MM-DD和YYYY-MM-DD
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        let year = parts[0].length === 2 ? '20' + parts[0] : parts[0];
        return parseInt(year + parts[1].padStart(2, '0') + parts[2].padStart(2, '0'));
    }
    return 0;
}