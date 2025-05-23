import { ItemView, WorkspaceLeaf, TFile, Notice } from 'obsidian';
import { CardUtils, CardLocation } from './utils';
import type NewCardsPlugin from '../main';

export const VIEW_TYPE_CARDS_GALLERY = 'cards-gallery-view';

export class CardsGalleryView extends ItemView {
    private plugin: NewCardsPlugin;
    private container: HTMLElement;
    private columnCount: number;
    private hiddenFields: Set<string>;
    private selectedCardType: string;
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
        this.selectedCardType = settings.selectedCardType;
        this.filterDefinition = settings.filterDefinition || { conjunction: 'and', conditions: [] };
        this.sortDefinition = settings.sortDefinition || { criteria: [] };
    }

    private saveSettings() {
        this.plugin.settings.gallerySettings = {
            columnCount: this.columnCount,
            hiddenFields: Array.from(this.hiddenFields),
            selectedCardType: this.selectedCardType,
            sortField: 'year',
            filterDefinition: this.filterDefinition,
            sortDefinition: this.sortDefinition
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

        const types = [
            { id: 'all', text: '全部类型' },
            { id: 'music-card', text: '音乐' },
            { id: 'book-card', text: '书籍' },
            { id: 'movie-card', text: '电影' },
            { id: 'tv-card', text: '剧集' },
            { id: 'anime-card', text: '番剧' }
        ];

        // 添加类型筛选按钮
        const typeControl = controlsContainer.createDiv({ cls: 'gallery-type-control' });
        const currentType = types.find(type => type.id === this.selectedCardType) || types[0];
        const typeToggle = typeControl.createEl('button', {
            text: currentType.text,
            cls: 'gallery-type-toggle'
        });

        // 创建类型选择下拉菜单
        const typeDropdown = typeControl.createDiv({ cls: 'gallery-type-dropdown' });
        
        types.forEach(type => {
            const typeOption = typeDropdown.createDiv({ cls: 'type-option' });
            typeOption.textContent = type.text;
            typeOption.addEventListener('click', () => {
                this.selectedCardType = type.id;
                typeToggle.textContent = type.text;
                typeDropdown.classList.remove('show');
                this.plugin.settings.gallerySettings.selectedCardType = type.id;
                this.plugin.saveSettings();
                this.renderCards();
            });
        });

        // 添加类型切换按钮点击事件
        typeToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            typeDropdown.classList.toggle('show');
        });

        // 点击其他区域关闭类型下拉菜单
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
            { field: 'collection_date', text: '收录时间' }
        ];

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
            updateFilterDisplay();
        });

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
            updateFilterDisplay();
        };

        // 移除筛选条件
        const removeFilterCondition = (index: number) => {
            this.filterDefinition.conditions.splice(index, 1);
            this.plugin.settings.gallerySettings.filterDefinition = this.filterDefinition;
            this.plugin.saveSettings();
            this.renderCards();
            updateFilterDisplay();
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
            activeFiltersContainer.empty();
            this.filterDefinition.conditions.forEach((condition, index) => {
                // 跳过阅读状态筛选条件，因为它有专门的下拉框
                if (condition.field === 'status') return;
                
                const field = filterFields.find(f => f.field === condition.field);
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
                filterTag.createSpan({ text: `${field?.text || condition.field} ${condition.operator} ${condition.value}` });
                const removeButton = filterTag.createEl('button', { cls: 'remove-filter' });
                removeButton.addEventListener('click', () => removeFilterCondition(index));
            });
        };

        updateFilterDisplay();

        // 添加筛选按钮点击事件
        filterToggle.addEventListener('click', () => {
            filterModal.classList.add('show');
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
                meta?: Record<string, any>;
                [key: string]: any;
            };
            lastUpdate: number;
        }) => {
            if (this.selectedCardType !== 'all' && card.type !== this.selectedCardType) {
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
                this.selectedCardType === 'all' || card.type === this.selectedCardType
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
        for (const card of uniqueCards) {
            const cardContainer = cardsContainer.createDiv();

            switch (card.type) {
                case 'music-card':
                    await this.plugin.renderMusicCard(card.data, cardContainer, card.cid);
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
            }

            // 获取卡片容器
            const newCardsContainer = cardContainer.querySelector('.new-cards-container');
            if (newCardsContainer) {
                // 获取卡片所在的笔记
                const cardIndex = await CardUtils.loadCardIndex(this.plugin.app.vault);
                const cardLocations = cardIndex[card.cid]?.locations;
                if (cardLocations && cardLocations.length > 0) {
                    // 直接使用第一个包含该卡片的笔记文件
                    const noteFile = cardLocations[0];

                    if (noteFile) {
                        // 获取笔记的 frontmatter
                        const file = this.plugin.app.vault.getAbstractFileByPath(noteFile.path);
                        if (file instanceof TFile) {
                            const metadata = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter;
                            const status = metadata?.status || 'unread';

                            // 创建状态指示按钮
                            const statusIndicator = newCardsContainer.createDiv({ cls: `status-indicator ${status}` });
                            statusIndicator.textContent = status === 'read' ? '已看' : '未看';

                            // 添加点击事件处理
                            statusIndicator.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                const newStatus = status === 'read' ? 'unread' : 'read';
                                const content = await this.plugin.app.vault.read(file);
                                // 解析现有的 frontmatter
                                const frontmatterMatch = content.match(/^---(\r?\n|\r)(.*?)(\r?\n|\r)---/s);
                                let updatedContent = content;
                                
                                if (frontmatterMatch) {
                                    const frontmatter = frontmatterMatch[2];
                                    // 更新或添加 status 属性
                                    const lines = frontmatter.split(/\r?\n/);
                                    let statusFound = false;
                                    
                                    const updatedLines = lines.map(line => {
                                        if (line.startsWith('status:')) {
                                            statusFound = true;
                                            return `status: ${newStatus}`;
                                        }
                                        return line;
                                    });
                                    
                                    if (!statusFound) {
                                        updatedLines.push(`status: ${newStatus}`);
                                    }
                                    
                                    // 重建 frontmatter
                                    updatedContent = content.replace(
                                        /^---(\r?\n|\r)(.*?)(\r?\n|\r)---/s,
                                        `---\n${updatedLines.join('\n')}\n---`
                                    );
                                } else {
                                    // 如果没有 frontmatter，添加一个新的
                                    updatedContent = `---\nstatus: ${newStatus}\n---\n\n${content}`;
                                }
                                await this.plugin.app.vault.modify(file, updatedContent);

                                // 更新状态指示器
                                statusIndicator.className = `status-indicator ${newStatus}`;
                                statusIndicator.textContent = newStatus === 'read' ? '已看' : '未看';

                                // 显示通知
                                new Notice(`已将 ${card.data.title} 标记为${newStatus === 'read' ? '已看' : '未看'}`, 3000);
                            });
                        }
                    }
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
                            noteLink.addEventListener('click', () => {
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
}