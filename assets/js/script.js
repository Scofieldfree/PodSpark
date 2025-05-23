// 播客应用主要JavaScript文件

// 全局变量
let currentAudio = null;
let isPlaying = false;
let currentTime = 0;
let duration = 0;

// 工具函数
const utils = {
  // 格式化时间
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  },

  // 节流函数
  throttle(func, limit) {
    let inThrottle;
    return function () {
      const args = arguments;
      const context = this;
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  // 防抖函数
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // 获取随机数
  randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  // 本地存储操作
  storage: {
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.warn("无法保存到本地存储:", e);
      }
    },

    get(key) {
      try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
      } catch (e) {
        console.warn("无法从本地存储读取:", e);
        return null;
      }
    },

    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn("无法从本地存储删除:", e);
      }
    },
  },
};

// 音频播放器类
class AudioPlayer {
  constructor() {
    this.audio = null;
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.volume = 0.8;
    this.callbacks = {};

    this.init();
  }

  init() {
    // 从本地存储恢复音量设置
    const savedVolume = utils.storage.get("podcast_volume");
    if (savedVolume !== null) {
      this.volume = savedVolume;
    }
  }

  // 注册事件回调
  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  // 触发事件
  emit(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach((callback) => callback(data));
    }
  }

  // 加载音频
  load(src, metadata = {}) {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }

    this.audio = new Audio(src);
    this.audio.volume = this.volume;

    // 绑定事件
    this.audio.addEventListener("loadedmetadata", () => {
      this.duration = this.audio.duration;
      this.emit("durationchange", this.duration);
    });

    this.audio.addEventListener("timeupdate", () => {
      this.currentTime = this.audio.currentTime;
      this.emit("timeupdate", {
        currentTime: this.currentTime,
        duration: this.duration,
        progress: this.duration ? this.currentTime / this.duration : 0,
      });
    });

    this.audio.addEventListener("ended", () => {
      this.isPlaying = false;
      this.emit("ended");
    });

    this.audio.addEventListener("play", () => {
      this.isPlaying = true;
      this.emit("play");
    });

    this.audio.addEventListener("pause", () => {
      this.isPlaying = false;
      this.emit("pause");
    });

    this.emit("load", metadata);
  }

  // 播放
  play() {
    if (this.audio) {
      this.audio.play();
    }
  }

  // 暂停
  pause() {
    if (this.audio) {
      this.audio.pause();
    }
  }

  // 切换播放状态
  toggle() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  // 设置播放进度
  setCurrentTime(time) {
    if (this.audio) {
      this.audio.currentTime = time;
    }
  }

  // 设置音量
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audio) {
      this.audio.volume = this.volume;
    }
    utils.storage.set("podcast_volume", this.volume);
    this.emit("volumechange", this.volume);
  }

  // 快进
  seekForward(seconds = 30) {
    if (this.audio) {
      this.setCurrentTime(Math.min(this.audio.currentTime + seconds, this.duration));
    }
  }

  // 快退
  seekBackward(seconds = 30) {
    if (this.audio) {
      this.setCurrentTime(Math.max(this.audio.currentTime - seconds, 0));
    }
  }
}

// 全局播放器实例
const player = new AudioPlayer();

// 通知系统
class NotificationSystem {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    // 创建通知容器
    this.container = document.createElement("div");
    this.container.className = "fixed top-4 right-4 z-50 space-y-2";
    document.body.appendChild(this.container);
  }

  show(message, type = "info", duration = 3000) {
    const notification = document.createElement("div");
    notification.className = `notification ${type} transform translate-x-full`;

    const icons = {
      success: "✓",
      error: "✗",
      warning: "⚠",
      info: "ℹ",
    };

    notification.innerHTML = `
      <div class="flex items-center space-x-3">
        <span class="text-lg">${icons[type] || icons.info}</span>
        <span class="text-sm font-medium">${message}</span>
      </div>
    `;

    this.container.appendChild(notification);

    // 显示动画
    setTimeout(() => {
      notification.classList.remove("translate-x-full");
      notification.classList.add("translate-x-0");
    }, 10);

    // 自动隐藏
    setTimeout(() => {
      this.hide(notification);
    }, duration);

    return notification;
  }

  hide(notification) {
    notification.classList.add("translate-x-full");
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }
}

// 全局通知实例
const notifications = new NotificationSystem();

// 播客数据管理
class PodcastData {
  constructor() {
    this.podcasts = [];
    this.episodes = [];
    this.subscriptions = [];
    this.favorites = [];
    this.playHistory = [];

    this.loadData();
  }

  loadData() {
    // 从本地存储加载数据
    this.subscriptions = utils.storage.get("podcast_subscriptions") || [];
    this.favorites = utils.storage.get("podcast_favorites") || [];
    this.playHistory = utils.storage.get("podcast_history") || [];

    // 加载示例数据
    this.loadSampleData();
  }

  loadSampleData() {
    this.podcasts = [
      {
        id: 1,
        title: "科技聊天室",
        description: "深度探讨最新科技趋势和创新",
        image: "https://images.unsplash.com/photo-1488229297570-58520851e868?w=300&h=300&fit=crop",
        author: "科技小栈",
        category: "科技",
        rating: 4.8,
        subscriberCount: 12500,
        episodeCount: 125,
        isSubscribed: false,
      },
      {
        id: 2,
        title: "商业新视角",
        description: "商业洞察与创业故事分享",
        image: "https://images.unsplash.com/photo-1664575602276-acd073f104c1?w=300&h=300&fit=crop",
        author: "商业观察者",
        category: "商业",
        rating: 4.6,
        subscriberCount: 8900,
        episodeCount: 89,
        isSubscribed: true,
      },
      {
        id: 3,
        title: "生活美学",
        description: "发现日常生活中的美好瞬间",
        image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
        author: "美学生活家",
        category: "生活",
        rating: 4.9,
        subscriberCount: 15600,
        episodeCount: 67,
        isSubscribed: false,
      },
    ];

    this.episodes = [
      {
        id: 1,
        podcastId: 1,
        title: "人工智能的未来展望",
        description: "探讨AI技术的发展趋势和对社会的影响",
        duration: 2580, // 43分钟
        publishDate: "2024-01-15",
        playCount: 5600,
        isPlayed: false,
        isFavorite: false,
        audioUrl: "#", // 示例URL
      },
      {
        id: 2,
        podcastId: 1,
        title: "区块链技术深度解析",
        description: "从技术角度深入理解区块链的原理和应用",
        duration: 3240, // 54分钟
        publishDate: "2024-01-10",
        playCount: 4200,
        isPlayed: true,
        isFavorite: true,
        audioUrl: "#",
      },
      {
        id: 3,
        podcastId: 2,
        title: "创业公司的融资策略",
        description: "分享创业公司在不同阶段的融资经验和技巧",
        duration: 2100, // 35分钟
        publishDate: "2024-01-12",
        playCount: 3800,
        isPlayed: false,
        isFavorite: false,
        audioUrl: "#",
      },
    ];
  }

  // 获取播客列表
  getPodcasts(category = null, searchQuery = null) {
    let results = [...this.podcasts];

    if (category) {
      results = results.filter((podcast) => podcast.category === category);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      results = results.filter(
        (podcast) =>
          podcast.title.toLowerCase().includes(query) ||
          podcast.description.toLowerCase().includes(query) ||
          podcast.author.toLowerCase().includes(query)
      );
    }

    return results;
  }

  // 获取单集列表
  getEpisodes(podcastId = null) {
    if (podcastId) {
      return this.episodes.filter((episode) => episode.podcastId === podcastId);
    }
    return [...this.episodes];
  }

  // 订阅播客
  subscribe(podcastId) {
    if (!this.subscriptions.includes(podcastId)) {
      this.subscriptions.push(podcastId);
      utils.storage.set("podcast_subscriptions", this.subscriptions);

      // 更新播客状态
      const podcast = this.podcasts.find((p) => p.id === podcastId);
      if (podcast) {
        podcast.isSubscribed = true;
      }

      notifications.show("订阅成功！", "success");
    }
  }

  // 取消订阅
  unsubscribe(podcastId) {
    this.subscriptions = this.subscriptions.filter((id) => id !== podcastId);
    utils.storage.set("podcast_subscriptions", this.subscriptions);

    // 更新播客状态
    const podcast = this.podcasts.find((p) => p.id === podcastId);
    if (podcast) {
      podcast.isSubscribed = false;
    }

    notifications.show("已取消订阅", "info");
  }

  // 添加到收藏
  addToFavorites(episodeId) {
    if (!this.favorites.includes(episodeId)) {
      this.favorites.push(episodeId);
      utils.storage.set("podcast_favorites", this.favorites);

      // 更新单集状态
      const episode = this.episodes.find((e) => e.id === episodeId);
      if (episode) {
        episode.isFavorite = true;
      }

      notifications.show("已添加到收藏", "success");
    }
  }

  // 从收藏移除
  removeFromFavorites(episodeId) {
    this.favorites = this.favorites.filter((id) => id !== episodeId);
    utils.storage.set("podcast_favorites", this.favorites);

    // 更新单集状态
    const episode = this.episodes.find((e) => e.id === episodeId);
    if (episode) {
      episode.isFavorite = false;
    }

    notifications.show("已从收藏移除", "info");
  }

  // 记录播放历史
  addToHistory(episodeId) {
    const historyItem = {
      episodeId,
      playDate: new Date().toISOString(),
      progress: 0,
    };

    // 移除重复项
    this.playHistory = this.playHistory.filter((item) => item.episodeId !== episodeId);

    // 添加到开头
    this.playHistory.unshift(historyItem);

    // 限制历史记录数量
    if (this.playHistory.length > 100) {
      this.playHistory = this.playHistory.slice(0, 100);
    }

    utils.storage.set("podcast_history", this.playHistory);
  }
}

// 全局数据实例
const podcastData = new PodcastData();

// 搜索功能
const searchManager = {
  searchQuery: "",
  searchResults: [],
  searchHistory: utils.storage.get("search_history") || [],

  search(query) {
    this.searchQuery = query;

    if (!query.trim()) {
      this.searchResults = [];
      return;
    }

    // 添加到搜索历史
    this.addToHistory(query);

    // 搜索播客和单集
    const podcasts = podcastData.getPodcasts(null, query);
    const episodes = podcastData.getEpisodes().filter((episode) => {
      const episodeQuery = query.toLowerCase();
      return (
        episode.title.toLowerCase().includes(episodeQuery) || episode.description.toLowerCase().includes(episodeQuery)
      );
    });

    this.searchResults = {
      podcasts,
      episodes,
      total: podcasts.length + episodes.length,
    };

    return this.searchResults;
  },

  addToHistory(query) {
    // 移除重复项
    this.searchHistory = this.searchHistory.filter((item) => item !== query);

    // 添加到开头
    this.searchHistory.unshift(query);

    // 限制历史记录数量
    if (this.searchHistory.length > 20) {
      this.searchHistory = this.searchHistory.slice(0, 20);
    }

    utils.storage.set("search_history", this.searchHistory);
  },

  clearHistory() {
    this.searchHistory = [];
    utils.storage.remove("search_history");
  },
};

// 主题管理
const themeManager = {
  isDark: utils.storage.get("dark_mode") || false,

  init() {
    this.apply();
  },

  toggle() {
    this.isDark = !this.isDark;
    this.apply();
    utils.storage.set("dark_mode", this.isDark);
  },

  apply() {
    if (this.isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  },
};

// 键盘快捷键
const keyboardManager = {
  init() {
    document.addEventListener("keydown", this.handleKeyDown.bind(this));
  },

  handleKeyDown(event) {
    // 如果焦点在输入框中，不处理快捷键
    if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") {
      return;
    }

    switch (event.code) {
      case "Space":
        event.preventDefault();
        player.toggle();
        break;

      case "ArrowLeft":
        if (event.shiftKey) {
          event.preventDefault();
          player.seekBackward(10);
        }
        break;

      case "ArrowRight":
        if (event.shiftKey) {
          event.preventDefault();
          player.seekForward(10);
        }
        break;

      case "ArrowUp":
        if (event.shiftKey) {
          event.preventDefault();
          player.setVolume(player.volume + 0.1);
        }
        break;

      case "ArrowDown":
        if (event.shiftKey) {
          event.preventDefault();
          player.setVolume(player.volume - 0.1);
        }
        break;
    }
  },
};

// 初始化
document.addEventListener("DOMContentLoaded", function () {
  // 初始化主题
  themeManager.init();

  // 初始化键盘快捷键
  keyboardManager.init();

  // 显示欢迎消息
  setTimeout(() => {
    notifications.show("欢迎使用小宇宙播客！", "success");
  }, 1000);
});

// 导出全局对象供页面使用
window.PodcastApp = {
  player,
  podcastData,
  searchManager,
  themeManager,
  notifications,
  utils,
};
