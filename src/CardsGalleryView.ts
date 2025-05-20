import { ItemView, WorkspaceLeaf, TFile } from 'obsidian';
import { CardUtils } from './utils';
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
        const fields = ['description', 'year', 'rating', 'tags', 'meta'];
        
        fields.forEach(field => {
            const fieldOption = fieldsDropdown.createDiv({ cls: 'field-option' });
            const checkbox = fieldOption.createEl('input', {
                type: 'checkbox',
                attr: { id: `field-${field}` }
            });
            fieldOption.createEl('label', {
                text: field,
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
        const closeFilterModal = filterModalTitle.createEl('button', { cls: 'modal-close-button', text: '×' });

        // 筛选字段定义
        const filterFields = [
            { field: 'year', text: '年份' },
            { field: 'rating', text: '评分' },
            { field: 'lastUpdate', text: '更新时间' },
            { field: 'title', text: '标题' },
            { field: 'description', text: '描述' }
        ];

        // 添加条件组合选择
        const conjunctionContainer = filterModalContent.createDiv({ cls: 'conjunction-container' });
        const andRadio = conjunctionContainer.createEl('input', {
            type: 'radio',
            attr: { name: 'conjunction', value: 'and', id: 'conj-and' }
        });
        conjunctionContainer.createEl('label', { text: '满足所有条件', attr: { for: 'conj-and' } });
        
        const orRadio = conjunctionContainer.createEl('input', {
            type: 'radio',
            attr: { name: 'conjunction', value: 'or', id: 'conj-or' }
        });
        conjunctionContainer.createEl('label', { text: '满足任一条件', attr: { for: 'conj-or' } });

        // 设置初始值
        if (this.filterDefinition.conjunction === 'and') {
            andRadio.checked = true;
        } else {
            orRadio.checked = true;
        }

        // 添加事件监听
        andRadio.addEventListener('change', () => {
            if (andRadio.checked) {
                this.filterDefinition.conjunction = 'and';
                this.plugin.settings.gallerySettings.filterDefinition = this.filterDefinition;
                this.plugin.saveSettings();
                this.renderCards();
                updateFilterDisplay();
            }
        });

        orRadio.addEventListener('change', () => {
            if (orRadio.checked) {
                this.filterDefinition.conjunction = 'or';
                this.plugin.settings.gallerySettings.filterDefinition = this.filterDefinition;
                this.plugin.saveSettings();
                this.renderCards();
                updateFilterDisplay();
            }
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

        // 关闭模态框
        closeFilterModal.addEventListener('click', () => {
            filterModal.classList.remove('show');
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
        const closeSortModal = sortModalTitle.createEl('button', { cls: 'modal-close-button', text: '×' });

        const sortFields = [
            { field: 'year', text: '年份' },
            { field: 'rating', text: '评分' },
            { field: 'lastUpdate', text: '更新时间' },
            { field: 'title', text: '标题' }
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

        // 关闭模态框
        closeSortModal.addEventListener('click', () => {
            sortModal.classList.remove('show');
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
        const filteredCards = cards.filter(card => {
            if (this.selectedCardType !== 'all' && card.type !== this.selectedCardType) {
                return false;
            }

            return this.filterDefinition.conditions.every(condition => {
                if (!condition.enabled) return true;

                const value = condition.field === 'lastUpdate' 
                    ? card.lastUpdate 
                    : condition.field.startsWith('meta.') 
                        ? card.data?.meta?.[condition.field.split('.')[1]] 
                        : card.data?.[condition.field];

                switch (condition.operator) {
                    case 'contains':
                        return String(value).toLowerCase().includes(String(condition.value).toLowerCase());
                    case 'equals':
                        return String(value) === condition.value;
                    case 'greater':
                        return parseFloat(value) > parseFloat(condition.value);
                    case 'less':
                        return parseFloat(value) < parseFloat(condition.value);
                    default:
                        return true;
                }
            });
        });

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
            }

            // 获取卡片容器
            const newCardsContainer = cardContainer.querySelector('.new-cards-container');
            if (newCardsContainer) {
                // 添加反链图标和容器
                const backlinksContainer = newCardsContainer.createDiv({ cls: 'card-backlinks-container' });
                const backlinksIcon = backlinksContainer.createDiv({ cls: 'card-backlinks-icon' });
                backlinksIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>';
                const backlinksDropdown = backlinksContainer.createDiv({ cls: 'card-backlinks-dropdown' });

                // 获取卡片所在的笔记和引用了当前卡片的笔记
                const cardIndex = await CardUtils.loadCardIndex(this.plugin.app.vault);
                const cardInfo = cardIndex[card.cid];
                const resolvedLinks = this.plugin.app.metadataCache.resolvedLinks;
                
                // 显示卡片所在的笔记
                if (cardInfo && cardInfo.locations && cardInfo.locations.length > 0) {
                    // 按文件路径排序
                    const locations = [...cardInfo.locations].sort((a, b) => a.path.localeCompare(b.path));
                    
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