# PCards

A card-style content display plugin for Obsidian, supporting seven types of cards: music, books, movies, TV shows, anime, ideas, and quotes. Beautiful card layouts make your notes more visually appealing and organized.

![Card Display Demo](https://raw.githubusercontent.com/Stargazer-cc/obsidian-PCards/main/assets/demo.png)

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Card Types and Fields](#card-types-and-fields)
  - [Common Fields](#common-fields)
  - [Music Card](#music-card)
  - [Book Card](#book-card)
  - [Movie Card](#movie-card)
  - [TV Card](#tv-card)
  - [Anime Card](#anime-card)
  - [Idea Card](#idea-card)
  - [Quote Card](#quote-card)
- [Advanced Features](#advanced-features)
  - [Cards Gallery View](#cards-gallery-view)
  - [Quick Note View](#quick-note-view)
  - [Custom Metadata](#custom-metadata)
  - [Timeline Plugin Integration](#timeline-plugin-integration)
- [FAQ](#faq)
- [Notes](#notes)

## Features

- **Multiple Card Types**: Support for music, books, movies, TV shows, anime, ideas, and quotes
- **Beautiful Card Layout**: Carefully designed card styles that automatically adapt to light/dark themes
- **Cover Image Display**: Support for displaying cover images related to the card
- **Rating System**: Add ratings to media content with color-coded rating badges
- **Tag System**: Add tags to cards for easy categorization and filtering
- **Custom Metadata**: Add any custom fields using the `meta.` prefix
- **Flexible URL Support**: Support for external links and Obsidian internal links
- **Cards Gallery**: Dedicated view to browse and manage all cards
- **Quick Note**: Convenient form interface for quickly adding new cards
- **Filtering and Sorting**: Advanced multi-condition filtering and multi-field sorting

## Installation

### From Obsidian Community Plugins

1. Open Obsidian Settings
2. Go to "Third-party plugins"
3. Disable "Safe mode"
4. Click "Browse community plugins"
5. Search for "PCards"
6. Click "Install"
7. Enable the plugin

### Manual Installation

1. Download the latest release package
2. Extract it to your Obsidian vault's plugins folder: `VaultFolder/.obsidian/plugins/`
3. Restart Obsidian
4. Enable the plugin in Settings

## Quick Start

### Basic Usage Flow

1. **Add Cards**: There are two ways to add cards
   - **Method 1**: Directly use code block syntax in notes
     - Type three backticks \``` followed by the card type (e.g., `music-card`)
     - Fill in the required field information
     - End with three backticks \```
   - **Method 2**: Use the Quick Note view
     - Click the "Quick Note" button in the left sidebar (or use shortcut `Ctrl+Shift+N`)
     - Select the card type
     - Fill in the form
     - Click save

2. **View Cards**:
   - View cards in preview mode within notes
   - Use the Cards Gallery view to see all cards

3. **Manage Cards**:
   - Filter, sort, and manage cards in the Cards Gallery view
   - Click on cards to jump to the corresponding note location

## Card Types and Fields

### Common Fields

All card types support the following common fields:

- `title`: Title (required)
- `year`: Year (required)
- `description`: Description/review (required)
- `rating`: Rating, typically on a scale of 0-10 (optional)
- `cover`: Cover image link (optional)
  - Supports external image links (http/https)
  - Supports Obsidian internal image links (![[image name]])
- `tags`: Tags, separated by spaces (optional)
- `url`: Link address (optional)
  - Supports external links (http/https)
  - Supports obsidian:// protocol links
- `collection_date`: Collection date, format YY-MM-DD (optional)
- `meta.*`: Custom metadata (optional, see [Custom Metadata](#custom-metadata))

### Music Card

Music cards are used to record and display music works.

**Specific Fields**:
- `artist`: Artist/singer name (required)

**Example**:

```music-card
title: Abbey Road
artist: The Beatles
year: 1969
description: The Beatles' eleventh studio album, featuring seamless transitions between songs and innovative production techniques.
rating: 9.5
cover: https://example.com/abbey_road.jpg
tags: #rock #classic #british
url: https://open.spotify.com/album/0ETFjACtuP2ADo6LFhL6HN
collection_date: 22-03-15
meta.genre: Rock
meta.length: 47:23
```

### Book Card

Book cards are used to record and display literary works.

**Specific Fields**:
- `author`: Author name (required)

**Example**:

```book-card
title: To Kill a Mockingbird
author: Harper Lee
year: 1960
description: A powerful story of racial injustice and moral growth seen through the eyes of a young girl in Alabama.
rating: 9.2
cover: ![[to_kill_a_mockingbird.jpg]]
tags: #novel #classic #american
url: https://www.goodreads.com/book/show/2657.To_Kill_a_Mockingbird
collection_date: 21-05-12
meta.publisher: J. B. Lippincott & Co.
meta.pages: 281
```

### Movie Card

Movie cards are used to record and display film works.

**Specific Fields**:
- `director`: Director name (required)

**Example**:

```movie-card
title: Inception
director: Christopher Nolan
year: 2010
description: A mind-bending sci-fi thriller about a thief who steals corporate secrets through dream-sharing technology.
rating: 9.3
cover: https://example.com/inception.jpg
tags: #scifi #action #thriller
url: https://www.imdb.com/title/tt1375666/
collection_date: 20-08-21
meta.cast: Leonardo DiCaprio
meta.runtime: 148 minutes
```

### TV Card

TV cards are used to record and display television series.

**Specific Fields**:
- `director`: Director name (required)

**Example**:

```tv-card
title: Chernobyl
director: Johan Renck
year: 2019
description: HBO's miniseries about the Chernobyl nuclear disaster, depicting the events and aftermath with stark realism.
rating: 9.6
cover: https://example.com/chernobyl.jpg
tags: #drama #history #disaster
url: https://www.imdb.com/title/tt7366338/
collection_date: 22-10-05
meta.seasons: 1
meta.episodes: 5
```

### Anime Card

Anime cards are used to record and display animated works.

**Specific Fields**:
- `director`: Director name (required)

**Example**:

```anime-card
title: Attack on Titan
director: Tetsurō Araki
year: 2013
description: A dark fantasy anime where humanity fights for survival against giant humanoids called Titans.
rating: 9.0
cover: ![[attack_on_titan.jpg]]
tags: #action #dark #epic
url: https://myanimelist.net/anime/16498/Shingeki_no_Kyojin
collection_date: 21-12-18
meta.seasons: 4
meta.episodes: 86
```

### Idea Card

Idea cards are used to record inspirations and thoughts.

**Specific Fields**:
- `idea`: Idea content (required)
- `source`: Source of inspiration (optional)
- `date`: Record date, format YYYY-MM-DD HH:MM:SS (optional)

**Example**:

```idea-card
idea: Integrate PCards plugin with daily journal for automatic monthly media consumption reports.
source: Obsidian community discussion
date: 2023-08-15 14:32:50
tags: #plugin #project_idea
url: https://github.com/Stargazer-cc/obsidian-PCards/issues
```

### Quote Card

Quote cards are used to record excerpts from books, articles, etc.

**Specific Fields**:
- `quote`: Quote content (required)
- `source`: Source (optional)
- `date`: Record date, format YYYY-MM-DD HH:MM:SS (optional)

**Example**:

```quote-card
quote: It is our choices that show what we truly are, far more than our abilities.
source: Harry Potter and the Chamber of Secrets - J.K. Rowling
date: 2023-05-20 09:45:12
tags: #inspiration #wisdom
url: https://www.goodreads.com/book/show/15881.Harry_Potter_and_the_Chamber_of_Secrets
```

## Advanced Features

### Cards Gallery View

The Cards Gallery view provides an interface for centralized management of all cards.

**Features**:
- Filter cards by type
- Set multi-condition filter rules
- Customize sorting rules
- Adjust column count and visible fields
- Click cards to jump to original note location

**How to Open**:
- Search "PCards: Open Cards Gallery" in the command palette
- Click the Cards Gallery icon in the sidebar

### Quick Note View

The Quick Note view provides a convenient form interface for quickly adding new cards.

**Features**:
- Select card type
- Fill in form fields
- Add custom metadata fields
- Save to specified note with one click

**How to Open**:
- Search "PCards: Open Quick Note" in the command palette
- Use shortcut `Ctrl+Shift+N`
- Click the Quick Note icon in the sidebar

**Custom Metadata**:
- In movie, book, music, TV, and anime card forms, you can add any number of custom metadata fields
- Click the "Add Metadata Field" button to add more fields
- Each field includes a field name and field value input
- When saved, custom metadata is automatically added to the card's `meta` section

### Custom Metadata

You can add any custom fields to cards using the `meta.` prefix.

**Format**: `meta.field_name: field_value`

**Example**:
```
meta.director: Christopher Nolan
meta.cast: Leonardo DiCaprio
meta.runtime: 148 minutes
meta.watch_date: 2023-01-15
```

### Timeline Plugin Integration

PCards can integrate with the Timeline plugin to display card content in a timeline.

**Example**:
```markdown
```timeline
```music-card
title: Abbey Road
artist: The Beatles
year: 1969
description: Classic album
```

```book-card
title: To Kill a Mockingbird
author: Harper Lee
year: 1960
description: American classic
```
```
```

## FAQ

**Q: Why aren't my cards displaying properly?**  
A: Ensure all required fields are filled in. Music cards need `title`, `artist`, `year`, and `description`; Book cards need `title`, `author`, `year`, and `description`; Movie/TV/Anime cards need `title`, `director`, `year`, and `description`.

**Q: How can I use Obsidian internal links in cards?**  
A: For the `url` field, you can use the `obsidian://` protocol to link to internal notes; for the `cover` field, you can use the `![[image name]]` format to reference images in your vault.

**Q: How do I refresh the card index?**  
A: Click the "Refresh Index" button in the Cards Gallery view. The plugin will scan all note files and update the card index.

**Q: Can I customize card styles?**  
A: You can customize text colors in the plugin settings, or further customize styles using CSS snippets.

**Q: How can I bulk import cards?**  
A: The plugin doesn't directly support bulk import, but you can prepare a Markdown file with multiple card code blocks and import it into Obsidian.

**Q: How do I add custom metadata fields?**  
A: In the Quick Note view, all media card types (movie, book, music, TV, anime) provide a custom metadata section where you can add any number of field names and values. You can also manually add them when writing cards using the `meta.field_name: field_value` format.

## Notes

1. **Required Fields**: All required fields must be filled in, otherwise cards may not display properly.
2. **Tag Format**: Tags should be separated by spaces, and can optionally use the `#` prefix.
3. **Custom Metadata**: Use the `meta.` prefix to define metadata; you can add any custom fields.
4. **Image Links**: Both external links and Obsidian internal links are supported; internal links use the format `![[image name]]`.
5. **Index Updates**: If cards aren't showing up, try refreshing the index in the Cards Gallery view.
6. **Save Paths**: You can specify default save paths for each card type in settings.