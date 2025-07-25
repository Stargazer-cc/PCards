import { SHA256 } from 'crypto-js';
import { TFile } from 'obsidian';

export interface CardLocation {
  path: string;
  startLine: number;
  endLine: number;
}

interface CardIndex {
  [key: string]: {
    content: string;
    locations: CardLocation[];
    lastUpdated: string;
  }
}

export class CardUtils {
  private static base62Chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  
  static async getCardContentByCID(vault: any, cid: string): Promise<string | null> {
    const index = await this.loadCardIndex(vault);
    return index[cid]?.content || null;
  }

  static async findCIDByContent(vault: any, content: string): Promise<string | null> {
    const index = await this.loadCardIndex(vault);
    const newCID = this.generateCID(content);
    
    // 首先检查是否已存在相同的CID
    if (index[newCID]) {
      return newCID;
    }
    
    // 遍历所有卡片，检查是否有相同内容的卡片
    for (const cid in index) {
      if (index[cid].content === content) {
        return cid;
      }
    }
    
    return null;
  }

  static async updateCardLocations(vault: any, oldCID: string, newCID: string): Promise<void> {
    const index = await this.loadCardIndex(vault);
    if (index[oldCID]) {
      const locations = index[oldCID].locations;
      delete index[oldCID];
      if (index[newCID]) {
        index[newCID].locations = [...new Set([...index[newCID].locations, ...locations])];
      }
      await this.saveCardIndex(vault, index);
    }
  }

  static base62Encode(hex: string): string {
    let num = BigInt('0x' + hex);
    let encoded = '';
    while (num > 0n) {
      encoded = this.base62Chars[Number(num % 62n)] + encoded;
      num = num / 62n;
    }
    return encoded.padStart(8, '0');
  }

  static normalizeContent(content: string): string {
    return content
      .toLowerCase() // 统一转换为小写
      .replace(/\s+/g, '') // 去除所有空白字符（包括空格、制表符、换行符等）
      .replace(/[^\w\u4e00-\u9fa5]/g, ''); // 只保留字母、数字、下划线和中文字符
  }

  static generateCID(content: string): string {
    // 仅在计算哈希值时对内容进行标准化处理
    const normalizedContent = this.normalizeContent(content);
    const hash = SHA256(normalizedContent).toString();
    return 'CID-' + this.base62Encode(hash.substring(0, 16));
  }

  static async loadCardIndex(vault: any): Promise<CardIndex> {
    try {
      const indexFile = vault.getAbstractFileByPath('card-index.json');
      if (indexFile instanceof TFile) {
        const content = await vault.read(indexFile);
        return JSON.parse(content);
      }
    } catch (error) {
      console.error('Failed to load card index:', error);
    }
    return {};
  }

  static async saveCardIndex(vault: any, index: CardIndex): Promise<void> {
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
      try {
        const content = JSON.stringify(index, null, 2);
        const indexFile = vault.getAbstractFileByPath('card-index.json');
        
        if (indexFile instanceof TFile) {
          await vault.modify(indexFile, content);
          console.log(`卡片索引已成功保存，条目数量: ${Object.keys(index).length}`);
        } else {
          await vault.create('card-index.json', content);
          console.log(`卡片索引文件已成功创建，条目数量: ${Object.keys(index).length}`);
        }
        
        return; // 成功保存，退出函数
      } catch (error) {
        retryCount++;
        console.error(`保存卡片索引失败 (尝试 ${retryCount}/${maxRetries}):`, error);
        
        if (retryCount >= maxRetries) {
          console.error('达到最大重试次数，无法保存卡片索引');
          throw new Error(`保存卡片索引失败: ${error.message}`);
        }
        
        // 等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private static isLocationInCard(location: CardLocation, cardLocation: CardLocation): boolean {
    return location.path === cardLocation.path &&
           location.startLine >= cardLocation.startLine &&
           location.endLine <= cardLocation.endLine;
  }

  static async updateCardIndex(vault: any, cid: string, content: string, location: CardLocation): Promise<string> {
    const index = await this.loadCardIndex(vault);
    const newCID = this.generateCID(content);
    
    // 如果内容相同但CID不同，需要更新所有使用旧CID的位置
    if (newCID !== cid) {
      // 首先验证修改位置是否属于当前卡片，考虑嵌入视图的情况
      if (!index[cid] || (!index[cid].locations.some(loc => this.isLocationInCard(location, loc)) && 
          !index[cid].locations.some(loc => loc.path === location.path))) {
        console.warn('修改位置不属于当前卡片');
        return cid;
      }

      const existingCID = await this.findCIDByContent(vault, content);
      if (existingCID) {
        // 如果找到相同内容的卡片，使用其CID
        await this.updateCardLocations(vault, cid, existingCID);
        // 更新当前位置的内容
        const file = vault.getAbstractFileByPath(location);
        if (file instanceof TFile) {
          const fileContent = await vault.read(file);
          const updatedContent = fileContent.replace(
            new RegExp(`\[\[card:${cid}\]\]([\s\S]*?)\[\[/card\]\]`),
            `[[card:${existingCID}]]${content}[[/card]]`
          );
          await vault.modify(file, updatedContent);
        }
        return existingCID;
      }
      
      // 如果是新内容，则创建新的CID条目并更新所有位置
      if (index[cid] && index[cid].locations.some(loc => this.isLocationInCard(location, loc))) {
        // 保存旧CID的locations并更新所有位置的内容
        const oldLocations = index[cid].locations;
        
        // 先更新所有位置的内容和CID
        for (const loc of oldLocations) {
          try {
            const file = vault.getAbstractFileByPath(loc.path);
            if (file instanceof TFile) {
              const fileContent = await vault.read(file);
              const updatedContent = fileContent.replace(
                new RegExp(`\[\[card:${cid}\]\]([\s\S]*?)\[\[/card\]\]`),
                `[[card:${newCID}]]${content}[[/card]]`
              );
              await vault.modify(file, updatedContent);
            }
          } catch (error) {
            console.error(`Failed to update content at location: ${JSON.stringify(loc)}`, error);
            // 如果更新失败，保持使用原有CID
            return cid;
          }
        }
        
        // 所有文件更新成功后，再更新索引
        index[newCID] = {
          content: content,
          locations: [...oldLocations, location],
          lastUpdated: new Date().toISOString()
        };
        
        // 删除旧CID
        delete index[cid];
      } else {
        // 如果是全新的卡片，创建新的CID条目
        index[newCID] = {
          content: content,
          locations: [location],
          lastUpdated: new Date().toISOString()
        };
      }
    } else {
      // 内容未变化，更新现有CID的位置
      if (!index[cid]) {
        // 只有当位置信息有效时才创建新的索引
        if (location.startLine > 0 && location.endLine > 0) {
          index[cid] = {
            content: content,
            locations: [location],
            lastUpdated: new Date().toISOString()
          };
        }
      } else {
        // 清理同一文件中的旧位置记录，只保留最新的位置
        index[cid].locations = index[cid].locations.filter(loc => loc.path !== location.path);
        // 添加新的位置信息
        if (location.startLine > 0 && location.endLine > 0) {
          index[cid].locations.push(location);
        }
        index[cid].lastUpdated = new Date().toISOString();
      }
    }

    await this.saveCardIndex(vault, index);
    return newCID;
  }

  static async removeCardLocation(vault: any, location: CardLocation): Promise<void> {
    const index = await this.loadCardIndex(vault);
    
    // 遍历所有卡片
    for (const cid in index) {
      const card = index[cid];
      // 从locations数组中移除指定位置
      const locationIndex = card.locations.findIndex(
        loc => loc.path === location.path && loc.startLine === location.startLine && loc.endLine === location.endLine
      );
      if (locationIndex !== -1) {
        card.locations.splice(locationIndex, 1);
        // 如果卡片不再有任何位置引用，则删除该卡片
        if (card.locations.length === 0) {
          delete index[cid];
        }
      }
    }

    await this.saveCardIndex(vault, index);
  }

  static async removeCardsByPath(vault: any, path: string): Promise<void> {
    const index = await this.loadCardIndex(vault);
    let removedCount = 0;
    let modifiedCount = 0;
    
    console.log(`开始清理路径 ${path} 的卡片索引...`);
    
    try {
      // 遍历所有卡片
      for (const cid in index) {
        const card = index[cid];
        const originalLocationsCount = card.locations.length;
        
        // 移除指定路径下的所有位置
        card.locations = card.locations.filter(loc => loc.path !== path);
        
        // 如果过滤后位置数量减少，记录被修改的卡片
        if (card.locations.length < originalLocationsCount) {
          modifiedCount++;
          
          // 如果卡片不再有任何位置引用，则删除该卡片
          if (card.locations.length === 0) {
            delete index[cid];
            removedCount++;
            console.log(`已删除卡片索引: ${cid}`);
          } else {
            console.log(`已从卡片 ${cid} 中移除路径 ${path} 的位置引用`);
          }
        }
      }
      
      console.log(`清理完成，共修改 ${modifiedCount} 个卡片索引，完全删除 ${removedCount} 个卡片索引`);
      
      // 保存索引
      await this.saveCardIndex(vault, index);
    } catch (error) {
      console.error(`清理路径 ${path} 的卡片索引时出错:`, error);
      throw error; // 抛出错误以便上层处理
    }
  }
}