# New Cards Plugin

A card-style content display plugin for Obsidian, supporting three types of cards: music, books, and movies.

## Features

- Support for three card types: music, books, and movies
- Beautiful card-style layout
- Cover image display support
- Tag system support
- Custom metadata support
- URL link support (both external links and Obsidian internal links)

## Installation

1. Open Settings in Obsidian
2. Go to Third-party plugins
3. Disable Safe mode
4. Click Browse community plugins
5. Search for "New Cards"
6. Click Install
7. Enable the plugin

## Usage

### Music Card

Create a music card using the `music-card` code block:

```music-card
title: Song Title
artist: Artist Name
year: 2024
description: Brief description
cover: Cover image link
tags: tag1 tag2
url: Link address
meta.genre: Pop
meta.album: Album Name
```

### Book Card

Create a book card using the `book-card` code block:

```book-card
title: Book Title
author: Author Name
year: 2024
description: Brief description
cover: Cover image link
tags: #tag1 #tag2
url: Link address
meta.publisher: Publisher
meta.pages: Page count
```

### Movie Card

Create a movie card using the `movie-card` code block:

```movie-card
title: Movie Title
director: Director Name
year: 2024
description: Brief description
cover: Cover image link
tags: #tag1 #tag2
url: Link address
meta.duration: Duration
meta.rating: Rating
```

## Field Descriptions

### Common Fields

- `title`: Title (required)
- `year`: Year (required)
- `description`: Description (required)
- `cover`: Cover image link (optional)
  - Supports external image links (http/https)
  - Supports Obsidian internal image links (![[image name]])
- `tags`: Tags, separated by spaces (optional)
- `url`: Link address (optional)
  - Supports external links (http/https)
  - Supports obsidian:// protocol links
- `meta.*`: Custom metadata (optional)

### Specific Fields

- Music card: `artist` (Artist name, required)
- Book card: `author` (Author name, required)
- Movie card: `director` (Director name, required)

## Timeline Plugin Integration

Cards from this plugin can be used in the Timeline plugin. In Timeline, cards are automatically sorted by the `year` field. Example:

```markdown
```timeline
```music-card
title: Song Title
artist: Artist Name
year: 2024
description: Brief description
```

```book-card
title: Book Title
author: Author Name
year: 2023
description: Brief description
```
```

## Notes

1. All required fields must be filled in, otherwise the card may not display properly
2. Tags should be separated by spaces
3. Custom metadata uses the `meta.` prefix
4. Image links support both external links and Obsidian internal links