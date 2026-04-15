/**
 * ReviewStore - 锐评数据管理
 * 负责所有锐评的增删改查和设置持久化
 */

const SETTINGS_KEY = 'shu_review_board';

export class ReviewStore {
  constructor(extensionSettings, saveSettingsDebounced) {
    this.extensionSettings = extensionSettings;
    this.saveSettingsDebounced = saveSettingsDebounced;
    this._init();
  }

  //========== 初始化 ==========

  _init() {
    if (!this.extensionSettings[SETTINGS_KEY]) {
      this.extensionSettings[SETTINGS_KEY] = this._getDefaultSettings();
    }

    // 版本兼容：确保所有必需字段存在
    const s = this.getSettings();
    const defaults = this._getDefaultSettings();
    for (const [key, value] of Object.entries(defaults)) {
      if (s[key] === undefined) {
        s[key] = value;
      }
    }
    this.save();
  }

  _getDefaultSettings() {
    return {
      userNickname: '',
      maxChatMessages: 30,
      autoPrompt: false,
      autoPromptInterval: 20,
      messageCounter: 0,
      reviews: [],
    };
  }

  getSettings() {
    return this.extensionSettings[SETTINGS_KEY];
  }

  // ========== 用户称呼 ==========

  getUserNickname() {
    return this.getSettings().userNickname || '老大';
  }

  setUserNickname(name) {
    this.getSettings().userNickname = name;
    this.save();
  }

  // ==========锐评 CRUD ==========

  addReview(data) {
    const review = {
      id: this._generateId(),
      timestamp: Date.now(),
      characterName: data.characterName || '未知角色',
      chatId: data.chatId || '',
      chatTitle: data.chatTitle || '',
      personality: data.personality || [],
      content: data.content || '',
      mode: data.mode || 'manual',
      liked: false,
      pinned: false,
      ownerComment: '',};
    this.getSettings().reviews.unshift(review);
    this.save();
    return review;
  }

  deleteReview(id) {
    const s = this.getSettings();
    const idx = s.reviews.findIndex(r => r.id === id);
    if (idx !== -1) {
      s.reviews.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  updateReview(id, updates) {
    const review = this.getReviewById(id);
    if (review) {
      Object.assign(review, updates);
      this.save();
      return review;
    }
    return null;
  }

  getReviewById(id) {
    return this.getSettings().reviews.find(r => r.id === id) || null;
  }

  /**
   * 获取锐评列表
   * @param {Object} filter - 筛选条件
   * @param {string} filter.characterName - 按角色名筛选
   * @param {string} filter.chatId - 按聊天ID筛选
   * @param {boolean} filter.pinnedOnly - 只看置顶
   * @param {boolean} filter.likedOnly - 只看点赞
   * @returns {Array} 排序后的锐评列表
   */
  getReviews(filter = {}) {
    let reviews = [...this.getSettings().reviews];

    if (filter.characterName) {
      reviews = reviews.filter(r => r.characterName === filter.characterName);
    }
    if (filter.chatId) {
      reviews = reviews.filter(r => r.chatId === filter.chatId);
    }
    if (filter.pinnedOnly) {
      reviews = reviews.filter(r => r.pinned);
    }
    if (filter.likedOnly) {
      reviews = reviews.filter(r => r.liked);
    }

    // 排序：置顶优先 → 时间倒序
    reviews.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.timestamp - a.timestamp;
    });

    return reviews;
  }

  /**
   * 获取所有出现过的角色名（用于分组视图和筛选下拉框）
   */
  getCharacterNames() {
    const names = new Set();
    this.getSettings().reviews.forEach(r => {
      if (r.characterName) names.add(r.characterName);
    });
    return Array.from(names).sort();
  }

  // ========== 互动操作 ==========

  toggleLike(id) {
    const review = this.getReviewById(id);
    if (review) {
      review.liked = !review.liked;
      this.save();
      return review.liked;
    }
    return false;
  }

  togglePin(id) {
    const review = this.getReviewById(id);
    if (review) {
      review.pinned = !review.pinned;
      this.save();
      return review.pinned;
    }
    return false;
  }

  setOwnerComment(id, comment) {
    const review = this.getReviewById(id);
    if (review) {
      review.ownerComment = comment;
      this.save();
      return true;
    }
    return false;
  }

  // ========== 自动提醒 ==========

  incrementCounter() {
    this.getSettings().messageCounter++;
    // 不立即save，减少写入频率……反正counter丢了也没大事}

  resetCounter() {
    this.getSettings().messageCounter = 0;
    this.save();
  }

  shouldAutoPrompt() {
    const s = this.getSettings();
    if (!s.autoPrompt || !s.autoPromptInterval) return false;
    return s.messageCounter >= s.autoPromptInterval;
  }

  getAutoPromptSettings() {
    const s = this.getSettings();
    return {
      enabled: !!s.autoPrompt,
      interval: s.autoPromptInterval || 20,
    };
  }

  setAutoPromptSettings(enabled, interval) {
    const s = this.getSettings();
    s.autoPrompt = !!enabled;
    if (interval !== undefined) {
      s.autoPromptInterval = Math.max(5, Math.min(200, interval));
    }
    this.save();
  }

  // ========== 参考消息数==========

  getMaxChatMessages() {
    return this.getSettings().maxChatMessages || 30;
  }

  setMaxChatMessages(n) {
    this.getSettings().maxChatMessages = Math.max(5, Math.min(100, n));
    this.save();
  }

  // ========== 统计 ==========

  getReviewCount() {
    return this.getSettings().reviews.length;
  }

  // ========== 工具 ==========

  save() {
    this.saveSettingsDebounced();
  }

  _generateId() {
    return `rev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }
}
