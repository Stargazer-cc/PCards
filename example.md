# PCards 使用示例

本文档展示了PCards插件支持的各种卡片类型及其使用方法。

## 基础卡片展示

以下是各种类型卡片的基础展示：

### 音乐卡片

```music-card
title: 七里香
artist: 周杰伦
year: 2004
description: 周杰伦第五张专辑，融合中国风与现代流行音乐元素，歌词优美，旋律动听。
rating: 9.2
cover: https://example.com/qilixiang.jpg
tags: #华语 #流行 #经典
url: https://music.163.com/song?id=186016
collection_date: 22-03-15
meta.album: 七里香
meta.genre: 流行
```

### 书籍卡片

```book-card
title: 活着
author: 余华
year: 1993
description: 一部描述中国农村人生活的小说，通过福贵的一生展现了人如何在困境中求生存的故事。
rating: 9.4
cover: https://example.com/huozhe.jpg
tags: #小说 #中国文学 #经典
url: https://book.douban.com/subject/4913064/
collection_date: 21-05-12
meta.publisher: 作家出版社
meta.pages: 248
```

### 电影卡片

```movie-card
title: 盗梦空间
director: 克里斯托弗·诺兰
year: 2010
description: 一部极具创意的科幻电影，通过多层梦境探索潜意识世界，情节扣人心弦。
rating: 9.3
cover: https://example.com/inception.jpg
tags: #科幻 #动作 #悬疑
url: https://movie.douban.com/subject/3541415/
collection_date: 20-08-21
meta.主演: 莱昂纳多·迪卡普里奥
meta.时长: 148分钟
```

### 剧集卡片

```tv-card
title: 切尔诺贝利
director: 约翰·伦克
year: 2019
description: HBO出品的核灾难迷你剧，真实还原切尔诺贝利核电站事故及其影响。
rating: 9.6
cover: https://example.com/chernobyl.jpg
tags: #剧情 #历史 #灾难
url: https://movie.douban.com/subject/27098632/
collection_date: 22-10-05
meta.季数: 1
meta.集数: 5
```

### 番剧卡片

```anime-card
title: 进击的巨人
director: 荒木哲郎
year: 2013
description: 人类与巨人的生存之战，剧情紧凑，世界观宏大，伦理思考深刻。
rating: 9.0
cover: https://example.com/attack_on_titan.jpg
tags: #动作 #黑暗 #史诗
url: https://bangumi.tv/subject/38854
collection_date: 21-12-18
meta.季数: 4
meta.集数: 86
```

### 想法卡片

```idea-card
idea: 将PCards插件与日记系统结合，自动生成每月媒体消费报告。
source: Obsidian社区讨论
date: 2023-08-15 14:32:50
tags: #插件 #项目点子
url: https://github.com/Stargazer-cc/obsidian-PCards/issues
```

### 摘录卡片

```quote-card
quote: 生活不能等待别人来安排，要自己去争取和奋斗。
source: 《平凡的世界》 - 路遥
date: 2023-05-20 09:45:12
tags: #名言 #激励
url: https://book.douban.com/subject/1084165/
```

## 与Timeline插件集成

PCards可以与Timeline插件集成，展示时间线上的媒体消费记录：

```timeline-labeled
[line-3, body-2]
date: 2023-01-15
title: 看了一部电影
content: 
    ```movie-card
    title: 盗梦空间
    director: 克里斯托弗·诺兰
    year: 2010
    description: 在这部科幻动作片中，一位经验丰富的盗梦者必须完成一个看似不可能的任务。
    tags: #科幻 #动作 #经典
    rating: 9.3
    cover: https://example.com/inception.jpg
    meta.主演: 莱昂纳多·迪卡普里奥
    ```
date: 2023-02-20
title: 听了一张专辑
content:
    ```music-card
    title: 七里香
    artist: 周杰伦
    year: 2004
    description: 周杰伦第五张专辑，融合中国风与现代流行音乐。
    tags: #华语 #流行
    rating: 9.2
    cover: https://example.com/qilixiang.jpg
    ```
date: 2023-03-10
title: 读了一本书
content:
    ```book-card
    title: 活着
    author: 余华
    year: 1993
    description: 一部描述中国农村人生活的小说，通过福贵的一生展现了人如何在困境中求生存的故事。
    tags: #小说 #中国文学
    rating: 9.4
    cover: https://example.com/huozhe.jpg
    ```
```

## 使用技巧

1. **批量展示**：您可以在一个笔记中插入多个卡片，它们会自动排列。
2. **标签筛选**：在卡片总览视图中，您可以通过标签快速筛选相关卡片。
3. **自定义元数据**：使用`meta.`前缀添加任意自定义字段，这些字段也可以用于筛选。
4. **卡片评分**：评分在7.0以上会显示为"优秀"徽章，评分低于7.0会显示为普通徽章。
5. **封面图片**：可以使用网络图片链接或Obsidian库内的图片（使用`![[图片名称]]`格式）。

## 常见问题

- 如果卡片没有正确显示，请确保所有必填字段都已填写。
- 如果更新了卡片内容但显示未变化，请在卡片总览视图中点击"刷新索引"。
- 标签可以使用`#`前缀，也可以直接使用标签名，两种形式都有效。